/* 운영 모듈 — 공고 4분류 · 변경 감지 · 기관 이력 · 제출서류 6단계 분류 · 서류 자동 검사 · 공고별 체크리스트 생성 (브라우저/Node 공용) */
(function (g) {
  'use strict';
  const E = g.BIDENG || require('./engine.js'); const str = v => (v == null ? '' : String(v));
  const norm = s => str(s).toLowerCase().replace(/[\s ]+/g, '');

  /* ───────── 1) 공고 4분류: 입찰 / 내부안내 / 제외(X) / 확인필요 ─────────
     근거 약함·상충은 '확인필요'(억지로 입찰로 올리지 않음). cfg.types(WIC 9대 유형 정의)는 사용자가 정의를 넣기 전까지 비어 있음(HOLD). */
  const DEF_KW = {
    bid: ['시장보고서', '해외시장', '글로벌시장', '국외도서', '영문도서', '해외도서', '전자저널', '학술', '데이터베이스', 'DB', '전자자료', '시장조사', '기술동향', '산업분석', 'market', 'industry report'],
    int: ['자료구매', '자료 구매', '기술자료', '해외자료', '국외자료', '전문자료', '학술자료', '조사자료', '연구자료', '보고서', '구독', '라이선스', '온라인 자료', '콘텐츠 이용권'],
    ex: ['용역', '구축', '개발', '시스템', '운영', '연구', '조사', '제작', '발간', '원고', '프로그램', '경진대회', '공사', '인쇄']
  };
  const hit = (t, k, ts) => { const n = norm(k); if (!n) return false; if (/^[a-z0-9]+$/.test(n)) return new RegExp('(^|[^a-z0-9])' + n + '($|[^a-z0-9])').test(ts || t); return t.includes(n); };
  function classify(name, kw, cfg) {
    const K = kw || DEF_KW, t = norm(name), ts = str(name).toLowerCase().replace(/s+/g, ' '); const has = list => (list || []).filter(k => hit(t, k, ts)); const ex = has(K.ex), bid = has(K.bid), it = has(K.int);
    const flags = noticeFlags(name);
    if (flags.includes('취소')) return {cls: '제외(X)', note: '취소 공고', flags};
    if (cfg && cfg.types && cfg.types.length) { /* WIC 9대 유형 + 발행사 공급권한 대조 (정의 입력 후 활성화) */
      for (const ty of cfg.types) { const k = has(ty.keywords || []); if (k.length) { const pubs = (cfg.publisher_authority || []).filter(p => t.includes(norm(p))); return pubs.length || !ty.requiresPublisher ? {cls: '입찰', note: `WIC 유형 ${ty.name}: ${k.slice(0, 2).join(', ')}${pubs.length ? ' · 공급권한 ' + pubs[0] : ''}`, flags} : {cls: '확인필요', note: `WIC 유형 ${ty.name} 이나 발행사 공급권한 확인 필요`, flags}; } }
    }
    if (ex.length && bid.length) return {cls: '확인필요', note: `제외어(${ex[0]}) + 입찰어(${bid[0]}) 상충 → 사람 확인`, flags};
    if (ex.length && it.length) return {cls: '확인필요', note: `제외어(${ex[0]}) + 안내어(${it[0]}) 상충 → 사람 확인`, flags};
    if (ex.length) return {cls: '제외(X)', note: `제외어: ${ex.slice(0, 3).join(', ')}`, flags};
    if (bid.length) return {cls: '입찰', note: `입찰어: ${bid.slice(0, 3).join(', ')}`, flags};
    if (it.length) return {cls: '내부안내', note: `안내어: ${it.slice(0, 3).join(', ')}`, flags};
    return {cls: '확인필요', note: '키워드 없음 → 근거 약함(입찰로 올리지 않음)', flags};
  }

  /* ───────── 2) 신규·정정·취소·재공고 감지 ───────── */
  function noticeFlags(text) {
    const t = E.normText(text).replace(/\s+/g, ' '); const f = [];
    if (/정정\s*공고|변경\s*공고|\(\s*정정\s*\)|\[\s*정정\s*\]|재\s*정정/.test(t)) f.push('정정');
    if (/취소\s*공고|\(\s*취소\s*\)|\[\s*취소\s*\]|공고\s*취소|입찰\s*취소\s*공고/.test(t)) f.push('취소');
    if (/재\s*공고(?!\s*를\s*하지)/.test(t)) f.push('재공고');
    if (/연기\s*공고|개찰\s*연기|마감\s*연기|\(\s*연기\s*\)/.test(t)) f.push('연기');
    return f;
  }
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
  const TRACK = ['title', 'org', 'base', 'due', 'open', 'floor', 'range', 'award', 'status'];
  function fingerprint(n) { return fnv(TRACK.map(k => norm(n[k])).join('|')); }
  /* prev: 이전 기록({fp, fields}) 또는 null → {state: NEW|SAME|CHANGED, changes:[…], flags:[…]} */
  function diffNotice(prev, cur, text) {
    const flags = noticeFlags((text || '') + ' ' + str(cur.title)); const fp = fingerprint(cur);
    if (!prev) return {state: 'NEW', changes: [], flags, fp};
    if (prev.fp === fp) return {state: 'SAME', changes: [], flags, fp};
    const changes = []; TRACK.forEach(k => { if (norm(prev.fields && prev.fields[k]) !== norm(cur[k])) changes.push({field: k, from: str(prev.fields && prev.fields[k]), to: str(cur[k])}); });
    return {state: 'CHANGED', changes, flags, fp};
  }

  /* ───────── 3) 기관 이력 누적: 기관 → {count, latest, cls별 건수, 공고번호 목록, 참여·결과·제출경로·예외(사용자 입력 칸)} ───────── */
  function accumulateHistory(hist, notice) {
    const h = hist || {}; const org = str(notice.org).trim() || '(기관 없음)'; const e = h[org] = h[org] || {count: 0, latest: '', latestNo: '', cls: {}, notices: [], participation: '', result: '', route: '', exceptions: ''};
    if (notice.no && e.notices.includes(notice.no)) { /* 같은 공고번호는 건수 중복 증가 금지 — 최신 정보만 갱신 */ e.latest = notice.title || e.latest; return h; }
    e.count++; e.latest = notice.title || e.latest; e.latestNo = notice.no || e.latestNo; if (notice.cls) e.cls[notice.cls] = (e.cls[notice.cls] || 0) + 1; if (notice.no) e.notices.push(notice.no); return h;
  }

  /* ───────── 4) 제출서류: 6단계 분류 ───────── */
  const STAGES = ['자동 수집', '자동 작성', '자동 검사', '사용자 인증 필요', '법적 확인 필요', '수동 처리'];
  const CLS = {reg: '자동 검사', biz: '자동 검사', cert: '사용자 인증 필요', seal: '수동 처리', small: '자동 검사', emp: '수동 처리', apply: '자동 작성', bidform: '자동 작성', bond: '자동 작성', fair: '법적 확인 필요', sub: '법적 확인 필요', integ: '법적 확인 필요', cost: '자동 작성', ct1: '사용자 인증 필요', sec: '법적 확인 필요', cbond: '자동 작성', ct2: '자동 작성', ins: '수동 처리', pay: '사용자 인증 필요',
    corpreg: '수동 처리', tax: '사용자 인증 필요', insure: '법적 확인 필요', record: '수동 처리', direct: '자동 검사', credit: '수동 처리', spec: '수동 처리', proxy: '수동 처리'};
  /* 공고 유형과 무관하게 점검하는 추가 서류 (예: 024호) */
  const EXTRA = {
    price_proof: {t: '발행사 가격 증빙 (발행사 판매 페이지·견적서 — 정가·통화·날짜 확인)', cls: '자동 검사', check: ['amount'], src: '024호 요구 · 입력한 정가와 증빙 금액 일치 검사'},
    social_ins: {t: '사회보험 완납증명서 (국민연금·건강보험 등) — 입찰마감일 기준 유효기간', cls: '자동 검사', check: ['validity'], needsAuth: true, src: '024호 요구 · 발급은 사용자 인증 필요 · 유효기간 자동 검사'},
    delivery: {t: '납기 (공고의 납품기한) 확인', cls: '자동 수집', check: [], src: '공고문에서 자동 추출'},
    final_submit: {t: '최종 제출 (해당 기관 시스템에서 인증 후 직접 제출 · 접수증 보관)', cls: '사용자 인증 필요', check: [], needsAuth: true, src: '제출은 되돌릴 수 없으므로 사용자가 직접'}
  };
  function classifyDoc(id) { return CLS[id] || (EXTRA[id] && EXTRA[id].cls) || '수동 처리'; }
  /* 공고별 체크리스트: 기본 목록 + 공고에서 발견된 서류 + 낙찰방식별 추가 항목 */
  function buildChecklist(ctx) {
    const base = E.CHECKLIST.map(c => ({id: c.id, stage: c.stage, t: c.t, src: c.src, gen: c.gen, cls: classifyDoc(c.id), hit: (ctx.docHits || {})[c.id] || null, check: ['reg', 'small', 'direct'].includes(c.id) ? ['validity'] : c.id === 'bond' ? ['amount'] : c.id === 'bidform' || c.id === 'apply' ? ['noticeNo', 'amount'] : []}));
    Object.keys(ctx.docHits || {}).forEach(k => { if (E.EXTRA_DOCS[k] && !base.some(b => b.id === k)) base.push({id: k, stage: '1 참가·투찰', t: E.EXTRA_DOCS[k], src: '올린 공고문에서 발견', gen: false, cls: classifyDoc(k), hit: ctx.docHits[k], check: k === 'direct' ? ['validity'] : []}); });
    const add = (id, stage) => { if (!base.some(b => b.id === id)) { const x = EXTRA[id]; base.push({id, stage, t: x.t, src: x.src, gen: false, cls: x.cls, needsAuth: !!x.needsAuth, hit: null, check: x.check}); } };
    if (ctx.award === 'lowest') { add('price_proof', '1 참가·투찰'); add('social_ins', '1 참가·투찰'); }
    add('delivery', '1 참가·투찰'); add('final_submit', '1 참가·투찰');
    base.forEach(b => { if (!b.needsAuth && EXTRA[b.id]) b.needsAuth = !!EXTRA[b.id].needsAuth; });
    return base;
  }

  /* ───────── 5) 서류 자동 검사: 유효기간 · 금액 · 공고번호 일치 ───────── */
  function toDate(s) { const m = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(str(s)); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  const fmt = d => d.toISOString().slice(0, 10);
  /* ctx: {notice:{no, due, total, listPrice}, docs:{id:{validUntil, amount, noticeNo}}, items:[…checklist item]} → [{id, check, status: OK|FAIL|WARN|HOLD, msg}] */
  function inspect(ctx) {
    const out = []; const due = toDate(ctx.notice && ctx.notice.due); const docs = ctx.docs || {};
    (ctx.items || []).forEach(it => {
      (it.check || []).forEach(ck => {
        const d = docs[it.id] || {}; const push = (status, msg) => out.push({id: it.id, title: it.t.split(/ —|\(/)[0], check: ck, status, msg});
        if (ck === 'validity') {
          const v = toDate(d.validUntil); if (!d.validUntil) return push('HOLD', '유효기간(만료일) 입력 필요'); if (!v) return push('FAIL', `유효기간 형식을 읽을 수 없음: ${d.validUntil}`);
          if (!due) return push('HOLD', '입찰마감일을 읽지 못해 유효기간 비교 불가'); if (v < due) return push('FAIL', `유효기간 ${fmt(v)} 이 입찰마감일 ${fmt(due)} 보다 먼저 끝남 → 재발급 필요`);
          const days = Math.round((v - due) / 86400000); return push(days < 14 ? 'WARN' : 'OK', `유효기간 ${fmt(v)} (마감일 후 ${days}일 남음)${days < 14 ? ' — 계약·납품 단계에서 만료될 수 있어 갱신 일정 확인' : ''}`);
        }
        if (ck === 'amount') {
          const want = it.id === 'price_proof' ? ctx.notice && ctx.notice.listPrice : ctx.notice && ctx.notice.total; const a = E.num(d.amount);
          if (d.amount == null || d.amount === '') return push('HOLD', '서류의 금액 입력 필요'); if (a.s !== 'ok') return push('FAIL', `금액 형식 오류: ${d.amount}`); if (want == null || want === '') return push('HOLD', '비교할 기준 금액(투찰금액/정가) 미입력');
          const w = E.num(want).n; return a.n === w ? push('OK', `금액 일치 ${E.won(a.n)}`) : push('FAIL', `금액 불일치: 서류 ${E.won(a.n)} ≠ 기준 ${E.won(w)} (차이 ${E.won(a.n - w)})`);
        }
        if (ck === 'noticeNo') {
          if (!d.noticeNo) return push('HOLD', '서류의 공고번호 입력 필요'); const want = ctx.notice && ctx.notice.no; if (!want) return push('HOLD', '공고번호 미입력');
          return norm(d.noticeNo).replace(/제|호/g, '') === norm(want).replace(/제|호/g, '') ? push('OK', `공고번호 일치 ${want}`) : push('FAIL', `공고번호 불일치: 서류 ${d.noticeNo} ≠ 공고 ${want}`);
        }
      });
    });
    return out;
  }

  const api = {DEF_KW, classify, noticeFlags, fingerprint, diffNotice, accumulateHistory, STAGES, CLS, EXTRA, classifyDoc, buildChecklist, inspect, toDate};
  E.ops = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
