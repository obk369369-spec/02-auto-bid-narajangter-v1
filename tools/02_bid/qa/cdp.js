/* 의존성 없는 최소 CDP(Chrome DevTools Protocol) 클라이언트 — Edge/Chrome 헤드리스 제어. Node 22+ 의 전역 WebSocket 사용. */
'use strict';
const {spawn} = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const EDGE = [process.env.BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean).find(p => fs.existsSync(p));
const getJson = (url) => new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch(opts = {}) {
  if (!EDGE) throw new Error('Edge/Chrome 실행 파일을 찾지 못했습니다 (BROWSER_PATH 환경변수로 지정)');
  const port = opts.port || (9300 + Math.floor(Math.random() * 500)); const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'wicqa-'));
  const args = ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + ud, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--allow-file-access-from-files', '--disable-features=Translate', '--window-size=1400,1000'].concat(opts.args || []);
  const proc = spawn(EDGE, args, {stdio: 'ignore', windowsHide: true});
  let info = null; for (let i = 0; i < 60 && !info; i++) { try { info = await getJson(`http://127.0.0.1:${port}/json/version`); } catch (e) { await sleep(250); } }
  if (!info) { proc.kill(); throw new Error('브라우저 디버그 포트 연결 실패'); }
  const ws = new WebSocket(info.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(), handlers = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const {res, rej} = pend.get(d.id); pend.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else if (d.method) handlers.forEach(h => h(d)); };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, {res, rej}); ws.send(JSON.stringify({id: i, method, params, sessionId})); });
  const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await send('Target.attachToTarget', {targetId, flatten: true});
  const S = (m, p) => send(m, p, sessionId);
  await S('Page.enable'); await S('Runtime.enable'); await S('DOM.enable');
  const consoleErrors = []; handlers.push(d => { if (d.sessionId !== sessionId) return; if (d.method === 'Runtime.exceptionThrown') consoleErrors.push(d.params.exceptionDetails.exception ? (d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text) : d.params.exceptionDetails.text); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') consoleErrors.push(d.params.args.map(a => a.value || a.description).join(' ')); });
  const page = {
    consoleErrors,
    async goto(url) { const loaded = new Promise(r => { const h = d => { if (d.sessionId === sessionId && d.method === 'Page.loadEventFired') { handlers.splice(handlers.indexOf(h), 1); r(); } }; handlers.push(h); }); await S('Page.navigate', {url}); await Promise.race([loaded, sleep(60000)]); },
    async eval(expr) { const r = await S('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true, timeout: 120000}); if (r.exceptionDetails) throw new Error('eval 오류: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; },
    async setFiles(selector, files) { const {root} = await S('DOM.getDocument', {depth: 0}); const {nodeId} = await S('DOM.querySelector', {nodeId: root.nodeId, selector}); if (!nodeId) throw new Error('요소 없음: ' + selector); await S('DOM.setFileInputFiles', {files, nodeId}); },
    async dropFiles(x, y, files) { const data = {items: [], files, dragOperationsMask: 1}; await S('Input.dispatchDragEvent', {type: 'dragEnter', x, y, data}); await S('Input.dispatchDragEvent', {type: 'dragOver', x, y, data}); await S('Input.dispatchDragEvent', {type: 'drop', x, y, data}); },
    async screenshot(file) { const r = await S('Page.captureScreenshot', {format: 'png'}); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); },
    send: S, sleep
  };
  const close = async () => { try { ws.close(); } catch (e) {} try { proc.kill(); } catch (e) {} await sleep(300); try { fs.rmSync(ud, {recursive: true, force: true}); } catch (e) {} };
  return {page, close, send, edge: EDGE};
}
module.exports = {launch, sleep};
