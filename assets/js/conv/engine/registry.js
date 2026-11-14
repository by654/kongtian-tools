/* 类别、目标格式与参数定义：界面与格式矩阵共用同一份数据 */

function canEncodeAvif() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL('image/avif').startsWith('data:image/avif');
  } catch (_) {
    return false;
  }
}

export const AVIF_ENCODE_SUPPORTED = canEncodeAvif();

const P = {
  bitrate: {
    id: 'bitrate', label: '音频码率', type: 'select', default: '192',
    help: '越高越清晰、体积越大；来源是压缩格式时提升码率不会增加细节。',
    options: [['auto', '自动（沿用源）'], ['64', '64 kbps'], ['96', '96 kbps'], ['128', '128 kbps'], ['192', '192 kbps'], ['256', '256 kbps'], ['320', '320 kbps']],
  },
  sampleRate: {
    id: 'sampleRate', label: '采样率', type: 'select', default: 'auto',
    help: '降低采样率可显著减小体积，语音场景 16–32 kHz 通常够用。',
    options: [['auto', '保持原始'], ['48000', '48 kHz'], ['44100', '44.1 kHz'], ['32000', '32 kHz'], ['22050', '22.05 kHz'], ['16000', '16 kHz'], ['8000', '8 kHz']],
  },
  channels: {
    id: 'channels', label: '声道 / 布局', type: 'select', default: 'auto',
    help: '单声道可再省约一半体积；5.1 需要源本身是多声道。',
    options: [['auto', '保持原始'], ['mono', '单声道'], ['stereo', '立体声（2.0）'], ['6', '5.1 环绕（6 声道）']],
  },
  wavDepth: {
    id: 'wavDepth', label: '位深', type: 'select', default: '16',
    help: 'WAV / AIFF 的 PCM 精度，24 位与 32 位浮点体积更大。',
    options: [['16', '16 位整数'], ['24', '24 位整数'], ['32f', '32 位浮点']],
  },
  mp3Vbr: {
    id: 'mp3Vbr', label: 'MP3 码率模式', type: 'select', default: 'off',
    help: 'VBR 按内容复杂度分配码率，通常同体积下音质更好。',
    options: [['off', '固定码率（CBR）'], ['2', 'VBR 高质量 (q2)'], ['4', 'VBR 均衡 (q4)'], ['6', 'VBR 小体积 (q6)']],
  },
  vorbisQuality: {
    id: 'vorbisQuality', label: 'Vorbis 质量', type: 'select', default: '5',
    options: [['3', '低 (3)'], ['5', '中 (5)'], ['7', '高 (7)'], ['9', '极高 (9)']],
  },
  metadata: {
    id: 'metadata', label: '元数据', type: 'select', default: 'keep',
    help: '保留标题、艺术家、拍摄时间等信息，或全部清除以减小体积。',
    options: [['keep', '保留源元数据'], ['strip', '清除元数据']],
  },
  resolution: {
    id: 'resolution', label: '分辨率', type: 'select', default: 'auto',
    help: '按高度缩放并保持宽高比；只缩不放以避免无意义的放大。',
    options: [['auto', '保持原始'], ['2160', '2160p (4K)'], ['1440', '1440p (2K)'], ['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p'], ['240', '240p']],
  },
  fps: {
    id: 'fps', label: '帧率', type: 'select', default: 'auto',
    help: '降低帧率可明显减小体积，动画/游戏视频建议保留 24–30。',
    options: [['auto', '保持原始'], ['60', '60 fps'], ['50', '50 fps'], ['30', '30 fps'], ['25', '25 fps'], ['24', '24 fps'], ['20', '20 fps'], ['15', '15 fps'], ['12', '12 fps'], ['10', '10 fps']],
  },
  videoQuality: {
    id: 'videoQuality', label: '画质', type: 'select', default: 'medium',
    options: [['high', '高（文件较大）'], ['medium', '均衡'], ['low', '小体积']],
  },
  videoEncoder: {
    id: 'videoEncoder', label: '视频编码器', type: 'select', default: 'auto',
    help: 'H.264 兼容性最好；MPEG-4 Part 2 适合老设备，同画质体积更大。',
    options: [['auto', '自动（H.264）'], ['libx264', 'H.264 (libx264)'], ['mpeg4', 'MPEG-4 Part 2']],
  },
  pixelFormat: {
    id: 'pixelFormat', label: '色彩格式', type: 'select', default: 'auto',
    help: '4:2:0 兼容性最好；4:4:4 保留更多色彩细节，但部分播放器不支持。',
    options: [['auto', '自动（4:2:0）'], ['yuv420p', 'YUV 4:2:0'], ['yuv422p', 'YUV 4:2:2'], ['yuv444p', 'YUV 4:4:4']],
  },
  audioBitrate: {
    id: 'audioBitrate', label: '音频码率', type: 'select', default: '128',
    options: [['auto', '自动'], ['64', '64 kbps'], ['96', '96 kbps'], ['128', '128 kbps'], ['192', '192 kbps'], ['256', '256 kbps']],
  },
  start: { id: 'start', label: '起始时间', type: 'text', default: '', placeholder: '如 00:00:05，留空为开头' },
  end: { id: 'end', label: '结束时间', type: 'text', default: '', placeholder: '如 00:01:10，留空为结尾' },
  crop: { id: 'crop', label: '画面裁剪', type: 'text', default: '', placeholder: '宽:高:x:y，如 640:480:0:0' },
  quality: { id: 'quality', label: '质量 (%)', type: 'range', default: '90', min: 20, max: 100, step: 1, help: '仅对有损格式（JPG / WEBP / AVIF / PDF 重压）生效。' },
  compressStrategy: {
    id: 'compressStrategy', label: '压缩策略', type: 'select', default: 'quality',
    help: '质量优先按上面的百分比编码；体积优先会自动搜索最接近目标体积的质量。',
    options: [['quality', '质量优先（按百分比）'], ['size', '体积优先（逼近目标大小）']],
  },
  targetKB: { id: 'targetKB', label: '目标体积 (KB)', type: 'number', default: '300', min: 10, max: 20000, placeholder: '如 300' },
  width: { id: 'width', label: '宽度 (px)', type: 'number', default: '0', min: 0, max: 12000, placeholder: '0 = 自动' },
  height: { id: 'height', label: '高度 (px)', type: 'number', default: '0', min: 0, max: 12000, placeholder: '0 = 自动' },
  background: { id: 'background', label: '透明背景填充', type: 'color', default: '#ffffff', help: '输出格式不支持透明（JPG / BMP / TIFF）时使用。' },
  pdfPage: {
    id: 'pdfPage', label: 'PDF 页面', type: 'select', default: 'original',
    options: [['original', '贴合图片尺寸'], ['a4', 'A4 纸张适配']],
  },
  pdfOrientation: {
    id: 'pdfOrientation', label: '页面方向', type: 'select', default: 'auto',
    help: '仅在 A4 或每页多张时生效；自动会按图片横竖比例选择。',
    options: [['auto', '自动'], ['portrait', '纵向'], ['landscape', '横向']],
  },
  pdfMargin: {
    id: 'pdfMargin', label: '页边距 (pt)', type: 'number', default: '28', min: 0, max: 120, placeholder: '如 28',
    help: '1 pt ≈ 0.35 mm；设为 0 可让图片贴边。',
  },
  pdfPerPage: {
    id: 'pdfPerPage', label: '每页图片数', type: 'select', default: '1',
    help: '2 张为上下排列，4 张为 2×2 宫格；多张时自动使用 A4 页面。',
    options: [['1', '每页 1 张'], ['2', '每页 2 张'], ['4', '每页 4 张 (2×2)']],
  },
  imageQuality: {
    id: 'imageQuality', label: '图片重编码', type: 'select', default: 'original',
    help: '“原始”直接嵌入 JPG/PNG 字节；选择百分比会统一转成 JPEG（透明区域用背景色填充）。',
    options: [['original', '保留原始质量'], ['90', '高质量 (90%)'], ['75', '均衡 (75%)'], ['60', '小体积 (60%)']],
  },
  range: { id: 'range', label: '页码范围', type: 'text', default: '', placeholder: '如 1-3,5；留空表示全部页' },
  dpi: {
    id: 'dpi', label: '渲染精度', type: 'select', default: '144',
    help: '144 DPI 约等于屏幕阅读 2 倍图；印刷建议 300 DPI，但文件更大。',
    options: [['96', '96 DPI（快）'], ['144', '144 DPI'], ['216', '216 DPI'], ['300', '300 DPI（印刷）']],
  },
  rotate: {
    id: 'rotate', label: '旋转角度', type: 'select', default: '90',
    options: [['90', '顺时针 90°'], ['180', '180°'], ['270', '逆时针 90°（270°）']],
  },
  extractMode: {
    id: 'extractMode', label: '提取方式', type: 'select', default: 'single',
    help: '合并模式把所选页面按顺序放进一个 PDF；分组模式每个范围单独输出（多份自动打包 ZIP）。',
    options: [['single', '合并为一个 PDF'], ['separate', '每个范围单独输出']],
  },
  nupGrid: {
    id: 'nupGrid', label: '每张页数', type: 'select', default: '4',
    help: '把连续多页缩放排到一张 A4 纸上，适合讲义与缩印。',
    options: [['2', '2 页 / 张'], ['4', '4 页 / 张 (2×2)'], ['6', '6 页 / 张 (2×3)'], ['9', '9 页 / 张 (3×3)']],
  },
  nupOrientation: {
    id: 'nupOrientation', label: '纸张方向', type: 'select', default: 'auto',
    help: '自动：2 合 1 用横向，其余用纵向。',
    options: [['auto', '自动'], ['portrait', '纵向'], ['landscape', '横向']],
  },
  nupMargin: { id: 'nupMargin', label: '页边距 (pt)', type: 'number', default: '18', min: 0, max: 72, placeholder: '如 18' },
  nupGap: { id: 'nupGap', label: '格子间距 (pt)', type: 'number', default: '8', min: 0, max: 36, placeholder: '如 8' },
  pageSizeTarget: {
    id: 'pageSizeTarget', label: '目标纸张', type: 'select', default: 'a4',
    options: [['a4', 'A4 (210×297 mm)'], ['a3', 'A3'], ['a5', 'A5'], ['letter', 'Letter'], ['legal', 'Legal']],
  },
  pageSizeOrientation: {
    id: 'pageSizeOrientation', label: '页面方向', type: 'select', default: 'auto',
    options: [['auto', '跟随原页'], ['portrait', '纵向'], ['landscape', '横向']],
  },
  cropTop: { id: 'cropTop', label: '上边距 (pt)', type: 'number', default: '0', min: 0, max: 400 },
  cropRight: { id: 'cropRight', label: '右边距 (pt)', type: 'number', default: '0', min: 0, max: 400 },
  cropBottom: { id: 'cropBottom', label: '下边距 (pt)', type: 'number', default: '0', min: 0, max: 400 },
  cropLeft: { id: 'cropLeft', label: '左边距 (pt)', type: 'number', default: '0', min: 0, max: 400 },
  wmText: { id: 'wmText', label: '水印文字', type: 'text', default: '内部资料 · 禁止外传', placeholder: '支持中文，最多 80 字' },
  wmSize: { id: 'wmSize', label: '字号 (pt)', type: 'number', default: '48', min: 8, max: 200 },
  wmOpacity: { id: 'wmOpacity', label: '不透明度 (%)', type: 'range', default: '22', min: 5, max: 100, step: 1 },
  wmRotation: {
    id: 'wmRotation', label: '倾斜角度', type: 'select', default: '-30',
    options: [['0', '水平'], ['-30', '左上倾斜 -30°'], ['-45', '左上倾斜 -45°'], ['30', '右上倾斜 30°'], ['45', '右上倾斜 45°'], ['90', '垂直']],
  },
  wmColor: { id: 'wmColor', label: '水印颜色', type: 'color', default: '#d11a2a' },
  wmMode: {
    id: 'wmMode', label: '分布方式', type: 'select', default: 'center',
    options: [['center', '页面居中一处'], ['tile', '平铺 5 处（防截图）']],
  },
  pnPosition: {
    id: 'pnPosition', label: '页码位置', type: 'select', default: 'bottom-center',
    options: [['bottom-center', '底部居中'], ['bottom-left', '底部靠左'], ['bottom-right', '底部靠右'], ['top-center', '顶部居中'], ['top-left', '顶部靠左'], ['top-right', '顶部靠右']],
  },
  pnFormat: {
    id: 'pnFormat', label: '页码格式', type: 'select', default: 'n',
    options: [['n', '1'], ['n-total', '1 / 总页数'], ['cn', '第 1 页']],
  },
  pnStart: { id: 'pnStart', label: '起始页码', type: 'number', default: '1', min: 0, max: 99999 },
  pnSize: { id: 'pnSize', label: '字号 (pt)', type: 'number', default: '10', min: 6, max: 24 },
  pnColor: { id: 'pnColor', label: '页码颜色', type: 'color', default: '#334155' },
  hfHeader: { id: 'hfHeader', label: '页眉文字', type: 'text', default: '', placeholder: '如 公司名称 · 内部文件' },
  hfFooter: { id: 'hfFooter', label: '页脚文字', type: 'text', default: '', placeholder: '如 空天文件转换 · 2026' },
  hfSize: { id: 'hfSize', label: '字号 (pt)', type: 'number', default: '9', min: 6, max: 20 },
  hfColor: { id: 'hfColor', label: '文字颜色', type: 'color', default: '#64748b' },
  batesPrefix: { id: 'batesPrefix', label: '编号前缀', type: 'text', default: 'KT', placeholder: '如 ABC' },
  batesStart: { id: 'batesStart', label: '起始编号', type: 'number', default: '1', min: 0, max: 999999 },
  batesDigits: { id: 'batesDigits', label: '编号位数', type: 'number', default: '6', min: 2, max: 10 },
  batesSize: { id: 'batesSize', label: '字号 (pt)', type: 'number', default: '9', min: 6, max: 20 },
  redactRects: {
    id: 'redactRects', label: '遮盖区域', type: 'text', default: '', placeholder: '如 1:40,60,300,80；2:120,500,200,50',
    help: '格式：页码:x,y,宽,高（单位 pt，原点在页面左上角）；多个区域用分号分隔。只在视觉上遮盖，原文字仍存在于文件中。',
  },
  redactColor: { id: 'redactColor', label: '遮盖颜色', type: 'color', default: '#000000' },
  metaTitle: { id: 'metaTitle', label: '标题', type: 'text', default: '', placeholder: '留空则不修改' },
  metaAuthor: { id: 'metaAuthor', label: '作者', type: 'text', default: '' },
  metaSubject: { id: 'metaSubject', label: '主题', type: 'text', default: '' },
  metaKeywords: { id: 'metaKeywords', label: '关键词', type: 'text', default: '', placeholder: '用逗号分隔' },
  metaCreator: { id: 'metaCreator', label: '创建工具', type: 'text', default: '', placeholder: '如 空天文件转换' },
  textPdfSize: {
    id: 'textPdfSize', label: '正文字号 (pt)', type: 'select', default: '12',
    options: [['10', '10 pt（紧凑）'], ['11', '11 pt'], ['12', '12 pt（标准）'], ['14', '14 pt'], ['16', '16 pt（大字）']],
  },
  textPdfMargin: { id: 'textPdfMargin', label: '页边距 (mm)', type: 'number', default: '20', min: 10, max: 40 },
  csvDelimiter: {
    id: 'csvDelimiter', label: '输出分隔符', type: 'select', default: 'auto',
    help: '自动跟随目标格式：CSV 用逗号、TSV 用制表符。',
    options: [['auto', '自动（CSV 逗号 / TSV 制表符）'], [',', '逗号 ,'], ['\t', '制表符 Tab'], [';', '分号 ;'], ['|', '竖线 |']],
  },
  csvInputDelimiter: {
    id: 'csvInputDelimiter', label: '源分隔符', type: 'select', default: 'auto', whenSource: ['csv', 'tsv'],
    help: '自动时会根据首行在逗号、制表符、分号之间判断。',
    options: [['auto', '自动识别'], [',', '逗号 ,'], ['\t', '制表符 Tab'], [';', '分号 ;']],
  },
  csvEncoding: {
    id: 'csvEncoding', label: '源文件编码', type: 'select', default: 'utf-8', whenSource: ['csv', 'tsv', 'txt'],
    options: [['utf-8', 'UTF-8'], ['gbk', 'GBK / GB18030'], ['big5', 'Big5'], ['shift_jis', 'Shift-JIS'], ['windows-1252', 'Windows-1252']],
  },
  zipLevel: {
    id: 'zipLevel', label: 'ZIP 压缩级别', type: 'select', default: '6',
    help: '0 为仅打包不压缩（最快），9 体积最小但更慢。',
    options: [['0', '0 仅打包'], ['1', '1 快速'], ['6', '6 均衡'], ['9', '9 最小体积']],
  },
  subtitleEncoding: {
    id: 'subtitleEncoding', label: '字幕源编码', type: 'select', default: 'utf-8',
    help: '老字幕常见 GBK / Big5；选错会出现乱码。',
    options: [['utf-8', 'UTF-8'], ['gbk', 'GBK / GB18030'], ['big5', 'Big5'], ['windows-1252', 'Windows-1252']],
  },
};

const CATEGORIES = [
  {
    id: 'audio', label: '音频', color: '#8b5cf6', limitMB: 220,
    hint: '单线程 ffmpeg 解码/编码，适合音乐、语音与录音。',
    exts: ['mp3', 'wav', 'flac', 'ogg', 'oga', 'm4a', 'aac', 'opus', 'wma', 'aiff', 'aif', 'amr', 'm4b', 'ac3', 'mp2', 'mka', 'au', 'caf'],
    targets: [
      { id: 'mp3', label: 'MP3', params: ['bitrate', 'mp3Vbr', 'sampleRate', 'channels', 'metadata', 'start', 'end'], def: true },
      { id: 'wav', label: 'WAV', params: ['sampleRate', 'channels', 'wavDepth', 'metadata', 'start', 'end'] },
      { id: 'flac', label: 'FLAC', params: ['sampleRate', 'channels', 'metadata', 'start', 'end'] },
      { id: 'ogg', label: 'OGG (Vorbis)', params: ['vorbisQuality', 'sampleRate', 'channels', 'metadata', 'start', 'end'] },
      { id: 'm4a', label: 'M4A (AAC)', params: ['bitrate', 'sampleRate', 'channels', 'metadata', 'start', 'end'] },
      { id: 'aac', label: 'AAC', params: ['bitrate', 'sampleRate', 'channels', 'start', 'end'] },
      { id: 'aiff', label: 'AIFF', params: ['sampleRate', 'channels', 'wavDepth', 'metadata', 'start', 'end'], partial: true, note: 'PCM 无损，主要用于专业音频与 macOS 场景' },
      { id: 'ac3', label: 'AC-3', params: ['bitrate', 'sampleRate', 'channels', 'metadata', 'start', 'end'], partial: true, note: '影院/旧设备常用，兼容性不如 AAC' },
      { id: 'wma', label: 'WMA', params: ['bitrate', 'sampleRate', 'channels', 'metadata', 'start', 'end'], partial: true, note: 'Windows 旧设备常用，现代浏览器一般不能直接播放' },
      { id: 'mp2', label: 'MP2', params: ['bitrate', 'sampleRate', 'channels', 'start', 'end'], partial: true, note: '老式 MPEG 音频，适合旧播放设备' },
      { id: 'opus', label: 'OPUS', params: [], disabled: true, note: '单线程核心的 libopus 编码器会内存越界崩溃，已禁用；OPUS 仍可作为输入' },
    ],
    params: P,
  },
  {
    id: 'video', label: '视频', color: '#3b82f6', limitMB: 220,
    hint: 'H.264 / MPEG-4 / VP8 编码与容器转换；GIF 由调色板滤镜生成。',
    exts: ['mp4', 'm4v', 'webm', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'ts', 'mts', 'm2ts', 'mpeg', 'mpg', '3gp', 'vob', 'asf', 'f4v', 'ogv', 'gif'],
    targets: [
      { id: 'mp4', label: 'MP4 (H.264)', group: '视频', params: ['resolution', 'crop', 'fps', 'videoQuality', 'videoEncoder', 'pixelFormat', 'audioBitrate', 'metadata', 'start', 'end'], def: true },
      { id: 'webm', label: 'WEBM (VP8)', group: '视频', params: ['resolution', 'crop', 'fps', 'videoQuality', 'start', 'end'], partial: true, note: '单线程 VP8 编码，音轨为 Vorbis' },
      { id: 'mkv', label: 'MKV', group: '视频', params: ['resolution', 'crop', 'fps', 'videoQuality', 'videoEncoder', 'pixelFormat', 'audioBitrate', 'metadata', 'start', 'end'] },
      { id: 'mov', label: 'MOV', group: '视频', params: ['resolution', 'crop', 'fps', 'videoQuality', 'videoEncoder', 'pixelFormat', 'audioBitrate', 'metadata', 'start', 'end'] },
      { id: 'avi', label: 'AVI (MPEG-4)', group: '视频', params: ['resolution', 'crop', 'fps', 'videoQuality', 'audioBitrate', 'metadata', 'start', 'end'], partial: true, note: 'MPEG-4 Part 2 + MP3，兼容老设备' },
      { id: 'ts', label: 'TS 流', group: '视频', params: ['resolution', 'crop', 'fps', 'videoQuality', 'audioBitrate', 'metadata', 'start', 'end'], partial: true, note: 'MPEG-TS 容器，适合直播/播放器导入' },
      { id: 'flv', label: 'FLV', group: '视频', params: ['resolution', 'crop', 'fps', 'videoQuality', 'audioBitrate', 'start', 'end'], partial: true, note: 'H.264 + AAC，适合旧版网页播放器' },
      { id: 'wmv', label: 'WMV', group: '视频', params: ['resolution', 'crop', 'fps', 'videoQuality', 'audioBitrate', 'start', 'end'], partial: true, note: 'Windows Media 编码，现代浏览器不能直接播放' },
      { id: '3gp', label: '3GP', group: '视频', params: ['resolution', 'crop', 'fps', 'videoQuality', 'audioBitrate', 'start', 'end'], partial: true, note: '为旧式手机设计，建议分辨率不超过 480p' },
      { id: 'mpg', label: 'MPG (MPEG-1)', group: '视频', params: ['resolution', 'crop', 'fps', 'videoQuality', 'audioBitrate', 'start', 'end'], partial: true, note: 'MPEG-1 + MP2；仅标准帧率（24/25/30/50/60），其他帧率按 25 fps 输出' },
      { id: 'gif', label: 'GIF 动图', group: '视频', params: ['resolution', 'crop', 'fps', 'start', 'end'], partial: true, note: 'GIF 无音轨、体积大，适合短片段' },
      { id: 'mp3', label: 'MP3（仅音轨）', group: '提取音轨', params: ['bitrate', 'mp3Vbr', 'sampleRate', 'channels', 'start', 'end'] },
      { id: 'wav', label: 'WAV（仅音轨）', group: '提取音轨', params: ['sampleRate', 'channels', 'wavDepth', 'start', 'end'] },
      { id: 'm4a', label: 'M4A（仅音轨）', group: '提取音轨', params: ['bitrate', 'sampleRate', 'channels', 'start', 'end'] },
      { id: 'flac', label: 'FLAC（仅音轨）', group: '提取音轨', params: ['sampleRate', 'channels', 'start', 'end'] },
      { id: 'aiff', label: 'AIFF（仅音轨）', group: '提取音轨', params: ['sampleRate', 'channels', 'wavDepth', 'start', 'end'], partial: true, note: 'PCM 无损音轨' },
    ],
    params: P,
  },
  {
    id: 'image', label: '图片', color: '#22c55e', limitMB: 120,
    hint: 'Canvas 光栅化处理；SVG / GIF / ICO 可作为输入，GIF 输出首帧光栅图。',
    exts: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'bmp', 'gif', 'svg', 'ico'],
    targets: [
      { id: 'jpg', label: 'JPG', params: ['quality', 'compressStrategy', 'targetKB', 'width', 'height', 'background'] },
      { id: 'png', label: 'PNG', params: ['width', 'height'], note: '无损、保留透明，Canvas 编码不提供压缩级别' },
      { id: 'webp', label: 'WEBP', params: ['quality', 'compressStrategy', 'targetKB', 'width', 'height'] },
      ...(AVIF_ENCODE_SUPPORTED ? [{ id: 'avif', label: 'AVIF', params: ['quality', 'compressStrategy', 'targetKB', 'width', 'height'], partial: true }] : []),
      { id: 'bmp', label: 'BMP', params: ['width', 'height', 'background'] },
      { id: 'tiff', label: 'TIFF', params: ['width', 'height', 'background'], partial: true, note: '手写未压缩 RGB TIFF，体积较大；不支持 TIFF 输入' },
      { id: 'ico', label: 'ICO 图标', params: [], partial: true, note: '自动生成 16–256 px 多尺寸 PNG 图标' },
      { id: 'svg', label: 'SVG（位图包装）', params: ['width', 'height', 'background'], partial: true, note: '把位图嵌入 SVG 容器，不做矢量化' },
      { id: 'pdf', label: 'PDF（单图）', params: ['width', 'height', 'background', 'pdfPage', 'pdfOrientation', 'pdfMargin', 'pdfPerPage', 'imageQuality'] },
    ],
    params: P,
  },
  {
    id: 'document', label: '文档', color: '#f59e0b', limitMB: 120,
    hint: 'Markdown / HTML / 纯文本 / RTF / DOCX / EPUB / ODT 互转；写出保留段落与标题层级。',
    exts: ['txt', 'md', 'markdown', 'html', 'htm', 'docx', 'rtf', 'epub', 'odt'],
    targets: [
      { id: 'txt', label: '纯文本', params: [] },
      { id: 'md', label: 'Markdown', params: [] },
      { id: 'html', label: 'HTML', params: [] },
      { id: 'docx', label: 'DOCX', params: [], partial: true, note: '保留段落与标题层级，不保留复杂样式' },
      { id: 'rtf', label: 'RTF', params: [], partial: true },
      { id: 'epub', label: 'EPUB 电子书', params: [], partial: true, note: '生成单章、无封面的基础 EPUB 3，适合阅读器导入' },
      { id: 'odt', label: 'ODT', params: [], partial: true, note: '生成基础 OpenDocument 文本，保留段落与标题层级' },
      { id: 'pdf', label: 'PDF（文字排版）', group: 'PDF', params: ['textPdfSize', 'textPdfMargin'], partial: true, note: '按 A4 段落排版；文字栅格化后不可选中，但中文与符号不会缺字' },
    ],
    params: P,
  },
  {
    id: 'subtitle', label: '字幕', color: '#a855f7', limitMB: 20,
    hint: 'SRT / VTT / ASS(SSA) / 纯文本互转，保留时间轴与换行；不做语音识别。',
    exts: ['srt', 'vtt', 'ass', 'ssa'],
    targets: [
      { id: 'srt', label: 'SRT', params: ['subtitleEncoding'], def: true },
      { id: 'vtt', label: 'WebVTT', params: ['subtitleEncoding'] },
      { id: 'ass', label: 'ASS / SSA', params: ['subtitleEncoding'], partial: true, note: '保留时间轴与文字，样式标签会被精简' },
      { id: 'txt', label: '纯文本（去时间轴）', params: ['subtitleEncoding'] },
    ],
    params: P,
  },
  {
    id: 'pdf', label: 'PDF', color: '#ef4444', limitMB: 260,
    hint: '页面整理、拼版、水印页码、裁剪、元数据与格式转换；可视化页面管理在「PDF 工具箱」，合并操作在队列工具栏。',
    exts: ['pdf'],
    targets: [
      { id: 'txt', label: '文本 (.txt)', group: '格式转换', params: ['range'], def: true },
      { id: 'html', label: 'HTML 网页', group: '格式转换', params: ['range'], partial: true, note: '保留段落与换行，不还原原始版面' },
      { id: 'png', label: 'PNG 图片（逐页）', group: '格式转换', params: ['range', 'dpi'], partial: true, note: '多页会打包为 ZIP' },
      { id: 'jpg', label: 'JPG 图片（逐页）', group: '格式转换', params: ['range', 'dpi', 'quality'], partial: true, note: '多页会打包为 ZIP' },
      { id: 'webp', label: 'WEBP 图片（逐页）', group: '格式转换', params: ['range', 'dpi', 'quality'], partial: true, note: '多页会打包为 ZIP' },
      { id: 'bmp', label: 'BMP 图片（逐页）', group: '格式转换', params: ['range', 'dpi'], partial: true, note: '无损位图，体积较大；多页打包 ZIP' },
      { id: 'tiff', label: 'TIFF（多页）', group: '格式转换', params: ['range', 'dpi'], partial: true, note: '未压缩 RGB 多页 TIFF，适合归档与打印' },
      { id: 'cbz', label: 'CBZ 漫画包', group: '格式转换', params: ['range', 'dpi', 'quality'], partial: true, note: '逐页 JPG 打包为 ZIP，可直接改名 .cbz 供漫画阅读器使用' },
      { id: 'json', label: 'JSON（结构化）', group: '格式转换', params: ['range'], partial: true, note: '包含元数据、页面尺寸与文本；扫描件文本为空' },
      { id: 'split', label: '拆分 PDF', group: '页面整理', params: ['range'], partial: true, note: '留空则每页一个 PDF，结果打包为 ZIP' },
      { id: 'extract', label: '提取页面', group: '页面整理', params: ['range', 'extractMode'], partial: true, note: '按页码顺序提取到新 PDF，不改动原文件' },
      { id: 'delete', label: '删除页面', group: '页面整理', params: ['range'], partial: true, note: '删除指定页码后重建 PDF' },
      { id: 'rotate', label: '旋转 PDF', group: '页面整理', params: ['range', 'rotate'], partial: true, note: '只调整页面显示角度，不重新编码内容' },
      { id: 'nup', label: '多页拼版 (N-up)', group: '拼版排版', params: ['nupGrid', 'nupOrientation', 'nupMargin', 'nupGap'], partial: true, note: '把连续 2/4/6/9 页缩放到一张 A4 上，保留矢量内容' },
      { id: 'booklet', label: '小册子（骑马订）', group: '拼版排版', params: ['nupMargin'], partial: true, note: '自动补齐空白页并按双面打印顺序重排' },
      { id: 'pageSize', label: '统一页面尺寸', group: '拼版排版', params: ['pageSizeTarget', 'pageSizeOrientation'], partial: true, note: '按比例缩放内容到目标纸张，不是重排版' },
      { id: 'crop', label: '裁剪页面', group: '拼版排版', params: ['cropTop', 'cropRight', 'cropBottom', 'cropLeft'], partial: true, note: '调整裁剪框（CropBox），原内容仍保留在文件中' },
      { id: 'watermark', label: '添加水印', group: '内容叠加', params: ['wmText', 'wmSize', 'wmOpacity', 'wmRotation', 'wmColor', 'wmMode'], partial: true, note: '文字渲染为透明图片，支持中文' },
      { id: 'pagenum', label: '添加页码', group: '内容叠加', params: ['pnPosition', 'pnFormat', 'pnStart', 'pnSize', 'pnColor'] },
      { id: 'headerfooter', label: '页眉页脚', group: '内容叠加', params: ['hfHeader', 'hfFooter', 'hfSize', 'hfColor'] },
      { id: 'bates', label: 'Bates 编号', group: '内容叠加', params: ['batesPrefix', 'batesStart', 'batesDigits', 'batesSize'], partial: true, note: '法律/档案场景的连续编号' },
      { id: 'redact', label: '遮盖（涂黑）', group: '内容叠加', params: ['redactRects', 'redactColor'], partial: true, note: '视觉遮盖，原文字仍存在于文件内，敏感文件请改走安全流程' },
      { id: 'compress', label: '压缩 PDF', group: '优化与元数据', params: ['range', 'dpi', 'quality'], partial: true, note: '有损：页面栅格化为 JPEG 后重建 PDF，文字不可再选中' },
      { id: 'meta-edit', label: '编辑元数据', group: '优化与元数据', params: ['metaTitle', 'metaAuthor', 'metaSubject', 'metaKeywords', 'metaCreator'] },
      { id: 'meta-clear', label: '清除元数据', group: '优化与元数据', params: [] },
      { id: 'sanitize', label: '清理文档', group: '优化与元数据', params: [], partial: true, note: '清除元数据、注释与脚本动作；不保证完全匿名化' },
    ],
    params: P,
  },
  {
    id: 'sheet', label: '表格', color: '#06b6d4', limitMB: 120,
    hint: 'XLSX / XLS / XLSM / XLSB / ODS / CSV / TSV / JSON 互转；多工作表会打包为 ZIP。',
    exts: ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'csv', 'tsv', 'json'],
    targets: [
      { id: 'xlsx', label: 'XLSX', params: ['csvDelimiter'] },
      { id: 'csv', label: 'CSV', params: ['csvDelimiter', 'csvInputDelimiter', 'csvEncoding'] },
      { id: 'tsv', label: 'TSV', params: ['csvDelimiter', 'csvInputDelimiter', 'csvEncoding'] },
      { id: 'json', label: 'JSON', params: ['csvInputDelimiter', 'csvEncoding'] },
      { id: 'html', label: 'HTML 表格', params: ['csvInputDelimiter', 'csvEncoding'] },
    ],
    params: P,
  },
  {
    id: 'archive', label: '压缩包', color: '#94a3b8', limitMB: 300,
    hint: 'ZIP / TAR / GZIP 解压与重新打包；RAR、7z、加密 ZIP 浏览器无法解码。',
    exts: ['zip', 'tar', 'gz', 'tgz'],
    targets: [
      { id: 'extract', label: '解压（逐个输出）', params: [], partial: true, note: '仅支持 ZIP、TAR、GZIP；不支持加密 ZIP' },
      { id: 'zip', label: '重新打包为 ZIP', params: ['zipLevel'], partial: true, note: '可把 TAR / GZIP / ZIP 内的文件重新压成 ZIP' },
    ],
    params: P,
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const EXT_INDEX = new Map();
for (const c of CATEGORIES) for (const e of c.exts) EXT_INDEX.set(e, c.id);

export function categoryFromExt(ext) {
  return EXT_INDEX.get(ext) || null;
}

export function getCategory(id) {
  return CATEGORY_MAP[id] || null;
}

export function targetsOf(categoryId) {
  const c = getCategory(categoryId);
  return c ? c.targets : [];
}

export function targetOf(categoryId, targetId) {
  return targetsOf(categoryId).find((t) => t.id === targetId) || null;
}

export function defaultTarget(categoryId, ext) {
  const c = getCategory(categoryId);
  if (!c) return null;
  if (categoryId === 'document') {
    const map = { docx: 'txt', md: 'html', markdown: 'html', html: 'md', htm: 'md', txt: 'md', rtf: 'txt', epub: 'txt', odt: 'txt' };
    if (map[ext]) return map[ext];
  }
  if (categoryId === 'image') {
    if (ext === 'png' || ext === 'svg' || ext === 'ico') return 'jpg';
    return 'png';
  }
  if (categoryId === 'sheet') {
    const map = { xlsx: 'csv', xls: 'csv', xlsm: 'csv', xlsb: 'csv', ods: 'csv', csv: 'xlsx', tsv: 'csv', json: 'xlsx' };
    if (map[ext]) return map[ext];
  }
  if (categoryId === 'archive') {
    return ext === 'zip' ? 'extract' : 'extract';
  }
  const hasSame = c.targets.some((t) => t.id === ext && !t.disabled);
  const def = c.targets.find((t) => t.def && !t.disabled);
  if (def && def.id !== ext) return def.id;
  const other = c.targets.find((t) => t.id !== ext && t.id !== 'split' && !t.disabled);
  if (other) return other.id;
  return hasSame ? ext : c.targets[0].id;
}

export function paramDescriptors(categoryId, targetId, ext) {
  const cat = getCategory(categoryId);
  const target = targetOf(categoryId, targetId);
  if (!cat || !target) return [];
  return (target.params || [])
    .map((k) => cat.params[k])
    .filter(Boolean)
    .filter((d) => !d.whenSource || !ext || d.whenSource.includes(ext));
}

export function defaultParamsFor(categoryId, targetId, ext) {
  const out = {};
  for (const d of paramDescriptors(categoryId, targetId, ext)) out[d.id] = d.default;
  return out;
}

export function limitMB(categoryId) {
  const c = getCategory(categoryId);
  return c ? c.limitMB : 100;
}

/** 供「格式支持」面板与文档矩阵使用的说明 */
export const CAPABILITY_NOTES = [
  ['运行方式', '所有转换在浏览器本地完成，文件不会上传。音频/视频使用 ffmpeg.wasm 单线程核心（不依赖 SharedArrayBuffer），因此可以直接部署在 GitHub Pages。'],
  ['GitHub Pages', '静态托管无法自定义 COOP/COEP 响应头，多线程 WASM 方案不可用；本站默认单线程，首次需加载约 32 MB 的 ffmpeg 核心（浏览器会缓存）。'],
  ['音视频', '音频输出 MP3 / WAV / FLAC / OGG / M4A / AAC / AIFF / AC-3 / WMA / MP2，视频输出 MP4 / WEBM / MKV / MOV / AVI / TS / FLV / WMV / 3GP / MPG / GIF，并可提取音轨。编码器为 libx264、mpeg4、libvpx(VP8)、libmp3lame、AAC、Vorbis、FLAC、PCM。'],
  ['图片', 'PNG / JPG / WEBP / BMP / ICO / TIFF 输出由 Canvas 或手写编码器生成，SVG 输出是位图包装；AVIF 输出取决于浏览器编码能力（当前环境' + (AVIF_ENCODE_SUPPORTED ? '支持' : '不支持') + '）。SVG / GIF / ICO 可栅格化为位图，GIF 输入只取首帧。'],
  ['文档', 'DOCX 读取使用 mammoth（保留基础语义），写出为轻量 OOXML。EPUB / ODT 通过 ZIP + XML 解析与生成，保留段落与标题层级，不保留复杂版式。'],
  ['字幕', 'SRT / WebVTT / ASS(SSA) 在浏览器内解析与生成，保留时间轴、换行与基础样式标记；不提供语音识别自动生成字幕（需要语音模型，体积与算力都不适合纯前端）。'],
  ['PDF', '文本抽取与逐页渲染依赖 pdf.js；合并 / 拆分 / 旋转 / 图片转 PDF / 重压依赖 pdf-lib；重压为有损栅格化。加密 PDF 暂不支持。'],
  ['表格', 'SheetJS 处理 XLSX / XLS / XLSM / XLSB / ODS / CSV / TSV / JSON；CSV 支持输入自动识别分隔符与多种源编码，输出编码固定为 UTF-8。'],
  ['压缩包', 'ZIP / TAR / GZIP 解压，并可重新打包为指定压缩级别的 ZIP。RAR、7z 与加密 ZIP 需要额外的原生解码器，浏览器内无法可靠实现。'],
  ['暂不支持', 'OPUS 输出（单线程核心的 libopus 编码器会内存越界崩溃，已禁用；OPUS 仍可输入）、RAR / 7z 解压、加密 ZIP / PDF、PDF→DOCX、DOCX→PDF（中文字体与版式无法可靠还原）、HEIC / TIFF 输入（Chrome 无解码器）、GIF 动图输出（Canvas 无法编码）、OGV 输出（缺少 Theora 编码器）、语音识别生成字幕、多线程 WASM 加速。'],
];

export { CATEGORIES };
