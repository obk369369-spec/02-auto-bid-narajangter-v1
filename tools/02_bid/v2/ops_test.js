/* 운영 모듈 시험: node v2/ops_test.js */
const E = require('./engine.js'); const O = require('./ops.js');
let pass = 0, fail = 0; const t = (n, e, a) => { const ok = String(e) === String(a); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + ' | 기대 ' + e + ' | 실제 ' + a); };
/* 4분류 */
t('분류: 해외 시장보고서 구매 → 입찰', '입찰', O.classify('해외 시장보고서 구매').cls); t('분류: 정보시스템 구축 용역 → 제외(X)', '제외(X)', O.classify('정보시스템 구축 용역').cls);
t('분류: 시장조사 용역(시장보고서 포함) → 확인필요(상충)', '확인필요', O.classify('시장조사 용역(시장보고서 포함)').cls); t('분류: 사무용품 구매 → 확인필요(근거 약함)', '확인필요', O.classify('사무용품 구매').cls);
t('분류: 전자저널 구독 → 입찰', '입찰', O.classify('전자저널 구독').cls); t('분류: (취소) 공고 → 제외(X)', '제외(X)', O.classify('해외시장보고서 구매 (취소)').cls);
t('분류: WIC 유형 정의 입력 시 발행사 공급권한 대조', '입찰/확인필요', O.classify('Mordor Intelligence Helium Market', null, {types: [{name: 'T1', keywords: ['Helium'], requiresPublisher: true}], publisher_authority: ['Mordor Intelligence']}).cls + '/' + O.classify('Helium Market by Other', null, {types: [{name: 'T1', keywords: ['Helium'], requiresPublisher: true}], publisher_authority: ['Mordor Intelligence']}).cls);
/* 변경 감지 */
const n1 = {no: 'X-1', title: '해외보고서 구매', org: '기관A', base: '1000000', due: '2026-11-25 10:00', floor: '88'};
const d0 = O.diffNotice(null, n1, ''); t('감지: 최초 → NEW', 'NEW', d0.state); const rec = {fp: d0.fp, fields: n1};
t('감지: 같은 공고 → SAME', 'SAME', O.diffNotice(rec, n1, '').state); const d2 = O.diffNotice(rec, Object.assign({}, n1, {due: '2026-11-26 10:00'}), '정정공고'); t('감지: 마감 변경 → CHANGED', 'CHANGED', d2.state); t('감지: 변경 항목 due', 'due', d2.changes[0].field); t('감지: 정정 문구 플래그', true, d2.flags.includes('정정'));
t('플래그: 취소공고', true, O.noticeFlags('입찰 취소공고').includes('취소')); t('플래그: 재공고', true, O.noticeFlags('○○ 재공고').includes('재공고')); t('플래그: "재입찰 허용"은 재공고 아님', false, O.noticeFlags('본 입찰은 재입찰을 허용합니다').includes('재공고'));
/* 기관 이력 */
let h = O.accumulateHistory({}, {org: '기관A', no: 'A-1', title: 't1', cls: '입찰'}); h = O.accumulateHistory(h, {org: '기관A', no: 'A-2', title: 't2', cls: '확인필요'}); h = O.accumulateHistory(h, {org: '기관A', no: 'A-2', title: 't2-정정', cls: '확인필요'});
t('기관 이력: 같은 공고번호는 중복 증가 없음', 2, h['기관A'].count); t('기관 이력: 최신 공고명 갱신', 't2-정정', h['기관A'].latest); t('기관 이력: 분류별 건수', '입찰1/확인필요1', '입찰' + h['기관A'].cls['입찰'] + '/확인필요' + h['기관A'].cls['확인필요']);
/* 6단계 서류 */
const cl = O.buildChecklist({award: 'lowest', docHits: {tax: 'x', corpreg: 'y'}}); const ids = cl.map(c => c.id);
t('체크리스트(최저가): 발행사 가격 증빙', true, ids.includes('price_proof')); t('체크리스트(최저가): 사회보험 완납증명서', true, ids.includes('social_ins')); t('체크리스트: 납기·최종제출', true, ids.includes('delivery') && ids.includes('final_submit'));
t('체크리스트: 모든 항목이 6단계 중 하나', true, cl.every(c => O.STAGES.includes(c.cls))); t('체크리스트(하한율제): 가격 증빙 항목 없음', false, O.buildChecklist({award: 'floor'}).some(c => c.id === 'price_proof'));
t('6단계 분류 예: 입찰서=자동 작성 / 청렴서약=법적 확인 / 인증서=사용자 인증 / 사용인감계=수동 / 소상공인확인서=자동 검사 / 공고 납기=자동 수집', '자동 작성/법적 확인 필요/사용자 인증 필요/수동 처리/자동 검사/자동 수집', [O.classifyDoc('bidform'), O.classifyDoc('integ'), O.classifyDoc('cert'), O.classifyDoc('seal'), O.classifyDoc('small'), O.classifyDoc('delivery')].join('/'));
/* 자동 검사 */
const items = cl; const notice = {no: '제20261119-024호', due: '2026. 11. 25. 10:00', total: 6555000, listPrice: 4250};
const ins = O.inspect({notice, items, docs: {social_ins: {validUntil: '2026-11-24'}, small: {validUntil: '2027-03-01'}, bond: {amount: 327750}, bidform: {amount: 6555000, noticeNo: '20261119-024'}, price_proof: {amount: 4250}}});
const get = (id, ck) => ins.find(x => x.id === id && x.check === ck);
t('검사: 완납증명서 유효기간이 마감 전 만료 → FAIL', 'FAIL', get('social_ins', 'validity').status); t('검사: 소상공인확인서 유효 → OK', 'OK', get('small', 'validity').status);
t('검사: 입찰서 금액 일치 → OK', 'OK', get('bidform', 'amount').status); t('검사: 입찰서 공고번호 일치(제·호 무시) → OK', 'OK', get('bidform', 'noticeNo').status); t('검사: 가격 증빙 금액 = 정가 → OK', 'OK', get('price_proof', 'amount').status);
t('검사: 금액 불일치 → FAIL', 'FAIL', O.inspect({notice, items, docs: {bidform: {amount: 6000000, noticeNo: '20261119-024'}}}).find(x => x.id === 'bidform' && x.check === 'amount').status);
t('검사: 공고번호 불일치 → FAIL', 'FAIL', O.inspect({notice, items, docs: {bidform: {amount: 6555000, noticeNo: '20261119-025'}}}).find(x => x.id === 'bidform' && x.check === 'noticeNo').status);
t('검사: 값이 없으면 추측하지 않고 HOLD', 'HOLD', O.inspect({notice, items, docs: {}}).find(x => x.id === 'social_ins').status);
t('검사: 마감 직후 만료(14일 미만) → WARN', 'WARN', O.inspect({notice, items, docs: {small: {validUntil: '2026-12-01'}}}).find(x => x.id === 'small').status);
console.log(`\n결과 PASS ${pass} / FAIL ${fail}`); process.exit(fail ? 1 : 0);
