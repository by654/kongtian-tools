import { TOOLS, CATEGORIES } from './assets/js/registry.js';
import { MERGED, ALIAS } from './assets/js/core/merge-map.js';

const cats = CATEGORIES.map((c) => c.id);
const aliasIds = new Set(Object.keys(ALIAS));
const modCache = {};
async function getMod(cat) {
  if (!(cat in modCache)) {
    try { modCache[cat] = (await import(`./assets/js/tools/${cat}.js`)).default || {}; }
    catch (e) { modCache[cat] = null; console.log(`模块加载失败：${cat} -> ${e.message}`); }
  }
  return modCache[cat];
}

let missing = [];
let extra = [];

for (const cat of cats) {
  const impl = await getMod(cat);
  if (!impl) continue;
  for (const t of TOOLS.filter((x) => x.cat === cat)) {
    if (typeof impl[t.id] !== 'function') missing.push(`${cat}/${t.id}`);
  }
  for (const k of Object.keys(impl)) {
    if (TOOLS.some((t) => t.id === k && t.cat === cat)) continue;
    if (aliasIds.has(k)) continue;
    extra.push(`${cat}/${k}`);
  }
}

/* 合并标签页：每个标签的实现在其所属分类模块里必须存在 */
let badTabs = [];
for (const [target, spec] of Object.entries(MERGED)) {
  if (!TOOLS.some((t) => t.id === target)) missing.push(`合并主工具未注册：${target}`);
  for (const s of spec.sections) {
    const impl = await getMod(s.cat);
    if (!impl || typeof impl[s.id] !== 'function') badTabs.push(`${target} > ${s.label}(${s.cat}/${s.id})`);
  }
}

console.log(`分类: ${cats.length} · 工具: ${TOOLS.length} · 被合并工具: ${aliasIds.size} · 合并主工具: ${Object.keys(MERGED).length}`);
if (extra.length) console.log('未注册实现:', extra.join(', '));
if (badTabs.length) console.log('标签页实现缺失:', badTabs.join(', '));
if (missing.length) {
  console.log('缺失实现:', missing.join(', '));
  process.exit(1);
}
if (badTabs.length) process.exit(1);
console.log('全部工具实现齐全 ✓');
