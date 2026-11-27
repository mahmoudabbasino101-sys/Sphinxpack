/* =========================================================
   إعدادات Firebase — لازم تستبدل القيم دي ببيانات مشروعك
   هتلاقي الخطوات بالتفصيل في ملف README.md
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyAvQHUxmyZYJCEzj5bp_3k_kME9sEB0Q5A",
  authDomain: "sphinx-b9b21.firebaseapp.com",
  databaseURL: "https://sphinx-b9b21-default-rtdb.firebaseio.com",
  projectId: "sphinx-b9b21",
  storageBucket: "sphinx-b9b21.firebasestorage.app",
  messagingSenderId: "273593552344",
  appId: "1:273593552344:web:c79832f85ed622141976ad"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* جلسة الدخول (أدمن/موظف/عميل) بتتمسح أول ما التبويب أو المتصفح يتقفل،
   فالمرة الجاية لازم يتكتب الباسورد تاني. وكمان الجلسة معزولة لكل تبويب،
   فحساب العميل ماينفعش يتخلط مع جلسة الأدمن. */
if (typeof firebase.auth === "function") {
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(function (e) { console.error(e); });
}
