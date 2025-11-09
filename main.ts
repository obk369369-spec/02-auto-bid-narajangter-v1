// main.ts — 나라장터 입찰 계산 도구 (2번 도구 v1)
Deno.serve(() =>
  new Response(
    `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>나라장터 입찰 계산 도구 v1</title>
  <style>
    body{font-family:"Noto Sans KR",sans-serif;background:#f9f9f9;margin:0;padding:20px;color:#222}
    h1{font-size:1.4rem;margin-bottom:10px}
    input{width:100%;padding:8px;margin:4px 0 10px 0;border:1px solid #ccc;border-radius:6px;font-size:0.9rem}
    button{padding:9px 16px;border-radius:6px;border:none;background:#0052cc;color:#fff;font-weight:600;cursor:pointer}
    button:hover{background:#003f99}
    .card{background:#fff;border-radius:12px;padding:20px;margin-bottom:15px;box-shadow:0 4px 8px rgba(0,0,0,0.05)}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:right;font-size:0.85rem}
    th{background:#fafafa;text-align:center}
    .log{background:#fefefe;border:1px solid #eee;border-radius:8px;padding:10px;white-space:pre-line;font-size:0.85rem}
  </style>
</head>
<body>
  <div class="card">
    <h1>나라장터 입찰 계산 도구 v1</h1>
    <label>예정가격 (원)</label>
    <input type="number" id="expectedPrice" placeholder="예: 99600000" />
    <label>낙찰하한율 (%)</label>
    <input type="number" id="lowerRate" step="0.001" placeholder="예: 87.745" />
    <button onclick="calc()">계산하기</button>
  </div>

  <div class="card">
    <div class="log" id="result">결과가 여기에 표시됩니다.</div>
  </div>

<script>
function f(n){return n.toLocaleString('ko-KR')}
function calc(){
 const exp=Number(document.getElementById('expectedPrice').value);
 const rate=Number(document.getElementById('lowerRate').value);
 if(!exp||!rate){document.getElementById('result').textContent='예정가격과 낙찰하한율을 모두 입력하세요.';return;}
 const lower=exp*(rate/100);
 const rec1=lower*1.002, rec2=lower*1.003, rec3=lower*1.005;
 let t='① 하한가: '+f(Math.round(lower))+'원 ('+rate+'%)';
 t+='\n② 추천 입찰가 (+0.2%): '+f(Math.round(rec1))+'원';
 t+='\n③ 추천 입찰가 (+0.3%): '+f(Math.round(rec2))+'원';
 t+='\n④ 추천 입찰가 (+0.5%): '+f(Math.round(rec3))+'원';
 document.getElementById('result').textContent=t;
}
</script>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  ),
);
