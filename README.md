# Private AI Workbench · 私人 AI 工作台

把自己的资料、可复用的 Skills 和本机工具，接成一个可以持续维护的 AI 工作环境。

公开版提供可以运行的本地检索、Skills 定位、只读数据分析和项目目录管理，以及 10 个通用 Skill。它不包含个人笔记、记忆内容、账号、设备资料、作品、模型权重或第三方软件安装包。AI 模型由你选择的宿主提供。

## 维护与更新节奏

> **公开版按需整理发布，可能落后于私有主线，不保证功能和更新时间同步。**

- 维护者的私人工作台是日常开发和维护主线，通用功能也先在私有主线迭代。
- 维护者安排更新公开项目时，再选取适合公开的通用改动，完成兼容整理、测试与公开检查后提交或发行。
- 两边没有自动同步；私有主线可能已有尚未纳入公开版的功能或修复。公开版的可用能力以本仓库说明、[更新记录](CHANGELOG.md)和已发布版本为准。

个人资料、密钥及私有 Git 历史始终隔离。详细流程见[维护与升级](docs/MAINTENANCE.md)。

## 五分钟开始

需要 Node.js 22 或更新，以及 Git 或 ZIP 解压工具。

~~~sh
git clone https://github.com/wubinKKK/private-ai-workbench.git
cd private-ai-workbench
npm ci --ignore-scripts
node src/cli.mjs init
node src/cli.mjs index
node src/cli.mjs search "如何分析本地表格"
node src/cli.mjs route "查 GitHub 仓库"
~~~

把自己的 Markdown 放进 private/notes，然后重新运行 index。private/memory 可存放你自主管理的长期记录，默认同样不入 Git。不会自动导入浏览器、扫描硬盘或读取其他工作台。

已有资料目录可以在 workbench.local.json 中显式登记；只读取指定工作区内的 Markdown，不跟随通向外部的目录链接，也不会索引 Sessions、缓存和运行目录。

## 现在能做什么

| 能力 | 状态 |
| --- | --- |
| 中文、英文资料全文检索 | 内置；返回当前原文、行号和哈希 |
| Skills 定位 | 内置；失败或停用的 Skill 不作为可用入口 |
| CSV、TSV、JSON、JSONL、Parquet 汇总 | 可选 DuckDB；只读、单文件、单条 SELECT |
| 项目目录与输入/审核/交付合同 | 内置；不会覆盖已存在项目 |
| MCP 接入 | 内置 4 个只读工具，stdio，不开后台网络服务 |
| GitHub、浏览器、文档、Godot、视频工作方法 | 通用 Skills；相关软件、授权和模型另行配置 |

~~~sh
node src/cli.mjs status
node src/cli.mjs new-project demo
node src/cli.mjs --root ./my-workspace init
~~~

工作区可放在仓库之外，使用同一个 --root 参数访问。这样代码升级和私人数据互不混合。详见 [安装说明](docs/INSTALL.md)。

## 接到你的 AI

把 [AGENTS.md](AGENTS.md) 交给支持本地文件的 AI 宿主，或使用 [MCP 接入说明](docs/INTEGRATIONS.md)。当前程序本身不提供模型、聊天界面或在线账号。

~~~sh
node src/cli.mjs --root ./my-workspace mcp
~~~

MCP 只暴露工作台状态、资料检索、Skills 定位和只读数据查询。初始化和新建项目是显式 CLI 操作，MCP 不执行任意命令、不安装软件、不发布内容。

## 可选数据引擎

需要 Python 3.10 或更新。安装只进入所选工作区的 runtime/data-venv。

~~~sh
npm run setup:data
node src/cli.mjs data examples/sample.csv "SELECT category, SUM(quantity) AS total FROM data GROUP BY category"
~~~

自定义工作区：npm run setup:data -- --root ./my-workspace。已有环境可用 WORKBENCH_PYTHON 指定装有 DuckDB 的 Python；不需要 API Key。

## 私人数据与公开代码

核心检索和计算在本机执行；索引同样包含你的原文片段，需要按私人资料保存。若宿主 AI 使用云端模型，回传给宿主的工具结果可能进入该模型服务，这不等于全离线 AI。

公开发行通过 release-files.json 逐项选择文件；private、runtime、账号配置和 Git 历史不进入 ZIP。默认忽略规则是第一层边界，发布检查另行扫描候选文件。见 [数据边界](docs/PRIVACY.md)。

## 开发与发行

~~~sh
npm test
npm run check
npm run release
~~~

发行包在 dist，附 SHA-256、逐文件清单与校验值。main 分支自动检查；推送 v* 标签后自动发布 GitHub Release。见 [维护与升级](docs/MAINTENANCE.md)。

## 目录

~~~text
src/          本地检索、数据查询、CLI 和 MCP
skills/       10 个通用工作方法
docs/         安装、接入、数据边界与维护
examples/     全新虚构样例
tools/        数据环境安装、发布扫描与确定性 ZIP 构建
tests/        隔离功能、协议和发布边界检查
private/      使用者自己的资料；初始化后创建，不入 Git
runtime/      索引、缓存和可选 Python 环境；不入 Git
~~~

许可证：[MIT](LICENSE)。第三方依赖见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。公开版从私人工作台提取通用实现和方法，使用独立代码树和全新历史；不会同步原工作台的个人内容。当前为首个公开预览版本 v0.1.0。
