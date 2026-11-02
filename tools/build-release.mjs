import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { checkRelease, root } from './check-release.mjs';
import { writeZip } from './zip-utf8.mjs';
export function buildRelease(out = path.join(root, 'dist')) {
  const checked = checkRelease();
  if (!checked.ok) throw new Error('公开检查未通过：' + JSON.stringify(checked.findings));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const prefix = pkg.name + '-' + pkg.version + '/', name = pkg.name + '-' + pkg.version + '.zip';
  const entries = checked.files.map(item => ({ name: prefix + item.path, data: fs.readFileSync(path.join(root, item.path)) }));
  const manifest = { name: pkg.name, version: pkg.version, files: checked.files };
  entries.push({ name: prefix + 'MANIFEST.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') });
  entries.push({ name: prefix + 'CHECKSUMS.sha256', data: Buffer.from(checked.files.map(item => item.sha256 + '  ' + item.path).join('\n') + '\n') });
  const zip = writeZip(entries), digest = createHash('sha256').update(zip).digest('hex');
  fs.mkdirSync(out, { recursive: true });
  const destination = path.join(out, name);
  fs.writeFileSync(destination, zip);
  fs.writeFileSync(path.join(out, 'SHA256SUMS'), digest + '  ' + name + '\n');
  return { ok: true, version: pkg.version, archive: destination, sha256: digest, files: entries.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const index = process.argv.indexOf('--out'); console.log(JSON.stringify(buildRelease(index >= 0 ? path.resolve(process.argv[index + 1]) : undefined), null, 2)); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}
