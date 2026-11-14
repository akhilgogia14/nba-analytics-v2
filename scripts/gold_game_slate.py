"""Gold game_slate, written in PySpark. One row per game of the latest season, played or not: the data behind the
"Today's games" page (who plays on a date, and the score once it is final). Key (game_id).

Source: silver game (one row per game; the schedule, with the score filled from the box score when the schedule lags).
Only the latest season is kept (the season with the highest `season` in silver), and every game type of it
('preseason', 'regular-season', 'playoffs', 'play-in', 'nba-cup', 'all-star') stays in game_type; the page always filters
to one type, so a regular-season and a playoff game are never mixed.

game_date is the date on the schedule, which is the US date (there is no tip-off time in the source). The page turns
"today" into a US Eastern date and picks the rows with that game_date. A game that has not been played has is_final
false and empty scores and home_won.
Columns: game_id, game_date, season, season_label ('2026-27'), game_type, home_team_id, home_tricode, home_team_name,
away_team_id, away_tricode, away_team_name, home_pts, away_pts, is_final, home_won.
Runs only inside Databricks (it needs a Spark session); transform() is pure DataFrame code and is unit-tested locally.
"""
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from gold_team_form import season_label_col

SOURCE_TABLE = "workspace.nba_v2_silver.game"
OUTPUT_COLUMNS = [
    "game_id", "game_date", "season", "season_label", "game_type",
    "home_team_id", "home_tricode", "home_team_name", "away_team_id", "away_tricode", "away_team_name",
    "home_pts", "away_pts", "is_final", "home_won",
]


def transform(games: DataFrame) -> DataFrame:
    latest_season = games.agg(F.max("season")).collect()[0][0]
    return (games.filter(F.col("season") == latest_season)
            .withColumn("game_type", F.col("season_type"))
            .withColumn("season_label", season_label_col("season"))
            .select(*OUTPUT_COLUMNS))


def build(spark):
    return transform(spark.table(SOURCE_TABLE))
