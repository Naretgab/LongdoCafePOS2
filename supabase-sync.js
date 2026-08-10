// ============================================================
// SUPABASE SYNC — Phase 1: ยอดขาย (orders) + ลูกค้า (customers) เท่านั้น
// ============================================================
// แนวคิด: localStorage ('ld_orders' / 'ld_customers') ยังคงเป็นแหล่งข้อมูล
// หลักที่ทุกหน้าจออ่าน/เขียนเหมือนเดิมทุกอย่าง (DB.get / DB.set ไม่เปลี่ยน
// พฤติกรรม) — โมดูลนี้แค่ "แอบ" ส่งข้อมูลที่เปลี่ยนขึ้น Supabase เบื้องหลัง
// แบบ diff (เฉพาะรายการที่เปลี่ยนจริง ไม่ยกอาเรย์ทั้งก้อน) และดึงข้อมูลจาก
// เครื่องอื่น ๆ ลงมาตอนเปิดแอป + แบบเรียลไทม์ ทำให้ POS หลายเครื่อง/หลาย
// อุปกรณ์เห็นยอดขาย-ลูกค้าตรงกัน โดยแอปยังทำงานออฟไลน์ได้เหมือนเดิม
// (ถ้าออฟไลน์ หรือยังไม่ตั้งค่า Supabase → ทำงาน local-only เหมือนก่อนหน้านี้
// ทุกประการ ไม่กระทบของเดิม)
//
// เมนู/หมวดหมู่/วัตถุดิบ/โปรโมชัน ฯลฯ ยังอยู่ใน localStorage อย่างเดียวตามเดิม
// (ตามที่ตกลงกันว่าเริ่มจากยอดขาย+ลูกค้าก่อน ค่อยขยายทีหลัง)
// ============================================================

// ── ตั้งค่า Supabase ตรงนี้ ──────────────────────────────────
// ไปเอาค่าได้จาก Supabase Dashboard > Project Settings > API
// (ใช้ "anon public" key เท่านั้น ห้ามใช้ service_role key ในโค้ดฝั่งลูกค้า)
const SUPABASE_CONFIG = {
  url: 'https://osrydesgenxyikngmgbg.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcnlkZXNnZW54eWlrbmdtZ2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNTAwMzMsImV4cCI6MjEwMTkyNjAzM30.UugZVQEw9bil9dv6PUv6NtR1-dGsR6s2XthtMiGynpk',
};

const SyncEngine = (() => {
  const SYNC_TABLES = { orders: 'orders', customers: 'customers' };
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
    // state: 'off' | 'syncing' | 'synced' | 'error'
    if (!statusEl) statusEl = document.getElementById('syncStatusDot');
    if (!statusEl) return;
    statusEl.dataset.state = state;
    const labels = { off:'ยังไม่เชื่อมต่อ Supabase', syncing:'กำลังซิงค์…', synced:'ซิงค์ล่าสุด: '+new Date().toLocaleTimeString('th-TH'), error:'ซิงค์ไม่สำเร็จ — จะลองใหม่อัตโนมัติ' };
    statusEl.title = labels[state] || '';
  }

  // ── row <-> app-object mapping ──────────────────────────────
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
  const toRow = { orders: orderToRow, customers: customerToRow };
  const fromRow = { orders: rowToOrder, customers: rowToCustomer };

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
        const table = SYNC_TABLES[job.key];
        if (job.op === 'upsert') {
          await upsertInBatches(table, job.rows);
        } else if (job.op === 'delete') {
          const { error } = await client.from(table).delete().in('id', job.ids);
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

  // ── called from DB.set() for 'orders' / 'customers' only ────
  function onSet(key, newArr) {
    if (!SYNC_TABLES[key]) return;
    if (!ready) return; // local-only mode: nothing to do
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
          // First-time migration: this device's local data becomes the seed.
          await upsertInBatches(table, local.map(toRow[key]));
          localStorage.setItem(SNAP_PREFIX + key, JSON.stringify(local));
        } else if (rows && rows.length > 0) {
          const remoteRecs = rows.map(fromRow[key]);
          const remoteIds = new Set(remoteRecs.map(r => r.id));
          const localOnly = local.filter(r => !remoteIds.has(r.id)); // made fully offline, not pushed yet
          const merged = [...remoteRecs, ...localOnly].sort((a, b) => a.id - b.id);
          localStorage.setItem(SNAP_PREFIX + key, JSON.stringify(merged));
          DB.set(key, merged); // onSet() will push any localOnly rows up; no-op for the rest
        } else {
          localStorage.setItem(SNAP_PREFIX + key, JSON.stringify(local));
        }
      } catch (e) {
        console.error('[sync] bootstrap failed for', table, e.message || e);
      }
    }
    setStatus('synced');
    subscribeRealtime();
  }

  // ── realtime: pick up changes made from other devices ────────
  function subscribeRealtime() {
    if (!ready) return;
    client.channel('ld_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleRemoteChange('orders'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, handleRemoteChange('customers'))
      .subscribe();
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
      // Re-render the current page if it shows this data, but never yank a modal
      // out from under someone mid-edit.
      if (!document.querySelector('.modal.open') && typeof showPage === 'function') {
        showPage(currentPage);
      }
      setStatus('synced');
    };
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
