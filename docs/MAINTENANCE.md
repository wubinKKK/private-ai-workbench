# 维护、升级与发布

代码、Skills 与配置样例在这个公开仓库维护。个人记录继续放在独立的私人工作区，不回写本仓库。对其他版本的改进，以逐文件审阅的代码变更迁移，不自动拉取其资料和历史。

日常修改后：

~~~sh
npm ci --ignore-scripts
npm test
npm run check
npm run release
git diff
~~~

release-files.json 是公开源文件和 ZIP 的清单。新增目录必须显式登记。Git 跟踪的文件若不在清单中，公开检查同样拒绝，避免仓库源码与 ZIP 采用不同的边界。

发布新版本：更新 package.json、package-lock.json、CHANGELOG.md 和 MCP 服务版本，完成检查，提交后推送 v* 标签。GitHub Actions 会再次运行检查并生成 ZIP、SHA256SUMS 和 GitHub Release。GitHub 自动生成的 Source code 是公开仓库当前标签的源码，不包含依赖安装目录。

更新工作区中的 Skills 时逐个审阅后复制；init 遇到已有 Skill 会保留，避免覆盖使用者修改。升级程序后重新运行 index 更新检索片段。数据目录合同和旧成果继续沿用。

本地测试仅在被忽略的 runtime/tests 下建立独立样例。发布构建仅写 dist 或显式 --out 目录。不会清理系统目录、改私有仓库可见性、上传用户资料或安装后台任务。
