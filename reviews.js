/* =========================================================
   ĐÁNH GIÁ — lõi dùng chung + giao diện người xem
   • Chỉ được tải SAU KHI trang bio đã hiển thị xong (xem view.js / edit.js)
   • Trang sửa (edit.html) cũng nạp tệp này để dùng lại các hàm chung (window.RV),
     phần giao diện người xem chỉ tự chạy khi <body class="mode-preview">.
========================================================= */
(() => {
  "use strict";
  if (window.RV) return;
  const NS = (window.RV = {});

  const DEVICE_KEY  = "rv_device";
  const VISITED_KEY = "rv_visited";
  const NOTICE_KEY  = "rv_notice_seen";
  const HASH        = "#danh-gia";
  const MAX_NAME = 40, MAX_TEXT = 500;
  NS.REVIEW_LIMIT = 100;                 // số bình luận tải về tối đa (tiết kiệm lượt đọc Firebase)
  NS.MAX_MEDIA_BYTES = 640 * 1024;       // ảnh động / video biểu cảm tối đa (Firestore giới hạn ~1MB / tài liệu)
  NS.LABELS = ["", "Rất tệ", "Chưa tốt", "Bình thường", "Hài lòng", "Tuyệt vời"];

  /* ---------- Tiện ích nhỏ ---------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, Number(v) || 0));

  NS.h = (tag, props, ...kids) => {
    const e = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else e.setAttribute(k, v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  };
  const h = NS.h;

  NS.hexA = (hex, a) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    const n = m ? parseInt(m[1], 16) : 0xffffff;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const luminance = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    const n = m ? parseInt(m[1], 16) : 0xffffff;
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };

  NS.ago = (ts) => {
    const d = ts && ts.toDate ? ts.toDate() : ts ? new Date(ts) : null;
    if (!d || isNaN(d)) return "vừa xong";
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return "vừa xong";
    if (s < 3600) return Math.floor(s / 60) + " phút trước";
    if (s < 86400) return Math.floor(s / 3600) + " giờ trước";
    if (s < 86400 * 7) return Math.floor(s / 86400) + " ngày trước";
    return d.toLocaleDateString("vi-VN");
  };

  NS.hue = (str) => { let x = 0; for (const c of String(str || "?")) x = (x * 31 + c.charCodeAt(0)) % 360; return x; };

  /* ---------- Mã thiết bị: lưu ở localStorage + cookie (1 thiết bị = 1 lần bình luận) ---------- */
  NS.getDeviceId = () => {
    let id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) {}
    if (!id) { const m = document.cookie.match(/(?:^|; )rv_device=([^;]+)/); if (m) id = m[1]; }
    if (!id || !/^[a-z0-9]{10,40}$/i.test(id)) {
      const a = new Uint8Array(12);
      (window.crypto || window.msCrypto).getRandomValues(a);
      id = "d" + Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
    try { document.cookie = "rv_device=" + id + "; max-age=63072000; path=/; SameSite=Lax"; } catch (e) {}
    return id;
  };

  /* ---------- Nhận diện từ ngữ tiêu cực (bỏ dấu, bắt cả kiểu viết tách "l.ừ.a đ.ả.o") ---------- */
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const words = (s) => norm(s).replace(/[^a-z0-9]+/g, " ").trim();
  NS.findBanned = (text, list) => {
    const spaced = " " + words(text) + " ";
    const compact = words(text).replace(/ /g, "");
    for (const w of list || []) {
      const nw = words(w);
      if (!nw) continue;
      if (spaced.includes(" " + nw + " ")) return w;
      const cw = nw.replace(/ /g, "");
      if (cw.length >= 4 && compact.includes(cw)) return w;
    }
    return null;
  };

  /* ---------- Cấu hình mặc định (lưu ở Firestore: site/reviewConfig) ---------- */
  NS.defaultConfig = () => ({
    title: "Đánh giá & nhận xét",
    subtitle: "Chia sẻ cảm nhận của bạn — chỉ mất 10 giây",
    avatar: null,
    slogans: ["Uy tín", "Giao hàng nhanh", "Đóng gói cẩn thận", "Tư vấn nhiệt tình", "Sẽ ủng hộ tiếp"],
    quickReplies: ["Cảm ơn bạn đã ủng hộ! ❤️", "Rất tiếc về trải nghiệm này, mình sẽ cải thiện ngay ạ.", "Hẹn gặp lại bạn nhé!"],
    glass: { color: "#ffffff", alpha: 0.14, blur: 14, radius: 22, distort: 18 },
    moodSeconds: 3,
    rules: {
      enabled: true,
      words: ["lừa đảo", "đồ rác", "scam"],
      notice: "Bình luận của bạn đã bị gỡ vì chứa từ ngữ không phù hợp: “{word}”. Thiết bị này không thể bình luận lại trên trang."
    }
  });
  NS.mergeConfig = (d) => {
    const b = NS.defaultConfig(); d = d || {};
    return { ...b, ...d, glass: { ...b.glass, ...(d.glass || {}) }, rules: { ...b.rules, ...(d.rules || {}) } };
  };
  NS.calcStats = (list) => {
    const dist = [0, 0, 0, 0, 0, 0]; let sum = 0;
    list.forEach((r) => { const s = clamp(r.stars, 1, 5); dist[s]++; sum += s; });
    const count = list.length;
    return { count, avg: count ? sum / count : 0, dist };
  };

  /* ---------- Ngôi sao ---------- */
  const STAR = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z";
  NS.starSvg = (cls) => `<svg class="rv-star ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR}"/></svg>`;
  NS.starsRow = (n) => h("span", { class: "rv-stars", role: "img", "aria-label": n + " trên 5 sao",
    html: [1, 2, 3, 4, 5].map((i) => `<span class="${i <= n ? "on" : ""}">${NS.starSvg()}</span>`).join("") });
  NS.starsAvg = (avg) => {
    const one = [1, 2, 3, 4, 5].map(() => `<span>${NS.starSvg()}</span>`).join("");
    return h("span", { class: "rv-stars-avg", role: "img", "aria-label": avg.toFixed(1) + " trên 5 sao",
      html: `<span class="base">${one}</span><span class="fill" style="width:${(avg / 5) * 100}%">${one}</span>` });
  };

  /* ---------- Hiệu ứng kính (thuỷ tinh) ---------- */
  NS.liquidOK = /(Chrome|Chromium|Edg|SamsungBrowser)\//.test(navigator.userAgent) && !/(CriOS|FxiOS|EdgiOS)/.test(navigator.userAgent);
  NS.ensureFilter = () => {
    let svg = document.getElementById("rvFilterSvg");
    if (!svg) {
      const wrap = document.createElement("div");
      wrap.innerHTML = `<svg id="rvFilterSvg" width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true"><defs>
        <filter id="rvLiquid" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="2" seed="7" result="noise"/>
          <feGaussianBlur in="noise" stdDeviation="3" result="soft"/>
          <feDisplacementMap id="rvDisp" in="SourceGraphic" in2="soft" scale="18" xChannelSelector="R" yChannelSelector="G"/>
        </filter></defs></svg>`;
      svg = wrap.firstElementChild; document.body.appendChild(svg);
    }
    return svg;
  };
  NS.applyGlass = (root, g) => {
    const a = clamp(g.alpha, 0, 0.9);
    const dark = a > 0.5 && luminance(g.color) > 0.62;
    root.style.setProperty("--g-tint", NS.hexA(g.color, a));
    root.style.setProperty("--g-blur", clamp(g.blur, 0, 40) + "px");
    root.style.setProperty("--g-radius", clamp(g.radius, 0, 40) + "px");
    root.style.setProperty("--g-ink", dark ? "#14121F" : "#F7F5FF");
    root.style.setProperty("--g-ink-soft", dark ? "rgba(20,18,31,.7)" : "rgba(247,245,255,.72)");
    NS.ensureFilter();
    const disp = document.getElementById("rvDisp");
    if (disp) disp.setAttribute("scale", clamp(g.distort, 0, 60));
    document.documentElement.classList.toggle("rv-liquid", NS.liquidOK && g.distort > 0);
  };

  /* ---------- Xử lý ảnh / video tải từ máy ---------- */
  const readDataURL = (file) => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("Không đọc được tệp.")); r.readAsDataURL(file);
  });
  /* Tự cắt vuông ở giữa rồi thu về 256px — gọn nhẹ, hiển thị bo tròn bỏ qua 4 góc */
  NS.compressSquare = (file, size = 256) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      const c = document.createElement("canvas"); c.width = c.height = size;
      c.getContext("2d").drawImage(img, sx, sy, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      let out = c.toDataURL("image/webp", 0.86);
      if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", 0.86);
      res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Không đọc được ảnh này.")); };
    img.src = url;
  });
  NS.fileToMedia = async (file) => {
    if (!file) throw new Error("Chưa chọn tệp.");
    const t = file.type || "";
    const tooBig = () => new Error(`Tệp nặng ${Math.round(file.size / 1024)}KB, tối đa ${Math.round(NS.MAX_MEDIA_BYTES / 1024)}KB. Hãy cắt ngắn (≤3 giây), giảm độ phân giải, hoặc dán link thay vì tải từ máy.`);
    if (t.startsWith("video/")) { if (file.size > NS.MAX_MEDIA_BYTES) throw tooBig(); return { type: "video", src: await readDataURL(file) }; }
    if (t === "image/gif") { if (file.size > NS.MAX_MEDIA_BYTES) throw tooBig(); return { type: "image", src: await readDataURL(file) }; }
    if (t.startsWith("image/")) return { type: "image", src: await NS.compressSquare(file, 256) };
    throw new Error("Chỉ nhận ảnh hoặc video.");
  };
  NS.mediaFromUrl = (url) => ({ type: /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) ? "video" : "image", src: url });

  /* ---------- Khung avatar + vòng tỉ lệ sao + biểu cảm động ---------- */
  let ringUid = 0;
  NS.buildRing = () => {
    const gid = "rvg" + (++ringUid);
    const el = h("div", { class: "rv-ring" });
    el.innerHTML = `
      <svg class="rv-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff9f43"/></linearGradient></defs>
        <circle class="rv-ring-track" cx="60" cy="60" r="55"/>
        <circle class="rv-ring-bar" cx="60" cy="60" r="55" pathLength="100" stroke="url(#${gid})" transform="rotate(-90 60 60)"/>
      </svg>
      <div class="rv-ring-avatar"><div class="rv-ring-img"></div><div class="rv-ring-mood"></div></div>
      <div class="rv-ring-badge">${NS.starSvg()}<b>0.0</b></div>`;
    const img = el.querySelector(".rv-ring-img"), bar = el.querySelector(".rv-ring-bar"),
          badge = el.querySelector(".rv-ring-badge b"), moodBox = el.querySelector(".rv-ring-mood");
    let timer = null;
    const api = {
      el,
      setAvatar(url) { img.style.backgroundImage = url ? `url(${url})` : ""; el.classList.toggle("no-avatar", !url); },
      setScore(avg, count) {
        const pct = clamp((avg / 5) * 100, 0, 100);
        bar.style.opacity = count ? 1 : 0;
        bar.style.strokeDasharray = `${pct} ${100 - pct}`;
        badge.textContent = count ? avg.toFixed(1) : "–";
      },
      stopMood() {
        clearTimeout(timer); el.classList.remove("is-mood");
        const old = Array.from(moodBox.children);
        setTimeout(() => old.forEach((n) => n.remove()), 380);
      },
      /* Thay avatar bằng biểu cảm (ảnh/video) trong khung tròn trong suốt — các góc của ảnh/video bị cắt bỏ */
      playMood(media, seconds) {
        api.stopMood();
        if (!media || !media.src) return;
        let node;
        if (media.type === "video") {
          node = document.createElement("video");
          node.muted = true; node.loop = true; node.autoplay = true; node.playsInline = true;
          node.setAttribute("playsinline", ""); node.src = media.src;
          const p = node.play && node.play(); if (p && p.catch) p.catch(() => {});
        } else { node = document.createElement("img"); node.alt = ""; node.decoding = "async"; node.src = media.src; }
        moodBox.appendChild(node);
        requestAnimationFrame(() => el.classList.add("is-mood"));
        timer = setTimeout(api.stopMood, clamp(seconds || 3, 1, 15) * 1000);
      }
    };
    return api;
  };

  /* =========================================================
     GIAO DIỆN NGƯỜI XEM — chỉ chạy ở index.html
  ========================================================= */
  function mountViewer() {
    const stage = document.getElementById("stage");
    const pageCard = document.getElementById("pageCard");
    if (!stage || !pageCard) return;

    const root = document.documentElement;
    const deviceId = NS.getDeviceId();
    const st = {
      cfg: NS.defaultConfig(), reviews: [], mine: null, blocked: null,
      rating: 0, open: false, cascade: false, popMine: false, busy: false, fiveSig: ""
    };
    const moodCache = {};
    const visited = () => { try { return localStorage.getItem(VISITED_KEY) === "1"; } catch (e) { return false; } };
    const bio = () => window.__bioState || {};

    NS.ensureFilter();

    /* ----- Dựng khung giao diện ----- */
    const teaser = h("button", { type: "button", class: "rv-teaser glass liq", id: "rvTeaser" });
    teaser.innerHTML = `
      <span class="rv-teaser-badge">${NS.starSvg()}<i class="rv-sp a"></i><i class="rv-sp b"></i><i class="rv-sp c"></i><i class="rv-sp d"></i></span>
      <span class="rv-teaser-main"><strong>Đánh giá &amp; nhận xét</strong><span class="rv-teaser-sub" id="rvTeaserSub">Đang tải…</span></span>
      <span class="rv-teaser-cta">Xem</span>`;

    const fab = h("button", { type: "button", class: "rv-fab glass", id: "rvFab", "aria-label": "Mở trang đánh giá" });
    fab.innerHTML = `${NS.starSvg()}<span>Đánh giá</span><i class="rv-sp a"></i><i class="rv-sp b"></i><i class="rv-sp c"></i><i class="rv-sp d"></i>`;

    const feed = h("div", { class: "rv-feed", "aria-hidden": "true" });
    const toast = h("div", { class: "rv-toast", role: "status", "aria-live": "polite" });

    const view = h("section", { class: "rv-view", id: "rvView", "aria-label": "Đánh giá" });
    view.innerHTML = `
      <div class="rv-top"><button type="button" class="rv-back glass" id="rvBack">‹ Trang bio</button></div>
      <div class="rv-head">
        <div id="rvRingHost"></div>
        <h2 class="rv-title" id="rvTitle"></h2>
        <p class="rv-sub" id="rvSub"></p>
        <div class="rv-score"><b id="rvAvg">0.0</b><span id="rvAvgStars"></span><small id="rvCount"></small></div>
      </div>
      <div class="rv-form glass liq" id="rvForm">
        <label class="rv-field"><span>Tên của bạn</span>
          <input id="rvName" maxlength="${MAX_NAME}" placeholder="Nhập tên hiển thị" autocomplete="nickname"></label>
        <div class="rv-rate">
          <div class="rv-rate-stars" id="rvRate" role="radiogroup" aria-label="Chọn số sao">
            ${[1, 2, 3, 4, 5].map((i) => `<button type="button" role="radio" aria-checked="false" aria-label="${i} sao" data-v="${i}">${NS.starSvg()}</button>`).join("")}
          </div>
          <span class="rv-rate-label" id="rvRateLabel">Chạm vào sao để chấm điểm</span>
        </div>
        <div class="rv-slogans" id="rvSlogans"></div>
        <label class="rv-field"><span>Bình luận thêm</span>
          <textarea id="rvText" maxlength="${MAX_TEXT}" rows="3" placeholder="Kể thêm trải nghiệm của bạn (không bắt buộc)"></textarea></label>
        <div class="rv-form-foot"><small id="rvChars">0/${MAX_TEXT}</small><button type="button" class="rv-submit" id="rvSubmit">Gửi đánh giá</button></div>
        <p class="rv-form-msg" id="rvMsg" role="status"></p>
      </div>
      <div class="rv-done glass" id="rvDone" hidden></div>
      <div class="rv-blocked glass" id="rvBlocked" hidden></div>
      <div class="rv-list" id="rvList" aria-live="polite"></div>`;

    pageCard.after(teaser, view);
    document.body.append(fab, feed, toast);

    const $ = (id) => document.getElementById(id);
    const ring = NS.buildRing();
    $("rvRingHost").appendChild(ring.el);
    const ui = {
      name: $("rvName"), text: $("rvText"), chars: $("rvChars"), msg: $("rvMsg"), submit: $("rvSubmit"),
      rate: $("rvRate"), rateLabel: $("rvRateLabel"), slogans: $("rvSlogans"), list: $("rvList"),
      form: $("rvForm"), done: $("rvDone"), blocked: $("rvBlocked"),
      avg: $("rvAvg"), avgStars: $("rvAvgStars"), count: $("rvCount"), title: $("rvTitle"), sub: $("rvSub"),
      teaserSub: $("rvTeaserSub")
    };

    /* ----- Lấp lánh cho tới khi người dùng truy cập lần đầu ----- */
    const sparkleEls = [teaser, fab];
    const setSparkle = (on) => sparkleEls.forEach((e) => e.classList.toggle("rv-sparkle", on));
    setSparkle(!visited());
    const markVisited = () => { try { localStorage.setItem(VISITED_KEY, "1"); } catch (e) {} setSparkle(false); };

    /* ----- Nút ★ góc trái: hiện sau cú chạm/bấm đầu tiên vào trang ----- */
    let fabShown = false;
    const showFab = () => {
      if (fabShown) return; fabShown = true;
      fab.classList.add("show");
      ["pointerdown", "keydown"].forEach((ev) => window.removeEventListener(ev, showFab, true));
    };
    ["pointerdown", "keydown"].forEach((ev) => window.addEventListener(ev, showFab, { capture: true, passive: true }));

    /* ----- Mở / đóng trang đánh giá ngay trên nền chính ----- */
    function openView() {
      if (st.open) return;
      st.open = true; markVisited();
      document.body.classList.add("rv-open");
      st.cascade = true; renderSummary(); renderGate(); renderList();   // vẽ ngay lần đầu mở
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    function closeView() {
      if (!st.open) return;
      st.open = false; ring.stopMood();
      document.body.classList.remove("rv-open");
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    const syncHash = () => (location.hash === HASH ? openView() : closeView());
    const goOpen = () => { if (location.hash !== HASH) location.hash = HASH; else openView(); };
    const goBack = () => { if (location.hash === HASH) location.hash = ""; else closeView(); };
    window.addEventListener("hashchange", syncHash);
    teaser.addEventListener("click", goOpen);
    fab.addEventListener("click", goOpen);
    $("rvBack").addEventListener("click", goBack);

    /* ----- Cấu hình (kính, slogan, chữ, avatar) ----- */
    function applyConfig() {
      const c = st.cfg;
      NS.applyGlass(root, c.glass);
      ui.title.textContent = c.title || "Đánh giá";
      ui.sub.textContent = c.subtitle || "";
      ring.setAvatar(c.avatar || bio().avatar || null);
      ui.slogans.innerHTML = "";
      (c.slogans || []).forEach((s) => {
        ui.slogans.appendChild(h("button", { type: "button", class: "rv-chip", text: s, onclick: (e) => addSlogan(s, e.currentTarget) }));
      });
      ui.slogans.hidden = !(c.slogans || []).length;
    }
    document.addEventListener("bio:render", () => ring.setAvatar(st.cfg.avatar || bio().avatar || null));

    function addSlogan(s, btn) {
      const cur = ui.text.value.trim();
      if (btn.classList.contains("on")) {
        ui.text.value = cur.split(/\s*•\s*/).filter((x) => x && x !== s).join(" • ");
        btn.classList.remove("on");
      } else {
        if ((cur ? cur + " • " : "").length + s.length > MAX_TEXT) return;
        ui.text.value = cur ? cur + " • " + s : s; btn.classList.add("on");
      }
      ui.chars.textContent = ui.text.value.length + "/" + MAX_TEXT;
    }
    ui.text.addEventListener("input", () => { ui.chars.textContent = ui.text.value.length + "/" + MAX_TEXT; });

    /* ----- 5 sao: bấm/rê tới mức nào thì sáng tới mức đó ----- */
    const starBtns = Array.from(ui.rate.querySelectorAll("button"));
    function paintStars(n) { starBtns.forEach((b, i) => { b.classList.toggle("on", i < n); b.setAttribute("aria-checked", String(st.rating === i + 1)); }); }
    function setRating(n) {
      st.rating = n; paintStars(n);
      ui.rateLabel.textContent = NS.LABELS[n] || "Chạm vào sao để chấm điểm";
      ui.rateLabel.dataset.v = n;
      getMood(n);
    }
    starBtns.forEach((b) => {
      const v = Number(b.dataset.v);
      b.addEventListener("click", () => { setRating(v); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); });
      b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") paintStars(v); });
      b.addEventListener("focus", () => paintStars(v));
    });
    ui.rate.addEventListener("pointerleave", () => paintStars(st.rating));
    ui.rate.addEventListener("focusout", () => paintStars(st.rating));

    /* ----- Biểu cảm động theo mức sao (tải khi cần, giữ trong bộ nhớ) ----- */
    function getMood(n) {
      if (!moodCache[n]) moodCache[n] = moodRef(n).get().then((s) => (s.exists ? s.data() : null)).catch(() => null);
      return moodCache[n];
    }
    async function playMood(n) { const m = await getMood(n); if (m && st.open) ring.playMood(m, st.cfg.moodSeconds); }

    /* ----- Thông báo nhỏ ----- */
    let toastTimer = null;
    function say(text, bad) {
      toast.textContent = text; toast.classList.toggle("bad", !!bad); toast.classList.add("show");
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
    }
    function formMsg(text, bad) { ui.msg.textContent = text || ""; ui.msg.classList.toggle("bad", !!bad); }

    /* ----- Gửi đánh giá ----- */
    const fmtNotice = (tpl, word) => String(tpl || "").replace(/\{word\}/g, word);
    async function submit() {
      if (st.busy) return;
      const name = ui.name.value.trim().slice(0, MAX_NAME);
      const text = ui.text.value.trim().slice(0, MAX_TEXT);
      if (!name) { formMsg("Vui lòng nhập tên của bạn.", true); ui.name.focus(); return; }
      if (!st.rating) { formMsg("Hãy chạm vào sao để chọn mức đánh giá.", true); return; }
      st.busy = true; ui.submit.disabled = true; formMsg("Đang gửi…");
      try {
        const b = await BLOCKED_REF.doc(deviceId).get();
        if (b.exists) { st.blocked = b.data(); renderGate(); return; }
        const r = st.cfg.rules;
        if (r.enabled) {
          const w = NS.findBanned(name + " " + text, r.words);
          if (w) {
            await BLOCKED_REF.doc(deviceId).set({
              reason: fmtNotice(r.notice, w).slice(0, 400), word: String(w).slice(0, 60),
              ts: firebase.firestore.FieldValue.serverTimestamp(), by: "auto"
            });
            formMsg(""); return;                      // khung thông báo hiện qua bộ lắng nghe "blocked"
          }
        }
        st.popMine = true;               // đặt TRƯỚC khi ghi: Firestore bắn cập nhật cục bộ ngay khi ghi
        try {
          await REVIEWS_REF.doc(deviceId).set({
            name, stars: st.rating, text, reply: "", ts: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) { st.popMine = false; throw e; }
        formMsg("");
        window.scrollTo({ top: 0, behavior: "smooth" });
        playMood(st.rating);
        say("Cảm ơn bạn đã đánh giá! ★");
      } catch (err) {
        console.error(err);
        const code = err && err.code;
        if (code === "permission-denied") formMsg("Thiết bị này đã gửi đánh giá rồi (mỗi thiết bị chỉ được 1 lần) hoặc đã bị chặn.", true);
        else if (code === "unavailable" || !navigator.onLine) formMsg("Mất kết nối mạng. Nội dung của bạn vẫn còn đây, hãy thử gửi lại.", true);
        else formMsg("Chưa gửi được, vui lòng thử lại sau ít phút.", true);
      } finally { st.busy = false; ui.submit.disabled = false; }
    }
    ui.submit.addEventListener("click", submit);

    /* ----- Hiển thị: form / đã đánh giá / bị chặn ----- */
    function renderGate() {
      const blocked = !!st.blocked, mine = !blocked && !!st.mine;
      ui.form.hidden = blocked || mine;
      ui.done.hidden = !mine; ui.blocked.hidden = !blocked;
      if (mine) {
        ui.done.innerHTML = "";
        ui.done.append(h("b", { text: "Cảm ơn bạn đã đánh giá!" }), NS.starsRow(st.mine.stars),
          h("small", { text: "Mỗi thiết bị chỉ đánh giá được một lần." }));
      }
      if (blocked) {
        ui.blocked.innerHTML = "";
        ui.blocked.append(h("b", { text: "Thiết bị này không thể bình luận" }), h("p", { text: st.blocked.reason || "Bình luận của bạn đã bị gỡ." }));
        const ts = st.blocked.ts && st.blocked.ts.toMillis ? st.blocked.ts.toMillis() : 0;
        let seen = 0; try { seen = Number(localStorage.getItem(NOTICE_KEY) || 0); } catch (e) {}
        if (ts && ts !== seen) {
          try { localStorage.setItem(NOTICE_KEY, String(ts)); } catch (e) {}
          showNotice(st.blocked.reason);
        }
      }
    }
    function showNotice(reason) {
      const close = () => m.remove();
      const m = h("div", { class: "rv-modal", role: "alertdialog", "aria-modal": "true" },
        h("div", { class: "rv-modal-box glass" },
          h("b", { text: "Thông báo từ chủ trang" }),
          h("p", { text: reason || "Bình luận của bạn đã bị gỡ." }),
          h("button", { type: "button", class: "rv-submit", text: "Đã hiểu", onclick: close })));
      m.addEventListener("click", (e) => { if (e.target === m) close(); });
      document.body.appendChild(m);
    }

    /* ----- Tổng hợp điểm + danh sách ----- */
    function allReviews() {
      const seen = new Set(), out = [];
      if (st.mine) { out.push(st.mine); seen.add(st.mine.id); }
      st.reviews.forEach((r) => { if (!seen.has(r.id)) { seen.add(r.id); out.push(r); } });
      return out;
    }
    function renderSummary() {
      const list = allReviews(), s = NS.calcStats(list);
      ring.setScore(s.avg, s.count);
      ui.avg.textContent = s.count ? s.avg.toFixed(1) : "–";
      ui.avgStars.innerHTML = ""; ui.avgStars.appendChild(NS.starsAvg(s.avg));
      ui.count.textContent = s.count ? s.count + " đánh giá" : "Chưa có đánh giá";
      ui.teaserSub.innerHTML = "";
      if (s.count) ui.teaserSub.append(NS.starsAvg(s.avg), h("span", { text: `${s.avg.toFixed(1)} · ${s.count} đánh giá` }));
      else ui.teaserSub.textContent = "Hãy là người đầu tiên đánh giá";
    }
    function buildItem(r, i, isMine) {
      const avatar = h("span", { class: "rv-av", style: `--h:${NS.hue(r.name)}`, text: (r.name || "?").trim().charAt(0).toUpperCase() });
      const el = h("article", { class: "rv-item glass liq" + (st.cascade ? " rv-drop" : "") + (isMine && st.popMine ? " rv-pop" : ""), style: `--i:${Math.min(i, 14)}` },
        h("header", null, avatar,
          h("div", { class: "rv-who" }, h("b", { class: "rv-name", text: r.name || "Ẩn danh" }), isMine ? h("em", { class: "rv-me", text: "Của bạn" }) : null, NS.starsRow(r.stars)),
          h("time", { text: NS.ago(r.ts) })),
        r.text ? h("p", { class: "rv-text", text: r.text }) : null,
        r.reply ? h("div", { class: "rv-reply" },
          h("span", { class: "rv-reply-tag" }, h("i", { class: "rv-reply-av", style: st.cfg.avatar || bio().avatar ? `background-image:url(${st.cfg.avatar || bio().avatar})` : "" }), "Chủ trang"),
          h("p", { text: r.reply })) : null);
      return el;
    }
    function renderList() {
      const list = allReviews();
      const frag = document.createDocumentFragment();
      if (!list.length) frag.appendChild(h("p", { class: "rv-empty", text: "Chưa có bình luận nào — bạn hãy là người đầu tiên nhé." }));
      list.forEach((r, i) => frag.appendChild(buildItem(r, i, r.id === deviceId)));
      ui.list.innerHTML = ""; ui.list.appendChild(frag);
      st.cascade = false; st.popMine = false;
    }
    /* Gộp nhiều bản cập nhật liên tiếp (danh sách + bình luận của mình) thành 1 lần vẽ, tránh nháy hoạt ảnh */
    let listRaf = 0;
    function scheduleList() { if (listRaf) return; listRaf = requestAnimationFrame(() => { listRaf = 0; if (st.open) renderList(); }); }
    function renderAll() { renderSummary(); renderGate(); if (st.open) scheduleList(); }

    /* ----- Dòng bình luận 5 sao chạy ở góc phải dưới (kiểu live TikTok) ----- */
    let feedIdx = 0, feedTimer = null;
    const five = () => allReviews().filter((r) => r.stars === 5);
    function feedAdd(el) {
      const olds = Array.from(feed.children);
      const tops = olds.map((o) => o.getBoundingClientRect().top);
      feed.appendChild(el);
      olds.forEach((o, i) => {                      // FLIP: các dòng cũ trượt mượt lên trên
        const d = tops[i] - o.getBoundingClientRect().top;
        if (!d) return;
        o.style.transition = "none"; o.style.transform = `translateY(${d}px)`;
        requestAnimationFrame(() => requestAnimationFrame(() => { o.style.transition = ""; o.style.transform = ""; }));
      });
      while (feed.children.length > 4) feed.firstElementChild.remove();
      setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 600); }, 9500);
    }
    function feedTick() {
      if (document.hidden || st.open) return;
      const list = five(); if (!list.length) return;
      const r = list[feedIdx++ % list.length];
      if (feed.querySelector(`[data-id="${r.id}"]`)) return;
      const el = h("div", { class: "rv-feed-item", "data-id": r.id },
        h("span", { class: "rv-av", style: `--h:${NS.hue(r.name)}`, text: (r.name || "?").trim().charAt(0).toUpperCase() }),
        h("div", null, h("b", { text: r.name || "Ẩn danh" }), h("span", { class: "rv-feed-stars", html: "★★★★★" }),
          h("p", { text: r.text || "Rất hài lòng!" })));
      feedAdd(el);
    }
    function restartFeed() {
      const sig = five().map((r) => r.id).join(",");
      if (sig === st.fiveSig) return;
      st.fiveSig = sig; clearInterval(feedTimer);
      if (!sig) { feed.innerHTML = ""; return; }
      feedTimer = setInterval(feedTick, 2800); feedTick();
    }

    /* ----- Lắng nghe dữ liệu thời gian thực ----- */
    CONFIG_REF.onSnapshot((s) => { st.cfg = NS.mergeConfig(s.exists ? s.data() : {}); applyConfig(); if (st.open) scheduleList(); }, (e) => console.warn("reviewConfig:", e));
    REVIEWS_REF.orderBy("ts", "desc").limit(NS.REVIEW_LIMIT).onSnapshot((s) => {
      st.reviews = s.docs.map((d) => ({ id: d.id, ...d.data() })); renderAll(); restartFeed();
    }, (e) => { console.warn("reviews:", e); ui.teaserSub.textContent = "Chưa tải được đánh giá"; });
    REVIEWS_REF.doc(deviceId).onSnapshot((s) => { st.mine = s.exists ? { id: s.id, ...s.data() } : null; renderAll(); restartFeed(); }, () => {});
    BLOCKED_REF.doc(deviceId).onSnapshot((s) => { st.blocked = s.exists ? s.data() : null; renderGate(); }, () => {});
    document.addEventListener("visibilitychange", () => { if (!document.hidden) feedTick(); });

    applyConfig(); renderSummary();
    requestAnimationFrame(() => teaser.classList.add("ready"));
    syncHash();                                     // mở thẳng nếu link có #danh-gia
  }

  if (document.body && document.body.classList.contains("mode-preview")) mountViewer();
})();
