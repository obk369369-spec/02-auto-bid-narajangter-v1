/* 02 입찰 도구 v3.2 — 상황 진단·전략 구간 화면 (ui2.js 다음, ui.js 앞에서 로드. ui.js 가 끝에서 init(U) 를 호출한다)
   · 5가지 변수 입력 → E.strategy.analyze → 근거 라벨이 붙은 구간 차트·후보표·시뮬레이션 표
   · 출력 서류(.xls/.doc) 직전 내부 원가·커미션 유출 차단(guard) · 장부 1행의 원가 칸 비움(redactLedger) */
(() => {
  'use strict';
  const api = window.__BIDUI3 = {}; let U = null; const E = () => window.BIDENG, ST = () => window.BIDENG.strategy;
  const SKEY = 'wic02v31_s';
  const FLAGTXT = {LOSS: ['적자', 'bad'], UNDER_MIN_MARGIN: ['최소마진 미달', 'warn'], UNDER_GUIDE: ['대외 안내 미달', 'warn'], OVER_BASE: ['기초금액 초과(무효 위험)', 'bad'], BELOW_FLOOR_ALWAYS: ['항상 탈락(하한 미만)', 'bad'], FLOOR_RISK: ['예정가격에 따라 탈락 가능', 'warn']};
  const SHORT = {BE: '적자선', GD: '안내선', CAP: '기초금액', FL: '하한 아래끝', FH: '하한 위끝', EL: '통과 최저', EH: '평점 최고', TM: '목표마진', CD: '경쟁가정', CG: '경쟁−폭'};

  api.init = u => {
    U = u; const {$, ls} = U; const saved = ls.get(SKEY, {});
    ['s_org', 's_orgkey', 's_sales', 's_contract'].forEach(id => { if (saved[id] !== undefined) $(id).value = saved[id]; });
    ['s_urgent', 's_rebid'].forEach(id => { if (saved[id] !== undefined) $(id).checked = !!saved[id]; });
    const store = () => { const o = {}; ['s_org', 's_orgkey', 's_sales', 's_contract'].forEach(id => o[id] = $(id).value); ['s_urgent', 's_rebid'].forEach(id => o[id] = $(id).checked); ls.set(SKEY, o); };
    ['s_org', 's_orgkey', 's_sales', 's_contract', 's_urgent', 's_rebid'].forEach(id => $(id).addEventListener('change', () => { store(); live(); }));
    let tm = null; const live = () => { if (!U.S.strat) return; clearTimeout(tm); tm = setTimeout(() => api.run(), 120); };
    /* 슬라이더 ↔ 숫자 입력 동기화 (목표 마진율 · 예상 경쟁 할인율) */
    [['rng_mrg', 'c_mrg'], ['rng_cdisc', 'c_cdisc']].forEach(([r, n]) => {
      const rg = $(r), nu = $(n); if (nu.value !== '') rg.value = nu.value;
      rg.addEventListener('input', () => { nu.value = rg.value; U.csave(); live(); });
      nu.addEventListener('input', () => { const v = parseFloat(nu.value); if (isFinite(v)) rg.value = String(Math.min(Number(rg.max), Math.max(Number(rg.min), v))); U.csave(); live(); });
    });
    ['c_comm', 'c_guide', 'c_tlo', 'c_thi', 'c_smin', 'c_cgap', 'c_step', 'c_trates'].forEach(id => $(id).addEventListener('input', () => { U.csave(); live(); }));
    $('stratBtn').onclick = () => { api.run(); };
    $('stratClear').onclick = () => { ['c_comm', 'c_guide', 'c_tlo', 'c_thi', 'c_mrg', 'c_cdisc', 'c_cgap', 'c_trates'].forEach(id => $(id).value = ''); $('rng_mrg').value = 0; $('rng_cdisc').value = 0; $('c_smin').value = '0'; $('c_step').value = '5'; U.csave(); U.S.strat = null; $('stratOut').innerHTML = '<div class="empty">내부 원가·안내 기준을 비웠습니다. 값을 입력한 뒤 [상황 진단·구간 계산]을 누르세요.</div>'; U.toast('내부 원가·전략 입력을 비웠습니다'); };
  };

  function profileOf(n) {
    const {$} = U; const S0 = ST(); const org = $('s_org').value === 'auto' ? S0.detectOrg(n.org) : $('s_org').value; const key = $('s_orgkey').value === 'auto' ? S0.detectOrgKey(n.org) : ($('s_orgkey').value === 'none' ? '' : $('s_orgkey').value);
    return {org, orgKey: key, sales: $('s_sales').value, contract: $('s_contract').value, urgent: $('s_urgent').checked, rebid: $('s_rebid').checked};
  }
  /* 실제 커미션이 입력되면 기존 계산(최저가·하한율제 화면)도 같은 원가(정가×환율×(1−커미션))를 쓰도록 계수로 환산한다 — 화면 전용, 저장값은 그대로 */
  api.eff = c => { const v = parseFloat(String(c.comm).replace(/,/g, '')); if (String(c.comm).trim() === '' || !isFinite(v) || v < 0 || v >= 100) return c; return Object.assign({}, c, {costmode: 'ledger', disc: String(Math.round((1 - v / 100) * 1e6) / 1e6)}); };
  api.compute = () => {
    const n = U.nget(), c = U.cget(), s = profileOf(n); const award = n.award || (n.floor ? 'floor' : ''); let fo = null;
    if (award === 'floor') { try { fo = E().calc(U.buildInp()); } catch (e) { fo = null; } }
    const p = ST().fromForm(n, c, s, fo); const an = ST().analyze(p); U.S.strat = an; U.S.stratP = p; return an;
  };
  const badge = src => `<span class="src ${src.cls}" title="기능: 이 숫자의 근거 · 결과: 어떤 자료에서 나온 값인지 표시 · 사용시점: 숫자를 믿고 쓰기 전에">${U.esc(src.label)}</span>`;
  const pct2 = x => (Math.round(x * 100) / 100) + '%';

  /* ───────── 구간 차트 (음영) ───────── */
  function chart(an) {
    const {won, svg, T, C} = U; const W = 700, H = 262, pl = 30, pr = 24, ay = 120, bh = 44;
    const rates = an.lines.map(l => l.rate).concat(an.cands.map(c => c.rate), an.zone ? [an.zone.loRate, an.zone.hiRate] : []); let lo = Math.max(0, Math.floor((Math.min(...rates, 100) - 6) / 5) * 5), hi = Math.max(104, Math.ceil(Math.max(...rates) / 2) * 2 + 2); if (hi - lo < 20) lo = Math.max(0, hi - 40);
    const X = r => pl + (r - lo) / (hi - lo) * (W - pl - pr); const rect = (a, b, fill, op, extra) => (b > a ? `<rect x="${X(a)}" y="${ay - bh / 2}" width="${X(b) - X(a)}" height="${bh}" fill="${fill}" opacity="${op}" ${extra || ''}/>` : '');
    let s = `<rect x="${pl}" y="${ay - bh / 2}" width="${W - pl - pr}" height="${bh}" fill="#f1f5f9" stroke="#e2e8f0"/>`;
    const be = an.breakEven ? an.breakEven.rate : null, gd = an.guideLine ? an.guideLine.rate : null;
    if (be != null) s += rect(lo, Math.min(be, 100), C.r, .22); if (gd != null && (be == null || gd > be)) s += rect(be == null ? lo : be, gd, C.a, .2);
    s += rect(100, hi, '#7f1d1d', .2);
    if (an.zone) s += rect(an.zone.loRate, an.zone.hiRate, C.g, .34, `stroke="${C.gd}" stroke-width="1.5"`);
    else if (an.feasible && an.feasible.hiRate) s += rect(an.feasible.loRate == null ? lo : an.feasible.loRate, 100, C.g, .12, `stroke="${C.gd}" stroke-dasharray="5 4"`);
    if (an.floorBand) { const fb = an.floorBand; s += rect(lo, an.lines.find(l => l.id === 'FL') ? an.lines.find(l => l.id === 'FL').rate : lo, C.r, .14); }
    /* 선 + 라벨(겹침 방지: 3줄 순환) */
    const ls = an.lines.slice().sort((a, b) => a.rate - b.rate); const rows = [34, 18, 50]; let k = 0;
    ls.forEach(l => { const x = X(Math.min(hi, Math.max(lo, l.rate))); const col = l.src.key === 'rule' ? C.gd : l.src.key === 'measured' ? '#0e7490' : l.src.key === 'assume' ? '#b45309' : l.src.key === 'deflt' ? '#9a3412' : C.b; const sh = l.id.startsWith('M') ? '과거 1등' : (SHORT[l.id] || l.id); const yy = rows[k++ % 3];
      s += `<line x1="${x}" x2="${x}" y1="${ay - bh / 2 - 6}" y2="${ay + bh / 2 + 6}" stroke="${col}" stroke-width="2.4"/><line x1="${x}" x2="${x}" y1="${yy + 4}" y2="${ay - bh / 2 - 6}" stroke="${col}" stroke-width=".8" stroke-dasharray="2 3"/>` + T(x, yy, sh + ' ' + l.rate + '%', {fill: col, bold: true, size: 10.5}); });
    an.cands.forEach(c => { const x = X(Math.min(hi, Math.max(lo, c.rate))); const col = c.flags.includes('LOSS') ? C.r : C.t; s += `<path d="M${x - 6} ${ay + bh / 2 + 10}L${x + 6} ${ay + bh / 2 + 10}L${x} ${ay + bh / 2 + 21}Z" fill="${col}"/>` + T(x, ay + bh / 2 + 34, c.id, {bold: true, size: 10.5, fill: col}); });
    [lo, Math.round((lo + hi) / 2 / 5) * 5, 100].forEach(r => { s += T(X(r), H - 22, r + '%', {size: 10, fill: C.m}); });
    s += T(W / 2, H - 6, '기초금액 대비 투찰률 — 빨강: 적자 · 주황: 대외 안내 미달 · 초록: ' + (an.zone ? '공고 규칙 가능 구간' : '가능 범위(점선, 낙찰 구간 산출 불가)') + ' · 진한 빨강: 기초금액 초과', {size: 10, fill: C.m});
    return svg(W, H, s, '상황별 투찰 구간');
  }

  const flagHtml = f => f.length ? f.map(x => `<span class="${FLAGTXT[x][1]}">${FLAGTXT[x][0]}</span>`).join(' · ') : '<span class="ok">이상 없음</span>';
  function candRows(list, an, withName) {
    const {won} = U; return list.map((c, i) => `<tr data-pick="${c.bid}" class="${c.flags.includes('LOSS') ? 'lossrow' : ''}" style="cursor:pointer" title="기능: 이 금액을 서류 작성 탭의 투찰금액으로 선택 · 결과: ③ 서류에 반영 · 사용시점: 금액을 정했을 때"><td>${U.esc(c.id)}</td>${withName ? `<td>${U.esc(c.name)}</td>` : ''}<td class="n">${c.rate}%</td><td class="n">${won(c.bid)}</td><td class="n">${won(c.supply)}</td><td class="n ${c.profit != null && c.profit < 0 ? 'bad' : ''}">${c.profit == null ? '확인 필요' : won(c.profit)}</td><td class="n">${c.profitPct == null ? '-' : c.profitPct.toFixed(2) + '%'}</td><td>${flagHtml(c.flags)}${c.inZone === true ? ' · <span class="ok">구간 안</span>' : ''}</td><td>${badge(c.src)}</td></tr>`).join('');
  }

  api.render = an => {
    const {$, won, esc} = U; const out = $('stratOut'); const h = [];
    if (!an.ok) { out.innerHTML = `<div class="card"><div class="bad">입력 확인 필요 — 구간을 계산하지 않았습니다 (빈칸·잘못된 값은 추측하지 않습니다)</div><div style="margin-top:8px">${an.errors.map(x => '· ' + esc(x)).join('<br>')}</div></div>`; return; }
    const P0 = an.profile; const chip = (k, v) => `<span class="pill"><b>${esc(k)}</b> ${esc(v)}</span>`;
    h.push(`<div class="card strat"><h2>상황 진단 · 전략 요약 <span class="small" style="font-weight:400">· 근거가 있는 숫자만 사용합니다</span></h2>
      <div>${chip('① 기관', P0.orgName.split(' (')[0])}${chip('② 낙찰방식', P0.awardName)}${chip('③ 영업·독점', P0.salesName + (P0.urgent ? ' · 긴급' : '') + (P0.rebid ? ' · 재공고' : ''))}${chip('④ 과세·계약', (P0.tax === 'free' ? '면세' : '과세 ' + an.vatRate + '%') + ' · ' + P0.contractName)}${chip('⑤ 원가 분리', an.cost == null ? '실제 원가 미입력' : '실제 원가 ' + won(an.cost) + '원 (내부용)')}</div>
      <div class="kpis" style="margin-top:14px">
        <div class="kpi"><small>① 최저 적자 방어선</small><b>${an.defense ? won(an.defense.bid) + '원' : '원가 필요'}</b><em>${an.defense ? '기초금액의 ' + pct2(an.defense.rate) + ' · ' + esc(an.defense.why) : '실제 원가를 넣으면 계산'}</em><div>${an.defense ? badge(an.defense.src) : ''}</div></div>
        <div class="kpi"><small>② 낙찰 가능 구간</small><b>${an.zone ? won(an.zone.lo) + ' ~ ' + won(an.zone.hi) + '원' : an.winStatus === 'nego' ? '가격 구간 없음(기술 평가)' : an.winStatus === 'blocked' ? '방어선과 겹침 없음' : '산출 불가'}</b><em>${an.zone ? '기초금액의 ' + pct2(an.zone.loRate) + ' ~ ' + pct2(an.zone.hiRate) : '근거 데이터 부족 → 숫자를 만들지 않음'}</em><div>${an.zone ? badge(an.zone.src) : '<span class="src src-none">근거 부족 · 아래 시뮬레이션 표로 직접 비교</span>'}</div></div>
        <div class="kpi"><small>③ 상한 (기초금액)</small><b>${won(an.ref)}원</b><em>초과 투찰 = 무효 위험</em><div>${badge(an.src.rule)}</div></div></div>
      ${an.reasons.map(x => `<div class="explainbox" style="background:#eff6ff;border-color:#bfdbfe">${esc(x)}</div>`).join('')}
      ${an.warns.map(x => `<div class="explainbox" style="background:#fee2e2;border-color:#fecaca">${esc(x)}</div>`).join('')}
      ${(m => (an.cost != null && U.$('c_cur').value !== 'KRW') ? `<p class="small">환율 출처: ${m && String(m.rate) === String(U.$('c_fx').value) ? esc(m.source) + ' · 기준 ' + esc(m.asOf) + ' · 조회 ' + esc(m.fetchedAt) + ' (시장 환율 · 은행 고시환율 아님)' : '수동 입력'}</p>` : '')(U.S.fxMeta)}
      <p class="small">※ 이 화면은 내부용입니다 — 실제 원가·커미션·순이익은 .xls/.doc 서류에 출력되지 않으며, 출력 직전 검사에서 발견되면 내려받기가 차단됩니다.</p></div>`);
    h.push(`<div class="card"><h2>구간 차트</h2><div class="chart">${chart(an)}</div><div class="small" style="margin-top:6px">선 색: ${badge(an.src.rule)} ${badge(an.src.input)} ${an.measured ? badge(an.src.measured) : ''} ${an.lines.some(l => l.src.key === 'assume') ? badge(an.src.assume) : ''}</div></div>`);
    h.push(`<div class="card"><h2>후보 투찰안과 실제 순이익 <span class="small" style="font-weight:400">· 행을 누르면 그 금액을 서류에 반영</span></h2>${an.cands.length ? `<div class="scroll"><table id="candTbl"><thead><tr><th>안</th><th>설명</th><th>투찰률</th><th>투찰가(총액)</th><th>공급가액</th><th>실제 순이익(내부)</th><th>순이익률</th><th>판정</th><th>출처</th></tr></thead><tbody>${candRows(an.cands, an, true)}</tbody></table></div>` : '<div class="empty">후보가 없습니다. 목표 구간·직접 후보·목표 마진을 입력하세요.</div>'}</div>`);
    h.push(`<details open><summary>시뮬레이션 표 — 투찰률을 ${an.step}%p 간격으로 직접 비교 (간격은 위 입력칸에서 조절)</summary><div class="inner"><p class="small">이 표의 모든 줄은 "기초금액 × 투찰률" 단순 계산입니다. 낙찰 확률을 뜻하지 않으며, 출처는 사용자가 입력한 원가·안내 기준과 공고의 기초금액입니다.</p><div class="scroll"><table id="gridTbl"><thead><tr><th>안</th><th>투찰률</th><th>투찰가(총액)</th><th>공급가액</th><th>실제 순이익(내부)</th><th>순이익률</th><th>판정</th><th>출처</th></tr></thead><tbody>${candRows(an.grid, an, false)}</tbody></table></div></div></details>`);
    h.push(`<details><summary>이 숫자들의 근거 (계산에 쓴 층 ${an.layers.length}개)</summary><div class="inner">${an.layers.map(l => `<div style="margin-bottom:10px"><b>${esc(l.label)}</b> ${badge(l.src)}<div class="small">${esc(l.detail)}</div></div>`).join('')}<h3>선(라인) 목록</h3><div class="scroll"><table><thead><tr><th>선</th><th>금액</th><th>투찰률</th><th>출처</th><th>설명</th></tr></thead><tbody>${an.lines.map(l => `<tr><td>${esc(l.label)}</td><td class="n">${won(l.bid)}</td><td class="n">${l.rate}%</td><td>${badge(l.src)}</td><td class="small">${esc(l.detail)}</td></tr>`).join('')}</tbody></table></div></div></details>`);
    out.innerHTML = h.join('');
    out.querySelectorAll('[data-pick]').forEach(tr => tr.onclick = () => { const el = $('d_bid'); el.value = tr.dataset.pick; el.dataset.auto = '0'; U.toast('투찰금액 ' + won(Number(tr.dataset.pick)) + '원을 ③ 서류 작성에 반영했습니다'); U.log('전략표에서 투찰금액 선택: ' + won(Number(tr.dataset.pick))); });
  };
  api.run = () => { const an = api.compute(); api.render(an); U.log(`전략 진단: ${an.ok ? (an.zone ? '구간 ' + an.zone.lo + '~' + an.zone.hi : '구간 산출 불가(' + an.winStatus + ')') : '입력 확인 필요'}`); return an; };

  /* ───────── 출력 서류 보안: 내부 원가·커미션 유출 차단 ───────── */
  const toText = x => (Array.isArray(x) ? ST().leak.rowsToText(x) : ST().leak.htmlToText(x));
  api.secrets = () => { api.compute(); return ST().leak.build(U.S.stratP, U.S.strat && U.S.strat.ok ? U.S.strat : null); };
  api.guard = (name, content) => {
    const sec = api.secrets(); const bid = Number(String(U.$('d_bid').value).replace(/[^\d]/g, '')) || 0; const tf = U.$('n_tax').value === 'free';
    const sp = bid ? (tf ? bid : E().pricing.splitVat(bid, 10).supply) : 0; const allow = bid ? [bid, sp, bid - sp, Math.round(bid * 0.9), Math.round(bid / 1.1), Math.round(bid * 0.05), Math.ceil(bid * 0.05), Math.round(bid * 0.9 * 0.1)] : [];
    const hits = ST().leak.scan(toText(content), sec, allow);
    /* API 키(환율 인증키·AI 키)가 서류에 섞이는 것도 차단 */
    ['wic02_ai_cfg', 'wic02_fx_cfg'].forEach(k => { const o = U.ls.get(k, {}) || {}; [o.key, o.koreaeximKey].forEach(v => { if (v && String(v).length >= 8 && toText(content).includes(v)) hits.push('API 키'); }); });
    if (hits.length) { U.toast('내부 원가·커미션 정보가 서류에 섞여 있어 내려받기를 막았습니다 (' + hits.join(', ') + ')'); U.log('서류 출력 차단: ' + name + ' — ' + hits.join(' / ')); window.__BIDUI3_BLOCKED = (window.__BIDUI3_BLOCKED || []).concat([{name, hits}]); return false; }
    return true;
  };
  api.redactLedger = row => { const sec = api.secrets(); const has = sec.amounts.size || sec.small.length || String(row[23] || row[24] || '') !== ''; if (!has) return row; U.toast('장부 1행: 원가·디스카운트 칸은 내부 정보라 비워서 내려받습니다'); return ST().redactLedger(row); };
})();
