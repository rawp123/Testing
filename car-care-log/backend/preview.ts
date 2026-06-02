import fs from 'node:fs';
import type { AttachmentPreview } from '../shared/types';

export const ATTACHMENT_PREVIEW_MAX_BYTES = 8 * 1024 * 1024;

export function buildLocalPreview(filePath: string, mimeType: string, attachmentId: string): AttachmentPreview {
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  if (!isImage && !isPdf) {
    return { attachmentId, mimeType, dataUrl: '', previewKind: 'unsupported' };
  }

  const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  if (!stats?.isFile()) {
    return { attachmentId, mimeType, dataUrl: '', previewKind: 'unsupported' };
  }
  if (stats.size > ATTACHMENT_PREVIEW_MAX_BYTES) {
    return { attachmentId, mimeType, dataUrl: '', previewKind: 'too_large' };
  }

  return {
    attachmentId,
    mimeType,
    dataUrl: `data:${mimeType};base64,${fs.readFileSync(filePath).toString('base64')}`,
    previewKind: isPdf ? 'pdf' : 'image'
  };
}
