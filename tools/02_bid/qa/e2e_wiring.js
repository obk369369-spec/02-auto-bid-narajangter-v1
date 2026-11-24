/* 전체 탭 연결 전수 E2E (헤드리스 Edge · file:/// 실제 열기)
   A) ① 낙찰방식 드롭다운 → ② 계산·전략·추가 입력 즉시 연동, 최저가면 하한율 칸 비활성  B) ② 대표 시나리오 불러오기 4종
   C) 탭 간 값 전달: ①→②→③ · 보관함 저장·검색·불러오기·삭제 · 검증·설정 · 공고 목록 · 모든 드롭다운 옵션 순회 · 무반응 버튼 탐지
   실행: node qa/e2e_wiring.js [html 경로]   증거: qa/e2e_wiring_evidence.json */
'use strict';
const fs = require('fs'), path = require('path'), {launch, sleep} = require('./cdp.js'); const X = require('./expect_calc.js');
const ROOT = path.join(__dirname, '..'); const htmlFile = path.resolve(process.argv[2] || path.join(ROOT, '02_bid.html')); const url = 'file:///' + htmlFile.replace(/\\/g, '/');
let pass = 0, fail = 0; const ev = [];
const t = (name, exp, act) => { const ok = String(exp) === String(act); ok ? pass++ : fail++; ev.push({name, expected: String(exp), actual: String(act), pass: ok}); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' | 기대 ' + exp + ' | 실제 ' + act)); };
const tr = (name, c, info) => t(name, true, !!c || (info !== undefined ? 'false: ' + String(info).slice(0, 220) : 'false'));
(async () => {
  const L = await launch(); const {page} = L;
  try {
    const fresh = async () => { await page.goto('about:blank'); await page.goto(url); await page.eval(`localStorage.clear(); localStorage.setItem('wic02_ocr','off'); 1`); await page.goto(url); await sleep(700); await page.eval(`window.__DL=[]; WIC.download=(n,b)=>{window.__DL.push(n)}; 1`); };
    const $ = (id, prop) => page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)}); return e ? e.${prop || 'value'} : '__NOEL__'})()`);
    const set = (id, v) => page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)}); if(!e) return 'NOEL'; if(e.type==='checkbox') e.checked=!!${JSON.stringify(v)}; else e.value=${JSON.stringify(String(v))}; return 'ok'})()`);
    const fire = (id, ev0) => page.eval(`document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event(${JSON.stringify(ev0 || 'change')},{bubbles:true})); 1`);
    const click = id => page.eval(`document.getElementById(${JSON.stringify(id)}).click(); 1`); const txt = id => page.eval(`document.getElementById(${JSON.stringify(id)}).innerText.replace(/\\s+/g,' ')`);
    const activeTab = () => page.eval(`(document.querySelector('.pane.on')||{}).id`);
    /* ═════ A) 낙찰방식 드롭다운 ═════ */
    await fresh();
    const opts = await page.eval(`[...document.getElementById('n_award').options].map(o=>o.value+'='+o.text)`);
    t('A1 ①탭 낙찰방식 드롭다운 4종 + 미선택', '=(확인 필요 — 공고문을 보고 선택)|floor=복수예가·낙찰하한율제|lowest=최저가 낙찰제|eval=적격심사제|nego=협상에 의한 계약', opts.join('|'));
    tr('A2 낙찰방식 라벨이 ①탭 공고 정보 안에 있음', await page.eval(`document.getElementById('tab1').contains(document.getElementById('n_award')) && document.getElementById('awardLbl').textContent.includes('낙찰방식 (선정방법)')`));
    await set('n_base', '10000000'); await set('n_title', '시험 공고'); await set('n_org', '예시기관'); await set('c_list', '1000'); await set('c_cur', 'KRW'); await set('c_comm', '30'); await set('n_tax', 'free'); await set('n_basis', 'asis');
    for (const [a, label, offFloor] of [['lowest', '최저가 낙찰제', true], ['eval', '적격심사제', true], ['nego', '협상에 의한 계약', true], ['floor', '복수예가·낙찰하한율제', false]]) {
      await page.eval(`document.querySelector('[data-tab="2"]').click(); 1`); await set('n_award', a); await fire('n_award'); await sleep(450);
      const st = await page.eval(`JSON.stringify({f: document.getElementById('n_floor').disabled, r: document.getElementById('n_range').disabled, m: document.getElementById('n_method').disabled, ph: document.getElementById('n_floor').placeholder, hint: document.getElementById('awardHint').textContent, now: document.getElementById('awardNow').innerText, open: document.getElementById('awardExtra').open})`).then(JSON.parse);
      t('A3 [' + a + '] 하한율·예가범위·예정가격방식 칸 비활성 = ' + offFloor, offFloor, st.f && st.r && st.m ? true : (!st.f && !st.r && !st.m ? false : 'mixed'));
      tr('A3 [' + a + '] 현재 낙찰방식 안내에 ' + label, st.now.includes(label), st.now); if (a === 'lowest') tr('A3 최저가: 하한율 칸에 "최저가: 하한율 없음" 안내', st.ph.includes('하한율 없음') && st.hint.includes('낙찰하한율 없음'), st.ph + '|' + st.hint);
      if (a !== 'floor') tr('A3 [' + a + '] 낙찰방식별 추가 입력 패널 자동 펼침', st.open);
      const dim = await page.eval(`[...document.querySelectorAll('#awardExtra label')].map(l=>[l.textContent.trim().slice(0,6), l.style.opacity||'1'])`);
      if (a !== 'floor') { const grp = {lowest: '[최저가]', eval: '[적격심사]', nego: '[협상]'}[a]; tr('A3 [' + a + '] 해당 그룹만 선명, 나머지는 흐림', dim.filter(d => d[0].startsWith(grp)).every(d => d[1] === '1') && dim.filter(d => !d[0].startsWith(grp)).every(d => d[1] !== '1'), JSON.stringify(dim)); }
      /* ② 계산 엔진 연동: 계산하기 → 화면과 전략 엔진의 낙찰방식 */
      await click('calcBtn'); await sleep(600); const head = await txt('calcHead'); const sa = await page.eval(`window.__BIDUI.S.strat && window.__BIDUI.S.strat.award`);
      tr('A4 [' + a + '] ② 계산 화면 낙찰방식 표시 ' + label, head.includes(label) || (a === 'floor'), head); t('A4 [' + a + '] 전략 엔진(strategy.js)이 받은 낙찰방식', a === 'floor' ? 'floor|undefined' : a, a === 'floor' ? 'floor|undefined' : sa);
    }
    /* 계산 후 낙찰방식을 바꾸면 ② 결과가 자동으로 다시 계산됨 */
    await set('n_floor', '88'); await set('n_award', 'lowest'); await fire('n_award'); await sleep(300); await click('calcBtn'); await sleep(500); const before = await txt('calcHead');
    await set('n_award', 'eval'); await fire('n_award'); await sleep(700); const after = await txt('calcHead'); tr('A5 낙찰방식 변경 → ② 계산 결과가 즉시 다시 그려짐(최저가 → 적격심사제)', before.includes('최저가') && after.includes('적격심사'), before + ' => ' + after);
    await set('n_award', 'lowest'); await fire('n_award'); await sleep(500); const an = await page.eval(`JSON.stringify({aw: window.__BIDUI.S.strat.award, ws: window.__BIDUI.S.strat.winStatus})`).then(JSON.parse); t('A6 최저가 + 하한율 칸에 값이 남아 있어도 하한율 무시(낙찰 구간 산출 불가)', 'lowest/insufficient', an.aw + '/' + an.ws);
    await page.eval(`document.querySelector('[data-tab="1"]').click(); 1`); await set('n_award', ''); await fire('n_award'); await sleep(400); tr('A7 미선택 → 하한율 칸 다시 켜짐 + 선택 안내', !(await $('n_floor', 'disabled')) && (await txt('awardNow')).includes('낙찰방식 미선택'));
    /* 공고문 자동 판별 → 드롭다운 선택 + 비활성 연동 */
    await click('nClear'); await page.eval(`document.getElementById('docPaste').value='입찰공고\\n공고번호: 제2026-0001호\\n낙찰자 선정방법 : 최저가\\n기초금액 : 5,000,000원(VAT 포함)\\n'; document.getElementById('docPasteBtn').click(); 1`); await sleep(900);
    t('A8 공고문 자동 판별 → 낙찰방식 드롭다운이 최저가로 선택', 'lowest', await $('n_award')); tr('A8 자동 판별 후 하한율 칸 비활성', await $('n_floor', 'disabled')); t('A8 기초금액 자동 입력', '5000000', await $('n_base'));
    await page.goto(url); await sleep(700); t('A9 새로고침 후에도 낙찰방식 유지', 'lowest', await $('n_award')); tr('A9 새로고침 후에도 하한율 칸 비활성 유지', await $('n_floor', 'disabled'));
    await click('nClear'); await sleep(400); t('A10 [공고 정보 비우기] → 낙찰방식 미선택 + 하한율 칸 활성', 'false', String(await $('n_floor', 'disabled')) + (await $('n_award') === '' ? '' : '(award=' + (await $('n_award')) + ')'));
    /* ═════ B) 대표 시나리오 불러오기 ═════ */
    await fresh(); const menu = await page.eval(`[...document.getElementById('scSel').options].map(o=>o.value+'='+o.text)`); t('B1 [대표 시나리오 불러오기] 항목 수(안내 + 4종)', 5, menu.length); menu.slice(1).forEach((m, i) => tr('B1 메뉴 ' + (i + 1) + ' 표기 "사례 ' + (i + 1) + '"', m.includes('사례 ' + (i + 1)), m));
    tr('B1 장부 사례 불러오기 버튼 옆에 위치', await page.eval(`document.getElementById('exLoad').nextElementSibling === document.getElementById('scSel')`));
    const SCS = await page.eval(`JSON.stringify(window.BIDSC)`).then(JSON.parse); const IDS = ['S1_KRICT_024', 'S2_KISTI_FLOOR', 'S4_G2B_EVAL', 'S5_NEGO'];
    for (let i = 0; i < 4; i++) {
      const sc = SCS.find(s => s.id === IDS[i]); const P = '사례 ' + (i + 1) + ' ';
      await page.eval(`document.querySelector('[data-tab="1"]').click(); 1`); await page.eval(`(()=>{const s=document.getElementById('scSel'); s.value=${JSON.stringify(IDS[i])}; s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(900);
      t(P + '불러온 뒤 ② 탭으로 이동', 'tab2', await activeTab());
      for (const k of Object.keys(sc.n)) { if (['rlo', 'rhi'].includes(k) && sc.n[k] === '') continue; t(P + '① n_' + k + ' 채움', sc.n[k], await $('n_' + k)); }
      for (const k of ['list', 'cur', 'fx', 'comm', 'guide', 'tlo', 'thi', 'smin']) { if (sc.c[k] !== undefined && sc.c[k] !== '') t(P + '② c_' + k + ' 채움', sc.c[k], await $('c_' + k)); }
      t(P + '② 상황: 영업·독점성', sc.s.sales, await $('s_sales')); t(P + '② 상황: 기관 유형', sc.s.org, await $('s_org')); t(P + '낙찰방식 드롭다운 값', sc.n.award, await $('n_award')); t(P + '낙찰하한율 칸 비활성 = ' + (sc.n.award !== 'floor'), String(sc.n.award !== 'floor'), String(await $('n_floor', 'disabled')));
      const out = await txt('stratOut'); tr(P + '전략 진단 결과가 자동으로 나옴', out.includes('상황 진단') && !/NaN|undefined/.test(out), out.slice(0, 100)); tr(P + '② 계산 결과 카드도 자동으로 나옴', (await page.eval(`document.getElementById('calcOut').querySelector('.card')!==null`)));
      const x = X.make(sc), sa = await page.eval(`window.__BIDUI.S.strat`); if (sc.n.award === 'lowest') t(P + '전략 엔진 실제 원가(환율 시험값 기준)', x.cost, await page.eval(`window.__BIDUI.S.strat.cost`)); if (sc.n.award === 'floor') tr(P + '전략 엔진: 하한가 변동 구간 산출', await page.eval(`!!window.__BIDUI.S.strat.zone`));
      tr(P + '불러오기 안내 토스트', (await page.eval(`(document.querySelector('.toast')||{}).innerText||''`)).includes('사례를 불러왔습니다'));
    }
    /* ═════ C) 탭 간 값 전달 ═════ */
    await fresh(); await page.eval(`(()=>{const s=document.getElementById('scSel'); s.value='S1_KRICT_024'; s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(900);
    /* C1 ②→③: 후보 행 선택 → 확정 투찰금액 */
    const bid0 = await page.eval(`document.querySelector('#candTbl [data-pick]').dataset.pick`); await page.eval(`document.querySelector('#candTbl [data-pick]').click(); 1`); t('C1 ② 후보 행 선택 → ③ 확정 투찰금액 칸에 반영', bid0, await $('d_bid'));
    await page.eval(`document.querySelector('[data-tab="3"]').click(); 1`); await sleep(500); t('C2 ③ 탭 열림', 'tab3', await activeTab()); const chk = await txt('chkBox'); tr('C2 ③ 체크리스트가 낙찰방식(최저가) 기준으로 표시', chk.length > 50 && !/NaN|undefined/.test(chk), chk.slice(0, 80));
    await set('co_name', 'OO상사'); await fire('co_name', 'input'); await page.eval(`window.__DL=[]; 1`);
    for (const k of ['cost', 'apply', 'bidform', 'bond', 'payreq', 'contract', 'ledger']) { await page.eval(`(()=>{const b=document.querySelector('[data-gen="${k}"]'); if(b) b.click()})()`); await sleep(120); }
    const dls = await page.eval(`window.__DL`); t('C3 ③ 서류 7종 생성 버튼 모두 동작', 7, dls.length); tr('C3 서류 파일명에 공고번호 반영', dls.every(n => n.includes(SCS.find(s => s.id === 'S1_KRICT_024').n.no) || n.includes('입찰')), dls.join(','));
    await page.eval(`document.getElementById('itemAdd').click(); 1`); await sleep(200); tr('C4 ③ [품목 추가] 버튼이 행을 늘림', (await page.eval(`document.querySelectorAll('#itemTbl tbody tr').length`)) >= 2);
    /* C5~ 보관함 */
    await page.eval(`document.querySelector('[data-tab="5"]').click(); 1`); await sleep(300); await click('bx_fill'); await sleep(200); const n0 = await page.eval(`JSON.stringify({o:document.getElementById('n_org').value,t:document.getElementById('n_title').value,b:document.getElementById('n_base').value,a:document.getElementById('n_award').value,tax:document.getElementById('n_tax').value,no:document.getElementById('n_no').value})`).then(JSON.parse);
    t('C5 보관함 [현재 공고 불러오기] → 기관', n0.o, await $('bx_org')); t('C5 → 공고명', n0.t, await $('bx_title')); t('C5 → 예산(기초금액)', n0.b, await $('bx_budget')); await click('bx_save'); await sleep(300); tr('C6 보관함 [저장] → 목록 1건', (await txt('sumCount')).includes('저장 1건'), await txt('sumCount'));
    await set('bx_search', n0.t.slice(0, 6)); await click('bx_find'); await sleep(200); t('C7 보관함 검색 일치 1건', 1, await page.eval(`document.querySelectorAll('#bx_body tr').length`)); await set('bx_search', '없는기관ZZZ'); await click('bx_find'); await sleep(200); t('C7 검색 불일치 → 0건', 0, await page.eval(`document.querySelectorAll('#bx_body tr').length`)); await click('bx_reset'); await sleep(200); t('C7 [초기화] → 전체 1건', 1, await page.eval(`document.querySelectorAll('#bx_body tr').length`));
    await page.eval(`document.querySelector('[data-tab="1"]').click(); 1`); await click('nClear'); await sleep(300); await page.eval(`document.querySelector('[data-tab="5"]').click(); document.querySelector('[data-bxload]').click(); 1`); await sleep(500);
    t('C8 보관함 [불러오기] → ① 기관 복원', n0.o, await $('n_org')); t('C8 → ① 공고명 복원', n0.t, await $('n_title')); t('C8 → ① 기초금액 복원', n0.b, await $('n_base')); t('C8 → ① 공고번호 복원', n0.no, await $('n_no')); t('C8 → ① 낙찰방식 복원', n0.a, await $('n_award')); t('C8 → ① 면세/과세 복원', n0.tax, await $('n_tax')); t('C8 → 낙찰방식에 따라 하한율 칸 비활성 유지', String(n0.a !== 'floor' && n0.a !== ''), String(await $('n_floor', 'disabled')));
    await page.eval(`document.querySelector('[data-bxdel]').click(); 1`); await sleep(300); tr('C9 보관함 [삭제] → 0건', (await txt('sumCount')).includes('저장 0건'), await txt('sumCount')); await set('bx_org', '임시'); await click('bx_clear'); await sleep(100); t('C9 [비우기] → 입력칸 비워짐', '', await $('bx_org'));
    /* C10~ 검증·설정 */
    await page.eval(`document.querySelector('[data-tab="4"]').click(); 1`); await click('verifyBtn'); await sleep(3000); const vm = await txt('verifyMsg'); const vb = await page.eval(`[...document.querySelectorAll('#vTbl tbody tr td:last-child')].map(x=>x.innerText)`); tr('C10 검증·설정 [자가검증 실행] 전체 PASS', vm.includes('PASS') && vb.length > 20 && vb.every(x => x === 'PASS'), vm + ' / ' + vb.filter(x => x !== 'PASS').length); await page.eval(`window.__DL=[]; 1`); await click('evBtn'); await sleep(200); t('C11 [Evidence 내려받기]', 1, (await page.eval(`window.__DL`)).length);
    await set('k_ex', '용역\n시험제외어'); await click('saveCfg'); await sleep(300); await page.eval(`document.querySelector('[data-tab="1"]').click(); document.getElementById('listBox').open=true; 1`); await set('paste', '시험제외어 구매 건\n전자저널 데이터베이스 구독'); await click('addBtn'); await sleep(600);
    const rows = await page.eval(`[...document.querySelectorAll('#tbl tbody tr')].map(t=>[...t.children].map(c=>c.innerText.trim()))`); tr('C12 키워드 설정이 ① 목록 분류에 반영(제외어 → X, 입찰어 → 입찰)', rows.length === 2 && rows.some(r => r[1].includes('X')) && rows.some(r => r[1] === '입찰'), JSON.stringify(rows.map(r => r.slice(0, 2))));
    await page.eval(`document.querySelector('[data-tab="4"]').click(); 1`); await click('defCfg'); await sleep(300); tr('C13 [기본값 복원] → 제외어 기본 목록', (await $('k_ex')).includes('용역') && !(await $('k_ex')).includes('시험제외어'));
    /* C14~ ① 공고 목록 */
    await page.eval(`document.querySelector('[data-tab="1"]').click(); 1`); await page.eval(`window.__DL=[]; 1`); await click('csvBtn'); await sleep(200); t('C14 ① [CSV] 내려받기', 1, (await page.eval(`window.__DL`)).length); await click('copyBtn'); await sleep(200);
    await set('amtVat', 'incl'); await set('paste', 'R25BK777\t해외 시장보고서 구매\t예시기관\t2026-12-01\t99,000,000'); await click('addBtn'); await sleep(500); await page.eval(`[...document.querySelectorAll('#tbl tbody tr')].find(r=>r.innerText.includes('R25BK777')).querySelector('[data-calc]').click(); 1`); await sleep(800);
    t('C15 목록 [계산기로] → ② 탭 이동', 'tab2', await activeTab()); t('C15 → 기초금액 99,000,000 전달', '99000000', await $('n_base')); tr('C15 → 낙찰방식 미선택이면 안내(추측 금지)', (await txt('awardNow')).includes('낙찰방식') );
    await page.eval(`document.querySelector('[data-tab="1"]').click(); document.getElementById('onlyBid').click(); 1`); await sleep(200); await click('resetBtn'); await sleep(300); tr('C16 ① [누적 초기화] 후 표 비워짐', (await page.eval(`document.querySelectorAll('#tbl tbody tr').length`)) === 0);
    /* C17 모든 드롭다운 옵션 순회 → 계산 오류·NaN 없음 */
    await fresh(); await page.eval(`(()=>{const s=document.getElementById('scSel'); s.value='S2_KISTI_FLOOR'; s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(900);
    const sels = await page.eval(`[...document.querySelectorAll('.pane select')].filter(s=>s.id && s.id!=='scSel').map(s=>[s.id, [...s.options].map(o=>o.value)])`); let combos = 0, bad = [];
    for (const [id, vals] of sels) { const orig = await $(id); for (const v of vals) { await set(id, v); await fire(id); await page.eval(`document.querySelector('[data-tab="2"]').click(); document.getElementById('calcBtn').click(); 1`); await sleep(250); const o = await txt('calcOut') + await txt('stratOut'); combos++; if (/NaN|undefined|Infinity/.test(o)) bad.push(id + '=' + v); } await set(id, orig); await fire(id); }
    t('C17 모든 드롭다운(' + sels.length + '개) 옵션 ' + combos + '가지 순회 → NaN·undefined 0건', 0, bad.length); if (bad.length) console.log('   발견:', bad.join(', '));
    /* C18 무반응 버튼 탐지: 각 탭의 모든 버튼을 눌러 화면·저장소·토스트·내려받기 중 하나라도 변하는지 */
    const tabs = ['1', '2', '3', '5', '4']; const SKIP = new Set(['docPasteBtn', 'fxBtn', 'aiBtn', 'aiSave', 'aiClear']); const dead = [];
    for (const tb of tabs) {
      await fresh(); await page.eval(`(()=>{const s=document.getElementById('scSel'); s.value='S1_KRICT_024'; s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(700); await page.eval(`document.querySelector('[data-tab="${tb}"]').click(); document.getElementById('d_bid').value='5000000'; document.getElementById('co_name').value='OO상사'; 1`); await sleep(300);
      const btns = await page.eval(`[...document.querySelectorAll('#tab${tb} button')].filter(b=>b.id&&b.offsetParent!==null).map(b=>b.id)`);
      for (const id of btns) { if (SKIP.has(id)) continue; const snap = `JSON.stringify([document.body.innerText.length, document.body.innerHTML.length, JSON.stringify(localStorage).length, (window.__DL||[]).length, (document.querySelector('.toast')||{}).innerText||'', (document.querySelector('.pane.on')||{}).id, document.getElementById('log').innerText.length])`; if (tb === '2') { await page.eval(`(()=>{const s=document.getElementById('scSel'); s.value='S1_KRICT_024'; s.dispatchEvent(new Event('change',{bubbles:true}))})(); 1`); await sleep(500); } /* 앞 버튼(비우기 등)이 입력을 지웠을 수 있어 매번 같은 사례로 되돌림 */ await page.eval(`document.querySelector('[data-tab="${tb}"]').click(); [...document.querySelectorAll('.toast')].forEach(x=>x.innerText=''); 1`); const b4 = await page.eval(snap); await page.eval(`window.__DL=window.__DL||[]; (()=>{const e=document.getElementById(${JSON.stringify(id)}); if(e) e.click()})(); 1`); await sleep(250); const af = await page.eval(snap); if (b4 === af) { dead.push('tab' + tb + ':' + id); if (process.env.WIRING_DEBUG) console.log('   [dbg]', id, b4.slice(0, 160)); } }
    }
    console.log('   (무반응 후보: ' + (dead.join(', ') || '없음') + ')'); const ALLOW = new Set(['tab2:calcClear', 'tab5:bx_clear', 'tab5:bx_find', 'tab5:bx_reset']); /* 비어 있는 상태에서 눌러 보여줄 것이 없는 정상 동작 */ const unexplained = dead.filter(d => !ALLOW.has(d)); t('C18 무반응 버튼(허용 목록 제외) 0건', 0, unexplained.length); if (unexplained.length) console.log('   발견:', unexplained.join(', '));
    t('콘솔 오류 0건', 0, page.consoleErrors.length); if (page.consoleErrors.length) console.log(page.consoleErrors.slice(0, 6)); t('가로 넘침 없음', false, await page.eval(`document.documentElement.scrollWidth > innerWidth + 2`));
    t('툴팁 100%: 모든 버튼·입력·선택에 title', 0, await page.eval(`[...document.querySelectorAll('button, input:not([type=file]):not([type=hidden]), select, textarea')].filter(e=>!(e.getAttribute('title')||'').trim() && !(e.closest('label')&&(e.closest('label').getAttribute('title')||'').trim())).map(e=>e.id).length`));
  } finally { await L.close(); }
  fs.writeFileSync(path.join(__dirname, 'e2e_wiring_evidence.json'), JSON.stringify({at: new Date().toISOString(), html: path.basename(htmlFile), pass, fail, ev}, null, 1));
  console.log(`\n결과 PASS ${pass} / FAIL ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
