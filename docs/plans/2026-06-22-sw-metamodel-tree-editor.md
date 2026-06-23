# SW 元模型结构树编辑器 — 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个单 HTML 文件工具，导入 SystemWeaver 元模型结构树文本 → 可视化编辑 → 导出规范文本/复制。

**Architecture:** 纯逻辑（解析/序列化/树操作/校验）抽到 `core.js`（双环境：浏览器全局 `window.SWTree` + Node `module.exports`）。`index.html` 做 UI 并引用 `core.js`。`test/run.js` 用 Node 跑纯逻辑测试。最后一个任务把 `core.js` 内联进 `dist/index.html`，得到零依赖单文件交付物。

**Tech Stack:** 原生 HTML/CSS/JS（零依赖），Node 22 仅用于跑测试（非运行时依赖），localStorage 持久化。

**设计文档:** `docs/plans/2026-06-22-sw-metamodel-tree-editor-design.md`

---

## 约定

- **测试命令**：`node test/run.js`（纯逻辑任务）。预期输出末行 `N passed, 0 failed`，退出码 0。任何 FAIL 会打印详情并退出码 1。
- **UI 任务**无自动化测试，按任务的"验证"步骤人工核对（打开 `index.html`）。
- **Git**：本目录当前非 git 仓库。Task 0 可选初始化；之后的"commit"步骤假定 git 已初始化。若用户不想用 git，跳过 commit 步骤即可，不影响功能。
- **不变量**（见设计文档 §3）：根节点 `partSid === null`；其余节点必有 `partSid`；`itemSid` 任意节点可空。
- **SID 字符集**：字母数字（`[A-Za-z0-9]+`）。

---

## Task 0（可选）：Git 初始化

**Files:** 仓库根

**Step 1:** 若用户同意用 git：`git init`，添加 `.gitignore`（忽略 `dist/`、`.DS_Store`、`*.log`）。
**Step 2:** 首次提交占位：`git add -A && git commit -m "chore: project scaffold"`。
**Step 3:** 若用户不需要 git，跳过本任务及所有 commit 步骤。

---

## Task 1：骨架 — core.js 命名空间 + 测试运行器 + index.html 占位

**Files:**
- Create: `core.js`
- Create: `test/run.js`
- Create: `index.html`
- Create: `test/.gitkeep`（可选）

**Step 1: 写 `core.js` 骨架（双环境导出 + 一个 sanity 函数）**

```js
// core.js — 纯逻辑，无 DOM 依赖。双环境导出。
const SWTree = {
  version: '1.0.0',
};

if (typeof module !== 'undefined' && module.exports) module.exports = SWTree;
if (typeof window !== 'undefined') window.SWTree = SWTree;
```

**Step 2: 写 `test/run.js` 测试运行器骨架 + 一个 sanity 测试**

```js
// test/run.js — 用 Node 跑纯逻辑测试。命令：node test/run.js
const SWTree = require('../core.js');

let passed = 0;
let failed = 0;

function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}

function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error(`FAIL: ${msg}`); }
}

// === sanity ===
eq(SWTree.version, '1.0.0', 'core 模块可加载');

// 后续任务的测试追加到这里

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

**Step 3: 写 `index.html` 占位（三区结构）**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SW 元模型结构树编辑器</title>
  <style>/* Task 18 填充 */</style>
</head>
<body>
  <h1>SW 元模型结构树编辑器</h1>
  <section id="import-area">
    <h2>导入</h2>
    <textarea id="import-text" rows="6" placeholder="粘贴结构树文本..."></textarea>
    <button id="btn-import">导入</button>
    <button id="btn-clear">清空</button>
  </section>
  <section id="editor-area">
    <h2>编辑区</h2>
    <div id="tree-root"></div>
  </section>
  <section id="output-area">
    <h2>规范化输出</h2>
    <textarea id="output-text" rows="10" readonly></textarea>
    <button id="btn-copy">复制</button>
    <button id="btn-download">下载 .txt</button>
  </section>
  <script src="core.js"></script>
  <script>/* UI 逻辑在后续任务填充 */</script>
</body>
</html>
```

**Step 4: 运行测试**
Run: `node test/run.js`
Expected: `1 passed, 0 failed`，退出码 0。

**Step 5: Commit**
`git add core.js test/run.js index.html && git commit -m "feat: project scaffold with dual-env core and test runner"`

---

## Task 2：数据模型 — makeNode 工厂

**Files:**
- Modify: `core.js`（在 `SWTree` 对象内加 `makeNode`）
- Modify: `test/run.js`（追加测试）

**Step 1: 先写失败测试（追加到 sanity 测试后）**

```js
// === Task 2: makeNode ===
{
  const n = SWTree.makeNode({ name: 'Root', itemSid: 'IMT01' });
  eq(n.name, 'Root', 'makeNode.name');
  eq(n.itemSid, 'IMT01', 'makeNode.itemSid');
  eq(n.partSid, null, 'makeNode.partSid 默认 null');
  eq(n.children, [], 'makeNode.children 默认 []');

  const child = SWTree.makeNode({ name: 'C', itemSid: 'IC', partSid: 'PC', children: ['x'] });
  eq(child.children, ['x'], 'makeNode.children 显式传入');
}
```

**Step 2: 运行测试，确认失败**
Run: `node test/run.js`
Expected: FAIL（`SWTree.makeNode is not a function`）。

**Step 3: 实现 makeNode**

在 `core.js` 的 `SWTree` 对象内添加：

```js
makeNode(opts) {
  return {
    name: opts.name || '',
    itemSid: opts.itemSid != null ? opts.itemSid : null,
    partSid: opts.partSid != null ? opts.partSid : null,
    children: Array.isArray(opts.children) ? opts.children : [],
  };
},
```

**Step 4: 运行测试，确认通过**
Run: `node test/run.js`
Expected: `4 passed, 0 failed`（累计）。

**Step 5: Commit**
`git add core.js test/run.js && git commit -m "feat: makeNode factory"`

---

## Task 3：parseTree — 规范格式 happy path

**Files:** Modify: `core.js`, `test/run.js`

**Step 1: 先写失败测试（用设计文档里的规范示例）**

```js
// === Task 3: parseTree 规范格式 ===
{
  const text = [
    'Mapping Tree (IMT01)',
    '├─[PPT01]→ Polarion Tree (IPT02)',
    '│   ├─[PSP06]→ Space (ISA03)',
    '│   │   ├─[PSP05]→ Space (ISA03)',
    '│   │   │   └─[PPD02]→ Doc (IPD02)',
    '│   │   │       └─[PPW01]→ Requirement',
  ].join('\n');
  const { root, errors } = SWTree.parseTree(text);
  ok(root !== null, 'parseTree 返回根节点');
  eq(errors, [], 'parseTree 无错误');
  eq(root.name, 'Mapping Tree', '根 name');
  eq(root.itemSid, 'IMT01', '根 itemSid');
  eq(root.partSid, null, '根 partSid 为 null');
  eq(root.children.length, 1, '根有 1 个子节点');
  const polarion = root.children[0];
  eq(polarion.partSid, 'PPT01', 'Polarion partSid');
  eq(polarion.name, 'Polarion Tree', 'Polarion name');
  eq(polarion.itemSid, 'IPT02', 'Polarion itemSid');
  const space1 = polarion.children[0];
  eq(space1.partSid, 'PSP06', 'Space1 partSid');
  const doc = space1.children[0].children[0];
  eq(doc.partSid, 'PPD02', 'Doc partSid');
  eq(doc.name, 'Doc', 'Doc name');
  const req = doc.children[0];
  eq(req.partSid, 'PPW01', 'Requirement partSid');
  eq(req.name, 'Requirement', 'Requirement name');
  eq(req.itemSid, null, 'Requirement 无 itemSid');
}
```

**Step 2: 运行测试，确认失败**
Run: `node test/run.js`
Expected: FAIL（parseTree 不存在）。

**Step 3: 实现 parseTree（含辅助 contentStartCol + parseNodeContent）**

在 `core.js` 的 `SWTree` 对象内、`makeNode` 之后添加：

```js
// 解析辅助：树前缀字符集（空格/Tab/box-drawing/ASCII art）
const _TREE_CHARS = new Set([' ', '\t', '│', '|', '├', '└', '┌', '┐', '┘', '─', '-', '+', '\\', '/']);

_contentStartCol(line) {
  for (let i = 0; i < line.length; i++) {
    if (!_TREE_CHARS.has(line[i])) return i;
  }
  return -1;
},

// 解析辅助：从内容部分提取 partSid/name/itemSid
_parseNodeContent(content) {
  // 可选 [PARTSID] + 可选箭头(→/->/>) + Name + 可选 (ITEMSID)
  const re = /^(?:\[([A-Za-z0-9]+)\]\s*(?:→|->|>)?\s*)?(.+?)(?:\s*\(([A-Za-z0-9]+)\))?\s*$/;
  const m = content.match(re);
  if (!m) return null;
  const name = (m[2] || '').trim();
  if (!name) return null;
  return { partSid: m[1] || null, name, itemSid: m[3] || null };
},

parseTree(text) {
  const errors = [];
  const lines = text.split(/\r?\n/);
  const parsed = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;
    const col = SWTree._contentStartCol(raw);
    if (col < 0) { errors.push({ lineNo: i + 1, raw, message: '无法识别内容' }); continue; }
    const m = SWTree._parseNodeContent(raw.slice(col));
    if (!m) { errors.push({ lineNo: i + 1, raw, message: '解析失败' }); continue; }
    parsed.push({ col, ...m, lineNo: i + 1 });
  }
  if (parsed.length === 0) return { root: null, errors };

  const root = SWTree.makeNode({ name: parsed[0].name, itemSid: parsed[0].itemSid });
  root.partSid = null; // 根没有入边
  const stack = [{ node: root, col: parsed[0].col }];
  for (let i = 1; i < parsed.length; i++) {
    const p = parsed[i];
    while (stack.length > 1 && stack[stack.length - 1].col >= p.col) stack.pop();
    const parent = stack[stack.length - 1].node;
    const node = SWTree.makeNode({ name: p.name, itemSid: p.itemSid, partSid: p.partSid });
    parent.children.push(node);
    stack.push({ node, col: p.col });
  }
  return { root, errors };
},
```

**Step 4: 运行测试，确认通过**
Run: `node test/run.js`
Expected: 全部 PASS。

**Step 5: Commit**
`git add core.js test/run.js && git commit -m "feat: parseTree canonical format"`

---

## Task 4：parseTree — 容错变体

**Files:** Modify: `test/run.js`（追加变体测试）；`core.js` 通常无需改（若 Step 2 失败再修）

**Step 1: 写变体测试**

```js
// === Task 4: parseTree 容错变体 ===
{
  // 变体1：ASCII art 连接符 +-- 和 |-- + 2空格缩进
  const t1 = [
    'Root (R0)',
    '+-- [PA] -> Child A (CA)',
    '|   +-- [PB] -> Grand B (CB)',
  ].join('\n');
  const r1 = SWTree.parseTree(t1);
  eq(r1.errors, [], '变体1 无错误');
  eq(r1.root.children[0].partSid, 'PA', '变体1 partSid');
  eq(r1.root.children[0].children[0].itemSid, 'CB', '变体1 孙节点层级正确');

  // 变体2：纯空格缩进（无连接符），> 箭头
  const t2 = [
    'Root (R0)',
    '  [PA]> Child A (CA)',
    '    [PB]> Grand B (CB)',
  ].join('\n');
  const r2 = SWTree.parseTree(t2);
  eq(r2.errors, [], '变体2 无错误');
  eq(r2.root.children[0].children[0].name, 'Grand B', '变体2 缩进父查找正确');

  // 变体3：空行 + 尾随空格 + 缺 itemSid
  const t3 = [
    'Root (R0)',
    '',
    '  ├─[PA]→ Child A   ',
    '',
    '    └─[PB]→ Leaf',
  ].join('\n');
  const r3 = SWTree.parseTree(t3);
  eq(r3.errors, [], '变体3 无错误');
  eq(r3.root.children[0].children[0].itemSid, null, '变体3 叶子缺 itemSid');
  eq(r3.root.children[0].name, 'Child A', '变体3 尾随空格被 trim');

  // 变体4：根被缩进（AI 偶尔如此），仍当根
  const t4 = '  [PA]→ Only (O1)';
  const r4 = SWTree.parseTree(t4);
  ok(r4.root !== null, '变体4 单行也返回根');
  eq(r4.root.name, 'Only', '变体4 根 name');
}
```

**Step 2: 运行测试**
Run: `node test/run.js`
Expected: 全部 PASS。若某变体 FAIL，回到 Task 3 的 `_contentStartCol` / `_parseNodeContent` 调整正则或字符集，**不要放宽不变量**。

**Step 3: Commit**
`git add test/run.js core.js && git commit -m "test: parseTree lenient variants"`

---

## Task 5：parseTree — 错误收集

**Files:** Modify: `core.js`, `test/run.js`

**Step 1: 写失败测试**

```js
// === Task 5: parseTree 错误收集 ===
{
  // 一行无法解析（纯符号无 name）
  const t = 'Root (R0)\n├─[PA]→ Child (CA)\n├─└─│─ (XX)';
  const { root, errors } = SWTree.parseTree(t);
  ok(root !== null, '错误测试：仍返回已解析部分');
  eq(root.children.length, 1, '错误测试：成功解析的子节点保留');
  ok(errors.length === 1, '错误测试：收集到 1 个错误');
  eq(errors[0].lineNo, 3, '错误测试：记录行号');
  ok(typeof errors[0].raw === 'string', '错误测试：保留原文');
}
```

注：`├─└─│─ (XX)` —— 内容部分 `(XX)` 不是 `[PART] Name` 形式。需确认 `_parseNodeContent` 对它返回 null。`(XX)` 单独无法匹配（regex 要求先有 Name 的 `.+?`）。检查正则：`^(?:\[...\])?(.+?)(?:\s*\(...\))?\s*$` 对 `(XX)`：可选 `[...]` 缺，然后 `(.+?)` 必须匹配至少 1 字符 —— `(` 不是 alnum 但 `.+?` 匹配任意字符，会匹配 `(XX)` 整体作为 name。这会**误判为成功**。

**Step 2: 运行测试，确认失败**
Run: `node test/run.js`
Expected: FAIL（errors.length 为 0）。

**Step 3: 修复 `_parseNodeContent` —— name 不能以括号开头/不能纯括号**

调整正则，让 name 必须包含至少一个非括号字符，且拒绝 name 纯为 `(xxx)`：

```js
_parseNodeContent(content) {
  const re = /^(?:\[([A-Za-z0-9]+)\]\s*(?:→|->|>)?\s*)?(.+?)(?:\s*\(([A-Za-z0-9]+)\))?\s*$/;
  const m = content.match(re);
  if (!m) return null;
  const name = (m[2] || '').trim();
  if (!name) return null;
  // 拒绝 name 整体是括号形式（如 "(XX)"），那是残缺行
  if (/^\([A-Za-z0-9]*\)$/.test(name)) return null;
  return { partSid: m[1] || null, name, itemSid: m[3] || null };
},
```

**Step 4: 运行测试，确认通过**
Run: `node test/run.js`
Expected: 全部 PASS。

**Step 5: Commit**
`git add core.js test/run.js && git commit -m "feat: parseTree error collection"`

---

## Task 6：serializeTree — 规范序列化 + 连接符规则

**Files:** Modify: `core.js`, `test/run.js`

**Step 1: 写失败测试（覆盖独子链 + 多兄弟分支）**

```js
// === Task 6: serializeTree ===
{
  // 场景1：独子链 → 全 └─
  const t1in = [
    'Mapping Tree (IMT01)',
    '├─[PPT01]→ Polarion Tree (IPT02)',
    '│   ├─[PSP06]→ Space (ISA03)',
  ].join('\n');
  const { root: r1 } = SWTree.parseTree(t1in);
  const out1 = SWTree.serializeTree(r1);
  eq(out1, [
    'Mapping Tree (IMT01)',
    '└─[PPT01]→ Polarion Tree (IPT02)',
    '    └─[PSP06]→ Space (ISA03)',
  ].join('\n'), 'serialize 独子链全 └─');

  // 场景2：多兄弟 → ├─ 与 └─ 混合 + │   延续
  const tree = SWTree.makeNode({ name: 'Root', itemSid: 'R0' });
  const a = SWTree.makeNode({ name: 'A', itemSid: 'IA', partSid: 'PA' });
  a.children.push(SWTree.makeNode({ name: 'A1', itemSid: 'IA1', partSid: 'PB' }));
  tree.children.push(a);
  tree.children.push(SWTree.makeNode({ name: 'B', itemSid: 'IB', partSid: 'PC' }));
  const out2 = SWTree.serializeTree(tree);
  eq(out2, [
    'Root (R0)',
    '├─[PA]→ A (IA)',
    '│   └─[PB]→ A1 (IA1)',
    '└─[PC]→ B (IB)',
  ].join('\n'), 'serialize 多兄弟混合连接符');

  // 场景3：根无 itemSid
  const tree3 = SWTree.makeNode({ name: 'BareRoot' });
  eq(SWTree.serializeTree(tree3), 'BareRoot', 'serialize 根无 itemSid');

  // 场景4：null root
  eq(SWTree.serializeTree(null), '', 'serialize null 返回空串');
}
```

**Step 2: 运行测试，确认失败**
Run: `node test/run.js`
Expected: FAIL（serializeTree 不存在）。

**Step 3: 实现 serializeTree**

```js
serializeTree(root) {
  if (!root) return '';
  const lines = [];
  const emit = (node, prefix, isLast) => {
    let line = prefix;
    if (node !== root) {
      line += isLast ? '└─' : '├─';
      line += '[' + (node.partSid != null ? node.partSid : '') + ']→ ';
    }
    line += node.name;
    if (node.itemSid) line += ' (' + node.itemSid + ')';
    lines.push(line);
    const childPrefix = prefix + (node === root ? '' : (isLast ? '    ' : '│   '));
    const kids = node.children;
    kids.forEach((c, i) => emit(c, childPrefix, i === kids.length - 1));
  };
  emit(root, '', true);
  return lines.join('\n');
},
```

**Step 4: 运行测试，确认通过**
Run: `node test/run.js`
Expected: 全部 PASS。

**Step 5: Commit**
`git add core.js test/run.js && git commit -m "feat: serializeTree with connector rules"`

---

## Task 7：路径辅助 + 兄弟移动

**Files:** Modify: `core.js`, `test/run.js`

**Step 1: 写失败测试**

```js
// === Task 7: 路径 + 兄弟移动 ===
{
  const { root } = SWTree.parseTree([
    'Root (R0)',
    '├─[PA]→ A (IA)',
    '├─[PB]→ B (IB)',
    '└─[PC]→ C (IC)',
  ].join('\n'));
  eq(SWTree.getNodeByPath(root, [1]).name, 'B', 'getNodeByPath');
  eq(SWTree.getParentByPath(root, [1]).name, 'Root', 'getParentByPath');

  // moveSibling up: B 上移到 A 前
  ok(SWTree.moveSibling(root, [1], -1), 'moveSibling up 成功');
  eq(root.children.map(c => c.name).join(','), 'B,A,C', '上移后顺序');

  // moveSibling up 越界：B 已是首个
  ok(!SWTree.moveSibling(root, [0], -1), '首个上移返回 false');
  // moveSibling down 越界
  ok(!SWTree.moveSibling(root, [2], 1), '末个下移返回 false');

  // 根不可移动
  ok(!SWTree.moveSibling(root, [], -1), '根不可移动');
}
```

**Step 2: 运行测试，确认失败**
Run: `node test/run.js`
Expected: FAIL。

**Step 3: 实现路径辅助 + moveSibling**

```js
getNodeByPath(root, path) {
  let node = root;
  for (const idx of path) {
    if (!node.children || idx < 0 || idx >= node.children.length) return null;
    node = node.children[idx];
  }
  return node;
},

getParentByPath(root, path) {
  if (path.length === 0) return null;
  return SWTree.getNodeByPath(root, path.slice(0, -1));
},

moveSibling(root, path, dir) {
  if (path.length === 0) return false;
  const parent = SWTree.getParentByPath(root, path);
  const idx = path[path.length - 1];
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= parent.children.length) return false;
  const [node] = parent.children.splice(idx, 1);
  parent.children.splice(newIdx, 0, node);
  return true;
},
```

**Step 4: 运行测试，确认通过**
Run: `node test/run.js`
Expected: 全部 PASS。

**Step 5: Commit**
`git add core.js test/run.js && git commit -m "feat: path helpers and moveSibling"`

---

## Task 8：缩进 / 提升缩进（reparent）

**Files:** Modify: `core.js`, `test/run.js`

**Step 1: 写失败测试**

```js
// === Task 8: indent / outdent ===
{
  const { root } = SWTree.parseTree([
    'Root (R0)',
    '├─[PA]→ A (IA)',
    '└─[PB]→ B (IB)',
  ].join('\n'));

  // indent B → 变成 A 的子节点
  ok(SWTree.indent(root, [1]), 'indent 成功');
  eq(root.children.length, 1, 'indent 后根只剩 1 子');
  eq(root.children[0].name, 'A', 'indent 后 A 是唯一顶层子');
  eq(root.children[0].children[0].name, 'B', 'B 变成 A 的子');
  eq(root.children[0].children[0].partSid, 'PB', 'B 的 partSid 保留');

  // indent A（无前一兄弟）→ false
  ok(!SWTree.indent(root, [0]), '无前一兄弟 indent 返回 false');

  // outdent B → 变回根的子
  ok(SWTree.outdent(root, [0, 0]), 'outdent 成功');
  eq(root.children.length, 2, 'outdent 后根有 2 子');
  eq(root.children[1].name, 'B', 'B 提升为顶层');

  // 顶层节点 outdent → false
  ok(!SWTree.outdent(root, [0]), '顶层 outdent 返回 false');
  // 根 → false
  ok(!SWTree.outdent(root, []), '根 outdent 返回 false');
}
```

**Step 2: 运行测试，确认失败**
Run: `node test/run.js`
Expected: FAIL。

**Step 3: 实现 indent / outdent**

```js
indent(root, path) {
  // 变成前一兄弟的子节点
  if (path.length === 0) return false;
  const parent = SWTree.getParentByPath(root, path);
  const idx = path[path.length - 1];
  if (idx === 0) return false; // 无前一兄弟
  const [node] = parent.children.splice(idx, 1);
  parent.children[idx - 1].children.push(node);
  return true;
},

outdent(root, path) {
  // 变成父节点的兄弟（提升一级）
  if (path.length <= 1) return false; // 根或顶层不可提升
  const grandparent = SWTree.getNodeByPath(root, path.slice(0, -2));
  const parentIdx = path[path.length - 2];
  const parent = grandparent.children[parentIdx];
  const idx = path[path.length - 1];
  const [node] = parent.children.splice(idx, 1);
  grandparent.children.splice(parentIdx + 1, 0, node);
  return true;
},
```

**Step 4: 运行测试，确认通过**
Run: `node test/run.js`
Expected: 全部 PASS。

**Step 5: Commit**
`git add core.js test/run.js && git commit -m "feat: indent/outdent reparent ops"`

---

## Task 9：添加子节点 / 删除节点

**Files:** Modify: `core.js`, `test/run.js`

**Step 1: 写失败测试**

```js
// === Task 9: addChild / removeNode ===
{
  const { root } = SWTree.parseTree([
    'Root (R0)',
    '└─[PA]→ A (IA)',
  ].join('\n'));

  // addChild 到根
  ok(SWTree.addChild(root, []), 'addChild 到根成功');
  eq(root.children.length, 2, '根新增 1 子');
  eq(root.children[1].name, 'New', '新子默认 name=New');
  eq(root.children[1].partSid, '', '新子 partSid 默认空串（待填，校验会警告）');

  // addChild 到叶子
  ok(SWTree.addChild(root, [0]), 'addChild 到 A 成功');
  eq(root.children[0].children[0].name, 'New', 'A 新增子');

  // removeNode 非根
  const before = root.children.length;
  const res = SWTree.removeNode(root, [0, 0]);
  eq(res.cleared, false, 'removeNode 非根 cleared=false');
  eq(root.children[0].children.length, 0, 'A 的子被删');

  // removeNode 根 → cleared
  eq(SWTree.removeNode(root, []).cleared, true, 'removeNode 根 cleared=true');
}
```

**Step 2: 运行测试，确认失败**
Run: `node test/run.js`
Expected: FAIL。

**Step 3: 实现 addChild / removeNode**

```js
addChild(root, path) {
  const node = SWTree.getNodeByPath(root, path);
  if (!node) return false;
  node.children.push(SWTree.makeNode({ name: 'New', partSid: '' }));
  return true;
},

removeNode(root, path) {
  if (path.length === 0) return { cleared: true };
  const parent = SWTree.getParentByPath(root, path);
  const idx = path[path.length - 1];
  parent.children.splice(idx, 1);
  return { cleared: false };
},
```

**Step 4: 运行测试，确认通过**
Run: `node test/run.js`
Expected: 全部 PASS。

**Step 5: Commit**
`git add core.js test/run.js && git commit -m "feat: addChild/removeNode ops"`

---

## Task 10：字段更新

**Files:** Modify: `core.js`, `test/run.js`

**Step 1: 写失败测试**

```js
// === Task 10: updateField ===
{
  const { root } = SWTree.parseTree([
    'Root (R0)',
    '└─[PA]→ A (IA)',
  ].join('\n'));

  ok(SWTree.updateField(root, [0], 'partSid', 'PANEW'), '改 partSid');
  eq(root.children[0].partSid, 'PANEW', 'partSid 已更新');

  ok(SWTree.updateField(root, [0], 'name', 'Alpha'), '改 name');
  eq(root.children[0].name, 'Alpha', 'name 已更新');

  ok(SWTree.updateField(root, [0], 'itemSid', null), '清空 itemSid');
  eq(root.children[0].itemSid, null, 'itemSid 已清空');

  // 根不能改 partSid
  ok(!SWTree.updateField(root, [], 'partSid', 'X'), '根改 partSid 返回 false');
  // 根可改 name/itemSid
  ok(SWTree.updateField(root, [], 'name', 'NewRoot'), '根改 name');
  eq(root.name, 'NewRoot', '根 name 已更新');
}
```

**Step 2: 运行测试，确认失败**
Run: `node test/run.js`
Expected: FAIL。

**Step 3: 实现 updateField**

```js
updateField(root, path, field, value) {
  const node = SWTree.getNodeByPath(root, path);
  if (!node) return false;
  if (field === 'partSid' && path.length === 0) return false; // 根无入边
  node[field] = value;
  return true;
},
```

**Step 4: 运行测试，确认通过**
Run: `node test/run.js`
Expected: 全部 PASS。

**Step 5: Commit**
`git add core.js test/run.js && git commit -m "feat: updateField op"`

---

## Task 11：校验 validateTree

**Files:** Modify: `core.js`, `test/run.js`

**Step 1: 写失败测试**

```js
// === Task 11: validateTree ===
{
  // 非根缺 partSid → 警告；重复 itemSid 不报（合法：共享实例）
  const root = SWTree.makeNode({ name: 'Root', itemSid: 'R0' });
  const c = SWTree.makeNode({ name: 'Bad', itemSid: 'ISA03', partSid: '' }); // 缺 partSid → 警告
  root.children.push(c); // c 的 path = [0]
  const dup = SWTree.makeNode({ name: 'Space2', itemSid: 'ISA03', partSid: 'PX' }); // 重复 itemSid，合法不报
  root.children.push(dup); // dup 的 path = [1]
  const w = SWTree.validateTree(root);
  eq(w.length, 1, '仅 1 条警告（缺 partSid）；重复 itemSid 不报');
  eq(w[0].type, 'missing-partSid', '警告类型');
  eq(w[0].path, [0], '警告路径指向 c');
}
```

> 路径语义：`path` 是从根的 children 起算的索引数组（根本身是 `[]`）。`c` 是 `root.children[0]` → path `[0]`。

**Step 2: 运行测试，确认失败**
Run: `node test/run.js`
Expected: FAIL（`validateTree is not a function`）。

**Step 3: 实现 validateTree**

```js
validateTree(root) {
  const warnings = [];
  const walk = (node, path) => {
    if (path.length > 0 && (node.partSid == null || node.partSid === '')) {
      warnings.push({ type: 'missing-partSid', path: path.slice(), message: '非根节点缺少 PartType SID' });
    }
    node.children.forEach((c, i) => walk(c, path.concat([i])));
  };
  if (root) walk(root, []);
  return warnings;
},
```

**Step 4: 运行测试，确认通过**
Run: `node test/run.js`
Expected: 全部 PASS。

**Step 5: Commit**
`git add core.js test/run.js && git commit -m "feat: validateTree warnings"`

---

## Task 12：localStorage 持久化（浏览器专用，Node 跳过）

**Files:** Modify: `core.js`, `test/run.js`

**说明：** localStorage 仅浏览器有。Node 测试里用 stub 验证逻辑；或仅做存在性检查。

**Step 1: 写测试（Node 下用全局 stub）**

```js
// === Task 12: localStorage 持久化（Node stub）===
{
  // 模拟 localStorage
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };

  const root = SWTree.makeNode({ name: 'Root', itemSid: 'R0' });
  SWTree.saveTree(root);
  const loaded = SWTree.loadTree();
  eq(loaded.name, 'Root', 'saveTree/loadTree 往返 name');
  eq(loaded.itemSid, 'R0', 'loadTree itemSid');
  eq(loaded.children, [], 'loadTree children');

  SWTree.clearTree();
  eq(SWTree.loadTree(), null, 'clearTree 后 loadTree 返回 null');

  delete globalThis.localStorage;
}
```

**Step 2: 运行测试，确认失败**
Run: `node test/run.js`
Expected: FAIL。

**Step 3: 实现 saveTree / loadTree / clearTree**

```js
const _STORAGE_KEY = 'sw-tree-editor:v1';

saveTree(root) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(_STORAGE_KEY, JSON.stringify(root));
  } catch (e) { /* 忽略配额/隐私模式错误 */ }
},

loadTree() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
},

clearTree() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(_STORAGE_KEY);
  } catch (e) {}
},
```

**Step 4: 运行测试，确认通过**
Run: `node test/run.js`
Expected: 全部 PASS。

**Step 5: Commit**
`git add core.js test/run.js && git commit -m "feat: localStorage persistence"`

---

## 阶段检查点：纯逻辑完成

运行 `node test/run.js`，确认所有纯逻辑测试全绿（约 30+ 用例）。此后任务为 UI，无自动化测试，逐个在浏览器打开 `index.html` 人工核对。

---

## Task 13：UI — 渲染树编辑器

**Files:** Modify: `index.html`（`<script>` 块）

**Step 1: 实现 state + render**

在 `index.html` 的 `<script>` 块内（`<script src="core.js"></script>` 之后）添加：

```js
const T = window.SWTree;
let state = { root: null }; // 当前树

const editorEl = document.getElementById('tree-root');
const outputEl = document.getElementById('output-text');

function render() {
  editorEl.innerHTML = '';
  if (!state.root) {
    editorEl.innerHTML = '<p class="empty">（空）点击「导入」或手动添加根节点</p>';
    outputEl.value = '';
    return;
  }
  renderNode(state.root, [], editorEl);
  outputEl.value = T.serializeTree(state.root);
}

function renderNode(node, path, parentEl) {
  const row = document.createElement('div');
  row.className = 'tree-row';
  row.style.marginLeft = (path.length * 20) + 'px';

  // 字段区
  const fields = document.createElement('span');
  fields.className = 'fields';
  if (path.length > 0) {
    fields.appendChild(makeField(node, path, 'partSid', '[' + (node.partSid || '') + ']', 'partSid'));
    fields.appendChild(document.createTextNode('→ '));
  }
  fields.appendChild(makeField(node, path, 'name', node.name || '', 'name'));
  if (node.itemSid) {
    fields.appendChild(makeField(node, path, 'itemSid', '(' + node.itemSid + ')', 'itemSid'));
  }
  row.appendChild(fields);

  // 按钮区
  const btns = document.createElement('span');
  btns.className = 'btns';
  btns.appendChild(btn('↑', () => op(() => T.moveSibling(state.root, path, -1))));
  btns.appendChild(btn('↓', () => op(() => T.moveSibling(state.root, path, 1))));
  btns.appendChild(btn('→', () => op(() => T.indent(state.root, path))));
  btns.appendChild(btn('←', () => op(() => T.outdent(state.root, path))));
  btns.appendChild(btn('＋', () => op(() => T.addChild(state.root, path))));
  btns.appendChild(btn('×', () => delNode(path)));
  row.appendChild(btns);

  parentEl.appendChild(row);
  node.children.forEach((c, i) => renderNode(c, path.concat([i]), parentEl));
}

function btn(label, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = 'op-btn';
  b.addEventListener('click', onClick);
  return b;
}

function makeField(node, path, field, displayText, cls) {
  const span = document.createElement('span');
  span.className = 'field ' + cls;
  span.textContent = displayText;
  span.title = '点击编辑';
  span.addEventListener('click', () => editField(path, field, span));
  return span;
}

// 统一操作包装：执行 → 持久化 → 重渲染
function op(fn) {
  fn();
  persistAndRender();
}
function persistAndRender() {
  if (state.root) T.saveTree(state.root);
  render();
}
```

**Step 2: 验证**
打开 `index.html`。控制台执行临时测试：
```js
state.root = SWTree.parseTree('Root (R0)\n└─[PA]→ A (IA)').root; render();
```
Expected: 编辑区显示两行带按钮的节点；输出区显示规范文本。

**Step 3: Commit**
`git add index.html && git commit -m "feat: UI render tree editor"`

---

## Task 14：UI — 字段编辑 / 删除处理

**Files:** Modify: `index.html`

**Step 1: 实现 editField + delNode**

```js
function editField(path, field, span) {
  const node = T.getNodeByPath(state.root, path);
  if (!node) return;
  if (field === 'partSid' && path.length === 0) return; // 根无 partSid
  const current = node[field] || '';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'field-input';
  span.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    let val = input.value.trim();
    if (field === 'itemSid' && val === '') val = null;
    T.updateField(state.root, path, field, val);
    persistAndRender();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { persistAndRender(); }
  });
}

function delNode(path) {
  if (path.length === 0) {
    if (!confirm('删除根节点将清空整棵树，确定？')) return;
    state.root = null;
    T.clearTree();
    render();
    return;
  }
  T.removeNode(state.root, path);
  persistAndRender();
}
```

**Step 2: 验证**
打开 `index.html`，用控制台建树后：点击 partSid/name/itemSid → 弹 input → 改值回车 → 更新且输出同步；点 × 删节点；点根的 × 弹确认。

**Step 3: Commit**
`git add index.html && git commit -m "feat: UI field editing and delete"`

---

## Task 15：UI — 导入 / 清空

**Files:** Modify: `index.html`

**Step 1: 绑定导入/清空按钮**

```js
document.getElementById('btn-import').addEventListener('click', () => {
  const text = document.getElementById('import-text').value;
  if (!text.trim()) { alert('请先粘贴文本'); return; }
  if (state.root && !confirm('导入将覆盖当前树，确定？')) return;
  const { root, errors } = T.parseTree(text);
  state.root = root;
  persistAndRender();
  if (errors.length > 0) {
    alert('解析完成，但有 ' + errors.length + ' 行无法识别（已在控制台列出）');
    console.warn('parse errors:', errors);
  }
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (!confirm('清空当前树？')) return;
  state.root = null;
  T.clearTree();
  document.getElementById('import-text').value = '';
  render();
});
```

**Step 2: 验证**
打开 `index.html`，粘贴设计文档示例到导入框 → 点导入 → 编辑区还原为树 → 输出区显示规范文本。刷新页面 → 树仍在（localStorage）。

**Step 3: Commit**
`git add index.html && git commit -m "feat: UI import and clear"`

---

## Task 16：UI — 复制 / 下载

**Files:** Modify: `index.html`

**Step 1: 实现复制 + 下载**

```js
document.getElementById('btn-copy').addEventListener('click', async () => {
  const text = outputEl.value;
  if (!text) { alert('输出为空'); return; }
  try {
    await navigator.clipboard.writeText(text);
    flashBtn('btn-copy', '已复制');
  } catch (e) {
    // 降级：选中文本框
    outputEl.select();
    document.execCommand('copy');
    flashBtn('btn-copy', '已复制（降级）');
  }
});

document.getElementById('btn-download').addEventListener('click', () => {
  const text = outputEl.value;
  if (!text) { alert('输出为空'); return; }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'meta-model-tree.txt';
  a.click();
  URL.revokeObjectURL(a.href);
});

function flashBtn(id, msg) {
  const b = document.getElementById(id);
  const old = b.textContent;
  b.textContent = msg;
  setTimeout(() => { b.textContent = old; }, 1200);
}
```

**Step 2: 验证**
打开 `index.html`（建议用本地服务器 `python -m http.server` 或直接 file://，注意 file:// 下 Clipboard API 可能受限，降级路径会生效）。点复制 → 粘贴到别处确认内容；点下载 → 得到 .txt 文件。

**Step 3: Commit**
`git add index.html && git commit -m "feat: UI copy and download"`

---

## Task 17：UI — 校验展示 + 启动加载

**Files:** Modify: `index.html`

**Step 1: 渲染警告 + 启动时恢复**

在 `render()` 内、序列化输出之后追加校验展示：

```js
// 修改 render()：在末尾加
const warnings = T.validateTree(state.root);
const warnEl = document.getElementById('warnings') || (() => {
  const e = document.createElement('div'); e.id = 'warnings'; e.className = 'warnings';
  editorEl.parentNode.insertBefore(e, editorEl.nextSibling); return e;
})();
warnEl.innerHTML = warnings.map(w =>
  `<div class="warn">⚠ 路径 [${w.path.join(',')}] ${w.message}</div>`
).join('');
```

启动加载（在 `<script>` 块末尾）：

```js
// 启动：恢复 localStorage
(function init() {
  const saved = T.loadTree();
  if (saved) state.root = saved;
  render();
})();
```

**Step 2: 验证**
打开 `index.html`，建一棵含缺 partSid 节点的树 → 编辑区下方出现黄色 ⚠ 提示。刷新页面 → 树和警告都恢复。

**Step 3: Commit**
`git add index.html && git commit -m "feat: UI validation display and init restore"`

---

## Task 18：CSS 样式

**Files:** Modify: `index.html`（`<style>` 块）

**Step 1: 写样式（三区布局 + 节点行 + 警告 + 按钮态）**

```css
* { box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; padding: 20px; max-width: 1000px; color: #222; }
h1 { font-size: 1.3rem; margin: 0 0 16px; }
section { background: #f7f7f8; border: 1px solid #e2e2e6; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
h2 { font-size: 0.95rem; margin: 0 0 8px; color: #555; }
textarea { width: 100%; font-family: "Consolas", "Cascadia Code", monospace; font-size: 13px; padding: 8px; border: 1px solid #d0d0d6; border-radius: 4px; resize: vertical; }
button { cursor: pointer; padding: 5px 10px; border: 1px solid #c8c8d0; background: #fff; border-radius: 4px; font-size: 13px; }
button:hover { background: #eef; }
#btn-import { background: #2563eb; color: #fff; border-color: #2563eb; }
#tree-root { background: #fff; border: 1px solid #e2e2e6; border-radius: 4px; padding: 8px; min-height: 60px; }
.tree-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-family: "Consolas", "Cascadia Code", monospace; font-size: 13px; }
.tree-row .fields { flex: 1; }
.tree-row .field { cursor: text; padding: 1px 3px; border-radius: 3px; }
.tree-row .field:hover { background: #fff3bf; }
.tree-row .field.partSid { color: #2563eb; }
.tree-row .field.itemSid { color: #888; }
.tree-row .btns { opacity: 0.4; }
.tree-row:hover .btns { opacity: 1; }
.op-btn { padding: 1px 6px; font-size: 12px; line-height: 1.4; }
.field-input { font-family: inherit; font-size: 13px; padding: 1px 3px; border: 1px solid #2563eb; border-radius: 3px; }
.empty { color: #999; font-style: italic; padding: 10px; }
.warnings { margin-top: 8px; }
.warn { color: #b8860b; background: #fff8e1; border-left: 3px solid #f5c518; padding: 4px 8px; font-size: 13px; margin-bottom: 3px; border-radius: 2px; }
```

**Step 2: 验证**
打开 `index.html`，整体观感整洁；节点行按钮 hover 才显示；警告黄色；导入按钮蓝色。

**Step 3: Commit**
`git add index.html && git commit -m "style: three-region layout and node styling"`

---

## Task 19：交付物 — 内联 core.js 到 dist/index.html（单文件）

**Files:** Create: `dist/index.html`

**Step 1: 生成单文件**

读 `index.html`，把 `<script src="core.js"></script>` 替换为内联 `<script>`（内容来自 `core.js`），写到 `dist/index.html`。可手动或用脚本：

PowerShell 脚本（在工作目录执行）：
```powershell
$core = Get-Content -Raw core.js
$html = Get-Content -Raw index.html
$inlined = $html -replace '<script src="core\.js"></script>', "<script>`n$core`n</script>"
New-Item -ItemType Directory -Force -Path dist | Out-Null
Set-Content -Path dist\index.html -Value $inlined -NoNewline
```

**Step 2: 验证单文件零依赖**
- 检查 `dist/index.html` 不含任何 `src=` 或 `href=` 外部引用（`grep "src=\|href=" dist/index.html` 应只可能有 meta/href 无关项，无网络引用）。
- 断网双击 `dist/index.html` → 功能完整：导入示例 → 编辑 → 复制 → 下载 → 刷新恢复。
- 运行纯逻辑测试确保未回归：`node test/run.js` 全绿。

**Step 3: Commit**
`git add dist/index.html && git commit -m "build: inline core.js into standalone dist/index.html"`

---

## 验收清单（对照设计文档 §11）

执行完所有任务后逐项确认：
1. ✅ 粘贴示例文本正确还原为可编辑树（Task 3 + 15）
2. ✅ 粘贴带变体（`+--`、2 空格、`->`、空行）也能还原（Task 4 + 15）
3. ✅ 所有按钮（移动/缩进/增/删/编辑）正确且不破坏不变量（Task 7-10, 13-14）
4. ✅ 刷新页面后树仍在（Task 12 + 17）
5. ✅ 复制/下载输出严格符合 §6 规范（Task 6 + 16）
6. ✅ 非根缺 partSid 黄色提示；解析失败行红色提示（Task 5 + 11 + 17）
7. ✅ `dist/index.html` 单文件、断网可用、零外部依赖（Task 19）

全部通过即交付完成。
