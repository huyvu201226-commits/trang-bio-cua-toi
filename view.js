(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const stage           = $("stage");
  const coverImg        = $("coverImg");
  const avatar          = $("avatar");
  const brandName       = $("brandName");
  const brandDesc       = $("brandDesc");
  const footerName      = $("footerName");
  const linksContainer  = $("linksContainer");
  const loadHint        = $("loadHint");
  const linkCardTemplate = $("linkCardTemplate");

  function buildLinkCard(data) {
    const node = linkCardTemplate.content.firstElementChild.cloneNode(true);
    node.style.setProperty("--card-color", data.color || "#6C5CE0");
    node.href = data.url || "#";

    const mediaEl = node.querySelector(".link-media");
    node.querySelector(".link-title").textContent = data.title || "";
    node.querySelector(".link-desc").textContent = data.desc || "";

    if (data.image) {
      mediaEl.style.setProperty("--media-image", `url(${data.image})`);
      mediaEl.classList.add("has-image");
    }
    return node;
  }

  function render(state) {
    brandName.textContent = state.brandName || "Tên Thương Hiệu";
    brandDesc.textContent = state.brandDesc || "";
    footerName.textContent = state.brandName || "Tên Thương Hiệu";
    applyAvatar(avatar, state);
    applyCover(coverImg, state);
    applyStageBackground(stage, null, state);

    linksContainer.innerHTML = "";
    if (!state.links || state.links.length === 0) {
      const p = document.createElement("p");
      p.className = "load-hint";
      p.textContent = "Chưa có liên kết nào.";
      linksContainer.appendChild(p);
      return;
    }
    state.links.forEach((data) => linksContainer.appendChild(buildLinkCard(data)));
  }

  /* Lắng nghe dữ liệu theo thời gian thực — hễ trang sửa lưu thay đổi,
     trang chính sẽ tự cập nhật ngay mà không cần tải lại trang. */
  DOC_REF.onSnapshot(
    (snap) => {
      const state = { ...defaultState(), ...(snap.exists ? snap.data() : {}) };
      render(state);
    },
    (err) => {
      console.error(err);
      loadHint.textContent = "Không tải được dữ liệu. Kiểm tra lại cấu hình Firebase.";
    }
  );
})();
