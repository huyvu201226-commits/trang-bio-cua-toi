/* =========================================================
   ĐÁNH GIÁ — khu quản trị (chỉ nạp ở edit.html, sau khi đăng nhập
   và sau khi trang bio đã tải xong). Cần reviews.js (window.RV).
========================================================= */
(() => {
  "use strict";
  if (window.RVAdmin) return;
  const RV = window.RV;
  const root = document.getElementById("rvAdmin");
  if (!RV || !root) return;
  const h = RV.h;

  const SEEN_KEY = "rv_admin_seen";
  const TS = () => firebase.firestore.FieldValue.serverTimestamp();
  const DEL = () => firebase.firestore.FieldValue.delete();

  /* Rules Firestore đầy đủ (hiển thị ở tab "Mô phỏng lỗi" để sao chép) */
  const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Dữ liệu trang bio, cấu hình đánh giá, biểu cảm: ai cũng đọc, chỉ chủ trang ghi
    match /site/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Bình luận: mã tài liệu = mã thiết bị => mỗi thiết bị chỉ tạo được 1 lần
    match /reviews/{id} {
      allow read: if true;
      allow create: if request.resource.data.keys().hasOnly(['name','stars','text','reply','ts'])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0 && request.resource.data.name.size() <= 40
        && request.resource.data.stars is int
        && request.resource.data.stars >= 1 && request.resource.data.stars <= 5
        && request.resource.data.text is string && request.resource.data.text.size() <= 500
        && request.resource.data.reply == ''
        && request.resource.data.ts == request.time
        && !exists(/databases/$(database)/documents/blocked/$(id));
      allow update, delete: if request.auth != null;
    }

    // Thiết bị bị chặn + lý do thông báo cho họ
    match /blocked/{id} {
      allow get: if true;
      allow list, update, delete: if request.auth != null;
      allow create: if request.auth != null
        || (request.resource.data.keys().hasOnly(['reason','word','ts','by'])
            && request.resource.data.reason is string && request.resource.data.reason.size() <= 400
            && request.resource.data.ts == request.time);
    }
  }
}`;

  const st = {
    cfg: RV.defaultConfig(), reviews: [], blocked: [], moods: {}, drafts: {},
    unsubs: [], started: false, built: false, firstReviews: true, firstConfig: true,
    seen: Number(localStorage.getItem(SEEN_KEY) || 0), sec: "comments",
    filter: "all", query: "", saveTimer: null, notify: false, rings: []
  };
  const ms = (ts) => (ts && ts.toMillis ? ts.toMillis() : ts instanceof Date ? ts.getTime() : 0);
  const $q = (sel) => root.querySelector(sel);
  const fmtNotice = (tpl, w) => String(tpl || "").replace(/\{word\}/g, w);

  /* ---------- Thông báo (toast / âm báo / thông báo trình duyệt) ---------- */
  let toastBox = null;
  function toast(text, kind, ms = 4200) {
    if (!toastBox) { toastBox = h("div", { class: "rva-toasts" }); document.body.appendChild(toastBox); }
    const t = h("div", { class: "rva-toast " + (kind || "") , text });
    toastBox.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, ms);
  }
  function beep() {
    try {
      const A = window.AudioContext || window.webkitAudioContext, c = new A();
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.14, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.42);
    } catch (e) {}
  }

  /* ---------- Lưu cấu hình (gộp thao tác, chờ 500ms) ---------- */
  function save() {
    const s = $q("#rvaSave"); if (s) s.textContent = "Đang lưu…";
    clearTimeout(st.saveTimer);
    st.saveTimer = setTimeout(() => {
      CONFIG_REF.set(st.cfg).then(() => { if (s) s.textContent = "Đã lưu ✓"; })
        .catch((e) => { console.error(e); if (s) s.textContent = "Lỗi khi lưu!"; toast("Không lưu được cấu hình: " + (e.code || e.message), "bad"); });
    }, 500);
  }
  const applyLook = () => { RV.applyGlass(root, st.cfg.glass); };

  /* =========================================================
     KHUNG GIAO DIỆN
  ========================================================= */
  const SECTIONS = [
    ["comments", "Bình luận"], ["look", "Giao diện"], ["moods", "Biểu cảm theo sao"],
    ["rules", "Luật & chặn"], ["sim", "Mô phỏng lỗi"]
  ];
  function build() {
    if (st.built) return; st.built = true;
    root.innerHTML = "";
    const nav = h("nav", { class: "rva-nav", role: "tablist" },
      SECTIONS.map(([k, label]) => h("button", { type: "button", class: "rva-nav-btn" + (k === st.sec ? " on" : ""), "data-sec": k, role: "tab", text: label, onclick: () => showSec(k) })),
      h("span", { class: "rva-grow" }),
      h("label", { class: "rva-notify", title: "Nhận thông báo của trình duyệt khi có đánh giá mới" },
        h("input", { type: "checkbox", id: "rvaNotify", onchange: (e) => askNotify(e.target.checked) }), " Thông báo trình duyệt"),
      h("span", { class: "rva-save", id: "rvaSave" }));
    const body = h("div", { class: "rva-body" },
      h("section", { "data-body": "comments" }, buildComments()),
      h("section", { "data-body": "look", hidden: true }, buildLook()),
      h("section", { "data-body": "moods", hidden: true }, buildMoods()),
      h("section", { "data-body": "rules", hidden: true }, buildRules()),
      h("section", { "data-body": "sim", hidden: true }, buildSim()));
    root.append(nav, body);
    applyLook();
  }
  function showSec(k) {
    st.sec = k;
    root.querySelectorAll(".rva-nav-btn").forEach((b) => b.classList.toggle("on", b.dataset.sec === k));
    root.querySelectorAll("[data-body]").forEach((s) => { s.hidden = s.dataset.body !== k; });
    if (k === "comments") markSeen();
    if (k === "moods") loadMoods();
  }
  function askNotify(on) {
    st.notify = on;
    if (on && "Notification" in window && Notification.permission === "default") Notification.requestPermission().then((p) => { if (p !== "granted") { st.notify = false; $q("#rvaNotify").checked = false; toast("Trình duyệt đã từ chối thông báo.", "bad"); } });
    if (on && !("Notification" in window)) { st.notify = false; $q("#rvaNotify").checked = false; toast("Trình duyệt này không hỗ trợ thông báo.", "bad"); }
  }

  /* =========================================================
     1) BÌNH LUẬN
  ========================================================= */
  function buildComments() {
    return h("div", { class: "rva-comments" },
      h("div", { class: "rva-card rva-stats", id: "rvaStats" }),
      h("div", { class: "rva-tools" },
        h("select", { id: "rvaFilter", onchange: (e) => { st.filter = e.target.value; renderComments(); } },
          [["all", "Tất cả"], ["new", "Mới (chưa xem)"], ["noreply", "Chưa trả lời"], ["5", "5 sao"], ["low", "1–2 sao"]].map(([v, t]) => h("option", { value: v, text: t }))),
        h("input", { type: "search", id: "rvaSearch", placeholder: "Tìm theo tên / nội dung…", oninput: (e) => { st.query = e.target.value; renderComments(); } }),
        h("button", { type: "button", class: "tbtn small", text: "Đánh dấu đã xem", onclick: () => { markSeen(true); renderComments(); } })),
      h("div", { class: "rva-list", id: "rvaList" }, h("p", { class: "rva-empty", text: "Đang tải bình luận…" })));
  }
  function renderStats() {
    const box = $q("#rvaStats"); if (!box) return;
    const s = RV.calcStats(st.reviews);
    box.innerHTML = "";
    const bars = [5, 4, 3, 2, 1].map((n) => h("div", { class: "rva-bar" },
      h("span", { text: n + "★" }), h("i", null, h("b", { style: `width:${s.count ? (s.dist[n] / s.count) * 100 : 0}%` })), h("span", { text: String(s.dist[n]) })));
    box.append(h("div", { class: "rva-avg" }, h("b", { text: s.count ? s.avg.toFixed(1) : "–" }), RV.starsAvg(s.avg), h("small", { text: s.count + " đánh giá" })), h("div", { class: "rva-bars" }, bars));
    st.rings.forEach((r) => r.setScore(s.avg, s.count));
  }
  function visible() {
    const q = st.query.trim().toLowerCase();
    return st.reviews.filter((r) => {
      if (st.filter === "new" && !(ms(r.ts) > st.seen)) return false;
      if (st.filter === "noreply" && r.reply) return false;
      if (st.filter === "5" && r.stars !== 5) return false;
      if (st.filter === "low" && r.stars > 2) return false;
      if (q && !((r.name || "") + " " + (r.text || "")).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function renderComments() {
    renderStats();
    const box = $q("#rvaList"); if (!box) return;
    const list = visible();
    box.innerHTML = "";
    if (!list.length) { box.appendChild(h("p", { class: "rva-empty", text: st.reviews.length ? "Không có bình luận khớp bộ lọc." : "Chưa có bình luận nào." })); return; }
    list.forEach((r) => box.appendChild(commentCard(r)));
  }
  function commentCard(r) {
    const isNew = ms(r.ts) > st.seen;
    const ta = h("textarea", { rows: 2, maxlength: 400, placeholder: "Trả lời nhanh… (Ctrl+Enter để gửi)",
      oninput: (e) => { st.drafts[r.id] = e.target.value; },
      onkeydown: (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply(r, ta.value); } });
    ta.value = st.drafts[r.id] != null ? st.drafts[r.id] : r.reply || "";
    const chips = (st.cfg.quickReplies || []).map((q) => h("button", { type: "button", class: "rv-chip", text: q, onclick: () => { ta.value = q; st.drafts[r.id] = q; ta.focus(); } }));
    return h("article", { class: "rva-item" + (isNew ? " is-new" : "") },
      h("header", null,
        h("span", { class: "rv-av", style: `--h:${RV.hue(r.name)}`, text: (r.name || "?").charAt(0).toUpperCase() }),
        h("div", { class: "rva-who" }, h("b", { text: r.name || "Ẩn danh" }), RV.starsRow(r.stars)),
        isNew ? h("em", { class: "rva-new", text: "Mới" }) : null,
        h("time", { text: RV.ago(r.ts) + " · #" + r.id.slice(1, 7) })),
      r.text ? h("p", { class: "rva-text", text: r.text }) : h("p", { class: "rva-text muted", text: "(không có bình luận kèm theo)" }),
      chips.length ? h("div", { class: "rv-slogans" }, chips) : null,
      ta,
      h("div", { class: "rva-actions" },
        h("button", { type: "button", class: "tbtn small primary", text: r.reply ? "Cập nhật trả lời" : "Gửi trả lời", onclick: () => sendReply(r, ta.value) }),
        r.reply ? h("button", { type: "button", class: "tbtn small ghost", text: "Gỡ trả lời", onclick: () => { ta.value = ""; delete st.drafts[r.id]; sendReply(r, ""); } }) : null,
        h("span", { class: "rva-grow" }),
        h("button", { type: "button", class: "tbtn small danger", text: "Xoá", onclick: () => removeReview(r, false) }),
        h("button", { type: "button", class: "tbtn small danger", text: "Xoá & chặn thiết bị", onclick: () => removeReview(r, true) })));
  }
  function sendReply(r, text) {
    text = text.trim();
    const patch = text ? { reply: text.slice(0, 400), replyTs: TS() } : { reply: "", replyTs: DEL() };
    REVIEWS_REF.doc(r.id).update(patch).then(() => { delete st.drafts[r.id]; toast(text ? "Đã gửi trả lời — trang chính cập nhật ngay." : "Đã gỡ trả lời.", "ok"); })
      .catch((e) => toast("Không gửi được: " + (e.code || e.message), "bad"));
  }
  async function removeReview(r, block) {
    let reason = "";
    if (block) {
      reason = prompt("Lý do sẽ hiện cho người dùng (thiết bị này sẽ bị chặn bình luận lại):", fmtNotice(st.cfg.rules.notice, "nội dung không phù hợp"));
      if (reason === null) return;
    } else if (!confirm("Xoá bình luận của “" + (r.name || "Ẩn danh") + "”? (Thiết bị đó vẫn có thể đánh giá lại)")) return;
    try {
      await punish(r, block, reason, "admin", "");
      toast(block ? "Đã xoá và chặn thiết bị." : "Đã xoá bình luận.", "ok");
    } catch (e) { toast("Không xoá được: " + (e.code || e.message), "bad"); }
  }
  async function punish(r, block, reason, by, word) {
    const batch = db.batch();
    batch.delete(REVIEWS_REF.doc(r.id));
    if (block) batch.set(BLOCKED_REF.doc(r.id), { reason: String(reason).slice(0, 400), word: String(word || "").slice(0, 60), ts: TS(), by });
    await batch.commit();
  }

  /* ---------- Thông báo đánh giá mới + tự động duyệt theo luật (không cần admin bấm duyệt) ---------- */
  function unreadCount() { return st.reviews.filter((r) => ms(r.ts) > st.seen).length; }
  function updateBadge() {
    const b = document.getElementById("rvTabBadge"); if (!b) return;
    const n = document.body.classList.contains("tab-reviews") && st.sec === "comments" ? 0 : unreadCount();
    b.textContent = n > 99 ? "99+" : String(n); b.hidden = n === 0;
  }
  function markSeen(force) {
    const top = st.reviews.reduce((m, r) => Math.max(m, ms(r.ts)), 0);
    if (!top && !force) return;
    st.seen = Math.max(st.seen, top || Date.now());
    try { localStorage.setItem(SEEN_KEY, String(st.seen)); } catch (e) {}
    updateBadge();
  }
  async function autoModerate(r) {
    const rules = st.cfg.rules;
    if (!rules.enabled) return false;
    const w = RV.findBanned((r.name || "") + " " + (r.text || ""), rules.words);
    if (!w) return false;
    try {
      await punish(r, true, fmtNotice(rules.notice, w), "auto", w);
      toast(`Tự xoá bình luận của “${r.name}” (chứa “${w}”) và chặn thiết bị.`, "warn", 6000);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  function onReviewsSnapshot(snap) {
    st.reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => !r.id.startsWith("__probe"));
    const fresh = [];
    if (st.firstReviews) st.reviews.forEach((r) => { if (ms(r.ts) > st.seen) fresh.push(r); });
    else snap.docChanges().forEach((c) => { if (c.type === "added" && !c.doc.id.startsWith("__probe") && !c.doc.metadata.hasPendingWrites) fresh.push({ id: c.doc.id, ...c.doc.data() }); });
    const first = st.firstReviews; st.firstReviews = false;
    renderComments(); updateBadge();
    fresh.forEach(async (r) => {
      if (await autoModerate(r)) return;
      if (first && fresh.length > 3) return;                 // nạp lần đầu: chỉ báo bằng huy hiệu, tránh bão thông báo
      toast(`⭐ ${r.name} vừa đánh giá ${r.stars}★${r.text ? ": " + r.text.slice(0, 80) : ""}`, "ok", 6000); beep();
      if (st.notify && "Notification" in window && Notification.permission === "granted" && document.hidden) {
        try { new Notification("Đánh giá mới: " + r.stars + "★ từ " + r.name, { body: r.text || "" }); } catch (e) {}
      }
    });
    if (document.body.classList.contains("tab-reviews") && st.sec === "comments") markSeen();
  }

  /* =========================================================
     2) GIAO DIỆN (kính, avatar, slogan, mẫu trả lời)
  ========================================================= */
  function slider(label, key, min, max, step, unit) {
    const out = h("output", { text: st.cfg.glass[key] + (unit || "") });
    const inp = h("input", { type: "range", min, max, step, value: st.cfg.glass[key], "data-g": key,
      oninput: (e) => { st.cfg.glass[key] = Number(e.target.value); out.textContent = e.target.value + (unit || ""); applyLook(); save(); } });
    return h("label", { class: "rva-row" }, h("span", { text: label }), inp, out);
  }
  function listEditor(title, hint, key, placeholder) {
    const wrap = h("div", { class: "rva-card" }, h("h4", { text: title }), h("p", { class: "rva-hint", text: hint }));
    const chipBox = h("div", { class: "rva-chips" });
    const inp = h("input", { type: "text", placeholder, maxlength: 120 });
    const draw = () => {
      chipBox.innerHTML = "";
      (st.cfg[key] || []).forEach((t, i) => chipBox.appendChild(h("span", { class: "rva-chip" }, t, h("button", { type: "button", "aria-label": "Xoá", text: "✕", onclick: () => { st.cfg[key].splice(i, 1); draw(); save(); } }))));
    };
    const add = () => { const v = inp.value.trim(); if (!v) return; (st.cfg[key] = st.cfg[key] || []).push(v); inp.value = ""; draw(); save(); };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
    wrap.append(chipBox, h("div", { class: "rva-row" }, inp, h("button", { type: "button", class: "tbtn small primary", text: "Thêm", onclick: add })));
    wrap.redraw = draw; draw(); return wrap;
  }
  function buildLook() {
    const ring = RV.buildRing(); st.rings.push(ring); st.ringLook = ring;
    ring.setAvatar(st.cfg.avatar); 
    const avatarInput = h("input", { type: "file", accept: "image/*", hidden: true, onchange: async (e) => {
      try { st.cfg.avatar = await RV.compressSquare(e.target.files[0], 256); ring.setAvatar(st.cfg.avatar); save(); toast("Đã đổi avatar trang đánh giá.", "ok"); }
      catch (err) { toast(err.message, "bad"); } e.target.value = ""; } });
    const title = h("input", { type: "text", maxlength: 60, "data-f": "title", oninput: (e) => { st.cfg.title = e.target.value; save(); } });
    const sub = h("input", { type: "text", maxlength: 100, "data-f": "subtitle", oninput: (e) => { st.cfg.subtitle = e.target.value; save(); } });
    const color = h("input", { type: "color", "data-g": "color", oninput: (e) => { st.cfg.glass.color = e.target.value; applyLook(); save(); } });

    /* Khu xem trước: nền màu chuyển động + 3 quả cầu kéo được → thấy ngay hiệu ứng kính làm méo nền */
    const orbs = [["#ff6f5e", 18, 22], ["#6c5ce0", 62, 14], ["#e8b94a", 40, 62]].map(([c, x, y]) =>
      h("i", { class: "rva-orb", style: `background:${c};left:${x}%;top:${y}%` }));
    const prev = h("div", { class: "rva-prev" }, orbs,
      h("div", { class: "rv-item glass liq", style: "position:relative;margin:0" },
        h("header", null, h("span", { class: "rv-av", style: "--h:200", text: "A" }), h("div", { class: "rv-who" }, h("b", { class: "rv-name", text: "Bình luận mẫu" }), RV.starsRow(5)), h("time", { text: "vừa xong" })),
        h("p", { class: "rv-text", text: "Kéo các quả cầu màu bên dưới khung kính để xem nền bị méo như thế nào." })));
    orbs.forEach((o) => {
      o.addEventListener("pointerdown", (e) => {
        e.preventDefault(); o.setPointerCapture(e.pointerId);
        const mv = (ev) => { const r = prev.getBoundingClientRect(); o.style.left = ((ev.clientX - r.left) / r.width) * 100 + "%"; o.style.top = ((ev.clientY - r.top) / r.height) * 100 + "%"; };
        const up = () => { o.removeEventListener("pointermove", mv); o.removeEventListener("pointerup", up); };
        o.addEventListener("pointermove", mv); o.addEventListener("pointerup", up);
      });
    });

    const slogans = listEditor("Slogan bấm nhanh", "Hiện thành các ô nhỏ phía trên ô bình luận thêm (giống nhãn nhanh của Shopee). Người dùng bấm để chèn vào bình luận.", "slogans", "VD: Giao hàng nhanh");
    const quick = listEditor("Mẫu trả lời nhanh", "Chỉ bạn thấy — bấm một mẫu ở tab Bình luận để điền sẵn câu trả lời.", "quickReplies", "VD: Cảm ơn bạn đã ủng hộ!");
    st.lists = [slogans, quick];
    st.lookFields = { title, sub, color };

    return h("div", { class: "rva-grid" },
      h("div", { class: "rva-card" }, h("h4", { text: "Avatar & tiêu đề trang đánh giá" }),
        h("div", { class: "rva-ring-host" }, ring.el),
        h("div", { class: "rva-row" }, h("button", { type: "button", class: "tbtn small", text: "Tải avatar khác từ máy", onclick: () => avatarInput.click() }),
          h("button", { type: "button", class: "tbtn small ghost", text: "Dùng avatar trang bio", onclick: () => { st.cfg.avatar = null; ring.setAvatar(window.__bioState && window.__bioState.avatar); save(); } }), avatarInput),
        h("p", { class: "rva-hint", text: "Vòng vàng quanh avatar và con số ★ tự tính theo điểm trung bình thật của người dùng." }),
        h("label", { class: "rva-row" }, h("span", { text: "Tiêu đề" }), title),
        h("label", { class: "rva-row" }, h("span", { text: "Dòng phụ" }), sub)),
      h("div", { class: "rva-card" }, h("h4", { text: "Khung kính cho tất cả bình luận" }),
        h("label", { class: "rva-row" }, h("span", { text: "Màu kính" }), color),
        slider("Độ trong", "alpha", 0, 0.7, 0.01), slider("Độ mờ nền", "blur", 0, 36, 1, "px"),
        slider("Bo góc", "radius", 0, 40, 1, "px"), slider("Độ méo nền", "distort", 0, 60, 1),
        h("p", { class: "rva-hint", text: "Độ méo nền (hiệu ứng thuỷ tinh) chỉ hiện trên trình duyệt nhân Chrome/Edge/Android. Kéo về 0 để tắt nếu máy yếu bị giật." }),
        prev),
      slogans, quick);
  }
  function fillLook() {
    const f = st.lookFields; if (!f) return;
    f.title.value = st.cfg.title || ""; f.sub.value = st.cfg.subtitle || ""; f.color.value = st.cfg.glass.color || "#ffffff";
    root.querySelectorAll("input[data-g]").forEach((i) => { if (i.type === "range") { i.value = st.cfg.glass[i.dataset.g]; if (i.nextElementSibling) i.nextElementSibling.textContent = i.value + (i.dataset.g === "blur" || i.dataset.g === "radius" ? "px" : ""); } });
    st.lists.forEach((l) => l.redraw());
    const av = st.cfg.avatar || null;
    st.ringLook.setAvatar(av); if (st.ringMood) st.ringMood.setAvatar(av);
    if (st.moodDur) { st.moodDur.value = st.cfg.moodSeconds; st.moodDurOut.textContent = st.cfg.moodSeconds + " giây"; }
    if (st.rulesFields) fillRules();
  }

  /* =========================================================
     3) BIỂU CẢM THEO SAO
  ========================================================= */
  function buildMoods() {
    const ring = RV.buildRing(); st.rings.push(ring); st.ringMood = ring;
    ring.setAvatar(st.cfg.avatar);
    st.moodDurOut = h("output", { text: st.cfg.moodSeconds + " giây" });
    st.moodDur = h("input", { type: "range", min: 1, max: 10, step: 1, value: st.cfg.moodSeconds, oninput: (e) => { st.cfg.moodSeconds = Number(e.target.value); st.moodDurOut.textContent = e.target.value + " giây"; save(); } });
    const rows = [1, 2, 3, 4, 5].map((n) => moodRow(n));
    return h("div", { class: "rva-moods" },
      h("div", { class: "rva-card" }, h("h4", { text: "Biểu cảm khi người dùng vừa đánh giá xong" }),
        h("p", { class: "rva-hint", text: "Mỗi mức sao có thể gắn một ảnh / ảnh động (GIF) / video riêng. Ảnh được tự cắt vuông giữa, mọi thứ hiển thị trong khung tròn trong suốt — 4 góc của ảnh hoặc video bị cắt bỏ. Ảnh động & video tải từ máy tối đa 640KB; nặng hơn hãy dán link." }),
        h("div", { class: "rva-ring-host" }, ring.el),
        h("label", { class: "rva-row" }, h("span", { text: "Hiện trong" }), st.moodDur, st.moodDurOut)),
      rows);
  }
  function moodRow(n) {
    const thumb = h("div", { class: "rva-mood-thumb", id: "rvaMoodThumb" + n, text: "Chưa có" });
    const file = h("input", { type: "file", accept: "image/*,video/*", hidden: true, onchange: async (e) => {
      try { const m = await RV.fileToMedia(e.target.files[0]); await saveMood(n, m); } catch (err) { toast(err.message, "bad", 7000); } e.target.value = ""; } });
    const url = h("input", { type: "url", placeholder: "…hoặc dán link ảnh / GIF / mp4" });
    return h("div", { class: "rva-card rva-mood-row" },
      h("div", { class: "rva-mood-label" }, h("b", { text: n + " sao" }), RV.starsRow(n), h("small", { text: RV.LABELS[n] })),
      thumb,
      h("div", { class: "rva-mood-ctrl" },
        h("div", { class: "rva-row" },
          h("button", { type: "button", class: "tbtn small", text: "Tải ảnh/video từ máy", onclick: () => file.click() }), file,
          h("button", { type: "button", class: "tbtn small", text: "Xem thử", onclick: () => { if (st.moods[n]) st.ringMood.playMood(st.moods[n], st.cfg.moodSeconds); else toast("Mức này chưa có biểu cảm.", "warn"); } }),
          h("button", { type: "button", class: "tbtn small ghost", text: "Xoá", onclick: () => saveMood(n, null) })),
        h("div", { class: "rva-row" }, url, h("button", { type: "button", class: "tbtn small", text: "Dùng link", onclick: async () => { const v = url.value.trim(); if (!/^https?:\/\//i.test(v)) { toast("Link phải bắt đầu bằng http(s)://", "bad"); return; } await saveMood(n, RV.mediaFromUrl(v)); url.value = ""; } }))));
  }
  function drawMoodThumb(n) {
    const t = document.getElementById("rvaMoodThumb" + n); if (!t) return;
    t.innerHTML = ""; const m = st.moods[n];
    if (!m) { t.textContent = "Chưa có"; t.classList.remove("has"); return; }
    t.classList.add("has");
    t.appendChild(m.type === "video" ? h("video", { src: m.src, muted: true, loop: true, autoplay: true, playsinline: true }) : h("img", { src: m.src, alt: "" }));
    const v = t.querySelector("video"); if (v) { v.muted = true; v.play && v.play().catch(() => {}); }
  }
  async function saveMood(n, m) {
    try {
      if (!m) { await moodRef(n).delete(); delete st.moods[n]; toast("Đã xoá biểu cảm " + n + " sao.", "ok"); }
      else {
        if (m.src.length > 900000) throw new Error("Tệp quá nặng cho một tài liệu Firebase (≈1MB). Hãy nén nhỏ hơn hoặc dán link.");
        await moodRef(n).set({ type: m.type, src: m.src, ts: TS() });
        st.moods[n] = m; toast("Đã lưu biểu cảm " + n + " sao.", "ok");
        st.ringMood.playMood(m, Math.min(st.cfg.moodSeconds, 3));
      }
      drawMoodThumb(n);
    } catch (e) { toast("Không lưu được: " + (e.message || e.code), "bad", 7000); }
  }
  let moodsLoaded = false;
  function loadMoods() {
    if (moodsLoaded) return; moodsLoaded = true;
    [1, 2, 3, 4, 5].forEach((n) => moodRef(n).get().then((s) => { if (s.exists) { st.moods[n] = s.data(); drawMoodThumb(n); } }).catch(() => { moodsLoaded = false; }));
  }

  /* =========================================================
     4) LUẬT LỌC & THIẾT BỊ BỊ CHẶN
  ========================================================= */
  function buildRules() {
    const enabled = h("input", { type: "checkbox", id: "rvaRuleOn", onchange: (e) => { st.cfg.rules.enabled = e.target.checked; save(); } });
    const wordsTa = h("textarea", { rows: 6, id: "rvaWords", placeholder: "Mỗi dòng một từ / cụm từ tiêu cực, VD:\nlừa đảo\nđồ rác", oninput: (e) => {
      st.cfg.rules.words = Array.from(new Set(e.target.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean))); save(); } });
    const noticeTa = h("textarea", { rows: 3, id: "rvaNotice", oninput: (e) => { st.cfg.rules.notice = e.target.value; save(); } });
    const testIn = h("input", { type: "text", placeholder: "Gõ thử một câu bình luận…" });
    const testOut = h("p", { class: "rva-hint" });
    testIn.addEventListener("input", () => {
      const w = testIn.value.trim() ? RV.findBanned(testIn.value, st.cfg.rules.words) : null;
      testOut.className = "rva-hint " + (w ? "bad" : ""); testOut.textContent = testIn.value.trim() ? (w ? `Sẽ bị gỡ — khớp “${w}”.` : "Hợp lệ — sẽ được đăng.") : "";
    });
    st.rulesFields = { enabled, wordsTa, noticeTa };
    st.blockedBox = h("div", { class: "rva-blocked-list" });
    return h("div", { class: "rva-grid" },
      h("div", { class: "rva-card" }, h("h4", { text: "Luật duyệt tự động" }),
        h("label", { class: "rva-row rva-check" }, enabled, h("span", { text: "Bật: bình luận chứa từ cấm sẽ bị gỡ, thiết bị bị chặn và được báo lý do" })),
        h("label", { class: "rva-col" }, h("span", { text: "Từ ngữ tiêu cực (không phân biệt hoa/thường, có dấu hay không dấu; bắt cả kiểu viết tách ký tự)" }), wordsTa),
        h("label", { class: "rva-col" }, h("span", { text: "Lý do hiện cho người dùng — dùng {word} để chèn từ vi phạm" }), noticeTa),
        h("div", { class: "rva-row" }, testIn), testOut,
        h("div", { class: "rva-row" }, h("button", { type: "button", class: "tbtn small danger", text: "Quét lại tất cả bình luận theo luật", onclick: rescan })),
        h("p", { class: "rva-hint", text: "Người dùng gửi bình luận → trang kiểm tra luật ngay (kể cả khi bạn không mở trang sửa). Khi bạn đang mở trang sửa, bình luận lọt qua cũng được quét và xoá tự động." })),
      h("div", { class: "rva-card" }, h("h4", { text: "Thiết bị đang bị chặn" }), st.blockedBox));
  }
  function fillRules() {
    const { enabled, wordsTa, noticeTa } = st.rulesFields;
    enabled.checked = !!st.cfg.rules.enabled;
    if (document.activeElement !== wordsTa) wordsTa.value = (st.cfg.rules.words || []).join("\n");
    if (document.activeElement !== noticeTa) noticeTa.value = st.cfg.rules.notice || "";
  }
  async function rescan() {
    const hits = st.reviews.map((r) => [r, RV.findBanned((r.name || "") + " " + (r.text || ""), st.cfg.rules.words)]).filter((x) => x[1]);
    if (!hits.length) { toast("Không có bình luận nào vi phạm luật hiện tại.", "ok"); return; }
    if (!confirm(`Có ${hits.length} bình luận vi phạm: sẽ xoá và chặn thiết bị của họ. Tiếp tục?`)) return;
    for (const [r, w] of hits) await punish(r, true, fmtNotice(st.cfg.rules.notice, w), "auto", w).catch((e) => toast("Lỗi: " + (e.code || e.message), "bad"));
    toast(`Đã xử lý ${hits.length} bình luận.`, "ok");
  }
  function renderBlocked() {
    const box = st.blockedBox; if (!box) return; box.innerHTML = "";
    if (!st.blocked.length) { box.appendChild(h("p", { class: "rva-empty", text: "Chưa chặn thiết bị nào." })); return; }
    st.blocked.forEach((b) => box.appendChild(h("div", { class: "rva-blocked" },
      h("div", null, h("b", { text: "Thiết bị #" + b.id.slice(1, 7) }), h("small", { text: (b.by === "auto" ? " · tự động" : " · thủ công") + (b.word ? " · “" + b.word + "”" : "") + " · " + RV.ago(b.ts) }), h("p", { text: b.reason || "" })),
      h("button", { type: "button", class: "tbtn small", text: "Bỏ chặn", onclick: () => BLOCKED_REF.doc(b.id).delete().then(() => toast("Đã bỏ chặn thiết bị.", "ok")).catch((e) => toast("Lỗi: " + (e.code || e.message), "bad")) }))));
  }

  /* =========================================================
     5) MÔ PHỎNG LỖI & KHẮC PHỤC (+ kiểm tra hệ thống thật)
  ========================================================= */
  function buildSim() {
    const result = h("div", { class: "rva-sim-result", id: "rvaSimResult" }, h("p", { class: "rva-empty", text: "Chọn một tình huống ở trên để xem người dùng sẽ thấy gì và cách khắc phục." }));
    const goto = (sec) => ({ label: "Mở tab " + SECTIONS.find((s) => s[0] === sec)[1], fn: () => showSec(sec) });
    const scenarios = [
      { t: "Bình luận chứa từ cấm", run: () => {
          const w = (st.cfg.rules.words || [])[0] || "lừa đảo";
          return { ui: [h("b", { text: "Thông báo từ chủ trang" }), h("p", { text: fmtNotice(st.cfg.rules.notice, w) })],
            cause: `Nội dung chứa “${w}”, khớp luật. Bình luận không được đăng, thiết bị bị chặn bình luận lại.`,
            fix: [{ text: "Nếu từ này bị bắt nhầm: xoá nó khỏi danh sách luật.", action: goto("rules") }, { text: "Sau đó bấm “Bỏ chặn” ở danh sách thiết bị bị chặn để người dùng bình luận lại." }] }; } },
      { t: "Thiết bị đã bình luận rồi", run: () => ({ ui: [h("p", { text: "Thiết bị này đã gửi đánh giá rồi (mỗi thiết bị chỉ được 1 lần) hoặc đã bị chặn." })],
          cause: "Mã thiết bị (lưu trong trình duyệt) đã có một bình luận — Firestore từ chối ghi đè.",
          fix: [{ text: "Muốn cho họ đánh giá lại: ở tab Bình luận, bấm “Xoá” (không chặn) bình luận cũ.", action: goto("comments") }, { text: "Lưu ý: xoá dữ liệu trình duyệt hoặc dùng chế độ ẩn danh sẽ tạo mã thiết bị mới." }] }) },
      { t: "Thiết bị bị chặn nhầm", run: () => ({ ui: [h("b", { text: "Thiết bị này không thể bình luận" }), h("p", { text: fmtNotice(st.cfg.rules.notice, "…") })],
          cause: "Có bản ghi trong danh sách chặn của thiết bị đó.",
          fix: [{ text: "Vào danh sách “Thiết bị đang bị chặn” và bấm Bỏ chặn.", action: goto("rules") }] }) },
      { t: "Mất mạng khi gửi", run: () => ({ ui: [h("p", { text: "Mất kết nối mạng. Nội dung của bạn vẫn còn đây, hãy thử gửi lại." })],
          cause: "Điện thoại mất sóng / Wi-Fi chập chờn. Form giữ nguyên tên, sao, nội dung.",
          fix: [{ text: "Không cần làm gì — người dùng bấm gửi lại khi có mạng." }] }) },
      { t: "Firebase báo “permission-denied”", run: () => ({ ui: [h("p", { text: "Chưa gửi được, vui lòng thử lại sau ít phút." })],
          cause: "Rules Firestore chưa được cập nhật cho bộ đánh giá (chỉ có rule cũ cho site/data) nên khách bị từ chối.",
          fix: [{ text: "Vào Firebase → Firestore → Rules, thay toàn bộ bằng rules mới rồi Publish.", action: { label: "Sao chép rules mới", fn: () => navigator.clipboard.writeText(FIRESTORE_RULES).then(() => toast("Đã sao chép rules.", "ok")).catch(() => toast("Không sao chép được, hãy mở README.md.", "bad")) } }, { text: "Bấm “Kiểm tra hệ thống thật” để xác nhận." }] }) },
      { t: "Ảnh / video biểu cảm quá nặng", run: () => ({ ui: [h("p", { text: `Tệp nặng 2400KB, tối đa ${Math.round(RV.MAX_MEDIA_BYTES / 1024)}KB. Hãy cắt ngắn (≤3 giây), giảm độ phân giải, hoặc dán link thay vì tải từ máy.` })],
          cause: "Firestore giới hạn ~1MB mỗi tài liệu; ảnh động/video được lưu trực tiếp nên phải nhẹ.",
          fix: [{ text: "Cắt video ≤3 giây, 256–360px, bỏ âm thanh rồi tải lại; hoặc đưa tệp lên GitHub của bạn và dán link.", action: goto("moods") }] }) },
      { t: "Nền video / hiệu ứng méo bị giật trên máy yếu", run: () => ({ ui: [h("p", { text: "Trang cuộn không mượt khi có nhiều bình luận kính." })],
          cause: "Hiệu ứng thuỷ tinh làm méo nền tốn GPU, nhất là khi nền là video.",
          fix: [{ text: "Giảm “Độ méo nền” về 0 hoặc giảm “Độ mờ nền”; hoặc dùng ảnh nền thay video.", action: goto("look") }] }) }
    ];
    const btns = h("div", { class: "rva-sim-btns" }, scenarios.map((s) => h("button", { type: "button", class: "tbtn small", text: s.t, onclick: () => showScenario(s) })));
    function showScenario(s) {
      const r = s.run(); const box = $q("#rvaSimResult"); box.innerHTML = "";
      box.append(
        h("div", { class: "rva-sim-col" }, h("h5", { text: "Người dùng sẽ thấy" }), h("div", { class: "rv-modal-box glass static" }, r.ui)),
        h("div", { class: "rva-sim-col" }, h("h5", { text: "Nguyên nhân" }), h("p", { text: r.cause }),
          h("h5", { text: "Cách khắc phục" }),
          h("ol", null, r.fix.map((f) => h("li", null, f.text, f.action ? h("button", { type: "button", class: "tbtn small", text: f.action.label, onclick: f.action.fn }) : null)))));
    }
    const checkOut = h("ul", { class: "rva-checks", id: "rvaChecks" });
    return h("div", { class: "rva-grid" },
      h("div", { class: "rva-card" }, h("h4", { text: "Mô phỏng các lỗi hay gặp" }), btns, result),
      h("div", { class: "rva-card" }, h("h4", { text: "Kiểm tra hệ thống thật" }),
        h("p", { class: "rva-hint", text: "Chạy thử bằng một “khách” ẩn danh (không đăng nhập) để biết Rules Firestore đã đúng chưa: khách đọc được, đăng được 1 lần, không sửa / xoá được." }),
        h("button", { type: "button", class: "tbtn primary", id: "rvaRun", text: "Chạy kiểm tra", onclick: runChecks }), checkOut,
        h("details", { class: "rva-rules" }, h("summary", { text: "Xem Rules Firestore cần dùng" }), h("pre", { text: FIRESTORE_RULES }),
          h("button", { type: "button", class: "tbtn small", text: "Sao chép", onclick: () => navigator.clipboard.writeText(FIRESTORE_RULES).then(() => toast("Đã sao chép rules.", "ok")) }))));
  }
  async function runChecks() {
    const out = $q("#rvaChecks"), btn = $q("#rvaRun"); out.innerHTML = ""; btn.disabled = true;
    const line = (ok, text, hint) => out.appendChild(h("li", { class: ok ? "ok" : "bad" }, h("b", { text: (ok ? "✔ " : "✘ ") + text }), !ok && hint ? h("small", { text: hint }) : null));
    let probe;
    try { probe = firebase.app("probe"); } catch (e) { probe = firebase.initializeApp(firebaseConfig, "probe"); }
    const pdb = probe.firestore(), id = "__probe" + Math.random().toString(36).slice(2, 8);
    const attempt = async (fn) => { try { await fn(); return true; } catch (e) { return e.code || String(e); } };
    const RULE_HINT = "Rules Firestore chưa đúng — mở “Xem Rules Firestore cần dùng”, dán vào Firebase rồi Publish.";
    try {
      line((await attempt(() => CONFIG_REF.get())) === true, "Chủ trang đọc được cấu hình", "Kiểm tra kết nối mạng / cấu hình firebase-config.js.");
      line((await attempt(() => pdb.collection("reviews").limit(1).get())) === true, "Khách đọc được danh sách bình luận", RULE_HINT);
      const made = await attempt(() => pdb.collection("reviews").doc(id).set({ name: "Kiểm tra", stars: 5, text: "", reply: "", ts: firebase.firestore.FieldValue.serverTimestamp() }));
      line(made === true, "Khách tạo được bình luận hợp lệ", RULE_HINT + " (lỗi: " + made + ")");
      if (made === true) {
        line((await attempt(() => pdb.collection("reviews").doc(id).set({ name: "Ghi đè", stars: 1, text: "", reply: "", ts: firebase.firestore.FieldValue.serverTimestamp() }))) !== true, "Khách KHÔNG ghi đè được (mỗi thiết bị 1 lần)", "Rules đang cho khách sửa bình luận — dán lại rules mới.");
        line((await attempt(() => pdb.collection("reviews").doc(id).delete())) !== true, "Khách KHÔNG xoá được bình luận", "Rules đang cho khách xoá — dán lại rules mới.");
        line((await attempt(() => pdb.collection("reviews").doc(id + "x").set({ name: "x", stars: 9, text: "", reply: "", ts: firebase.firestore.FieldValue.serverTimestamp() }))) !== true, "Khách KHÔNG gửi được số sao sai (9★)", "Rules chưa kiểm tra dữ liệu — dán lại rules mới.");
        await REVIEWS_REF.doc(id).delete().catch(() => {});
      }
      line((await attempt(() => pdb.collection("blocked").doc("__probe").get())) === true, "Khách kiểm tra được thiết bị của mình có bị chặn không", RULE_HINT);
      line((await attempt(() => pdb.collection("blocked").limit(1).get())) !== true, "Khách KHÔNG xem được danh sách thiết bị bị chặn", "Rules đang để lộ danh sách chặn — dán lại rules mới.");
      line((await attempt(() => BLOCKED_REF.limit(1).get())) === true, "Chủ trang xem được danh sách thiết bị bị chặn", "Chưa đăng nhập hoặc rules thiếu quyền cho chủ trang.");
    } finally { btn.disabled = false; }
  }

  /* =========================================================
     KHỞI ĐỘNG / DỪNG
  ========================================================= */
  function start() {
    if (st.started) return; st.started = true; st.firstReviews = true; st.firstConfig = true;
    build();
    st.unsubs.push(CONFIG_REF.onSnapshot((s) => {
      if (s.metadata.hasPendingWrites) return;             // bỏ qua phản hồi từ chính thao tác lưu của mình
      st.cfg = RV.mergeConfig(s.exists ? s.data() : {});
      applyLook(); fillLook(); fillRules();
    }, (e) => toast("Không đọc được cấu hình đánh giá: " + (e.code || e.message), "bad")));
    st.unsubs.push(REVIEWS_REF.orderBy("ts", "desc").limit(500).onSnapshot(onReviewsSnapshot,
      (e) => toast("Không đọc được bình luận: " + (e.code || e.message) + " — xem tab Mô phỏng lỗi.", "bad", 8000)));
    st.unsubs.push(BLOCKED_REF.onSnapshot((s) => { st.blocked = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.ts) - ms(a.ts)); renderBlocked(); }, () => {}));
    fillRules(); fillLook();
  }
  function stop() {
    st.unsubs.forEach((u) => { try { u(); } catch (e) {} }); st.unsubs = []; st.started = false;
  }
  window.RVAdmin = {
    start, stop,
    onShow() { build(); if (st.sec === "comments") markSeen(); else if (st.sec === "moods") loadMoods(); updateBadge(); }
  };
})();
