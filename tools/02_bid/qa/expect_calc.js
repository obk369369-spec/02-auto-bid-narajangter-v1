/* 시험용 기대값 계산기 — 엔진(strategy.js)과 별개로, 시나리오 입력에서 손계산 공식으로 기대값을 만든다.
   비공개 본·공개 본이 같은 시험 코드를 쓰도록 하드코딩 금액을 시험 파일에 두지 않는다. (비과세 단일 최저가형에 쓰이는 공식 + 과세 분리) */
'use strict';
const num = x => Number(String(x == null ? '' : x).replace(/,/g, ''));
function make(sc) {
  const n = sc.n, c = sc.c, base = num(n.base), free = n.tax === 'free', vat = num(n.vat) || 10, fx = c.cur === 'KRW' ? 1 : num(c.fx);
  const cost = Math.round(num(c.list) * fx * (1 - num(c.comm) / 100)) + (num(c.extra) || 0);
  const supply = bid => (free ? bid : Math.floor(bid * 100 / (100 + vat)));
  const totalFromSupply = s => { if (free) return s; let T = Math.ceil(s * (100 + vat) / 100); while (Math.floor(T * 100 / (100 + vat)) < s) T++; return T; };
  const bidAt = r => Math.floor(base * Math.round(r * 1000) / 100000 + 1e-9);
  const needSupply = m => Math.ceil(cost * (1 + m / 100) - 1e-6);
  const beBid = totalFromSupply(needSupply(num(c.smin) || 0)); const guideBid = c.guide ? bidAt(num(c.guide)) : null;
  return {base, free, vat, cost, supply, bidAt, beBid, guideBid, defBid: Math.max(beBid, guideBid || 0), profitAt: r => supply(bidAt(r)) - cost, tmBid: m => totalFromSupply(needSupply(m)), cdBid: d => bidAt(100 - d), won: x => Number(x).toLocaleString('ko-KR')};
}
module.exports = {make};
