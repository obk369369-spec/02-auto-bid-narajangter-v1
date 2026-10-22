# TOOL002 — KISTI BID READY HANDOFF — 2026-10-22

## 0. Purpose
Prepare TOOL002 for immediate practical KISTI bidding use from 2026-10-23 without rebuilding the already verified core.

This document is the canonical tool-specific handoff for the current discussion.
Do not treat this file alone as evidence that a new observer/runtime has been implemented. It records the required operating scope and next practical steps.

## 1. Existing canonical PASS — reuse, do not rebuild
Central closure evidence already records:
- root: TOOL002_CANONICAL_RUNTIME_AND_DEPLOYED_READBACK
- overall: PASS
- canonical repository: obk369369-spec/02-auto-bid-narajangter-v1
- canonical commit: b496e0f1a51e7c15aa578c5557ae5ac5c2b5fdaa
- actual input: 48,486-row XLSX, header row 5
- positive / negative / failure injection / regression / recovery / rollback / artifact validation / actual deployment / deployed read-back: PASS
- pass_lock: PASS_LOCKED
- reexecution: BLOCKED

Therefore:
- Do not rebuild TOOL002 from scratch.
- Do not rerun the large XLSX proof unless the locked code/rules/interface/evidence validity actually changes.
- Preserve distinct TSV MVP / XLSX worker roles.
- Reuse existing institution accumulation, classification and runtime evidence.

## 2. Recovered historical intent that remains relevant
The current TOOL002 purpose is not merely a static bid calculator.
Relevant retained intent from the recovered 2번 입찰 records:
1. Accept public procurement notice data (paste/upload/structured source).
2. Classify into practical branches: 입찰 / 내부안내 / 제외(X).
3. Parse notice-specific numeric fields without inventing a universal winning formula.
4. Calculate only from verified notice values/rules.
5. Accumulate issuing/demand institutions without duplicate corruption.
6. Minimize user input and keep the result visible in the browser.
7. Keep unstable institution-specific exceptions/manual review separate rather than breaking the core.
8. Actual final submission remains on the official procurement site when login/certificate/final confirmation is required.

## 3. Small Observer v1 — current feasible scope
The preferred near-term automation is a small observer outside the core, not a larger rebuild of TOOL002.

Observer responsibility:
1. Check official/public procurement sources for new notices.
2. Detect changed notices.
3. Apply a first WIC-relevance screen.
4. Flag approaching deadlines.
5. Accumulate institution occurrence/history.
6. Pass only relevant/new/changed records to TOOL002 for deeper classification/calculation.

Observer must NOT:
- duplicate TOOL002 calculation/classification internals;
- make up bid/winning probabilities;
- submit bids;
- bypass login, certificate, CAPTCHA, access control, or security controls;
- rewrite PASS_LOCKED TOOL002 core merely to add monitoring.

Suggested minimal observer output:
- NEW
- CHANGED
- SAME
- 입찰후보
- 내부안내
- 제외
- 마감임박
- source URL
- notice number
- institution
- deadline
- handoff status to TOOL002

No-change runs should be silent/minimal.

## 4. G2B current feasibility update
Earlier historical records that treated full NaraJangter monitoring as unavailable must not be blindly reused.
As of 2026-10-22, use verified official/public interfaces where available (including official procurement/open-data interfaces) before falling back to manual Excel download/upload.
This is a new capability direction and remains NEW until an actual observer execution is evidence-backed.

## 5. KISTI practical bid readiness for 2026-10-23
Primary operating assumption: use the exact KISTI notice as the authority. Do not generalize one KISTI notice to every KISTI bid.

A verified 2026 KISTI service-bid example shows:
- demand institution: 한국과학기술정보연구원
- electronic bidding through 국가종합전자조달시스템(나라장터)
- bid price entered in G2B during the submission window
- participation registration requirements apply
- notice-specific eligibility and supporting documents apply
- some KISTI service notices can use 제한경쟁 / 총액입찰 / 협상에 의한 계약

For tomorrow, the practical sequence is:
1. Open the exact KISTI notice.
2. Confirm notice number, title, submission deadline and submission channel.
3. Download/read the notice + attachments.
4. Verify bidder eligibility, registered business/category requirements, SME/small-business certificates or other notice-specific documents where required.
5. Identify bid method: price-only / quotation / negotiated contract / other.
6. Extract exact numeric fields: estimated/base amount, VAT treatment, bid bond if applicable, lower-limit or evaluation formula only if explicitly stated.
7. Feed those exact values/rules into TOOL002.
8. Generate the practical bid amount/range only from the actual notice.
9. Check required attachments and final submission checklist.
10. Proceed to the official site for login/certificate/final bid submission.
11. Record the result/receipt after submission.

## 6. Tonight's readiness boundary
Prepared now:
- canonical PASS core identified and locked;
- historical intent recovered;
- small observer v1 scope defined;
- KISTI/G2B practical sequence fixed;
- no need to spend tomorrow rebuilding the tool.

Still requires the actual target notice before final price/document preparation:
- exact KISTI notice number/title;
- exact deadline;
- exact eligibility restrictions;
- exact calculation/evaluation rules;
- exact required attachments.

Do not guess any of those.

## 7. Tomorrow first-action rule
When the user supplies or opens the target KISTI notice:
- do not ask for old TOOL002 rules again;
- do not redesign the tool;
- immediately parse the notice and attachments;
- produce only the fields needed to participate;
- distinguish AUTO / MANUAL / FINAL-SUBMIT;
- user intervention should be limited to credentials/certificate/final irreversible submission or genuinely unavailable external input.

## 8. Status
- TOOL002 existing core: PASS_LOCKED / REUSE
- historical records: RECOVERED / REUSE
- KISTI practical workflow: READY_AS_OPERATING_INSTRUCTION
- Small Observer v1 implementation: NEW / NOT YET EVIDENCE-PASSED
- Exact 2026-10-23 KISTI target notice: NOT IDENTIFIED IN THIS HANDOFF
- Actual final electronic submission: MANUAL/OFFICIAL-SITE FINAL STEP
