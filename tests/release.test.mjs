import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { checkRelease, releaseFiles, inspectText, root } from '../tools/check-release.mjs';
import { buildRelease } from '../tools/build-release.mjs';
import { readZipNames } from '../tools/zip-utf8.mjs';

test('all shipped source files pass publication checks', () => {
  const checked = checkRelease();
  assert.deepEqual(checked.findings, []);
  assert.ok(checked.files.some(item => item.path === 'src/data.py'));
  assert.ok(!checked.files.some(item => /^(private|runtime|node_modules|\.git)\//.test(item.path)));
});

test('secret scanner detects synthetic token and home-path samples without disclosing values', () => {
  assert.ok(inspectText('gh' + 'p_' + 'a'.repeat(36)).includes('github-token'));
  assert.ok(inspectText('sk' + '-' + 'b'.repeat(32)).includes('api-secret'));
  assert.ok(inspectText(['C:', 'Users', 'example-person', 'file'].join(String.fromCharCode(92))).includes('personal-home'));
  assert.deepEqual(inspectText('node src/cli.mjs --root ./my-workspace index'), []);
});

test('release manifest refuses a credential file even when explicitly listed', () => {
  const parent = path.join(root, 'runtime/tests'); fs.mkdirSync(parent, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(parent, 'denied-release-'));
  fs.writeFileSync(path.join(fixture, 'release-files.json'), JSON.stringify({ files: ['.env'], directories: [] }));
  fs.writeFileSync(path.join(fixture, '.env'), 'synthetic');
  assert.throws(() => releaseFiles(fixture), /不允许发布/);
});

test('Git source cannot contain tracked files outside the public release manifest', () => {
  const parent = path.join(root, 'runtime/tests'); fs.mkdirSync(parent, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(parent, 'tracked-release-'));
  fs.writeFileSync(path.join(fixture, 'release-files.json'), JSON.stringify({ files: ['release-files.json', 'README.md'], directories: [] }));
  fs.writeFileSync(path.join(fixture, 'README.md'), '# Public example');
  fs.writeFileSync(path.join(fixture, 'local-note.txt'), 'Synthetic local-only content');
  for (const args of [['init', '-q'], ['add', '--', 'README.md', 'release-files.json', 'local-note.txt']]) {
    const git = spawnSync('git', args, { cwd: fixture, encoding: 'utf8', windowsHide: true });
    assert.equal(git.status, 0, git.stderr);
  }
  assert.ok(checkRelease(fixture).findings.some(item => item.kind === 'tracked-outside-public-manifest' && item.file === 'local-note.txt'));
});

test('release ZIP is deterministic, complete and excludes local test artifacts', () => {
  const parent = path.join(root, 'runtime/tests'); fs.mkdirSync(parent, { recursive: true });
  const out = fs.mkdtempSync(path.join(parent, 'release-'));
  const first = buildRelease(out), firstBytes = fs.readFileSync(first.archive);
  const second = buildRelease(out);
  assert.equal(first.sha256, second.sha256);
  assert.equal(createHash('sha256').update(firstBytes).digest('hex'), first.sha256);
  const directory = readZipNames(firstBytes);
  assert.ok(directory.every(entry => entry.utf8Flagged));
  const names = directory.map(entry => entry.name);
  assert.ok(names.some(name => name.endsWith('/MANIFEST.json')));
  assert.ok(names.some(name => name.endsWith('/CHECKSUMS.sha256')));
  assert.ok(names.some(name => name.endsWith('/README.md')));
  assert.equal(names.length, checkRelease().fileCount + 2);
  assert.ok(!names.some(name => /\/(private|runtime|node_modules|\.git)\//.test(name)));
});
