const HEADER_ALIASES = {
  noticeNo: ["입찰공고번호", "공고번호", "공고번호/차수", "입찰번호", "번호"],
  title: ["공고명", "입찰공고명", "사업명", "건명", "공고건명"],
  agency: ["공고기관", "발주기관", "기관명", "계약기관"],
  demandAgency: ["수요기관", "수요기관명", "실수요기관"]
};

function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

function mapHeaders(row) {
  const normalized = row.map(normalize);
  return Object.fromEntries(Object.entries(HEADER_ALIASES).map(([key, aliases]) => {
    const accepted = aliases.map(normalize);
    return [key, normalized.findIndex((value) => accepted.includes(value))];
  }));
}

export function findHeaderRow(rows, limit = 20) {
  const bounded = rows.slice(0, limit);
  for (let index = 0; index < bounded.length; index += 1) {
    const map = mapHeaders(bounded[index]);
    if (map.noticeNo >= 0 && map.title >= 0 && (map.agency >= 0 || map.demandAgency >= 0)) {
      return { index, map };
    }
  }
  return null;
}

export function accumulateInstitutions(rows) {
  const header = findHeaderRow(rows);
  if (!header) {
    return { status: "HOLD_HEADER_ROW_NOT_FOUND", headerRow: null, rows: [], institutions: [] };
  }

  const get = (row, column) => column >= 0 ? String(row[column] ?? "").trim() : "";
  const seen = new Set();
  const mapped = [];
  for (const row of rows.slice(header.index + 1)) {
    if (!row.some((value) => String(value ?? "").trim())) continue;
    const noticeNo = get(row, header.map.noticeNo);
    const title = get(row, header.map.title);
    if (!noticeNo || !title || seen.has(noticeNo)) continue;
    seen.add(noticeNo);
    const agency = get(row, header.map.agency);
    const demandAgency = get(row, header.map.demandAgency);
    mapped.push({ noticeNo, title, agency, demandAgency, institution: agency || demandAgency });
  }

  if (mapped.some((row) => !row.institution)) {
    return { status: "HOLD_INSTITUTION_MISSING", headerRow: header.index + 1, rows: mapped, institutions: [] };
  }

  const counts = new Map();
  for (const row of mapped) counts.set(row.institution, (counts.get(row.institution) || 0) + 1);
  const institutions = [...counts].map(([institution, count]) => ({ institution, count }));
  const total = institutions.reduce((sum, item) => sum + item.count, 0);
  if (total !== mapped.length) throw new Error("institution accumulation invariant failed");

  return { status: "PASS", headerRow: header.index + 1, rows: mapped, institutions };
}
