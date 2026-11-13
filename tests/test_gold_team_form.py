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
    return {(r["team_id"], r["game_type"], r["stat"]): r.asDict() for r in out}


def test_every_team_gets_all_eight_stats_per_game_type_it_played(spark):
    games = {1: [dict(season=2027, pts=100)] * 3 + [dict(season=2027, pts=90, season_type="playoffs")], 2: [dict(season=2027, pts=90)] * 2}
    out = run(spark, games)
    assert sorted({s for (_, _, s) in out}) == sorted(STATS)
    assert sorted({(t, g) for (t, g, _) in out}) == [(1, "playoffs"), (1, "regular-season"), (2, "regular-season")]
    assert len(out) == 3 * 8


def test_windows_never_mix_game_types(spark):
    # 12 games: game i has pts 100+i, opponent 90+i (margin always 10), even games are wins.
    # Games 1-4 are 2026, games 5-12 are 2027. Games 11 and 12 are playoffs, the other ten are regular season.
    games = [dict(season=2026 if i <= 4 else 2027, pts=100 + i, opp=90 + i, won=(i % 2 == 0)) for i in range(1, 13)]
    games[10]["season_type"] = games[11]["season_type"] = "playoffs"
    out = run(spark, {1: games})
    r = out[(1, "regular-season", "pts")]  # games 1..10: points 101..110
    assert r["l10_games"] == 10 and r["total_games"] == 10
    assert r["l10_first_date"] == date(2026, 1, 1) and r["last_game_date"] == date(2026, 1, 10)
    assert r["l10_games_before_current_season"] == 4 and r["l10_wins"] == 5  # 2026 games 1-4; wins 2,4,6,8,10
    assert (r["l10_min"], r["l10_max"], r["l10_mean"]) == (101.0, 110.0, 105.5)
    assert (r["l10_p10"], r["l10_median"], r["l10_p90"]) == (101.9, 105.5, 109.1)  # linear interpolation on 101..110
    assert r["season_games"] == 6 and r["season_mean"] == 107.5  # 2027 regular-season games 5..10
    assert r["season_label"] == "2026-27" and r["last_season_label"] == "2026-27"
    p = out[(1, "playoffs", "pts")]  # games 11 and 12: points 111, 112
    assert p["l10_games"] == 2 and p["total_games"] == 2 and p["l10_wins"] == 1  # game 12 won, game 11 lost
    assert p["l10_games_before_current_season"] == 0
    assert (p["l10_mean"], p["l10_p10"], p["l10_median"], p["l10_p90"], p["l10_min"], p["l10_max"]) == (111.5, 111.1, 111.5, 111.9, 111.0, 112.0)
    assert p["season_games"] == 2 and p["season_mean"] == 111.5
    a = out[(1, "regular-season", "allowed")]  # 91..100
    assert (a["l10_mean"], a["l10_p10"], a["l10_median"], a["l10_p90"], a["l10_min"], a["l10_max"]) == (95.5, 91.9, 95.5, 99.1, 91.0, 100.0)
    m = out[(1, "playoffs", "margin")]  # always 10
    assert (m["l10_mean"], m["l10_p10"], m["l10_median"], m["l10_p90"], m["l10_min"], m["l10_max"]) == (10.0,) * 6


def test_window_is_capped_at_ten_per_type(spark):
    games = [dict(season=2027, pts=100)] * 12 + [dict(season=2027, pts=50, season_type="playoffs")] * 3
    out = run(spark, {1: games})
    assert out[(1, "regular-season", "pts")]["l10_games"] == 10 and out[(1, "regular-season", "pts")]["total_games"] == 12
    assert out[(1, "playoffs", "pts")]["l10_games"] == 3 and out[(1, "playoffs", "pts")]["l10_mean"] == 50.0


def test_a_losing_team_has_negative_margin_and_no_wins(spark):
    out = run(spark, {1: [dict(season=2027, pts=100)] * 3, 2: [dict(season=2027, pts=90, opp=100)] * 3})
    m, a, p = out[(2, "regular-season", "margin")], out[(2, "regular-season", "allowed")], out[(2, "regular-season", "pts")]
    assert (m["l10_mean"], m["l10_min"], m["l10_max"], m["season_mean"]) == (-10.0, -10.0, -10.0, -10.0)
    assert (a["l10_mean"], p["l10_mean"], p["l10_wins"]) == (100.0, 90.0, 0)


def test_team_that_has_not_played_this_season_is_kept_and_labelled(spark):
    out = run(spark, {1: [dict(season=2027, pts=100)] * 3, 2: [dict(season=2026, pts=95)] * 12})
    r = out[(2, "regular-season", "pts")]
    assert r["season_games"] == 0 and r["season_mean"] is None
    assert r["l10_games"] == 10 and r["l10_games_before_current_season"] == 10
    assert r["last_season_label"] == "2025-26" and r["season_label"] == "2026-27"


def test_a_playoff_window_from_an_earlier_season_says_so(spark):
    games = {1: [dict(season=2026, pts=90, season_type="playoffs")] * 4 + [dict(season=2027, pts=100)] * 5}
    p = run(spark, games)[(1, "playoffs", "pts")]
    assert p["l10_games"] == 4 and p["l10_games_before_current_season"] == 4
    assert p["season_games"] == 0 and p["season_mean"] is None and p["last_season_label"] == "2025-26"


def test_a_team_with_few_games_has_a_short_window(spark):
    r = run(spark, {1: [dict(season=2027, pts=100)] * 12, 2: [dict(season=2027, pts=80), dict(season=2027, pts=90)]})[(2, "regular-season", "pts")]
    assert r["l10_games"] == 2 and r["l10_mean"] == 85.0 and r["total_games"] == 2


def test_latest_name_of_any_game_type_wins(spark):
    games = [dict(season=2027, pts=100, name="Old Name", tri="OLD"),
             dict(season=2027, pts=100, name="New Name", tri="NEW", season_type="playoffs")]
    out = run(spark, {1: games})
    assert (out[(1, "regular-season", "pts")]["team_name"], out[(1, "regular-season", "pts")]["team_tricode"]) == ("New Name", "NEW")
    assert out[(1, "playoffs", "pts")]["team_tricode"] == "NEW"


def test_python_table_is_skipped_by_the_command_line_runner():
    import silver_build as s

    class NoSparkDb:
        sql = []

        def run(self, stmt):
            self.sql.append(stmt)
            raise AssertionError("a SKIPped table must not run any SQL")

    s.build(NoSparkDb(), "team_form", s.TABLES["team_form"], execute=True)
    assert NoSparkDb.sql == []
