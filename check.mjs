import { TOOLS, CATEGORIES } from './assets/js/registry.js';

const cats = CATEGORIES.map((c) => c.id);
let missing = [];
let extra = [];
for (const cat of cats) {
  const mod = await import(`./assets/js/tools/${cat}.js`);
  const impl = mod.default || {};
  for (const t of TOOLS.filter((x) => x.cat === cat)) {
    if (typeof impl[t.id] !== 'function') missing.push(`${cat}/${t.id}`);
  }
  for (const k of Object.keys(impl)) {
    if (!TOOLS.some((t) => t.id === k && t.cat === cat)) extra.push(`${cat}/${k}`);
  }
}
console.log(`分类: ${cats.length} · 工具: ${TOOLS.length}`);
if (extra.length) console.log('未注册实现:', extra.join(', '));
if (missing.length) {
  console.log('缺失实现:', missing.join(', '));
  process.exit(1);
}
console.log('全部工具实现齐全 ✓');
