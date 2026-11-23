/* 오프라인 글자 인식(OCR) 연결부 — tesseract.js 5.1.1(Apache-2.0) + 한국어/영어 LSTM 데이터. 네트워크 사용 없음.
   · 단일 HTML: 02_bid_ocr_assets.js (같은 폴더, base64) 를 처음 필요할 때 불러와 blob 작업자로 구동
   · 확장 프로그램: __OCR_URLS 로 확장 안의 파일을 직접 지정
   정확도 한계: 스캔 품질에 따라 오인식 가능 → OCR 로 읽은 값은 항상 "낮음 · 확인 필요"로 표시한다. */
(function (g) {
  'use strict';
  const u8 = b => { const a = atob(b), u = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) u[i] = a.charCodeAt(i); return u; };
  let wp = null;
  function enabled() {
    try { const v = localStorage.getItem('wic02_ocr'); if (v === 'off') return false; if (v === 'on') return !!g.Tesseract; } catch (e) {}
    const cb = typeof document !== 'undefined' && document.getElementById('ocrOn'); if (cb && !cb.checked) return false;
    return !!g.Tesseract;
  }
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('글자 인식(OCR) 자료 파일을 찾지 못했습니다: ' + src + ' — 02_bid.html 과 같은 폴더에 있어야 합니다')); document.head.appendChild(s); }); }
  async function worker() {
    if (wp) return wp;
    wp = (async () => {
      if (!g.Tesseract) throw new Error('OCR 라이브러리가 로드되지 않았습니다');
      let opts;
      if (g.__OCR_URLS) { const U = g.__OCR_URLS; opts = {workerPath: U.worker, corePath: U.core, langPath: U.lang, cacheMethod: 'none', gzip: true, workerBlobURL: false}; }
      else {
        if (!g.__OCR) await loadScript(g.__OCR_ASSET_SRC || '02_bid_ocr_assets.js');
        const A = g.__OCR; if (!A) throw new Error('OCR 자료가 비어 있습니다');
        const blob = (b, t) => URL.createObjectURL(new Blob([b], {type: t || 'text/javascript'}));
        const main = blob(u8(A.worker)), core = blob(u8(A.core)) + '#core.js';
        /* 작업자가 언어 데이터를 fetch 로 요청하면 내장 데이터를 돌려주도록 감싼다(네트워크 접근 없음) */
        const wrapper = 'const B=s=>{const a=atob(s),u=new Uint8Array(a.length);for(let i=0;i<a.length;i++)u[i]=a.charCodeAt(i);return u};const L={kor:"' + A.kor + '",eng:"' + A.eng + '"};const of=self.fetch.bind(self);self.fetch=(u,o)=>{const s=String(u);for(const k in L){if(s.indexOf("/"+k+".traineddata")>=0)return Promise.resolve(new Response(B(L[k]),{status:200}))}return of(u,o)};importScripts("' + main + '");';
        opts = {workerPath: blob(wrapper), corePath: core, langPath: 'https://offline.invalid', cacheMethod: 'none', gzip: true, workerBlobURL: false};
      }
      return g.Tesseract.createWorker('kor+eng', 1, Object.assign(opts, {logger: () => {}}));
    })();
    wp.catch(() => { wp = null; }); return wp;
  }
  async function recognize(src) { const w = await worker(); const r = await w.recognize(src); return r.data.text || ''; }
  /* PDF 를 쪽별 그림으로 그려 인식 (pdf.js 사용) — 최대 maxPages 쪽 */
  async function pdfPages(buf, maxPages) {
    const lib = g.pdfjsLib; if (!lib) throw new Error('pdf.js 가 없습니다');
    const doc = await lib.getDocument({data: new Uint8Array(buf.slice ? buf.slice(0) : buf), CMapReaderFactory: g.__WIC_CMAP_FACTORY, cMapPacked: true, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0}).promise;
    let out = ''; const n = Math.min(doc.numPages, maxPages || 30);
    for (let p = 1; p <= n; p++) {
      const page = await doc.getPage(p); const vp0 = page.getViewport({scale: 1}); const scale = Math.min(3, Math.max(1.6, 2000 / Math.max(vp0.width, vp0.height) * 1.0));
      const vp = page.getViewport({scale}); const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height); const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({canvasContext: ctx, viewport: vp}).promise; out += (await recognize(cv)) + '\n\n'; page.cleanup(); cv.width = cv.height = 0;
    }
    await doc.destroy(); return out;
  }
  g.WICOCR = {enabled, image: file => recognize(file), pdfPages, ready: () => worker().then(() => true)};
})(typeof window !== 'undefined' ? window : globalThis);
