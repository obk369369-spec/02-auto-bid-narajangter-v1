# 02 입찰 도구 — 사용·운영 설명서

## 파일 구성 (`I:\WIC_MASTER\02_실행도구_완성본\tools\02_bid\`)
| 파일/폴더 | 용도 |
|---|---|
| `02_bid.html` | 단일 HTML 도구 (더블클릭). 처음 OCR 이 필요하면 같은 폴더의 `02_bid_ocr_assets.js` 를 자동으로 불러옴 — **두 파일을 같이 보관** |
| `02_bid_이전본_20261119.html` | 개편 전 백업 (삭제 금지) |
| `v2/` | 소스: `engine.js`(계산·추출) · `ui.js` · `body.html` · `pdfjs_glue.js` · `ocr_glue.js` |
| `build_02_bid_v2.js` | `node build_02_bid_v2.js` → `02_bid.html` + `02_bid_ocr_assets.js` 생성 |
| `chrome_extension/` | 크롬/엣지 확장 프로그램 (압축해제 폴더). `build_extension.js` 로 생성 |
| `test_samples/` | 실전 시험 자료 (`recent/` 방금 받은 공고, `zip/` 입찰.zip 에서 계정·세무·인증서·개인증빙 제외 165건 + `_source_map.json`) |
| `qa/` | 자동 시험·상시 검증 데몬 |
| `../../vendor/pdfjs`, `../../vendor/tesseract` | pdf.js 3.11.174 · tesseract.js 5.1.1(+한국어/영어 데이터) — 공식 패키지 sha512 무결성 대조 완료(`PROVENANCE.txt`) |

## 사용법
1. **단일 HTML**: `02_bid.html` 을 열고 공고문(PDF·HWP·HWPX·DOCX·DOC·엑셀·텍스트·이미지)을 상자에 끌어다 놓으면 기초금액·낙찰하한율·예가범위(비대칭 포함)·입찰마감/개찰일시·면세/과세·정가·환율·수량·품목이 자동 입력됩니다. 못 찾은 값은 "확인 필요"(추측 금지). 스캔·사진은 OCR(장당 3~10초)로 읽으며 **OCR 값은 항상 "낮음 · 확인 필요"** — 원본과 대조하세요.
2. **크롬 확장**: `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드합니다" → `chrome_extension` 폴더 선택. 나라장터(g2b.go.kr)·KISTI(kisti.re.kr)·국방전자조달(d2b.go.kr) 공고 화면을 열면 오른쪽 아래에 분석 패널(하한가·권장 투찰가 복사)이 뜨고, [도구에서 열기]로 전체 도구가 열립니다. 다른 사이트는 확장 아이콘을 누르면 그 화면을 분석합니다. 모든 계산은 PC 안에서만 이뤄집니다.

## 상시 검증 데몬
* 시작: `node qa/start_daemon.js` (또는 `qa/start_daemon.bat` 더블클릭 — **재부팅하면 다시 시작 필요**, 작업 스케줄러에는 등록하지 않음)
* 상태: `qa/daemon_status.json` · 로그: `qa/daemon.log` · 중지: `qa/STOP.flag` 파일 생성 · 일시정지: `qa/PAUSE.flag`
* 매 주기: 변경 감지(또는 30분 주기) → 빌드 → 엔진 단위시험 → .xls 재열기시험 → 확장 빌드·Edge E2E → 실전 샘플 전수(드롭) → OCR 전수 → 상태 기록. 오류는 백오프 후 재시도. 3회 연속 100% → `qa/COMPLETE.flag` 기록 후 감시 모드 계속.
* 데몬은 코드를 스스로 고치지 않습니다. 새 샘플을 `test_samples/` 에 넣으면 정답표(`qa/expected.json`)에 없는 파일이 **UNJUDGED** 로 잡힙니다 → `node qa/run_samples.js --dump` 로 읽은 글자(`qa/out/`)를 확인해 파서를 고치고 정답표를 확정(`qa/finalize_expected.js` 패턴)하면 데몬이 즉시 재검증합니다.

## 시험 종류
* `node v2/engine_test.js` — 엔진(장부 값·학습자료 예제·추출·HWP/PDF) · `node v2/xls_reopen_test.js` — .xls BIFF8 재열기
* `node qa/run_samples.js` — 샘플 전수 드롭 시험(OCR 끔) · `--ocr` — OCR 켬(`expected_ocr.json`)
* `node qa/test_extension.js` — 확장 프로그램 Edge E2E (먼저 `node build_extension.js --test`)

## 판정 용어
PASS=원본 대조로 확정한 기대값과 일치 · HOLD_OK=글자 없는 문서에서 "읽지 못함" 안내가 정확히 나옴 · SNAP_OK=OCR 추출 스냅샷이 그대로임(**미검증, 정확도 보증 아님**) · FAIL/UNJUDGED=미통과

## v3.3 범용 전략 · 환율 · AI (2026-11-24)
* **② 투찰가 계산 탭 → "상황 진단 · 투찰 구간"**: 기관 유형 · 낙찰방식 · 사전 영업/독점성 · 과세/계약 · 실제 원가 vs 대외 안내 5가지를 조합해 진단합니다.
  * 숫자는 **① 실측 기록 ② 공고 규칙 ③ 사용자 입력** 에서만 나오고, 모든 선·구간·후보·표 줄에 **출처 라벨**(공고 규칙 기반 / 실측 데이터 기반 / 사용자 입력 조건 기반 / 사용자 가정 / 기본 평가표 / AI 제안)이 붙습니다.
  * 하한율이 없는 최저가처럼 근거가 모자라면 **낙찰 구간을 만들지 않고** "산출 불가"로 표시하며, 목표 마진율 · 예상 경쟁 할인율 슬라이더와 시뮬레이션 표(투찰률 간격 조절)로 직접 비교합니다.
  * 실제 원가·커미션·순이익은 **내부용** — 출력 서류(.xls/.doc) 생성 직전 검사에서 발견되면 내려받기를 차단하고, 입찰장부 1행은 원가·디스카운트 칸을 비웁니다.
* **[실시간 환율 불러오기]**: 키 없는 공개 피드(open.er-api.com → frankfurter.app)를 기본으로, 한국수출입은행 인증키를 넣으면 고시환율을 먼저 조회합니다. 출처·기준 시각을 환율 칸 아래에 표시하며 오프라인·실패 시 수동 입력이 그대로 유지됩니다(직접 입력한 값은 자동 조회가 덮어쓰지 않음). 시장 환율(중간값)이며 은행 고시환율이 아닙니다. 하나은행·관세청은 공개 API 규격 미확인으로 연결하지 않았습니다(HOLD).
* **[AI 심층 입찰 전략 분석]**: 설정에서 본인의 Claude 또는 Gemini API 키를 입력하면 공고문 원문 + 기관 특성 + (선택) 실제 원가·대외 안내를 직접 보내 ① 숨은 리스크·참가자격 ② 경쟁 강도 ③ 시나리오별 전략을 구조화해 보여 줍니다. AI 의 숫자는 "근거 데이터 아님"으로 표시하고, AI 가 제안한 투찰률은 도구가 다시 계산하며, 인용 문구는 원문과 대조합니다. **키는 이 브라우저 localStorage 에만 저장**되고 저장소·서류·URL·화면 결과에는 들어가지 않습니다. 실제 제공사 서버·실제 키 호출은 시험하지 못했습니다(모의 응답으로 요청 형식 검증 — HOLD).
* 시험: `node v2/strategy_test.js` · `node qa/e2e_strategy.js` · `node qa/e2e_features.js` · `node qa/live_fx.js`(실제 환율 피드 smoke) · `node qa/secret_scan.js <폴더>`(키 모양 문자열 스캔 — 푸시 전 필수)
