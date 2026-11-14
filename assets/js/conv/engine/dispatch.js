/* 任务分发：根据类别与目标格式调用对应转换引擎 */
import { convertMedia } from './media.js';
import { convertImage } from './image.js';
import { convertDocument } from './documents.js';
import { imagesToPdf, mergePdfs, pdfToImages, pdfToText, splitPdf, rotatePdf, compressPdf } from './pdf.js';
import {
  batesPdf, bookletPdf, clearMetadataPdf, cropPdf, deletePdfPages, editMetadataPdf,
  extractPdfPages, headerFooterPdf, nupPdf, pageNumbersPdf, pdfToBmp, pdfToCbz, pdfToHtml, pdfToJson,
  pdfToTiff, redactPdf, resizePdf, sanitizePdf, textToPdf, watermarkPdf,
} from './pdf-tools.js';
import { convertSheet } from './sheets.js';
import { extractArchive, repackZip } from './archive.js';
import { convertSubtitle } from './subtitle.js';
import { fmtSize } from './utils.js';
import { getCategory, limitMB } from './registry.js';

export async function runJob(job, hooks = {}) {
  const cat = getCategory(job.category);
  if (!cat) throw new Error('未识别的文件类别');
  const limit = limitMB(job.category) * 1024 * 1024;
  if (job.file.size > limit) {
    throw new Error(`文件 ${fmtSize(job.file.size)} 超过 ${limitMB(job.category)} MB 上限，请先压缩或分割后再试`);
  }
  if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');

  switch (job.category) {
    case 'audio':
    case 'video':
      return convertMedia(job, hooks);
    case 'image':
      if (job.target === 'pdf') return imagesToPdf([job.file], job.params, hooks);
      return convertImage(job.file, job.target, job.params, hooks);
    case 'document':
      if (job.target === 'pdf') {
        const txt = await convertDocument(job.file, 'txt', job.params, hooks);
        const ext = (job.ext || '').toLowerCase();
        return textToPdf(txt[0].blob, job.params, hooks, job.file.name, ext);
      }
      return convertDocument(job.file, job.target, job.params, hooks);
    case 'subtitle':
      return convertSubtitle(job.file, job.target, job.params, hooks);
    case 'pdf':
      switch (job.target) {
        case 'txt': return pdfToText(job.file, job.params, hooks);
        case 'html': return pdfToHtml(job.file, job.params, hooks);
        case 'png':
        case 'jpg':
        case 'webp': return pdfToImages(job.file, job.target, job.params, hooks);
        case 'bmp': return pdfToBmp(job.file, job.params, hooks);
        case 'tiff': return pdfToTiff(job.file, job.params, hooks);
        case 'cbz': return pdfToCbz(job.file, job.params, hooks);
        case 'json': return pdfToJson(job.file, job.params, hooks);
        case 'split': return splitPdf(job.file, job.params, hooks);
        case 'extract': return extractPdfPages(job.file, job.params, hooks);
        case 'delete': return deletePdfPages(job.file, job.params, hooks);
        case 'rotate': return rotatePdf(job.file, job.params, hooks);
        case 'nup': return nupPdf(job.file, job.params, hooks);
        case 'booklet': return bookletPdf(job.file, job.params, hooks);
        case 'pageSize': return resizePdf(job.file, job.params, hooks);
        case 'crop': return cropPdf(job.file, job.params, hooks);
        case 'watermark': return watermarkPdf(job.file, job.params, hooks);
        case 'pagenum': return pageNumbersPdf(job.file, job.params, hooks);
        case 'headerfooter': return headerFooterPdf(job.file, job.params, hooks);
        case 'bates': return batesPdf(job.file, job.params, hooks);
        case 'redact': return redactPdf(job.file, job.params, hooks);
        case 'compress': return compressPdf(job.file, job.params, hooks);
        case 'meta-edit': return editMetadataPdf(job.file, job.params, hooks);
        case 'meta-clear': return clearMetadataPdf(job.file, job.params, hooks);
        case 'sanitize': return sanitizePdf(job.file, job.params, hooks);
        default: throw new Error('不支持的 PDF 输出格式');
      }
    case 'sheet':
      return convertSheet(job.file, job.target, job.params, hooks);
    case 'archive':
      if (job.target === 'zip') return repackZip(job.file, job.params, hooks);
      return extractArchive(job.file, job.params, hooks);
    default:
      throw new Error('不支持的类别');
  }
}

export { mergePdfs, imagesToPdf };
