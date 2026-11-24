/* 범용 전략 엔진 E2E (헤드리스 Edge · file:/// 실제 열기)
   시나리오마다: 입력 → [상황 진단·구간 계산] → 출처 라벨·구간·후보·순이익 → [계산하기] 차트 음영 → ③ 서류 전부 생성 시 내부 원가 유출 0 → 일부러 원가를 섞으면 차단
   기대값은 qa/expect_calc.js 의 손계산 공식으로 만든다(하드코딩 금액 없음) → 비공개 본·공개 본 모두 같은 시험.
   실행: node qa/e2e_strategy.js [시나리오 파일] [html 경로]   증거: qa/e2e_strategy_evidence.json */
'use strict';
const fs = require('fs'), path = require('path'), {launch, sleep} = require('./cdp.js'); const X = require('./expect_calc.js');
const ROOT = path.join(__dirname, '..'); const scFile = path.resolve(process.argv[2] || path.join(__dirname, fs.existsSync(path.join(__dirname, 'scenarios_private.js')) ? 'scenarios_private.js' : 'scenarios_public.js')); const htmlFile = path.resolve(process.argv[3] || path.join(ROOT, '02_bid.html')); const SC = require(scFile);
const PRIVATE = /private/.test(scFile); const url = 'file:///' + htmlFile.replace(/\\/g, '/'); const ev = []; let pass = 0, fail = 0;
const t = (name, exp, act) => { const ok = String(exp) === String(act); ok ? pass++ : fail++; ev.push({name, expected: String(exp), actual: String(act), pass: ok}); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' | 기대 ' + exp + ' | 실제 ' + act)); };
const tr = (name, cond, info) => t(name, true, !!cond || (info !== undefined ? 'false: ' + String(info).slice(0, 160) : 'false'));
(async () => {
  const L = await launch(); const {page} = L;
  try {
    for (const sc of SC) {
      await page.goto('about:blank'); await page.goto(url); await page.eval(`localStorage.clear(); localStorage.setItem('wic02_ocr','off'); 1`); await page.goto(url); await sleep(500);
      const set = (id, v) => page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)}); if(!e) return 'NOEL'; if(e.type==='checkbox') e.checked=!!${JSON.stringify(v)}; else e.value=${JSON.stringify(String(v))}; return 'ok'})()`);
      for (const k of Object.keys(sc.n)) await set('n_' + k, sc.n[k]); for (const k of Object.keys(sc.c)) await set('c_' + k, sc.c[k]);
      await set('s_org', sc.s.org); await set('s_orgkey', sc.s.orgKey || 'none'); await set('s_sales', sc.s.sales); await set('s_contract', sc.s.contract); await set('s_urgent', sc.s.urgent); await set('s_rebid', sc.s.rebid);
      await page.eval(`document.querySelector('[data-tab="2"]').click(); document.getElementById('stratBtn').click(); 1`); await sleep(400);
      const out = await page.eval(`document.getElementById('stratOut').innerText.replace(/\\s+/g,' ')`); const P = sc.id + ' '; const x = X.make(sc), w = x.won;
      t(P + '진단 화면 NaN/undefined/Infinity 없음', false, /NaN|undefined|Infinity/.test(out));
      const nsrc = await page.eval(`document.querySelectorAll('#stratOut .src').length`); tr(P + '모든 구간·표 줄에 출처 라벨 표시(' + nsrc + '개)', nsrc >= 8, nsrc);
      t(P + '후보·시뮬레이션 표 모든 줄에 출처 라벨', 0, await page.eval(`[...document.querySelectorAll('#candTbl tbody tr, #gridTbl tbody tr')].filter(r=>!r.querySelector('.src')).length`));
      tr(P + '구간 차트 SVG 있음', await page.eval(`!!document.querySelector('#stratOut .chart svg')`)); tr(P + '내부용 안내 문구', out.includes('내부용'));
      t(P + '툴팁 100%: 새 카드의 모든 입력·버튼에 title', 0, await page.eval(`[...document.querySelectorAll('#stratCard input, #stratCard select, #stratCard button')].filter(e=>!(e.getAttribute('title')||'').trim()).length`));
      if (sc.id === 'S1_KRICT_024') {
        const tlo = Number(sc.c.tlo), thi = Number(sc.c.thi), g = Number(sc.c.guide);
        tr(P + '하한율 없는 최저가 → 낙찰 구간 "산출 불가" + 근거 부족 안내', out.includes('산출 불가') && out.includes('근거 데이터가 부족')); tr(P + '목표 아래 실제 순이익 ' + w(x.profitAt(tlo)) + ' 표시', out.includes(w(x.profitAt(tlo)))); tr(P + '목표 아래 투찰가 ' + w(x.bidAt(tlo)) + ' 표시', out.includes(w(x.bidAt(tlo)))); tr(P + '대외 안내 방어선 ' + w(x.guideBid) + ' 표시', out.includes(w(x.guideBid)));
        tr(P + '임의 통계(86.9·90.4) 화면에 없음', !/86\.9|90\.4/.test(out));
        await page.eval(`const r=document.getElementById('rng_mrg'); r.value='30'; r.dispatchEvent(new Event('input',{bubbles:true})); const d=document.getElementById('rng_cdisc'); d.value='12'; d.dispatchEvent(new Event('input',{bubbles:true})); 1`); await sleep(500);
        const out2 = await page.eval(`document.getElementById('stratOut').innerText.replace(/\\s+/g,' ')`); t(P + '슬라이더 → 숫자칸 동기화(목표 마진)', '30', await page.eval(`document.getElementById('c_mrg').value`)); tr(P + '슬라이더 → 목표 마진 30% 가격 ' + w(x.tmBid(30)) + ' 반영', out2.includes(w(x.tmBid(30)))); tr(P + '슬라이더 → 경쟁 가정가 ' + w(x.cdBid(12)) + ' + 사용자 가정 라벨', out2.includes(w(x.cdBid(12))) && out2.includes('사용자 가정'));
        const lr = Math.floor(x.cost / x.base * 100 * 0.8); await page.eval(`document.getElementById('c_trates').value='${lr}'; document.getElementById('stratBtn').click(); 1`); await sleep(300); tr(P + lr + '% (원가 미만) 후보 → 적자 경고 화면 표시', (await page.eval(`document.getElementById('stratOut').innerText`)).includes('적자:')); await page.eval(`document.getElementById('c_trates').value=''; 1`);
      }
      if (sc.id === 'S2_KISTI_FLOOR') { tr(P + '낙찰 가능 구간(공고 규칙 라벨)', out.includes('공고 규칙 기반') && /\d,\d{3},\d{3} ~ \d,\d{3},\d{3}원/.test(out)); if (PRIVATE && sc.real) { tr(P + '실측 데이터 라벨(비공개 본)', out.includes('실측 데이터 기반')); tr(P + '구간 하·상단 2,700,720 ~ 2,755,280', out.includes('2,700,720') && out.includes('2,755,280')); } else tr(P + '공개 본: 실측 라벨 없음(자료 없음 → 반영 0)', !out.includes('과거 1등')); }
      if (sc.id === 'S3_UNIV_OPEN') tr(P + '일반 최저가 → 구간 산출 불가 + 시뮬레이션 표', out.includes('산출 불가') && (await page.eval(`document.querySelectorAll('#gridTbl tbody tr').length`)) >= 5);
      if (sc.id === 'S4_G2B_EVAL') tr(P + '평가표 미입력 → 기본 평가표 라벨 + 통과 최저 ' + w(Math.ceil(x.base * 80.5 / 100)), out.includes('기본 평가표') && out.includes(w(Math.ceil(x.base * 80.5 / 100))));
      if (sc.id === 'S5_NEGO') tr(P + '협상 → 가격 구간 없음 안내', out.includes('가격 구간 없음'));
      /* [계산하기] — 기존 계산 + 차트 음영 */
      await page.eval(`document.getElementById('calcBtn').click(); 1`); await sleep(800); const calcTxt = await page.eval(`document.getElementById('calcOut').innerText.replace(/\\s+/g,' ')`);
      t(P + '[계산하기] 화면 NaN/undefined 없음', false, /NaN|undefined|Infinity/.test(calcTxt)); const svgs = await page.eval(`document.querySelectorAll('#calcOut svg').length`);
      if (sc.n.award === 'floor') tr(P + '기존 차트 위 음영: 하한가 그래프에 "가능 구간(공고 규칙" 표시', await page.eval(`document.getElementById('calcOut').innerHTML.includes('가능 구간(공고 규칙')`));
      if (sc.n.award === 'lowest') tr(P + '기존 최저가 차트 위 음영: "가능 범위" 표시', await page.eval(`document.getElementById('calcOut').innerHTML.includes('가능 범위(방어선~기초금액')`));
      tr(P + '기존 계산 결과 SVG ' + svgs + '개', svgs >= 1 || sc.n.award === 'nego' || sc.n.award === 'eval');
      /* ③ 서류: 전부 생성 + 유출 0 */
      const bid = await page.eval(`(()=>{const a=window.__BIDUI.S.strat; return a&&a.ok? ((a.recommended||a.cands.find(c=>!c.flags.length)||a.cands[0]||{}).bid||0):0})()`);
      await page.eval(`document.getElementById('d_bid').value=${JSON.stringify(String(bid || 5000000))}; document.getElementById('co_name').value='OO상사'; document.getElementById('co_ceo').value='홍길동'; ['n_no','n_title','n_org'].forEach(i=>{if(!document.getElementById(i).value) document.getElementById(i).value='시험'}); 1`);
      await page.eval(`window.__DL=[]; window.__ROWS=[]; WIC.download=(n,b)=>{window.__DL.push(n)}; const o=XLSX.utils.aoa_to_sheet; XLSX.utils.aoa_to_sheet=r=>{window.__ROWS.push(JSON.stringify(r)); return o(r)}; window.__BIDUI3_BLOCKED=[]; document.querySelector('[data-tab="3"]').click(); 1`);
      for (const k of ['cost', 'apply', 'bidform', 'bond', 'payreq', 'contract', 'ledger']) { await page.eval(`(()=>{const b=document.querySelector('[data-gen="${k}"]'); if(b) b.click()})()`); await sleep(120); }
      t(P + '서류 7종 모두 생성(내려받기 호출)', 7, (await page.eval(`window.__DL`)).length); t(P + '정상 서류는 차단 0건', 0, (await page.eval(`window.__BIDUI3_BLOCKED`)).length);
      const sp0 = x.supply(bid || 5000000); const leak = await page.eval(`(()=>{const S=window.BIDENG.strategy; const sec=window.__BIDUI3.secrets(); return S.leak.scan(window.__ROWS.join('\\n'), sec, [${bid}, ${sp0}, ${(bid || 5000000) - sp0}])})()`);
      t(P + '생성된 .xls(산출내역서·장부) 안에 내부 원가·커미션 0건', 0, leak.length); if (leak.length) console.log('   발견:', leak.join(' / '));
      const secret = await page.eval(`(()=>{const sec=window.__BIDUI3.secrets(); const ok=new Set([${bid}, ${sp0}, ${(bid || 5000000) - sp0}, ${Math.round((bid || 5000000) * 0.9)}]); return [...sec.amounts].find(a=>!ok.has(a))||0})()`);
      if (secret) { await page.eval(`window.__DL=[]; window.__BIDUI3_BLOCKED=[]; document.getElementById('co_name').value='원가 ${secret.toLocaleString('ko-KR')}원'; document.querySelector('[data-gen="apply"]').click(); 1`); await sleep(200); t(P + '대조군: 서류에 원가가 섞이면 내려받기 차단', '0/1', (await page.eval(`window.__DL.length`)) + '/' + (await page.eval(`window.__BIDUI3_BLOCKED.length`))); }
      await page.eval(`document.getElementById('co_name').value='OO상사'; 1`);
    }
    t('콘솔 오류 0건', 0, page.consoleErrors.length); if (page.consoleErrors.length) console.log(page.consoleErrors.slice(0, 5));
    t('가로 넘침 없음', false, await page.eval(`document.documentElement.scrollWidth > innerWidth + 2`));
    await page.screenshot(path.join(__dirname, 'e2e_strategy_last.png'));
  } finally { await L.close(); }
  fs.writeFileSync(path.join(__dirname, 'e2e_strategy_evidence.json'), JSON.stringify({at: new Date().toISOString(), scenarios: path.basename(scFile), html: path.basename(htmlFile), pass, fail, ev}, null, 1));
  console.log(`\n결과 PASS ${pass} / FAIL ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
