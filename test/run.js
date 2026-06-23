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

// 后续任务的测试追加到这里

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
