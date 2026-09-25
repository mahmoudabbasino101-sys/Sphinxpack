/* =========================================================
   SphinxPack — لوحة تحكم الأدمن
   ========================================================= */

/* ---------- تسجيل الدخول (Firebase Authentication حقيقي، مش باسورد مخزّن في قاعدة البيانات) ---------- */
const ADMIN_EMAIL = "admin@sphinxpack.app"; // إيميل ثابت داخلي لحساب الأدمن، مش هيستقبل رسائل فعلية

function isAuthed() { return !!firebase.auth().currentUser; }

function doLoginWithPassword(pass) {
  return firebase.auth().signInWithEmailAndPassword(ADMIN_EMAIL, pass);
}

function logout() {
  firebase.auth().signOut();
}

function changeAdminPassword(currentPass, newPass) {
  const cred = firebase.auth.EmailAuthProvider.credential(ADMIN_EMAIL, currentPass);
  return firebase.auth().currentUser
    .reauthenticateWithCredential(cred)
    .then(() => firebase.auth().currentUser.updatePassword(newPass));
}

/* ---------- تنبيه صوتي (Web Audio – بدون ملف صوت خارجي) ---------- */
let audioCtx;
function playAlertSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const beep = (start, freq) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + start);
      osc.stop(audioCtx.currentTime + start + 0.36);
    };
    // نمط "إنذار": ثلاث نغمات متكررة مرتين
    [0, 0.45, 0.9, 1.55, 2.0, 2.45].forEach((t, i) => beep(t, i % 3 === 1 ? 1050 : 780));
  } catch (e) { /* المتصفح مانعش الصوت قبل تفاعل المستخدم */ }
}

/* ---------- ضغط الصورة قبل الرفع (base64 خفيف) ---------- */
/* ---------- ضغط الصور: موجودة في shop.js (compressImage) وبتتحمل قبل الملف ده ---------- */

/* ---------- منتجات ---------- */
function addProduct(data) {
  return db.ref("products/" + data.category).push({
    name: data.name,
    price: data.price,
    qty: data.qty,
    barcode: data.barcode || "",
    description: data.description || "",
    image: data.image || "",
    createdAt: Date.now(),
  });
}
function updateProduct(category, id, data) {
  return db.ref(`products/${category}/${id}`).update(data);
}
function deleteProduct(category, id) {
  return db.ref(`products/${category}/${id}`).remove();
}
function loadAllProductsOnce() {
  return db.ref("products").once("value").then(snap => {
    const val = snap.val() || {};
    const list = [];
    Object.entries(val).forEach(([cat, prods]) => {
      Object.entries(prods || {}).forEach(([id, p]) => list.push({ id, category: cat, ...p }));
    });
    return list;
  });
}

/* ---------- أوردرات ---------- */
function confirmOrderDelivered(id) {
  return db.ref("orders/" + id).update({ status: "done", completedAt: Date.now() });
}
function isSameMonth(ts) {
  const d = new Date(ts), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}
