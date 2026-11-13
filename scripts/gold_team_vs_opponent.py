"""Gold team_vs_opponent, written in PySpark. One row per team, opponent, season label, game type and stat.

Source: silver team_game (one row per team per game). Key: (team_id, opponent_team_id, season_label, game_type, stat).

Every row covers ONE game type, never a mix: game_type is 'regular-season', 'playoffs', 'play-in' or 'nba-cup'.
season_label is either one season like '2024-25' or 'all' (all seasons in the data, still that one game type).
Stats are the same eight as team_form: pts, reb, ast, fg3m, blk, stl, allowed (opponent points), margin.
Per row: games, wins, first and last game date, mean, median, p10, p90 (exact percentiles, linear interpolation),
min_value, max_value.
Runs only inside Databricks (it needs a Spark session); transform() is pure DataFrame code and is unit-tested locally.
"""
from functools import reduce

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from gold_team_form import STATS, QUANTILES, season_label_col

SOURCE_TABLE = "workspace.nba_v2_silver.team_game"
GROUP = ["team_id", "opponent_team_id", "season_label", "game_type"]
OUTPUT_COLUMNS = [
    "team_id", "opponent_team_id", "season_label", "game_type", "stat", "team_tricode", "opponent_tricode",
    "games", "wins", "first_game_date", "last_game_date",
    "mean", "median", "p10", "p90", "min_value", "max_value",
]


def tag_groups(games: DataFrame) -> DataFrame:
    """Each game appears twice: under its own season and under season 'all'. The game type is always its own."""
    base = (games.withColumn("allowed", F.col("opp_pts")).withColumn("margin", F.col("pts") - F.col("opp_pts"))
            .withColumn("game_type", F.col("season_type")))
    all_seasons = base.withColumn("season_label", F.lit("all"))
    one_season = base.withColumn("season_label", season_label_col("season"))
    return all_seasons.unionByName(one_season)


def transform(games: DataFrame) -> DataFrame:
    tagged = tag_groups(games)
    newest_first = Window.partitionBy("team_id", "opponent_team_id").orderBy(F.col("game_date").desc(), F.col("game_id").desc())
    names = (games.withColumn("rn", F.row_number().over(newest_first)).filter("rn = 1")
             .select("team_id", "opponent_team_id", "team_tricode", "opponent_tricode"))
    facts = tagged.groupBy(*GROUP).agg(
        F.count("*").alias("games"),
        F.sum(F.when(F.col("won"), 1).otherwise(0)).alias("wins"),
        F.min("game_date").alias("first_game_date"), F.max("game_date").alias("last_game_date"))

    parts = []
    for stat in STATS:  # the same block for every stat
        x = F.col(stat).cast("double")
        quantiles = F.expr(f"percentile(CAST({stat} AS DOUBLE), array({', '.join(str(q) for q in QUANTILES)}))")
        part = (tagged.groupBy(*GROUP)
                .agg(F.round(F.avg(x), 3).alias("mean"), quantiles.alias("_q"),
                     F.min(x).alias("min_value"), F.max(x).alias("max_value"))
                .withColumn("p10", F.round(F.col("_q")[0], 3))
                .withColumn("median", F.round(F.col("_q")[1], 3))
                .withColumn("p90", F.round(F.col("_q")[2], 3)).drop("_q")
                .withColumn("stat", F.lit(stat)))
        parts.append(part)
    stats_df = reduce(lambda a, b: a.unionByName(b), parts)
    return (facts.join(stats_df, GROUP).join(names, ["team_id", "opponent_team_id"])
            .select(*OUTPUT_COLUMNS))


def build(spark):
    return transform(spark.table(SOURCE_TABLE))
