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
