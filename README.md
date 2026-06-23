# SW 元模型结构树编辑器

> 一个单 HTML 文件的小工具：把 SystemWeaver 元模型结构树文本**导入 → 可视化编辑 → 导出规范文本**。纯原生 JS，零依赖，断网双击即用。

## 解决什么问题

开发 SystemWeaver 扩展时，常需要给 AI 提供一段"元模型结构树"（ItemType 之间通过 PartType 连接的层级），帮助 AI 理解项目结构。但 AI 生成的这类树文本经常有小差错（缩进、连接符 `├─└─│`、SID 配错），手动对齐这些 Unicode 树形字符非常折磨。

这个工具把"对齐字符"变成"操作节点"——导入文本 → 编辑节点 → 一键复制规范输出。

## 功能

- **容错导入**：识别多种变体（box-drawing `├─└─│`、ASCII `+--`/`|--`、纯空格缩进、`→`/`->`/`>` 箭头、空行等），来什么都能改
- **可视化编辑**：嵌套树形（左侧引导线 + 缩进）、整行 hover 高亮、原地编辑每个字段、缩进/提升/上移/下移/增/删
- **从零构建**：不必先导入，可新建根节点从头搭起
- **严格规范导出**：统一连接符规则（最后孩子 `└─`、否则 `├─`），复制 / 下载干净文本
- **实时校验**：缺 PartType SID 的节点行内红色高亮 + 底部说明
- **自动存档**：改动自动存 localStorage，刷新不丢
- **像软件一样用**：可安装为桌面快捷方式（独立窗口、品牌图标）

## 结构树格式

```
Mapping Tree (IMT01)
├─[PPT01]→ Polarion Tree (IPT02)
│   └─[PSP06]→ Space (ISA03)
│       └─[PPD02]→ Doc (IPD02)
│           └─[PPW01]→ Requirement
```

- 根节点：`名称 (类型SID)`
- 子节点：`[PartSID]→ 名称 (类型SID)`，用 `├─└─│` 或空格缩进表示层级（类型 SID 可省略）

## 安装与使用

### 当软件用（推荐）

在项目根目录用 PowerShell 7 运行：

```powershell
pwsh -ExecutionPolicy Bypass -File .\install.ps1
```

会在桌面创建快捷方式「SW 元模型结构树编辑器」，双击即在独立窗口（Edge `--app` 模式，无浏览器外壳）中打开。文件安装到 `%LOCALAPPDATA%\SWTreeEditor\`，与项目目录解耦。

### 直接用单文件

拿 `dist/index.html`（构建产物），双击用任意现代浏览器打开即可。

### 工作流

1. 粘贴结构树文本 →「导入」（或空状态下「新建根节点」从零开始）
2. 在编辑区调整节点：点字段改名 / SID，用行内按钮 ↑ ↓ ← → ＋ × 调结构
3. 在底部「规范化输出」区「复制」或「下载 .txt」

## 开发

纯原生 HTML/CSS/JS，无构建工具、无框架。纯逻辑抽到 `core.js`（可被 Node 测试），UI 在 `index.html`，单文件交付物 `dist/index.html` 由 `install.ps1` 把 `core.js` 内联生成。

```powershell
node test/run.js                                  # 跑逻辑测试（83 个）
pwsh -ExecutionPolicy Bypass -File .\install.ps1   # 构建 + 部署 + 桌面快捷方式
pwsh -ExecutionPolicy Bypass -File .\build-icon.ps1 # 从 icon.svg 重新生成 app.ico
```

改代码后重跑 `install.ps1` 即刷新已安装副本与快捷方式。

> 更多架构约定、关键陷阱与不变量见 [`AGENTS.md`](./AGENTS.md)。

## 目录结构

```
index.html        UI（开发用，引用 core.js）
core.js           纯逻辑（解析/序列化/树操作/校验/持久化），双环境导出
test/run.js       Node 逻辑测试
install.ps1       构建 + 部署 + 桌面快捷方式
build-icon.ps1    从 icon.svg 生成 app.ico
icon.svg          品牌图标源（矢量）
dist/index.html   生成的单文件交付物（core.js 已内联，由 install.ps1 构建）
docs/plans/       设计文档与实现计划
```
