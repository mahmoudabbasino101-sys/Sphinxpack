/* =========================================================
   SphinxPack — منطق المتجر المشترك (كل الصفحات العامة)
   ========================================================= */

const DEFAULT_WHATSAPP_NUMBER = "201028735709"; // بصيغة دولية بدون + ، يستخدم في روابط wa.me
let WHATSAPP_NUMBER = DEFAULT_WHATSAPP_NUMBER;
let SOCIAL_LINKS = []; // [{key,name,url}] بتتحمل من الإعدادات
let DEPOSIT_PERCENT = 25; // نسبة العربون الافتراضية، تتغيّر من الإعدادات
let WALLET_NUMBER = "01028735709"; // رقم فودافون كاش للتحويل اليدوي
let INSTAPAY_NUMBER = "01028735709"; // رقم/حساب إنستاباي للتحويل اليدوي

/* رابط سيرفر الدفع (Vercel) — هيتظبط بعد ما يترفع سيرفر Paymob */
/* حماية من XSS: أي نص جاي من قاعدة البيانات أو من السلة بيتنقّى قبل ما يتحط في HTML */
function escHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function safeUrl(u) {
  try { const x = new URL(String(u || ""), location.href); return /^https?:$/.test(x.protocol) ? x.href : "#"; } catch (e) { return "#"; }
}
function safeImg(u) {
  u = String(u || "");
  return /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(u) || /^https?:\/\//.test(u) ? u : "";
}

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
    INSTAPAY_NUMBER = val.instapayNumber || WALLET_NUMBER;
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
      CATEGORIES = Object.entries(val).map(([slug, c]) => ({ slug, name: c.name, icon: c.icon || "box", image: c.image || null, description: c.description || "" }));
    } else {
      const seed = {};
      DEFAULT_CATEGORIES.forEach(c => { seed[c.slug] = { name: c.name, icon: c.icon }; });
      /* بنكتب الأقسام الافتراضية بس لو اللي فاتح هو الأدمن (الزوار مالهمش صلاحية كتابة) */
      if (typeof firebase.auth === "function" && firebase.auth().currentUser) db.ref("categories").set(seed).catch(() => {});
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
/* رسالة نقص المخزون */
function stockMsg(stock) {
  return stock > 0
    ? "الكمية غير متوفرة في المخزن. المتاح حاليًا: " + stock
    : "المنتج غير متوفر حاليًا في المخزن";
}
/* بترجّع true لو اتضاف، و false لو الكمية المطلوبة (مع اللي في السلة) أكبر من المخزون */
function addToCart(product, qty) {
  const cart = getCart();
  const line = cart.find(l => l.id === product.id);
  const stock = typeof product.qty === "number" ? product.qty : null;
  const inCart = line ? line.qty : 0;
  if (stock !== null && inCart + qty > stock) {
    showToast(stockMsg(stock) + (inCart ? " (عندك " + inCart + " في السلة)" : ""));
    return false;
  }
  if (line) { line.qty += qty; if (stock !== null) line.stock = stock; }
  else cart.push({ id: product.id, name: product.name, category: product.category,
                    price: product.price, image: product.image || "", piecesPerCarton: product.piecesPerCarton || null, qty,
                    stock: stock });
  saveCart(cart);
  showToast(`تمت إضافة "${product.name}" للسلة`);
  return true;
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
  if (typeof line.stock === "number" && line.qty > line.stock) {
    line.qty = Math.max(1, line.stock);
    showToast(stockMsg(line.stock));
  }
  saveCart(cart);
  renderDrawer();
  if (typeof renderCartPage === "function") renderCartPage();
}
/* بنحدّث المتاح من المخزون لكل منتج في السلة، ولو الكمية أكبر من المتاح بنقلّلها ونبلّغ العميل */
function refreshCartStock(cb) {
  const cart = getCart();
  if (!cart.length || typeof db === "undefined") { if (cb) cb(); return; }
  Promise.all(cart.map(l => db.ref("products/" + l.category + "/" + l.id + "/qty").once("value")
    .then(snap => ({ id: l.id, qty: snap.val() })).catch(() => null))).then(rs => {
    const c = getCart(); const msgs = []; let changed = false;
    rs.forEach(r => {
      if (!r || typeof r.qty !== "number") return;
      const line = c.find(x => x.id === r.id); if (!line) return;
      line.stock = r.qty; changed = true;
      if (r.qty > 0 && line.qty > r.qty) { line.qty = r.qty; msgs.push(line.name + ": " + stockMsg(r.qty)); }
    });
    if (changed) saveCart(c);
    if (msgs.length) showToast(msgs.join(" — "));
    if (cb) cb();
  });
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

/* ---------- حركة الإضافة للسلة: صورة المنتج بتطير لأيقونة السلة ---------- */
function bumpCartIcon() {
  const t = document.getElementById("open-cart-btn") || document.querySelector(".cart-toggle");
  if (t && t.animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    t.animate([{ transform: "scale(1)" }, { transform: "scale(1.16)" }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out" });
  }
}
function flyToCart(fromEl) {
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = document.getElementById("open-cart-btn") || document.querySelector(".cart-toggle");
    const card = fromEl && fromEl.closest && fromEl.closest(".prod-card");
    const src = (card && card.querySelector(".thumb")) || document.getElementById("pm-image");
    if (!target || !src || !src.animate) { bumpCartIcon(); return; }
    const a = src.getBoundingClientRect(), b = target.getBoundingClientRect();
    const size = 64;
    const ghost = document.createElement("div");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.cssText = "position:fixed;z-index:400;pointer-events:none;border-radius:12px;overflow:hidden;background:var(--amber,#E1531B);box-shadow:0 10px 24px rgba(33,29,24,.35);" +
      "width:" + size + "px;height:" + size + "px;left:" + (a.left + a.width / 2 - size / 2) + "px;top:" + (a.top + a.height / 2 - size / 2) + "px;";
    const img = src.querySelector("img");
    if (img) {
      const c = img.cloneNode(false);
      c.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
      ghost.appendChild(c);
    }
    document.body.appendChild(ghost);
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    const anim = ghost.animate([
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: "translate(" + dx * 0.55 + "px," + (dy * 0.55 - 70) + "px) scale(.7)", opacity: 1, offset: 0.55 },
      { transform: "translate(" + dx + "px," + dy + "px) scale(.18)", opacity: .25 },
    ], { duration: 750, easing: "cubic-bezier(.45,.05,.55,.95)" });
    anim.onfinish = () => { ghost.remove(); bumpCartIcon(); };
  } catch (e) { /* الحركة تحسين شكلي بس */ }
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
  refreshCartStock(() => renderDrawer());
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
          <span class="name">${escHtml(l.name)}</span>
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

/* ---------- التعامل مع السيرفر ----------
   إنشاء الأوردرات وتجهيز الدفع بيتم من السيرفر (Vercel): هو اللي بيحسب الأسعار والإجمالي
   ويرقّم الأوردر ويخصم المخزون، والمتصفح مابيكتبش في قاعدة البيانات خالص. */
async function postToServer(path, body) {
  /* تسجيل الدخول إجباري: بنبعت توكن الحساب، والسيرفر بيتحقق منه ومابيقبلش أي طلب من غيره */
  const headers = { "Content-Type": "application/json" };
  const token = window.SPAuth ? await SPAuth.getToken() : null;
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(PAYMENT_SERVER_URL + path, { method: "POST", headers, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d.error || "حصل خطأ، جرّب تاني");
    e.status = r.status;
    if ((r.status === 401 || r.status === 403) && window.SPAuth) SPAuth.handleServerAuthError(r.status);
    throw e;
  }
  return d;
}
function cartForServer(cart) {
  return cart.map(l => ({ id: l.id, category: l.category, qty: l.qty })); // بنبعت المعرّف والكمية بس، الأسعار بتتحسب في السيرفر
}
function pushOrderToFirebase(cart, customer, extra) {
  return postToServer("/api/create-order", {
    cart: cartForServer(cart),
    customer: { name: customer.name, phone: customer.phone, address: customer.address || "", notes: customer.notes || "", location: customer.location || null },
    paymentMethod: (extra && extra.paymentMethod) || "cod",
    proofImage: (extra && extra.paymentProofImage) || undefined,
  });
}

/* تجهيز دفعة Paymob (عربون/كامل): السيرفر بيحسب المبلغ ويحفظ الطلب مؤقتًا ويرجّع رابط الدفع */
function createPaymobPayment(cart, customer, method) {
  return postToServer("/api/create-payment", {
    cart: cartForServer(cart),
    customer: { name: customer.name, phone: customer.phone, address: customer.address || "", notes: customer.notes || "", location: customer.location || null },
    paymentMethod: method,
    returnUrl: new URL("thank-you.html", location.href).href, // الرجوع لصفحة الشكر بعد الدفع
  }).then(d => {
    try { localStorage.setItem("sp_pending_id", d.orderId); } catch (e) {}
    return d;
  });
}


/* ضغط أي صورة (لقطة شاشة تحويل، صورة منتج...) لحجم صغير مناسب للتخزين في Firebase */
function compressImage(file, maxSize = 700, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) { height *= maxSize / width; width = maxSize; }
        else if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sendOrderViaWhatsapp(customer, extra) {
  const cart = getCart();
  if (!cart.length) { showToast("السلة فاضية"); return Promise.resolve(null); }
  if (window.SPAuth && !SPAuth.isLoggedIn()) { SPAuth.requireLogin().catch(() => {}); return Promise.reject(new Error("سجّل دخولك الأول عشان تكمّل الطلب")); }
  const msg = buildWhatsappMessage(cart, customer);
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

  /* لازم نفتح واتساب فورًا جوه حدث الضغطة نفسها، وإلا هيمنعه المتصفح على الموبايل
     لو استنينا رد Firebase الأول (نفس فكرة الـ popup blocker) */
  window.open(url, "_blank");

  const pushPromise = pushOrderToFirebase(cart, customer, extra);
  pushPromise.then(() => {
    localStorage.removeItem(CART_KEY);
    updateCartCount();
    if (typeof renderCartPage === "function") renderCartPage();
    renderDrawer();
  }).catch(err => console.warn("تعذر حفظ الطلب:", err));
  return pushPromise;
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
    ${CATEGORIES.map(c => `<li><a href="category.html?cat=${encodeURIComponent(c.slug)}" class="${activeSlug === c.slug ? "active" : ""}">${escHtml(c.name)}</a></li>`).join("")}
  </ul></nav>`;
}

const UI_ICONS = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.5L21 7H6"/><circle cx="10" cy="20.5" r="1.5"/><circle cx="18" cy="20.5" r="1.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8 2.5 11.2a1 1 0 0 0 .7 1.8H5v7.2a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V13h1.8a1 1 0 0 0 .7-1.8L12 2.8Z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.9-4.9"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="8" r="4.2"/><path d="M4 21c.6-4.3 4-6.5 8-6.5s7.4 2.2 8 6.5"/></svg>',
};

function mountHeader(activeSlug) {
  const el = document.getElementById("site-header");
  if (!el) return;
  const ph = localPhone(WHATSAPP_NUMBER);
  el.innerHTML = `
    <div class="topbar"><div class="wrap">
      <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener">واتساب: ${ph}</a>
      <a href="tel:${ph}">اتصل بنا: ${ph}</a>
    </div></div>
    <div class="hdr-in">
      <button class="hdr-btn hdr-menu" id="open-menu-btn" aria-label="القائمة">${UI_ICONS.menu}</button>
      <a href="index.html" class="brand" aria-label="SphinxPack">
        <img src="assets/images/sphinx-logo-gold.png" alt="">
        <span class="brand-txt"><b>SphinxPack</b><small>Packaging Supplies</small></span>
      </a>
      <nav class="hdr-links"><a href="index.html">الرئيسية</a><a href="index.html#categories">الأقسام</a><a href="index.html#contact">تواصل معنا</a></nav>
      <span class="hdr-actions"><span id="acct-slot"></span>
        <button class="hdr-btn hdr-cart" id="open-cart-btn" aria-label="سلة التسوق">${UI_ICONS.cart}<span class="count" data-cart-count>0</span></button>
      </span>
    </div>
    ${renderCatNav(activeSlug)}
  `;
  document.getElementById("open-cart-btn").addEventListener("click", openDrawer);
  document.getElementById("open-menu-btn").addEventListener("click", () => toggleMenu(true));
  mountMenu();
  mountBottomNav();
  updateCartCount();
  if (window.SPAuth) SPAuth.mount();
}

/* ---------- القائمة الجانبية (موبايل) ---------- */
function toggleMenu(open) {
  document.getElementById("menu-overlay")?.classList.toggle("open", open);
  document.getElementById("menu-panel")?.classList.toggle("open", open);
}
function mountMenu() {
  let panel = document.getElementById("menu-panel");
  if (!panel) {
    const ov = document.createElement("div");
    ov.className = "menu-overlay"; ov.id = "menu-overlay";
    panel = document.createElement("aside");
    panel.className = "menu-panel"; panel.id = "menu-panel";
    document.body.append(ov, panel);
    ov.addEventListener("click", () => toggleMenu(false));
    panel.addEventListener("click", e => { if (e.target.closest("a,.menu-close")) toggleMenu(false); });
  }
  panel.innerHTML = `
    <div class="menu-top">
      <a href="index.html" class="brand"><img src="assets/images/sphinx-logo-gold.png" alt=""><span class="brand-txt"><b>SphinxPack</b></span></a>
      <button class="menu-close" aria-label="إغلاق">×</button>
    </div>
    <div class="menu-sec"><h5>التسوق</h5>
      <a href="index.html">الرئيسية</a>
      <a href="account.html">حسابي وطلباتي</a>
    </div>
    <div class="menu-sec"><h5>الأقسام</h5>
      ${CATEGORIES.map(c => `<a href="category.html?cat=${encodeURIComponent(c.slug)}">${escHtml(c.name)}</a>`).join("")}
    </div>
    <div class="menu-sec"><h5>معلومات</h5>
      <a href="shipping-policy.html">سياسة الشحن والتوصيل</a>
      <a href="policy.html">سياسة الاستبدال والاسترجاع</a>
      <a href="privacy-policy.html">سياسة الخصوصية</a>
    </div>
    <a class="menu-wa" href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener">راسلنا على واتساب</a>`;
}

/* ---------- شريط التنقل السفلي + نافذة البحث ---------- */
function mountBottomNav() {
  if (document.getElementById("bnav")) return;
  const path = location.pathname.split("/").pop() || "index.html";
  const act = k => ({ home: path === "index.html" || path === "", acct: path === "account.html", cart: path === "cart.html", cats: path === "category.html" })[k] ? "is-active" : "";
  const nav = document.createElement("nav");
  nav.className = "bnav"; nav.id = "bnav";
  nav.innerHTML = `
    <a href="index.html" class="${act("home")}">${UI_ICONS.home}<span>الرئيسية</span></a>
    <a href="index.html#categories" class="${act("cats")}">${UI_ICONS.grid}<span>الأقسام</span></a>
    <button type="button" data-bn="search">${UI_ICONS.search}<span>بحث</span></button>
    <button type="button" data-bn="acct" class="${act("acct")}">${UI_ICONS.user}<span>حسابي</span></button>
    <button type="button" data-bn="cart" class="${act("cart")}">${UI_ICONS.cart}<span>سلة التسوق</span><b class="badge" data-cart-count>0</b></button>`;
  document.body.appendChild(nav);
  document.body.classList.add("has-bnav");

  const sheet = document.createElement("div");
  sheet.className = "search-sheet"; sheet.id = "search-sheet";
  sheet.innerHTML = `<form role="search"><input type="search" placeholder="ابحث عن منتج... (مثال: كوب 12 أوز)" aria-label="بحث"><button type="submit">بحث</button></form>`;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", e => { if (e.target === sheet) sheet.classList.remove("open"); });
  sheet.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();
    const q = sheet.querySelector("input").value.trim();
    if (q) location.href = "category.html?search=" + encodeURIComponent(q);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { sheet.classList.remove("open"); toggleMenu(false); } });

  nav.addEventListener("click", e => {
    const b = e.target.closest("[data-bn]");
    if (!b) return;
    const k = b.dataset.bn;
    if (k === "cart") openDrawer();
    else if (k === "search") { sheet.classList.add("open"); sheet.querySelector("input").focus(); }
    else if (k === "acct") {
      if (window.SPAuth && SPAuth.isLoggedIn()) location.href = "account.html";
      else if (window.SPAuth) SPAuth.open("login");
      else location.href = "account.html";
    }
  });
  updateCartCount();
}

function mountFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;
  el.innerHTML = `
    <footer><div class="wrap">
      <div>
        <h4>SphinxPack</h4>
        <p style="max-width:32ch;font-size:13.5px;color:var(--muted)">
          مستلزمات التغليف والضيافة بالجملة — أكواب، علب وجبات، فويل، أدوات مائدة، ومستلزمات طبية.
        </p>
      </div>
      <div>
        <h4>الأقسام</h4>
        ${CATEGORIES.map(c => `<a href="category.html?cat=${encodeURIComponent(c.slug)}">${escHtml(c.name)}</a>`).join("")}
      </div>
      <div>
        <h4>تواصل معنا</h4>
        <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank">واتساب: ${localPhone(WHATSAPP_NUMBER)}</a>
        <a href="tel:${localPhone(WHATSAPP_NUMBER)}">اتصال: ${localPhone(WHATSAPP_NUMBER)}</a>
        <a href="policy.html">سياسة الاستبدال والاسترجاع</a>
        <a href="shipping-policy.html">سياسة الشحن والتوصيل</a>
        <a href="privacy-policy.html">سياسة الخصوصية</a>
      </div>
    </div>
    <div class="bottom">© ${new Date().getFullYear()} SphinxPack — جميع الحقوق محفوظة</div>
    </footer>`;
}

document.addEventListener("DOMContentLoaded", updateCartCount);
