/* =========================================================
   SphinxPack — منطق المتجر المشترك (كل الصفحات العامة)
   ========================================================= */

const DEFAULT_WHATSAPP_NUMBER = "201028735709"; // بصيغة دولية بدون + ، يستخدم في روابط wa.me
let WHATSAPP_NUMBER = DEFAULT_WHATSAPP_NUMBER;
let SOCIAL_LINKS = []; // [{key,name,url}] بتتحمل من الإعدادات
let DEPOSIT_PERCENT = 25; // نسبة العربون الافتراضية، تتغيّر من الإعدادات
let WALLET_NUMBER = "01028735709"; // رقم المحفظة/فودافون كاش للتحويل اليدوي

/* رابط سيرفر الدفع (Vercel) — هيتظبط بعد ما يترفع سيرفر Paymob */
const PAYMENT_SERVER_URL = "https://sphinxpack-server.vercel.app";

function localPhone(intl) {
  const digits = String(intl || DEFAULT_WHATSAPP_NUMBER).replace(/[^0-9]/g, "");
  return digits.startsWith("20") ? "0" + digits.slice(2) : digits;
}

/* تحميل إعدادات المتجر (رقم واتساب + روابط السوشيال ميديا) من Firebase */
function initSettings(callback) {
  if (typeof db === "undefined") { callback(); return; }
  db.ref("settings").on("value", snap => {
    const val = snap.val() || {};
    WHATSAPP_NUMBER = val.whatsappNumber || DEFAULT_WHATSAPP_NUMBER;
    DEPOSIT_PERCENT = val.depositPercent || 25;
    WALLET_NUMBER = val.walletNumber || localPhone(WHATSAPP_NUMBER);
    SOCIAL_LINKS = val.socialLinks ? Object.entries(val.socialLinks).map(([key, s]) => ({ key, ...s })) : [];
    callback();
  });
}

const DEFAULT_CATEGORIES = [
  { slug: "plastic-cups", name: "أكواب بلاستيكية", icon: "cup" },
  { slug: "meal-boxes",   name: "علب الوجبات",      icon: "box" },
  { slug: "paper-cups",   name: "أكواب ورقية",      icon: "cup" },
  { slug: "foil",         name: "أدوات الفويل",      icon: "roll" },
  { slug: "tableware",    name: "أدوات المائدة",     icon: "fork" },
  { slug: "accessories",  name: "إكسسوارات",        icon: "star" },
  { slug: "medical",      name: "مستلزمات طبية",     icon: "cross" },
];
/* CATEGORIES تبدأ بالقيم الافتراضية عشان الصفحة متفضلش فاضية، وبعدين
   initCategories() بتحدّثها بالأقسام الحقيقية المخزّنة في Firebase (لو موجودة) */
let CATEGORIES = DEFAULT_CATEGORIES.slice();

/* تحميل الأقسام من Firebase (مع بذر القيم الافتراضية أول مرة)، وتشغيل
   callback في كل مرة تتغير فيها الأقسام (إضافة/حذف من لوحة التحكم) */
function initCategories(callback) {
  if (typeof db === "undefined") { callback(CATEGORIES); return; }
  db.ref("categories").on("value", snap => {
    const val = snap.val();
    if (val && Object.keys(val).length) {
      CATEGORIES = Object.entries(val).map(([slug, c]) => ({ slug, name: c.name, icon: c.icon || "box" }));
    } else {
      const seed = {};
      DEFAULT_CATEGORIES.forEach(c => { seed[c.slug] = { name: c.name, icon: c.icon }; });
      db.ref("categories").set(seed);
      CATEGORIES = DEFAULT_CATEGORIES.slice();
    }
    callback(CATEGORIES);
  });
}

function catName(slug) {
  const c = CATEGORIES.find(c => c.slug === slug);
  return c ? c.name : slug;
}

const ICONS = {
  cup:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 8h12l-1.2 11a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8Z"/><path d="M6 8 5.2 5h13.6L18 8"/></svg>',
  box:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8 12 4l9 4-9 4-9-4Z"/><path d="M3 8v9l9 4 9-4V8"/><path d="M12 12v9"/></svg>',
  roll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v9c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/></svg>',
  fork: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11M17 3c-1.5 1-2 2.5-2 4.5S16 12 17 12s2-1 2-4.5S18.5 4 17 3Zm0 9v8"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m12 3 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1L6.6 19l1.3-6-4.6-4.1 6.1-.6L12 3Z"/></svg>',
  cross:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18M3 12h18" stroke-linecap="round"/></svg>',
  bag:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
};

/* ---------- تأمين JSON داخل خصائص onclick ---------- */
function safeJson(obj) {
  return JSON.stringify(obj).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

/* ---------- سلة الشراء (localStorage) ---------- */
const CART_KEY = "sphinxpack_cart";

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}
function addToCart(product, qty) {
  const cart = getCart();
  const line = cart.find(l => l.id === product.id);
  if (line) line.qty += qty;
  else cart.push({ id: product.id, name: product.name, category: product.category,
                    price: product.price, image: product.image || "", piecesPerCarton: product.piecesPerCarton || null, qty });
  saveCart(cart);
  showToast(`تمت إضافة "${product.name}" للسلة`);
}
function removeFromCart(id) {
  saveCart(getCart().filter(l => l.id !== id));
  renderDrawer();
  if (typeof renderCartPage === "function") renderCartPage();
}
function setLineQty(id, qty) {
  const cart = getCart();
  const line = cart.find(l => l.id === id);
  if (!line) return;
  line.qty = Math.max(1, qty);
  saveCart(cart);
  renderDrawer();
  if (typeof renderCartPage === "function") renderCartPage();
}
function cartTotal(cart) {
  return cart.reduce((s, l) => s + l.price * l.qty, 0);
}
function cartCount(cart) {
  return cart.reduce((s, l) => s + l.qty, 0);
}
function updateCartCount() {
  document.querySelectorAll("[data-cart-count]").forEach(el => {
    el.textContent = cartCount(getCart());
  });
}

/* ---------- توست تنبيه صغير ---------- */
let toastTimer;
function showToast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- درج السلة (يظهر فوق أي صفحة) ---------- */
function ensureDrawer() {
  if (document.getElementById("cart-drawer")) return;
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.id = "cart-overlay";
  const drawer = document.createElement("div");
  drawer.className = "drawer";
  drawer.id = "cart-drawer";
  drawer.innerHTML = `
    <div class="drawer-head">
      <h3>سلة الطلبات</h3>
      <button class="drawer-close" aria-label="إغلاق">×</button>
    </div>
    <div class="drawer-items" id="drawer-items"></div>
    <div class="drawer-foot">
      <div class="total-row"><span>الإجمالي</span><span id="drawer-total">0 ج.م</span></div>
      <a href="cart.html" class="btn btn-ink btn-block">مراجعة الطلب والإرسال</a>
    </div>`;
  document.body.append(overlay, drawer);
  overlay.addEventListener("click", closeDrawer);
  drawer.querySelector(".drawer-close").addEventListener("click", closeDrawer);
}
function openDrawer() {
  ensureDrawer();
  renderDrawer();
  document.getElementById("cart-drawer").classList.add("open");
  document.getElementById("cart-overlay").classList.add("open");
}
function closeDrawer() {
  document.getElementById("cart-drawer")?.classList.remove("open");
  document.getElementById("cart-overlay")?.classList.remove("open");
}
function renderDrawer() {
  const wrap = document.getElementById("drawer-items");
  if (!wrap) return;
  const cart = getCart();
  if (!cart.length) {
    wrap.innerHTML = `<p class="empty-note">السلة فاضية دلوقتي</p>`;
  } else {
    wrap.innerHTML = cart.map(l => `
      <div class="cart-line">
        <div class="thumb">${l.image ? `<img src="${l.image}" alt="">` : ICONS.bag}</div>
        <div class="info">
          <span class="name">${l.name}</span>
          <span class="cat">${catName(l.category)}</span>
          <div class="row">
            <div class="qty-box">
              <button onclick="setLineQty('${l.id}', ${l.qty - 1})">−</button>
              <input value="${l.qty}" readonly>
              <button onclick="setLineQty('${l.id}', ${l.qty + 1})">+</button>
            </div>
            <span class="price">${(l.price * l.qty).toFixed(2)} ج.م</span>
          </div>
        </div>
        <button class="remove-line" onclick="removeFromCart('${l.id}')">حذف</button>
      </div>`).join("");
  }
  const totalEl = document.getElementById("drawer-total");
  if (totalEl) totalEl.textContent = cartTotal(cart).toFixed(2) + " ج.م";
}

/* ---------- بناء رسالة واتساب من محتوى السلة ---------- */
function buildWhatsappMessage(cart, customer) {
  const lines = cart.map((l, i) =>
    `${i + 1}) ${l.name} (${catName(l.category)}) — الكمية: ${l.qty} × ${l.price} ج.م = ${(l.qty * l.price).toFixed(2)} ج.م`
  ).join("\n");
  return `*طلب جديد من موقع SphinxPack*\n\n` +
    `الاسم: ${customer.name}\n` +
    `رقم التواصل: ${customer.phone}\n` +
    (customer.address ? `العنوان: ${customer.address}\n` : "") +
    (customer.notes ? `ملاحظات: ${customer.notes}\n` : "") +
    `\nتفاصيل الطلب:\n${lines}\n\n` +
    `*الإجمالي: ${cartTotal(cart).toFixed(2)} ج.م*`;
}

/* حفظ الطلب في Firebase عشان يظهر في صفحة الأدمن */
function pushOrderToFirebase(cart, customer, extra) {
  if (typeof db === "undefined") return Promise.resolve(null);
  const order = {
    customerName: customer.name,
    customerPhone: customer.phone,
    address: customer.address || "",
    notes: customer.notes || "",
    items: cart.map(l => ({ name: l.name, category: l.category, price: l.price, qty: l.qty, piecesPerCarton: l.piecesPerCarton || null })),
    total: cartTotal(cart),
    status: "new",
    createdAt: Date.now(),
    paymentMethod: (extra && extra.paymentMethod) || "cod",
    paymentStatus: (extra && extra.paymentStatus) || "unpaid",
  };
  if (extra && extra.depositAmount) order.depositAmount = extra.depositAmount;
  upsertCustomer(customer, order.total);
  /* رقم تسلسلي لكل أوردر (١، ٢، ٣...) عشان يسهل البحث والمتابعة */
  return db.ref("counters/orders").transaction(cur => (cur || 0) + 1).then(result => {
    order.orderNumber = result.snapshot.val();
    return db.ref("orders").push(order).then(ref => ({ id: ref.key, orderNumber: order.orderNumber, order }));
  });
}

/* طلب رابط دفع Paymob من السيرفر الخاص بينا (المفاتيح السرية مش هنا) */
function createPaymobPayment(orderInfo, amount, customer) {
  return fetch(PAYMENT_SERVER_URL + "/api/create-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      orderId: orderInfo.id,
      orderNumber: orderInfo.orderNumber,
      customerName: customer.name,
      customerPhone: customer.phone,
    }),
  }).then(r => r.json());
}

/* حفظ/تحديث بيانات العميل (الاسم والهاتف) كل ما حد يعمل أوردر */
function upsertCustomer(customer, orderTotal) {
  if (typeof db === "undefined") return;
  const key = (customer.phone || "").replace(/[^0-9]/g, "") || "unknown_" + Date.now();
  db.ref("customers/" + key).transaction(current => {
    current = current || { name: customer.name, phone: customer.phone, ordersCount: 0, totalSpent: 0 };
    current.name = customer.name || current.name;
    current.phone = customer.phone || current.phone;
    current.ordersCount = (current.ordersCount || 0) + 1;
    current.totalSpent = (current.totalSpent || 0) + orderTotal;
    current.lastOrderAt = Date.now();
    return current;
  });
}

function sendOrderViaWhatsapp(customer, extra) {
  const cart = getCart();
  if (!cart.length) { showToast("السلة فاضية"); return; }
  const msg = buildWhatsappMessage(cart, customer);
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

  /* لازم نفتح واتساب فورًا جوه حدث الضغطة نفسها، وإلا هيمنعه المتصفح على الموبايل
     لو استنينا رد Firebase الأول (نفس فكرة الـ popup blocker) */
  window.open(url, "_blank");

  /* حفظ الطلب في الخلفية (Firebase) من غير ما يعطل فتح واتساب */
  pushOrderToFirebase(cart, customer, extra).catch(err => console.warn("تعذر حفظ الطلب:", err));

  localStorage.removeItem(CART_KEY);
  updateCartCount();
  if (typeof renderCartPage === "function") renderCartPage();
  renderDrawer();
}

/* ---------- تحميل المنتجات من Firebase ---------- */
function loadProducts(categorySlug, cb) {
  if (typeof db === "undefined") { cb([]); return; }
  const ref = categorySlug ? db.ref("products/" + categorySlug) : db.ref("products");
  ref.on("value", snap => {
    const val = snap.val() || {};
    let list = [];
    if (categorySlug) {
      list = Object.entries(val).map(([id, p]) => ({ id, category: categorySlug, ...p }));
    } else {
      Object.entries(val).forEach(([cat, prods]) => {
        Object.entries(prods || {}).forEach(([id, p]) => list.push({ id, category: cat, ...p }));
      });
    }
    cb(list);
  });
}

/* ---------- عناصر مشتركة: هيدر وفوتر ---------- */
function renderCatNav(activeSlug) {
  return `<nav class="cat-nav"><ul>
    <li><a href="index.html" class="${!activeSlug ? "active" : ""}">الرئيسية</a></li>
    ${CATEGORIES.map(c => `<li><a href="category.html?cat=${c.slug}" class="${activeSlug === c.slug ? "active" : ""}">${c.name}</a></li>`).join("")}
  </ul></nav>`;
}

function mountHeader(activeSlug) {
  const el = document.getElementById("site-header");
  if (!el) return;
  el.innerHTML = `
    <div class="topbar"><div class="wrap">
      <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank">واتساب: ${localPhone(WHATSAPP_NUMBER)}</a>
      <a href="tel:${localPhone(WHATSAPP_NUMBER)}">اتصل بنا: ${localPhone(WHATSAPP_NUMBER)}</a>
    </div></div>
    <div class="nav-row wrap">
      <a href="index.html" class="logo">
        <span class="mark" style="background:transparent"><img src="assets/images/sphinx-logo.png" alt="SphinxPack" style="width:42px;height:42px;object-fit:contain"></span>
        <span class="brand">SphinxPack<small>مستلزمات التغليف والضيافة</small></span>
      </a>
      <button class="cart-btn" id="open-cart-btn">
        ${ICONS.bag.replace("currentColor","currentColor")}
        <span>السلة</span>
        <span class="count" data-cart-count>0</span>
      </button>
    </div>
    ${renderCatNav(activeSlug)}
  `;
  document.getElementById("open-cart-btn").addEventListener("click", openDrawer);
  updateCartCount();
}

function mountFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;
  el.innerHTML = `
    <footer><div class="wrap">
      <div>
        <h4>SphinxPack</h4>
        <p style="max-width:32ch;font-size:13.5px;color:#C9D4DD">
          مستلزمات التغليف والضيافة بالجملة — أكواب، علب وجبات، فويل، أدوات مائدة، ومستلزمات طبية.
        </p>
      </div>
      <div>
        <h4>الأقسام</h4>
        ${CATEGORIES.map(c => `<a href="category.html?cat=${c.slug}">${c.name}</a>`).join("")}
      </div>
      <div>
        <h4>تواصل معنا</h4>
        <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank">واتساب: ${localPhone(WHATSAPP_NUMBER)}</a>
        <a href="tel:${localPhone(WHATSAPP_NUMBER)}">اتصال: ${localPhone(WHATSAPP_NUMBER)}</a>
      </div>
    </div>
    <div class="bottom">© ${new Date().getFullYear()} SphinxPack — جميع الحقوق محفوظة</div>
    </footer>`;
}

document.addEventListener("DOMContentLoaded", updateCartCount);
