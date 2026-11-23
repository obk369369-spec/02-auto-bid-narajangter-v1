/* 어댑터 시험: node adapters/test_adapters.js  (G2B 응답은 명세 형태로 만든 합성 응답 — 실호출 검증 아님) */
const G = require('./g2b_openapi.js'), T = require('./generic_table.js'); const fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const t = (n, e, a) => { const ok = String(e) === String(a); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + ' | 기대 ' + e + ' | 실제 ' + a); };
/* G2B */
t('G2B: 키 없으면 URL 만들지 않음', null, G.buildUrl({}));
const u = G.buildUrl({serviceKey: 'TESTKEY%2B', op: 'thng', from: new Date(2026, 10, 22, 9, 0), to: new Date(2026, 10, 23, 9, 0), title: '시장보고서'}); t('G2B: URL 기본 경로', true, u.startsWith('https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoThng?'));
t('G2B: 조회기간·형식·키 보존', true, u.includes('inqryBgnDt=202611220900') && u.includes('inqryEndDt=202611230900') && u.includes('type=json') && u.includes('serviceKey=TESTKEY%2B')); t('G2B: 공고명 검색어 인코딩', true, u.includes('bidNtceNm=' + encodeURIComponent('시장보고서')));
const fx = {response: {header: {resultCode: '00', resultMsg: 'OK'}, body: {totalCount: 3, items: [
  {bidNtceNo: '20261119024', bidNtceOrd: '00', bidNtceNm: 'Helium Market (시험)', ntceInsttNm: '한국화학연구원', dminsttNm: '한국화학연구원', presmptPrce: '5959090', asignBdgtAmt: '6555000', bidClseDt: '2026-11-25 10:00:00', opengDt: '2026-11-25 10:30:00', sucsfbidMthdNm: '최저가낙찰제', cntrctCnclsMthdNm: '수의계약', ntceKindNm: '일반공고'},
  {bidNtceNo: '20261119024', bidNtceOrd: '01', bidNtceNm: 'Helium Market (시험) 정정', ntceInsttNm: '한국화학연구원', sucsfbidMthdNm: '제한경쟁', ntceKindNm: '변경공고'},
  {bidNtceNo: 'X2', bidNtceOrd: '00', bidNtceNm: '재공고 건', ntceInsttNm: 'B', reNtceYn: 'Y', sucsfbidMthdNm: '낙찰하한율'}]}}};
const r = G.parseResponse(fx); t('G2B: 정규화 3건', 3, r.notices.length); t('G2B: 낙찰방식 최저가', 'lowest', r.notices[0].award); t('G2B: 기초(배정)금액', '6555000', r.notices[0].baseAmount); t('G2B: 차수 01 → 정정', '정정', r.notices[1].kind); t('G2B: 재공고 표시', '재공고', r.notices[2].kind); t('G2B: 낙찰하한율 → floor', 'floor', r.notices[2].award);
t('G2B: 오류 코드는 숨기지 않고 HOLD', 'HOLD_API_ERROR', G.parseResponse({response: {header: {resultCode: '30', resultMsg: 'SERVICE KEY IS NOT REGISTERED'}}}).status);
t('G2B: 단건 items.item 객체도 처리', 1, G.parseResponse({response: {header: {resultCode: '00'}, body: {items: {item: {bidNtceNo: 'Z', bidNtceNm: 'z'}}}}}).notices.length);
G.collect({}).then(c => { t('G2B: 서비스키 없는 실호출은 HOLD_NO_SERVICE_KEY', 'HOLD_NO_SERVICE_KEY', c.status);
  /* 범용 표 */
  const tab = T.fromText('공고번호\t공고명\t수요기관\t마감일\t기초금액\nA-1\t해외 시장보고서 구매\tKISTI\t2026-11-25\t6,555,000\nA-1\t중복행\tKISTI\t2026-11-25\t1\nB-2\t도서 구입\t학교\t2026-11-26\t3000000'); t('표: 중복 제거 2건', 2, tab.notices.length); t('표: 금액 숫자만', '6555000', tab.notices[0].baseAmount);
  t('표: 제목 줄 뒤 머리글 탐지', 'PASS', T.fromRows([['나라장터 목록'], [], ['번호', '공고명', '공고기관', '입찰공고번호'], ['1', '시장조사', '기관X', 'N-1']]).status); t('표: 머리글 없으면 HOLD', 'HOLD_HEADER_NOT_FOUND', T.fromRows([['a', 'b'], ['c', 'd']]).status);
  const reg = JSON.parse(fs.readFileSync(path.join(__dirname, 'registry.json'), 'utf8')); t('레지스트리: 15개 어댑터 항목', 15, reg.adapters.length); t('레지스트리: 검증 안 된 기관은 HOLD 표기', true, reg.adapters.filter(a => a.kind === 'html').every(a => /^HOLD/.test(a.status)));
  console.log(`\n결과 PASS ${pass} / FAIL ${fail}`); process.exit(fail ? 1 : 0); });
