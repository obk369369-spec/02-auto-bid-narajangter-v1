/* 비밀값(API 키·토큰) 유출 스캔 — 소스·빌드 산출물·공개 저장소 작업본에 키 모양 문자열이 있는지 검사한다. 하나라도 발견되면 종료코드 1(푸시 금지).
   실행: node qa/secret_scan.js <검사할 폴더 또는 파일>...   (인자가 없으면 이 도구 폴더 전체)
   패턴은 코드로 조합해 만들어 이 파일 자신이 걸리지 않는다. */
'use strict';
const fs = require('fs'), path = require('path');
const R = (a, b) => new RegExp(a + b);
const PATTERNS = [
  ['Anthropic API 키 형태', R('sk-' + 'ant-', '[A-Za-z0-9_\\-]{16,}')], ['OpenAI 계열 키 형태', R('sk-', '[A-Za-z0-9]{32,}')], ['Google API 키 형태', R('AI' + 'za', '[0-9A-Za-z_\\-]{30,}')],
  ['AWS 액세스 키 형태', R('AK' + 'IA', '[0-9A-Z]{16}')], ['GitHub 토큰 형태', R('gh[pousr]' + '_', '[A-Za-z0-9]{30,}')], ['수출입은행 authkey 실값', R('authkey=', '(?!\\*\\*\\*\\*)(?!\\$\\{)(?!\' \\+)(?!"\\s*\\+)[A-Za-z0-9]{8,}')],
  ['개인 키 블록', R('-----BEGIN [A-Z ]*PRIVATE ', 'KEY-----')]
];
const SKIP_DIR = new Set(['node_modules', '.git', 'test_samples', 'public_out']); const SKIP_FILE = /secret_scan\.js$|[\/]lib[\/]|[\/]vendor[\/]|tesseract|pdf\.(min|worker)|xlsx|ocr_assets|\.(png|gz|wasm|bcmap|ico|zip)$/i; const EXT = /\.(js|mjs|cjs|html|json|md|txt|py|bat|ps1|yml|yaml)$/i;
function* walk(p) { const st = fs.statSync(p); if (st.isFile()) { yield p; return; } for (const f of fs.readdirSync(p)) { if (SKIP_DIR.has(f)) continue; yield* walk(path.join(p, f)); } }
const targets = process.argv.slice(2).length ? process.argv.slice(2) : [path.join(__dirname, '..')]; let files = 0, hits = [];
for (const t of targets) for (const f of walk(path.resolve(t))) {
  if (SKIP_FILE.test(f) || !EXT.test(f)) continue; const size = fs.statSync(f).size; if (size > 40 * 1024 * 1024) continue; const s = fs.readFileSync(f, 'utf8'); files++;
  for (const [name, re] of PATTERNS) { const m = re.exec(s); if (m) hits.push({file: f, name, sample: m[0].slice(0, 6) + '…(' + m[0].length + '자)'}); }
}
console.log('비밀값 스캔: ' + files + '개 파일 검사');
if (hits.length) { hits.forEach(h => console.log('발견 ' + h.name + ' · ' + h.file + ' · ' + h.sample)); console.log('결과 FAIL ' + hits.length + '건 — 푸시·배포 금지'); process.exit(1); }
console.log('결과 PASS 0건 (키 모양 문자열 없음)');
