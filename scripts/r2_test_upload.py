"""Test upload to R2: one raw file plus one manifest entry, then verify.

Writes exactly two objects and refuses to overwrite either if it already exists.
Run from the repo root:  .venv/bin/python scripts/r2_test_upload.py
"""
import hashlib
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

TAG = "nba_stats_schedules"
FILE = "nba_schedule_2025.parquet"
SOURCE_URL = f"https://github.com/sportsdataverse/sportsdataverse-data/releases/download/{TAG}/{FILE}"
DATA_KEY = f"raw/hoopr_stats/{TAG}/2025/{FILE}"
MANIFEST_KEY = "_manifest/2026-11-06-test.json"


def load_env(path=".env"):
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def exists(s3, bucket, key):
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
            return False
        raise


def main():
    load_env()
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    bucket = os.environ["R2_BUCKET"]

    for key in (DATA_KEY, MANIFEST_KEY):
        if exists(s3, bucket, key):
            sys.exit(f"Refusing to overwrite existing object: {key}")

    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with urllib.request.urlopen(SOURCE_URL) as r:
        body = r.read()
    sha = hashlib.sha256(body).hexdigest()
    print(f"Downloaded {len(body)} bytes, sha256 {sha[:16]}...")

    manifest = {
        "kind": "test",
        "source_repo": "sportsdataverse/sportsdataverse-data",
        "release_tag": TAG,
        "source_url": SOURCE_URL,
        "r2_key": DATA_KEY,
        "size_bytes": len(body),
        "sha256": sha,
        "fetched_at_utc": fetched_at,
    }
    s3.put_object(Bucket=bucket, Key=DATA_KEY, Body=body, ContentType="application/octet-stream")
    s3.put_object(Bucket=bucket, Key=MANIFEST_KEY, Body=json.dumps(manifest, indent=2).encode(),
                  ContentType="application/json")
    print("Uploaded 2 objects.")

    # Verify: list, then download back and compare checksums.
    listed = s3.list_objects_v2(Bucket=bucket, MaxKeys=50).get("Contents", [])
    for obj in listed:
        print(f"  {obj['Key']}  ({obj['Size']} bytes)")
    back = s3.get_object(Bucket=bucket, Key=DATA_KEY)["Body"].read()
    back_sha = hashlib.sha256(back).hexdigest()
    print("Stored file matches original:", back_sha == sha)
    m = json.loads(s3.get_object(Bucket=bucket, Key=MANIFEST_KEY)["Body"].read())
    print("Manifest sha256 matches stored file:", m["sha256"] == back_sha)


if __name__ == "__main__":
    main()
