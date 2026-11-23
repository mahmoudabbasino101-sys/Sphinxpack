# SphinxPack — موقع المتجر (GitHub Pages)

صفحات HTML ثابتة + Firebase Realtime Database + سيرفر دفع على Vercel (`sphinxpack-server`).

## أهم ما تحتاج تعرفه
- **قواعد Firebase:** استخدم فقط ملف `firebase-rules-final.json` (مجلد `3-firebase-rules` في الحزمة الكاملة). لا تستخدم أي قواعد قديمة فيها `".write": true`.
- **الزوار مابيكتبوش في قاعدة البيانات:** الأوردرات والدفع بيتعملوا من السيرفر (`PAYMENT_SERVER_URL` في `assets/shop.js`).
- **الصفحات الداخلية:** `admin.html` (الأدمن) و `staff.html` (موظف المنتجات) و `courier.html` (المندوب) — كل واحدة بتقبل دورها بس.
- **`security-test.html`** أداة فحص مؤقتة، لا ترفعها للموقع بشكل دائم.

## إعداد Firebase (مرة واحدة)
1. أنشئ مشروع Firebase وفعّل Realtime Database و Authentication (Email/Password).
2. حط بيانات المشروع في `assets/firebase-init.js`.
3. أضف حساب الأدمن `admin@sphinxpack.app` من Authentication ← Users.
4. الصق `firebase-rules-final.json` في Rules واضغط Publish.
5. من لوحة الأدمن ← الإعدادات: أضف موظفين ومناديب، وحدّد رقم واتساب ونسبة العربون.

تفاصيل النشر الكاملة في `START-HERE-AR.md` (الحزمة الكاملة).
