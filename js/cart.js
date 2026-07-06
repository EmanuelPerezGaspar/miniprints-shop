/* =============================================
   MINIPRINTS SHOP — CARRITO (localStorage)
   ============================================= */

const Cart = (() => {
  const KEY = 'mp_shop_cart';

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function _save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    _dispatchUpdate();
  }

  function _dispatchUpdate() {
    window.dispatchEvent(new CustomEvent('cart:updated'));
  }

  function getItems() { return _load(); }

  function add(product, qty = 1, options = {}) {
    const items = _load();
    const key = product.id + (options.color ? `_${options.color}` : '');
    const existing = items.find(i => i.key === key);
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, product.stock || 99);
    } else {
      items.push({
        key,
        id: product.id,
        nombre: product.nombre,
        imagen: product.imagen,
        precio: product.precio,
        categoria: product.categoria,
        color: options.color || null,
        notas: options.notas || null,
        stock: product.stock || 99,
        qty,
      });
    }
    _save(items);
  }

  function remove(key) {
    _save(_load().filter(i => i.key !== key));
  }

  function updateQty(key, qty) {
    const items = _load();
    const item = items.find(i => i.key === key);
    if (!item) return;
    if (qty <= 0) { remove(key); return; }
    item.qty = Math.min(qty, item.stock);
    _save(items);
  }

  function clear() { _save([]); }

  function count() { return _load().reduce((n, i) => n + i.qty, 0); }

  function subtotal() { return _load().reduce((t, i) => t + i.precio * i.qty, 0); }

  function shipping(freeFrom = 800) {
    const sub = subtotal();
    if (sub === 0) return 0;
    return sub >= freeFrom ? 0 : 99;
  }

  function total(freeFrom = 800) { return subtotal() + shipping(freeFrom); }

  return { getItems, add, remove, updateQty, clear, count, subtotal, shipping, total };
})();
