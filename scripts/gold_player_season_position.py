"""Gold player_season_position, written in PySpark. One row per player per season: the position the roster LISTS for him
(G, F, C, G-F, F-C, C-F or F-G), as written, nothing merged or guessed. Key (person_id, season).

Source: bronze rosters (a snapshot of each team's roster; the current season is appended again each time it changes).
Where a player has several snapshots in one season, the label of the newest snapshot (by _loaded_at, then
_source_modified_at) is kept. A snapshot with an empty label is ignored, so a player with no usable label has no row;
the defense-by-position grid shows those players as "Not listed". The label is NOT the lineup slot in a box score.

Why a table: the app can only read gold tables, and bronze rosters is not one of them.
Columns: person_id, season, season_label ('2025-26'), player_name, position.
Runs only inside Databricks (it needs a Spark session); transform() is pure DataFrame code and is unit-tested locally.
"""
from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from gold_team_form import season_label_col

SOURCE_TABLE = "workspace.nba_v2_bronze.rosters"
OUTPUT_COLUMNS = ["person_id", "season", "season_label", "player_name", "position"]
LISTED_POSITIONS = ["G", "F", "C", "G-F", "F-C", "C-F", "F-G"]


def transform(rosters: DataFrame) -> DataFrame:
    label = F.upper(F.trim(F.col("position")))
    newest_first = Window.partitionBy("player_id", "season").orderBy(
        F.col("_loaded_at").desc_nulls_last(), F.col("_source_modified_at").desc_nulls_last(), label)
    return (rosters
            .filter(F.col("player_id").isNotNull() & F.col("season").isNotNull() & F.col("position").isNotNull() & (F.trim(F.col("position")) != ""))
            .withColumn("_label", label)
            .withColumn("_rank", F.row_number().over(newest_first))
            .filter(F.col("_rank") == 1)
            .select(F.col("player_id").cast("long").alias("person_id"),
                    F.col("season").cast("int").alias("season"),
                    season_label_col(F.col("season").cast("int")).alias("season_label"),
                    F.col("player").alias("player_name"),
                    F.col("_label").alias("position")))


def build(spark):
    return transform(spark.table(SOURCE_TABLE))
