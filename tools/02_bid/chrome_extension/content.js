/* 02 입찰 도구 — 공고 화면 분석 패널 (콘텐츠 스크립트). engine.js(BIDENG) 가 먼저 로드되어 있어야 한다. 모든 계산은 이 화면 안에서만 이뤄지고 외부로 전송하지 않는다. */
(() => {
  'use strict';
  if (window.__wic02_loaded) return; window.__wic02_loaded = true;
  const E = window.BIDENG; if (!E) return;
  const isTop = window === window.top, HOSTID = 'wic02-panel-host';
  const KEYS = ['base', 'floor', 'no', 'est', 'budget', 'due', 'name'];
  const won = E.won, esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  let best = null, dismissed = false;
  try { dismissed = sessionStorage.getItem('wic02_dismissed') === '1'; } catch (e) {}
  const pageText = () => { try { return (document.body ? document.body.innerText : '').slice(0, 300000); } catch (e) { return ''; } };
  function analyze() { const text = pageText(); if (text.replace(/\s/g, '').length < 30) return null; const ex = E.extractFields(text); const plain = {}; Object.entries(ex).forEach(([k, v]) => plain[k] = {value: v.value, label: v.label, conf: v.conf, evidence: v.evidence}); return {ex: plain, hit: KEYS.filter(k => ex[k]).length, text, url: location.href, title: document.title}; }
  /* 기초금액 기준: 추정가격과의 비율(×1.1 → 부가세 포함 그대로 / ×1 → 부가세 제외) · 없으면 문구 — ui.js 와 같은 규칙 */
  function compute(ex) {
    const baseV = ex.base ? ex.base.value : (ex.est ? ex.est.value : (ex.budget ? ex.budget.value : null)), floor = ex.floor ? ex.floor.value : null; if (!baseV || !floor) return null;
    let basis = 'asis'; if (!ex.base && ex.est) basis = 'excl'; if (ex.base && ex.est && Number(ex.est.value) > 0) { const r = Number(ex.base.value) / Number(ex.est.value); if (Math.abs(r - 1) < 0.006) basis = 'excl'; }
    const inp = {est: baseV, floor, basis, range: ex.range ? ex.range.value : '', rangeLo: ex.rangeLo ? ex.rangeLo.value : '', rangeHi: ex.rangeHi ? ex.rangeHi.value : '', taxmode: ex.taxmode ? ex.taxmode.value : '', vat: '10'};
    const o = E.calc(inp); if (!o.ok) return null; return {o, recs: E.recommend(o, null), rangeAssumed: !(ex.range || ex.rangeLo)};
  }
  const CSS = ':host{all:initial}.box{position:fixed;right:16px;bottom:16px;width:360px;max-height:80vh;overflow:auto;z-index:2147483647;background:#fff;color:#111827;border:1px solid #cbd5e1;border-radius:14px;box-shadow:0 8px 30px rgba(15,23,42,.25);font:13px/1.55 "Malgun Gothic",Arial,sans-serif}.hd{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#0f172a;color:#fff;border-radius:14px 14px 0 0}.hd b{flex:1;font-size:14px}.hd button{background:#334155;color:#fff;border:0;border-radius:8px;padding:3px 9px;cursor:pointer;font:inherit}.bd{padding:12px 14px}.row{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px dashed #e5e7eb}.row span:first-child{color:#64748b;white-space:nowrap}.row span:last-child{text-align:right;font-weight:600;word-break:break-all}.miss{color:#b45309}.sec{margin:10px 0 4px;font-weight:700;color:#1e3a8a}.rec{display:flex;align-items:center;gap:8px;padding:5px 0}.rec .n{flex:1}.rec button{border:1px solid #93c5fd;background:#eff6ff;color:#1d4ed8;border-radius:8px;padding:2px 9px;cursor:pointer;font:inherit}.act{display:flex;gap:8px;margin-top:12px}.act button{flex:1;padding:8px;border-radius:9px;border:1px solid #2563eb;background:#2563eb;color:#fff;cursor:pointer;font:inherit}.act button.g{background:#fff;color:#2563eb}.note{margin-top:8px;font-size:11.5px;color:#64748b}.collapsed .bd{display:none}';
  function host() { let h = document.getElementById(HOSTID); if (!h) { h = document.createElement('div'); h.id = HOSTID; (document.documentElement || document.body).appendChild(h); h.attachShadow({mode: 'open'}); } return h; }
  function copy(text, btn) { const done = () => { const t = btn.textContent; btn.textContent = '복사됨'; setTimeout(() => btn.textContent = t, 1200); }; try { navigator.clipboard.writeText(String(text)).then(done, () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }); } catch (e) {} }
  function render(data, forced) {
    if (dismissed && !forced) return; const h = host(), root = h.shadowRoot; const ex = data ? data.ex : {};
    const F = (label, key, fmt) => { const v = ex[key]; return `<div class="row"><span>${label}</span><span class="${v ? '' : 'miss'}">${v ? esc(fmt ? fmt(v.value) : v.value) : '확인 필요'}</span></div>`; };
    const c = data ? compute(ex) : null; let rows = '';
    rows += F('공고번호', 'no') + F('공고명', 'name') + F('수요기관', 'org') + F('입찰마감', 'due') + F('개찰일시', 'open') + F('기초금액', 'base', v => won(Number(v)) + '원') + (ex.est ? F('추정가격', 'est', v => won(Number(v)) + '원') : '') + (!ex.base && ex.budget ? F('추정예산', 'budget', v => won(Number(v)) + '원') : '') + F('낙찰하한율', 'floor', v => v + '%') + F('예가범위', ex.rangeLo ? 'rangeLo' : 'range', v => ex.rangeLo ? `−${ex.rangeLo.value}% ~ +${ex.rangeHi ? ex.rangeHi.value : '?'}%` : '±' + v + '%') + F('면세/과세', 'taxmode', v => v === 'free' ? '면세' : '과세');
    let calc = '';
    if (c) { const o = c.o; calc = `<div class="sec">계산 (사정율 0% 기준)</div><div class="row"><span>낙찰하한가</span><span>${won(o.floorLimit)}원</span></div><div class="row"><span>하한가 변동 구간</span><span>${won(o.floorMin)} ~ ${won(o.floorMax)}원</span></div><div class="sec">권장 투찰가 (과거 장부 패턴)</div>` + c.recs.map(r => `<div class="rec"><span class="n"><b>${r.id}</b> ${esc(r.name)}<br><span style="color:#64748b">${won(r.bid)}원 · ${r.rate.toFixed(3)}%</span></span><button data-copy="${r.bid}">복사</button></div>`).join('') + (c.rangeAssumed ? '<div class="note">⚠ 예가범위를 찾지 못해 ±2%로 가정했습니다 — 공고문 확인 필요</div>' : ''); }
    else if (data) calc = '<div class="note">기초금액·낙찰하한율을 모두 읽어야 하한가를 계산합니다. 못 찾은 값은 추측하지 않습니다.</div>';
    else calc = '<div class="note">이 화면에서 읽은 공고 숫자가 없습니다.</div>';
    root.innerHTML = `<style>${CSS}</style><div class="box"><div class="hd"><b>02 입찰 도구</b><button id="tg" title="접기/펼치기">▾</button><button id="x" title="이 탭에서 닫기">✕</button></div><div class="bd">${rows}${calc}<div class="act"><button id="open">도구에서 열기</button><button class="g" id="rescan">다시 읽기</button></div><div class="note">계산은 이 화면 안에서만 이뤄지며 외부로 전송되지 않습니다. 낙찰을 보장하지 않습니다.</div></div></div>`;
    root.getElementById('x').onclick = () => { dismissed = true; try { sessionStorage.setItem('wic02_dismissed', '1'); } catch (e) {} h.remove(); };
    root.getElementById('tg').onclick = () => root.querySelector('.box').classList.toggle('collapsed');
    root.getElementById('rescan').onclick = () => scan(true);
    root.getElementById('open').onclick = () => chrome.runtime.sendMessage({type: 'wic02_open', payload: {text: data ? data.text : pageText(), url: location.href, title: document.title, ts: Date.now()}});
    root.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy, b));
  }
  function show(data, forced) { if (!best || (data && data.hit >= best.hit) || forced) best = data || best; render(best, forced); }
  function scan(forced) {
    const d = analyze(); if (forced) { dismissed = false; try { sessionStorage.removeItem('wic02_dismissed'); } catch (e) {} }
    if (!d) { if (isTop && forced) show(null, true); return; }
    if (d.hit >= 2 || forced) { if (isTop) show(d, forced); else try { chrome.runtime.sendMessage({type: 'wic02_found', data: {ex: d.ex, hit: d.hit, text: d.text, url: d.url, title: d.title}}); } catch (e) {} }
  }
  chrome.runtime.onMessage.addListener(msg => { if (!msg) return; if (msg.type === 'wic02_scan') scan(true); else if (msg.type === 'wic02_show' && isTop) show(msg.data, false); });
  let timer = null; const later = () => { clearTimeout(timer); timer = setTimeout(() => scan(false), 1800); };
  scan(false); try { new MutationObserver(later).observe(document.documentElement, {childList: true, subtree: true, characterData: true}); } catch (e) {}
})();
