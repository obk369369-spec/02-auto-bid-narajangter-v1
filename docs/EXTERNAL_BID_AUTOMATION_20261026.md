# TOOL002 External Automation Components — corrected 2026-10-26

## Correction
Info21C and BidQ are external bid-service companies/services. They are NOT the reusable program/code components the user asked to import into WIC. They may remain optional service references only and must not be reported as the requested automation-tool acquisition.

## Acquisition policy
Target only software/code that can be installed, connected, forked, or adapted:
- open-source repositories
- MCP servers
- bots/schedulers
- local/self-hosted tender workspaces
- reusable workflow engines

Do not rebuild a feature from zero when a reusable component already exists.

## Priority A — Korea-specific ready components

### 1. opendata-kr/narajangteo-bid-mcp
Repository: https://github.com/opendata-kr/narajangteo-bid-mcp
License: MIT
Type: local MCP server / npm package
Install pattern:
npx -y @opendata-kr/narajangteo-bid-mcp@latest
Required secret:
DATA_GO_KR_SERVICE_KEY

Implemented tools:
- search_bid_notices
- get_bid_notice
- get_bid_basis_amount
- get_bid_evaluation
- get_bid_change_history
- get_bid_eligibility
- get_bid_items
- get_bid_attachments
- download_attachments
- read_attachment

Important:
It already solves most of TOOL002's public-source ingestion layer, including attachment download and HWP/HWPX/legacy DOC reading. Do not reimplement those features inside TOOL002 unless integration proves incompatible.

Proposed WIC role:
G2B SOURCE ADAPTER + ATTACHMENT READER.

Status:
IMPORT-FIRST candidate.

### 2. donghyeon01/kr-public-mcp
Repository: https://github.com/donghyeon01/kr-public-mcp
Type: remote MCP server for Korean public procurement
Public endpoint reported by repository:
https://kr-public-mcp.songdonghyeon01.workers.dev/mcp

Implemented direction:
- G2B bid notice search
- pre-specification data
- award/result data
- source links

Value:
Fastest zero-install proof path because the repository advertises URL-only remote MCP use.

Proposed WIC role:
FAST PROTOTYPE / FALLBACK READ-ONLY SOURCE.

Status:
VERIFY-LIVE before reliance.

### 3. tobornot2b/Narabot
Repository: https://github.com/tobornot2b/Narabot
Type: Python scheduled bot

Implemented:
- scheduled G2B API polling
- bid notice collection
- opening/result collection
- contract result collection
- winner list
- Telegram bot delivery

Proposed WIC role:
Reuse scheduler + dedupe/notification pattern instead of building observer scheduling from zero.

Status:
IMPORT-PARTIAL candidate; inspect API age and dependencies before use.

### 4. kochangbok/narajangteo-crawler
Repository: https://github.com/kochangbok/narajangteo-crawler
Type: Python batch collector

Implemented:
- G2B/KJEBI bid page collection
- batch by bid number CSV
- JSON/Markdown/PDF generation
- attachment auto-download
- HWP/HWPX conversion to Markdown/PDF
- completed-opening popup merge

Proposed WIC role:
Historical/result collector and attachment sidecar only if official API/MCP does not cover a case.

Status:
IMPORT-OPTIONAL; low commit history, use behind official API first.

## Priority B — reusable tender workflow shells

### 5. Amawta-labs/tendergraph
Repository: https://github.com/Amawta-labs/tendergraph
License: Apache-2.0
Type: full tender operating workspace

Implemented workspace stages:
- discovery
- qualification
- requirements
- bid preparation
- compliance
- monitoring
- outcome learning
Also includes versioned source sets, requirement readiness, dependency-aware plans, compliance blockers and amendment-impact handling.

Important:
It does NOT claim universal live-source discovery. Therefore G2B ingestion should come from a Korea-specific adapter such as narajangteo-bid-mcp.

Proposed WIC role:
Potential UI/workflow/evidence shell. Do not copy whole project blindly; extract only modules that reduce TOOL002 custom development.

Status:
EVALUATE-FOR-SHELL.

### 6. axel20000/tenders-bot
Repository: https://github.com/axel20000/tenders-bot
Type: Python observer pipeline

Implemented architecture:
- scheduled tender discovery
- provider modules
- Playwright
- SQLite persistent state/dedup
- LLM relevance scoring
- structured validation
- email reporting

Proposed WIC role:
Observer architecture donor: scheduler + seen-state + relevance + reporting.
For G2B use official MCP/API rather than browser scraping whenever possible.

Status:
EVALUATE-FOR-OBSERVER.

## Proposed WIC composition

[Official G2B]
  ↓
[narajangteo-bid-mcp]
  ↓
[TOOL002 RAW/INTERNAL]
  ├─ notice detail
  ├─ basis amount/evaluation
  ├─ eligibility
  ├─ items
  ├─ change history
  └─ attachments/HWP read
  ↓
[WIC classification + publisher-cost + bid calculation]
  ↓
[observer state]
  ├─ NEW
  ├─ CHANGED
  ├─ SAME
  ├─ DEADLINE
  └─ MANUAL_REQUIRED
  ↓
[Tender workspace / browser UI]
  ↓
[Official G2B login/final submit]

Reuse sources:
- narajangteo-bid-mcp: source/attachment functions
- tenders-bot or Narabot: scheduler/dedupe/notification pattern
- TenderGraph: workflow/evidence UI patterns if compatible
- existing TOOL002 PASS_LOCKED core: WIC-specific logic

## Build prohibition
Do NOT write new versions of the following until import compatibility has been tested:
- G2B search client
- bid notice detail parser
- basis amount reader
- eligibility reader
- amendment/change detector
- attachment downloader
- HWP/HWPX reader
- generic scheduler
- generic seen/dedup store

## Next Work execution order
1. Clone/download candidate repos into an isolated external-components workspace.
2. Verify license, dependency, test, last activity, runtime requirements.
3. Run each candidate with its own sample/test before integration.
4. Produce SKIP-REUSE / IMPORT / ADAPT / REJECT table.
5. Import only required modules; never merge whole repos into canonical TOOL002 blindly.
6. Connect imported source adapter to TOOL002 through a narrow contract.
7. Test one actual G2B notice end-to-end.
8. Verify notice, basis amount, eligibility, change history and attachments against official source.
9. Only then connect scheduler/observer.
10. Preserve final G2B login/certificate/irreversible submission as MANUAL/OFFICIAL.

## Evidence gate
No component is considered "brought in" merely because its URL was found.
PASS requires:
- actual source code acquired
- license recorded
- dependency install success
- component starts/runs
- one real function executes
- output compared with official source
- TOOL002 integration test
- rollback available
- evidence committed/read-back

## Current decisions
- narajangteo-bid-mcp: TOP IMPORT CANDIDATE
- kr-public-mcp: TOP FAST-PROOF CANDIDATE
- Narabot: NOTIFICATION DONOR
- narajangteo-crawler: OPTIONAL COLLECTOR
- TenderGraph: WORKFLOW/UI DONOR
- tenders-bot: OBSERVER DONOR
- Info21C/BidQ: SERVICE ONLY; not counted as imported automation programs


## 2026-10-26 STRICT READY-TO-USE GATE

The user's required external-tool class is stricter than "open-source code exists".

A candidate may be called READY-TO-USE only if ALL are evidence-backed:
1. 24-hour continuous operation is supported.
2. No paid license/subscription is required for the required WIC scope.
3. It is already a usable program/service, not merely source code.
4. It can be connected as a narrow socket/plugin/MCP/API without rebuilding its internals.
5. It already performs a useful end-to-end procurement function.
6. Actual execution evidence exists.
7. It can consume or coexist with TOOL002 without rewriting PASS_LOCKED core.
8. It does not require the user to become the operator/programmer.
9. It does not depend on a vendor manually doing the work for the user.
10. Security/login/final submission boundaries are explicit.

Under this strict gate, current candidates are NOT yet READY:
- opendata-kr/narajangteo-bid-mcp: reusable local MCP package, but not an autonomous 24h hosted observer; requires data.go.kr key and a running MCP client/runtime.
- donghyeon01/kr-public-mcp: remote MCP is closest to socket-form, but free tier is limited (README states IP-based 30 calls/day); watch_bids is Pro. Therefore not free 24h monitoring.
- Narabot: source program requiring deployment/runtime/configuration; not a zero-setup 24h finished service.
- tenders-bot: source program requiring Python/Playwright/Gemini/SMTP/cron and Korea provider adaptation; not ready for WIC.
- TenderGraph: workflow shell requiring its own runtime and optional model credentials; not G2B-ready out of box.
- narajangteo-crawler: batch script, not continuous ready-to-use automation.

Therefore:
CURRENT VERIFIED COUNT OF STRICT "24H + FREE + FINISHED + SOCKET + IMMEDIATE PRACTICAL" EXTERNAL TOOLS = 0.

The above projects remain only component candidates and MUST NOT be presented as already-acquired completed tools.

## Relationship to WIC archive
The user's uploaded bid archive contains WIC/KISTI-specific historical evidence, business rules, result history, documents, old credentials/process artifacts, and bid calculation experience.
External G2B tools do not automatically understand or use that archive.
They can only supply current public procurement data unless an explicit import/adapter exists.

Therefore an external tool qualifies for WIC only if it either:
A. can ingest WIC historical/rule data directly, or
B. provides a narrow socket that TOOL002 can call without modifying its PASS_LOCKED core.

If neither is true, it is not "ready for WIC practical use".

## Search priority after this correction
Search order must be:
1. Fully finished 24h free/self-hosted procurement application with G2B support.
2. Finished remote MCP/API/plugin with no practical free-tier barrier and direct socket connection.
3. Finished self-hosted app requiring only deployment/config values.
4. Only after 1-3 fail: component composition.
5. Custom coding is last.
