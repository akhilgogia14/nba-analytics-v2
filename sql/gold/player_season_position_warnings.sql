-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- A player with two different labels in one season's roster snapshots: the newest snapshot's label is used.
SELECT 'player_season_has_two_labels' AS warning, concat(CAST(player_id AS STRING), '|', CAST(season AS STRING)) AS row_key,
       to_json(named_struct('labels', concat_ws(',', array_sort(collect_set(upper(trim(position))))))) AS detail
FROM workspace.nba_v2_bronze.rosters
WHERE position IS NOT NULL AND trim(position) <> ''
GROUP BY player_id, season HAVING count(DISTINCT upper(trim(position))) > 1
UNION ALL
-- A season where more than 15% of played regular-season games belong to a player with no listed position (traded or signed
-- mid-season players are often missing from the roster snapshot). The grid shows them as "Not listed".
SELECT 'season_many_games_without_a_position', CAST(season AS STRING),
       to_json(named_struct('share_without_label', round(100 * avg(CASE WHEN no_label THEN 1.0 ELSE 0.0 END), 1), 'games', count(*)))
FROM (SELECT g.season, p.person_id IS NULL AS no_label
      FROM workspace.nba_v2_silver.player_game g
      LEFT JOIN {T} p ON p.person_id = g.person_id AND p.season = g.season
      WHERE g.played AND g.season_type = 'regular-season')
GROUP BY season HAVING avg(CASE WHEN no_label THEN 1.0 ELSE 0.0 END) > 0.15
