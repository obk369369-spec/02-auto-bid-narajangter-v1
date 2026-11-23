/* 02 입찰 도구 v2 — 순수 계산·추출 엔진 (브라우저/Node 공용). 근거: 입찰.zip 의 입찰장부(.xls)·투찰 기본 계산식·info21c 학습자료·KISTI 절차 문서. */
(function (g) {
  'use strict';
  const str = v => (v === null || v === undefined) ? '' : String(v);
  const num = v => { const t = str(v).replace(/[,\s원₩$€£¥]/g, '').replace(/%$/, ''); if (t === '') return {s: 'empty'}; if (!/^-?\d+(\.\d+)?$/.test(t)) return {s: 'bad', raw: str(v)}; return {s: 'ok', n: Number(t)}; };
  const won = n => (n === null || n === undefined || !isFinite(n)) ? '-' : Math.round(n).toLocaleString('ko-KR');
  const pct = (n, d = 3) => isFinite(n) ? n.toFixed(d).replace(/\.?0+$/, '') + '%' : '-';
  const r1000 = r => Math.round(r * 1000);
  const mulRate = (price, rate) => Math.round(price * r1000(rate) / 1e5);
  const floorLimit = (price, rate) => Math.ceil(price * r1000(rate) / 1e5 - 1e-6);
  /* 투찰금액 = 기초금액 × 사정율 × 낙찰하한율 (원 미만 절상) — info21c 학습자료 21번. 정수(BigInt) 연산으로 오차 제거 */
  const bidBySajung = (base, sajungPct, floorPct) => {
    const S = BigInt(Math.round((100 + sajungPct) * 1e4)), F = BigInt(Math.round(floorPct * 1e3)), B = BigInt(Math.round(base));
    const den = 100000000000n, n = B * S * F; return Number((n + den - 1n) / den);
  };

  /* ───────── 기관별 예가 변동폭 (info21c 학습자료 21번 표) — 읽을 수 없는 칸은 비움(추측 금지) ───────── */
  const ORG_RANGE = [
    ['조달청', '±2%'], ['행안부(지자체)', '±3%'], ['농어촌공사', '±2%'], ['수자원공사', '±2.5%'], ['한국전력', '±2.5%'],
    ['가스공사', '0% ~ -5%'], ['한국토지주택공사', '0% ~ -6%'], ['마사회', '0% ~ -5%'], ['철도시설공단', '0% ~ -6%'], ['군시설', '±3%']
  ];

  /* ───────── 예시 이력(비식별 합성값 · 실제 과거 투찰가가 아님) ───────── */
  const HIST = [
    {no: 'EX-0001', org: '예시기관', name: '예시 보고서 A', K: 3000000, F: 88, T: 2643000, range: '(-1)%~(+0)%', result: ''},
    {no: 'EX-0002', org: '예시기관', name: '예시 보고서 B', K: 5000000, F: 88, T: 4405000, range: '(-2)%~(+2)%', result: ''},
    {no: 'EX-0003', org: '예시기관', name: '예시 보고서 C', K: 2000000, F: 88, T: 1761000, range: '(-2)%~(+2)%', result: ''}
  ];
  HIST.forEach(h => { h.L = Math.round(h.K * h.F / 100); h.ratioL = h.T / h.L; h.ratioK = h.T / h.K; });
  /* 비드큐 입찰공고 목록 187건(2018-10-08 수집) 집계 */
  const LIST_STATS = {
    n: 187,
    floorRate: [['90%', 160], ['88%', 7], ['89.995%', 3], ['87.995%', 2], ['87.745%', 2], ['84.245%', 2], ['표기 없음', 11]],
    industry: [['출판물', 164], ['기타', 9], ['사무기기/사무용품', 3], ['악기/장난감/교보재', 4], ['컴퓨터/전산', 2]],
    baseAmt: {n: 157, p25: 3481380, med: 4930500, p75: 10944000}
  };

  /* ───────── 투찰 계산 (기존 엔진 유지 + 원가 장부방식·기준금액 그대로 방식 추가) ───────── */
  function calc(inp) {
    const fixes = [], errors = [], out = {rows: [], strat: [], notes: []};
    const N = (k, label, req) => { const r = num(inp[k]); if (r.s === 'bad') errors.push(`${label}: 숫자가 아님 (${r.raw})`); else if (r.s === 'empty' && req) errors.push(`${label}: 입력 필요`); else if (r.s === 'ok' && /[,\s원₩$€£¥%]/.test(str(inp[k]))) fixes.push(`${label}: 기호·쉼표 제거 (${str(inp[k])} → ${r.n})`); return r; };
    const vat = N('vat', '부가세율'), est = N('est', '추정가격'), bud = N('budget', '배정예산'), fl = N('floor', '낙찰하한율', true), rg = N('range', '예비가격 변동 범위');
    const asis = inp.basis === 'asis';
    let E = est.s === 'ok' ? est.n : null;
    const V = vat.s === 'ok' ? vat.n : 10; if (vat.s !== 'ok') fixes.push('부가세율: 비어 있어 10%로 적용 (면세·과세 구분 아님, 공고문 확인)');
    if (est.s === 'ok' && est.n <= 0) errors.push('추정가격은 0보다 커야 합니다');
    if (bud.s === 'ok' && bud.n <= 0) errors.push('배정예산은 0보다 커야 합니다');
    if (E === null && bud.s === 'ok' && bud.n > 0) {
      if (asis) { E = bud.n; fixes.push(`기초금액 ${won(bud.n)} 을 그대로 기준으로 사용 (부가세 포함 입찰 · 입찰장부 K열 방식)`); }
      else { E = Math.round(bud.n / (1 + V / 100)); fixes.push(`추정가격 비어 있음 → 배정예산 ${won(bud.n)} ÷ (1+${V}%) = ${won(E)} 로 역산`); }
    }
    if (E === null && !errors.length) errors.push('추정가격 또는 배정예산 중 하나는 필요합니다 ("기초금액 확인 필요")');
    if (!asis && est.s === 'ok' && bud.s === 'ok' && bud.n > 0 && est.n > 0) { const exp = bud.n / (1 + V / 100); if (Math.abs(exp - est.n) / exp > 0.01) out.notes.push(`⚠ 추정가격과 배정예산÷(1+부가세)가 1% 이상 다릅니다 (${won(est.n)} vs ${won(exp)}) — 공고문 값을 확인하세요`); }
    let F = fl.s === 'ok' ? fl.n : null;
    if (F !== null && (F <= 0 || F > 100)) { errors.push(`낙찰하한율은 0 초과 100 이하의 % 값입니다 (${F})`); F = null; }
    if (F !== null && F <= 1) { F = Math.round(F * 100 * 1e6) / 1e6; fixes.push(`낙찰하한율 ${fl.n} → ${F}% (비율로 입력된 것으로 보고 ×100)`); }
    out.est = E; out.floorRate = F; out.vat = V; out.range = rg.s === 'ok' ? rg.n : 2; out.basis = asis ? 'asis' : 'excl';
    /* 예가 변동폭: 대칭(±R) 기본, 비대칭(예: -3% ~ +0%)은 rangeLo/rangeHi 로 지정 */
    const rlo = num(inp.rangeLo), rhi = num(inp.rangeHi);
    out.rangeLo = rlo.s === 'ok' && rlo.n >= 0 ? rlo.n : out.range; out.rangeHi = rhi.s === 'ok' && rhi.n >= 0 ? rhi.n : out.range;
    if (E !== null && F !== null) {
      out.floorLimit = floorLimit(E, F);
      const R = out.range, LO = out.rangeLo, HI = out.rangeHi; out.estMin = Math.round(E * (1 - LO / 100)); out.estMax = Math.round(E * (1 + HI / 100));
      out.floorMin = floorLimit(out.estMin, F); out.floorMax = floorLimit(out.estMax, F);
      let rates = [];
      const raw = str(inp.rates).split(/[,\s;]+/).filter(Boolean);
      if (raw.length) { raw.forEach(t => { const r = num(t); if (r.s !== 'ok') { fixes.push(`투찰률 "${t}" 은 숫자가 아니어서 제외`); return; } let x = r.n; if (x <= 1) { fixes.push(`투찰률 ${t} → ${x * 100}% (비율 → %)`); x *= 100; } if (x > 100 || x <= 0) { fixes.push(`투찰률 ${t} 은 범위 밖이어서 제외`); return; } rates.push(Math.round(x * 1000) / 1000); }); }
      if (!rates.length) rates = [0.05, 0.1, 0.2, 0.3, 0.5, 1.0].map(a => Math.round((F + a) * 1000) / 1000).filter(x => x <= 100);
      rates = [...new Set(rates)].sort((a, b) => a - b);
      const L = num(inp.list), FX = num(inp.fx), D = num(inp.disc);
      let cost = null, costNote = '정가·할인율 미입력 → 마진 "확인 필요"';
      const ledger = inp.costmode === 'ledger';
      if (L.s === 'bad') errors.push('보고서 정가: 숫자가 아님 (' + L.raw + ')'); else if (L.s === 'ok' && L.n <= 0) errors.push('보고서 정가는 0보다 커야 합니다');
      if (D.s === 'bad') errors.push((ledger ? '원가 계수' : '할인율') + ': 숫자가 아님 (' + D.raw + ')');
      else if (D.s === 'ok' && !ledger && (D.n < 0 || D.n >= 100)) errors.push('할인율은 0 이상 100 미만(%) 입니다 (' + D.n + ')');
      else if (D.s === 'ok' && ledger && D.n <= 0) errors.push('원가 계수는 0보다 커야 합니다 (' + D.n + ')');
      if (FX.s === 'bad') errors.push('환율: 숫자가 아님 (' + FX.raw + ')');
      let fx = FX.s === 'ok' ? FX.n : null; const cur = inp.cur || 'KRW';
      if (cur === 'KRW') { if (fx !== null && fx !== 1) fixes.push('통화가 KRW 이므로 환율 ' + fx + ' 을 무시하고 1 적용'); fx = 1; }
      else if (fx === null || fx <= 0) fx = null;
      let coef = null;
      if (ledger && D.s === 'ok' && D.n > 0) { coef = D.n; if (coef > 1) { fixes.push(`원가 계수 ${D.n} → ${coef / 100} (% 로 입력된 것으로 보고 ÷100)`); coef = coef / 100; } }
      if (L.s === 'ok' && L.n > 0 && ((!ledger && D.s === 'ok' && D.n >= 0 && D.n < 100) || (ledger && coef !== null))) {
        if (fx === null) costNote = `통화 ${cur} 인데 환율이 없어 마진 "확인 필요"`;
        else if (ledger) { cost = Math.round(L.n * fx * coef); costNote = `원가 = 정가 ${L.n.toLocaleString('ko-KR')} ${cur} × 환율 ${fx} × 계수 ${coef} = ${won(cost)}원 (입찰장부 Y열 = 달러×환율×디스카운트열)`; }
        else { cost = Math.round(L.n * fx * (1 - D.n / 100)); costNote = `매입가 = 정가 ${L.n.toLocaleString('ko-KR')} ${cur} × 환율 ${fx} × (1 − 할인율 ${D.n}%) = ${won(cost)}원`; }
      }
      out.cost = cost; out.costNote = costNote;
      const taxfree = inp.taxmode !== 'tax'; if (inp.taxmode === '') fixes.push('면세/과세가 비어 있어 면세로 계산했습니다 (공고문 확인 필요)');
      const mk = (rate) => {
        const bid = mulRate(E, rate); const diff = bid - out.floorLimit;
        const r = {rate, bid, diff, diffPct: out.floorLimit ? diff / out.floorLimit * 100 : NaN, margin: cost === null ? null : bid - cost, marginPct: cost === null ? null : (bid - cost) / bid * 100, below: bid < out.floorLimit, loss: cost !== null && bid < cost};
        if (asis) { r.supply = taxfree ? bid : Math.round(bid / (1 + V / 100)); r.vatAmt = bid - r.supply; r.total = bid; }
        else { r.supply = bid; r.vatAmt = taxfree ? 0 : Math.round(bid * V / 100); r.total = bid + r.vatAmt; }
        r.bond = null; return r;
      };
      out.rows = rates.map(x => mk(x));
      const safe = num(inp.safe), mid = num(inp.mid), mn = num(inp.min);
      const sp = safe.s === 'ok' ? safe.n : 2, mp = mid.s === 'ok' ? mid.n : 5, np = mn.s === 'ok' ? mn.n : 0;
      const strat = (name, price, how) => { const bid = Math.round(price); const rate = bid / E * 100; const r = {name, how, bid, rate, below: bid < out.floorLimit, margin: cost === null ? null : bid - cost, marginPct: cost === null ? null : (bid - cost) / bid * 100}; r.loss = cost !== null && bid < cost; return r; };
      out.strat.push(strat('보수적', E * (1 - sp / 100), `예정가격에서 ${sp}% 여유`));
      if (cost !== null) { out.strat.push(strat('중간', cost * (1 + mp / 100), `원가 × (1 + ${mp}%)`)); out.strat.push(strat('공격적', cost * (1 + np / 100), `원가 + 최소마진 ${np}%`)); }
      else { out.strat.push({name: '중간', how: '정가·할인율 필요', bid: null}); out.strat.push({name: '공격적', how: '정가·할인율 필요', bid: null}); }
      const bd = num(inp.bond); out.bondRate = bd.s === 'ok' && bd.n > 0 ? bd.n : null; if (bd.s === 'bad') errors.push('입찰보증금율: 숫자가 아님');
      out.rows.forEach(r => { r.bond = out.bondRate === null ? null : Math.round(r.bid * out.bondRate / 100); });
      /* 사정율 표: 기초금액 × (1+사정율) × 하한율. 사정율 = 예정가격이 기초금액에서 벗어난 정도(예가변동폭 안) */
      out.sajung = [];
      if (LO + HI > 0) { const steps = 8; for (let i = 0; i <= steps; i++) { const s = -LO + ((LO + HI) * i) / steps; const sj = Math.round(s * 1e4) / 1e4; out.sajung.push({sajung: sj, est: Math.round(E * (1 + sj / 100)), floor: bidBySajung(E, sj, F)}); } }
      else out.sajung.push({sajung: 0, est: E, floor: out.floorLimit});
    }
    out.fixes = fixes; out.errors = errors; out.ok = !errors.length && out.rows.length > 0; return out;
  }
  function reverify(o) {
    const checks = [];
    if (!o.ok) return checks;
    o.rows.forEach(r => {
      const back = r.bid / o.est * 100; checks.push({name: `투찰률 ${pct(r.rate)} 역산`, expected: r.rate.toFixed(3), actual: back.toFixed(3), pass: Math.abs(back - r.rate) <= 0.5 / o.est * 100 + 1e-9});
      checks.push({name: `투찰률 ${pct(r.rate)} 하한 판정 일치`, expected: String(r.rate < o.floorRate), actual: String(r.bid < o.floorLimit), pass: (r.rate < o.floorRate) === (r.bid < o.floorLimit) || Math.abs(r.rate - o.floorRate) < 1e-9});
      if (r.margin !== null) checks.push({name: `투찰률 ${pct(r.rate)} 마진 = 입찰금액 − 매입가`, expected: won(r.bid - o.cost), actual: won(r.margin), pass: r.margin === r.bid - o.cost});
    });
    checks.push({name: '낙찰하한가 ≤ 예정가격', expected: 'true', actual: String(o.floorLimit <= o.est), pass: o.floorLimit <= o.est});
    checks.push({name: '투찰률 후보 오름차순·중복 없음', expected: 'true', actual: String(o.rows.every((r, i) => !i || r.rate > o.rows[i - 1].rate)), pass: o.rows.every((r, i) => !i || r.rate > o.rows[i - 1].rate)});
    return checks;
  }

  /* ───────── 권장 투찰 구간 (과거 장부 패턴 기반) ─────────
     하한가 × 1.001 을 표준안으로 둔다(일반 규칙이 아니라 이 도구의 기본 제안).
     A=하한가×1.001 (장부 3-4번 행·손글씨 일치) · B=예가범위 최저 하한가×1.001 (장부 3번 행 근사) · C=예가범위 최고 하한가 (하한 통과 최우선) */
  function recommend(o, cost) {
    if (!o || !o.ok) return [];
    const E = o.est, F = o.floorRate, R = o.range, LO = o.rangeLo, HI = o.rangeHi;
    const Lmin = floorLimit(Math.round(E * (1 - LO / 100)), F), Lmax = floorLimit(Math.round(E * (1 + HI / 100)), F);
    const mk = (id, name, bid, how, ev) => ({id, name, bid, how, ev, rate: bid / E * 100, belowCenter: bid < o.floorLimit, margin: cost === null || cost === undefined ? null : bid - cost, marginPct: (cost === null || cost === undefined) ? null : (bid - cost) / bid * 100, loss: cost !== null && cost !== undefined && bid < cost});
    const recs = [
      mk('A', '표준(장부 패턴)', Math.round(o.floorLimit * 1.001), '하한가(기초금액×하한율) × 1.001', '하한가 × 1.001 규칙 (예: 4,400,000 → 4,404,400)'),
      mk('B', '공격(범위 최저)', Math.round(Lmin * 1.001), `예가 −${LO}% 가정 하한가 × 1.001`, '예가 범위 최저 하한가 기준의 근접 투찰'),
      mk('C', '안전(범위 최고)', Lmax, `예가 +${HI}% 가정 하한가 (= 어떤 예정가격에서도 하한 통과)`, '하한 미만 탈락을 피하는 최상단. 가격 경쟁력은 가장 낮음')
    ];
    if (LO + HI === 0) { recs[1].how = '예가변동 없음 → A와 동일'; recs[2].how = '예가변동 없음 → 하한가 그대로'; }
    return recs;
  }

  /* ───────── 복수예비가격 모의 (가정 명시: 15개 균등분포·참가자 무작위 2개·최다 4개 평균) ─────────
     근거: info21c 학습자료(복수예비가격 15개 중 2개 선택, 다빈도 4개 평균 = 예정가격). 참가자수·분포는 가정값이며 실제 낙찰 확률이 아니다. */
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function simulate(base, F, lo, hi, participants, trials, seed) {
    const rnd = rng(seed || 20261119), floors = [];
    if (!(lo + hi > 0)) { const f = floorLimit(base, F); for (let i = 0; i < trials; i++) floors.push(f); return floors; }
    for (let t = 0; t < trials; t++) {
      const prices = []; for (let i = 0; i < 15; i++) prices.push(base * (1 - lo / 100 + rnd() * (lo + hi) / 100));
      const cnt = new Array(15).fill(0);
      for (let p = 0; p < participants; p++) { const a = Math.floor(rnd() * 15); let b = Math.floor(rnd() * 14); if (b >= a) b++; cnt[a]++; cnt[b]++; }
      const idx = cnt.map((c, i) => ({c, i, r: rnd()})).sort((x, y) => y.c - x.c || y.r - x.r).slice(0, 4);
      const est = Math.ceil(idx.reduce((s, x) => s + prices[x.i], 0) / 4);
      floors.push(floorLimit(est, F));
    }
    return floors;
  }
  const passProb = (floors, bid) => floors.filter(f => bid >= f).length / floors.length;
  function histogram(vals, bins) {
    const mn = Math.min(...vals), mx = Math.max(...vals); if (mn === mx) return {min: mn, max: mx, bins: [{lo: mn, hi: mx, c: vals.length}]};
    const w = (mx - mn) / bins, out = []; for (let i = 0; i < bins; i++) out.push({lo: mn + w * i, hi: mn + w * (i + 1), c: 0});
    vals.forEach(v => { let i = Math.floor((v - mn) / w); if (i >= bins) i = bins - 1; out[i].c++; }); return {min: mn, max: mx, bins: out};
  }

  /* ───────── 공고문 텍스트에서 핵심 숫자 추출 (근거 문장 함께 반환 · 못 찾으면 비움) ───────── */
  const NUM = '([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)';
  /* 문서마다 다른 기호(전각 숫자·콜론, 긴 대시, 특수 공백)를 하나로 맞춘다 — 글자 의미는 바꾸지 않는다 */
  function normText(raw) {
    return str(raw).replace(/ |　| |​/g, ' ').replace(/\r/g, '').replace(/[‐-―−－]/g, '-')
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/：/g, ':').replace(/％/g, '%').replace(/，/g, ',').replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/\\(?=\d)/g, '₩');
  }
  const DATE_RE = '(\\d{4}\\s*[.\\-/년]\\s*\\d{1,2}\\s*[.\\-/월]\\s*\\d{1,2}\\s*[.일]?\\s*(?:\\([가-힣]{1,3}\\))?)\\s*(\\d{1,2}\\s*:\\s*\\d{2}(?:\\s*[~-]\\s*\\d{1,2}:\\d{2})?)?';
  /* 표 머리글(입찰개시일·입찰마감일시·개찰일시…) 아래에 줄바꿈으로 흩어진 날짜·시각을 머리글 순서대로 짝짓는다 */
  function tableDates(flat) {
    const out = {}; const H = /(입찰\s*개시\s*일\s*시?|입찰\s*시작\s*일\s*시?|제출\s*시작\s*일\s*시?|참가\s*등록\s*마감\s*일\s*시?|입찰\s*(?:서\s*)?마감\s*일\s*시?|투찰\s*마감\s*일\s*시?|견적\s*마감\s*일\s*시?|개\s*찰\s*일\s*시?|재\s*입찰\s*일\s*시?)/g;
    /* 머리글 후보를 모두 모아 40자 이내로 붙은 것끼리 묶고, '마감'이 들어 있는 묶음을 고른다 ("입찰일시 및 개찰일시" 같은 제목 줄에 속지 않기 위함) */
    let m; const all = []; while ((m = H.exec(flat))) all.push({k: m[1].replace(/\s+/g, ''), idx: m.index, end: m.index + m[0].length});
    const group = sameLine => { const cl = []; all.forEach(x => { const c = cl[cl.length - 1]; const gap = c ? flat.slice(c[c.length - 1].end, x.idx) : ''; const near = c && (sameLine ? /^[ \t]{0,3}$/.test(gap) : x.idx - c[c.length - 1].end <= 40); if (near) c.push(x); else cl.push([x]); }); return cl.filter(c => c.length >= 2 && c.some(x => /마감/.test(x.k))); };
    const pick = group(true).sort((p, q) => q.length - p.length)[0] || group(false).sort((p, q) => q.length - p.length)[0];
    if (!pick) return out;
    const labels = pick; let last = pick[pick.length - 1].end;
    const rx = new RegExp(DATE_RE, 'g'); rx.lastIndex = last; const toks = []; let d;
    while ((d = rx.exec(flat)) && toks.length < labels.length && d.index - last < 400) { toks.push({date: d[1].replace(/\s+/g, ' ').trim(), time: (d[2] || '').replace(/\s+/g, ''), idx: d.index}); last = d.index + d[0].length; }
    if (toks.length < labels.length) return out;
    labels.forEach((l, i) => { const t = toks[i]; if (!t) return; const v = (t.date + (t.time ? ' ' + t.time : '')).trim(); const ev = snippet(flat, labels[0].idx, 60) + ' … ' + v;
      if (/마감/.test(l.k)) { if (!/참가등록/.test(l.k) && !out.due) out.due = {v, ev}; } else if (/^개찰/.test(l.k)) out.open = {v, ev}; else if (/개시|시작/.test(l.k) && !/재입찰/.test(l.k)) out.start = {v, ev}; });
    return out;
  }
  function snippet(text, idx, len) { const s = Math.max(0, idx - 24), e = Math.min(text.length, idx + len + 40); return text.slice(s, e).replace(/\s+/g, ' ').trim(); }
  function extractFields(raw) {
    const text = normText(raw);
    const flat = text.replace(/[ \t]+/g, ' ');
    const res = {}; const put = (key, label, value, m, conf, hint) => { if (res[key] || value === '' || value === null || value === undefined) return; res[key] = {key, label, value: String(value), evidence: m ? snippet(flat, m.index, m[0].length) : (hint || ''), conf}; };
    let m;
    const amt = (label, re, key, conf) => { const rx = new RegExp(re, 'g'); let best = null; while ((m = rx.exec(flat))) { const n = Number(m[1].replace(/,/g, '')); if (n >= 1000 && !best) best = {n, m}; } if (best) put(key, label, best.n, best.m, conf); };
    amt('기초금액', '기\\s*초\\s*금\\s*액\\s*[:：]?\\s*[(（]?\\s*(?:금\\s*)?(?:₩\\s*)?' + NUM + '\\s*(?:원|\\()?', 'base', 'high');
    if (!res.base) amt('기초금액(예비가격기초)', '(?:예비가격\\s*기초금액|기초\\s*예비가격|기준예비가격)\\s*[:：]?\\s*(?:₩\\s*)?' + NUM, 'base', 'mid');
    amt('추정가격', '추\\s*정\\s*가\\s*격\\s*[:：]?\\s*(?:금\\s*)?(?:₩\\s*)?' + NUM, 'est', 'high');
    amt('배정예산', '(?:배\\s*정\\s*예\\s*산|사업\\s*예산|예산\\s*금액|사업금액)\\s*[:：]?\\s*(?:금\\s*)?(?:₩\\s*)?' + NUM, 'budget', 'mid');
    const pctRe = (key, label, re, conf, valid) => { const rx = new RegExp(re, 'g'); while ((m = rx.exec(flat))) { const v = Number(m[1]); if (isFinite(v) && valid(v)) { put(key, label, String(v), m, conf); return; } } };
    pctRe('floor', '낙찰하한율', '낙\\s*찰\\s*하\\s*한\\s*율[^0-9]{0,24}([0-9]{2,3}(?:\\.[0-9]+)?)\\s*%', 'high', v => v > 50 && v <= 100);
    if (!res.floor) pctRe('floor', '낙찰하한율(최저입찰가 비율)', '(?:투찰\\s*하한율|최저\\s*낙찰\\s*률?|낙찰\\s*하한\\s*가율)[^0-9]{0,24}([0-9]{2,3}(?:\\.[0-9]+)?)\\s*%', 'mid', v => v > 50 && v <= 100);
    if (!res.floor && (m = /최저\s*가\s*낙찰/.exec(flat))) { /* 낙찰하한율 없는 최저가 방식은 값 생성 금지 */ }
    /* 입찰보증금: 면제 / 비율 */
    if ((m = /입찰\s*보증금[^.。\n]{0,40}?([0-9]+(?:\.[0-9]+)?)\s*%/.exec(flat))) put('bond', '입찰보증금율', m[1], m, 'high');
    else if ((m = /입찰\s*(?:이행\s*)?보증금[^.。\n]{0,30}?면제/.exec(flat))) put('bondExempt', '입찰보증금', '면제', m, 'high');
    else if ((m = /입찰\s*보증금[^.。]{0,60}?(?:납부\s*이행\s*각서|지급\s*각서)[^.。]{0,12}(?:갈음|대체)/.exec(flat))) put('bondExempt', '입찰보증금', '납부이행각서로 갈음', m, 'high');
    /* 예가 변동폭 */
    if ((m = /(?:예비\s*가격|예\s*가|기초\s*금액)[^.\n]{0,40}?[±]\s*([0-9]+(?:\.[0-9]+)?)\s*%/.exec(flat)) || (m = /[±]\s*([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:범위|이내|내)/.exec(flat))) put('range', '예비가격 변동폭 ±(%)', m[1], m, 'high');
    else if ((m = /[-−]\s*\(?\s*([0-9]+(?:\.[0-9]+)?)\s*\)?\s*%\s*(?:~|∼|～|에서|-)\s*\+?\s*\(?\s*\+?\s*([0-9]+(?:\.[0-9]+)?)\s*\)?\s*%/.exec(flat))) {
      if (m[1] === m[2]) put('range', '예비가격 변동폭 ±(%)', m[1], m, 'mid');
      else { put('rangeLo', '예가범위 하한 −(%)', m[1], m, 'mid'); put('rangeHi', '예가범위 상한 +(%)', m[2], m, 'mid'); }
    }
    if (!res.range && !res.rangeLo && (m = /\(\s*-\s*([0-9.]+)\s*\)\s*%\s*~\s*\(\s*\+\s*([0-9.]+)\s*\)\s*%/.exec(flat))) { if (m[1] === m[2]) put('range', '예비가격 변동폭 ±(%)', m[1], m, 'mid'); else { put('rangeLo', '예가범위 하한 −(%)', m[1], m, 'mid'); put('rangeHi', '예가범위 상한 +(%)', m[2], m, 'mid'); } }
    /* 업무 메모 서식: "정가: $ 4,500 * (usd) 1152.80 = 5,187,600 원" · "5,000,000 * 88% = 4,440,000 원" · "D.C (부가세 포함) 25%" */
    { const CUR = {'$': 'USD', 'US$': 'USD', 'USD': 'USD', '€': 'EUR', 'EUR': 'EUR', '£': 'GBP', 'GBP': 'GBP', '¥': 'JPY', '엔': 'JPY', 'JPY': 'JPY', '₩': 'KRW'};
      const lp = /정\s*가\s*[:：]?\s*(US\$|\$|USD|€|EUR|£|GBP|¥|JPY|₩)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]+)?)\s*(US\$|USD|EUR|GBP|JPY)?\s*[*×xX]\s*\(?\s*(usd|eur|gbp|jpy|엔)?\s*\)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*=\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/i.exec(flat);
      if (lp) { const c = CUR[(lp[1] || lp[3] || lp[4] || '').toUpperCase()] || CUR[lp[1] || lp[3] || lp[4] || ''] || ''; put('list', '보고서 정가(외화)', lp[2].replace(/,/g, ''), lp, 'high'); if (c) put('cur', '정가 통화', c, lp, 'high'); put('fx', '적용 환율', lp[5].replace(/,/g, ''), lp, 'high'); put('listKrw', '정가 원화환산', lp[6].replace(/,/g, ''), lp, 'high'); }
      const fm = /([0-9]{1,3}(?:,[0-9]{3})+)\s*원?\s*[*×xX]\s*([5-9][0-9](?:\.[0-9]+)?)\s*%\s*=\s*([0-9]{1,3}(?:,[0-9]{3})+)/.exec(flat);
      if (fm) { const a = Number(fm[1].replace(/,/g, '')), f = Number(fm[2]), b = Number(fm[3].replace(/,/g, '')), d = Math.abs(a * f / 100 - b); if (d <= 2) put('floor', '낙찰하한율(계산식에서)', fm[2], fm, 'high'); else if (d / b <= 0.02) put('floor', '낙찰하한율(계산식에서 · 결과 숫자가 약간 다름)', fm[2], fm, 'mid', '메모의 계산식 결과(' + fm[3] + ')가 ' + fm[1] + '×' + fm[2] + '%=' + Math.round(a * f / 100).toLocaleString('ko-KR') + ' 와 다릅니다 — 확인 필요'); }
      const tj = new RegExp('(?:^|\\n|\\s)투찰\\s*[:\\[]\\s*' + DATE_RE).exec(text.replace(/[ \t]+/g, ' ')); if (tj) put('due', '입찰마감일시(투찰 메모)', (tj[1].replace(/\s+/g, ' ').trim() + ' ' + (tj[2] || '').replace(/\s+/g, '')).trim(), tj, 'mid');
      const dcm = /D\s*\.?\s*C\.?\s*(?:\([^)]{0,12}\))?\s*[:]?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i.exec(flat); if (dcm) put('dc', 'D.C(디스카운트) %', dcm[1], dcm, 'mid'); }
    /* 예정가격 결정방식 */
    if ((m = /복수\s*예비\s*가격|복수\s*예가/.exec(flat))) put('method', '예정가격 결정방식', 'multi', m, 'high');
    else if ((m = /단일\s*예가|단일\s*예정\s*가격|예정\s*가격\s*[:：]?\s*단일/.exec(flat))) put('method', '예정가격 결정방식', 'single', m, 'mid');
    /* 공고번호·공고명·기관·마감 */
    if ((m = /(?:공고\s*번호|입찰\s*공고\s*번호)\s*[:：]?\s*(?:제\s*)?(\d{8}\s*-\s*\d{2,4})\s*호?/.exec(flat))) put('no', '공고번호', m[1].replace(/\s/g, ''), m, 'high');
    else if ((m = /(?:공고\s*번호|입찰\s*공고\s*번호)\s*[:：]?\s*([A-Za-z]?\d{4}[-]?\d{5,8}(?:-\d{2})?|\d{11,15}(?:-\d{2})?)/.exec(flat))) put('no', '공고번호', m[1], m, 'high');
    else if ((m = /\b(\d{11}-\d{2})\b/.exec(flat))) put('no', '공고번호', m[1], m, 'mid');
    else if ((m = /공고\s*제\s*(\d{4}\s*-\s*\d+)\s*호/.exec(flat))) put('no', '공고번호(기관 자체번호)', m[1].replace(/\s/g, ''), m, 'mid');
    else if ((m = /(?:^|[^A-Za-z0-9])([bBcC]\d{4}-\d{6}(?:-\d{2})?)(?![0-9])/.exec(flat))) put('no', '공고번호', m[1], m, 'mid');
    if ((m = /(?:공\s*고\s*명|입찰\s*건\s*명|사\s*업\s*명|건\s*명)\s*[:：]\s*([^\n]{3,120})/.exec(text)) || (m = /(?:^|\n|\t)\s*공\s*고\s*명\s*\t+\s*([^\t\n]{4,160})/.exec(text)) ||(m = /(?:^|\n)\s*건\s*명\s*\n\s*([^\n]{3,120})/.exec(text))) { const nv = m[1].trim(); if (!/:\s*$/.test(nv) && !/^(?:공고\s*번호|공고\s*명|건\s*명|사업명|입찰\s*건명)\s*:?\s*$/.test(nv) && nv.length >= 4) put('name', '공고명', nv, m, 'high'); }
    if ((m = /(?:수요\s*기관|발주\s*기관|공고\s*기관)\s*[:：]\s*([^\n:]{2,60})/.exec(text)) && !/의뢰|해당|말한다/.test(m[1])) put('org', '수요기관', m[1].trim(), m, 'high');
    else if ((m = /설명서는\s*((?:\([^)]{1,6}\))?[가-힣A-Za-z0-9·\s]{2,40}?)\s*이\s*집행/.exec(flat))) put('org', '수요기관', m[1].trim(), m, 'high');
    else if ((m = /개찰\s*장소\s*[:：]\s*((?:\([^)]{1,6}\))?[가-힣A-Za-z0-9·]{2,40}?)\s*(?:입찰\s*집행\s*관|입찰집행|PC)/.exec(flat))) put('org', '수요기관', m[1].trim(), m, 'mid');
    else if ((m = /(?:^|\n)\s*([가-힣A-Za-z0-9·() ]{2,40}?)\s+공고\s*제\s*\d{4}\s*-\s*\d+\s*호/.exec(text))) put('org', '수요기관(공고 머리말 기준)', m[1].trim(), m, 'mid');
    const td = tableDates(flat);
    if (td.due) put('due', '입찰마감일시', td.due.v, null, 'high', td.due.ev); if (td.open) put('open', '개찰일시', td.open.v, null, 'high', td.open.ev); if (td.start) put('start', '입찰개시일시', td.start.v, null, 'high', td.start.ev);
    const dl = (label, key, conf) => { const rx = new RegExp(label + '\\s*[:\\[\\(]?\\s*' + DATE_RE); const mm = rx.exec(flat); if (mm) put(key, key === 'due' ? '입찰마감일시' : key === 'open' ? '개찰일시' : '입찰개시일시', (mm[1].replace(/\s+/g, ' ').trim() + ' ' + (mm[2] || '').replace(/\s+/g, '')).trim(), mm, conf); };
    dl('(?:입찰\\s*서?\\s*(?:접수\\s*)?마감(?:\\s*일시|\\s*일)?|투찰\\s*마감(?:\\s*일시|\\s*일)?|견적\\s*(?:서\\s*)?(?:제출\\s*)?마감(?:\\s*일시|\\s*일)?|입찰\\s*마감(?:\\s*일시|\\s*일)?)', 'due', 'mid');
    /* "투찰 기간 2017-09-26 09:00 ~ 2017-09-26 14:00" · "견적서 제출기간 : 2018. 10. 05.(금) 09:00 ~ 2018. 10. 11.(목) 12:00" → 시작 ~ 마감 */
    { const pr = new RegExp('(?:투찰|입찰서?|견적서?|제출|접수)\\s*(?:서\\s*)?(?:제출\\s*)?기간\\s*[:\\[\\(]?\\s*' + DATE_RE + '\\s*[~-]\\s*' + DATE_RE).exec(flat);
      if (pr) { put('start', '입찰개시일시', (pr[1].replace(/\s+/g, ' ').trim() + ' ' + (pr[2] || '').replace(/\s+/g, '')).trim(), pr, 'high'); put('due', '입찰마감일시', (pr[3].replace(/\s+/g, ' ').trim() + ' ' + (pr[4] || '').replace(/\s+/g, '')).trim(), pr, 'high'); } }
    /* "- 개시 : 2015. 2. 24 (화요일) 10:10 / - 마감 : 2015. 2. 24 (화요일) 14:00" */
    dl('(?:^|\\n|-)\\s*마감', 'due', 'mid'); dl('(?:^|\\n|-)\\s*개시', 'start', 'mid');
    dl('개\\s*찰\\s*(?:일\\s*시|일\\s*자|일)(?:\\s*및\\s*장소)?', 'open', 'mid'); dl('입찰\\s*서?\\s*(?:접수\\s*)?(?:개시|시작)(?:\\s*일시|\\s*일)?', 'start', 'mid');
    /* 면세·과세: 공고에 부가가치세 금액이 따로 적혀 있으면 과세(가장 확실) → 면세 명시 → 부가세 별도 → 품목 키워드(약한 추정) */
    let vm;
    if ((vm = /부가\s*(?:가치)?세(?:액)?\s*[:=]?\s*(?:₩\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[1-9][0-9]{3,})\s*원/.exec(flat))) { put('vatAmt', '부가가치세액', vm[1].replace(/,/g, ''), vm, 'high'); put('taxmode', '면세/과세', 'tax', vm, 'high'); }
    if ((m = /부가\s*(?:가치)?세\s*(?:면세|영세율)|면세\s*(?:사업자|물품|대상|품목)|(?:면세|부가세\s*없음)/.exec(flat))) put('taxmode', '면세/과세', 'free', m, 'mid');
    else if ((m = /부가\s*(?:가치)?세\s*(?:별도|제외)/.exec(flat))) put('taxmode', '면세/과세', 'tax', m, 'low', '공고에 "부가세 별도" 표기 — 과세 품목인지 확인 필요');
    else if ((m = /도서|정기간행물|학술지|저널/.exec(flat))) put('taxmode', '면세/과세', 'free', m, 'low', '도서·간행물 키워드(면세 품목일 가능성) — 공고문으로 확인 필요');
    /* 원가계산서·산출내역서: 공급가액 / 부가가치세 / 총계 */
    const sm = (re, key, label) => { const mm = re.exec(flat); if (mm) { const n = Math.round(Number(mm[1].replace(/,/g, ''))); if (n > 0) put(key, label, n, mm, 'high'); } };
    sm(/총\s*합\s*계[^0-9₩\n]{0,60}([0-9]{4,}(?:\.[0-9]+)?)/, 'total', '총합계');
    sm(/공\s*급\s*가\s*액[^0-9₩\n]{0,40}(?:₩\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})/, 'supply', '공급가액');
    if (!res.vatAmt) sm(/부\s*가\s*가\s*치\s*세[^0-9₩\n]{0,40}(?:₩\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,})/, 'vatAmt', '부가가치세액');
    sm(/(?:총\s*계|합\s*계\s*금\s*액|총\s*금\s*액|견\s*적\s*금\s*액|입찰\s*금\s*액)[^0-9₩\n]{0,40}(?:₩\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,})/, 'total', '총계(합계금액)');
    if (!res.total) sm(/일금[^()\n]{2,30}\(\s*₩?\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*\)/, 'total', '총계(합계금액)');
    if (res.supply && res.vatAmt && !res.taxmode) put('taxmode', '면세/과세', Number(res.vatAmt.value) > 0 ? 'tax' : 'free', null, 'high', '공급가액 ' + res.supply.value + ' / 부가세 ' + res.vatAmt.value);
    if (res.supply && res.vatAmt && Number(res.vatAmt.value) > 0 && res.taxmode && res.taxmode.value !== 'tax') res.taxmode = {key: 'taxmode', label: '면세/과세', value: 'tax', evidence: '부가가치세 ' + res.vatAmt.value + '원 표기', conf: 'high'};
    /* 추정소요예산 ₩ 18,478,112 (363권) — 구입 목록 머리말 */
    if ((m = /추정\s*소요\s*예산\s*:?\s*[₩\\]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*\(\s*([0-9][0-9,]*)\s*(권|점|부|개|건)\s*\)/.exec(flat))) { put('budget', '추정소요예산', m[1].replace(/,/g, ''), m, 'mid'); put('qty', '총 수량', m[2].replace(/,/g, ''), m, 'mid'); }
    if ((m = /발\s*행\s*사\s*[:：]\s*([^\n/]{2,60})/.exec(text))) put('pub', '발행사', m[1].trim(), m, 'high');
    /* 참가자격·계약 조건(매뉴얼 3번 15항목 중): 지역제한 · 소기업/소상공인 확인서 · 공동계약 · 지문인식 · 계약방법 · 적격심사 대상 여부 */
    if ((m = /지역\s*제한(?:\s*경쟁)?[^.\n]{0,40}|(?:관할구역|소재)[^.\n]{0,20}(?:업체|사업자)/.exec(flat))) put('region', '지역 제한', m[0].replace(/\s+/g, ' ').trim().slice(0, 60), m, 'mid');
    if ((m = /(?:소기업|소상공인|중소기업)[·\s,및과]*(?:소상공인)?\s*확인서[^.\n]{0,20}(?:소지|제출|보유)|확인서\s*소지\s*업체/.exec(flat))) put('smeReq', '소기업·소상공인(중소기업) 확인서 요구', '필요', m, 'mid');
    if ((m = /공동\s*(?:계약|수급|도급)\s*(?:은\s*)?(불허|허용|가능|불가|하지\s*않)/.exec(flat))) put('joint', '공동계약', /불허|불가|하지/.test(m[1]) ? '불허' : '허용', m, 'mid');
    if ((m = /지문\s*인식\s*신원\s*확인/.exec(flat))) put('fingerprint', '지문인식 신원확인 입찰', '적용', m, 'mid');
    if ((m = /(?:계약\s*방법|계약\s*방식)\s*[:：]?\s*([가-힣()·\s]{2,20}?)(?=\s{2,}|\n|$|[,.])/.exec(flat))) put('cmethod', '계약방법', m[1].trim(), m, 'mid');
    if ((m = /적격\s*심사\s*(비\s*대상|대상)/.exec(flat))) put('evalTarget', '적격심사', m[1].replace(/\s/g, ''), m, 'mid');
    /* 수량 */
    if ((m = /구입\s*수량\s*[:]?\s*([0-9][0-9,]*)\s*(부|권|책|점|개|매|세트|건)/.exec(flat))) put('qty', '구입 수량', m[1].replace(/,/g, ''), m, 'high');
    if ((m = /총\s*([0-9][0-9,]*)\s*(부|권|책|점|개|매|세트|건|EA)(?![A-Za-z의])/.exec(flat))) put('qty', '총 수량', m[1].replace(/,/g, ''), m, 'mid');
    if ((m = /(?:종당|품목당|건당)\s*([0-9][0-9,]*)\s*(부|권|책|점|개|매|세트)/.exec(flat))) put('qtyEach', '품목당 수량', m[1].replace(/,/g, ''), m, 'mid');
    if ((m = /총\s*([0-9]+)\s*종/.exec(flat))) put('kinds', '품목 종류 수', m[1], m, 'mid');
    /* 부가세 포함 여부 */
    if ((m = /(?:부가\s*(?:가치)?세\s*포함|VAT\s*포함)/i.exec(flat))) put('vatIncl', '금액 부가세 포함 여부', 'incl', m, 'mid');
    else if ((m = /(?:부가\s*(?:가치)?세\s*(?:별도|제외)|VAT\s*(?:별도|제외))/i.exec(flat))) put('vatIncl', '금액 부가세 포함 여부', 'excl', m, 'mid');
    return res;
  }
  /* 품목·수량·단가 표 추출: (a) "① 품목명 40" 형태 행  (b) 머리글에 품명/수량(/단가·정가/금액)이 있는 표 */
  function extractItems(raw) {
    const text = normText(raw), items = [], seen = new Set();
    const push = it => { const k = it.name + '|' + it.qty + '|' + (it.unit || ''); if (seen.has(k) || items.length >= 500) return; seen.add(k); items.push(it); };
    let m; const re = /(?:^|\n)[ \t]*([①-⑳])[ \t]*([^\n]{4,100}?)[ \t]+([0-9]{1,5})[ \t]*(?=\n|$)/g;
    while ((m = re.exec(text))) { const name = m[2].trim(); if (/^[0-9.,\s~×x()면부종매]+$/.test(name) || /^[0-9]+\s*(?:면|부|종)/.test(name) || !(/\p{L}/u.test(name) && name.length >= 2)) continue; push({name, qty: Number(m[3]), src: '번호 행'}); }
    const lines = text.split('\n'); const HN = /(품\s*명|품\s*목|도서명|서\s*명|자료명|물품명|간행물명|제\s*목|명\s*칭|규\s*격|ITEM|Title)/i, HQ = /(수\s*량|부\s*수|책\s*\(\s*점\s*\)|권\s*수|QTY)/i, HQ2 = /^\s*개\s*수\s*$/, HU = /(단\s*가|정\s*가|가\s*격|Price)/i, HA = /(금\s*액|Amount)/i;
    for (let i = 0; i < lines.length; i++) {
      const cells = lines[i].split(/\t| {2,}/).map(s => s.trim()); if (cells.length < 3) continue;
      const iN = cells.findIndex(c => HN.test(c)), iQ = cells.findIndex(c => HQ.test(c)); if (iN < 0 || iQ < 0 || iN === iQ) continue;
      const iQ2 = cells.findIndex(c => HQ2.test(c)), iU = cells.findIndex(c => HU.test(c)), iA = cells.findIndex(c => HA.test(c)); let blank = 0, miss = 0;
      for (let j = i + 1; j < lines.length && blank < 3 && miss < 4 && items.length < 500; j++) {
        const row = lines[j].split(/\t| {2,}/).map(s => s.trim()); if (row.every(c => !c)) { blank++; continue; } blank = 0;
        const name = (row[iN] || '').replace(/^[①-⑳]\s*/, ''); let q = num(row[iQ]); const u = iU >= 0 ? num(row[iU]) : {s: 'empty'}, a = iA >= 0 ? num(row[iA]) : {s: 'empty'};
        if (q.s === 'empty' && !str(row[iQ]).trim() && row.filter(c => c).length >= 4) q = {s: 'ok', n: 1}; /* 수량 칸이 비어도 여러 칸이 채워진 실제 품목 행이면 1 (도서 목록의 '책(점)' 빈 칸) */
        if (!name || q.s !== 'ok' || !(q.n > 0) || !(/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(name) ? name.length >= 2 : (/\p{L}/u.test(name) && name.length >= 3)) || /^[*(]/.test(name) || /^(합\s*계|소\s*계|총\s*계)/.test(name.replace(/\s/g, ''))) { miss++; continue; } miss = 0;
        let qty = q.n, unit = u.s === 'ok' ? u.n : null; if (iQ2 >= 0) { const q2 = num(row[iQ2]); if (q2.s === 'ok' && q2.n > 0) { /* 정기간행물: 수량=부수, 단가=정가×개수(연간) — 금액과 맞춘다 */ unit = a.s === 'ok' && q.n > 0 ? a.n / q.n : (unit !== null ? unit * q2.n : null); } }
        push({name, qty, unit, amount: a.s === 'ok' ? a.n : null, src: '표'});
      }
    }
    return items;
  }
  /* 업무 메모 여러 건(점선으로 구분): "공고일 … * 투찰 : 2016 / 11/22 / 10시10분 / B2016-000856-00 · * 제목 · * 발행사 … $ 7,095 · * 정가 … · * 기준예비가격 : 8,000,000 원 · 8,000,000원 X 88% = … DC : 27 %" */
  function extractMemoBlocks(raw) {
    const text = normText(raw); const byDate = text.split(/(?=^[ \t]*\*?[ \t]*공고일\s*:)/m); const blocks = (byDate.length > 2 ? byDate : text.split(/\n[ \t]*-{8,}[ \t]*(?:\n|$)/)).map(b => b.replace(/\n[ \t]*-{8,}[ \t]*(?:\n|$)/g, '\n')).filter(b => /기준\s*예비\s*가격/.test(b)); const out = [];
    blocks.forEach(b => {
      const no = (/(?:^|[^A-Za-z0-9])([bBcC]\d{4}-\d{6}(?:-\d{2})?)(?![0-9])/.exec(b) || [])[1] || '';
      const dm = /투찰\s*[:]\s*(\d{4})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/ ]\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?)?/.exec(b);
      const pad = n => String(n).padStart(2, '0'); const due = dm ? `${dm[1]}-${pad(dm[2])}-${pad(dm[3])}` + (dm[4] ? ` ${pad(dm[4])}:${pad(dm[5] || 0)}` : '') : '';
      const lines = b.split('\n').map(l => l.trim()).filter(Boolean); let name = '';
      const si = lines.findIndex(l => /^\*?\s*발행사/.test(l)); const hi = lines.findIndex(l => /공고일/.test(l));
      if (si > hi + 0 && si >= 0) name = lines.slice(hi + 1, si).map(l => l.replace(/^\*\s*/, '')).join(' ').trim();
      const base = (/기준\s*예비\s*가격\s*[:]?\s*([0-9]{1,3}(?:,[0-9]{3})+)/.exec(b) || [])[1], floor = (/[0-9,]{5,}\s*원?\s*[*×xX]\s*([5-9][0-9](?:\.[0-9]+)?)\s*%/.exec(b) || [])[1], dc = (/D\s*\.?\s*C\.?\s*[:]?\s*([0-9.]+)\s*%/i.exec(b) || [])[1];
      const lp = /정\s*가\s*[:]?\s*(\$|€|£|¥)?\s*([0-9][0-9,.]*)/.exec(b); const pub = (/발행사\s*[:]\s*([^/\n]+?)\s*(?:\/|$)/.exec(b) || [])[1];
      out.push({no, name, due, base: base ? base.replace(/,/g, '') : '', floor: floor || '', dc: dc || '', list: lp ? lp[2].replace(/,/g, '') : '', cur: lp && lp[1] === '$' ? 'USD' : lp && lp[1] === '€' ? 'EUR' : '', pub: (pub || '').trim()});
    });
    return out;
  }
  /* 글자 품질: 스캔본의 인식 글자층처럼 깨진 글자가 많으면 낮게 나온다 (0~1). 의미 있는 글자(한글·영문 단어·숫자) 비율 + 한글/영문 단어 형태 비율 */
  function textQuality(raw) {
    const t = str(raw).replace(/\s+/g, ' ').trim(); if (t.length < 20) return 1;
    const good = (t.match(/[가-힣]{2,}|[A-Za-z]{3,}|[0-9][0-9,.]*/g) || []).join('').length; return Math.min(1, good / t.replace(/\s/g, '').length);
  }
  /* 제출서류 키워드 탐지 */
  const DOC_KEYS = [
    ['reg', /경쟁\s*입찰\s*참가\s*자격\s*등록\s*증|입찰\s*참가\s*자격\s*등록/], ['biz', /사업자\s*등록\s*증/], ['seal', /사용\s*인감\s*계|인감\s*증명/],
    ['small', /소상공인\s*확인서|중소기업\s*(?:기본\s*)?확인서|중소기업자\s*확인/], ['direct', /직접\s*생산\s*확인/], ['integ', /청렴\s*이행|청렴\s*서약|청렴\s*계약/],
    ['apply', /입찰\s*참가\s*신청서|입찰\s*참가\s*자격\s*신청/], ['bidform', /물품\s*구매\s*입찰서|입찰서/], ['bond', /입찰\s*보증금\s*지급\s*각서|입찰\s*보증금/],
    ['fair', /불공정\s*행위\s*확약/], ['sub', /하도급\s*대금\s*직불/], ['cost', /산출\s*내역서|물품\s*내역서|견적서|내역서/], ['record', /납품\s*실적|실적\s*증명/],
    ['proxy', /위임장|입찰\s*대리인/], ['cert', /공인\s*인증서|범용\s*인증서|전자\s*거래\s*범용/], ['sec', /보안\s*(?:서약|계약|각서)/], ['cbond', /계약\s*보증금/],
    ['emp', /재직\s*증명/], ['corpreg', /등기부\s*등본|법인\s*등기/], ['tax', /납세\s*증명|국세\s*완납|지방세\s*납세/], ['insure', /계약\s*보증\s*보험|보증\s*보험\s*증권/], ['credit', /신용\s*평가|경영\s*상태/], ['spec', /규격서|제안서|기술\s*(?:심사|평가)/]
  ];
  function detectDocs(raw) { const t = str(raw).replace(/\s+/g, ' '); const hit = {}; DOC_KEYS.forEach(([k, re]) => { const m = re.exec(t); if (m) hit[k] = snippet(t, m.index, m[0].length); }); return hit; }

  /* ───────── 제출서류 체크리스트 (근거: 입찰.zip 의 경쟁입찰참가자격등록·KISTI 절차·물품구매입찰서 화면·1년 갱신 문서) ───────── */
  const CHECKLIST = [
    {stage: '0 사전·상시', id: 'reg', t: '경쟁입찰참가자격등록증 (사본)', src: '입찰.zip: 경쟁입찰참가자격등록증-2015-02-04.pdf · 갱신 신청서에 첨부(붙임 1)', gen: false},
    {stage: '0 사전·상시', id: 'biz', t: '사업자등록증 (사본)', src: '인증서·조달등록 신청 시 일반 제출서류(나라장터 안내문)', gen: false},
    {stage: '0 사전·상시', id: 'cert', t: '전자거래범용 공인인증서 — 해당 기관 입찰시스템에 등록', src: '나라장터 안내문·ETRI 전자입찰 안내(우리 연구원 입찰시스템에 등록한 인증서 선택)', gen: false},
    {stage: '0 사전·상시', id: 'seal', t: '사용인감계 (사용인감 날인 시 추가 첨부)', src: '입찰.zip: 사용인감계.pdf · KISTI 갱신 신청서 안내', gen: false},
    {stage: '0 사전·상시', id: 'small', t: '소상공인확인서(또는 중소기업확인서) — 유효기간 확인, 만료 다음 날부터 갱신(1년 단위)', src: '입찰.zip: 1년마다 업데이트 사항.doc · 소상공인확인서.pdf', gen: false},
    {stage: '0 사전·상시', id: 'emp', t: '재직증명서 (입찰 담당자 · 필요 시)', src: '입찰.zip: 재직증명서 폴더', gen: false},
    {stage: '1 참가·투찰', id: 'apply', t: '입찰참가신청서 / 참가자격 서류 제출(해당 시)', src: 'ETRI 전자입찰 안내: 참가자격 서류제출 단계(압축 첨부)', gen: 'apply'},
    {stage: '1 참가·투찰', id: 'bidform', t: '물품구매입찰서 — 투찰금액(부가세 등 제세포함 총액) 입력', src: '입찰.zip: 물품구매입찰서.jpg (나라장터 화면)', gen: 'bidform'},
    {stage: '1 참가·투찰', id: 'bond', t: '입찰보증금 지급각서 (면제대상자에게 적용)', src: '물품구매입찰서 화면 하단 각서 문구', gen: 'bond'},
    {stage: '1 참가·투찰', id: 'fair', t: '불공정행위 여부 확약서 (경쟁입찰 참가자) — 입찰서 화면에서 동의', src: '물품구매입찰서 화면 하단', gen: false},
    {stage: '1 참가·투찰', id: 'sub', t: '하도급대금 직불조건부 입찰참가 확약서 — 입찰서 화면에서 동의', src: '물품구매입찰서 화면 하단', gen: false},
    {stage: '1 참가·투찰', id: 'integ', t: '청렴이행서약서 (기관 시스템에서 동의·출력)', src: '입찰.zip: 방위사업청 청렴이행서약서.jpg', gen: false},
    {stage: '1 참가·투찰', id: 'cost', t: '산출내역서 / 물품내역서 (공고에서 요구 시)', src: '요청 항목: 산출내역서 — 본 도구에서 초안 생성', gen: 'cost'},
    {stage: '2 계약(낙찰 당일~다음날)', id: 'ct1', t: '전자계약 → 계약현황에서 계약번호 확인 → 표준계약서(물품) 작성', src: 'KISTI 낙찰시 검수 및 대금지급 절차.doc ①②', gen: 'contract'},
    {stage: '2 계약(낙찰 당일~다음날)', id: 'sec', t: '보안계약서 동의 · 청렴이행각서 동의', src: 'KISTI 절차.doc ②', gen: false},
    {stage: '2 계약(낙찰 당일~다음날)', id: 'cbond', t: '계약보증금지급각서 — 출력 → 사용 도장 날인 → 스캔 → 첨부 (계약보증금 = 계약금의 10%)', src: 'KISTI 절차.doc ②', gen: 'contract'},
    {stage: '2 계약(낙찰 당일~다음날)', id: 'ct2', t: '물품내역서 입력: 품목구분=공고명, 제조사=발행사, 옵션=PDF, 소비자가=기준예비가격의 88%, 단위 1·수량 1, 납품가=계약금액', src: 'KISTI 절차.doc ②', gen: 'contract'},
    {stage: '3 납품·검수·대금', id: 'ins', t: '검수요청서 작성 → 계약담당자 결재 → 검수부서', src: 'KISTI 절차.doc ③', gen: false},
    {stage: '3 납품·검수·대금', id: 'pay', t: '대금 청구 → 계약담당자 결재 · 결재 문자 미수신 시 재무관리실 연락 · 수요자에게 PDF 송부 기한 문의', src: 'KISTI 절차.doc ④ · 대금요청 현황 화면(실제 화면 캡처)', gen: 'payreq'}
  ];

  /* 공고문에서 발견됐지만 기본 목록에 없는 서류 → 체크리스트 "공고문 발견" 항목으로 추가 */
  const EXTRA_DOCS = {corpreg: '등기부등본 (법인인 경우)', tax: '납세증명서 / 국세 완납증명', insure: '계약보증보험증권 (계약보증금 대체 시)', record: '납품실적증명서', direct: '직접생산확인증명서', credit: '신용평가·경영상태 확인서', spec: '규격서·기술(제안) 서류', proxy: '위임장 · 입찰대리인 서류'};

  /* ───────── 서류 초안 생성 ───────── */
  const escH = s => str(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const blank = v => (str(v).trim() === '' ? '＿＿＿＿＿＿＿＿ (확인 필요)' : escH(v));
  /* 산출내역서: 투찰금액(총액)을 품목 정가(원화환산) 비율로 배분, 마지막 품목이 끝수 흡수 */
  function allocate(items, total) {
    const w = items.map(it => { const p = num(it.list), q = num(it.qty), fx = it.cur === 'KRW' ? 1 : num(it.fx); const base = (p.s === 'ok' && q.s === 'ok' && (it.cur === 'KRW' || fx.s === 'ok')) ? p.n * q.n * (it.cur === 'KRW' ? 1 : fx.n) : 0; return base; });
    const sum = w.reduce((a, b) => a + b, 0); const eq = !(sum > 0);
    let acc = 0; return items.map((it, i) => { const q = num(it.qty).s === 'ok' ? num(it.qty).n : 1; let amt; if (i === items.length - 1) amt = total - acc; else { amt = Math.round(total * (eq ? 1 / items.length : w[i] / sum)); acc += amt; } return {name: it.name, pub: it.pub, qty: q, unitPrice: q ? Math.round(amt / q) : amt, amt, eq}; });
  }
  function costSheetRows(notice, items, total, taxfree, vatRate) {
    const al = allocate(items, total); const head = ['산출내역서'], rows = [head, ['공고번호', notice.no || '(확인 필요)'], ['공고명', notice.name || '(확인 필요)'], ['수요기관', notice.org || '(확인 필요)'], [], ['번호', '품목', '발행사(제조사)', '규격', '단위', '수량', '단가(원)', '금액(원)']];
    al.forEach((a, i) => rows.push([i + 1, a.name, a.pub || '', 'PDF', '1', a.qty, a.unitPrice, a.amt]));
    const supply = taxfree ? total : Math.round(total / (1 + vatRate / 100)); rows.push([], ['', '', '', '', '', '', '공급가액', supply], ['', '', '', '', '', '', '부가세', total - supply], ['', '', '', '', '', '', '합계(투찰금액)', total]);
    rows.push([], ['※ 투찰금액을 품목 정가(원화환산) 비율로 배분한 초안입니다. 배분 방식·규격 표기는 공고 요구에 맞게 확인 후 사용하세요.']); return rows;
  }
  const docWrap = (title, body) => '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + escH(title) + '</title><style>@page{size:A4;margin:20mm}body{font-family:"Malgun Gothic",Arial,sans-serif;font-size:11pt;line-height:1.6}h1{font-size:20pt;text-align:center;margin:0 0 16pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:5pt 7pt;vertical-align:top}th{background:#eee;width:28%;text-align:left}.c{text-align:center}.note{font-size:9pt;color:#444}.sig{margin-top:28pt;text-align:right}</style></head><body>' + body + '<p class="note">※ 본 문서는 도구가 입력값으로 만든 초안입니다. 빈칸(확인 필요)과 문구는 해당 기관 공고·시스템 양식과 대조해 확정하세요.</p></body></html>';
  function docApply(n, co, bid) {
    return docWrap('입찰참가신청서', '<h1>입 찰 참 가 신 청 서</h1><table><tr><th>공고번호</th><td>' + blank(n.no) + '</td></tr><tr><th>공고명</th><td>' + blank(n.name) + '</td></tr><tr><th>수요기관(귀하)</th><td>' + blank(n.org) + '</td></tr><tr><th>입찰마감일시</th><td>' + blank(n.due) + '</td></tr><tr><th>입찰금액(부가세 등 제세포함)</th><td>' + (bid ? '금 ' + won(bid) + ' 원' : blank('')) + '</td></tr><tr><th>상호</th><td>' + blank(co.name) + '</td></tr><tr><th>대표자</th><td>' + blank(co.ceo) + '</td></tr><tr><th>사업자등록번호</th><td>' + blank(co.biz) + '</td></tr><tr><th>주소</th><td>' + blank(co.addr) + '</td></tr><tr><th>전화</th><td>' + blank(co.tel) + '</td></tr><tr><th>입찰 담당자</th><td>' + blank(co.mgr) + '</td></tr></table><p>위 공고에 대하여 입찰참가자격을 갖추고 입찰유의서 및 공고 조건을 숙지하여 입찰에 참가하고자 신청합니다.</p><p class="sig">년 &nbsp; 월 &nbsp; 일<br>신청인 ' + blank(co.name) + ' (인)</p>');
  }
  function docBidForm(n, co, bid, taxfree) {
    return docWrap('물품구매입찰서 입력값', '<h1>물 품 구 매 입 찰 서 (입력값 정리)</h1><p class="note">나라장터 「물품구매입찰서」 화면의 칸 이름 기준입니다. 화면의 회색(자동) 칸은 공고에서 불러와지며, 아래 값은 직접 입력해야 하는 칸입니다.</p><table><tr><th>입찰공고번호</th><td>' + blank(n.no) + '</td></tr><tr><th>공고명</th><td>' + blank(n.name) + '</td></tr><tr><th>수요기관(귀하)</th><td>' + blank(n.org) + '</td></tr><tr><th>입찰마감일시</th><td>' + blank(n.due) + '</td></tr><tr><th>원산지</th><td>대한민국 (화면 기본 입력값)</td></tr><tr><th>총액 / 투찰금액(원)</th><td>' + (bid ? won(bid) : blank('')) + ' <span class="note">※ 투찰금액(총액)은 부가세 등 제세포함가격 — ' + (taxfree ? '면세 품목' : '과세 품목') + '</span></td></tr><tr><th>수량</th><td>1 (희망수량 입찰이 아니면 총액 입력)</td></tr><tr><th>입찰 담당자</th><td>' + blank(co.mgr) + '</td></tr></table><p>[ ] 위 투찰금액 결정관련 유의사항을 숙지하고, 이에 동의합니다. (화면 체크박스는 직접 선택)</p>');
  }
  function docBond(n, co, bid) {
    return docWrap('입찰보증금 지급각서', '<h1>입 찰 보 증 금 지 급 각 서</h1><p class="note">입찰보증금 면제대상자에게 적용 — 나라장터 물품구매입찰서 화면 하단 각서 문구 기준</p><table><tr><th>공고번호</th><td>' + blank(n.no) + '</td></tr><tr><th>공고명</th><td>' + blank(n.name) + '</td></tr><tr><th>입찰금액</th><td>' + (bid ? '금 ' + won(bid) + ' 원 (낙찰금액의 5% 이상 = ' + won(Math.ceil(bid * 0.05)) + ' 원 이상)' : blank('')) + '</td></tr></table><p>이 입찰에서 본인이 낙찰자로 선정된 후 정당한 이유없이 소정의 기일내에 계약을 체결하지 않아 입찰보증금의 국고귀속 사유가 발생한 경우에는 귀기관의 요청에 따라 국가를 당사자로하는계약에관한법률시행령 제38조(입찰보증금의 국고귀속)의 규정에 의한 낙찰금액의 5%이상에 해당하는 입찰보증금을 지체없이 귀기관에 현금으로 납입하겠으며, 기타 입찰보증금의 국고귀속 사유로 인한 여하한 조치에 대하여도 귀기관의 결정 또는 요구에 따를 것을 확약합니다.</p><p class="sig">년 &nbsp; 월 &nbsp; 일<br>' + blank(co.name) + ' 대표자 ' + blank(co.ceo) + ' (인)</p>');
  }
  /* 계약 단계 입력 카드 — KISTI 절차 문서의 문구 그대로(해석 여지가 있는 부분은 확인 필요로 표기) */
  function contractCard(n, bid, base, F) {
    const contract = bid ? Math.round(bid * 0.9) : null;
    return {contract, exVat: bid ? Math.round(bid / 1.1) : null, bond: contract ? Math.round(contract * 0.1) : null, consumer: base ? Math.round(base * (F || 88) / 100) : null};
  }
  /* 대금 청구(KISTI 전자조달 「대금요청 현황」 화면 칸 기준 입력값) — 계약금액·요청금액·세액·계산서 구분 */
  function docPayReq(n, co, bid, taxfree) {
    const supply = bid ? (taxfree ? bid : Math.round(bid / 1.1)) : null, vat = bid ? (taxfree ? 0 : bid - supply) : null;
    return docWrap('대금요청서 입력값', '<h1>대 금 요 청 (입력값 정리)</h1><p class="note">전자조달 「대금요청 현황」 화면의 칸 이름 기준. 계약번호·검수번호는 계약·검수 완료 후 화면에서 선택하는 값이라 비워 둡니다. 금액은 입력한 확정 투찰금액 기준 계산값이며 기관 시스템의 계약금액과 다르면 시스템 값이 우선입니다(확인 필요).</p><table><tr><th>계약번호</th><td>' + blank('') + '</td></tr><tr><th>계약명</th><td>' + blank(n.name) + '</td></tr><tr><th>검수번호</th><td>' + blank('') + '</td></tr><tr><th>계약금액(원)</th><td>' + (supply ? won(supply) : blank('')) + ' <span class="note">' + (taxfree ? '면세 품목 — 부가세 0' : '투찰금액 ÷ 1.1 (과세)') + '</span></td></tr><tr><th>지급 구분</th><td>잔금 (선금 / 중도금 / 잔금 중 선택)</td></tr><tr><th>지급 방법</th><td>현금</td></tr><tr><th>계산서 구분</th><td>' + (taxfree ? '계산서(면세) — 확인 필요' : '세금계산서(전자) — 확인 필요') + '</td></tr><tr><th>계산서 발행일</th><td>' + blank('') + '</td></tr><tr><th>요청 금액(원)</th><td>' + (supply ? won(supply) : blank('')) + '</td></tr><tr><th>세액(원)</th><td>' + (vat === null ? blank('') : won(vat)) + '</td></tr><tr><th>요청 총금액(원)</th><td>' + (supply ? won(supply + vat) : blank('')) + '</td></tr><tr><th>첨부파일</th><td>4대보험 완납증명서 등 통장사본·납부증명서 (유효기간 확인)</td></tr><tr><th>보증 방법</th><td>해당없음 (계약보증금 면제 시) — 확인 필요</td></tr><tr><th>요청자</th><td>' + blank(co.name) + '</td></tr></table>');
  }
  function docContract(n, co, bid, base, F) {
    const c = contractCard(n, bid, base, F);
    return docWrap('계약 단계 입력 카드', '<h1>계약(낙찰 후) 입력 카드</h1><p class="note">근거: KISTI 「낙찰시 검수 및 대금지급 관리까지 절차」 ②. 아래 "계약금액 = 투찰금액에서 10% 제외"는 해당 문서의 기재 문구를 그대로 적용한 값이며(면세 사업자 사유), 기관별로 다를 수 있어 <b>확인 필요</b>.</p><table><tr><th>품목 구분</th><td>' + blank(n.name) + ' (입찰공고 현황의 공고명 복사)</td></tr><tr><th>제조사</th><td>발행사 이하 (물품내역서 부분 복사)</td></tr><tr><th>옵션사항</th><td>PDF</td></tr><tr><th>소비자가</th><td>' + (c.consumer ? won(c.consumer) + ' 원 (기준예비가격의 ' + (F || 88) + '%' + (F ? '' : ' — 낙찰하한율 미입력, KISTI 문서 기본값') + ')' : blank('')) + '</td></tr><tr><th>단위 / 수량</th><td>1 / 1</td></tr><tr><th>납품가(계약금액)</th><td>' + (c.contract ? won(c.contract) + ' 원 (투찰금액 ' + won(bid) + ' − 10%)' : blank('')) + '</td></tr><tr><th>참고: 투찰금액 ÷ 1.1 (VAT 제외)</th><td>' + (c.exVat ? won(c.exVat) + ' 원 — 실제 계약에서 계약금액이 이 산식으로 정해진 사례가 있어 기관 시스템의 계약금액과 대조 필요(확인 필요)' : blank('')) + '</td></tr><tr><th>계약보증금(계약금의 10%)</th><td>' + (c.bond ? won(c.bond) + ' 원' : blank('')) + '</td></tr></table><p>계약보증금지급각서: 파일 열기 → 출력 → 회사 사용 도장 날인 → 스캔 → 첨부파일에 끌어서 첨부. 결재 요청 후 처리까지 시간이 걸립니다.</p>');
  }
  /* 입찰장부 1행 (입찰장부.xls Sheet1 · 26열 헤더 · 정본 그대로) — 수식은 값으로 계산해 넣는다 */
  const LEDGER_HEAD = ['상호', '공고번호', '공고명', '수요자정보', '계약담당자', '낙찰\n하한율', '추정예산\n(VAT포함)', '투찰기간', '모델명', '발행사', '기준예비가격\n(10% 부가세포함)', '낙찰하한율', '(주관사)디스\n카운트(%)\n(부가세포함)', '예비가격범위', '범위(-2)', '범위(-1)', '범위(0)', '범위(+1)', '범위(+2)', '투찰가격', '보고서가격\n(달러)', '보고서가격\n(엔화)', '환율', '(발행사)디스\n카운트(%)', '월드산업\n원가', '개찰조회'];
  function ledgerRow(n, f, bid, cost) {
    const K = f.base, F = f.floor, L = K && F ? Math.round(K * F / 100) : '', R = f.range;
    const sc = p => (L && R >= Math.abs(p) && p !== null) ? Math.round(L * (1 + p / 100)) : '';
    const row = new Array(26).fill('');
    row[0] = f.company || ''; row[1] = n.no || ''; row[2] = n.name || ''; row[3] = ''; row[4] = ''; row[5] = F ? F + '%' : ''; row[6] = f.budgetIncl || ''; row[7] = n.due || ''; row[8] = f.model || ''; row[9] = f.pub || '';
    row[10] = K || ''; row[11] = L; row[13] = R ? `(-${R})%~(+${R})%` : ''; row[14] = R >= 2 ? sc(-2) : ''; row[15] = R >= 1 ? sc(-1) : ''; row[16] = L; row[17] = R >= 1 ? sc(1) : ''; row[18] = R >= 2 ? sc(2) : '';
    row[19] = bid || ''; if (f.cur === 'USD') row[20] = f.list || ''; if (f.cur === 'JPY') row[21] = f.list || ''; row[22] = f.fx || ''; row[23] = f.coef || ''; row[24] = cost || '';
    return row;
  }

  /* ───────── 파일 → 텍스트 ───────── */
  /* 스트림 끝의 패딩·쓰레기 바이트(CFB 섹터 여유, PDF 줄바꿈)로 인한 오류는 이미 나온 출력을 살려서 허용 */
  async function inflate1(u8, fmt) {
    const ds = new DecompressionStream(fmt); const w = ds.writable.getWriter(); w.write(u8).catch(() => {}); w.close().catch(() => {});
    const rd = ds.readable.getReader(), chunks = []; let n = 0, err = null;
    try { for (;;) { const r = await rd.read(); if (r.done) break; chunks.push(r.value); n += r.value.length; } } catch (e) { err = e; }
    if (err && !n) throw err;
    const out = new Uint8Array(n); let p = 0; chunks.forEach(c => { out.set(c, p); p += c.length; }); return out;
  }
  async function inflate(u8, fmt) { let err; for (const cut of [0, 1, 2]) { try { return await inflate1(cut ? u8.subarray(0, u8.length - cut) : u8, fmt); } catch (e) { err = e; } } throw err; }
  async function inflateAny(u8) { try { return await inflate(u8, 'deflate-raw'); } catch (e) { return await inflate(u8, 'deflate'); } }
  async function hwpText(buf, XLSX) {
    const cfb = XLSX.CFB.read(new Uint8Array(buf), {type: 'array'});
    const hdr = XLSX.CFB.find(cfb, 'FileHeader'); if (!hdr) throw new Error('HWP 5.x 형식이 아님(FileHeader 없음) — 한글에서 텍스트로 저장 후 올려 주세요');
    const hc = hdr.content, flags = hc[36] | (hc[37] << 8) | (hc[38] << 16); const compressed = !!(flags & 1), encrypted = !!(flags & 2), dist = !!(flags & 4);
    if (encrypted) throw new Error('암호가 걸린 HWP 입니다 — 열어서 텍스트로 저장 후 올려 주세요');
    let out = '';
    for (let i = 0; i < 200; i++) {
      const e = XLSX.CFB.find(cfb, '/BodyText/Section' + i); if (!e) break;
      let c = new Uint8Array(e.content);
      if (compressed || dist) { try { c = await inflateAny(c); } catch (er) { throw new Error('HWP 본문 압축 해제 실패(배포용 문서일 수 있음) — 텍스트로 저장 후 올려 주세요'); } }
      let p = 0; const dv = new DataView(c.buffer, c.byteOffset, c.byteLength);
      while (p + 4 <= c.length) { const h = dv.getUint32(p, true); const tag = h & 0x3ff; let size = (h >>> 20) & 0xfff; p += 4; if (size === 0xfff) { size = dv.getUint32(p, true); p += 4; }
        if (tag === 67) { let s = ''; for (let k = 0; k + 1 < size; k += 2) { const ch = dv.getUint16(p + k, true); if (ch === 13) s += '\n'; else if (ch === 9) s += '\t'; else if (ch === 10) s += '\n'; else if (ch >= 32) s += String.fromCharCode(ch); else if (ch === 24 || ch === 25 || ch === 30 || ch === 31) s += ' '; else if ((ch >= 1 && ch <= 8) || (ch >= 11 && ch <= 12) || (ch >= 14 && ch <= 23)) { k += 14; } } out += s + '\n'; }
        p += size; }
    }
    if (!out.trim()) throw new Error('HWP 본문 텍스트를 찾지 못했습니다'); return out;
  }
  /* Word 97-2003(.doc): CFB 의 WordDocument 스트림 + Clx(조각 표)에서 본문 글자를 읽는다 (MS-DOC) */
  const CP1252 = {0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178};
  function docText(buf, XLSX) {
    const cfb = XLSX.CFB.read(new Uint8Array(buf), {type: 'array'}); const wd = XLSX.CFB.find(cfb, 'WordDocument');
    if (!wd) throw new Error('Word 문서(.doc)가 아니거나 형식이 다릅니다 — .docx 로 저장하거나 내용을 붙여넣어 주세요');
    const w = new Uint8Array(wd.content), dv = new DataView(w.buffer, w.byteOffset, w.byteLength);
    if (dv.getUint16(0, true) !== 0xa5ec) throw new Error('Word 97-2003 형식이 아닙니다 — .docx 로 저장하거나 내용을 붙여넣어 주세요');
    const flags = dv.getUint16(0x0a, true); if (flags & 0x0100) throw new Error('암호가 걸린 .doc 입니다 — 열어서 저장 후 올려 주세요');
    const tbl = XLSX.CFB.find(cfb, (flags & 0x0200) ? '1Table' : '0Table'); if (!tbl) throw new Error('.doc 표 스트림을 찾지 못했습니다');
    const t = new Uint8Array(tbl.content), tv = new DataView(t.buffer, t.byteOffset, t.byteLength);
    const fcClx = dv.getUint32(0x1a2, true), lcbClx = dv.getUint32(0x1a6, true), ccpText = dv.getInt32(0x4c, true);
    let p = fcClx; const end = fcClx + lcbClx; while (p < end && t[p] === 1) p += 3 + tv.getUint16(p + 1, true);
    if (t[p] !== 2) throw new Error('.doc 조각 표(Clx)를 해석하지 못했습니다');
    const lcb = tv.getUint32(p + 1, true), plc = p + 5, n = Math.floor((lcb - 4) / 12); let out = '';
    for (let i = 0; i < n; i++) {
      const cpS = tv.getUint32(plc + i * 4, true), cpE = tv.getUint32(plc + (i + 1) * 4, true); if (cpS >= ccpText) break; const cnt = Math.min(cpE, ccpText) - cpS; if (cnt <= 0) continue;
      let fc = tv.getUint32(plc + (n + 1) * 4 + i * 8 + 2, true), comp = !!(fc & 0x40000000); fc &= 0x3fffffff;
      if (comp) { const off = fc >> 1; for (let k = 0; k < cnt; k++) { const b = w[off + k]; out += String.fromCharCode(CP1252[b] || b); } }
      else for (let k = 0; k < cnt; k++) out += String.fromCharCode(dv.getUint16(fc + k * 2, true));
    }
    let res = '', skip = 0;
    for (const ch of out) { const c = ch.charCodeAt(0);
      if (c === 0x13) { skip++; continue; } if (c === 0x14) { if (skip) skip--; continue; } if (c === 0x15) { continue; } if (skip) continue;
      if (c === 13 || c === 11 || c === 10) res += '\n'; else if (c === 7 || c === 9) res += '\t'; else if (c === 12) res += '\n'; else if (c >= 32 || c === 0) res += c === 0 ? '' : ch; }
    res = res.replace(/\t\n/g, '\n').replace(/\n{3,}/g, '\n\n'); if (res.replace(/\s/g, '').length < 5) throw new Error('.doc 본문 글자를 찾지 못했습니다'); return res;
  }
  async function zipXmlText(buf, XLSX, names) {
    const cfb = XLSX.CFB.read(new Uint8Array(buf), {type: 'array'}); let out = '';
    for (let i = 0; i < cfb.FullPaths.length; i++) { const fp = cfb.FullPaths[i]; if (names.test(fp)) { const c = cfb.FileIndex[i].content; if (c) out += new TextDecoder('utf-8').decode(new Uint8Array(c)).replace(/<\/(?:w:p|hp:p|text:p)>/g, '\n').replace(/<[^>]+>/g, '') + '\n'; } }
    if (!out.trim()) throw new Error('문서에서 본문을 찾지 못했습니다'); return out;
  }
  /* PDF: 텍스트 계층이 있는 PDF 의 최선 추출(ToUnicode 통합 매핑). 스캔본은 불가 → 안내 */
  async function pdfText(buf) {
    const u8 = new Uint8Array(buf), latin = (a, s, e) => { let r = ''; for (let i = s; i < e; i++) r += String.fromCharCode(a[i]); return r; };
    const src = latin(u8, 0, u8.length); const streams = []; const re = /stream\r?\n/g; let m;
    while ((m = re.exec(src))) { const s = m.index + m[0].length; const e = src.indexOf('endstream', s); if (e < 0) break; const dict = src.slice(Math.max(0, m.index - 400), m.index); const d = dict.slice(dict.lastIndexOf('<<')); streams.push({s, e, flate: /FlateDecode/.test(d)}); re.lastIndex = e; }
    const map = new Map(), pages = [];
    for (const st of streams) {
      let data = u8.subarray(st.s, st.e); if (st.flate) { try { data = await inflate(data, 'deflate'); } catch (e) { try { data = await inflateAny(data.subarray(0, data.length)); } catch (e2) { continue; } } }
      const txt = latin(data, 0, Math.min(data.length, 3e6));
      if (/beginbf(?:char|range)/.test(txt)) {
        const hx = h => parseInt(h, 16); let mm; const rc = /<([0-9A-Fa-f]{2,4})>\s*<([0-9A-Fa-f]{4,8})>/g; const sec = txt.split(/beginbfchar/).slice(1).map(x => x.split('endbfchar')[0]);
        sec.forEach(blk => { rc.lastIndex = 0; while ((mm = rc.exec(blk))) map.set(hx(mm[1]), String.fromCharCode(hx(mm[2].slice(0, 4)))); });
        const rr = /<([0-9A-Fa-f]{2,4})>\s*<([0-9A-Fa-f]{2,4})>\s*<([0-9A-Fa-f]{4})>/g; const sec2 = txt.split(/beginbfrange/).slice(1).map(x => x.split('endbfrange')[0]);
        sec2.forEach(blk => { rr.lastIndex = 0; while ((mm = rr.exec(blk))) { const a = hx(mm[1]), b = hx(mm[2]), u = hx(mm[3]); for (let c = a; c <= b && c - a < 70000; c++) map.set(c, String.fromCharCode(u + (c - a))); } });
      } else if (/\bBT\b/.test(txt) && /\bET\b/.test(txt)) pages.push(txt);
    }
    const dec = (h, lit) => { if (lit !== undefined) { let r = ''; for (let i = 0; i < lit.length; i++) { const c = lit.charCodeAt(i); r += map.has(c) && map.size && false ? '' : String.fromCharCode(c); } return r; } let r = ''; const two = h.length % 4 === 0; if (two) { let hit = 0, tot = 0; for (let i = 0; i < h.length; i += 4) { tot++; if (map.has(parseInt(h.substr(i, 4), 16))) hit++; } if (hit / Math.max(1, tot) > 0.5) { for (let i = 0; i < h.length; i += 4) { const c = parseInt(h.substr(i, 4), 16); r += map.has(c) ? map.get(c) : ''; } return r; } } for (let i = 0; i + 1 < h.length; i += 2) { const c = parseInt(h.substr(i, 2), 16); r += map.has(c) ? map.get(c) : String.fromCharCode(c); } return r; };
    let out = '';
    pages.forEach(pg => {
      const tj = /\[((?:[^\]\\]|\\.)*)\]\s*TJ|<([0-9A-Fa-f]+)>\s*Tj|\(((?:[^()\\]|\\.)*)\)\s*Tj|(T\*|ET|-?[\d.]+\s+-?[\d.]+\s+T[dD])/g; let mm;
      while ((mm = tj.exec(pg))) {
        if (mm[1] !== undefined) { const parts = /<([0-9A-Fa-f]+)>|\(((?:[^()\\]|\\.)*)\)/g; let pp; while ((pp = parts.exec(mm[1]))) out += pp[1] !== undefined ? dec(pp[1]) : dec(null, pp[2].replace(/\\(.)/g, '$1')); }
        else if (mm[2] !== undefined) out += dec(mm[2]); else if (mm[3] !== undefined) out += dec(null, mm[3].replace(/\\(.)/g, '$1'));
        else if (mm[4]) { if (mm[4] === 'ET' || mm[4] === 'T*' || /-\d/.test(mm[4].split(/\s+/)[1] || '')) out += '\n'; }
      }
      out += '\n';
    });
    out = out.replace(/\n{3,}/g, '\n\n'); if (out.replace(/\s/g, '').length < 30) throw new Error('PDF 에서 글자를 읽지 못했습니다(스캔본이거나 글꼴 매핑 불가). 내용을 복사해 붙여넣거나 텍스트로 저장해 올려 주세요'); return out;
  }
  async function fileToText(file, XLSX, opts) {
    opts = opts || {};
    const name = file.name || '', ext = (name.split('.').pop() || '').toLowerCase(); const buf = await file.arrayBuffer();
    if (['xlsx', 'xls', 'csv', 'tsv', 'xlsm'].includes(ext)) { const wb = XLSX.read(new Uint8Array(buf), {type: 'array'}); let t = ''; wb.SheetNames.forEach(sn => { XLSX.utils.sheet_to_json(wb.Sheets[sn], {header: 1, defval: ''}).forEach(r => { const line = r.map(c => str(c).replace(/[\r\n]+/g, ' ')).join('\t').replace(/\s+$/, ''); if (line.trim()) t += line + '\n'; }); }); return t; }
    if (['txt', 'md', 'json', 'url'].includes(ext)) return new TextDecoder('utf-8').decode(new Uint8Array(buf));
    if (['html', 'htm'].includes(ext)) return new TextDecoder('utf-8').decode(new Uint8Array(buf)).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<\/(?:p|div|tr|li|h\d)>/gi, '\n').replace(/<\/t[dh]>/gi, '\t').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
    if (ext === 'hwp') return hwpText(buf, XLSX);
    if (ext === 'hwpx') return zipXmlText(buf, XLSX, /Contents\/section\d*\.xml$/i);
    if (ext === 'docx') return zipXmlText(buf, XLSX, /word\/document\.xml$/i);
    if (ext === 'pdf') { if (g.WICPDF) return g.WICPDF(buf, file, !!opts.forceOcr); return pdfText(buf); }
    if (ext === 'doc') return docText(buf, XLSX);
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff', 'webp'].includes(ext)) { if (g.WICOCR && g.WICOCR.enabled()) { file.__ocr = true; return g.WICOCR.image(file); } throw new Error('이미지(스캔본)는 글자 인식(OCR)이 꺼져 있어 읽지 못합니다 — OCR 을 켜거나, 내용을 입력하거나 텍스트로 붙여넣어 주세요'); }
    throw new Error('지원하지 않는 형식(.' + ext + ')');
  }

  g.BIDENG = {str, num, won, pct, mulRate, floorLimit, bidBySajung, calc, reverify, recommend, simulate, passProb, histogram, extractFields, extractItems, extractMemoBlocks, textQuality, normText, tableDates, detectDocs, DOC_KEYS, CHECKLIST, EXTRA_DOCS, HIST, LIST_STATS, ORG_RANGE, allocate, costSheetRows, docApply, docBidForm, docBond, docContract, docPayReq, contractCard, LEDGER_HEAD, ledgerRow, fileToText, pdfText, hwpText, escH};
  if (typeof module !== 'undefined') module.exports = g.BIDENG;
})(typeof window !== 'undefined' ? window : globalThis);
