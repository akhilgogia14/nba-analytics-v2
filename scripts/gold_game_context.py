"""Gold game_context, written in PySpark. One row per team per game on the schedule, played or not: the situation the
team is in BEFORE tip-off (rest, back-to-back, home or away, crowded stretches, how long a road trip or homestand has
run, and how rested the opponent is). Key (team_id, game_id).

Source: silver game (the schedule, with scores filled from box scores). Game types kept: 'regular-season', 'playoffs',
'play-in' and 'nba-cup'. Preseason and all-star games are left out: they are not part of a team's real schedule load.
Every season in silver is kept, so past seasons can be used to see how a situation affected results; the latest season
includes games not yet played (is_final false), which is what lets the app point at a team's NEXT game.

Columns:
  * days_rest: whole days between this team's previous game and this one (0 = back-to-back, 1 = one day off, ...).
    NULL for a team's first game of a season (the previous game is from an earlier season, months ago). After the
    All-Star break it is large (about 6 to 9); the app caps it ("3+").
  * is_b2b: days_rest = 0. games_in_4 / games_in_6: this team's games in the 4 / 6 days ending on this game's date,
    this game included. is_3_in_4 = games_in_4 >= 3; is_4_in_6 = games_in_6 >= 4.
  * stint_game_number: this is the Nth game in a row at the same place (home or away), so with is_home it reads as
    "game 3 of a road trip" or "game 2 of a homestand". It restarts every season.
  * opp_days_rest: the opponent's days_rest for the same game. rest_edge = days_rest - opp_days_rest (NULL if either
    is NULL): positive means this team is the more rested one.
Runs only inside Databricks (it needs a Spark session); transform() is pure DataFrame code and is unit-tested locally.
"""
from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from gold_team_form import season_label_col

SOURCE_TABLE = "workspace.nba_v2_silver.game"
GAME_TYPES = ["regular-season", "playoffs", "play-in", "nba-cup"]
OUTPUT_COLUMNS = [
    "team_id", "game_id", "game_date", "season", "season_label", "game_type", "team_tricode", "team_name",
    "opponent_team_id", "opponent_tricode", "is_home", "is_final",
    "days_rest", "is_b2b", "games_in_4", "games_in_6", "is_3_in_4", "is_4_in_6", "stint_game_number",
    "opp_days_rest", "rest_edge",
]


def team_games(games: DataFrame) -> DataFrame:
    """The schedule as one row per team per game (a home row and an away row for each game)."""
    games = games.filter(F.col("season_type").isin(GAME_TYPES)).withColumn("game_type", F.col("season_type"))
    common = ["game_id", "game_date", "season", "game_type", "is_final"]
    home = games.select(*common, F.col("home_team_id").alias("team_id"), F.col("home_tricode").alias("team_tricode"),
                        F.col("home_team_name").alias("team_name"), F.col("away_team_id").alias("opponent_team_id"),
                        F.col("away_tricode").alias("opponent_tricode"), F.lit(True).alias("is_home"))
    away = games.select(*common, F.col("away_team_id").alias("team_id"), F.col("away_tricode").alias("team_tricode"),
                        F.col("away_team_name").alias("team_name"), F.col("home_team_id").alias("opponent_team_id"),
                        F.col("home_tricode").alias("opponent_tricode"), F.lit(False).alias("is_home"))
    return home.unionByName(away)


def transform(games: DataFrame) -> DataFrame:
    t = team_games(games).withColumn("day_number", F.datediff(F.col("game_date"), F.lit("1970-01-01")))
    in_order = Window.partitionBy("team_id").orderBy("game_date", "game_id")
    t = (t.withColumn("prev_date", F.lag("game_date").over(in_order))
         .withColumn("prev_season", F.lag("season").over(in_order))
         .withColumn("days_rest", F.when(F.col("prev_season") == F.col("season"), F.datediff(F.col("game_date"), F.col("prev_date")) - 1))
         .withColumn("is_b2b", F.col("days_rest") == 0))

    by_day = Window.partitionBy("team_id", "season").orderBy("day_number")
    t = (t.withColumn("games_in_4", F.count("*").over(by_day.rangeBetween(-3, 0)))
         .withColumn("games_in_6", F.count("*").over(by_day.rangeBetween(-5, 0)))
         .withColumn("is_3_in_4", F.col("games_in_4") >= 3)
         .withColumn("is_4_in_6", F.col("games_in_6") >= 4))

    # A stint = a run of games at the same place. A new one starts when home/away flips (or at the first game of a season).
    in_season = Window.partitionBy("team_id", "season").orderBy("game_date", "game_id")
    t = (t.withColumn("new_stint", F.coalesce((F.col("is_home") != F.lag("is_home").over(in_season)).cast("int"), F.lit(1)))
         .withColumn("stint_id", F.sum("new_stint").over(in_season))
         .withColumn("stint_game_number", F.row_number().over(Window.partitionBy("team_id", "season", "stint_id").orderBy("game_date", "game_id"))))

    opp = t.select(F.col("game_id").alias("o_game_id"), F.col("team_id").alias("o_team_id"), F.col("days_rest").alias("opp_days_rest"))
    t = (t.join(opp, (F.col("game_id") == F.col("o_game_id")) & (F.col("opponent_team_id") == F.col("o_team_id")), "left")
         .withColumn("rest_edge", F.col("days_rest") - F.col("opp_days_rest"))
         .withColumn("season_label", season_label_col("season")))
    return t.select(*OUTPUT_COLUMNS)


def build(spark):
    return transform(spark.table(SOURCE_TABLE))
