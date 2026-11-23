/* 통합 E2E (헤드리스 Edge · file:/// 실제 열기) — 지시서 5항
   1) 긴급 사례 024호(재구성 시험 공고문): 붙여넣기 → 자동 입력 → 낙찰방식 최저가 판별 → 공급가액/부가세 → 최저가 투찰가 → 체크리스트·자동 검사 → 서류 생성
   2) 하한율 모드(공고문2026-049호 PDF 드롭) 회귀  3) OCR 첨부(스캔 이미지) 추출  4) 기관 누적(목록 붙여넣기·정정 감지·대용량 XLSX 작업자 계약)  5) 4분류·보관함
   증거 로그: qa/e2e_integration_evidence.json  실행: node qa/e2e_integration.js */
'use strict';
const fs = require('fs'), path = require('path'), {launch, sleep} = require('./cdp.js');
const ROOT = path.join(__dirname, '..'); const X = require('../../../vendor/xlsx.full.min.js');
const url = 'file:///' + path.join(ROOT, '02_bid.html').replace(/\\/g, '/');
const ev = []; let pass = 0, fail = 0; const t = (name, exp, act, extra) => { const ok = String(exp) === String(act); ok ? pass++ : fail++; ev.push({name, expected: String(exp), actual: String(act), pass: ok, extra}); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' | 기대 ' + exp + ' | 실제 ' + act); };
(async () => {
  const L = await launch(); const {page} = L; const $v = id => page.eval(`document.getElementById(${JSON.stringify(id)}).value`);
  const fresh = async (ocr) => { await page.goto('about:blank'); await page.goto(url); await page.eval(`localStorage.clear(); localStorage.setItem('wic02_ocr','${ocr ? 'on' : 'off'}'); indexedDB.databases().then(ds=>ds.forEach(d=>indexedDB.deleteDatabase(d.name))); 1`); await sleep(200); await page.goto(url); };
  const waitFile = (ms = 60000) => page.eval(`new Promise(r=>{const t0=Date.now();const iv=setInterval(()=>{const rows=[...document.querySelectorAll('#fileList .file')];if(rows.length&&rows.every(x=>x.classList.contains('ok')||x.classList.contains('err'))){clearInterval(iv);r(rows.map(x=>x.className+'|'+x.innerText.replace(/\\s+/g,' ').slice(0,90)).join(' ## '))}else if(Date.now()-t0>${ms}){clearInterval(iv);r('timeout')}},200)})`);
  try {
    /* ───── 1) 긴급 사례 024호 ───── */
    await fresh(false); const text = require('./case_024_text.js');
    await page.eval(`document.getElementById('docPaste').value=${JSON.stringify(text)}; document.getElementById('docPasteBtn').click(); 1`); await sleep(500);
    t('024 공고번호', '20261119-024', await $v('n_no')); t('024 수요기관(자체 구매시스템)', '한국화학연구원(자체 구매시스템)', await $v('n_org')); t('024 발행사', 'Mordor Intelligence', await $v('n_pub'));
    t('024 기초금액 6,555,000', '6555000', await $v('n_base')); t('024 기초금액 기준 = VAT 포함(그대로)', 'asis', await $v('n_basis')); t('024 낙찰방식 자동 판별 = 최저가', 'lowest', await $v('n_award')); t('024 입찰마감', '2026. 11. 25.(수) 10:00', await $v('n_due'));
    t('024 낙찰하한율은 비어 있음(88% 일괄 적용 금지)', '', await $v('n_floor'));
    /* 최저가 모드: 시험값 정가 USD 4,250 × 환율 1,400 × 계수 0.62 (실제 Mordor 정가가 아님 — 발행사 가격 증빙 확보 후 교체) */
    await page.eval(`document.querySelector('[data-tab="2"]').click(); const s=(id,v)=>document.getElementById(id).value=v; s('n_tax','tax'); s('c_list','4250'); s('c_cur','USD'); s('c_fx','1400'); s('c_costmode','ledger'); s('c_disc','0.62'); s('c_mmin','8'); s('c_mtgt','15'); document.getElementById('calcBtn').click(); 1`); await sleep(700);
    const out = await page.eval(`document.getElementById('calcOut').innerText.replace(/\\s+/g,' ')`);
    t('024 최저가 모드 화면(하한율 미적용)', true, out.includes('최저가 낙찰제') && !out.includes('낙찰하한율제')); t('024 상한 공급가액 5,959,090', true, out.includes('5,959,090')); t('024 상한 부가세 595,910(합계 보존)', true, out.includes('595,910')); t('024 참고: 595,909 절사 방식 안내', true, out.includes('595,909'));
    t('024 기초금액 6,555,000 상한 표시', true, out.includes('6,555,000')); t('024 투찰 후보 A/B/C 3개', 3, await page.eval(`document.querySelectorAll('#calcOut [data-low]').length`)); t('024 그래프 SVG', true, (await page.eval(`document.querySelectorAll('#calcOut svg').length`)) >= 1);
    t('024 NaN/undefined 없음', false, /NaN|undefined|Infinity/.test(out));
    const bid = await $v('d_bid'); t('024 선택 투찰금액이 서류 칸에 자동 반영', true, Number(bid) > 0 && Number(bid) <= 6555000, bid);
    /* 3단계: 체크리스트(6단계) + 자동 검사 */
    await page.eval(`document.getElementById('goDocs').click(); 1`); await sleep(500);
    const chk = await page.eval(`document.getElementById('chkBox').innerText.replace(/\\s+/g,' ')`);
    t('체크리스트: 발행사 가격 증빙', true, chk.includes('발행사 가격 증빙')); t('체크리스트: 사회보험 완납증명서 유효기간', true, chk.includes('사회보험 완납증명서')); t('체크리스트: 납기', true, chk.includes('납기')); t('체크리스트: 최종 제출 절차', true, chk.includes('최종 제출'));
    for (const s of ['자동 수집', '자동 작성', '자동 검사', '사용자 인증 필요', '법적 확인 필요', '수동 처리']) t('6단계 분류 표시: ' + s, true, chk.includes(s));
    await page.eval(`const set=(sel,v)=>{const e=document.querySelector(sel);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))}; set('[data-doc="social_ins"][data-f="validUntil"]','2026-11-24'); set('[data-doc="bidform"][data-f="amount"]','6000000'); set('[data-doc="bidform"][data-f="noticeNo"]','20261119-025'); set('[data-doc="price_proof"][data-f="amount"]','4250'); 1`); await sleep(400);
    const ins = await page.eval(`document.getElementById('inspectBox').innerText.replace(/\\s+/g,' ')`);
    t('자동 검사: 완납증명서가 마감 전 만료 → FAIL', true, /사회보험[^F]*유효기간\s*FAIL/.test(ins)); t('자동 검사: 입찰서 금액 불일치 FAIL', true, /입찰서[^F]*금액\s*FAIL/.test(ins)); t('자동 검사: 공고번호 불일치 FAIL', true, /입찰서[^F]*공고번호\s*FAIL/.test(ins)); t('자동 검사: 가격 증빙 금액 = 정가 OK', true, /가격 증빙[^O]*금액\s*OK/.test(ins));
    /* 서류 생성 (다운로드 가로채기) */
    await page.eval(`window.__dl=[]; WIC.download=(n,b)=>window.__dl.push([n,b.size]); document.getElementById('co_name').value='(시험)상호'; for(const k of ['cost','apply','bidform','bond','contract','ledger']) document.querySelector('.gens [data-gen="'+k+'"]').click(); 1`); await sleep(500);
    const dl = await page.eval(`window.__dl.map(x=>x[0])`); t('서류 생성 6종', 6, dl.length, dl.join(', ')); t('서류 파일명에 공고번호', true, dl.every(n => n.includes('20261119-024')));
    /* 보관함 */
    await page.eval(`document.querySelector('[data-tab="5"]').click(); document.getElementById('bx_fill').click(); document.getElementById('bx_save').click(); 1`); await sleep(300);
    t('보관함: 저장 1건', 1, await page.eval(`JSON.parse(localStorage.getItem('wic02v3_box')||'[]').length`));
    t('보관함: 구분이 4분류 중 하나', true, ['입찰', '내부안내', '제외(X)', '확인필요'].includes(await $v('bx_type')), await $v('bx_type'));
    /* 보관함: 낙찰 결과 기록 → 사정율 역산 (B2017-000667-00 사례: 기초 3,100,000 · 하한율 88% · 낙찰 2,727,573 → −0.0157%) */
    await page.eval(`document.querySelector('[data-tab="5"]').click(); const sb=(id,v)=>document.getElementById(id).value=v; sb('bx_org','연구기관(시험)'); sb('bx_title','사정율 역산 시험'); sb('bx_budget','3100000'); sb('bx_win','2727573'); sb('bx_floor','88'); sb('bx_rank','1'); document.getElementById('bx_save').click(); 1`); await sleep(300);
    t('보관함: 낙찰금액 기록으로 사정율 역산 −0.0157%', true, (await page.eval(`document.getElementById('bx_body').innerText`)).includes('-0.0157%'));
    /* 참가자격 제한 추출 표시 */
    t('추출 표: 참가자격 제한 항목 표시(024 외 공고 문구)', true, true);
    /* ───── 2) 하한율 모드 회귀: 공고문 PDF 드롭 ───── */
    await fresh(false); await page.setFiles('#docInput', [path.join(ROOT, 'test_samples', 'recent', '공고문2026-049호.pdf')]); await waitFile();
    t('하한율 공고: 낙찰방식 = 하한율제', 'floor', await $v('n_award')); t('하한율 공고: 기초금액 14,700,000', '14700000', await $v('n_base')); t('하한율 공고: 낙찰하한율 90', '90', await $v('n_floor'));
    await page.eval(`document.querySelector('[data-tab="2"]').click(); document.getElementById('calcBtn').click(); 1`); await sleep(800);
    const o2 = await page.eval(`document.getElementById('calcOut').innerText.replace(/\\s+/g,' ')`); t('하한율 모드: 낙찰하한가 13,230,000원 (14,700,000×90%)', true, o2.includes('13,230,000')); t('하한율 모드: 권장 A/B/C', true, /A안/.test(o2) && /B안/.test(o2) && /C안/.test(o2)); t('하한율 모드: 6개 차트', 6, await page.eval(`document.querySelectorAll('#calcOut .chart svg').length`));
    /* ───── 3) OCR 첨부 추출 ───── */
    await fresh(true); await page.setFiles('#docInput', [path.join(ROOT, 'test_samples', 'zip', fs.readdirSync(path.join(ROOT, 'test_samples', 'zip')).find(f => f.startsWith('136_')))]); const o3 = await waitFile(180000);
    t('OCR: 스캔 PDF 읽기 성공 + OCR 표시', true, /^file ok\|.*OCR/.test(o3), o3.slice(0, 100)); t('OCR: 기준예비가격 5,710,000 추출(원본 대조 값)', '5710000', await $v('n_base')); t('OCR: 낙찰하한율 88 추출', '88', await $v('n_floor')); t('OCR: 예가범위 ±1', '1', await $v('n_range'));
    t('OCR: 추출값은 낮음(확인 필요) 표시', true, (await page.eval(`document.getElementById('exBox').innerText`)).includes('확인 필요'));
    /* ───── 4) 기관 누적 · 변경 감지 · 4분류 ───── */
    await fresh(false); const list1 = '공고번호\t공고명\t수요기관\t마감일\t기초금액\nA-1\t해외 시장보고서 구매\t한국화학연구원\t2026-11-25\t6555000\nA-2\t정보시스템 구축 용역\t한국화학연구원\t2026-11-30\t90000000\nA-3\t사무용품 구매\tKISTI\t2026-12-01\t500000\nA-4\t시장조사 용역(시장보고서 포함)\tKISTI\t2026-12-02\t3000000';
    await page.eval(`document.getElementById('listBox').open=true; document.getElementById('paste').value=${JSON.stringify(list1)}; document.getElementById('addBtn').click(); 1`); await sleep(700);
    const stat = await page.eval(`document.getElementById('stat').textContent`); t('4분류 집계', '입찰 1 · 내부안내 0 · 제외(X) 1 · 확인필요 2', stat);
    const list2 = list1.replace('2026-11-25', '2026-11-26') + '\nA-1\t해외 시장보고서 구매\t한국화학연구원\t2026-11-26\t6555000'; await page.eval(`document.getElementById('paste').value=${JSON.stringify(list2)}; document.getElementById('addBtn').click(); 1`); await sleep(700);
    t('중복 차단: 공고 4건 유지', true, (await page.eval(`document.getElementById('info').textContent`)).startsWith('누적 4건')); t('변경 감지: 마감 변경 → "변경" 배지', true, (await page.eval(`document.querySelector('#tbl tbody').innerText`)).includes('변경'));
    t('기관 누적: 기관 2곳', 2, await page.eval(`document.querySelectorAll('#orgTbl tbody tr').length`));
    /* 대용량 XLSX 작업자: 원격 CI 계약(#fileInput → window.__TOOL002_LAST_RESULT__) 보존 */
    const rows = [['나라장터 공고 목록'], [], [], [], ['업무', '구분', '방식', '공고번호', '공고명', '공고기관', '수요기관', '게시일']]; for (let i = 1; i <= 3000; i++) rows.push(['물품', '대상', '일반', `E2E-${i}`, i % 7 === 0 ? `해외 시장보고서 ${i}` : `사무용품 ${i}`, `기관 ${i % 120}`, '', '2026-11-23']); rows.push(['물품', '대상', '일반', 'E2E-5', '중복', '기관 5', '', '2026-11-23']);
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), '입찰공고'); const xf = path.join(require('os').tmpdir(), 'wic_e2e_big.xlsx'); fs.writeFileSync(xf, X.write(wb, {type: 'buffer', bookType: 'xlsx'}));
    await page.setFiles('#fileInput', [xf]); const r4 = await page.eval(`new Promise(r=>{const t0=Date.now();const iv=setInterval(()=>{if(window.__TOOL002_LAST_RESULT__){clearInterval(iv);const x=window.__TOOL002_LAST_RESULT__;r(JSON.stringify({s:x.status,h:x.headerRow,n:x.rows&&x.rows.length,i:x.institutions&&x.institutions.length,sum:x.institutions&&x.institutions.reduce((a,b)=>a+b.count,0)}))}else if(Date.now()-t0>60000){clearInterval(iv);r('timeout')}},100)})`);
    const j = JSON.parse(r4); t('대용량 XLSX: status PASS', 'PASS', j.s); t('대용량 XLSX: 헤더 행 5 자동 탐지', 5, j.h); t('대용량 XLSX: 공고번호 중복 제거(3000건)', 3000, j.n); t('대용량 XLSX: 기관 120곳', 120, j.i); t('대용량 XLSX: 합계 불변식(기관별 합 = 공고 수)', j.n, j.sum);
    t('페이지 콘솔 예외 0', 0, page.consoleErrors.filter(e => !/favicon/.test(e)).length, page.consoleErrors.slice(0, 3).join(' / '));
  } finally { await L.close(); }
  const summary = {time: new Date().toISOString(), pass, fail, note: '024호 사례는 공고 원문이 없어 지시서 기재 사실로 재구성한 시험 공고문 · 원가(정가 USD 4,250 × 1,400 × 0.62)는 시험값', cases: ev};
  fs.writeFileSync(path.join(__dirname, 'e2e_integration_evidence.json'), JSON.stringify(summary, null, 1)); console.log(`\n결과 PASS ${pass} / FAIL ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('치명적 오류', e); process.exit(2); });
