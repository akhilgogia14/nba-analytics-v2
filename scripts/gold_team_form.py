"""Gold team_form, written in PySpark. One row per team per game type per stat (long format),
key (team_id, game_type, stat).

Source: silver team_game (one row per team per game). A team gets rows for every game type it has played:
game_type is 'regular-season', 'playoffs', 'play-in' or 'nba-cup'. Regular season and playoffs are never mixed.

Per team, game type and stat (pts, reb, ast, fg3m, blk, stl, allowed, margin), where allowed = points the opponent
scored and margin = pts - allowed:
  * last-10 window = the team's 10 most recent games OF THAT TYPE, crossing into earlier seasons if needed.
    l10_games, l10_first_date, l10_games_before_current_season (window games from before the latest season in the
    data) and l10_wins label what the window is made of. A playoff window can reach back years: last_game_date and
    l10_first_date say how old it is.
  * l10_mean, l10_median, l10_p10, l10_p90 (exact percentiles with linear interpolation), l10_min, l10_max.
  * season_games and season_mean for the latest season and that game type (0 and NULL if none yet).
team_name and team_tricode come from the team's latest game of any type.
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
GROUP = ["team_id", "game_type"]
OUTPUT_COLUMNS = [
    "team_id", "game_type", "stat", "team_name", "team_tricode", "last_game_date", "last_season_label",
    "total_games", "season_label", "season_games", "l10_games", "l10_first_date",
    "l10_games_before_current_season", "l10_wins",
    "l10_mean", "l10_median", "l10_p10", "l10_p90", "l10_min", "l10_max", "season_mean",
]


def season_label_col(season):
    """Season 2027 is the 2026-27 season."""
    s = F.col(season) if isinstance(season, str) else season
    return F.concat((s - 1).cast("string"), F.lit("-"), F.substring(s.cast("string"), 3, 2))


def transform(games: DataFrame) -> DataFrame:
    latest_season = games.agg(F.max("season")).collect()[0][0]
    games = (games.withColumn("allowed", F.col("opp_pts")).withColumn("margin", F.col("pts") - F.col("opp_pts"))
             .withColumn("game_type", F.col("season_type")))
    newest_first = Window.partitionBy(*GROUP).orderBy(F.col("game_date").desc(), F.col("game_id").desc())
    ranked = games.withColumn("rn", F.row_number().over(newest_first))
    window_rows = ranked.filter(F.col("rn") <= WINDOW_GAMES)
    this_season = games.filter(F.col("season") == latest_season)

    latest_any = Window.partitionBy("team_id").orderBy(F.col("game_date").desc(), F.col("game_id").desc())
    names = (games.withColumn("rn", F.row_number().over(latest_any)).filter("rn = 1")
             .select("team_id", "team_name", "team_tricode"))
    last = ranked.filter(F.col("rn") == 1).select(
        *GROUP, F.col("game_date").alias("last_game_date"), season_label_col("season").alias("last_season_label"))
    totals = games.groupBy(*GROUP).agg(F.count("*").alias("total_games"))
    season_games = this_season.groupBy(*GROUP).agg(F.count("*").alias("season_games"))
    window_facts = window_rows.groupBy(*GROUP).agg(
        F.count("*").alias("l10_games"),
        F.min("game_date").alias("l10_first_date"),
        F.sum(F.when(F.col("season") < latest_season, 1).otherwise(0)).alias("l10_games_before_current_season"),
        F.sum(F.when(F.col("won"), 1).otherwise(0)).alias("l10_wins"))
    facts = (last.join(totals, GROUP).join(window_facts, GROUP).join(names, "team_id")
             .join(season_games, GROUP, "left")
             .withColumn("season_games", F.coalesce(F.col("season_games"), F.lit(0)))
             .withColumn("season_label", season_label_col(F.lit(latest_season))))

    parts = []
    for stat in STATS:  # the same block for every stat: this loop is what a new stat extends
        x = F.col(stat).cast("double")
        quantiles = F.expr(f"percentile(CAST({stat} AS DOUBLE), array({', '.join(str(q) for q in QUANTILES)}))")
        part = (window_rows.groupBy(*GROUP)
                .agg(F.round(F.avg(x), 3).alias("l10_mean"), quantiles.alias("_q"),
                     F.min(x).alias("l10_min"), F.max(x).alias("l10_max"))
                .withColumn("l10_p10", F.round(F.col("_q")[0], 3))
                .withColumn("l10_median", F.round(F.col("_q")[1], 3))
                .withColumn("l10_p90", F.round(F.col("_q")[2], 3)).drop("_q"))
        season_mean = this_season.groupBy(*GROUP).agg(F.round(F.avg(x), 3).alias("season_mean"))
        parts.append(part.join(season_mean, GROUP, "left").withColumn("stat", F.lit(stat)))

    stats_df = reduce(lambda a, b: a.unionByName(b), parts)
    return facts.join(stats_df, GROUP).select(*OUTPUT_COLUMNS)


def build(spark):
    return transform(spark.table(SOURCE_TABLE))
