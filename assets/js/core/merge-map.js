/* 空天工具合集 · 工具合并关系表（无副作用，可被 node 校验脚本直接引入）
   MERGED：主工具 id -> { note, sections: [{ label, cat, id }] }
   ALIAS ：被合并工具 id -> { target, tab }，用于旧链接兼容 */

export const MERGED = {
  'convert-pdf': {
    note: '已合并 PDF 合并拆分、PDF 信息、文本提取、PDF 转图片、水印页码、手写签名 6 个重复工具',
    sections: [
      { label: '转换引擎', cat: 'convert', id: 'convert-pdf' },
      { label: '合并拆分', cat: 'pdf', id: 'pdf-merge' },
      { label: '页面信息', cat: 'pdf', id: 'pdf-info' },
      { label: '文本提取', cat: 'pdf', id: 'pdf-text' },
      { label: 'PDF 转图片', cat: 'image', id: 'pdf-image' },
      { label: '水印页码', cat: 'pdf', id: 'pdf-watermark' },
      { label: '手写签名', cat: 'pdf', id: 'pdf-sign' }
    ]
  },
  'convert-image': {
    note: '已合并 缩放与格式转换、图片转 PDF 2 个重复工具',
    sections: [
      { label: '格式转换', cat: 'convert', id: 'convert-image' },
      { label: '缩放与重采样', cat: 'image', id: 'image-resize' },
      { label: '多图合成 PDF', cat: 'image', id: 'image-pdf' }
    ]
  },
  'convert-audio': {
    note: '已合并 音频转换（视频转音频 / 导出 WAV）工具',
    sections: [
      { label: '引擎转码', cat: 'convert', id: 'convert-audio' },
      { label: '视频转音频', cat: 'audio', id: 'audio-convert' }
    ]
  },
  'convert-sheet': {
    note: '已合并 Excel 转换、CSV 与 JSON、表格格式转换 3 个重复工具',
    sections: [
      { label: '引擎转换', cat: 'convert', id: 'convert-sheet' },
      { label: 'Excel 与 CSV', cat: 'encoding', id: 'excel-convert' },
      { label: 'CSV 与 JSON', cat: 'encoding', id: 'csv-json' },
      { label: '含 Markdown 表格', cat: 'data', id: 'table-convert' }
    ]
  },
  'convert-archive': {
    note: '已合并 ZIP 压缩解压工具',
    sections: [
      { label: '引擎解包', cat: 'convert', id: 'convert-archive' },
      { label: '打包与提取', cat: 'file', id: 'zip-tool' }
    ]
  },
  'convert-doc': {
    note: '已合并 Markdown 转换工具',
    sections: [
      { label: '文档互转', cat: 'convert', id: 'convert-doc' },
      { label: 'Markdown 转换', cat: 'dev', id: 'markdown-convert' }
    ]
  },
  base64: {
    note: '已合并 图片 Base64、PDF Base64 2 个重复工具',
    sections: [
      { label: '通用编解码', cat: 'encoding', id: 'base64' },
      { label: '图片 Base64', cat: 'image', id: 'image-base64' },
      { label: 'PDF Base64', cat: 'pdf', id: 'pdf-base64' }
    ]
  },
  'clipboard-pro': {
    note: '已合并 剪贴板工具',
    sections: [
      { label: '剪贴板工作台', cat: 'input', id: 'clipboard-pro' },
      { label: '简易读写', cat: 'security', id: 'clipboard-tool' }
    ]
  },
  'subtitle-tools': {
    note: '已合并 字幕转换（引擎）工具',
    sections: [
      { label: '字幕工作台', cat: 'mediapro', id: 'subtitle-tools' },
      { label: '引擎转换', cat: 'convert', id: 'convert-subtitle' }
    ]
  },
  'scan-ocr': {
    note: '已合并 图片 OCR 工具',
    sections: [
      { label: '批量扫描识别', cat: 'print', id: 'scan-ocr' },
      { label: '单图 OCR', cat: 'image', id: 'image-ocr' }
    ]
  },
  'ascii-art': {
    note: '已合并 图片转 ASCII 工具',
    sections: [
      { label: '艺术字与字符画', cat: 'fun', id: 'ascii-art' },
      { label: '像素画模式', cat: 'image', id: 'image-ascii' }
    ]
  },
  'json-mock': {
    note: '已合并 假数据 JSON 工具',
    sections: [
      { label: '模板生成', cat: 'dev', id: 'json-mock' },
      { label: '常见业务假数据', cat: 'random', id: 'fake-json' }
    ]
  },
  'sleep-pro': {
    note: '已合并 睡眠计算工具',
    sections: [
      { label: '睡眠与作息', cat: 'wellness', id: 'sleep-pro' },
      { label: '睡眠周期速算', cat: 'time', id: 'sleep-calc' }
    ]
  },
  'qr-gen': {
    note: '已合并 批量二维码工具',
    sections: [
      { label: '单个生成', cat: 'qr', id: 'qr-gen' },
      { label: '批量生成', cat: 'qr', id: 'qr-batch' }
    ]
  }
};

export const ALIAS = (() => {
  const map = {};
  for (const [target, spec] of Object.entries(MERGED)) {
    for (const s of spec.sections) {
      if (s.id !== target) map[s.id] = { target, tab: s.label };
    }
  }
  return map;
})();
