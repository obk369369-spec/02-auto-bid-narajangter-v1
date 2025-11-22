// 입찰 계산·시각화 도구 v2

let chart = null;
let lastData = null;

// 숫자 포맷 (원)
function formatWon(value) {
  if (isNaN(value)) return "-";
  return value.toLocaleString("ko-KR") + "원";
}

// 소수점 자리 제한
function round(value, digits = 2) {
  if (isNaN(value)) return NaN;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

// 메인 계산
function calculate() {
  const budget = parseFloat(document.getElementById("budget").value);
  const estimate = parseFloat(document.getElementById("estimate").value);
  const threshold = parseFloat(document.getElementById("threshold").value);
  const marginRate = parseFloat(document.getElementById("marginRate").value);
  const vatType = document.getElementById("vatType").value;
  const bidRatesRaw = document.getElementById("bidRates").value;

  const errorBox = document.getElementById("errorBox");
  errorBox.style.display = "none";
  errorBox.textContent = "";

  if (!budget || isNaN(threshold) || !bidRatesRaw) {
    errorBox.style.display = "block";
    errorBox.textContent = "배정예산, 낙찰하한율, 투찰율 후보는 반드시 입력해 주세요.";
    return;
  }

  // 기준금액: 추정가격이 있으면 우선, 없으면 배정예산 사용
  const baseAmount = !isNaN(estimate) && estimate > 0 ? estimate : budget;

  // 하한가
  const thresholdRate = threshold / 100;
  const thresholdAmount = baseAmount * thresholdRate;

  // 투찰율 리스트
  const bidRates = bidRatesRaw
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((v) => !isNaN(v))
    .sort((a, b) => a - b);

  if (bidRates.length === 0) {
    errorBox.style.display = "block";
    errorBox.textContent = "투찰율 후보를 다시 확인해 주세요.";
    return;
  }

  const rows = [];
  let bestRow = null;

  bidRates.forEach((rate) => {
    const bidAmount = baseAmount * (rate / 100);
    const gapWon = bidAmount - thresholdAmount;
    const gapRate =
      thresholdAmount > 0 ? (gapWon / thresholdAmount) * 100 : NaN;

    // 마진 계산 (아주 단순 모델: 기준금액 * 마진율)
    let marginWon = NaN;
    let marginRateReal = NaN;
    if (!isNaN(marginRate)) {
      const marginBase =
        vatType === "taxable"
          ? bidAmount / 1.1 // 부가세 제외 순매출 기준
          : bidAmount;
      marginWon = marginBase * (marginRate / 100);
      marginRateReal = (marginWon / bidAmount) * 100;
    }

    // 판정
    let status = "";
    if (gapWon < 0) {
      status = "하한가 미만 (탈락 위험)";
    } else if (gapRate >= 0 && gapRate <= 0.3) {
      status = "낙찰권역 (집중 구간)";
    } else {
      status = "여유 있음 (안전 구간)";
    }

    const row = {
      rate,
      bidAmount,
      gapWon,
      gapRate,
      marginWon,
      marginRateReal,
      status,
    };

    // 추천: 하한가보다 약간 위 + 마진 양수
    if (
      gapWon >= 0 &&
      gapRate >= 0.1 &&
      gapRate <= 0.3 &&
      !isNaN(marginWon) &&
      marginWon > 0
    ) {
      if (!bestRow) {
        bestRow = row;
      } else {
        // 하한가와 더 가까운 쪽 선택
        if (Math.abs(row.gapRate - 0.15) < Math.abs(bestRow.gapRate - 0.15)) {
          bestRow = row;
        }
      }
    }

    rows.push(row);
  });

  // bestRow 없으면, 하한가보다 위에서 가장 가까운 값 선택
  if (!bestRow) {
    const aboveRows = rows.filter((r) => r.gapWon >= 0);
    if (aboveRows.length > 0) {
      bestRow = aboveRows.sort((a, b) => a.gapWon - b.gapWon)[0];
    }
  }

  // 결과 테이블 채우기
  const tbody = document.getElementById("resultBody");
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    if (bestRow && r.rate === bestRow.rate) {
      tr.classList.add("row-recommend");
    }

    tr.innerHTML = `
      <td>${r.rate.toFixed(2)}</td>
      <td>${formatWon(Math.round(r.bidAmount))}</td>
      <td>${formatWon(Math.round(r.gapWon))}</td>
      <td>${isNaN(r.gapRate) ? "-" : round(r.gapRate, 3) + "%"}</td>
      <td>${isNaN(r.marginWon) ? "-" : formatWon(Math.round(r.marginWon))}</td>
      <td>${isNaN(r.marginRateReal) ? "-" : round(r.marginRateReal, 2) + "%"}</td>
      <td>${r.status}</td>
    `;
    tbody.appendChild(tr);
  });

  // 요약 박스 채우기
  const title = document.getElementById("noticeTitle").value || "(제목 없음)";
  const agency =
    document.getElementById("agencyName").value || "(기관명 없음)";

  document.getElementById("summaryTitle").textContent =
    `${agency} / ${title}`;
  document.getElementById("summaryBase").textContent =
    `${formatWon(Math.round(baseAmount))} (기준금액)`;
  document.getElementById("summaryThreshold").textContent =
    `${formatWon(Math.round(thresholdAmount))} (${threshold.toFixed(
      2
    )}%)`;

  if (bestRow) {
    document.getElementById("summaryRecommendation").textContent =
      `${bestRow.rate.toFixed(2)}% / ${formatWon(
        Math.round(bestRow.bidAmount)
      )} (하한가 대비 여유 ${round(bestRow.gapRate, 3)}%)`;
  } else {
    document.getElementById("summaryRecommendation").textContent =
      "조건에 맞는 추천 지점을 찾지 못했습니다.";
  }

  // 그래프용 데이터 저장
  lastData = {
    baseAmount,
    thresholdAmount,
    thresholdRate,
    rows,
    bestRow,
  };

  updateChart("bidAmount");
  updateAnalysisText();
}

// 그래프 그리기
function updateChart(type) {
  if (!lastData) return;

  const ctx = document.getElementById("mainChart").getContext("2d");
  const labels = lastData.rows.map((r) => r.rate.toFixed(2));
  let data = [];
  let yLabel = "";

  if (type === "bidAmount") {
    data = lastData.rows.map((r) => Math.round(r.bidAmount));
    yLabel = "입찰가 (원)";
  } else if (type === "gap") {
    data = lastData.rows.map((r) => round(r.gapRate, 3));
    yLabel = "하한가 대비 여유율 (%)";
  } else if (type === "margin") {
    data = lastData.rows.map((r) => round(r.marginRateReal, 2));
    yLabel = "마진율 (%)";
  }

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: yLabel,
          data,
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
        },
        tooltip: {
          enabled: true,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "투찰율 (%)",
          },
        },
        y: {
          title: {
            display: true,
            text: yLabel,
          },
        },
      },
    },
  });
}

// 해석 텍스트
function updateAnalysisText() {
  if (!lastData) return;

  const { baseAmount, thresholdAmount, thresholdRate, rows, bestRow } =
    lastData;
  const analysis = [];

  analysis.push(
    `① 기준금액은 약 ${formatWon(
      Math.round(baseAmount)
    )} 이고, 낙찰하한가는 약 ${formatWon(
      Math.round(thresholdAmount)
    )} (하한율 ${round(thresholdRate * 100, 3)}%) 입니다.`
  );

  const above = rows.filter((r) => r.gapWon >= 0);
  const below = rows.filter((r) => r.gapWon < 0);

  if (below.length > 0) {
    analysis.push(
      `② ${below.length}개 투찰율은 하한가보다 낮아 “탈락 위험”으로 표시됩니다. 이 구간은 선택하지 않는 것이 좋습니다.`
    );
  }

  if (above.length > 0) {
    const minAbove = above.sort((a, b) => a.gapWon - b.gapWon)[0];
    analysis.push(
      `③ 하한가보다 조금 위에 있는 가장 가까운 투찰율은 약 ${minAbove.rate.toFixed(
        2
      )}% 이고, 하한가 대비 여유는 약 ${round(
        minAbove.gapRate,
        3
      )}% 입니다.`
    );
  }

  if (bestRow) {
    analysis.push(
      `④ 추천 구간은 하한가보다 약간 위(약 0.1~0.3%)이면서 마진이 플러스인 지점입니다. 현재 추천 투찰율은 약 ${bestRow.rate.toFixed(
        2
      )}% 로, 하한가 대비 여유는 약 ${round(
        bestRow.gapRate,
        3
      )}% 이고 마진은 ${formatWon(
        Math.round(bestRow.marginWon)
      )} 수준으로 계산됩니다.`
    );
  } else {
    analysis.push(
      "④ 하한가보다 조금 위이면서 마진이 플러스인 지점을 찾지 못했습니다. 투찰율 후보를 다시 조정해 보는 것이 좋습니다."
    );
  }

  analysis.push(
    "⑤ 실제 입찰에서는 예정가격 산정 방식(복수예비가격, 추첨 방식 등)과 기관의 내부 기준이 추가로 작용할 수 있으므로, 위 결과는 ‘숫자 기준의 참고용’으로 활용하는 것이 좋습니다."
  );

  document.getElementById("analysisText").textContent =
    analysis.join(" ");
}

// 탭 버튼 이벤트
function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const type = btn.getAttribute("data-chart");
      updateChart(type);
    });
  });
}

// 초기화
window.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("calcButton")
    .addEventListener("click", calculate);
  setupTabs();
});
