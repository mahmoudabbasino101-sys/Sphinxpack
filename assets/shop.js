/* =========================================================
   SphinxPack — منطق المتجر المشترك (كل الصفحات العامة)
   ========================================================= */

const DEFAULT_WHATSAPP_NUMBER = "201028735709"; // بصيغة دولية بدون + ، يستخدم في روابط wa.me
let WHATSAPP_NUMBER = DEFAULT_WHATSAPP_NUMBER;
/* ✏️ إيميل التواصل: اكتبه بين العلامتين (لو فاضي مش هيظهر في أي مكان) */
const SITE_CONTACT = { email: "" };
let SETTINGS_EMAIL = "";
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
    SETTINGS_EMAIL = val.contactEmail || "";
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

const LOGO_SRC = "data:image/png;base64,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";
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
        <img src="${LOGO_SRC}" alt="">
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

/* ---------- روابط التواصل (فيس بوك / إنستجرام / إيميل) ---------- */
function contactEmail() {
  const e = String(SITE_CONTACT.email || SETTINGS_EMAIL || "").trim();
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(e) ? e : "";
}
function socialOf(kind) {
  const re = kind === "facebook" ? /facebook|fb\.com|fb\.me|فيس/i : /instagram|instagr|انستجرام|انستقرام|إنستجرام|إنستقرام|انستا/i;
  const s = (SOCIAL_LINKS || []).find(x => re.test([x.key, x.name, x.url].join(" ")));
  const u = s ? safeUrl(s.url) : "";
  return u && u !== "#" ? u : "";
}
const SOC_ICONS = {
  facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8h2.5V4.5H14A3.5 3.5 0 0 0 10.5 8v2H8v3.5h2.5V21H14v-7.5h2.5L17 10h-3V8.5c0-.3.2-.5.5-.5Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
};

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
      <a href="index.html" class="brand"><img src="${LOGO_SRC}" alt=""><span class="brand-txt"><b>SphinxPack</b></span></a>
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
    ${(() => {
      const em = contactEmail(), fb = socialOf("facebook"), ig = socialOf("instagram");
      if (!em && !fb && !ig) return "";
      return `<div class="menu-sec"><h5>تواصل معنا</h5>
        ${em ? `<a class="menu-ic" href="mailto:${escHtml(em)}">${SOC_ICONS.email}<span dir="ltr">${escHtml(em)}</span></a>` : ""}
        ${fb ? `<a class="menu-ic" href="${escHtml(fb)}" target="_blank" rel="noopener">${SOC_ICONS.facebook}<span>فيس بوك</span></a>` : ""}
        ${ig ? `<a class="menu-ic" href="${escHtml(ig)}" target="_blank" rel="noopener">${SOC_ICONS.instagram}<span>إنستجرام</span></a>` : ""}
      </div>`;
    })()}
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
