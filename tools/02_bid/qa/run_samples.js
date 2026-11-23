/* 02_bid.html 실전 샘플 자동 드롭 테스트 (헤드리스 Edge · file:/// 실제 열기)
   실행: node qa/run_samples.js [--dump] [--only 부분문자열] [--html 경로] [--out 보고서경로]
   - test_samples/ 아래 모든 파일을 하나씩 #docInput 에 넣어(드롭과 동일 처리 경로) 자동 입력 결과를 qa/expected.json 과 대조
   - --dump: 읽은 글자 전문을 qa/out/<샘플>.txt 로 저장(정답표 작성·파서 디버깅용) */
'use strict';
const fs = require('fs'), path = require('path'), {launch} = require('./cdp.js');
const ROOT = path.join(__dirname, '..'), SAMPLES = path.join(ROOT, 'test_samples'), OUT = path.join(__dirname, 'out');
const args = process.argv.slice(2), has = a => args.includes(a), val = a => { const i = args.indexOf(a); return i >= 0 ? args[i + 1] : null; };
const HTML = val('--html') || path.join(ROOT, '02_bid.html'); const REPORT = val('--out') || path.join(__dirname, 'last_report.json');
const FIELDS = ['title', 'no', 'org', 'due', 'open', 'start', 'supply', 'vatamt', 'total', 'qty', 'base', 'basis', 'floor', 'range', 'rlo', 'rhi', 'method', 'bond', 'tax', 'vat'];
const CFIELDS = ['list', 'cur', 'fx'];
const SKIP = /(_source_map\.json|\.bak|\.url|\.md|\.gitkeep)$/i;
function walk(d, acc = []) { for (const f of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, f.name); f.isDirectory() ? walk(p, acc) : (!SKIP.test(f.name) && acc.push(p)); } return acc; }
const rel = p => path.relative(SAMPLES, p).replace(/\\/g, '/');
const OCR = has('--ocr'); const EXPF = val('--expected') || (OCR ? 'expected_ocr.json' : 'expected.json');
function loadExpected() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, EXPF), 'utf8')); } catch (e) { return {}; } }
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

function judge(key, got, exp) {
  const fails = [];
  if (!exp) return {verdict: 'UNJUDGED', fails: ['정답표(expected.json)에 없는 샘플']};
  if (exp.status === 'hold') { if (got.status === 'err' && new RegExp(exp.holdMsg || 'OCR|읽지 못|지원하지|직접 읽지').test(got.msg)) return {verdict: 'HOLD_OK', fails: []}; return {verdict: 'FAIL', fails: ['HOLD 기대인데 결과: ' + got.status + ' ' + got.msg]}; }
  if (got.status !== 'ok') return {verdict: 'FAIL', fails: ['읽기 실패: ' + got.msg]};
  for (const [k, v] of Object.entries(exp.expect || {})) { const a = norm(got.fields[k]); const ok = (v && v.startsWith && v.startsWith('~')) ? a.includes(v.slice(1)) : a === norm(v); if (!ok) fails.push(`${k}: 기대 "${norm(v)}" / 실제 "${a}"`); }
  for (const k of exp.forbid || []) if (norm(got.fields[k])) fails.push(`${k}: 비어 있어야 하는데 "${norm(got.fields[k])}"`);
  for (const k of exp.docs || []) if (!(got.docs || []).includes(k)) fails.push(`서류 ${k} 미탐지`);
  if (exp.itemsN !== undefined && got.itemsN !== exp.itemsN) fails.push(`품목 건수: 기대 ${exp.itemsN} / 실제 ${got.itemsN}`);
  if (exp.itemsQty !== undefined && got.itemsQty !== exp.itemsQty) fails.push(`품목 수량합: 기대 ${exp.itemsQty} / 실제 ${got.itemsQty}`);
  if (exp.listAdded !== undefined && got.listAdded !== exp.listAdded) fails.push(`목록 누적: 기대 ${exp.listAdded} / 실제 ${got.listAdded}`);
  (exp.textHas || []).forEach((t, i) => { if (!(got.textHasRes || [])[i]) fails.push(`읽은 글자에 "${t}" 없음`); });
  if (exp.ocr && !/OCR/.test(got.msg)) fails.push('OCR 로 읽었다는 표시가 없음');
  if (exp.minLen && got.textLen < exp.minLen) fails.push(`읽은 글자 수 ${got.textLen} < ${exp.minLen}`);
  /* OCR 스냅샷: 사람이 원본과 대조하지 않은 OCR 추출값 전체가 그대로인지(드리프트·새 오탐 감시). 검증된 expect 가 없으면 SNAP_OK 로 따로 센다 */
  let snap = false;
  if (exp.snapshot) { snap = true; const DEFN = {basis: 'asis', vat: '10', cur: 'KRW'}; const cur = {}; Object.entries(got.fields).forEach(([k, v]) => { if (v && DEFN[k] !== v) cur[k] = norm(v); }); const keys = new Set([...Object.keys(cur), ...Object.keys(exp.snapshot)]); keys.forEach(k => { if ((cur[k] || '') !== norm(exp.snapshot[k] || '')) fails.push(`스냅샷 변화 ${k}: 기준 "${norm(exp.snapshot[k] || '')}" / 지금 "${cur[k] || ''}"`); }); }
  const verified = exp.expect && Object.keys(exp.expect).length > 0;
  return {verdict: fails.length ? 'FAIL' : (snap && !verified ? 'SNAP_OK' : 'PASS'), fails};
}

(async () => {
  const only = val('--only'); let files = walk(SAMPLES).sort(); if (only) files = files.filter(f => rel(f).includes(only));
  if (has('--dump')) fs.mkdirSync(OUT, {recursive: true});
  const exp = loadExpected(); const {page, close, edge} = await launch(); const results = []; const t0 = Date.now();
  const url = 'file:///' + HTML.replace(/\\/g, '/').replace(/^\/+/, '');
  try {
    for (const f of files) {
      const key = rel(f); const t1 = Date.now(); let got; const th = (exp[key] && exp[key].textHas) || [];
      try {
        await page.goto('about:blank'); await page.goto(url); await page.eval("localStorage.clear(); localStorage.setItem('wic02_ocr', '" + (OCR ? 'on' : 'off') + "'); indexedDB.databases().then(ds=>ds.forEach(d=>indexedDB.deleteDatabase(d.name))); 1"); await page.sleep(150); await page.goto(url);
        await page.setFiles('#docInput', [f]);
        const done = await page.eval(`new Promise(r=>{const t0=Date.now();const iv=setInterval(()=>{const rows=[...document.querySelectorAll('#fileList .file')];if(rows.length&&rows.every(x=>x.classList.contains('ok')||x.classList.contains('err'))){clearInterval(iv);r(true)}else if(Date.now()-t0>${OCR ? 900000 : 110000}){clearInterval(iv);r(false)}},150)})`);
        got = await page.eval(`(()=>{const S=window.__BID,row=document.querySelector('#fileList .file');const f={};${JSON.stringify(FIELDS)}.forEach(k=>{const e=document.getElementById('n_'+k);f[k]=e?e.value:''});${JSON.stringify(CFIELDS)}.forEach(k=>f[k]=document.getElementById('c_'+k).value);
          const d=S.docs[0];return {status:row&&row.classList.contains('ok')?'ok':'err',msg:row?row.innerText.replace(/\\s+/g,' ').trim():'(행 없음)',fields:f,ex:Object.fromEntries(Object.entries(S.ex).map(([k,v])=>[k,{v:v.value,c:v.conf,e:v.evidence}])),docs:Object.keys(S.docHits),textLen:d?d.text.length:0,text:${has('--dump') ? 'd?d.text:""' : '""'},listAdded:S.items.length,itemsN:(S.docItems||[]).length,textHasRes:${JSON.stringify(th)}.map(t=>!!(S.docs[0]&&S.docs[0].text.replace(/\\s+/g,'').includes(t.replace(/\\s+/g,'')))),itemsQty:(S.docItems||[]).reduce((s,i)=>s+i.qty,0)}})()`);
        if (!done) got.msg += ' (시간 초과)';
      } catch (e) { got = {status: 'err', msg: '러너 오류: ' + e.message, fields: {}, ex: {}, docs: [], textLen: 0}; }
      if (has('--dump') && got.text) fs.writeFileSync(path.join(OUT, key.replace(/[\\/]/g, '__') + '.txt'), got.text);
      delete got.text; const j = judge(key, got, exp[key]);
      results.push({key, ms: Date.now() - t1, ...j, status: got.status, msg: got.msg.slice(0, 200), fields: got.fields, ex: got.ex, docs: got.docs, textLen: got.textLen, listAdded: got.listAdded, textHasRes: got.textHasRes, itemsN: got.itemsN, itemsQty: got.itemsQty});
      const r = results[results.length - 1]; if (!has('--quiet')) console.log(`${r.verdict.padEnd(9)} ${String(r.ms).padStart(5)}ms ${key.slice(0, 70)}${r.fails.length ? '\n          ↳ ' + r.fails.join('\n          ↳ ') : ''}`);
    }
  } finally { await close(); }
  const cnt = results.reduce((a, r) => (a[r.verdict] = (a[r.verdict] || 0) + 1, a), {});
  const summary = {time: new Date().toISOString(), edge, html: HTML, total: results.length, counts: cnt, seconds: Math.round((Date.now() - t0) / 1000), pass100: results.length > 0 && !results.some(r => ['FAIL', 'UNJUDGED'].includes(r.verdict))};
  fs.writeFileSync(REPORT, JSON.stringify({summary, results}, null, 1));
  console.log('\n요약', JSON.stringify(summary)); process.exit(summary.pass100 ? 0 : 1);
})().catch(e => { console.error('치명적 오류', e); process.exit(2); });
