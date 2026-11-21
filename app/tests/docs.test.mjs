import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COMPONENTS, DECISIONS, DOCS_TOPICS, FAQ, PATHS, REQUEST_STEPS, TABLES, WORKFLOW, docsTopicFromHash, searchTables, tablesIn } from '../src/lib/docs.ts'
import { parseHash } from '../src/lib/pages.ts'

test('docs addresses: the page and each sub-page', () => {
  assert.equal(parseHash('#/docs').page, 'docs')
  assert.equal(parseHash('#/docs/model').page, 'docs')
  assert.equal(parseHash('#/docs/dictionary?q=rest').page, 'docs')
  assert.equal(parseHash('#/documents').page, 'today')
  assert.equal(docsTopicFromHash('#/docs'), 'home')
  assert.equal(docsTopicFromHash('#/docs/model'), 'model')
  assert.equal(docsTopicFromHash('#/docs/dictionary?q=rest'), 'dictionary')
  assert.equal(docsTopicFromHash('#/docs/workflow'), 'workflow')
  assert.equal(docsTopicFromHash('#/docs/architecture'), 'architecture')
  assert.equal(docsTopicFromHash('#/docs/nothing'), 'home')
  for (const t of DOCS_TOPICS) assert.equal(docsTopicFromHash(t.path), t.key) // every nav link opens its own topic
})

test('every table is documented once, and every gold table lists its columns', () => {
  const names = TABLES.map((t) => `${t.layer}.${t.name}`)
  assert.equal(new Set(names).size, names.length)
  for (const t of tablesIn('gold')) {
    assert.ok(t.columns.length > 0, `${t.name} has columns`)
    const cols = t.columns.map((c) => c.name)
    assert.equal(new Set(cols).size, cols.length, `${t.name} has no repeated column`)
    for (const k of t.key) assert.ok(cols.includes(k), `${t.name}: key ${k} is a column`)
    for (const c of t.columns) assert.ok(c.type && c.meaning.trim().length >= 4, `${t.name}.${c.name} has a type and a meaning`)
  }
  for (const t of TABLES) {
    assert.ok(t.purpose && t.grain && t.usedBy, `${t.name} has words`)
    for (const f of t.from) assert.ok(TABLES.some((o) => o.name === f), `${t.name} is built from ${f}, which is documented`)
  }
})

test('drift: the silver and gold tables the build script makes are exactly the ones documented', () => {
  const src = readFileSync(new URL('../../scripts/silver_build.py', import.meta.url), 'utf8')
  const block = src.slice(src.indexOf('TABLES = {'), src.indexOf('MAX_DELETE_FRACTION'))
  const built = [...block.matchAll(/^\s{4}"(\w+)":\s*\{[^}]*"layer":\s*"(silver|gold)"/gm)].map((m) => `${m[2]}.${m[1]}`)
  assert.ok(built.length >= 10, 'found the tables in silver_build.py')
  const documented = TABLES.filter((t) => t.layer !== 'bronze').map((t) => `${t.layer}.${t.name}`)
  assert.deepEqual([...built].sort(), documented.sort())
})

test('drift: the bronze tables in config/sources.json are exactly the ones documented', () => {
  const cfg = JSON.parse(readFileSync(new URL('../../config/sources.json', import.meta.url), 'utf8'))
  const loaded = Object.values(cfg.bronze.tables).map((t) => t.table)
  assert.deepEqual([...loaded].sort(), tablesIn('bronze').map((t) => t.name).sort())
})

test('search finds tables and columns by name or meaning, and an empty search shows all', () => {
  assert.equal(searchTables('').length, TABLES.length)
  const rest = searchTables('days_rest')
  assert.equal(rest[0].table.name, 'game_context')
  assert.ok(rest[0].columns.some((c) => c.name === 'days_rest'))
  assert.ok(searchTables('BACK-TO-BACK').some((r) => r.table.name === 'game_context')) // case does not matter, meaning is searched
  assert.equal(searchTables('zzzzzz').length, 0)
  const byTable = searchTables('team_vs_opponent')
  assert.ok(byTable.some((r) => r.table.name === 'team_vs_opponent' && r.columns.length === r.table.columns.length)) // a table-name match shows all its columns
})

test('workflow steps are numbered in order and the start page has questions', () => {
  assert.deepEqual(WORKFLOW.map((s) => s.n), WORKFLOW.map((_, i) => i + 1))
  for (const s of WORKFLOW) assert.ok(s.title && s.where && s.what && s.check)
  assert.ok(FAQ.length >= 5 && FAQ.every((f) => f.q.endsWith('?') && f.a.length > 20))
})

test('architecture: three paths, every piece explained, and the pieces named in the paths are all described', () => {
  assert.deepEqual(PATHS.map((p) => p.name), ['Data path', 'Request path', 'Release path'])
  for (const p of PATHS) assert.ok(p.nodes.length >= 3 && p.nodes.every((n) => n.title && n.sub))
  for (const c of COMPONENTS) assert.ok(c.name && c.role && c.why)
  assert.ok(REQUEST_STEPS.length === 5 && DECISIONS.length >= 6)
  const names = COMPONENTS.map((c) => c.name).join(' | ')
  for (const must of ['GitHub Actions', 'Cloudflare R2', 'Databricks Apps', 'SQL warehouse', 'Slack']) assert.ok(names.includes(must), `${must} is described`)
})
