#!/usr/bin/env node
import path from 'node:path';
import { initialize, environment, buildIndex, searchWorkbench, queryLocalData, status, newProject } from './core.mjs';

try {
  const argv = process.argv.slice(2);
  const rootIndex = argv.indexOf('--root');
  let root = process.cwd();
  if (rootIndex >= 0) {
    if (!argv[rootIndex + 1]) throw new Error('--root 需要一个工作区路径。');
    root = path.resolve(argv[rootIndex + 1]); argv.splice(rootIndex, 2);
  }
  const [command = 'help', ...rest] = argv;
  let result;
  if (command === 'help') result = { commands: ['init', 'index', 'search <问题>', 'route <目标>', 'status', 'data <文件> [SELECT 查询]', 'new-project <名称>', 'mcp'], workspace: '--root <目录>，默认当前目录。MCP 只暴露只读工具。' };
  else if (command === 'init') result = initialize(root);
  else {
    const env = environment(root);
    if (command === 'index') result = buildIndex(env);
    else if (command === 'search' || command === 'route') result = searchWorkbench(rest.join(' '), { env, skillsOnly: command === 'route' });
    else if (command === 'status') result = status(env);
    else if (command === 'data') result = queryLocalData(rest[0], rest.slice(1).join(' ') || undefined, { env });
    else if (command === 'new-project') result = newProject(rest[0], env);
    else if (command === 'mcp') { const { serve } = await import('./mcp.mjs'); await serve(env); }
    else throw new Error('未知命令，运行 help 查看用法。');
  }
  if (result) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) { process.stderr.write(JSON.stringify({ ok: false, error: error.message }) + '\n'); process.exitCode = 1; }
