(() => {
  const posts = window.blogPosts || [];
  const members = new Map((window.chapterMembers || []).map((member) => [member.name, member]));
  const photo = (name) => (members.has(name) ? window.memberPhoto(members.get(name)) : `assets/images/member-${name}.jpg`);
  const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // 어드민에서 쓴 본문을 HTML 로 바꿉니다: 빈 줄 = 문단, "## " = 소제목, **굵게**
  const formatBody = (text) => String(text || "").split(/\n\s*\n/).map((block) => {
    const trimmed = block.trim();
    const html = escapeHtml(trimmed).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br />");
    if (!html) return "";
    return trimmed.startsWith("## ") ? `<h2>${html.replace(/^##\s+/, "")}</h2>` : `<p>${html}</p>`;
  }).join("\n");
  const calendarIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/></svg>';

  // 영상 주소 → 유튜브 아이디
  const youtubeId = (url) => {
    const match = String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return match ? match[1] : "";
  };
  // 카드 이미지: 대표 이미지 → 유튜브 썸네일 → 멤버 사진
  const coverOf = (post) => {
    if (post.cover) return post.cover;
    const id = youtubeId(post.video);
    if (id) return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    return post.member ? photo(post.member) : "assets/images/event-1.jpg";
  };
  const playIcon = '<span class="video-badge" aria-label="영상"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z"/></svg></span>';
  const excerptOf = (post, length = 110) => {
    const source = post.lead || post.bodyText || String(post.body || "").replace(/<[^>]+>/g, " ");
    const text = source.replace(/\*\*|##/g, "").replace(/\s+/g, " ").trim();
    return text.length > length ? `${text.slice(0, length)} […]` : text;
  };
  const sourceOf = (post) => (post.member ? `${post.company || ""} ${post.member}`.trim() : post.company || "최강챕터");
  const videoEmbed = (url) => {
    const id = youtubeId(url);
    if (id) return `<div class="post-video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="영상" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url || "")) return `<div class="post-video"><video src="${escapeHtml(url)}" controls preload="metadata"></video></div>`;
    return url ? `<p class="post-video-link"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">영상 보기 →</a></p>` : "";
  };

  // 메인 페이지: 최신 뉴스 4개
  const homeNews = document.querySelector("#homeNews");
  if (homeNews) {
    const latest = posts.slice(0, 4);
    homeNews.innerHTML = latest.map((post) => `
      <a class="news-tile" href="post.html?id=${encodeURIComponent(post.id)}">
        <span class="news-tile-media"><img src="${escapeHtml(coverOf(post))}" alt="" loading="lazy" />${post.video ? playIcon : ""}</span>
        <h3>${escapeHtml(post.title)}</h3>
        <span class="news-tile-source">(${escapeHtml(sourceOf(post))})</span>
        <time>${escapeHtml(post.publishedAt || post.date)}</time>
        <p>${escapeHtml(excerptOf(post))}</p>
      </a>`).join("");
    const section = homeNews.closest("section");
    if (section && !latest.length) section.style.display = "none";
  }

  // 목록 페이지
  const grid = document.querySelector("#blogGrid");
  if (grid) {
    const filters = [...document.querySelectorAll(".blog-filter")];
    const empty = document.querySelector("#blogEmpty");

    grid.innerHTML = posts.map((post) => `
      <a class="blog-card" href="post.html?id=${encodeURIComponent(post.id)}" data-category="${escapeHtml(post.category)}">
        <div class="blog-card-photo${post.cover || post.video ? " is-cover" : ""}"><img src="${escapeHtml(coverOf(post))}" alt="" loading="lazy" />${post.video ? playIcon : ""}</div>
        <div class="blog-card-body">
          ${post.badge ? `<span class="blog-badge">${escapeHtml(post.badge)}</span>` : ""}
          <h2>${escapeHtml(post.title)}</h2>
          <p class="blog-card-meta">${post.member ? `<strong>${escapeHtml(post.member)} ${escapeHtml(post.role || "")}</strong> · ${escapeHtml(post.company || "")}` : escapeHtml(excerptOf(post, 50))}</p>
          <div class="blog-card-foot"><span>${calendarIcon}${escapeHtml(post.date)}</span><b>스토리 읽기 →</b></div>
        </div>
      </a>`).join("");

    const cards = [...grid.querySelectorAll(".blog-card")];
    const applyFilter = (category) => {
      let visible = 0;
      cards.forEach((card) => {
        const show = category === "전체" || card.dataset.category === category;
        card.hidden = !show;
        if (show) visible += 1;
      });
      filters.forEach((button) => button.classList.toggle("is-active", button.dataset.category === category));
      if (empty) empty.hidden = visible > 0;
    };
    filters.forEach((button) => button.addEventListener("click", () => applyFilter(button.dataset.category)));
    applyFilter("전체");
  }

  // 상세 페이지
  const article = document.querySelector("#blogPost");
  if (article) {
    const id = new URLSearchParams(location.search).get("id");
    const post = posts.find((item) => item.id === id);
    if (!post) {
      article.innerHTML = '<a class="post-back" href="blog.html">← 뉴스 목록</a><h1 class="post-title">글을 찾을 수 없습니다</h1><p>주소가 바뀌었거나 삭제된 글입니다. 블로그 목록에서 다시 찾아 주세요.</p>';
      return;
    }
    const member = members.get(post.member) || {};
    const tags = member.tags || [];
    const profile = post.profile || { field: post.badge, strength: tags.join(", "), area: "고양·일산" };
    document.title = `${post.title} | BNI 고양지역 최강챕터`;
    // 본문이 비어 있는 멤버 소개 글은 '준비 중' 안내를 보여 줍니다.
    const bodyHtml = post.body || formatBody(post.bodyText)
      || (post.member ? `<p>${escapeHtml(member.description || "")}</p><p class="post-pending">상세 소개 글을 준비하고 있습니다. 먼저 전문가 연결이 필요하시면 아래 버튼으로 문의해 주세요.</p>` : "");

    article.innerHTML = `
      <a class="post-back" href="blog.html">← 뉴스 목록</a>
      <h1 class="post-title">${escapeHtml(post.title)}</h1>
      <p class="post-date">${escapeHtml(sourceOf(post))} · ${escapeHtml(post.publishedAt || post.date)}</p>
      ${post.member ? `<div class="post-profile">
        <img src="${photo(post.member)}" alt="${escapeHtml(post.member)}" />
        <div>
          <span>BNI 최강챕터 공인 비즈니스 마스터</span>
          <strong>${escapeHtml(post.company)} ${escapeHtml(post.member)} ${escapeHtml(post.role)}</strong>
          <p><b>전문분야:</b> ${escapeHtml(profile.field)} | <b>핵심역량:</b> ${escapeHtml(profile.strength)} | <b>활동지역:</b> ${escapeHtml(profile.area)}</p>
        </div>
      </div>` : ""}
      ${post.lead ? `<blockquote class="post-lead">${escapeHtml(post.lead)}</blockquote>` : ""}
      ${videoEmbed(post.video)}
      <div class="post-body">
        ${bodyHtml}
      </div>
      <div class="post-cta-box">
        <h2>BNI 최강챕터 비즈니스 조찬 참관 안내</h2>
        <p>매주 수요일 아침, 신뢰할 수 있는 지역 대표님들과의 비즈니스 네트워킹을 경험해보세요.</p>
        <a class="button post-cta-button" href="visitor.html">조찬 비지터 신청하기</a>
      </div>
      ${post.member ? `<p class="post-member-label">이 글의 멤버</p>
      <div class="post-member">
        <div class="post-member-info">
          <img src="${photo(post.member)}" alt="" />
          <div>
            ${post.region ? `<span class="post-member-region">${escapeHtml(post.region)}</span>` : ""}
            <strong>${escapeHtml(post.member)}</strong>
            <small>${escapeHtml(post.company)} · ${escapeHtml(post.role)}</small>
            ${tags.length ? `<p>${tags.map(escapeHtml).join(", ")}</p>` : ""}
          </div>
        </div>
        <div class="post-member-actions">
          <a class="primary" href="contact.html">전문가 연결 문의</a>
          <a href="experts.html?q=${encodeURIComponent(post.member)}">챕터 프로필</a>
        </div>
      </div>` : ""}
      <div class="post-bottom-actions">
        <a class="button post-cta-button" href="visitor.html">조찬모임 참석하기</a>
        <a class="button post-outline-button" href="contact.html">비즈니스 협업 문의</a>
      </div>`;
  }
})();
