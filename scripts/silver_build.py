"""Build silver tables from bronze with MERGE, behind quality gates.

Silver = cleaned, typed rows with one row per key. Each table is defined by a SELECT in
sql/silver/<name>.sql and checked by sql/silver/<name>_gates.sql (each gate returns a bad-row count,
0 = pass).

Run order:
  1. gates run on the SELECT's rows (before anything is written). Any failure stops the run.
  2. table is created if missing, with Delta Change Data Feed on (a log of which rows changed).
  3. MERGE on the key: new rows inserted, rows whose _row_hash changed updated, rows gone from the
     source removed. Unchanged rows are not touched, so the change feed shows only real changes.
  4. gates run again on the real table, and its row count is compared with the SELECT.

Dry run by default: runs the gates and reports how many rows a MERGE would insert/update/delete.
Needs the Databricks CLI logged in (profile DEFAULT, or DATABRICKS_HOST/DATABRICKS_TOKEN).
"""
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bronze_load  # noqa: E402  (reuses the Databricks SQL runner)

ROOT = Path(__file__).resolve().parent.parent
SQL_DIR = ROOT / "sql" / "silver"
SCHEMA = "workspace.nba_v2_silver"
TABLES = {"player_game": {"key": ["game_id", "person_id"]}}


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


def build(db, name, cfg, execute):
    table = f"{SCHEMA}.{name}"
    select_sql = (SQL_DIR / f"{name}.sql").read_text()
    gates_text = (SQL_DIR / f"{name}_gates.sql").read_text()
    print(f"{'EXECUTE' if execute else 'DRY RUN'} | silver {name}\n")

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
    else:
        print(f"Table {table} does not exist yet; it {'will be' if execute else 'would be'} created and filled with {src_rows:,} rows.")
    if not execute:
        print("Nothing was written. Re-run with --execute to build.")
        return

    db.run(create_sql(table, select_sql))
    db.run(merge_sql(table, select_sql, cfg["key"]))
    in_table = int(db.run(f"SELECT count(*) FROM {table}")[0][0])
    bad = failing_gates(db.run(gates_sql(gates_text, table)))
    print(f"Table rows: {in_table:,} (source {src_rows:,}) | gates on table: " + ("all pass" if not bad else f"FAILED {bad}"))
    if in_table != src_rows or bad:
        sys.exit("FAILED: silver table does not match the source rows or a gate failed.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--execute", action="store_true", help="really build (default is a dry run)")
    ap.add_argument("--table", choices=sorted(TABLES), help="one table (default: all)")
    args = ap.parse_args()
    cfg = bronze_load.CONFIG["bronze"]
    db = bronze_load.Databricks(os.environ.get("DATABRICKS_WAREHOUSE_ID", cfg["warehouse_id"]),
                                [os.environ.get("DATABRICKS_TOKEN")])
    for name in ([args.table] if args.table else sorted(TABLES)):
        build(db, name, TABLES[name], args.execute)


if __name__ == "__main__":
    main()
