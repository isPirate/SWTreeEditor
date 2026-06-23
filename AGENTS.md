# AGENTS.md

SystemWeaver 元模型结构树编辑器 —— 一个单 HTML 文件工具，用于导入 / 可视化编辑 / 导出 SystemWeaver **元模型结构树**（ItemType 节点通过 PartType 边相连）。纯原生 JS，**零运行时依赖**，双击离线运行。界面与控制台输出均为中文。

## 架构 —— 文件为什么这样拆分

- `core.js` —— **只有纯逻辑**（解析 / 序列化 / 树操作 / 校验 / localStorage），不含 DOM。它特意与 UI 分离，*是为了能在 Node 里做单元测试，同时让交付物保持单文件自包含*。不要在源码里把它内联进 `index.html` —— 它只在生成的 `dist/index.html` 中被内联。
- `index.html` —— UI，通过 `<script src>` 加载 `core.js`。UI 行为与样式的源头。
- `dist/index.html` —— **生成的**单文件交付物（`core.js` 已内联）。绝不手改；用 `install.ps1` 重新构建。
- `test/run.js` —— `core.js` 的 Node 测试运行器（用 `eq`/`ok` 断言，失败时非零退出）。UI 没有自动化测试。
- `install.ps1`、`build-icon.ps1` —— 构建 / 部署 / 图标脚本。

## 命令

- `node test/run.js` —— 跑逻辑测试（当前 83 个）。改过 `core.js` 后必跑，必须保持全绿。
- `pwsh -ExecutionPolicy Bypass -File .\install.ps1` —— 完整部署：把 `core.js` 内联进 `dist/index.html` → 复制到 `%LOCALAPPDATA%\SWTreeEditor\` →（重新）创建桌面 `--app` 快捷方式（用 `app.ico`）。任何改动后重跑，刷新已安装副本与快捷方式。
- `pwsh -ExecutionPolicy Bypass -File .\build-icon.ps1` —— 从 `icon.svg` 的几何重新生成 `app.ico`（多尺寸，GDI+）。改了 `icon.svg` 后跑它，再跑 `install.ps1`。

## 关键陷阱

- **PowerShell 脚本保存为 UTF-8 *带 BOM*。** 在 zh-CN Windows 上这是必须的：`powershell.exe`（5.1）会把无 BOM 的脚本按 GBK 读取，中文（及相邻的正则/字符串）会损坏 → 解析失败。编辑时务必保留 BOM。优先用 `pwsh`（PowerShell 7）运行，它无论有无 BOM 都按 UTF-8 处理。
- **`core.js` 的双环境导出必须保留**：同时要有 `module.exports = SWTree`（Node 测试用）和 `window.SWTree = SWTree`（浏览器 UI 用）。删掉任一会破坏一条代码路径。
- **遵循约定：未经明确要求不要执行 commit / push / 建分支。**

## UI 不变量 —— 这些是修过的 bug，不要回退

- `editField` 提交时走**外科手术式 DOM 更新**（把 `<input>` 换回 span + 调用 `refreshValidationDisplay()`），**不是** `render()`。在编辑提交时调 `render()` 会在 mousedown→mouseup 窗口内重建整树，引发间歇性的焦点/点击竞态 → "输入框变蓝、无法输入"。保持提交为局部更新。
- `render()` 保留 `_rendering` 重入守卫（`innerHTML = ''` 时会同步触发 blur）。务必保留。
- `renderNode` 里的操作按钮**按节点位置禁用**（`canUp`/`canDown`/`canIndent`/`canOutdent`）。在单子链上 ↑↓→← 大多是合法的空操作；它们必须保持可见的禁用（灰显）—— 如果看着可用却没反应，用户会以为按钮坏了。`＋` / `×` 永远可用。
- 空名称提交时**静默回退**到旧值（不弹 `alert`、不强制聚焦）。在 blur 处理器里弹模态 `alert()` 会重入并锁死编辑器。

## 数据模型不变量 —— SystemWeaver 领域

- 节点 = `{ name, itemSid, partSid, children }`。**根节点 `partSid === null`**（无入边）；每个非根节点都有 `partSid`。
- `partSid` = **连向父节点那条边上的 PartType SID**；`itemSid` = **节点自身的 ItemType SID**（可空 —— 如 "Requirement" 这种叶子可能没有）。
- **重复的 `itemSid` 是合法的** —— 同一 ItemType 在多处被引用，表示共享实例（如 `Space (ISA03)` 出现两次）。**不要**加 ItemType-SID 唯一性校验。唯一的校验警告是非根节点缺少 `partSid`。

## 领域参考

- SystemWeaver 的 Item / Part / PartType 概念：见 `sw-ext-dev` skill（`IswItem` / `IswPart`，PartType 是定义在两个 ItemType 之间的关系）。
- 设计依据与完整任务历史：`docs/plans/2026-06-22-sw-metamodel-tree-editor-design.md` 与 `…-editor.md`。
