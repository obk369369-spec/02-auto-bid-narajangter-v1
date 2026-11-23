# TOOL002 통합 검증 증거 — 2026-11-23

모두 헤드리스 Edge(CDP)로 실제 파일을 열어 실행한 결과이며, 기대값과 실제값을 비교한 판정이다.

| 시험 | 대상 | 결과(기대 vs 실제) |
|---|---|---|
| 엔진 단위(`v2/engine_test.js`) | 추출·계산·권장안 | PASS 25 / FAIL 0 (공개판. 비공개 장부 대조 7건은 제외됨) |
| 가격 엔진(`v2/pricing_test.js`) | 최저가·적격심사·협상·부가세·사정율 역산 | PASS 42 / FAIL 0 |
| 운영 모듈(`v2/ops_test.js`) | 4분류·변경 감지·6단계 서류·자동 검사 | PASS 33 / FAIL 0 |
| 어댑터(`adapters/test_adapters.js`) | G2B 요청 생성·응답 정규화·범용 표 | PASS 19 / FAIL 0 (G2B 실호출은 HOLD) |
| 원격 단위(`tests/institution-accumulator.test.mjs`) | 기관 누적·중복 제거 | PASS 1(3건) / FAIL 0 |
| 통합 E2E(`qa/e2e_integration.js`) | 024호 최저가 · 하한율 PDF 드롭 · OCR 첨부 · 기관 누적 · 서류 생성 · 자동 검사 · 사정율 역산 | **PASS 58 / FAIL 0** (공개판 빌드로 재실행) |
| 샘플 전수(`qa/run_samples.js`) | 입찰.zip 파생 164건 | PASS 101 · HOLD_OK 63 · FAIL 0 (공개판 빌드로 재실행). HOLD_OK = 공고문에 값이 없어 비워 두는 것이 정답인 건 |
| 확장 프로그램 E2E(`qa/test_extension.js`) | MV3 로드·콘텐츠 스크립트·앱 페이지 드롭·OCR | PASS 19 / FAIL 0 |

## 이번 검증 중 찾아 고친 결함
* 확장 앱 페이지 스크립트 목록에 `pricing/ops/ui2` 가 빠져 `E.pricing` 이 정의되지 않았다(확장 시험 5건 FAIL). 목록을 고친 뒤 19/0.

## 검증하지 못한 것 (HOLD)
* 최종 빌드에서 OCR 포함 전수 시험은 다시 돌리지 않았다(이전 빌드 결과: PASS 106 · SNAP 55 · HOLD 2 · 스냅샷은 원본 대조 전).
* 원격 `tests/tool002_actual_xlsx_e2e.cjs`(48,486행 실제 XLSX, Playwright)는 해당 XLSX 가 이 환경에 없어 실행하지 못했다.
* G2B 실호출·기관 14곳 실수집·024호 실제 원문.
