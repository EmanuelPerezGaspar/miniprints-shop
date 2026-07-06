/* =============================================
   MINIPRINTS SHOP — PANEL ADMIN
   ============================================= */

let ADMIN_DATA = { tienda: {}, categorias: [], productos: [] };
let editingId  = null;
let activeTab  = 'productos';

// ---- Upload de imagen a Firebase Storage ----
async function handleFileSelect(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToastAdmin('La imagen supera 5 MB', 'error');
    return;
  }

  const btn      = document.getElementById('upload-btn');
  const progress = document.getElementById('upload-progress');
  const bar      = document.getElementById('upload-progress-bar');
  const status   = document.getElementById('upload-status');
  const imgInput = document.getElementById('f-imagen');

  // Preview local inmediato
  const localUrl = URL.createObjectURL(file);
  updateImgPreview(localUrl);

  btn.disabled = true;
  btn.textContent = 'Subiendo…';
  progress.style.display = 'block';
  status.textContent = 'Subiendo imagen…';
  status.style.color = 'var(--primary)';

  try {
    const url = await ShopDB.uploadImage(file, pct => {
      bar.style.width = pct + '%';
      status.textContent = `Subiendo… ${pct}%`;
    });
    imgInput.value = url;
    updateImgPreview(url);
    URL.revokeObjectURL(localUrl);
    status.textContent = '✓ Foto subida correctamente';
    status.style.color = 'var(--success)';
    showToastAdmin('Foto subida ✓');
  } catch (e) {
    updateImgPreview('img/placeholder.svg');
    imgInput.value = '';
    status.textContent = '✕ Error: ' + e.message;
    status.style.color = 'var(--danger)';
    showToastAdmin('Error al subir: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📷 Subir foto desde mi dispositivo';
    progress.style.display = 'none';
    bar.style.width = '0%';
    document.getElementById('file-input').value = '';
  }
}

// ---- PIN ----
function checkPin() { return localStorage.getItem('shop_admin_ok') === '1'; }
function logoutAdmin() {
  localStorage.removeItem('shop_admin_ok');
  showScreen('pin');
}

function showScreen(name) {
  document.querySelectorAll('.admin-screen').forEach(el => el.classList.remove('active'));
  document.getElementById('screen-' + name)?.classList.add('active');
}

async function handlePin() {
  const input = document.getElementById('pin-input');
  const error = document.getElementById('pin-error');
  if (!input) return;
  if (input.value === SHOP_PIN) {
    localStorage.setItem('shop_admin_ok', '1');
    error.style.display = 'none';
    showScreen('loading');
    await loadAdminData();
    showScreen('app');
    renderTab(activeTab);
  } else {
    input.value = '';
    input.focus();
    error.style.display = 'block';
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 500);
  }
}

// ---- Carga de datos ----
async function loadAdminData() {
  const loadingMsg = document.getElementById('loading-msg');
  const setMsg = m => { if (loadingMsg) loadingMsg.textContent = m; };

  setMsg('Conectando con Firebase…');
  const res  = await fetch('data/products.json');
  const json = await res.json();
  ADMIN_DATA  = { ...json };

  const ok = await ShopDB.init();
  if (!ok) {
    showToastAdmin('Firebase no disponible — usando datos de ejemplo', 'warn');
    return;
  }

  setMsg('Cargando productos…');
  const [fbProductos, fbConfig] = await Promise.all([
    ShopDB.getProductos(),
    ShopDB.getConfig()
  ]);

  if (fbProductos && fbProductos.length > 0) {
    ADMIN_DATA.productos = fbProductos;
  } else {
    // Primera vez: preguntar si importar
    setMsg('Preparando datos iniciales…');
    await ShopDB.importFromJSON(json.productos, json.tienda);
    ADMIN_DATA.productos = json.productos;
  }

  if (fbConfig) ADMIN_DATA.tienda = { ...ADMIN_DATA.tienda, ...fbConfig };
}

// ---- Tabs ----
function renderTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.admin-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  const target = document.getElementById('tab-' + tab);
  if (target) target.style.display = 'block';

  if (tab === 'productos')   renderProductos();
  if (tab === 'config')      renderConfig();
}

// ---- Render lista de productos ----
function renderProductos() {
  const container = document.getElementById('admin-product-list');
  if (!container) return;

  if (!ADMIN_DATA.productos.length) {
    container.innerHTML = `<div class="admin-empty">Sin productos. Agrega el primero.</div>`;
    return;
  }

  const catNombre = id => {
    const c = ADMIN_DATA.categorias.find(c => c.id === id);
    return c ? `${c.icono} ${c.nombre}` : id;
  };

  container.innerHTML = ADMIN_DATA.productos.map(p => `
    <div class="admin-product-row ${p.disponible === false ? 'unavailable' : ''}">
      <div class="apr-img">
        <img src="${p.imagen || 'img/placeholder.svg'}" alt="${p.nombre}"
             onerror="this.src='img/placeholder.svg'">
      </div>
      <div class="apr-info">
        <div class="apr-name">${p.nombre}</div>
        <div class="apr-meta">
          <span class="apr-cat">${catNombre(p.categoria)}</span>
          <span class="apr-price">$${Number(p.precio).toLocaleString('es-MX')}</span>
          ${p.destacado ? '<span class="apr-badge star">⭐</span>' : ''}
          ${p.nuevo     ? '<span class="apr-badge new-b">Nuevo</span>' : ''}
        </div>
      </div>
      <div class="apr-actions">
        <button class="apr-toggle ${p.disponible === false ? 'off' : 'on'}"
                onclick="toggleDisponible('${p.id}')"
                title="${p.disponible === false ? 'Sin stock' : 'En venta'}">
          ${p.disponible === false ? '🔴' : '🟢'}
        </button>
        <button class="apr-btn edit" onclick="openModal('${p.id}')">✏️</button>
        <button class="apr-btn del"  onclick="confirmDelete('${p.id}', '${p.nombre.replace(/'/g,"\\'")}')">🗑</button>
      </div>
    </div>`).join('');
}

// ---- Render config ----
function renderConfig() {
  const c = ADMIN_DATA.tienda || {};
  const f = id => document.getElementById(id);
  if (f('cfg-whatsapp'))   f('cfg-whatsapp').value   = c.telefono_whatsapp   || '';
  if (f('cfg-envio'))      f('cfg-envio').value       = c.envio_gratis_desde  || 800;
  if (f('cfg-moneda'))     f('cfg-moneda').value      = c.moneda              || 'MXN';
  if (f('cfg-tienda'))     f('cfg-tienda').value      = c.nombre              || 'MiniPrints Shop';
}

async function saveConfig() {
  const f = id => document.getElementById(id)?.value?.trim();
  const config = {
    nombre:              f('cfg-tienda')    || 'MiniPrints Shop',
    telefono_whatsapp:   f('cfg-whatsapp')  || '',
    envio_gratis_desde:  Number(f('cfg-envio')) || 800,
    moneda:              f('cfg-moneda')    || 'MXN',
  };
  try {
    await ShopDB.saveConfig(config);
    ADMIN_DATA.tienda = { ...ADMIN_DATA.tienda, ...config };
    showToastAdmin('Configuración guardada ✓');
  } catch (e) {
    showToastAdmin('Error al guardar: ' + e.message, 'error');
  }
}

// ---- Toggle disponible ----
async function toggleDisponible(id) {
  const p = ADMIN_DATA.productos.find(x => x.id === id);
  if (!p) return;
  p.disponible = p.disponible === false ? true : false;
  try {
    await ShopDB.saveProducto(p);
    renderProductos();
    showToastAdmin(`${p.nombre}: ${p.disponible ? 'activo ✓' : 'oculto'}`);
  } catch (e) {
    showToastAdmin('Error: ' + e.message, 'error');
  }
}

// ---- Modal add/edit ----
function openModal(id = null) {
  editingId = id;
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('modal-title');
  if (!modal) return;

  if (id) {
    const p = ADMIN_DATA.productos.find(x => x.id === id);
    if (!p) return;
    title.textContent = 'Editar producto';
    fillForm(p);
  } else {
    title.textContent = 'Agregar producto';
    clearForm();
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('product-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  editingId = null;
}

function fillForm(p) {
  const fv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  const fc = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

  fv('f-nombre',        p.nombre);
  fv('f-categoria',     p.categoria);
  fv('f-precio',        p.precio);
  fv('f-precio-orig',   p.precio_original || '');
  fv('f-desc-corta',    p.descripcion_corta);
  fv('f-descripcion',   p.descripcion || '');
  fv('f-imagen',        p.imagen || '');
  fv('f-material',      p.material || '');
  fv('f-colores',       (p.colores_disponibles || []).join(', '));
  fv('f-dimensiones',   p.dimensiones || '');
  fv('f-entrega',       p.tiempo_entrega || '');
  fv('f-stock',         p.stock ?? 10);
  fc('f-disponible',    p.disponible !== false);
  fc('f-destacado',     p.destacado);
  fc('f-nuevo',         p.nuevo);

  // Preview imagen
  updateImgPreview(p.imagen);
}

function clearForm() {
  document.querySelectorAll('#product-form input, #product-form textarea, #product-form select').forEach(el => {
    if (el.type === 'checkbox') el.checked = el.id === 'f-disponible';
    else el.value = '';
  });
  const stockEl = document.getElementById('f-stock');
  if (stockEl) stockEl.value = 10;
  updateImgPreview('');
}

function updateImgPreview(url) {
  const prev = document.getElementById('img-preview');
  if (!prev) return;
  prev.src = url || 'img/placeholder.svg';
  prev.onerror = () => { prev.src = 'img/placeholder.svg'; };
}

async function saveProducto() {
  const fv = id => document.getElementById(id)?.value?.trim() ?? '';
  const fc = id => document.getElementById(id)?.checked ?? false;

  const nombre = fv('f-nombre');
  const precio = Number(fv('f-precio'));
  if (!nombre || !precio) {
    showToastAdmin('Nombre y precio son obligatorios', 'error');
    return;
  }

  const coloresRaw = fv('f-colores');
  const colores = coloresRaw ? coloresRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const id = editingId || ('p' + Date.now());
  const orden = editingId
    ? (ADMIN_DATA.productos.find(x => x.id === editingId)?.orden ?? ADMIN_DATA.productos.length)
    : ADMIN_DATA.productos.length;

  const producto = {
    id,
    nombre,
    categoria:            fv('f-categoria') || 'funcional',
    precio,
    precio_original:      Number(fv('f-precio-orig')) || null,
    descripcion_corta:    fv('f-desc-corta') || nombre,
    descripcion:          fv('f-descripcion') || fv('f-desc-corta') || nombre,
    imagen:               fv('f-imagen') || 'img/placeholder.svg',
    imagenes:             [fv('f-imagen') || 'img/placeholder.svg'],
    material:             fv('f-material') || 'PLA',
    colores_disponibles:  colores,
    dimensiones:          fv('f-dimensiones') || 'Variable',
    tiempo_entrega:       fv('f-entrega') || '3-5 días',
    stock:                Number(fv('f-stock')) || 10,
    disponible:           fc('f-disponible'),
    destacado:            fc('f-destacado'),
    nuevo:                fc('f-nuevo'),
    tags:                 [],
    orden,
  };

  const btn = document.getElementById('save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    await ShopDB.saveProducto(producto);
    if (editingId) {
      const idx = ADMIN_DATA.productos.findIndex(x => x.id === editingId);
      if (idx >= 0) ADMIN_DATA.productos[idx] = producto;
      else ADMIN_DATA.productos.push(producto);
    } else {
      ADMIN_DATA.productos.push(producto);
    }
    closeModal();
    renderProductos();
    showToastAdmin(editingId ? 'Producto actualizado ✓' : 'Producto agregado ✓');
  } catch (e) {
    showToastAdmin('Error al guardar: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar producto'; }
  }
}

// ---- Eliminar ----
function confirmDelete(id, nombre) {
  const confirmed = confirm(`¿Eliminar "${nombre}"?\n\nEsta acción no se puede deshacer.`);
  if (!confirmed) return;
  deleteProducto(id);
}

async function deleteProducto(id) {
  try {
    await ShopDB.deleteProducto(id);
    ADMIN_DATA.productos = ADMIN_DATA.productos.filter(p => p.id !== id);
    renderProductos();
    showToastAdmin('Producto eliminado');
  } catch (e) {
    showToastAdmin('Error al eliminar: ' + e.message, 'error');
  }
}

// ---- Toast ----
function showToastAdmin(msg, type = 'success') {
  let c = document.getElementById('admin-toast');
  if (!c) {
    c = document.createElement('div');
    c.id = 'admin-toast';
    c.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  const color = type === 'error' ? '#FF453A' : type === 'warn' ? '#FF9F0A' : '#30D158';
  t.style.cssText = `background:#1C1C1E;color:#fff;padding:12px 18px;border-radius:12px;font-size:.875rem;font-weight:500;box-shadow:0 4px 24px rgba(0,0,0,.3);border-left:3px solid ${color};max-width:280px;animation:toastIn .3s ease`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'toastOut .3s ease forwards'; t.addEventListener('animationend', () => t.remove()); }, 3000);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  // Categorías select del formulario
  const catSelect = document.getElementById('f-categoria');
  if (catSelect && ADMIN_DATA.categorias.length === 0) {
    const res = await fetch('data/products.json').catch(() => null);
    if (res) {
      const json = await res.json();
      ADMIN_DATA.categorias = json.categorias || [];
      catSelect.innerHTML = json.categorias.map(c =>
        `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join('');
    }
  }

  // Tabs
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => renderTab(btn.dataset.tab));
  });

  // PIN: Enter key
  const pinInput = document.getElementById('pin-input');
  if (pinInput) pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') handlePin(); });

  // IMG preview on input
  const imgInput = document.getElementById('f-imagen');
  if (imgInput) imgInput.addEventListener('input', e => updateImgPreview(e.target.value));

  // Cerrar modal al click fuera
  document.getElementById('product-modal')?.addEventListener('click', e => {
    if (e.target.id === 'product-modal') closeModal();
  });

  // Verificar si ya tiene PIN
  if (checkPin()) {
    showScreen('loading');
    await loadAdminData();
    // Cargar categorías en el select
    const catSel = document.getElementById('f-categoria');
    if (catSel && ADMIN_DATA.categorias.length > 0) {
      catSel.innerHTML = ADMIN_DATA.categorias.map(c =>
        `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join('');
    }
    showScreen('app');
    renderTab('productos');
  } else {
    showScreen('pin');
  }
});
