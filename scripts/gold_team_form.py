"""Gold team_form, written in PySpark. One row per team per stat (long format), key (team_id, stat).

Source: silver team_game (one row per team per game). All teams with at least one game are included.

Per team and stat (pts, reb, ast, fg3m, blk, stl, allowed, margin), where allowed = points the opponent scored and
margin = pts - allowed:
  * last-10 window = the team's 10 most recent games, crossing into earlier seasons if needed.
    l10_games, l10_first_date, l10_games_before_current_season (window games from before the latest season in the
    data), l10_games_not_regular (play-in, playoffs, cup) and l10_wins label what the window is made of.
  * l10_mean, l10_median, l10_p10, l10_p90 (exact percentiles with linear interpolation), l10_min, l10_max.
  * season_games and season_mean for the latest season (0 and NULL if the team has not played in it yet).
Same shape as gold player_form, so the app can treat them alike. Runs only inside Databricks (it needs a Spark
session); transform() is pure DataFrame code and is unit-tested locally.
"""
from functools import reduce

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

SOURCE_TABLE = "workspace.nba_v2_silver.team_game"
WINDOW_GAMES = 10
STATS = ["pts", "reb", "ast", "fg3m", "blk", "stl", "allowed", "margin"]
QUANTILES = (0.1, 0.5, 0.9)
OUTPUT_COLUMNS = [
    "team_id", "stat", "team_name", "team_tricode", "last_game_date", "last_season_label",
    "total_games", "season_label", "season_games", "l10_games", "l10_first_date",
    "l10_games_before_current_season", "l10_games_not_regular", "l10_wins",
    "l10_mean", "l10_median", "l10_p10", "l10_p90", "l10_min", "l10_max", "season_mean",
]


def season_label_col(season):
    """Season 2027 is the 2026-27 season."""
    s = F.col(season) if isinstance(season, str) else season
    return F.concat((s - 1).cast("string"), F.lit("-"), F.substring(s.cast("string"), 3, 2))


def transform(games: DataFrame) -> DataFrame:
    latest_season = games.agg(F.max("season")).collect()[0][0]
    games = (games.withColumn("allowed", F.col("opp_pts"))
             .withColumn("margin", F.col("pts") - F.col("opp_pts")))
    newest_first = Window.partitionBy("team_id").orderBy(F.col("game_date").desc(), F.col("game_id").desc())
    ranked = games.withColumn("rn", F.row_number().over(newest_first))
    window_rows = ranked.filter(F.col("rn") <= WINDOW_GAMES)
    this_season = games.filter(F.col("season") == latest_season)

    team = ranked.filter(F.col("rn") == 1).select(
        "team_id", "team_name", "team_tricode", F.col("game_date").alias("last_game_date"),
        season_label_col("season").alias("last_season_label"))
    totals = games.groupBy("team_id").agg(F.count("*").alias("total_games"))
    season_games = this_season.groupBy("team_id").agg(F.count("*").alias("season_games"))
    window_facts = window_rows.groupBy("team_id").agg(
        F.count("*").alias("l10_games"),
        F.min("game_date").alias("l10_first_date"),
        F.sum(F.when(F.col("season") < latest_season, 1).otherwise(0)).alias("l10_games_before_current_season"),
        F.sum(F.when(F.col("season_type") != "regular-season", 1).otherwise(0)).alias("l10_games_not_regular"),
        F.sum(F.when(F.col("won"), 1).otherwise(0)).alias("l10_wins"))
    facts = (team.join(totals, "team_id").join(window_facts, "team_id")
             .join(season_games, "team_id", "left")
             .withColumn("season_games", F.coalesce(F.col("season_games"), F.lit(0)))
             .withColumn("season_label", season_label_col(F.lit(latest_season))))

    parts = []
    for stat in STATS:  # the same block for every stat: this loop is what a new stat extends
        x = F.col(stat).cast("double")
        quantiles = F.expr(f"percentile(CAST({stat} AS DOUBLE), array({', '.join(str(q) for q in QUANTILES)}))")
        part = (window_rows.groupBy("team_id")
                .agg(F.round(F.avg(x), 3).alias("l10_mean"), quantiles.alias("_q"),
                     F.min(x).alias("l10_min"), F.max(x).alias("l10_max"))
                .withColumn("l10_p10", F.round(F.col("_q")[0], 3))
                .withColumn("l10_median", F.round(F.col("_q")[1], 3))
                .withColumn("l10_p90", F.round(F.col("_q")[2], 3)).drop("_q"))
        season_mean = this_season.groupBy("team_id").agg(F.round(F.avg(x), 3).alias("season_mean"))
        parts.append(part.join(season_mean, "team_id", "left").withColumn("stat", F.lit(stat)))

    stats_df = reduce(lambda a, b: a.unionByName(b), parts)
    return facts.join(stats_df, "team_id").select(*OUTPUT_COLUMNS)


def build(spark):
    return transform(spark.table(SOURCE_TABLE))
