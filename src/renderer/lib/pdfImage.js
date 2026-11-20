// PDF（TikZ の図を LuaLaTeX で組んだもの・PDF の画像）の 1 ページ目を、プレビュー用の画像にする（pdf.js）
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const SCALE = 3; // 画面で拡大しても粗くならないよう、3 倍の大きさで描く

/**
 * @param {Uint8Array|string} data PDF のバイト列、または base64
 * @returns {Promise<{url:string, widthPt:number, heightPt:number}>}
 */
export async function pdfToImage(data) {
  const bytes = typeof data === 'string' ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0)) : data;
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, background: 'rgba(0,0,0,0)' }).promise;
    return { url: canvas.toDataURL('image/png'), widthPt: base.width, heightPt: base.height };
  } finally {
    doc.destroy();
  }
}

/** data:application/pdf;base64,… を画像にする */
export async function pdfDataUrlToImage(dataUrl) {
  return pdfToImage(dataUrl.slice(dataUrl.indexOf(',') + 1));
}
