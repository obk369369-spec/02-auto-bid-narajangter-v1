/* 02 입찰 도구 v3 확장 UI — ui.js 보다 먼저 실행되어 window.__BIDUI2 를 등록하고, ui.js 가 끝에서 init(U) 로 내부 함수를 넘겨준다.
   · 낙찰방식별 계산 화면(최저가·적격심사·협상) · 6단계 제출서류 체크리스트+자동 검사 · 변경 감지(신규/정정/취소/재공고) · 입찰 건 보관함 · 대용량 XLSX 기관 누적(별도 작업자) */
(() => {
  'use strict';
  let U = null; const B = () => window.BIDENG, P = () => window.BIDENG.pricing, O = () => window.BIDENG.ops; const api = window.__BIDUI2 = {};
  const CLSCOL = {'자동 수집': '#0e7490', '자동 작성': '#2563eb', '자동 검사': '#047857', '사용자 인증 필요': '#b45309', '법적 확인 필요': '#7c3aed', '수동 처리': '#64748b'};
  const AWNAME = {floor: '복수예가·낙찰하한율제', lowest: '최저가 낙찰제', eval: '적격심사제', nego: '협상에 의한 계약'};
  api.init = u => { U = u; api._ready = true; U.S.hist = U.ls.get('wic02v3_hist', {}); U.S.instHist = U.ls.get('wic02v3_inst', {}); bindBox(); bindXlsx(); bindDocInputs(); renderBox(); kistiCard(); };

  /* ───────── 변경 감지 · 기관 이력 ───────── */
  api.track = (it, ex0) => {
    const S = U.S; const cur = {title: it.name, org: it.org, base: it.base, due: it.due}; const d = O().diffNotice(S.hist[it.key] || null, cur, it.name); it.state = d.state; it.flags = d.flags;
    if (ex0) { if (d.state === 'CHANGED') Object.assign(ex0, {name: it.name, org: it.org, due: it.due, base: it.base, state: 'CHANGED', flags: d.flags, changes: d.changes}); }
    S.hist[it.key] = {fp: d.fp, fields: cur}; O().accumulateHistory(S.instHist, {org: it.org, no: it.no, title: it.name, cls: it.cls});
    if (!api._t) api._t = setTimeout(() => { api._t = null; U.ls.set('wic02v3_hist', S.hist); U.ls.set('wic02v3_inst', S.instHist); }, 400);
  };

  /* ───────── 계산 분기 ───────── */
  const kpi = (a, b, c) => `<div class="kpi"><small>${a}</small><b>${b}</b>${c ? `<em>${c}</em>` : ''}</div>`;
  function head(n, award) { const {$, esc, won} = U; $('calcHead').innerHTML = `<b>${esc(n.title || '(공고명 없음)')}</b> · ${esc(n.org || '기관 미입력')} · 낙찰방식 <b>${esc(AWNAME[award] || '확인 필요')}</b>${U.S.award && U.S.award.mode === award ? ` <span class="small">(공고 문구: ${esc(U.S.award.evidence.slice(0, 60))})</span>` : ''} · 기초금액 ${n.base ? esc(won(U.num(n.base).n)) + '원' : '<span class="bad">미입력</span>'}`; }
  api.calc = () => {
    const {$, nget, cget, S, esc} = U; const n = nget(), c = cget(); const award = n.award || (n.floor ? 'floor' : ''); S.mode = award;
    if (award === 'floor') { U.showCalc(); const h = $('calcHead'); h.innerHTML = `낙찰방식 <b>${AWNAME.floor}</b> · ` + h.innerHTML; return; }
    if (!award) { $('calcHead').innerHTML = '낙찰방식 <b class="bad">확인 필요</b>'; $('calcOut').innerHTML = `<div class="card"><h2>낙찰자 결정방식을 먼저 정하세요</h2><p class="lead">공고문에서 낙찰하한율·최저가·적격심사·협상계약 문구를 찾지 못했습니다. 잘못된 방식으로 계산하지 않도록 계산을 멈췄습니다. ① 공고 정보의 "낙찰자 결정방식"을 선택하세요(낙찰하한율 숫자를 입력하면 하한율제로 계산).</p></div>`; S.lastCalc = null; return; }
    head(n, award); if (award === 'lowest') return renderLowest(n, c); if (award === 'eval') return renderEval(n, c); return renderNego(n, c);
  };
  const setBid = total => { const el = U.$('d_bid'); el.value = String(total); el.dataset.auto = '1'; };
  const actions = id => `<div class="row" style="margin-top:16px"><button id="goDocs" class="primary" title="기능: 선택한 투찰금액으로 ③ 서류 작성 탭 이동 · 결과: 서류 초안에 금액 반영 · 사용시점: 투찰가를 정했을 때">이 금액으로 서류 만들기 → ③</button><button id="cpBid" title="기능: 투찰금액 복사 · 결과: 입찰서에 붙여넣기 · 사용시점: 투찰 직전">투찰금액 복사</button></div>`;
  function wireActions(total) { const {$, showTab, toast} = U; $('goDocs').onclick = () => { setBid(total); showTab(3); toast('선택한 투찰금액을 서류 작성에 반영했습니다'); }; $('cpBid').onclick = async () => { try { await navigator.clipboard.writeText(String(total)); toast('투찰금액 ' + U.won(total) + '원 복사됨'); } catch (e) { toast('복사 권한이 없습니다'); } }; }

  /* 최저가 낙찰제 */
  function chartLowest(L, selId) {
    const {svg, T, C, short, won} = U; const W = 640, H = 200, pl = 34, pr = 34, ay = 108; const pts = [L.totalCost, L.capTotal, ...L.rows.map(r => r.total)]; let lo = Math.min(...pts), hi = Math.max(...pts); const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad; const X = v => pl + (v - lo) / (hi - lo) * (W - pl - pr);
    let s = `<line x1="${pl}" x2="${W - pr}" y1="${ay}" y2="${ay}" stroke="${C.m}" stroke-width="2"/><rect x="${X(L.capTotal)}" y="${ay - 18}" width="${Math.max(0, W - pr - X(L.capTotal))}" height="36" fill="${C.r}" opacity=".16"/><rect x="${pl}" y="${ay - 18}" width="${Math.max(0, X(L.totalCost) - pl)}" height="36" fill="${C.r}" opacity=".16"/>`;
    s += T(X(L.capTotal) + 6, ay - 24, '기초금액 초과 = 무효 위험', {anchor: 'start', size: 10.5, fill: C.r}) + T(pl + 4, ay - 24, '원가 미만 = 적자', {anchor: 'start', size: 10.5, fill: C.r});
    { const st = U.S.strat; if (st && st.ok && st.feasible && st.feasible.lo != null && st.feasible.hi > st.feasible.lo) { const a = Math.max(pl, X(st.feasible.lo)), b = Math.min(W - pr, X(st.feasible.hi)); if (b > a) s += `<rect x="${a}" y="${ay - 18}" width="${b - a}" height="36" fill="${C.g}" opacity=".14" stroke="${C.gd}" stroke-dasharray="4 3"/>` + T((a + b) / 2, ay + 34, '가능 범위(방어선~기초금액 · 낙찰 구간 아님)', {size: 10, fill: C.gd}); } }
    const tick = (v, col, label, y) => `<line x1="${X(v)}" x2="${X(v)}" y1="${ay - 22}" y2="${ay + 22}" stroke="${col}" stroke-width="2.5"/>` + T(X(v), y, label, {fill: col, bold: true, size: 11});
    s += tick(L.totalCost, C.gd, '원가 ' + won(L.totalCost), 170) + tick(L.capTotal, C.r, '기초금액(상한) ' + won(L.capTotal), 190);
    L.rows.forEach(r => { const sel = r.id === selId; s += `<path d="M${X(r.total) - 7} ${ay - 40}L${X(r.total) + 7} ${ay - 40}L${X(r.total)} ${ay - 28}Z" fill="${sel ? C.b : C.t}"/>` + T(X(r.total), ay - 46, r.id, {bold: true, fill: sel ? C.b : C.t}); });
    return svg(W, H, s, '최저가 낙찰 가격 위치');
  }
  function renderLowest(n, c) {
    const {$, S, esc, won, pct} = U; const L = P().calcLowest({base: n.base, baseVat: n.basis === 'est' ? 'excl' : 'incl', taxmode: n.tax, vat: n.vat, list: c.list, cur: c.cur, fx: c.fx, costmode: c.costmode, disc: c.disc, marginMin: c.mmin, marginTarget: c.mtgt, extraCost: c.extra});
    S.lastCalc = null;
    if (!L.ok) { $('calcOut').innerHTML = `<div class="card"><div class="bad">입력 오류 — 최저가 계산을 하지 않았습니다 (빈칸·잘못된 값은 추측하지 않습니다)</div><div style="margin-top:8px">${L.errors.map(x => '· ' + esc(x)).join('<br>')}</div><p class="small" style="margin-top:10px">① 공고 정보(기초금액·VAT)와 위 "발행사 정가·환율·원가 계수"를 확인하세요. 최저가 낙찰제는 하한율을 곱하지 않고 <b>원가 + 마진 + 부가세</b>로 투찰가를 만듭니다.</p></div>`; return; }
    if (!S.lowSel || !L.rows.some(r => r.id === S.lowSel)) S.lowSel = (L.recommended || L.rows[0]).id; const sel = L.rows.find(r => r.id === S.lowSel); const cap = P().splitVat(L.capTotal, L.vatRate); S.lastCalc = {cost: L.totalCost, o: null, mode: 'lowest', lowest: L};
    setBid(sel.total);
    const h = [];
    h.push(`<div class="card"><h2>최저가 낙찰제 · 한눈에 보기</h2><p class="lead">하한율을 곱하지 않습니다. 투찰금액(총액)은 <b>기초금액(${L.baseIncl ? 'VAT 포함' : 'VAT 별도'}) 이하</b>여야 하고, 그 안에서 원가 + 마진으로 정합니다.</p>
      <div class="kpis">${kpi('기초금액 = 투찰 상한(총액)', won(L.capTotal) + '원', L.baseIncl ? 'VAT 포함 기준' : 'VAT 별도 → 가산 후')}${kpi('상한의 공급가액 / 부가세', won(cap.supply) + ' / ' + won(cap.vat), L.taxfree ? '면세 품목: 부가세 0' : '합계 ' + won(cap.total) + '원 보존')}${kpi('원가(공급원가)', won(L.totalCost) + '원', esc(L.costNote).slice(0, 80))}${kpi('판정', `<span class="${L.feasible ? 'ok' : 'bad'}">${esc(L.status)}</span>`, '')}${kpi('선택한 투찰가 (' + sel.id + ')', `<span style="color:var(--blue)">${won(sel.total)}원</span>`, `공급 ${won(sel.supply)} · 부가세 ${won(sel.vat)}`)}</div>
      ${!L.taxfree && cap.differs ? `<div class="explainbox">참고: 공급가액×10% 절사 방식으로 계산하면 부가세 ${won(cap.altVat)}원(합계 ${won(cap.altTotal)}원)이 되어 기초금액과 1원 차이가 납니다. 이 도구는 <b>합계가 기초금액과 맞도록</b> 부가세 = 총액 − 공급가액(${won(cap.vat)}원)으로 분리합니다. 기관 시스템이 다른 방식을 쓰면 공고 기준을 확인하세요.</div>` : ''}
      ${L.warns.map(w => `<div class="explainbox" style="background:#fee2e2;border-color:#fecaca">${esc(w)}</div>`).join('')}${L.fixes.map(x => `<div class="small">· ${esc(x)}</div>`).join('')}${actions()}</div>`);
    h.push(`<div class="card"><h2>투찰 후보 <span class="small" style="font-weight:400">· 카드를 눌러 선택</span></h2><div class="recs">${L.rows.map(r => `<div class="rec ${r.id === S.lowSel ? 'sel' : ''}" data-low="${r.id}"><h4>${r.id}안 · ${esc(r.name)}</h4><div class="big">${won(r.total)}원</div><div class="small">공급 ${won(r.supply)} + 부가세 ${won(r.vat)} · 상한 대비 ${pct(r.rateOfCap, 2)}</div><ul><li>산식: ${esc(r.how)}</li><li>마진: <span class="${r.margin < 0 ? 'bad' : ''}">${won(r.margin)}원 (원가 대비 ${r.markupPct.toFixed(2)}% · 공급가 대비 ${r.marginPct.toFixed(2)}%)</span></li>${r.over ? `<li class="bad">기초금액 ${won(r.overBy)}원 초과</li>` : '<li class="ok">기초금액 이하</li>'}</ul></div>`).join('')}</div></div>`);
    h.push(`<div class="card"><h2>그래프로 보기</h2><div class="charts"><div class="chart" style="grid-column:1/-1"><h4>원가 · 후보 · 기초금액 위치</h4><p>빨강 영역: 적자 또는 기초금액 초과. 최저가 경쟁에서는 A안이 가장 낮지만 마진은 최소입니다.</p>${chartLowest(L, S.lowSel)}</div></div></div>`);
    $('calcOut').innerHTML = h.join(''); wireActions(sel.total); $('calcOut').querySelectorAll('[data-low]').forEach(el => el.onclick = () => { S.lowSel = el.dataset.low; renderLowest(n, c); });
  }

  /* 적격심사 */
  function renderEval(n, c) {
    const {$, S, esc, won, svg, T, C} = U; const Ev = P().calcEval({base: n.base, ref: c.ref, weight: c.weight, k: c.k, otherScore: c.other, pass: c.pass}); S.lastCalc = null;
    if (!Ev.ok) { $('calcOut').innerHTML = `<div class="card"><div class="bad">${Ev.errors.map(esc).join('<br>')}</div></div>`; return; }
    const p = Ev.params; const best = Ev.best; if (best) setBid(best.bid);
    const W = 640, H = 220, pl = 46, pb = 40, pt = 20, rs = Ev.rows.map(r => r.rate), lo = Math.min(...rs), hi = Math.max(...rs), ymax = p.weight + p.otherScore; const X = v => pl + (v - lo) / (hi - lo || 1) * (W - pl - 14), Y = v => pt + (1 - v / ymax) * (H - pt - pb);
    let ch = `<line x1="${pl}" x2="${W - 14}" y1="${Y(p.pass)}" y2="${Y(p.pass)}" stroke="${C.r}" stroke-dasharray="5 4"/>` + T(W - 16, Y(p.pass) - 5, '통과 ' + p.pass + '점', {anchor: 'end', size: 10.5, fill: C.r}) + `<polyline fill="none" stroke="${C.b}" stroke-width="2.5" points="${Ev.rows.map(r => X(r.rate) + ',' + Y(r.total)).join(' ')}"/>`;
    Ev.rows.forEach(r => { ch += `<circle cx="${X(r.rate)}" cy="${Y(r.total)}" r="3.5" fill="${r.pass ? C.g : C.r}"/>`; }); if (best) ch += `<line x1="${X(best.rate)}" x2="${X(best.rate)}" y1="${pt}" y2="${H - pb}" stroke="${C.gd}" stroke-width="2"/>` + T(X(best.rate), pt - 4, '통과 최저 ' + best.rate + '%', {size: 10.5, bold: true, fill: C.gd});
    ch += T(pl - 6, pt + 4, '총점', {anchor: 'end', size: 10.5, fill: C.m}) + T(W / 2, H - 8, '투찰률(%) — 예정가격 대비', {size: 10.5, fill: C.m});
    $('calcOut').innerHTML = `<div class="card"><h2>적격심사 · 한눈에 보기</h2><p class="lead">입찰가격 평점 = ${p.weight} − ${p.k} × |${p.ref} − 투찰률| , 총점 = 가격평점 + 기타 ${p.otherScore}점 ≥ ${p.pass}점이면 통과 (조달청 물품 적격심사 · info21c 학습자료 37번). <b>공고의 평가표가 우선</b>이며 위 "낙찰방식별 추가 입력"에서 바꿀 수 있습니다.</p>
      <div class="kpis">${kpi('예정가격(가정 = 기초금액, 사정율 0%)', won(Number(n.base)) + '원', '')}${kpi('통과 최저 투찰률', Ev.minRate == null ? '불가' : Ev.minRate + '%', '')}${kpi('통과 최저 투찰가', Ev.minBid == null ? '-' : won(Ev.minBid) + '원', '')}${kpi('평점 최고 투찰률', p.ref + '%', '가격평점 ' + p.weight + '점')}</div>${Ev.fixes.map(x => `<div class="explainbox">${esc(x)}</div>`).join('')}${actions()}</div>
      <div class="card"><h2>그래프</h2><div class="chart">${svg(W, H, ch, '적격심사 점수 곡선')}</div></div>
      <div class="card"><h2>투찰률별 점수표</h2><div class="scroll"><table><thead><tr><th>투찰률</th><th>투찰가</th><th>가격평점</th><th>총점</th><th>판정</th></tr></thead><tbody>${Ev.rows.map(r => `<tr class="${best && r.rate === best.rate ? 'sel' : ''}"><td class="n">${r.rate}%</td><td class="n">${won(r.bid)}</td><td class="n">${r.priceScore.toFixed(2)}</td><td class="n">${r.total.toFixed(2)}</td><td>${r.pass ? '<span class="ok">통과</span>' : '<span class="bad">미달</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
    wireActions(best ? best.bid : 0);
  }
  /* 협상에 의한 계약 */
  function renderNego(n, c) {
    const {$, S, esc, won} = U; const N = P().calcNego({techScore: c.tech, priceWeight: c.pw, lowestBid: c.low, bids: c.bids}); S.lastCalc = null;
    if (!N.ok) { $('calcOut').innerHTML = `<div class="card"><div class="bad">협상에 의한 계약 — 계산 전에 확인할 값</div><div style="margin-top:8px">${N.errors.map(x => '· ' + esc(x)).join('<br>')}</div><p class="small">위 "낙찰방식별 추가 입력"의 [협상] 칸을 채우세요. 가격 배점·평가 산식은 공고의 평가기준이 우선입니다.</p></div>`; return; }
    const top = N.rows.slice().sort((a, b) => b.total - a.total)[0]; setBid(top.bid);
    $('calcOut').innerHTML = `<div class="card"><h2>협상에 의한 계약 · 총점 비교</h2>${N.fixes.map(x => `<div class="explainbox">${esc(x)}</div>`).join('')}<div class="scroll"><table><thead><tr><th>입찰가</th><th>가격점수</th><th>총점(기술+가격)</th></tr></thead><tbody>${N.rows.map(r => `<tr class="${r.bid === top.bid ? 'sel' : ''}"><td class="n">${won(r.bid)}</td><td class="n">${r.priceScore}</td><td class="n">${r.total}</td></tr>`).join('')}</tbody></table></div>${actions()}</div>`; wireActions(top.bid);
  }

  /* ───────── 6단계 제출서류 체크리스트 + 자동 검사 ───────── */
  const dkey = () => U.chkKey();
  const docsStore = () => (U.ls.get('wic02v3_docs', {})[dkey()] || {});
  function inspectNow() {
    const {$, nget, cget, esc} = U; const n = nget(), c = cget(); const items = O().buildChecklist({award: n.award, docHits: U.S.docHits}); const total = U.num($('d_bid').value);
    const res = O().inspect({notice: {no: n.no, due: n.due, total: total.s === 'ok' ? total.n : '', listPrice: c.list}, items, docs: docsStore()}); const box = $('inspectBox'); if (!box) return res;
    const col = {OK: 'ok', FAIL: 'bad', WARN: 'warn', HOLD: 'small'}; const cnt = res.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
    box.innerHTML = `<h3>서류 자동 검사 <span class="small">(유효기간 · 금액 · 공고번호 일치) · OK ${cnt.OK || 0} · 경고 ${cnt.WARN || 0} · 실패 ${cnt.FAIL || 0} · 입력 필요 ${cnt.HOLD || 0}</span></h3><div class="scroll"><table><thead><tr><th>서류</th><th>검사</th><th>결과</th><th>설명</th></tr></thead><tbody>${res.map(r => `<tr><td>${esc(r.title)}</td><td>${{validity: '유효기간', amount: '금액', noticeNo: '공고번호'}[r.check]}</td><td class="${col[r.status]}"><b>${r.status}</b></td><td class="small">${esc(r.msg)}</td></tr>`).join('')}</tbody></table></div>`; return res;
  }
  api.inspect = inspectNow;
  api.renderChk = () => {
    const {$, S, ls, esc, nget} = U; const n = nget(); const items = O().buildChecklist({award: n.award, docHits: S.docHits}); const st = ls.get('wic02v2_chk', {}), key = dkey(), cur = st[key] || {}, ds = docsStore(); let stage = '', h = '', done = 0;
    const cnt = {}; items.forEach(i => cnt[i.cls] = (cnt[i.cls] || 0) + 1);
    h += `<div class="row" style="margin-bottom:14px">${O().STAGES.map(s => `<span class="pill" style="border-color:${CLSCOL[s]};color:${CLSCOL[s]}"><b>${esc(s)}</b> ${cnt[s] || 0}</span>`).join('')}</div>`;
    items.forEach(it => { if (it.stage !== stage) { stage = it.stage; h += `<div class="stage">${esc(stage.replace(/^\d /, ''))}</div>`; } const ok = !!cur[it.id]; if (ok) done++; const d = ds[it.id] || {};
      const ins = it.check.map(ck => ck === 'validity' ? `<label class="small">유효기간(만료일) <input type="date" class="docin" data-doc="${esc(it.id)}" data-f="validUntil" value="${esc(d.validUntil || '')}" title="기능: 서류의 만료일 입력 · 결과: 입찰마감일과 비교해 자동 검사 · 사용시점: 서류를 확인한 뒤"></label>` : ck === 'amount' ? `<label class="small">서류 금액(원) <input class="docin" data-doc="${esc(it.id)}" data-f="amount" value="${esc(d.amount || '')}" style="width:130px" title="기능: 서류에 적힌 금액 입력 · 결과: 투찰금액/정가와 일치 검사 · 사용시점: 서류를 확인한 뒤"></label>` : `<label class="small">서류의 공고번호 <input class="docin" data-doc="${esc(it.id)}" data-f="noticeNo" value="${esc(d.noticeNo || '')}" style="width:150px" title="기능: 서류에 적힌 공고번호 입력 · 결과: 공고번호 일치 검사 · 사용시점: 서류를 확인한 뒤"></label>`).join(' ');
      h += `<div class="chk ${ok ? 'done' : ''}"><input type="checkbox" data-id="${esc(it.id)}" ${ok ? 'checked' : ''} title="기능: 준비 완료 표시 · 결과: 진행률 갱신(공고별 저장) · 사용시점: 서류를 챙겼을 때"><div style="flex:1"><div class="ct">${esc(it.t)} <span class="badge" style="background:${CLSCOL[it.cls]}22;color:${CLSCOL[it.cls]}">${esc(it.cls)}</span>${it.needsAuth ? ' <span class="badge b-mid">인증 필요</span>' : ''}${it.hit ? ` <span class="badge b-mid" title="${esc(it.hit)}">공고문 언급</span>` : ''}</div><div class="src">근거: ${esc(it.src)}</div>${ins ? `<div class="row" style="margin-top:6px;gap:14px">${ins}</div>` : ''}</div>${it.gen ? `<button class="sm" type="button" data-gen="${it.gen}" title="기능: 이 서류 초안 내려받기 · 결과: 파일 저장 · 사용시점: 서류 작성 시">초안 만들기</button>` : ''}</div>`; });
    h += '<div id="inspectBox" style="margin-top:22px"></div>'; $('chkBox').innerHTML = h; $('chkProg').textContent = `· ${done} / ${items.length} 완료 (${key})`; $('chkBar').style.width = (items.length ? done / items.length * 100 : 0) + '%'; inspectNow();
  };
  function bindDocInputs() { const {$, ls} = U; $('chkBox').addEventListener('input', e => { const i = e.target.closest('.docin'); if (!i) return; const all = ls.get('wic02v3_docs', {}); const k = dkey(); all[k] = all[k] || {}; all[k][i.dataset.doc] = all[k][i.dataset.doc] || {}; all[k][i.dataset.doc][i.dataset.f] = i.value; ls.set('wic02v3_docs', all); inspectNow(); }); ['d_bid', 'n_due', 'n_no', 'c_list'].forEach(id => $(id).addEventListener('input', () => { if ($('tab3').classList.contains('on')) inspectNow(); })); }

  /* ───────── 입찰 건 보관함 (예전 index 의 입찰 건·품목 등록 통합) ───────── */
  const BK = 'wic02v3_box'; const box = () => U.ls.get(BK, []);
  function fillBox(b) { const {$} = U; $('bx_org').value = b.org || ''; $('bx_title').value = b.title || ''; $('bx_due').value = b.due || ''; $('bx_budget').value = b.budget || ''; $('bx_type').value = b.type || '입찰'; $('bx_status').value = b.status || '검토중'; $('bx_contact').value = b.contact || ''; $('bx_note').value = b.note || ''; $('bx_rank').value = b.rank || ''; $('bx_win').value = b.win || ''; $('bx_floor').value = b.floor || ''; }
  function renderBox(list) {
    const {$, esc} = U; const all = box(); const rows = list || all; const today = new Date().toISOString().slice(0, 10);
    $('sumCount').textContent = `저장 ${all.length}건`; $('sumToday').textContent = `오늘 ${all.filter(b => (b.ts || '').slice(0, 10) === today).length}건`; $('sumLast').textContent = '최근 기관 ' + (all.length ? all[all.length - 1].org || '-' : '-');
    $('bx_body').innerHTML = rows.map(b => `<tr><td>${esc(b.org)}</td><td>${esc(b.title)}</td><td>${esc(b.due)}</td><td class="n">${esc(b.budget)}</td><td>${esc(b.type)}</td><td>${esc(b.status)}</td><td class="n">${(b.items || []).length}</td><td class="n">${esc(b.rank || '')}${b.win ? ' · ' + esc(b.win) : ''}</td><td class="n">${implied(b)}</td><td><button class="sm" data-bxload="${esc(b.id)}" title="기능: ①공고 정보와 ③품목으로 불러오기 · 결과: 이어서 작업 · 사용시점: 저장한 건을 다시 볼 때">불러오기</button> <button class="sm" data-bxdel="${esc(b.id)}" title="기능: 이 건 삭제 · 결과: 보관함에서 제거 · 사용시점: 필요 없을 때">삭제</button></td></tr>`).join(''); $('bx_empty').style.display = rows.length ? 'none' : '';
  }
  /* 낙찰금액이 기록돼 있으면 사정율(예정가격이 기초금액에서 벗어난 정도)을 거꾸로 계산 — 한 기관의 하한율을 보편값으로 쓸 수 없다는 근거 */
  function implied(b) { const w = U.num(b.win), base = U.num(String(b.budget || '').replace(/[^\d.]/g, '')), f = U.num(b.floor); if (w.s !== 'ok' || base.s !== 'ok' || f.s !== 'ok' || !(base.n > 0) || !(f.n > 0)) return ''; const v = P().impliedSajung(w.n, base.n, f.n); return (v >= 0 ? '+' : '') + v + '%'; }
  /* 비공개 본 전용: 과거 KISTI 이력 카드 (E.kisti 가 있을 때만) */
  function kistiCard() {
    const K = U.E && U.E.kisti || window.BIDENG && window.BIDENG.kisti; const host = document.getElementById('tab5'); if (!K || !host || document.getElementById('kistiHist')) return; const sm = K.summary(), won = n => Number(n).toLocaleString('ko-KR');
    let h = '<div class="card" id="kistiHist"><h2>과거 KISTI 개찰 이력 (비공개 본 · 직접 판독 ' + sm.n + '건)</h2><p class="small">' + U.esc(K.note) + '</p><div class="tablewrap"><table><thead><tr><th>공고번호</th><th>결과</th><th>우리 투찰가</th><th>투찰률(추정예산 대비)</th><th>하한가 대비</th><th>비고</th></tr></thead><tbody>';
    sm.wins.forEach(w => { h += '<tr><td>' + U.esc(w.no) + '</td><td>1등</td><td class="n">' + won(w.bid) + '</td><td class="n">' + w.rateOfEstimate + '%</td><td class="n">' + (w.rateOfFloor == null ? '' : w.rateOfFloor + '%') + '</td><td>2등과 차이 +' + w.secondGapPct + '%</td></tr>'; });
    sm.gaps.forEach(g => { h += '<tr><td>' + U.esc(g.no) + '</td><td>' + g.ourRank + '등(1등과 +' + g.behindPct + '% · ' + won(g.behindWon) + '원 차이)</td><td class="n">' + won(g.ourBid) + '</td><td class="n">' + g.rateOfEstimate + '%</td><td></td><td>1등 ' + won(g.winnerBid) + '</td></tr>'; });
    h += '</tbody></table></div></div>'; host.insertAdjacentHTML('afterbegin', h);
  }
  function bindBox() {
    const {$, S, ls, toast, nget, esc} = U;
    $('bx_fill').onclick = () => { const n = nget(); fillBox({org: n.org, title: n.title, due: n.due, budget: n.base, type: U.classify(n.title || '').cls, status: '검토중', floor: n.floor}); toast('현재 공고 정보를 가져왔습니다 (품목 ' + (S.itemsDoc || []).filter(i => i.name).length + '건 포함 저장)'); };
    $('bx_clear').onclick = () => fillBox({});
    $('bx_save').onclick = () => { const b = {org: $('bx_org').value.trim(), title: $('bx_title').value.trim(), due: $('bx_due').value, budget: $('bx_budget').value, type: $('bx_type').value, status: $('bx_status').value, contact: $('bx_contact').value, note: $('bx_note').value, rank: $('bx_rank').value, win: $('bx_win').value, floor: $('bx_floor').value, items: JSON.parse(JSON.stringify((S.itemsDoc || []).filter(i => i.name))), ts: new Date().toISOString(), n: nget()}; if (!b.org && !b.title) { toast('기관 또는 공고명을 입력하세요'); return; } b.id = 'b' + (b.org + '|' + b.title).split('').reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7); const all = box().filter(x => x.id !== b.id); all.push(b); ls.set(BK, all); renderBox(); toast('저장했습니다 (같은 기관+공고명은 덮어씀)'); };
    $('bx_find').onclick = () => { const q = $('bx_search').value.trim().toLowerCase(); renderBox(q ? box().filter(b => [b.org, b.title, b.note, b.contact].join(' ').toLowerCase().includes(q)) : null); }; $('bx_reset').onclick = () => { $('bx_search').value = ''; renderBox(); };
    $('bx_body').addEventListener('click', e => { const l = e.target.closest('[data-bxload]'), d = e.target.closest('[data-bxdel]'); if (l) { const b = box().find(x => x.id === l.dataset.bxload); if (!b) return; fillBox(b); const set = (id, v) => { $(id).value = v; $(id).classList.remove('auto'); }; set('n_org', b.org); set('n_title', b.title); set('n_due', b.due); if (b.budget) set('n_base', String(b.budget).replace(/[^\d]/g, '')); if (b.n) { Object.keys(b.n).forEach(k => { const e = $('n_' + k); if (e && b.n[k] !== undefined && b.n[k] !== null) { e.value = b.n[k]; e.classList.remove('auto'); } }); if (window.__BIDUI3 && window.__BIDUI3.syncAward) window.__BIDUI3.syncAward(); if (U.nsave) U.nsave(); } if (b.items && b.items.length) { S.itemsDoc = JSON.parse(JSON.stringify(b.items)); ls.set('wic02v2_items', S.itemsDoc); } U.S.items; toast('① 공고 정보와 ③ 품목으로 불러왔습니다'); } else if (d) { ls.set(BK, box().filter(x => x.id !== d.dataset.bxdel)); renderBox(); } });
  }

  /* ───────── 대용량 나라장터 XLSX 기관 누적 (원격 저장소 기능 보존: #fileInput · window.__TOOL002_LAST_RESULT__) ───────── */
  async function workerSource() {
    const scripts = [...document.scripts]; let x = scripts.find(s => !s.src && /^\s*\/\* inline: vendor\/xlsx/.test(s.textContent || '')); let xs;
    if (x) xs = x.textContent; else { const xe = scripts.find(s => s.src && /xlsx\.full\.min\.js/.test(s.src)); if (!xe) throw new Error('XLSX 라이브러리를 찾지 못했습니다'); xs = await (await fetch(xe.src)).text(); }
    return xs + '\n' + window.__INST_CORE_SRC + "\nself.onmessage=event=>{try{const workbook=XLSX.read(event.data,{type:'array',dense:true,cellStyles:false,cellNF:false,cellHTML:false});const sheet=workbook.Sheets[workbook.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});const result=WICInstitutionAccumulator.accumulateInstitutions(rows);self.postMessage({ok:true,result});}catch(error){self.postMessage({ok:false,error:String(error&&error.message||error)});}};";
  }
  function bindXlsx() {
    const {$, S, esc, toast, log} = U; const fi = $('fileInput'); if (!fi) return; let active = null;
    fi.addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return; if (active) active.terminate(); $('status').textContent = '작업중 — 별도 worker에서 XLSX 처리'; $('status').className = 'small hold';
      let w; try { w = active = window.__INST_WORKER_URL ? new Worker(window.__INST_WORKER_URL) : new Worker(URL.createObjectURL(new Blob([await workerSource()], {type: 'text/javascript'}))); } catch (e) { window.__TOOL002_LAST_RESULT__ = {status: 'HOLD_WORKER_ERROR', error: e.message}; $('status').textContent = 'HOLD_WORKER_ERROR: ' + e.message; return; }
      w.onmessage = message => {
        const payload = message.data; if (!payload.ok) { window.__TOOL002_LAST_RESULT__ = {status: 'HOLD_RUNTIME_ERROR', error: payload.error}; $('status').textContent = 'HOLD_RUNTIME_ERROR: ' + payload.error; return; }
        const result = payload.result; window.__TOOL002_LAST_RESULT__ = result; $('headerRow').textContent = result.headerRow == null ? '-' : result.headerRow; $('rowCount').textContent = result.rows.length; $('institutionCount').textContent = result.institutions.length;
        $('resultBody').replaceChildren(...result.institutions.slice(0, 300).map(item => { const tr = document.createElement('tr'), a = document.createElement('td'), b = document.createElement('td'); a.textContent = item.institution; b.textContent = item.count; tr.append(a, b); return tr; }));
        $('status').textContent = result.status + (result.institutions.length > 300 ? ' (기관 표는 상위 300건만 표시)' : ''); $('status').className = result.status === 'PASS' ? 'small ok' : 'small hold';
        if (result.status === 'PASS') { /* 입찰·확인필요 후보만 누적 목록에 반영(최대 2,000건) — 4만 건 전체를 화면 표에 올리지 않음 */
          const cand = []; for (const r of result.rows) { const c = U.classify(r.title); if (c.cls === '입찰' || c.cls === '확인필요') { cand.push({공고번호: r.noticeNo, 공고명: r.title, 수요기관: r.demandAgency || r.agency}); if (cand.length >= 2000) break; } }
          if (cand.length) { U.addRows(cand); log(`대용량 XLSX: ${result.rows.length}행 → 기관 ${result.institutions.length}곳, 후보 ${cand.length}건 누적`); toast(`기관 ${result.institutions.length}곳 누적 · 입찰/확인필요 후보 ${cand.length}건을 목록에 추가`); }
        }
        w.terminate(); active = null;
      };
      w.onerror = error => { window.__TOOL002_LAST_RESULT__ = {status: 'HOLD_WORKER_ERROR', error: error.message}; $('status').textContent = 'HOLD_WORKER_ERROR: ' + error.message; };
      const buffer = await file.arrayBuffer(); w.postMessage(buffer, [buffer]);
    });
  }
})();
