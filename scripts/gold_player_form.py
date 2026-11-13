"""Gold player_form, written in PySpark. One row per player per game type per stat (long format),
key (person_id, game_type, stat).

Source: gold player_game_log (every played player-game). A player gets rows for every game type he has played:
game_type is 'regular-season', 'playoffs', 'play-in' or 'nba-cup'. Regular season and playoffs are never mixed.
All players with at least one played game are included, including players who have not played yet this season;
last_game_date and last_season_label (of that game type) say how fresh a row is.

Per player, game type and stat (pts, reb, ast, pra, pr, pa, ra, fg3m, blk, stl, minutes):
  * last-10 window = the player's 10 most recent played games OF THAT TYPE, crossing into earlier seasons if needed.
    l10_games, l10_first_date and l10_games_before_current_season (window games from before the latest season in
    the data) label what the window is made of. A playoff window can reach back years: last_game_date and
    l10_first_date say how old it is.
  * l10_mean, l10_median, l10_p10, l10_p90 (exact percentiles with linear interpolation), l10_min, l10_max.
  * for count stats only (fg3m, blk, stl): the share of window games at 0, 1, 2 and 3 or more.
  * season_games and season_mean for the latest season and that game type (0 and NULL if not played yet).
player_name and the team come from the player's latest game of any type.
Runs only inside Databricks (it needs a Spark session); transform() is pure DataFrame code and is unit-tested locally.
"""
from functools import reduce

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

LOG_TABLE = "workspace.nba_v2_gold.player_game_log"
WINDOW_GAMES = 10
STATS = ["pts", "reb", "ast", "pra", "pr", "pa", "ra", "fg3m", "blk", "stl", "minutes"]
COUNT_STATS = ["fg3m", "blk", "stl"]
QUANTILES = (0.1, 0.5, 0.9)
GROUP = ["person_id", "game_type"]
SHARE_COLS = ["l10_share_0", "l10_share_1", "l10_share_2", "l10_share_3plus"]
OUTPUT_COLUMNS = [
    "person_id", "game_type", "stat", "player_name", "team_id", "team_tricode", "last_game_date", "last_season_label",
    "total_games", "season_label", "season_games", "l10_games", "l10_first_date",
    "l10_games_before_current_season",
    "l10_mean", "l10_median", "l10_p10", "l10_p90", "l10_min", "l10_max", *SHARE_COLS, "season_mean",
]


def season_label(season):
    return f"{season - 1}-{str(season)[2:]}"


def transform(log: DataFrame) -> DataFrame:
    latest_season = log.agg(F.max("season")).collect()[0][0]
    log = log.withColumn("game_type", F.col("season_type"))
    newest_first = Window.partitionBy(*GROUP).orderBy(F.col("game_date").desc(), F.col("game_id").desc())
    ranked = log.withColumn("rn", F.row_number().over(newest_first))
    window_rows = ranked.filter(F.col("rn") <= WINDOW_GAMES)
    this_season = log.filter(F.col("season") == latest_season)

    latest_any = Window.partitionBy("person_id").orderBy(F.col("game_date").desc(), F.col("game_id").desc())
    names = (log.withColumn("rn", F.row_number().over(latest_any)).filter("rn = 1")
             .select("person_id", "player_name", "team_id", "team_tricode"))
    last = ranked.filter(F.col("rn") == 1).select(
        *GROUP, F.col("game_date").alias("last_game_date"), F.col("season_label").alias("last_season_label"))
    totals = log.groupBy(*GROUP).agg(F.count("*").alias("total_games"))
    season_games = this_season.groupBy(*GROUP).agg(F.count("*").alias("season_games"))
    window_facts = window_rows.groupBy(*GROUP).agg(
        F.count("*").alias("l10_games"),
        F.min("game_date").alias("l10_first_date"),
        F.sum(F.when(F.col("season") < latest_season, 1).otherwise(0)).alias("l10_games_before_current_season"))
    facts = (last.join(totals, GROUP).join(window_facts, GROUP).join(names, "person_id")
             .join(season_games, GROUP, "left")
             .withColumn("season_games", F.coalesce(F.col("season_games"), F.lit(0)))
             .withColumn("season_label", F.lit(season_label(latest_season))))

    parts = []
    for stat in STATS:  # the same block for every stat: this loop is what a new stat extends
        x = F.col(stat).cast("double")
        quantiles = F.expr(f"percentile(CAST({stat} AS DOUBLE), array({', '.join(str(q) for q in QUANTILES)}))")
        aggs = [F.round(F.avg(x), 3).alias("l10_mean"), quantiles.alias("_q"),
                F.min(x).alias("l10_min"), F.max(x).alias("l10_max")]
        if stat in COUNT_STATS:
            aggs += [F.round(F.avg((x == 0).cast("double")), 3).alias("l10_share_0"),
                     F.round(F.avg((x == 1).cast("double")), 3).alias("l10_share_1"),
                     F.round(F.avg((x == 2).cast("double")), 3).alias("l10_share_2"),
                     F.round(F.avg((x >= 3).cast("double")), 3).alias("l10_share_3plus")]
        part = (window_rows.groupBy(*GROUP).agg(*aggs)
                .withColumn("l10_p10", F.round(F.col("_q")[0], 3))
                .withColumn("l10_median", F.round(F.col("_q")[1], 3))
                .withColumn("l10_p90", F.round(F.col("_q")[2], 3)).drop("_q"))
        if stat not in COUNT_STATS:
            for c in SHARE_COLS:
                part = part.withColumn(c, F.lit(None).cast("double"))
        season_mean = this_season.groupBy(*GROUP).agg(F.round(F.avg(x), 3).alias("season_mean"))
        parts.append(part.join(season_mean, GROUP, "left").withColumn("stat", F.lit(stat)))

    stats_df = reduce(lambda a, b: a.unionByName(b), parts)
    return facts.join(stats_df, GROUP).select(*OUTPUT_COLUMNS)


def build(spark):
    return transform(spark.table(LOG_TABLE))
