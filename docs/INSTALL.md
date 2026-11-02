# 安装与独立工作区

1. 安装 Node.js 22 或更新。
2. 克隆仓库或解压 GitHub Release ZIP，进入包含 package.json 的目录。
3. 运行 npm ci --ignore-scripts。
4. 运行 node src/cli.mjs --root ./my-workspace init。
5. 把 Markdown 放入 my-workspace/private/notes。
6. 运行 node src/cli.mjs --root ./my-workspace index。

~~~sh
node src/cli.mjs --root ./my-workspace search "以前怎么做"
node src/cli.mjs --root ./my-workspace route "制作视频"
node src/cli.mjs --root ./my-workspace status
~~~

--root 可以是你自己选择的绝对路径；文档使用相对路径方便跨平台。之后每次调用都使用同一工作区。init 不覆盖已有配置、笔记或 Skills。

workbench.local.json 中 documentRoots 和 skillRoots 必须是工作区内的相对目录；默认只索引 private/notes、private/memory 和 skills。不要登记整个磁盘。Sessions、隐藏目录、运行与缓存目录不会进入索引。

可选数据功能需要 Python。运行 npm run setup:data -- --root ./my-workspace 安装独立环境。若已有安装了 DuckDB 的 Python，可用当前 shell 的 WORKBENCH_PYTHON 环境变量指定它。程序不会更改系统 Python、安装浏览器插件或保存云端账号。

卸载程序前先保留自己的工作区。代码目录和私人数据可以放在不同位置，避免升级时覆盖资料。不要把含私人数据的目录整体上传或附到问题报告。
