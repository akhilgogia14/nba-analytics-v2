import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

STAT_COLS = ["pts", "reb", "ast", "pra", "pr", "pa", "ra", "fg3m", "blk", "stl", "minutes"]


def make_log(spark, players):
    """players: {person_id: [dict(season, season_type, pts, fg3m, name, team), ...] oldest first}. Dates run daily."""
    rows = []
    for pid, games in players.items():
        for i, g in enumerate(games):
            pts, fg3m = g["pts"], g.get("fg3m", 0)
            row = dict(person_id=pid, game_id=f"{pid}-{i:03d}", game_date=date(2026, 1, 1) + timedelta(days=i),
                       season=g["season"], season_type=g.get("season_type", "regular-season"),
                       season_label=f"{g['season'] - 1}-{str(g['season'])[2:]}",
                       player_name=g.get("name", f"Player {pid}"), team_id=g.get("team_id", 1), team_tricode=g.get("team", "AAA"),
                       pts=pts, reb=1, ast=2, pra=pts + 3, pr=pts + 1, pa=pts + 2, ra=3, fg3m=fg3m, blk=0, stl=1, minutes=30.0)
            rows.append(row)
    return spark.createDataFrame(rows)


def run(spark, players):
    pf = pytest.importorskip("gold_player_form")
    out = pf.transform(make_log(spark, players)).collect()
    return {(r["person_id"], r["stat"]): r.asDict() for r in out}


def test_every_player_gets_all_eleven_stats(spark):
    out = run(spark, {1: [dict(season=2027, pts=10)] * 3, 2: [dict(season=2027, pts=5)] * 2})
    assert sorted({s for (_, s) in out}) == sorted(STAT_COLS)
    assert len(out) == 22


def test_window_is_the_last_ten_games_across_seasons_with_labels(spark):
    # 12 games: the first 4 in 2026, the last 8 in 2027; pts 1..12; games 11 and 12 are playoffs
    games = [dict(season=2026, pts=i) for i in range(1, 5)] + [dict(season=2027, pts=i) for i in range(5, 13)]
    games[10]["season_type"] = games[11]["season_type"] = "playoffs"
    r = run(spark, {1: games})[(1, "pts")]
    assert r["l10_games"] == 10
    assert r["l10_first_date"] == date(2026, 1, 3)  # the 3rd game: games 1 and 2 fell out of the window
    assert r["l10_games_before_current_season"] == 2  # window games 3 and 4 are from 2026
    assert r["l10_games_not_regular"] == 2
    assert (r["l10_min"], r["l10_max"], r["l10_mean"]) == (3.0, 12.0, 7.5)
    assert (r["l10_p10"], r["l10_median"], r["l10_p90"]) == (3.9, 7.5, 11.1)  # linear interpolation on 3..12
    assert r["season_games"] == 8 and r["season_mean"] == 8.5  # games 5..12 of the latest season
    assert r["season_label"] == "2026-27" and r["last_season_label"] == "2026-27" and r["total_games"] == 12


def test_count_stat_shares_cover_zero_one_two_and_three_plus(spark):
    fg3m = [0, 0, 0, 1, 1, 2, 3, 4, 5, 0]
    r = run(spark, {1: [dict(season=2027, pts=10, fg3m=v) for v in fg3m]})[(1, "fg3m")]
    assert (r["l10_share_0"], r["l10_share_1"], r["l10_share_2"], r["l10_share_3plus"]) == (0.4, 0.2, 0.1, 0.3)


def test_shares_are_empty_for_stats_that_are_not_counts(spark):
    r = run(spark, {1: [dict(season=2027, pts=10)] * 3})[(1, "pts")]
    assert r["l10_share_0"] is None and r["l10_share_3plus"] is None


def test_player_who_has_not_played_this_season_is_kept_and_labelled(spark):
    out = run(spark, {1: [dict(season=2027, pts=10)] * 3, 2: [dict(season=2026, pts=7)] * 12})
    r = out[(2, "pts")]
    assert r["season_games"] == 0 and r["season_mean"] is None
    assert r["l10_games"] == 10 and r["l10_games_before_current_season"] == 10
    assert r["last_season_label"] == "2025-26" and r["season_label"] == "2026-27"


def test_a_player_with_few_games_has_a_short_window(spark):
    r = run(spark, {1: [dict(season=2027, pts=10)] * 12, 2: [dict(season=2027, pts=4), dict(season=2027, pts=8)]})[(2, "pts")]
    assert r["l10_games"] == 2 and r["l10_mean"] == 6.0 and r["total_games"] == 2


def test_latest_name_and_team_win_when_they_changed(spark):
    games = [dict(season=2027, pts=5, name="Chris Manon", team="AAA", team_id=1),
             dict(season=2027, pts=6, name="Chris Mañon", team="BBB", team_id=2)]
    r = run(spark, {1: games})[(1, "pts")]
    assert (r["player_name"], r["team_tricode"], r["team_id"]) == ("Chris Mañon", "BBB", 2)


def test_python_table_is_skipped_by_the_command_line_runner():
    import silver_build as s

    class NoSparkDb:
        sql = []

        def run(self, stmt):
            self.sql.append(stmt)
            raise AssertionError("a SKIPped table must not run any SQL")

    s.build(NoSparkDb(), "player_form", s.TABLES["player_form"], execute=True)
    assert NoSparkDb.sql == []
