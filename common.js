/* =========================================================
   PHẦN DÙNG CHUNG cho cả trang chính (view.js) và trang sửa (edit.js)
========================================================= */

function defaultState() {
  return {
    brandName: "Tên Thương Hiệu",
    brandDesc: "Viết một dòng mô tả ngắn về bạn hoặc thương hiệu ở đây.",
    avatar: null,
    cover: null,
    stageBgColor: "#1b1730",
    stageBgImage: null,
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

function applyStageBackground(stage, bgColorInput, state) {
  stage.style.setProperty("--stage-bg-color", state.stageBgColor || "#1b1730");
  stage.style.setProperty("--stage-bg-image", state.stageBgImage ? `url(${state.stageBgImage})` : "none");
  if (bgColorInput) bgColorInput.value = state.stageBgColor || "#1b1730";
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
