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
