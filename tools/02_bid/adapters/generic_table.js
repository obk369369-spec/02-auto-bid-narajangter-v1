/* 범용 표 어댑터 — 기관 사이트·나라장터·비드큐 목록을 복사/내려받은 표(행 배열)를 표준 공고로 바꾼다. 로그인 우회 없이 사용자가 직접 받은 자료를 읽으므로 모든 기관에 즉시 사용 가능. */
(function (g) {
  'use strict';
  const C = g.WICAdapters && g.WICAdapters.common || require('./common.js');
  const AL = {no: ['공고번호', '입찰공고번호', '공고 번호', 'bidNtceNo', '관리번호'], title: ['공고명', '입찰공고명', '건명', '사업명', '공고 제목', '제목'], agency: ['공고기관', '발주기관', '발주처', '기관명', '기관'], demandAgency: ['수요기관', '수요 기관', '실수요기관'], base: ['기초금액', '기초 금액', '추정예산', '배정예산', '사업금액', '예산금액'], est: ['추정가격'], due: ['마감일', '투찰마감일', '입찰마감일시', '입찰마감', '마감일시'], open: ['개찰일시', '개찰일'], posted: ['입력일', '공고일', '게시일'], award: ['낙찰방법', '낙찰자결정방법', '낙찰하한율']};
  const nz = v => String(v == null ? '' : v).replace(/\s+/g, '').toLowerCase();
  function mapHeader(row) { const m = {}; const h = row.map(nz); for (const [k, names] of Object.entries(AL)) m[k] = h.findIndex(x => names.map(nz).includes(x)); return m; }
  function findHeader(rows, limit) { for (let i = 0; i < Math.min(rows.length, limit || 20); i++) { const m = mapHeader(rows[i] || []); if (m.no >= 0 && m.title >= 0 || (m.title >= 0 && (m.agency >= 0 || m.demandAgency >= 0))) return {index: i, map: m}; } return null; }
  /* rows: 2차원 배열 → collect 결과 (헤더 행을 앞 20행에서 찾음, 공고번호(또는 기관+제목+마감) 중복 제거) */
  function fromRows(rows, source) {
    const hd = findHeader(rows); if (!hd) return C.result('HOLD_HEADER_NOT_FOUND', [], '앞 20행에서 공고번호·공고명(+기관) 머리글을 찾지 못했습니다');
    const get = (r, c) => (c >= 0 ? C.s(r[c]) : ''); const seen = new Set(), out = [];
    for (const r of rows.slice(hd.index + 1)) { if (!r || !r.some(x => C.s(x))) continue; const n = C.blank(); n.source = source || 'table'; n.no = get(r, hd.map.no); n.title = get(r, hd.map.title); n.agency = get(r, hd.map.agency); n.demandAgency = get(r, hd.map.demandAgency); n.baseAmount = C.digits(get(r, hd.map.base)); n.estAmount = C.digits(get(r, hd.map.est)); n.dueAt = get(r, hd.map.due); n.openAt = get(r, hd.map.open); n.postedAt = get(r, hd.map.posted); n.award = C.awardOf(get(r, hd.map.award));
      if (!n.title && !n.no) continue; const key = n.no ? n.no.toLowerCase() : [n.agency, n.title, n.dueAt].join('|').toLowerCase(); if (seen.has(key)) continue; seen.add(key); out.push(n); }
    return C.result('PASS', out, `헤더 ${hd.index + 1}행 · 중복 제거 ${out.length}건`);
  }
  /* 붙여넣은 탭/쉼표 글자 */
  function fromText(text, source) { const lines = String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim()); if (!lines.length) return C.result('HOLD_EMPTY', [], '내용이 없습니다'); const sep = lines[0].includes('\t') ? '\t' : ','; return fromRows(lines.map(l => l.split(sep)), source || 'paste'); }
  const api = {id: 'generic_table', name: '범용 표(붙여넣기/XLSX/CSV)', kind: 'table', status: 'IMPLEMENTED_VERIFIED', AL, mapHeader, findHeader, fromRows, fromText, collect: async o => (o && o.rows ? fromRows(o.rows, o.source) : o && o.text ? fromText(o.text, o.source) : C.result('HOLD_NO_INPUT', [], 'rows 또는 text 가 필요합니다'))};
  g.WICAdapters = g.WICAdapters || {}; g.WICAdapters.generic = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
