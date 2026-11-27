/* =========================================================
   SphinxPack — حساب العميل
   إيميل + كلمة سر + تأكيد الإيميل (Firebase Authentication).
   الحماية الحقيقية على السيرفر: create-order و create-payment بيرفضوا أي طلب
   من غير توكن صالح لحساب مؤكَّد. الملف ده بس بيدير الواجهة.
   ========================================================= */
(function () {
  "use strict";
  if (typeof firebase === "undefined" || typeof firebase.auth !== "function") {
    console.warn("firebase-auth-compat غير محمّل في الصفحة دي");
    return;
  }
  const auth = firebase.auth();
  auth.languageCode = "ar"; // رسائل التأكيد واستعادة كلمة السر بالعربي

  const REQUIRE_VERIFIED = true; // لازم يطابق REQUIRE_VERIFIED_EMAIL في Vercel
  const MIN_PASS = 8;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isOk = u => !!(u && u.email && (!REQUIRE_VERIFIED || u.emailVerified));
  const ICON_USER = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';

  const listeners = [];
  let ready = false, modal = null, view = "login", waiters = [], lastFocus = null, resendLeft = 0, resendTimer = null, busy = false;

  /* ---------- رسائل الأخطاء (عامة وما بتكشفش هل الإيميل مسجّل) ---------- */
  function errText(e, ctx) {
    const c = (e && e.code) || "";
    if (c === "auth/too-many-requests") return "محاولات كتير، استنى شوية وجرّب تاني.";
    if (c === "auth/network-request-failed") return "مفيش اتصال بالإنترنت، جرّب تاني.";
    if (c === "auth/invalid-email") return "اكتب إيميل صحيح.";
    if (c === "auth/weak-password") return "كلمة السر ضعيفة، استخدم " + MIN_PASS + " حروف وأرقام على الأقل.";
    if (ctx === "signup" && c === "auth/email-already-in-use") return "الإيميل ده مسجّل قبل كده — جرّب تسجيل الدخول.";
    if (ctx === "login") return "الإيميل أو كلمة السر غير صحيحة.";
    return "حصل خطأ، جرّب تاني.";
  }

  const G_ICON = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  const googleBtn = () => '<div class="spa-or"><span>أو</span></div><button class="spa-google" type="button" data-act="google">' + G_ICON + '<span>المتابعة بحساب جوجل</span></button>';
  function googleErr(e) {
    const c = (e && e.code) || "";
    if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return "";
    if (c === "auth/popup-blocked") return "المتصفح منع نافذة جوجل — اسمح بالنوافذ المنبثقة وجرّب تاني.";
    if (c === "auth/unauthorized-domain") return "دومين الموقع مش مضاف في Firebase (Authorized domains).";
    if (c === "auth/operation-not-allowed") return "تسجيل الدخول بجوجل لسه مش مفعّل في Firebase.";
    if (c === "auth/account-exists-with-different-credential") return "الإيميل ده مسجّل بكلمة سر — سجّل دخولك بيها.";
    if (c === "auth/network-request-failed") return "مفيش اتصال بالإنترنت، جرّب تاني.";
    return "تعذر الدخول بحساب جوجل، جرّب تاني.";
  }

  /* ---------- الواجهة: نافذة الدخول ---------- */
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "spa-overlay";
    modal.hidden = true;
    modal.innerHTML = '<div class="spa-card" role="dialog" aria-modal="true" aria-labelledby="spa-title" tabindex="-1"></div>';
    document.body.appendChild(modal);
    modal.addEventListener("mousedown", e => { if (e.target === modal) closeModal(true); });
    modal.addEventListener("click", onModalClick);
    modal.addEventListener("submit", onModalSubmit);
    modal.addEventListener("keydown", e => {
      if (e.key === "Escape") { closeModal(true); return; }
      if (e.key !== "Tab") return;
      const f = [...modal.querySelectorAll("button,input,a[href]")].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    return modal;
  }

  function field(id, label, type, extra) {
    return '<label class="spa-field" for="' + id + '"><span>' + label + '</span>' +
      '<input id="' + id + '" name="' + id + '" type="' + type + '" ' + (extra || "") + ' required></label>';
  }

  function render(msg, kind) {
    const card = modal.querySelector(".spa-card");
    const u = auth.currentUser;
    /* نحتفظ بالإيميل والاسم لو العميل غلط في حاجة، ومابنحتفظش بكلمة السر */
    const keep = {};
    ["spa-email", "spa-name"].forEach(id => { const el = card.querySelector("#" + id); if (el) keep[id] = el.value; });
    let body = "";
    if (view === "login") {
      body = '<h2 id="spa-title">تسجيل الدخول</h2><p class="spa-sub">سجّل دخولك عشان تكمّل طلبك.</p>' +
        '<form data-form="login" novalidate>' +
        field("spa-email", "الإيميل", "email", 'autocomplete="email" inputmode="email" dir="ltr"') +
        field("spa-pass", "كلمة السر", "password", 'autocomplete="current-password" dir="ltr"') +
        '<button class="spa-btn" type="submit">دخول</button></form>' + googleBtn() +
        '<div class="spa-links"><button type="button" data-go="reset">نسيت كلمة السر؟</button><button type="button" data-go="signup">إنشاء حساب جديد</button></div>';
    } else if (view === "signup") {
      body = '<h2 id="spa-title">إنشاء حساب</h2><p class="spa-sub">هنبعتلك رسالة على الإيميل عشان تأكّد حسابك.</p>' +
        '<form data-form="signup" novalidate>' +
        field("spa-name", "الاسم", "text", 'autocomplete="name" maxlength="80"') +
        field("spa-email", "الإيميل", "email", 'autocomplete="email" inputmode="email" dir="ltr"') +
        field("spa-pass", "كلمة السر (" + MIN_PASS + " حروف على الأقل)", "password", 'autocomplete="new-password" minlength="' + MIN_PASS + '" dir="ltr"') +
        '<button class="spa-btn" type="submit">إنشاء الحساب</button></form>' + googleBtn() +
        '<div class="spa-links"><button type="button" data-go="login">عندي حساب بالفعل</button></div>';
    } else if (view === "reset") {
      body = '<h2 id="spa-title">استعادة كلمة السر</h2><p class="spa-sub">اكتب إيميلك وهنبعتلك رابط تعيين كلمة سر جديدة.</p>' +
        '<form data-form="reset" novalidate>' +
        field("spa-email", "الإيميل", "email", 'autocomplete="email" inputmode="email" dir="ltr"') +
        '<button class="spa-btn" type="submit">ابعت الرابط</button></form>' +
        '<div class="spa-links"><button type="button" data-go="login">رجوع لتسجيل الدخول</button></div>';
    } else if (view === "verify") {
      body = '<h2 id="spa-title">أكّد إيميلك</h2>' +
        '<p class="spa-sub">بعتنا رسالة تأكيد على <strong dir="ltr">' + esc(u && u.email) + '</strong>. افتحها واضغط على الرابط، وبعدين ارجع هنا واضغط «تم التأكيد». لو مش لاقيها شوف مجلد الرسائل المزعجة (Spam).</p>' +
        '<button class="spa-btn" type="button" data-act="check">تم التأكيد</button>' +
        '<div class="spa-links"><button type="button" data-act="resend"' + (resendLeft > 0 ? " disabled" : "") + '>' +
        (resendLeft > 0 ? "إعادة الإرسال بعد " + resendLeft + " ث" : "إعادة إرسال الرسالة") + '</button>' +
        '<button type="button" data-act="out">تسجيل الخروج</button></div>';
    }
    card.innerHTML = '<button class="spa-x" type="button" aria-label="إغلاق" data-act="close">✕</button>' + body +
      '<p class="spa-msg ' + (kind || "") + '" role="alert" aria-live="polite">' + esc(msg || "") + '</p>';
    Object.keys(keep).forEach(id => { const el = card.querySelector("#" + id); if (el) el.value = keep[id]; });
    const first = [...card.querySelectorAll("input")].find(i => !i.value);
    if (first) setTimeout(() => first.focus(), 30);
    else card.focus();
  }

  function openModal(v) {
    ensureModal();
    view = v || "login";
    lastFocus = document.activeElement;
    render();
    modal.hidden = false;
    document.documentElement.classList.add("spa-lock");
    requestAnimationFrame(() => modal.classList.add("is-open"));
    if (view === "verify") startResendCooldown(0);
  }

  function closeModal(cancelled) {
    if (!modal || modal.hidden) return;
    modal.classList.remove("is-open");
    document.documentElement.classList.remove("spa-lock");
    modal.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (cancelled) { const w = waiters; waiters = []; w.forEach(x => x.reject(new Error("cancelled"))); }
  }

  function finish(u) {
    closeModal(false);
    const w = waiters; waiters = []; w.forEach(x => x.resolve(u));
    if (typeof showToast === "function") showToast("أهلاً " + (u.displayName || u.email.split("@")[0]));
  }

  function setBusy(b) {
    busy = b;
    modal.querySelectorAll("button[type=submit],[data-act=check],[data-act=google]").forEach(x => { x.disabled = b; });
  }

  function startResendCooldown(sec) {
    clearInterval(resendTimer);
    resendLeft = sec;
    if (sec <= 0) return;
    resendTimer = setInterval(() => {
      resendLeft--;
      if (resendLeft <= 0) clearInterval(resendTimer);
      if (view === "verify" && modal && !modal.hidden) {
        const b = modal.querySelector("[data-act=resend]");
        if (b) { b.disabled = resendLeft > 0; b.textContent = resendLeft > 0 ? "إعادة الإرسال بعد " + resendLeft + " ث" : "إعادة إرسال الرسالة"; }
      }
    }, 1000);
  }

  function onModalClick(e) {
    const t = e.target.closest("[data-go],[data-act]");
    if (!t || busy) return;
    if (t.dataset.go) { view = t.dataset.go; render(); return; }
    const act = t.dataset.act;
    const u = auth.currentUser;
    if (act === "close") closeModal(true);
    else if (act === "google") {
      setBusy(true);
      const prov = new firebase.auth.GoogleAuthProvider();
      prov.setCustomParameters({ prompt: "select_account" });
      auth.signInWithPopup(prov).then(cred => {
        setBusy(false); mount();
        if (isOk(cred.user)) finish(cred.user); else { view = "verify"; render(); }
      }).catch(err => { setBusy(false); const m = googleErr(err); if (m) render(m, "err"); });
    }
    else if (act === "out") { auth.signOut().then(() => { view = "login"; render(); }); }
    else if (act === "resend" && u) {
      setBusy(true);
      u.sendEmailVerification().then(() => { setBusy(false); startResendCooldown(60); render("بعتنا الرسالة تاني، شوف الإيميل.", "ok"); })
        .catch(err => { setBusy(false); render(errText(err), "err"); });
    } else if (act === "check" && u) {
      setBusy(true);
      u.reload().then(() => {
        if (!u.emailVerified) { setBusy(false); render("الإيميل لسه ما اتأكدش — اضغط على الرابط في الرسالة الأول.", "err"); return; }
        return u.getIdToken(true).then(() => { setBusy(false); mount(); finish(u); }); // توكن جديد فيه email_verified = true
      }).catch(err => { setBusy(false); render(errText(err), "err"); });
    }
  }

  function onModalSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const form = e.target, kind = form.dataset.form;
    const val = id => (form.querySelector("#" + id) || {}).value || "";
    const email = val("spa-email").trim(), pass = val("spa-pass");
    if (!email) return render("اكتب الإيميل.", "err");

    if (kind === "reset") {
      setBusy(true);
      auth.sendPasswordResetEmail(email).then(() => 0, err => (err && err.code === "auth/invalid-email") ? Promise.reject(err) : 0)
        .then(() => { setBusy(false); render("لو الإيميل ده مسجّل عندنا هيوصلك رابط تعيين كلمة السر خلال دقايق.", "ok"); })
        .catch(err => { setBusy(false); render(errText(err), "err"); });
      return;
    }
    if (!pass) return render("اكتب كلمة السر.", "err");

    if (kind === "login") {
      setBusy(true);
      auth.signInWithEmailAndPassword(email, pass).then(cred => {
        setBusy(false); mount();
        if (isOk(cred.user)) finish(cred.user); else { view = "verify"; render(); }
      }).catch(err => { setBusy(false); render(errText(err, "login"), "err"); });
    } else if (kind === "signup") {
      const name = val("spa-name").trim();
      if (name.length < 2) return render("اكتب اسمك.", "err");
      if (pass.length < MIN_PASS) return render("كلمة السر لازم تكون " + MIN_PASS + " حروف على الأقل.", "err");
      setBusy(true);
      auth.createUserWithEmailAndPassword(email, pass).then(cred =>
        cred.user.updateProfile({ displayName: name }).catch(() => {})
          .then(() => (REQUIRE_VERIFIED ? cred.user.sendEmailVerification().catch(() => {}) : null))
          .then(() => { setBusy(false); mount(); if (isOk(cred.user)) finish(cred.user); else { view = "verify"; render(); startResendCooldown(60); } })
      ).catch(err => { setBusy(false); render(errText(err, "signup"), "err"); });
    }
  }

  /* ---------- زر الحساب في الهيدر ---------- */
  function renderSlot(slot) {
    if (!ready) { slot.innerHTML = ""; return; }
    const u = auth.currentUser;
    if (!u) {
      slot.innerHTML = '<button type="button" class="acct-btn" data-acct="open" aria-label="تسجيل الدخول">' + ICON_USER + '<span class="acct-label">دخول</span></button>';
      return;
    }
    const name = u.displayName || (u.email || "").split("@")[0] || "حسابي";
    slot.innerHTML = '<div class="acct-wrap"><button type="button" class="acct-btn is-in" data-acct="menu" aria-haspopup="true" aria-expanded="false">' +
      '<span class="acct-avatar" aria-hidden="true">' + esc(name.trim().charAt(0).toUpperCase()) + '</span><span class="acct-label">' + esc(name) + '</span></button>' +
      '<div class="acct-menu" hidden><div class="acct-mail" dir="ltr">' + esc(u.email) + '</div>' +
      (isOk(u) ? "" : '<button type="button" data-acct="verify">أكّد الإيميل</button>') +
      '<button type="button" data-acct="out">تسجيل الخروج</button></div></div>';
  }
  function mount() { document.querySelectorAll("#acct-slot").forEach(renderSlot); }

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-acct]");
    document.querySelectorAll(".acct-menu").forEach(m => {
      if (!t || t.dataset.acct !== "menu" || !m.parentNode.contains(t)) { m.hidden = true; const b = m.parentNode.querySelector("[data-acct=menu]"); if (b) b.setAttribute("aria-expanded", "false"); }
    });
    if (!t) return;
    const a = t.dataset.acct;
    if (a === "open") openModal("login");
    else if (a === "verify") openModal("verify");
    else if (a === "out") auth.signOut();
    else if (a === "menu") {
      const m = t.parentNode.querySelector(".acct-menu");
      m.hidden = !m.hidden;
      t.setAttribute("aria-expanded", String(!m.hidden));
    }
  });

  /* ---------- حالة الدخول ---------- */
  auth.onAuthStateChanged(() => {
    ready = true;
    mount();
    listeners.slice().forEach(fn => { try { fn(auth.currentUser, isOk(auth.currentUser)); } catch (e) { console.error(e); } });
  });

  window.SPAuth = {
    isLoggedIn: () => isOk(auth.currentUser),
    user: () => auth.currentUser,
    getToken: () => (auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)),
    /* بترجّع Promise بيتحل أول ما العميل يخلّص تسجيل الدخول/التأكيد، وبيترفض لو قفل النافذة */
    requireLogin: () => new Promise((resolve, reject) => {
      const u = auth.currentUser;
      if (isOk(u)) return resolve(u);
      waiters.push({ resolve, reject });
      openModal(u ? "verify" : "login");
    }),
    open: v => openModal(v || "login"),
    signOut: () => auth.signOut(),
    onChange: fn => { listeners.push(fn); if (ready) fn(auth.currentUser, isOk(auth.currentUser)); },
    mount,
    /* السيرفر رفض الطلب لأسباب دخول: 401 جلسة منتهية، 403 إيميل غير مؤكَّد */
    handleServerAuthError: status => {
      if (status === 403 && auth.currentUser) openModal("verify");
      else openModal("login");
    },
  };
})();
