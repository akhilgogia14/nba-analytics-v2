"""Load landed R2 files into Databricks bronze tables, only the files that are new or changed.

Bronze = the source rows untouched, plus load columns: _source_file, _source_modified_at,
_loaded_at, _sha256. Each file is swapped in one atomic statement (INSERT ... REPLACE WHERE
_source_file = ...), so a failed load leaves the old rows. Nothing is dropped or deleted.

Compares the sha256 label on each R2 file with the _sha256 stored in bronze:
NEW (no rows for that file) | CHANGED (different or missing checksum) | UNCHANGED.

Two modes per table (config "mode"):
  replace (default)  a changed file's old rows are swapped for the new ones (event data: games, plays, shots).
  append             a changed file is ADDED as a new version and old versions stay, so history builds up
                     (snapshot data: season stats, standings, rosters). Each version carries its _sha256 and _loaded_at.

Dry run by default. --execute loads, then checks row counts (and keys, if configured).
Needs: R2 settings (.env) and the Databricks CLI logged in (profile DEFAULT, or DATABRICKS_HOST/TOKEN).
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import backfill  # shared R2 helpers
from sqlutil import sql_str  # noqa: F401  (kept importable as bronze_load.sql_str)

CONFIG = json.loads(backfill.CONFIG_PATH.read_text())


# ---------- pure helpers (covered by tests/test_bronze_load.py) ----------



def classify_file(r2_sha, bronze_shas):
    """bronze_shas = the checksums bronze holds for this file (None = column was empty)."""
    shas = set(bronze_shas)
    if not shas:
        return "NEW"
    if shas == {r2_sha} and r2_sha is not None:
        return "UNCHANGED"
    return "CHANGED"


def classify_snapshot(r2_sha, bronze_shas):
    """Append mode: a file is UNCHANGED if bronze already holds this exact version."""
    shas = set(bronze_shas)
    if not shas:
        return "NEW"
    if r2_sha is not None and r2_sha in shas:
        return "UNCHANGED"
    return "CHANGED"


def classifier_for(mode):
    return classify_snapshot if mode == "append" else classify_file


def file_uri(endpoint_url, bucket, key):
    host = re.sub(r"^https?://", "", endpoint_url).rstrip("/")
    return f"r2://{bucket}@{host}/{key}"


META_COLS = ("_source_file", "_source_modified_at", "_loaded_at", "_sha256")


def create_empty_sql(table, glob_uri):
    """Empty table whose columns are the union of every season file (seasons can differ)."""
    return (f"CREATE TABLE IF NOT EXISTS {table} AS SELECT *, _metadata.file_path AS _source_file, "
            f"_metadata.file_modification_time AS _source_modified_at, current_timestamp() AS _loaded_at, "
            f"CAST(NULL AS STRING) AS _sha256 FROM read_files({sql_str(glob_uri)}, format => 'parquet', "
            f"mergeSchema => true) WHERE 1 = 0")


def columns_to_add(table_cols, file_cols_typed):
    """Columns the file has and the table lacks, as (name, type). Adding them is additive: old rows get NULL."""
    return [(n, t) for n, t in file_cols_typed if n not in table_cols]


def add_columns_sql(table, new_cols):
    return f"ALTER TABLE {table} ADD COLUMNS (" + ", ".join(f"`{n}` {t}" for n, t in new_cols) + ")"


def select_list(table_cols, file_cols):
    """Column-by-name select. Table columns the file lacks are NULL. File columns the table lacks are an
    error here: the caller must add them first (columns_to_add), so nothing is dropped by accident."""
    extra = [c for c in file_cols if c not in table_cols]
    if extra:
        raise ValueError(f"file has columns bronze does not: {extra[:6]} (schema change needs a decision)")
    meta = {"_source_file": "_metadata.file_path", "_source_modified_at": "_metadata.file_modification_time",
            "_loaded_at": "current_timestamp()", "_sha256": None}
    out = []
    for c in table_cols:
        if c in meta:
            out.append(f"{meta[c]} AS {c}" if meta[c] else "{SHA} AS _sha256")
        elif c in file_cols:
            out.append(f"`{c}`")
        else:
            out.append(f"NULL AS `{c}`")
    return out


def load_file_sql(table, uri, sha, mode, table_cols, file_cols):
    head = f"INSERT INTO {table} " + (f"REPLACE WHERE _source_file = {sql_str(uri)} " if mode == "replace" else "")
    cols = ", ".join(select_list(table_cols, file_cols)).replace("{SHA}", sql_str(sha))
    return f"{head}SELECT {cols} FROM read_files({sql_str(uri)}, format => 'parquet')"


def count_check_sql(table, uri, sha=None):
    """Rows bronze holds for this file (this version only, if sha is given) vs rows in the file."""
    only_version = f" AND _sha256 = {sql_str(sha)}" if sha else ""
    return (f"SELECT (SELECT count(*) FROM {table} WHERE _source_file = {sql_str(uri)}{only_version}), "
            f"(SELECT count(*) FROM read_files({sql_str(uri)}, format => 'parquet'))")


def key_check_sql(table, key_cols, mode="replace"):
    """One row: total rows, distinct keys, rows with a NULL key part.
    Append tables hold several versions of a file, so uniqueness is checked within one version."""
    cols = ", ".join(key_cols + (["_source_file", "_sha256"] if mode == "append" else []))
    anynull = " OR ".join(f"{c} IS NULL" for c in key_cols)
    return (f"SELECT count(*), count(DISTINCT {cols}), sum(CASE WHEN {anynull} THEN 1 ELSE 0 END) FROM {table}")


# ---------- Databricks (SQL statements API through the CLI) ----------

class Databricks:
    def __init__(self, warehouse_id, secrets):
        self.warehouse_id, self.secrets = warehouse_id, [s for s in secrets if s]

    def mask(self, text):
        for s in self.secrets:
            text = str(text).replace(s, "<hidden>")
        return str(text)

    def _api(self, method, path, body=None):
        cmd = ["databricks", "api", method, path] + (["--json", json.dumps(body)] if body else [])
        p = subprocess.run(cmd, capture_output=True, text=True)
        out = "\n".join(l for l in p.stdout.splitlines() if "aitools" not in l)
        try:
            return json.loads(out)
        except Exception:
            return {"status": {"state": "FAILED", "error": {"message": out + p.stderr}}}

    def run(self, stmt):
        r = self._api("post", "/api/2.0/sql/statements", {"warehouse_id": self.warehouse_id, "statement": stmt,
                                                           "wait_timeout": "50s", "on_wait_timeout": "CONTINUE"})
        sid = r.get("statement_id")
        for _ in range(90):
            if r.get("status", {}).get("state") in ("SUCCEEDED", "FAILED", "CANCELED", "CLOSED") or not sid:
                break
            time.sleep(4)
            r = self._api("get", f"/api/2.0/sql/statements/{sid}")
        st = r.get("status", {})
        if st.get("state") != "SUCCEEDED":
            raise RuntimeError(self.mask(st.get("error", {}).get("message", st.get("state")))[:400])
        return r.get("result", {}).get("data_array", []) or []


# ---------- plan and run ----------

def r2_files(s3, bucket, prefix):
    """Every parquet under prefix with its checksum label."""
    found, token = [], None
    while True:
        kw = {"Bucket": bucket, "Prefix": prefix + "/"} | ({"ContinuationToken": token} if token else {})
        resp = s3.list_objects_v2(**kw)
        for o in resp.get("Contents", []):
            if o["Key"].endswith(".parquet"):
                sha = s3.head_object(Bucket=bucket, Key=o["Key"]).get("Metadata", {}).get("sha256")
                found.append((o["Key"], sha, o["Size"]))
        if not resp.get("IsTruncated"):
            return sorted(found)
        token = resp["NextContinuationToken"]


def bronze_state(db, table):
    """{file uri: [checksums]} or None if the table does not exist yet."""
    try:
        cols = [r[0] for r in db.run(f"DESCRIBE TABLE {table}")]
    except RuntimeError:
        return None
    if "_sha256" not in cols:
        rows = db.run(f"SELECT _source_file, CAST(NULL AS STRING), count(*) FROM {table} GROUP BY 1")
    else:
        rows = db.run(f"SELECT _source_file, _sha256, count(*) FROM {table} GROUP BY 1, 2")
    state = {}
    for uri, sha, _ in rows:
        state.setdefault(uri, []).append(sha)
    return state


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--execute", action="store_true", help="really load (default is a dry run)")
    args = ap.parse_args()

    backfill.load_env()
    bcfg = CONFIG["bronze"]
    s3, bucket = backfill.make_s3(), os.environ["R2_BUCKET"]
    endpoint = os.environ["R2_ENDPOINT_URL"]
    acct = re.sub(r"^https?://", "", endpoint).split(".")[0]
    db = Databricks(os.environ.get("DATABRICKS_WAREHOUSE_ID", bcfg["warehouse_id"]), [acct])

    plan, problems = [], []
    for tag, t in bcfg["tables"].items():
        table = f"{bcfg['schema']}.{t['table']}"
        state = bronze_state(db, table)
        for key, sha, size in r2_files(s3, bucket, f"{CONFIG['r2_prefix']}/{tag}"):
            uri = file_uri(endpoint, bucket, key)
            status = classifier_for(t.get("mode"))(sha, (state or {}).get(uri, []))
            if sha is None:
                problems.append(f"{key}: no sha256 label in R2")
            plan.append({"tag": tag, "table": table, "key": key, "uri": uri, "sha": sha, "size": size,
                         "status": status, "exists": state is not None, "glob": file_uri(endpoint, bucket, f"{CONFIG['r2_prefix']}/{tag}/*/*.parquet"), "mode": t.get("mode", "replace")})

    print(f"{'EXECUTE' if args.execute else 'DRY RUN'} | bronze\n")
    counts = {}
    for p in plan:
        counts[p["status"]] = counts.get(p["status"], 0) + 1
        print(f"{p['status']:10s}{p['size']:>12,d}  {p['key']}" + ("  (append)" if p["mode"] == "append" else ""))
    print(f"\nFiles: {len(plan)} | " + ", ".join(f"{k}: {v}" for k, v in sorted(counts.items())))
    if problems:
        sys.exit("Stopping: " + "; ".join(problems))
    if not args.execute:
        print("Nothing was written. Re-run with --execute to load.")
        return

    results, failed, schema_changes = [], None, []
    prepared = set()
    for p in plan:
        if p["status"] == "UNCHANGED":
            continue
        try:
            if p["table"] not in prepared:
                db.run(create_empty_sql(p["table"], p["glob"]))
                cols = [r[0] for r in db.run(f"DESCRIBE TABLE {p['table']}")]
                if "_sha256" not in cols:
                    db.run(f"ALTER TABLE {p['table']} ADD COLUMNS (_sha256 STRING)")
                prepared.add(p["table"])
            print(f"LOAD {p['key']}")
            table_cols = [r[0] for r in db.run(f"DESCRIBE TABLE {p['table']}") if not r[0].startswith("#") and r[0]]
            typed = [(r[0], r[1]) for r in db.run(f"DESCRIBE QUERY SELECT * FROM read_files({sql_str(p['uri'])}, format => 'parquet')")]
            file_cols = [n for n, _ in typed]
            new_cols = columns_to_add(table_cols, typed)
            if new_cols:
                print(f"SCHEMA CHANGE {p['table']}: adding {[n for n, _ in new_cols]}")
                db.run(add_columns_sql(p["table"], new_cols))
                schema_changes.append({"table": p["table"], "added": [{"name": n, "type": t} for n, t in new_cols], "file": p["key"]})
                table_cols = table_cols + [n for n, _ in new_cols]
            db.run(load_file_sql(p["table"], p["uri"], p["sha"], p["mode"], table_cols, file_cols))
            in_table, in_file = [int(x) for x in db.run(count_check_sql(p["table"], p["uri"], p["sha"]))[0]]
            if in_table != in_file:
                raise RuntimeError(f"row count mismatch: bronze {in_table} vs file {in_file}")
            results.append({"r2_key": p["key"], "status": p["status"], "rows": in_table, "sha256": p["sha"]})
        except Exception as e:
            failed = {"r2_key": p["key"], "error": f"{type(e).__name__}: {db.mask(e)[:300]}"}
            print(f"FAILED {p['key']}: {failed['error']}")
            break

    keychecks = []
    for tag, t in bcfg["tables"].items():
        if t.get("key") and not failed:
            table = f"{bcfg['schema']}.{t['table']}"
            total, distinct, nulls = [int(x or 0) for x in db.run(key_check_sql(table, t["key"], t.get("mode", "replace")))[0]]
            ok = total == distinct and nulls == 0
            keychecks.append({"table": table, "key": t["key"], "rows": total, "distinct": distinct, "null_keys": nulls, "ok": ok})
            print(f"KEY CHECK {table} ({', '.join(t['key'])}): rows={total:,} distinct={distinct:,} null={nulls} {'OK' if ok else 'PROBLEM'}")
            if not ok:
                failed = {"r2_key": None, "error": f"key check failed for {table}"}

    run_id = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    record = {"run_id": run_id, "kind": "bronze_load", "status": "partial" if failed else "complete",
              "failure": failed, "summary": counts, "loaded": results, "schema_changes": schema_changes, "key_checks": keychecks}
    mkey = f"_manifest/{run_id}-bronze.json"
    s3.put_object(Bucket=bucket, Key=mkey, Body=json.dumps(record, indent=2).encode(), ContentType="application/json")
    print(f"\nRun record written: {mkey} ({record['status']})")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
