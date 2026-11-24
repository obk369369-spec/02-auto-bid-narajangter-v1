/* 02 입찰 도구 v3.3 — 실시간 환율 조회 · AI 심층 입찰 전략 분석 화면 (ui3.js 다음, ui.js 앞에서 로드. ui.js 가 끝에서 init(U) 호출)
   키 보안: 모든 설정(환율 인증키·AI 키)은 localStorage 'wic02_fx_cfg' / 'wic02_ai_cfg' 에만 저장한다. 화면 결과·서류·CSV·Evidence·URL 에는 넣지 않는다. */
(() => {
  'use strict';
  const api = window.__BIDUI4 = {}; let U = null; const E = () => window.BIDENG;
  const FXK = 'wic02_fx_cfg', AIK = 'wic02_ai_cfg', FXLAST = 'wic02_fx_last';
  const netFetch = (u, i) => window.fetch(u, i); /* 호출 시점에 window.fetch 를 읽는다(시험에서 모의 가능) */
  const esc = s => U.esc(s);
  const fxCfg = () => Object.assign({provider: 'er', koreaeximKey: '', auto: true}, U.ls.get(FXK, {}));
  const aiCfg = () => Object.assign({provider: 'claude', model: '', key: ''}, U.ls.get(AIK, {}));

  api.init = u => {
    U = u; const {$, ls} = U; const fc = fxCfg(), ac = aiCfg();
    $('fx_prov').value = fc.provider; $('fx_key').value = fc.koreaeximKey || ''; $('fx_auto').checked = !!fc.auto; $('ai_prov').value = ac.provider; $('ai_model').value = ac.model || ''; $('ai_key').value = ac.key || '';
    $('ai_model').placeholder = E().ai.PROVIDERS[ac.provider].defaultModel; showCfgMsg();
    const saveFx = () => ls.set(FXK, {provider: $('fx_prov').value, koreaeximKey: $('fx_key').value.trim(), auto: $('fx_auto').checked});
    ['fx_prov', 'fx_key', 'fx_auto'].forEach(id => $(id).addEventListener('change', saveFx));
    $('ai_prov').addEventListener('change', () => { $('ai_model').placeholder = E().ai.PROVIDERS[$('ai_prov').value].defaultModel; });
    $('aiSave').onclick = () => { ls.set(AIK, {provider: $('ai_prov').value, model: $('ai_model').value.trim(), key: $('ai_key').value.trim()}); showCfgMsg(); U.toast('AI 설정을 이 브라우저에 저장했습니다'); };
    $('aiClear').onclick = () => { ls.set(AIK, {provider: $('ai_prov').value, model: $('ai_model').value.trim(), key: ''}); $('ai_key').value = ''; showCfgMsg(); U.toast('저장된 API 키를 지웠습니다'); };
    $('fxBtn').onclick = () => api.fetchFx(true);
    $('c_cur').addEventListener('change', () => { const c = fxCfg(); if (c.auto && $('c_cur').value !== 'KRW' && !$('c_fx').value.trim()) api.fetchFx(false); else if ($('c_cur').value === 'KRW') $('fxInfo').textContent = '원화(KRW)는 환율이 필요 없습니다'; });
    $('c_fx').addEventListener('input', () => { const m = U.S.fxMeta; if (m && String($('c_fx').value) !== String(m.rate)) { U.S.fxMeta = null; $('fxInfo').innerHTML = '<span class="small">수동 입력한 환율입니다</span>'; } });
    $('aiBtn').onclick = () => api.runAi();
    const last = ls.get(FXLAST, null); if (last) $('fxInfo').innerHTML = `<span class="small">마지막 성공 조회(참고): ${esc(last.cur)} ${esc(String(last.rate))} · ${esc(last.source)} · 조회 ${esc(last.fetchedAt)}</span>`;
  };
  function showCfgMsg() { const c = aiCfg(); U.$('aiCfgMsg').textContent = c.key ? '키 저장됨 (●●●●) · ' + E().ai.PROVIDERS[c.provider].name + ' · 이 브라우저에만 보관' : '저장된 키 없음'; }

  /* ───────── 실시간 환율 ───────── */
  api.fetchFx = async manual => {
    const {$, toast, log} = U; const cur = $('c_cur').value; const info = $('fxInfo');
    if (cur === 'KRW') { info.textContent = '원화(KRW)는 환율이 필요 없습니다 — 정가 통화를 외화로 바꾸세요'; if (manual) toast('통화가 원화입니다'); return null; }
    info.textContent = '환율 조회 중…'; const btn = $('fxBtn'); btn.disabled = true;
    const r = await E().fx.fetchRate(cur, fxCfg(), netFetch); btn.disabled = false;
    if (r.ok) {
      if (!manual && $('c_fx').value.trim()) { info.textContent = '직접 입력한 환율이 있어 덮어쓰지 않았습니다'; return r; } /* 자동 조회는 사용자가 쓴 값을 절대 덮어쓰지 않는다 */
      $('c_fx').value = String(r.rate); U.csave(); U.S.fxMeta = {rate: r.rate, cur: r.cur, source: r.source, asOf: r.asOf, fetchedAt: r.fetchedAt}; U.ls.set(FXLAST, U.S.fxMeta);
      info.innerHTML = `<b>${esc(String(r.rate))}</b> 원/${esc(cur)} · 출처 ${esc(r.source)} · 기준 ${esc(r.asOf)} · 조회 ${esc(r.fetchedAt)}<br><span class="small">${esc(r.disclaimer)}</span>`;
      toast('환율 ' + r.rate + ' (' + r.source + ')'); log('환율 조회: ' + cur + ' ' + r.rate + ' / ' + r.source + ' / 기준 ' + r.asOf); return r;
    }
    const last = U.ls.get(FXLAST, null);
    info.innerHTML = `<span class="warn">환율을 불러오지 못했습니다 — 환율 칸에 직접 입력하세요.</span> <span class="small">(${esc(r.errors.map(e => e.provider + ': ' + e.msg).join(' · '))})${last ? ' · 마지막 성공 조회(참고, 자동 입력 안 함): ' + esc(last.cur) + ' ' + esc(String(last.rate)) + ' · ' + esc(last.fetchedAt) : ''}</span>`;
    if (manual) toast(r.offline ? '오프라인입니다 — 환율을 직접 입력하세요' : '환율 조회 실패 — 직접 입력하세요'); log('환율 조회 실패: ' + r.errors.map(e => e.provider + ' ' + e.msg).join(' / ')); return r;
  };

  /* ───────── AI 심층 분석 ───────── */
  const noticeText = () => (U.S.docs || []).map(d => d.text).join('\n');
  const qBadge = st => (st === 'found' ? '<span class="src src-rule">원문 확인됨</span>' : st === 'missing' ? '<span class="src src-assume">원문에서 찾지 못함 (AI 추정)</span>' : '<span class="src src-none">원문 인용 없음</span>');
  function riskList(list, nt) { return list.length ? list.map(r => `<div style="margin-bottom:12px"><b>${esc(r.title)}</b> ${qBadge(E().ai.quoteStatus(r.quote, nt))}<div class="small" style="color:#334155;font-size:13px">${esc(r.detail)}</div>${r.quote ? `<div class="small" style="border-left:3px solid #cbd5e1;padding-left:8px;margin-top:4px">“${esc(r.quote)}”</div>` : ''}</div>`).join('') : '<div class="small">AI 가 제시한 항목이 없습니다.</div>'; }
  api.runAi = async () => {
    const {$, won} = U; const msg = $('aiMsg'); const out = $('aiOut'); const cfg = aiCfg();
    if (!cfg.key) { msg.innerHTML = '<span class="warn">AI 키가 없습니다 — 위 [환율·AI 설정]에서 키를 입력하고 저장하세요.</span>'; $('cfgCard').open = true; return; }
    if (!$('ai_consent').checked) { msg.innerHTML = '<span class="warn">외부 AI 서버로 전송됨을 이해한다는 항목을 체크해야 분석합니다.</span>'; return; }
    const an = window.__BIDUI3 ? window.__BIDUI3.compute() : null; const includeCost = $('ai_cost').checked && an && an.ok;
    const prompt = E().ai.buildPrompt({notice: U.nget(), docs: U.S.docs || [], strat: an && an.ok ? an : null, includeCost});
    msg.textContent = '분석 중… (' + E().ai.PROVIDERS[cfg.provider].name + ' 서버로 전송됨)'; $('aiBtn').disabled = true; out.innerHTML = '';
    const res = await E().ai.run(cfg, prompt, netFetch); $('aiBtn').disabled = false;
    if (!res.ok) { msg.innerHTML = '<span class="bad">분석 실패</span>'; out.innerHTML = `<div class="card"><div class="bad">AI 분석을 하지 못했습니다</div><div style="margin-top:8px">${esc(res.error)}</div><p class="small">키·모델 이름·네트워크를 확인하세요. 이 도구의 다른 계산은 그대로 쓸 수 있습니다.</p></div>`; U.log('AI 분석 실패: ' + res.error); return; }
    const parsed = E().ai.parse(res.text);
    if (!parsed.ok) { msg.innerHTML = '<span class="warn">응답을 구조화하지 못했습니다</span>'; out.innerHTML = `<div class="card"><div class="warn">AI 응답을 표로 바꾸지 못했습니다 (${esc(parsed.error)}) — 원문을 그대로 보여 줍니다.</div><pre class="log">${esc(parsed.raw || '')}</pre></div>`; return; }
    msg.textContent = '분석 완료 · ' + (res.model || '') + (prompt.clipped ? ' · 공고문은 앞부분만 전송됨' : '');
    /* AI 가 제안한 투찰률 → 엔진이 다시 계산(금액·순이익·경고) */
    let rows = {}; if (an && an.ok && U.S.stratP) { const rates = parsed.scenarios.map(s => s.rate).filter(r => r != null); if (rates.length) { const a2 = E().strategy.analyze(Object.assign({}, U.S.stratP, {custom: rates})); if (a2.ok) a2.cands.forEach(c => { rows[c.rate] = c; }); } }
    const nt = noticeText(); const h = [];
    h.push(`<div class="card"><h2>AI 심층 입찰 전략 분석 결과 <span class="src src-ai">AI 제안 (근거 데이터 아님 · 검증 필요)</span></h2><p class="small">제공사 ${esc(E().ai.PROVIDERS[cfg.provider].name)} · 모델 ${esc(res.model || '')}${prompt.clipped ? ' · 공고문 ' + prompt.totalChars + '자 중 앞 ' + E().ai.MAX_NOTICE_CHARS + '자만 전송' : ''}${includeCost ? ' · 내부 원가·대외 안내 포함 전송' : ' · 내부 원가 미전송'}. 이 결과는 서류에 자동 반영되지 않고 화면에만 표시됩니다.</p></div>`);
    h.push(`<div class="card"><h2>① 숨은 리스크 · 참가자격 주의사항</h2>${riskList(parsed.risks.concat(parsed.cautions.map(c => Object.assign({}, c, {title: '[참가자격] ' + c.title}))), nt)}</div>`);
    const lvCls = {낮음: 'src-rule', 보통: 'src-def', 높음: 'src-assume', 판단불가: 'src-none'}[parsed.competition.level];
    h.push(`<div class="card"><h2>② 경쟁 강도 진단 <span class="small" style="font-weight:400">· AI 추정</span></h2><div><span class="src ${lvCls}" style="font-size:13px">${esc(parsed.competition.level)}</span></div>${parsed.competition.reasons.map(r => `<div class="small" style="font-size:13px;color:#334155">· ${esc(r)}</div>`).join('')}<div class="small" style="margin-top:6px">근거로 든 자료: ${esc(parsed.competition.basis || '(밝히지 않음)')}</div></div>`);
    h.push(`<div class="card"><h2>③ 시나리오별 권장 투찰 전략</h2>${parsed.scenarios.length ? `<div class="scroll"><table id="aiScTbl"><thead><tr><th>시나리오</th><th>AI 제안 투찰률</th><th>도구가 계산한 투찰가</th><th>실제 순이익(내부)</th><th>검증</th><th>근거</th><th>가정·위험</th></tr></thead><tbody>${parsed.scenarios.map(s => { const c = s.rate != null ? rows[Math.round(s.rate * 1000) / 1000] : null; return `<tr><td><b>${esc(s.name)}</b></td><td class="n">${s.rate == null ? '-' : s.rate + '%'}</td><td class="n">${c ? won(c.bid) + '원' : (s.rate == null ? '-' : '계산 불가(입력 필요)')}</td><td class="n ${c && c.profit != null && c.profit < 0 ? 'bad' : ''}">${c && c.profit != null ? won(c.profit) : '확인 필요'}</td><td>${c ? (c.flags.length ? c.flags.map(f => `<span class="warn">${esc(f)}</span>`).join(' ') : '<span class="ok">방어선·상한 이상 없음</span>') : '-'}</td><td class="small" style="font-size:12.5px;color:#334155">${esc(s.rationale)}</td><td class="small">${s.assumptions.map(x => '가정: ' + esc(x)).join('<br>')}${s.risks.length ? '<br>' + s.risks.map(x => '위험: ' + esc(x)).join('<br>') : ''}</td></tr>`; }).join('')}</tbody></table></div><p class="small" style="margin-top:8px">투찰가·순이익은 AI 가 아니라 이 도구의 계산 엔진이 AI 가 제안한 투찰률로 다시 계산한 값입니다. 투찰률 자체는 ${'<span class="src src-ai">AI 제안 (근거 데이터 아님 · 검증 필요)</span>'}입니다.</p>` : '<div class="small">시나리오가 없습니다.</div>'}${parsed.missing.length ? `<h3>AI 가 부족하다고 한 정보</h3>${parsed.missing.map(m => `<div class="small" style="font-size:13px">· ${esc(m)}</div>`).join('')}` : ''}</div>`);
    out.innerHTML = h.join(''); U.log('AI 분석 완료: ' + (res.model || '') + ' / 시나리오 ' + parsed.scenarios.length + '건');
  };
})();
