/* 실시간 환율 조회 (v3.3) — API 키 없이 쓰는 공개 피드 2종 + (선택) 수출입은행 고시환율 API 키
   [안전] ① 요청에는 통화 코드만 실린다(공고·원가·고객 정보 없음) ② 실패·오프라인이면 아무것도 바꾸지 않고 수동 입력을 유지 ③ 불러온 값에는 출처·기준 시각을 항상 붙인다
   [주의] 아래 피드는 "시장 환율(중간값)"이다. 하나은행 등 은행 고시환율(전신환 매도율 등)이 아니며, 실제 결제 환율은 거래 은행 기준으로 확인해야 한다.
   미검증(HOLD): 수출입은행 API 는 이 PC 에서 실제 키로 호출해 보지 못했다(응답 규격은 공식 문서 기준 구현). 하나은행·관세청은 공개 API 규격을 확인하지 못해 연결하지 않았다. */
(function (g) {
  'use strict';
  const E = g.BIDENG || {}; const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  const DISCLAIMER = '시장 환율(중간값)입니다. 은행 고시환율·실제 결제환율과 다를 수 있으니 거래 은행 기준으로 확인하세요.';
  const PROVIDERS = {
    er: {
      id: 'er', name: 'open.er-api.com', kind: '시장 환율(중간값) · 키 없음',
      url: cur => 'https://open.er-api.com/v6/latest/' + encodeURIComponent(cur),
      parse: j => { if (!j || j.result !== 'success' || !j.rates || typeof j.rates.KRW !== 'number') throw new Error('응답 형식이 다름'); const asOf = j.time_last_update_unix ? new Date(j.time_last_update_unix * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : (j.time_last_update_utc || ''); return {rate: j.rates.KRW, asOf}; }
    },
    frank: {
      id: 'frank', name: 'frankfurter.app (ECB 기준)', kind: '유럽중앙은행 참조환율 · 키 없음',
      url: cur => 'https://api.frankfurter.app/latest?from=' + encodeURIComponent(cur) + '&to=KRW',
      parse: j => { if (!j || !j.rates || typeof j.rates.KRW !== 'number') throw new Error('응답 형식이 다름'); return {rate: j.rates.KRW, asOf: (j.date || '') + ' (ECB 기준일)'}; }
    },
    koreaexim: {
      id: 'koreaexim', name: '한국수출입은행 고시환율', kind: '매매기준율 · 인증키 필요',
      needsKey: true,
      url: (cur, key, date) => 'https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=' + encodeURIComponent(key) + '&searchdate=' + date + '&data=AP01',
      parse: (j, cur) => { if (!Array.isArray(j)) throw new Error('응답 형식이 다름'); if (!j.length) throw new Error('고시 데이터 없음(휴일·영업시간 전일 수 있음)'); const row = j.find(r => r && (r.cur_unit === cur || r.cur_unit === cur + '(100)')); if (!row) throw new Error(cur + ' 고시 없음'); const v = parseFloat(String(row.deal_bas_r).replace(/,/g, '')); if (!(v > 0)) throw new Error('매매기준율 값 오류'); return {rate: row.cur_unit.endsWith('(100)') ? v / 100 : v, asOf: '고시 매매기준율 ' + (row.__date || '')}; }
    }
  };
  function withTimeout(fetchImpl, url, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const timer = setTimeout(() => { if (ctl) ctl.abort(); }, ms);
    const p = fetchImpl(url, ctl ? {signal: ctl.signal, cache: 'no-store'} : {cache: 'no-store'}); return Promise.resolve(p).then(r => { clearTimeout(timer); return r; }, e => { clearTimeout(timer); throw e; });
  }
  /* 환율 조회: 순서 = (수출입은행 키가 있으면 먼저) → open.er-api.com → frankfurter.app. 하나라도 성공하면 끝. */
  async function fetchRate(cur, cfg, fetchImpl, now) {
    cfg = cfg || {}; const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(g) : null); const errors = []; const t0 = now || new Date();
    if (!/^[A-Z]{3}$/.test(cur || '')) return {ok: false, errors: [{provider: '-', msg: '통화 코드가 올바르지 않음'}]};
    if (cur === 'KRW') return {ok: false, noNeed: true, errors: [{provider: '-', msg: '원화(KRW)는 환율이 필요 없습니다'}]};
    if (!f) return {ok: false, errors: [{provider: '-', msg: '이 환경에서는 네트워크 조회를 쓸 수 없음'}]};
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return {ok: false, offline: true, errors: [{provider: '-', msg: '오프라인 상태입니다'}]};
    const order = []; if (cfg.koreaeximKey) order.push('koreaexim'); if (cfg.provider === 'frank') order.push('frank', 'er'); else order.push('er', 'frank');
    for (const id of order) {
      const P = PROVIDERS[id];
      try {
        let url, shown; if (P.needsKey) { /* 휴일이면 최대 5일 전까지 거슬러 조회 */ let found = null, lastErr = null; for (let back = 0; back < 6 && !found; back++) { const d = new Date(t0.getTime() - back * 86400000); const dt = ymd(d); const u = P.url(cur, cfg.koreaeximKey, dt); try { const r = await withTimeout(f, u, 8000); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); if (Array.isArray(j) && j.length) { j.forEach(r0 => { r0.__date = dt.slice(0, 4) + '-' + dt.slice(4, 6) + '-' + dt.slice(6, 8); }); found = P.parse(j, cur); } else lastErr = new Error('고시 데이터 없음'); } catch (e) { lastErr = e; if (e && e.name === 'AbortError') break; } } if (!found) throw lastErr || new Error('조회 실패'); const out = found; shown = 'https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=****&data=AP01'; return finish(P, cur, out, shown, t0); }
        url = P.url(cur); const r = await withTimeout(f, url, 8000); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); const out = P.parse(j, cur); return finish(P, cur, out, url, t0);
      } catch (e) { errors.push({provider: P.name, msg: e && e.name === 'AbortError' ? '시간 초과(8초)' : String((e && e.message) || e).slice(0, 120)}); }
    }
    return {ok: false, errors};
  }
  function finish(P, cur, out, url, t0) {
    if (!(out.rate > 0) || !isFinite(out.rate)) throw new Error('환율 값이 올바르지 않음');
    const dec = cur === 'JPY' ? 4 : 2; return {ok: true, rate: Number(out.rate.toFixed(dec)), raw: out.rate, cur, source: P.name, kind: P.kind, asOf: out.asOf, fetchedAt: t0.toISOString().replace('T', ' ').slice(0, 19) + ' UTC', url, disclaimer: DISCLAIMER};
  }
  const api = {PROVIDERS, DISCLAIMER, fetchRate};
  E.fx = api; g.BIDENG = E; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
