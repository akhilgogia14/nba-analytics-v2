"""Databricks job task: build every silver table from bronze (gates, MERGE, run log, oddities).

Run by the job defined in databricks.yml. The first argument is the folder the bundle uploaded the repo files to
(a script launched by a job has no __file__). Any failed gate or check fails the task, and so the job.
"""
import sys
from pathlib import Path

from pyspark.sql import SparkSession

root = Path(sys.argv[1])
sys.path.insert(0, str(root / "scripts"))
import silver_build  # noqa: E402

db = silver_build.SparkRunner(SparkSession.builder.getOrCreate())
for name, cfg in silver_build.TABLES.items():
    try:
        silver_build.build(db, name, cfg, execute=True, sql_dir=root / "sql" / "silver")
    except SystemExit as e:  # build() stops with sys.exit(message); make that a real task failure
        raise RuntimeError(f"silver build for {name} stopped: {e}") from None
