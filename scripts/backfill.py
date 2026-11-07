"""Sync raw source files into R2 (parquet, bytes untouched).

Default is a DRY RUN: it reads GitHub and R2, prints a plan, writes nothing.
With --execute it uploads NEW files and replaces CHANGED ones, then writes a manifest.
It never deletes anything. A file is replaced only when its source content changed,
after the size and parquet checks pass, and the old and new checksums go in the manifest.

Run from the repo root:
    .venv/bin/python scripts/backfill.py --tier tier1              # dry run
    .venv/bin/python scripts/backfill.py --tier tier1 --execute    # real run
"""
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "config" / "sources.json"


# ---------- small pure helpers (covered by tests/test_backfill.py) ----------

def select_assets(assets, seasons):
    """Pick exactly one parquet file per season (name ends with _<season>.parquet)."""
    picked = []
    for season in seasons:
        suffix = f"_{season}.parquet"
        found = [a for a in assets if a["name"].endswith(suffix)]
        if len(found) != 1:
            raise ValueError(f"season {season}: expected 1 file ending {suffix}, found {len(found)}")
        a = found[0]
        picked.append({"season": season, "name": a["name"], "size": a["size"],
                       "updated_at": a["updated_at"], "url": a["browser_download_url"]})
    return picked


def r2_key(prefix, tag, season, name):
    return f"{prefix}/{tag}/{season}/{name}"


def is_parquet(data):
    """A parquet file starts and ends with the 4 bytes PAR1."""
    return len(data) > 8 and data[:4] == b"PAR1" and data[-4:] == b"PAR1"


def classify(asset, head):
    """NEW (not in R2), UNCHANGED (labels match the source), or CHECK (must compare content)."""
    if head is None:
        return "NEW"
    meta = head.get("Metadata", {})
    if meta.get("source_updated_at") == asset["updated_at"] and head.get("ContentLength") == asset["size"]:
        return "UNCHANGED"
    return "CHECK"


def resolve(stored_sha, new_sha):
    return "UNCHANGED" if stored_sha == new_sha else "CHANGED"


# ---------- plumbing ----------

def load_env():
    p = ROOT / ".env"
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def make_s3():
    missing = [k for k in ("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
               if not os.environ.get(k)]
    if missing:
        sys.exit(f"Missing settings: {', '.join(missing)} (check .env)")
    return boto3.client(
        "s3", endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto", config=Config(signature_version="s3v4"))


def http_get(url, token=None):
    """Download with 3 tries. The token (if any) is sent only to api.github.com."""
    headers = {"User-Agent": "nba-analytics-v2-backfill"}
    if token and url.startswith("https://api.github.com/"):
        headers["Authorization"] = f"Bearer {token}"
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"download failed after 3 tries ({type(last).__name__}): {url}")


def head_or_none(s3, bucket, key):
    try:
        return s3.head_object(Bucket=bucket, Key=key)
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
            return None
        raise


def sha_of_object(s3, bucket, key):
    h = hashlib.sha256()
    for chunk in s3.get_object(Bucket=bucket, Key=key)["Body"].iter_chunks(1 << 20):
        h.update(chunk)
    return h.hexdigest()


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------- plan and execute ----------

def build_plan(s3, bucket, cfg, tags, token):
    items = []
    for tag in tags:
        release = json.loads(http_get(f"https://api.github.com/repos/{cfg['repo']}/releases/tags/{tag}", token))
        for asset in select_assets(release["assets"], cfg["seasons"]):
            key = r2_key(cfg["r2_prefix"], tag, asset["season"], asset["name"])
            head = head_or_none(s3, bucket, key)
            item = {"tag": tag, "asset": asset, "key": key, "status": classify(asset, head),
                    "data": None, "previous_sha256": None, "refresh": False}
            if item["status"] == "CHECK":
                stored = head.get("Metadata", {}).get("sha256") or sha_of_object(s3, bucket, key)
                data = http_get(asset["url"])
                new_sha = hashlib.sha256(data).hexdigest()
                item["status"] = resolve(stored, new_sha)
                item["previous_sha256"] = stored
                item["data"] = data
                item["refresh"] = item["status"] == "UNCHANGED"  # same bytes, stale labels
            elif item["status"] == "UNCHANGED":
                item["previous_sha256"] = head.get("Metadata", {}).get("sha256")
            items.append(item)
    return items


def upload_and_verify(s3, bucket, item, fetched_at):
    asset, key = item["asset"], item["key"]
    data = item["data"] if item["data"] is not None else http_get(asset["url"])
    if len(data) != asset["size"]:
        raise RuntimeError(f"size mismatch: got {len(data)}, source says {asset['size']}")
    if not is_parquet(data):
        raise RuntimeError("file does not look like parquet (missing PAR1 markers)")
    sha = hashlib.sha256(data).hexdigest()
    s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType="application/octet-stream",
                  Metadata={"sha256": sha, "source_updated_at": asset["updated_at"],
                            "source_url": asset["url"], "fetched_at": fetched_at})
    head = s3.head_object(Bucket=bucket, Key=key)
    if head["ContentLength"] != len(data) or sha_of_object(s3, bucket, key) != sha:
        raise RuntimeError("stored copy does not match what was uploaded")
    return sha


def manifest_entry(item, sha, fetched_at):
    a = item["asset"]
    return {"tag": item["tag"], "season": a["season"], "r2_key": item["key"], "source_url": a["url"],
            "size_bytes": a["size"], "sha256": sha, "source_updated_at": a["updated_at"],
            "status": item["status"], "previous_sha256": item["previous_sha256"],
            "metadata_refreshed": item["refresh"], "fetched_at_utc": fetched_at}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tier", required=True)
    ap.add_argument("--execute", action="store_true", help="really upload (default is a dry run)")
    args = ap.parse_args()

    cfg = json.loads(CONFIG_PATH.read_text())
    if args.tier not in cfg["tiers"]:
        sys.exit(f"Unknown tier '{args.tier}'. Choices: {', '.join(cfg['tiers'])}")
    load_env()
    s3, bucket = make_s3(), os.environ["R2_BUCKET"]
    token = os.environ.get("GITHUB_TOKEN")

    started = utc_now()
    items = build_plan(s3, bucket, cfg, cfg["tiers"][args.tier], token)

    print(f"{'DRY RUN' if not args.execute else 'EXECUTE'} | tier {args.tier} | bucket {bucket}\n")
    counts, todo_bytes = {}, 0
    for it in items:
        counts[it["status"]] = counts.get(it["status"], 0) + 1
        if it["status"] in ("NEW", "CHANGED"):
            todo_bytes += it["asset"]["size"]
        note = "  (same bytes, labels will be refreshed)" if it["refresh"] else ""
        print(f"{it['status']:10s}{it['asset']['size']:>13,d}  {it['key']}{note}")
    print(f"\nFiles: {len(items)} | " + ", ".join(f"{k}: {v}" for k, v in sorted(counts.items()))
          + f" | to upload: {todo_bytes / 1e6:.1f} MB")
    if not args.execute:
        print("Nothing was written. Re-run with --execute to upload.")
        return

    entries, failed = [], None
    for it in items:
        fetched_at = utc_now()
        try:
            if it["status"] in ("NEW", "CHANGED") or it["refresh"]:
                verb = "OVERWRITE" if it["status"] == "CHANGED" else ("REFRESH" if it["refresh"] else "UPLOAD")
                print(f"{verb} {it['key']}")
                sha = upload_and_verify(s3, bucket, it, fetched_at)
            else:
                sha = it["previous_sha256"]
            entries.append(manifest_entry(it, sha, fetched_at))
        except Exception as e:  # stop at the first problem; record what was done
            failed = {"r2_key": it["key"], "error": f"{type(e).__name__}: {str(e)[:200]}"}
            print(f"FAILED {it['key']}: {failed['error']}")
            break

    run_id = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    manifest = {"run_id": run_id, "kind": "sync", "tier": args.tier, "repo": cfg["repo"],
                "status": "partial" if failed else "complete", "failure": failed,
                "started_utc": started, "finished_utc": utc_now(),
                "summary": counts, "items": entries}
    mkey = f"_manifest/{run_id}-{args.tier}.json"
    if head_or_none(s3, bucket, mkey) is not None:
        sys.exit(f"Manifest already exists, not overwriting: {mkey}")
    s3.put_object(Bucket=bucket, Key=mkey, Body=json.dumps(manifest, indent=2).encode(),
                  ContentType="application/json")
    print(f"\nManifest written: {mkey} ({manifest['status']})")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
