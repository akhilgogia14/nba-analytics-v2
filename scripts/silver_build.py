"""Build silver and gold tables with MERGE, behind quality gates.

Silver = cleaned, typed rows with one row per key (from bronze). Gold = tables shaped for the app (from silver).
Each table is defined by a SELECT in sql/<layer>/<name>.sql and checked by sql/<layer>/<name>_gates.sql (each
gate returns a bad-row count, 0 = pass). Silver tables are built first, then gold.

Run order:
  1. gates run on the SELECT's rows (before anything is written). Any failure stops the run.
  2. table is created if missing, with Delta Change Data Feed on (a log of which rows changed).
  3. MERGE on the key: new rows inserted, rows whose _row_hash changed updated, rows gone from the
     source removed. Unchanged rows are not touched, so the change feed shows only real changes.
  4. gates run again on the real table, and its row count is compared with the SELECT.
  5. the run is written down: what changed (from the change feed, with a few examples), new oddities
     from sql/silver/<name>_warnings.sql, and one summary row in <schema>._build_log.

Safety: if a MERGE would delete more than 1% of the table's rows, the run stops (use --allow-large-delete
to proceed). Delta keeps old versions, so a bad run can be rolled back with RESTORE.

Dry run by default: runs the gates and reports how many rows a MERGE would insert/update/delete.
Needs the Databricks CLI logged in (profile DEFAULT, or DATABRICKS_HOST/DATABRICKS_TOKEN).
"""
import argparse
import json
import os
from datetime import datetime, timezone
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sqlutil import sql_str  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SQL_ROOT = ROOT / "sql"
SCHEMA = "workspace.nba_v2_silver"  # default schema for the helpers; build() uses the table's own layer


def schema_for(layer):
    """workspace.nba_v2_<layer>, e.g. workspace.nba_v2_gold."""
    return f"workspace.nba_v2_{layer}"


# Each table says which layer it belongs to (its SQL is in sql/<layer>/, the table and its run log live in that
# layer's schema). ORDER MATTERS: every silver table is built before any gold table, because gold reads silver.
TABLES = {
    "player_game": {"key": ["game_id", "person_id"], "layer": "silver"},
    "team_game": {"key": ["game_id", "team_id"], "layer": "silver"},
    "game": {"key": ["game_id"], "layer": "silver"},
    "player_game_log": {"key": ["game_id", "person_id"], "layer": "gold"},
    # A "python" table is written in PySpark: scripts/<module>.py has build(spark) returning a DataFrame. It runs only
    # where a Spark session exists (the Databricks job); the command line skips it.
    "player_form": {"key": ["person_id", "stat"], "layer": "gold", "python": "gold_player_form"},
    "team_form": {"key": ["team_id", "stat"], "layer": "gold", "python": "gold_team_form"},
    "team_vs_opponent": {"key": ["team_id", "opponent_team_id", "season_label", "game_type", "stat"], "layer": "gold", "python": "gold_team_vs_opponent"},
}
MAX_DELETE_FRACTION = 0.01
MAX_EXAMPLES = 5
HOUSEKEEPING = ("_build_log", "_data_warnings")


def strip_comments(sql):
    """Drop whole-line -- comments so the SQL can be placed inside brackets."""
    return "\n".join(l for l in sql.splitlines() if not l.lstrip().startswith("--")).strip()


def source_sql(select_sql):
    """The SELECT plus a hash of every column, used to spot changed rows."""
    return f"SELECT *, sha2(to_json(struct(*)), 256) AS _row_hash FROM ({strip_comments(select_sql)}) _s"


def gates_sql(gates_text, source):
    """Gate query reading from `source` (a table name or the alias silver_src)."""
    return strip_comments(gates_text).replace("{T}", source)


def gates_on_source(select_sql, gates_text):
    return f"WITH silver_src AS ({strip_comments(select_sql)})\n" + gates_sql(gates_text, "silver_src")


def failing_gates(rows):
    """[(gate, bad)] for every gate whose bad-row count is not 0."""
    return [(name, int(bad)) for name, bad in rows if int(bad) != 0]


def create_sql(table, select_sql):
    return (f"CREATE TABLE IF NOT EXISTS {table} TBLPROPERTIES (delta.enableChangeDataFeed = true) AS "
            f"SELECT * FROM ({source_sql(select_sql)}) WHERE 1 = 0")


def merge_sql(table, select_sql, key):
    on = " AND ".join(f"t.{k} <=> s.{k}" for k in key)  # <=> is NULL-safe equality
    return (f"MERGE INTO {table} t USING ({source_sql(select_sql)}) s ON {on}\n"
            "WHEN MATCHED AND t._row_hash <> s._row_hash THEN UPDATE SET *\n"
            "WHEN NOT MATCHED THEN INSERT *\n"
            "WHEN NOT MATCHED BY SOURCE THEN DELETE")


def plan_sql(table, select_sql, key):
    """Counts of rows a MERGE would insert, update, delete."""
    on = " AND ".join(f"t.{k} <=> s.{k}" for k in key)
    return ("SELECT count_if(t._row_hash IS NULL AND s._row_hash IS NOT NULL), "
            "count_if(t._row_hash IS NOT NULL AND s._row_hash IS NOT NULL AND t._row_hash <> s._row_hash), "
            "count_if(s._row_hash IS NULL AND t._row_hash IS NOT NULL) "
            f"FROM {table} t FULL OUTER JOIN ({source_sql(select_sql)}) s ON {on}")


def delete_guard_trips(deletes, table_rows, fraction=MAX_DELETE_FRACTION):
    """True when a MERGE would delete more than `fraction` of the table."""
    return table_rows > 0 and deletes > fraction * table_rows


def changed_columns(cols, pre, post):
    """[(column, old, new)] for columns that differ between the before and after row (hash ignored)."""
    return [(c, a, b) for c, a, b in zip(cols, pre, post) if a != b and c != "_row_hash"]


def create_log_tables_sql(schema=SCHEMA):
    return [
        f"CREATE TABLE IF NOT EXISTS {schema}._build_log (run_id STRING, table_name STRING, run_at TIMESTAMP, "
        "source_rows BIGINT, inserted BIGINT, updated BIGINT, deleted BIGINT, table_rows BIGINT, "
        "version_before BIGINT, version_after BIGINT, new_warnings BIGINT, examples STRING)",
        f"CREATE TABLE IF NOT EXISTS {schema}._data_warnings (run_id STRING, detected_at TIMESTAMP, "
        "table_name STRING, warning STRING, row_key STRING, detail STRING)",
    ]


def warnings_insert_sql(table_name, run_id, warnings_text, source, schema=SCHEMA):
    """Append only warnings not already logged for this table (same warning + row key)."""
    q = gates_sql(warnings_text, source)
    tn, rid = sql_str(table_name), sql_str(run_id)
    return (f"INSERT INTO {schema}._data_warnings\n"
            f"SELECT {rid}, current_timestamp(), {tn}, w.warning, w.row_key, w.detail FROM ({q}) w\n"
            f"WHERE NOT EXISTS (SELECT 1 FROM {schema}._data_warnings x "
            f"WHERE x.table_name = {tn} AND x.warning = w.warning AND x.row_key = w.row_key)")


def log_insert_sql(run_id, table_name, c, schema=SCHEMA):
    """One summary row. `c` has source_rows, inserted, updated, deleted, table_rows, version_before,
    version_after, new_warnings, examples (a JSON string)."""
    vb = "NULL" if c["version_before"] is None else str(int(c["version_before"]))
    return (f"INSERT INTO {schema}._build_log VALUES ({sql_str(run_id)}, {sql_str(table_name)}, "
            f"current_timestamp(), {int(c['source_rows'])}, {int(c['inserted'])}, {int(c['updated'])}, "
            f"{int(c['deleted'])}, {int(c['table_rows'])}, {vb}, {int(c['version_after'])}, "
            f"{int(c['new_warnings'])}, {sql_str(c['examples'])})")


def table_version(db, table):
    return int(db.run(f"SELECT max(version) FROM (DESCRIBE HISTORY {table})")[0][0])


def change_examples(db, table, version_after, cols, key):
    """Up to MAX_EXAMPLES updated rows (which columns changed, old to new) and deleted keys, from the change feed."""
    col_list = ", ".join(cols)
    order_by = ", ".join(str(cols.index(c) + 1) for c in key)  # ORDER BY the key columns' positions
    rows = db.run(f"SELECT {col_list}, _change_type FROM table_changes('{table}', {version_after}, {version_after}) "
                  f"WHERE _change_type IN ('update_preimage', 'update_postimage', 'delete') ORDER BY {order_by}, _change_type")
    n = len(cols)
    pre, post, deleted = {}, {}, []
    for r in rows:
        kind, vals = r[n], r[:n]
        k = tuple(vals[cols.index(c)] for c in key)
        if kind == "update_preimage":
            pre[k] = vals
        elif kind == "update_postimage":
            post[k] = vals
        else:
            deleted.append("|".join(str(x) for x in k))
    updates = [{"key": "|".join(str(x) for x in k),
                "changes": {c: [a, b] for c, a, b in changed_columns(cols, pre[k], post[k])}}
               for k in sorted(post) if k in pre][:MAX_EXAMPLES]
    return {"updated": updates, "deleted_keys": deleted[:MAX_EXAMPLES]}


def build(db, name, cfg, execute, allow_large_delete=False, sql_root=SQL_ROOT):
    layer = cfg["layer"]
    schema = schema_for(layer)
    sql_dir = sql_root / layer
    table = f"{schema}.{name}"
    if cfg.get("python"):
        spark = getattr(db, "spark", None)
        if spark is None:
            print(f"SKIP {layer} {name}: written in PySpark, so it only runs inside the Databricks job.")
            return
        import importlib
        view = f"{name}_src"
        importlib.import_module(cfg["python"]).build(spark).createOrReplaceTempView(view)
        select_sql = f"SELECT * FROM {view}"  # the rest of the build (gates, MERGE, logs) is unchanged
    else:
        select_sql = (sql_dir / f"{name}.sql").read_text()
    gates_text = (sql_dir / f"{name}_gates.sql").read_text()
    warnings_text = (sql_dir / f"{name}_warnings.sql").read_text()
    print(f"{'EXECUTE' if execute else 'DRY RUN'} | {layer} {name}\n")

    src_rows = int(db.run(f"SELECT count(*) FROM ({source_sql(select_sql)})")[0][0])
    if src_rows == 0:
        sys.exit(f"Stopping: the SELECT for {name} returned 0 rows (is bronze empty?).")
    print(f"Source rows: {src_rows:,}")
    bad = failing_gates(db.run(gates_on_source(select_sql, gates_text)))
    print("Gates on source: " + ("all pass" if not bad else f"FAILED {bad}"))
    if bad:
        sys.exit("Stopping: quality gates failed on the source rows; nothing written.")

    exists = True
    try:
        db.run(f"DESCRIBE TABLE {table}")
    except RuntimeError:
        exists = False
    if exists:
        ins, upd, dele = [int(x) for x in db.run(plan_sql(table, select_sql, cfg["key"]))[0]]
        print(f"MERGE would: insert {ins:,}, update {upd:,}, delete {dele:,}")
        existing = int(db.run(f"SELECT count(*) FROM {table}")[0][0])
        if delete_guard_trips(dele, existing) and not allow_large_delete:
            sys.exit(f"Stopping: the MERGE would delete {dele:,} of {existing:,} rows "
                     f"(more than {MAX_DELETE_FRACTION:.0%}). Look at bronze first; re-run with --allow-large-delete if it is right.")
    else:
        print(f"Table {table} does not exist yet; it {'will be' if execute else 'would be'} created and filled with {src_rows:,} rows.")
    if not execute:
        print("Nothing was written. Re-run with --execute to build.")
        return

    run_id = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    version_before = table_version(db, table) if exists else None
    db.run(f"CREATE SCHEMA IF NOT EXISTS {schema}")
    db.run(create_sql(table, select_sql))
    db.run(merge_sql(table, select_sql, cfg["key"]))
    version_after = table_version(db, table)
    in_table = int(db.run(f"SELECT count(*) FROM {table}")[0][0])
    bad = failing_gates(db.run(gates_sql(gates_text, table)))
    print(f"Table rows: {in_table:,} (source {src_rows:,}) | gates on table: " + ("all pass" if not bad else f"FAILED {bad}"))
    if in_table != src_rows or bad:
        sys.exit(f"FAILED: {layer} table {name} does not match the source rows or a gate failed.")

    # what this run changed, from the change feed
    first = 0 if version_before is None else version_before + 1
    feed = dict((k, int(v)) for k, v in db.run(
        f"SELECT _change_type, count(*) FROM table_changes('{table}', {first}, {version_after}) GROUP BY 1"))
    counts = {"inserted": feed.get("insert", 0), "updated": feed.get("update_postimage", 0), "deleted": feed.get("delete", 0)}
    print(f"Changed this run: inserted {counts['inserted']:,}, updated {counts['updated']:,}, deleted {counts['deleted']:,}")
    examples = {"updated": [], "deleted_keys": []}
    if counts["updated"] or counts["deleted"]:
        cols = [r[0] for r in db.run(f"DESCRIBE TABLE {table}") if r[0] and not r[0].startswith("#")]
        examples = change_examples(db, table, version_after, cols, cfg["key"])
        for u in examples["updated"]:
            print("  updated", u["key"], {c: f"{a} -> {b}" for c, (a, b) in u["changes"].items()})
        if examples["deleted_keys"]:
            print("  deleted (first few):", examples["deleted_keys"])

    for s in create_log_tables_sql(schema):
        db.run(s)
    new_warnings = int(db.run(warnings_insert_sql(name, run_id, warnings_text, table, schema))[0][0])
    print(f"New oddities logged to {schema}._data_warnings: {new_warnings}")
    db.run(log_insert_sql(run_id, name, schema=schema, c={**counts, "source_rows": src_rows, "table_rows": in_table,
                                         "version_before": version_before, "version_after": version_after,
                                         "new_warnings": new_warnings, "examples": json.dumps(examples, default=str)}))
    print(f"Run written to {schema}._build_log (run_id {run_id}, table versions {version_before} -> {version_after})")


class SparkRunner:
    """Runs SQL inside a Databricks job through Spark. Same interface as the CLI runner:
    run(sql) returns a list of rows (lists); any failure is raised as RuntimeError."""

    def __init__(self, spark):
        self.spark = spark

    def run(self, stmt):
        try:
            return [list(r) for r in self.spark.sql(stmt).collect()]
        except Exception as e:  # Spark raises its own exception types; build() expects RuntimeError
            raise RuntimeError(str(e)[:400]) from None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--execute", action="store_true", help="really build (default is a dry run)")
    ap.add_argument("--table", choices=list(TABLES), help="one table (default: all, silver first)")
    ap.add_argument("--allow-large-delete", action="store_true", help="let a MERGE delete more than 1% of rows")
    args = ap.parse_args()
    import bronze_load  # only the command line needs the CLI runner (and boto3)
    cfg = bronze_load.CONFIG["bronze"]
    db = bronze_load.Databricks(os.environ.get("DATABRICKS_WAREHOUSE_ID", cfg["warehouse_id"]),
                                [os.environ.get("DATABRICKS_TOKEN")])
    for name in ([args.table] if args.table else list(TABLES)):  # silver tables first, then gold
        build(db, name, TABLES[name], args.execute, args.allow_large_delete)


if __name__ == "__main__":
    main()
