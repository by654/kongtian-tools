/* 商业、财务、组织与项目 */
import { esc, copy, toast, download } from '../core/ui.js';
import { calcWorkbench, templateWorkbench, checklistWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);

const IIT = [
  [3000, 0.03, 0], [12000, 0.1, 210], [25000, 0.2, 1410], [35000, 0.25, 2660],
  [55000, 0.3, 4410], [80000, 0.35, 7160], [Infinity, 0.45, 15160]
];
function iit(taxable) {
  if (taxable <= 0) return 0;
  const row = IIT.find(([cap]) => taxable <= cap);
  return taxable * row[1] - row[2];
}
function npv(rate, flows) {
  return flows.reduce((s, cf, i) => s + cf / (1 + rate) ** i, 0);
}
function irr(flows) {
  let lo = -0.9, hi = 5;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid, flows) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export default {
  /* ================= 财税计算 ================= */
  'finance-pro'(root) {
    calcWorkbench(root, {
      title: '财税与财务计算',
      note: '个税与增值税按中国大陆常见规则简化计算，实际以最新法规与主管税务机关口径为准。',
      groups: [
        { name: '工资个税', fields: [['income', '税前月收入', 20000], ['social', '五险一金', 3000], ['deduct', '专项附加扣除', 2000]], run: (v) => {
          const taxable = Math.max(0, v.income - 5000 - v.social - v.deduct);
          const tax = iit(taxable);
          return `应纳税所得额：${taxable.toFixed(2)} 元\n个人所得税：${tax.toFixed(2)} 元\n税后收入：${(v.income - v.social - tax).toFixed(2)} 元`;
        } },
        { name: '年终奖计税', fields: [['bonus', '年终奖', 50000], ['salaryTaxable', '全年工资应纳税所得额', 60000]], run: (v) => {
          const monthly = v.bonus / 12;
          const row = IIT.find(([cap]) => monthly <= cap);
          const tax = v.bonus * row[1] - row[2];
          return `按月换算：${monthly.toFixed(2)} 元\n适用税率：${(row[1] * 100).toFixed(0)}% · 速算扣除 ${row[2]}\n年终奖税额：${tax.toFixed(2)} 元\n税后：${(v.bonus - tax).toFixed(2)} 元`;
        } },
        { name: '增值税', fields: [['amount', '金额', 10600], ['rate', '税率 %', 6], ['incl', '含税价', 'yes', 'select', [['yes', '是'], ['no', '否']]]], run: (v) => {
          const rate = v.rate / 100;
          const net = v.incl === 'yes' ? v.amount / (1 + rate) : v.amount;
          return `不含税金额：${net.toFixed(2)}\n税额：${(net * rate).toFixed(2)}\n含税金额：${(net * (1 + rate)).toFixed(2)}`;
        } },
        { name: '折旧', fields: [['cost', '原值', 100000], ['salvage', '残值', 5000], ['years', '年限', 5], ['method', '方法', 'straight', 'select', [['straight', '直线法'], ['double', '双倍余额递减']]]], run: (v) => {
          if (v.method === 'straight') return `年折旧额：${((v.cost - v.salvage) / v.years).toFixed(2)}\n月折旧额：${((v.cost - v.salvage) / v.years / 12).toFixed(2)}`;
          let book = v.cost; const rows = [];
          for (let i = 1; i <= v.years; i++) { const dep = book * 2 / v.years; rows.push(`第 ${i} 年：${dep.toFixed(2)}，账面 ${(book - dep).toFixed(2)}`); book -= dep; }
          return rows.join('\n');
        } },
        { name: 'NPV / IRR', fields: [['rate', '折现率 %', 8], ['flows', '现金流（每行一期，含第 0 期）', '-100000\n30000\n35000\n40000\n45000', 'textarea']], run: (v) => {
          const flows = v.flows.split(/\r?\n/).map(Number).filter((x) => !isNaN(x));
          return `NPV = ${npv(v.rate / 100, flows).toFixed(2)}\nIRR = ${(irr(flows) * 100).toFixed(2)}%\n回收期：${(() => { let s = 0; for (let i = 0; i < flows.length; i++) { s += flows[i]; if (s >= 0) return i + ' 期'; } return '未回收'; })()}`;
        } },
        { name: '盈亏平衡', fields: [['fixed', '固定成本', 50000], ['price', '单价', 100], ['var', '单位变动成本', 60]], run: (v) => {
          const cm = v.price - v.var;
          return `单位边际贡献：${cm.toFixed(2)}\n盈亏平衡销量：${cm > 0 ? Math.ceil(v.fixed / cm) : '∞'}\n盈亏平衡销售额：${cm > 0 ? (v.fixed / cm * v.price).toFixed(2) : '∞'}`;
        } },
        { name: '货币格式', fields: [['amount', '金额', 1234567.89], ['cur', '货币', 'CNY', 'select', [['CNY', '人民币'], ['USD', '美元'], ['EUR', '欧元'], ['JPY', '日元']]], ['locale', '地区', 'zh-CN', 'select', [['zh-CN', '中国'], ['en-US', '美国'], ['de-DE', '德国'], ['ja-JP', '日本']]]], run: (v) => new Intl.NumberFormat(v.locale, { style: 'currency', currency: v.cur }).format(v.amount) }
      ]
    });
  },

  /* ================= HR 与招聘 ================= */
  'hr-tools'(root) {
    templateWorkbench(root, {
      title: 'HR 与招聘模板',
      templates: [
        { id: 'jd', name: '招聘 JD', build: (v) => `# ${v.title} · 招聘 JD\n\n- 部门：\n- 地点：\n- 汇报对象：${v.owner || '—'}\n\n## 岗位职责\n${v.notes.split('\n').filter(Boolean).map((x) => '- ' + x).join('\n')}\n\n## 任职要求\n- 3 年以上相关经验\n- 良好的沟通与协作能力\n- 加分项：\n\n## 我们提供\n- 有竞争力的薪资\n- 弹性工作与成长空间` },
        { id: 'interview', name: '面试问题清单', build: (v) => `# ${v.title} · 面试问题\n\n## 背景与动机\n1. 请介绍最近一段相关经历。\n2. 为什么想加入我们？\n\n## 专业能力\n${v.notes.split('\n').filter(Boolean).map((x, i) => `${i + 3}. ${x}`).join('\n')}\n\n## 行为面试（STAR）\n- 请讲一个你推动跨团队协作的案例。\n- 请讲一次失败经历，你如何复盘？\n\n## 反问环节\n- 团队目前最大的挑战是什么？` },
        { id: 'scorecard', name: '面试评分表', build: (v) => `# ${v.title} · 面试评分表\n\n候选人：__________　面试官：${v.owner || '__________'}　日期：${v.date}\n\n| 维度 | 权重 | 得分（1–5） | 备注 |\n| --- | --- | --- | --- |\n| 专业能力 | 30% |  |  |\n| 问题解决 | 25% |  |  |\n| 沟通协作 | 20% |  |  |\n| 成长潜力 | 15% |  |  |\n| 文化匹配 | 10% |  |  |\n\n## 综合评价\n\n\n## 结论\n- [ ] 强烈推荐\n- [ ] 推荐\n- [ ] 待定\n- [ ] 不推荐` },
        { id: 'onboarding', name: '入职清单', build: (v) => `# ${v.title} · 入职清单\n\n- 负责人：${v.owner}\n- 入职日期：${v.date}\n\n## 入职前\n- [ ] 发送 Offer 与入职指引\n- [ ] 收集身份证明、学历、银行卡信息\n- [ ] 准备工位、电脑与账号\n- [ ] 通知团队\n\n## 第一天\n- [ ] 办理入职手续\n- [ ] 介绍团队与办公环境\n- [ ] 开通系统权限\n- [ ] 安排导师与首周计划\n\n## 第一周\n- [ ] 完成合规与安全培训\n- [ ] 明确 30/60/90 天目标\n- [ ] 一次 1:1 反馈` },
        { id: 'offboarding', name: '离职交接清单', build: (v) => `# ${v.title} · 离职交接清单\n\n- 离职人：\n- 交接人：${v.owner}\n- 最后工作日：${v.date}\n\n## 工作交接\n${v.notes.split('\n').filter(Boolean).map((x) => `- [ ] ${x}`).join('\n')}\n\n## 资产与权限\n- [ ] 电脑、手机、门禁卡归还\n- [ ] 邮箱、代码库、云账号权限回收\n- [ ] 客户与供应商关系转移\n\n## 结算\n- [ ] 工资、年假、报销结清\n- [ ] 保密与竞业提醒` },
        { id: 'offer', name: 'Offer 对比表', build: (v) => `# ${v.title} · Offer 对比\n\n| 项目 | Offer A | Offer B |\n| --- | --- | --- |\n| 公司 |  |  |\n| 职位 |  |  |\n| 月薪 |  |  |\n| 年终奖 |  |  |\n| 股票/期权 |  |  |\n| 社保公积金 |  |  |\n| 通勤 |  |  |\n| 成长空间 |  |  |\n\n## 备注\n${v.notes}` },
        { id: 'performance', name: '绩效评估模板', build: (v) => `# ${v.title} · 绩效评估\n\n员工：__________　评估人：${v.owner}　周期：${v.date}\n\n## 目标回顾\n${v.notes.split('\n').filter(Boolean).map((x) => '- ' + x).join('\n')}\n\n## 亮点\n- \n\n## 待改进\n- \n\n## 下一周期目标\n- \n\n## 员工反馈\n\n\n## 签名\n员工：__________　主管：__________` },
        { id: 'org', name: '组织架构说明', build: (v) => `# ${v.title} · 组织架构\n\n负责人：${v.owner}\n\n\`\`\`\n${v.title}\n├── 产品部\n│   ├── 产品经理\n│   └── 设计师\n├── 技术部\n│   ├── 前端\n│   ├── 后端\n│   └── 测试\n└── 运营部\n    ├── 内容\n    └── 客户成功\n\`\`\`\n\n## 职责说明\n${v.notes}` }
      ]
    });
  },

  /* ================= 销售与 CRM ================= */
  'sales-crm'(root) {
    calcWorkbench(root, {
      title: '销售与客户计算',
      groups: [
        { name: '销售漏斗', fields: [['visit', '访问/线索', 1000], ['mql', '意向', 300], ['sql', '商机', 100], ['deal', '成交', 20]], run: (v) => `线索→意向：${(v.mql / v.visit * 100).toFixed(1)}%\n意向→商机：${(v.sql / v.mql * 100).toFixed(1)}%\n商机→成交：${(v.deal / v.sql * 100).toFixed(1)}%\n整体转化：${(v.deal / v.visit * 100).toFixed(2)}%` },
        { name: '线索评分', fields: [['budget', '预算匹配 0–10', 8], ['authority', '决策权 0–10', 6], ['need', '需求 0–10', 7], ['time', '时间 0–10', 5]], run: (v) => `加权得分（BANT）：${((v.budget * 0.3 + v.authority * 0.25 + v.need * 0.3 + v.time * 0.15)).toFixed(1)} / 10\n建议：${(v.budget * 0.3 + v.authority * 0.25 + v.need * 0.3 + v.time * 0.15) >= 7 ? '优先跟进' : '培育观察'}` },
        { name: '销售目标拆解', fields: [['target', '年度目标', 12000000], ['avg', '客单价', 30000], ['rate', '成交率 %', 20], ['months', '月份数', 12]], run: (v) => `需成交客户：${Math.ceil(v.target / v.avg)} 家\n需商机：${Math.ceil(v.target / v.avg / (v.rate / 100))} 个\n每月需商机：${Math.ceil(v.target / v.avg / (v.rate / 100) / v.months)} 个` },
        { name: '佣金/提成', fields: [['sales', '销售额', 100000], ['rate', '提成 %', 5], ['base', '底薪', 8000]], run: (v) => `提成：${(v.sales * v.rate / 100).toFixed(2)}\n总收入：${(v.base + v.sales * v.rate / 100).toFixed(2)}` },
        { name: 'NPS', fields: [['promoters', '推荐者人数', 60], ['passive', '中立人数', 30], ['detractors', '贬损者人数', 10]], run: (v) => { const total = v.promoters + v.passive + v.detractors; return `NPS = ${((v.promoters - v.detractors) / total * 100).toFixed(1)}\n（-100 到 100，>30 通常较好）`; } },
        { name: '客户流失与 CLV', fields: [['customers', '期初客户', 1000], ['lost', '流失客户', 80], ['arpu', '月均客单价', 200], ['months', '平均生命周期月', 18]], run: (v) => `流失率：${(v.lost / v.customers * 100).toFixed(2)}%\nCLV ≈ ${(v.arpu * v.months).toFixed(2)}\n月流失 ${(v.lost / v.customers * 100).toFixed(2)}% 对应平均生命周期 ${(100 / (v.lost / v.customers)).toFixed(1)} 个月` }
      ]
    });
  },

  /* ================= 采购与库存 ================= */
  'procurement'(root) {
    calcWorkbench(root, {
      title: '采购与库存计算',
      groups: [
        { name: '安全库存', fields: [['z', '服务水平系数 z', 1.65], ['sigma', '需求标准差/天', 20], ['lead', '补货周期 天', 7]], run: (v) => `安全库存 ≈ ${(v.z * v.sigma * Math.sqrt(v.lead)).toFixed(0)} 件\n（z=1.65 约 95% 服务水平）` },
        { name: '再订货点', fields: [['demand', '日均需求', 50], ['lead', '补货周期 天', 7], ['safety', '安全库存', 80]], run: (v) => `再订货点 = ${(v.demand * v.lead + v.safety).toFixed(0)} 件` },
        { name: 'EOQ 经济订货量', fields: [['d', '年需求量', 12000], ['s', '每次订货成本', 200], ['h', '单位年持有成本', 5]], run: (v) => `EOQ = ${Math.sqrt(2 * v.d * v.s / v.h).toFixed(0)} 件\n年订货次数 ≈ ${(v.d / Math.sqrt(2 * v.d * v.s / v.h)).toFixed(1)} 次` },
        { name: '库存周转', fields: [['cogs', '年销货成本', 800000], ['inv', '平均库存', 100000]], run: (v) => `周转率 = ${(v.cogs / v.inv).toFixed(2)} 次/年\n周转天数 = ${(365 / (v.cogs / v.inv)).toFixed(1)} 天` },
        { name: '缺货率', fields: [['demand', '总需求', 10000], ['short', '缺货数量', 150]], run: (v) => `缺货率 = ${(v.short / v.demand * 100).toFixed(2)}%\n满足率 = ${((1 - v.short / v.demand) * 100).toFixed(2)}%` },
        { name: '库龄分析', fields: [['d0', '0–30 天金额', 50000], ['d1', '31–90 天金额', 30000], ['d2', '91–180 天金额', 15000], ['d3', '180 天以上金额', 5000]], run: (v) => { const total = v.d0 + v.d1 + v.d2 + v.d3; return `库存总额：${total}\n0–30 天：${(v.d0 / total * 100).toFixed(1)}%\n31–90 天：${(v.d1 / total * 100).toFixed(1)}%\n91–180 天：${(v.d2 / total * 100).toFixed(1)}%\n180 天以上：${(v.d3 / total * 100).toFixed(1)}%`; } }
      ]
    });
  },

  /* ================= 项目管理 ================= */
  'project-pro'(root) {
    templateWorkbench(root, {
      title: '项目管理模板',
      templates: [
        { id: 'wbs', name: 'WBS 工作分解', build: (v) => `# ${v.title} · WBS\n\n负责人：${v.owner}　日期：${v.date}\n\n1. 项目启动\n   1.1 目标与范围\n   1.2 干系人识别\n2. 需求与设计\n${v.notes.split('\n').filter(Boolean).map((x, i) => `   2.${i + 1} ${x}`).join('\n')}\n3. 开发与测试\n4. 上线与验收\n5. 复盘与归档` },
        { id: 'raci', name: 'RACI 矩阵', build: (v) => `# ${v.title} · RACI 矩阵\n\n| 任务 | 负责人 R | 审批 A | 咨询 C | 知会 I |\n| --- | --- | --- | --- | --- |\n| 需求确认 |  |  |  |  |\n| 方案设计 |  |  |  |  |\n| 开发实现 |  |  |  |  |\n| 测试验收 |  |  |  |  |\n| 上线发布 |  |  |  |  |\n\n负责人：${v.owner}` },
        { id: 'risk', name: '风险登记册', build: (v) => `# ${v.title} · 风险登记册\n\n| 编号 | 风险描述 | 概率 | 影响 | 等级 | 应对措施 | 负责人 |\n| --- | --- | --- | --- | --- | --- | --- |\n| R1 |  | 中 | 高 | 高 |  |  |\n| R2 |  | 低 | 中 | 中 |  |  |\n\n## 说明\n${v.notes}` },
        { id: 'milestone', name: '里程碑清单', build: (v) => `# ${v.title} · 里程碑\n\n- 项目负责人：${v.owner}\n- 计划日期：${v.date}\n\n| 里程碑 | 目标日期 | 交付物 | 状态 |\n| --- | --- | --- | --- |\n${v.notes.split('\n').filter(Boolean).map((x, i) => `| M${i + 1} ${x} |  |  | 未开始 |`).join('\n')}` },
        { id: 'charter', name: '项目章程', build: (v) => `# ${v.title} · 项目章程\n\n- 发起人：\n- 项目经理：${v.owner}\n- 日期：${v.date}\n\n## 背景\n\n\n## 目标与成功标准\n${v.notes.split('\n').filter(Boolean).map((x) => '- ' + x).join('\n')}\n\n## 范围\n- 包含：\n- 不包含：\n\n## 关键干系人\n\n\n## 主要风险\n\n\n## 审批\n` },
        { id: 'weekly', name: '项目周报', build: (v) => `# ${v.title} · 项目周报\n\n- 周期：${v.date}\n- 负责人：${v.owner}\n\n## 本周进展\n${v.notes.split('\n').filter(Boolean).map((x) => '- ' + x).join('\n')}\n\n## 下周计划\n- \n\n## 风险与阻塞\n- 无\n\n## 需要支持\n- 无` },
        { id: 'change', name: '变更请求', build: (v) => `# ${v.title} · 变更请求\n\n- 提出人：${v.owner}\n- 日期：${v.date}\n- 变更类型：范围 / 进度 / 成本 / 质量\n\n## 变更内容\n${v.notes}\n\n## 影响分析\n- 范围：\n- 进度：\n- 成本：\n- 风险：\n\n## 决策\n- [ ] 批准\n- [ ] 拒绝\n- [ ] 待补充` },
        { id: 'accept', name: '验收清单', build: (v) => `# ${v.title} · 验收清单\n\n验收人：${v.owner}　日期：${v.date}\n\n${v.notes.split('\n').filter(Boolean).map((x) => `- [ ] ${x}`).join('\n')}\n- [ ] 文档齐全\n- [ ] 权限与账号移交\n- [ ] 监控与告警就绪\n- [ ] 回滚方案确认\n\n## 验收结论\n- [ ] 通过\n- [ ] 有条件通过\n- [ ] 不通过` }
      ]
    });
  },

  /* ================= 风险合规与客服 ================= */
  'risk-support'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="rs-tabs"><button class="tab active" data-i="0">合规清单</button><button class="tab" data-i="1">政策生成</button><button class="tab" data-i="2">工单 SLA</button></div>
        <div id="rs-p0"></div>
        <div class="panel hidden" id="rs-p1">
          <div class="grid3">
            <div class="field"><label class="lab">类型</label><select class="sel" id="rs-type"><option value="disclaimer">免责声明</option><option value="copyright">版权声明</option><option value="license">许可声明</option><option value="retention">数据保留策略</option><option value="privacy">隐私政策摘要</option></select></div>
            <div class="field"><label class="lab">主体</label><input class="inp" id="rs-company" value="空天工具合集"></div>
            <div class="field"><label class="lab">联系方式</label><input class="inp" id="rs-email" value="hello@example.com"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="rs-gen">生成</button><button class="btn" id="rs-copy">复制</button><button class="btn" id="rs-dl">下载 .md</button></div>
          <pre class="out" id="rs-out" style="margin-top:10px"></pre>
        </div>
        <div class="panel hidden" id="rs-p2">
          <div class="grid4">
            <div class="field"><label class="lab">优先级</label><select class="sel" id="rs-pri"><option value="P1">P1 紧急</option><option value="P2">P2 高</option><option value="P3" selected>P3 中</option><option value="P4">P4 低</option></select></div>
            <div class="field"><label class="lab">首次响应目标 min</label><input class="inp" id="rs-first" type="number" value="30"></div>
            <div class="field"><label class="lab">解决目标 h</label><input class="inp" id="rs-resolve" type="number" value="8"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="rs-sla" style="width:100%">计算</button></div>
          </div>
          <pre class="out" id="rs-sla-out" style="margin-top:10px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const holder = document.createElement('div');
    root.querySelector('#rs-p0').appendChild(holder);
    checklistWorkbench(holder, {
      title: '合规与安全清单',
      sections: [
        { name: 'GDPR / 隐私', items: ['明确数据控制者与处理者', '记录数据处理活动', '提供隐私政策与告知', '支持数据访问、删除、导出', '跨境传输合法性评估', '数据泄露 72 小时通知流程'] },
        { name: '安全基线', items: ['强制 HTTPS 与 HSTS', '最小权限与定期复核', '依赖漏洞扫描', '备份与恢复演练', '日志留存与告警', '离职权限回收'] },
        { name: '事件响应', items: ['发现与分级', '隔离与止损', '取证与记录', '通知与沟通', '恢复与复盘', '改进项跟踪'] },
        { name: '业务连续性 / 灾备', items: ['关键业务清单', 'RTO / RPO 定义', '异地备份', '切换演练', '供应商联络表', '恢复验证记录'] },
        { name: '数据治理', items: ['数据分类分级', '保留期限', '删除与销毁记录', '访问审计', '第三方共享清单', '员工培训记录'] }
      ]
    });
    $('#rs-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#rs-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#rs-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    const gen = () => {
      const c = $('#rs-company').value, e = $('#rs-email').value, t = $('#rs-type').value;
      const year = new Date().getFullYear();
      if (t === 'disclaimer') return `# 免责声明\n\n${c} 提供的工具按“现状”提供，不对计算结果的准确性、完整性或适用性作明示或暗示担保。\n\n加密、健康、金融、法律相关结果不构成专业建议。用户应自行复核并承担使用风险。\n\n如有疑问：${e}`;
      if (t === 'copyright') return `# 版权声明\n\n© ${year} ${c}. 保留所有权利。\n\n未经许可，不得复制、修改、分发或用于商业用途。开源依赖遵循其各自许可证。\n\n联系：${e}`;
      if (t === 'license') return `# 许可声明\n\n本项目代码采用 MIT License。\n\n你可以自由使用、修改、分发，但需保留版权声明与许可声明。软件按“现状”提供，不提供担保。\n\n第三方依赖遵循其各自许可证，请在使用前核对。`;
      if (t === 'retention') return `# 数据保留策略\n\n${c} 仅在本机保存用户主动创建的数据（收藏、笔记、待办等），不上传服务器。\n\n- 浏览器本地数据：由用户自行清除\n- 日志与统计：不采集个人身份信息\n- 第三方 CDN 请求：按 CDN 服务商策略\n\n数据删除请求：${e}`;
      return `# 隐私政策摘要\n\n${c} 不收集、不上传用户在工具中处理的文件与文本。所有处理在浏览器本地完成。\n\n本地存储用于主题、收藏与最近使用；可随时清除。\n\n摄像头、麦克风、剪贴板等权限仅在主动使用对应工具时请求。\n\n联系：${e}`;
    };
    $('#rs-gen').onclick = () => { $('#rs-out').textContent = gen(); };
    $('#rs-copy').onclick = () => copy($('#rs-out').textContent);
    $('#rs-dl').onclick = () => download('policy.md', $('#rs-out').textContent, 'text/markdown');
    $('#rs-sla').onclick = () => {
      const pri = $('#rs-pri').value;
      const first = Number($('#rs-first').value), resolve = Number($('#rs-resolve').value);
      $('#rs-sla-out').textContent = `优先级：${pri}\n首次响应目标：${first} 分钟\n解决目标：${resolve} 小时\n\n升级路径：\n1. 一线客服 ${first} 分钟内响应\n2. ${resolve} 小时未解决升级至二线\n3. P1 事件每 30 分钟同步进展\n4. 超时自动记录并纳入复盘`;
    };
    $('#rs-gen').click(); $('#rs-sla').click();
  }
};
