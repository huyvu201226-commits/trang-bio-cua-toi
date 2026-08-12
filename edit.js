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

  auth.onAuthStateChanged((user) => {
    if (user) {
      loginOverlay.classList.add("hidden");
      appRoot.classList.remove("app-hidden");
      DOC_REF.get().then((snap) => {
        state = { ...defaultState(), ...(snap.exists ? snap.data() : {}) };
        initFromState();
      }).catch((err) => console.error(err));
    } else {
      appRoot.classList.add("app-hidden");
      loginOverlay.classList.remove("hidden");
      loginPassword.value = "";
    }
  });
})();
