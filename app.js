// ============================================================
// LONG DO CAFE & BAKERY — POS SYSTEM
// app.js — Main Application Logic
// ============================================================

// ── DATA STORE ──────────────────────────────────────────────
const DB = {
  get(k, def=[]) { try { const v=localStorage.getItem('ld_'+k); return v?JSON.parse(v):def; } catch { return def; } },
  set(k,v) { localStorage.setItem('ld_'+k, JSON.stringify(v)); },
};

// Default data
function initDB() {
  if (!DB.get('init',false)) {
    DB.set('categories', [
      {id:1,icon:'☕',name:'เครื่องดื่มร้อน'},
      {id:2,icon:'🧊',name:'เครื่องดื่มเย็น'},
      {id:3,icon:'🧁',name:'เบเกอรี่'},
      {id:4,icon:'🥤',name:'ปั่น/ชา'},
    ]);
    DB.set('menus', [
      {id:1,icon:'☕',name:'อเมริกาโน่ร้อน',cat:1,p1:60,p2:70,p3:70,cost:15},
      {id:2,icon:'☕',name:'ลาเต้ร้อน',cat:1,p1:65,p2:75,p3:75,cost:18},
      {id:3,icon:'🧊',name:'อเมริกาโน่เย็น',cat:2,p1:65,p2:75,p3:75,cost:15},
      {id:4,icon:'🧊',name:'ลาเต้เย็น',cat:2,p1:70,p2:80,p3:80,cost:18},
      {id:5,icon:'🥐',name:'ครัวซองต์เนย',cat:3,p1:55,p2:65,p3:65,cost:22},
      {id:6,icon:'🧁',name:'ชีสเค้ก',cat:3,p1:80,p2:90,p3:90,cost:30},
      {id:7,icon:'🥤',name:'ชาไทยเย็น',cat:4,p1:55,p2:65,p3:65,cost:12},
      {id:8,icon:'🥤',name:'มัทฉะปั่น',cat:4,p1:75,p2:85,p3:85,cost:25},
    ]);
    DB.set('customerTypes', [{id:1,name:'ลูกค้าทั่วไป'},{id:2,name:'สมาชิก'},{id:3,name:'VIP'}]);
    DB.set('customers', [
      {id:1,name:'คุณนภา',phone:'0812345678',type:2,total:2350,lastOrder:today()},
    ]);
    DB.set('promotions', [
      {id:1,name:'ลด 10%',value:10,type:'pct',used:5,totalDiscount:320,active:true,start:'',end:''},
      {id:2,name:'ลด 20 บาท',value:20,type:'thb',used:3,totalDiscount:60,active:true,start:'',end:''},
    ]);
    DB.set('ingredients', [
      {id:1,name:'กาแฟ Espresso',unit:'กรัม',price:1.5,stock:500,expiry:'2025-12-31'},
      {id:2,name:'นมสด',unit:'มล',price:0.05,stock:3000,expiry:'2025-07-10'},
      {id:3,name:'น้ำตาล',unit:'กรัม',price:0.02,stock:2000,expiry:'2026-01-01'},
    ]);
    DB.set('expenses', []);
    DB.set('orders', []);
    DB.set('shopInfo', {name:'Long Do Cafe & Bakery',address:'',phone:'',footer:'ขอบคุณที่ใช้บริการ 😊'});
    DB.set('gpSettings', {instore:0,grab:32.1,lineman:32.1});
    DB.set('printerSettings', {width:58,name:''});
    DB.set('addonGroups', [
      {id:1, name:'ขนาด', required:false, multi:false, options:[
        {id:101,name:'S',price:0},{id:102,name:'M',price:10},{id:103,name:'L',price:20}
      ]},
      {id:2, name:'ความหวาน', required:false, multi:false, options:[
        {id:201,name:'หวานน้อย',price:0},{id:202,name:'หวานปกติ',price:0},{id:203,name:'หวานมาก',price:0}
      ]},
      {id:3, name:'ท็อปปิ้ง', required:false, multi:true, options:[
        {id:301,name:'ไข่มุก',price:10},{id:302,name:'วิปครีม',price:15},{id:303,name:'เยลลี่',price:10}
      ]},
    ]);
    DB.set('orderSeq', 1000001);
    DB.set('init', true);
  }
}

// ── STATE ────────────────────────────────────────────────────
let cart = [];
let posType = 'instore'; // instore | grab | lineman
let cartCustomer = null; // customer object or null
let editingId = null;
let currentPage = 'pos';
let reportPeriod = {sales:'day', profit:'day', products:'day'};
let selectedOrderId = null;
let editingCartIdx = null; // index of cart item being edited in item-editor

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initDB();
  updateTopbarDate();
  setInterval(updateTopbarDate, 60000);

  // Load all pages
  renderPosCats();
  renderPosMenu();
  updateCartUI();
  fillPromoSel();

  // Hide splash
  setTimeout(() => {
    const s = document.getElementById('splash');
    s.style.opacity = '0';
    setTimeout(() => s.remove(), 600);
  }, 1200);
});

function today() {
  // ใช้เวลาท้องถิ่นของเครื่อง แทน toISOString() (ซึ่งเป็น UTC และทำให้วันที่เพี้ยนไป 1 วัน
  // ในช่วงกลางคืนสำหรับโซนเวลาไทย/GMT+7)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function updateTopbarDate() {
  const d = new Date();
  document.getElementById('topbarDate').textContent =
    d.toLocaleDateString('th-TH', {weekday:'short',day:'numeric',month:'short',year:'numeric'});
}

// ── PAGE NAVIGATION ──────────────────────────────────────────
const pageTitles = {
  pos:'หน้าขาย POS', orders:'รายการออเดอร์', menu:'จัดการเมนู',
  categories:'หมวดหมู่สินค้า', customers:'ลูกค้า', promotions:'โปรโมชั่น',
  ingredients:'วัตถุดิบ', expenses:'รายจ่าย', 'report-sales':'รายงานยอดขาย',
  'report-profit':'กำไร-ขาดทุน', 'report-products':'สินค้าขายดี',
  'report-customers':'รายงานลูกค้า', settings:'ตั้งค่าระบบ'
};
function showPage(name) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+name)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>{
    if(n.getAttribute('onclick')?.includes("'"+name+"'")) n.classList.add('active');
  });
  document.getElementById('pageTitle').textContent = pageTitles[name]||name;
  currentPage = name;
  // Close sidebar on mobile
  if(window.innerWidth<900) closeSidebar();
  // Render page-specific content
  if(name==='menu') { renderMenuTable(); renderAddonGroupList(); }
  if(name==='categories') renderCatGrid();
  if(name==='customers') renderCustomerTable();
  if(name==='promotions') renderPromoTable();
  if(name==='ingredients') renderIngTable();
  if(name==='expenses') renderExpTable();
  if(name==='orders') renderOrdersTable();
  if(name==='report-sales') renderSalesReport();
  if(name==='report-profit') renderProfitReport();
  if(name==='report-products') renderTopProductsReport();
  if(name==='report-customers') renderCustReport();
  if(name==='settings') loadSettings();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── MODAL HELPERS ─────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); editingId=null; }

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type?' '+type:'');
  setTimeout(() => t.className='toast', 2800);
}

// ── POS ───────────────────────────────────────────────────────
function setPosType(t) {
  posType = t;
  document.querySelectorAll('.pos-type-btn').forEach(el=>el.classList.remove('active'));
  document.getElementById('posType-'+t)?.classList.add('active');
  renderPosMenu();
  updateCartUI();
}

function renderPosCats() {
  const cats = DB.get('categories');
  const el = document.getElementById('posCatTabs');
  el.innerHTML = `<div class="pos-cat-pill active" data-cat="all" onclick="filterCat('all')">🌟 ทั้งหมด</div>`;
  cats.forEach(c => {
    el.innerHTML += `<div class="pos-cat-pill" data-cat="${c.id}" onclick="filterCat(${c.id})">${c.icon} ${c.name}</div>`;
  });
}

let activeCat = 'all';
function filterCat(cat) {
  activeCat = cat;
  document.querySelectorAll('.pos-cat-pill').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll(`.pos-cat-pill[data-cat="${cat}"]`).forEach(t=>t.classList.add('active'));
  renderPosMenu();
}

function filterMenu() {
  renderPosMenu();
}

function renderPosMenu() {
  const menus = DB.get('menus');
  const q = document.getElementById('posSearch')?.value?.toLowerCase()||'';
  const el = document.getElementById('posMenuGrid');
  const filtered = menus.filter(m =>
    (activeCat==='all' || m.cat==activeCat) &&
    (!q || m.name.toLowerCase().includes(q))
  );
  if(!filtered.length) {
    el.innerHTML='<div class="empty-state"><div class="empty-icon">🔍</div><p>ไม่พบเมนู</p></div>';
    return;
  }
  const priceKey = posType==='grab'?'p2':posType==='lineman'?'p3':'p1';
  el.innerHTML = filtered.map(m=>{
    const hasAddon = (m.addonGroups||[]).length > 0;
    return `<div class="pos-card${hasAddon?' has-addon':''}" onclick="addToCart(${m.id})">
      ${hasAddon ? '<div class="pos-card-addon-dot"></div>' : ''}
      <span class="pos-card-emoji">${m.icon||'☕'}</span>
      <div class="pos-card-name">${m.name}</div>
      <div class="pos-card-price">฿${m[priceKey]||m.p1}</div>
    </div>`;
  }).join('');
}

function addToCart(menuId) {
  const menu = DB.get('menus').find(m=>m.id===menuId);
  if(!menu) return;
  const priceKey = posType==='grab'?'p2':posType==='lineman'?'p3':'p1';
  const price = menu[priceKey]||menu.p1;
  // If menu has addon groups → open item editor
  const linkedGroups = (menu.addonGroups||[]).length > 0;
  if(linkedGroups) {
    openItemEditor(menuId, null); // null = new item
    return;
  }
  // No addons: add/increment directly
  const existing = cart.findIndex(i=>i.menuId===menuId && !i.addons?.length && !i.customPrice);
  if(existing>=0) { cart[existing].qty++; cart[existing].total = cart[existing].qty * cart[existing].price; }
  else { cart.push({menuId,name:menu.name,icon:menu.icon,price,qty:1,total:price,cost:menu.cost||0,addons:[],note:'',customPrice:null}); }
  updateCartUI();
  showToast('เพิ่ม '+menu.name, 'success');
}

function changeQty(cartIdx, delta) {
  if(cartIdx<0||cartIdx>=cart.length) return;
  cart[cartIdx].qty += delta;
  if(cart[cartIdx].qty<=0) { cart.splice(cartIdx,1); }
  else {
    const base = cart[cartIdx].customPrice !== null ? cart[cartIdx].customPrice : cart[cartIdx].price;
    const addonSum = (cart[cartIdx].addons||[]).reduce((s,a)=>s+a.price,0);
    cart[cartIdx].total = cart[cartIdx].qty * (base + addonSum);
  }
  updateCartUI();
}

function updateCartUI() {
  const body = document.getElementById('cartBody');
  if(!cart.length) {
    body.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛒</div><div class="cart-empty-text">ยังไม่มีรายการ<br>แตะเมนูเพื่อเพิ่ม</div></div>`;
  } else {
    body.innerHTML = cart.map((item, idx) => {
      const addonSum = (item.addons||[]).reduce((s,a)=>s+a.price,0);
      const hasCustomPrice = item.customPrice !== null && item.customPrice !== undefined;
      const hasItemDisc = (item.itemDiscount||0) > 0 && !hasCustomPrice;
      const origUnitPrice = item.price + addonSum;

      // Tags row
      const addonTags = (item.addons||[]).map(a =>
        `<span class="cart-tag">${a.name}${a.price>0?' +฿'+a.price:''}</span>`
      ).join('');
      const customTag  = hasCustomPrice ? `<span class="cart-tag cart-tag-price">💰 ปรับราคา</span>` : '';
      const discTag    = hasItemDisc    ? `<span class="cart-tag cart-tag-disc">🏷️ ${item.itemDiscountType==='pct'?item.itemDiscount+'%':'฿'+item.itemDiscount}</span>` : '';
      const allTags    = addonTags + customTag + discTag;
      const noteHtml   = item.note ? `<div class="cart-item-note">📝 ${item.note}</div>` : '';
      const origHtml   = (hasCustomPrice||hasItemDisc) ? `<div class="cart-item-orig">฿${origUnitPrice}</div>` : '';

      return `<div class="cart-item">
        <div class="cart-item-top">
          <span class="cart-item-emoji">${item.icon||'☕'}</span>
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            ${allTags ? `<div class="cart-item-tags">${allTags}</div>` : ''}
            ${noteHtml}
          </div>
          <button class="cart-edit-btn" onclick="openItemEditor(${item.menuId},${idx})">✏️</button>
        </div>
        <div class="cart-item-bottom">
          <div class="qty-ctrl">
            <button class="qty-btn" onclick="changeQty(${idx},-1)">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" onclick="changeQty(${idx},1)">+</button>
          </div>
          <div style="text-align:right;">
            ${origHtml}
            <div class="cart-item-price">฿${item.total}</div>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  updateCartTotals();
}

function updateCartTotals() {
  const subtotal = cart.reduce((s,i)=>s+i.total,0);
  let discAmt = 0;
  const dval = parseFloat(document.getElementById('cartDiscount')?.value)||0;
  const dtype = document.getElementById('cartDiscountType')?.value||'thb';
  if(dval>0) { discAmt = dtype==='pct' ? Math.round(subtotal*dval/100) : dval; }
  const total = Math.max(0, subtotal-discAmt);
  document.getElementById('ctSubtotal').textContent = '฿'+subtotal;
  document.getElementById('ctDiscount').textContent = '-฿'+discAmt;
  document.getElementById('ctTotal').textContent = '฿'+total;
  document.getElementById('topbarSales').textContent = '฿'+getDaySales();
  document.getElementById('payBtn').disabled = cart.length===0;
}

function getDaySales() {
  return DB.get('orders').filter(o=>o.date===today()&&o.status!=='cancelled')
    .reduce((s,o)=>s+o.total,0);
}

function clearCart() {
  if(!cart.length) return;
  cart=[];
  cartCustomer=null;
  document.getElementById('cartCustomerName').textContent='ลูกค้า';
  document.getElementById('cartDiscount').value='';
  document.getElementById('cartPromoSel').value='';
  updateCartUI();
}

// ── ITEM EDITOR (addons + custom price) ──────────────────────
function openItemEditor(menuId, cartIdx) {
  const menu = DB.get('menus').find(m=>m.id===menuId);
  if(!menu) return;
  editingCartIdx = cartIdx; // null = new item
  const priceKey = posType==='grab'?'p2':posType==='lineman'?'p3':'p1';
  const basePrice = menu[priceKey]||menu.p1;
  // Existing cart item data (if editing)
  const existing = cartIdx !== null ? cart[cartIdx] : null;
  const selAddons = existing ? [...(existing.addons||[])] : [];
  const customPriceVal = existing ? existing.customPrice : null;
  const noteVal = existing ? (existing.note||'') : '';

  // Get linked addon groups for this menu
  const allGroups = DB.get('addonGroups');
  const linkedGroupIds = menu.addonGroups||[];
  const groups = allGroups.filter(g=>linkedGroupIds.includes(g.id));

  // Build modal content
  let addonHTML = '';
  if(groups.length) {
    addonHTML = groups.map(g=>`
      <div style="margin-bottom:12px;">
        <div style="font-size:0.82rem;font-weight:600;color:var(--espresso);margin-bottom:6px;">
          ${g.name}${g.required?'<span style="color:var(--red);margin-left:4px;">*</span>':''}
          <span style="font-size:0.7rem;color:var(--muted);font-weight:400;">${g.multi?'(เลือกได้หลายอย่าง)':'(เลือก 1)'}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${g.options.map(opt=>{
            const isSelected = selAddons.some(a=>a.id===opt.id);
            return `<button type="button"
              id="addonopt_${opt.id}"
              onclick="toggleAddonOpt(${g.id},${opt.id},'${opt.name}',${opt.price},${g.multi})"
              style="padding:5px 12px;border-radius:20px;border:1.5px solid ${isSelected?'var(--caramel)':'var(--border)'};
                background:${isSelected?'var(--caramel)':'white'};color:${isSelected?'white':'var(--text)'};
                font-family:'Sarabun',sans-serif;font-size:0.82rem;cursor:pointer;transition:all 0.15s;">
              ${opt.name}${opt.price>0?' +฿'+opt.price:''}
            </button>`;
          }).join('')}
        </div>
      </div>`).join('');
  }

  document.getElementById('itemEditorTitle').textContent = (existing?'แก้ไข':'เพิ่ม') + ' — ' + menu.name;
  document.getElementById('itemEditorMenuId').value = menuId;
  document.getElementById('itemEditorBasePrice').textContent = '฿'+basePrice;
  document.getElementById('itemEditorAddons').innerHTML = addonHTML || '<div style="font-size:0.82rem;color:var(--muted);padding:4px 0;">ไม่มี Add-on สำหรับเมนูนี้</div>';
  document.getElementById('itemEditorCustomPrice').value = customPriceVal !== null ? customPriceVal : '';
  document.getElementById('itemEditorNote').value = noteVal;
  // Item discount
  document.getElementById('itemEditorDiscount').value = existing?.itemDiscount || '';
  document.getElementById('itemEditorDiscountType').value = existing?.itemDiscountType || 'thb';
  // Show/hide delete button
  const delBtn = document.getElementById('btnRemoveCartItem');
  if(delBtn) delBtn.style.display = cartIdx !== null ? 'block' : 'none';
  // Update confirm button text
  const confirmBtn = document.querySelector('#itemEditorModal .btn-primary');
  if(confirmBtn) confirmBtn.textContent = cartIdx !== null ? '✅ อัปเดตรายการ' : '✅ เพิ่มลงบิล';
  // Store working addons in a temporary array on the modal
  window._editorAddons = selAddons;
  updateItemEditorTotal(basePrice);
  openModal('itemEditorModal');
}

function toggleAddonOpt(groupId, optId, optName, optPrice, isMulti) {
  const menuId = parseInt(document.getElementById('itemEditorMenuId').value);
  const menu = DB.get('menus').find(m=>m.id===menuId);
  const priceKey = posType==='grab'?'p2':posType==='lineman'?'p3':'p1';
  const basePrice = menu ? (menu[priceKey]||menu.p1) : 0;
  const groups = DB.get('addonGroups');
  const grp = groups.find(g=>g.id===groupId);
  if(!grp) return;
  const addons = window._editorAddons;
  const existIdx = addons.findIndex(a=>a.id===optId);
  if(existIdx>=0) {
    // Deselect
    addons.splice(existIdx,1);
  } else {
    if(!isMulti) {
      // Remove others in same group
      grp.options.forEach(o=>{ const i=addons.findIndex(a=>a.id===o.id); if(i>=0) addons.splice(i,1); });
    }
    addons.push({id:optId, groupId, name:optName, price:optPrice});
  }
  // Re-render buttons
  grp.options.forEach(o=>{
    const btn = document.getElementById('addonopt_'+o.id);
    if(!btn) return;
    const sel = addons.some(a=>a.id===o.id);
    btn.style.border = `1.5px solid ${sel?'var(--caramel)':'var(--border)'}`;
    btn.style.background = sel?'var(--caramel)':'white';
    btn.style.color = sel?'white':'var(--text)';
  });
  updateItemEditorTotal(basePrice);
}

function updateItemEditorTotal(basePrice) {
  const customPriceRaw = parseFloat(document.getElementById('itemEditorCustomPrice').value);
  const hasCustom = !isNaN(customPriceRaw) && document.getElementById('itemEditorCustomPrice').value !== '';
  const addonSum = (window._editorAddons||[]).reduce((s,a)=>s+a.price,0);
  let unitPrice = (hasCustom ? customPriceRaw : basePrice) + addonSum;
  // Apply item discount only if no custom price override
  if(!hasCustom) {
    const discVal = parseFloat(document.getElementById('itemEditorDiscount').value)||0;
    const discType = document.getElementById('itemEditorDiscountType').value||'thb';
    if(discVal>0) unitPrice -= discType==='pct' ? Math.round(unitPrice*discVal/100) : discVal;
  }
  unitPrice = Math.max(0, unitPrice);
  document.getElementById('itemEditorTotal').textContent = '฿'+unitPrice;
}

function onItemEditorChange() {
  const menuId = parseInt(document.getElementById('itemEditorMenuId').value);
  const menu = DB.get('menus').find(m=>m.id===menuId);
  const priceKey = posType==='grab'?'p2':posType==='lineman'?'p3':'p1';
  const basePrice = menu ? (menu[priceKey]||menu.p1) : 0;
  updateItemEditorTotal(basePrice);
}

function confirmItemEditor() {
  const menuId = parseInt(document.getElementById('itemEditorMenuId').value);
  const menu = DB.get('menus').find(m=>m.id===menuId);
  if(!menu) return;
  const priceKey = posType==='grab'?'p2':posType==='lineman'?'p3':'p1';
  const basePrice = menu[priceKey]||menu.p1;
  const cpRaw = parseFloat(document.getElementById('itemEditorCustomPrice').value);
  const hasCustomPrice = !isNaN(cpRaw) && document.getElementById('itemEditorCustomPrice').value.trim()!=='';
  const customPrice = hasCustomPrice ? cpRaw : null;
  const note = document.getElementById('itemEditorNote').value.trim();
  const addons = [...(window._editorAddons||[])];
  const itemDiscountVal = parseFloat(document.getElementById('itemEditorDiscount').value)||0;
  const itemDiscountType = document.getElementById('itemEditorDiscountType').value||'thb';

  // Check required addon groups
  const allGroups = DB.get('addonGroups');
  const linkedGroupIds = menu.addonGroups||[];
  for(const gid of linkedGroupIds) {
    const grp = allGroups.find(g=>g.id===gid);
    if(grp?.required && !addons.some(a=>a.groupId===gid)) {
      showToast('กรุณาเลือก '+grp.name,'error'); return;
    }
  }

  // Calculate per-unit price
  const addonSum = addons.reduce((s,a)=>s+a.price,0);
  let unitPrice = (customPrice !== null ? customPrice : basePrice) + addonSum;
  if(customPrice === null && itemDiscountVal > 0) {
    const discAmt = itemDiscountType==='pct' ? Math.round(unitPrice*itemDiscountVal/100) : itemDiscountVal;
    unitPrice = Math.max(0, unitPrice - discAmt);
  }

  const itemData = {
    menuId, name:menu.name, icon:menu.icon, price:basePrice, cost:menu.cost||0,
    addons, note, customPrice, itemDiscount:itemDiscountVal, itemDiscountType
  };

  if(editingCartIdx !== null) {
    const old = cart[editingCartIdx];
    cart[editingCartIdx] = {...old, ...itemData, qty:old.qty, total:old.qty*unitPrice};
  } else {
    cart.push({...itemData, qty:1, total:unitPrice});
  }
  closeModal('itemEditorModal');
  updateCartUI();
  showToast((editingCartIdx!==null?'✏️ แก้ไข':'✅ เพิ่ม')+' '+menu.name, 'success');
}

function removeCartItem(cartIdx) {
  cart.splice(cartIdx,1);
  closeModal('itemEditorModal');
  updateCartUI();
}


function selectCartCustomer() { renderPosCustList(); openModal('selectCustModal'); }

function renderPosCustList() {
  const q = document.getElementById('posCustSearch')?.value?.toLowerCase()||'';
  const custs = DB.get('customers').filter(c=>!q||c.name.toLowerCase().includes(q));
  const el = document.getElementById('posCustList');
  if(!custs.length) { el.innerHTML='<div class="empty-state" style="padding:20px;"><p>ไม่พบลูกค้า</p></div>'; return; }
  el.innerHTML = custs.map(c=>`
    <div style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;"
      onclick="setCartCustomer(${c.id}); closeModal('selectCustModal');">
      <div>
        <div style="font-weight:600;font-size:0.9rem;">${c.name}</div>
        <div style="font-size:0.78rem;color:var(--muted);">${c.phone||''}</div>
      </div>
      <span class="pill pill-blue" style="font-size:0.72rem;">${getCustTypeName(c.type)}</span>
    </div>
  `).join('');
}

function setCartCustomer(id) {
  if(!id) { cartCustomer=null; document.getElementById('cartCustomerName').textContent='ลูกค้า'; return; }
  const c = DB.get('customers').find(x=>x.id===id);
  if(c) { cartCustomer=c; document.getElementById('cartCustomerName').textContent=c.name; }
}

function fillPromoSel() {
  const sel = document.getElementById('cartPromoSel');
  const promos = DB.get('promotions').filter(p=>p.active);
  sel.innerHTML = '<option value="">🎁 โปรโมชั่น</option>';
  promos.forEach(p=>{ sel.innerHTML+=`<option value="${p.id}">${p.name} (${p.type==='pct'?p.value+'%':'฿'+p.value})</option>`; });
}

function applyPromo() {
  const pid = document.getElementById('cartPromoSel').value;
  if(!pid) { document.getElementById('cartDiscount').value=''; document.getElementById('cartDiscountType').value='thb'; updateCartTotals(); return; }
  const promo = DB.get('promotions').find(p=>p.id==pid);
  if(promo) {
    document.getElementById('cartDiscount').value = promo.value;
    document.getElementById('cartDiscountType').value = promo.type;
    updateCartTotals();
  }
}

// ── PAYMENT ───────────────────────────────────────────────────
function openPayment() {
  if(!cart.length) return;
  const total = getCartTotal();
  document.getElementById('payAmount').textContent = '฿'+total;
  document.getElementById('receivedAmount').value = '';
  document.getElementById('changeAmount').textContent = '฿0';
  const refGroup = document.getElementById('refOrderNoGroup');
  const refInput = document.getElementById('refOrderNo');
  if(posType==='grab' || posType==='lineman') {
    refGroup.style.display = '';
    document.getElementById('refOrderNoLabel').textContent = posType==='grab' ? 'หมายเลขออเดอร์ Grab' : 'หมายเลขออเดอร์ LINE MAN';
    refInput.value = '';
  } else {
    refGroup.style.display = 'none';
    refInput.value = '';
  }
  buildQuickCash(total);
  setPayMethod('cash');
  buildReceiptPreview();
  openModal('payModal');
}

function getCartTotal() {
  const subtotal = cart.reduce((s,i)=>s+i.total,0);
  const dval = parseFloat(document.getElementById('cartDiscount')?.value)||0;
  const dtype = document.getElementById('cartDiscountType')?.value||'thb';
  const disc = dval>0 ? (dtype==='pct' ? Math.round(subtotal*dval/100) : dval) : 0;
  return Math.max(0, subtotal-disc);
}

function getCartDiscount() {
  const subtotal = cart.reduce((s,i)=>s+i.total,0);
  const dval = parseFloat(document.getElementById('cartDiscount')?.value)||0;
  const dtype = document.getElementById('cartDiscountType')?.value||'thb';
  return dval>0 ? (dtype==='pct' ? Math.round(subtotal*dval/100) : dval) : 0;
}

let payMethod = 'cash';
function setPayMethod(m) {
  payMethod = m;
  ['cash','qr','transfer'].forEach(x=>{
    document.getElementById('pm'+x.charAt(0).toUpperCase()+x.slice(1))?.classList.remove('btn-primary');
    document.getElementById('pm'+x.charAt(0).toUpperCase()+x.slice(1))?.classList.add('btn-ghost');
  });
  const key = 'pm'+m.charAt(0).toUpperCase()+m.slice(1);
  document.getElementById(key)?.classList.replace('btn-ghost','btn-primary');
  document.getElementById('cashSection').style.display = m==='cash'?'block':'none';
  document.getElementById('qrSection').style.display = m==='qr'?'block':'none';
  if(m==='qr') drawQR();
}

function buildQuickCash(total) {
  const amounts = [total, ...([20,50,100,500,1000].filter(a=>a>=total))].slice(0,5);
  const uniqueAmounts = [...new Set(amounts)];
  document.getElementById('quickCash').innerHTML = uniqueAmounts.map(a=>
    `<button class="btn btn-ghost btn-sm" onclick="document.getElementById('receivedAmount').value=${a};calcChange();">฿${a}</button>`
  ).join('');
}

function calcChange() {
  const total = getCartTotal();
  const rec = parseFloat(document.getElementById('receivedAmount').value)||0;
  const change = rec - total;
  document.getElementById('changeAmount').textContent = (change>=0?'฿'+change:'ไม่เพียงพอ');
  document.getElementById('changeAmount').style.color = change>=0?'var(--sage)':'var(--red)';
}

function drawQR() {
  const total = getCartTotal();
  document.getElementById('qrAmount').textContent = 'ยอด ฿' + total;
  const posQrData = DB.get('posQrImage','');
  const imageWrap = document.getElementById('posQrImageWrap');
  const canvasWrap = document.getElementById('posQrCanvasWrap');
  if(posQrData) {
    document.getElementById('posQrImage').src = posQrData;
    if(imageWrap) imageWrap.style.display='block';
    if(canvasWrap) canvasWrap.style.display='none';
  } else {
    if(imageWrap) imageWrap.style.display='none';
    if(canvasWrap) canvasWrap.style.display='block';
    const canvas = document.getElementById('qrCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0,0,180,180);
    ctx.fillStyle = '#1a0a00';
    const cell = 6;
    const pattern = generateQRPattern(total);
    for(let r=0;r<30;r++) for(let c=0;c<30;c++) {
      if(pattern[r*30+c]) { ctx.fillRect(c*cell,r*cell,cell-1,cell-1); }
    }
    [[0,0],[0,21],[21,0]].forEach(([r,c])=>{
      ctx.fillStyle='#1a0a00';
      ctx.fillRect(c*cell,r*cell,7*cell,7*cell);
      ctx.fillStyle='white';
      ctx.fillRect(c*cell+cell,r*cell+cell,5*cell,5*cell);
      ctx.fillStyle='#1a0a00';
      ctx.fillRect(c*cell+2*cell,r*cell+2*cell,3*cell,3*cell);
    });
  }
}

function generateQRPattern(seed) {
  // Pseudo-random pattern based on total amount
  const arr = new Array(900).fill(0);
  let s = seed+1;
  for(let i=0;i<900;i++) { s=(s*1103515245+12345)&0x7fffffff; arr[i]=s%2; }
  return arr;
}

function buildReceiptPreview() {
  const shopInfo = DB.get('shopInfo',{});
  const logoData = DB.get('shopLogo','');
  const receiptQrData = DB.get('receiptQrImage','');
  const subtotal = cart.reduce((s,i)=>s+i.total,0);
  const disc = getCartDiscount();
  const total = subtotal-disc;
  const seq = String(DB.get('orderSeq',1000001)).padStart(7,'0');
  const typeLabel = posType==='grab'?'Grab':posType==='lineman'?'LINE MAN':'หน้าร้าน';
  document.getElementById('receiptPreview').innerHTML = `
    <div class="receipt">
      ${logoData?`<div style="text-align:center;margin-bottom:6px;"><img src="${logoData}" style="max-width:100px;max-height:50px;object-fit:contain;"></div>`:''}
      <div class="receipt-logo">${shopInfo.name||'Long Do Cafe & Bakery'}</div>
      <div class="receipt-sub">${shopInfo.address||''}</div>
      <div class="receipt-sub">เลขที่: ${seq} · ${typeLabel}${(posType==='grab'||posType==='lineman')&&document.getElementById('refOrderNo')?.value.trim()?' #'+document.getElementById('refOrderNo').value.trim():''}</div>
      <div class="receipt-sub">${cartCustomer?cartCustomer.name:''}</div>
      <div class="receipt-sub">${new Date().toLocaleString('th-TH')}</div>
      <hr class="receipt-divider">
      ${cart.map(i=>{
        const addonStr=(i.addons&&i.addons.length)?i.addons.map(a=>a.name+(a.price>0?' +฿'+a.price:'')).join(', '):'';
        const hasCustom=i.customPrice!==null&&i.customPrice!==undefined;
        const hasDisc=(i.itemDiscount||0)>0&&!hasCustom;
        const discLabel=hasDisc?(i.itemDiscountType==='pct'?`-${i.itemDiscount}%`:`-฿${i.itemDiscount}`):'';
        return `<div class="receipt-row"><span>${i.name} x${i.qty}</span><span>฿${i.total}</span></div>
        ${addonStr?`<div style="font-size:0.75rem;color:var(--muted);padding-left:8px;">↳ ${addonStr}</div>`:''}
        ${hasCustom?`<div style="font-size:0.72rem;color:var(--sage);padding-left:8px;">💰 ราคาพิเศษ</div>`:''}
        ${hasDisc?`<div style="font-size:0.72rem;color:var(--red);padding-left:8px;">🏷️ ส่วนลด ${discLabel}</div>`:''}
        ${i.note?`<div style="font-size:0.72rem;color:var(--muted);padding-left:8px;">📝 ${i.note}</div>`:''}`;
      }).join('')}      }).join('')}
      <hr class="receipt-divider">
      <div class="receipt-row"><span>รวม</span><span>฿${subtotal}</span></div>
      ${disc>0?`<div class="receipt-row"><span>ส่วนลด</span><span>-฿${disc}</span></div>`:''}
      <div class="receipt-row receipt-total"><span>ยอดรวม</span><span>฿${total}</span></div>
      <hr class="receipt-divider">
      ${receiptQrData?`<div style="text-align:center;margin:6px 0;"><div style="font-size:10px;color:#888;margin-bottom:4px;">สแกน QR ชำระเงิน</div><img src="${receiptQrData}" style="width:95%;max-width:280px;height:auto;object-fit:contain;"></div>`:''}
      <div class="receipt-footer">${shopInfo.footer||'ขอบคุณที่ใช้บริการ 😊'}</div>
    </div>
  `;
}

function confirmPayment() {
  const total = getCartTotal();
  if(payMethod==='cash') {
    const rec = parseFloat(document.getElementById('receivedAmount').value)||0;
    if(rec < total) { showToast('รับเงินไม่เพียงพอ','error'); return; }
  }
  // Save order
  const orders = DB.get('orders');
  const seq = DB.get('orderSeq',1000001);
  const subtotal = cart.reduce((s,i)=>s+i.total,0);
  const disc = getCartDiscount();
  const cost = cart.reduce((s,i)=>s+(i.cost*i.qty),0);
  const promoId = document.getElementById('cartPromoSel')?.value||null;

  const order = {
    id: seq, orderNo: String(seq).padStart(7,'0'),
    date: today(), time: new Date().toLocaleTimeString('th-TH'),
    type: posType, refNo: (posType==='grab'||posType==='lineman') ? (document.getElementById('refOrderNo')?.value.trim()||'') : '',
    customer: cartCustomer?{id:cartCustomer.id,name:cartCustomer.name}:null,
    items: cart.map(i=>({id:i.menuId,name:i.name,icon:i.icon,qty:i.qty,price:i.price,total:i.total,cost:i.cost,addons:i.addons||[],note:i.note||'',customPrice:i.customPrice??null,itemDiscount:i.itemDiscount||0,itemDiscountType:i.itemDiscountType||'thb'})),
    subtotal, discount:disc, total, cost, profit:total-cost,
    payMethod, promoId, status:'completed',
    received: payMethod==='cash'?(parseFloat(document.getElementById('receivedAmount').value)||total):total,
    change: payMethod==='cash'?Math.max(0,(parseFloat(document.getElementById('receivedAmount').value)||0)-total):0
  };
  orders.push(order);
  DB.set('orders', orders);
  DB.set('orderSeq', seq+1);

  // Update customer total
  if(cartCustomer) {
    const custs = DB.get('customers');
    const ci = custs.findIndex(c=>c.id===cartCustomer.id);
    if(ci>=0) { custs[ci].total=(custs[ci].total||0)+total; custs[ci].lastOrder=today(); DB.set('customers',custs); }
  }

  // Update promo usage
  if(promoId && disc>0) {
    const promos = DB.get('promotions');
    const pi = promos.findIndex(p=>p.id==promoId);
    if(pi>=0) { promos[pi].used=(promos[pi].used||0)+1; promos[pi].totalDiscount=(promos[pi].totalDiscount||0)+disc; DB.set('promotions',promos); }
  }

  closeModal('payModal');
  showToast('✅ ชำระเงินสำเร็จ เลขที่ '+order.orderNo, 'success');
  clearCart();
  updateCartTotals();

  // Auto print (simulated)
  setTimeout(()=>printReceipt(order), 300);
}

function printReceipt(order) {
  if(!order) return;
  const shopInfo = DB.get('shopInfo',{});
  const printerSettings = DB.get('printerSettings',{width:58,name:''});
  const logoData = DB.get('shopLogo','');
  const receiptQrData = DB.get('receiptQrImage','');
  const is80mm = printerSettings.width===80;
  const paperWidth = is80mm ? 302 : 216;
  const fontSize = is80mm ? 13 : 11;

  const logoHtml = logoData
    ? `<img src="${logoData}" style="max-width:${paperWidth-16}px;max-height:56px;object-fit:contain;margin-bottom:4px;">`
    : '';
  const qrPrintSize = paperWidth - 12; // ขยายให้เกือบเต็มหน้ากระดาษ
  const receiptQrHtml = receiptQrData
    ? `<div class="hr"></div><div class="center" style="font-size:10px;margin-bottom:4px;">สแกน QR ชำระเงิน</div><img src="${receiptQrData}" style="width:${qrPrintSize}px;height:${qrPrintSize}px;object-fit:contain;">`
    : '';

  const itemsHtml = order.items.map(i => {
    const addonStr = (i.addons&&i.addons.length) ? i.addons.map(a=>a.name+(a.price>0?' +฿'+a.price:'')).join(', ') : '';
    const hasCustom = i.customPrice!==null && i.customPrice!==undefined;
    const hasDisc = (i.itemDiscount||0)>0 && !hasCustom;
    const discLabel = hasDisc ? (i.itemDiscountType==='pct' ? `-${i.itemDiscount}%` : `-฿${i.itemDiscount}`) : '';
    return `<div class="row"><span>${i.name} x${i.qty}</span><span>฿${i.total}</span></div>
      ${addonStr ? `<div class="sub">&#8627; ${addonStr}</div>` : ''}
      ${hasCustom ? `<div class="sub green">&#128176; ราคาพิเศษ</div>` : ''}
      ${hasDisc ? `<div class="sub red">&#128247; ส่วนลด ${discLabel}</div>` : ''}
      ${i.note ? `<div class="sub gray">&#128221; ${i.note}</div>` : ''}`;
  }).join('');

  // Pre-build ESC/POS items string to embed safely in HTML
  const escItemLines = order.items.map(i => {
    const W = 32;
    const namepart = (i.name+' x'+i.qty).substring(0,W-8);
    const pricepart = String(i.total);
    const pad = Math.max(1, W - namepart.length - pricepart.length - 3);
    const addonStr = (i.addons&&i.addons.length) ? i.addons.map(a=>a.name).join(',') : '';
    const hasDisc = (i.itemDiscount||0)>0 && !i.customPrice;
    const discStr = hasDisc ? (i.itemDiscountType==='pct' ? '-'+i.itemDiscount+'%' : '-'+i.itemDiscount) : '';
    return JSON.stringify({namepart, pricepart, pad, addonStr, hasDisc, discStr, note:(i.note||'').substring(0,24)});
  });

  const shopName = JSON.stringify(shopInfo.name||'Long Do Cafe & Bakery');
  const shopAddr = JSON.stringify(shopInfo.address||'');
  const shopPhone= JSON.stringify(shopInfo.phone||'');
  const shopFoot = JSON.stringify(shopInfo.footer||'ขอบคุณที่ใช้บริการ');
  const orderNo  = order.orderNo.replace('#','');
  const orderType= order.type==='grab'?'Grab':order.type==='lineman'?'LINE MAN':'หน้าร้าน';
  const orderDate= order.date+' '+order.time;
  const custName = JSON.stringify(order.customer ? order.customer.name : '');
  const subtotal = order.subtotal;
  const discount = order.discount||0;
  const total    = order.total;
  const received = order.received||0;
  const change   = order.change||0;
  const isCash   = order.payMethod==='cash';
  const escItemsJSON = '['+escItemLines.join(',')+']';

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>ใบเสร็จ ${order.orderNo}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;}
  body{font-family:'Courier New',monospace;font-size:${fontSize}px;background:#ccc;display:flex;flex-direction:column;align-items:center;padding:14px 10px 0;}
  #receiptWrap{background:white;width:${paperWidth}px;max-width:100%;padding:10px 8px 14px;border-radius:2px;box-shadow:0 2px 16px rgba(0,0,0,.2);}
  .center{text-align:center;}.hr{border:none;border-top:1px dashed #bbb;margin:5px 0;}
  .row{display:flex;justify-content:space-between;font-size:${fontSize}px;padding:1px 0;}
  .bold{font-weight:bold;}.big{font-size:${fontSize+2}px;}
  .sub{font-size:.82em;color:#555;padding-left:10px;}.green{color:#2d6a4f;}.red{color:#c0392b;}.gray{color:#888;}
  img{display:block;margin:0 auto;}
  .action-bar{width:${paperWidth}px;max-width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 0 6px;}
  .action-bar .full{grid-column:1/-1;}
  .action-bar button{padding:13px 0;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity .15s,transform .1s;font-family:'Sarabun','Courier New',sans-serif;}
  .action-bar button:active{opacity:.75;transform:scale(.97);}
  .btn-ble{background:#27ae60;color:white;}.btn-print{background:#c8821a;color:white;}.btn-png{background:#1a5276;color:white;}
  .ble-st{width:${paperWidth}px;max-width:100%;text-align:center;font-size:12px;color:#666;padding:4px 0 12px;min-height:22px;}
  @media print{body{background:white;padding:0;}#receiptWrap{box-shadow:none;width:100%;max-width:none;}.action-bar,.ble-st{display:none!important;}@page{margin:3mm;size:${is80mm?'80mm':'58mm'} auto;}}
</style></head><body>
<div id="receiptWrap">
  <div class="center">${logoHtml}</div>
  <div class="center bold big">${shopInfo.name||'Long Do Cafe & Bakery'}</div>
  ${shopInfo.address?`<div class="center">${shopInfo.address}</div>`:''}
  ${shopInfo.phone?`<div class="center">โทร: ${shopInfo.phone}</div>`:''}
  <div class="center">เลขที่: ${order.orderNo}</div>
  <div class="center">${orderType}${order.refNo?' #'+order.refNo:''}</div>
  ${order.customer?`<div class="center">${order.customer.name}</div>`:''}
  <div class="center">${orderDate}</div>
  <hr class="hr">
  ${itemsHtml}
  <hr class="hr">
  <div class="row"><span>รวม</span><span>฿${subtotal}</span></div>
  ${discount>0?`<div class="row"><span>ส่วนลด</span><span>-฿${discount}</span></div>`:''}
  <div class="row bold big"><span>ยอดรวม</span><span>฿${total}</span></div>
  ${isCash?`<div class="row"><span>รับเงิน</span><span>฿${received}</span></div><div class="row"><span>เงินทอน</span><span>฿${change}</span></div>`:''}
  ${receiptQrHtml}
  <hr class="hr">
  <div class="center">${shopInfo.footer||'ขอบคุณที่ใช้บริการ &#128522;'}</div>
</div>
<div class="action-bar">
  <button class="btn-ble full" id="btnBle">&#128225; พิมพ์ Bluetooth</button>
  <button class="btn-print" onclick="window.print()">&#128424; พิมพ์ปกติ</button>
  <button class="btn-png"   id="btnPng">&#128247; บันทึก PNG</button>
</div>
<div class="ble-st" id="bleSt">กด "พิมพ์ Bluetooth" เพื่อส่งไปยังเครื่องพิมพ์ 58mm</div>
<script>
var SVCS=['000018f0-0000-1000-8000-00805f9b34fb','0000ff00-0000-1000-8000-00805f9b34fb','49535343-fe7d-4ae5-8fa9-9fafd205e455','0000ffe0-0000-1000-8000-00805f9b34fb','e7810a71-73ae-499d-8c15-faa9aef0c3f2'];
var CHARS=['00002af1-0000-1000-8000-00805f9b34fb','0000ff02-0000-1000-8000-00805f9b34fb','0000ffe1-0000-1000-8000-00805f9b34fb','49535343-8841-43f4-a8d4-ecbe34729bb3','bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'];

async function write(ch,data){
  for(var i=0;i<data.length;i+=20){
    var c=data.slice(i,i+20);
    if(ch.properties.writeWithoutResponse) await ch.writeValueWithoutResponse(c);
    else await ch.writeValueWithResponse(c);
    await new Promise(function(r){setTimeout(r,20);});
  }
}

function buildESC(){
  var b=[],enc=new TextEncoder();
  var p=function(){for(var i=0;i<arguments.length;i++)b.push(arguments[i]);};
  var t=function(s){var x=enc.encode(s);for(var i=0;i<x.length;i++)b.push(x[i]);};
  var lf=function(){p(10);};
  var ESC=27,GS=29,W=32;
  p(ESC,64);p(ESC,116,21);p(ESC,97,1);
  p(GS,33,17);t(${shopName});lf();p(GS,33,0);
  ${shopAddr} && (t(JSON.parse(${shopAddr})),lf());
  ${shopPhone} && (t('Tel: '+JSON.parse(${shopPhone})),lf());
  p(ESC,97,0);
  t('--------------------------------');lf();
  t('No: ${order.orderNo}');lf();
  t('${orderType}${order.refNo?' #'+order.refNo.replace(/'/g,"") : ''}');lf();
  ${order.customer?`t('Cust: '+${custName});lf();`:''}
  t('${orderDate}');lf();
  t('--------------------------------');lf();
  var items=${escItemsJSON};
  items.forEach(function(i){
    var s=i.namepart+' '.repeat(i.pad)+'B'+i.pricepart;t(s);lf();
    if(i.addonStr){t('  +'+i.addonStr.substring(0,30));lf();}
    if(i.hasDisc){t('  Disc: '+i.discStr);lf();}
    if(i.note){t('  '+i.note);lf();}
  });
  t('--------------------------------');lf();
  var line=function(l,r){var sp=W-l.length-r.length;t(l+' '.repeat(Math.max(1,sp))+r);lf();};
  line('Subtotal','B${subtotal}');
  ${discount>0?`line('Discount','-B${discount}');`:''}
  p(ESC,69,1);line('TOTAL','B${total}');p(ESC,69,0);
  ${isCash?`line('Cash','B${received}');line('Change','B${change}');`:''}
  t('--------------------------------');lf();
  p(ESC,97,1);t(${shopFoot});lf();lf();lf();
  p(GS,86,1);
  return new Uint8Array(b);
}

document.getElementById('btnBle').onclick=async function(){
  var btn=this,st=document.getElementById('bleSt');
  if(!navigator.bluetooth){st.textContent='❌ ใช้ Chrome บน Android/Windows';st.style.color='#c0392b';return;}
  btn.disabled=true;btn.textContent='🔍 ค้นหา...';st.style.color='#666';
  try{
    var d=await navigator.bluetooth.requestDevice({
      filters:[{namePrefix:'JP'},{namePrefix:'POS'},{namePrefix:'pos'},{namePrefix:'RPP'},{namePrefix:'PT'},{namePrefix:'Printer'}],
      optionalServices:SVCS
    });
    st.textContent='🔗 '+d.name+'...';
    var srv=await d.gatt.connect(),ch=null;
    for(var s=0;s<SVCS.length&&!ch;s++){
      try{
        var svc=await srv.getPrimaryService(SVCS[s]);
        for(var c=0;c<CHARS.length&&!ch;c++){try{var x=await svc.getCharacteristic(CHARS[c]);if(x.properties.write||x.properties.writeWithoutResponse)ch=x;}catch(e){}}
        if(!ch){try{var all=await svc.getCharacteristics();for(var k=0;k<all.length&&!ch;k++)if(all[k].properties.write||all[k].properties.writeWithoutResponse)ch=all[k];}catch(e){}}
      }catch(e){}
    }
    if(!ch)throw new Error('ไม่พบ characteristic');
    st.textContent='📡 กำลังส่ง...';
    await write(ch,buildESC());
    btn.textContent='✅ พิมพ์แล้ว';st.textContent='✅ '+d.name;st.style.color='#27ae60';
    setTimeout(function(){btn.textContent='📡 พิมพ์ Bluetooth';btn.disabled=false;},3000);
  }catch(e){
    btn.textContent='📡 พิมพ์ Bluetooth';btn.disabled=false;
    st.textContent='❌ '+e.message;st.style.color='#c0392b';
  }
};

document.getElementById('btnPng').onclick=function(){
  var btn=this;btn.textContent='⏳...';btn.disabled=true;
  html2canvas(document.getElementById('receiptWrap'),{scale:2,backgroundColor:'#fff',useCORS:true,logging:false})
  .then(function(cv){
    var a=document.createElement('a');
    a.download='receipt-${orderNo}.png';a.href=cv.toDataURL('image/png');a.click();
    btn.textContent='✅ บันทึกแล้ว';
    setTimeout(function(){btn.textContent='📷 บันทึก PNG';btn.disabled=false;},2500);
  }).catch(function(){btn.textContent='📷 บันทึก PNG';btn.disabled=false;});
};
<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width='+(Math.min(paperWidth+60,440))+',height=780,resizable=yes');
  if(!w) { showToast('กรุณาอนุญาต popup เพื่อพิมพ์บิล','error'); return; }
  w.document.write(html);
  w.document.close();
}



// ── ORDERS ────────────────────────────────────────────────────
function renderOrdersTable() {
  const orders = DB.get('orders').slice().reverse();
  const tbody = document.getElementById('ordersTable');
  const date = document.getElementById('ordersDate')?.value||'';
  const filtered = date ? orders.filter(o=>o.date===date) : orders;
  if(!filtered.length) { tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px;">ไม่มีรายการ</td></tr>`; return; }
  tbody.innerHTML = filtered.map(o=>`
    <tr>
      <td>${filtered.indexOf(o)+1}</td>
      <td style="font-family:monospace;font-weight:600;">#${o.orderNo}</td>
      <td>${o.date} ${o.time}</td>
      <td>${o.customer?.name||'—'}</td>
      <td><span class="pill ${o.type==='grab'?'pill-green':o.type==='lineman'?'pill-gold':'pill-blue'}">${o.type==='grab'?'Grab':o.type==='lineman'?'LINE MAN':'หน้าร้าน'}</span>${o.refNo?`<div style="font-size:0.72rem;color:var(--muted);font-weight:700;margin-top:2px;">#${o.refNo}</div>`:''}</td>
      <td>${o.items.length} รายการ</td>
      <td style="font-weight:600;">฿${o.total}</td>
      <td><span class="pill ${o.status==='cancelled'?'pill-red':'pill-green'}">${o.status==='cancelled'?'ยกเลิก':'สำเร็จ'}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="viewOrder(${o.id})">ดู</button></td>
    </tr>
  `).join('');
}

function filterOrders() { renderOrdersTable(); }

function viewOrder(id) {
  const order = DB.get('orders').find(o=>o.id===id);
  if(!order) return;
  selectedOrderId = id;
  const shopInfo = DB.get('shopInfo',{});
  document.getElementById('orderDetailContent').innerHTML = `
    <div class="grid-2" style="gap:16px;margin-bottom:16px;">
      <div>
        <div style="font-size:0.82rem;color:var(--muted);">เลขที่</div>
        <div style="font-family:monospace;font-size:1.1rem;font-weight:700;">#${order.orderNo}</div>
      </div>
      <div>
        <div style="font-size:0.82rem;color:var(--muted);">วันที่</div>
        <div>${order.date} ${order.time}</div>
      </div>
      <div>
        <div style="font-size:0.82rem;color:var(--muted);">ลูกค้า</div>
        <div>${order.customer?.name||'—'}</div>
      </div>
      <div>
        <div style="font-size:0.82rem;color:var(--muted);">ประเภท</div>
        <div>${order.type==='grab'?'Grab':order.type==='lineman'?'LINE MAN':'หน้าร้าน'}${order.refNo?` · เลขที่ #${order.refNo}`:''}</div>
      </div>
    </div>
    <div class="receipt">
      ${DB.get('shopLogo','')?`<div style="text-align:center;margin-bottom:6px;"><img src="${DB.get('shopLogo','')}" style="max-width:100px;max-height:50px;object-fit:contain;"></div>`:''}
      <div class="receipt-logo">${shopInfo.name||'Long Do Cafe & Bakery'}</div>
      <div class="receipt-sub">เลขที่: ${order.orderNo}</div>
      <hr class="receipt-divider">
      ${order.items.map(i=>{
        const addonStr=(i.addons&&i.addons.length)?i.addons.map(a=>a.name+(a.price>0?' +฿'+a.price:'')).join(', '):'';
        const hasCustom=i.customPrice!==null&&i.customPrice!==undefined;
        const hasDisc=(i.itemDiscount||0)>0&&!hasCustom;
        const discLabel=hasDisc?(i.itemDiscountType==='pct'?`-${i.itemDiscount}%`:`-฿${i.itemDiscount}`):'';
        return `<div class="receipt-row"><span>${i.icon||''} ${i.name} x${i.qty}</span><span>฿${i.total}</span></div>
        ${addonStr?`<div style="font-size:0.72rem;color:var(--muted);padding-left:8px;">↳ ${addonStr}</div>`:''}
        ${hasCustom?`<div style="font-size:0.72rem;color:var(--sage);padding-left:8px;">💰 ราคาพิเศษ</div>`:''}
        ${hasDisc?`<div style="font-size:0.72rem;color:var(--red);padding-left:8px;">🏷️ ส่วนลด ${discLabel}</div>`:''}
        ${i.note?`<div style="font-size:0.72rem;color:var(--muted);padding-left:8px;">📝 ${i.note}</div>`:''}`;
      }).join('')}
      <hr class="receipt-divider">
      <div class="receipt-row"><span>รวม</span><span>฿${order.subtotal}</span></div>
      ${order.discount>0?`<div class="receipt-row"><span>ส่วนลด</span><span>-฿${order.discount}</span></div>`:''}
      <div class="receipt-row receipt-total"><span>ยอดรวม</span><span>฿${order.total}</span></div>
      ${order.payMethod==='cash'?`<div class="receipt-row"><span>รับเงิน</span><span>฿${order.received}</span></div><div class="receipt-row"><span>เงินทอน</span><span>฿${order.change}</span></div>`:''}
      ${DB.get('receiptQrImage','')?`<hr class="receipt-divider"><div style="text-align:center;"><div style="font-size:10px;color:#888;margin-bottom:4px;">สแกน QR ชำระเงิน</div><img src="${DB.get('receiptQrImage','')}" style="width:100px;height:100px;object-fit:contain;"></div>`:''}
    </div>
  `;
  const cancelBtn = document.getElementById('cancelOrderBtn');
  if(order.status==='cancelled') {
    cancelBtn.disabled=true; cancelBtn.textContent='ยกเลิกแล้ว';
  } else {
    cancelBtn.disabled=false; cancelBtn.textContent='🚫 ยกเลิกออเดอร์';
    cancelBtn.onclick=()=>cancelOrder(id);
  }
  openModal('orderDetailModal');
}

function cancelOrder(id) {
  if(!confirm('ยืนยันยกเลิกออเดอร์ #'+String(id).padStart(7,'0')+'?')) return;
  const orders = DB.get('orders');
  const i = orders.findIndex(o=>o.id===id);
  if(i>=0) { orders[i].status='cancelled'; DB.set('orders',orders); }
  closeModal('orderDetailModal');
  renderOrdersTable();
  showToast('ยกเลิกออเดอร์แล้ว','error');
}

function printOrder() {
  if(!selectedOrderId) return;
  const order = DB.get('orders').find(o=>o.id===selectedOrderId);
  if(order) printReceipt(order);
}

// ── ADDON GROUP MANAGEMENT ────────────────────────────────────
function renderAddonGroupList() {
  const groups = DB.get('addonGroups');
  const el = document.getElementById('addonGroupList');
  if(!el) return;
  if(!groups.length) { el.innerHTML='<div style="color:var(--muted);font-size:0.85rem;padding:8px 0;">ยังไม่มีกลุ่ม Add-on</div>'; return; }
  el.innerHTML = groups.map(g=>`
    <div class="card" style="margin-bottom:10px;padding:14px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div>
          <span style="font-weight:600;font-size:0.9rem;">${g.name}</span>
          <span style="margin-left:8px;font-size:0.72rem;color:var(--muted);background:var(--cream);border-radius:10px;padding:2px 8px;">
            ${g.required?'จำเป็น':'ไม่บังคับ'} · ${g.multi?'หลายตัว':'1 ตัว'}
          </span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick="openAddonGroupModal(${g.id})">✏️ แก้ไข</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAddonGroup(${g.id})">🗑️</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;">
        ${g.options.map(o=>`<span style="padding:3px 10px;border-radius:14px;background:var(--cream);border:1px solid var(--border);font-size:0.78rem;">
          ${o.name}${o.price>0?' +฿'+o.price:''}
        </span>`).join('')}
      </div>
    </div>`).join('');
}

let editingAddonGroupId = null;
let addonGroupOptions = []; // [{id,name,price}]

function openAddonGroupModal(id=null) {
  editingAddonGroupId = id;
  const groups = DB.get('addonGroups');
  if(id) {
    const g = groups.find(x=>x.id===id);
    if(!g) return;
    document.getElementById('agName').value = g.name;
    document.getElementById('agRequired').checked = g.required;
    document.getElementById('agMulti').checked = g.multi;
    addonGroupOptions = JSON.parse(JSON.stringify(g.options));
  } else {
    document.getElementById('agName').value = '';
    document.getElementById('agRequired').checked = false;
    document.getElementById('agMulti').checked = false;
    addonGroupOptions = [];
  }
  document.getElementById('agOptName').value='';
  document.getElementById('agOptPrice').value='';
  renderAddonOptList();
  openModal('addonGroupModal');
}

function renderAddonOptList() {
  const el = document.getElementById('agOptList');
  if(!el) return;
  if(!addonGroupOptions.length) { el.innerHTML='<div style="color:var(--muted);font-size:0.8rem;">ยังไม่มีตัวเลือก</div>'; return; }
  el.innerHTML = addonGroupOptions.map((o,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);">
      <span style="flex:1;font-size:0.85rem;">${o.name}</span>
      <span style="font-size:0.82rem;color:var(--caramel);min-width:40px;">${o.price>0?'+฿'+o.price:'ฟรี'}</span>
      <button onclick="removeAddonOpt(${i})" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.9rem;">✕</button>
    </div>`).join('');
}

function addAddonOpt() {
  const name = document.getElementById('agOptName').value.trim();
  const price = parseFloat(document.getElementById('agOptPrice').value)||0;
  if(!name) { showToast('กรุณาใส่ชื่อตัวเลือก','error'); return; }
  addonGroupOptions.push({id: Date.now()+Math.floor(Math.random()*1000), name, price});
  document.getElementById('agOptName').value='';
  document.getElementById('agOptPrice').value='';
  renderAddonOptList();
}

function removeAddonOpt(idx) {
  addonGroupOptions.splice(idx,1);
  renderAddonOptList();
}

function saveAddonGroup() {
  const name = document.getElementById('agName').value.trim();
  if(!name) { showToast('กรุณาใส่ชื่อกลุ่ม','error'); return; }
  if(!addonGroupOptions.length) { showToast('กรุณาเพิ่มตัวเลือกอย่างน้อย 1 รายการ','error'); return; }
  const groups = DB.get('addonGroups');
  const item = {
    name,
    required: document.getElementById('agRequired').checked,
    multi: document.getElementById('agMulti').checked,
    options: addonGroupOptions
  };
  if(editingAddonGroupId) {
    const i = groups.findIndex(g=>g.id===editingAddonGroupId);
    if(i>=0) groups[i]={...groups[i],...item};
  } else {
    item.id = Date.now(); groups.push(item);
  }
  DB.set('addonGroups',groups);
  closeModal('addonGroupModal');
  renderAddonGroupList();
  showToast('บันทึกกลุ่ม Add-on แล้ว','success');
}

function deleteAddonGroup(id) {
  if(!confirm('ลบกลุ่ม Add-on นี้?')) return;
  DB.set('addonGroups', DB.get('addonGroups').filter(g=>g.id!==id));
  // Remove from all menus
  const menus = DB.get('menus');
  menus.forEach(m=>{ if(m.addonGroups) m.addonGroups=m.addonGroups.filter(gid=>gid!==id); });
  DB.set('menus',menus);
  renderAddonGroupList();
  showToast('ลบกลุ่ม Add-on แล้ว');
}

// ── MENU MANAGEMENT ───────────────────────────────────────────
function renderMenuTable() {
  const menus = DB.get('menus');
  const cats = DB.get('categories');
  const ings = DB.get('ingredients');
  const q = document.getElementById('menuSearch')?.value?.toLowerCase()||'';
  const filtered = q ? menus.filter(m=>m.name.toLowerCase().includes(q)) : menus;
  const tbody = document.getElementById('menuTable');
  if(!filtered.length) { tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีเมนู</td></tr>`; return; }
  tbody.innerHTML = filtered.map(m=>{
    const cat = cats.find(c=>c.id===m.cat);
    // Recalculate live cost from recipe if exists
    let liveCost = m.cost||0;
    let hasRecipe = m.recipe && m.recipe.length>0;
    if(hasRecipe) {
      liveCost = Math.round(m.recipe.reduce((s,r)=>{
        const ing=ings.find(i=>i.id===r.ingId);
        return s+(ing?ing.price*r.qty:0);
      },0)*100)/100;
    }
    const gp = m.p1>0 ? Math.round((m.p1-liveCost)/m.p1*100) : 0;
    const costDisplay = hasRecipe
      ? `<span style="font-weight:600;">฿${liveCost}</span> <span style="font-size:0.7rem;color:var(--sage);" title="คำนวณจากสูตรวัตถุดิบ">🧪</span>`
      : `฿${liveCost}`;
    const addonBadge = (m.addonGroups&&m.addonGroups.length)
      ? `<span style="font-size:0.68rem;background:var(--caramel);color:white;border-radius:10px;padding:1px 7px;margin-left:4px;">+${m.addonGroups.length} Add-on</span>`
      : '';
    return `<tr>
      <td style="font-size:1.4rem;">${m.icon||'☕'}</td>
      <td style="font-weight:600;">${m.name}${addonBadge}</td>
      <td>${cat?cat.icon+' '+cat.name:'—'}</td>
      <td>฿${m.p1}</td>
      <td>฿${m.p2||'-'}</td>
      <td>฿${m.p3||'-'}</td>
      <td>${costDisplay}</td>
      <td><span class="pill ${gp>=50?'pill-green':gp>=30?'pill-gold':'pill-red'}">${gp}%</span></td>
      <td>
        <div class="td-actions">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="openMenuModal(${m.id})" title="แก้ไข">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteMenu(${m.id})" title="ลบ">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── RECIPE (per-menu ingredient linking) ─────────────────────
let currentRecipe = []; // [{ingId, qty}]

function refreshIngSelect() {
  const ings = DB.get('ingredients');
  const sel = document.getElementById('recipeIngSel');
  if(!sel) return;
  sel.innerHTML = ings.length
    ? ings.map(i=>`<option value="${i.id}">${i.name} (${i.unit}) — ฿${i.price}/${i.unit}</option>`).join('')
    : '<option value="">ไม่มีวัตถุดิบ</option>';
}

function calcRecipeCost() {
  const ings = DB.get('ingredients');
  let total = 0;
  currentRecipe.forEach(r => {
    const ing = ings.find(i=>i.id===r.ingId);
    if(ing) total += ing.price * r.qty;
  });
  return Math.round(total * 100) / 100;
}

function renderRecipeList() {
  const ings = DB.get('ingredients');
  const list = document.getElementById('recipeList');
  const totalBox = document.getElementById('recipeTotalBox');
  const totalVal = document.getElementById('recipeTotalVal');
  const costNote = document.getElementById('mCostNote');
  if(!list) return;

  if(!currentRecipe.length) {
    list.innerHTML = '<div style="font-size:0.8rem;color:var(--muted);padding:8px 0;">ยังไม่มีวัตถุดิบในสูตร</div>';
    if(totalBox) totalBox.style.display='none';
    if(costNote) costNote.style.display='block';
    return;
  }

  list.innerHTML = currentRecipe.map((r,idx) => {
    const ing = ings.find(i=>i.id===r.ingId);
    if(!ing) return '';
    const lineCost = Math.round(ing.price * r.qty * 100)/100;
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--cream);border-radius:8px;margin-bottom:6px;border:1px solid var(--border);">
      <div style="flex:1;font-size:0.82rem;">
        <span style="font-weight:600;">${ing.name}</span>
        <span style="color:var(--muted);"> ${r.qty} ${ing.unit}</span>
      </div>
      <div style="font-size:0.82rem;color:var(--caramel);font-weight:600;min-width:60px;text-align:right;">฿${lineCost}</div>
      <button onclick="removeRecipeRow(${idx})" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:1rem;padding:0 2px;" title="ลบ">✕</button>
    </div>`;
  }).join('');

  const total = calcRecipeCost();
  if(totalBox) { totalBox.style.display='block'; }
  if(totalVal) totalVal.textContent = total;
  // Auto-fill cost field
  const costField = document.getElementById('mCost');
  if(costField) costField.value = total;
  document.getElementById('mCostFromRecipe').textContent = `← คำนวณจากสูตร`;
  if(costNote) costNote.style.display='none';
}

function addRecipeRow() {
  const sel = document.getElementById('recipeIngSel');
  const qtyEl = document.getElementById('recipeIngQty');
  const ingId = parseInt(sel?.value);
  const qty = parseFloat(qtyEl?.value);
  if(!ingId) { showToast('กรุณาเลือกวัตถุดิบ','error'); return; }
  if(!qty || qty<=0) { showToast('กรุณาใส่ปริมาณ','error'); return; }
  // Merge if same ingredient
  const existing = currentRecipe.findIndex(r=>r.ingId===ingId);
  if(existing>=0) { currentRecipe[existing].qty = Math.round((currentRecipe[existing].qty + qty)*1000)/1000; }
  else { currentRecipe.push({ingId, qty}); }
  qtyEl.value = '';
  renderRecipeList();
}

function removeRecipeRow(idx) {
  currentRecipe.splice(idx,1);
  if(!currentRecipe.length) {
    document.getElementById('mCostFromRecipe').textContent='';
  }
  renderRecipeList();
}

function onManualCostEdit() {
  // When user types manually, clear recipe-linked label
  if(!currentRecipe.length) {
    document.getElementById('mCostFromRecipe').textContent='';
  }
}

function openMenuModal(id=null) {
  editingId=id;
  document.getElementById('menuModalTitle').textContent = id?'แก้ไขเมนู':'เพิ่มเมนู';
  // Fill category select
  const cats = DB.get('categories');
  const sel = document.getElementById('mCat');
  sel.innerHTML = cats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  // Fill ingredient select
  refreshIngSelect();
  // Fill addon group checkboxes
  const allGroups = DB.get('addonGroups');
  const addonGroupsEl = document.getElementById('mAddonGroups');
  if(addonGroupsEl) {
    addonGroupsEl.innerHTML = allGroups.length
      ? allGroups.map(g=>`<label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;cursor:pointer;padding:3px 0;">
          <input type="checkbox" id="mag_${g.id}" value="${g.id}" style="accent-color:var(--caramel);">
          <span>${g.name}</span>
          <span style="font-size:0.7rem;color:var(--muted);">(${g.options.length} ตัวเลือก)</span>
        </label>`).join('')
      : '<div style="font-size:0.78rem;color:var(--muted);">ยังไม่มีกลุ่ม Add-on — สร้างได้ที่หน้าจัดการเมนู</div>';
  }
  // Init data
  if(id) {
    const m = DB.get('menus').find(x=>x.id===id);
    if(m) {
      document.getElementById('mIcon').value=m.icon||'';
      document.getElementById('mName').value=m.name;
      sel.value=m.cat;
      document.getElementById('mP1').value=m.p1||'';
      document.getElementById('mP2').value=m.p2||'';
      document.getElementById('mP3').value=m.p3||'';
      document.getElementById('mCost').value=m.cost||'';
      currentRecipe = m.recipe ? JSON.parse(JSON.stringify(m.recipe)) : [];
      // Check linked addon groups
      const linkedGroups = m.addonGroups||[];
      allGroups.forEach(g=>{ const cb=document.getElementById('mag_'+g.id); if(cb) cb.checked=linkedGroups.includes(g.id); });
    }
  } else {
    ['mIcon','mName','mP1','mP2','mP3','mCost'].forEach(id=>document.getElementById(id).value='');
    currentRecipe = [];
    allGroups.forEach(g=>{ const cb=document.getElementById('mag_'+g.id); if(cb) cb.checked=false; });
  }
  document.getElementById('mCostFromRecipe').textContent = currentRecipe.length ? '← คำนวณจากสูตร' : '';
  document.getElementById('recipeIngQty').value='';
  renderRecipeList();
  openModal('menuModal');
}

function saveMenu() {
  const name = document.getElementById('mName').value.trim();
  if(!name) { showToast('กรุณาใส่ชื่อเมนู','error'); return; }
  const menus = DB.get('menus');
  // Use recipe cost if recipe exists, else use manual cost
  const recipeCost = currentRecipe.length ? calcRecipeCost() : null;
  const manualCost = parseFloat(document.getElementById('mCost').value)||0;
  const finalCost = recipeCost !== null ? recipeCost : manualCost;
  const allGroups = DB.get('addonGroups');
  const linkedAddonGroups = allGroups.filter(g=>{ const cb=document.getElementById('mag_'+g.id); return cb&&cb.checked; }).map(g=>g.id);
  const item = {
    icon: document.getElementById('mIcon').value||'☕',
    name, cat: parseInt(document.getElementById('mCat').value)||1,
    p1: parseFloat(document.getElementById('mP1').value)||0,
    p2: parseFloat(document.getElementById('mP2').value)||0,
    p3: parseFloat(document.getElementById('mP3').value)||0,
    cost: finalCost,
    recipe: currentRecipe.length ? JSON.parse(JSON.stringify(currentRecipe)) : [],
    addonGroups: linkedAddonGroups,
  };
  if(editingId) {
    const i=menus.findIndex(m=>m.id===editingId); if(i>=0){menus[i]={...menus[i],...item};}
  } else {
    item.id = Date.now(); menus.push(item);
  }
  DB.set('menus',menus);
  closeModal('menuModal');
  renderMenuTable();
  renderPosCats();
  renderPosMenu();
  fillPromoSel();
  showToast('บันทึกเมนูแล้ว','success');
}

function deleteMenu(id) {
  if(!confirm('ลบเมนูนี้?')) return;
  DB.set('menus', DB.get('menus').filter(m=>m.id!==id));
  renderMenuTable();
  renderPosMenu();
  showToast('ลบเมนูแล้ว');
}

// ── CATEGORIES ────────────────────────────────────────────────
function renderCatGrid() {
  const cats = DB.get('categories');
  const el = document.getElementById('catGrid');
  if(!cats.length) { el.innerHTML='<div class="empty-state"><div class="empty-icon">🏷️</div><p>ไม่มีหมวดหมู่</p></div>'; return; }
  el.innerHTML = cats.map(c=>`
    <div class="card" style="text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:8px;">${c.icon}</div>
      <div style="font-weight:600;font-size:1rem;margin-bottom:12px;">${c.name}</div>
      <div style="display:flex;gap:6px;justify-content:center;">
        <button class="btn btn-ghost btn-sm" onclick="openCatModal(${c.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCat(${c.id})">🗑️</button>
      </div>
    </div>
  `).join('');
}

function openCatModal(id=null) {
  editingId=id;
  if(id) {
    const c=DB.get('categories').find(x=>x.id===id);
    if(c){ document.getElementById('cIcon').value=c.icon||''; document.getElementById('cName').value=c.name; }
  } else { document.getElementById('cIcon').value=''; document.getElementById('cName').value=''; }
  openModal('catModal');
}

function saveCat() {
  const name=document.getElementById('cName').value.trim();
  if(!name){showToast('กรุณาใส่ชื่อหมวดหมู่','error');return;}
  const cats=DB.get('categories');
  const item={icon:document.getElementById('cIcon').value||'🏷️',name};
  if(editingId){const i=cats.findIndex(c=>c.id===editingId);if(i>=0)cats[i]={...cats[i],...item};}
  else{item.id=Date.now();cats.push(item);}
  DB.set('categories',cats);
  closeModal('catModal');
  renderCatGrid();
  renderPosCats();
  showToast('บันทึกหมวดหมู่แล้ว','success');
}

function deleteCat(id) {
  if(!confirm('ลบหมวดหมู่นี้?'))return;
  DB.set('categories',DB.get('categories').filter(c=>c.id!==id));
  renderCatGrid();
  renderPosCats();
  showToast('ลบหมวดหมู่แล้ว');
}

// ── CUSTOMERS ─────────────────────────────────────────────────
function renderCustomerTable() {
  const custs=DB.get('customers');
  const q=document.getElementById('custSearch')?.value?.toLowerCase()||'';
  const filtered=q?custs.filter(c=>c.name.toLowerCase().includes(q)||c.phone?.includes(q)):custs;
  const tbody=document.getElementById('custTable');
  if(!filtered.length){tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีลูกค้า</td></tr>`;return;}
  tbody.innerHTML=filtered.map(c=>`<tr>
    <td style="font-weight:600;">${c.name}</td>
    <td>${c.phone||'—'}</td>
    <td><span class="pill pill-blue">${getCustTypeName(c.type)}</span></td>
    <td>฿${(c.total||0).toLocaleString()}</td>
    <td>${c.lastOrder||'—'}</td>
    <td><div class="td-actions">
      <button class="btn btn-ghost btn-sm btn-icon" onclick="openCustomerModal(${c.id})">✏️</button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteCust(${c.id})">🗑️</button>
    </div></td>
  </tr>`).join('');
}

function getCustTypeName(typeId){
  const t=DB.get('customerTypes').find(x=>x.id==typeId);
  return t?t.name:'—';
}

function openCustomerModal(id=null){
  editingId=id;
  document.getElementById('custModalTitle').textContent=id?'แก้ไขลูกค้า':'เพิ่มลูกค้า';
  const types=DB.get('customerTypes');
  const sel=document.getElementById('custType');
  sel.innerHTML=types.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  if(id){const c=DB.get('customers').find(x=>x.id===id);if(c){document.getElementById('custName').value=c.name;document.getElementById('custPhone').value=c.phone||'';sel.value=c.type;}}
  else{['custName','custPhone'].forEach(i=>document.getElementById(i).value='');}
  openModal('custModal');
}

function saveCust(){
  const name=document.getElementById('custName').value.trim();
  if(!name){showToast('กรุณาใส่ชื่อลูกค้า','error');return;}
  const custs=DB.get('customers');
  const item={name,phone:document.getElementById('custPhone').value,type:parseInt(document.getElementById('custType').value)||1};
  if(editingId){const i=custs.findIndex(c=>c.id===editingId);if(i>=0)custs[i]={...custs[i],...item};}
  else{item.id=Date.now();item.total=0;item.lastOrder='';custs.push(item);}
  DB.set('customers',custs);
  closeModal('custModal');
  renderCustomerTable();
  showToast('บันทึกลูกค้าแล้ว','success');
}

function deleteCust(id){
  if(!confirm('ลบลูกค้านี้?'))return;
  DB.set('customers',DB.get('customers').filter(c=>c.id!==id));
  renderCustomerTable();
  showToast('ลบลูกค้าแล้ว');
}

function openCustTypeModal(){
  renderCustTypeList();
  openModal('custTypeModal');
}

function renderCustTypeList(){
  const types=DB.get('customerTypes');
  document.getElementById('custTypeList').innerHTML=types.map(t=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <span>${t.name}</span>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteCustType(${t.id})">🗑️</button>
    </div>
  `).join('');
}

function addCustType(){
  const name=document.getElementById('newCustTypeName').value.trim();
  if(!name)return;
  const types=DB.get('customerTypes');
  types.push({id:Date.now(),name});
  DB.set('customerTypes',types);
  document.getElementById('newCustTypeName').value='';
  renderCustTypeList();
  showToast('เพิ่มประเภทลูกค้าแล้ว','success');
}

function deleteCustType(id){
  DB.set('customerTypes',DB.get('customerTypes').filter(t=>t.id!==id));
  renderCustTypeList();
}

// ── PROMOTIONS ────────────────────────────────────────────────
function renderPromoTable(){
  const promos=DB.get('promotions');
  const tbody=document.getElementById('promoTable');
  if(!promos.length){tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีโปรโมชั่น</td></tr>`;return;}
  tbody.innerHTML=promos.map(p=>`<tr>
    <td style="font-weight:600;">${p.name}</td>
    <td style="font-weight:700;color:var(--caramel);">${p.type==='pct'?p.value+'%':'฿'+p.value}</td>
    <td>${p.type==='pct'?'เปอร์เซ็นต์':'บาท'}</td>
    <td>${p.used||0} ครั้ง</td>
    <td>฿${(p.totalDiscount||0).toLocaleString()}</td>
    <td><span class="pill ${p.active?'pill-green':'pill-gray'}">${p.active?'ใช้งาน':'ปิด'}</span></td>
    <td><div class="td-actions">
      <button class="btn btn-ghost btn-sm btn-icon" onclick="togglePromo(${p.id})">${p.active?'🔴':'🟢'}</button>
      <button class="btn btn-ghost btn-sm btn-icon" onclick="openPromoModal(${p.id})">✏️</button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deletePromo(${p.id})">🗑️</button>
    </div></td>
  </tr>`).join('');
}

function openPromoModal(id=null){
  editingId=id;
  document.getElementById('promoModalTitle').textContent=id?'แก้ไขโปรโมชั่น':'เพิ่มโปรโมชั่น';
  if(id){const p=DB.get('promotions').find(x=>x.id===id);if(p){document.getElementById('promoName').value=p.name;document.getElementById('promoValue').value=p.value;document.getElementById('promoType').value=p.type;document.getElementById('promoStart').value=p.start||'';document.getElementById('promoEnd').value=p.end||'';}}
  else{['promoName','promoValue','promoStart','promoEnd'].forEach(i=>document.getElementById(i).value='');document.getElementById('promoType').value='thb';}
  openModal('promoModal');
}

function savePromo(){
  const name=document.getElementById('promoName').value.trim();
  if(!name){showToast('กรุณาใส่ชื่อโปรโมชั่น','error');return;}
  const promos=DB.get('promotions');
  const item={name,value:parseFloat(document.getElementById('promoValue').value)||0,type:document.getElementById('promoType').value,start:document.getElementById('promoStart').value,end:document.getElementById('promoEnd').value,active:true};
  if(editingId){const i=promos.findIndex(p=>p.id===editingId);if(i>=0)promos[i]={...promos[i],...item};}
  else{item.id=Date.now();item.used=0;item.totalDiscount=0;promos.push(item);}
  DB.set('promotions',promos);
  closeModal('promoModal');
  renderPromoTable();
  fillPromoSel();
  showToast('บันทึกโปรโมชั่นแล้ว','success');
}

function togglePromo(id){
  const promos=DB.get('promotions');
  const i=promos.findIndex(p=>p.id===id);
  if(i>=0)promos[i].active=!promos[i].active;
  DB.set('promotions',promos);
  renderPromoTable();
  fillPromoSel();
}

function deletePromo(id){
  if(!confirm('ลบโปรโมชั่นนี้?'))return;
  DB.set('promotions',DB.get('promotions').filter(p=>p.id!==id));
  renderPromoTable();
  fillPromoSel();
  showToast('ลบโปรโมชั่นแล้ว');
}

// ── INGREDIENTS ───────────────────────────────────────────────
function renderIngTable(){
  const ings=DB.get('ingredients');
  const tbody=document.getElementById('ingTable');
  if(!ings.length){tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีวัตถุดิบ</td></tr>`;return;}
  const now=new Date();
  tbody.innerHTML=ings.map(i=>{
    const exp=i.expiry?new Date(i.expiry):null;
    const daysLeft=exp?Math.ceil((exp-now)/86400000):null;
    let status='pill-green',statusTxt='ปกติ';
    if(daysLeft!==null&&daysLeft<0){status='pill-red';statusTxt='หมดอายุ';}
    else if(daysLeft!==null&&daysLeft<=7){status='pill-gold';statusTxt='ใกล้หมด '+(daysLeft)+'วัน';}
    return `<tr>
      <td style="font-weight:600;">${i.name}</td>
      <td>${i.unit}</td>
      <td>฿${i.price}/${i.unit}</td>
      <td>${i.stock} ${i.unit}</td>
      <td>${i.expiry||'—'}</td>
      <td><span class="pill ${status}">${statusTxt}</span></td>
      <td><div class="td-actions">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="openIngModal(${i.id})">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteIng(${i.id})">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function openIngModal(id=null){
  editingId=id;
  document.getElementById('ingModalTitle').textContent=id?'แก้ไขวัตถุดิบ':'เพิ่มวัตถุดิบ';
  if(id){const i=DB.get('ingredients').find(x=>x.id===id);if(i){document.getElementById('ingName').value=i.name;document.getElementById('ingUnit').value=i.unit;document.getElementById('ingPrice').value=i.price;document.getElementById('ingStock').value=i.stock;document.getElementById('ingExpiry').value=i.expiry||'';}}
  else{['ingName','ingUnit','ingPrice','ingStock','ingExpiry'].forEach(i=>document.getElementById(i).value='');}
  openModal('ingModal');
}

function saveIng(){
  const name=document.getElementById('ingName').value.trim();
  if(!name){showToast('กรุณาใส่ชื่อวัตถุดิบ','error');return;}
  const ings=DB.get('ingredients');
  const item={name,unit:document.getElementById('ingUnit').value||'ชิ้น',price:parseFloat(document.getElementById('ingPrice').value)||0,stock:parseFloat(document.getElementById('ingStock').value)||0,expiry:document.getElementById('ingExpiry').value||''};
  if(editingId){const i=ings.findIndex(x=>x.id===editingId);if(i>=0)ings[i]={...ings[i],...item};}
  else{item.id=Date.now();ings.push(item);}
  DB.set('ingredients',ings);
  // Recalculate cost for all menus that have recipe linked to this ingredient
  const menus=DB.get('menus');
  let updated=false;
  menus.forEach((m,idx)=>{
    if(m.recipe&&m.recipe.length){
      const newCost=Math.round(m.recipe.reduce((s,r)=>{
        const ing=ings.find(i=>i.id===r.ingId);
        return s+(ing?ing.price*r.qty:0);
      },0)*100)/100;
      if(menus[idx].cost!==newCost){menus[idx].cost=newCost;updated=true;}
    }
  });
  if(updated) DB.set('menus',menus);
  closeModal('ingModal');
  renderIngTable();
  if(updated) renderMenuTable();
  showToast('บันทึกวัตถุดิบแล้ว'+(updated?' (อัปเดตต้นทุนเมนูแล้ว)':''),'success');
}

function deleteIng(id){
  if(!confirm('ลบวัตถุดิบนี้?'))return;
  DB.set('ingredients',DB.get('ingredients').filter(i=>i.id!==id));
  renderIngTable();
  showToast('ลบวัตถุดิบแล้ว');
}

// ── EXPENSES ──────────────────────────────────────────────────
let _expReceiptData = '';

function renderExpTable(){
  const exps=DB.get('expenses').slice().reverse();
  const tbody=document.getElementById('expTable');
  if(!exps.length){tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีรายจ่าย</td></tr>`;return;}
  tbody.innerHTML=exps.map(e=>`<tr>
    <td>${e.date}</td>
    <td style="font-weight:600;">${e.name}</td>
    <td><span class="pill pill-gray">${e.cat}</span></td>
    <td style="font-weight:600;color:var(--red);">฿${e.amount.toLocaleString()}</td>
    <td>${e.note||'—'}</td>
    <td>${e.receipt?`<img src="${e.receipt}" class="receipt-thumb" onclick="viewReceipt('${e.receipt}')">`:'—'}</td>
    <td><button class="btn btn-danger btn-sm btn-icon" onclick="deleteExp(${e.id})">🗑️</button></td>
  </tr>`).join('');
}

function openExpenseModal(){
  document.getElementById('expDate').value=today();
  ['expName','expAmount','expNote'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('expReceiptUpload').value='';
  _expReceiptData='';
  document.getElementById('expReceiptPreview').style.display='none';
  document.getElementById('expReceiptPreview').src='';
  document.getElementById('expReceiptRemoveWrap').style.display='none';
  openModal('expenseModal');
}

function handleExpReceiptUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  compressImage(file, 1000, 0.7, (dataUrl)=>{
    _expReceiptData=dataUrl;
    const prev=document.getElementById('expReceiptPreview');
    prev.src=dataUrl;
    prev.style.display='block';
    document.getElementById('expReceiptRemoveWrap').style.display='block';
  });
}

function removeExpReceipt(){
  _expReceiptData='';
  document.getElementById('expReceiptUpload').value='';
  document.getElementById('expReceiptPreview').style.display='none';
  document.getElementById('expReceiptPreview').src='';
  document.getElementById('expReceiptRemoveWrap').style.display='none';
}

function viewReceipt(src){
  document.getElementById('receiptLightboxImg').src=src;
  document.getElementById('receiptLightbox').classList.add('open');
}

function closeReceiptLightbox(){
  document.getElementById('receiptLightbox').classList.remove('open');
}

function saveExpense(){
  const name=document.getElementById('expName').value.trim();
  const amount=parseFloat(document.getElementById('expAmount').value);
  if(!name||!amount){showToast('กรุณาใส่ข้อมูลให้ครบ','error');return;}
  const exps=DB.get('expenses');
  exps.push({id:Date.now(),name,cat:document.getElementById('expCat').value,amount,date:document.getElementById('expDate').value,note:document.getElementById('expNote').value,receipt:_expReceiptData||''});
  DB.set('expenses',exps);
  closeModal('expenseModal');
  renderExpTable();
  showToast('บันทึกรายจ่ายแล้ว','success');
}

function deleteExp(id){
  if(!confirm('ลบรายจ่ายนี้?'))return;
  DB.set('expenses',DB.get('expenses').filter(e=>e.id!==id));
  renderExpTable();
}

// ── REPORTS ───────────────────────────────────────────────────
function switchReportTab(period, page) {
  reportPeriod[page.replace('report-','')] = period;
  const pageEl = document.getElementById('page-'+page);
  pageEl.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  event.target.classList.add('active');
  if(page==='report-sales') renderSalesReport();
  if(page==='report-profit') renderProfitReport();
  if(page==='report-products') renderTopProductsReport();
}

function getFilteredOrders(period) {
  const orders = DB.get('orders').filter(o=>o.status!=='cancelled');
  const now = new Date();
  if(period==='day') return orders.filter(o=>o.date===today());
  if(period==='month') return orders.filter(o=>o.date.startsWith(now.toISOString().slice(0,7)));
  return orders.filter(o=>o.date.startsWith(String(now.getFullYear())));
}

function renderSalesReport(){
  const period = reportPeriod.sales||'day';
  const orders = getFilteredOrders(period);
  const total = orders.reduce((s,o)=>s+o.total,0);
  const totalDisc = orders.reduce((s,o)=>s+(o.discount||0),0);
  const cost = orders.reduce((s,o)=>s+(o.cost||0),0);
  const profit = orders.reduce((s,o)=>s+(o.profit||0),0);
  const expenses = DB.get('expenses').filter(e=>period==='day'?e.date===today():period==='month'?e.date.startsWith(new Date().toISOString().slice(0,7)):e.date.startsWith(String(new Date().getFullYear())));
  const expTotal = expenses.reduce((s,e)=>s+e.amount,0);

  document.getElementById('salesStatCards').innerHTML = `
    <div class="stat-card"><div class="stat-label">ยอดขายรวม</div><div class="stat-value">฿${total.toLocaleString()}</div></div>
    <div class="stat-card"><div class="stat-label">จำนวนออเดอร์</div><div class="stat-value">${orders.length}</div></div>
    <div class="stat-card"><div class="stat-label">ส่วนลดรวม</div><div class="stat-value red">฿${totalDisc.toLocaleString()}</div></div>
    <div class="stat-card"><div class="stat-label">รายจ่าย</div><div class="stat-value red">฿${expTotal.toLocaleString()}</div></div>
  `;

  // Simple chart
  renderSalesChart(orders, period);
  renderCompareChart(period);
  renderSalesByType(orders);
  renderExpByCat(expenses);

  // Table
  const tbody=document.getElementById('salesReportTable');
  if(!orders.length){tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีข้อมูล</td></tr>`;return;}
  tbody.innerHTML=orders.slice().reverse().map(o=>`<tr>
    <td style="font-family:monospace;">#${o.orderNo}</td>
    <td>${o.date} ${o.time}</td>
    <td>${o.customer?.name||'—'}</td>
    <td><span class="pill pill-blue">${o.type==='grab'?'Grab':o.type==='lineman'?'LINE MAN':'หน้าร้าน'}</span>${o.refNo?`<div style="font-size:0.72rem;color:var(--muted);font-weight:700;margin-top:2px;">#${o.refNo}</div>`:''}</td>
    <td>฿${o.subtotal}</td>
    <td style="color:var(--red);">${o.discount>0?'-฿'+o.discount:'—'}</td>
    <td style="font-weight:600;">฿${o.total}</td>
  </tr>`).join('');
}

function renderSalesChart(orders, period) {
  const el = document.getElementById('salesChart');
  const labelEl = document.getElementById('salesChartLabels');
  let buckets = [], labels = [];
  if(period==='day') {
    for(let h=6;h<=22;h++){buckets.push({label:h+':00',val:0});}
    orders.forEach(o=>{const h=parseInt(o.time?.split(':')[0]||'0');const i=h-6;if(i>=0&&i<17)buckets[i].val+=o.total;});
  } else if(period==='month') {
    const days=new Date().getDate();
    for(let d=1;d<=days;d++)buckets.push({label:d,val:0});
    orders.forEach(o=>{const d=parseInt(o.date.split('-')[2]||'1')-1;if(buckets[d])buckets[d].val+=o.total;});
  } else {
    const months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    months.forEach(m=>buckets.push({label:m,val:0}));
    orders.forEach(o=>{const m=parseInt(o.date.split('-')[1]||'1')-1;if(buckets[m])buckets[m].val+=o.total;});
  }
  const max=Math.max(...buckets.map(b=>b.val),1);
  const show=buckets.slice(-16);
  el.innerHTML=show.map(b=>`<div class="bar" style="height:${Math.max(4,b.val/max*110)}px;" title="${b.label}: ฿${b.val}"></div>`).join('');
  labelEl.innerHTML=show.map(b=>`<div class="bar-label" style="flex:1;">${b.label}</div>`).join('');
}

// Sales vs expenses comparison chart. Since expenses only carry a date (no time-of-day),
// buckets are always date-based: last 7 days / each day this month / each month this year.
function renderCompareChart(period){
  const el = document.getElementById('compareChart');
  const labelEl = document.getElementById('compareChartLabels');
  const netEl = document.getElementById('compareNet');
  if(!el) return;

  const allOrders = DB.get('orders').filter(o=>o.status!=='cancelled');
  const allExpenses = DB.get('expenses');
  const pad = n => String(n).padStart(2,'0');
  let buckets = [];

  if(period==='day'){
    for(let i=6;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      const ds=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      buckets.push({label:`${d.getDate()}/${d.getMonth()+1}`, match:o=>o.date===ds});
    }
  } else if(period==='month'){
    const now=new Date();
    const days=new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    for(let d=1; d<=days; d++){
      const ds=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(d)}`;
      buckets.push({label:String(d), match:o=>o.date===ds});
    }
  } else {
    const months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const year=String(new Date().getFullYear());
    months.forEach((m,i)=>buckets.push({label:m, match:o=>o.date.startsWith(`${year}-${pad(i+1)}`)}));
  }

  buckets.forEach(b=>{
    b.sales = allOrders.filter(b.match).reduce((s,o)=>s+o.total,0);
    b.exp = allExpenses.filter(b.match).reduce((s,e)=>s+e.amount,0);
  });

  const show = buckets.slice(-16);
  const max = Math.max(...show.map(b=>Math.max(b.sales,b.exp)), 1);

  el.innerHTML = show.map(b=>`
    <div class="bar-group">
      <div class="bar-sales" style="height:${Math.max(3,b.sales/max*120)}px;" title="ยอดขาย ${b.label}: ฿${b.sales.toLocaleString()}"></div>
      <div class="bar-expense" style="height:${Math.max(3,b.exp/max*120)}px;" title="รายจ่าย ${b.label}: ฿${b.exp.toLocaleString()}"></div>
    </div>`).join('');
  labelEl.innerHTML = show.map(b=>`<div class="bar-label" style="flex:1;">${b.label}</div>`).join('');

  const totalSales = show.reduce((s,b)=>s+b.sales,0);
  const totalExp = show.reduce((s,b)=>s+b.exp,0);
  const net = totalSales - totalExp;
  if(netEl){
    netEl.style.color = net>=0 ? 'var(--sage)' : 'var(--red)';
    netEl.textContent = `สุทธิ: ${net>=0?'+':''}฿${net.toLocaleString()}`;
  }
}

// Breakdown of sales by order channel/type (หน้าร้าน / Grab / LINE MAN)
function renderSalesByType(orders){
  const tbody = document.getElementById('salesByTypeTable');
  if(!tbody) return;
  const types = [
    {label:'หน้าร้าน', match:o=>!o.type||o.type==='instore'},
    {label:'Grab', match:o=>o.type==='grab'},
    {label:'LINE MAN', match:o=>o.type==='lineman'}
  ];
  const total = orders.reduce((s,o)=>s+o.total,0);
  const rows = types.map(t=>{
    const list = orders.filter(t.match);
    const sum = list.reduce((s,o)=>s+o.total,0);
    return {label:t.label, count:list.length, sum, pct: total>0?Math.round(sum/total*100):0};
  });
  if(!orders.length){
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีข้อมูล</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r=>`<tr>
    <td>${r.label}</td>
    <td>${r.count}</td>
    <td style="font-weight:600;">฿${r.sum.toLocaleString()}</td>
    <td>
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="flex:1;background:var(--border);border-radius:4px;height:6px;overflow:hidden;">
          <div style="width:${r.pct}%;height:100%;background:var(--sage);"></div>
        </div>
        <span style="font-size:12px;color:var(--muted);min-width:32px;text-align:right;">${r.pct}%</span>
      </div>
    </td>
  </tr>`).join('');
}

// Breakdown of expenses by category (วัตถุดิบ / ค่าเช่า / ค่าแรง / ค่าสาธารณูปโภค / อื่นๆ)
function renderExpByCat(expenses){
  const tbody = document.getElementById('expByCatTable');
  if(!tbody) return;
  const cats = ['วัตถุดิบ','ค่าเช่า','ค่าแรง','ค่าสาธารณูปโภค','อื่นๆ'];
  const total = expenses.reduce((s,e)=>s+e.amount,0);
  const rows = cats.map(c=>{
    const list = expenses.filter(e=>(e.cat||'อื่นๆ')===c);
    const sum = list.reduce((s,e)=>s+e.amount,0);
    return {label:c, count:list.length, sum, pct: total>0?Math.round(sum/total*100):0};
  });
  if(!expenses.length){
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีข้อมูล</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r=>`<tr>
    <td>${r.label}</td>
    <td>${r.count}</td>
    <td style="font-weight:600;color:var(--red);">฿${r.sum.toLocaleString()}</td>
    <td>
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="flex:1;background:var(--border);border-radius:4px;height:6px;overflow:hidden;">
          <div style="width:${r.pct}%;height:100%;background:var(--red);"></div>
        </div>
        <span style="font-size:12px;color:var(--muted);min-width:32px;text-align:right;">${r.pct}%</span>
      </div>
    </td>
  </tr>`).join('');
}

function renderProfitReport(){
  const period = reportPeriod.profit||'day';
  const orders = getFilteredOrders(period);
  const revenue = orders.reduce((s,o)=>s+o.total,0);
  const cost = orders.reduce((s,o)=>s+(o.cost||0),0);
  const profit = revenue-cost;
  const gpPct = revenue>0?Math.round(profit/revenue*100):0;
  const expenses = DB.get('expenses').filter(e=>period==='day'?e.date===today():period==='month'?e.date.startsWith(new Date().toISOString().slice(0,7)):e.date.startsWith(String(new Date().getFullYear())));
  const expTotal = expenses.reduce((s,e)=>s+e.amount,0);
  const netProfit = profit-expTotal;

  document.getElementById('profitStatCards').innerHTML = `
    <div class="stat-card"><div class="stat-label">รายได้รวม</div><div class="stat-value">฿${revenue.toLocaleString()}</div></div>
    <div class="stat-card"><div class="stat-label">ต้นทุนสินค้า</div><div class="stat-value red">฿${cost.toLocaleString()}</div></div>
    <div class="stat-card"><div class="stat-label">กำไรขั้นต้น</div><div class="stat-value ${profit>=0?'green':'red'}">฿${profit.toLocaleString()} (${gpPct}%)</div></div>
    <div class="stat-card"><div class="stat-label">กำไรสุทธิ</div><div class="stat-value ${netProfit>=0?'green':'red'}">฿${netProfit.toLocaleString()}</div></div>
  `;

  // Per-product profit
  const menus = DB.get('menus');
  const itemSales = {};
  orders.forEach(o=>o.items.forEach(i=>{
    if(!itemSales[i.id])itemSales[i.id]={name:i.name,qty:0,revenue:0,cost:0};
    itemSales[i.id].qty+=i.qty;
    itemSales[i.id].revenue+=i.total;
    itemSales[i.id].cost+=(i.cost||0)*i.qty;
  }));

  const tbody=document.getElementById('profitTable');
  const rows=Object.values(itemSales).sort((a,b)=>b.revenue-a.revenue);
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีข้อมูล</td></tr>`;return;}
  tbody.innerHTML=rows.map(r=>{
    const menu=menus.find(m=>m.name===r.name)||{p1:r.revenue/Math.max(r.qty,1),cost:r.cost/Math.max(r.qty,1)};
    const pricePerUnit=Math.round(r.revenue/Math.max(r.qty,1));
    const costPerUnit=Math.round(r.cost/Math.max(r.qty,1));
    const profitPerUnit=pricePerUnit-costPerUnit;
    const gp=pricePerUnit>0?Math.round(profitPerUnit/pricePerUnit*100):0;
    const totalP=r.revenue-r.cost;
    return `<tr>
      <td style="font-weight:600;">${r.name}</td>
      <td>${r.qty} ชิ้น</td>
      <td>฿${costPerUnit}</td>
      <td>฿${pricePerUnit}</td>
      <td style="color:${profitPerUnit>=0?'var(--sage)':'var(--red)'};">฿${profitPerUnit}</td>
      <td><span class="pill ${gp>=50?'pill-green':gp>=30?'pill-gold':'pill-red'}">${gp}%</span></td>
      <td>${r.qty}</td>
      <td style="font-weight:700;color:${totalP>=0?'var(--sage)':'var(--red)'};">฿${totalP.toLocaleString()}</td>
    </tr>`;
  }).join('');
}

function renderTopProductsReport(){
  const period = reportPeriod.products||'day';
  const orders = getFilteredOrders(period);
  const itemSales = {};
  orders.forEach(o=>o.items.forEach(i=>{
    if(!itemSales[i.id]){const m=DB.get('menus').find(x=>x.id===i.id)||{};itemSales[i.id]={name:i.name,cat:m.cat,qty:0,revenue:0};}
    itemSales[i.id].qty+=i.qty;
    itemSales[i.id].revenue+=i.total;
  }));
  const cats=DB.get('categories');
  const rows=Object.values(itemSales).sort((a,b)=>b.qty-a.qty);
  const tbody=document.getElementById('topProductsTable');
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีข้อมูล</td></tr>`;return;}
  tbody.innerHTML=rows.map((r,idx)=>{
    const cat=cats.find(c=>c.id===r.cat);
    const medals=['🥇','🥈','🥉'];
    return `<tr>
      <td style="font-size:1.2rem;">${medals[idx]||idx+1}</td>
      <td style="font-weight:600;">${r.name}</td>
      <td>${cat?cat.icon+' '+cat.name:'—'}</td>
      <td style="font-weight:700;">${r.qty} ชิ้น</td>
      <td>฿${r.revenue.toLocaleString()}</td>
      <td><span class="pill pill-green">+${Math.round(r.qty/Math.max(rows[0].qty,1)*100)}%</span></td>
    </tr>`;
  }).join('');
}

function renderCustReport(){
  const custs=DB.get('customers');
  const orders=DB.get('orders').filter(o=>o.status!=='cancelled');
  const tbody=document.getElementById('custReportTable');
  if(!custs.length){tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">ไม่มีลูกค้า</td></tr>`;return;}
  const rows=custs.map(c=>{
    const custOrders=orders.filter(o=>o.customer?.id===c.id);
    const totalRev=custOrders.reduce((s,o)=>s+o.total,0);
    const avg=custOrders.length>0?Math.round(totalRev/custOrders.length):0;
    const last=custOrders.length>0?custOrders.slice(-1)[0].date:'—';
    return {...c,orderCount:custOrders.length,totalRev,avg,last};
  }).sort((a,b)=>b.totalRev-a.totalRev);
  tbody.innerHTML=rows.map(r=>`<tr>
    <td style="font-weight:600;">${r.name}</td>
    <td><span class="pill pill-blue">${getCustTypeName(r.type)}</span></td>
    <td>${r.orderCount}</td>
    <td style="font-weight:700;">฿${r.totalRev.toLocaleString()}</td>
    <td>฿${r.avg.toLocaleString()}</td>
    <td>${r.last}</td>
  </tr>`).join('');
}

// ── SETTINGS ──────────────────────────────────────────────────
function loadSettings(){
  const si=DB.get('shopInfo',{});
  let gp=DB.get('gpSettings',{instore:0,grab:32.1,lineman:32.1});
  const ps=DB.get('printerSettings',{width:58,name:''});
  // Migrate from old defaults if exactly equal to old defaults
  if(gp.instore===60 && gp.grab===55 && gp.lineman===55) {
    gp={instore:0,grab:32.1,lineman:32.1};
    DB.set('gpSettings', gp);
  }
  document.getElementById('shopName').value=si.name||'Long Do Cafe & Bakery';
  document.getElementById('shopAddress').value=si.address||'';
  document.getElementById('shopPhone').value=si.phone||'';
  document.getElementById('shopFooter').value=si.footer||'ขอบคุณที่ใช้บริการ 😊';
  document.getElementById('gpInstore').value=gp.instore!==undefined?gp.instore:0;
  document.getElementById('gpGrab').value=gp.grab!==undefined?gp.grab:32.1;
  document.getElementById('gpLineman').value=gp.lineman!==undefined?gp.lineman:32.1;
  // Printer
  document.getElementById('printerWidth').value=ps.width||58;
  document.getElementById('printerName').value=ps.name||'';
  // Logo preview
  const logoData=DB.get('shopLogo','');
  if(logoData){
    document.getElementById('logoPreview').src=logoData;
    document.getElementById('logoPreviewWrap').style.display='block';
  }
  // Receipt QR preview
  const rqData=DB.get('receiptQrImage','');
  if(rqData){
    document.getElementById('receiptQrPreview').src=rqData;
    document.getElementById('receiptQrPreviewWrap').style.display='block';
  }
  // POS QR preview
  const pqData=DB.get('posQrImage','');
  if(pqData){
    document.getElementById('posQrPreview').src=pqData;
    document.getElementById('posQrPreviewWrap').style.display='block';
  }
}

function saveGP(){
  const instoreVal=parseFloat(document.getElementById('gpInstore').value);
  const grabVal=parseFloat(document.getElementById('gpGrab').value);
  const linemanVal=parseFloat(document.getElementById('gpLineman').value);
  DB.set('gpSettings',{
    instore:isNaN(instoreVal)?0:instoreVal,
    grab:isNaN(grabVal)?32.1:grabVal,
    lineman:isNaN(linemanVal)?32.1:linemanVal,
  });
  showToast('บันทึกค่า GP แล้ว','success');
}

function saveShopInfo(){
  DB.set('shopInfo',{
    name:document.getElementById('shopName').value,
    address:document.getElementById('shopAddress').value,
    phone:document.getElementById('shopPhone').value,
    footer:document.getElementById('shopFooter').value,
  });
  showToast('บันทึกข้อมูลร้านแล้ว','success');
}

function savePrinterSettings(){
  const w=parseInt(document.getElementById('printerWidth').value)||58;
  const n=document.getElementById('printerName').value.trim();
  DB.set('printerSettings',{width:w,name:n});
  showToast('บันทึกการตั้งค่าเครื่องพิมพ์แล้ว','success');
}

// ── BLE PRINTER ENGINE ────────────────────────────────────────
// Supports JP-58, POS-58, PT-210, RPP02 and most ESC/POS 58mm BLE printers
// Service UUIDs tried in order
const BLE_PRINT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // common thermal
  '0000ff00-0000-1000-8000-00805f9b34fb', // alt thermal
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISP BLE serial
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 BLE
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // RPP02
];
const BLE_PRINT_CHARS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

let _btDevice = null;
let _btChar   = null;

async function btConnect(statusEl, nameHint) {
  if(!navigator.bluetooth) throw new Error('บราวเซอร์ไม่รองรับ Bluetooth (ใช้ Chrome/Edge)');
  if(statusEl) { statusEl.textContent='🔍 กำลังค้นหาเครื่องพิมพ์...'; statusEl.style.color='var(--muted)'; }

  const filters = [];
  if(nameHint) filters.push({name: nameHint});
  ['JP-58','JP58','POS-58','POS58','pos58','RPP','PT-210','Printer'].forEach(p => filters.push({namePrefix:p}));

  const device = await navigator.bluetooth.requestDevice({
    filters,
    optionalServices: BLE_PRINT_SERVICES,
  });

  if(statusEl) { statusEl.textContent='🔗 กำลังเชื่อมต่อ '+device.name+'...'; }

  const server = await device.gatt.connect();
  let char = null;

  for(const svcUUID of BLE_PRINT_SERVICES) {
    try {
      const svc = await server.getPrimaryService(svcUUID);
      for(const charUUID of BLE_PRINT_CHARS) {
        try {
          const c = await svc.getCharacteristic(charUUID);
          const props = c.properties;
          if(props.write || props.writeWithoutResponse) { char = c; break; }
        } catch(_){}
      }
      // Also enumerate all characteristics of this service
      if(!char) {
        try {
          const allChars = await svc.getCharacteristics();
          for(const c of allChars) {
            if(c.properties.write || c.properties.writeWithoutResponse) { char = c; break; }
          }
        } catch(_){}
      }
      if(char) break;
    } catch(_){}
  }

  if(!char) throw new Error('ไม่พบ characteristic สำหรับพิมพ์ — ลองเครื่องพิมพ์รุ่นอื่น');

  _btDevice = device;
  _btChar   = char;

  device.addEventListener('gattserverdisconnected', () => {
    _btDevice = null; _btChar = null;
    const el = document.getElementById('printerStatus');
    if(el) { el.textContent = '🔌 เครื่องพิมพ์ตัดการเชื่อมต่อ'; el.style.color = 'var(--red)'; }
  });

  return device.name;
}

// Write in 20-byte chunks (BLE MTU safe size)
async function btWrite(char, data) {
  const CHUNK = 20;
  for(let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    if(char.properties.writeWithoutResponse) await char.writeValueWithoutResponse(chunk);
    else await char.writeValueWithResponse(chunk);
    await new Promise(r => setTimeout(r, 20)); // pace the stream
  }
}

// Build ESC/POS byte array for 58mm receipt
function buildEscPos(order) {
  const shopInfo = DB.get('shopInfo',{});
  const logoData = DB.get('shopLogo',''); // logo not printable over ESC/POS without image raster — skip

  const enc = new TextEncoder(); // UTF-8; printer must support or use TIS-620
  const bytes = [];

  const cmd = (...b) => bytes.push(...b);
  const text = (s) => { const b = enc.encode(s); bytes.push(...b); };
  const lf = () => cmd(0x0A);
  const ESC = 0x1B; const GS = 0x1D;

  // Init
  cmd(ESC,0x40);                       // ESC @ — initialize
  cmd(ESC,0x74,0x15);                  // ESC t 21 — CP874 Thai codepage (TIS-620)
  cmd(ESC,0x61,0x01);                  // ESC a 1 — center align

  // Shop name — double height+width
  cmd(GS,0x21,0x11);
  text(shopInfo.name||'Long Do Cafe');  lf();
  cmd(GS,0x21,0x00);                   // normal size

  if(shopInfo.address) { text(shopInfo.address); lf(); }
  if(shopInfo.phone)   { text('Tel: '+shopInfo.phone); lf(); }

  cmd(ESC,0x61,0x00);                  // left align
  text('--------------------------------'); lf();
  text('No: '+order.orderNo); lf();
  const typeLabel = order.type==='grab'?'Grab':order.type==='lineman'?'LINE MAN':'หน้าร้าน';
  text('ช่องทาง: '+typeLabel+(order.refNo?' #'+order.refNo:'')); lf();
  if(order.customer) { text('ลูกค้า: '+order.customer.name); lf(); }
  text(order.date+' '+order.time); lf();
  text('--------------------------------'); lf();

  // Items
  order.items.forEach(i => {
    const W = 32; // chars per line on 58mm
    const nameStr = (i.name+' x'+i.qty).substring(0,W-8);
    const priceStr = '฿'+i.total;
    const pad = W - nameStr.length - priceStr.length;
    text(nameStr + ' '.repeat(Math.max(1,pad)) + priceStr); lf();
    const addonStr = (i.addons&&i.addons.length) ? '  +'+i.addons.map(a=>a.name).join(',') : '';
    if(addonStr) { text(addonStr.substring(0,W)); lf(); }
    const hasDisc = (i.itemDiscount||0)>0 && !i.customPrice;
    if(hasDisc) {
      const d = i.itemDiscountType==='pct' ? '-'+i.itemDiscount+'%' : '-฿'+i.itemDiscount;
      text('  ส่วนลด: '+d); lf();
    }
    if(i.note) { text('  note: '+i.note.substring(0,W-8)); lf(); }
  });

  text('--------------------------------'); lf();

  // Totals
  const W = 32;
  const line = (l,r) => {
    const pad = W - l.length - r.length;
    text(l + ' '.repeat(Math.max(1,pad)) + r); lf();
  };
  line('รวม', '฿'+order.subtotal);
  if(order.discount>0) line('ส่วนลด', '-฿'+order.discount);

  // Grand total — bold
  cmd(ESC,0x45,0x01);
  line('ยอดรวม', '฿'+order.total);
  cmd(ESC,0x45,0x00);

  if(order.payMethod==='cash') {
    line('รับเงิน','฿'+order.received);
    line('เงินทอน','฿'+order.change);
  }

  text('--------------------------------'); lf();
  cmd(ESC,0x61,0x01); // center
  text(shopInfo.footer||'ขอบคุณที่ใช้บริการ :)'); lf(); lf(); lf();

  // Cut paper
  cmd(GS,0x56,0x01);  // GS V 1 — partial cut

  return new Uint8Array(bytes);
}

async function testPrinterConnect(){
  const btn    = document.getElementById('btnConnectPrinter');
  const status = document.getElementById('printerStatus');
  btn.disabled = true;
  try {
    const nameHint = document.getElementById('printerName').value.trim();
    const name = await btConnect(status, nameHint);
    status.textContent = '✅ เชื่อมต่อแล้ว: '+name;
    status.style.color = 'var(--sage)';
    document.getElementById('printerName').value = name;
    DB.set('printerSettings',{
      width: parseInt(document.getElementById('printerWidth').value)||58,
      name
    });
    showToast('เชื่อมต่อ '+name+' สำเร็จ ✅','success');
  } catch(e) {
    status.textContent = '❌ '+e.message;
    status.style.color = 'var(--red)';
  }
  btn.disabled = false;
}

async function btPrint(order) {
  // If not connected yet, try to connect first using saved name
  if(!_btChar) {
    const ps = DB.get('printerSettings',{});
    const status = document.getElementById('printerStatus');
    try { await btConnect(status, ps.name||''); }
    catch(e) { return false; }
  }
  if(!_btChar) return false;
  try {
    const data = buildEscPos(order);
    await btWrite(_btChar, data);
    return true;
  } catch(e) {
    _btDevice = null; _btChar = null;
    return false;
  }
}

// Resize + compress an uploaded image file to a JPEG data URL, to keep localStorage lean.
function compressImage(file, maxDim, quality, callback){
  const reader=new FileReader();
  reader.onload=function(e){
    const img=new Image();
    img.onload=function(){
      let w=img.width, h=img.height;
      if(w>maxDim||h>maxDim){
        if(w>h){h=Math.round(h*maxDim/w);w=maxDim;}
        else{w=Math.round(w*maxDim/h);h=maxDim;}
      }
      const canvas=document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#fff';
      ctx.fillRect(0,0,w,h);
      ctx.drawImage(img,0,0,w,h);
      callback(canvas.toDataURL('image/jpeg',quality));
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleLogoUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    const data=e.target.result;
    DB.set('shopLogo',data);
    document.getElementById('logoPreview').src=data;
    document.getElementById('logoPreviewWrap').style.display='block';
    showToast('อัปโหลดโลโก้แล้ว','success');
  };
  reader.readAsDataURL(file);
}
function removeLogo(){
  DB.set('shopLogo','');
  document.getElementById('logoPreviewWrap').style.display='none';
  document.getElementById('logoUpload').value='';
  showToast('ลบโลโก้แล้ว','success');
}

function handleReceiptQrUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    const data=e.target.result;
    DB.set('receiptQrImage',data);
    document.getElementById('receiptQrPreview').src=data;
    document.getElementById('receiptQrPreviewWrap').style.display='block';
    showToast('อัปโหลด QR ใบเสร็จแล้ว','success');
  };
  reader.readAsDataURL(file);
}
function removeReceiptQr(){
  DB.set('receiptQrImage','');
  document.getElementById('receiptQrPreviewWrap').style.display='none';
  document.getElementById('receiptQrUpload').value='';
  showToast('ลบ QR ใบเสร็จแล้ว','success');
}

function handlePosQrUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    const data=e.target.result;
    DB.set('posQrImage',data);
    document.getElementById('posQrPreview').src=data;
    document.getElementById('posQrPreviewWrap').style.display='block';
    showToast('อัปโหลด QR หน้าขายแล้ว','success');
  };
  reader.readAsDataURL(file);
}
function removePosQr(){
  DB.set('posQrImage','');
  document.getElementById('posQrPreviewWrap').style.display='none';
  document.getElementById('posQrUpload').value='';
  showToast('ลบ QR หน้าขายแล้ว','success');
}

// ── DATA BACKUP (EXPORT / IMPORT) ─────────────────────────────
function exportData(){
  try{
    const data = {};
    for(let i=0;i<localStorage.length;i++){
      const key = localStorage.key(i);
      if(key && key.startsWith('ld_')){
        data[key] = localStorage.getItem(key);
      }
    }
    if(!Object.keys(data).length){
      showToast('ไม่พบข้อมูลให้สำรอง','error');
      return;
    }
    const payload = {
      app: 'Long Do POS',
      version: 1,
      exportedAt: new Date().toISOString(),
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `longdo-pos-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 3000);
    showToast('ส่งออกข้อมูลสำเร็จ ✅','success');
  }catch(e){
    console.error('exportData error:', e);
    showToast('ส่งออกข้อมูลไม่สำเร็จ','error');
  }
}

function triggerImportFile(){
  document.getElementById('importFileInput')?.click();
}

function importData(event){
  const file = event.target.files[0];
  if(!file) return;
  if(!confirm('การนำเข้าข้อมูลจะเขียนทับข้อมูลปัจจุบันทั้งหมดในเครื่องนี้ (เมนู, ออเดอร์, ลูกค้า, ฯลฯ)\nต้องการดำเนินการต่อหรือไม่?')){
    event.target.value='';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const parsed = JSON.parse(e.target.result);
      // รองรับทั้งไฟล์ที่ห่อด้วย {data:{...}} และไฟล์ที่เป็น object ล้วน
      const data = (parsed && typeof parsed==='object' && parsed.data && typeof parsed.data==='object') ? parsed.data : parsed;
      if(!data || typeof data !== 'object') throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
      const keys = Object.keys(data).filter(k=>k.startsWith('ld_'));
      if(!keys.length) throw new Error('ไม่พบข้อมูล Long Do POS ในไฟล์นี้');

      // ลบข้อมูลเดิมทั้งหมดก่อน (ป้องกันข้อมูลเก่าตกค้าง)
      for(let i=localStorage.length-1;i>=0;i--){
        const k = localStorage.key(i);
        if(k && k.startsWith('ld_')) localStorage.removeItem(k);
      }
      keys.forEach(k=>{ localStorage.setItem(k, data[k]); });

      showToast('นำเข้าข้อมูลสำเร็จ ✅ กำลังโหลดใหม่...','success');
      setTimeout(()=>location.reload(), 1200);
    }catch(err){
      console.error('importData error:', err);
      showToast('นำเข้าข้อมูลไม่สำเร็จ: '+err.message, 'error');
    }finally{
      event.target.value='';
    }
  };
  reader.onerror = function(){
    showToast('อ่านไฟล์ไม่สำเร็จ','error');
    event.target.value='';
  };
  reader.readAsText(file);
}

// ── SERVICE WORKER REGISTER ───────────────────────────────────
if('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
