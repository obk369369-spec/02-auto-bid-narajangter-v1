// main.ts — 나라장터 입찰 계산 도구 v1 (2번 도구)

Deno.serve(() =>
  new Response(
    `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>나라장터 입찰 계산 도구 v1 (2번 도구)</title>
  <style>
    body {
      font-family: "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      background:#f5f5f5;
      margin:0;
      padding:20px;
      color:#222;
    }
    h1 {
      font-size:1.4rem;
      margin-bottom:10px;
    }
    .card {
      background:#fff;
      border-radius:12px;
      padding:16px 20px;
      box-shadow:0 4px 10px rgba(0,0,0,0.04);
      margin-bottom:16px;
    }
    label {
      display:block;
      font-size:0.9rem;
      margin-top:10px;
      margin-bottom:4px;
      font-weight:600;
    }
    input[type="text"], input[type="number"] {
      width:100%;
      padding:8px 10px;
      border-radius:6px;
      border:1px solid #ccc;
      box-sizing:border-box;
      font-size:0.9rem;
    }
    button {
      margin-top:14px;
      padding:9px 16px;
      border-radius:8px;
      border:none;
      font-size:0.95rem;
      font-weight:600;
      cursor:pointer;
      background:#0052cc;
      color:#fff;
    }
    button:hover { background:#003f99; }
    .log {
      font-size:0.85rem;
      line-height:1.5;
      white-space:pre-line;
      background:#fcfcfc;
      border-radius:8px;
      border:1px solid #eee;
      padding:10px;
      margin-top:6px;
    }
    table {
      width:100%;
      border-collapse:collapse;
      margin-top:10px;
      font-size:0.85rem;
    }
    th, td {
      border:1px solid #ddd;
      padding:6px 8px;
      text-align:right;
    }
    th {
      background:#fafafa;
      text-align:center;
    }
    .footer {
      margin-top:10px;
      font-size:0.75rem;
      color:#777;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>나라장터 입찰 계산 도구 v1 (2번 도구)</h1>
    <div style="font-size:0.9rem; line-height:1.5;">
      나라장터 개찰결과 화면에서 <b>예정가격</b>과 <b>낙찰하한율</b>을 그대로 입력하면
      <b>하한가와 추천 입찰가(+0.2% / +0.3% / +0.5%)</b>를 순서대로 보여주는 도구다.
    </div>
  </div>

  <div class="card">
    <label>예정가격 (원)</label>
    <input type="number" id="expectedPrice" placeholder="예: 99600000" />
    <label>낙찰하한율 (%)</label>
    <input type="number" id="lowerRate" step="0.001" placeholder="예: 87.745" />
    <button onclick="calc()">계산하기</button>
  </div>

  <div class="card">
    <div class="log" id="summary">아직 계산하지 않았다. 위에 값을 입력하고 버튼을 누르면 결과가 나온다.</div>
  </div>

  <div class="card">
    <div class="log" id="detail"></div>
    <table id="resultTable" style="display:none;">
      <thead>
        <tr>
          <th>구분</th>
          <th>금액(원)</th>
          <th>예정가격 대비 투찰률(%)</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>

  <script>
    function fmt(n) {
      if (isNaN(n)) return "-";
      return n.toLocaleString("ko-KR");
    }
    function roundWon(n) {
      return Math.round(n / 10) * 10;
    }
    function roundRate(n) {
      return Math.round(n * 1000) / 1000;
    }

    function calc() {
      const exp = Number((document.getElementById("expectedPrice").value || "0").replace(/,/g,""));
      const rate = Number((document.getElementById("lowerRate").value || "0").replace(/,/g,""));
      const summary = document.getElementById("summary");
      const detail = document.getElementById("detail");
      const table = document.getElementById("resultTable");
      const tbody = table.querySelector("tbody");

      if (!exp || !rate) {
        summary.textContent = "예정가격과 낙찰하한율을 모두 입력해야 계산할 수 있다.";
        detail.textContent = "";
        table.style.display = "none";
        return;
      }

      const lower = exp * (rate / 100);
      const lowerR = roundWon(lower);
      const rec1 = roundWon(lower * 1.002);
      const rec2 = roundWon(lower * 1.003);
      const rec3 = roundWon(lower * 1.005);

      const rLower = roundRate(lowerR / exp * 100);
      const r1 = roundRate(rec1 / exp * 100);
      const r2 = roundRate(rec2 / exp * 100);
      const r3 = roundRate(rec3 / exp * 100);

      // 요약 설명
      let s = "";
      s += "1단계) 입력값 확인: 예정가격 " + fmt(exp) + "원, 낙찰하한율 " + rate + "%\\n";
      s += "2단계) 하한가 계산: 예정가격 × 낙찰하한율 = " +
           fmt(exp) + " × " + rate + "% ≒ " + fmt(lowerR) +
           "원 (투찰률 " + rLower + "%)\\n";
      s += "3단계) 추천 입찰가: 하한가 기준으로 +0.2%, +0.3%, +0.5%를 적용한다.";
      summary.textContent = s;

      // 상세 설명
      let d = "";
      d += "● 하한가(낙찰하한가) = 예정가격 × 낙찰하한율\\n";
      d += "   = " + fmt(exp) + " × " + rate + "% ≒ " + fmt(lowerR) + "원\\n\\n";
      d += "● 추천 입찰가\\n";
      d += "   - 추천1: 하한가 × 1.002 (하한가 +0.2%)\\n";
      d += "   - 추천2: 하한가 × 1.003 (하한가 +0.3%)\\n";
      d += "   - 추천3: 하한가 × 1.005 (하한가 +0.5%)\\n";
      detail.textContent = d;

      // 표
      tbody.innerHTML = "";
      function addRow(label, amount, rateText) {
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        const td2 = document.createElement("td");
        const td3 = document.createElement("td");
        td1.textContent = label;
        td1.style.textAlign = "center";
        td2.textContent = fmt(amount);
        td3.textContent = rateText;
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tbody.appendChild(tr);
      }
      addRow("예정가격", exp, "100.000");
      addRow("하한가", lowerR, rLower.toString());
      addRow("추천1 (+0.2%)", rec1, r1.toString());
      addRow("추천2 (+0.3%)", rec2, r2.toString());
      addRow("추천3 (+0.5%)", rec3, r3.toString());
      table.style.display = "";
    }
  </script>

  <div class="footer">
    ※ 사용법: 나라장터 개찰결과 화면에서 예정가격과 낙찰하한율을 확인한 뒤 그대로 위 칸에 입력하고, "계산하기" 버튼을 누르면 된다.
  </div>
</body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  ),
);
