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
    return {(r["person_id"], r["game_type"], r["stat"]): r.asDict() for r in out}


def test_every_player_gets_all_eleven_stats_per_game_type_he_played(spark):
    out = run(spark, {1: [dict(season=2027, pts=10)] * 3 + [dict(season=2027, pts=8, season_type="playoffs")],
                      2: [dict(season=2027, pts=5)] * 2})
    assert sorted({s for (_, _, s) in out}) == sorted(STAT_COLS)
    assert sorted({(p, g) for (p, g, _) in out}) == [(1, "playoffs"), (1, "regular-season"), (2, "regular-season")]
    assert len(out) == 3 * 11


def test_windows_never_mix_game_types(spark):
    # 12 games: the first 4 in 2026 and the last 8 in 2027; pts 1..12; games 11 and 12 are playoffs
    games = [dict(season=2026, pts=i) for i in range(1, 5)] + [dict(season=2027, pts=i) for i in range(5, 13)]
    games[10]["season_type"] = games[11]["season_type"] = "playoffs"
    out = run(spark, {1: games})
    r = out[(1, "regular-season", "pts")]  # games 1..10
    assert r["l10_games"] == 10 and r["total_games"] == 10
    assert r["l10_first_date"] == date(2026, 1, 1) and r["last_game_date"] == date(2026, 1, 10)
    assert r["l10_games_before_current_season"] == 4  # the 2026 games 1-4
    assert (r["l10_min"], r["l10_max"], r["l10_mean"]) == (1.0, 10.0, 5.5)
    assert (r["l10_p10"], r["l10_median"], r["l10_p90"]) == (1.9, 5.5, 9.1)  # linear interpolation on 1..10
    assert r["season_games"] == 6 and r["season_mean"] == 7.5  # 2027 regular-season games 5..10
    assert r["season_label"] == "2026-27" and r["last_season_label"] == "2026-27"
    p = out[(1, "playoffs", "pts")]  # games 11 and 12
    assert p["l10_games"] == 2 and p["total_games"] == 2 and p["l10_games_before_current_season"] == 0
    assert (p["l10_mean"], p["l10_p10"], p["l10_median"], p["l10_p90"], p["l10_min"], p["l10_max"]) == (11.5, 11.1, 11.5, 11.9, 11.0, 12.0)
    assert p["season_games"] == 2 and p["season_mean"] == 11.5


def test_window_is_capped_at_ten_per_type(spark):
    games = [dict(season=2027, pts=10)] * 12 + [dict(season=2027, pts=40, season_type="playoffs")] * 3
    out = run(spark, {1: games})
    assert out[(1, "regular-season", "pts")]["l10_games"] == 10 and out[(1, "regular-season", "pts")]["total_games"] == 12
    assert out[(1, "playoffs", "pts")]["l10_games"] == 3 and out[(1, "playoffs", "pts")]["l10_mean"] == 40.0


def test_a_playoff_window_from_an_earlier_season_says_so(spark):
    games = [dict(season=2026, pts=30, season_type="playoffs")] * 4 + [dict(season=2027, pts=10)] * 5
    p = run(spark, {1: games})[(1, "playoffs", "pts")]
    assert p["l10_games"] == 4 and p["l10_games_before_current_season"] == 4
    assert p["season_games"] == 0 and p["season_mean"] is None and p["last_season_label"] == "2025-26"


def test_count_stat_shares_cover_zero_one_two_and_three_plus(spark):
    fg3m = [0, 0, 0, 1, 1, 2, 3, 4, 5, 0]
    r = run(spark, {1: [dict(season=2027, pts=10, fg3m=v) for v in fg3m]})[(1, "regular-season", "fg3m")]
    assert (r["l10_share_0"], r["l10_share_1"], r["l10_share_2"], r["l10_share_3plus"]) == (0.4, 0.2, 0.1, 0.3)


def test_count_stat_shares_are_per_game_type(spark):
    games = [dict(season=2027, pts=10, fg3m=0)] * 4 + [dict(season=2027, pts=10, fg3m=4, season_type="playoffs")] * 2
    out = run(spark, {1: games})
    assert out[(1, "regular-season", "fg3m")]["l10_share_0"] == 1.0
    assert out[(1, "playoffs", "fg3m")]["l10_share_3plus"] == 1.0


def test_shares_are_empty_for_stats_that_are_not_counts(spark):
    r = run(spark, {1: [dict(season=2027, pts=10)] * 3})[(1, "regular-season", "pts")]
    assert r["l10_share_0"] is None and r["l10_share_3plus"] is None


def test_player_who_has_not_played_this_season_is_kept_and_labelled(spark):
    out = run(spark, {1: [dict(season=2027, pts=10)] * 3, 2: [dict(season=2026, pts=7)] * 12})
    r = out[(2, "regular-season", "pts")]
    assert r["season_games"] == 0 and r["season_mean"] is None
    assert r["l10_games"] == 10 and r["l10_games_before_current_season"] == 10
    assert r["last_season_label"] == "2025-26" and r["season_label"] == "2026-27"


def test_a_player_with_few_games_has_a_short_window(spark):
    r = run(spark, {1: [dict(season=2027, pts=10)] * 12, 2: [dict(season=2027, pts=4), dict(season=2027, pts=8)]})[(2, "regular-season", "pts")]
    assert r["l10_games"] == 2 and r["l10_mean"] == 6.0 and r["total_games"] == 2


def test_latest_name_and_team_of_any_game_type_win(spark):
    games = [dict(season=2027, pts=5, name="Chris Manon", team="AAA", team_id=1),
             dict(season=2027, pts=6, name="Chris Mañon", team="BBB", team_id=2, season_type="playoffs")]
    out = run(spark, {1: games})
    for gt in ("regular-season", "playoffs"):
        r = out[(1, gt, "pts")]
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
