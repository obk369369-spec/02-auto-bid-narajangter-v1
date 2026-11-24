/* 범용 투찰 전략 엔진 (v3.2) — 5가지 변수로 공고 성격을 진단하고, 근거가 있는 숫자만으로 투찰 구간을 계산한다.
   [임의 가짜 숫자 금지] 이 파일의 모든 수치는 다음 세 근거에서만 나온다.
     ① 실측 데이터   : 우리 입찰장부·KISTI 개찰 기록(비공개 본 qa/장부) — 표본 수를 함께 표시, 통계로 확대하지 않음
     ② 공고·기관 규칙: 공고문에 적힌 낙찰하한율·예가범위·기초금액·평가표(없으면 "기본 평가표" 로 표시하고 공고 값으로 교체 요구)
     ③ 사용자 입력   : 실제 원가(정가×환율×매입계수)·대외 안내 기준·목표 마진율·예상 경쟁 할인율 (경쟁 가정은 "가정"으로 표시)
   근거가 모자라 낙찰 구간을 계산할 수 없으면(예: 하한율 없는 최저가) 구간을 만들어내지 않고 "산출 불가"로 두고, 사용자가 입력칸으로 조절하는 투명한 계산 표(simulate grid)만 제공한다.
   보편 88%·공공입찰 평균(86.9%/90.4% 등)·허용 폭 같은 근거 없는 상수는 사용하지 않는다(출처 미확인 통계는 계산에서 제외).
   내부 원가·커미션·순이익은 화면 전용 — leak.scan() 이 모든 .xls/.doc 출력 직전에 검사해 발견되면 내려받기를 막는다. */
(function (g) {
  'use strict';
  const E = g.BIDENG || require('./engine.js'); const P = E.pricing || require('./pricing.js'); const {num, won} = E;
  const r3 = x => Math.round(x * 1000) / 1000;

  /* 근거 라벨 — 화면의 모든 숫자에 붙는다 */
  const SRC = {
    rule: {key: 'rule', label: '공고 규칙 기반', cls: 'src-rule'},
    measured: {key: 'measured', label: '실측 데이터 기반 (우리 장부·KISTI 개찰)', cls: 'src-meas'},
    input: {key: 'input', label: '사용자 입력 조건 기반', cls: 'src-input'},
    assume: {key: 'assume', label: '사용자 가정 (시뮬레이션 · 근거 데이터 아님)', cls: 'src-assume'},
    deflt: {key: 'deflt', label: '기본 평가표 (공고 평가표 값으로 교체 필요)', cls: 'src-def'}
  };

  /* ───────── 변수 ① 발주 기관 유형 · ③ 영업/독점성 · ④ 계약 조건: 공고 성격 진단용 분류(숫자를 만들지 않는다) ───────── */
  const ORG_TYPES = {
    research: {name: '출연연 자체 구매시스템 (KISTI·한국화학연구원·ETRI 등)', hint: /KISTI|한국과학기술정보|한국화학연구원|ETRI|한국전자통신|출연|연구원|연구소|KRICT|KIST/i},
    g2b: {name: '나라장터 (G2B · 조달청)', hint: /조달청|나라장터|G2B/i},
    s2b: {name: '학교장터 (S2B) · 대학', hint: /대학|학교|S2B|교육청|산학협력단/i},
    d2b: {name: '국방전자조달 (D2B) · 공기업', hint: /국방|방위|D2B|공사|공단|한국전력|KEPCO|철도|수자원/i},
    other: {name: '그 밖의 공공기관·일반', hint: null}
  };
  const SALES = {prequote: '사전 견적 제출 공고', exclusive: '발행사 단독 공급권', nonexcl: '발행사 비독점 공급권', open: '일반 공개경쟁'};
  const CONTRACT = {single: '단건 납품', unit: '단가계약', annual: '연간 구독'};
  const AWARD = {lowest: '단순 최저가', floor: '복수예가 낙찰하한율제', eval: '적격심사', nego: '협상에 의한 계약(기술+가격)'};
  function detectOrg(text) { const t = String(text || ''); for (const k of ['g2b', 'research', 's2b', 'd2b']) { if (ORG_TYPES[k].hint && ORG_TYPES[k].hint.test(t)) return k; } return 'other'; }
  function detectOrgKey(text) { const t = String(text || ''); if (/KISTI|한국과학기술정보연구원/i.test(t)) return 'kisti'; if (/한국화학연구원|KRICT/i.test(t)) return 'kric'; if (/ETRI|한국전자통신연구원/i.test(t)) return 'etri'; return ''; }

  /* ① 실측 데이터: 개찰 기록(1등 낙찰금액 ÷ 기초금액). 같은 낙찰방식(복수예가 낙찰하한율제)의 기록만 쓴다 — 다른 방식에 억지 적용 금지. 비공개 본(E.kisti)에만 존재 */
  function measuredFor(orgKey, award) {
    if (orgKey === 'kisti' && award === 'floor' && E.kisti && E.kisti.summary) { try { return E.kisti.summary().wins.filter(w => w.rateOfBase != null).map(w => ({rate: w.rateOfBase, no: w.no, src: 'KISTI 개찰 상세조회 1등 기록 ' + w.no})); } catch (e) { return []; } }
    return [];
  }

  /* ───────── 실제 매입 원가(내부용): 정가 × 환율 × (1 − 실제 커미션) (+부대비용) ───────── */
  function internalCost(p, errors) {
    const L = num(p.list), FX = num(p.fx), C = num(p.commission), X = num(p.extra); const cur = p.cur || 'KRW';
    if (p.commission === '' || p.commission == null) { if (p.costOverride != null && p.costOverride > 0) return {cost: p.costOverride, k: null, note: '기존 입력의 원가(장부 방식)를 사용'}; return null; }
    if (L.s !== 'ok' || !(L.n > 0)) { errors.push('발행사 정가 입력 필요 (실제 원가 계산용)'); return null; }
    const fx = cur === 'KRW' ? 1 : (FX.s === 'ok' && FX.n > 0 ? FX.n : null); if (fx === null) { errors.push('통화 ' + cur + ' 의 환율 입력 필요'); return null; }
    if (C.s !== 'ok' || C.n < 0 || C.n >= 100) { errors.push('실제 커미션은 0 이상 100 미만(%)'); return null; }
    const k = 1 - C.n / 100, extra = X.s === 'ok' && X.n > 0 ? X.n : 0, base = Math.round(L.n * fx * k);
    return {cost: base + extra, k, extra, commission: C.n, fx, listKrw: Math.round(L.n * fx), note: `실제 원가 = 정가 ${L.n.toLocaleString('ko-KR')} ${cur} × 환율 ${fx} × 매입계수 ${r3(k)} (실제 커미션 ${C.n}%)${extra ? ' + 부대비용 ' + won(extra) : ''} = ${won(base + extra)}원`};
  }

  /* ───────── 핵심 분석 ───────── */
  function analyze(p) {
    const errors = [], warns = [], reasons = [], layers = []; const out = {ok: false, errors, warns, reasons, layers, src: SRC};
    const org = ORG_TYPES[p.org] ? p.org : 'other', award = AWARD[p.award] ? p.award : '', sales = SALES[p.sales] ? p.sales : 'open', taxfree = p.tax === 'free', contract = CONTRACT[p.contract] ? p.contract : 'single';
    const vatRate = p.bidVat != null ? p.bidVat : (taxfree ? 0 : (num(p.vat).s === 'ok' ? num(p.vat).n : 10));
    const ref = Number(p.ref); if (!(ref > 0)) errors.push('기준 금액(기초금액) 확인 필요');
    if (!award) errors.push('낙찰방식을 먼저 정하세요 (최저가·하한율제·적격심사·협상) — 추측하지 않습니다');
    const cst = internalCost(p, errors);
    const opt = k => { const v = num(p[k]); if (v.s === 'ok') return v.n; if (v.s === 'bad') errors.push(k + ': 숫자가 아님'); return null; };
    const minM = opt('minMargin') || 0, guide = (x => (x != null && x > 0 ? x : null))(opt('guide')), tLo = opt('tlo'), tHi = opt('thi'), tMargin = opt('targetMargin'), compDisc = opt('compDisc'), compGap = opt('compGap'), step = (x => (x != null && x > 0 ? x : 5))(opt('step'));
    if (guide != null && guide > 100) errors.push('대외 안내 비율은 100% 이하');
    if (errors.length) return Object.assign(out, {errors});
    const supplyOf = bid => (vatRate > 0 ? P.splitVat(bid, vatRate).supply : bid);
    const bidAt = rate => Math.floor(ref * Math.round(rate * 1000) / 100000 + 1e-9);
    const rateOf = bid => ref ? bid / ref * 100 : 0;
    const profile = {org, orgName: ORG_TYPES[org].name, award, awardName: AWARD[award], sales, salesName: SALES[sales], urgent: !!p.urgent, rebid: !!p.rebid, tax: taxfree ? 'free' : 'tax', contract, contractName: CONTRACT[contract], hasCost: !!cst, guide};
    out.profile = profile; out.ref = ref; out.cost = cst ? cst.cost : null; out.costNote = cst ? cst.note : null; out.vatRate = vatRate; out.minMargin = minM; out.guide = guide;
    const lines = []; const mk = (id, label, bid, src, detail) => { const L = {id, label, bid, rate: r3(rateOf(bid)), src, detail: detail || ''}; lines.push(L); return L; };
    /* ③ 사용자 입력: 적자 방어선·대외 안내선 */
    let beBid = null, guideBid = null;
    if (cst) { const need = Math.ceil(cst.cost * (1 + minM / 100) - 1e-6); beBid = vatRate === 0 ? need : P.totalFromSupply(need, vatRate); mk('BE', '적자 방어선 (실제 원가' + (minM ? ' + 최소마진 ' + minM + '%' : '') + ')', beBid, SRC.input, cst.note); }
    if (guide != null) { guideBid = bidAt(guide); mk('GD', '대외 안내선 ' + guide + '%', guideBid, SRC.input, '고객에게 안내한 조건 — 이 아래로 쓰면 안내를 어김'); }
    mk('CAP', '기초금액 상한 (100%)', ref, SRC.rule, '기초금액 초과 투찰은 무효 위험');
    const lows = [beBid, guideBid].filter(x => x != null); const defBid = lows.length ? Math.max(...lows) : null;
    out.breakEven = beBid == null ? null : {bid: beBid, rate: r3(rateOf(beBid))}; out.guideLine = guideBid == null ? null : {bid: guideBid, rate: guide};
    out.defense = defBid == null ? null : {bid: defBid, rate: r3(rateOf(defBid)), src: SRC.input, why: guideBid != null && guideBid >= (beBid || 0) ? '대외 안내 기준' : '적자 방어(원가+최소마진)'};
    /* ② 공고 규칙 · ① 실측: 낙찰 가능 구간 */
    let zone = null, winStatus = 'insufficient', basisNote = '';
    if (award === 'floor') {
      const fb = p.floorBand; if (!fb || !(fb.max > 0)) { errors.push('낙찰하한율제 구간은 ① 공고 정보의 하한율·예가범위가 필요합니다'); return Object.assign(out, {errors}); }
      zone = {lo: Math.ceil(fb.min), hi: Math.floor(fb.max), src: SRC.rule}; winStatus = 'rule'; basisNote = `낙찰하한가는 예정가격에 따라 ${won(fb.min)}~${won(fb.max)}원 사이에서 움직입니다 (공고 하한율 ${fb.floorRate}% · 예가범위 반영). 아래끝 미만은 어떤 경우에도 탈락, 위쪽 끝 이상은 항상 통과.`;
      mk('FL', '하한가 변동 아래끝 (이보다 낮으면 항상 탈락)', zone.lo, SRC.rule, '공고 낙찰하한율 × 예정가격 최저'); mk('FH', '하한가 변동 위쪽 끝 (항상 통과)', zone.hi, SRC.rule, '공고 낙찰하한율 × 예정가격 최고');
      layers.push({id: 'rule', label: '입찰 방식 규칙 (복수예가 낙찰하한율제)', detail: basisNote, src: SRC.rule});
    } else if (award === 'eval') {
      const g2 = k => (num(p[k]).s === 'ok' ? num(p[k]).n : null); const has = ['evalRef', 'evalWeight', 'evalK', 'evalOther', 'evalPass'].every(k => g2(k) != null);
      const ep = {ref: g2('evalRef') == null ? 88 : g2('evalRef'), weight: g2('evalWeight') == null ? 70 : g2('evalWeight'), k: g2('evalK') == null ? 2 : g2('evalK'), otherScore: g2('evalOther') == null ? 30 : g2('evalOther'), pass: g2('evalPass') == null ? 85 : g2('evalPass')}; const src = has ? SRC.rule : SRC.deflt;
      const mr = P.minPassRate(ep);
      if (mr == null) { warns.push('가격평점이 모자라 통과점수에 닿을 수 없습니다 — 평가표 확인 필요'); }
      else { zone = {lo: Math.ceil(ref * mr / 100), hi: Math.ceil(ref * ep.ref / 100), src}; winStatus = has ? 'rule' : 'rule_default'; basisNote = `가격평점 = ${ep.weight} − ${ep.k}×|${ep.ref} − 투찰률|, 통과 ${ep.pass}점(기타 ${ep.otherScore}점) → 통과 최저 투찰률 ${mr}% ~ 평점 최고 ${ep.ref}%`; mk('EL', '심사 통과 최저선 (' + mr + '%)', zone.lo, src, basisNote); mk('EH', '가격평점 최고점 (' + ep.ref + '%)', zone.hi, src, basisNote); }
      layers.push({id: 'rule', label: '입찰 방식 규칙 (적격심사 가격평점)', detail: basisNote || '산출 불가', src});
      if (!has) warns.push('적격심사 평가표(기준율·배점·감점·기타점수·통과점수)를 공고에서 입력하지 않아 조달청 기본값으로 계산했습니다 — 공고 평가표 확인 필요.');
    } else if (award === 'nego') {
      winStatus = 'nego'; layers.push({id: 'rule', label: '입찰 방식 규칙 (협상에 의한 계약)', detail: '기술+가격 합산 평가 — 가격만으로 구간을 정할 수 없음', src: SRC.rule});
      warns.push('협상에 의한 계약은 기술점수가 좌우합니다. 적자 방어선·기초금액 상한만 제시하고 낙찰 구간은 산출하지 않습니다.');
    } else {
      winStatus = 'insufficient'; layers.push({id: 'rule', label: '입찰 방식 규칙 (단순 최저가)', detail: '하한율이 없고 공고에 구간을 정할 수치가 없음 — 가장 낮은 가격이 낙찰', src: SRC.rule});
    }
    /* ① 실측 층 */
    const meas = measuredFor(p.orgKey, award);
    if (meas.length) { const avg = meas.reduce((a, b) => a + b.rate, 0) / meas.length; layers.push({id: 'meas', label: '과거 개찰 실측 (낙찰가÷기초금액)', detail: meas.map(m => m.rate.toFixed(2) + '%').join(' · ') + ` — 표본 ${meas.length}건 (통계 아님 · 위치 확인용)`, src: SRC.measured, rates: meas.map(m => m.rate)}); meas.forEach(m => mk('M' + m.no, '과거 1등 ' + m.no + ' (' + m.rate.toFixed(2) + '%)', Math.round(ref * m.rate / 100), SRC.measured, m.src)); out.measured = meas; out.measuredAvg = avg; }
    else layers.push({id: 'meas', label: '과거 개찰 실측', detail: award === 'floor' || award === 'eval' ? '이 기관·방식의 누적 기록이 없음 → 반영 0 (기록이 쌓이면 표시)' : '이 낙찰방식의 실측 기록 없음 → 낙찰 구간을 숫자로 만들지 않음', src: SRC.measured});
    layers.push({id: 'org', label: '기관 유형·영업 조건 진단', detail: `${profile.orgName} · ${profile.salesName} · ${profile.contractName}${profile.urgent ? ' · 긴급' : ''}${profile.rebid ? ' · 재공고' : ''} — 기관별 개찰 성향 실측 자료가 없어 숫자에 반영하지 않음(진단·주의 문구만)`, src: SRC.input});
    /* ③ 사용자 시뮬레이션 라인: 목표 마진율 · 예상 경쟁 */
    if (cst && tMargin != null) { const need = Math.ceil(cst.cost * (1 + tMargin / 100) - 1e-6); const b = vatRate === 0 ? need : P.totalFromSupply(need, vatRate); mk('TM', `목표 마진 ${tMargin}% 가격 (원가 대비)`, b, SRC.input, '원가 × (1 + 목표 마진율)'); }
    if (compDisc != null) { const cb = bidAt(100 - compDisc); mk('CD', `경쟁 가정가 (기초금액 −${compDisc}%)`, cb, SRC.assume, '사용자가 입력한 예상 경쟁 할인율 — 실제 개찰 데이터 아님'); if (compGap != null) mk('CG', `경쟁 가정가 −${compGap}%p`, bidAt(100 - compDisc - compGap), SRC.assume, '경쟁 가정가보다 더 낮게 쓰는 폭(사용자 입력)'); }
    out.lines = lines;
    /* 구간 정리 */
    let z = null;
    if (zone) { let lo = zone.lo, hi = Math.min(zone.hi, ref); if (defBid != null && lo < defBid) lo = defBid; if (lo > hi) { winStatus = 'blocked'; warns.push(defBid > ref ? '방어선이 기초금액을 넘습니다 — 이 조건으로는 참여할 수 없습니다.' : '방어선(원가·대외 안내)이 가능 구간보다 위에 있습니다 — 이 구간에서는 마진/약속을 지킬 수 없습니다. 참여 여부를 재검토하세요.'); } else z = {lo, hi, loRate: r3(rateOf(lo)), hiRate: r3(rateOf(hi)), src: zone.src, rawLo: zone.lo, rawHi: zone.hi}; }
    out.zone = z; out.winStatus = winStatus; out.basisNote = basisNote; out.award = award; out.floorBand = p.floorBand || null;
    out.feasible = defBid != null ? (defBid <= ref ? {lo: defBid, hi: ref, loRate: r3(rateOf(defBid)), hiRate: 100, src: SRC.input} : null) : {lo: null, hi: ref, loRate: null, hiRate: 100, src: SRC.rule};
    if (winStatus === 'insufficient') warns.push('근거 데이터가 부족해 낙찰 유력 구간은 산출하지 않았습니다 — 아래 시뮬레이션 표에서 목표 마진과 예상 경쟁 가정을 조절해 직접 비교하세요.');
    /* 후보 투찰안 + 순이익 */
    const rates = []; const addR = (id, rate, name, src, bid) => { if (rate == null || !isFinite(rate)) return; rates.push({id, rate: r3(rate), name, src, bid}); }; const addB = (id, bid, name, src) => { if (bid != null) addR(id, rateOf(bid), name, src, bid); };
    if (z) { addB('D', z.lo, award === 'floor' ? '하한가 구간 아래쪽 (공격 · 탈락 위험)' : '심사 통과 최저선', z.src); if (z.hi > z.lo) { addB('M', Math.round((z.lo + z.hi) / 2), '구간 중앙', z.src); addB('X', z.hi, award === 'floor' ? '하한가 위쪽 끝 (항상 통과)' : '가격평점 최고점', z.src); } }
    else if (defBid != null && defBid <= ref) addB('D', defBid, '방어선 (가장 낮게 쓸 수 있는 가격)', SRC.input);
    lines.filter(l => ['TM', 'CD', 'CG'].includes(l.id)).forEach(l => addR(l.id, l.rate, l.label, l.src, l.bid));
    if (tLo != null) addR('T1', tLo, '목표 구간 아래 ' + tLo + '%', SRC.input); if (tHi != null) addR('T2', tHi, '목표 구간 위 ' + tHi + '%', SRC.input); if (tLo != null && tHi != null && tHi > tLo) addR('T3', (tLo + tHi) / 2, '목표 구간 중앙', SRC.input);
    (p.custom || []).forEach((x, i) => addR('U' + (i + 1), x, '직접 입력 ' + x + '%', SRC.input));
    const rowOf = (c) => {
      const bid = c.bid != null ? c.bid : bidAt(c.rate), sp = supplyOf(bid); const row = {id: c.id, name: c.name, rate: c.rate, bid, supply: sp, vat: bid - sp, src: c.src, flags: []};
      if (cst) { row.profit = sp - cst.cost; row.profitPct = sp ? row.profit / sp * 100 : 0; row.markupPct = cst.cost ? row.profit / cst.cost * 100 : null; } else { row.profit = null; row.profitPct = null; row.markupPct = null; }
      if (cst && row.profit < 0) row.flags.push('LOSS'); else if (cst && beBid != null && bid < beBid) row.flags.push('UNDER_MIN_MARGIN');
      if (guide != null && c.rate < guide - 1e-9) row.flags.push('UNDER_GUIDE'); if (bid > ref) row.flags.push('OVER_BASE');
      if (award === 'floor' && p.floorBand && bid < p.floorBand.min) row.flags.push('BELOW_FLOOR_ALWAYS'); else if (award === 'floor' && p.floorBand && bid < p.floorBand.max) row.flags.push('FLOOR_RISK');
      if (z) row.inZone = bid >= z.lo && bid <= z.hi; return row;
    };
    const seen = new Set(); out.cands = rates.sort((a, b) => a.rate - b.rate).filter(c => (seen.has(c.rate) ? false : (seen.add(c.rate), true))).map(rowOf);
    /* 시뮬레이션 표(투명한 계산 표) — 방어선(없으면 0)부터 100% 까지 step %p 간격(표시 간격일 뿐 추천이 아님) */
    const start = defBid != null ? Math.max(0, Math.floor(rateOf(defBid) / step) * step) : 0; const grid = [];
    for (let r = start; r <= 100 + 1e-9; r += step) grid.push(rowOf({id: 'G', name: '', rate: Math.min(100, r3(r)), src: SRC.input}));
    if (!grid.length || grid[grid.length - 1].rate < 100) grid.push(rowOf({id: 'G', name: '', rate: 100, src: SRC.input}));
    out.grid = grid; out.step = step;
    out.cands.forEach(c => { if (c.flags.includes('LOSS')) warns.push(`⚠ 적자: ${c.id}안 ${won(c.bid)}원(기초금액의 ${c.rate}%) — 순이익 ${won(c.profit)}원. 이 금액으로는 투찰하지 마세요.`); if (c.flags.includes('UNDER_GUIDE')) warns.push(`대외 안내 ${guide}% 미만: ${c.id}안 ${c.rate}% — 고객에게 안내한 조건을 어기게 됩니다.`); if (c.flags.includes('OVER_BASE')) warns.push(`${c.id}안은 기초금액 초과 — 무효 위험`); if (c.flags.includes('BELOW_FLOOR_ALWAYS')) warns.push(`${c.id}안 ${won(c.bid)}원은 어떤 예정가격에서도 하한가 미만 — 탈락`); });
    if (cst && out.breakEven && out.breakEven.bid > ref) warns.push(`적자 방어선 ${won(out.breakEven.bid)}원 > 기초금액 ${won(ref)}원 — 안전한 원가 미달`);
    if (!cst) warns.push('실제 원가를 넣지 않아 순이익·적자 방어선은 계산하지 않았습니다.');
    if (guide != null && cst && beBid != null && guideBid < beBid) warns.push(`대외 안내 ${guide}% 지점(${won(guideBid)}원)은 적자 방어선(${won(beBid)}원)보다 낮습니다 — 안내를 지키면 적자입니다.`);
    out.recommended = award === 'floor' && z ? (out.cands.find(c => c.id === 'X' && c.profit != null && c.profit > 0 && !c.flags.length) || null) : null;
    out.reasons = explain(out, {profile, tLo, tHi, tMargin, compDisc}); out.ok = true; return out;
  }

  function explain(o, c) {
    const P0 = o.profile, r = [], f2 = x => (Math.round(x * 100) / 100) + '%';
    const lead = [P0.orgName.split(' (')[0], P0.awardName, P0.salesName, P0.tax === 'free' ? '면세(부가세 0)' : '과세(부가세 ' + o.vatRate + '%)', P0.contractName + (P0.urgent ? ' · 긴급' : '') + (P0.rebid ? ' · 재공고' : '')].join(' + ');
    if (o.winStatus === 'nego') r.push(`[${lead}] 기술점수가 낙찰을 좌우하므로 가격 구간을 정하지 않습니다. 적자 방어선 ${o.defense ? won(o.defense.bid) + '원' : '(원가 미입력)'} 이상 · 기초금액 이하에서 평가기준대로 판단하세요.`);
    else if (o.winStatus === 'blocked') r.push(`[${lead}] 공고 규칙상 가능한 구간이 방어선과 겹치지 않습니다.`);
    else if (o.zone && o.award === 'floor') r.push(`[${lead}] 하한율은 공고 값이므로, 낙찰하한가가 움직이는 ${won(o.zone.lo)}~${won(o.zone.hi)}원(기초금액의 ${f2(o.zone.loRate)}~${f2(o.zone.hiRate)})이 가능 구간입니다. 위쪽 끝은 어떤 예정가격에서도 통과하는 최대 마진 지점, 아래쪽 끝은 가장 공격적인 지점입니다. 〔${o.zone.src.label}〕`);
    else if (o.zone && o.award === 'eval') r.push(`[${lead}] 가격평점 산식으로 통과 최저 투찰률부터 평점 최고율까지 ${won(o.zone.lo)}~${won(o.zone.hi)}원(기초금액의 ${f2(o.zone.loRate)}~${f2(o.zone.hiRate)})이 유효 구간입니다. 〔${o.zone.src.label}〕`);
    else r.push(`[${lead}] 하한율이 없는 최저가라 공고 규칙으로는 낙찰 구간을 정할 수 없고, 실측 개찰 기록도 없어 숫자로 만들지 않았습니다. 계산 가능한 것은 ① 적자 방어선 ${o.defense ? won(o.defense.bid) + '원(기초금액의 ' + f2(o.defense.rate) + ')' : '(원가 입력 필요)'} ② 상한 ${won(o.ref)}원 사이의 범위뿐입니다 — 아래 시뮬레이션 표에서 목표 마진과 예상 경쟁을 조절해 정하세요.`);
    if (o.defense && o.winStatus !== 'nego') r.push(`최저 방어선 ${won(o.defense.bid)}원(기초금액의 ${f2(o.defense.rate)}) — ${o.defense.why}. 이보다 낮게 쓰면 ${o.defense.why.startsWith('대외') ? '고객 안내를 어기게 됩니다' : '적자입니다'}. 〔${o.defense.src.label}〕`);
    if (o.guideLine && o.cost != null) r.push(`대외 안내(${o.guideLine.rate}%)와 실제 원가를 분리해 계산했습니다 — 안내 기준 이상·기초금액 이하에서 후보별 실제 순이익을 비교하세요(내부용 · 서류에는 출력되지 않음).`);
    if (c.tLo != null && c.tHi != null && o.zone) { const inside = c.tLo >= o.zone.loRate - 1e-9 && c.tHi <= o.zone.hiRate + 1e-9; r.push(`목표 투찰 ${c.tLo}~${c.tHi}% 는 공고 규칙 구간 ${f2(o.zone.loRate)}~${f2(o.zone.hiRate)} ${inside ? '안에 있습니다' : c.tHi < o.zone.loRate ? '보다 낮아 탈락 위험이 있습니다' : c.tLo > o.zone.hiRate ? '보다 높습니다' : '과 일부만 겹칩니다'}.`); }
    if (P0.urgent) r.push('긴급 공고: 제출 기간이 짧아 서류 준비 시간이 변수입니다(가격 구간은 변경하지 않음).'); if (P0.rebid) r.push('재공고: 직전 개찰(유찰·무효) 결과가 있으면 그 금액을 예상 경쟁 할인율에 반영해 비교하세요(입력 자료 없음 → 반영 0).');
    return r;
  }

  /* ───────── 화면 입력(공고 n · 원가 c · 상황 s) → analyze 입력 ───────── */
  function fromForm(n, c, s, fo) {
    const award = n.award || (n.floor ? 'floor' : ''), taxfree = n.tax === 'free', V = num(n.vat).s === 'ok' ? num(n.vat).n : 10; const B = num(n.base);
    const p = {org: s.org, orgKey: s.orgKey, award, sales: s.sales, urgent: s.urgent, rebid: s.rebid, contract: s.contract, tax: taxfree ? 'free' : 'tax', vat: n.vat, list: c.list, cur: c.cur, fx: c.fx, commission: c.comm, extra: c.extra, minMargin: c.smin, guide: c.guide, tlo: c.tlo, thi: c.thi,
      targetMargin: c.mrg, compDisc: c.cdisc, compGap: c.cgap, step: c.step, custom: String(c.trates || '').split(/[,\s;]+/).filter(Boolean).map(x => Number(x)).filter(x => isFinite(x) && x > 0), evalRef: c.ref, evalWeight: c.weight, evalK: c.k, evalOther: c.other, evalPass: c.pass, legacyCoef: c.costmode === 'ledger' ? c.disc : ''};
    if (award === 'floor') { if (fo && fo.errors && !fo.errors.length) { p.ref = fo.est; p.floorBand = {min: fo.floorMin, max: fo.floorMax, floorRate: fo.floorRate}; p.bidVat = fo.basis === 'asis' && !taxfree ? V : 0; } else p.ref = B.s === 'ok' ? B.n : 0; }
    else if (B.s === 'ok') { p.ref = (n.basis === 'est' && !taxfree) ? P.totalFromSupply(B.n, V) : B.n; } else p.ref = 0;
    if ((c.comm === '' || c.comm == null) && String(c.list || '') !== '' && String(c.disc || '') !== '') { const er = [], fx = []; const k = P.costOf({list: c.list, cur: c.cur, fx: c.fx, disc: c.disc, costmode: c.costmode}, er, fx); if (k) p.costOverride = k.cost + (num(c.extra).s === 'ok' ? num(c.extra).n : 0); }
    return p;
  }

  /* ───────── 내부 정보 유출 차단 ───────── */
  const KEYWORDS = ['커미션', '매입계수', '매입원가', '실제 원가', '실제원가', '내부용', '순이익', '실제 마진'];
  function buildSecrets(p, an) {
    const t = {amounts: new Set(), small: [], keywords: KEYWORDS.slice()}; const errs = [];
    const add = n => { if (n != null && isFinite(n) && Math.abs(n) >= 1000) t.amounts.add(Math.round(Math.abs(n))); };
    const ctx = v => '(?:계수|디스카운트|커미션|매입|할인)[^\\d]{0,14}' + v + '(?!\\d)';
    const c = internalCost(Object.assign({}, p, {costOverride: p.costOverride}), errs);
    if (c) { add(c.cost); add(c.listKrw ? c.listKrw - c.cost : null); if (c.k != null && c.k < 1) { const ks = String(r3(c.k)).replace(/^0/, '').replace('.', '\\.'); t.small.push(ctx('0?' + ks)); t.small.push(ctx(String(c.commission).replace('.', '\\.') + '(?:\\.0+)?\\s*%?')); t.small.push('(?<![\\d.])' + String(c.commission).replace('.', '\\.') + '(?:\\.0+)?\\s*%[^\\n]{0,6}커미션'); } if (p.costOverride) add(p.costOverride); }
    if (num(p.legacyCoef).s === 'ok' && num(p.legacyCoef).n > 0 && num(p.legacyCoef).n < 1) t.small.push(ctx('0?' + String(num(p.legacyCoef).n).replace(/^0/, '').replace('.', '\\.')));
    if (an && an.ok) an.cands.concat(an.grid || []).forEach(x => add(x.profit)); return t;
  }
  /* allow: 서류에 정당하게 적히는 금액(투찰금액·공급가액·부가세) — 마진 0 지점처럼 우연히 원가와 같아도 차단하지 않는다 */
  function scan(text, secrets, allow) {
    const hits = []; const s = String(text == null ? '' : text); if (!secrets) return hits; const ok = new Set((allow || []).map(x => Math.round(Math.abs(Number(x)))));
    secrets.keywords.forEach(k => { if (s.indexOf(k) >= 0) hits.push('키워드 "' + k + '"'); });
    secrets.amounts.forEach(a => { if (ok.has(a)) return; [String(a), a.toLocaleString('ko-KR')].forEach(f => { const re = new RegExp('(?<![\\d,.])' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\d,])'); if (re.test(s)) hits.push('내부 금액 ' + a.toLocaleString('ko-KR')); }); });
    secrets.small.forEach(re => { try { if (new RegExp(re).test(s)) hits.push('내부 계수/커미션 값'); } catch (e) { /* ignore */ } });
    return Array.from(new Set(hits));
  }
  const rowsToText = rows => rows.map(r => r.join('\t')).join('\n');
  const htmlToText = h => String(h).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  const redactLedger = row => { const r = row.slice(); r[23] = ''; r[24] = ''; return r; };

  const api = {SRC, ORG_TYPES, SALES, CONTRACT, AWARD, KEYWORDS, detectOrg, detectOrgKey, measuredFor, internalCost, analyze, fromForm, redactLedger, leak: {build: buildSecrets, scan, rowsToText, htmlToText}};
  E.strategy = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
