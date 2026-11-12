import os
import sys

import pytest


@pytest.fixture(scope="session")
def spark():
    """A small local Spark session for testing PySpark code (skipped if pyspark is not installed)."""
    pytest.importorskip("pyspark")
    os.environ["PYSPARK_PYTHON"] = sys.executable  # workers must use the same Python as the driver
    from pyspark.sql import SparkSession
    session = (SparkSession.builder.master("local[2]").appName("tests")
               .config("spark.ui.enabled", "false").config("spark.sql.shuffle.partitions", "2")
               .config("spark.sql.ansi.enabled", "true")  # the Databricks side runs with ANSI on
               .config("spark.driver.bindAddress", "127.0.0.1").getOrCreate())
    yield session
    session.stop()
