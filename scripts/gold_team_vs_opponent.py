"""Gold team_vs_opponent, written in PySpark. One row per team, opponent, scope, scope value and stat.

Source: silver team_game (one row per team per game). Key: (team_id, opponent_team_id, scope, scope_value, stat).

Every row is labelled with the group of games it covers:
  * scope 'all',       scope_value 'all'                      every game in the data
  * scope 'season',    scope_value like '2024-25'             every game of that season (any game type)
  * scope 'game_type', scope_value 'regular-season'|'playoffs'  all seasons, that game type only
    (play-in and NBA Cup games count in 'all' and 'season' only).
Stats are the same eight as team_form: pts, reb, ast, fg3m, blk, stl, allowed (opponent points), margin.
Per row: games, wins, regular_games, playoff_games (so a mixed group shows what it is made of), first and last game
date, mean, median, p10, p90 (exact percentiles, linear interpolation), min_value, max_value.
Runs only inside Databricks (it needs a Spark session); transform() is pure DataFrame code and is unit-tested locally.
"""
from functools import reduce

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from gold_team_form import STATS, QUANTILES, season_label_col

SOURCE_TABLE = "workspace.nba_v2_silver.team_game"
GAME_TYPE_SCOPE = ["regular-season", "playoffs"]
GROUP = ["team_id", "opponent_team_id", "scope", "scope_value"]
OUTPUT_COLUMNS = [
    "team_id", "opponent_team_id", "scope", "scope_value", "stat", "team_tricode", "opponent_tricode",
    "games", "wins", "regular_games", "playoff_games", "first_game_date", "last_game_date",
    "mean", "median", "p10", "p90", "min_value", "max_value",
]


def tag_scopes(games: DataFrame) -> DataFrame:
    """Each game appears once per scope it belongs to: all, its season, and (regular season or playoffs) its type."""
    base = games.withColumn("allowed", F.col("opp_pts")).withColumn("margin", F.col("pts") - F.col("opp_pts"))
    all_games = base.withColumn("scope", F.lit("all")).withColumn("scope_value", F.lit("all"))
    by_season = base.withColumn("scope", F.lit("season")).withColumn("scope_value", season_label_col("season"))
    by_type = (base.filter(F.col("season_type").isin(GAME_TYPE_SCOPE))
               .withColumn("scope", F.lit("game_type")).withColumn("scope_value", F.col("season_type")))
    return all_games.unionByName(by_season).unionByName(by_type)


def transform(games: DataFrame) -> DataFrame:
    tagged = tag_scopes(games)
    newest_first = Window.partitionBy("team_id", "opponent_team_id").orderBy(F.col("game_date").desc(), F.col("game_id").desc())
    names = (games.withColumn("rn", F.row_number().over(newest_first)).filter("rn = 1")
             .select("team_id", "opponent_team_id", "team_tricode", "opponent_tricode"))
    facts = tagged.groupBy(*GROUP).agg(
        F.count("*").alias("games"),
        F.sum(F.when(F.col("won"), 1).otherwise(0)).alias("wins"),
        F.sum(F.when(F.col("season_type") == "regular-season", 1).otherwise(0)).alias("regular_games"),
        F.sum(F.when(F.col("season_type") == "playoffs", 1).otherwise(0)).alias("playoff_games"),
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
