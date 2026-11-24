/* 실제 네트워크 환율 조회 smoke (모의 없음) — file:/// 에서 브라우저가 실제로 환율 피드를 호출해 CORS·응답 형식이 통과하는지 확인. 통화 코드만 전송됨 */
'use strict';
const path = require('path'), {launch, sleep} = require('./cdp.js'); const url = 'file:///' + path.resolve(process.argv[2] || path.join(__dirname, '..', '02_bid.html')).replace(/\\/g, '/');
(async () => {
  const L = await launch(); const {page} = L;
  try {
    await page.goto('about:blank'); await page.goto(url); await page.eval(`localStorage.clear(); 1`); await page.goto(url); await sleep(500);
    await page.eval(`document.querySelector('[data-tab="2"]').click(); document.getElementById('c_cur').value='USD'; document.getElementById('fxBtn').click(); 1`); await sleep(6000);
    const v = await page.eval(`document.getElementById('c_fx').value`), info = await page.eval(`document.getElementById('fxInfo').innerText.replace(/\\s+/g,' ')`);
    console.log('LIVE c_fx =', v, '|', info.slice(0, 220)); console.log(Number(v) > 0 ? 'LIVE PASS' : 'LIVE FAIL(네트워크 환경 의존)'); process.exit(Number(v) > 0 ? 0 : 1);
  } finally { await L.close(); }
})();
