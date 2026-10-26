# TOOL002 Bid Archive Audit — 2026-10-26

## Scope
User archive: 입찰.zip
- 220 actual files
- approx. 173.4 MB unpacked
- PDF 81 / HWP 43 / JPG 35 / XLS 20 / DOC 13 / other 28
- KISTI 114 files
- SME-status / small-business confirmation 40
- BidQ notice lists 16
- NaraJangter 12
- ETRI 8
- KEPCO research procurement 5
- other institution/procurement records

## Security rule
Do NOT commit source files containing passwords, certificates, certificate request numbers, tax filings, business/employee identifiers, insurance/pension documents, account/login data, or raw email credentials.
GitHub stores only non-sensitive rules, process knowledge, redacted historical analysis and evidence metadata.

## Archive classification

### A. High-value practical evidence
- KISTI 공고 현황/1등
- KISTI 공고 현황/상위권
- KISTI 공고 현황/하위권
- KISTI 낙찰 후 검수/대금 절차
- historical bid calculation notes
- info21c bid study
- multiple preliminary-price calculation manual
- ETRI e-bid/e-contract/workflow manuals

### B. Historical-only / refresh before use
- 2015 competition-participant registration certificate
- old small-business certificates
- old seal/use-seal documents
- old insurance/tax payment certificates
- KISTI legacy e-bid registration/renewal files through 2024
- old NaraJangter Java/JRE/Applet manuals
- old institution-specific registration instructions

### C. Sensitive originals — local archive only
- 엑셀-입찰관련모음 (아이디, 패스워드..).xls
- certificate/request-number images
- tax-return PDFs
- business-registration evidence
- employment certificates
- insurance/pension originals
- account/login information documents

## Duplicate hash groups
Exact duplicate groups found: 3.
1. info21c_bid_study.pdf duplicate under 입찰 학습
2. multiple-preliminary-price manual duplicate under 입찰 학습
3. one identical scanned image reused in two KISTI low-rank folders

No deletion performed.

## KISTI historical evidence
KISTI archive contains:
- winner folder: 31 files; at least 14 bid-number traces
- upper-rank folder: 5 files; at least 4 bid-number traces
- lower-rank folder: 21 files; at least 8 bid-number traces

Important example B2017-000667-00:
- goods
- total-price bid
- small-value quotation
- winner method: lower-limit rate
- historical lower-limit rate: 88%
- estimated budget: KRW 3,141,700 VAT included
- base preliminary price: KRW 3,100,000
- preliminary range: -1% to +1%
- 15 preliminary prices; selected four averaged into final expected price
- historical winning amount recorded: KRW 2,727,573

Why this matters:
3,100,000 * 88% = 2,728,000, but recorded winning amount differs.
Therefore historical 88% cannot be treated as a universal fixed winning formula.
TOOL002 must calculate from the exact current notice, expected-price method and stated lower-limit/evaluation rule.

Other historical KISTI files show different preliminary ranges such as +/-1%, +/-2%, and -3%~0%.
Institution identity alone never determines one fixed formula.

## KISTI legacy system
Archive contains KISTI legacy e-bid membership/renewal records through 2024.
For 2026 operations these are historical records only.
Current KISTI bids are searched/submitted through current official procurement routes, primarily G2B/NaraJangter when the notice states so.
Do not rebuild workflows around the dead legacy ebid host.

## Post-award evidence
Historical KISTI records include contract / delivery / inspection / payment flow.
One historical notice recorded:
- contract within 5 days after award notice
- performance within 20 days from contract
- payment after inspection
- payment timing after payment request
Current notice/contract terms always override historical timing.

## Immediate 2026 readiness checklist
1. Verify current G2B company status.
2. Verify required industry/product/participation registration.
3. Verify currently valid SME/small-business certificate if required.
4. Prepare current company documents.
5. Find exact target notice.
6. Save notice + all attachments.
7. Extract eligibility / deadline / submission route / numeric rules.
8. Run TOOL002 only from verified notice fields.
9. Perform final self-audit and correction.
10. Submit on official site; preserve receipt/result evidence.

## Reuse rule
This archive is not a template to copy blindly.
Use it as:
- historical winning/losing evidence
- institutional process memory
- contract/inspection/payment experience
- bid-price analysis data

Do not reuse:
- expired credentials/certificates
- old authentication procedures
- old KISTI legacy-site instructions
- fixed 88% assumptions

Status: ARCHIVE_AUDITED / SENSITIVE_SOURCE_EXCLUDED_FROM_GITHUB
