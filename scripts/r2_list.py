"""Read-only R2 check: list up to 20 objects in the bucket.

Reads credentials from the gitignored .env file (or the environment).
Makes no writes. Never prints credentials.

Run from the repo root:  .venv/bin/python scripts/r2_list.py
"""
import os
import sys
from pathlib import Path

import boto3
from botocore.config import Config


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


def main():
    load_env()
    needed = ["R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
    missing = [k for k in needed if not os.environ.get(k)]
    if missing:
        sys.exit(f"Missing settings: {', '.join(missing)} (check .env)")

    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    bucket = os.environ["R2_BUCKET"]
    resp = s3.list_objects_v2(Bucket=bucket, MaxKeys=20)
    items = resp.get("Contents", [])
    print(f"Connected to bucket '{bucket}'. Objects shown (max 20): {len(items)}")
    for obj in items:
        print(f"  {obj['Key']}  ({obj['Size']} bytes)")
    if resp.get("IsTruncated"):
        print("  ... more objects exist")


if __name__ == "__main__":
    main()
