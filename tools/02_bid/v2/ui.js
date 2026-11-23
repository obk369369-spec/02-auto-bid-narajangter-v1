(() => {
  'use strict';
  const E = window.BIDENG, {str, norm, esc} = WIC; const $ = id => document.getElementById(id);
  const {num, won, pct, floorLimit, mulRate} = E;
  const DEF_KW = {
    bid: ['시장보고서','해외시장','글로벌시장','국외도서','영문도서','해외도서','전자저널','학술','데이터베이스','DB','전자자료','시장조사','기술동향','산업분석'],
    int: ['자료구매','자료 구매','기술자료','해외자료','국외자료','전문자료','학술자료','조사자료','연구자료','보고서','구독','라이선스','온라인 자료','콘텐츠 이용권'],
    ex:  ['용역','구축','개발','시스템','운영','연구','조사','제작','발간','원고','프로그램','경진대회']
  };
  const S = {items: [], dup: 0, kw: JSON.parse(JSON.stringify(DEF_KW)), logs: [], ev: null, lastCalc: null, sel: null, ex: {}, docs: [], docHits: {}, tabsDone: {}, prevHtml: ''}; window.__BID = S;
  const log = m => { S.logs.push(m); $('log').textContent = S.logs.slice(-60).join('\n'); };
  const db = WIC.store('wic02_bid');
  const ls = {get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }};
  let toastT = null; const toast = m => { const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', 3200); };

  /* ───────── 탭 ───────── */
  function showTab(n) { document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'tab' + n)); document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === String(n))); window.scrollTo({top: 0}); if (String(n) === '3') { renderChk(); renderItems(); syncBid(); } }
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });

  /* ───────── 공고 정보 폼 ───────── */
  const NF = ['title', 'no', 'org', 'due', 'open', 'supply', 'vatamt', 'total', 'qty', 'base', 'basis', 'floor', 'range', 'rlo', 'rhi', 'method', 'award', 'pub', 'bond', 'tax', 'vat'];
  const nget = () => { const o = {}; NF.forEach(k => o[k] = $('n_' + k).value); return o; };
  const nsave = () => { ls.set('wic02v2_notice', nget()); };
  function nload() { const s = ls.get('wic02v2_notice', {}); NF.forEach(k => { if (s[k] !== undefined) $('n_' + k).value = s[k]; $('n_' + k).addEventListener('input', () => { const el = $('n_' + k); el.classList.remove('auto'); const t = el.parentElement.querySelector('.autotag'); if (t) t.remove(); nsave(); }); $('n_' + k).addEventListener('change', nsave); }); }
  function setAuto(id, v, why) { const el = $(id); if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === v)) return; el.value = v; el.classList.add('auto'); const lab = el.parentElement; let t = lab.querySelector('.autotag'); if (!t) { t = document.createElement('span'); t.className = 'autotag'; lab.firstChild.after(t); } t.textContent = '자동 입력'; t.title = why || ''; }
  const RANK = {high: 3, mid: 2, low: 1};
  function mergeEx(ex, file, lowConf) { Object.values(ex).forEach(v => { const vv = lowConf ? Object.assign({}, v, {conf: 'low', label: v.label + ' (OCR)'}) : v; const cur = S.ex[vv.key]; if (!cur || RANK[vv.conf] > RANK[cur.conf]) S.ex[vv.key] = Object.assign({}, vv, {file}); }); }
  function applyEx() {
    const ex = S.ex; let k = 0; const A = (id, v, why) => { setAuto(id, v, why); k++; };
    if (ex.title) {}
    if (ex.name) A('n_title', ex.name.value, ex.name.evidence); if (ex.no) A('n_no', ex.no.value, ex.no.evidence); if (ex.org) A('n_org', ex.org.value, ex.org.evidence); if (ex.due) A('n_due', ex.due.value, ex.due.evidence);
    /* 기초금액 기준: 추정가격이 함께 있으면 비율로 판정(기초금액 ≈ 추정가격×1.1 → 부가세 포함 그대로, ≈ 추정가격 → 부가세 제외), 없으면 문구('부가세 포함/별도')로 판정 */
    const vx = ex.vatIncl ? ex.vatIncl.value : '';
    if (ex.base) { A('n_base', ex.base.value, ex.base.evidence); let b = vx === 'excl' ? 'est' : 'asis'; if (ex.est && Number(ex.est.value) > 0) { const r = Number(ex.base.value) / Number(ex.est.value); if (Math.abs(r - 1.1) < 0.006) b = 'asis'; else if (Math.abs(r - 1) < 0.006) b = 'est'; } $('n_basis').value = b; }
    else if (ex.est) { A('n_base', ex.est.value, ex.est.evidence); $('n_basis').value = 'est'; }
    else if (ex.budget) { A('n_base', ex.budget.value, ex.budget.evidence); $('n_basis').value = vx === 'excl' ? 'est' : 'asis'; }
    if (ex.open) A('n_open', ex.open.value, ex.open.evidence); if (ex.supply) A('n_supply', ex.supply.value, ex.supply.evidence); if (ex.vatAmt) A('n_vatamt', ex.vatAmt.value, ex.vatAmt.evidence); if (ex.total) A('n_total', ex.total.value, ex.total.evidence); if (ex.qty) A('n_qty', ex.qty.value, ex.qty.evidence);
    if (ex.floor) A('n_floor', ex.floor.value, ex.floor.evidence); if (ex.range) A('n_range', ex.range.value, ex.range.evidence); if (ex.rangeLo) A('n_rlo', ex.rangeLo.value, ex.rangeLo.evidence); if (ex.rangeHi) A('n_rhi', ex.rangeHi.value, ex.rangeHi.evidence);
    if (ex.list) { setAuto('c_list', ex.list.value, ex.list.evidence); k++; } if (ex.cur) { setAuto('c_cur', ex.cur.value, ex.cur.evidence); k++; } if (ex.fx) { setAuto('c_fx', ex.fx.value, ex.fx.evidence); k++; } if (ex.bond) A('n_bond', ex.bond.value, ex.bond.evidence);
    if (ex.method) A('n_method', ex.method.value, ex.method.evidence); if (ex.pub) A('n_pub', ex.pub.value, ex.pub.evidence); if (S.award && S.award.mode) A('n_award', S.award.mode, S.award.evidence); if (ex.taxmode) A('n_tax', ex.taxmode.value, ex.taxmode.evidence);
    nsave(); return k;
  }
  function applyItems() { const its = (S.docItems || []).slice(0, 200); if (!its.length) return; S.itemsDoc = its.map(i => ({name: i.name, pub: '', qty: String(i.qty), list: i.unit != null ? String(i.unit) : '', cur: 'KRW', fx: ''})); ls.set('wic02v2_items', S.itemsDoc); }
  const FIELD_LABEL = {base: '기초금액', floor: '낙찰하한율', range: '예비가격 변동폭', bond: '입찰보증금율', method: '예정가격 결정방식', name: '공고명', no: '공고번호', org: '수요기관', due: '입찰마감일시', taxmode: '면세/과세'};
  const MUST = ['base', 'floor', 'range', 'bond', 'method', 'name', 'no', 'org', 'due', 'taxmode'];
  const dispVal = v => v.key === 'method' ? (v.value === 'multi' ? '복수예비가격' : '단일 예가') : v.key === 'taxmode' ? (v.value === 'free' ? '면세' : '과세') : (['base', 'est', 'budget', 'supply', 'vatAmt', 'total'].includes(v.key) ? won(Number(v.value)) + ' 원' : (['floor', 'range', 'bond'].includes(v.key) ? v.value + ' %' : v.value));
  function renderEx() {
    const vals = Object.values(S.ex); if (!S.docs.length) { $('exBox').innerHTML = '<div class="empty">아직 올린 문서가 없습니다. 위 상자에 공고문을 끌어다 놓으면 이곳에 추출 결과가 나옵니다.</div>'; return; }
    const miss = MUST.filter(k => !S.ex[k] && !(k === 'base' && (S.ex.est || S.ex.budget)) && !(k === 'bond' && S.ex.bondExempt));
    let h = '<div class="scroll"><table><thead><tr><th>항목</th><th>추출값</th><th>신뢰도</th><th>근거 문장 (공고문 원문)</th><th>파일</th></tr></thead><tbody>' +
      vals.map(v => `<tr><td><b>${esc(v.label)}</b></td><td>${esc(dispVal(v))}</td><td><span class="badge b-${v.conf === 'high' ? 'hi' : v.conf === 'mid' ? 'mid' : 'low'}">${v.conf === 'high' ? '높음' : v.conf === 'mid' ? '보통' : '낮음 · 확인 필요'}</span></td><td class="small">${esc(v.evidence)}</td><td class="small">${esc(v.file || '')}</td></tr>`).join('') + '</tbody></table></div>';
    if (miss.length) h += `<div class="explainbox"><b>찾지 못한 항목 (추측하지 않고 비워 둡니다):</b> ${miss.map(k => esc(FIELD_LABEL[k])).join(' · ')} — 공고문에서 직접 확인해 ① 아래 공고 정보에 입력하세요.</div>`;
    const dh = Object.keys(S.docHits); if (dh.length) h += `<p class="small" style="margin-top:12px">공고문에서 발견된 서류 이름: ${dh.map(k => `<span class="pill">${esc(docName(k))}</span>`).join('')} → ③ 체크리스트에 반영됩니다.</p>`;
    $('exBox').innerHTML = h;
  }
  const docName = k => { const c = E.CHECKLIST.find(x => x.id === k); return c ? c.t.split(/ —|\(|·/)[0].trim() : (E.EXTRA_DOCS[k] || k); };

  /* ───────── 파일 / 붙여넣기 ───────── */
  /* 공고 "목록" 파일: 앞쪽 몇 줄 안에 공고번호·공고명·기초금액 같은 머리글이 2개 이상 있는 표 (제목 줄이 먼저 있어도 인식) */
  const headHits = line => line.split('\t').filter(h => Object.values(AL).some(a => a.some(x => norm(x) === norm(h)))).length;
  const listStart = t => t.split('\n').slice(0, 6).findIndex(l => headHits(l) >= 2);
  const looksLikeList = t => listStart(t) >= 0;
  /* 파일·붙여넣기 공통 처리: 글자 → (목록 / 업무메모 여러 건 / 단일 공고) 분기 */
  function ingest(name, text, isSheet, ocr) {
    if (text.replace(/\s/g, '').length < 5) throw new Error('읽은 글자가 없습니다 (빈 문서이거나 이미지로만 된 문서입니다)');
    S.docs.push({name, text}); const len = text.length.toLocaleString();
    const memo = E.extractMemoBlocks(text);
    if (memo.length >= 2) { addRows(memo.map(m => ({공고번호: m.no, 공고명: m.name, 수요기관: '', 마감일: m.due, 기초금액: m.base}))); return `${len}자 읽음 · 업무 메모 ${memo.length}건을 누적 목록에 추가 (한 건의 공고 정보로는 합치지 않음)${ocr ? " · OCR 글자 인식 — 오인식 가능" : ""}`; }
    if (isSheet && looksLikeList(text)) { const rows = rowsFromText(text.split('\n').slice(listStart(text)).join('\n')); addRows(rows); return `${len}자 읽음 · 공고 목록 ${rows.length}건을 누적 목록에 추가 (한 건의 공고 정보로는 합치지 않음)${ocr ? " · OCR 글자 인식 — 오인식 가능" : ""}`; }
    const ex = E.extractFields(text), n = Object.keys(ex).length; mergeEx(ex, name, ocr); { const aw = E.pricing.detectAward(text), ORD = ['floor', 'nego', 'eval', 'lowest']; if (aw.mode && (!S.award || ORD.indexOf(aw.mode) < ORD.indexOf(S.award.mode))) S.award = {mode: aw.mode, evidence: aw.evidence}; } Object.assign(S.docHits, E.detectDocs(text));
    const its = E.extractItems(text); if (its.length) { S.docItems = (S.docItems || []).concat(its.map(i => Object.assign({file: name}, i))); applyItems(); }
    return `${len}자 읽음${ocr ? ' (OCR 글자 인식 — 오인식 가능, 원본과 대조 필요)' : ''} · ${n}개 항목 추출` + (its.length ? ` · 품목 ${its.length}건` : '');
  }
  S.files = {};
  async function handleFiles(files, forceOcr) {
    for (const f of files) {
      S.files[f.name] = f; const isImg = /\.(jpe?g|png|gif|bmp|tiff?|webp|pdf)$/i.test(f.name);
      const row = document.createElement('div'); row.className = 'file'; row.innerHTML = `<div><b>${esc(f.name)}</b><div class="small">${isImg ? '읽는 중… (스캔본이면 글자 인식(OCR)을 하므로 시간이 걸립니다)' : '읽는 중…'}</div></div>`; $('fileList').prepend(row);
      try {
        const text = await E.fileToText(f, XLSX, {forceOcr: !!forceOcr}); const note = ingest(f.name, text, /\.(xlsx|xls|csv|tsv)$/i.test(f.name), !!f.__ocr);
        const again = isImg && !f.__ocr && window.WICOCR && window.WICOCR.enabled() ? `<button class="sm" data-ocr="${esc(f.name)}" title="기능: 이 파일을 글자 인식(OCR)으로 다시 읽기 · 결과: 스캔본의 글자를 추가로 추출 · 사용시점: 값이 비어 있는데 사진·스캔본일 때">OCR로 다시 읽기</button>` : '';
        row.className = 'file ok'; row.innerHTML = `<div style="flex:1"><b>${esc(f.name)}</b><div class="small">${esc(note)}</div></div>${again}`; log('문서 읽음: ' + f.name + ' · ' + note);
      } catch (e) { row.className = 'file err'; row.innerHTML = `<div><b>${esc(f.name)}</b><div class="small bad">${esc(e.message || String(e))}</div></div>`; log('문서 실패: ' + f.name + ' — ' + (e.message || e)); }
    }
    const k = applyEx(); renderEx(); renderChk(); toast(k ? `공고 정보 ${k}칸을 자동 입력했습니다` : '자동으로 찾은 값이 없습니다 — 직접 입력하세요');
  }
  $('fileList').addEventListener('click', e => { const b = e.target.closest('[data-ocr]'); if (!b) return; const f = S.files[b.dataset.ocr]; if (f) { b.parentElement.remove(); handleFiles([f], true); } });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });
  ['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => { if (!drop.contains(e.target)) e.preventDefault(); }));
  $('docInput').onchange = e => { handleFiles([...e.target.files]); e.target.value = ''; };
  $('docPasteBtn').onclick = () => { const t = $('docPaste').value; if (!t.trim()) { toast('붙여넣은 글이 없습니다'); return; } let note; try { note = ingest('(붙여넣기)', t, false); } catch (e) { toast(e.message); return; } const k = applyEx(); renderEx(); renderChk(); toast(k ? `공고 정보 ${k}칸을 자동 입력했습니다` : '자동으로 찾은 값이 없습니다'); log('붙여넣기: ' + note); };
  $('nClear').onclick = () => { NF.forEach(k => { const el = $('n_' + k); if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = k === 'vat' ? '10' : ''; el.classList.remove('auto'); const t = el.parentElement.querySelector('.autotag'); if (t) t.remove(); }); S.ex = {}; S.docs = []; S.docHits = {}; S.docItems = []; S.award = null; $('fileList').innerHTML = ''; renderEx(); nsave(); renderChk(); toast('공고 정보를 비웠습니다'); };

  /* ───────── 분류 · 누적 (기존 기능 유지) ───────── */
  const classify = name => E.ops.classify(name, S.kw, S.wicCfg);
  const AL = {no: ['공고번호', '입찰공고번호', '공고 번호', 'bidNtceNo', '번호'], name: ['공고명', '입찰공고명', '건명', '사업명', '공고 제목', '제목'], org: ['수요기관', '발주기관', '공고기관', '수요 기관', '기관명', '기관', '발주처'], due: ['마감일', '입찰마감일시', '입찰마감', '마감일시', '개찰일시', '투찰마감일'], base: ['기초금액', '기초 금액', '추정가격', '사업금액', '예산금액', '배정예산']};
  const pickCol = (row, f) => { const ks = Object.keys(row); for (const a of AL[f]) { const k = ks.find(h => norm(h) === norm(a)); if (k !== undefined) return str(row[k]); } return ''; };
  const keyOf = it => it.no ? `${norm(it.org)}|${norm(it.no)}` : `${norm(it.org)}|${norm(it.name)}|${norm(it.due)}`;
  function toItem(row) { const it = {no: pickCol(row, 'no'), name: pickCol(row, 'name'), org: pickCol(row, 'org'), due: pickCol(row, 'due'), base: pickCol(row, 'base')}; it.key = keyOf(it); return it; }
  function rowsFromText(t) {
    const lines = t.replace(/\r/g, '').split('\n').filter(l => l.trim()); if (!lines.length) return [];
    const sep = lines[0].includes('\t') ? '\t' : (lines[0].includes(',') && lines.length > 1 ? ',' : null);
    if (!sep) return lines.map(l => ({공고명: l.trim()}));
    const grid = WIC.csv(t, sep); const head = grid[0] || [];
    const isHead = head.some(h => Object.values(AL).some(a => a.some(x => norm(x) === norm(h))));
    if (isHead) return WIC.parseRows(grid, '붙여넣기').rows;
    return grid.filter(r => r.some(c => str(c))).map(r => ({공고번호: r[0], 공고명: r[1], 수요기관: r[2], 마감일: r[3], 기초금액: r[4]}));
  }
  const split = s => s.split(/[,\n;]+/).map(x => x.trim()).filter(Boolean);
  function cfgShow() { $('k_bid').value = S.kw.bid.join(', '); $('k_int').value = S.kw.int.join(', '); $('k_ex').value = S.kw.ex.join(', '); }
  function cfgLoad() { const s = ls.get('wic02_kw2', null); if (s && s.bid && s.int && s.ex) S.kw = s; cfgShow(); }
  $('saveCfg').onclick = () => { S.kw = {bid: split($('k_bid').value), int: split($('k_int').value), ex: split($('k_ex').value)}; ls.set('wic02_kw2', S.kw); $('cfgMsg').textContent = '저장됨 — 표가 다시 분류되었습니다'; log('분류 키워드 저장·재분류'); render(); };
  $('defCfg').onclick = () => { S.kw = JSON.parse(JSON.stringify(DEF_KW)); cfgShow(); try { localStorage.removeItem('wic02_kw2'); } catch (e) {} $('cfgMsg').textContent = '기본값으로 되돌렸습니다'; log('분류 키워드를 기본값으로 되돌림'); render(); };
  const itemCalc = it => {
    const a = num(it.base); if (a.s === 'empty') return {text: '기초금액 확인 필요'}; if (a.s === 'bad' || a.n <= 0) return {text: '오류', bad: true, note: '기초금액이 숫자가 아니거나 0 이하: ' + it.base};
    const n = nget(); const V = num(n.vat).s === 'ok' ? num(n.vat).n : 10; const F = num(n.floor).s === 'ok' ? num(n.floor).n : null; if (F === null) return {text: '낙찰하한율 확인 필요(① 공고 정보에 입력)'};
    const E0 = $('amtVat').value === 'incl' && n.basis !== 'asis' ? Math.round(a.n / (1 + V / 100)) : a.n; const fl = floorLimit(E0, F); const bid = Math.round(fl * 1.001);
    return {floor: fl, bid, est: E0, note: `기준 ${won(E0)} · 하한율 ${F}% · 장부 패턴(하한가×1.001)`};
  };
  function render() {
    const tb = $('tbl').querySelector('tbody'); const cnt = {'입찰': 0, '내부안내': 0, '제외(X)': 0, '확인필요': 0}; const only = $('onlyBid').checked; let shown = 0;
    tb.innerHTML = S.items.map((it, i) => {
      const c = classify(it.name); cnt[c.cls]++; it.cls = c.cls; let fl = '-', bid = '-', note = c.note, bad = false;
      if (c.cls === '입찰') { const r = itemCalc(it); if (r.bid) { fl = won(r.floor); bid = won(r.bid); note += ' / ' + r.note; it.floor = fl; it.bidv = bid; } else { bid = r.text; bad = !!r.bad; if (r.note) note += ' / ' + r.note; } } else { bid = '계산 안 함'; }
      it.bid = bid; it.note = note; if (only && c.cls !== '입찰') return ''; shown++;
      const cl = {'입찰': 't-bid', '내부안내': 't-int', '제외(X)': 't-ex', '확인필요': 'warn'}[c.cls];
      return `<tr><td>${i + 1}</td><td class="${cl}">${esc(c.cls)}</td><td>${esc(it.no)}</td><td>${esc(it.name)}</td><td>${esc(it.org)}</td><td>${esc(it.due)}</td><td class="n">${esc(it.base)}</td><td class="n">${esc(fl)}</td><td class="n ${bad ? 'bad' : ''}">${esc(bid)}</td><td class="small">${esc(note)}${it.state && it.state !== 'SAME' ? ` <span class="badge b-${it.state === 'NEW' ? 'hi' : 'mid'}">${esc(it.state === 'NEW' ? '신규' : '변경')}</span>` : ''}${(it.flags || []).map(f => ` <span class="badge b-low">${esc(f)}</span>`).join('')}</td><td>${c.cls === '입찰' ? `<button class="sm" data-calc="${i}" title="기능: 이 공고를 계산 화면으로 · 결과: 공고 정보 입력 후 ②로 이동 · 사용시점: 입찰 대상 공고를 계산할 때">계산하기</button>` : ''}</td></tr>`;
    }).join('');
    $('emptyMsg').style.display = shown ? 'none' : ''; $('emptyMsg').textContent = S.items.length ? '표시할 공고가 없습니다 ("입찰만 보기"를 해제해 보세요).' : '아직 공고가 없습니다. 위에서 목록을 붙여넣고 [붙여넣기 반영]을 누르세요.';
    $('info').textContent = `누적 ${S.items.length}건 / 중복 ${S.dup}건`; $('stat').textContent = `입찰 ${cnt['입찰']} · 내부안내 ${cnt['내부안내']} · 제외(X) ${cnt['제외(X)']} · 확인필요 ${cnt['확인필요']}`;
    const orgs = {}; S.items.forEach(it => { const k = it.org || '(기관 없음)'; (orgs[k] = orgs[k] || []).push(it); });
    $('orgTbl').querySelector('tbody').innerHTML = Object.keys(orgs).map(k => { const a = orgs[k]; const c = {}; a.forEach(x => c[x.cls] = (c[x.cls] || 0) + 1); return `<tr><td>${esc(k)}</td><td class="n">${a.length}</td><td>${esc(a[a.length - 1].name)}</td><td class="small">${Object.keys(c).map(x => x + ' ' + c[x]).join(' · ')}</td></tr>`; }).join('');
  }
  $('tbl').addEventListener('click', e => { const b = e.target.closest('[data-calc]'); if (!b) return; const it = S.items[+b.dataset.calc];
    const set = (id, v) => { const el = $(id); el.value = v; el.classList.remove('auto'); }; set('n_title', it.name); set('n_org', it.org); set('n_no', it.no); set('n_due', it.due); set('n_tax', /도서|학술지|저널|전자저널|정기간행물|journal|book/i.test(it.name) ? 'free' : 'tax');
    const a = num(it.base); if (a.s === 'ok') { set('n_base', String(a.n)); set('n_basis', $('amtVat').value === 'incl' ? 'asis' : 'est'); } nsave(); showTab(2); calcDispatch(); });
  $('onlyBid').onchange = render; $('amtVat').onchange = render; ['n_floor', 'n_vat', 'n_basis'].forEach(id => $(id).addEventListener('change', render));
  function renderListStats() {
    const st = E.LIST_STATS, mx = Math.max(...st.floorRate.map(x => x[1]));
    $('listStats').innerHTML = `<p class="small">낙찰하한율 표기 분포 (${st.n}건 중). 하한율은 공고마다 다릅니다 — 한 기관·한 방식의 값(예: 88%)을 다른 공고에 일괄 적용하지 마세요(공고문의 값이 유일한 근거).</p>` +
      st.floorRate.map(([k, c]) => `<div class="row" style="gap:10px;margin:3px 0"><span style="width:90px;font-size:12.5px">${esc(k)}</span><div class="bar" style="flex:1;max-width:420px"><i style="width:${c / mx * 100}%;background:#2563eb"></i></div><span class="small">${c}건</span></div>`).join('') +
      `<p class="small" style="margin-top:10px">기초금액(157건): 하위 25% ${won(st.baseAmt.p25)}원 · 중앙값 ${won(st.baseAmt.med)}원 · 상위 25% ${won(st.baseAmt.p75)}원 · 업종은 출판물이 대부분(${st.industry[0][1]}건).</p>`;
  }

  /* ───────── 계산 입력 ───────── */
  const CF = ['list', 'cur', 'fx', 'costmode', 'disc', 'rates', 'people', 'safe', 'mid', 'min', 'mmin', 'mtgt', 'extra', 'ref', 'weight', 'k', 'other', 'pass', 'tech', 'pw', 'low', 'bids'];
  const cget = () => { const o = {}; CF.forEach(k => o[k] = $('c_' + k).value); return o; };
  function csave() { ls.set('wic02v2_cost', cget()); }
  function cload() { const s = ls.get('wic02v2_cost', {}); CF.forEach(k => { const e = $('c_' + k); if (s[k] !== undefined) e.value = s[k]; e.addEventListener('change', () => { csave(); discLabel(); }); }); discLabel(); }
  function discLabel() { $('c_discLbl').firstChild.textContent = $('c_costmode').value === 'ledger' ? '원가 계수 (장부 \'발행사 디스카운트\' 열 값, 예 0.4)' : '발행사 할인율 (%)'; }
  function buildInp() {
    const n = nget(), c = cget(); const inp = {floor: n.floor, range: n.method === 'single' ? '0' : n.range, rangeLo: n.method === 'single' ? '0' : n.rlo, rangeHi: n.method === 'single' ? '0' : n.rhi, vat: n.vat, bond: n.bond, taxmode: n.tax, list: c.list, cur: c.cur, fx: c.fx, disc: c.disc, costmode: c.costmode, rates: c.rates, safe: c.safe, mid: c.mid, min: c.min};
    if (n.basis === 'asis') { inp.est = n.base; inp.basis = 'asis'; } else if (n.basis === 'incl') inp.budget = n.base; else inp.est = n.base; return inp;
  }

  /* ───────── 그래프 (SVG) ───────── */
  const C = {g: '#10b981', gd: '#047857', r: '#ef4444', b: '#2563eb', a: '#f59e0b', m: '#94a3b8', t: '#334155', l: '#e5e7eb'};
  const svg = (w, h, inner, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label || '')}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 11}" fill="${o.fill || C.t}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}>${esc(s)}</text>`;
  const short = n => { const a = Math.abs(n); return a >= 1e8 ? (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '억' : a >= 1e4 ? Math.round(n / 1e4).toLocaleString('ko-KR') + '만' : won(n); };
  function chartLine(o, recs, cost, sel) {
    const W = 640, H = 196, pl = 34, pr = 34, ay = 108; const pts = [o.est, o.floorLimit, o.floorMin, o.floorMax, ...recs.map(r => r.bid)]; if (cost !== null && cost !== undefined) pts.push(cost); if (sel) pts.push(sel.bid);
    let lo = Math.min(...pts), hi = Math.max(...pts); const pad = (hi - lo) * 0.05 || 1; lo -= pad; hi += pad; const X = v => pl + (v - lo) / (hi - lo) * (W - pl - pr);
    let s = `<line x1="${pl}" x2="${W - pr}" y1="${ay}" y2="${ay}" stroke="${C.m}" stroke-width="2"/>`;
    if (o.floorMax > o.floorMin) s += `<rect x="${X(o.floorMin)}" y="${ay - 16}" width="${Math.max(2, X(o.floorMax) - X(o.floorMin))}" height="32" fill="${C.a}" opacity=".28" rx="3"/>` + T((X(o.floorMin) + X(o.floorMax)) / 2, ay + 30, `하한가 변동 구간 ${short(o.floorMin)}~${short(o.floorMax)} (예가 ${rangeTxt(o)})`, {size: 10.5, fill: C.a});
    const tick = (v, col, label, yl, anchor) => `<line x1="${X(v)}" x2="${X(v)}" y1="${ay - 22}" y2="${ay + 22}" stroke="${col}" stroke-width="2.5"/>` + T(X(v), yl, label, {fill: col, bold: true, anchor: anchor || 'middle', size: 11});
    s += tick(o.est, C.b, '기준 ' + short(o.est), 24); s += tick(o.floorLimit, C.r, '낙찰하한가 ' + won(o.floorLimit), 168);
    if (cost !== null && cost !== undefined) s += tick(cost, C.gd, '원가 ' + won(cost), 188);
    recs.forEach(r => { const isSel = sel && sel.bid === r.bid; s += `<path d="M${X(r.bid) - 7} ${ay - 36}L${X(r.bid) + 7} ${ay - 36}L${X(r.bid)} ${ay - 24}Z" fill="${isSel ? C.b : C.t}"/>` + T(X(r.bid), ay - 42, r.id, {bold: true, fill: isSel ? C.b : C.t}); });
    if (sel && !recs.some(r => r.bid === sel.bid)) s += `<path d="M${X(sel.bid) - 7} ${ay - 36}L${X(sel.bid) + 7} ${ay - 36}L${X(sel.bid)} ${ay - 24}Z" fill="${C.b}"/>` + T(X(sel.bid), ay - 42, '선택', {bold: true, fill: C.b});
    return svg(W, H, s, '낙찰하한선 위치');
  }
  function chartMargin(o) {
    const rows = o.rows, hasC = o.cost !== null && o.cost !== undefined; const W = 640, H = 230, pl = 56, pb = 52, pt = 24; const vals = rows.map(r => hasC ? r.margin : r.diff); const mx = Math.max(1, ...vals.map(Math.abs)); const zy = pt + (H - pt - pb) * (Math.max(0, ...vals) / (Math.max(0, ...vals) + Math.abs(Math.min(0, ...vals)) || 1));
    const scale = (H - pt - pb) / (Math.max(0, ...vals) + Math.abs(Math.min(0, ...vals)) || 1); const bw = Math.min(54, (W - pl - 20) / rows.length - 14); let s = `<line x1="${pl}" x2="${W - 10}" y1="${zy}" y2="${zy}" stroke="${C.m}"/>`;
    rows.forEach((r, i) => { const v = vals[i], x = pl + 14 + i * ((W - pl - 20) / rows.length) + ((W - pl - 20) / rows.length - 14 - bw) / 2, h = Math.abs(v) * scale, y = v >= 0 ? zy - h : zy; const bad = r.below || (hasC && r.loss); s += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(1.5, h)}" rx="3" fill="${bad ? C.r : C.g}" opacity="${r.below ? .55 : 1}"/>` + T(x + bw / 2, v >= 0 ? y - 5 : y + h + 12, (v >= 0 ? '' : '') + short(v), {size: 10.5}) + T(x + bw / 2, H - pb + 16, pct(r.rate), {size: 10.5, bold: true}) + T(x + bw / 2, H - pb + 30, r.below ? '하한 미만' : (hasC && r.loss ? '적자' : '가능'), {size: 10, fill: bad ? C.r : C.gd}); });
    s += T(pl - 6, pt + 4, hasC ? '마진(원)' : '하한가 대비(원)', {anchor: 'end', size: 10.5, fill: C.m}); return svg(W, H, s, '투찰률별 마진');
  }
  function gauge(val, min, max, zones, title, valTxt, sub) {
    const W = 300, H = 176, cx = 150, cy = 140, r1 = 108, r0 = 84; const cl = v => Math.min(max, Math.max(min, v)); const ang = v => Math.PI * (1 - (cl(v) - min) / (max - min)); const pt = (a, r) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    const arc = (a0, a1) => { const p = [pt(a0, r1), pt(a1, r1), pt(a1, r0), pt(a0, r0)]; return `M${p[0][0]} ${p[0][1]}A${r1} ${r1} 0 0 1 ${p[1][0]} ${p[1][1]}L${p[2][0]} ${p[2][1]}A${r0} ${r0} 0 0 0 ${p[3][0]} ${p[3][1]}Z`; };
    let s = zones.map(z => `<path d="${arc(ang(z.from), ang(z.to))}" fill="${z.c}" opacity=".85"/>`).join(''); const n = pt(ang(val), r1 - 8);
    s += `<line x1="${cx}" y1="${cy}" x2="${n[0]}" y2="${n[1]}" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="7" fill="#0f172a"/>` + T(cx - r1 + 10, cy + 16, short1(min), {size: 10, fill: C.m}) + T(cx + r1 - 10, cy + 16, short1(max), {size: 10, fill: C.m}) + T(cx, 26, title, {bold: true, size: 12.5}) + T(cx, cy + 34, valTxt, {bold: true, size: 15}) + (sub ? T(cx, cy + 50, sub, {size: 10.5, fill: C.m}) : '');
    return svg(W, H + 28, s, title);
  }
  const short1 = v => (Math.round(v * 100) / 100) + '';
  function chartHist(o, recs, sel) {
    const items = E.HIST.map((h, i) => ({k: '장부' + (i + 1), v: h.ratioL, c: C.m})).concat(recs.map(r => ({k: r.id, v: r.bid / o.floorLimit, c: sel && sel.bid === r.bid ? C.b : '#93c5fd'})));
    const W = 640, H = 230, pl = 52, pb = 40, pt = 22; const lo = Math.min(0.975, ...items.map(i => i.v)) - 0.002, hi = Math.max(1.004, ...items.map(i => i.v)) + 0.003; const Y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb); const bw = (W - pl - 16) / items.length;
    let s = `<line x1="${pl}" x2="${W - 8}" y1="${Y(1)}" y2="${Y(1)}" stroke="${C.r}" stroke-dasharray="5 4" stroke-width="1.5"/>` + T(W - 10, Y(1) - 5, '하한가 100%', {anchor: 'end', size: 10.5, fill: C.r});
    items.forEach((it, i) => { const x = pl + i * bw + 6, w = bw - 12; s += `<rect x="${x}" y="${Y(it.v)}" width="${w}" height="${Math.max(2, H - pb - Y(it.v))}" fill="${it.c}" rx="3"/>` + T(x + w / 2, Y(it.v) - 5, (it.v * 100).toFixed(2) + '%', {size: 10}) + T(x + w / 2, H - pb + 16, it.k, {size: 10.5, bold: i >= E.HIST.length}); });
    s += T(pl - 6, pt + 4, '투찰가 ÷ 하한가', {anchor: 'end', size: 10.5, fill: C.m}); s += T(W / 2, H - 6, '회색 = 과거 장부 6건 · 파랑 = 이번 권장안', {size: 10.5, fill: C.m}); return svg(W, H, s, '과거 장부 대비 투찰 위치');
  }
  function chartSim(floors, recs, sel) {
    const h = E.histogram(floors, 24); const W = 640, H = 230, pl = 36, pb = 44, pt = 26; const my = Math.max(...h.bins.map(b => b.c)) || 1; const span = (h.max - h.min) || 1; const X = v => pl + (v - h.min) / span * (W - pl - 14); const bw = h.bins.length > 1 ? (W - pl - 14) / h.bins.length : 40;
    let s = h.bins.map((b, i) => `<rect x="${pl + i * bw + 1}" y="${pt + (H - pt - pb) * (1 - b.c / my)}" width="${bw - 2}" height="${(H - pt - pb) * b.c / my}" fill="#cbd5e1"/>`).join('');
    recs.forEach((r, i) => { const x = Math.min(W - 14, Math.max(pl, X(r.bid))); const p = E.passProb(floors, r.bid); const isSel = sel && sel.bid === r.bid; s += `<line x1="${x}" x2="${x}" y1="${pt - 4}" y2="${H - pb}" stroke="${isSel ? C.b : C.t}" stroke-width="${isSel ? 3 : 2}"/>` + T(x, pt - 8 - (i % 2) * 11, `${r.id} 통과 ${(p * 100).toFixed(0)}%`, {size: 10.5, bold: true, fill: isSel ? C.b : C.t}); });
    s += T(pl, H - pb + 16, short(h.min), {size: 10.5, anchor: 'start'}) + T(W - 14, H - pb + 16, short(h.max), {size: 10.5, anchor: 'end'}) + T(W / 2, H - 8, '모의로 나온 낙찰하한가 분포(원) — 세로선보다 왼쪽 면적 = 그 투찰가가 하한을 통과할 비율', {size: 10.5, fill: C.m}); return svg(W, H, s, '모의 낙찰하한가 분포');
  }

  /* ───────── 계산 · 화면 ───────── */
  const rangeTxt = o => o.rangeLo === o.rangeHi ? '±' + o.rangeLo + '%' : '−' + o.rangeLo + '% ~ +' + o.rangeHi + '%';
  const splitTax = (o, bid) => { const V = o.vat, free = $('n_tax').value !== 'tax'; if (o.basis === 'asis') { const sp = free ? bid : Math.round(bid / (1 + V / 100)); return {supply: sp, vat: bid - sp, total: bid}; } const vt = free ? 0 : Math.round(bid * V / 100); return {supply: bid, vat: vt, total: bid + vt}; };
  function showCalc() {
    const inp = buildInp(), o = E.calc(inp), chk = E.reverify(o); const n = nget(); const h = [];
    $('calcHead').innerHTML = `<b>${esc(n.title || '(공고명 없음)')}</b> · ${esc(n.org || '기관 미입력')} · 기초금액 ${n.base ? esc(won(num(n.base).n)) + '원' : '<span class="bad">미입력</span>'} · 낙찰하한율 ${n.floor ? esc(n.floor) + '%' : '<span class="bad">미입력</span>'} · 예가범위 ${esc(n.method === 'single' ? '±0% (단일예가)' : ((n.rlo || n.rhi) ? '−' + (n.rlo || n.range || 0) + '% ~ +' + (n.rhi || n.range || 0) + '%' : '±' + (n.range || '2 (비어 있어 가정)') + '%'))}`;
    $('calcMsg').textContent = '';
    if (o.fixes.length) h.push(`<div class="card"><b>자동 수정 ${o.fixes.length}건</b><div class="small" style="margin-top:6px">${o.fixes.map(x => '· ' + esc(x)).join('<br>')}</div></div>`);
    if (o.errors.length) { h.push(`<div class="card"><div class="bad">입력 오류 — 계산하지 않았습니다 (빈칸·잘못된 값은 추측하지 않습니다)</div><div style="margin-top:8px">${o.errors.map(x => '· ' + esc(x)).join('<br>')}</div><p class="small" style="margin-top:10px">① 공고 등록 탭의 공고 정보에서 값을 확인하세요.</p></div>`); $('calcOut').innerHTML = h.join(''); S.lastCalc = null; log('계산 중단: 입력 오류 ' + o.errors.length + '건'); return; }
    const cost = o.cost, recs = E.recommend(o, cost); const people = Math.min(500, Math.max(2, Math.round(num($('c_people').value).n || 30)));
    const floors = E.simulate(o.est, o.floorRate, o.rangeLo, o.rangeHi, people, 3000, 20261119);
    if (!S.sel || !recs.some(r => r.bid === S.sel.bid) && !o.rows.some(r => r.bid === S.sel.bid)) S.sel = {bid: recs[0].bid, id: 'A'};
    S.lastCalc = {inp, o, chk, recs, floors, people, cost}; renderOut(); log(`계산 완료: 기준 ${won(o.est)} / 하한가 ${won(o.floorLimit)} / 권장 A ${won(recs[0].bid)} / 재검증 ${chk.every(c => c.pass) ? 'PASS' : 'FAIL'}`); for (const k of ['2']) S.tabsDone[k] = true;
    document.querySelector('#tabs button[data-tab="2"]').classList.add('done');
  }
  function renderOut() {
    const L = S.lastCalc; if (!L) return; const {o, chk, recs, floors, people, cost, inp} = L; const sel = S.sel; const h = [];
    const selTax = splitTax(o, sel.bid), selRate = sel.bid / o.est * 100, selMargin = cost === null ? null : sel.bid - cost, selMP = cost === null ? null : selMargin / sel.bid * 100, selP = E.passProb(floors, sel.bid);
    o.notes.forEach(x => h.push(`<div class="explainbox">${esc(x)}</div>`));
    h.push(`<div class="card"><h2>한눈에 보기</h2><p class="lead">기준 = ${o.basis === 'asis' ? '기초금액 그대로(부가세 포함 입찰)' : '예정가격(부가세 제외 환산)'} · 선택한 투찰가 기준으로 갱신됩니다.</p><div class="kpis">
      <div class="kpi"><small>기준 금액(예정가격 가정)</small><b>${won(o.est)}원</b><em>사정율 0% 가정</em></div>
      <div class="kpi"><small>낙찰하한가 (하한율 ${pct(o.floorRate)})</small><b style="color:var(--red)">${won(o.floorLimit)}원</b><em>변동 구간 ${won(o.floorMin)} ~ ${won(o.floorMax)}</em></div>
      <div class="kpi"><small>원가</small><b>${cost === null ? '확인 필요' : won(cost) + '원'}</b><em>${cost === null ? '정가·환율·계수 입력' : esc(o.costNote).slice(0, 70)}</em></div>
      <div class="kpi"><small>선택한 투찰가 (${esc(sel.id || '직접')})</small><b style="color:var(--blue)">${won(sel.bid)}원</b><em>투찰률 ${selRate.toFixed(3)}% · 하한 통과(모의) ${(selP * 100).toFixed(0)}%</em></div>
      <div class="kpi"><small>예상 마진</small><b class="${selMargin !== null && selMargin < 0 ? 'bad' : ''}">${selMargin === null ? '확인 필요' : won(selMargin) + '원'}</b><em>${selMP === null ? '원가 입력 시 표시' : selMP.toFixed(2) + '%'}</em></div></div>
      <div style="margin-top:14px"><span class="pill">공급가액 ${won(selTax.supply)}원</span><span class="pill">부가세 ${won(selTax.vat)}원</span><span class="pill">총액(투찰금액) ${won(selTax.total)}원</span><span class="pill">입찰보증금 ${o.bondRate === null ? '확인 필요(공고 비율 입력)' : won(Math.round(sel.bid * o.bondRate / 100)) + '원 (' + pct(o.bondRate) + ')'}</span></div>
      <div class="row" style="margin-top:18px"><button id="goDocs" class="primary" title="기능: 선택한 투찰금액으로 ③ 서류 작성 탭 이동 · 결과: 서류 초안에 금액 반영 · 사용시점: 투찰가를 정했을 때">이 금액으로 서류 만들기 → ③</button><button id="cpBid" title="기능: 투찰금액을 복사 · 결과: 나라장터 입찰서에 붙여넣기 · 사용시점: 투찰 직전">투찰금액 복사</button></div></div>`);
    h.push(`<div class="card"><h2>권장 투찰 구간 <span class="small" style="font-weight:400">· 과거 장부 6건·손글씨 계산식 패턴 기준 · 카드를 눌러 선택</span></h2><p class="lead">장부의 실제 투찰가는 하한가 대비 98.1%~100.1% 범위였고, 손글씨 계산식과 장부 일부 행은 "하한가 × 1.001"이었습니다. 이 규칙을 이번 공고 숫자에 적용했습니다. 낙찰 가능성을 보장하는 값이 아닙니다.</p><div class="recs">${recs.map(r => { const p = E.passProb(floors, r.bid); const d = (r.bid - o.floorLimit) / o.floorLimit * 100; return `<div class="rec ${sel.bid === r.bid ? 'sel' : ''}" data-bid="${r.bid}" data-id="${r.id}" title="기능: 이 투찰가를 선택 · 결과: 위 요약·그래프 갱신 · 사용시점: 후보를 비교할 때"><h4>${r.id}안 · ${esc(r.name)}</h4><div class="big">${won(r.bid)}원</div><div class="small">투찰률 ${r.rate.toFixed(3)}% · 하한가 대비 ${d >= 0 ? '+' : ''}${d.toFixed(3)}%</div><ul><li>산식: ${esc(r.how)}</li><li>하한 통과(모의 ${people}개사): <b>${(p * 100).toFixed(0)}%</b></li><li>마진: ${r.margin === null ? '확인 필요' : `<span class="${r.loss ? 'bad' : ''}">${won(r.margin)}원 (${r.marginPct.toFixed(2)}%)${r.loss ? ' · 적자' : ''}</span>`}</li><li class="small">근거: ${esc(r.ev)}</li></ul></div>`; }).join('')}</div></div>`);
    const rl = Math.max(o.floorRate * (1 - o.rangeLo / 100) - 0.4, 50), rh = Math.min(o.floorRate * (1 + o.rangeHi / 100) + 0.4, 100.0001);
    const gz = [{from: rl, to: o.floorRate * (1 - o.rangeLo / 100), c: C.r}, {from: o.floorRate * (1 - o.rangeLo / 100), to: o.floorRate * (1 + o.rangeHi / 100), c: C.a}, {from: o.floorRate * (1 + o.rangeHi / 100), to: rh, c: C.g}];
    if (o.rangeLo + o.rangeHi === 0) { gz[0].to = o.floorRate; gz[1] = {from: o.floorRate, to: o.floorRate, c: C.a}; gz[2].from = o.floorRate; }
    const mz = [{from: -5, to: 0, c: C.r}, {from: 0, to: 5, c: C.a}, {from: 5, to: 25, c: C.g}];
    h.push(`<div class="card"><h2>그래프로 보기</h2><div class="charts">
      <div class="chart"><h4>낙찰하한선 위치</h4><p>기준금액 → 하한가 변동 구간 → 원가, 그리고 권장안(A·B·C) 위치</p>${chartLine(o, recs, cost, sel)}</div>
      <div class="chart"><h4>${cost === null ? '투찰률 구간별 하한가 대비 차이' : '투찰률 구간별 마진 변화'}</h4><p>${cost === null ? '원가를 넣으면 마진 막대로 바뀝니다 · 빨강 = 하한 미만' : '초록 = 가능, 빨강 = 하한 미만 또는 적자'}</p>${chartMargin(o)}</div>
      <div class="chart"><h4>선택 투찰률 게이지</h4><p>빨강: 어떤 예정가격에서도 하한 미만 · 노랑: 예정가격에 따라 갈림 · 초록: 항상 통과</p><div class="row" style="justify-content:space-around">${gauge(selRate, rl, rh, gz, '투찰률 ' + selRate.toFixed(3) + '%', selRate.toFixed(3) + '%', '하한율 ' + pct(o.floorRate))}${gauge(selMP === null ? -5 : selMP, -5, 25, mz, '마진율', selMP === null ? '원가 필요' : selMP.toFixed(1) + '%', '5% 이상 안정')}</div></div>
      <div class="chart"><h4>과거 장부 대비 위치</h4><p>투찰가 ÷ 하한가 — 과거 6건과 이번 권장안 비교 (세로축은 일부 구간만 표시)</p>${chartHist(o, recs, sel)}</div>
      <div class="chart" style="grid-column:1/-1"><h4>모의 하한가 분포와 통과 확률</h4><p>가정: 복수예비가격 15개(범위 ${rangeTxt(o)} 균등) · 참가 ${people}개사가 각 2개 무작위 선택 · 최다 4개 평균 = 예정가격 · 3,000회 모의. 실제 확률이 아닙니다.</p>${chartSim(floors, recs, sel)}</div></div></div>`);
    const mx = Math.max(1, ...o.rows.map(r => Math.abs(r.margin || 0)));
    h.push(`<details open><summary>투찰률별 입찰금액·마진 (행을 누르면 선택)</summary><div class="inner"><div class="scroll"><table id="rateTbl"><thead><tr><th>투찰률</th><th>입찰금액</th><th>하한가 대비</th><th>원가</th><th>마진(원)</th><th>마진율</th><th>하한 통과(모의)</th><th>판정</th></tr></thead><tbody>${o.rows.map(r => `<tr data-bid="${r.bid}" class="${sel.bid === r.bid ? 'sel' : ''}" style="cursor:pointer"><td class="n">${pct(r.rate)}</td><td class="n">${won(r.bid)}</td><td class="n">${r.diff >= 0 ? '+' : ''}${won(r.diff)} (${r.diffPct.toFixed(3)}%)</td><td class="n">${cost === null ? '확인 필요' : won(cost)}</td><td class="n ${r.loss ? 'bad' : ''}">${r.margin === null ? '확인 필요' : won(r.margin)}</td><td class="n">${r.marginPct === null ? '-' : r.marginPct.toFixed(2) + '%'}</td><td class="n">${(E.passProb(floors, r.bid) * 100).toFixed(0)}%</td><td>${r.below ? '<span class="bad">하한 미만(기준 예가)</span>' : r.loss ? '<span class="bad">적자</span>' : '<span class="ok">가능</span>'}</td></tr>`).join('')}</tbody></table></div><p class="small" style="margin-top:8px">${esc(o.costNote)} · 마진 = 입찰금액 − 원가</p></div></details>`);
    h.push(`<details><summary>사정율별 낙찰하한가 (기초금액 × 사정율 × 하한율, 원 미만 절상)</summary><div class="inner"><div class="scroll"><table><thead><tr><th>사정율(예정가격 이동)</th><th>예정가격(가정)</th><th>낙찰하한가</th><th>선택 투찰가와의 차이</th></tr></thead><tbody>${o.sajung.map(s => `<tr><td class="n">${s.sajung >= 0 ? '+' : ''}${s.sajung}%</td><td class="n">${won(s.est)}</td><td class="n">${won(s.floor)}</td><td class="n ${sel.bid < s.floor ? 'bad' : 'ok'}">${sel.bid - s.floor >= 0 ? '+' : ''}${won(sel.bid - s.floor)} ${sel.bid < s.floor ? '(하한 미만)' : ''}</td></tr>`).join('')}</tbody></table></div><p class="small" style="margin-top:8px">예가변동폭 참고(학습자료): ${E.ORG_RANGE.map(x => x[0] + ' ' + x[1]).join(' · ')}</p></div></details>`);
    h.push(`<details><summary>전략 3종 추천 금액</summary><div class="inner"><div class="scroll"><table><thead><tr><th>전략</th><th>산식</th><th>입찰금액</th><th>투찰률</th><th>마진</th><th>판정</th></tr></thead><tbody>${o.strat.map(s => s.bid === null ? `<tr><td>${esc(s.name)}</td><td>${esc(s.how)}</td><td colspan="4" class="warn">확인 필요</td></tr>` : `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.how)}</td><td class="n">${won(s.bid)}</td><td class="n">${s.rate.toFixed(3)}%</td><td class="n">${s.margin === null ? '확인 필요' : won(s.margin) + ' (' + s.marginPct.toFixed(2) + '%)'}</td><td>${s.below ? '<span class="bad">하한 미만 → 하한가 이상으로</span>' : s.loss ? '<span class="bad">원가 미만(적자)</span>' : '<span class="ok">가능</span>'}</td></tr>`).join('')}</tbody></table></div></div></details>`);
    const best = o.rows.find(r => !r.below && !r.loss) || o.rows.find(r => !r.below);
    h.push(`<details><summary>왜 이 금액인가 (단계별 설명) · 재검증 ${chk.every(c => c.pass) ? '<span class="ok">PASS</span>' : '<span class="bad">FAIL</span>'}</summary><div class="inner"><div class="explain">${esc(
`1) 기준 금액 ${won(o.est)}원 (${o.basis === 'asis' ? '공고 기초금액 그대로 · 입찰장부 K열 방식' : '부가세 제외 예정가격'}).
2) 낙찰하한가 = 기준 × 낙찰하한율 ${pct(o.floorRate)} = ${won(o.floorLimit)}원. 이보다 낮게 쓰면 탈락입니다.
3) 실제 예정가격은 기초금액 ${rangeTxt(o)} 안의 복수예비가격 평균이므로 하한가는 ${won(o.floorMin)} ~ ${won(o.floorMax)}원 사이에서 움직입니다.
4) ${cost === null ? '정가·환율·계수를 넣지 않아 마진은 계산하지 않았습니다.' : o.costNote + ' → 이 금액 아래로 쓰면 적자입니다.'}
5) ${best ? `하한 위·적자 아님을 만족하는 가장 낮은 투찰률 후보: ${pct(best.rate)}, ${won(best.bid)}원` : '입력한 투찰률 후보 중 조건을 만족하는 금액이 없습니다.'}
6) 권장 A안은 하한가×1.001 규칙입니다.
※ 낙찰 가능성은 보장하지 않으며 최종 제출 판단은 사람이 합니다.`)}</div><p class="small" style="margin-top:10px">재검증: ${chk.length}개 항목 중 ${chk.filter(c => c.pass).length}개 일치</p></div></details>`);
    $('calcOut').innerHTML = h.join('');
    const set = (bid, id) => { S.sel = {bid, id: id || ''}; syncBid(); renderOut(); };
    $('calcOut').querySelectorAll('[data-bid]').forEach(el => el.onclick = () => set(+el.dataset.bid, el.dataset.id));
    $('goDocs').onclick = () => { syncBid(true); showTab(3); toast('선택한 투찰금액을 서류 작성에 반영했습니다'); };
    $('cpBid').onclick = async () => { try { await navigator.clipboard.writeText(String(selTax.total)); toast('투찰금액 ' + won(selTax.total) + '원 복사됨'); } catch (e) { toast('복사 권한이 없습니다 — 금액을 직접 선택해 복사하세요'); } };
    syncBid();
  }
  function syncBid(force) { const L = S.lastCalc; if (!L || !L.o || !S.sel) return; const t = splitTax(L.o, S.sel.bid).total; const el = $('d_bid'); if (force || !el.value || el.dataset.auto === '1') { el.value = String(t); el.dataset.auto = '1'; } }
  $('d_bid').addEventListener('input', () => { $('d_bid').dataset.auto = '0'; });
  const calcDispatch = () => (window.__BIDUI2 && window.__BIDUI2._ready ? window.__BIDUI2.calc() : showCalc());
  $('calcBtn').onclick = calcDispatch;
  $('toCalc').onclick = () => { showTab(2); calcDispatch(); };
  $('calcClear').onclick = () => { ['list', 'fx', 'disc', 'rates'].forEach(k => $('c_' + k).value = ''); $('calcOut').innerHTML = '<div class="empty">공고 숫자를 입력한 뒤 [계산하기]를 누르세요.</div>'; S.sel = null; S.lastCalc = null; csave(); };
  $('exLoad').onclick = () => { const set = (id, v) => { $(id).value = v; $(id).classList.remove('auto'); }; set('n_title', '예시 보고서 구입'); set('n_org', '예시기관'); set('n_no', 'EX-0001'); set('n_base', '4000000'); set('n_basis', 'asis'); set('n_floor', '88'); set('n_range', '2'); set('n_method', 'multi'); set('n_tax', 'free'); S.sel = null; showCalc(); toast('예시 값을 불러왔습니다 (실제 공고가 아닙니다)'); };

  /* ───────── 체크리스트 ───────── */
  const chkKey = () => { const n = nget(); return n.no || n.title || '(공고 미입력)'; };
  function checklistItems() {
    const items = E.CHECKLIST.map(c => Object.assign({}, c, {hit: S.docHits[c.id] || null}));
    Object.keys(S.docHits).forEach(k => { if (E.EXTRA_DOCS[k] && !items.some(i => i.id === k)) items.push({stage: '1 참가·투찰', id: k, t: E.EXTRA_DOCS[k], src: '올린 공고문에서 발견', gen: false, hit: S.docHits[k]}); });
    return items;
  }
  function renderChk() { if (window.__BIDUI2 && window.__BIDUI2._ready) return window.__BIDUI2.renderChk(); return renderChk0(); }
  function renderChk0() {
    const items = checklistItems(), st = ls.get('wic02v2_chk', {}), key = chkKey(), cur = st[key] || {}; let stage = '', h = '', done = 0;
    items.forEach(it => { if (it.stage !== stage) { stage = it.stage; h += `<div class="stage">${esc(stage.replace(/^\d /, ''))}</div>`; } const ok = !!cur[it.id]; if (ok) done++;
      h += `<label class="chk ${ok ? 'done' : ''}"><input type="checkbox" data-id="${esc(it.id)}" ${ok ? 'checked' : ''} title="기능: 준비 완료 표시 · 결과: 진행률 갱신(공고별 저장) · 사용시점: 서류를 챙겼을 때"><div style="flex:1"><div class="ct">${esc(it.t)} ${it.hit ? `<span class="badge b-mid" title="${esc(it.hit)}">공고문 언급</span>` : ''}</div><div class="src">근거: ${esc(it.src)}</div></div>${it.gen ? `<button class="sm" type="button" data-gen="${it.gen}" title="기능: 이 서류 초안 내려받기 · 결과: 파일 저장 · 사용시점: 서류 작성 시">초안 만들기</button>` : ''}</label>`; });
    $('chkBox').innerHTML = h; $('chkProg').textContent = `· ${done} / ${items.length} 완료 (${key})`; $('chkBar').style.width = (items.length ? done / items.length * 100 : 0) + '%';
  }
  $('chkBox').addEventListener('change', e => { const c = e.target.closest('input[type=checkbox]'); if (!c) return; const st = ls.get('wic02v2_chk', {}), key = chkKey(); st[key] = st[key] || {}; st[key][c.dataset.id] = c.checked; ls.set('wic02v2_chk', st); renderChk(); });

  /* ───────── 회사정보 · 품목 · 서류 생성 ───────── */
  const COF = ['name', 'ceo', 'biz', 'addr', 'tel', 'mgr'];
  const coget = () => { const o = {}; COF.forEach(k => o[k] = $('co_' + k).value); return o; };
  function coload() { const s = ls.get('wic02v2_co', {}); COF.forEach(k => { if (s[k] !== undefined) $('co_' + k).value = s[k]; $('co_' + k).addEventListener('change', () => ls.set('wic02v2_co', coget())); }); }
  S.itemsDoc = ls.get('wic02v2_items', null) || [{name: '', pub: '', qty: '1', list: '', cur: 'KRW', fx: ''}];
  function renderItems() {
    if (S.itemsDoc.length === 1 && !S.itemsDoc[0].name) S.itemsDoc[0].name = nget().title;
    $('itemTbl').querySelector('tbody').innerHTML = S.itemsDoc.map((it, i) => `<tr data-i="${i}"><td><input data-f="name" value="${esc(it.name)}" style="width:260px" title="기능: 품목(보고서) 이름 · 결과: 산출내역서 품목명 · 사용시점: 서류 작성 시"></td><td><input data-f="pub" value="${esc(it.pub)}" style="width:130px" title="기능: 발행사 · 결과: 제조사 칸 · 사용시점: 서류 작성 시"></td><td><input data-f="qty" value="${esc(it.qty)}" style="width:60px" title="기능: 수량 · 결과: 단가 계산 · 사용시점: 서류 작성 시"></td><td><input data-f="list" value="${esc(it.list)}" style="width:100px" title="기능: 정가 · 결과: 투찰금액 배분 비율 · 사용시점: 여러 품목일 때"></td><td><select data-f="cur" title="기능: 통화 · 결과: 원화 환산 · 사용시점: 외화 정가일 때">${['KRW', 'USD', 'EUR', 'GBP', 'JPY'].map(c => `<option ${c === it.cur ? 'selected' : ''}>${c}</option>`).join('')}</select></td><td><input data-f="fx" value="${esc(it.fx)}" style="width:80px" title="기능: 환율 · 결과: 원화 환산 · 사용시점: 외화 정가일 때"></td><td><button class="sm" data-del="${i}" title="기능: 이 품목 삭제 · 결과: 목록에서 제거 · 사용시점: 잘못 추가했을 때">삭제</button></td></tr>`).join('');
  }
  $('itemTbl').addEventListener('input', e => { const tr = e.target.closest('tr'); if (!tr || !e.target.dataset.f) return; S.itemsDoc[+tr.dataset.i][e.target.dataset.f] = e.target.value; ls.set('wic02v2_items', S.itemsDoc); });
  $('itemTbl').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; S.itemsDoc.splice(+b.dataset.del, 1); if (!S.itemsDoc.length) S.itemsDoc.push({name: '', pub: '', qty: '1', list: '', cur: 'KRW', fx: ''}); ls.set('wic02v2_items', S.itemsDoc); renderItems(); });
  $('itemAdd').onclick = () => { S.itemsDoc.push({name: '', pub: '', qty: '1', list: '', cur: 'KRW', fx: ''}); ls.set('wic02v2_items', S.itemsDoc); renderItems(); };
  const dlDoc = (name, html) => WIC.download(name, new Blob(['﻿' + html], {type: 'application/msword;charset=utf-8'}));
  const dlXls = (name, rows, sheet) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet); const out = XLSX.write(wb, {bookType: 'xls', type: 'array'}); WIC.download(name, new Blob([out], {type: 'application/vnd.ms-excel'})); };
  const safeName = s => str(s).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || '입찰';
  function preview(html) { $('prev').innerHTML = `<div class="small" style="margin-bottom:6px">미리보기 (내려받은 파일과 같은 내용)</div><iframe sandbox style="width:100%;height:430px;border:1px solid var(--line);border-radius:10px;background:#fff" srcdoc="${esc(html)}" title="서류 미리보기"></iframe>`; }
  function gen(kind) {
    const n = nget(), co = coget(), bid = num($('d_bid').value).s === 'ok' ? num($('d_bid').value).n : null; const taxfree = n.tax !== 'tax', V = num(n.vat).s === 'ok' ? num(n.vat).n : 10; const base = num(n.base).s === 'ok' ? num(n.base).n : null; const F = num(n.floor).s === 'ok' ? num(n.floor).n : null;
    const miss = []; if (!n.no) miss.push('공고번호'); if (!n.title) miss.push('공고명'); if (bid === null && kind !== 'ledger') miss.push('확정 투찰금액'); if (!co.name && ['apply', 'bond'].includes(kind)) miss.push('상호');
    const nn = {no: n.no, name: n.title, org: n.org, due: n.due};
    try {
      if (kind === 'cost') { if (bid === null) { toast('확정 투찰금액을 먼저 입력하세요 (② 계산에서 선택하면 자동 입력)'); return; } const rows = E.costSheetRows(nn, S.itemsDoc.map(i => ({name: i.name || n.title, pub: i.pub, qty: i.qty, list: i.list, cur: i.cur, fx: i.fx})), bid, taxfree, V); dlXls('산출내역서_' + safeName(n.no || n.title) + '.xls', rows, '산출내역서'); $('prev').innerHTML = '<div class="small" style="margin-bottom:6px">미리보기</div><div class="scroll"><table><tbody>' + rows.map(r => '<tr>' + (r.length ? r.map(c => `<td>${esc(c)}</td>`).join('') : '<td>&nbsp;</td>') + '</tr>').join('') + '</tbody></table></div>'; }
      else if (kind === 'apply') { const html = E.docApply(nn, co, bid); dlDoc('입찰참가신청서_' + safeName(n.no || n.title) + '.doc', html); preview(html); }
      else if (kind === 'bidform') { const html = E.docBidForm(nn, co, bid, taxfree); dlDoc('물품구매입찰서_입력값_' + safeName(n.no || n.title) + '.doc', html); preview(html); }
      else if (kind === 'bond') { const html = E.docBond(nn, co, bid); dlDoc('입찰보증금지급각서_' + safeName(n.no || n.title) + '.doc', html); preview(html); }
      else if (kind === 'payreq') { const html = E.docPayReq(nn, co, bid, taxfree); dlDoc('대금요청서_입력값_' + safeName(n.no || n.title) + '.doc', html); preview(html); }
      else if (kind === 'contract') { const html = E.docContract(nn, co, bid, base, F); dlDoc('계약입력카드_' + safeName(n.no || n.title) + '.doc', html); preview(html); }
      else if (kind === 'ledger') { const c = cget(), L = S.lastCalc; const f = {base, floor: F, range: n.method === 'single' ? 0 : (num(n.range).s === 'ok' ? num(n.range).n : 2), company: n.org, cur: c.cur, list: c.list, fx: c.fx, coef: c.costmode === 'ledger' ? c.disc : '', model: (S.itemsDoc[0] && S.itemsDoc[0].name) || n.title, pub: (S.itemsDoc[0] && S.itemsDoc[0].pub) || ''}; const row = E.ledgerRow(nn, f, bid, L ? L.cost : null); const rows = [E.LEDGER_HEAD, row]; dlXls('입찰장부_1행_' + safeName(n.no || n.title) + '.xls', rows, 'Sheet1'); $('prev').innerHTML = '<div class="small" style="margin-bottom:6px">미리보기 (정본 26열)</div><div class="scroll"><table><thead><tr>' + E.LEDGER_HEAD.map(x => `<th>${esc(x)}</th>`).join('') + '</tr></thead><tbody><tr>' + row.map(x => `<td>${esc(x)}</td>`).join('') + '</tr></tbody></table></div>'; }
      toast('초안을 내려받았습니다' + (miss.length ? ' — 빈칸(확인 필요): ' + miss.join(', ') : '')); log('서류 초안 생성: ' + kind + (miss.length ? ' · 빈칸 ' + miss.join(',') : ''));
    } catch (e) { toast('생성 실패: ' + e.message); log('서류 생성 실패: ' + kind + ' ' + e.message); }
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-gen]'); if (b) { e.preventDefault(); if (document.getElementById('tab3').classList.contains('on')) gen(b.dataset.gen); } });

  /* ───────── 자가검증 ───────── */
  const calc = E.calc, mulR = E.mulRate;
  const EV_CASES = [
    ['예정 99,000,000 × 하한율 87.745% = 낙찰하한가 (원장 902행)', '86,867,550', () => won(floorLimit(99000000, 87.745))],
    ['예정 99,600,000 × 하한율 87.745% (손계산 87,394,020)', '87,394,020', () => won(floorLimit(99600000, 87.745))],
    ['배정예산 75,000,000 ÷ 1.10 = 추정가격 (원장 5095행)', '68,181,818', () => won(calc({budget: '75000000', vat: '10', floor: '87.745'}).est)],
    ['예정 8,230,000 에서 7,920,000 원 = 투찰률 96.233% (원장 2366행)', '96.233', () => (7920000 / 8230000 * 100).toFixed(3)],
    ['예정 8,230,000 × 96.233% = 입찰금액', '7,919,976', () => won(mulR(8230000, 96.233))],
    ['정가 13,000,000 · 할인율 20% → 매입가 10,400,000 (원장 8399행 식)', '10,400,000', () => won(calc({est: '11466000', floor: '87.745', list: '13000000', cur: 'KRW', fx: '1', disc: '20'}).cost)],
    ['입찰 11,466,000 − 매입가 10,400,000 = 마진 1,066,000 (마진율 9.297%)', '1,066,000 / 9.297%', () => { const r = calc({est: '11466000', floor: '87.745', rates: '100', list: '13000000', cur: 'KRW', fx: '1', disc: '20'}).rows[0]; return won(r.margin) + ' / ' + r.marginPct.toFixed(3) + '%'; }],
    ['외화 환산(시험값): 5,000 USD × 환율 1,400 × (1−20%) = 5,600,000', '5,600,000', () => won(calc({est: '10000000', floor: '87.745', list: '5000', cur: 'USD', fx: '1400', disc: '20'}).cost)],
    ['오류수정: "99,000,000원" 쉼표·원 제거 후 동일 결과', '86,867,550', () => won(calc({est: '99,000,000원', floor: '87.745'}).floorLimit)],
    ['오류수정: 하한율 0.87745(비율) → 87.745%', '87.745', () => String(calc({est: '99000000', floor: '0.87745'}).floorRate)],
    ['빈 하한율은 계산 거부(추측 금지)', '오류', () => calc({est: '99000000', floor: ''}).errors.length ? '오류' : '계산됨'],
    ['0원·음수 추정가격은 계산 거부', '오류', () => (calc({est: '0', floor: '87.745'}).errors.length && calc({est: '-5', floor: '87.745'}).errors.length) ? '오류' : '계산됨'],
    ['초대형 숫자 9,999,999,999,999 에서 계산값이 모두 유한수', 'true', () => String(calc({est: '9999999999999', floor: '87.745', list: '1', cur: 'KRW', disc: '0'}).rows.every(r => isFinite(r.bid) && isFinite(r.margin)))],
    ['면세(도서·학술지): 공급가액 79,110,000 → 부가세 0 / 총액 79,110,000', '0 / 79,110,000', () => { const r = calc({est: '90000000', floor: '87.745', rates: '87.9', taxmode: 'free'}).rows[0]; return won(r.vatAmt) + ' / ' + won(r.total); }],
    ['과세(그 외): 공급가액 79,110,000 → 부가세 7,911,000 / 총액 87,021,000', '7,911,000 / 87,021,000', () => { const r = calc({est: '90000000', floor: '87.745', rates: '87.9', taxmode: 'tax'}).rows[0]; return won(r.vatAmt) + ' / ' + won(r.total); }],
    ['최소마진 0% 선택: 공격적 전략 = 원가(10,400,000)', '10,400,000', () => won(calc({est: '11466000', floor: '87.745', list: '13000000', cur: 'KRW', disc: '20', min: '0'}).strat[2].bid)],
    ['최소마진 3% 선택: 공격적 전략 = 원가×1.03', '10,712,000', () => won(calc({est: '11466000', floor: '87.745', list: '13000000', cur: 'KRW', disc: '20', min: '3'}).strat[2].bid)],
    ['분류: "해외 시장보고서 구매" → 입찰', '입찰', () => classify('해외 시장보고서 구매').cls],
    ['분류: "정보시스템 구축 용역" → 제외(X)', '제외(X)', () => classify('정보시스템 구축 용역').cls],
    ['분류: "시장조사 용역(시장보고서 포함)" → 상충 → 확인필요(입찰 금지)', '확인필요', () => classify('시장조사 용역(시장보고서 포함)').cls],
    ['분류: 키워드 없는 "사무용품 구매" → 확인필요(입찰로 올리지 않음)', '확인필요', () => classify('사무용품 구매').cls],
    /* v2 추가: 입찰장부(.xls) 실제 값 · info21c 학습자료 예제 */
    ['손글씨 계산식: 기준 5,000,000 × 0.88 × 1.001 = 4,404,400', '4,404,400', () => won(E.recommend(calc({est: '5000000', floor: '88', range: '2'}), null)[0].bid)],
    ['학습자료 예제: 1억 × 100.1234% × 87.745% (원 미만 절상)', '87,853,278', () => won(E.bidBySajung(100000000, 0.1234, 87.745))],
    ['학습자료 예제: 1억 × 99.8766% × 87.745% (원 미만 절상)', '87,636,723', () => won(E.bidBySajung(100000000, -0.1234, 87.745))],
    ['부가세 포함 기준(asis) 면세: 공급가액 = 총액 2,700,000', '2,700,000 / 0', () => { const r = calc({est: '3000000', floor: '88', rates: '90', basis: 'asis', taxmode: 'free'}).rows[0]; return won(r.supply) + ' / ' + won(r.vatAmt); }],
    ['공고문 추출: 기초금액(금18,118,200원) → 18118200', '18118200', () => (E.extractFields('복수예가, 기초금액(금18,118,200원)').base || {}).value],
    ['공고문 추출: 낙찰하한율 90% 이상 → 90', '90', () => (E.extractFields('낙찰하한율 90% 이상으로 제출한 자').floor || {}).value],
    ['공고문 추출: 값이 없으면 비움(추측 금지)', '비어 있음', () => E.extractFields('관련 없는 문장').base ? '값 생성됨' : '비어 있음'],
    ['모의: 투찰가가 범위 최고 하한가면 통과확률 100%', '1', () => { const f = E.simulate(5000000, 88, 2, 2, 30, 500, 7); return String(E.passProb(f, Math.ceil(5000000 * 1.02 * 0.88) + 5)); }]
  ];
  async function sha(t) { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return 'sha256-unavailable'; } }
  $('verifyBtn').onclick = async () => {
    const res = EV_CASES.map(([name, exp, fn]) => { let act; try { act = String(fn()); } catch (e) { act = '예외: ' + e.message; } return {name, expected: exp, actual: act, pass: act === exp}; });
    const cur = S.lastCalc ? E.reverify(S.lastCalc.o).map(c => ({name: '[현재 계산] ' + c.name, expected: c.expected, actual: c.actual, pass: c.pass})) : [];
    const all = res.concat(cur), nf = all.filter(c => !c.pass).length;
    $('vTbl').querySelector('tbody').innerHTML = all.map(c => `<tr><td>${esc(c.name)}</td><td class="n">${esc(c.expected)}</td><td class="n">${esc(c.actual)}</td><td class="${c.pass ? 'ok' : 'bad'}">${c.pass ? 'PASS' : 'FAIL'}</td></tr>`).join('');
    const ev = {tool: '02_bid', version: 'v2', time: new Date().toISOString(), total: all.length, pass: all.length - nf, fail: nf, verdict: nf ? 'FAIL' : 'PASS', currentCalcIncluded: !!cur.length, cases: all};
    ev.sha256 = await sha(JSON.stringify({...ev, sha256: undefined})); S.ev = ev;
    $('verifyMsg').textContent = `${ev.pass}/${ev.total} 일치 → ${ev.verdict}` + (nf ? ' — 실패 항목을 수정한 뒤 다시 실행하세요(완료 보고 금지)' : ''); $('verifyMsg').className = nf ? 'bad' : 'ok';
    log(`자가검증 ${ev.verdict} ${ev.pass}/${ev.total} sha256=${ev.sha256.slice(0, 12)}`);
  };
  $('evBtn').onclick = () => { if (!S.ev) { $('verifyMsg').textContent = '먼저 [자가검증 실행]을 누르세요'; $('verifyMsg').className = 'warn'; return; } WIC.download('입찰도구_Evidence.json', new Blob([JSON.stringify(S.ev, null, 1)], {type: 'application/json'})); };

  /* ───────── 누적·저장·내보내기 ───────── */
  async function persist() {
    try { await db.setVerified('state', {items: S.items.map(({no, name, org, due, base, key}) => ({no, name, org, due, base, key})), dup: S.dup}); $('saveState').textContent = '저장: read-back 확인됨'; $('saveState').className = ''; }
    catch (e) { $('saveState').textContent = '저장: FAIL (' + e.message + ')'; $('saveState').className = 'bad'; log('저장 실패: ' + e.message); }
  }
  function addRows(rows) {
    const seen = new Set(S.items.map(i => i.key)); let added = 0, dup = 0;
    for (const r of rows) { const it = toItem(r); if (!it.name && !it.no) continue; if (AL.name.some(x => norm(x) === norm(it.name)) || AL.no.some(x => norm(x) === norm(it.no))) continue; const T2 = window.__BIDUI2 && window.__BIDUI2._ready && window.__BIDUI2.track; if (seen.has(it.key)) { dup++; if (T2) { const ex0 = S.items.find(x => x.key === it.key); if (ex0) T2(it, ex0); } continue; } seen.add(it.key); if (T2) T2(it, null); S.items.push(it); added++; }
    S.dup += dup; log(`반영: 신규 ${added} / 중복 ${dup}`); render(); S.pending = persist(); return S.pending;
  }
  async function loadSaved() { try { const st = await db.get('state'); if (st) { S.items = st.items || []; S.dup = st.dup || 0; log(`복원: ${S.items.length}건`); } } catch (e) { log('복원 실패: ' + e.message); } render(); }
  $('addBtn').onclick = () => { const t = $('paste').value; if (!t.trim()) return; const rows = rowsFromText(t); $('paste').value = ''; return addRows(rows); };
  $('listInput').onchange = async e => { for (const f of e.target.files) { const p = await WIC.readFile(f); if (p && p.rows) await addRows(p.rows); } e.target.value = ''; };
  $('resetBtn').onclick = async () => { S.items = []; S.dup = 0; try { await db.clear(); } catch (e) {} render(); log('누적 초기화'); };
  const lines = () => { const head = ['분류', '공고번호', '공고명', '수요기관', '마감일', '기초금액', '하한가(추정)', '권장 입찰금액', '비고']; return [head, ...S.items.map(i => [i.cls, i.no, i.name, i.org, i.due, i.base, i.floor || '', i.bidv || i.bid, i.note])]; };
  $('csvBtn').onclick = () => { const q = v => '"' + str(v).replace(/"/g, '""') + '"'; const csv = '﻿' + lines().map(r => r.map(q).join(',')).join('\r\n'); WIC.download('입찰 공고 누적.csv', new Blob([csv], {type: 'text/csv;charset=utf-8'})); };
  $('copyBtn').onclick = async () => { try { await navigator.clipboard.writeText(lines().map(r => r.join('\t')).join('\n')); log('복사 완료'); toast('표를 복사했습니다'); } catch (e) { log('HOLD: 복사 권한 없음'); toast('복사 권한이 없습니다'); } };

  nload(); cload(); coload(); cfgLoad(); renderListStats(); renderEx(); loadSaved(); renderChk();
  /* 크롬 확장에서 넘어온 공고 화면 글자를 받아 자동 입력 (확장 프로그램 환경에서만 동작) */
  try { if (window.chrome && chrome.storage && chrome.storage.local && chrome.storage.local.get) chrome.storage.local.get('wic02_pending').then(r => { const p = r && r.wic02_pending; if (!p) return; chrome.storage.local.remove('wic02_pending'); try { const note = ingest('(공고 화면) ' + (p.title || p.url || ''), p.text || '', false); const k = applyEx(); renderEx(); renderChk(); toast(k ? '확장 프로그램에서 넘어온 공고 화면에서 ' + k + '칸을 자동 입력했습니다' : '넘어온 화면에서 읽은 값이 없습니다'); log('확장에서 수신: ' + note); } catch (e) { toast(e.message); } }); } catch (e) {}
  window.__BIDUI = {S, E, $, nget, cget, csave, buildInp, showTab, showCalc, renderChk0, toast, log, ls, ingest, applyEx, renderEx, syncBid, splitTax, rangeTxt, render, addRows, classify, esc, chkKey, checklistItems, AL, rowsFromText, toItem, norm, str, num, won, pct, svg, T, C, short, chartLine, EV_CASES, handleFiles};
  if (window.__BIDUI2 && window.__BIDUI2.init) window.__BIDUI2.init(window.__BIDUI);
  log('02 입찰 도구 v3 시작');
})();
