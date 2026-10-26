# TOOL002 External Automation Tool Evaluation — 2026-10-26

## Decision
Do not rebuild commodity bid-notice monitoring/alert features if an existing mature service already provides them reliably.
Use external services for commodity monitoring and keep TOOL002 focused on WIC-specific judgment, cost, notice-specific calculation and evidence.

## 1. Official G2B OpenAPI — preferred machine source
Official public-data service:
https://www.data.go.kr/data/15129394/openapi.do

Current documented capabilities include:
- goods/service/construction/foreign bid notice lists
- detailed notice information
- base amount
- license restrictions
- eligible regions
- notice-change history
- search conditions
- REST JSON/XML
- real-time update
- free usage

TOOL002 observer integration priority: HIGH.
Reason: official source, structured, suitable for NEW/CHANGED/deadline/institution monitoring.

Do not claim observer PASS until an actual API-backed run is evidence-tested.

## 2. Info21C — immediate practical monitoring
https://www.info21c.net/

Current practical functions confirmed from public service pages:
- mobile app
- real-time push for new customized notices
- customized notice conditions
- Kakao/SMS notice alerts
- correction/re-bid alerts
- first-ranked/winning alerts
- 1:1 bid analysis service
- bid-price / multiple-preliminary-price support
- automatic saving to bid/winning document folders on configured services

Immediate WIC value:
HIGH for "do not manually search every day".

Recommended use:
Use customized keywords/institutions to monitor:
- 한국과학기술정보연구원
- 한국생산기술연구원
- 한국화학연구원
- 한국탄소산업진흥원
- 해외보고서
- 시장조사
- 시장보고서
- 데이터베이스
- 전자자료
- 도서

Do not copy their analysis output blindly into TOOL002.
Exact notice remains authority.

## 3. BidQ — immediate practical monitoring + analysis UI
https://www.bidq.co.kr/

Archive already contains a historical BidQ analysis-service contract and BidQ notice-list exports, so WIC has prior operational experience with this service.

Current public functions include:
- customized notice collection
- email/Kakao/app push notifications
- document bag / calendar-style management
- bid result tracking
- qualification-review calculator
- issuer tendency analysis
- competitor bid analysis
- preliminary-rate frequency analysis
- bid analysis/consulting
- candidate bid-price ranges

Immediate WIC value:
HIGH if user wants an already-built visual bid workspace rather than waiting for TOOL002 observer development.

## 4. Recommended division of labor

### External service
Use Info21C or BidQ for:
- broad notice collection
- push notification
- correction/re-bid notification
- search/filter UI
- calendar/document organization
- commodity bid-analysis views

### G2B official API
Use for:
- structured source-of-truth observation
- automated NEW/CHANGED detection
- notice-detail ingestion
- institution accumulation

### TOOL002
Keep for WIC-specific:
- 입찰 / 내부안내 / 제외 branching
- market-report / data-product relevance
- publisher supply feasibility
- publisher list price / FX / discount / commission / margin calculation
- exact notice-specific bid calculations
- WIC institutional history
- evidence-backed self-validation
- practical final checklist

## 5. What not to build again
Do not spend Work credits rebuilding from zero:
- generic bid search
- generic app push
- generic Kakao alert
- generic bid calendar
- generic competitor-analysis UI
when an external mature service already does it better.

## 6. Current best practical choice
For tomorrow-level practical use:
1. Use current G2B directly for official KISTI notices.
2. Enable either Info21C or BidQ customized alerts to stop manual daily searching.
3. Feed only relevant notice data into TOOL002 for WIC-specific decision/calculation.
4. Build the small observer later only where it replaces repetitive WIC-specific work that external services cannot do.

Status:
- G2B OpenAPI: VERIFIED AVAILABLE / INTEGRATION NOT YET PASS
- Info21C: VERIFIED CURRENT SERVICE / EXTERNAL
- BidQ: VERIFIED CURRENT SERVICE / EXTERNAL
- TOOL002 Observer: NEW / NOT YET EVIDENCE-PASSED
