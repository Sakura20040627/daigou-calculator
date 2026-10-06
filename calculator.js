const $ = id => document.getElementById(id);
const money = n => '¥' + (Number(n) || 0).toFixed(2);
const labels = { quote:'0.055 包邮报价', goods:'商品折算', service:'代购费', traffic:'客户承担交通费', total:'客户总支付', xy:'闲鱼服务费', net:'扣费后到账', cost:'商品实际成本', tcost:'日本交通实际成本', international:'国际物流成本' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const FX_URL = 'https://api.frankfurter.dev/v2/rate/jpy/cny', FX_CACHE = 'sakura_fx_jpy_cny_v1';

function readRateCache() { try { return JSON.parse(localStorage.getItem(FX_CACHE) || 'null'); } catch { return null; } }
function applyCostRate(rate, date, source = '网络参考') {
  const value = Number(rate); if (!Number.isFinite(value) || value <= 0) return false;
  if ($('costRate').dataset.userEdited !== 'true') $('costRate').value = value.toFixed(5);
  $('rateStatus').textContent = `${date || '最新'} · ${source}`; calc(); return true;
}
async function refreshLiveRate() {
  const button = $('refreshRate'); button.classList.add('loading'); $('rateStatus').textContent = '正在获取网络汇率';
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(FX_URL, { cache:'no-store', signal:controller.signal });
    if (!response.ok) throw new Error('rate unavailable');
    const data = await response.json(); if (!applyCostRate(data.rate, data.date)) throw new Error('invalid rate');
    try { localStorage.setItem(FX_CACHE, JSON.stringify({ rate:data.rate, date:data.date, savedAt:Date.now() })); } catch {}
  } catch {
    const cached = readRateCache(); if (!cached || !applyCostRate(cached.rate, cached.date, '缓存参考')) $('rateStatus').textContent = '网络不可用 · 可手动输入';
  } finally { clearTimeout(timer); button.classList.remove('loading'); }
}

function setupGlassSelect(select) {
  select.classList.add('native-select');
  const shell = document.createElement('div'); shell.className = 'glass-select';
  shell.innerHTML = '<button type="button" class="glass-select-trigger" aria-haspopup="listbox" aria-expanded="false"><span></span><i></i></button><div class="glass-select-menu" role="listbox"></div>';
  select.insertAdjacentElement('afterend', shell);
  const trigger = shell.querySelector('.glass-select-trigger'), text = trigger.querySelector('span'), menu = shell.querySelector('.glass-select-menu');
  const refresh = () => {
    text.textContent = select.options[select.selectedIndex]?.textContent || '请选择'; menu.innerHTML = '';
    [...select.options].forEach(option => {
      const button = document.createElement('button'); button.type = 'button'; button.className = `glass-select-option${option.selected ? ' selected' : ''}`;
      button.innerHTML = `<span>${escapeHtml(option.textContent)}</span><i aria-hidden="true">✓</i>`;
      button.onclick = event => { event.stopPropagation(); select.value = option.value; select.dispatchEvent(new Event('change', { bubbles:true })); shell.classList.remove('open'); refresh(); };
      menu.appendChild(button);
    });
  };
  trigger.onclick = event => { event.stopPropagation(); const opening = !shell.classList.contains('open'); shell.classList.toggle('open', opening); trigger.setAttribute('aria-expanded', String(opening)); };
  select.addEventListener('change', refresh); select._glassRefresh = refresh; refresh();
  document.addEventListener('click', () => shell.classList.remove('open'));
}

function setMode() {
  const allIn = $('pricingMode').value === 'allin';
  document.querySelectorAll('.all-in-field').forEach(el => { el.classList.toggle('is-active', allIn); el.toggleAttribute('inert', !allIn); el.setAttribute('aria-hidden', String(!allIn)); });
  document.querySelectorAll('.legacy-field').forEach(el => { el.classList.toggle('is-active', !allIn); el.toggleAttribute('inert', allIn); el.setAttribute('aria-hidden', String(allIn)); });
  $('pricingNote').innerHTML = allIn
    ? '<b>0.055 包邮规则</b>　客户支付 = 商品日元价 × 0.055；报价已包含国际物流，利润中按 60 元/kg 扣除实际国际物流成本。'
    : '<b>旧阶梯规则</b>　不足 10,000 日元客户承担全部日本交通费；10,000–19,999 承担一半；20,000 以上免交通费。';
  if ($('pricingNote').animate) $('pricingNote').animate([{ opacity:.45, transform:'translateY(5px)' }, { opacity:1, transform:'translateY(0)' }], { duration:220, easing:'cubic-bezier(.2,.8,.2,1)' });
  $('pricingMode')._glassRefresh?.();
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
$('costRate').addEventListener('input', () => { $('costRate').dataset.userEdited = 'true'; });
$('refreshRate').onclick = () => { $('costRate').dataset.userEdited = ''; refreshLiveRate(); };
$('pricingMode').onchange = setMode;
setupGlassSelect($('pricingMode'));
setMode();
refreshLiveRate();

