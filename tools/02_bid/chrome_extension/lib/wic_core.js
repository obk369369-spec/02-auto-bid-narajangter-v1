/* WIC common core (inline, no network). DATA is injected by scripts/build_tool.py from tool13_v2/*.json */
(function(g){
  'use strict';
  const D = {"publishers":[{"name":"Allied Market Research","tokens":["alliedmarketresearch"],"wordTokens":[]},{"name":"AnalystView Market Insights","tokens":["analystview"],"wordTokens":[]},{"name":"Barnes Reports","tokens":["barnes"],"wordTokens":[]},{"name":"BCC Research","tokens":["bccresearch"],"wordTokens":[]},{"name":"BIS Research","tokens":["bisresearch"],"wordTokens":[]},{"name":"Bizwit Research & Consulting LLP","tokens":["bizwit"],"wordTokens":[]},{"name":"Coherent Market Insights","tokens":["coherentmarketinsights"],"wordTokens":["wmr"],"aliases":["WMR"]},{"name":"DataM Intelligence","tokens":["datamintelligence"],"wordTokens":[]},{"name":"GlobalData","tokens":["globaldata"],"wordTokens":[]},{"name":"Global Info Research","tokens":["globalinforesearch"],"wordTokens":["gir"],"aliases":["GIR","GIR (Global Info Research)"]},{"name":"Grand View Research","tokens":["grandviewresearch","grandviewresarch"],"wordTokens":["gvr"],"aliases":["Grand View Research Inc."]},{"name":"HNY Research","tokens":["hnyresearch"],"wordTokens":[]},{"name":"Introspective Market Research","tokens":["introspectivemarketresearch","imrreports"],"wordTokens":[]},{"name":"LP Information","tokens":["lpinformation"],"wordTokens":["lpi"],"aliases":["LPI","LPI(LP Information)","LP Information"]},{"name":"Lucintel","tokens":["lucintel"],"wordTokens":[],"aliases":["Lucintel"]},{"name":"Maia Research","tokens":["maiaresearch"],"wordTokens":[],"aliases":["Maia Research"]},{"name":"Market Monitor Global","tokens":["marketmonitorglobal"],"wordTokens":[]},{"name":"Market Research Future","tokens":["marketresearchfuture"],"wordTokens":["mrfr"],"aliases":["MRFR"]},{"name":"MarketsandMarkets","tokens":["marketsandmarkets"],"wordTokens":[],"aliases":["Markets and Markets"]},{"name":"Multi Market Insight","tokens":["multimarketinsight"],"wordTokens":[],"aliases":["Multimarket Insight"]},{"name":"Next Move Strategy Consulting","tokens":["nextmovestrategy"],"wordTokens":["nmsc"]},{"name":"Prescient & Strategic Intelligence","tokens":["prescientstrategic","prescientandstrategic"],"wordTokens":[]},{"name":"Prodture","tokens":["prodture"],"wordTokens":[]},{"name":"Prof Research","tokens":["profresearch"],"wordTokens":["prof"]},{"name":"QYResearch","tokens":["qyresearch"],"wordTokens":[]},{"name":"The Insight Partners","tokens":["theinsightpartners","insightpartners"],"wordTokens":["tip"]},{"name":"Transparency Market Research","tokens":["transparencymarketresearch"],"wordTokens":["tmr"]},{"name":"UnivDatos","tokens":["univdatos"],"wordTokens":["umi"]},{"name":"99Strategy","tokens":["99strategy"],"wordTokens":[]},{"name":"BuddeComm","tokens":["buddecomm"],"wordTokens":[],"aliases":["Budde Comm","BuddeComm"]},{"name":"Global Markets Direct","tokens":["globalmarketsdirect"],"wordTokens":[],"aliases":["Global Markets Direct"]},{"name":"M14 Intelligence Research","tokens":["m14intelligence"],"wordTokens":["m14"]},{"name":"Materials Research Foundation","tokens":["materialsresearchfoundation"],"wordTokens":["mrf"],"aliases":["Materials Research Foundation"]},{"name":"DEStech","tokens":["destech"],"wordTokens":[],"aliases":["DEStech"]},{"name":"Wiley","tokens":["wiley"],"wordTokens":[],"aliases":["Wiley"]},{"name":"ChemTec Publishing","tokens":["chemtec"],"wordTokens":[],"aliases":["ChemTec Publishing"]},{"name":"Elsevier","tokens":["elsevier"],"wordTokens":[],"aliases":["Elsevier Science","Academic Press","Woodhead Publishing","Morgan Kaufmann","Butterworth-Heinemann","Syngress","Newnes","North Holland","Gulf Professional Publishing","Chandos Publishing","William Andrew","Academic Cell"]}],"aliases":{"advanced interior materials":"신소재/복합재료","agrochemicals fertilizers":"바이오산업","alcohol tobacco":"무역","animal feed and feed additives":"식품/음료","animal health":"신약 산업/제약","automotive transportation":"자동차/우주항공","beauty personal care":"신약 산업/제약","biotechnology":"바이오산업","clinical diagnostics":"메디칼 디바이스","clothing footwear accessories":"무역","communication services":"정보통신","communications infrastructure":"정보통신","consumer f b":"식품/음료","conventional energy":"에너지","digital media":"정보통신","disinfectants preservatives":"화학/정밀화학","distribution utilities":"에너지","drilling extraction equipments":"에너지","electronic devices":"반도체/전자부품","electronic electrical":"반도체/전자부품","food additives nutricosmetics":"식품/음료","green building materials":"토목/건축","healthcare it":"정보통신","homecare decor":"토목/건축","homecare décor":"토목/건축","hvac construction":"토목/건축","it services applications":"정보통신","medical devices":"메디칼 디바이스","next generation technologies":"정보통신","nutraceuticals functional foods":"식품/음료","organic chemicals":"화학/정밀화학","paints coatings printing inks":"신소재/복합재료","petrochemicals":"신소재/복합재료","pharmaceuticals":"신약 산업/제약","plastics polymers resins":"신소재/복합재료","power generation storage":"에너지","renewable chemicals":"화학/정밀화학","renewable energy":"에너지","semiconductors":"반도체/전자부품","sensors controls":"반도체/전자부품","smart textiles":"신소재/복합재료","specialty glass ceramic fiber":"신소재/복합재료","specialty polymers":"신소재/복합재료","water sludge treatment":"환경","automotive and transportation":"자동차/우주항공","telecom and it":"정보통신","chemicals":"화학/정밀화학","semiconductor and electronics":"반도체/전자부품","aerospace defence":"자동차/우주항공","aerospace and defence":"자동차/우주항공","energy power":"에너지","energy and power":"에너지","food beverages":"식품/음료","food and beverages":"식품/음료","agriculture industry":"농업","building construction":"토목/건축","building and construction":"토목/건축"},"hold":["mining minerals and metals","analytical and scientific instrumentation","packaging"],"official":["반도체/전자부품","신소재/복합재료","화학/정밀화학","환경","에너지","자동차/우주항공","바이오산업","신약 산업/제약","메디칼 디바이스","정보통신","전자기기/서비스","융합산업","토목/건축","식품/음료","산업용 기계","무역","농업","화장품"]};
  const WIC = g.WIC = {version:'1', data:D};
  const str = v => v == null ? '' : String(v).trim();
  const norm = v => str(v).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const compact = v => str(v).toLowerCase().replace(/[^a-z0-9]+/g,'');
  const stripAnd = t => norm(t).split(' ').filter(w => w && w !== 'and').join(' ');
  WIC.str = str; WIC.norm = norm;
  WIC.HEADERS18 = ['발행사','상품명','한글명','1차카테고리','2차카테고리','3차카테고리','페이지수','개요','목차','발행일','파일명','판매유형','환(u,e,g,j)','HardCapy가격','PDF가격','저자','체제','ISBN/CODE'];
  WIC.OFFICIAL = D.official || [];
  const LOOK = {}; Object.entries(D.aliases || {}).forEach(([k,v]) => { LOOK[stripAnd(k)] = v; });
  const HOLD = (D.hold || []).map(stripAnd);
  // ---- 발행사 감지 (파일명 토큰 → 열 값 별칭). 모호하면 null
  WIC.detectPublisher = function(fileName, columnValue){
    const lower = str(fileName).toLowerCase(), cmp = compact(lower), words = lower.split(/[^a-z0-9]+/).filter(Boolean);
    let hits = (D.publishers || []).filter(p => (p.tokens||[]).some(t => cmp.includes(t)) || (p.wordTokens||[]).some(t => words.includes(t)));
    if (!hits.length && columnValue){
      const c = compact(columnValue);
      hits = (D.publishers || []).filter(p => [p.name].concat(p.aliases||[]).some(n => compact(n) === c));
    }
    return hits.length === 1 ? hits[0].name : null;
  };
  // ---- 카테고리: 확정 별칭 → 공식명 그대로 → null(HOLD)
  WIC.category = function(raw){
    const k = stripAnd(raw); if (!k) return {name:'', status:'EMPTY'};
    if (HOLD.includes(k)) return {name:'', status:'HOLD'};
    if (LOOK[k]) return {name:LOOK[k], status:'ALIAS'};
    const off = WIC.OFFICIAL.find(n => stripAnd(n) === k); if (off) return {name:off, status:'OFFICIAL'};
    return {name:'', status:'UNMAPPED'};
  };
  // ---- 번역 원장 (원장에 없으면 '' → HOLD)
  WIC.translate = function(title){ const t = (D.ledger || {})[norm(title)]; return t || ''; };
  // ---- 날짜 (MKT-06/07): 빈값→빈값, 연도/코드값 비변환, 모호 d/m 비변환
  WIC.normDate = function(v){
    const raw = str(v); if (raw === '') return '';
    const pad = n => String(n).padStart(2,'0');
    const ymd = (y,m,d) => (m>=1&&m<=12&&d>=1&&d<=31) ? `${y}-${pad(m)}-${pad(d)}` : raw;
    if (/^\d+(\.\d+)?$/.test(raw)){
      const n = Number(raw); if (n < 20000 || n > 80000) return raw;
      const e = new Date(Date.UTC(1899,11,30)); e.setUTCDate(e.getUTCDate() + Math.floor(n));
      return `${e.getUTCFullYear()}-${pad(e.getUTCMonth()+1)}-${pad(e.getUTCDate())}`;
    }
    let m = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T].*)?$/); if (m) return ymd(m[1], +m[2], +m[3]);
    m = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (m){ const a = +m[1], b = +m[2]; if (a>12 && b<=12) return ymd(m[3], b, a); if (b>12 && a<=12) return ymd(m[3], a, b); return raw; }
    return raw;
  };
  WIC.isIsoDate = v => { const t = str(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false; const d = new Date(t + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t; };   // 형식 + 실제 달력 날짜(2026-13-40, 2026-02-30 거부)
  // ---- 헤더 별칭
  const AL = {
    publisher:['발행사','Publisher','Published by','Publisher Name','Company Name'],
    title_en:['한글명','Report Title','Title','Product Title','Product Name','Report Name','bookTitle'],
    title_ko:['상품명'],
    date:['발행일','Date Published','Publish Date','Published Date','Publication Date','Release Date','Publishing Date','publish_date','PublicationDate','Pub Date','Date'],
    pages:['No.of Pages','No. of Pages','No of Pages','Number of Pages','Pages','no_of_pages','No_Pages','No Pages','Page No','numberPages','페이지수'],
    pagesLabel:['체제'],
    overview:['개요','Report Description','Summary','Description','Abstract','Abstact','Snapshot','Report Descriptions','Scope of the Report'],
    toc:['목차','Table of Contents','Table of Content','table_of_content','Contents','TOC'],
    category:['2차카테고리','3차카테고리','Report Category','Category','category','Category Name','Main Category','Industry'],
    pdfPrice:['PDF가격','Single user Price in US$','Single User Price','Single User License','price_sul','Price SUL','Price_SUL','Signal User','Individual Price'],
    link:['링크','Report Link','Link','URL','Product Page URL','Report URL'],
    fileName:['파일명','File Name','Ffile Name','filename'],
    code:['Report Code','Report ID','Product Code']
  };
  WIC.ALIASES = AL;
  WIC.pick = function(row, field){
    const keys = Object.keys(row);
    for (const a of AL[field] || []){ const k = keys.find(h => norm(h) === norm(a)); if (k !== undefined && str(row[k]) !== '') return {value:row[k], header:k}; }
    for (const a of AL[field] || []){ if (norm(a).length < 4) continue; const k = keys.find(h => { const x = norm(h), y = norm(a); return x.includes(y) || y.includes(x); }); if (k !== undefined && str(row[k]) !== '') return {value:row[k], header:k}; }
    return {value:'', header:''};
  };
  // ---- 워크북 읽기 (SheetJS 인라인 필요)
  WIC.findHeaderRow = function(rows, hints){
    if (hints && hints.length){   // 도구가 예상 헤더 이름을 알려 주면, 그 이름과 가장 많이 일치하는 첫 행을 헤더로 (데이터 행의 일반 단어 오인 방지)
      const H = new Set(hints.map(norm)); let bi = -1, bn = 1;
      for (let i = 0; i < Math.min(rows.length, 40); i++){ const n = (rows[i] || []).filter(c => H.has(norm(c))).length; if (n > bn){ bn = n; bi = i; } }
      if (bi >= 0) return bi;
    }
    const strong = ['title','reporttitle','pages','publisheddate','datepublished','publishdate','summary','tableofcontents','description','category','한글명','상품명','발행사','공고','기관','고객'];
    let best = -1, bestScore = -1e9;
    for (let i = 0; i < Math.min(rows.length, 40); i++){
      const cells = (rows[i] || []).map(str).filter(Boolean); if (cells.length < 3) continue;
      let sc = 0; cells.forEach(c => { if (c.length <= 40) sc++; else sc -= 3; if (strong.some(t => norm(c).replace(/ /g,'').includes(t))) sc += 4; });
      if (sc > bestScore){ bestScore = sc; best = i; }
    }
    return best;
  };
  WIC.parseRows = function(rows2d, fileName, hints){
    const hi = WIC.findHeaderRow(rows2d, hints); if (hi < 0) return {headers:[], rows:[]};
    const headers = (rows2d[hi] || []).map(str); const out = [];
    for (let i = hi + 1; i < rows2d.length; i++){
      const arr = rows2d[i] || []; if (arr.every(v => str(v) === '')) continue;
      const o = {origin_file:fileName, origin_row:i + 1}; headers.forEach((h,j) => { if (h) o[h] = arr[j]; }); out.push(o);
    }
    return {headers, rows:out};
  };
  WIC._readFile0 = async function(file, hints){
    const ext = file.name.split('.').pop().toLowerCase(); let rows2d;
    if (ext === 'csv' || ext === 'tsv' || ext === 'txt'){
      const text = await file.text(); const sep = ext === 'tsv' || (text.split('\n')[0].split('\t').length > text.split('\n')[0].split(',').length) ? '\t' : ',';
      rows2d = WIC.csv(text, sep);
    } else { const wb = XLSX.read(await file.arrayBuffer(), {type:'array'}); rows2d = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, defval:'', raw:true}); }
    return WIC.parseRows(rows2d, file.name, hints);
  };
  // 공통 파일 읽기 보호막: 빈 파일·깨진 파일·행이 없는 파일은 예외로 죽지 않고 화면 상단에 이유를 알려 준다(ENTERPRISE_DEV_STANDARD §2)
  WIC.notice = function(msg){ try { let b = document.getElementById('wic-notice'); if (!b){ b = document.createElement('div'); b.id = 'wic-notice'; b.setAttribute('role', 'alert'); b.style.cssText = 'position:fixed;left:50%;top:48px;transform:translateX(-50%);z-index:100001;max-width:720px;background:#fef3c7;color:#92400e;border:1px solid #f59e0b;border-radius:10px;padding:10px 16px;font:13px/1.5 "Malgun Gothic",Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)'; document.body.appendChild(b); } b.textContent = msg; b.style.display = 'block'; clearTimeout(WIC.__nt); WIC.__nt = setTimeout(function(){ b.style.display = 'none'; }, 9000); } catch (e) {} };
  WIC.readFile = async function(file, hints){
    const nm = file && file.name ? file.name : '(이름 없음)';
    if (!file || file.size === 0){ WIC.notice('빈 파일입니다: ' + nm + ' — 내용이 들어 있는 엑셀(.xlsx/.xls)·CSV 파일을 올려 주세요'); return { rows: [], issues: ['빈 파일'], headers: [] }; }
    try { const r = await WIC._readFile0(file, hints); if (!r || !r.rows || !r.rows.length) WIC.notice('읽을 수 있는 행이 없습니다: ' + nm + ' — 첫 줄이 헤더인 표 형식 파일인지 확인해 주세요'); return r; }
    catch (e) { WIC.notice('파일을 읽지 못했습니다: ' + nm + ' — 지원하지 않는 형식이거나 깨진 파일입니다(엑셀 .xlsx/.xls, CSV 만 가능). ' + (e && e.message ? '[' + String(e.message).slice(0, 60) + ']' : '')); return { rows: [], issues: ['읽기 실패'], headers: [] }; }
  };
  WIC.csv = function(text, sep){
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++){ const c = text[i];
      if (q){ if (c === '"'){ if (text[i+1] === '"'){ cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true; else if (c === sep){ row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r'){ if (c === '\r' && text[i+1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c; }
    if (cur !== '' || row.length){ row.push(cur); rows.push(row); } return rows;
  };
  // ---- 공통 보조
  WIC.esc = s => str(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  WIC.hash = text => { let x = 5381; for (let i = 0; i < text.length; i++) x = ((x << 5) + x + text.charCodeAt(i)) | 0; return (x >>> 0).toString(16); };
  WIC.download = function(name, blob){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  // IndexedDB key-value + read-back (저장 성공은 read-back 이후에만 인정)
  WIC.store = function(dbName){
    const open = () => new Promise((res, rej) => { const r = indexedDB.open(dbName, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv', mode); const out = fn(t.objectStore('kv')); t.oncomplete = () => { db.close(); res(out && out.result); }; t.onerror = () => { db.close(); rej(t.error); }; t.onabort = () => { db.close(); rej(t.error || new Error('abort')); }; }); };
    return {
      get: k => tx('readonly', s => s.get(k)),
      set: (k, v) => tx('readwrite', s => s.put(v, k)),
      async setVerified(k, v){ if (g.__WIC_FAIL_STORE) throw new Error('STORE_FAIL_INJECTED'); await this.set(k, v); const back = await this.get(k); if (JSON.stringify(back) !== JSON.stringify(v)) throw new Error('READBACK_MISMATCH'); return true; },
      clear: () => tx('readwrite', s => s.clear())
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);

