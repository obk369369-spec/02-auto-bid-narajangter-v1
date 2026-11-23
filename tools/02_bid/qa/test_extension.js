/* 확장 프로그램 E2E 시험 (헤드리스 Edge 에 시험용 확장 로드)
   1) 공고 화면(로컬 서버)을 열면 오른쪽 아래 분석 패널이 뜨고 기초금액·낙찰하한율·하한가가 맞는가
   2) iframe 안의 공고도 상위 화면 패널로 전달되는가
   3) [도구에서 열기] → 확장 app.html 이 열리고 값이 자동 입력되는가 (CSP 오류·콘솔 예외 0)
   4) 확장 app.html 에서 실제 공고 PDF 를 올려도 pdf.js 가 동작하는가
   실행: node qa/test_extension.js   (먼저 node build_extension.js --test) */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), {launch, sleep} = require('./cdp.js');
const ROOT = path.join(__dirname, '..'), EXT = path.join(ROOT, 'chrome_extension_test');
const dump = fs.readFileSync(path.join(__dirname, 'out', 'recent__공고문2026-049호.pdf.txt'), 'utf8').split('\n\n=====')[0];
const body = dump.split(/\n{2,}/).filter(s => s.trim()).map(p => `<p>${p.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]))}</p>`).join('\n');
const PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>공고 상세 (시험)</title></head><body><h1>입찰공고 상세</h1>${body}</body></html>`;
const WRAP = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>목록(시험)</title></head><body><h1>입찰공고 목록</h1><iframe src="/notice" style="width:800px;height:500px"></iframe></body></html>';
const srv = http.createServer((q, s) => { s.setHeader('content-type', 'text/html; charset=utf-8'); s.end(q.url.startsWith('/wrap') ? WRAP : q.url.startsWith('/empty') ? '<html><body><p>관련 없는 화면입니다</p></body></html>' : PAGE); });
let pass = 0, fail = 0; const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' | ' + info : '')); };
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  const L = await launch({args: ['--load-extension=' + EXT, '--disable-extensions-except=' + EXT]}); const {page, send} = L;
  try {
    const panelText = () => page.eval(`(()=>{const h=document.getElementById('wic02-panel-host');return h&&h.shadowRoot?h.shadowRoot.textContent.replace(/\\s+/g,' '):''})()`);
    const waitPanel = async (ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const x = await panelText(); if (x) return x; await sleep(300); } return ''; };
    /* 1) 직접 화면 */
    await page.goto(`http://127.0.0.1:${port}/notice`); let tx = await waitPanel();
    t('패널 표시', !!tx, tx.slice(0, 40)); t('기초금액 14,700,000원', tx.includes('14,700,000원')); t('낙찰하한율 90%', tx.includes('90%')); t('예가범위 ±3%', tx.includes('±3%'));
    t('공고번호 2026-049', tx.includes('2026-049')); t('낙찰하한가 계산 13,230,000원', tx.includes('13,230,000원'), (tx.match(/낙찰하한가[^가-힣]*[0-9,]+원/) || [''])[0]); t('권장 A안 표시', /A.{0,12}표준/.test(tx));
    t('면세/과세 = 과세', tx.includes('과세'));
    /* 2) iframe 전달 */
    await page.goto(`http://127.0.0.1:${port}/wrap`); tx = await waitPanel(); t('iframe 공고도 패널에 표시', tx.includes('14,700,000원'), tx.slice(0, 50));
    /* 3) 관련 없는 화면: 패널 없음 */
    await page.goto(`http://127.0.0.1:${port}/empty`); await sleep(2500); t('관련 없는 화면에는 패널이 뜨지 않음', !(await panelText()));
    /* 4) 도구에서 열기 */
    await page.goto(`http://127.0.0.1:${port}/notice`); await waitPanel();
    await page.eval(`document.getElementById('wic02-panel-host').shadowRoot.getElementById('open').click(); 1`); await sleep(2500);
    const {targetInfos} = await send('Target.getTargets'); const app = targetInfos.find(x => x.type === 'page' && x.url.includes('/app.html'));
    t('app.html 탭이 열림', !!app, app ? app.url.slice(0, 60) : JSON.stringify(targetInfos.map(x => x.url)));
    if (app) {
      const {sessionId} = await send('Target.attachToTarget', {targetId: app.targetId, flatten: true}); const S = (m, p) => send(m, p, sessionId);
      await S('Runtime.enable'); const errs = []; const ev = async (expr) => { const r = await S('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
      await sleep(2500);
      const f = await ev(`Object.fromEntries(['title','no','org','due','open','base','floor','range','method','tax'].map(k=>[k,document.getElementById('n_'+k).value]))`);
      t('앱에 기초금액 자동 입력', f.base === '14700000', JSON.stringify(f).slice(0, 140)); t('앱에 낙찰하한율·범위', f.floor === '90' && f.range === '3'); t('앱에 마감일시', f.due.includes('2026. 11. 26') && f.due.includes('10:00'));
      t('앱 pdf.js 로드', await ev('typeof window.pdfjsLib === "object" && typeof window.WICPDF === "function"')); t('앱 확장 CSP: 인라인 스크립트 없음', !(await ev(`[...document.scripts].some(s=>!s.src)`)));
      /* 5) 앱에서 실제 PDF 올리기 (워커가 확장 URL 로 동작하는지) */
      await S('DOM.enable'); const {root} = await S('DOM.getDocument', {depth: 0}); const {nodeId} = await S('DOM.querySelector', {nodeId: root.nodeId, selector: '#docInput'});
      await ev(`document.getElementById('nClear').click(); 1`); await S('DOM.setFileInputFiles', {files: [path.join(ROOT, 'test_samples', 'recent', '공고문2026-049호.pdf')], nodeId});
      const ok = await ev(`new Promise(r=>{const t0=Date.now();const iv=setInterval(()=>{const row=document.querySelector('#fileList .file');if(row&&(row.classList.contains('ok')||row.classList.contains('err'))){clearInterval(iv);r(row.className+'|'+document.getElementById('n_base').value+'|'+document.getElementById('n_floor').value)}else if(Date.now()-t0>60000){clearInterval(iv);r('timeout')}},200)})`);
      t('앱에서 PDF 드롭 → 자동 입력 (확장 환경)', ok === 'file ok|14700000|90', ok);
    }
    /* 6) 확장 환경에서 이미지 OCR (wasm CSP · 확장 안 파일로 작업자·언어데이터 로드) */
    if (app) {
      const {sessionId} = await send('Target.attachToTarget', {targetId: app.targetId, flatten: true}); const S = (m, p) => send(m, p, sessionId);
      await S('Runtime.enable'); await S('DOM.enable'); const {root} = await S('DOM.getDocument', {depth: 0}); const {nodeId} = await S('DOM.querySelector', {nodeId: root.nodeId, selector: '#docInput'});
      const img = fs.readdirSync(path.join(ROOT, 'test_samples', 'zip')).find(f => f.startsWith('016_'));
      await S('Runtime.evaluate', {expression: "document.getElementById('fileList').innerHTML=''; 1"});
      await S('DOM.setFileInputFiles', {files: [path.join(ROOT, 'test_samples', 'zip', img)], nodeId});
      const waitExpr = "new Promise(r=>{const t0=Date.now();const iv=setInterval(()=>{const row=document.querySelector('#fileList .file');if(row&&(row.classList.contains('ok')||row.classList.contains('err'))){clearInterval(iv);r(row.className+'|'+row.innerText.replace(/\\s+/g,' ').slice(0,120)+'|'+(window.__BID.docs[0]?window.__BID.docs[0].text.length:0))}else if(Date.now()-t0>120000){clearInterval(iv);r('timeout')}},300)})";
      const r = await S('Runtime.evaluate', {awaitPromise: true, returnByValue: true, expression: waitExpr});
      const v = String(r.result.value); t('확장 환경 이미지 OCR 동작', /^file ok\|.*OCR/.test(v) && Number(v.split('|').pop()) > 300, v.slice(0, 110));
    }
    t('페이지 콘솔 예외 0', page.consoleErrors.filter(e => !/favicon/.test(e)).length === 0, page.consoleErrors.slice(0, 2).join(' / '));
  } finally { await L.close(); srv.close(); }
  console.log(`\n결과 PASS ${pass} / FAIL ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('치명적 오류', e); process.exit(2); });
