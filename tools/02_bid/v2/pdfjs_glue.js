/* pdf.js(Apache-2.0, 3.11.174 공식 패키지 · sha512 무결성 확인) 연결부 — 오프라인. 텍스트 계층이 있는 PDF 의 글자를 읽는다.
   필요 전역: pdfjsLib(pdf.min.js) · __PDF_WORKER_B64 또는 __PDF_WORKER_URL · __PDF_CMAPS(한글 CMap, base64) */
(function (g) {
  'use strict';
  const b64 = s => { const a = atob(s), u = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) u[i] = a.charCodeAt(i); return u; };
  let ready = false;
  function init() {
    if (ready) return; const lib = g.pdfjsLib; if (!lib) throw new Error('pdf.js 가 로드되지 않았습니다');
    if (!lib.GlobalWorkerOptions.workerSrc) {
      if (g.__PDF_WORKER_URL) lib.GlobalWorkerOptions.workerSrc = g.__PDF_WORKER_URL;
      else if (g.__PDF_WORKER_B64) lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([b64(g.__PDF_WORKER_B64)], {type: 'text/javascript'}));
      else throw new Error('pdf.js 작업자(worker)가 없습니다');
    }
    ready = true;
  }
  class EmbCMapFactory {
    constructor() {}
    async fetch({name}) { const d = g.__PDF_CMAPS && g.__PDF_CMAPS[name]; if (!d) throw new Error('cmap 없음: ' + name); return {cMapData: b64(d), compressed: true}; }
  }
  /* 한 페이지의 글자 조각을 (1) 문서 내 기록 순서 (2) 화면 위치(행) 순서 두 가지로 이어 붙인다 — 2단 편집 문서 대비 */
  function pageTexts(items) {
    let stream = '', prev = null;
    items.forEach(it => {
      if (!('str' in it)) return; const y = it.transform[5], x = it.transform[4];
      if (prev) { if (Math.abs(y - prev.y) > Math.max(2, (it.height || 8) * 0.5) && !prev.eol) stream += '\n'; else if (!prev.eol && x - prev.xe > 1.2) stream += ' '; }
      stream += it.str; if (it.hasEOL) stream += '\n'; prev = {y, xe: x + (it.width || 0), eol: it.hasEOL};
    });
    const rows = []; items.forEach(it => { if (!('str' in it) || !it.str.trim()) return; const y = it.transform[5]; let r = rows.find(r => Math.abs(r.y - y) <= 3); if (!r) { r = {y, a: []}; rows.push(r); } r.a.push({x: it.transform[4], w: it.width || 0, s: it.str}); });
    rows.sort((p, q) => q.y - p.y);
    const visual = rows.map(r => { r.a.sort((p, q) => p.x - q.x); let s = '', xe = null; r.a.forEach(c => { if (xe !== null) s += (c.x - xe > 6) ? '   ' : (c.x - xe > 1 ? ' ' : ''); s += c.s; xe = c.x + c.w; }); return s; }).join('\n');
    return {stream, visual};
  }
  g.__WIC_CMAP_FACTORY = EmbCMapFactory;
  g.WICPDF = async function (buf, file, forceOcr) {
    init(); const keep = buf.slice(0); /* pdf.js 가 읽으면서 버퍼를 넘겨(detached) 버리므로, OCR 용 사본을 먼저 보관 */
    if (forceOcr && g.WICOCR && g.WICOCR.enabled()) { if (file) file.__ocr = true; return g.WICOCR.pdfPages(keep); }
    const task = g.pdfjsLib.getDocument({data: new Uint8Array(buf), CMapReaderFactory: EmbCMapFactory, cMapPacked: true, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0});
    const doc = await task.promise; let S = '', V = '';
    for (let p = 1; p <= doc.numPages; p++) { const page = await doc.getPage(p); const tc = await page.getTextContent({normalizeWhitespace: false}); const t = pageTexts(tc.items); S += t.stream + '\n\n'; V += t.visual + '\n\n'; page.cleanup(); }
    await doc.destroy();
    if ((S + V).replace(/\s/g, '').length < 40) { if (g.WICOCR && g.WICOCR.enabled()) { if (file) file.__ocr = true; return g.WICOCR.pdfPages(keep); } throw new Error('PDF 에 글자가 없습니다(스캔·이미지 PDF) — 글자 인식(OCR)이 꺼져 있어 읽지 못합니다. OCR 을 켜거나, 내용을 복사해 붙여넣어 주세요'); }
    return S + '\n\n' + V;
  };
})(typeof window !== 'undefined' ? window : globalThis);
