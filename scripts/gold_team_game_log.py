"""Gold team_game_log, written in PySpark. One row per team per game played: the team-level box score behind the
Teams page (the last-15-games table and the "against an opponent" panel). Key (team_id, game_id).

Source: silver team_game (one row per team per game, real teams only). Every game type is kept ('regular-season',
'playoffs', 'play-in', 'nba-cup') in game_type; the app always filters to one type, so a regular-season and a playoff
game are never mixed. Only games that were played exist in silver, so there are no empty rows.

Columns: ids and labels (season_label like '2025-26'), the game (date, opponent, is_home), the result (won, pts, opp_pts,
margin = pts - opp_pts, overtime_periods) and the team's box score: fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast,
stl, blk, tov, pf. Percentages are not stored: they are made / attempts, worked out on the page.
Runs only inside Databricks (it needs a Spark session); transform() is pure DataFrame code and is unit-tested locally.
"""
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from gold_team_form import season_label_col

SOURCE_TABLE = "workspace.nba_v2_silver.team_game"
BOX_COLUMNS = ["fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "reb", "ast", "stl", "blk", "tov", "pf"]
OUTPUT_COLUMNS = [
    "team_id", "game_id", "game_date", "season", "season_label", "game_type", "team_name", "team_tricode",
    "opponent_team_id", "opponent_tricode", "is_home", "won", "pts", "opp_pts", "margin", "overtime_periods", *BOX_COLUMNS,
]


def transform(games: DataFrame) -> DataFrame:
    return (games.withColumn("game_type", F.col("season_type"))
            .withColumn("season_label", season_label_col("season"))
            .withColumn("margin", F.col("pts") - F.col("opp_pts"))
            .select(*OUTPUT_COLUMNS))


def build(spark):
    return transform(spark.table(SOURCE_TABLE))
