// ============================================================
// SUPABASE SYNC — orders, customers, categories, menus, customerTypes,
// promotions, ingredients, expenses, addonGroups (array tables) +
// shopInfo, gpSettings, printerSettings, expenseCategories, orderSeq
// (singleton settings, stored in one key-value "settings" table)
// ============================================================
// แนวคิด: localStorage ('ld_xxx') ยังคงเป็นแหล่งข้อมูลหลักที่ทุกหน้าจอ
// อ่าน/เขียนเหมือนเดิมทุกอย่าง (DB.get / DB.set ไม่เปลี่ยนพฤติกรรม) —
// โมดูลนี้แค่ "แอบ" ส่งข้อมูลที่เปลี่ยนขึ้น Supabase เบื้องหลังแบบ diff
// (เฉพาะรายการที่เปลี่ยนจริง) และดึงข้อมูลจากเครื่องอื่นๆ ลงมาตอนเปิดแอป
// + แบบเรียลไทม์ ทำให้ POS หลายเครื่อง/หลายอุปกรณ์เห็นข้อมูลตรงกัน โดย
// แอปยังทำงานออฟไลน์ได้เหมือนเดิม (ถ้าออฟไลน์ หรือยังไม่ตั้งค่า Supabase
// → ทำงาน local-only เหมือนก่อนหน้านี้ทุกประการ ไม่กระทบของเดิม)
//
// รูปภาพ (โลโก้ร้าน / QR) ยังอยู่ IndexedDB อย่างเดียว ไม่ซิงค์ในเฟสนี้
// (ไฟล์ใหญ่ ไม่เหมาะกับ Postgres row — ค่อยทำทีหลังถ้าต้องการ)
// ============================================================

// ── ตั้งค่า Supabase ตรงนี้ ──────────────────────────────────
const SUPABASE_CONFIG = {
  url: 'https://osrydesgenxyikngmgbg.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcnlkZXNnZW54eWlrbmdtZ2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNTAwMzMsImV4cCI6MjEwMTkyNjAzM30.UugZVQEw9bil9dv6PUv6NtR1-dGsR6s2XthtMiGynpk',
};

const SyncEngine = (() => {
  // ── array-of-records tables: diff-by-id sync ──────────────────
  // ลำดับที่ใส่ไว้ตรงนี้คือลำดับที่ bootstrap() จะดึง/ดันข้อมูล — ไม่มี
  // foreign key ผูกกันจริงในฐานข้อมูล (แอปเองก็ไม่บังคับ referential
  // integrity ใน localStorage อยู่แล้ว) ลำดับนี้แค่จัดให้อ่านง่าย
  function orderToRow(o) {
    return {
      id: o.id, order_no: o.orderNo, date: o.date, time: o.time, type: o.type,
      ref_no: o.refNo || '', customer_id: o.customer ? o.customer.id : null,
      customer_name: o.customer ? o.customer.name : null, items: o.items,
      subtotal: o.subtotal, discount: o.discount, total: o.total, cost: o.cost,
      profit: o.profit, pay_method: o.payMethod, promo_id: o.promoId ?? null,
      status: o.status, received: o.received, change: o.change,
      updated_at: new Date().toISOString(),
    };
  }
  function rowToOrder(r) {
    return {
      id: r.id, orderNo: r.order_no, date: r.date, time: r.time, type: r.type,
      refNo: r.ref_no || '', customer: r.customer_id ? { id: r.customer_id, name: r.customer_name } : null,
      items: r.items || [], subtotal: r.subtotal, discount: r.discount, total: r.total,
      cost: r.cost, profit: r.profit, payMethod: r.pay_method, promoId: r.promo_id,
      status: r.status, received: r.received, change: r.change,
    };
  }
  function customerToRow(c) {
    return {
      id: c.id, name: c.name, phone: c.phone || '', type: c.type,
      total: c.total || 0, last_order: c.lastOrder || null,
      updated_at: new Date().toISOString(),
    };
  }
  function rowToCustomer(r) {
    return { id: r.id, name: r.name, phone: r.phone || '', type: r.type, total: r.total || 0, lastOrder: r.last_order };
  }
  function categoryToRow(c) { return { id: c.id, icon: c.icon || '', name: c.name, updated_at: new Date().toISOString() }; }
  function rowToCategory(r) { return { id: r.id, icon: r.icon || '', name: r.name }; }

  function menuToRow(m) {
    return {
      id: m.id, icon: m.icon || '', name: m.name, cat: m.cat,
      p1: m.p1, p2: m.p2, p3: m.p3, cost: m.cost,
      recipe: m.recipe || [], addon_groups: m.addonGroups || [],
      updated_at: new Date().toISOString(),
    };
  }
  function rowToMenu(r) {
    return { id: r.id, icon: r.icon || '', name: r.name, cat: r.cat, p1: r.p1, p2: r.p2, p3: r.p3, cost: r.cost, recipe: r.recipe || [], addonGroups: r.addon_groups || [] };
  }

  function custTypeToRow(t) { return { id: t.id, name: t.name, updated_at: new Date().toISOString() }; }
  function rowToCustType(r) { return { id: r.id, name: r.name }; }

  function promoToRow(p) {
    return {
      id: p.id, name: p.name, value: p.value, type: p.type, used: p.used || 0,
      total_discount: p.totalDiscount || 0, active: !!p.active,
      start_date: p.start || '', end_date: p.end || '',
      updated_at: new Date().toISOString(),
    };
  }
  function rowToPromo(r) {
    return { id: r.id, name: r.name, value: r.value, type: r.type, used: r.used || 0, totalDiscount: r.total_discount || 0, active: r.active, start: r.start_date || '', end: r.end_date || '' };
  }

  function ingToRow(i) {
    return {
      id: i.id, name: i.name, unit: i.unit || '', price: i.price,
      price_type: i.priceType || 'thb', stock: i.stock, expiry: i.expiry || '',
      updated_at: new Date().toISOString(),
    };
  }
  function rowToIng(r) {
    return { id: r.id, name: r.name, unit: r.unit || '', price: r.price, priceType: r.price_type || 'thb', stock: r.stock, expiry: r.expiry || '' };
  }

  function expToRow(e) {
    return {
      id: e.id, cat: e.cat || '', name: e.name, amount: e.amount,
      date: e.date || '', note: e.note || '', receipt: !!e.receipt,
      updated_at: new Date().toISOString(),
    };
  }
  function rowToExp(r) {
    return { id: r.id, cat: r.cat || '', name: r.name, amount: r.amount, date: r.date || '', note: r.note || '', receipt: r.receipt };
  }

  function addonGroupToRow(g) {
    return { id: g.id, name: g.name, required: !!g.required, multi: !!g.multi, options: g.options || [], updated_at: new Date().toISOString() };
  }
  function rowToAddonGroup(r) {
    return { id: r.id, name: r.name, required: r.required, multi: r.multi, options: r.options || [] };
  }

  const SYNC_TABLES = {
    customers: 'customers', categories: 'categories', customerTypes: 'customer_types',
    addonGroups: 'addon_groups', ingredients: 'ingredients', promotions: 'promotions',
    menus: 'menus', orders: 'orders', expenses: 'expenses',
  };
  const toRow = {
    customers: customerToRow, categories: categoryToRow, customerTypes: custTypeToRow,
    addonGroups: addonGroupToRow, ingredients: ingToRow, promotions: promoToRow,
    menus: menuToRow, orders: orderToRow, expenses: expToRow,
  };
  const fromRow = {
    customers: rowToCustomer, categories: rowToCategory, customerTypes: rowToCustType,
    addonGroups: rowToAddonGroup, ingredients: rowToIng, promotions: rowToPromo,
    menus: rowToMenu, orders: rowToOrder, expenses: rowToExp,
  };

  // ── singleton settings: whole-object upsert into one "settings" table ──
  const SETTINGS_KEYS = ['shopInfo', 'gpSettings', 'printerSettings', 'expenseCategories', 'orderSeq'];

  const QUEUE_KEY = 'ld_syncQueue';
  const SNAP_PREFIX = 'ld_syncSnapshot_';

  let client = null;
  let ready = false;
  let flushing = false;
  let statusEl = null;

  function configured() {
    return SUPABASE_CONFIG.url.startsWith('http') &&
           !SUPABASE_CONFIG.url.includes('YOUR-PROJECT-REF') &&
           SUPABASE_CONFIG.anonKey && SUPABASE_CONFIG.anonKey !== 'YOUR-ANON-PUBLIC-KEY';
  }

  function setStatus(state) {
    if (!statusEl) statusEl = document.getElementById('syncStatusDot');
    if (!statusEl) return;
    statusEl.dataset.state = state;
    const labels = { off:'ยังไม่เชื่อมต่อ Supabase', syncing:'กำลังซิงค์…', synced:'ซิงค์ล่าสุด: '+new Date().toLocaleTimeString('th-TH'), error:'ซิงค์ไม่สำเร็จ — จะลองใหม่อัตโนมัติ' };
    statusEl.title = labels[state] || '';
  }

  async function upsertInBatches(table, rows, size = 500) {
    for (let i = 0; i < rows.length; i += size) {
      const { error } = await client.from(table).upsert(rows.slice(i, i + size));
      if (error) throw error;
    }
  }

  // ── offline queue (persisted so a page reload doesn't lose pending writes) ──
  function loadQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } }
  function saveQueue(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {} }
  function enqueue(job) { const q = loadQueue(); q.push(job); saveQueue(q); }

  async function flushQueue() {
    if (!ready || flushing) return;
    flushing = true;
    setStatus('syncing');
    let q = loadQueue();
    try {
      while (q.length) {
        const job = q[0];
        if (job.op === 'upsert') {
          await upsertInBatches(SYNC_TABLES[job.key], job.rows);
        } else if (job.op === 'delete') {
          const { error } = await client.from(SYNC_TABLES[job.key]).delete().in('id', job.ids);
          if (error) throw error;
        } else if (job.op === 'setting') {
          const { error } = await client.from('settings').upsert({ key: job.key, value: job.value, updated_at: new Date().toISOString() });
          if (error) throw error;
        }
        q.shift();
        saveQueue(q);
      }
      setStatus('synced');
    } catch (e) {
      console.error('[sync] flush failed, will retry:', e.message || e);
      setStatus('error');
    } finally {
      flushing = false;
    }
  }

  // ── called from DB.set() ──────────────────────────────────────
  function onSet(key, value) {
    if (!ready) return; // local-only mode: nothing to do

    if (SETTINGS_KEYS.includes(key)) {
      enqueue({ op: 'setting', key, value });
      flushQueue();
      return;
    }

    if (!SYNC_TABLES[key]) return;
    const newArr = value;
    const snapKey = SNAP_PREFIX + key;
    let prev = [];
    try { prev = JSON.parse(localStorage.getItem(snapKey) || '[]'); } catch {}
    const prevMap = new Map(prev.map(r => [r.id, r]));
    const newMap = new Map(newArr.map(r => [r.id, r]));

    const changed = [];
    for (const [id, rec] of newMap) {
      const old = prevMap.get(id);
      if (!old || JSON.stringify(old) !== JSON.stringify(rec)) changed.push(rec);
    }
    const removedIds = [];
    for (const id of prevMap.keys()) if (!newMap.has(id)) removedIds.push(id);

    if (changed.length) enqueue({ op: 'upsert', key, rows: changed.map(toRow[key]) });
    if (removedIds.length) enqueue({ op: 'delete', key, ids: removedIds });

    localStorage.setItem(snapKey, JSON.stringify(newArr));
    if (changed.length || removedIds.length) flushQueue();
  }

  // ── first load: pull remote, merge with local, one-time push if remote empty ──
  async function bootstrap() {
    if (!ready) return;
    setStatus('syncing');

    for (const key of Object.keys(SYNC_TABLES)) {
      const table = SYNC_TABLES[key];
      try {
        const { data: rows, error } = await client.from(table).select('*');
        if (error) throw error;
        const local = DB.get(key);

        if ((!rows || rows.length === 0) && local.length > 0) {
          await upsertInBatches(table, local.map(toRow[key]));
          localStorage.setItem(SNAP_PREFIX + key, JSON.stringify(local));
        } else if (rows && rows.length > 0) {
          const remoteRecs = rows.map(fromRow[key]);
          const remoteIds = new Set(remoteRecs.map(r => r.id));
          const localOnly = local.filter(r => !remoteIds.has(r.id));
          const merged = [...remoteRecs, ...localOnly].sort((a, b) => a.id - b.id);
          localStorage.setItem(SNAP_PREFIX + key, JSON.stringify(merged));
          DB.set(key, merged);
        } else {
          localStorage.setItem(SNAP_PREFIX + key, JSON.stringify(local));
        }
      } catch (e) {
        console.error('[sync] bootstrap failed for', table, e.message || e);
      }
    }

    // singleton settings
    try {
      const { data: rows, error } = await client.from('settings').select('*');
      if (error) throw error;
      const remoteMap = new Map((rows || []).map(r => [r.key, r.value]));
      for (const key of SETTINGS_KEYS) {
        if (remoteMap.has(key)) {
          DB.set(key, remoteMap.get(key));
        } else if (localStorage.getItem('ld_' + key) !== null) {
          enqueue({ op: 'setting', key, value: DB.get(key) });
        }
      }
      await flushQueue();
    } catch (e) {
      console.error('[sync] bootstrap failed for settings', e.message || e);
    }

    // orderSeq reconciliation: never let the local counter fall behind the
    // highest order id seen across any device, now that >1 device can create
    // orders. This is a floor, not a hard concurrency guarantee — two POS
    // terminals both offline at the same moment can still in theory pick the
    // same number. Fine for this shop's normal single/low-concurrency use;
    // revisit with a Postgres-side atomic counter if that ever becomes a
    // real problem.
    try {
      const orders = DB.get('orders');
      const maxOrderId = orders.reduce((m, o) => Math.max(m, o.id || 0), 0);
      const seq = DB.get('orderSeq', 1000001);
      if (maxOrderId >= seq) DB.set('orderSeq', maxOrderId + 1);
    } catch (e) { console.error('[sync] orderSeq reconcile failed', e); }

    setStatus('synced');
    subscribeRealtime();
  }

  // ── realtime: pick up changes made from other devices ────────
  function subscribeRealtime() {
    if (!ready) return;
    let channel = client.channel('ld_sync');
    for (const key of Object.keys(SYNC_TABLES)) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: SYNC_TABLES[key] }, handleRemoteChange(key));
    }
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, handleRemoteSettingChange);
    channel.subscribe();
  }
  function handleRemoteChange(key) {
    return (payload) => {
      const local = DB.get(key);
      const map = new Map(local.map(r => [r.id, r]));
      if (payload.eventType === 'DELETE') {
        map.delete(payload.old.id);
      } else {
        const rec = fromRow[key](payload.new);
        map.set(rec.id, rec);
      }
      const merged = [...map.values()].sort((a, b) => a.id - b.id);
      localStorage.setItem('ld_' + key, JSON.stringify(merged));
      localStorage.setItem(SNAP_PREFIX + key, JSON.stringify(merged));
      refreshUiIfSafe();
      setStatus('synced');
    };
  }
  function handleRemoteSettingChange(payload) {
    const row = payload.new || payload.old;
    if (!row || !SETTINGS_KEYS.includes(row.key)) return;
    if (payload.eventType === 'DELETE') return;
    localStorage.setItem('ld_' + row.key, JSON.stringify(row.value));
    refreshUiIfSafe();
    setStatus('synced');
  }
  function refreshUiIfSafe() {
    if (!document.querySelector('.modal.open') && typeof showPage === 'function') {
      showPage(currentPage);
    }
  }

  function init() {
    if (!configured()) { console.info('[sync] Supabase not configured — running local-only (as before).'); setStatus('off'); return; }
    if (typeof supabase === 'undefined') { console.warn('[sync] supabase-js failed to load — running local-only.'); setStatus('off'); return; }
    client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    ready = true;
    window.addEventListener('online', flushQueue);
    flushQueue();
    bootstrap();
  }

  return { init, onSet };
})();
