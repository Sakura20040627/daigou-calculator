const SUPABASE_URL = 'https://qasjwpsgnchwxidpfaai.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RmQkPdQmjSMQh13L2T6-9w_XnCcSxw-';
let db = window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';
function loadSupabase() {
  if (db) return Promise.resolve(db);
  if (window.__sakuraSupabaseLoader) return window.__sakuraSupabaseLoader;
  window.__sakuraSupabaseLoader = new Promise(resolve => {
    const script = document.createElement('script');
    script.src = SUPABASE_CDN; script.async = true;
    script.onload = () => { db = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY) || null; resolve(db); };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return window.__sakuraSupabaseLoader;
}
const LEGACY = 'sakura_orders_v4', LOCAL = 'sakura_orders_local_v1';
let orders = [], editing = null, filter = '全部', session = null, localMode = false, storageWarningShown = false;
const $ = id => document.getElementById(id);
const money = n => '¥' + (Number(n) || 0).toFixed(2);
const statuses = ['全部', '待购买', '已购买', '日本运输', '已发国内', '已完成', '已取消'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const withTimeout = (promise, ms = 12000) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时，请检查网络连接')), ms))]);

function calc(p, t, s, c, x, f) {
  const traffic = (p < 1e4 ? t : p < 2e4 ? t / 2 : 0) * s;
  const total = p * s + p * s * f / 100 + traffic;
  return { customerTotal: total, profit: total - total * x / 100 - p * c - t * c };
}
function toDb(o) {
  return { user_id:session.user.id, client_order_id:o.id, order_date:o.date, status:o.status, product:o.product, customer:o.customer || '', price_jpy:o.priceJPY || 0, transport_jpy:o.transportJPY || 0, sell_rate:o.sellRate || 0, cost_rate:o.costRate || 0, xianyu_rate:o.xianyuRate || 0, service_rate:o.serviceRate || 0, remark:o.remark || '', customer_total:o.customerTotal || 0, profit:o.profit || 0, updated_at:new Date().toISOString() };
}
function fromDb(o) {
  return { id:o.client_order_id, date:o.order_date, status:o.status, product:o.product, customer:o.customer, priceJPY:+o.price_jpy, transportJPY:+o.transport_jpy, sellRate:+o.sell_rate, costRate:+o.cost_rate, xianyuRate:+o.xianyu_rate, serviceRate:+o.service_rate, remark:o.remark, customerTotal:+o.customer_total, profit:+o.profit };
}
function readLocal(key) { try { return localStorage.getItem(key); } catch { return null; } }
function writeLocal(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
function removeLocal(key) { try { localStorage.removeItem(key); } catch {} }
function localLoad() {
  try { const parsed = JSON.parse(readLocal(LOCAL) || '[]'); orders = Array.isArray(parsed) ? parsed : []; } catch { orders = []; }
  render();
}
function localSave() {
  const ok = writeLocal(LOCAL, JSON.stringify(orders));
  if (!ok && !storageWarningShown) { storageWarningShown = true; toast('浏览器阻止了本地存储，当前订单仅暂存于本页面；请允许此网站使用存储'); }
  return ok;
}
async function refresh() {
  if (!db || !session) return localLoad();
  const { data, error } = await withTimeout(db.from('orders').select('*').order('order_date', { ascending:false }));
  if (error) throw error;
  orders = (data || []).map(fromDb); render();
}
async function migrate() {
  if (!db || !session) return;
  let old = []; try { old = JSON.parse(readLocal(LEGACY) || '[]'); } catch {}
  if (!old.length) return;
  const { error } = await withTimeout(db.from('orders').upsert(old.map(toDb), { onConflict:'user_id,client_order_id' }));
  if (error) throw error;
  removeLocal(LEGACY); toast(`已迁移 ${old.length} 笔旧订单`);
}
function renderFilters() {
  const el = $('filters'); if (!el) return;
  el.innerHTML = statuses.map(s => `<button class="filter ${s === filter ? 'active' : ''}" data-f="${s}">${s}</button>`).join('');
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; renderFilters(); render(); });
}
function badge(s) { return `<span class="badge ${s === '已完成' ? 'done' : s === '已取消' ? 'cancel' : ['日本运输','已发国内'].includes(s) ? 'transit' : ''}">${esc(s)}</span>`; }
function render() {
  const body = $('body'); if (!body) return;
  const q = ($('search')?.value || '').toLowerCase();
  const rows = orders.filter(o => (filter === '全部' || o.status === filter) && [o.id,o.product,o.customer].join(' ').toLowerCase().includes(q));
  body.innerHTML = rows.map(o => `<tr><td><b>${esc(o.id)}</b><small>${esc(o.date)}</small></td><td><b>${esc(o.product)}</b><small>${esc(o.customer || '未填写客户')}</small></td><td>¥${(+o.priceJPY || 0).toLocaleString()}</td><td>${money(o.customerTotal)}</td><td class="profitCell">${money(o.profit)}</td><td>${badge(o.status)}</td><td><button class="dots" data-edit="${esc(o.id)}">•••</button></td></tr>`).join('');
  if ($('empty')) $('empty').style.display = rows.length ? 'none' : 'block';
  const valid = orders.filter(o => o.status !== '已取消'), done = orders.filter(o => o.status === '已完成').length;
  if ($('nOrders')) $('nOrders').textContent = orders.length;
  if ($('nDone')) $('nDone').textContent = done;
  if ($('doneRate')) $('doneRate').textContent = `完成率 ${orders.length ? (done / orders.length * 100).toFixed(0) : 0}%`;
  if ($('revenue')) $('revenue').textContent = money(valid.reduce((n,o) => n + (+o.customerTotal || 0), 0));
  if ($('profit')) $('profit').textContent = money(valid.reduce((n,o) => n + (+o.profit || 0), 0));
  body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => open(orders.find(o => o.id === b.dataset.edit)));
}
function open(o) {
  if (!$('backdrop')) return;
  editing = o?.id || null;
  if ($('modalTitle')) $('modalTitle').textContent = o ? '编辑订单' : '新建订单';
  if ($('remove')) $('remove').style.visibility = o ? 'visible' : 'hidden';
  const defaults = { date:new Date().toISOString().slice(0,10), status:'待购买', priceJPY:1e4, transportJPY:1e3, sellRate:.045, costRate:.0438, xianyuRate:.6, serviceRate:10 };
  Object.keys(defaults).concat(['product','customer','remark']).forEach(id => { if ($(id)) $(id).value = o?.[id] ?? defaults[id] ?? ''; });
  $('backdrop').classList.add('open');
}
function close() { if ($('backdrop')) $('backdrop').classList.remove('open'); editing = null; }
function toast(message) {
  const el = $('toast'); if (!el) return;
  el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}
function authMessage(message) { if ($('authError')) $('authError').textContent = message || ''; }
function enterLocal() { localMode = true; session = null; if ($('auth')) $('auth').classList.add('hidden'); localLoad(); toast('已进入本地模式，数据保存在此设备'); }

if ($('authForm')) $('authForm').onsubmit = async e => {
  e.preventDefault();
  if (!db) return authMessage('云端服务暂时不可用，可先使用本地模式');
  const button = $('authForm').querySelector('button[type="submit"]'), email = $('authEmail')?.value.trim() || '', password = $('authPassword')?.value || '';
  if (!email || password.length < 6) return authMessage('请输入邮箱和至少 6 位密码');
  if (button) { button.disabled = true; button.textContent = '登录中…'; }
  authMessage('');
  try { const { error } = await withTimeout(db.auth.signInWithPassword({ email, password })); if (error) authMessage(error.message || '登录失败，请检查邮箱和密码'); }
  catch (error) { authMessage(error?.message || '登录请求失败，请检查网络后重试'); }
  finally { if (button) { button.disabled = false; button.textContent = '登录云端'; } }
};
if ($('signup')) $('signup').onclick = async () => {
  const email = $('authEmail')?.value.trim() || '', password = $('authPassword')?.value || '';
  if (!db) return authMessage('云端服务暂时不可用，可先使用本地模式');
  if (!email || password.length < 6) return authMessage('请输入邮箱和至少 6 位密码');
  const button = $('signup'); if (button) { button.disabled = true; button.textContent = '注册中…'; }
  authMessage('正在创建账号…');
  try {
    const { data, error } = await withTimeout(db.auth.signUp({ email, password, options:{ emailRedirectTo:location.href.split('#')[0] } }));
    if (error) return authMessage(error.message || '注册失败，请稍后重试');
    if (data?.session) return authMessage('注册成功，正在进入云端 ERP…');
    authMessage('注册已提交，请查收确认邮件；若收不到，请检查垃圾邮件或在 Supabase 配置 SMTP。');
  } catch (error) { authMessage(error?.message || '注册请求失败，请检查网络后重试'); }
  finally { if (button) { button.disabled = false; button.textContent = '注册新账户'; } }
};
if ($('guest')) $('guest').onclick = enterLocal;
if ($('new')) $('new').onclick = () => open();
if ($('close')) $('close').onclick = close;
if ($('cancel')) $('cancel').onclick = close;
if ($('search')) $('search').oninput = render;
if ($('orderForm')) $('orderForm').onsubmit = async e => {
  e.preventDefault();
  const p = +$('priceJPY').value || 0, t = +$('transportJPY').value || 0, s = +$('sellRate').value || 0, c = +$('costRate').value || 0, x = +$('xianyuRate').value || 0, f = +$('serviceRate').value || 0;
  const o = { id:editing || 'DG-' + Date.now().toString().slice(-8), date:$('date').value, status:$('status').value, product:$('product').value.trim(), customer:$('customer').value.trim(), priceJPY:p, transportJPY:t, sellRate:s, costRate:c, xianyuRate:x, serviceRate:f, remark:$('remark').value.trim(), ...calc(p,t,s,c,x,f) };
  if (!o.product) return toast('请填写商品名称');
  if (localMode || !session || !db) {
    const i = orders.findIndex(v => v.id === o.id); i < 0 ? orders.unshift(o) : orders[i] = o;
    const persisted = localSave(); close(); render(); toast(persisted ? '已保存到本机' : '已创建订单，但浏览器未允许持久化，请允许网站存储'); return;
  }
  const saveButton = $('orderForm').querySelector('button[type="submit"]'); if (saveButton) saveButton.disabled = true;
  try { const { error } = await withTimeout(db.from('orders').upsert(toDb(o), { onConflict:'user_id,client_order_id' })); if (error) return toast('保存失败：' + error.message); close(); await refresh(); toast('已保存到云端'); }
  catch (error) { toast('保存失败：' + (error?.message || '网络异常')); }
  finally { if (saveButton) saveButton.disabled = false; }
};
if ($('remove')) $('remove').onclick = async () => {
  if (!editing || !confirm('确定删除这笔订单吗？')) return;
  if (localMode || !session || !db) { orders = orders.filter(o => o.id !== editing); const persisted = localSave(); close(); render(); toast(persisted ? '已删除' : '已删除当前订单，但浏览器未允许持久化'); return; }
  try { const { error } = await withTimeout(db.from('orders').delete().eq('client_order_id', editing)); if (error) return toast('删除失败：' + error.message); close(); await refresh(); toast('已删除'); }
  catch (error) { toast('删除失败：' + (error?.message || '网络异常')); }
};
let authBound = false;
function bindAuth() {
  if (authBound || !db?.auth?.onAuthStateChange) return;
  authBound = true;
  db.auth.onAuthStateChange((_event, s) => { session = s; if ($('auth')) $('auth').classList.toggle('hidden', !!s || localMode); if (s && !localMode) refresh().catch(error => toast('云端加载失败：' + (error?.message || '网络异常'))); });
}
async function initCloud() {
  if (!db) await loadSupabase();
  if (!db) { authMessage('云端脚本加载失败，可点击“先本地使用”；'); return; }
  if (localMode) return;
  bindAuth();
  try { const { data, error } = await withTimeout(db.auth.getSession()); if (error) throw error; session = data.session; if ($('auth')) $('auth').classList.toggle('hidden', !!session); if (session) { await migrate(); await refresh(); } }
  catch (error) { authMessage('云端暂时无法连接，可点击“先本地使用”；' + (error?.message || '')); }
}
initCloud();
renderFilters();
