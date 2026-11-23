/* 나라장터(G2B) 공식 OpenAPI 어댑터 — 공공데이터포털 「조달청_나라장터 입찰공고정보서비스」
   상태: 요청 URL 생성·응답 정규화는 구현·시험(합성 응답). **실호출은 서비스키(공공데이터포털 발급)가 있어야 하며 이 PC 에 키가 없어 HOLD_NO_SERVICE_KEY**.
   엔드포인트·필드명은 서비스 명세 기준이며 실제 응답으로는 아직 검증하지 못했다(미실측). 서비스키는 코드·저장소에 넣지 않고 환경변수 G2B_SERVICE_KEY 또는 호출 인자로만 받는다. */
(function (g) {
  'use strict';
  const C = g.WICAdapters && g.WICAdapters.common || require('./common.js');
  const BASE = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
  const OPS = {thng: 'getBidPblancListInfoThng', servc: 'getBidPblancListInfoServc', cnstwk: 'getBidPblancListInfoCnstwk', frgcpt: 'getBidPblancListInfoFrgcpt'}; /* 물품·용역·공사·외자 */
  const ymdhm = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`; };
  /* opts: {serviceKey, op: thng|servc|cnstwk|frgcpt, from: Date, to: Date, rows, page, title, agency} */
  function buildUrl(opts) {
    const o = opts || {}; if (!o.serviceKey) return null; const to = o.to || new Date(), from = o.from || new Date(to.getTime() - 24 * 3600 * 1000);
    const q = {serviceKey: o.serviceKey, pageNo: o.page || 1, numOfRows: o.rows || 100, inqryDiv: 1, inqryBgnDt: ymdhm(from), inqryEndDt: ymdhm(to), type: 'json'}; if (o.title) q.bidNtceNm = o.title; if (o.agency) q.ntceInsttNm = o.agency;
    return BASE + '/' + (OPS[o.op || 'thng'] || OPS.thng) + '?' + Object.entries(q).map(([k, v]) => k + '=' + (k === 'serviceKey' ? v : encodeURIComponent(v))).join('&'); /* 서비스키는 포털이 주는 인코딩 값을 그대로 사용 */
  }
  /* 응답 한 건 → 표준 공고. 필드명이 달라도 후보 키를 차례로 본다(없으면 '') */
  function normalizeItem(it) {
    const n = C.blank(); n.source = 'G2B-OpenAPI'; n.no = C.s(C.pick(it, ['bidNtceNo'])); n.ord = C.s(C.pick(it, ['bidNtceOrd'])); n.title = C.s(C.pick(it, ['bidNtceNm', 'ntceNm'])); n.agency = C.s(C.pick(it, ['ntceInsttNm'])); n.demandAgency = C.s(C.pick(it, ['dminsttNm'])); n.estAmount = C.digits(C.pick(it, ['presmptPrce'])); n.budget = C.digits(C.pick(it, ['asignBdgtAmt']));
    n.baseAmount = n.budget; n.postedAt = C.s(C.pick(it, ['bidNtceDt', 'rgstDt'])); n.dueAt = C.s(C.pick(it, ['bidClseDt'])); n.openAt = C.s(C.pick(it, ['opengDt'])); n.method = C.s(C.pick(it, ['cntrctCnclsMthdNm'])); n.award = C.awardOf(C.pick(it, ['sucsfbidMthdNm', 'bidwinrDcsnMthdNm'])); n.kind = C.kindOf(C.pick(it, ['ntceKindNm']), n.ord, C.pick(it, ['reNtceYn'])); n.url = C.s(C.pick(it, ['bidNtceDtlUrl', 'bidNtceUrl'])); n.raw = it; return n;
  }
  function parseResponse(json) {
    const body = json && json.response && json.response.body; const hdr = json && json.response && json.response.header; if (hdr && hdr.resultCode && hdr.resultCode !== '00') return C.result('HOLD_API_ERROR', [], `${hdr.resultCode} ${hdr.resultMsg || ''}`);
    let items = body && body.items; if (items && items.item) items = items.item; if (!items) return C.result('PASS', [], '결과 0건'); if (!Array.isArray(items)) items = [items];
    return C.result('PASS', items.map(normalizeItem), `총 ${body.totalCount != null ? body.totalCount : items.length}건 중 ${items.length}건`);
  }
  /* 실호출 — 키가 없으면 호출하지 않고 HOLD (오류를 숨기지 않는다) */
  async function collect(opts) {
    const o = Object.assign({serviceKey: (typeof process !== 'undefined' && process.env && process.env.G2B_SERVICE_KEY) || ''}, opts || {}); if (!o.serviceKey) return C.result('HOLD_NO_SERVICE_KEY', [], '공공데이터포털 서비스키가 없습니다 (환경변수 G2B_SERVICE_KEY). 키 없이 지어낸 결과를 만들지 않습니다.');
    const url = buildUrl(o); try { const r = await fetch(url); if (!r.ok) return C.result('HOLD_HTTP_ERROR', [], 'HTTP ' + r.status); return parseResponse(await r.json()); } catch (e) { return C.result('HOLD_NETWORK_ERROR', [], String(e && e.message || e)); }
  }
  const api = {id: 'g2b_openapi', name: '나라장터 OpenAPI', kind: 'api', status: 'IMPLEMENTED_REAL_CALL_HOLD_NO_SERVICE_KEY', BASE, OPS, buildUrl, normalizeItem, parseResponse, collect};
  g.WICAdapters = g.WICAdapters || {}; g.WICAdapters.g2b = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
