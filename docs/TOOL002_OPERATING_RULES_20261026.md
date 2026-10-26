# TOOL002 Canonical Operating Rules — 2026-10-26

## Authority
Current notice + attachments override historical examples.

## Existing core
- preserve PASS_LOCKED TOOL002 core
- SKIP-REUSE proven capabilities
- no full rebuild
- no broad re-scan without new failure evidence

## Data architecture
RAW -> INTERNAL -> JUDGMENT -> CALCULATION -> DISPLAY -> EVIDENCE
Raw source is immutable.
Display never overwrites raw/internal evidence.

## Classification
- 입찰
- 내부안내
- 제외(X)
- MANUAL_REQUIRED

## Calculation
Use only verified notice values.
No universal 88%, no invented probability, no fixed preliminary-price assumption.

## WIC supply-cost branch
Maintain publisher price / FX / discount-commission / fees / VAT / cost / target margin separately from procurement threshold calculations.

## Institution history
Accumulate institution, notice count, latest notice, participation/result, submission route and institution-specific exceptions.
Institution exceptions belong in adapters/config, not duplicated core logic.

## Observer boundary
Observer may:
- find new notices
- detect changed notices
- flag deadlines
- perform first WIC relevance screen
- accumulate institutions
- hand relevant records to TOOL002

Observer must not:
- duplicate calculation core
- invent winning probability
- bypass authentication/access controls
- perform final irreversible submission

## Collection priority
1. official NaraJangter/G2B OpenAPI where applicable
2. immediate external alert services (Info21C/BidQ) for practical monitoring
3. institution public websites as supplementary sources

## Output validation gate
Before user delivery:
RULE_LOAD
-> INPUT_LOCK
-> EXPECTED_BUILD
-> GENERATE
-> SELF_AUDIT
-> ERROR_LOCALIZE
-> AUTO_REPAIR
-> REVALIDATE
-> REGRESSION
-> EVIDENCE
-> OUTPUT

User is not the error-finder.
System must localize and safely repair errors before final delivery.

## PASS
PASS requires actual evidence:
- actual input
- actual result
- expected=actual
- zero residual errors within defined validation scope
- regression pass
- reopen/read-back where applicable
- evidence location

No evidence = not PASS.

## Security
Never commit:
passwords, authentication certificates, certificate request numbers, raw tax/insurance/employment documents, account credentials, sensitive business/person identifiers.

## KISTI current rule
Treat legacy KISTI ebid material as historical.
Search the current target notice through official current procurement routes; for 2026 KISTI cases this is primarily G2B when the notice states G2B electronic bidding.
KISTI website is supplementary.

## AUTO / MANUAL / FINAL-SUBMIT
AUTO:
collection, change detection, extraction, classification, calculation, checklist, history.

MANUAL_REQUIRED:
ambiguous qualification, license/supply feasibility, policy meaning.

FINAL-SUBMIT:
credentials, personal authentication, irreversible bid/proposal submission.
