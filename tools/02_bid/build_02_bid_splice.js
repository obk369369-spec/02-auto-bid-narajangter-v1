// 02 입찰 도구 v3.2 "이어붙이기 빌드" — 이 PC 의 vendor/ 에 xlsx.inline.min.js · wic_core.js · tesseract 코어가 없어 build_02_bid_v2.js 가 단독 실행되지 않을 때 사용한다.
// 기존 02_bid.html 에서 vendor 가 인라인된 앞부분(xlsx · WIC core · pdf.js · tesseract · glue)을 그대로 보존하고, 본문(body.html)과 v2/ 의 스크립트(engine·pricing·strategy·ops·ui2·ui3·ui)만 새로 이어 붙인다.
// 실행: node build_02_bid_splice.js [--public]
//   기본: 02_bid.html 갱신(비공개 본: v2/kisti_private.js 포함)
//   --public: kisti_private.js 를 넣지 않은 비식별 공개본을 public_out/02_bid.html 에 생성
// 안전장치: 앞부분(보존 구간)의 SHA-256 을 출력하고, 결과 HTML 에서 각 스크립트 마커가 정확히 1번씩 나오는지 확인한다.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const D = __dirname, PUB = process.argv.includes('--public');
const rd = p => fs.readFileSync(path.join(D, p), 'utf8'); const safe = s => s.replace(/<\/script/gi, '<\\/script');
const srcPath = process.env.SPLICE_IN ? path.resolve(process.env.SPLICE_IN) : path.join(D, '02_bid.html'); const old = fs.readFileSync(srcPath, 'utf8');
const A = '<script>/* ocr glue */'; const ia = old.indexOf(A); if (ia < 0) throw new Error('ocr glue 마커 없음');
const rx = /<\/script>\r?\n/g; rx.lastIndex = ia; const mm = rx.exec(old); if (!mm) throw new Error('ocr glue 끝 태그를 찾지 못함'); const ib = mm.index + mm[0].length; /* 본문이 시작되는 위치(CRLF 허용) */
if (ib < 1000000) throw new Error('보존 앞부분이 비정상적으로 짧음(' + ib + ') — 중단');
const head = old.slice(0, ib);
const scFile = path.join(D, 'qa', (!PUB && fs.existsSync(path.join(D, 'qa/scenarios_private.js'))) ? 'scenarios_private.js' : 'scenarios_public.js'); const scJson = JSON.stringify(require(scFile)).replace(/</g, '\\u003c');
if (PUB && /"real":true/.test(scJson)) throw new Error('공개본 시나리오에 실제 사례(real:true)가 섞임');
const kisti = !PUB && fs.existsSync(path.join(D, 'v2/kisti_private.js')) ? rd('v2/kisti_private.js') : '';
const tail = rd('v2/body.html') + '\n<script>/* 02 bid engine */\n' + safe(rd('v2/engine.js')) + '\n</script>\n<script>/* pricing */\n' + safe(rd('v2/pricing.js')) + '\n</script>\n<script>/* strategy */\n' + safe(rd('v2/strategy.js')) + '\n</script>\n<script>/* fx */\n' + safe(rd('v2/fx.js')) + '\n</script>\n<script>/* ai */\n' + safe(rd('v2/ai.js')) + '\n</script>\n' +
  (kisti ? '<script>/* 비공개 본: KISTI 이력 */\n' + safe(kisti) + '\n</script>\n' : '') + '<script>/* ops */\n' + safe(rd('v2/ops.js')) + '\n</script>\n<script>window.__INST_CORE_SRC=' + JSON.stringify(rd('v2/institution_core.js')).replace(/</g, '\\u003c') + ';</script>\n<script>/* institution core (원격 저장소 원본) */\n' + safe(rd('v2/institution_core.js')) + '\n</script>\n<script>/* ui2 */\n' + safe(rd('v2/ui2.js')) + '\n</script>\n<script>/* scenarios */\nwindow.BIDSC=' + scJson + ';</script>\n<script>/* ui3 */\n' + safe(rd('v2/ui3.js')) + '\n</script>\n<script>/* ui4 */\n' + safe(rd('v2/ui4.js')) + '\n</script>\n<script>/* 02 bid ui */\n' + safe(rd('v2/ui.js')) + '\n</script></body></html>\n';
const html = head + tail;
for (const m of ['/* 02 bid engine */', '/* pricing */', '/* strategy */', '/* fx */', '/* ai */', '/* ops */', '/* ui2 */', '/* scenarios */', '/* ui3 */', '/* ui4 */', '/* 02 bid ui */']) { const n = html.split('<script>' + m).length - 1; if (n !== 1) throw new Error('마커 ' + m + ' 이 ' + n + '번 나옴'); }
if (PUB && /<script>\/\* 비공개 본: KISTI|const OPENINGS\s*=/.test(html)) throw new Error('공개본에 비공개 KISTI 이력이 섞임');
const out = process.env.SPLICE_OUT ? path.resolve(process.env.SPLICE_OUT) : path.join(PUB ? path.join(D, 'public_out') : D, '02_bid.html'); fs.mkdirSync(path.dirname(out), {recursive: true});
const bak = path.join(D, '02_bid_이전본_전략전.html'); if (!PUB && !process.env.SPLICE_OUT && !fs.existsSync(bak)) fs.copyFileSync(out, bak); /* 최초 1회만 백업(덮어쓰기 금지) */
fs.writeFileSync(out, html);
console.log((PUB ? '[공개본] ' : '[비공개 본] ') + out, (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB · 보존 앞부분 sha256 ' + crypto.createHash('sha256').update(head).digest('hex').slice(0, 16));
