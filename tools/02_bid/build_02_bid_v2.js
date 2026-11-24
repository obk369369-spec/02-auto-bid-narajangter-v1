// 02 입찰 도구 v3 빌드: vendor(xlsx·WIC core·pdf.js·tesseract) + v2/(engine·pricing·ops·ui2·ui·body) → 02_bid.html + 02_bid_ocr_assets.js
// 실행: node build_02_bid_v2.js   (저장소 단독 빌드 가능 — 이전본 파일 불필요)
const fs = require('fs'), path = require('path');
const D = __dirname, V = path.join(D, '..', '..', 'vendor');
const rd = p => fs.readFileSync(path.join(D, p), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const CMAP_KEEP = /^(Adobe-Korea1-|KSC|UniKS-UCS2|UniKS-UTF16)/;
function parts() {
  const xlsxSrc = fs.readFileSync(path.join(V, 'xlsx.inline.min.js'), 'utf8'), coreSrc = fs.readFileSync(path.join(V, 'wic_core.js'), 'utf8');
  const cm = {}; fs.readdirSync(path.join(V, 'pdfjs', 'cmaps')).filter(n => CMAP_KEEP.test(n)).forEach(n => { cm[n.replace(/\.bcmap$/, '')] = fs.readFileSync(path.join(V, 'pdfjs', 'cmaps', n)).toString('base64'); });
  return {
    prefix: '<script>/* inline: vendor/xlsx.full.min.js */\n' + xlsxSrc + '\n</script>\n<script>/* inline: common/wic_core (+data) */\n' + coreSrc + '\n</script>\n',
    pdfjs: fs.readFileSync(path.join(V, 'pdfjs', 'pdf.min.js'), 'utf8'),
    workerB64: fs.readFileSync(path.join(V, 'pdfjs', 'pdf.worker.min.js')).toString('base64'),
    cmaps: cm, glue: rd('v2/pdfjs_glue.js'), body: rd('v2/body.html'), engine: rd('v2/engine.js'), ui: rd('v2/ui.js'),
    tess: fs.readFileSync(path.join(V, 'tesseract', 'tesseract.min.js'), 'utf8'), ocrGlue: rd('v2/ocr_glue.js'),
    pricing: rd('v2/pricing.js'), strategy: rd('v2/strategy.js'), ui3: rd('v2/ui3.js'), scen: JSON.stringify(require(path.join(D, 'qa', fs.existsSync(path.join(D, 'qa/scenarios_private.js')) ? 'scenarios_private.js' : 'scenarios_public.js'))).replace(/</g, '\\u003c'), fx: rd('v2/fx.js'), ai: rd('v2/ai.js'), ui4: rd('v2/ui4.js'), ops: rd('v2/ops.js'), instCore: rd('v2/institution_core.js'), ui2: rd('v2/ui2.js'), kisti: fs.existsSync(path.join(D, 'v2/kisti_private.js')) ? rd('v2/kisti_private.js') : ''
  };
}
/* OCR 자료(작업자·코어·한국어/영어 데이터) — 02_bid.html 과 같은 폴더의 02_bid_ocr_assets.js (처음 OCR 이 필요할 때만 불러온다) */
function buildOcrAssets() {
  const T = path.join(V, 'tesseract'), b = f => fs.readFileSync(path.join(T, f)).toString('base64');
  return 'window.__OCR=' + JSON.stringify({worker: b('worker.min.js'), core: b('tesseract-core-simd-lstm.wasm.js'), kor: b('kor.traineddata.gz'), eng: b('eng.traineddata.gz')}) + ';';
}
function buildSingle() {
  const p = parts();
  return '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n<title>02 입찰 도구 (단일 HTML)</title>\n' + p.prefix +
    '<script>/* pdf.js 3.11.174 (Apache-2.0) */\n' + safe(p.pdfjs) + '\n</script>\n<script>window.__PDF_WORKER_B64="' + p.workerB64 + '";window.__PDF_CMAPS=' + JSON.stringify(p.cmaps) + ';</script>\n<script>/* pdf glue */\n' + safe(p.glue) + '\n</script>\n<script>/* tesseract.js 5.1.1 (Apache-2.0) */\n' + safe(p.tess) + '\n</script>\n<script>/* ocr glue */\n' + safe(p.ocrGlue) + '\n</script>\n' +
    p.body + '\n<script>/* 02 bid engine */\n' + safe(p.engine) + '\n</script>\n<script>/* pricing */\n' + safe(p.pricing) + '\n</script>\n<script>/* strategy */\n' + safe(p.strategy) + '\n</script>\n<script>/* fx */\n' + safe(p.fx) + '\n</script>\n<script>/* ai */\n' + safe(p.ai) + '\n</script>\n' + (p.kisti ? '<script>/* 비공개 본: KISTI 이력 */\n' + safe(p.kisti) + '\n</script>\n' : '') + '<script>/* ops */\n' + safe(p.ops) + '\n</script>\n<script>window.__INST_CORE_SRC=' + JSON.stringify(p.instCore).replace(/</g, '\\u003c') + ';</script>\n<script>/* institution core (원격 저장소 원본) */\n' + safe(p.instCore) + '\n</script>\n<script>/* ui2 */\n' + safe(p.ui2) + '\n</script>\n<script>/* scenarios */\nwindow.BIDSC=' + p.scen + ';</script>\n<script>/* ui3 */\n' + safe(p.ui3) + '\n</script>\n<script>/* ui4 */\n' + safe(p.ui4) + '\n</script>\n<script>/* 02 bid ui */\n' + safe(p.ui) + '\n</script></body></html>\n';
}
module.exports = {parts, buildSingle, buildOcrAssets, CMAP_KEEP};
if (require.main === module) {
  const html = buildSingle(); fs.writeFileSync(path.join(D, '02_bid.html'), html);
  const oa = buildOcrAssets(); fs.writeFileSync(path.join(D, '02_bid_ocr_assets.js'), oa);
  console.log('02_bid.html 생성', (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB · 02_bid_ocr_assets.js', (Buffer.byteLength(oa) / 1048576).toFixed(1) + ' MB');
}
