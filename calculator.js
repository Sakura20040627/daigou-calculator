const $ = id => document.getElementById(id);
const money = n => '¥' + (Number(n) || 0).toFixed(2);
const labels = { quote:'0.055 包邮报价', goods:'商品折算', service:'代购费', traffic:'客户承担交通费', total:'客户总支付', xy:'闲鱼服务费', net:'扣费后到账', cost:'商品实际成本', tcost:'日本交通实际成本', international:'国际物流成本' };

function setMode() {
  const allIn = $('pricingMode').value === 'allin';
  document.querySelectorAll('.all-in-field').forEach(el => el.hidden = !allIn);
  document.querySelectorAll('.legacy-field').forEach(el => el.hidden = allIn);
  $('pricingNote').innerHTML = allIn
    ? '<b>0.055 包邮规则</b>　客户支付 = 商品日元价 × 0.055；报价已包含国际物流，利润中按 60 元/kg 扣除实际国际物流成本。'
    : '<b>旧阶梯规则</b>　不足 10,000 日元客户承担全部日本交通费；10,000–19,999 承担一半；20,000 以上免交通费。';
  calc();
}

function calc() {
  const p = +$('price').value || 0, t = +$('transport').value || 0, c = +$('costRate').value || 0, x = (+$('xianyuRate').value || 0) / 100;
  const allIn = $('pricingMode').value === 'allin';
  let total, values;
  if (allIn) {
    const quote = p * .055, international = (+$('shippingKg').value || 0) * 60;
    total = quote;
    values = { quote, total, xy:total * x, net:total * (1 - x), cost:p * c, tcost:t * c, international };
  } else {
    const s = +$('legacySellRate').value || 0, f = (+$('serviceRate').value || 0) / 100;
    const goods = p * s, service = goods * f, traffic = (p < 1e4 ? t : p < 2e4 ? t / 2 : 0) * s;
    total = goods + service + traffic;
    values = { goods, service, traffic, total, xy:total * x, net:total * (1 - x), cost:p * c, tcost:t * c };
  }
  const profit = values.net - values.cost - values.tcost - (values.international || 0), rate = total ? profit / total * 100 : 0;
  $('profit').textContent = money(profit);
  $('rate').textContent = `利润率 ${rate.toFixed(2)}%`;
  $('rows').innerHTML = Object.entries(values).map(([key, value]) => `<div><span>${labels[key]}</span><b>${money(value)}</b></div>`).join('');
}

document.querySelectorAll('input').forEach(el => el.oninput = calc);
$('pricingMode').onchange = setMode;
setMode();

