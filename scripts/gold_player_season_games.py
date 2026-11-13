"""Gold player_season_games, written in PySpark. One row per player, per team, per team game: the grid behind
the season "hexagon" chart (one hexagon per team game, coloured if the player played, grey if not).
Key (person_id, team_id, game_id).

Sources: silver player_game (what each player did) and silver team_game (every game each team played).
A player gets a grid for a team and game type ('regular-season', 'playoffs', 'play-in', 'nba-cup') in a season if he
PLAYED at least one game of that type for that team that season. The grid is then ALL of that team's games of that type
that season, even if he played only one; games he missed are filled in from the team schedule with played = false and
empty stats. A player traded mid-season gets a full grid for each team, and other_teams names the other team(s) so the
page can say so. Game types are never mixed: a regular-season grid has no playoff games.

"Played" (the owner's rule, 2026-11-13) = any minutes, OR any box-score stat above 0, OR a non-zero plus/minus.
Otherwise the game is a did-not-play. This is wider than silver's own `played` flag (minutes > 0 only); the two differ
on a handful of rows.

Columns: ids and labels (season_label like '2025-26'), the game (date, opponent, is_home), game_number and team_games
(the game's place among the team's games of that type that season), played, minutes, pts, reb, ast, fg3m, blk, stl
(NULL when not played), other_teams (comma-separated tricodes, NULL if the player had one team that season and type), and the
rest of the box score (started, fgm, fga, fg3a, ftm, fta, oreb, dreb, tov, pf, plus_minus; NULL when not played).
Runs only inside Databricks (it needs a Spark session); transform() is pure DataFrame code and is unit-tested locally.
"""
from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from gold_team_form import season_label_col

PLAYER_TABLE = "workspace.nba_v2_silver.player_game"
TEAM_TABLE = "workspace.nba_v2_silver.team_game"
# Box-score numbers that make a game "played" when above 0 (plus/minus is handled separately: any non-zero value).
PLAYED_STATS = ["pts", "reb", "ast", "fg3m", "blk", "stl", "tov", "pf", "fgm", "fga", "fg3a", "ftm", "fta", "oreb", "dreb"]
STAT_COLUMNS = ["minutes", "pts", "reb", "ast", "fg3m", "blk", "stl"]
# The rest of the box score (added 2026-11-13 for the fuller box-score table), also NULL when not played:
# started, field goals / three-point / free-throw makes and attempts, offensive and defensive rebounds, turnovers, fouls, plus/minus.
BOX_COLUMNS = ["started", "fgm", "fga", "fg3a", "ftm", "fta", "oreb", "dreb", "tov", "pf", "plus_minus"]
OUTPUT_COLUMNS = [
    "person_id", "team_id", "game_id", "game_date", "season", "season_label", "game_type", "player_name",
    "team_tricode", "opponent_team_id", "opponent_tricode", "is_home", "game_number", "team_games",
    "played", *STAT_COLUMNS, "other_teams", *BOX_COLUMNS,
]
GROUP = ["person_id", "team_id", "season", "season_type"]
TEAM_GROUP = ["team_id", "season", "season_type"]


def played_rule():
    """True when the row shows minutes, a stat above 0, or a non-zero plus/minus."""
    rule = F.coalesce(F.col("minutes_seconds"), F.lit(0)) > 0
    for stat in PLAYED_STATS:
        rule = rule | (F.coalesce(F.col(stat), F.lit(0)) > 0)
    return rule | (F.coalesce(F.col("plus_minus"), F.lit(0)) != 0)


def transform(players: DataFrame, teams: DataFrame) -> DataFrame:
    played = players.filter(played_rule())
    in_order = Window.partitionBy(*TEAM_GROUP).orderBy("game_date", "game_id")
    schedule = (teams.select("game_id", "team_id", "game_date", "season", "season_type", "team_tricode", "is_home",
                             "opponent_team_id", "opponent_tricode")
                .withColumn("game_number", F.row_number().over(in_order))
                .withColumn("team_games", F.count("*").over(Window.partitionBy(*TEAM_GROUP))))

    # one row per (player, team, season, game type) the player played in, with the team's latest tricode
    latest_tricode = schedule.groupBy(*TEAM_GROUP).agg(
        F.max_by("team_tricode", F.struct("game_date", "game_id")).alias("group_tricode"))
    groups = played.select(*GROUP).distinct().join(latest_tricode, TEAM_GROUP)
    all_teams = F.collect_set("group_tricode").over(Window.partitionBy("person_id", "season", "season_type"))
    others = F.array_sort(F.array_except(all_teams, F.array("group_tricode")))
    groups = groups.withColumn("other_teams", F.when(F.size(others) > 0, F.array_join(others, ",")))

    names = (players.withColumn("rn", F.row_number().over(
                 Window.partitionBy("person_id").orderBy(F.col("game_date").desc(), F.col("game_id").desc())))
             .filter("rn = 1").select("person_id", "player_name"))
    box = played.select("game_id", "person_id", "team_id", F.lit(True).alias("played"), *STAT_COLUMNS, *BOX_COLUMNS)

    grid = (groups.join(schedule, TEAM_GROUP)
            .join(box, ["game_id", "person_id", "team_id"], "left")
            .join(names, "person_id")
            .withColumn("played", F.coalesce(F.col("played"), F.lit(False)))
            .withColumn("game_type", F.col("season_type"))
            .withColumn("season_label", season_label_col("season")))
    return grid.select(*OUTPUT_COLUMNS)


def build(spark):
    return transform(spark.table(PLAYER_TABLE), spark.table(TEAM_TABLE))
