/* 범용 전략 엔진 단독 시험: node v2/strategy_test.js [시나리오 파일 경로]
   기대값은 엔진 코드와 따로, 시나리오 입력에서 손계산 공식으로 만든다(qa/expect_calc.js) — 비공개 본·공개 본이 같은 시험을 쓴다.
   [임의 가짜 숫자 금지] 하한율 없는 최저가는 낙찰 구간을 만들지 않는다는 것, 모든 숫자에 출처 라벨이 붙는다는 것도 시험한다. */
const path = require('path'), fs = require('fs'); const E = require('./engine.js'); require('./pricing.js'); if (fs.existsSync(path.join(__dirname, 'kisti_private.js'))) require('./kisti_private.js'); /* 비공개 본: KISTI 기록 */
const S = require('./strategy.js'); const X = require('../qa/expect_calc.js'); const scPath = process.argv[2] || path.join(__dirname, '..', 'qa', fs.existsSync(path.join(__dirname, '..', 'qa', 'scenarios_private.js')) ? 'scenarios_private.js' : 'scenarios_public.js'); const SC = require(path.resolve(scPath));
let pass = 0, fail = 0; const t = (n, e, a) => { const ok = String(e) === String(a); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + ' | 기대 ' + e + ' | 실제 ' + a); };
const byId = id => SC.find(x => x.id === id); const HAS_KISTI = !!E.kisti;
function run(sc, over) {
  const n = Object.assign({}, sc.n), c = Object.assign({}, sc.c, over || {}), s = sc.s; let fo = null;
  if ((n.award || (n.floor ? 'floor' : '')) === 'floor') { fo = E.calc({floor: n.floor, range: n.range, rangeLo: n.rlo, rangeHi: n.rhi, vat: n.vat, taxmode: n.tax, list: c.list, cur: c.cur, fx: c.fx, disc: c.disc, costmode: c.costmode, est: n.base, basis: n.basis}); }
  const p = S.fromForm(n, c, s, fo); return {p, a: S.analyze(p), fo};
}
const won = x => Number(x).toLocaleString('ko-KR');
function srcCheck(id, a) { const noSrc = [].concat(a.lines, a.cands, a.grid, a.zone ? [a.zone] : [], a.defense ? [a.defense] : []).filter(x => !x.src || !x.src.label); t(id + ' 모든 선·후보·구간에 출처 라벨', 0, noSrc.length); }
console.log('시나리오 파일:', path.basename(scPath), '· 실측 기록(KISTI) ' + (HAS_KISTI ? '있음(비공개 본)' : '없음(공개 본)'));
/* S1 최저가 · 사전견적 · 비과세 — 하한율 없는 최저가: 구간을 만들지 않고 시뮬레이션 표만 */
{ const sc = byId('S1_KRICT_024'); if (sc) { const x = X.make(sc), {a} = run(sc); const tlo = Number(sc.c.tlo), thi = Number(sc.c.thi), g = Number(sc.c.guide);
  t('S1 분석 성공', true, a.ok); t('S1 실제 원가 = 정가×환율×(1−커미션)', x.cost, a.cost); t('S1 적자 방어선 투찰가', x.beBid, a.breakEven.bid); t('S1 대외 안내 지점 투찰가', x.guideBid, a.guideLine.bid); t('S1 방어선 = max(원가 방어선, 대외 안내)', x.defBid, a.defense.bid);
  t('S1 하한율 없는 최저가 → 낙찰 유력 구간을 만들지 않음', 'insufficient/null', a.winStatus + '/' + a.zone); t('S1 근거 부족 안내 경고', true, a.warns.some(w => w.includes('근거 데이터가 부족'))); t('S1 문구에 임의 비율(86.9·90.4·88.65) 없음', false, /86\.9|90\.4|88\.65/.test(JSON.stringify(a.reasons)));
  const c1 = a.cands.find(c => c.rate === tlo), c2 = a.cands.find(c => c.rate === thi); t('S1 목표 아래 투찰가', x.bidAt(tlo), c1.bid); t('S1 목표 아래 실제 순이익(공급가−원가)', x.profitAt(tlo), c1.profit); t('S1 목표 위 투찰가', x.bidAt(thi), c2.bid); t('S1 목표 위 실제 순이익', x.profitAt(thi), c2.profit);
  t('S1 목표 후보 출처 = 사용자 입력', 'input', c1.src.key); t('S1 방어선 출처 = 사용자 입력', 'input', a.defense.src.key); t('S1 상한선 출처 = 공고 규칙', 'rule', a.lines.find(l => l.id === 'CAP').src.key); srcCheck('S1', a);
  t('S1 추천안 없음(근거 부족 → 사용자가 고름)', null, a.recommended);
  const lr = Math.floor(x.cost / x.base * 100 * 0.8); const b = run(sc, {trates: lr + ', ' + (lr + 1)}).a; t('S1 원가보다 낮은 후보(' + lr + '%) → 적자 경고', true, b.warns.some(w => w.includes('적자') && w.includes(String(lr)))); t('S1 원가보다 낮은 후보 → 대외 안내 미만 경고', true, b.warns.some(w => w.includes('대외 안내 ' + g + '%'))); t('S1 원가보다 낮은 후보 순이익 음수', true, b.cands.find(c => c.rate === lr).profit < 0);
  t('S1 대외 안내 지점 순이익', x.profitAt(g), run(sc, {trates: String(g)}).a.cands.find(c => c.rate === g).profit);
  const sim = run(sc, {mrg: '30', cdisc: '12', cgap: '1'}).a; const tm = sim.lines.find(l => l.id === 'TM'), cd = sim.lines.find(l => l.id === 'CD'), cg = sim.lines.find(l => l.id === 'CG');
  t('S1 목표 마진 30% 가격', x.tmBid(30), tm.bid); t('S1 목표 마진 후보 투찰가 = 선(반올림 손실 없음)', x.tmBid(30), sim.cands.find(c => c.id === 'TM').bid); t('S1 목표 마진 30% 실제 순이익', x.supply(x.tmBid(30)) - x.cost, sim.cands.find(c => c.id === 'TM').profit);
  t('S1 예상 경쟁 할인율 12% → 기초금액×88%', x.cdBid(12), cd.bid); t('S1 경쟁 가정 −1%p → 87%', x.cdBid(13), cg.bid); t('S1 경쟁 가정선 출처 = 사용자 가정(근거 데이터 아님)', 'assume', cd.src.key); t('S1 목표 마진 가격 출처 = 사용자 입력', 'input', tm.src.key);
  t('S1 경쟁 가정 후보 순이익', x.supply(x.cdBid(12)) - x.cost, sim.cands.find(c => c.id === 'CD').profit);
  t('S1 시뮬레이션 표: 방어선 아래로 내려가지 않음(5%p 간격)', Math.max(0, Math.floor(x.defBid / x.base * 100 / 5) * 5), sim.grid[0].rate); t('S1 시뮬레이션 표: 마지막 줄 100%', 100, sim.grid[sim.grid.length - 1].rate); t('S1 시뮬레이션 표: 줄마다 순이익·출처', true, sim.grid.every(r => r.profit != null && r.src && r.src.label));
  t('S1 표 간격 2.5%p 로 바꾸면 줄 수가 늘어남', true, run(sc, {step: '2.5'}).a.grid.length > sim.grid.length); } }
/* S2 복수예가 하한율제 — 공고 규칙 (+ 비공개 본: 실측) */
{ const sc = byId('S2_KISTI_FLOOR'); if (sc) { const {a, fo} = run(sc); const F = Number(sc.n.floor), R = Number(sc.n.range), B = Number(sc.n.base);
  t('S2 분석 성공', true, a.ok); t('S2 하한가 변동 구간 = 기초×하한율×(1∓범위)', 'ok', Math.abs(fo.floorMin - B * F / 100 * (1 - R / 100)) < 2 && Math.abs(fo.floorMax - B * F / 100 * (1 + R / 100)) < 2 ? 'ok' : fo.floorMin + '~' + fo.floorMax);
  t('S2 가능 구간 아래 = 하한가 변동 아래끝', fo.floorMin, a.zone.lo); t('S2 마진 기대선 = 항상 통과하는 위쪽 끝', fo.floorMax, a.zone.hi); t('S2 구간 출처 = 공고 규칙', 'rule', a.zone.src.key);
  if (sc.winnerBid) t('S2 과거 1등 투찰가가 구간 안', true, sc.winnerBid >= a.zone.lo && sc.winnerBid <= a.zone.hi);
  t('S2 원가 = 정가×환율×(1−커미션)', X.make(sc).cost, a.cost);
  if (HAS_KISTI && sc.n.org.includes('한국과학기술정보연구원')) { t('S2 실측 층: 표본 2건 표시(비공개 본)', true, (a.layers.find(l => l.id === 'meas') || {detail: ''}).detail.includes('표본 2건')); t('S2 실측 선의 출처 = 실측 데이터', 'measured', a.lines.find(l => l.id.startsWith('M')).src.key); }
  else t('S2 실측 기록 없음 → 반영 0 안내(추측 금지)', true, a.layers.find(l => l.id === 'meas').detail.includes('반영 0'));
  t('S2 위쪽 끝 후보는 흑자 + 추천안', true, !!a.recommended && a.recommended.profit > 0); t('S2 설명에 낙찰하한가 구간 문구', true, a.reasons[0].includes('낙찰하한가가 움직이는')); srcCheck('S2', a);
  t('S2 하한 아래끝 미만 후보는 항상 탈락 경고', true, run(sc, {trates: String(Math.floor(F * 0.9))}).a.warns.some(w => w.includes('하한가 미만'))); }}
/* S3 일반 공개경쟁 최저가 · 과세 — 구간 없음, 표만 */
{ const sc = byId('S3_UNIV_OPEN'); if (sc) { const x = X.make(sc), {a} = run(sc);
  t('S3 원가', x.cost, a.cost); t('S3 낙찰 유력 구간 만들지 않음', 'insufficient/null', a.winStatus + '/' + a.zone); t('S3 방어선(원가+최소마진) 총액', x.beBid, a.breakEven.bid);
  const g = a.grid.find(r => r.rate === 90); t('S3 표 90% 투찰가', x.bidAt(90), g.bid); t('S3 표 90% 공급가(VAT 분리)', x.supply(x.bidAt(90)), g.supply); t('S3 표 90% 부가세 합계 보존', x.bidAt(90), g.supply + g.vat); t('S3 표 90% 순이익', x.profitAt(90), g.profit);
  t('S3 계산 근거 층에 출처 미확인 통계 없음', false, a.layers.some(l => /86\.9|90\.4/.test(l.detail))); srcCheck('S3', a); }}
/* S4 적격심사(평가표 미입력 → 기본 평가표) */
{ const sc = byId('S4_G2B_EVAL'); if (sc) { const {a} = run(sc); const B = Number(sc.n.base);
  t('S4 분석 성공', true, a.ok); t('S4 통과 최저 투찰가 = 기초×80.5%', Math.ceil(B * 80.5 / 100), a.zone.lo); t('S4 평점 최고 지점 = 기초×88%', Math.ceil(B * 88 / 100), a.zone.hi); t('S4 평가표 미입력 → 출처 라벨 = 기본 평가표(교체 필요)', 'deflt', a.zone.src.key); t('S4 기본값 사용 경고', true, a.warns.some(w => w.includes('기본값으로 계산')));
  t('S4 원가', X.make(sc).cost, a.cost); t('S4 방어선 총액', X.make(sc).beBid, a.breakEven.bid);
  const b = run(sc, {ref: '90', weight: '60', k: '3', other: '40', pass: '85'}).a; t('S4 공고 평가표를 입력하면 출처 = 공고 규칙', 'rule', b.zone.src.key); t('S4 평가표 변경 시 구간도 변함(통과 최저율 = 90−(60−45)/3 = 85%)', Math.ceil(B * 85 / 100), b.zone.lo); srcCheck('S4', a); }}
/* S5 협상 */
{ const sc = byId('S5_NEGO'); if (sc) { const {a} = run(sc);
  t('S5 협상은 가격 구간을 정하지 않는다', 'nego/null', a.winStatus + '/' + a.zone); t('S5 기술점수 안내 경고', true, a.warns.some(w => w.includes('기술점수'))); t('S5 방어선·상한 범위만 제시', true, !!a.feasible && a.feasible.hi === Number(sc.n.base)); }}
/* 오류·빈칸: 추측하지 않는다 */
{ const sc = byId('S1_KRICT_024'); const no = S.analyze(Object.assign(run(sc).p, {ref: 0})); t('기초금액 없음 → 거부', false, no.ok);
  const nA = S.analyze(Object.assign(run(sc).p, {award: ''})); t('낙찰방식 없음 → 거부(추측 금지)', false, nA.ok); const nc = S.analyze(Object.assign(run(sc).p, {commission: '', costOverride: null, list: ''})); t('원가 없음 → 순이익 미계산 + 경고', 'ok/true', (nc.ok ? 'ok' : 'x') + '/' + (nc.cands.every(x => x.profit === null) && nc.warns.some(w => w.includes('원가를 넣지'))));
  const nf = S.analyze(Object.assign(run(sc).p, {commission: '150'})); t('커미션 150% → 거부', false, nf.ok); const bad = S.analyze(Object.assign(run(sc).p, {guide: 'abc'})); t('대외 안내 비율 문자 → 거부', false, bad.ok); const big = S.analyze(Object.assign(run(sc).p, {guide: '150'})); t('대외 안내 150% → 거부', false, big.ok);
  const huge = S.analyze(Object.assign(run(sc).p, {ref: 9999999999999})); t('초대형 기초금액에도 NaN 없음', false, /NaN|Infinity|undefined/.test(JSON.stringify(huge))); }
/* 내부 정보 유출 차단 — 모든 서류 생성 결과를 스캔(투찰금액·공급가·부가세는 서류에 적히는 정당한 숫자라 allow) */
SC.forEach(sc => {
  const {p, a} = run(sc); if (!a.ok || a.cost == null) return; const sec = S.leak.build(p, a); const pick = a.recommended || a.cands.find(x => !x.flags.length) || a.cands[0]; const bid = pick ? pick.bid : 5000000;
  const nn = {no: sc.n.no, name: sc.n.title, org: sc.n.org, due: sc.n.due || ''}, co = {name: 'OO상사', ceo: '', biz: '', addr: '', tel: '', mgr: ''}, tf = sc.n.tax === 'free';
  const items = [{name: sc.n.title, pub: sc.n.pub || '', qty: 1, list: sc.c.list, cur: sc.c.cur, fx: sc.c.fx}]; const sp = tf ? bid : E.pricing.splitVat(bid, 10).supply; const allow = [bid, sp, bid - sp, Math.round(bid * 0.9), Math.round(bid / 1.1), Math.round(bid * 0.05), Math.round(bid * 0.9 * 0.1)];
  const outs = {'산출내역서.xls': S.leak.rowsToText(E.costSheetRows(nn, items, bid, tf, 10)), '입찰참가신청서.doc': S.leak.htmlToText(E.docApply(nn, co, bid)), '입찰서.doc': S.leak.htmlToText(E.docBidForm(nn, co, bid, tf)), '보증금각서.doc': S.leak.htmlToText(E.docBond(nn, co, bid)), '대금요청서.doc': S.leak.htmlToText(E.docPayReq(nn, co, bid, tf)), '계약카드.doc': S.leak.htmlToText(E.docContract(nn, co, bid, Number(sc.n.base), 88))};
  const ledger = E.ledgerRow(nn, {base: Number(sc.n.base), floor: Number(sc.n.floor) || 0, range: Number(sc.n.range) || 2, company: sc.n.org, cur: sc.c.cur, list: sc.c.list, fx: sc.c.fx, coef: String(1 - Number(sc.c.comm) / 100), model: sc.n.title, pub: ''}, bid, a.cost);
  const rawL = S.leak.scan(S.leak.rowsToText([ledger]), sec, []); t(sc.id + ' 대조군: 장부 원본 행에는 내부 원가가 들어 있어 탐지됨(스캐너 작동 확인)', true, rawL.length > 0);
  outs['입찰장부_1행.xls(원가칸 비움)'] = S.leak.rowsToText([S.redactLedger(ledger)]);
  Object.keys(outs).forEach(k => { const h = S.leak.scan(outs[k], sec, allow); t(sc.id + ' 출력 ' + k + ' 내부 정보 0건', 0, h.length); if (h.length) console.log('   발견:', h.join(' / ')); });
  t(sc.id + ' 대조군: 원가를 심은 문장은 차단', true, S.leak.scan('원가 ' + won(a.cost) + '원 커미션', sec, []).length >= 2);
});
console.log(`\n결과 PASS ${pass} / FAIL ${fail}`); process.exit(fail ? 1 : 0);
