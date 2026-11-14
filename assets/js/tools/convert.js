/* 文件转换类工具：直接调用内置转换引擎，功能以独立工具项形式呈现 */
import { mountConvert } from '../conv/panel.js';

const HINT = {
  video: '支持 mp4/mkv/mov/avi/webm 等，转码由本地 WebAssembly 完成，不上传文件',
  audio: '支持 mp3/wav/flac/aac/ogg/m4a 等，可设置码率、采样率与声道',
  image: '支持 jpg/png/webp/avif/bmp/tiff/ico 等，可调质量与尺寸',
  document: '支持 docx/md/html/txt 等互转，保留基本结构',
  sheet: '支持 xlsx/xls/csv/tsv/json 互转',
  subtitle: '支持 srt/vtt/ass/ssa/lrc 等字幕格式互转',
  pdf: 'PDF 转图片、文本、HTML，也可压缩、拆分、旋转、加水印',
  archive: '支持 zip/rar/7z/tar/gz 解包，可重新打包为 zip',
};

const out = {};

out['convert-all'] = (root, ctx) => {
  mountConvert(root, ctx, {
    auto: true,
    sub: '拖入任意支持的文件，自动识别类别并转为该类别默认输出格式',
    tip: '图片、文档、表格、字幕、压缩包为即时转换；音视频首次转码需加载引擎',
  });
};

function bind(catId, tip) {
  return (root, ctx) => {
    mountConvert(root, ctx, { catId, sub: HINT[catId], tip: tip || '' });
  };
}

out['convert-video'] = bind('video', '首次转码会加载解码引擎（约 31 MB，仅加载一次）');
out['convert-audio'] = bind('audio', '首次转码会加载解码引擎（约 31 MB，仅加载一次）');
out['convert-image'] = bind('image', '全部在浏览器画布内完成，不上传');
out['convert-doc'] = bind('document', '文档解析在本地完成，不上传');
out['convert-sheet'] = bind('sheet', '表格解析在本地完成，不上传');
out['convert-subtitle'] = bind('subtitle', '自动识别编码，避免中文乱码');
out['convert-pdf'] = bind('pdf', '支持逐页拆分为图片、导出文本、压缩与页面整理');
out['convert-archive'] = bind('archive', '解包后可逐个下载，或导出为 zip');

export default out;
