/* 수집 어댑터 공통 — 공고 표준 스키마와 정규화 (브라우저/Node 공용)
   원칙: 공식 경로(나라장터 OpenAPI)를 1순위, 기관 공개 사이트는 보조. 로그인·인증서·CAPTCHA 우회 금지, 최종 제출은 사람이. 값이 없으면 ''(추측 금지). */
(function (g) {
  'use strict';
  /* 표준 공고(Notice) 스키마 */
  const NOTICE_FIELDS = ['source', 'no', 'ord', 'title', 'agency', 'demandAgency', 'baseAmount', 'estAmount', 'budget', 'postedAt', 'dueAt', 'openAt', 'method', 'award', 'kind', 'url', 'raw'];
  const blank = () => NOTICE_FIELDS.reduce((o, k) => (o[k] = '', o), {});
  const s = v => (v == null ? '' : String(v).trim());
  const digits = v => s(v).replace(/[^\d.-]/g, '');
  const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null && s(o[k]) !== '') return o[k]; return ''; };
  /* 낙찰방식 문구 → floor|lowest|eval|nego|'' (pricing.detectAward 와 같은 판정) */
  function awardOf(text) { const t = s(text); if (/하한/.test(t)) return 'floor'; if (/협상/.test(t)) return 'nego'; if (/적격/.test(t)) return 'eval'; if (/최저/.test(t)) return 'lowest'; return ''; }
  /* 차수/종류로 정정·재공고·취소 표시 */
  function kindOf(ntceKind, ord, reYn) { const k = s(ntceKind); if (/취소/.test(k)) return '취소'; if (/재\s*공고/.test(k) || s(reYn).toUpperCase() === 'Y') return '재공고'; if (/정정|변경/.test(k) || (s(ord) && Number(ord) > 0)) return '정정'; return k || '일반'; }
  const result = (status, notices, reason) => ({status, notices: notices || [], reason: reason || ''});
  const api = {NOTICE_FIELDS, blank, s, digits, pick, awardOf, kindOf, result};
  g.WICAdapters = g.WICAdapters || {}; g.WICAdapters.common = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
