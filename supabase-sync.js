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
      profit: o.profit, pay_method: o.payMethod, promo_ids: o.promoIds && o.promoIds.length ? o.promoIds : null,
      status: o.status, received: o.received, change: o.change,
      gp_pct: o.gpPct ?? null, gp_amount: o.gpAmount ?? null, net_revenue: o.netRevenue ?? null,
      salesperson: o.salesperson || null, is_advertisement: !!o.isAdvertisement,
      import_hash:o.importHash||null, import_source:o.importSource||null, import_notes:o.importNotes||null,
      updated_at: new Date().toISOString(),
    };
  }
  function rowToOrder(r) {
    return {
      id: r.id, orderNo: r.order_no, date: r.date, time: r.time, type: r.type,
      refNo: r.ref_no || '', customer: r.customer_id ? { id: r.customer_id, name: r.customer_name } : null,
      items: r.items || [], subtotal: r.subtotal, discount: r.discount, total: r.total,
      cost: r.cost, profit: r.profit, payMethod: r.pay_method, promoIds: r.promo_ids || [],
      status: r.status, received: r.received, change: r.change,
      gpPct: r.gp_pct, gpAmount: r.gp_amount, netRevenue: r.net_revenue,
      salesperson: r.salesperson || null, isAdvertisement: !!r.is_advertisement,
      importHash:r.import_hash||null, importSource:r.import_source||null, importNotes:r.import_notes||'',
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
      purchase_price: i.purchasePrice ?? null, purchase_qty: i.purchaseQty ?? null,
      updated_at: new Date().toISOString(),
    };
  }
  function rowToIng(r) {
    return { id: r.id, name: r.name, unit: r.unit || '', price: r.price, priceType: r.price_type || 'thb', stock: r.stock, expiry: r.expiry || '', purchasePrice: r.purchase_price, purchaseQty: r.purchase_qty };
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
  const SETTINGS_KEYS = ['shopInfo', 'gpSettings', 'printerSettings', 'expenseCategories', 'salespeople', 'adExpenses', 'orderSeq'];

  const QUEUE_KEY = 'ld_syncQueue';
  const SNAP_PREFIX = 'ld_syncSnapshot_';

  // Snapshot = แผนที่ id → ลายเซ็น (hash) ของแต่ละรายการ แทนการเก็บสำเนาข้อมูลทั้งก้อน
  // ใช้แค่ตรวจว่า "รายการไหนเปลี่ยน" ประหยัดพื้นที่ localStorage ลงเกือบครึ่งหนึ่งของที่แอปใช้เดิม
  function sigOf(rec) {
    const str = JSON.stringify(rec);
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = ((h1 << 5) + h1) ^ c; h2 = ((h2 * 33) ^ c) | 0; }
    return (h1 >>> 0).toString(36) + '.' + (h2 >>> 0).toString(36) + '.' + str.length.toString(36);
  }
  function readSnap(key) {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(SNAP_PREFIX + key) || 'null'); } catch {}
    const map = new Map();
    if (Array.isArray(raw)) { for (const r of raw) map.set(String(r.id), sigOf(r)); }          // รูปแบบเก่า (เก็บทั้งก้อน)
    else if (raw && raw.v === 2 && raw.m) { for (const id of Object.keys(raw.m)) map.set(id, raw.m[id]); }
    return map;
  }
  function writeSnap(key, arr) {
    const m = {};
    for (const r of arr) m[String(r.id)] = sigOf(r);
    try { localStorage.setItem(SNAP_PREFIX + key, JSON.stringify({ v: 2, m })); return true; }
    catch { try { localStorage.removeItem(SNAP_PREFIX + key); } catch {} return false; }
  }

  let client = null;
  let ready = false;
  let flushing = false;
  let statusEl = null;
  let rtChannel = null;
  let rtState = 'off';      // off | connecting | connected | reconnecting
  let lastOkAt = 0, lastError = '';
  let pulling = false;
  let catching = false;
  let lastCatchup = 0;
  let rtRetryTimer = null, rtRetryDelay = 3000;
  const LASTPULL_KEY = 'ld_syncLastPull';
  let lastPullAt = Number(localStorage.getItem(LASTPULL_KEY)) || 0;
  function markPulled(ts) { lastPullAt = ts; try { localStorage.setItem(LASTPULL_KEY, String(ts)); } catch {} }

  function configured() {
    return SUPABASE_CONFIG.url.startsWith('http') &&
           !SUPABASE_CONFIG.url.includes('YOUR-PROJECT-REF') &&
           SUPABASE_CONFIG.anonKey && SUPABASE_CONFIG.anonKey !== 'YOUR-ANON-PUBLIC-KEY';
  }

  function setStatus(state) {
    if (state === 'synced') { lastOkAt = Date.now(); lastError = ''; }
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
      lastError = 'ส่งขึ้นคลาวด์ไม่สำเร็จ: ' + (e.message || e);
      setStatus('error');
    } finally {
      flushing = false;
    }
  }


  // ดึงทุกแถวของตาราง (Supabase จำกัด 1000 แถว/คำขอ จึงต้องแบ่งหน้า)
  async function fetchAll(table, size = 1000) {
    let all = [], from = 0;
    for (;;) {
      const { data, error } = await client.from(table).select('*').order('id', { ascending: true }).range(from, from + size - 1);
      if (error) throw error;
      all = all.concat(data || []);
      if (!data || data.length < size) break;
      from += size;
    }
    return all;
  }

  // ── ปุ่ม "อัปเดตข้อมูลขึ้น Supabase" (manual full reconcile) ─────────
  // compare(): อ่านจากคลาวด์อย่างเดียว ไม่เขียนอะไร → คืนรายงาน
  // apply(report, includeDiff): ดันข้อมูลในเครื่องนี้ขึ้นคลาวด์ (upsert เท่านั้น ไม่ลบอะไรบนคลาวด์)
  function normV(v) {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
    if (Array.isArray(v)) return v.map(normV);
    if (typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach(k => { o[k] = normV(v[k]); }); return o; }
    return v;
  }
  function sameVal(a, b) { return JSON.stringify(normV(a)) === JSON.stringify(normV(b)); }
  function rowsEqual(localRow, remoteRow) {
    for (const k of Object.keys(localRow)) {
      if (k === 'updated_at') continue;
      if (!sameVal(localRow[k], remoteRow[k])) return false;
    }
    return true;
  }

  function isReady() { return ready; }

  async function compare() {
    if (!ready) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase (หรือโหลด supabase-js ไม่สำเร็จ)');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('ขณะนี้ออฟไลน์ — ต่ออินเทอร์เน็ตก่อน');
    const report = { tables: [], settings: [], errors: [], queued: loadQueue().length };

    for (const key of Object.keys(SYNC_TABLES)) {
      const table = SYNC_TABLES[key];
      try {
        const remote = await fetchAll(table);
        const rmap = new Map(remote.map(r => [String(r.id), r]));
        const local = DB.get(key);
        const missing = [], diff = [];
        for (const rec of local) {
          const row = toRow[key](rec);
          const rr = rmap.get(String(rec.id));
          if (!rr) missing.push(row);
          else if (!rowsEqual(row, rr)) diff.push(row);
        }
        report.tables.push({ key, table, localCount: local.length, remoteCount: remote.length, missing, diff });
      } catch (e) {
        report.errors.push({ name: table, message: e.message || String(e) });
      }
    }

    try {
      const { data: srows, error } = await client.from('settings').select('*');
      if (error) throw error;
      const rmap = new Map((srows || []).map(r => [r.key, r.value]));
      for (const key of SETTINGS_KEYS) {
        const raw = localStorage.getItem('ld_' + key);
        if (raw === null) continue;
        let value; try { value = JSON.parse(raw); } catch { continue; }
        const has = rmap.has(key);
        if (!has) { report.settings.push({ key, value, status: 'missing' }); continue; }
        const rv = rmap.get(key);
        // orderSeq: ห้ามถอยหลัง — ถ้าคลาวด์มากกว่าหรือเท่ากันถือว่าตรงกัน
        if (key === 'orderSeq') { if (Number(value) > Number(rv)) report.settings.push({ key, value, status: 'diff' }); continue; }
        if (!sameVal(value, rv)) report.settings.push({ key, value, status: 'diff' });
      }
    } catch (e) {
      report.errors.push({ name: 'settings', message: e.message || String(e) });
    }
    return report;
  }

  async function apply(report, includeDiff) {
    if (!ready) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase');
    setStatus('syncing');
    const result = { pushed: 0, errors: [] };
    const doneKeys = new Set();

    for (const t of report.tables) {
      const rows = includeDiff ? t.missing.concat(t.diff) : t.missing;
      if (!rows.length) continue;
      try {
        await upsertInBatches(t.table, rows);
        result.pushed += rows.length;
        doneKeys.add(t.key);
      } catch (e) {
        result.errors.push({ name: t.table, message: e.message || String(e) });
      }
    }
    for (const s of report.settings) {
      if (s.status === 'diff' && !includeDiff) continue;
      try {
        const { error } = await client.from('settings').upsert({ key: s.key, value: s.value, updated_at: new Date().toISOString() });
        if (error) throw error;
        result.pushed++;
        doneKeys.add('setting:' + s.key);
      } catch (e) {
        result.errors.push({ name: 'settings/' + s.key, message: e.message || String(e) });
      }
    }

    // ล้างงานค้างในคิวที่ซ้ำกับสิ่งที่เพิ่งดันขึ้นไป (กันของเก่าในคิวมาเขียนทับของใหม่) — เก็บคิวลบไว้
    try {
      const q = loadQueue().filter(j => {
        if (j.op === 'upsert') return !(doneKeys.has(j.key) && includeDiff) ;
        if (j.op === 'setting') return !doneKeys.has('setting:' + j.key);
        return true;
      });
      saveQueue(q);
      for (const t of report.tables) {
        if (doneKeys.has(t.key) && includeDiff) writeSnap(t.key, DB.get(t.key));
      }
    } catch (e) { console.error('[sync] queue cleanup failed', e); }

    setStatus(result.errors.length ? 'error' : 'synced');
    flushQueue();
    return result;
  }


  // ── ปุ่ม "ดึงข้อมูลล่าสุดจาก Supabase" (manual pull) ──────────────
  // ดึงทุกตารางจากคลาวด์มาทับ/เพิ่มในเครื่องนี้ (คลาวด์ชนะเมื่อ id ซ้ำ)
  // รายการที่มีเฉพาะในเครื่อง (ยังไม่ขึ้นคลาวด์) ไม่ถูกลบ — แจ้งจำนวนให้ไปกดปุ่มอัปเดตขึ้นคลาวด์
  async function pullAll() {
    if (!ready) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase (หรือโหลด supabase-js ไม่สำเร็จ)');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('ขณะนี้ออฟไลน์ — ต่ออินเทอร์เน็ตก่อน');
    if (pulling) throw new Error('กำลังดึงข้อมูลอยู่');
    pulling = true;
    setStatus('syncing');
    const pullStartedAt = Date.now();
    const result = { tables: [], localOnly: 0, errors: [] };
    try {
      for (const key of Object.keys(SYNC_TABLES)) {
        try {
          const rows = await fetchAll(SYNC_TABLES[key]);
          const remoteRecs = rows.map(fromRow[key]);
          const local = DB.get(key);
          const localMap = new Map(local.map(r => [String(r.id), r]));
          const remoteIds = new Set(remoteRecs.map(r => String(r.id)));
          const localOnly = local.filter(r => !remoteIds.has(String(r.id)));
          let changed = 0;
          for (const r of remoteRecs) {
            const l = localMap.get(String(r.id));
            if (!l) changed++; else if (JSON.stringify(normV(l)) !== JSON.stringify(normV(r))) changed++;
          }
          const merged = [...remoteRecs, ...localOnly].sort((a, b) => a.id - b.id);
          try {
            const json = JSON.stringify(merged);
            localStorage.setItem('ld_' + key, json);
            writeSnap(key, merged); // ถ้าพื้นที่เต็มจะข้าม snapshot — ข้อมูลจริงสำคัญกว่า
          } catch (qe) {
            throw new Error('บันทึกลงเครื่องไม่สำเร็จ (พื้นที่จัดเก็บเต็ม?) ' + (qe.message || qe));
          }
          result.tables.push({ key, changed, remoteCount: remoteRecs.length });
          result.localOnly += localOnly.length;
        } catch (e) {
          console.error('[pull] failed for', SYNC_TABLES[key], e);
          result.errors.push({ name: SYNC_TABLES[key], message: (e && (e.message || e.details || e.hint)) || JSON.stringify(e) || String(e) });
        }
      }
      try {
        const { data: srows, error } = await client.from('settings').select('*');
        if (error) throw error;
        for (const r of srows || []) {
          if (!SETTINGS_KEYS.includes(r.key)) continue;
          if (r.key === 'orderSeq') { const cur = Number(DB.get('orderSeq', 0)) || 0; if (Number(r.value) > cur) localStorage.setItem('ld_orderSeq', JSON.stringify(r.value)); continue; }
          localStorage.setItem('ld_' + r.key, JSON.stringify(r.value));
        }
      } catch (e) {
        result.errors.push({ name: 'settings', message: e.message || String(e) });
      }
      try {
        const maxOrderId = DB.get('orders').reduce((m, o) => Math.max(m, o.id || 0), 0);
        if (maxOrderId >= DB.get('orderSeq', 1000001)) localStorage.setItem('ld_orderSeq', JSON.stringify(maxOrderId + 1));
      } catch {}
      markPulled(pullStartedAt);
      subscribeRealtime(); // ต่อ Realtime ใหม่ เผื่อการเชื่อมต่อเดิมหลุด
      refreshUiIfSafe();
      setStatus(result.errors.length ? 'error' : 'synced');
    } finally {
      pulling = false;
    }
    return result;
  }


  // ── สุขภาพการซิงค์ + การใช้พื้นที่เก็บข้อมูลในเครื่อง (ใช้กับหน้าตั้งค่า) ──
  const STORAGE_LIMIT_CHARS = 5000000; // โควต้า localStorage ของเบราว์เซอร์ทั่วไปประมาณ 5 ล้านตัวอักษร (ประมาณการ)
  function storageUsage() {
    let used = 0; const per = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i), v = localStorage.getItem(k) || '';
        const n = k.length + v.length; used += n; per.push({ key: k, chars: n });
      }
    } catch {}
    per.sort((a, b) => b.chars - a.chars);
    return { usedChars: used, limitChars: STORAGE_LIMIT_CHARS, pct: Math.round(used / STORAGE_LIMIT_CHARS * 100), top: per.slice(0, 4) };
  }
  function getHealth() {
    return {
      configured: configured(), ready, online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
      rtState, lastOkAt, lastPullAt, queue: loadQueue().length, lastError, storage: storageUsage(),
    };
  }
  function reconnect() { if (!ready) return; rtRetryDelay = 3000; subscribeRealtime(); catchUp('manual', true); }
  function retryQueue() { return flushQueue(); }
  function migrateSnapshots() {
    for (const key of Object.keys(SYNC_TABLES)) {
      try {
        const raw = JSON.parse(localStorage.getItem(SNAP_PREFIX + key) || 'null');
        if (Array.isArray(raw)) writeSnap(key, raw); // แปลงรูปแบบเก่า (ทั้งก้อน) เป็นแบบย่อ ลดพื้นที่ที่ใช้
      } catch {}
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
    const prevSig = readSnap(key);
    const newMap = new Map(newArr.map(r => [r.id, r]));

    const changed = [];
    for (const [id, rec] of newMap) {
      const old = prevSig.get(String(id));
      if (!old || old !== sigOf(rec)) changed.push(rec);
    }
    const removedIds = [];
    const newKeys = new Set([...newMap.keys()].map(String));
    for (const id of prevSig.keys()) if (!newKeys.has(id)) removedIds.push(Number(id));

    if (changed.length) enqueue({ op: 'upsert', key, rows: changed.map(toRow[key]) });
    if (removedIds.length) enqueue({ op: 'delete', key, ids: removedIds });

    writeSnap(key, newArr);
    if (changed.length || removedIds.length) flushQueue();
  }

  // ── first load: pull remote, merge with local, one-time push if remote empty ──
  async function bootstrap() {
    if (!ready) return;
    setStatus('syncing');
    const bootStartedAt = Date.now();

    for (const key of Object.keys(SYNC_TABLES)) {
      const table = SYNC_TABLES[key];
      try {
        const rows = await fetchAll(table);
        const local = DB.get(key);

        if ((!rows || rows.length === 0) && local.length > 0) {
          await upsertInBatches(table, local.map(toRow[key]));
          writeSnap(key, local);
        } else if (rows && rows.length > 0) {
          const remoteRecs = rows.map(fromRow[key]);
          const remoteIds = new Set(remoteRecs.map(r => r.id));
          const localOnly = local.filter(r => !remoteIds.has(r.id));
          const merged = [...remoteRecs, ...localOnly].sort((a, b) => a.id - b.id);
          writeSnap(key, merged);
          DB.set(key, merged);
        } else {
          writeSnap(key, local);
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
    markPulled(bootStartedAt);
    subscribeRealtime();
  }

  // ── realtime: pick up changes made from other devices ────────
  function subscribeRealtime() {
    if (!ready) return;
    if (rtRetryTimer) { clearTimeout(rtRetryTimer); rtRetryTimer = null; }
    if (rtChannel) { const old = rtChannel; rtChannel = null; try { client.removeChannel(old); } catch {} }
    let channel = client.channel('ld_sync');
    for (const key of Object.keys(SYNC_TABLES)) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: SYNC_TABLES[key] }, handleRemoteChange(key));
    }
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, handleRemoteSettingChange);
    rtChannel = channel;
    rtState = 'connecting';
    channel.subscribe((status, err) => {
      if (channel !== rtChannel) return; // ช่องเก่าที่เราปิดเอง — ไม่ต้องทำอะไร
      if (status === 'SUBSCRIBED') {
        rtRetryDelay = 3000;
        rtState = 'connected';
        setStatus('synced');
        catchUp('subscribed', true); // ดึงสิ่งที่พลาดไประหว่างที่หลุด
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[sync] realtime', status, err || '');
        rtState = 'reconnecting';
        lastError = 'Realtime หลุด (' + status + ') — กำลังต่อใหม่';
        setStatus('error');
        if (!rtRetryTimer) {
          rtRetryTimer = setTimeout(() => { rtRetryTimer = null; subscribeRealtime(); }, rtRetryDelay);
          rtRetryDelay = Math.min(rtRetryDelay * 2, 60000);
        }
      }
    });
  }

  // ── รวมแถวจากคลาวด์เข้าเครื่อง (ใช้โดย catch-up) — คืน true ถ้ามีอะไรเปลี่ยน ──
  function mergeRemoteRecs(key, remoteRecs) {
    const local = DB.get(key);
    const map = new Map(local.map(r => [String(r.id), r]));
    let changed = false;
    for (const rec of remoteRecs) {
      const old = map.get(String(rec.id));
      if (!old || JSON.stringify(normV(old)) !== JSON.stringify(normV(rec))) { map.set(String(rec.id), rec); changed = true; }
    }
    if (!changed) return false;
    const merged = [...map.values()].sort((a, b) => a.id - b.id);
    const json = JSON.stringify(merged);
    localStorage.setItem('ld_' + key, json); // ถ้าพื้นที่เต็มจะ throw ให้ผู้เรียกจับ
    writeSnap(key, merged);
    return true;
  }

  // ── catch-up เงียบๆ: ดึงเฉพาะแถวที่ updated_at ใหม่กว่าครั้งก่อน (เผื่อ realtime พลาด/เครื่องหลับ) ──
  async function catchUp(reason, force) {
    if (!ready || pulling || catching || !lastPullAt) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const now = Date.now();
    if (!force && now - lastCatchup < 10000) return;
    if (loadQueue().length) { flushQueue(); return; } // มีของค้างส่งขึ้น — ส่งก่อน กันของเก่าทับของใหม่
    catching = true; lastCatchup = now;
    let changedAny = false;
    try {
      const since = new Date(lastPullAt - 15 * 60 * 1000).toISOString(); // เผื่อนาฬิกาแต่ละเครื่องไม่ตรงกัน
      for (const key of Object.keys(SYNC_TABLES)) {
        let from = 0, all = [];
        for (;;) {
          const { data, error } = await client.from(SYNC_TABLES[key]).select('*').gt('updated_at', since).order('id', { ascending: true }).range(from, from + 999);
          if (error) throw error;
          all = all.concat(data || []);
          if (!data || data.length < 1000) break;
          from += 1000;
        }
        if (all.length && mergeRemoteRecs(key, all.map(fromRow[key]))) changedAny = true;
      }
      const { data: srows, error: serr } = await client.from('settings').select('*').gt('updated_at', since);
      if (serr) throw serr;
      for (const r of srows || []) {
        if (!SETTINGS_KEYS.includes(r.key)) continue;
        if (r.key === 'orderSeq') { if (Number(r.value) > (Number(DB.get('orderSeq', 0)) || 0)) { localStorage.setItem('ld_orderSeq', JSON.stringify(r.value)); } continue; }
        const cur = localStorage.getItem('ld_' + r.key);
        const nv = JSON.stringify(r.value);
        if (cur === null || JSON.stringify(normV(JSON.parse(cur))) !== JSON.stringify(normV(r.value))) { localStorage.setItem('ld_' + r.key, nv); changedAny = true; }
      }
      markPulled(now);
      if (changedAny) refreshUiIfSafe();
      setStatus('synced');
    } catch (e) {
      console.warn('[sync] catch-up failed (' + reason + '):', e.message || e);
      lastError = 'ดึงข้อมูลใหม่ไม่สำเร็จ: ' + (e.message || e);
      setStatus('error');
    } finally {
      catching = false;
    }
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
      try {
        const json = JSON.stringify(merged);
        localStorage.setItem('ld_' + key, json);
        writeSnap(key, merged);
      } catch (e) {
        console.error('[sync] realtime: บันทึกลงเครื่องไม่สำเร็จ (พื้นที่เต็ม?)', e);
        setStatus('error');
        return;
      }
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
    migrateSnapshots();
    window.addEventListener('online', () => { flushQueue(); subscribeRealtime(); catchUp('online', true); });
    // กลับมาเปิดแอป/สลับแท็บ/เครื่องตื่น → ดึงของที่พลาดทันที
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') catchUp('visible'); });
    window.addEventListener('focus', () => catchUp('focus'));
    // กันตก: ระหว่างเปิดแอปอยู่ เช็คของใหม่ทุก 60 วินาที (เบามาก — ดึงเฉพาะแถวที่เพิ่งเปลี่ยน)
    setInterval(() => { if (document.visibilityState === 'visible') catchUp('interval'); }, 60000);
    flushQueue();
    bootstrap();
  }

  return { init, onSet, compare, apply, pullAll, isReady, getHealth, reconnect, retryQueue };
})();
