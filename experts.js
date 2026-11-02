(() => {
  // 기본 멤버 데이터 (Supabase 에 멤버가 등록되면 그 데이터가 대신 쓰입니다)
  const staticMembers = [
    { name: "박웅희", category: "Consultant", company: "GW법률사무소 · 대표", description: "상담은 충분히, 소송은 신중히. 재판은 끝까지 함께합니다.", tags: ["법률자문", "민사", "이혼"], grade: "GOLD CLUB" },
    { name: "윤성기", category: "Consultant", company: "세무법인아크로 가산점 · 대표", description: "고객의 미래가치와 기업의 성장을 함께하는 세무 파트너입니다.", tags: ["세무컨설팅", "기장대행", "경리대행"] },
    { name: "박승호", category: "Consultant", company: "법무법인 정윤 · 대표", description: "법률 상담과 사건 관련 문의를 도와드립니다.", tags: ["법률자문", "형사", "소송"] },
    { name: "송윤석", category: "Medical", company: "레이퀸 피부과 · 대표", description: "여드름, 발톱무좀, 보톡스 등 피부 건강을 진료합니다.", tags: ["피부과", "발톱무좀", "보톡스"], grade: "GREEN CLUB" },
    { name: "김경민", category: "Medical", company: "연오재한의원 · 대표", description: "나에게 맞는 선택을 돕는 한의원 진료와 클리닉을 운영합니다.", tags: ["진단 검사센터", "맞춤한약", "질환별 클리닉"], rank: "부의장" },
    { name: "변석호", category: "Medical", company: "동그라미치과 · 대표", description: "대학병원 교수 출신 원장이 직접 진료하는 구강 케어.", tags: ["최신장비", "임플란트", "소독"] },
    { name: "양정숙", category: "Life event", company: "데시앙 플라워 · 대표", description: "졸업·축하·근조 화환과 꽃바구니를 전국으로 배달합니다.", tags: ["꽃배달", "화환", "꽃바구니"], grade: "GREEN CLUB" },
    { name: "최세은", category: "Life event", company: "오티콘보청기 일산센터 · 대표", description: "덴마크 오티콘 보청기 상담과 피팅을 지원합니다.", tags: ["보청기", "피팅", "난청"], grade: "GREEN LIGHT" },
    { name: "이재상", category: "Life event", company: "컨티뉴 · 대표", description: "자동차 외형 복원, 덴트와 도색을 전문으로 합니다.", tags: ["차량정비 1급", "덴트", "도색"] },
    { name: "이상일", category: "Life event", company: "서준코퍼레이션 · 대표", description: "국산·수입 전 차종 신차와 장기 렌트카를 안내합니다.", tags: ["신차", "리스", "장기렌트카"] },
    { name: "이우빈", category: "Life event", company: "기아자동차 · 매니저", description: "차량 선택부터 인도까지 편안한 구매 과정을 안내합니다.", tags: ["기아자동차", "맞춤금융설계", "차량구매"] },
    { name: "정영현", category: "Life event", company: "노인장기보험 방문요양 · 시설장", description: "어르신을 믿음과 정성으로 섬기는 방문요양 센터입니다.", tags: ["방문요양", "노인장기요양", "시니어 케어"] },
    { name: "최수나", category: "Life event", company: "더 리본 · 대표", description: "고객과 소통하며 진심을 담은 상조·장례 서비스를 제공합니다.", tags: ["상조", "장례서비스", "의전"] },
    { name: "김태영", category: "Life event", company: "살롱드수 · 대표", description: "개인에게 어울리는 맞춤형 헤어 스타일과 시술을 제안합니다.", tags: ["헤어디자이너", "헤어", "미용"] },
    { name: "박정호", category: "Life event", company: "YL통신 휴대폰 성지 화정점 · 대표", description: "휴대폰과 통신 서비스 상담을 도와드립니다.", tags: ["휴대폰", "통신", "전자기기"] },
    { name: "강범수", category: "Finance & Insurance", company: "인카금융서비스 · 대표", description: "대물·화재보험 등 보험 상담을 지원합니다.", tags: ["대물보험", "화재보험", "보험"] },
    { name: "이정우", category: "Finance & Insurance", company: "에이플러스에셋 · 대표", description: "은퇴 설계와 연금·화재보험 상담을 제공합니다.", tags: ["연금보험", "은퇴설계", "화재보험"] },
    { name: "김희심", category: "Finance & Insurance", company: "고양축산농협 · 지점장", description: "개인·법인 금융과 대출, 카드, 예적금 서비스를 안내합니다.", tags: ["금융서비스", "대출", "예적금"] },
    { name: "이병길", category: "Finance & Insurance", company: "인카금융서비스 · 대표", description: "보험 상담과 보장 관련 문의를 도와드립니다.", tags: ["보험", "보장분석", "금융"] },
    { name: "안연원", category: "Social cooperative", company: "사회적협동조합 다시시작 · 대표", description: "천연비누와 야채수, 암환자의 사회 복귀를 지원합니다.", tags: ["사회적협동조합", "암환자 케어", "천연비누"] },
    { name: "이경세", category: "Marketing & Photo & IT", company: "이경세 마케팅 연구소 · 대표", description: "온라인 광고와 플레이스 광고를 통한 마케팅을 지원합니다.", tags: ["온라인광고", "플레이스광고", "마케팅"], rank: "의장" },
    { name: "박종운", category: "Marketing & Photo & IT", company: "샵에이원 · 대표", description: "광고·홍보에 필요한 인물·제품 사진과 영상을 촬영합니다.", tags: ["사진촬영", "제품사진", "영상"], rank: "ST" },
    { name: "김현영", category: "Architecture & Interior", company: "연합아이디 · 대표", description: "외식 프랜차이즈 상가·백화점·쇼핑몰 인테리어와 원복 공사를 합니다.", tags: ["상업 인테리어", "철거원복공사", "인테리어"], grade: "GREEN LIGHT" },
    { name: "정상규", category: "Architecture & Interior", company: "금보이앤씨 · 대표", description: "실내외 사인물과 인테리어 디자인, 조형·철골 구조물을 다룹니다.", tags: ["간판", "사이니지", "인테리어"] },
    { name: "전아름", category: "Architecture & Interior", company: "대림키친 · 대표", description: "업소용 주방 설비와 주방용품을 제공하는 토탈 솔루션 기업입니다.", tags: ["주방설비", "주방용품", "업소용 그릇"] },
    { name: "이영권", category: "Architecture & Interior", company: "조화닷컴 · 대표", description: "조화와 플랜테리어, 조경 관련 상담을 도와드립니다.", tags: ["조화", "플랜테리어", "조경"] },
    { name: "박성찬", category: "Architecture & Interior", company: "하나종합건설 · 대표", description: "누수 탐지와 수리, 피해 복구를 진행합니다.", tags: ["누수 탐지", "수리", "피해복구"] },
    { name: "박상현", category: "Architecture & Interior", company: "청소마법사 · 대표", description: "공간을 쾌적하고 아름답게 관리하는 청소 서비스를 제공합니다.", tags: ["종합청소", "특수청소", "청소"] },
    { name: "김하정", category: "Beauty & Tatoo & Hair", company: "노블엠 · 대표", description: "반영구 문신, 눈썹 문신과 헤어 문신을 진행합니다.", tags: ["반영구문신", "눈썹문신", "헤어문신"] },
  ];
  window.staticMembers = staticMembers;
  const expertDetails = window.siteMembers || staticMembers;
  window.chapterMembers = expertDetails;
  window.memberPhoto = (member) => member.photo || `assets/images/member-${member.name}.jpg`;

  // 등급(GOLD CLUB 등)·직급(의장 등) 배지를 사진 아래쪽에 붙입니다. 메인 멤버 목록과 전문가 찾기에서 함께 씁니다.
  window.createMemberBadges = (member) => {
    if (!member || (!member.grade && !member.rank)) return null;
    const stack = document.createElement("span");
    stack.className = "member-badges";
    if (member.grade) {
      const grade = document.createElement("span");
      grade.className = `member-badge grade-${member.grade.toLowerCase().replaceAll(" ", "-")}`;
      grade.textContent = member.grade;
      stack.append(grade);
    }
    if (member.rank) {
      const rank = document.createElement("span");
      rank.className = "member-badge badge-rank";
      rank.textContent = member.rank;
      stack.append(rank);
    }
    return stack;
  };
  if (!document.querySelector("#expertGrid")) return;

  // 카드는 멤버 데이터로 만듭니다.
  const cards = expertDetails.map((expert) => {
    const card = document.createElement("article");
    card.className = "expert-card";
    const photo = document.createElement("div");
    photo.className = "expert-photo";
    const image = document.createElement("img");
    image.src = window.memberPhoto(expert);
    image.alt = `${expert.name} 전문가`;
    image.loading = "lazy";
    photo.append(image);
    const info = document.createElement("div");
    info.className = "expert-info";
    card.append(photo, info);
    return card;
  });
  const sidebarButtons = [...document.querySelectorAll(".sidebar-filter")];
  const queryChips = [...document.querySelectorAll(".directory-chip")];
  const searchForm = document.querySelector(".directory-search");
  const searchInput = document.querySelector("#expertSearch");
  const sortSelect = document.querySelector("#expertSort");
  const grid = document.querySelector("#expertGrid");
  const count = document.querySelector("#expertCount");
  const emptyState = document.querySelector("#directoryEmpty");
  const params = new URLSearchParams(window.location.search);
  const requestedCategory = params.get("category");
  const requestedQuery = params.get("q");
  const categories = new Set(expertDetails.map((expert) => expert.category));
  let selectedCategory = categories.has(requestedCategory) ? requestedCategory : "all";
  if (requestedQuery && searchInput) searchInput.value = requestedQuery;

  function renderDetails(card, expert) {
    if (!expert) return;
    card.dataset.category = expert.category;
    card.dataset.search = `${expert.name} ${expert.company} ${expert.description} ${expert.tags.join(" ")}`.toLocaleLowerCase();
    const photo = card.querySelector(".expert-photo");
    const badges = window.createMemberBadges(expert);
    if (badges) photo.append(badges);
    const info = card.querySelector(".expert-info");
    info.replaceChildren();
    const category = document.createElement("span");
    category.className = "expert-category";
    category.textContent = expert.category;
    const name = document.createElement("h2");
    name.textContent = expert.name;
    const company = document.createElement("p");
    company.className = "expert-company";
    company.textContent = expert.company;
    const description = document.createElement("p");
    description.className = "expert-description";
    description.textContent = expert.description;
    const tags = document.createElement("div");
    tags.className = "expert-tags";
    expert.tags.forEach((tagText) => {
      const tag = document.createElement("span");
      tag.textContent = tagText;
      tags.append(tag);
    });
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const namecardButton = document.createElement("button");
    namecardButton.className = "card-btn-soft";
    namecardButton.type = "button";
    namecardButton.dataset.namecard = expert.name;
    namecardButton.textContent = "명함보기";
    const homepageLink = document.createElement("a");
    homepageLink.className = "card-btn-line";
    homepageLink.href = "#";
    homepageLink.dataset.homepage = expert.name;
    homepageLink.innerHTML = '홈페이지 <span aria-hidden="true">→</span>';
    actions.append(namecardButton, homepageLink);
    info.append(category, name, company, description, tags, actions);
  }

  cards.forEach((card, index) => renderDetails(card, expertDetails[index]));
  grid?.replaceChildren(...cards);

  function update() {
    const query = (searchInput?.value || "").trim().toLocaleLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const sort = sortSelect?.value || "default";
    const orderedCards = [...cards];

    if (sort === "name") {
      orderedCards.sort((a, b) => a.querySelector("h2").textContent.localeCompare(b.querySelector("h2").textContent, "ko"));
    } else if (sort === "category") {
      orderedCards.sort((a, b) => a.dataset.category.localeCompare(b.dataset.category) || a.querySelector("h2").textContent.localeCompare(b.querySelector("h2").textContent, "ko"));
    } else {
      orderedCards.sort((a, b) => expertDetails.findIndex((expert) => expert.name === a.querySelector("h2").textContent) - expertDetails.findIndex((expert) => expert.name === b.querySelector("h2").textContent));
    }

    orderedCards.forEach((card) => {
      grid?.append(card);
      const matchesCategory = selectedCategory === "all" || card.dataset.category === selectedCategory;
      const matchesQuery = terms.every((term) => card.dataset.search.includes(term));
      card.hidden = !(matchesCategory && matchesQuery);
    });

    const visibleCount = orderedCards.filter((card) => !card.hidden).length;
    if (count) count.textContent = String(visibleCount);
    if (emptyState) emptyState.hidden = visibleCount > 0;
    sidebarButtons.forEach((button) => {
      const active = button.dataset.category === selectedCategory;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    queryChips.forEach((button) => {
      const active = terms.length > 0 && query === button.dataset.query.toLocaleLowerCase();
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  sidebarButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;
      if (searchInput) searchInput.value = "";
      update();
    });
  });
  queryChips.forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory = "all";
      if (searchInput) searchInput.value = button.dataset.query;
      update();
    });
  });
  searchInput?.addEventListener("input", update);
  sortSelect?.addEventListener("change", update);
  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    update();
  });


  update();
})();
