import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { initialize, environment, buildIndex, searchWorkbench, newProject, queryLocalData, tokenize, packageRoot, inside } from '../src/core.mjs';

const fixtures = path.join(packageRoot, 'runtime/tests');
fs.mkdirSync(fixtures, { recursive: true });
function workspace() { const root = fs.mkdtempSync(path.join(fixtures, 'workspace-')); initialize(root); return { root, env: environment(root) }; }
function put(root, name, text) { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file; }

test('Chinese search finds current notes and removes stale source fragments', () => {
  const { root, env } = workspace();
  const file = put(root, 'private/notes/剪辑.md', '# 剪辑节奏\n相邻镜头的动作必须连续。');
  buildIndex(env);
  assert.ok(tokenize('怎么分析口型 ControlNet').includes('口型'));
  const found = searchWorkbench('剪辑节奏', { env }).results.find(item => item.path.endsWith('剪辑.md'));
  assert.ok(found); assert.equal(found.line, 1); assert.equal(found.sourceHash.length, 64);
  fs.writeFileSync(file, '# 已修改\n旧结论已撤回。');
  const after = searchWorkbench('剪辑节奏', { env });
  assert.ok(!after.results.some(item => item.path.endsWith('剪辑.md')));
  assert.ok(after.staleSources.includes('private/notes/剪辑.md'));
});

test('index excludes sessions, hidden files and unregistered folders', () => {
  const { root, env } = workspace();
  put(root, 'private/notes/Sessions/secret.md', '# excluded-sessions');
  put(root, 'private/notes/.hidden.md', '# excluded-hidden');
  put(root, 'private/notes/cache/file.md', '# excluded-cache');
  put(root, 'unregistered/private.md', '# excluded-unregistered');
  const result = buildIndex(env);
  assert.equal(result.fileCount, 10);
  assert.equal(searchWorkbench('excluded', { env }).results.length, 0);
});

test('routing returns only available Skills and never promotes a retired method', () => {
  const { root, env } = workspace();
  put(root, 'skills/retired/SKILL.md', '---\nname: retired\nstatus: retired\ndescription: obsolete-sentinel\n---\n# 旧方案\n');
  buildIndex(env);
  const routes = searchWorkbench('GitHub 仓库', { env, skillsOnly: true });
  assert.ok(routes.results.some(item => item.skill === 'github'));
  assert.equal(searchWorkbench('obsolete-sentinel', { env, skillsOnly: true }).results.length, 0);
  assert.equal(searchWorkbench('obsolete-sentinel', { env }).results[0].status, 'reference-only');
});

test('initialization preserves custom files and projects cannot traverse paths or overwrite', () => {
  const { root, env } = workspace();
  const file = put(root, 'skills/github/SKILL.md', '# My custom workflow');
  initialize(root); assert.equal(fs.readFileSync(file, 'utf8'), '# My custom workflow');
  const project = newProject('样例-project', env);
  assert.ok(fs.existsSync(path.join(root, project.contract)));
  assert.throws(() => newProject('样例-project', env), /已存在/);
  assert.throws(() => newProject('../escape', env), /项目名/);
  assert.throws(() => inside(root, '../escape'), /超出/);
});

test('workspace root validation refuses links that point outside the selected workspace', () => {
  const { root } = workspace();
  const outside = fs.mkdtempSync(path.join(fixtures, 'outside-'));
  const link = path.join(root, 'escape');
  fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => inside(root, 'escape/note.md'), /链接/);
});

test('MCP starts over stdio, lists four read-only tools and executes a real search', async () => {
  const { root, env } = workspace();
  put(root, 'private/notes/protocol.md', '# 协议样例\nprotocol-sentinel'); buildIndex(env);
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(packageRoot, 'src/cli.mjs'), '--root', root, 'mcp'] });
  const client = new Client({ name: 'workbench-release-check', version: '1.0.0' });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 4);
    assert.ok(listed.tools.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
    const result = await client.callTool({ name: 'search_workbench', arguments: { query: 'protocol-sentinel' } });
    assert.ok(JSON.parse(result.content[0].text).results.some(item => item.path.endsWith('protocol.md')));
    const denied = await client.callTool({ name: 'install', arguments: {} });
    assert.equal(denied.isError, true);
  } finally { await client.close(); }
});

const requireData = process.env.REQUIRE_DATA_TESTS === '1';
const dataReady = Boolean(process.env.WORKBENCH_PYTHON);
test('optional DuckDB aggregates the explicit file, rejects writes and blocks secondary files', { skip: !dataReady && !requireData }, () => {
  assert.ok(dataReady, 'CI must provide WORKBENCH_PYTHON for the data checks.');
  const { root, env } = workspace();
  const file = put(root, 'items.csv', 'category,quantity\na,2\nb,3\na,4\n');
  const original = fs.readFileSync(file, 'utf8');
  const result = queryLocalData(file, 'SELECT category, SUM(quantity) AS total FROM data GROUP BY category ORDER BY category', { env });
  assert.deepEqual(result.rows, [['a', 6], ['b', 3]]);
  assert.equal(result.readOnly, true); assert.equal(result.externalAccess, false);
  assert.throws(() => queryLocalData(file, 'DELETE FROM data', { env }), /SELECT/);
  assert.throws(() => queryLocalData(file, 'SELECT 1; SELECT 2', { env }), /SELECT/);
  assert.throws(() => queryLocalData(file, "SELECT * FROM read_csv_auto('other.csv')", { env }));
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('optional DuckDB reads JSON and Parquet and preserves large integers', { skip: !dataReady && !requireData }, () => {
  const { root, env } = workspace();
  const json = put(root, 'items.json', '[{"value":9007199254740993}]');
  assert.equal(queryLocalData(json, 'SELECT * FROM data', { env }).rows[0][0], '9007199254740993');
  const parquet = path.join(root, 'items.parquet');
  const script = "import duckdb,sys; c=duckdb.connect(); c.execute('COPY (SELECT 42 AS answer) TO ? (FORMAT PARQUET)', [sys.argv[1]])";
  const generated = spawnSync(env.python, ['-I', '-c', script, parquet], { encoding: 'utf8', windowsHide: true });
  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(queryLocalData(parquet, 'SELECT answer FROM data', { env }).rows[0][0], 42);
});
