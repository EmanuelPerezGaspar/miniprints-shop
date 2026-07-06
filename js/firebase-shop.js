/* =============================================
   MINIPRINTS SHOP — FIREBASE INTEGRATION
   Proyecto: miniprints-v2  |  Colecciones: shop_productos, shop_config
   ============================================= */

const SHOP_PIN = '0343';

const SHOP_FB_CONFIG = {
  apiKey:            "AIzaSyC64TanRR3eG1X5X7lUEoVjLTQGSRZr3Vg",
  authDomain:        "miniprints-v2.firebaseapp.com",
  projectId:         "miniprints-v2",
  storageBucket:     "miniprints-v2.firebasestorage.app",
  messagingSenderId: "688525548823",
  appId:             "1:688625548823:web:984352167469cba3402652"
};

let _db   = null;
let _auth = null;
let _ready = false;

const ShopDB = {

  async init() {
    if (_ready) return true;
    try {
      const app = firebase.apps.length
        ? firebase.app()
        : firebase.initializeApp(SHOP_FB_CONFIG);
      _db   = firebase.firestore();
      _auth = firebase.auth();
      await _auth.signInAnonymously();
      _ready = true;
      return true;
    } catch (e) {
      console.warn('[ShopDB] init falló:', e.message);
      return false;
    }
  },

  // ---- Productos ----
  async getProductos() {
    if (!_db) return null;
    try {
      const snap = await _db.collection('shop_productos').get();
      if (snap.empty) return null;
      return snap.docs
        .map(d => d.data())
        .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre));
    } catch (e) {
      console.warn('[ShopDB] getProductos:', e.message);
      return null;
    }
  },

  async saveProducto(p) {
    if (!_db) throw new Error('DB no inicializada');
    await _db.collection('shop_productos').doc(String(p.id)).set(p);
  },

  async deleteProducto(id) {
    if (!_db) throw new Error('DB no inicializada');
    await _db.collection('shop_productos').doc(String(id)).delete();
  },

  // ---- Configuración ----
  async getConfig() {
    if (!_db) return null;
    try {
      const doc = await _db.collection('shop_config').doc('main').get();
      return doc.exists ? doc.data() : null;
    } catch (e) {
      console.warn('[ShopDB] getConfig:', e.message);
      return null;
    }
  },

  async saveConfig(config) {
    if (!_db) throw new Error('DB no inicializada');
    await _db.collection('shop_config').doc('main').set(config, { merge: true });
  },

  // ---- Migración desde JSON ----
  async importFromJSON(productos, config) {
    if (!_db) throw new Error('DB no inicializada');
    const batch = _db.batch();
    productos.forEach((p, i) => {
      const ref = _db.collection('shop_productos').doc(String(p.id));
      batch.set(ref, { ...p, orden: i });
    });
    if (config) {
      const cfgRef = _db.collection('shop_config').doc('main');
      batch.set(cfgRef, config, { merge: true });
    }
    await batch.commit();
  }
};
