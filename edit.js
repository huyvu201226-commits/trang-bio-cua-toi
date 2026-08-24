(() => {
  "use strict";

  /* ---------- DOM refs ---------- */
  const $ = (id) => document.getElementById(id);
  const loginOverlay    = $("loginOverlay");
  const loginEmail      = $("loginEmail");
  const loginPassword   = $("loginPassword");
  const btnLogin        = $("btnLogin");
  const loginError      = $("loginError");
  const btnLogout       = $("btnLogout");
  const appRoot         = $("app");
  const saveStatus      = $("saveStatus");

  const stage           = $("stage");
  const pageCard         = $("pageCard");
  const bgPanel          = $("bgPanel");
  const bgColorInput     = $("bgColorInput");
  const bgFileInput      = $("bgFileInput");
  const btnBg            = $("btnBg");
  const btnUploadBg      = $("btnUploadBg");
  const btnClearBg       = $("btnClearBg");
  const btnAddLink       = $("btnAddLink");
  const btnReset         = $("btnReset");
  const coverImg         = $("coverImg");
  const avatar           = $("avatar");
  const avatarFileInput  = $("avatarFileInput");
  const brandName        = $("brandName");
  const brandDesc        = $("brandDesc");
  const footerName       = $("footerName");
  const linksContainer   = $("linksContainer");
  const emptyState       = $("emptyState");
  const linkCardTemplate = $("linkCardTemplate");

  let state = defaultState();
  let saveTimer = null;

  /* ---------- Lưu vĩnh viễn lên Firestore (có debounce nhẹ) ---------- */
  function saveState() {
    saveStatus.textContent = "Đang lưu…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      DOC_REF.set(state)
        .then(() => { saveStatus.textContent = "Đã lưu ✓"; })
        .catch((err) => { console.error(err); saveStatus.textContent = "Lỗi khi lưu!"; });
    }, 350);
  }

  /* ---------- Hộp liên kết ---------- */
  function buildLinkCard(data) {
    const node = linkCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = data.id;
    node.style.setProperty("--card-color", data.color || "#6C5CE0");

    const titleEl = node.querySelector(".link-title");
    const descEl  = node.querySelector(".link-desc");
    const urlEl   = node.querySelector(".link-url");
    const mediaEl = node.querySelector(".link-media");
    const mediaInput = node.querySelector(".link-media-input");
    const colorInput = node.querySelector(".link-color-input");
    const removeBtn = node.querySelector(".link-remove");

    titleEl.textContent = data.title || "";
    descEl.textContent = data.desc || "";
    urlEl.value = data.url || "";
    colorInput.value = data.color || "#6C5CE0";

    if (data.image) {
      mediaEl.style.setProperty("--media-image", `url(${data.image})`);
      mediaEl.classList.add("has-image");
    }

    titleEl.addEventListener("input", () => updateLink(data.id, { title: titleEl.textContent }));
    descEl.addEventListener("input", () => updateLink(data.id, { desc: descEl.textContent }));
    urlEl.addEventListener("input", () => updateLink(data.id, { url: urlEl.value }));
    colorInput.addEventListener("input", () => {
      node.style.setProperty("--card-color", colorInput.value);
      updateLink(data.id, { color: colorInput.value });
    });
    mediaEl.addEventListener("click", () => mediaInput.click());
    mediaInput.addEventListener("change", (e) => {
      fileToBase64(e.target.files[0], (base64) => {
        mediaEl.style.setProperty("--media-image", `url(${base64})`);
        mediaEl.classList.add("has-image");
        updateLink(data.id, { image: base64 });
      });
    });
    removeBtn.addEventListener("click", () => {
      state.links = state.links.filter((l) => l.id !== data.id);
      node.remove();
      refreshEmptyState();
      saveState();
    });

    return node;
  }

  function updateLink(id, patch) {
    const link = state.links.find((l) => l.id === id);
    if (link) Object.assign(link, patch);
    saveState();
  }

  function renderLinks() {
    linksContainer.innerHTML = "";
    state.links.forEach((data) => linksContainer.appendChild(buildLinkCard(data)));
    refreshEmptyState();
  }

  function refreshEmptyState() {
    emptyState.style.display = state.links.length === 0 ? "block" : "none";
  }

  /* ---------- Kéo thả để sắp xếp lại thứ tự liên kết ----------
     Giữ tay cầm (⋮⋮) rồi kéo: hộp đang kéo "nổi" lên trên (đổ bóng,
     phóng to nhẹ) và đi theo con trỏ/ngón tay; các hộp còn lại tự
     trượt sang chỗ trống mượt mà (kiểu FLIP). Dùng Pointer Events nên
     chạy tốt trên cả chuột lẫn cảm ứng (điện thoại/máy tính bảng). */
  function enableLinkReorder() {
    let draggingEl = null;
    let pointerId = null;
    let grabOffsetY = 0;

    linksContainer.addEventListener("pointerdown", (e) => {
      const handle = e.target.closest(".link-drag-handle");
      if (!handle) return;
      const card = handle.closest(".link-card");
      if (!card) return;
      e.preventDefault();

      draggingEl = card;
      pointerId = e.pointerId;
      handle.setPointerCapture(pointerId);

      const cardRect = card.getBoundingClientRect();
      grabOffsetY = e.clientY - cardRect.top;

      card.classList.add("is-dragging");
      linksContainer.classList.add("is-reordering");

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    });

    function onPointerMove(e) {
      if (!draggingEl) return;

      const containerTop = linksContainer.getBoundingClientRect().top;
      const desiredTop = e.clientY - grabOffsetY;
      const draggingMid = desiredTop + draggingEl.offsetHeight / 2;

      const siblings = Array.from(linksContainer.children).filter((el) => el !== draggingEl);

      // Tìm vị trí cần chèn tới dựa theo điểm giữa của các hộp khác
      let target = null;
      for (const sib of siblings) {
        const sibMid = containerTop + sib.offsetTop + sib.offsetHeight / 2;
        if (draggingMid < sibMid) { target = sib; break; }
      }
      const currentlyBefore = target ? target.previousElementSibling : linksContainer.lastElementChild;

      if (currentlyBefore !== draggingEl) {
        // FLIP: ghi lại vị trí cũ của các hộp sẽ bị dịch chuyển
        const firstTops = new Map();
        siblings.forEach((el) => firstTops.set(el, el.getBoundingClientRect().top));

        if (target) linksContainer.insertBefore(draggingEl, target);
        else linksContainer.appendChild(draggingEl);

        // Cho các hộp bị dịch trượt mượt từ vị trí cũ sang vị trí mới
        siblings.forEach((el) => {
          const firstTop = firstTops.get(el);
          const lastTop = el.getBoundingClientRect().top;
          const delta = firstTop - lastTop;
          if (delta) {
            el.style.transition = "none";
            el.style.transform = `translateY(${delta}px)`;
            requestAnimationFrame(() => {
              el.style.transition = "transform .2s ease";
              el.style.transform = "";
            });
          }
        });
      }

      // Hộp đang kéo luôn "nổi" theo đúng vị trí con trỏ, phóng to nhẹ
      const naturalTop = containerTop + draggingEl.offsetTop;
      draggingEl.style.transform = `translateY(${desiredTop - naturalTop}px) scale(1.025)`;
    }

    function onPointerUp() {
      if (!draggingEl) return;
      const finishedEl = draggingEl;

      finishedEl.classList.remove("is-dragging");
      finishedEl.style.transform = "";
      linksContainer.classList.remove("is-reordering");

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      // Đồng bộ lại thứ tự trong state theo đúng thứ tự hiện có trên DOM, rồi lưu
      const newOrder = Array.from(linksContainer.children)
        .map((el) => state.links.find((l) => l.id === el.dataset.id))
        .filter(Boolean);
      state.links = newOrder;
      saveState();

      draggingEl = null;
    }
  }

  /* ---------- Thanh công cụ ---------- */
  btnBg.addEventListener("click", () => bgPanel.classList.toggle("open"));

  bgColorInput.addEventListener("input", () => {
    state.stageBgColor = bgColorInput.value;
    applyStageBackground(stage, bgColorInput, state);
    saveState();
  });

  btnUploadBg.addEventListener("click", () => bgFileInput.click());
  bgFileInput.addEventListener("change", (e) => {
    fileToBase64(e.target.files[0], (base64) => {
      state.stageBgImage = base64;
      applyStageBackground(stage, bgColorInput, state);
      saveState();
    });
  });
  btnClearBg.addEventListener("click", () => {
    state.stageBgImage = null;
    applyStageBackground(stage, bgColorInput, state);
    saveState();
  });

  btnAddLink.addEventListener("click", () => {
    const data = { id: genId(), title: "Liên kết mới", desc: "", url: "", color: "#6C5CE0", image: null };
    state.links.push(data);
    linksContainer.appendChild(buildLinkCard(data));
    refreshEmptyState();
    saveState();
  });

  btnReset.addEventListener("click", () => {
    if (!confirm("Xoá toàn bộ nội dung và làm lại từ đầu? (Áp dụng cho cả trang chính)")) return;
    state = defaultState();
    initFromState();
    saveState();
  });

  coverImg.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.addEventListener("change", (e) => {
      fileToBase64(e.target.files[0], (base64) => {
        state.cover = base64;
        applyCover(coverImg, state);
        saveState();
      });
    });
    input.click();
  });

  avatar.addEventListener("click", () => avatarFileInput.click());
  avatarFileInput.addEventListener("change", (e) => {
    fileToBase64(e.target.files[0], (base64) => {
      state.avatar = base64;
      applyAvatar(avatar, state);
      saveState();
    });
  });

  brandName.addEventListener("input", () => {
    state.brandName = brandName.textContent;
    footerName.textContent = brandName.textContent || "Tên Thương Hiệu";
    saveState();
  });
  brandDesc.addEventListener("input", () => {
    state.brandDesc = brandDesc.textContent;
    saveState();
  });

  /* ---------- Khởi tạo giao diện từ state đã tải ---------- */
  function initFromState() {
    brandName.textContent = state.brandName;
    brandDesc.textContent = state.brandDesc;
    footerName.textContent = state.brandName || "Tên Thương Hiệu";
    applyAvatar(avatar, state);
    applyCover(coverImg, state);
    applyStageBackground(stage, bgColorInput, state);
    renderLinks();
  }

  /* ---------- Đăng nhập / đăng xuất ---------- */
  btnLogin.addEventListener("click", doLogin);
  loginPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

  function doLogin() {
    loginError.textContent = "";
    auth.signInWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value)
      .catch((err) => { loginError.textContent = "Sai email hoặc mật khẩu."; console.error(err); });
  }

  btnLogout.addEventListener("click", () => auth.signOut());

  enableLinkReorder();

  auth.onAuthStateChanged((user) => {
    if (user) {
      loginOverlay.classList.add("hidden");
      appRoot.classList.remove("app-hidden");
      DOC_REF.get().then((snap) => {
        state = { ...defaultState(), ...(snap.exists ? snap.data() : {}) };
        initFromState();
        // Dữ liệu đã sẵn sàng — mờ dần khung xương "đang tải", hiện nội dung thật
        requestAnimationFrame(() => pageCard.classList.add("is-loaded"));
      }).catch((err) => console.error(err));
    } else {
      appRoot.classList.add("app-hidden");
      loginOverlay.classList.remove("hidden");
      loginPassword.value = "";
      pageCard.classList.remove("is-loaded");
    }
  });
})();
