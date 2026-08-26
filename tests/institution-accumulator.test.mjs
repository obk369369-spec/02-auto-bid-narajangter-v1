import assert from "node:assert/strict";
import { accumulateInstitutions } from "../src/institution-accumulator.mjs";

const actualDerivedRows = [
  ["입찰공고 목록"],
  ["검색일", "2026-03-16"],
  ["검색조건", "전체"],
  [],
  ["업무구분", "업무여부", "구분", "입찰공고번호", "공고명", "공고기관", "수요기관", "게시일시(입찰마감일시)"],
  ["물품", "대상", "일반", "2026-0001", "해외시장 보고서 구매", "한국연구원", "한국연구원 도서관", "2026-03-16"],
  ["물품", "대상", "일반", "2026-0002", "전자자료 구독", "한국연구원", "한국연구원 정보실", "2026-03-16"],
  ["용역", "대상", "일반", "2026-0003", "산업 분석 자료", "산업진흥원", "", "2026-03-16"],
  ["용역", "대상", "일반", "2026-0003", "산업 분석 자료 중복", "산업진흥원", "", "2026-03-16"]
];

const result = accumulateInstitutions(actualDerivedRows);
assert.equal(result.status, "PASS");
assert.equal(result.headerRow, 5);
assert.equal(result.rows.length, 3);
assert.deepEqual(result.institutions, [
  { institution: "한국연구원", count: 2 },
  { institution: "산업진흥원", count: 1 }
]);
assert.equal(result.institutions.reduce((sum, item) => sum + item.count, 0), result.rows.length);

const missing = accumulateInstitutions([["입찰공고 목록"], ["데이터 없음"]]);
assert.equal(missing.status, "HOLD_HEADER_ROW_NOT_FOUND");

const blankInstitution = accumulateInstitutions([
  ["입찰공고번호", "공고명", "공고기관"],
  ["2026-0099", "기관 누락 사례", ""]
]);
assert.equal(blankInstitution.status, "HOLD_INSTITUTION_MISSING");

console.log(JSON.stringify({ status: "PASS", cases: 3, headerRow: result.headerRow, dedupedRows: result.rows.length, institutionCount: result.institutions.length }));
