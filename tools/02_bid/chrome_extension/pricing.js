/* 입찰 방식별 가격 계산 엔진 (v3) — 낙찰방식 자동 판별 + 최저가 / 적격심사 / 협상계약 + 부가세 분리
   원칙: 공고 원문의 낙찰방식·수치가 권위. 근거 없는 보편 하한율(예: 88%)은 쓰지 않는다. 복수예가·낙찰하한율제는 engine.js 의 calc() 를 그대로 사용한다. */
(function (g) {
  'use strict';
  const E = g.BIDENG || require('./engine.js'); const {num, won, pct} = E; const str = v => (v == null ? '' : String(v));
  const VATR = 10;

  /* ───────── 부가세 분리: 합계(총액)가 항상 보존되도록 공급가액 = 절사(총액 ÷ 1.1), 부가세 = 총액 − 공급가액 ───────── */
  function splitVat(total, rate) {
    const r = rate == null ? VATR : rate; const supply = Math.floor(total * 100 / (100 + r)); const vat = total - supply;
    const altVat = Math.floor(supply * r / 100); /* 공급가액×10% 절사 방식(참고) — 합계가 1원 어긋날 수 있음 */
    return {supply, vat, total, altVat, altTotal: supply + altVat, differs: altVat !== vat};
  }
  /* 공급가액 S 를 받아 총액 T 를 만든다(T = S + 부가세). 분리했을 때 공급가액이 S 이상 되는 최소 T */
  function totalFromSupply(supply, rate) { const r = rate == null ? VATR : rate; let T = Math.ceil(supply * (100 + r) / 100); while (Math.floor(T * 100 / (100 + r)) < supply) T++; return T; }

  /* ───────── 낙찰방식 자동 판별 (공고 글자 → floor | lowest | eval | nego | '') ───────── */
  function detectAward(raw) {
    const t = E.normText(raw).replace(/\s+/g, ' '); const hit = [];
    const add = (mode, re, label) => { const m = re.exec(t); if (m) hit.push({mode, label, evidence: t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 30)}); };
    add('floor', /낙찰\s*하한\s*율[^0-9]{0,24}[0-9]{2,3}(?:\.[0-9]+)?\s*%/, '낙찰하한율 수치');
    add('nego', /협상\s*에\s*의한\s*계약(?!\s*(?:이\s*아닌|아님|비대상))/, '협상에 의한 계약');
    add('eval', /적격\s*심사(?!\s*(?:비\s*대상|제외|대상이\s*아))/, '적격심사');
    add('lowest', /최저\s*가\s*낙찰|최저\s*가\s*격\s*으로\s*입찰한\s*자|(?:낙찰자\s*)?선정\s*방법\s*[:\s]*최저가|낙찰\s*방식\s*[:\s]*최저가|최저가\s*(?:입찰|경쟁)/, '최저가');
    if (!hit.length) return {mode: '', evidence: '', all: []};
    const order = ['floor', 'nego', 'eval', 'lowest']; const best = hit.slice().sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode))[0];
    /* 협상·적격심사 문구가 있어도 하한율 수치가 있으면 하한율제가 먼저(공고의 수치가 가장 확실) */
    return {mode: best.mode, evidence: best.evidence, label: best.label, all: hit.map(h => h.mode)};
  }

  /* ───────── 원가: 정가 × 환율 × 계수(장부) 또는 × (1 − 할인율) ───────── */
  function costOf(inp, errors, fixes) {
    const L = num(inp.list), FX = num(inp.fx), D = num(inp.disc), cur = inp.cur || 'KRW', ledger = inp.costmode !== 'disc';
    if (L.s !== 'ok') { errors.push(L.s === 'bad' ? '발행사 정가: 숫자가 아님 (' + L.raw + ')' : '발행사 정가 입력 필요 (원가 미확인 — 추측하지 않음)'); return null; } if (!(L.n > 0)) { errors.push('발행사 정가는 0보다 커야 합니다'); return null; }
    let fx = cur === 'KRW' ? 1 : (FX.s === 'ok' && FX.n > 0 ? FX.n : null); if (cur !== 'KRW' && fx === null) { errors.push('통화 ' + cur + ' 의 환율 입력 필요'); return null; }
    if (D.s !== 'ok') { errors.push((ledger ? '원가 계수' : '할인율') + ' 입력 필요'); return null; }
    let k; if (ledger) { k = D.n; if (!(k > 0)) { errors.push('원가 계수는 0보다 커야 합니다'); return null; } if (k > 1) { fixes.push(`원가 계수 ${D.n} → ${k / 100} (%로 입력된 것으로 보고 ÷100)`); k /= 100; } }
    else { if (D.n < 0 || D.n >= 100) { errors.push('할인율은 0 이상 100 미만(%)'); return null; } k = 1 - D.n / 100; }
    return {cost: Math.round(L.n * fx * k), fx, k, note: `원가 = 정가 ${L.n.toLocaleString('ko-KR')} ${cur} × 환율 ${fx} × ${ledger ? '계수' : '(1−할인율)'} ${Math.round(k * 1e6) / 1e6} = ${won(Math.round(L.n * fx * k))}원`};
  }

  /* ───────── 2) 최저가 낙찰제 ─────────
     상한 = 기초금액(부가세 포함/별도 구분). 투찰금액(총액) ≤ 상한. 하한율은 곱하지 않는다.
     후보: A 최소마진(가장 낮게) · B 목표마진 · C 상한(기초금액) — 공급가 기준 마진, 부가세는 과세 품목만 별도 */
  function calcLowest(inp) {
    const errors = [], fixes = [], warns = []; const out = {mode: 'lowest', rows: []};
    const B = num(inp.base); if (B.s !== 'ok' || !(B.n > 0)) errors.push(B.s === 'bad' ? '기초금액: 숫자가 아님 (' + B.raw + ')' : '기초금액 확인 필요'); const V = num(inp.vat).s === 'ok' ? num(inp.vat).n : VATR;
    const taxfree = inp.taxmode === 'free', taxUnknown = !inp.taxmode; if (taxUnknown) fixes.push('면세/과세가 비어 있어 과세(부가세 별도 가산)로 계산했습니다 — 공고문·품목 확인 필요');
    const baseIncl = inp.baseVat === 'incl'; if (!inp.baseVat) { fixes.push('기초금액의 부가세 포함/별도가 비어 있어 "부가세 포함"으로 가정했습니다 — 공고문 확인 필요'); }
    const incl = inp.baseVat ? baseIncl : true;
    const cst = costOf(inp, errors, fixes); const mn = num(inp.marginMin), mt = num(inp.marginTarget), ex = num(inp.extraCost);
    const minM = mn.s === 'ok' ? mn.n : 0, tgtM = mt.s === 'ok' ? mt.n : 10, extra = ex.s === 'ok' ? ex.n : 0;
    if (errors.length) { out.errors = errors; out.fixes = fixes; out.ok = false; return out; }
    /* 상한(총액): 부가세 포함이면 그대로, 별도면 과세 품목은 공급가액 + 부가세 */
    let capTotal, capSupply; if (taxfree) { capTotal = B.n; capSupply = B.n; } else if (incl) { capTotal = B.n; capSupply = splitVat(B.n, V).supply; } else { capSupply = B.n; capTotal = totalFromSupply(B.n, V); }
    const cost = cst.cost + extra; out.cost = cst.cost; out.extra = extra; out.totalCost = cost; out.costNote = cst.note + (extra ? ` + 부대비용 ${won(extra)}원` : ''); out.capTotal = capTotal; out.capSupply = capSupply; out.taxfree = taxfree; out.vatRate = V; out.baseIncl = incl; out.base = B.n;
    const mk = (id, name, supply, how) => {
      const total = taxfree ? supply : totalFromSupply(supply, V); const sp = taxfree ? {supply: total, vat: 0} : splitVat(total, V); const over = total > capTotal;
      return {id, name, how, supply: sp.supply, vat: sp.vat, total, margin: sp.supply - cost, marginPct: (sp.supply - cost) / sp.supply * 100, markupPct: (sp.supply - cost) / cost * 100, over, overBy: over ? total - capTotal : 0, rateOfCap: total / capTotal * 100};
    };
    const sMin = Math.ceil(cost * (1 + minM / 100)), sTgt = Math.ceil(cost * (1 + tgtM / 100));
    out.rows = [mk('A', '최저가 도전(최소마진)', sMin, `원가 × (1 + 최소마진 ${minM}%) → 최저가 경쟁에서 가장 낮게`), mk('B', '목표마진', sTgt, `원가 × (1 + 목표마진 ${tgtM}%)`), mk('C', '상한 근접(기초금액)', taxfree ? capTotal : capSupply, '기초금액 그대로 — 경쟁 약함·마진 최대')];
    out.rows[2] = mk('C', '상한 근접(기초금액)', capSupply, '기초금액 그대로 — 경쟁 약함·마진 최대');
    out.feasible = out.rows[0].total <= capTotal && out.rows[0].margin >= 0; out.status = out.feasible ? '참여 가능' : '참여 불가(기초금액 이하로는 최소마진 확보 불가)';
    if (!out.feasible) warns.push(`최소마진 ${minM}% 를 지킨 최저 투찰가 ${won(out.rows[0].total)}원 > 기초금액 상한 ${won(capTotal)}원 — 안전한 공급원가 미달, 참여 보류 권고`);
    out.rows.forEach(r => { if (r.over && r.id !== 'C') warns.push(`${r.id}안 ${won(r.total)}원 은 기초금액 ${won(capTotal)}원을 ${won(r.overBy)}원 초과 — 기초금액 초과 투찰은 무효 위험`); });
    out.recommended = out.feasible ? (out.rows[1].over ? out.rows[0] : out.rows[1]) : null;
    out.errors = []; out.fixes = fixes; out.warns = warns; out.ok = true; return out;
  }

  /* ───────── 3-a) 적격심사 (조달청 물품구매 적격심사 · info21c 학습자료 37번)
     입찰가격 평점 = 배점 − k × |기준율 − 투찰률|  (기본 70 − 2×|88 − x|), 통과점수 = 신용 등 다른 항목 점수 + 가격평점 ≥ 통과 ─ 기준은 공고의 평가표가 우선(입력 가능) ───────── */
  function priceScore(rate, p) { const ref = p.ref == null ? 88 : p.ref, w = p.weight == null ? 70 : p.weight, k = p.k == null ? 2 : p.k; return Math.max(0, w - k * Math.abs(ref - rate)); }
  function minPassRate(p) { const ref = p.ref == null ? 88 : p.ref, w = p.weight == null ? 70 : p.weight, k = p.k == null ? 2 : p.k, other = p.otherScore == null ? 30 : p.otherScore, pass = p.pass == null ? 85 : p.pass; const need = pass - other; if (need > w) return null; return Math.round((ref - (w - need) / k) * 1e4) / 1e4; }
  function calcEval(inp) {
    const errors = [], fixes = []; const out = {mode: 'eval'}; const B = num(inp.base);
    if (B.s !== 'ok' || !(B.n > 0)) errors.push('예정가격(또는 기초금액) 확인 필요');
    const g2 = (k, d) => { const v = num(inp[k]); return v.s === 'ok' ? v.n : d; };
    const p = {ref: g2('ref', 88), weight: g2('weight', 70), k: g2('k', 2), otherScore: g2('otherScore', 30), pass: g2('pass', 85)}; out.params = p;
    if (!inp.ref) fixes.push('기준율 88·배점 70·감점계수 2·통과 85·기타항목 30 은 조달청 물품 적격심사 기본값입니다 — 공고의 평가표 값으로 바꾸세요');
    if (errors.length) { out.errors = errors; out.fixes = fixes; out.ok = false; return out; }
    const minRate = minPassRate(p); out.minRate = minRate; out.minBid = minRate == null ? null : Math.ceil(B.n * minRate / 100);
    const rates = []; for (let x = Math.floor((minRate == null ? p.ref - 5 : minRate) * 2) / 2 - 1; x <= Math.min(100, p.ref + 4); x += 0.5) rates.push(Math.round(x * 100) / 100);
    out.rows = rates.map(r => { const sc = priceScore(r, p), tot = sc + p.otherScore; return {rate: r, bid: Math.ceil(B.n * r / 100), priceScore: sc, total: tot, pass: tot >= p.pass}; });
    out.best = out.rows.filter(r => r.pass).sort((a, b) => a.rate - b.rate)[0] || null; /* 통과하는 가장 낮은 투찰률(적격심사에서 통과 점수를 넘기는 최저 입찰) */
    out.peak = p.ref; out.errors = []; out.fixes = fixes; out.ok = true; return out;
  }
  /* ───────── 3-b) 협상에 의한 계약: 총점 = 기술점수 + 가격점수, 가격점수 = 가격배점 × (최저입찰가 ÷ 해당입찰가) (표준 산식 · 공고의 평가기준이 우선) ───────── */
  function calcNego(inp) {
    const errors = [], fixes = []; const out = {mode: 'nego'}; const g2 = k => num(inp[k]);
    const tech = g2('techScore'), wt = g2('priceWeight'), low = g2('lowestBid'), techW = g2('techWeight');
    if (wt.s !== 'ok' || !(wt.n > 0)) errors.push('가격 배점 확인 필요 (공고 평가기준)'); if (low.s !== 'ok' || !(low.n > 0)) errors.push('예상 최저 입찰가(경쟁 기준) 입력 필요'); if (tech.s !== 'ok') errors.push('예상 기술(제안서) 점수 입력 필요');
    if (errors.length) { out.errors = errors; out.ok = false; out.fixes = fixes; return out; }
    fixes.push('가격점수 = 가격배점 × 최저입찰가 ÷ 해당 입찰가 (협상에 의한 계약 표준 산식) — 공고문의 평가 산식과 다르면 그 산식이 우선입니다');
    const list = (str(inp.bids).split(/[,\s;]+/).filter(Boolean).map(x => num(x)).filter(x => x.s === 'ok' && x.n > 0).map(x => x.n)); if (!list.length) list.push(low.n, Math.round(low.n * 1.02), Math.round(low.n * 1.05), Math.round(low.n * 1.1));
    out.rows = [...new Set(list)].sort((a, b) => a - b).map(b => { const ps = wt.n * Math.min(1, low.n / b); return {bid: b, priceScore: Math.round(ps * 1000) / 1000, total: Math.round((tech.n + ps) * 1000) / 1000}; });
    out.techWeight = techW.s === 'ok' ? techW.n : null; out.errors = []; out.fixes = fixes; out.ok = true; return out;
  }

  /* 과거 낙찰금액 → 사정율 역산: 낙찰금액 = 기초금액 × (1+사정율) × 하한율 이면 사정율 = 낙찰금액 ÷ 하한율 ÷ 기초금액 − 1 (%). 한 기관의 하한율을 보편값으로 쓸 수 없다는 근거(B2017-000667-00) */
  const impliedSajung = (win, base, floorPct) => Math.round(((win / (floorPct / 100)) / base - 1) * 1e6) / 1e4;
  const api = {splitVat, totalFromSupply, detectAward, costOf, calcLowest, calcEval, calcNego, priceScore, minPassRate, impliedSajung};
  E.pricing = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
