/* 엔진 단독 시험: node engine_test.js [입찰자료 폴더] */
const E = require('./engine.js'); const fs = require('fs'); const path = require('path');
const XLSX = require('../../../vendor/xlsx.full.min.js');
let pass = 0, fail = 0; const t = (name, exp, act) => { const ok = String(exp) === String(act); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + ' | 기대 ' + exp + ' | 실제 ' + act); };
// 장부 일치
t('손글씨 5,000,000×0.88 → ×1.001 = 4,404,400', '4,404,400', E.won(E.recommend(E.calc({est: '5000000', floor: '88', range: '2'}), null)[0].bid));
t('info21c 예제 1억×100.1234%×87.745% 절상', '87,853,278', E.won(E.bidBySajung(100000000, 0.1234, 87.745)));
t('info21c 예제 1억×99.8766%×87.745% 절상', '87,636,723', E.won(E.bidBySajung(100000000, -0.1234, 87.745)));
t('기존 엔진 회귀: 99,000,000×87.745%', '86,867,550', E.won(E.floorLimit(99000000, 87.745)));
t('기존 엔진 회귀: 배정예산 75,000,000 ÷1.1', '68,181,818', E.won(E.calc({budget: '75000000', vat: '10', floor: '87.745'}).est));
t('asis 면세: 총액=공급가액 (투찰률 90%)', '2,700,000/0', (() => { const r = E.calc({est: '3000000', floor: '88', rates: '90', basis: 'asis', taxmode: 'free'}).rows[0]; return E.won(r.supply) + '/' + r.vatAmt; })());
t('asis 과세: 공급+부가세=총액', 'true', (() => { const r = E.calc({est: '3300000', floor: '88', rates: '90', basis: 'asis', taxmode: 'tax', vat: '10'}).rows[0]; return String(r.supply + r.vatAmt === r.total); })());
t('빈 하한율 거부', '오류', E.calc({est: '100', floor: ''}).errors.length ? '오류' : '계산');
// 모의
const fl = E.simulate(5000000, 88, 2, 2, 30, 2000, 1); const lo = 5000000 * 0.98 * 0.88, hi = 5000000 * 1.02 * 0.88;
t('모의 하한가가 범위 안', 'true', String(Math.min(...fl) >= lo - 2 && Math.max(...fl) <= hi + 2));
t('투찰가=범위 최고 하한가면 통과확률 100%', '1', String(E.passProb(fl, Math.ceil(hi + 5))));
// 추출
const sample = '공고번호: 20181003756-00\n공고명: 2018년 3분기 해양도서관 단행본 자료 구입\n수요기관: 국립해양박물관\n기초금액: 금 18,478,112 원 (부가가치세 포함)\n낙찰하한율 88 %\n입찰보증금은 입찰금액의 5% 이상 납부\n예비가격 기초금액 ±2% 범위 복수예비가격\n제출서류: 경쟁입찰참가자격등록증, 사용인감계, 소상공인확인서, 청렴이행서약서';
const x = E.extractFields(sample);
t('추출 기초금액', '18478112', x.base && x.base.value); t('추출 하한율', '88', x.floor && x.floor.value); t('추출 보증금율', '5', x.bond && x.bond.value);
t('추출 범위', '2', x.range && x.range.value); t('추출 방식', 'multi', x.method && x.method.value); t('추출 공고번호', '20181003756-00', x.no && x.no.value);
t('서류 탐지 4건 이상', 'true', String(Object.keys(E.detectDocs(sample)).length >= 4));
t('없는 값은 비움(추측 금지)', 'undefined', String(E.extractFields('아무 내용 없음').base));
// 파일
(async () => {
  const dir = process.argv[2];
  if (dir) {
    const files = fs.readdirSync(dir, {recursive: true}).filter(f => /\.(hwp|pdf)$/i.test(f)).slice(0, 400);
    const want = [/과업내용/, /입찰진행방법/, /전자입찰참가안내/, /2019년 .*입찰 공고|구입 입찰 공고|정기간행물.*특약|납품조건/];
    let shown = 0;
    for (const f of files) {
      if (!want.some(w => w.test(f))) continue; if (shown++ > 5) break;
      const buf = fs.readFileSync(path.join(dir, f)); const file = {name: f, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)};
      try { const tx = await E.fileToText(file, XLSX); console.log('READ OK', f.slice(-40), tx.length, '자 | ' + tx.replace(/\s+/g, ' ').slice(0, 120)); const ex = E.extractFields(tx); console.log('  추출:', Object.values(ex).map(v => v.key + '=' + v.value.slice(0, 30)).join(' · ')); }
      catch (e) { console.log('READ FAIL', f.slice(-40), e.message); }
    }
  }
  
/* 참가자격·계약 조건 추출 (실무 매뉴얼 3번 15항목 중) */
{ const r = E.extractFields('소기업·소상공인확인서를 소지한 업체. 지역제한(종전 광주광역시 관할구역). 공동계약 불허합니다. 지문인식 신원확인 입찰. 적격심사 비대상입니다. 계약방법 : 수의(견적)  ');
  t('참가자격 제한 추출: 지역제한', true, !!r.region); t('참가자격 제한 추출: 소기업 확인서 요구', '필요', r.smeReq && r.smeReq.value); t('참가자격 제한 추출: 공동계약 불허', '불허', r.joint && r.joint.value); t('참가자격 제한 추출: 지문인식', '적용', r.fingerprint && r.fingerprint.value); t('참가자격 제한 추출: 적격심사 비대상', '비대상', r.evalTarget && r.evalTarget.value); t('참가자격 제한 추출: 계약방법', '수의(견적)', r.cmethod && r.cmethod.value); t('조건 문구가 없으면 비움(추측 금지)', '', Object.keys(E.extractFields('관련 없는 문장')).filter(k => ['region', 'smeReq', 'joint', 'fingerprint', 'evalTarget', 'cmethod'].includes(k)).join(',')); }
console.log(`\n결과 PASS ${pass} / FAIL ${fail}`); process.exit(fail ? 1 : 0);
})();
