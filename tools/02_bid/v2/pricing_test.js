/* 가격 엔진 단독 시험: node v2/pricing_test.js */
const E = require('./engine.js'); const P = require('./pricing.js');
let pass = 0, fail = 0; const t = (n, e, a) => { const ok = String(e) === String(a); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + ' | 기대 ' + e + ' | 실제 ' + a); };
/* 긴급 사례(한국화학연구원 제20261119-024호): 기초금액 6,555,000원(VAT 포함) → 공급가액 5,959,090원 */
const s = P.splitVat(6555000); t('024호 공급가액', 5959090, s.supply); t('024호 부가세(합계 보존: 총액−공급가액)', 595910, s.vat); t('024호 합계 보존', 6555000, s.supply + s.vat);
t('참고: 공급가액×10% 절사 방식 부가세 595,909 (합계 6,554,999 → 1원 차이)', '595909/6554999/true', s.altVat + '/' + s.altTotal + '/' + s.differs);
t('공급가액→총액 왕복(5,959,090→6,554,999)', 6554999, P.totalFromSupply(5959090));
t('총액 1,100원 분리', '1000/100', (x => x.supply + '/' + x.vat)(P.splitVat(1100)));
/* 낙찰방식 판별 */
t('판별: 낙찰하한율 수치 → floor', 'floor', P.detectAward('낙찰자 결정: 낙찰하한율 90% 이상 중 최저가격').mode);
t('판별: 제한최저가 + 적격심사 비대상 + 하한율 → floor', 'floor', P.detectAward('제한최저가, 소액수의 총액 견적. 적격심사 비대상입니다. 낙찰하한율 90% 이상').mode);
t('판별: 선정방법 최저가 → lowest', 'lowest', P.detectAward('입찰공고번호 제20261119-024호 낙찰자 선정방법 : 최저가').mode);
t('판별: 적격심사 비대상만 있으면 미확정', '', P.detectAward('적격심사 비대상입니다').mode);
t('판별: 적격심사 → eval', 'eval', P.detectAward('낙찰자 결정방법: 적격심사').mode);
t('판별: 협상에 의한 계약 → nego', 'nego', P.detectAward('계약방법: 협상에 의한 계약(제한경쟁)').mode);
t('판별: 단서 없음', '', P.detectAward('안내문입니다').mode);
/* 최저가 낙찰제 — 시험값: 정가 USD 4,250 × 환율 1,400 × 계수 0.62 = 3,689,000 */
const base = {base: '6555000', baseVat: 'incl', taxmode: 'tax', list: '4250', cur: 'USD', fx: '1400', costmode: 'ledger', disc: '0.62', marginMin: '8', marginTarget: '15'};
const L = P.calcLowest(base); t('최저가: 계산 성공', true, L.ok); t('최저가: 원가(시험값) 3,689,000', 3689000, L.cost); t('최저가: 상한 총액=기초금액 6,555,000', 6555000, L.capTotal); t('최저가: 상한 공급가액 5,959,090', 5959090, L.capSupply);
const A = L.rows[0], Bm = L.rows[1], Cc = L.rows[2]; t('최저가 A안 공급가 = ⌈원가×1.08⌉', Math.ceil(3689000 * 1.08), A.supply); t('최저가 A안 부가세 분리 합계 보존', A.total, A.supply + A.vat); t('최저가 A안 원가 대비 마진(markup) ≥ 8%', true, A.markupPct >= 8 - 1e-9);
t('최저가 B안 원가 대비 마진(markup) ≥ 15%', true, Bm.markupPct >= 15 - 1e-9); t('최저가 C안 = 기초금액 근접(≤ 상한)', true, Cc.total <= 6555000); t('최저가: 기초금액 초과 없음', true, !L.rows.some(r => r.over)); t('최저가: 추천안 존재', true, !!L.recommended);
const L2 = P.calcLowest(Object.assign({}, base, {list: '9000', fx: '1500'})); t('최저가: 원가가 너무 높으면 참여 불가 + 경고', 'false/true', L2.feasible + '/' + (L2.warns.length > 0));
const L3 = P.calcLowest(Object.assign({}, base, {taxmode: 'free'})); t('최저가: 면세 품목은 부가세 0', 0, L3.rows[0].vat);
const L4 = P.calcLowest(Object.assign({}, base, {baseVat: 'excl'})); t('최저가: 기초금액 부가세 별도면 상한 총액 = 공급가액+부가세', 7210500, L4.capTotal);
t('최저가: 기초금액 없으면 거부(추측 금지)', false, P.calcLowest(Object.assign({}, base, {base: ''})).ok); t('최저가: 정가 없으면 거부', false, P.calcLowest(Object.assign({}, base, {list: ''})).ok);
/* 적격심사 (info21c 학습자료 37번: 평점 70 − 2×|88 − x| , 통과 85 , 신용 30 → 최저 투찰률 80.5%) */
t('적격심사: 기준율에서 가격평점 70', 70, P.priceScore(88, {})); t('적격심사: 80.5% 에서 평점 55', 55, P.priceScore(80.5, {})); t('적격심사: 통과 최저 투찰률 80.5%', 80.5, P.minPassRate({}));
const EV = P.calcEval({base: '100000000'}); t('적격심사: 최저 통과 투찰가(1억×80.5%)', 80500000, EV.minBid); t('적격심사: 통과 중 최저율 행', 80.5, EV.best.rate); t('적격심사: 기본값 사용 안내 문구', true, EV.fixes.length > 0);
t('적격심사: 예정가격 없으면 거부', false, P.calcEval({}).ok);
/* 협상계약: 가격점수 = 배점 × 최저가/입찰가 */
const NG = P.calcNego({priceWeight: '20', lowestBid: '1000000', techScore: '70', bids: '1000000,1100000'}); t('협상: 최저가 입찰 가격점수 20', 20, NG.rows[0].priceScore); t('협상: 1,100,000 입찰 가격점수 18.182', 18.182, NG.rows[1].priceScore); t('협상: 총점 = 기술+가격', 88.182, NG.rows[1].total);
t('협상: 배점 없으면 거부', false, P.calcNego({lowestBid: '1', techScore: '1'}).ok);
/* 보편 88% 금지 근거: B2017-000667-00 기초 3,100,000 · 하한율 88% · 낙찰 기록 2,727,573 → 하한가 2,728,000 과 다름 → 사정율 −0.0156% */
t('사정율 역산(B2017-000667-00): 낙찰 2,727,573 (-0.015653%)', -0.0157, P.impliedSajung(2727573, 3100000, 88)); t('기초×88% = 2,728,000 ≠ 기록된 낙찰금액(보편 88% 불가)', true, Math.round(3100000 * 0.88) !== 2727573);
console.log(`\n결과 PASS ${pass} / FAIL ${fail}`); process.exit(fail ? 1 : 0);
