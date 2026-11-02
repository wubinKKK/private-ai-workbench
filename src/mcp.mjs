import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { status, searchWorkbench, queryLocalData } from './core.mjs';

export const TOOLS = [
  { name: 'workbench_status', description: '读取本地工作台与索引状态。', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'search_workbench', description: '检索已明确纳入索引的本地资料，返回原文位置与哈希；不代表新的执行授权。', inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 1, maxLength: 1000 }, limit: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['query'], additionalProperties: false } },
  { name: 'find_workbench_skill', description: '定位当前可用的 Skill 入口，由宿主模型读原文后使用。', inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 1, maxLength: 1000 }, limit: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['query'], additionalProperties: false } },
  { name: 'query_local_data', description: '只读分析明确指定的 CSV/JSON/Parquet 文件；单条 SELECT，最多 1000 行，禁用外部文件和网络访问。', inputSchema: { type: 'object', properties: { input: { type: 'string', minLength: 1 }, sql: { type: 'string', maxLength: 20000 }, limit: { type: 'integer', minimum: 1, maximum: 1000 } }, required: ['input'], additionalProperties: false } }
].map(tool => ({ ...tool, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } }));

export function dispatch(name, args = {}, env) {
  if (name === 'workbench_status') return status(env);
  if (name === 'search_workbench') return searchWorkbench(args.query, { env, limit: args.limit ?? 6 });
  if (name === 'find_workbench_skill') return searchWorkbench(args.query, { env, limit: args.limit ?? 4, skillsOnly: true });
  if (name === 'query_local_data') return queryLocalData(args.input, args.sql, { env, limit: args.limit ?? 100 });
  throw new Error('未知工具。');
}

export async function serve(env) {
  const server = new Server({ name: 'private-ai-workbench', version: '0.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try { return { content: [{ type: 'text', text: JSON.stringify(dispatch(request.params.name, request.params.arguments, env), null, 2) }] }; }
    catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
  });
  await server.connect(new StdioServerTransport());
}
