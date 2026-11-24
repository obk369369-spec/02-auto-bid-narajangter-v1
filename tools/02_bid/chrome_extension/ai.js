/* AI 심층 입찰 전략 분석 (v3.3) — 사용자가 입력한 자신의 API 키(Claude 또는 Gemini)로 공고문·기관·원가·대외 안내를 보내 구조화된 분석을 받는다.
   [보안] 키는 이 브라우저의 localStorage('wic02_ai_cfg')에만 저장된다. 코드·저장소·서류·화면 결과·URL·CSV·Evidence 어디에도 넣지 않으며, 요청 헤더로만 제공사에 전달된다(Claude: x-api-key / Gemini: x-goog-api-key — URL 쿼리에 넣지 않음).
   [근거 규칙] AI 의 숫자는 "AI 제안(근거 데이터 아님 · 검증 필요)"로 표시한다. AI 가 제안한 투찰률은 엔진이 다시 계산해(금액·순이익) 보여 주고, AI 가 인용한 공고 원문 문구는 실제 원문에 있는지 대조해 "원문 확인됨/원문에서 찾지 못함"을 붙인다.
   미검증(HOLD): 이 PC 에서 실제 API 키로 제공사 서버를 호출해 보지 못했다 — 요청·응답 형식은 공식 문서 기준 구현이며, 시험은 모의 응답(stub)으로 했다. */
(function (g) {
  'use strict';
  const E = g.BIDENG || {};
  const PROVIDERS = {
    claude: {id: 'claude', name: 'Claude (Anthropic)', endpoint: 'https://api.anthropic.com/v1/messages', defaultModel: 'claude-sonnet-5-5', keyHint: 'sk-ant-…'},
    gemini: {id: 'gemini', name: 'Gemini (Google)', endpoint: m => 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(m) + ':generateContent', defaultModel: 'gemini-2.5-flash', keyHint: 'AIza…', modelUnverified: true}
  };
  const MAX_NOTICE_CHARS = 60000;
  const SCHEMA = '{"hidden_risks":[{"title":"","detail":"","evidence_quote":"공고문 원문에서 그대로 인용(없으면 빈 문자열)"}],"eligibility_cautions":[{"title":"","detail":"","evidence_quote":""}],"competition":{"level":"낮음|보통|높음|판단불가","reasons":[""],"basis":"어떤 제공 자료에 근거했는지"},"scenarios":[{"name":"","bid_rate_percent":null,"rationale":"","assumptions":[""],"risks":[""]}],"missing_info":[""]}';
  const SYSTEM = [
    '당신은 대한민국 공공기관 해외 시장조사 보고서·학술자료 입찰을 돕는 분석 보조자입니다. 사용자가 제공한 자료만 근거로 삼으세요.',
    '규칙: (1) 제공되지 않은 통계·확률·평균 낙찰률·경쟁사 정보를 지어내지 마세요. 모르면 "판단불가" 또는 "확인 필요"라고 쓰세요. (2) evidence_quote 는 공고문 원문에서 글자 그대로 복사한 문구만 넣으세요(없으면 빈 문자열). (3) bid_rate_percent 는 기초금액 대비 투찰률(%)이며, 제공된 낙찰하한율·적자 방어선·대외 안내선과 모순되면 안 됩니다. 근거를 모르면 null. (4) 낙찰을 보장하는 표현을 쓰지 마세요.',
    '반드시 아래 JSON 스키마 하나만, 설명·코드펜스 없이 출력하세요: ' + SCHEMA
  ].join('\n');

  function clip(text, max) { const s = String(text || ''); return s.length > max ? {text: s.slice(0, max), clipped: true, total: s.length} : {text: s, clipped: false, total: s.length}; }
  /* 프롬프트 구성: 공고문 원문 + 공고 정보 + 기관·상황 진단 + (선택) 원가·대외 안내·엔진 계산 결과 */
  function buildPrompt(o) {
    const n = o.notice || {}, docs = o.docs || [], an = o.strat, prof = an && an.profile; const parts = [];
    parts.push('[공고 정보(사용자 입력)]\n' + ['공고번호', 'title:공고명', 'org:수요기관', 'due:입찰마감', 'base:기초금액(원)', 'basis:기초금액 기준', 'floor:낙찰하한율(%)', 'range:예가범위(%)', 'award:낙찰방식', 'tax:부가세구분(free=면세)', 'pub:발행사'].map(k => { const [kk, lab] = k.includes(':') ? k.split(':') : ['no', k]; return lab + ': ' + (n[kk] === undefined || n[kk] === '' ? '(입력 없음)' : n[kk]); }).join('\n'));
    if (prof) parts.push('[상황 진단(도구 계산)]\n기관 유형: ' + prof.orgName + '\n낙찰방식: ' + prof.awardName + '\n영업 조건: ' + prof.salesName + (prof.urgent ? ' · 긴급' : '') + (prof.rebid ? ' · 재공고' : '') + '\n과세/계약: ' + (prof.tax === 'free' ? '면세' : '과세') + ' · ' + prof.contractName);
    if (o.includeCost && an && an.ok) {
      const lines = ['실제 원가(내부): ' + (an.cost == null ? '(미입력)' : an.cost + '원'), '대외 안내 비율: ' + (an.guide == null ? '(없음)' : an.guide + '% (기초금액 대비)'), '적자 방어선: ' + (an.breakEven ? an.breakEven.bid + '원 (기초금액의 ' + an.breakEven.rate + '%)' : '(원가 미입력)'), '기초금액 상한: ' + an.ref + '원'];
      if (an.zone) lines.push('도구가 공고 규칙으로 계산한 가능 구간: ' + an.zone.lo + '~' + an.zone.hi + '원 (' + an.zone.loRate + '%~' + an.zone.hiRate + '%) — 출처: ' + an.zone.src.label); else lines.push('낙찰 가능 구간: 산출 불가(' + an.winStatus + ') — 근거 데이터 부족');
      parts.push('[원가·대외 안내·도구 계산(내부 정보)]\n' + lines.join('\n'));
    } else parts.push('[원가·대외 안내] 사용자가 AI 로 보내지 않기로 함');
    const text = docs.map(d => '--- ' + d.name + ' ---\n' + d.text).join('\n\n'); const c = clip(text, MAX_NOTICE_CHARS);
    parts.push('[공고문 원문' + (docs.length ? '' : ' — 올린 문서 없음') + (c.clipped ? ' — 앞 ' + MAX_NOTICE_CHARS + '자만 전송(전체 ' + c.total + '자)' : '') + ']\n' + (c.text || '(없음)'));
    parts.push('위 자료만으로 JSON 스키마에 맞춰 분석하세요. 시나리오는 2~4개, 각 시나리오에 근거(rationale)와 가정(assumptions)을 쓰세요.');
    return {system: SYSTEM, user: parts.join('\n\n'), clipped: c.clipped, totalChars: c.total};
  }
  function buildRequest(cfg, prompt) {
    const P = PROVIDERS[cfg.provider]; if (!P) throw new Error('지원하지 않는 제공사'); const model = (cfg.model || P.defaultModel).trim();
    if (cfg.provider === 'claude') return {url: P.endpoint, init: {method: 'POST', headers: {'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'}, body: JSON.stringify({model, max_tokens: 4096, system: prompt.system, messages: [{role: 'user', content: prompt.user}]})}};
    return {url: P.endpoint(model), init: {method: 'POST', headers: {'content-type': 'application/json', 'x-goog-api-key': cfg.key}, body: JSON.stringify({systemInstruction: {parts: [{text: prompt.system}]}, contents: [{role: 'user', parts: [{text: prompt.user}]}], generationConfig: {responseMimeType: 'application/json', maxOutputTokens: 4096}})}};
  }
  const HTTPMSG = {400: '요청이 거부됨(모델명·요청 형식 확인)', 401: 'API 키가 올바르지 않음', 403: '권한 없음(키·결제·허용 도메인 확인)', 404: '모델 또는 주소를 찾지 못함(모델명 확인)', 429: '요청 한도 초과 — 잠시 후 다시'};
  async function run(cfg, prompt, fetchImpl) {
    const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(g) : null); if (!f) return {ok: false, error: '이 환경에서는 네트워크 호출을 쓸 수 없음'};
    if (!cfg || !cfg.key) return {ok: false, error: 'API 키가 없습니다 — 설정에서 입력하세요'};
    const req = buildRequest(cfg, prompt); let res;
    try { res = await f(req.url, req.init); } catch (e) { return {ok: false, error: '네트워크 오류(오프라인이거나 제공사에 연결할 수 없음): ' + String((e && e.message) || e).slice(0, 100)}; }
    if (!res.ok) { let body = ''; try { body = (await res.text()).slice(0, 200); } catch (e) { /* ignore */ } body = body.split(cfg.key).join('****'); return {ok: false, error: 'HTTP ' + res.status + ' — ' + (HTTPMSG[res.status] || '제공사 오류') + (body ? ' · ' + body : ''), status: res.status}; }
    let j; try { j = await res.json(); } catch (e) { return {ok: false, error: '응답을 읽을 수 없음'}; }
    const text = cfg.provider === 'claude' ? (j && j.content && j.content[0] && j.content[0].text) : (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts.map(p => p.text || '').join(''));
    if (!text) return {ok: false, error: '응답에 분석 내용이 없음', raw: JSON.stringify(j).slice(0, 400)};
    return {ok: true, text, model: (j && j.model) || cfg.model || PROVIDERS[cfg.provider].defaultModel, usage: j && (j.usage || j.usageMetadata) || null};
  }
  function parse(text) {
    let s = String(text || '').trim(); s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''); const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) return {ok: false, error: 'JSON 을 찾지 못함', raw: String(text).slice(0, 600)};
    let o; try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { return {ok: false, error: 'JSON 형식 오류', raw: String(text).slice(0, 600)}; }
    const arr = x => (Array.isArray(x) ? x : []), str = x => (x == null ? '' : String(x));
    const risks = x => arr(x).map(r => ({title: str(r && r.title), detail: str(r && r.detail), quote: str(r && r.evidence_quote)})).filter(r => r.title || r.detail);
    const comp = o.competition || {}; const lv = ['낮음', '보통', '높음', '판단불가'].includes(str(comp.level)) ? str(comp.level) : '판단불가';
    return {ok: true, risks: risks(o.hidden_risks), cautions: risks(o.eligibility_cautions), competition: {level: lv, reasons: arr(comp.reasons).map(str).filter(Boolean), basis: str(comp.basis)}, scenarios: arr(o.scenarios).map(s0 => ({name: str(s0 && s0.name), rate: (s0 && typeof s0.bid_rate_percent === 'number' && isFinite(s0.bid_rate_percent) && s0.bid_rate_percent > 0 && s0.bid_rate_percent <= 100) ? s0.bid_rate_percent : null, rationale: str(s0 && s0.rationale), assumptions: arr(s0 && s0.assumptions).map(str).filter(Boolean), risks: arr(s0 && s0.risks).map(str).filter(Boolean)})).filter(s1 => s1.name || s1.rationale), missing: arr(o.missing_info).map(str).filter(Boolean)};
  }
  /* AI 가 인용한 문구가 실제 공고문 원문에 있는지 대조(공백·개행 무시) */
  const squash = s => String(s || '').replace(/\s+/g, '').replace(/[“”"'‘’]/g, '');
  function quoteStatus(quote, noticeText) { const q = squash(quote); if (!q) return 'none'; return squash(noticeText).includes(q) ? 'found' : 'missing'; }
  const api = {PROVIDERS, MAX_NOTICE_CHARS, buildPrompt, buildRequest, run, parse, quoteStatus};
  E.ai = api; g.BIDENG = E; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
