/* 空天工具合集 · 工具注册表
   元数据用于首页、搜索、分类；具体实现在 tools/<cat>.js 中按 id 导出。 */

const t = (id, name, cat, desc, tags, extra = {}) => ({ id, name, cat, desc, tags, ...extra });

export const CATEGORIES = [
  { id: 'text', name: '文本处理', icon: 'text', desc: '统计、清洗、转换、提取、编码' },
  { id: 'encoding', name: '编码转换', icon: 'encoding', desc: 'Base64、进制、XML/YAML/CSV' },
  { id: 'dev', name: '开发工具', icon: 'dev', desc: 'JSON、正则、哈希、JWT、代码' },
  { id: 'data', name: '数据表格', icon: 'data', desc: 'CSV、统计、图表、SQLite、IP' },
  { id: 'time', name: '时间日期', icon: 'time', desc: '时间戳、农历、倒计时、时钟' },
  { id: 'math', name: '数学计算', icon: 'math', desc: '计算器、换算、贷款、健康' },
  { id: 'random', name: '随机生成', icon: 'random', desc: '随机数、抽奖、占位图、假数据' },
  { id: 'security', name: '安全隐私', icon: 'security', desc: 'AES、RSA、EXIF、脱敏、隐写' },
  { id: 'design', name: '颜色设计', icon: 'design', desc: '配色、CSS、SVG、字体' },
  { id: 'image', name: '图片处理', icon: 'image', desc: '压缩、裁剪、水印、OCR' },
  { id: 'pdf', name: 'PDF 文档', icon: 'pdf', desc: '合并拆分、水印、签名、文本' },
  { id: 'file', name: '文件压缩', icon: 'file', desc: 'ZIP、分割、预览、重命名' },
  { id: 'audio', name: '音频工具', icon: 'audio', desc: '录音、剪辑、节拍、噪音' },
  { id: 'media', name: '视频设备', icon: 'media', desc: '摄像头、录屏、屏幕测试' },
  { id: 'qr', name: '二维码', icon: 'qr', desc: '生成、识别、批量、条形码' },
  { id: 'life', name: '生活效率', icon: 'life', desc: '待办、笔记、打卡、记账' },
  { id: 'learn', name: '学习游戏', icon: 'learn', desc: '记忆卡、打字、数独、小游戏' },
  { id: 'office', name: '办公模板', icon: 'office', desc: '周报、简历、发票、大纲' },
  { id: 'browser', name: '浏览器测试', icon: 'browser', desc: '信息、特性、权限检测' },
  { id: 'fun', name: '趣味艺术', icon: 'fun', desc: 'ASCII、像素画、壁纸、梗图' },
  { id: 'ai', name: '本地智能', icon: 'ai', desc: '摘要、关键词、情感分析' },
  { id: 'input', name: '输入与剪贴板', icon: 'keyboard', desc: '输入法、剪贴板、拖放文件' },
  { id: 'print', name: '打印与扫描', icon: 'printer', desc: '拼版、打印 CSS、扫描增强' },
  { id: 'form', name: '表单与考试', icon: 'data', desc: '表单、问卷、评分统计' },
  { id: 'studio', name: '证书与白板', icon: 'award', desc: '徽章、证书、白板与投票' },
  { id: 'science', name: '科学与工程', icon: 'flask', desc: '元素、化学、物理、工程' },
  { id: 'wellness', name: '健康与生活', icon: 'life', desc: '健康记录、睡眠、心理、营养' },
  { id: 'business', name: '商业与组织', icon: 'office', desc: '财税、HR、销售、采购、项目' },
  { id: 'devops', name: '开发运维', icon: 'dev', desc: '配置、数据库、API、日志' },
  { id: 'mediapro', name: '媒体与创作', icon: 'media', desc: '字幕、电子书、视频、音频' },
  { id: 'webpro', name: 'Web 与设计', icon: 'browser', desc: 'CSS 艺术、i18n、SEO、PWA' },
  { id: 'studypro', name: '学习与教育', icon: 'learn', desc: '语言、成语、教务、引用' },
  { id: 'lifepro', name: '出行与法律', icon: 'compass', desc: '旅行、汽车、合同、职业' },
  { id: 'funpro', name: '游戏与生成', icon: 'fun', desc: '数值、精灵图、谜题、生成艺术' },
  { id: 'geoext', name: '地图与天文', icon: 'globe', desc: '坐标、瓦片、轨迹、气象' },
  { id: 'infra', name: '设备与协议', icon: 'chip', desc: '硬件、WebRTC、IoT、3D' },
  { id: 'convert', name: '文件转换', icon: 'media', desc: '音视频、图片、文档、字幕、PDF、表格、压缩包' }
];

export const TOOLS = [
  /* ---------------- 文本 ---------------- */
  t('text-stats', '文本统计', 'text', '字符、单词、行数、段落、词频、可读性一次算清', ['字数', '词频', '统计', '可读性'], { hot: true }),
  t('case-convert', '大小写与命名转换', 'text', '全大写/小写/首字母、驼峰/下划线/短横线互转', ['大小写', '驼峰', 'snake', '命名']),
  t('text-clean', '文本清洗', 'text', '去重、去空行、去首尾空格、排序、打乱、重复行统计', ['去重', '空行', '排序', '清洗']),
  t('line-tools', '行处理与行列转换', 'text', '行号、拆分合并、分列、文本转列表、分隔符拼接', ['行号', '分列', '列表', '合并']),
  t('find-replace', '查找替换', 'text', '普通替换与正则替换预览，支持分组引用', ['替换', '正则', '查找']),
  t('text-diff', '文本对比与相似度', 'text', '逐行差异、Levenshtein、Jaro-Winkler、余弦相似度', ['diff', '对比', '相似度']),
  t('text-extract', '信息提取', 'text', '提取数字、URL、邮箱、手机号、IP、日期、金额', ['提取', '邮箱', '手机号', 'URL']),
  t('text-mask', '文本脱敏', 'text', '手机号/邮箱/姓名/银行卡脱敏，自定义敏感词', ['脱敏', '隐私', '打码']),
  t('text-escape', '文本编码与转义', 'text', 'Base64、URL、Unicode、HTML、JSON、SQL、Shell、YAML', ['转义', 'Base64', 'URL', 'HTML']),
  t('cipher-classic', '古典密码', 'text', '摩斯、ROT13、凯撒、维吉尼亚、培根、猪圈、反转', ['摩斯', '凯撒', '密码', 'ROT13']),
  t('unicode-tools', 'Unicode 工具', 'text', '规范化、全角半角、零宽字符、不可见字符、同形异义', ['Unicode', '全角', '零宽', '规范化']),
  t('cn-convert', '中文转换', 'text', '简繁转换、中文数字、金额大写、竖排、标点转换', ['简繁', '大写金额', '中文数字', '竖排']),
  t('seo-text', 'SEO 文案分析', 'text', '标题/描述长度、关键词密度、可读性、Hashtag', ['SEO', '关键词', '标题', '描述']),
  t('slug-tools', 'Slug 与文件名', 'text', 'URL Slug、文件名安全化、批量文件名、路径规范化', ['slug', '文件名', '路径']),
  t('template-fill', '模板变量填充', 'text', '{{变量}} 批量替换、Mustache 简易渲染', ['模板', '变量', 'Mustache']),
  t('text-speech', '文本转语音', 'text', '使用系统语音朗读，调节语速、音调与音量', ['TTS', '朗读', '语音']),
  t('speech-text', '语音转文本', 'text', 'Web Speech API 实时听写（部分浏览器需联网）', ['语音识别', '听写', 'STT']),

  /* ---------------- 编码 ---------------- */
  t('base64', 'Base64 工具', 'encoding', '文本/文件/图片与 Data URL 互转', ['Base64', 'DataURL', '编码'], { hot: true }),
  t('base-n', 'Base32 / 58 / 62 / 85', 'encoding', 'Base32、Base58、Base62、Base85、UU、QP、Punycode', ['Base32', 'Base58', 'Base85', 'Punycode']),
  t('radix', '进制转换', 'encoding', '2/8/10/16 进制与任意进制互转', ['二进制', '十六进制', '进制']),
  t('text-binary', '文本与字节', 'encoding', '文本↔二进制/十六进制/ASCII，UTF-8 字节查看', ['二进制', '十六进制', 'ASCII', 'UTF-8']),
  t('xml-json', 'XML 与 JSON', 'encoding', 'XML 转 JSON、JSON 转 XML、美化与压缩', ['XML', 'JSON', '转换']),
  t('yaml-json', '配置格式互转', 'encoding', 'YAML / TOML / INI / JSON 互转与格式化', ['YAML', 'TOML', 'INI', 'JSON']),
  t('csv-json', 'CSV 与 JSON', 'encoding', 'CSV↔JSON、分隔符识别、表头处理', ['CSV', 'JSON', '表格']),
  t('excel-convert', 'Excel 转换', 'encoding', 'Excel 转 CSV/JSON，CSV 转 Excel', ['Excel', 'xlsx', 'CSV'], { deps: ['xlsx'] }),
  t('meta-tags', '网页元信息生成', 'encoding', 'Meta/OG/Twitter/JSON-LD/PWA/robots/sitemap/RSS', ['Meta', 'OG', 'SEO', 'PWA']),

  /* ---------------- 开发 ---------------- */
  t('json-workbench', 'JSON 工作台', 'dev', '格式化、压缩、校验、树形查看、JSONPath 提取', ['JSON', '格式化', '校验', 'JSONPath'], { hot: true }),
  t('json-to-code', 'JSON 转代码', 'dev', '生成 TypeScript/Go/Java/Python/C#/Rust 类型', ['TypeScript', 'Go', 'Java', 'Rust']),
  t('json-mock', 'Mock 数据生成', 'dev', '按模板生成假 JSON、测试数据表', ['Mock', '假数据', '测试']),
  t('jwt-tool', 'JWT 解析', 'dev', '解析 Header/Payload，检查过期时间', ['JWT', 'Token', '过期']),
  t('regex-test', '正则测试', 'dev', '实时匹配高亮、替换预览、常用正则库', ['正则', 'regex', '匹配']),
  t('hash-tool', '哈希与 HMAC', 'dev', 'MD5/SHA-1/SHA-256/SHA-512、HMAC、文件哈希', ['MD5', 'SHA256', 'HMAC', '哈希'], { deps: ['cryptojs'] }),
  t('uuid-tool', 'UUID / ULID / NanoID', 'dev', '批量生成各类唯一 ID', ['UUID', 'ULID', 'NanoID']),
  t('password-tool', '密码生成与强度', 'dev', '随机密码、密码短语、熵与强度评估', ['密码', '强度', '熵']),
  t('totp-tool', 'TOTP / HOTP', 'dev', '生成与验证动态口令，导出二维码', ['TOTP', 'HOTP', '2FA'], { deps: ['qrcode'] }),
  t('code-format', '代码格式化', 'dev', 'HTML/CSS/JS/JSON/SQL/XML 美化与压缩', ['格式化', '压缩', 'CSS', 'SQL']),
  t('markdown-editor', 'Markdown 编辑器', 'dev', '实时预览、目录、导出 HTML', ['Markdown', '编辑器', '预览'], { deps: ['marked', 'dompurify'], hot: true }),
  t('markdown-convert', 'Markdown 转换', 'dev', 'Markdown↔HTML、转纯文本、目录生成', ['Markdown', 'HTML', '目录'], { deps: ['marked'] }),
  t('codegen', '开发模板生成', 'dev', '.gitignore / LICENSE / README / Dockerfile / compose / nginx', ['gitignore', 'LICENSE', 'Dockerfile']),
  t('http-info', 'HTTP 与 MIME 查询', 'dev', '状态码、MIME 类型、UA 解析、常用端口', ['HTTP', '状态码', 'MIME', 'UA']),
  t('url-tools', 'URL 解析与 UTM', 'dev', '参数解析构建、编码、UTM 链接、Cookie 解析', ['URL', 'UTM', '参数', 'Cookie']),
  t('curl-convert', 'cURL 转换', 'dev', 'cURL ↔ fetch / axios / HTTPie', ['curl', 'fetch', 'axios']),
  t('cron-tool', 'Cron 解析', 'dev', '解析表达式并计算下次执行时间', ['Cron', '定时', '表达式']),
  t('semver-tool', '版本号工具', 'dev', 'SemVer 比较、递增、依赖范围解析', ['SemVer', '版本', 'npm']),
  t('pkce-tool', 'PKCE 生成器', 'dev', '生成 code_verifier / code_challenge', ['OAuth', 'PKCE', '授权']),
  t('api-form', 'JSON 与表单', 'dev', 'JSON↔表单、Mock API 响应、查询串', ['表单', 'JSON', 'API']),

  /* ---------------- 数据 ---------------- */
  t('csv-workbench', 'CSV 工作台', 'data', '预览、排序、筛选、去重、列操作、导出', ['CSV', '表格', '筛选', '排序'], { hot: true }),
  t('table-convert', '表格格式转换', 'data', 'CSV/TSV/Markdown/JSON/HTML 表格互转', ['Markdown表格', 'CSV', 'JSON']),
  t('data-stats', '统计计算', 'data', '平均数/中位数/众数/标准差/分位数/相关系数/回归', ['统计', '平均', '标准差', '回归']),
  t('data-validate', '数据校验', 'data', '身份证、银行卡 Luhn、IBAN、ISBN、EAN、VIN、IMEI', ['校验', '身份证', 'Luhn', 'IBAN']),
  t('data-pivot', '分组与透视', 'data', '按列分组统计、简易透视表', ['分组', '透视表', '汇总']),
  t('chart-maker', '图表生成', 'data', '折线/柱状/饼图/散点/雷达，导出 PNG', ['图表', '折线图', '饼图'], { deps: ['chartjs'], hot: true }),
  t('sqlite-browser', 'SQLite 浏览器', 'data', '浏览器内建库、执行 SQL、导入导出 CSV/JSON', ['SQLite', 'SQL', '数据库'], { deps: ['sqljs'] }),
  t('ip-cidr', 'IP / CIDR 计算', 'data', '子网掩码、网段范围、可用地址数', ['IP', 'CIDR', '子网']),
  t('geo-tools', '地理坐标计算', 'data', '距离、方位角、多边形面积、轨迹长度、UTM', ['经纬度', '距离', 'UTM']),
  t('geo-file', 'GeoJSON / GPX / KML', 'data', '查看、格式化、KML 转 GeoJSON、轨迹点', ['GeoJSON', 'GPX', 'KML']),
  t('visualization', '可视化生成器', 'data', '词云、日历热力图、甘特图、时间轴', ['词云', '热力图', '甘特图']),

  /* ---------------- 时间 ---------------- */
  t('timestamp', '时间戳转换', 'time', 'Unix 秒/毫秒与日期互转、批量转换、时区', ['时间戳', 'Unix', '时区'], { hot: true }),
  t('date-calc', '日期计算', 'time', '日期差、加减、年龄、工作日、周数、季度', ['日期差', '年龄', '工作日']),
  t('world-clock', '世界时钟', 'time', '多城市当前时间、时区会议规划', ['时区', '世界时钟', '会议']),
  t('countdown', '倒计时', 'time', '目标时间倒计时、正计时', ['倒计时', '计时']),
  t('pomodoro', '番茄钟', 'time', '专注/休息循环、任务记录、提示音', ['番茄钟', '专注', 'Pomodoro']),
  t('stopwatch', '秒表', 'time', '毫秒级计时、分段记录', ['秒表', '计时', '分段']),
  t('calendar-gen', '日历生成', 'time', '月历/年历生成、导出图片', ['日历', '月历', '年历']),
  t('lunar', '农历与节气', 'time', '农历转换、节气、生肖、星座', ['农历', '节气', '生肖', '星座']),
  t('sun-moon', '日出日落与月相', 'time', '太阳位置、黄金时刻、蓝调时刻、月相', ['日出', '日落', '月相', '黄金时刻']),
  t('sleep-calc', '睡眠计算', 'time', '根据入睡/起床时间计算睡眠周期', ['睡眠', '作息', '周期']),
  t('anniversary', '纪念日倒数', 'time', '纪念日、生日、高考/项目倒数日', ['纪念日', '生日', '倒数日']),

  /* ---------------- 数学 ---------------- */
  t('calculator', '科学计算器', 'math', '表达式求值、函数、常数、历史记录', ['计算器', '表达式', '科学'], { deps: ['mathjs'], hot: true }),
  t('unit-convert', '单位换算', 'math', '长度/重量/面积/体积/温度/速度/压力/能量/功率/数据', ['单位', '换算', '长度', '温度']),
  t('percentage-calc', '百分比与分摊', 'math', '百分比、折扣、小费、AA 分摊、比例', ['百分比', '折扣', 'AA', '小费']),
  t('loan-calc', '贷款计算', 'math', '等额本息/等额本金、房贷、提前还款、信用卡', ['房贷', '贷款', '等额本息']),
  t('finance-calc', '理财计算', 'math', '复利、定投、年化、通胀、退休储蓄、APR/APY', ['复利', '定投', '年化', '理财']),
  t('health-calc', '健康计算', 'math', 'BMI/体脂/BMR/TDEE、饮水、心率、配速、1RM', ['BMI', '体脂', 'TDEE', '配速']),
  t('number-theory', '数论与组合', 'math', '质数、因数分解、GCD/LCM、斐波那契、排列组合', ['质数', '因数', 'GCD', '排列组合']),
  t('equation-plot', '方程与函数绘图', 'math', '一元方程求解、函数图像绘制', ['方程', '函数', '绘图'], { deps: ['mathjs'] }),
  t('matrix-calc', '矩阵计算', 'math', '乘法、转置、行列式、逆矩阵、线性方程组', ['矩阵', '行列式', '线性方程']),
  t('stats-pro', '统计与分布', 'math', '正态分布、置信区间、A/B 样本量、概率', ['正态分布', '置信区间', 'A/B']),
  t('photo-calc', '摄影计算', 'math', '曝光、景深、ND 滤镜、等效焦距、视角', ['曝光', '景深', 'ND', '焦距']),
  t('business-calc', '商业计算', 'math', '毛利、ROI/ROAS、CAC/LTV、盈亏平衡、库存周转', ['毛利', 'ROI', '盈亏', '电商']),

  /* ---------------- 随机 ---------------- */
  t('random-basic', '随机数与颜色', 'random', '随机整数/小数、随机颜色、渐变、种子', ['随机数', '颜色', '渐变']),
  t('random-person', '随机身份数据', 'random', '姓名、英文名、公司、地址、邮箱、手机号（测试）', ['姓名', '测试数据', '地址']),
  t('lorem-gen', '随机文案', 'random', 'Lorem Ipsum、中文段落、名言、诗词、笑话', ['Lorem', '文案', '名言', '诗词']),
  t('fake-json', '假数据 JSON', 'random', '生成用户/订单/商品等假 JSON 数据', ['假数据', 'JSON', 'Mock']),
  t('random-group', '随机分组与点名', 'random', '随机分组、队伍、点名、抽题、打乱顺序', ['分组', '点名', '抽签']),
  t('wheel', '抽奖转盘', 'random', '自定义奖项转盘，带减速动画', ['转盘', '抽奖', '幸运']),
  t('dice-coin', '骰子与决定器', 'random', '骰子、硬币、猜拳、随机决定', ['骰子', '硬币', '猜拳', '决定']),
  t('placeholder-gen', '占位图生成', 'random', '自定义尺寸/颜色/文字的占位图、头像、SVG', ['占位图', '头像', 'SVG']),
  t('coupon-gen', '邀请码与券码', 'random', '邀请码、优惠券码、会员卡号、短代码', ['邀请码', '优惠券', '卡号']),
  t('tarot', '塔罗与星座', 'random', '塔罗牌意、星座运势模板、MBTI 测试', ['塔罗', '星座', 'MBTI']),

  /* ---------------- 安全 ---------------- */
  t('aes-text', 'AES 文本加密', 'security', '口令派生密钥，AES-GCM 加密/解密文本', ['AES', '加密', '解密'], { hot: true }),
  t('aes-file', '文件加密', 'security', '本地 AES 加密文件并下载', ['文件加密', 'AES', '隐私']),
  t('rsa-tool', 'RSA 密钥工具', 'security', '生成密钥对、加解密、签名验签', ['RSA', '密钥', '签名']),
  t('exif-tool', 'EXIF 查看与清除', 'security', '读取/删除图片 EXIF、GPS、元数据', ['EXIF', 'GPS', '元数据'], { hot: true }),
  t('image-stego', '图片隐写', 'security', 'LSB 隐写与提取、零宽字符隐写', ['隐写', 'LSB', '零宽']),
  t('privacy-gen', '隐私政策生成', 'security', '隐私政策、Cookie 政策、服务条款模板', ['隐私政策', 'Cookie', '条款']),
  t('vault', '本地加密笔记', 'security', '口令加密的本地笔记/密码本', ['密码本', '笔记', '加密']),
  t('idn-check', '域名安全检查', 'security', 'IDN 同形异义、URL 结构、可疑字符检测', ['IDN', '钓鱼', '域名']),
  t('clipboard-tool', '剪贴板工具', 'security', '读取/写入剪贴板、清理提醒、格式转换', ['剪贴板', '复制', '粘贴']),

  /* ---------------- 设计 ---------------- */
  t('color-convert', '颜色转换', 'design', 'HEX/RGB/HSL/HSV/CMYK 互转与颜色命名', ['HEX', 'RGB', 'HSL', '颜色'], { hot: true }),
  t('color-picker', '取色器', 'design', '屏幕/图片取色、主色提取、色板', ['取色', '主色', '图片']),
  t('palette-gen', '调色板与渐变', 'design', '配色方案、CSS 渐变、色板导出', ['调色板', '渐变', '配色']),
  t('contrast-check', '对比度与色盲', 'design', 'WCAG 对比度、色盲模拟、无障碍检查', ['WCAG', '对比度', '色盲']),
  t('css-gen', 'CSS 样式生成', 'design', '阴影、圆角、边框、玻璃拟态、新拟态、按钮', ['CSS', '阴影', '玻璃', '按钮']),
  t('layout-gen', '布局生成器', 'design', 'Grid/Flexbox/媒体查询/响应式断点', ['Grid', 'Flex', '媒体查询']),
  t('font-tools', '字体工具', 'design', '字体预览、配对、字号/行高/字距换算', ['字体', '字号', '行高']),
  t('svg-tools', 'SVG 工具', 'design', '预览、压缩、转 PNG、颜色替换', ['SVG', '压缩', 'PNG']),
  t('favicon-gen', '图标生成', 'design', 'Favicon、PWA 图标、启动图生成', ['Favicon', 'PWA', '图标']),
  t('css-effects', 'CSS 背景与动画', 'design', '网格/噪点/条纹背景、渐变文字、缓动预览', ['背景', '动画', '缓动']),
  t('design-token', '设计变量生成', 'design', 'CSS 变量、设计 Token、Tailwind 配置、暗色主题', ['CSS变量', 'Tailwind', 'Token']),
  t('poster-gen', '海报与名片生成', 'design', '海报、名片、社交封面、证书、邀请函', ['海报', '名片', '封面']),

  /* ---------------- 图片 ---------------- */
  t('image-compress', '图片压缩', 'image', '质量/尺寸压缩、批量处理、体积对比', ['压缩', '批量', 'WebP'], { hot: true }),
  t('image-resize', '缩放与格式转换', 'image', 'PNG/JPG/WebP 互转、批量缩放', ['缩放', '格式转换', 'WebP']),
  t('image-crop', '裁剪与旋转', 'image', '自由裁剪、旋转、翻转、圆角', ['裁剪', '旋转', '翻转']),
  t('image-watermark', '图片水印', 'image', '文字/图片/时间水印，批量应用', ['水印', '时间', '批量']),
  t('image-filter', '图片滤镜', 'image', '灰度、反色、亮度/对比度/饱和度、模糊、像素化', ['滤镜', '灰度', '模糊']),
  t('image-grid', '九宫格与拼接', 'image', '九宫格切图、长图拼接、多图合并', ['九宫格', '拼接', '长图']),
  t('image-info', '图片信息', 'image', '尺寸、体积、格式、EXIF、直方图', ['尺寸', 'EXIF', '直方图']),
  t('image-base64', '图片 Base64', 'image', '图片↔Base64/Data URL', ['Base64', 'DataURL', '图片']),
  t('image-ascii', '图片转 ASCII', 'image', '字符画、像素画生成', ['ASCII', '字符画', '像素']),
  t('image-pdf', '图片转 PDF', 'image', '多图合成 PDF，设置页面与边距', ['PDF', '图片', '合并'], { deps: ['pdflib'] }),
  t('pdf-image', 'PDF 转图片', 'image', '逐页渲染为 PNG/JPG', ['PDF', 'PNG', '渲染'], { deps: ['pdfjs'] }),
  t('image-ocr', '图片 OCR', 'image', '本地识别中英文文字（首次下载语言包）', ['OCR', '文字识别', '图片'], { deps: ['tesseract'] }),
  t('image-diff', '图片对比', 'image', '并排/滑动对比、像素差异图', ['对比', '差异', '像素']),
  t('image-idphoto', '证件照与头像', 'image', '证件照裁剪、头像圆角、社交尺寸', ['证件照', '头像', '尺寸']),

  /* ---------------- PDF ---------------- */
  t('pdf-merge', 'PDF 合并拆分', 'pdf', '合并、拆分、删除/排序/旋转页面', ['PDF', '合并', '拆分'], { deps: ['pdflib'], hot: true }),
  t('pdf-info', 'PDF 信息', 'pdf', '页数、元数据、缩略图预览', ['PDF', '元数据', '缩略图'], { deps: ['pdfjs'] }),
  t('pdf-text', 'PDF 文本提取', 'pdf', '逐页提取文本，导出 TXT', ['PDF', '文本', '提取'], { deps: ['pdfjs'] }),
  t('pdf-watermark', 'PDF 水印页码', 'pdf', '添加文字水印与页码', ['PDF', '水印', '页码'], { deps: ['pdflib'] }),
  t('pdf-sign', 'PDF 签名', 'pdf', '手写签名并嵌入 PDF', ['PDF', '签名', '手写'], { deps: ['pdflib'] }),
  t('pdf-base64', 'PDF Base64', 'pdf', 'PDF↔Base64 互转', ['PDF', 'Base64', '编码']),

  /* ---------------- 文件 ---------------- */
  t('zip-tool', 'ZIP 压缩解压', 'file', '打包下载、解压预览、ZIP 内文件提取', ['ZIP', '压缩', '解压'], { deps: ['jszip'], hot: true }),
  t('file-split', '文件分割合并', 'file', '按大小分割文件、合并分片', ['分割', '合并', '大文件']),
  t('file-preview', '文件预览', 'file', 'CSV/Excel/JSON/XML/图片/PDF/音视频预览', ['预览', '拖拽', '文件']),
  t('batch-rename', '批量重命名', 'file', '规则生成新文件名、导出 ZIP', ['重命名', '批量', '规则']),
  t('dir-tree', '目录树生成', 'file', '拖入文件夹生成目录树与 Markdown', ['目录树', '文件夹', 'Markdown']),
  t('storage-test', '存储测试', 'file', 'localStorage/IndexedDB/OPFS 容量与读写测试', ['存储', 'IndexedDB', 'OPFS']),

  /* ---------------- 音频 ---------------- */
  t('recorder', '录音机', 'audio', '麦克风录音、波形、下载 WebM/WAV', ['录音', '麦克风', 'WebM']),
  t('audio-player', '音频播放与波形', 'audio', '本地音频播放、波形与频谱可视化', ['播放器', '波形', '频谱']),
  t('audio-edit', '音频剪辑', 'audio', '裁剪、合并、淡入淡出、音量', ['裁剪', '合并', '淡入淡出']),
  t('audio-convert', '音频转换', 'audio', '视频转音频、导出 WAV、格式转换', ['WAV', '视频转音频', '格式']),
  t('audio-speed', '变速与倒放', 'audio', '变速、变调、倒放（Web Audio）', ['变速', '倒放', '变调']),
  t('metronome', '节拍器', 'audio', 'BPM 节拍、拍号、重音提示', ['节拍', 'BPM', '音乐']),
  t('tuner', '调音器', 'audio', '麦克风音高检测、标准音参考', ['调音', '音高', '吉他']),
  t('noise', '噪音混音器', 'audio', '白/粉/棕噪音混音、专注背景音', ['白噪音', '专注', '混音']),
  t('synth', '合成器', 'audio', '钢琴键盘、音阶、和弦查询与合成', ['合成器', '和弦', '音阶']),

  /* ---------------- 视频设备 ---------------- */
  t('camera', '摄像头', 'media', '拍照、录像、镜像、滤镜、下载', ['摄像头', '拍照', '录像'], { hot: true }),
  t('screen-record', '屏幕录制', 'media', '录制屏幕/窗口/标签页（可含麦克风）', ['录屏', '屏幕', '录制']),
  t('video-snapshot', '视频截图', 'media', '上传视频截帧、批量导出画面', ['视频', '截图', '帧']),
  t('video-info', '视频信息', 'media', '时长、分辨率、码率、格式检测', ['视频', '元数据', '分辨率']),
  t('screen-test', '屏幕测试', 'media', '坏点、色彩、刷新率、分辨率、DPR', ['屏幕', '坏点', '刷新率']),
  t('input-test', '输入设备测试', 'media', '键盘、鼠标、触摸、手柄、震动测试', ['键盘', '鼠标', '手柄', '触摸']),

  /* ---------------- 二维码 ---------------- */
  t('qr-gen', '二维码生成', 'qr', '文本/URL/WiFi/vCard/邮件/短信/电话/位置', ['二维码', 'WiFi', 'vCard'], { deps: ['qrcode'], hot: true }),
  t('qr-batch', '批量二维码', 'qr', '批量生成二维码并打包 ZIP', ['批量', '二维码', 'ZIP'], { deps: ['qrcode', 'jszip'] }),
  t('qr-scan', '二维码识别', 'qr', '上传图片或摄像头扫码（本地解码）', ['扫码', '识别', '摄像头'], { deps: ['jsqr'] }),
  t('barcode', '条形码工具', 'qr', 'Code128/EAN-13/UPC 生成与校验', ['条形码', 'Code128', 'EAN'], { deps: ['jsbarcode'] }),

  /* ---------------- 生活 ---------------- */
  t('todo', '待办清单', 'life', '添加、分类、优先级、完成度，本地保存', ['待办', '任务', '清单']),
  t('notes', '记事本', 'life', '多便签、Markdown、自动保存、导出', ['笔记', '便签', 'Markdown']),
  t('habit', '习惯打卡', 'life', '每日打卡、连续天数、热力图', ['习惯', '打卡', '热力图']),
  t('ledger', '记账本', 'life', '收支记录、分类统计、预算', ['记账', '收支', '预算']),
  t('mood', '情绪与复盘', 'life', '情绪记录、每日复盘、趋势', ['情绪', '复盘', '日记']),
  t('shopping', '清单管理', 'life', '购物/旅行/打包清单模板', ['购物', '旅行', '打包']),
  t('subscription', '订阅管理', 'life', '订阅到期提醒、月均支出', ['订阅', '账单', '提醒']),
  t('water', '饮水与久坐', 'life', '饮水打卡、久坐提醒、屏幕常亮', ['饮水', '久坐', '提醒']),

  /* ---------------- 学习 ---------------- */
  t('flashcards', '记忆卡片', 'learn', '单词卡、间隔重复、导入导出', ['单词', 'Anki', '记忆']),
  t('typing-test', '打字测试', 'learn', '中英文打字速度与准确率', ['打字', 'WPM', '速度']),
  t('math-practice', '口算练习', 'learn', '加减乘除口算题生成与批改', ['口算', '数学', '练习']),
  t('kana', '日语五十音', 'learn', '假名表、罗马音、发音、测验', ['日语', '五十音', '假名']),
  t('sudoku', '数独', 'learn', '生成/求解/校验，多难度', ['数独', '益智', '游戏']),
  t('game-2048', '2048', 'learn', '经典 2048 小游戏', ['2048', '游戏', '益智']),
  t('game-snake', '贪吃蛇', 'learn', '键盘/触摸控制的贪吃蛇', ['贪吃蛇', '游戏', '街机']),
  t('game-minesweeper', '扫雷', 'learn', '多难度扫雷，支持触屏', ['扫雷', '游戏', '益智']),
  t('game-gomoku', '五子棋', 'learn', '本地 AI 对弈', ['五子棋', 'AI', '棋类']),
  t('reaction-test', '反应力测试', 'learn', '反应速度、舒尔特方格、色感测试', ['反应', '舒尔特', '测试']),
  t('shortcut-ref', '快捷键查询', 'learn', 'Windows/macOS/VS Code/浏览器快捷键', ['快捷键', '键盘', '效率']),
  t('latex-preview', '公式预览', 'learn', 'LaTeX 公式实时渲染（KaTeX）', ['LaTeX', '公式', 'KaTeX'], { deps: ['katex', 'katexCss'] }),

  /* ---------------- 办公 ---------------- */
  t('doc-templates', '文档模板', 'office', '周报/日报/会议纪要/OKR/需求/Bug/复盘/ADR', ['周报', '会议纪要', 'OKR', '模板']),
  t('resume', '简历生成', 'office', '填写信息生成简历，打印为 PDF', ['简历', '求职', '打印']),
  t('invoice', '单据生成', 'office', '发票、报价单、收据模板，打印/PDF', ['发票', '报价单', '收据']),
  t('ppt-outline', 'PPT 大纲', 'office', '文本转 PPT 大纲/演讲提纲', ['PPT', '大纲', '演讲']),
  t('a11y-check', '可访问性检查', 'office', 'HTML 标题层级、alt、表单标签、链接文本', ['无障碍', 'a11y', 'SEO']),

  /* ---------------- 浏览器 ---------------- */
  t('browser-info', '浏览器信息', 'browser', 'UA、屏幕、DPR、语言、时区、CPU/内存、WebGL', ['UA', '浏览器', '设备']),
  t('feature-detect', '特性检测', 'browser', 'CSS/JS/API 支持情况一览', ['特性', '兼容性', '检测']),
  t('permission-test', '权限测试', 'browser', '摄像头/麦克风/定位/通知/剪贴板/文件系统', ['权限', '隐私', '测试']),

  /* ---------------- 趣味 ---------------- */
  t('ascii-art', 'ASCII 艺术字', 'fun', '文字转 ASCII 大字、图片转字符画', ['ASCII', '艺术字', '字符']),
  t('pixel-editor', '像素画板', 'fun', '像素画、涂鸦板、签名板', ['像素', '涂鸦', '画板']),
  t('mandala-gen', '曼陀罗生成', 'fun', '对称曼陀罗、分形图案、迷宫生成', ['曼陀罗', '分形', '迷宫']),
  t('meme-gen', '表情包生成', 'fun', '图片加文字，生成表情包/梗图', ['表情包', '梗图', '文字']),
  t('wallpaper-gen', '壁纸生成', 'fun', '渐变/几何/星空壁纸，适配手机与桌面', ['壁纸', '渐变', '图案']),

  /* ---------------- 本地智能 ---------------- */
  t('ai-summary', '本地摘要', 'ai', 'TextRank/TF-IDF 关键词与摘要，纯本地计算', ['摘要', '关键词', 'TextRank']),
  t('ai-sentiment', '文本情感分析', 'ai', '本地词典情感倾向、敏感词与可读性', ['情感', '倾向', '分析']),

  /* ---------------- 输入与剪贴板 ---------------- */
  t('input-assist', '输入辅助工作台', 'input', '全半角、标点转换、短语、快捷回复、候选排序、词频', ['输入法', '全角', '短语', '候选词'], { hot: true }),
  t('ime-schemes', '输入方案查询', 'input', '双拼、五笔字根、仓颉码、注音符号查询', ['双拼', '五笔', '仓颉', '注音']),
  t('handwriting', '手写板测试', 'input', '手写绘制、笔迹粗细与颜色、导出 PNG', ['手写', '画板', '笔迹']),
  t('clipboard-pro', '剪贴板工作台', 'input', '读取文本/图片、格式识别、清理、哈希、二维码', ['剪贴板', '读取', '清理', '哈希'], { hot: true }),
  t('dragdrop-pro', '拖放工作台', 'input', '文件类型、大小、哈希、目录树、信息提取', ['拖放', '文件', '目录树', '提取']),

  /* ---------------- 打印与扫描 ---------------- */
  t('print-workbench', '打印工作台', 'print', '纸张、边距、出血、裁切线、打印 CSS、页眉页脚', ['打印', '出血', '裁切线', 'CSS'], { hot: true }),
  t('imposition', '拼版计算', 'print', 'N 拼版、名片、证件照、小册子、书脊厚度', ['拼版', '名片', '证件照', '小册子']),
  t('scan-clean', '扫描件处理', 'print', '旋转、裁剪、对比度、去底色、二值化、转 PDF', ['扫描', '去底色', '二值化', 'PDF'], { deps: ['pdflib'] }),
  t('scan-ocr', '扫描 OCR', 'print', '批量识别、去重、脱敏、关键词、CSV/JSON 导出', ['OCR', '扫描', '批量', '脱敏'], { deps: ['tesseract'] }),

  /* ---------------- 表单与考试 ---------------- */
  t('form-builder', '表单生成器', 'form', '字段设计、校验规则、HTML/JSON/Schema 输出', ['表单', '校验', 'Schema', 'HTML']),
  t('survey-builder', '问卷生成器', 'form', '题目设计、逻辑、评分、离线填写包、二维码', ['问卷', '离线', '二维码'], { deps: ['qrcode'] }),
  t('survey-stats', '问卷统计', 'form', 'CSV/JSON 结果统计、频率分布、汇总导出', ['问卷', '统计', '频率']),
  t('exam-tool', '考试与评分', 'form', '题库、随机组卷、评分、成绩统计与分布', ['考试', '组卷', '评分', '统计'], { hot: true }),

  /* ---------------- 证书与白板 ---------------- */
  t('badge-gen', '徽章生成器', 'studio', '徽章 SVG/PNG、批量、编号、二维码', ['徽章', 'SVG', '批量', '二维码'], { deps: ['qrcode', 'jszip'] }),
  t('cert-gen', '证书生成器', 'studio', '奖状/结业/参赛/志愿者/培训证书，批量与校验码', ['证书', '奖状', '批量', '校验'], { deps: ['qrcode', 'jszip'], hot: true }),
  t('whiteboard', '白板与投票', 'studio', '画笔、形状、模板、自动保存、PNG/SVG/JSON、投票', ['白板', '模板', '投票', '导出'], { hot: true }),

  /* ---------------- 科学与工程 ---------------- */
  t('periodic-table', '元素周期表', 'science', '118 种元素查询、原子量、分类与搜索', ['元素', '周期表', '原子量']),
  t('chem-calc', '化学计算', 'science', '摩尔质量、浓度、稀释、pH、理想气体、计量', ['化学', '摩尔', 'pH', '浓度']),
  t('physics-calc', '物理计算', 'science', '运动、力、功、能量、压强、浮力、欧姆定律、波', ['物理', '力学', '电学', '波']),
  t('engineering-calc', '工程计算', 'science', '齿轮、扭矩、皮带、材料重量、公差、比例', ['工程', '齿轮', '扭矩', '材料']),
  t('lab-record', '实验记录', 'science', '实验信息、数据表、折线图、CSV 与 Markdown 导出', ['实验', '记录', '数据', '图表']),

  /* ---------------- 健康与生活 ---------------- */
  t('vitals-log', '健康记录', 'wellness', '血压/血糖/体温/体重/血氧、趋势、CSV、紧急卡', ['健康', '血压', '血糖', '趋势'], { hot: true }),
  t('sleep-pro', '睡眠与作息', 'wellness', '睡眠周期、睡眠债务、效率、咖啡因、时差、小睡', ['睡眠', '作息', '时差', '咖啡因']),
  t('mind-care', '心理与冥想', 'wellness', '情绪/压力/感恩日记、4-7-8/箱式呼吸、冥想计时', ['情绪', '压力', '呼吸', '冥想']),
  t('nutrition', '营养烹饪', 'wellness', '食谱缩放、杯克换算、烤箱温度、宏量、咖啡/盐水', ['营养', '烹饪', '热量', '换算']),
  t('fitness', '运动健身', 'wellness', '配速、分段、骑行功率、心率区间、TRIMP、1RM', ['健身', '配速', '心率', '1RM']),
  t('interval-timer', '间歇计时器', 'wellness', 'Tabata、HIIT、EMOM、AMRAP 与自定义计时', ['HIIT', 'Tabata', '计时', '训练']),
  t('garden-pet', '园艺与宠物', 'wellness', '浇水施肥提醒、NPK、堆肥、宠物年龄与喂食', ['园艺', '宠物', '提醒', 'NPK']),

  /* ---------------- 商业与组织 ---------------- */
  t('finance-pro', '财税计算', 'business', '个税、年终奖、增值税、折旧、NPV/IRR、盈亏平衡', ['个税', '增值税', 'NPV', 'IRR'], { hot: true }),
  t('hr-tools', 'HR 招聘模板', 'business', 'JD、面试问题、评分表、入职/离职、Offer 对比', ['HR', '招聘', 'JD', '面试']),
  t('sales-crm', '销售与 CRM', 'business', '销售漏斗、线索评分、目标拆解、佣金、NPS、流失', ['销售', 'CRM', '漏斗', 'NPS']),
  t('procurement', '采购与库存', 'business', '安全库存、再订货点、EOQ、周转率、库龄', ['采购', '库存', 'EOQ', '周转']),
  t('project-pro', '项目管理模板', 'business', 'WBS、RACI、风险登记、里程碑、章程、验收', ['项目', 'WBS', 'RACI', '风险']),
  t('risk-support', '风险合规与客服', 'business', 'GDPR/安全/灾备清单、政策生成、工单 SLA', ['合规', 'GDPR', 'SLA', '政策']),

  /* ---------------- 开发运维 ---------------- */
  t('config-gen', '配置生成器', 'devops', 'Docker/K8s/CI/Nginx/Caddy/安全头/环境变量', ['Docker', 'K8s', 'CI', 'Nginx'], { hot: true }),
  t('db-design', '数据库设计', 'devops', 'SQL 解析、数据字典、TypeScript/Go/Java/Python、迁移', ['数据库', 'SQL', 'ER', '迁移']),
  t('api-tools', 'API 工具', 'devops', 'OpenAPI→Markdown/TS/Mock、GraphQL、HAR→cURL', ['OpenAPI', 'GraphQL', 'HAR', 'API']),
  t('log-analyzer', '日志分析', 'devops', '级别统计、错误聚合、时间线、脱敏、CSV/JSON', ['日志', '错误', '时间线', '脱敏']),
  t('regex-pro', '正则与文本算法', 'devops', '性能测试、glob 互转、批量相似度、TF-IDF', ['正则', 'glob', '相似度', 'TF-IDF']),
  t('codegen-pro', '代码生成扩展', 'devops', 'JSON→Zod/Yup/Prisma/Mongoose/GraphQL/Protobuf', ['Zod', 'Prisma', 'GraphQL', '代码生成']),

  /* ---------------- 媒体与创作 ---------------- */
  t('subtitle-tools', '字幕工作台', 'mediapro', 'SRT/VTT/ASS 互转、偏移、缩放、合并、QC', ['字幕', 'SRT', 'VTT', 'ASS'], { hot: true }),
  t('ebook-tools', '电子书与漫画', 'mediapro', 'EPUB 元数据/目录/封面/正文，CBZ 转 PDF', ['EPUB', 'CBZ', '漫画', 'PDF'], { deps: ['jszip', 'pdflib'] }),
  t('video-calc', '视频计算', 'mediapro', '码率体积、时间码、变速、缩放、平台尺寸、安全区', ['视频', '码率', '时间码', '尺寸']),
  t('audio-analyze', '音频分析', 'mediapro', '峰值、RMS、动态范围、DC 偏移、立体声兼容', ['音频', '响度', '峰值', 'RMS']),
  t('music-theory', '音乐理论', 'mediapro', '音名频率、音程、移调、和弦、五度圈、MIDI/BPM', ['音乐', '音程', '和弦', 'MIDI']),
  t('audio-gen', '音效生成', 'mediapro', '白/粉/棕噪音、双耳节拍、扫频音效', ['音效', '噪音', '双耳节拍']),

  /* ---------------- Web 与设计 ---------------- */
  t('css-art', 'CSS 艺术', 'webpro', '形状、clip-path、遮罩、混合、滤镜、3D、滚动动画', ['CSS', 'clip-path', '滤镜', '3D']),
  t('i18n-tools', '国际化工具', 'webpro', '语言包对比、缺失键、CSV↔JSON、伪本地化、RTL', ['i18n', '语言包', 'RTL', 'CSV']),
  t('a11y-pro', '无障碍工具', 'webpro', 'ARIA 查询、焦点顺序、WCAG 清单、对比度', ['无障碍', 'ARIA', 'WCAG', '焦点']),
  t('seo-pro', 'SEO 扩展', 'webpro', 'SERP 预览、JSON-LD、批量长度检查、sitemap', ['SEO', 'SERP', 'JSON-LD', 'sitemap'], { hot: true }),
  t('pwa-tools', 'PWA 工具', 'webpro', 'Manifest 校验、缓存策略、本地存储查看', ['PWA', 'Manifest', '缓存', '存储']),
  t('perf-panel', '性能与存储', 'webpro', '导航/资源耗时、FPS、内存、存储配额', ['性能', 'FPS', '内存', '资源']),

  /* ---------------- 学习与教育 ---------------- */
  t('language-lab', '语言实验室', 'studypro', '日语变形、西法德冠词、英语时态、音标与字母', ['日语', '英语', '西班牙语', '音标']),
  t('idioms', '成语与词汇', 'studypro', '成语接龙/填空、近反义词、英语词根', ['成语', '近义词', '词根', '接龙']),
  t('teaching', '教育行政', 'studypro', '课程表、座位表、值日表、教案模板', ['课程表', '座位表', '教案', '值日']),
  t('citation', '学术引用', 'studypro', 'BibTeX→APA/MLA/Chicago/RIS、DOI/ISBN/ISSN 校验', ['BibTeX', 'APA', 'MLA', 'DOI']),

  /* ---------------- 出行与法律 ---------------- */
  t('travel-tools', '旅行与户外', 'lifepro', '预算、徒步时间、行李重量、汇率、时区', ['旅行', '预算', '徒步', '行李']),
  t('auto-tools', '汽车与交通', 'lifepro', '油耗、每公里成本、EV 续航、轮胎、保养、VIN', ['汽车', '油耗', 'EV', 'VIN']),
  t('law-tools', '法律与合同', 'lifepro', '条款提取、风险词、NDA/授权书/委托书/声明', ['合同', '条款', 'NDA', '风险']),
  t('career-tools', '求职与职业', 'lifepro', 'ATS 检查、STAR、薪资谈判、Offer 对比', ['求职', 'ATS', 'STAR', 'Offer']),
  t('content-tools', '内容与社媒', 'lifepro', '内容日历、平台字数、Front Matter、RSS/Slug', ['内容', '社媒', 'RSS', 'Slug']),

  /* ---------------- 游戏与生成 ---------------- */
  t('game-dev', '游戏数值', 'funpro', '伤害公式、掉落率、经验曲线、掉落模拟', ['游戏', '伤害', '掉落', '经验']),
  t('sprite-tools', '精灵图工具', 'funpro', '精灵表切图、动画预览、批量导出', ['精灵图', '切图', '动画'], { deps: ['jszip'] }),
  t('puzzle-tools', '谜题工具', 'funpro', '24 点求解/出题、迷宫生成、记忆序列', ['24点', '迷宫', '记忆']),
  t('random-pro', '随机扩展', 'funpro', '加权抽取、可复现种子、多轮统计', ['加权', '随机', '种子', '抽奖']),
  t('gen-art', '生成艺术', 'funpro', 'L-system、Mandelbrot/Julia、万花尺', ['生成艺术', '分形', 'L-system']),

  /* ---------------- 地图与天文 ---------------- */
  t('coord-convert', '坐标转换', 'geoext', '度分秒↔十进制、批量 UTM、EPSG 查询', ['坐标', 'DMS', 'UTM', 'EPSG']),
  t('map-grid', '地图分幅', 'geoext', '经纬度↔瓦片、比例尺、分辨率', ['地图', '瓦片', '比例尺', '分辨率']),
  t('track-tools', '轨迹分析', 'geoext', 'GPX 距离/爬升/速度、简化、GeoJSON 导出', ['GPX', '轨迹', '爬升', '速度']),
  t('weather-calc', '气象计算', 'geoext', '热指数、风寒、露点、气压高度、蒲福风级', ['天气', '热指数', '风寒', '露点']),
  t('astro-calc', '天文计算', 'geoext', '望远镜倍率/视场、极限星等、天文单位、恒星时、月相', ['天文', '望远镜', '月相', '星等']),

  /* ---------------- 设备与协议 ---------------- */
  t('hardware-test', '硬件测试', 'infra', '电池、媒体设备、手柄、传感器、全屏、震动', ['硬件', '电池', '手柄', '传感器']),
  t('webrtc-tools', 'WebRTC 工具', 'infra', '本地回环、SDP 格式化、设备枚举、统计', ['WebRTC', 'SDP', '回环', '设备']),
  t('iot-tools', 'IoT 工具', 'infra', 'MQTT 主题/消息、传感器模拟、设备注册、二维码', ['IoT', 'MQTT', '传感器', '设备'], { deps: ['qrcode'] }),
  t('xr3d-tools', '3D / XR 工具', 'infra', 'WebXR 检测、STL 体积面积、GLTF 结构统计', ['3D', 'WebXR', 'STL', 'GLTF']),

  /* ---------------- 文件转换 ---------------- */
  t('convert-all', '转换工作台', 'convert', '音视频/图片/文档/字幕/PDF/表格/压缩包一站式批量转换', ['格式转换', '批量', '转换台', '本地处理'], { hot: true }),
  t('convert-video', '视频转换', 'convert', '16 种输出：MP4/WEBM/MKV/MOV/AVI/TS/FLV/WMV/GIF，可只提取音轨', ['视频转换', 'mp4', 'webm', 'gif', '压缩']),
  t('convert-audio', '音频转换', 'convert', '10 种输出与码率/采样率/声道/位深参数，覆盖 MP3/FLAC/OGG/M4A', ['音频转换', 'mp3', 'flac', 'm4a']),
  t('convert-image', '图片格式转换', 'convert', 'JPG/PNG/WEBP/AVIF/BMP/TIFF/ICO/SVG/PDF 九类输出', ['图片转换', 'avif', 'webp', 'ico', 'tiff']),
  t('convert-doc', '文档转换', 'convert', 'DOCX/ODT/RTF/EPUB/HTML/MD/TXT/PDF 互转', ['文档转换', 'docx', 'epub', 'md', 'pdf']),
  t('convert-sheet', '表格转换', 'convert', 'XLSX/CSV/TSV/JSON/HTML 互转，保留工作表结构', ['表格转换', 'xlsx', 'csv', 'json']),
  t('convert-subtitle', '字幕转换', 'convert', 'SRT/VTT/ASS 互转，支持时间轴整体偏移与纯文本导出', ['字幕', 'srt', 'vtt', 'ass']),
  t('convert-pdf', 'PDF 工具箱', 'convert', '26 项操作：转图/转文本/转 HTML/CBZ、拆分拼版、小册子、水印、Bates、压缩', ['PDF', '合并', '拆分', '压缩', '转图'], { hot: true }),
  t('convert-archive', '压缩包处理', 'convert', '解压与重新打包 ZIP，可筛选条目后重新生成', ['zip', '解压', '压缩包'])
];

export const TOOL_MAP = Object.fromEntries(TOOLS.map((x) => [x.id, x]));
export const CAT_MAP = Object.fromEntries(CATEGORIES.map((x) => [x.id, x]));

export function countByCat(cat) {
  return TOOLS.filter((x) => x.cat === cat).length;
}
