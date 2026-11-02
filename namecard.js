(() => {
  const chapterMembers = window.chapterMembers || [];
  // 명함보기: 어드민에서 올린 명함 또는 assets/images/namecard-이름.jpg 가 있으면 그 명함 이미지를, 없으면 멤버 정보로 만든 명함을 보여줍니다.
  const namecardButtons = document.querySelectorAll("[data-namecard]");
  const memberByName = new Map(chapterMembers.map((member) => [member.name, member]));

  // 홈페이지 버튼: experts.js 에 homepage 주소가 있으면 그 사이트(새 창)로,
  // 아직 없으면 전문가 찾기의 해당 멤버 프로필로 연결합니다.
  document.querySelectorAll("[data-homepage]").forEach((link) => {
    const name = link.dataset.homepage;
    const url = memberByName.get(name)?.homepage;
    if (url) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
    } else {
      link.href = `experts.html?q=${encodeURIComponent(name)}`;
    }
  });

  if (namecardButtons.length) {
    const dialog = document.createElement("dialog");
    dialog.className = "namecard-dialog";
    dialog.innerHTML = `
      <div class="namecard-head">
        <h3 class="namecard-title"></h3>
        <button class="namecard-close" type="button" aria-label="닫기" data-close>×</button>
      </div>
      <div class="namecard-sides">
        <div class="namecard-side namecard-front">
          <img class="namecard-image" alt="" />
          <div class="namecard-made">
            <div class="namecard-made-text">
              <strong class="namecard-headline"></strong>
              <p class="namecard-who"><b class="namecard-company"></b> <span class="namecard-role"></span> <b class="namecard-name"></b></p>
              <p class="namecard-desc"></p>
              <ul class="namecard-points"></ul>
            </div>
            <img class="namecard-photo" alt="" />
            <img class="namecard-logo" src="assets/images/logo-cg.svg" alt="" />
          </div>
        </div>
        <div class="namecard-side namecard-back">
          <p class="namecard-slogan"><span class="namecard-field"></span> - <b class="namecard-brand"></b></p>
          <div class="namecard-tags"></div>
        </div>
      </div>`;
    document.body.append(dialog);
    const $ = (selector) => dialog.querySelector(selector);

    const fill = (member) => {
      const [company, role] = member.company.split(" · ");
      const field = member.tags[0] || member.category;
      $(".namecard-title").textContent = company;
      dialog.setAttribute("aria-label", `${company} ${member.name} 명함`);

      // 앞면: 명함 이미지가 있으면 이미지, 없으면 정보로 만든 명함
      const image = $(".namecard-image");
      const made = $(".namecard-made");
      image.hidden = true;
      made.hidden = false;
      image.alt = `${company} ${member.name} 명함`;
      image.onload = () => { image.hidden = false; made.hidden = true; };
      image.removeAttribute("src");
      image.src = member.namecard || `assets/images/namecard-${member.name}.jpg`;

      $(".namecard-headline").textContent = field;
      $(".namecard-company").textContent = company;
      $(".namecard-role").textContent = role || "";
      $(".namecard-name").textContent = member.name;
      $(".namecard-desc").textContent = member.description;
      $(".namecard-points").replaceChildren(...member.tags.map((tag) => {
        const item = document.createElement("li");
        item.textContent = tag;
        return item;
      }));
      $(".namecard-photo").src = window.memberPhoto(member);

      // 뒷면
      $(".namecard-field").textContent = field;
      $(".namecard-brand").textContent = company;
      $(".namecard-tags").replaceChildren(...member.tags.map((tag) => {
        const chip = document.createElement("span");
        chip.textContent = tag;
        return chip;
      }));
    };

    namecardButtons.forEach((button) => button.addEventListener("click", () => {
      const member = memberByName.get(button.dataset.namecard);
      if (!member) return;
      fill(member);
      dialog.showModal();
    }));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target.closest("[data-close]")) dialog.close();
    });
  }
})();
