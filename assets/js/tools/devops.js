/* 开发运维、数据库、API 与代码生成 */
import { esc, copy, toast, download } from '../core/ui.js';
import { templateWorkbench, calcWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);

function infer(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.length ? infer(v[0]) + '[]' : 'any[]';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return Number.isInteger(v) ? 'number' : 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'object';
}
function pascal(s) { return s.replace(/[^A-Za-z0-9_\u4e00-\u9fa5]/g, '_').replace(/^./, (c) => c.toUpperCase()); }
function tsFields(obj, indent = '  ') {
  return Object.entries(obj).map(([k, v]) => `${indent}${k}: ${typeof v === 'object' && v !== null && !Array.isArray(v) ? pascal(k) : infer(v)};`).join('\n');
}
function sqlTypeToTs(t) {
  t = t.toLowerCase();
  if (/int|serial|bigint|smallint/.test(t)) return 'number';
  if (/decimal|numeric|float|double|real/.test(t)) return 'number';
  if (/bool/.test(t)) return 'boolean';
  if (/date|time/.test(t)) return 'string';
  if (/json/.test(t)) return 'any';
  return 'string';
}
function parseCreateTable(sql) {
  const tables = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"\[]?([\w.]+)[`"\]]?\s*\(([\s\S]*?)\)\s*;/gi;
  let m;
  while ((m = re.exec(sql))) {
    const name = m[1].split('.').pop();
    const cols = m[2].split(/\n|,/).map((s) => s.trim()).filter(Boolean).map((line) => {
      if (/^(PRIMARY|UNIQUE|KEY|CONSTRAINT|INDEX|FOREIGN)/i.test(line)) return null;
      const parts = line.split(/\s+/);
      const col = (parts[0] || '').replace(/[`"\[\]]/g, '');
      const type = (parts[1] || '').toUpperCase();
      const notnull = /NOT\s+NULL/i.test(line);
      const pk = /PRIMARY\s+KEY/i.test(line);
      return { col, type, notnull, pk };
    }).filter(Boolean);
    tables.push({ name, cols });
  }
  return tables;
}

export default {
  /* ================= 配置生成器 ================= */
  'config-gen'(root) {
    templateWorkbench(root, {
      title: '部署与配置生成器',
      fields: [
        ['project', '项目名', 'kongtian-tools'],
        ['port', '端口', '8080'],
        ['image', '镜像', 'node:20-alpine'],
        ['domain', '域名', 'example.com'],
        ['env', '环境', 'production', 'select', [['development', '开发'], ['production', '生产']]]
      ],
      templates: [
        { id: 'dockerfile', name: 'Dockerfile', build: (v) => `FROM ${v.image} AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM nginx:alpine\nCOPY --from=build /app/dist /usr/share/nginx/html\nEXPOSE 80\nHEALTHCHECK CMD wget -qO- http://localhost/ || exit 1\nCMD ["nginx", "-g", "daemon off;"]` },
        { id: 'dockerignore', name: '.dockerignore', build: () => `node_modules\n.git\n.env*\ndist\ncoverage\n*.log\n.DS_Store` },
        { id: 'compose', name: 'docker-compose.yml', build: (v) => `services:\n  ${v.project}:\n    build: .\n    image: ${v.project}:latest\n    ports:\n      - "${v.port}:80"\n    environment:\n      - NODE_ENV=${v.env}\n    restart: unless-stopped\n    healthcheck:\n      test: ["CMD", "wget", "-qO-", "http://localhost/"]\n      interval: 30s\n      timeout: 3s\n      retries: 3` },
        { id: 'k8s', name: 'Kubernetes YAML', build: (v) => `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${v.project}\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: ${v.project}\n  template:\n    metadata:\n      labels:\n        app: ${v.project}\n    spec:\n      containers:\n        - name: ${v.project}\n          image: ${v.project}:latest\n          ports:\n            - containerPort: 80\n          resources:\n            requests:\n              cpu: 100m\n              memory: 128Mi\n            limits:\n              cpu: 500m\n              memory: 512Mi\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: ${v.project}\nspec:\n  selector:\n    app: ${v.project}\n  ports:\n    - port: 80\n      targetPort: 80\n  type: ClusterIP` },
        { id: 'helm', name: 'Helm values.yaml', build: (v) => `replicaCount: 2\nimage:\n  repository: ${v.project}\n  tag: latest\n  pullPolicy: IfNotPresent\nservice:\n  type: ClusterIP\n  port: 80\nresources:\n  limits:\n    cpu: 500m\n    memory: 512Mi\n  requests:\n    cpu: 100m\n    memory: 128Mi\nenv:\n  NODE_ENV: ${v.env}` },
        { id: 'actions', name: 'GitHub Actions', build: (v) => `name: Deploy\non:\n  push:\n    branches: [main]\npermissions:\n  contents: read\n  pages: write\n  id-token: write\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm\n      - run: npm ci\n      - run: npm run build\n      - uses: actions/upload-artifact@v4\n        with:\n          name: dist\n          path: dist` },
        { id: 'gitlab', name: 'GitLab CI', build: (v) => `stages: [test, build, deploy]\ntest:\n  image: node:20\n  script:\n    - npm ci\n    - npm test\nbuild:\n  image: node:20\n  script:\n    - npm ci\n    - npm run build\n  artifacts:\n    paths: [dist/]\ndeploy:\n  stage: deploy\n  script:\n    - echo "deploy ${v.project}"` },
        { id: 'jenkins', name: 'Jenkinsfile', build: (v) => `pipeline {\n  agent any\n  stages {\n    stage('Install') { steps { sh 'npm ci' } }\n    stage('Test') { steps { sh 'npm test' } }\n    stage('Build') { steps { sh 'npm run build' } }\n    stage('Deploy') { steps { sh './deploy.sh' } }\n  }\n  post { always { cleanWs() } }\n}` },
        { id: 'circleci', name: 'CircleCI config', build: () => `version: 2.1\njobs:\n  build:\n    docker:\n      - image: cimg/node:20.11\n    steps:\n      - checkout\n      - run: npm ci\n      - run: npm run build\nworkflows:\n  main:\n    jobs: [build]` },
        { id: 'nginx', name: 'Nginx 配置', build: (v) => `server {\n  listen 80;\n  server_name ${v.domain};\n  return 301 https://$host$request_uri;\n}\n\nserver {\n  listen 443 ssl http2;\n  server_name ${v.domain};\n  root /usr/share/nginx/html;\n  index index.html;\n\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n\n  location ~* \\.(js|css|svg|png|jpg|webp|woff2)$ {\n    expires 30d;\n    add_header Cache-Control "public, immutable";\n  }\n}` },
        { id: 'caddy', name: 'Caddyfile', build: (v) => `${v.domain} {\n  root * /usr/share/nginx/html\n  try_files {path} /index.html\n  file_server\n  encode gzip zstd\n  header {\n    Strict-Transport-Security "max-age=31536000; includeSubDomains"\n    X-Content-Type-Options "nosniff"\n  }\n}` },
        { id: 'apache', name: 'Apache 配置', build: (v) => `<VirtualHost *:80>\n  ServerName ${v.domain}\n  DocumentRoot /var/www/html\n  RewriteEngine On\n  RewriteCond %{HTTPS} off\n  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\n</VirtualHost>` },
        { id: 'headers', name: '安全响应头', build: () => `add_header X-Content-Type-Options "nosniff" always;\nadd_header X-Frame-Options "SAMEORIGIN" always;\nadd_header Referrer-Policy "strict-origin-when-cross-origin" always;\nadd_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;\nadd_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self' https://cdn.jsdelivr.net" always;` },
        { id: 'cors', name: 'CORS 配置', build: (v) => `Access-Control-Allow-Origin: https://${v.domain}\nAccess-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\nAccess-Control-Allow-Headers: Content-Type, Authorization\nAccess-Control-Max-Age: 86400\nAccess-Control-Allow-Credentials: true` },
        { id: 'gzip', name: 'Gzip / Brotli', build: () => `gzip on;\ngzip_comp_level 6;\ngzip_min_length 1024;\ngzip_types text/plain text/css application/json application/javascript image/svg+xml;\nbrotli on;\nbrotli_comp_level 6;\nbrotli_types text/plain text/css application/json application/javascript image/svg+xml;` },
        { id: 'cache', name: '缓存头策略', build: () => `# HTML：不缓存或短缓存\nlocation = /index.html { add_header Cache-Control "no-cache"; }\n\n# 带哈希的静态资源：长缓存\nlocation ~* \\.(js|css|woff2)$ { add_header Cache-Control "public, max-age=31536000, immutable"; }\n\n# 图片：中等缓存\nlocation ~* \\.(png|jpg|jpeg|webp|svg)$ { add_header Cache-Control "public, max-age=2592000"; }` },
        { id: 'env', name: '.env 示例', build: (v) => `NODE_ENV=${v.env}\nPORT=${v.port}\nAPP_NAME=${v.project}\nAPP_URL=https://${v.domain}\nLOG_LEVEL=info` },
        { id: 'deploy', name: '部署检查清单', build: (v) => `# ${v.project} 部署检查清单\n\n- [ ] 构建产物与版本号确认\n- [ ] 环境变量与密钥已配置\n- [ ] 数据库迁移已执行\n- [ ] 静态资源缓存策略确认\n- [ ] 健康检查与监控就绪\n- [ ] 回滚方案与备份确认\n- [ ] 发布公告与值班安排\n- [ ] 发布后冒烟测试` },
        { id: 'rollback', name: '回滚脚本', build: (v) => `#!/usr/bin/env bash\nset -euo pipefail\n\nAPP="${v.project}"\nPREVIOUS_VERSION="$1"\n\nif [ -z "$PREVIOUS_VERSION" ]; then\n  echo "用法: $0 <previous-version>"\n  exit 1\nfi\n\necho "[rollback] $APP -> $PREVIOUS_VERSION"\n# docker compose pull && docker compose up -d\n# kubectl rollout undo deployment/$APP\necho "[rollback] done"` }
      ]
    });
  },

  /* ================= 数据库设计 ================= */
  'db-design'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>数据库设计工作台</b><span class="hint">SQL → 表结构 / 数据字典 / 迁移</span></div>
          <textarea class="ta mono" id="db-sql" rows="9">CREATE TABLE users (\n  id BIGINT PRIMARY KEY,\n  name VARCHAR(64) NOT NULL,\n  email VARCHAR(128) NOT NULL,\n  created_at TIMESTAMP\n);</textarea>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="db-parse">解析 SQL</button>
            <select class="sel" id="db-view" style="max-width:150px"><option value="dict">数据字典</option><option value="ts">TypeScript</option><option value="go">Go</option><option value="java">Java</option><option value="python">Python</option><option value="migration">迁移 SQL</option></select>
            <button class="btn" id="db-copy">复制</button>
          </div>
        </div>
        <div class="grid2">
          <div class="panel"><div class="panel-head"><b>表结构</b></div><div id="db-tables" class="tool-ui"></div></div>
          <div class="panel"><div class="panel-head"><b>生成结果</b></div><pre class="out" id="db-out" style="max-height:460px"></pre></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let tables = [];
    const generate = () => {
      const mode = $('#db-view').value;
      if (!tables.length) return;
      const t = tables[0];
      if (mode === 'dict') {
        $('#db-out').textContent = tables.map((tb) => `## ${tb.name}\n\n| 字段 | 类型 | 非空 | 主键 |\n| --- | --- | --- | --- |\n${tb.cols.map((c) => `| ${c.col} | ${c.type} | ${c.notnull ? '是' : ''} | ${c.pk ? '是' : ''} |`).join('\n')}`).join('\n\n');
      } else if (mode === 'ts') {
        $('#db-out').textContent = `export interface ${pascal(t.name)} {\n${t.cols.map((c) => `  ${c.col}: ${sqlTypeToTs(c.type)};`).join('\n')}\n}`;
      } else if (mode === 'go') {
        $('#db-out').textContent = `type ${pascal(t.name)} struct {\n${t.cols.map((c) => `\t${pascal(c.col)} ${/int/.test(c.type) ? 'int64' : /bool/.test(c.type) ? 'bool' : /decimal|numeric|float|double/.test(c.type.toLowerCase()) ? 'float64' : 'string'} \`json:"${c.col}"\``).join('\n')}\n}`;
      } else if (mode === 'java') {
        $('#db-out').textContent = `public class ${pascal(t.name)} {\n${t.cols.map((c) => `    private ${/int/.test(c.type) ? 'Long' : /bool/.test(c.type) ? 'Boolean' : /decimal|numeric|float|double/.test(c.type.toLowerCase()) ? 'Double' : 'String'} ${c.col};`).join('\n')}\n}`;
      } else if (mode === 'python') {
        $('#db-out').textContent = `from dataclasses import dataclass\nfrom datetime import datetime\nfrom typing import Optional\n\n@dataclass\nclass ${pascal(t.name)}:\n${t.cols.map((c) => `    ${c.col}: ${/int/.test(c.type) ? 'int' : /bool/.test(c.type) ? 'bool' : /decimal|numeric|float|double/.test(c.type.toLowerCase()) ? 'float' : /date|time/.test(c.type.toLowerCase()) ? 'datetime' : 'str'}${c.notnull ? '' : ' | None'}`).join('\n')}`;
      } else {
        $('#db-out').textContent = `-- 迁移脚本（示例）\n${tables.map((tb) => `CREATE TABLE IF NOT EXISTS ${tb.name} (\n${tb.cols.map((c) => `  ${c.col} ${c.type}${c.notnull ? ' NOT NULL' : ''}${c.pk ? ' PRIMARY KEY' : ''}`).join(',\n')}\n);`).join('\n\n')}\n\n-- 回滚\n${tables.map((tb) => `DROP TABLE IF EXISTS ${tb.name};`).join('\n')}`;
      }
    };
    $('#db-parse').onclick = () => {
      tables = parseCreateTable($('#db-sql').value);
      if (!tables.length) return toast('没有解析到 CREATE TABLE 语句', 'err');
      $('#db-tables').innerHTML = tables.map((t) => `<div class="panel tight"><div class="panel-head"><b>${esc(t.name)}</b><span class="hint">${t.cols.length} 字段</span></div><table class="tbl"><tr><th>字段</th><th>类型</th><th>约束</th></tr>${t.cols.map((c) => `<tr><td class="mono">${c.col}</td><td>${c.type}</td><td>${c.pk ? 'PK ' : ''}${c.notnull ? 'NOT NULL' : ''}</td></tr>`).join('')}</table></div>`).join('');
      generate();
    };
    $('#db-view').addEventListener('change', generate);
    $('#db-copy').onclick = () => copy($('#db-out').textContent);
    $('#db-parse').click();
  },

  /* ================= API 工具 ================= */
  'api-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><select class="sel" id="at-mode" style="max-width:220px"><option value="openapi-md">OpenAPI → Markdown</option><option value="openapi-ts">OpenAPI → TypeScript</option><option value="openapi-mock">OpenAPI → Mock</option><option value="graphql">GraphQL 格式化</option><option value="har">HAR → cURL</option><option value="protocol">协议模板</option></select><button class="btn primary" id="at-run">生成</button><button class="btn" id="at-copy">复制</button></div>
          <textarea class="ta mono" id="at-in" rows="10" style="margin-top:9px" placeholder="粘贴 OpenAPI JSON / GraphQL / HAR JSON…"></textarea>
        </div>
        <div class="panel"><pre class="out" id="at-out" style="max-height:460px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const mode = $('#at-mode').value;
      const text = $('#at-in').value;
      try {
        if (mode.startsWith('openapi')) {
          const api = JSON.parse(text);
          const paths = api.paths || {};
          if (mode === 'openapi-md') {
            let md = `# ${api.info?.title || 'API'}\n\n${api.info?.version ? '版本：' + api.info.version : ''}\n\n`;
            for (const [p, methods] of Object.entries(paths)) {
              for (const [m, op] of Object.entries(methods)) {
                md += `## ${m.toUpperCase()} ${p}\n\n${op.summary || op.description || ''}\n\n`;
                const params = op.parameters || [];
                if (params.length) md += `| 参数 | 位置 | 必填 | 类型 |\n| --- | --- | --- | --- |\n${params.map((x) => `| ${x.name} | ${x.in} | ${x.required ? '是' : ''} | ${x.schema?.type || ''} |`).join('\n')}\n\n`;
              }
            }
            $('#at-out').textContent = md;
          } else if (mode === 'openapi-ts') {
            const schemas = api.components?.schemas || {};
            $('#at-out').textContent = Object.entries(schemas).map(([name, s]) => `export interface ${name} {\n${Object.entries(s.properties || {}).map(([k, v]) => `  ${k}${(s.required || []).includes(k) ? '' : '?'}: ${v.type === 'integer' || v.type === 'number' ? 'number' : v.type === 'boolean' ? 'boolean' : v.type === 'array' ? 'any[]' : 'string'};`).join('\n')}\n}`).join('\n\n') || '没有 components.schemas';
          } else {
            const schemas = api.components?.schemas || {};
            const mock = {};
            for (const [name, s] of Object.entries(schemas)) {
              mock[name] = {};
              for (const [k, v] of Object.entries(s.properties || {})) mock[name][k] = v.example ?? (v.type === 'integer' || v.type === 'number' ? 0 : v.type === 'boolean' ? false : v.type === 'array' ? [] : 'string');
            }
            $('#at-out').textContent = JSON.stringify(mock, null, 2);
          }
        } else if (mode === 'graphql') {
          let depth = 0, out = '';
          for (const ch of text) {
            if (ch === '{' || ch === '[') { depth++; out += ch + '\n' + '  '.repeat(depth); }
            else if (ch === '}' || ch === ']') { depth = Math.max(0, depth - 1); out += '\n' + '  '.repeat(depth) + ch; }
            else if (ch === ',') out += ',\n' + '  '.repeat(depth);
            else out += ch;
          }
          $('#at-out').textContent = out.replace(/\n\s*\n/g, '\n').trim();
        } else if (mode === 'har') {
          const har = JSON.parse(text);
          $('#at-out').textContent = (har.log?.entries || []).map((e) => `curl -X ${e.request.method} '${e.request.url}' ${e.request.headers.map((h) => `-H '${h.name}: ${h.value}'`).join(' ')}`).join('\n\n');
        } else {
          $('#at-out').textContent = `# WebSocket\nconst ws = new WebSocket('wss://example.com/ws');\nws.onmessage = (e) => console.log(e.data);\nws.onopen = () => ws.send(JSON.stringify({ type: 'ping' }));\n\n# SSE\nconst es = new EventSource('/events');\nes.onmessage = (e) => console.log(e.data);\n\n# MQTT\n主题：devices/{deviceId}/telemetry\n消息：{ "temp": 25.6, "ts": 1730000000 }\nQoS：1\n\n# 常见错误码\n400 参数错误 · 401 未认证 · 403 无权限 · 404 不存在 · 409 冲突 · 429 限流 · 500 服务器错误`;
        }
      } catch (e) { $('#at-out').textContent = '解析失败：' + e.message; }
    };
    $('#at-run').onclick = run;
    $('#at-copy').onclick = () => copy($('#at-out').textContent);
  },

  /* ================= 日志分析 ================= */
  'log-analyzer'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>日志分析</b><span class="hint">级别统计、错误聚合、去重、脱敏、导出</span></div>
          <textarea class="ta mono" id="la-in" rows="10" placeholder="粘贴日志，每行一条…">2026-11-14 10:00:01 INFO  request /api/tools 200 12ms
2026-11-14 10:00:02 WARN  cache miss key=tools
2026-11-14 10:00:03 ERROR database timeout host=10.0.0.8
2026-11-14 10:00:03 ERROR database timeout host=10.0.0.8</textarea>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="la-run">分析</button><button class="btn" id="la-csv">导出 CSV</button><button class="btn" id="la-json">导出 JSON</button><button class="btn" id="la-mask">脱敏</button></div>
        </div>
        <div class="stat-grid" id="la-stats"></div>
        <div class="grid2">
          <div class="panel"><div class="panel-head"><b>错误聚合</b></div><div id="la-errors" class="tool-ui"></div></div>
          <div class="panel"><div class="panel-head"><b>时间线</b></div><div id="la-timeline" class="hint"></div></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let parsed = [];
    $('#la-run').onclick = () => {
      const lines = $('#la-in').value.split(/\r?\n/).filter((x) => x.trim());
      parsed = lines.map((line) => {
        const m = line.match(/(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)/i);
        const ts = line.match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
        return { line, level: (m ? m[1].toUpperCase().replace('WARNING', 'WARN') : 'INFO'), ts: ts ? ts[0] : '' };
      });
      const levels = {};
      parsed.forEach((p) => { levels[p.level] = (levels[p.level] || 0) + 1; });
      $('#la-stats').innerHTML = Object.entries(levels).map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('') + `<div class="stat"><b>${parsed.length}</b><span>总行数</span></div>`;
      const errors = parsed.filter((p) => p.level === 'ERROR');
      const freq = new Map();
      errors.forEach((e) => { const key = e.line.replace(/^.*?ERROR\s*/, '').replace(/\d+/g, 'N').slice(0, 120); freq.set(key, (freq.get(key) || 0) + 1); });
      $('#la-errors').innerHTML = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><span class="mono" style="font-size:11px">${esc(k)}</span><span class="pill">${v}</span></div>`).join('') || '<div class="hint">没有 ERROR</div>';
      const buckets = new Map();
      parsed.forEach((p) => { if (p.ts) { const k = p.ts.slice(0, 16); buckets.set(k, (buckets.get(k) || 0) + 1); } });
      const max = Math.max(1, ...buckets.values());
      $('#la-timeline').innerHTML = [...buckets.entries()].map(([k, v]) => `<div class="row" style="margin-bottom:5px"><span style="min-width:110px" class="mono">${k}</span><div class="progress" style="flex:1"><i style="width:${v / max * 100}%"></i></div><span class="hint">${v}</span></div>`).join('') || '没有可解析的时间戳';
    };
    $('#la-csv').onclick = () => download('logs.csv', '\ufeff' + [['时间', '级别', '内容'], ...parsed.map((p) => [p.ts, p.level, p.line])].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    $('#la-json').onclick = () => download('logs.json', JSON.stringify(parsed, null, 2), 'application/json');
    $('#la-mask').onclick = () => {
      $('#la-in').value = $('#la-in').value.replace(/(?<!\d)(1[3-9]\d)\d{4}(\d{4})(?!\d)/g, '$1****$2').replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '***.***.***.***').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '***@***');
      toast('已脱敏', 'ok');
    };
    $('#la-run').click();
  },

  /* ================= 正则与文本算法 ================= */
  'regex-pro'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="rp-tabs"><button class="tab active" data-i="0">性能测试</button><button class="tab" data-i="1">glob ↔ 正则</button><button class="tab" data-i="2">批量相似度</button><button class="tab" data-i="3">TF-IDF / BM25</button></div>
        <div class="panel" id="rp-p0">
          <div class="grid2"><div class="field"><label class="lab">正则</label><input class="inp mono" id="rp-re" value="\\b\\w+@\\w+\\.\\w+\\b"></div><div class="field"><label class="lab">文本</label><input class="inp" id="rp-text" value="hello@example.com test@demo.com"></div></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="rp-run">测试 1000 次</button><span class="hint" id="rp-meta"></span></div>
          <pre class="out" id="rp-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="rp-p1">
          <div class="field"><label class="lab">glob 或正则</label><input class="inp mono" id="rp-glob" value="src/**/*.js"></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="rp-g2r" >glob → 正则</button><button class="btn" id="rp-r2g">正则 → glob</button></div>
          <pre class="out" id="rp-globout" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="rp-p2">
          <div class="field"><label class="lab">每行一对：A|B</label><textarea class="ta mono" id="rp-pairs" rows="6">kitten|sitting
hello|hallo
空天工具|空天工具箱</textarea></div>
          <button class="btn primary" id="rp-sim" style="margin-top:9px">计算相似度</button>
          <pre class="out" id="rp-simout" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="rp-p3">
          <div class="field"><label class="lab">文档（空行分隔）</label><textarea class="ta mono" id="rp-docs" rows="7">空天工具合集是浏览器工具箱。所有文件在本地处理。
浏览器工具箱提供文本、图片、PDF 工具。本地处理不上传。
今天天气很好，适合出门散步。</textarea></div>
          <button class="btn primary" id="rp-tfidf" style="margin-top:9px">计算关键词</button>
          <pre class="out" id="rp-tfout" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#rp-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#rp-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#rp-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#rp-run').onclick = () => {
      try {
        const re = new RegExp($('#rp-re').value, 'g');
        const text = $('#rp-text').value;
        const t0 = performance.now();
        let n = 0;
        for (let i = 0; i < 1000; i++) n = [...text.matchAll(re)].length;
        const ms = performance.now() - t0;
        const risky = /(\([^)]*[+*][^)]*\)[+*])/.test($('#rp-re').value);
        $('#rp-meta').textContent = `匹配 ${n} 处 · 1000 次 ${ms.toFixed(1)} ms`;
        $('#rp-out').textContent = `单次平均：${(ms / 1000).toFixed(3)} ms\n匹配数：${n}\n${risky ? '警告：检测到嵌套量词，可能存在灾难性回溯风险。' : '未发现明显的灾难性回溯模式。'}`;
      } catch (e) { $('#rp-out').textContent = '正则错误：' + e.message; }
    };
    $('#rp-g2r').onclick = () => {
      const g = $('#rp-glob').value;
      let re = '^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*').replace(/\?/g, '.') + '$';
      $('#rp-globout').textContent = re;
    };
    $('#rp-r2g').onclick = () => {
      const r = $('#rp-glob').value.replace(/^\^|\$$/g, '').replace(/\.\*/g, '**').replace(/\[\^\/\]\*/g, '*').replace(/\./g, '?');
      $('#rp-globout').textContent = r;
    };
    const lev = (a, b) => {
      const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
      for (let j = 1; j <= b.length; j++) dp[0][j] = j;
      for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return dp[a.length][b.length];
    };
    $('#rp-sim').onclick = () => {
      const out = $('#rp-pairs').value.split(/\r?\n/).filter(Boolean).map((l) => {
        const [a, b] = l.split('|');
        if (!b) return `${l} → 格式错误`;
        const d = lev(a, b);
        return `${a} ↔ ${b}\n  编辑距离 ${d} · 相似度 ${((1 - d / Math.max(a.length, b.length)) * 100).toFixed(1)}%`;
      });
      $('#rp-simout').textContent = out.join('\n\n');
    };
    $('#rp-tfidf').onclick = () => {
      const docs = $('#rp-docs').value.split(/\n\s*\n/).filter(Boolean);
      const tokenize = (s) => s.match(/[\u4e00-\u9fa5]{2,}|[A-Za-z]{2,}/g) || [];
      const df = new Map();
      docs.forEach((d) => new Set(tokenize(d)).forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
      const lines = [];
      docs.forEach((d, i) => {
        const tf = new Map();
        tokenize(d).forEach((w) => tf.set(w, (tf.get(w) || 0) + 1));
        const scores = [...tf.entries()].map(([w, f]) => [w, f * Math.log((docs.length + 1) / (df.get(w) + 0.5))]).sort((a, b) => b[1] - a[1]).slice(0, 6);
        lines.push(`文档 ${i + 1}：` + scores.map(([w, s]) => `${w}(${s.toFixed(2)})`).join('、'));
      });
      $('#rp-tfout').textContent = lines.join('\n');
    };
  },

  /* ================= 代码生成扩展 ================= */
  'codegen-pro'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row">
            <select class="sel" id="cg-mode" style="max-width:200px">
              <option value="zod">JSON → Zod</option><option value="yup">JSON → Yup</option><option value="prisma">JSON → Prisma</option>
              <option value="mongoose">JSON → Mongoose</option><option value="graphql">JSON → GraphQL</option><option value="proto">JSON → Protobuf</option>
              <option value="schema">JSON → JSON Schema</option><option value="sql-ts">SQL → TypeScript</option><option value="sql-go">SQL → Go</option><option value="sql-java">SQL → Java</option><option value="sql-python">SQL → Python</option>
            </select>
            <button class="btn primary" id="cg-run">生成</button><button class="btn" id="cg-copy">复制</button>
          </div>
          <textarea class="ta mono" id="cg-in" rows="9" style="margin-top:9px">{\n  "id": 1,\n  "name": "kongtian",\n  "email": "hi@example.com",\n  "active": true,\n  "tags": ["tools"]\n}</textarea>
        </div>
        <div class="panel"><pre class="out" id="cg-out" style="max-height:460px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const mode = $('#cg-mode').value;
      const text = $('#cg-in').value;
      try {
        if (mode.startsWith('sql-')) {
          const tables = parseCreateTable(text);
          if (!tables.length) throw new Error('没有解析到 CREATE TABLE');
          const t = tables[0], cls = pascal(t.name);
          if (mode === 'sql-ts') $('#cg-out').textContent = `export interface ${cls} {\n${t.cols.map((c) => `  ${c.col}${c.notnull ? '' : '?'}: ${sqlTypeToTs(c.type)};`).join('\n')}\n}`;
          else if (mode === 'sql-go') $('#cg-out').textContent = `type ${cls} struct {\n${t.cols.map((c) => `\t${pascal(c.col)} ${/int/.test(c.type) ? 'int64' : /bool/.test(c.type) ? 'bool' : /decimal|numeric|float|double/.test(c.type.toLowerCase()) ? 'float64' : 'string'} \`json:"${c.col}"\``).join('\n')}\n}`;
          else if (mode === 'sql-java') $('#cg-out').textContent = `public class ${cls} {\n${t.cols.map((c) => `    private ${/int/.test(c.type) ? 'Long' : /bool/.test(c.type) ? 'Boolean' : /decimal|numeric|float|double/.test(c.type.toLowerCase()) ? 'Double' : 'String'} ${c.col};`).join('\n')}\n}`;
          else $('#cg-out').textContent = `from dataclasses import dataclass\n\n@dataclass\nclass ${cls}:\n${t.cols.map((c) => `    ${c.col}: ${/int/.test(c.type) ? 'int' : /bool/.test(c.type) ? 'bool' : /decimal|numeric|float|double/.test(c.type.toLowerCase()) ? 'float' : 'str'}`).join('\n')}`;
          return;
        }
        const obj = JSON.parse(text);
        const name = 'Root';
        if (mode === 'zod') {
          const lines = Object.entries(obj).map(([k, v]) => {
            if (Array.isArray(v)) return v.length && typeof v[0] === 'object' ? `  ${k}: z.array(z.object({ ${Object.keys(v[0]).map((x) => `${x}: z.any()`).join(', ')} }))` : `  ${k}: z.array(z.${infer(v[0])})`;
            if (v && typeof v === 'object') return `  ${k}: z.object({ ${Object.keys(v).map((x) => `${x}: z.any()`).join(', ')} })`;
            return `  ${k}: z.${infer(v)}()`;
          });
          $('#cg-out').textContent = `import { z } from 'zod';\n\nexport const ${name}Schema = z.object({\n${lines.join(',\n')}\n});\n\nexport type ${name} = z.infer<typeof ${name}Schema>;`;
        } else if (mode === 'yup') {
          $('#cg-out').textContent = `import * as yup from 'yup';\n\nexport const ${name}Schema = yup.object({\n${Object.entries(obj).map(([k, v]) => `  ${k}: yup.${Array.isArray(v) ? 'array().of(yup.mixed())' : v && typeof v === 'object' ? 'object()' : v === null ? 'mixed().nullable()' : infer(v) === 'number' ? 'number()' : infer(v) === 'boolean' ? 'boolean()' : 'string()'}`).join(',\n')}\n});`;
        } else if (mode === 'prisma') {
          $('#cg-out').textContent = `model ${name} {\n  id Int @id @default(autoincrement())\n${Object.entries(obj).filter(([k]) => k !== 'id').map(([k, v]) => `  ${k} ${infer(v) === 'number' ? 'Int' : infer(v) === 'boolean' ? 'Boolean' : infer(v).endsWith('[]') ? 'Json' : 'String'}${v === null ? '?' : ''}`).join('\n')}\n}`;
        } else if (mode === 'mongoose') {
          $('#cg-out').textContent = `import mongoose from 'mongoose';\n\nconst ${name}Schema = new mongoose.Schema({\n${Object.entries(obj).map(([k, v]) => `  ${k}: { type: ${infer(v) === 'number' ? 'Number' : infer(v) === 'boolean' ? 'Boolean' : infer(v).endsWith('[]') ? 'Array' : 'String'}, required: true }`).join(',\n')}\n}, { timestamps: true });\n\nexport default mongoose.model('${name}', ${name}Schema);`;
        } else if (mode === 'graphql') {
          $('#cg-out').textContent = `type ${name} {\n${Object.entries(obj).map(([k, v]) => `  ${k}: ${infer(v) === 'number' ? 'Int' : infer(v) === 'boolean' ? 'Boolean' : infer(v).endsWith('[]') ? '[String]' : 'String'}`).join('\n')}\n}`;
        } else if (mode === 'proto') {
          $('#cg-out').textContent = `syntax = "proto3";\n\nmessage ${name} {\n${Object.entries(obj).map(([k, v], i) => `  ${infer(v) === 'number' ? (Number.isInteger(v) ? 'int64' : 'double') : infer(v) === 'boolean' ? 'bool' : infer(v).endsWith('[]') ? 'repeated string' : 'string'} ${k} = ${i + 1};`).join('\n')}\n}`;
        } else {
          const props = {};
          Object.entries(obj).forEach(([k, v]) => { props[k] = { type: infer(v).endsWith('[]') ? 'array' : infer(v) }; });
          $('#cg-out').textContent = JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: props }, null, 2);
        }
      } catch (e) { $('#cg-out').textContent = '生成失败：' + e.message; }
    };
    $('#cg-run').onclick = run;
    $('#cg-copy').onclick = () => copy($('#cg-out').textContent);
    run();
  }
};
