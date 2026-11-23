// 02 입찰 도구 → 크롬/엣지 확장 프로그램(Manifest V3) 빌드
// 실행: node build_extension.js [--test]   (--test: 로컬 시험용 호스트(127.0.0.1)를 content_scripts 에 추가한 chrome_extension_test/ 생성)
// 결과: chrome_extension/ (압축 해제된 확장 · 개발자 모드 "압축해제된 확장 프로그램 로드"로 설치) + chrome_extension.zip 은 만들지 않는다(삭제·외부 반출 없음)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const B = require('./build_02_bid_v2.js');
const D = __dirname, TEST = process.argv.includes('--test'); const OUT = path.join(D, TEST ? 'chrome_extension_test' : 'chrome_extension');
const W = (rel, data) => { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, data); };
const P = B.parts();
/* 이전본에서 xlsx 와 WIC core 인라인 블록을 각각 파일로 분리 (확장 페이지는 인라인 스크립트 금지) */
const xlsxJs = fs.readFileSync(path.join(D, '..', '..', 'vendor', 'xlsx.inline.min.js'), 'utf8'); const coreJs = fs.readFileSync(path.join(D, '..', '..', 'vendor', 'wic_core.js'), 'utf8');
W('lib/xlsx.full.min.js', xlsxJs); W('lib/wic_core.js', coreJs);
W('lib/pdf.min.js', P.pdfjs); W('lib/pdf.worker.min.js', fs.readFileSync(path.join(D, '..', '..', 'vendor', 'pdfjs', 'pdf.worker.min.js')));
W('lib/cmaps.js', 'window.__PDF_CMAPS=' + JSON.stringify(P.cmaps) + ';');
W('lib/pdf_init.js', "window.__PDF_WORKER_URL = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('lib/pdf.worker.min.js') : undefined;");
W('lib/pdfjs_glue.js', P.glue); W('engine.js', P.engine); W('ui.js', P.ui);
/* OCR: 확장 안의 파일을 직접 가리킨다 (blob 불필요) */
const TV = path.join(D, '..', '..', 'vendor', 'tesseract');
['tesseract.min.js', 'worker.min.js', 'tesseract-core-simd-lstm.wasm.js', 'kor.traineddata.gz', 'eng.traineddata.gz'].forEach(f => W('lib/ocr/' + f, fs.readFileSync(path.join(TV, f))));
W('lib/ocr_init.js', "window.__OCR_URLS = {worker: chrome.runtime.getURL('lib/ocr/worker.min.js'), core: chrome.runtime.getURL('lib/ocr/tesseract-core-simd-lstm.wasm.js'), lang: chrome.runtime.getURL('lib/ocr')};");
W('lib/ocr_glue.js', P.ocrGlue);
W('pricing.js', P.pricing); W('ops.js', P.ops); W('ui2.js', P.ui2); W('lib/institution_core.js', P.instCore);
/* 대용량 XLSX 작업자: 확장 페이지에서는 blob 작업자가 막히므로 확장 안의 파일로 둔다 */
W('lib/inst_worker.js', xlsxJs + '\n' + P.instCore + "\nself.onmessage=event=>{try{const workbook=XLSX.read(event.data,{type:'array',dense:true,cellStyles:false,cellNF:false,cellHTML:false});const sheet=workbook.Sheets[workbook.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});const result=WICInstitutionAccumulator.accumulateInstitutions(rows);self.postMessage({ok:true,result});}catch(error){self.postMessage({ok:false,error:String(error&&error.message||error)});}};");
W('lib/inst_init.js', "window.__INST_WORKER_URL = chrome.runtime.getURL('lib/inst_worker.js'); window.__INST_CORE_SRC = '';");
/* 앱 페이지: 본문 HTML 을 그대로 쓰되 <script src> 로 분리 */
const scripts = ['lib/xlsx.full.min.js', 'lib/wic_core.js', 'lib/pdf.min.js', 'lib/cmaps.js', 'lib/pdf_init.js', 'lib/pdfjs_glue.js', 'lib/ocr/tesseract.min.js', 'lib/ocr_init.js', 'lib/ocr_glue.js', 'engine.js', 'pricing.js', 'ops.js', 'lib/institution_core.js', 'lib/inst_init.js', 'ui2.js', 'ui.js'];
W('app.html', '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n<title>02 입찰 도구</title>\n' + P.body + '\n' + scripts.map(s => `<script src="${s}"></script>`).join('\n') + '\n</body></html>\n');
/* 확장 전용 스크립트 */
W('sw.js', fs.readFileSync(path.join(D, 'ext', 'sw.js'), 'utf8')); W('content.js', fs.readFileSync(path.join(D, 'ext', 'content.js'), 'utf8'));
/* 아이콘 (순수 Node PNG: 파란 둥근 배경 + 흰 막대 3개 = 투찰 그래프) */
function crc32(buf) { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function png(size) {
  const px = Buffer.alloc(size * size * 4); const set = (x, y, r, g, b, a) => { const i = (y * size + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };
  const rad = size * 0.2; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const dx = Math.max(rad - x, 0, x - (size - 1 - rad)), dy = Math.max(rad - y, 0, y - (size - 1 - rad)); if (dx * dx + dy * dy <= rad * rad) set(x, y, 37, 99, 235, 255); else set(x, y, 0, 0, 0, 0); }
  const bars = [[0.22, 0.45], [0.42, 0.62], [0.62, 0.78]]; bars.forEach(([x0, h]) => { const bx = Math.round(size * x0), bw = Math.round(size * 0.16), bh = Math.round(size * h * 0.8); for (let y = size - Math.round(size * 0.2) - bh; y < size - Math.round(size * 0.2); y++) for (let x = bx; x < bx + bw; x++) set(x, y, 255, 255, 255, 255); });
  const raw = Buffer.alloc((size * 4 + 1) * size); for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
[16, 32, 48, 128].forEach(s => W(`icons/icon${s}.png`, png(s)));
const HOSTS = ['*://*.g2b.go.kr/*', '*://*.kisti.re.kr/*', '*://*.d2b.go.kr/*'];
const manifest = {
  manifest_version: 3, name: '02 입찰 도구 (나라장터 공고 분석)', version: '1.0.0', description: '나라장터·연구기관 입찰공고 화면에서 기초금액·낙찰하한율 등을 자동으로 읽고 하한가·권장 투찰가·마진을 계산합니다. 모든 계산은 이 PC 안에서만 이뤄집니다(외부 전송 없음).',
  icons: {16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png'},
  action: {default_title: '02 입찰 도구 — 이 화면의 공고 분석', default_icon: {16: 'icons/icon16.png', 32: 'icons/icon32.png'}},
  background: {service_worker: 'sw.js'}, permissions: ['storage', 'activeTab', 'scripting'], host_permissions: HOSTS,
  content_scripts: [{matches: HOSTS.concat(TEST ? ['http://127.0.0.1/*'] : []), js: ['engine.js', 'content.js'], all_frames: true, run_at: 'document_idle'}],
  content_security_policy: {extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"},
  web_accessible_resources: []
};
W('manifest.json', JSON.stringify(manifest, null, 2));
W('README.txt', '02 입찰 도구 — 크롬/엣지 확장 프로그램\n설치: 크롬 주소창에 chrome://extensions → 우측 위 "개발자 모드" 켜기 → "압축해제된 확장 프로그램을 로드합니다" → 이 폴더 선택.\n사용: 나라장터(g2b.go.kr)·KISTI(kisti.re.kr)·국방전자조달(d2b.go.kr) 공고 화면을 열면 오른쪽 아래에 분석 패널이 뜹니다. 다른 사이트는 도구 모음의 확장 아이콘을 누르면 그 화면을 분석합니다.\n"도구에서 열기"를 누르면 전체 화면 도구(app.html)가 열리며 읽은 값이 자동 입력됩니다. 데이터는 이 PC 밖으로 나가지 않습니다.\n');
console.log((TEST ? '시험용 ' : '') + '확장 프로그램 생성:', OUT, '/ 파일', fs.readdirSync(OUT, {recursive: true}).length);
