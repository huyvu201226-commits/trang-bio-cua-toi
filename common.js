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

function fileToBase64(file, cb) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => cb(reader.result);
  reader.readAsDataURL(file);
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

/* videoEl (tuỳ chọn) là thẻ <video id="stageBgVideo"> nằm trong .stage,
   dùng để phát hoạt ảnh nền khi state.stageBgType === "video". */
function applyStageBackground(stage, bgColorInput, state, videoEl) {
  const type = state.stageBgType || (state.stageBgImage ? "image" : "color");

  stage.style.setProperty("--stage-bg-color", state.stageBgColor || "#1b1730");
  stage.style.setProperty(
    "--stage-bg-image",
    (type === "image" && state.stageBgImage) ? `url(${state.stageBgImage})` : "none"
  );
  stage.classList.toggle("bg-video-active", type === "video" && !!state.stageBgVideo);
  if (bgColorInput) bgColorInput.value = state.stageBgColor || "#1b1730";

  if (videoEl) {
    if (type === "video" && state.stageBgVideo) {
      if (videoEl.dataset.src !== state.stageBgVideo) {
        videoEl.src = state.stageBgVideo;
        videoEl.dataset.src = state.stageBgVideo;
      }
      playVideoWithFallback(videoEl);
    } else if (videoEl.dataset.src) {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
      delete videoEl.dataset.src;
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
