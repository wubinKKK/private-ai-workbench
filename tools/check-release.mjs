import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forbidden = /(?:^|\/)(?:private|vault|sessions|runtime|cache|reports|node_modules|\.git|\.venv)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|cookies[^/]*|credentials[^/]*|workbench\.local\.json)$|\.(?:pem|key|pfx|p12|safetensors|gguf|mp4|wav|dmp)$/i;
const signatures = [
  ['github-token', /gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{30,}/],
  ['api-secret', /\bsk-[A-Za-z0-9_-]{24,}|\bAKIA[A-Z0-9]{16}\b/],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['personal-home', /[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}[A-Za-z0-9_.-]+[\\/]|\/(?:Users|home)\/[A-Za-z0-9_.-]+\//],
  ['private-chat-attachment', /cindy-media:\/\/blobs\/|remote-agent[\\/]workspaces[\\/]/],
  ['credential-value', /["'](?:api_key|access_token|refresh_token|client_secret|password)["']\s*:\s*["'][A-Za-z0-9_+\/-]{16,}["']/i]
];
export function inspectText(text) { return signatures.filter(([, pattern]) => pattern.test(text)).map(([name]) => name); }
export function releaseFiles(base = root) {
  const spec = JSON.parse(fs.readFileSync(path.join(base, 'release-files.json'), 'utf8'));
  const found = [];
  function add(relative) {
    const normalized = relative.split(path.sep).join('/');
    if (path.isAbsolute(relative) || normalized.split('/').includes('..') || forbidden.test(normalized)) throw new Error('不允许发布的路径：' + normalized);
    const full = path.join(base, relative), stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error('公开发行版不接受文件链接：' + normalized);
    if (stat.isDirectory()) for (const item of fs.readdirSync(full).sort()) add(path.join(relative, item));
    else if (stat.isFile()) found.push(normalized);
    else throw new Error('公开发行版只接受普通文件。');
  }
  for (const file of spec.files) add(file);
  for (const directory of spec.directories) add(directory);
  return [...new Set(found)].sort();
}
export function checkRelease(base = root) {
  const files = releaseFiles(base), findings = [];
  for (const file of files) {
    const body = fs.readFileSync(path.join(base, file));
    if (body.includes(0)) findings.push({ file, kind: 'binary-not-reviewed' });
    for (const kind of inspectText(body.toString('utf8'))) findings.push({ file, kind });
  }
  if (fs.existsSync(path.join(base, '.git'))) {
    const git = spawnSync('git', ['-C', base, 'ls-files', '-z'], { encoding: 'utf8', windowsHide: true });
    if (git.status !== 0) throw new Error('无法核对 Git 跟踪范围。');
    const allowed = new Set(files);
    for (const file of git.stdout.split('\0').filter(Boolean)) {
      if (!allowed.has(file)) findings.push({ file, kind: 'tracked-outside-public-manifest' });
    }
  }
  return { ok: !findings.length, fileCount: files.length, findings, files: files.map(file => ({ path: file, sha256: createHash('sha256').update(fs.readFileSync(path.join(base, file))).digest('hex') })) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = checkRelease(); console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exitCode = 1; }
  catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}
