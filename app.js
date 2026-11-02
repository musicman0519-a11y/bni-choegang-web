(() => {
  const memberGrid = document.querySelector("#memberGrid");
  const memberCount = document.querySelector("#memberCount");
  const chapterMembers = window.chapterMembers || [];

  const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const gradeClass = { "GOLD CLUB": "grade-gold", "GREEN CLUB": "grade-green", "GREEN LIGHT": "grade-green-light" };
  const gradeOrder = ["GOLD CLUB", "GREEN CLUB", "GREEN LIGHT"];
  const rankOrder = ["의장", "부의장", "ST"];
  const orderOf = (list, value) => (list.indexOf(value) + 1) || 99;
  const cardActions = (member) => `<div class="card-actions"><button class="card-btn-soft" type="button" data-namecard="${esc(member.name)}">명함보기</button><a class="card-btn-line" href="#" data-homepage="${esc(member.name)}">홈페이지 <span aria-hidden="true">→</span></a></div>`;
  const showcaseInfo = (member) => `<div class="showcase-info"><span class="showcase-category">${esc(member.category)}</span><h3>${esc(member.name)}</h3><p class="showcase-company">${esc(member.company)}</p><div class="showcase-tags">${member.tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div><p class="showcase-description">${esc(member.description)}</p>${cardActions(member)}</div>`;
  const gradeBadge = (member) => (member.grade ? `<span class="showcase-grade ${gradeClass[member.grade] || ""}">${esc(member.grade)}</span>` : "");
  const fillSection = (selector, items, render) => {
    const grid = document.querySelector(selector);
    if (!grid) return;
    grid.innerHTML = items.map(render).join("");
    const section = grid.closest("section");
    if (section) section.style.display = items.length ? "" : "none";
  };
  fillSection(".leadership-grid",
    chapterMembers.filter((member) => member.rank).sort((a, b) => orderOf(rankOrder, a.rank) - orderOf(rankOrder, b.rank)),
    (member) => `<article class="showcase-card leadership-card"><div class="showcase-photo"><img src="${esc(window.memberPhoto(member))}" alt="${esc(member.name)} ${esc(member.rank)}" loading="lazy" /><span class="showcase-bni" aria-label="BNI 멤버">BNI</span><span class="showcase-leader">리더</span>${gradeBadge(member)}<span class="showcase-rank">${esc(member.rank)}</span></div>${showcaseInfo(member)}</article>`);
  fillSection(".spotlight-grid",
    chapterMembers.filter((member) => member.grade === "GREEN LIGHT"),
    (member) => `<article class="spotlight-card"><img src="${esc(window.memberPhoto(member))}" alt="${esc(member.name)}" loading="lazy" /><div><span>GREEN LIGHT</span><h3>${esc(member.name)}</h3></div></article>`);
  fillSection(".recognition-grid",
    chapterMembers.filter((member) => member.grade).sort((a, b) => orderOf(gradeOrder, a.grade) - orderOf(gradeOrder, b.grade)),
    (member) => `<article class="showcase-card recognition-card"><div class="showcase-photo"><img src="${esc(window.memberPhoto(member))}" alt="${esc(member.name)} ${esc(member.grade)}" loading="lazy" /><span class="showcase-bni" aria-label="BNI 멤버">BNI</span>${gradeBadge(member)}</div>${showcaseInfo(member)}</article>`);

  // 메인 배너 사진: 어드민에서 등록한 사진이 있으면 교체
  const heroSlidesBox = document.querySelector(".hero-slides");
  if (heroSlidesBox && window.siteBanners?.length) {
    heroSlidesBox.replaceChildren(...window.siteBanners.map((url, index) => {
      const slide = document.createElement("span");
      slide.style.backgroundImage = `url("${encodeURI(url)}")`;
      if (index === 0) slide.classList.add("is-active");
      return slide;
    }));
  }

  if (memberGrid) {
    const fragment = document.createDocumentFragment();
    chapterMembers.forEach((member) => {
      const card = document.createElement("article");
      card.className = "member-card";
      card.dataset.category = member.category;
      card.dataset.search = `${member.name} ${member.category} ${member.company} ${member.description} ${member.tags.join(" ")}`.toLocaleLowerCase();

      const image = document.createElement("img");
      image.src = window.memberPhoto(member);
      image.alt = member.name;
      image.loading = "lazy";

      const photo = document.createElement("span");
      photo.className = "member-photo";
      photo.append(image);
      const badges = window.createMemberBadges?.(member);
      if (badges) photo.append(badges);
      card.append(photo);

      const category = document.createElement("span");
      category.textContent = member.category;
      const name = document.createElement("strong");
      name.textContent = member.name;
      const company = document.createElement("small");
      company.className = "member-company";
      company.textContent = member.company;
      const description = document.createElement("span");
      description.className = "member-description";
      description.textContent = member.description;
      const tags = document.createElement("span");
      tags.className = "member-tags";
      member.tags.forEach((tagText) => {
        const tag = document.createElement("span");
        tag.textContent = tagText;
        tags.append(tag);
      });
      const actions = document.createElement("div");
      actions.className = "card-actions";
      const namecardButton = document.createElement("button");
      namecardButton.className = "card-btn-soft";
      namecardButton.type = "button";
      namecardButton.dataset.namecard = member.name;
      namecardButton.textContent = "명함보기";
      const homepageLink = document.createElement("a");
      homepageLink.className = "card-btn-line";
      homepageLink.href = "#";
      homepageLink.dataset.homepage = member.name;
      homepageLink.innerHTML = '홈페이지 <span aria-hidden="true">→</span>';
      actions.append(namecardButton, homepageLink);
      card.append(category, name, company, description, tags, actions);
      fragment.append(card);
    });
    memberGrid.replaceChildren(fragment);
    if (memberCount) memberCount.textContent = `총 ${chapterMembers.length}명의 멤버`;
  }

  // 문의 접수: Supabase 가 연결되어 있으면 inquiries 표에 저장합니다.
  if (window.siteConfigured) document.querySelectorAll("[data-offline-note]").forEach((note) => { note.hidden = true; });
  function setupInquiryForm(formSelector, statusSelector, kind, toRow) {
    const form = document.querySelector(formSelector);
    const status = document.querySelector(statusSelector);
    if (!form) return;
    const show = (text, ok) => {
      if (!status) return;
      status.hidden = false;
      status.textContent = text;
      status.classList.toggle("is-success", ok);
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const sb = await window.getSupabase?.();
      if (!sb) {
        show("접수 시스템이 아직 연결되지 않아 내용은 전송되지 않았습니다. 접수 기능이 준비되면 다시 안내하겠습니다.", false);
        return;
      }
      const button = form.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      const clean = (value) => (value || "").trim() || null;
      const { error } = await sb.from("inquiries").insert({ kind, ...toRow(data, clean) });
      if (button) button.disabled = false;
      if (error) {
        console.error(error);
        show("전송 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.", false);
        return;
      }
      form.reset();
      show("접수되었습니다. 담당자가 확인 후 연락드리겠습니다.", true);
    });
  }
  setupInquiryForm("#visitorForm", "#visitorFormStatus", "visitor", (data, clean) => ({
    name: clean(data.name), phone: clean(data.phone), email: clean(data.email), company: clean(data.company),
    category: clean(data.category), referrer: clean(data.referrer), message: clean(data.message),
  }));
  setupInquiryForm("#collaborationForm", "#collaborationFormStatus", "collab", (data, clean) => ({
    name: clean(data.name), phone: clean(data.phone), email: clean(data.email), company: clean(data.company),
    category: [clean(data.scope), clean(data.category)].filter(Boolean).join(" / ") || null, message: clean(data.message),
  }));


  const memberCards = [...document.querySelectorAll(".member-card")];
  const filterButtons = [...document.querySelectorAll(".filter-button")];
  const searchInput = document.querySelector("#memberSearch");
  const noMembers = document.querySelector("#noMembers");
  let selectedCategory = "all";

  function filterMembers() {
    const query = (searchInput?.value || "").trim().toLocaleLowerCase();
    let visibleCount = 0;
    memberCards.forEach((card) => {
      const matchesCategory = selectedCategory === "all" || card.dataset.category === selectedCategory;
      const matchesQuery = !query || card.dataset.search.toLocaleLowerCase().includes(query);
      const visible = matchesCategory && matchesQuery;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    if (memberCount) memberCount.textContent = `총 ${visibleCount}명의 멤버`;
    if (noMembers) noMembers.hidden = visibleCount > 0;
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.filter;
      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      filterMembers();
    });
  });
  searchInput?.addEventListener("input", filterMembers);

  document.querySelectorAll(".category-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedCategory = card.dataset.category;
      filterButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.filter === selectedCategory));
      filterMembers();
    });
  });


  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 메인 배너 배경 사진 전환
  const heroSlides = [...document.querySelectorAll(".hero-slides span")];
  if (heroSlides.length > 1 && !reduceMotion) {
    let heroIndex = 0;
    setInterval(() => {
      heroSlides[heroIndex].classList.remove("is-active");
      heroIndex = (heroIndex + 1) % heroSlides.length;
      heroSlides[heroIndex].classList.add("is-active");
    }, 6000);
  }

  // 숫자 카운트업: 화면에 보이면 0부터 data-count 값까지 올라갑니다.
  const counters = [...document.querySelectorAll(".count-up")];
  counters.forEach((counter) => {
    if (counter.dataset.source === "members" && chapterMembers.length) counter.dataset.count = chapterMembers.length;
    counter.textContent = Number(counter.dataset.count).toLocaleString("ko-KR");
  });
  const runCounter = (counter) => {
    const target = Number(counter.dataset.count) || 0;
    const duration = 2000;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = Math.round(target * eased).toLocaleString("ko-KR");
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (counters.length && !reduceMotion && "IntersectionObserver" in window) {
    counters.forEach((counter) => { counter.textContent = "0"; });
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    counters.forEach((counter) => counterObserver.observe(counter));
  }

  const backToTop = document.querySelector(".back-to-top");
  window.addEventListener("scroll", () => {
    backToTop?.classList.toggle("is-visible", window.scrollY > 500);
  }, { passive: true });
  backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
})();
