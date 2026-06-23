// core.js — 纯逻辑，无 DOM 依赖。双环境导出。
const _TREE_CHARS = new Set([' ', '\t', '│', '|', '├', '└', '┌', '┐', '┘', '─', '-', '+', '\\', '/']);
const _STORAGE_KEY = 'sw-tree-editor:v1';

const SWTree = {
  version: '1.0.0',

  makeNode(opts) {
    return {
      name: opts.name || '',
      itemSid: opts.itemSid != null ? opts.itemSid : null,
      partSid: opts.partSid != null ? opts.partSid : null,
      children: Array.isArray(opts.children) ? opts.children : [],
    };
  },

  // 解析辅助：树前缀字符集（空格/Tab/box-drawing/ASCII art）
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
    // 拒绝 name 整体是括号形式（如 "(XX)"），那是残缺行
    if (/^\([A-Za-z0-9]*\)$/.test(name)) return null;
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

  updateField(root, path, field, value) {
    const node = SWTree.getNodeByPath(root, path);
    if (!node) return false;
    if (field === 'partSid' && path.length === 0) return false; // 根无入边
    node[field] = value;
    return true;
  },

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
};

if (typeof module !== 'undefined' && module.exports) module.exports = SWTree;
if (typeof window !== 'undefined') window.SWTree = SWTree;
