import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

STATS = ["pts", "reb", "ast", "fg3m", "blk", "stl", "allowed", "margin"]


def make_games(spark, teams):
    """teams: {team_id: [dict(season, pts, opp, won, season_type, name, tri), ...] oldest first}. Dates run daily."""
    rows = []
    for tid, games in teams.items():
        for i, g in enumerate(games):
            rows.append(dict(
                game_id=f"{tid}-{i:03d}", team_id=tid, game_date=date(2026, 1, 1) + timedelta(days=i),
                season=g["season"], season_type=g.get("season_type", "regular-season"),
                team_name=g.get("name", f"Team {tid}"), team_tricode=g.get("tri", f"T{tid:02d}"),
                pts=g["pts"], opp_pts=g.get("opp", 100), won=g.get("won", g["pts"] > g.get("opp", 100)),
                reb=40, ast=25, fg3m=12, blk=5, stl=7))
    return spark.createDataFrame(rows)


def run(spark, teams):
    tf = pytest.importorskip("gold_team_form")
    out = tf.transform(make_games(spark, teams)).collect()
    return {(r["team_id"], r["stat"]): r.asDict() for r in out}


def test_every_team_gets_all_eight_stats(spark):
    out = run(spark, {1: [dict(season=2027, pts=100)] * 3, 2: [dict(season=2027, pts=90)] * 2})
    assert sorted({s for (_, s) in out}) == sorted(STATS)
    assert len(out) == 16


def test_window_is_the_last_ten_games_across_seasons_with_labels(spark):
    # 12 games, the first 4 in 2026 and the last 8 in 2027. Game i: pts 100+i, opponent 90+i (so margin is always 10).
    # Even-numbered games are wins. Games 11 and 12 are playoffs. The window is games 3..12.
    games = [dict(season=2026 if i <= 4 else 2027, pts=100 + i, opp=90 + i, won=(i % 2 == 0)) for i in range(1, 13)]
    games[10]["season_type"] = games[11]["season_type"] = "playoffs"
    out = run(spark, {1: games})
    r = out[(1, "pts")]
    assert r["l10_games"] == 10
    assert r["l10_first_date"] == date(2026, 1, 3)  # games 1 and 2 fell out of the window
    assert r["l10_games_before_current_season"] == 2  # window games 3 and 4 are from 2026
    assert r["l10_games_not_regular"] == 2
    assert r["l10_wins"] == 5  # games 4, 6, 8, 10, 12
    assert (r["l10_min"], r["l10_max"], r["l10_mean"]) == (103.0, 112.0, 107.5)
    assert (r["l10_p10"], r["l10_median"], r["l10_p90"]) == (103.9, 107.5, 111.1)  # linear interpolation on 103..112
    assert r["season_games"] == 8 and r["season_mean"] == 108.5  # games 5..12 of the latest season
    assert r["season_label"] == "2026-27" and r["last_season_label"] == "2026-27" and r["total_games"] == 12
    a = out[(1, "allowed")]  # 93..102
    assert (a["l10_mean"], a["l10_p10"], a["l10_median"], a["l10_p90"], a["l10_min"], a["l10_max"]) == (97.5, 93.9, 97.5, 101.1, 93.0, 102.0)
    m = out[(1, "margin")]  # always 10
    assert (m["l10_mean"], m["l10_p10"], m["l10_median"], m["l10_p90"], m["l10_min"], m["l10_max"]) == (10.0,) * 6


def test_a_losing_team_has_negative_margin_and_no_wins(spark):
    out = run(spark, {1: [dict(season=2027, pts=100)] * 3, 2: [dict(season=2027, pts=90, opp=100)] * 3})
    m, a, p = out[(2, "margin")], out[(2, "allowed")], out[(2, "pts")]
    assert (m["l10_mean"], m["l10_min"], m["l10_max"], m["season_mean"]) == (-10.0, -10.0, -10.0, -10.0)
    assert (a["l10_mean"], p["l10_mean"], p["l10_wins"]) == (100.0, 90.0, 0)


def test_team_that_has_not_played_this_season_is_kept_and_labelled(spark):
    out = run(spark, {1: [dict(season=2027, pts=100)] * 3, 2: [dict(season=2026, pts=95)] * 12})
    r = out[(2, "pts")]
    assert r["season_games"] == 0 and r["season_mean"] is None
    assert r["l10_games"] == 10 and r["l10_games_before_current_season"] == 10
    assert r["last_season_label"] == "2025-26" and r["season_label"] == "2026-27"


def test_a_team_with_few_games_has_a_short_window(spark):
    r = run(spark, {1: [dict(season=2027, pts=100)] * 12, 2: [dict(season=2027, pts=80), dict(season=2027, pts=90)]})[(2, "pts")]
    assert r["l10_games"] == 2 and r["l10_mean"] == 85.0 and r["total_games"] == 2


def test_latest_name_and_tricode_win_when_they_changed(spark):
    games = [dict(season=2027, pts=100, name="Old Name", tri="OLD"), dict(season=2027, pts=100, name="New Name", tri="NEW")]
    r = run(spark, {1: games})[(1, "pts")]
    assert (r["team_name"], r["team_tricode"]) == ("New Name", "NEW")


def test_python_table_is_skipped_by_the_command_line_runner():
    import silver_build as s

    class NoSparkDb:
        sql = []

        def run(self, stmt):
            self.sql.append(stmt)
            raise AssertionError("a SKIPped table must not run any SQL")

    s.build(NoSparkDb(), "team_form", s.TABLES["team_form"], execute=True)
    assert NoSparkDb.sql == []
