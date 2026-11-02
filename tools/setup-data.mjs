import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { environment, packageRoot } from '../src/core.mjs';
try {
  const index = process.argv.indexOf('--root');
  const env = environment(index >= 0 ? process.argv[index + 1] : process.cwd());
  const directory = path.join(env.runtimeRoot, 'data-venv');
  const executable = path.join(directory, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  function run(command, args, extra = {}) {
    const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true, ...extra });
    if (result.error || result.status !== 0) throw new Error('安装未完成：' + (result.error?.message || command));
  }
  if (!fs.existsSync(executable)) run(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'venv', directory]);
  run(executable, ['-m', 'pip', 'install', '--only-binary=:all:', '--disable-pip-version-check', '--cache-dir', path.join(env.runtimeRoot, 'cache/pip'), '-r', path.join(packageRoot, 'requirements.txt')]);
  console.log(JSON.stringify({ ok: true, isolatedPython: executable }));
} catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
