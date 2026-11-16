/* =========================================================
   PHẦN DÙNG CHUNG cho cả trang chính (view.js) và trang sửa (edit.js)
========================================================= */

function defaultState() {
  return {
    brandName: "Tên Thương Hiệu",
    brandDesc: "Viết một dòng mô tả ngắn về bạn hoặc thương hiệu ở đây.",
    avatar: null,
    cover: null,
    // Kiểu nền trang: "color" (màu phẳng) | "image" (ảnh tuỳ chỉnh) | "video" (hoạt ảnh nền)
    stageBgType: "color",
    stageBgColor: "#1b1730",
    stageBgImage: null,
    stageBgVideo: "https://huyvu201226-commits.github.io/N-n-ng/video.mp4",
    // Chỉnh màu nền: phủ màu (màu + độ đậm 0..1), đổi sắc (độ, 0..360), độ sáng (1 = gốc)
    stageBgTint: "#6C5CE0",
    stageBgTintOpacity: 0,
    stageBgHue: 0,
    stageBgBright: 1,
    // Hệ số phóng/thu khung trang — mọi kích thước bên trong (avatar, ảnh bìa,
    // chữ, hộp liên kết...) đều nhân theo hệ số này để luôn đồng bộ & cân đối
    cardScale: 1,
    // Nội dung chân trang phủ mờ xám, nằm đè lên nền trang (ngoài khung thẻ)
    footerText: "© 2026 · Trang bio của tôi",
    links: [
      { id: "l1", title: "Facebook", desc: "Trang cá nhân / fanpage của tôi", url: "https://facebook.com", color: "#6C5CE0", image: null },
      { id: "l2", title: "Instagram", desc: "Ảnh và story hằng ngày", url: "https://instagram.com", color: "#FF6F5E", image: null }
    ]
  };
}

function genId() {
  return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* Ảnh chụp từ điện thoại thường 3–8MB — quá nặng cho Firebase (giới hạn 1MB/tài liệu)
   và làm trang giật trên máy yếu. Hàm này tự thu nhỏ (tối đa 1280px) và nén lại
   trước khi lưu; ảnh nhỏ / định dạng khác (gif, svg...) giữ nguyên. */
function fileToBase64(file, cb, opts) {
  if (!file) return;
  const maxDim = (opts && opts.maxDim) || 1280;
  const readRaw = () => {
    const reader = new FileReader();
    reader.onload = () => cb(reader.result);
    reader.readAsDataURL(file);
  };
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 120 * 1024) return readRaw();

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    try {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      let out = canvas.toDataURL("image/webp", 0.82);
      if (out.indexOf("data:image/webp") !== 0) {          // Safari cũ không nén được webp
        out = file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.82);
      }
      if (out.length < file.size * 1.37) cb(out); else readRaw();   // chỉ dùng bản nén nếu thật sự nhẹ hơn
    } catch (e) { readRaw(); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); readRaw(); };
  img.src = url;
}

/* Một số trình duyệt trong app (TikTok, Facebook, Instagram, Zalo...)
   chặn autoplay video ở lần tải đầu tiên dù đã có muted+autoplay+playsinline.
   Hàm này thử play() ngay; nếu bị chặn, sẽ tự phát lại ngay khi người dùng
   chạm/bấm vào màn hình lần đầu tiên (chỉ đăng ký 1 lần cho mỗi videoEl). */
function playVideoWithFallback(videoEl) {
  const p = videoEl.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {
      if (videoEl.dataset.fallbackBound) return;
      videoEl.dataset.fallbackBound = "1";
      const resume = () => {
        videoEl.play().catch(() => {});
        window.removeEventListener("touchstart", resume);
        window.removeEventListener("click", resume);
      };
      window.addEventListener("touchstart", resume, { once: true, passive: true });
      window.addEventListener("click", resume, { once: true });
    });
  }
}

/* =========================================================
   KHO NỀN TRÊN GIT (GitHub Pages) — đổi owner/repo ở đây nếu bạn đổi kho
========================================================= */
const BG_REPO = { owner: "huyvu201226-commits", repo: "N-n-ng" };
const BG_REPO_PAGES = "https://" + BG_REPO.owner + ".github.io/" + BG_REPO.repo + "/";
const BG_REPO_GIT   = "https://github.com/" + BG_REPO.owner + "/" + BG_REPO.repo;

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function withVersion(url, token) {
  if (!token) return url;
  return url + (url.indexOf("?") < 0 ? "?" : "&") + "v=" + encodeURIComponent(token);
}

/* Hỏi nhanh máy chủ (HEAD, không tải video) để lấy "dấu phiên bản" của file.
   File đổi trong Git → dấu đổi → link thêm ?v=... mới → trình duyệt tải bản mới
   thay vì dùng bản cũ trong bộ nhớ đệm. Trả "" nếu không lấy được. */
function fetchRemoteVersion(url) {
  if (!/^https?:\/\/[^/]*\.github\.io\//i.test(url)) return Promise.resolve("");
  const ctl = ("AbortController" in window) ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 2500);
  return fetch(url.split("?")[0], { method: "HEAD", cache: "no-cache", signal: ctl ? ctl.signal : undefined })
    .then((r) => {
      clearTimeout(timer);
      if (!r.ok) return "";
      const raw = (r.headers.get("etag") || "") + "|" + (r.headers.get("last-modified") || "") + "|" + (r.headers.get("content-length") || "");
      return raw === "||" ? "" : hashStr(raw);
    })
    .catch(() => { clearTimeout(timer); return ""; });
}

function loadVideoVersion(videoEl, baseUrl, token) {
  const full = withVersion(baseUrl, token);
  if (videoEl.dataset.cur === full) return;
  videoEl.dataset.cur = full;
  videoEl.dataset.token = token || "";
  videoEl.src = full;
  playVideoWithFallback(videoEl);
}

/* Cứ 2 phút (và mỗi lần quay lại tab) kiểm tra lại: nếu video trong Git đã đổi thì
   tự thay bằng bản mới, người xem không cần tải lại trang. */
function startVideoWatch(videoEl) {
  if (videoEl._watching) return;
  videoEl._watching = true;
  const check = () => {
    const base = videoEl.dataset.src;
    if (!base || document.hidden) return;
    fetchRemoteVersion(base).then((token) => {
      if (!token || videoEl.dataset.src !== base) return;
      if (token !== videoEl.dataset.token) loadVideoVersion(videoEl, base, token);
    });
  };
  setInterval(check, 120000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
}

function setVideoSource(videoEl, baseUrl) {
  videoEl.dataset.src = baseUrl;
  fetchRemoteVersion(baseUrl).then((token) => {
    if (videoEl.dataset.src !== baseUrl) return;   // đã đổi sang nền khác trong lúc chờ
    loadVideoVersion(videoEl, baseUrl, token);
  });
  startVideoWatch(videoEl);
}

/* Danh sách ảnh/video có sẵn trong kho Git (tự thấy file mới khi bạn commit) */
function loadRepoBackgrounds(force) {
  const KEY = "bgRepoCache";
  try {
    if (!force) {
      const c = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (c && Date.now() - c.t < 300000) return Promise.resolve(c.items);
    }
  } catch (e) {}
  return fetch("https://api.github.com/repos/" + BG_REPO.owner + "/" + BG_REPO.repo + "/contents/",
               { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then((list) => {
      const items = list
        .filter((f) => f.type === "file" && /\.(mp4|webm|jpe?g|png|webp|gif|avif)$/i.test(f.name))
        .map((f) => ({
          name: f.name,
          url: BG_REPO_PAGES + encodeURIComponent(f.name),
          kind: /\.(mp4|webm)$/i.test(f.name) ? "video" : "image"
        }));
      try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), items })); } catch (e) {}
      return items;
    });
}

/* Hai lớp nền cố định (ảnh + phủ màu) được tạo tự động bên trong .stage */
function ensureBgLayers(stage, videoEl) {
  let img = stage.querySelector(".stage-bg-image");
  let tint = stage.querySelector(".stage-bg-tint");
  if (!img) {
    img = document.createElement("div");
    img.className = "stage-bg-image";
    const anchor = (videoEl && videoEl.parentNode === stage) ? videoEl.nextSibling : stage.firstChild;
    stage.insertBefore(img, anchor);
  }
  if (!tint) {
    tint = document.createElement("div");
    tint.className = "stage-bg-tint";
    stage.insertBefore(tint, img.nextSibling);
  }
  return { img, tint };
}

/* videoEl (tuỳ chọn) là thẻ <video id="stageBgVideo"> nằm trong .stage,
   dùng để phát hoạt ảnh nền khi state.stageBgType === "video". */
function applyStageBackground(stage, bgColorInput, state, videoEl) {
  const type = state.stageBgType || (state.stageBgImage ? "image" : "color");
  const layers = ensureBgLayers(stage, videoEl);

  stage.style.setProperty("--stage-bg-color", state.stageBgColor || "#1b1730");
  stage.style.setProperty("--stage-bg-image", "none");
  if (bgColorInput) bgColorInput.value = state.stageBgColor || "#1b1730";

  // Ảnh nền (từ máy hoặc từ kho Git) nằm ở lớp riêng để chỉnh màu được
  const useImage = type === "image" && !!state.stageBgImage;
  layers.img.style.backgroundImage = useImage ? 'url("' + String(state.stageBgImage).replace(/"/g, "%22") + '")' : "none";
  layers.img.classList.toggle("on", useImage);

  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const useVideo = type === "video" && !!state.stageBgVideo && !saveData;
  stage.classList.toggle("bg-video-active", useVideo);

  // Chỉnh màu: đổi sắc + độ sáng (ảnh/video), phủ màu (mọi loại nền)
  const hue = Number(state.stageBgHue) || 0;
  const bright = (state.stageBgBright == null) ? 1 : Number(state.stageBgBright);
  const filter = (hue || bright !== 1) ? "hue-rotate(" + hue + "deg) brightness(" + bright + ")" : "none";
  layers.img.style.filter = filter;
  if (videoEl) videoEl.style.filter = filter;
  const tintOp = Math.min(1, Math.max(0, Number(state.stageBgTintOpacity) || 0));
  layers.tint.style.background = state.stageBgTint || "#6C5CE0";
  layers.tint.style.opacity = tintOp;
  layers.tint.classList.toggle("on", tintOp > 0);

  if (videoEl) {
    if (useVideo) {
      if (videoEl.dataset.src !== state.stageBgVideo) setVideoSource(videoEl, state.stageBgVideo);
      else playVideoWithFallback(videoEl);
    } else if (videoEl.dataset.src) {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
      delete videoEl.dataset.src;
      delete videoEl.dataset.cur;
      delete videoEl.dataset.token;
    }
  }
}

/* Khung trang có thể phóng to/thu nhỏ theo ý muốn — mọi phần tử con
   (ảnh bìa, avatar, chữ, hộp liên kết...) đều lấy theo cùng 1 hệ số này
   trong style.css nên luôn co giãn đồng bộ, không bị lệch tỉ lệ. */
function applyCardScale(target, state) {
  target.style.setProperty("--card-scale", state.cardScale || 1);
}

function applyFooterText(el, state) {
  if (!el) return;
  const text = state.footerText || "";
  if (el.isContentEditable) {
    if (document.activeElement !== el && el.textContent !== text) el.textContent = text;
  } else {
    el.textContent = text;
  }
}

function applyAvatar(avatar, state) {
  if (state.avatar) {
    avatar.style.setProperty("--avatar-image", `url(${state.avatar})`);
    avatar.classList.add("has-image");
  } else {
    avatar.style.removeProperty("--avatar-image");
    avatar.classList.remove("has-image");
  }
}

function applyCover(coverImg, state) {
  if (state.cover) {
    coverImg.style.setProperty("--cover-image", `url(${state.cover})`);
  } else {
    coverImg.style.removeProperty("--cover-image");
  }
}


/* Tạm dừng video nền khi người xem chuyển tab / khoá màn hình — đỡ tốn pin và
   tránh giật khi quay lại. */
document.addEventListener("visibilitychange", () => {
  const v = document.getElementById("stageBgVideo");
  if (!v || !v.dataset.src) return;
  if (document.hidden) v.pause(); else playVideoWithFallback(v);
});
