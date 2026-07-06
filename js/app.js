/* =============================================
   MINIPRINTS SHOP — APP PRINCIPAL
   ============================================= */

// ---- Estado global ----
let DATA = { tienda: {}, categorias: [], productos: [] };
let filtroCategoria = 'todas';
let busqueda = '';
let orden = 'destacado';

// ---- Carga de datos (JSON base + Firestore override) ----
async function loadData() {
  // Siempre carga el JSON base (categorías + datos default)
  const res = await fetch('data/products.json');
  DATA = await res.json();

  // Intenta sobrescribir productos y config con datos en vivo de Firestore
  try {
    if (typeof ShopDB !== 'undefined') {
      const ok = await ShopDB.init();
      if (ok) {
        const [fbProductos, fbConfig] = await Promise.all([
          ShopDB.getProductos(),
          ShopDB.getConfig()
        ]);
        if (fbProductos && fbProductos.length > 0) DATA.productos = fbProductos;
        if (fbConfig) DATA.tienda = { ...DATA.tienda, ...fbConfig };
      }
    }
  } catch (e) {
    console.warn('[app] Usando datos JSON (Firestore no disponible):', e.message);
  }
  return DATA;
}

// ---- Formateo ----
function fmt(n) {
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0 });
}

// ---- Badge del carrito ----
function updateCartBadge() {
  const n = Cart.count();
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = n;
    el.classList.toggle('hidden', n === 0);
  });
}

// ---- Toasts ----
function showToast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span>${msg}`;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('leaving');
    t.addEventListener('animationend', () => t.remove());
  }, 2800);
}

// ---- Nombre de categoría ----
function catNombre(id) {
  const c = DATA.categorias.find(c => c.id === id);
  return c ? c.nombre : id;
}

// ---- Render tarjeta de producto ----
function renderProductCard(p) {
  const sale = p.precio_original && p.precio_original > p.precio;
  const badges = [
    p.nuevo ? '<span class="badge badge-new">Nuevo</span>' : '',
    sale    ? '<span class="badge badge-sale">Oferta</span>' : '',
    p.destacado && !p.nuevo ? '<span class="badge badge-featured">⭐ Destacado</span>' : '',
  ].filter(Boolean).join('');

  const priceBlock = sale
    ? `<div class="product-price">
         <span class="price-current">${fmt(p.precio)}</span>
         <span class="price-original">${fmt(p.precio_original)}</span>
       </div>`
    : `<div class="product-price"><span class="price-current">${fmt(p.precio)}</span></div>`;

  return `
    <div class="product-card" data-id="${p.id}">
      <a href="producto.html?id=${p.id}" class="product-img">
        <img src="${p.imagen}" alt="${p.nombre}" loading="lazy"
             onerror="this.src='img/placeholder.svg'">
        <div class="product-badges">${badges}</div>
        <button class="product-quick-add" title="Agregar al carrito"
                onclick="event.preventDefault(); quickAdd('${p.id}')">+</button>
      </a>
      <div class="product-body">
        <div class="product-category">${catNombre(p.categoria)}</div>
        <a href="producto.html?id=${p.id}" class="product-name">${p.nombre}</a>
        <p class="product-desc">${p.descripcion_corta}</p>
        <div class="product-footer">
          ${priceBlock}
          <button class="btn-add-cart" onclick="quickAdd('${p.id}')">+ Carrito</button>
        </div>
      </div>
    </div>`;
}

// ---- Quick add desde tarjeta ----
function quickAdd(id) {
  const p = DATA.productos.find(x => x.id === id);
  if (!p) return;
  Cart.add(p, 1);
  showToast(`${p.nombre} agregado al carrito`);
  updateCartBadge();
}

// ---- Render grid de productos ----
function renderGrid(container, productos) {
  if (!productos.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="icon">🔍</div>
        <h3>No se encontraron productos</h3>
        <p>Prueba con otro filtro o búsqueda</p>
      </div>`;
    return;
  }
  container.innerHTML = productos.map(renderProductCard).join('');
}

// ---- Filtrar + ordenar ----
function getFiltered() {
  let lista = [...DATA.productos];

  if (filtroCategoria && filtroCategoria !== 'todas') {
    lista = lista.filter(p => p.categoria === filtroCategoria);
  }
  if (busqueda.trim()) {
    const q = busqueda.toLowerCase();
    lista = lista.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.descripcion_corta.toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.includes(q))
    );
  }
  switch (orden) {
    case 'precio_asc':  lista.sort((a, b) => a.precio - b.precio); break;
    case 'precio_desc': lista.sort((a, b) => b.precio - a.precio); break;
    case 'nuevo':       lista.sort((a, b) => b.nuevo - a.nuevo);    break;
    default:            lista.sort((a, b) => b.destacado - a.destacado);
  }
  return lista;
}

// ============================================================
// PÁGINA: INDEX
// ============================================================
async function initIndex() {
  await loadData();
  updateCartBadge();

  // Grid de destacados
  const grid = document.getElementById('featured-grid');
  if (grid) {
    const destacados = DATA.productos.filter(p => p.destacado).slice(0, 4);
    renderGrid(grid, destacados);
  }

  // Grid de categorías
  const catGrid = document.getElementById('cat-grid');
  if (catGrid) {
    const conteo = {};
    DATA.productos.forEach(p => { conteo[p.categoria] = (conteo[p.categoria] || 0) + 1; });
    catGrid.innerHTML = DATA.categorias.map(c => `
      <a href="tienda.html?cat=${c.id}" class="category-card">
        <div class="cat-icon">${c.icono}</div>
        <div class="cat-name">${c.nombre}</div>
        <div class="cat-count">${conteo[c.id] || 0} producto${(conteo[c.id] || 0) !== 1 ? 's' : ''}</div>
      </a>`).join('');
  }
}

// ============================================================
// PÁGINA: TIENDA
// ============================================================
async function initTienda() {
  await loadData();
  updateCartBadge();

  const grid = document.getElementById('products-grid');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const resultsCount = document.getElementById('results-count');
  const filterList = document.getElementById('filter-list');

  // Leer parámetro ?cat=
  const params = new URLSearchParams(location.search);
  const catParam = params.get('cat');
  if (catParam) filtroCategoria = catParam;

  // Render filtros
  const conteo = {};
  DATA.productos.forEach(p => { conteo[p.categoria] = (conteo[p.categoria] || 0) + 1; });

  if (filterList) {
    const total = DATA.productos.length;
    filterList.innerHTML = `
      <div class="filter-item ${filtroCategoria === 'todas' ? 'active' : ''}" data-cat="todas">
        Todos los productos <span class="filter-count">${total}</span>
      </div>` +
      DATA.categorias.map(c => `
        <div class="filter-item ${filtroCategoria === c.id ? 'active' : ''}" data-cat="${c.id}">
          ${c.icono} ${c.nombre} <span class="filter-count">${conteo[c.id] || 0}</span>
        </div>`).join('');

    filterList.addEventListener('click', e => {
      const item = e.target.closest('.filter-item');
      if (!item) return;
      filtroCategoria = item.dataset.cat;
      filterList.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      refresh();
    });
  }

  function refresh() {
    const lista = getFiltered();
    renderGrid(grid, lista);
    if (resultsCount) resultsCount.textContent = `${lista.length} resultado${lista.length !== 1 ? 's' : ''}`;
  }

  if (searchInput) {
    searchInput.addEventListener('input', e => { busqueda = e.target.value; refresh(); });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', e => { orden = e.target.value; refresh(); });
  }

  refresh();
}

// ============================================================
// PÁGINA: PRODUCTO
// ============================================================
async function initProducto() {
  await loadData();
  updateCartBadge();

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const p = DATA.productos.find(x => x.id === id);

  const container = document.getElementById('product-detail');
  if (!p || !container) {
    if (container) container.innerHTML = `<div class="empty-state"><div class="icon">😕</div><h3>Producto no encontrado</h3></div>`;
    return;
  }

  document.title = `${p.nombre} — MiniPrints Shop`;

  let selectedColor = p.colores_disponibles?.[0] || '';
  let selectedQty = 1;
  let notas = '';

  const sale = p.precio_original && p.precio_original > p.precio;

  container.innerHTML = `
    <div class="product-detail">
      <div class="product-gallery">
        <div class="main-image"><img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='img/placeholder.svg'"></div>
      </div>
      <div class="product-info">
        <div class="product-cat-tag">${catNombre(p.categoria)}</div>
        <h1>${p.nombre}</h1>
        <div class="price-block">
          <span class="price-main">${fmt(p.precio)}</span>
          ${sale ? `<span class="price-was">${fmt(p.precio_original)}</span>` : ''}
        </div>
        <p class="desc">${p.descripcion}</p>

        <div class="product-specs">
          <div class="spec-item"><div class="spec-label">Material</div><div class="spec-value">${p.material}</div></div>
          <div class="spec-item"><div class="spec-label">Medidas</div><div class="spec-value">${p.dimensiones}</div></div>
          <div class="spec-item"><div class="spec-label">Entrega</div><div class="spec-value">${p.tiempo_entrega}</div></div>
          <div class="spec-item"><div class="spec-label">Disponibles</div><div class="spec-value">${p.stock >= 99 ? '∞' : p.stock} uds.</div></div>
        </div>

        ${p.colores_disponibles?.length ? `
          <div class="color-picker">
            <label>Color: <strong id="color-label">${selectedColor}</strong></label>
            <div class="color-options" id="color-options">
              ${p.colores_disponibles.map((c, i) => `
                <button class="color-option ${i === 0 ? 'selected' : ''}" data-color="${c}">${c}</button>`).join('')}
            </div>
          </div>` : ''}

        <div class="qty-add">
          <div class="qty-control">
            <button class="qty-btn" id="qty-minus">−</button>
            <span class="qty-num" id="qty-num">1</span>
            <button class="qty-btn" id="qty-plus">+</button>
          </div>
          <button class="btn btn-primary" id="btn-add-cart" style="flex:1">🛒 Agregar al carrito</button>
        </div>

        ${p.categoria === 'personalizado' ? `
          <div class="notes-field">
            <label>¿Qué necesitas? (texto, descripción, detalles)</label>
            <textarea id="notas-input" placeholder="Escribe aquí el texto para tu llavero, descripción de tu figura, etc."></textarea>
          </div>` : ''}

        <div class="stock-note ${p.stock <= 3 && p.stock < 99 ? 'low' : ''}">
          ${p.stock >= 99 ? '✓ Disponible sin límite de stock' : p.stock > 3 ? `✓ ${p.stock} unidades disponibles` : `⚠ Solo quedan ${p.stock} unidades`}
        </div>
        <div class="delivery-note">🚚 Envío gratis en pedidos mayores a $800 MXN</div>
      </div>
    </div>`;

  // Color picker
  const colorOpts = container.querySelectorAll('.color-option');
  colorOpts.forEach(btn => {
    btn.addEventListener('click', () => {
      colorOpts.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
      const lbl = container.querySelector('#color-label');
      if (lbl) lbl.textContent = selectedColor;
    });
  });

  // Cantidad
  container.querySelector('#qty-minus')?.addEventListener('click', () => {
    if (selectedQty > 1) { selectedQty--; container.querySelector('#qty-num').textContent = selectedQty; }
  });
  container.querySelector('#qty-plus')?.addEventListener('click', () => {
    if (selectedQty < (p.stock || 99)) { selectedQty++; container.querySelector('#qty-num').textContent = selectedQty; }
  });

  // Notas
  container.querySelector('#notas-input')?.addEventListener('input', e => { notas = e.target.value; });

  // Agregar
  container.querySelector('#btn-add-cart')?.addEventListener('click', () => {
    Cart.add(p, selectedQty, { color: selectedColor, notas });
    showToast(`${p.nombre} agregado al carrito ✓`);
    updateCartBadge();
  });
}

// ============================================================
// PÁGINA: CARRITO
// ============================================================
async function initCarrito() {
  await loadData();
  updateCartBadge();
  renderCart();

  window.addEventListener('cart:updated', renderCart);
}

function renderCart() {
  const items = Cart.getItems();
  const itemsEl = document.getElementById('cart-items');
  const countEl = document.getElementById('cart-count');

  if (countEl) countEl.textContent = Cart.count();

  if (itemsEl) {
    if (!items.length) {
      itemsEl.innerHTML = `
        <div class="cart-empty">
          <div class="empty-icon">🛒</div>
          <h3>Tu carrito está vacío</h3>
          <p>Agrega productos desde la tienda para continuar.</p>
          <a href="tienda.html" class="btn btn-primary">Ir a la tienda</a>
        </div>`;
    } else {
      itemsEl.innerHTML = items.map(item => `
        <div class="cart-item" data-key="${item.key}">
          <div class="cart-item-img">
            <img src="${item.imagen}" alt="${item.nombre}" onerror="this.src='img/placeholder.svg'">
          </div>
          <div class="cart-item-info">
            <div class="cart-item-name">${item.nombre}</div>
            <div class="cart-item-sub">${item.color ? `Color: ${item.color}` : ''} ${item.notas ? '· ' + item.notas : ''}</div>
            <div class="cart-item-controls">
              <div class="qty-control" style="border-color:var(--gray-200)">
                <button class="qty-btn" onclick="changeQty('${item.key}', ${item.qty - 1})">−</button>
                <span class="qty-num">${item.qty}</span>
                <button class="qty-btn" onclick="changeQty('${item.key}', ${item.qty + 1})">+</button>
              </div>
              <button class="btn-remove" onclick="Cart.remove('${item.key}')">Eliminar</button>
            </div>
          </div>
          <div class="cart-item-price">${fmt(item.precio * item.qty)}</div>
        </div>`).join('');
    }
  }

  // Resumen
  const freeFrom = DATA.tienda?.envio_gratis_desde || 800;
  const sub = Cart.subtotal();
  const ship = Cart.shipping(freeFrom);
  const tot = Cart.total(freeFrom);

  const el = id => document.getElementById(id);
  if (el('summary-subtotal')) el('summary-subtotal').textContent = fmt(sub);
  if (el('summary-shipping')) el('summary-shipping').textContent = ship === 0 ? 'GRATIS' : fmt(ship);
  if (el('summary-total')) el('summary-total').textContent = fmt(tot);

  const banner = document.getElementById('free-shipping-banner');
  if (banner) {
    if (sub === 0) { banner.style.display = 'none'; }
    else if (ship === 0) {
      banner.style.display = 'block';
      banner.textContent = '🎉 ¡Tienes envío gratis!';
    } else {
      const falta = freeFrom - sub;
      banner.style.display = 'block';
      banner.textContent = `Agrega ${fmt(falta)} más para envío gratis`;
    }
  }

  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) checkoutBtn.disabled = !items.length;
}

function changeQty(key, qty) {
  Cart.updateQty(key, qty);
  updateCartBadge();
}

// ============================================================
// PÁGINA: CHECKOUT
// ============================================================
async function initCheckout() {
  await loadData();
  updateCartBadge();

  const items = Cart.getItems();
  if (!items.length) {
    location.href = 'carrito.html';
    return;
  }

  // Resumen lateral
  const summaryItems = document.getElementById('checkout-summary-items');
  if (summaryItems) {
    summaryItems.innerHTML = items.map(i => `
      <div class="summary-line">
        <span>${i.nombre} ${i.qty > 1 ? `×${i.qty}` : ''}${i.color ? ` (${i.color})` : ''}</span>
        <span>${fmt(i.precio * i.qty)}</span>
      </div>`).join('');
  }

  const freeFrom = DATA.tienda?.envio_gratis_desde || 800;
  const el = id => document.getElementById(id);
  if (el('co-subtotal'))  el('co-subtotal').textContent  = fmt(Cart.subtotal());
  if (el('co-shipping'))  el('co-shipping').textContent  = Cart.shipping(freeFrom) === 0 ? 'GRATIS' : fmt(Cart.shipping(freeFrom));
  if (el('co-total'))     el('co-total').textContent     = fmt(Cart.total(freeFrom));

  // WhatsApp checkout
  const waBtn = document.getElementById('whatsapp-order-btn');
  if (waBtn) {
    waBtn.addEventListener('click', () => {
      if (!validateForm()) return;
      const msg = buildWhatsAppMessage();
      const phone = DATA.tienda?.telefono_whatsapp || '52XXXXXXXXXX';
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    });
  }
}

function validateForm() {
  const required = ['nombre', 'telefono', 'email', 'ciudad', 'colonia', 'calle'];
  let ok = true;
  required.forEach(id => {
    const el = document.getElementById(`field-${id}`);
    if (!el) return;
    if (!el.value.trim()) {
      el.style.borderColor = 'var(--danger)';
      ok = false;
    } else {
      el.style.borderColor = '';
    }
  });
  if (!ok) showToast('Por favor completa todos los campos requeridos', 'error');
  return ok;
}

function buildWhatsAppMessage() {
  const g = id => document.getElementById(`field-${id}`)?.value?.trim() || '';
  const items = Cart.getItems();
  const freeFrom = DATA.tienda?.envio_gratis_desde || 800;

  let msg = `🛒 *Nuevo pedido — MiniPrints Shop*\n\n`;
  msg += `👤 *Cliente:* ${g('nombre')}\n`;
  msg += `📞 *Teléfono:* ${g('telefono')}\n`;
  msg += `📧 *Email:* ${g('email')}\n\n`;
  msg += `📍 *Dirección de entrega:*\n`;
  msg += `${g('calle')}, Col. ${g('colonia')}, ${g('ciudad')}, CP ${g('cp')}\n\n`;
  msg += `📦 *Productos:*\n`;
  items.forEach(i => {
    msg += `• ${i.nombre}`;
    if (i.color) msg += ` (${i.color})`;
    msg += ` ×${i.qty} — ${fmt(i.precio * i.qty)}\n`;
    if (i.notas) msg += `  ✏️ ${i.notas}\n`;
  });
  msg += `\n💰 *Subtotal:* ${fmt(Cart.subtotal())}\n`;
  msg += `🚚 *Envío:* ${Cart.shipping(freeFrom) === 0 ? 'GRATIS' : fmt(Cart.shipping(freeFrom))}\n`;
  msg += `✅ *TOTAL: ${fmt(Cart.total(freeFrom))}*\n\n`;
  const nota = document.getElementById('field-notas')?.value?.trim();
  if (nota) msg += `📝 *Notas:* ${nota}\n\n`;
  msg += `_(Pedido generado desde miniprints.shop)_`;
  return msg;
}

// ============================================================
// NAV ACTIVO + MOBILE MENU
// ============================================================
function initNav() {
  // Marcar link activo
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // Mobile menu
  const toggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const closeBtn = document.getElementById('mobile-menu-close');

  if (toggle && mobileMenu) {
    toggle.addEventListener('click', () => mobileMenu.classList.add('open'));
    closeBtn?.addEventListener('click', () => mobileMenu.classList.remove('open'));
    mobileMenu.addEventListener('click', e => {
      if (e.target === mobileMenu) mobileMenu.classList.remove('open');
    });
  }
}

// ---- Init genérico ----
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  window.addEventListener('cart:updated', updateCartBadge);
  updateCartBadge();
});
