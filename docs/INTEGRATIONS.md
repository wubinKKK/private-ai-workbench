# 接入 AI 与外部工具

## MCP

在支持 stdio MCP 的宿主中创建一个条目：command 为 node，args 依次为本仓库 src/cli.mjs 的实际位置、--root、你的工作区实际位置、mcp。使用宿主界面输入路径，不需要任何工作台 API Key。保持进程由宿主管理；不建立常驻网络服务。

工具为 workbench_status、search_workbench、find_workbench_skill、query_local_data。首次启动前显式执行 init 和 index。工具结果包含本地文本；若宿主使用云端模型，这些结果可能发往模型服务。

## Skills

宿主可以直接读取 skills/*/SKILL.md，或通过 route 定位工作方法。不需要复制你的原始聊天。启用其他 Skill 时，先检查来源和许可，再在自己的工作区登记；文档并不会自动安装软件。

## 外部工具

| 用途 | 推荐入口 | 本版包含什么 |
| --- | --- | --- |
| GitHub 仓库操作 | 官方 GitHub MCP；不可用时 gh | 操作方法，不含登录凭据 |
| 现有 Chrome 登录态 | OpenCLI | 连接检查与只读操作方法，不含扩展和 Cookie |
| Office/PDF 转文本 | Microsoft MarkItDown | 本机处理方法，不含原文件 |
| 游戏开发 | Godot 官方编辑器与适配的 MCP | 项目与验证方法，不含游戏工程 |
| 参考视频与剪辑 | OpenMontage、FFmpeg | 素材与交付管理方法，不含软件、云端账号或模型 |

配置工具时使用各自官方文档和宿主的凭据管理。不要把原来电脑上的绝对路径、设备配置或账户文件复制到公开仓库。
