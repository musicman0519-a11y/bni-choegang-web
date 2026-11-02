(() => {
  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector("#mainNav");
  if (!menuToggle || !mainNav) return;

  // 상단 메뉴 링크를 그대로 복사해 오른쪽 슬라이드 메뉴를 만듭니다.
  const overlay = document.createElement("div");
  overlay.className = "drawer-overlay";
  overlay.hidden = true;

  const drawer = document.createElement("aside");
  drawer.className = "side-drawer";
  drawer.id = "sideDrawer";
  drawer.setAttribute("aria-label", "전체 메뉴");
  drawer.setAttribute("aria-hidden", "true");
  drawer.innerHTML = `
    <div class="drawer-head">
      <strong>BNI 최강챕터</strong>
      <button class="drawer-close" type="button" aria-label="메뉴 닫기">×</button>
    </div>
    <nav class="drawer-nav" aria-label="전체 메뉴"></nav>`;
  const drawerNav = drawer.querySelector(".drawer-nav");
  mainNav.querySelectorAll("a").forEach((link) => drawerNav.append(link.cloneNode(true)));
  document.body.append(overlay, drawer);
  menuToggle.setAttribute("aria-controls", "sideDrawer");

  const closeButton = drawer.querySelector(".drawer-close");
  const setOpen = (open) => {
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    drawer.setAttribute("aria-hidden", String(!open));
    drawer.toggleAttribute("inert", !open);
    document.body.classList.toggle("drawer-open", open);
    if (open) {
      overlay.hidden = false;
      requestAnimationFrame(() => drawer.classList.add("is-open"));
      closeButton.focus();
    } else {
      drawer.classList.remove("is-open");
      overlay.hidden = true;
      menuToggle.focus();
    }
  };
  drawer.toggleAttribute("inert", true);

  menuToggle.addEventListener("click", () => setOpen(menuToggle.getAttribute("aria-expanded") !== "true"));
  closeButton.addEventListener("click", () => setOpen(false));
  overlay.addEventListener("click", () => setOpen(false));
  drawerNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("is-open")) setOpen(false);
  });
})();
