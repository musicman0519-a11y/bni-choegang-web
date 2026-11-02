(async () => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const CATEGORIES = ["Consultant", "Medical", "Life event", "Finance & Insurance", "Social cooperative", "Marketing & Photo & IT", "Architecture & Interior", "Beauty & Tatoo & Hair", "Food & Beverage", "Power Team"];
  const SCHEDULE_TYPES = { meeting: "조찬회의", online: "화상회의", off: "회의없음", event: "행사" };

  const sb = await window.getSupabase();
  if (!sb) {
    $("#setupScreen").hidden = false;
    return;
  }

  // ── 공통 ───────────────────────────────────────────────
  let toastTimer;
  const toast = (message, isError = false) => {
    const box = $("#toast");
    box.textContent = message;
    box.classList.toggle("is-error", isError);
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, 3200);
  };
  const check = (result, okMessage) => {
    if (result.error) {
      console.error(result.error);
      toast(`문제가 생겼어요: ${result.error.message}`, true);
      return false;
    }
    if (okMessage) toast(okMessage);
    return true;
  };
  const formatDate = (iso) => new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  // 사진 올리기 → 공개 주소
  async function uploadImage(file, folder) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from("media").upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type || undefined });
    if (error) throw error;
    return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  }

  let myEmail = "";

  // ── 로그인 ─────────────────────────────────────────────
  async function showAdmin(session) {
    const { data: isAdmin, error } = await sb.rpc("is_admin");
    if (error || !isAdmin) {
      await sb.auth.signOut();
      $("#loginScreen").hidden = false;
      $("#adminApp").hidden = true;
      $("#loginMessage").textContent = error
        ? "데이터베이스 설정(schema.sql)이 아직 안 된 것 같아요. 안내 문서를 확인해 주세요."
        : "관리자로 등록되지 않은 계정이에요. schema.sql 의 관리자 이메일을 확인해 주세요.";
      return;
    }
    $("#loginScreen").hidden = true;
    $("#adminApp").hidden = false;
    $("#adminEmail").textContent = session.user.email;
    myEmail = session.user.email.toLowerCase();
    $("#demoBar").hidden = !window.__adminDemo;
    openTab("inquiries");
    refreshNewCount();
  }

  let signupMode = false;
  $("#signupToggle").addEventListener("click", () => {
    signupMode = !signupMode;
    $("#passwordConfirmField").hidden = !signupMode;
    $("#loginSubmit").textContent = signupMode ? "계정 만들기" : "로그인";
    $("#signupToggle").textContent = signupMode ? "이미 계정이 있어요. 로그인" : "처음이신가요? 계정 만들기";
    $(".login-card h1").textContent = signupMode ? "관리자 계정 만들기" : "관리자 로그인";
    $("#loginMessage").textContent = signupMode ? "관리자로 등록된 이메일만 계정을 만들 수 있어요." : "";
  });
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    $("#loginMessage").textContent = "";
    if (signupMode) {
      if (password.length < 8) { $("#loginMessage").textContent = "비밀번호는 8자 이상으로 정해 주세요."; return; }
      if (password !== form.elements.password2.value) { $("#loginMessage").textContent = "비밀번호 확인이 일치하지 않아요."; return; }
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split("?")[0] } });
      if (error) {
        $("#loginMessage").textContent = "계정을 만들 수 없어요. 관리자로 등록된 이메일인지 기존 관리자에게 확인해 주세요.";
        return;
      }
      form.reset();
      if (data.session) { showAdmin(data.session); return; }
      $("#signupToggle").click();
      $("#loginMessage").textContent = "계정을 만들었어요. 이메일로 온 확인 링크를 누른 뒤 로그인해 주세요.";
      return;
    }
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      $("#loginMessage").textContent = "이메일 또는 비밀번호가 맞지 않아요.";
      return;
    }
    form.reset();
    showAdmin(data.session);
  });
  $("#logoutButton").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });

  // ── 탭 ─────────────────────────────────────────────────
  const loaders = {};
  function openTab(name) {
    $$(".admin-tabs [data-tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.tab === name)));
    $$("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
    loaders[name]?.();
  }
  $$(".admin-tabs [data-tab]").forEach((tab) => tab.addEventListener("click", () => openTab(tab.dataset.tab)));
  $$("dialog [data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));

  // ── 문의 ───────────────────────────────────────────────
  async function refreshNewCount() {
    const { count } = await sb.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new");
    const badge = $("#newInquiryCount");
    badge.hidden = !count;
    badge.textContent = count || "";
  }
  loaders.inquiries = async () => {
    let query = sb.from("inquiries").select("*").order("created_at", { ascending: false }).limit(300);
    if ($("#inquiryKind").value) query = query.eq("kind", $("#inquiryKind").value);
    if ($("#inquiryStatus").value) query = query.eq("status", $("#inquiryStatus").value);
    const result = await query;
    if (!check(result)) return;
    const list = $("#inquiryList");
    if (!result.data.length) {
      list.innerHTML = '<p class="empty">해당하는 문의가 없어요.</p>';
      return;
    }
    list.innerHTML = result.data.map((item) => `
      <article class="inquiry ${item.status === "done" ? "is-done" : ""}" data-id="${item.id}">
        <header>
          <span class="kind kind-${item.kind}">${item.kind === "visitor" ? "비지터 신청" : "협업 문의"}</span>
          <strong>${esc(item.name)}</strong>
          <a href="tel:${esc(item.phone)}">${esc(item.phone)}</a>
          ${item.email ? `<a href="mailto:${esc(item.email)}">${esc(item.email)}</a>` : ""}
          <time>${formatDate(item.created_at)}</time>
        </header>
        <dl>
          ${item.company ? `<div><dt>회사</dt><dd>${esc(item.company)}</dd></div>` : ""}
          ${item.category ? `<div><dt>${item.kind === "visitor" ? "관심 업종" : "범위 · 분야"}</dt><dd>${esc(item.category)}</dd></div>` : ""}
          ${item.referrer ? `<div><dt>추천인</dt><dd>${esc(item.referrer)}</dd></div>` : ""}
        </dl>
        ${item.message ? `<p class="message">${esc(item.message)}</p>` : ""}
        <footer>
          <input class="memo" value="${esc(item.memo || "")}" placeholder="메모 (예: 10/15 통화 완료)" aria-label="메모" />
          <button class="btn btn-line" type="button" data-action="toggle">${item.status === "done" ? "새 문의로 되돌리기" : "처리 완료"}</button>
          <button class="btn btn-ghost danger" type="button" data-action="delete">삭제</button>
        </footer>
      </article>`).join("");
  };
  $("#inquiryKind").addEventListener("change", loaders.inquiries);
  $("#inquiryStatus").addEventListener("change", loaders.inquiries);
  $("#inquiryList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const card = button.closest(".inquiry");
    const id = card.dataset.id;
    if (button.dataset.action === "toggle") {
      const done = !card.classList.contains("is-done");
      if (check(await sb.from("inquiries").update({ status: done ? "done" : "new", memo: $(".memo", card).value.trim() || null }).eq("id", id), done ? "처리 완료로 바꿨어요." : "새 문의로 되돌렸어요.")) {
        loaders.inquiries();
        refreshNewCount();
      }
    }
    if (button.dataset.action === "delete" && confirm("이 문의를 삭제할까요? 되돌릴 수 없어요.")) {
      if (check(await sb.from("inquiries").delete().eq("id", id), "삭제했어요.")) {
        loaders.inquiries();
        refreshNewCount();
      }
    }
  });
  $("#inquiryList").addEventListener("change", async (event) => {
    if (!event.target.matches(".memo")) return;
    const id = event.target.closest(".inquiry").dataset.id;
    check(await sb.from("inquiries").update({ memo: event.target.value.trim() || null }).eq("id", id), "메모를 저장했어요.");
  });

  // ── 멤버 ───────────────────────────────────────────────
  let members = [];
  const memberForm = $("#memberForm");
  const mf = memberForm.elements; // 입력칸은 elements 로 접근 (form.name, form.title, form.id 는 폼 자체 속성이라 충돌)
  mf.category.innerHTML = CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join("");
  const photoOf = (row) => row.photo_url || `assets/images/member-${row.name}.jpg`;

  loaders.members = async () => {
    const result = await sb.from("members").select("*").order("sort_order").order("created_at");
    if (!check(result)) return;
    members = result.data;
    $("#memberSeed").hidden = members.length > 0;
    $("#staticMemberCount").textContent = (window.staticMembers || []).length;
    renderMembers();
  };
  function renderMembers() {
    const q = $("#memberSearch").value.trim().toLowerCase();
    const rows = members.filter((m) => !q || `${m.name} ${m.company} ${m.category} ${(m.tags || []).join(" ")}`.toLowerCase().includes(q));
    $("#memberRows").innerHTML = rows.map((m) => `
      <tr data-id="${m.id}">
        <td><img class="thumb" src="${esc(photoOf(m))}" alt="" loading="lazy" /></td>
        <td><strong>${esc(m.name)}</strong></td>
        <td>${esc(m.company)}${m.title ? ` · ${esc(m.title)}` : ""}</td>
        <td>${esc(m.category)}</td>
        <td>${m.grade ? `<span class="chip">${esc(m.grade)}</span>` : ""}${m.rank ? `<span class="chip chip-navy">${esc(m.rank)}</span>` : ""}</td>
        <td>${m.namecard_url ? '<span class="chip chip-ok">명함</span>' : '<span class="chip chip-off">명함 없음</span>'}${m.homepage ? `<a class="chip chip-ok" href="${esc(m.homepage)}" target="_blank" rel="noopener">홈페이지</a>` : '<span class="chip chip-off">링크 없음</span>'}</td>
        <td>${m.is_active ? "공개" : '<span class="muted">숨김</span>'}</td>
        <td><button class="btn btn-line btn-sm" type="button" data-edit="${m.id}">수정</button></td>
      </tr>`).join("") || '<tr><td colspan="8" class="empty">멤버가 없어요.</td></tr>';
  }
  $("#memberSearch").addEventListener("input", renderMembers);

  let editingMember = null;
  let pendingFiles = {};
  let clearCard = false;
  function openMemberEditor(row) {
    editingMember = row;
    pendingFiles = {};
    clearCard = false;
    memberForm.reset();
    $("#memberEditorTitle").textContent = row ? `${row.name} 수정` : "멤버 추가";
    $("#deleteMemberButton").hidden = !row;
    const value = row || { category: CATEGORIES[0], title: "대표", sort_order: 100, is_active: true };
    ["name", "category", "company", "title", "description", "grade", "rank", "homepage", "sort_order"].forEach((key) => {
      mf[key].value = value[key] ?? "";
    });
    mf.tags.value = (value.tags || []).join(", ");
    mf.is_active.checked = value.is_active !== false;
    const photo = $("#memberPhotoPreview");
    photo.src = row ? photoOf(row) : "";
    photo.hidden = !row;
    const card = $("#memberCardPreview");
    card.src = row?.namecard_url || "";
    card.hidden = !row?.namecard_url;
    $("#memberEditor").showModal();
  }
  const previewFile = (input, img, key) => input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    pendingFiles[key] = file;
    img.src = URL.createObjectURL(file);
    img.hidden = false;
    if (key === "namecard") clearCard = false;
  });
  previewFile(mf.photoFile, $("#memberPhotoPreview"), "photo");
  previewFile(mf.namecardFile, $("#memberCardPreview"), "namecard");
  $("#clearNamecard").addEventListener("click", () => {
    clearCard = true;
    delete pendingFiles.namecard;
    $("#memberCardPreview").hidden = true;
  });
  $("#addMemberButton").addEventListener("click", () => openMemberEditor(null));
  $("#memberRows").addEventListener("click", (event) => {
    const id = event.target.closest("[data-edit]")?.dataset.edit;
    if (id) openMemberEditor(members.find((m) => m.id === id));
  });

  memberForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveButton = $('[type="submit"]', memberForm);
    saveButton.disabled = true;
    try {
      const data = {
        name: mf.name.value.trim(),
        category: mf.category.value,
        company: mf.company.value.trim(),
        title: mf.title.value.trim(),
        description: mf.description.value.trim(),
        tags: mf.tags.value.split(",").map((t) => t.trim()).filter(Boolean),
        grade: mf.grade.value || null,
        rank: mf.rank.value.trim() || null,
        homepage: mf.homepage.value.trim() || null,
        sort_order: Number(mf.sort_order.value) || 100,
        is_active: mf.is_active.checked,
      };
      if (pendingFiles.photo) data.photo_url = await uploadImage(pendingFiles.photo, "members");
      if (pendingFiles.namecard) data.namecard_url = await uploadImage(pendingFiles.namecard, "namecards");
      if (clearCard) data.namecard_url = null;
      const result = editingMember
        ? await sb.from("members").update(data).eq("id", editingMember.id)
        : await sb.from("members").insert(data);
      if (check(result, "멤버를 저장했어요.")) {
        $("#memberEditor").close();
        loaders.members();
      }
    } catch (error) {
      toast(`사진을 올리지 못했어요: ${error.message}`, true);
    } finally {
      saveButton.disabled = false;
    }
  });
  $("#deleteMemberButton").addEventListener("click", async () => {
    if (!editingMember || !confirm(`${editingMember.name} 멤버를 삭제할까요? 잠시 숨기려면 '홈페이지에 공개'를 끄세요.`)) return;
    if (check(await sb.from("members").delete().eq("id", editingMember.id), "삭제했어요.")) {
      $("#memberEditor").close();
      loaders.members();
    }
  });
  $("#seedMembersButton").addEventListener("click", async () => {
    const rows = (window.staticMembers || []).map((m, index) => {
      const [company, title] = m.company.split(" · ");
      return {
        name: m.name, category: m.category, company: company || "", title: title || "", description: m.description || "",
        tags: m.tags || [], grade: m.grade || null, rank: m.rank || null, homepage: m.homepage || null,
        photo_url: `assets/images/member-${m.name}.jpg`, sort_order: (index + 1) * 10, is_active: true,
      };
    });
    if (check(await sb.from("members").insert(rows), `멤버 ${rows.length}명을 가져왔어요.`)) loaders.members();
  });

  // ── 블로그 ─────────────────────────────────────────────
  let posts = [];
  const postForm = $("#postForm");
  const pf = postForm.elements;
  loaders.posts = async () => {
    const [postResult, memberResult] = await Promise.all([
      sb.from("posts").select("*").order("created_at", { ascending: false }),
      sb.from("members").select("name, company, title").order("sort_order"),
    ]);
    if (!check(postResult)) return;
    posts = postResult.data;
    const names = memberResult.data?.length ? memberResult.data : (window.staticMembers || []).map((m) => ({ name: m.name, company: m.company.split(" · ")[0], title: m.company.split(" · ")[1] }));
    pf.member.innerHTML = '<option value="">선택 안 함</option>' + names.map((m) => `<option value="${esc(m.name)}" data-company="${esc(m.company)}" data-title="${esc(m.title || "")}">${esc(m.name)}</option>`).join("");
    $("#postSeed").hidden = posts.length > 0;
    $("#staticPostCount").textContent = (window.staticPosts || []).length;
    $("#postRows").innerHTML = posts.map((p) => `
      <tr>
        <td><strong>${esc(p.title)}</strong></td>
        <td>${esc(p.category)}</td>
        <td>${esc(p.member || "")}</td>
        <td>${esc(p.date)}</td>
        <td>${p.is_published ? "공개" : '<span class="muted">숨김</span>'}</td>
        <td><button class="btn btn-line btn-sm" type="button" data-edit="${esc(p.id)}">수정</button></td>
      </tr>`).join("") || '<tr><td colspan="6" class="empty">글이 없어요.</td></tr>';
  };
  let editingPost = null;
  let coverFile = null;
  let clearCover = false;
  pf.coverFile.addEventListener("change", () => {
    const file = pf.coverFile.files[0];
    if (!file) return;
    coverFile = file;
    clearCover = false;
    $("#postCoverPreview").src = URL.createObjectURL(file);
    $("#postCoverPreview").hidden = false;
  });
  $("#clearCover").addEventListener("click", () => {
    coverFile = null;
    clearCover = true;
    $("#postCoverPreview").hidden = true;
  });
  function openPostEditor(row) {
    editingPost = row;
    postForm.reset();
    coverFile = null;
    clearCover = false;
    $("#postCoverPreview").src = row?.cover_url || "";
    $("#postCoverPreview").hidden = !row?.cover_url;
    $("#postEditorTitle").textContent = row ? "뉴스 수정" : "새 뉴스 쓰기";
    $("#deletePostButton").hidden = !row;
    $("#viewPostLink").hidden = !row;
    if (row) $("#viewPostLink").href = `post.html?id=${encodeURIComponent(row.id)}`;
    const now = new Date();
    const value = row || { category: "멤버소개", date: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`, published_at: `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`, is_published: true };
    ["title", "category", "id", "member", "badge", "company", "role", "date", "published_at", "profile_field", "profile_strength", "profile_area", "region", "lead", "body", "video_url"].forEach((key) => {
      pf[key].value = value[key] ?? "";
    });
    pf.id.readOnly = Boolean(row);
    pf.is_published.checked = value.is_published !== false;
    $("#postEditor").showModal();
  }
  pf.member.addEventListener("change", () => {
    const option = pf.member.selectedOptions[0];
    if (!option?.value) return;
    if (!pf.company.value) pf.company.value = option.dataset.company || "";
    if (!pf.role.value) pf.role.value = option.dataset.title || "대표";
  });
  $("#addPostButton").addEventListener("click", () => openPostEditor(null));
  $("#postRows").addEventListener("click", (event) => {
    const id = event.target.closest("[data-edit]")?.dataset.edit;
    if (id) openPostEditor(posts.find((p) => p.id === id));
  });
  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = {};
    ["title", "category", "id", "member", "badge", "company", "role", "date", "published_at", "profile_field", "profile_strength", "profile_area", "region", "lead", "body", "video_url"].forEach((key) => {
      const v = pf[key].value.trim();
      data[key] = v || null;
    });
    data.badge = data.badge || "";
    data.body = data.body || "";
    data.date = data.date || "";
    data.is_published = pf.is_published.checked;
    try {
      if (coverFile) data.cover_url = await uploadImage(coverFile, "news");
    } catch (error) {
      toast(`이미지를 올리지 못했어요: ${error.message}`, true);
      return;
    }
    if (clearCover) data.cover_url = null;
    const result = editingPost
      ? await sb.from("posts").update(data).eq("id", editingPost.id)
      : await sb.from("posts").insert(data);
    if (check(result, "뉴스를 저장했어요.")) {
      $("#postEditor").close();
      loaders.posts();
    }
  });
  $("#deletePostButton").addEventListener("click", async () => {
    if (!editingPost || !confirm("이 글을 삭제할까요? 잠시 숨기려면 '홈페이지에 공개'를 끄세요.")) return;
    if (check(await sb.from("posts").delete().eq("id", editingPost.id), "삭제했어요.")) {
      $("#postEditor").close();
      loaders.posts();
    }
  });
  // 기존 글의 HTML 본문을 어드민 본문 형식(빈 줄 문단, ## 소제목, **굵게**)으로 바꿉니다.
  const htmlToText = (html) => {
    const box = document.createElement("div");
    box.innerHTML = html || "";
    return [...box.children].map((el) => {
      const text = el.innerHTML.replace(/<strong>(.*?)<\/strong>/g, "**$1**").replace(/<[^>]+>/g, "").trim();
      const plain = new DOMParser().parseFromString(text, "text/html").documentElement.textContent;
      return el.tagName === "H2" ? `## ${plain}` : plain;
    }).join("\n\n");
  };
  $("#seedPostsButton").addEventListener("click", async () => {
    const rows = (window.staticPosts || []).map((p, index) => ({
      id: p.id, category: p.category, badge: p.badge || "", title: p.title, member: p.member || null, role: p.role || null,
      company: p.company || null, date: p.date || "", published_at: p.publishedAt || null, region: p.region || null,
      profile_field: p.profile?.field || null, profile_strength: p.profile?.strength || null, profile_area: p.profile?.area || null,
      lead: p.lead || null, body: htmlToText(p.body), is_published: true,
      created_at: new Date(Date.now() - index * 60000).toISOString(),
    }));
    if (check(await sb.from("posts").insert(rows), `글 ${rows.length}개를 가져왔어요.`)) loaders.posts();
  });

  // ── 메인 배너 ──────────────────────────────────────────
  let banners = [];
  loaders.banners = async () => {
    const result = await sb.from("banners").select("*").order("sort_order").order("created_at");
    if (!check(result)) return;
    banners = result.data;
    $("#bannerSeed").hidden = banners.length > 0;
    $("#bannerGrid").innerHTML = banners.map((b, index) => `
      <figure class="banner-item ${b.is_active ? "" : "is-off"}" data-id="${b.id}">
        <img src="${esc(b.image_url)}" alt="배너 사진 ${index + 1}" loading="lazy" />
        <figcaption>
          <span>${index + 1}번째</span>
          <button class="btn btn-ghost btn-sm" type="button" data-move="-1" ${index === 0 ? "disabled" : ""} aria-label="앞으로">←</button>
          <button class="btn btn-ghost btn-sm" type="button" data-move="1" ${index === banners.length - 1 ? "disabled" : ""} aria-label="뒤로">→</button>
          <button class="btn btn-line btn-sm" type="button" data-toggle>${b.is_active ? "숨기기" : "보이기"}</button>
          <button class="btn btn-ghost btn-sm danger" type="button" data-delete>삭제</button>
        </figcaption>
      </figure>`).join("") || '<p class="empty">등록된 사진이 없어요.</p>';
  };
  $("#bannerUpload").addEventListener("change", async (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    toast("사진을 올리는 중이에요…");
    try {
      let order = banners.length ? Math.max(...banners.map((b) => b.sort_order)) : 0;
      for (const file of files) {
        order += 10;
        const url = await uploadImage(file, "banners");
        if (!check(await sb.from("banners").insert({ image_url: url, sort_order: order }))) return;
      }
      toast(`사진 ${files.length}장을 올렸어요.`);
      loaders.banners();
    } catch (error) {
      toast(`사진을 올리지 못했어요: ${error.message}`, true);
    }
  });
  $("#bannerGrid").addEventListener("click", async (event) => {
    const item = event.target.closest(".banner-item");
    if (!item) return;
    const index = banners.findIndex((b) => b.id === item.dataset.id);
    const banner = banners[index];
    if (event.target.closest("[data-move]")) {
      const other = banners[index + Number(event.target.closest("[data-move]").dataset.move)];
      if (!other) return;
      await sb.from("banners").update({ sort_order: other.sort_order }).eq("id", banner.id);
      await sb.from("banners").update({ sort_order: banner.sort_order === other.sort_order ? banner.sort_order + 1 : banner.sort_order }).eq("id", other.id);
      loaders.banners();
    } else if (event.target.closest("[data-toggle]")) {
      if (check(await sb.from("banners").update({ is_active: !banner.is_active }).eq("id", banner.id))) loaders.banners();
    } else if (event.target.closest("[data-delete]") && confirm("이 사진을 배너에서 삭제할까요?")) {
      if (check(await sb.from("banners").delete().eq("id", banner.id), "삭제했어요.")) loaders.banners();
    }
  });
  $("#seedBannersButton").addEventListener("click", async () => {
    const rows = ["assets/images/event-1.jpg", "assets/images/event-4.jpg", "assets/images/event-7.png"].map((url, i) => ({ image_url: url, sort_order: (i + 1) * 10 }));
    if (check(await sb.from("banners").insert(rows), "기본 사진 3장을 넣었어요.")) loaders.banners();
  });

  // ── 일정 ───────────────────────────────────────────────
  const scheduleForm = $("#scheduleForm");
  const sf = scheduleForm.elements;
  sf.type.addEventListener("change", () => {
    if (!sf.label.value || Object.values(SCHEDULE_TYPES).includes(sf.label.value)) sf.label.value = SCHEDULE_TYPES[sf.type.value];
  });
  sf.label.value = SCHEDULE_TYPES.meeting;
  loaders.schedule = async () => {
    const result = await sb.from("schedule").select("*").order("date");
    if (!check(result)) return;
    $("#scheduleRows").innerHTML = result.data.map((s) => `
      <tr data-date="${esc(s.date)}">
        <td>${esc(s.date)} (${"일월화수목금토"[new Date(`${s.date}T00:00:00`).getDay()]})</td>
        <td><span class="chip type-${esc(s.type)}">${esc(SCHEDULE_TYPES[s.type] || s.type)}</span></td>
        <td>${esc(s.label)}</td>
        <td>${esc(s.note || "")}</td>
        <td><button class="btn btn-ghost btn-sm danger" type="button" data-delete>삭제</button></td>
      </tr>`).join("") || '<tr><td colspan="5" class="empty">등록된 일정이 없어요. 매주 수요일 조찬회의만 표시되고 있어요.</td></tr>';
  };
  scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const row = { date: sf.date.value, type: sf.type.value, label: sf.label.value.trim(), note: sf.note.value.trim() || null };
    if (check(await sb.from("schedule").upsert(row), "일정을 저장했어요. 같은 날짜가 있으면 덮어써요.")) {
      scheduleForm.reset();
      sf.label.value = SCHEDULE_TYPES.meeting;
      loaders.schedule();
    }
  });
  $("#scheduleRows").addEventListener("click", async (event) => {
    if (!event.target.closest("[data-delete]")) return;
    const date = event.target.closest("tr").dataset.date;
    if (confirm(`${date} 일정을 삭제할까요?`) && check(await sb.from("schedule").delete().eq("date", date), "삭제했어요.")) loaders.schedule();
  });

  // ── 관리자 계정 ────────────────────────────────────────
  loaders.admins = async () => {
    const result = await sb.from("admins").select("*").order("created_at");
    if (!check(result)) return;
    const rows = result.data;
    $("#adminRows").innerHTML = rows.map((row) => {
      const me = row.email.toLowerCase() === myEmail;
      return `<tr data-email="${esc(row.email)}">
        <td><strong>${esc(row.email)}</strong>${me ? '<span class="chip chip-navy me-chip">나</span>' : ""}</td>
        <td>${esc(row.note || "")}</td>
        <td>${row.created_at ? formatDate(row.created_at) : ""}</td>
        <td>${me || rows.length <= 1 ? "" : '<button class="btn btn-ghost btn-sm danger" type="button" data-delete>삭제</button>'}</td>
      </tr>`;
    }).join("");
  };
  const adminAddForm = $("#adminAddForm");
  adminAddForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = adminAddForm.elements.email.value.trim().toLowerCase();
    const note = adminAddForm.elements.note.value.trim() || null;
    if (check(await sb.from("admins").insert({ email, note }), `${email} 을(를) 관리자로 등록했어요. 이제 그 이메일로 계정을 만들 수 있어요.`)) {
      adminAddForm.reset();
      loaders.admins();
    }
  });
  $("#adminRows").addEventListener("click", async (event) => {
    if (!event.target.closest("[data-delete]")) return;
    const email = event.target.closest("tr").dataset.email;
    if (!confirm(`${email} 의 관리자 권한을 삭제할까요? 삭제하면 로그인해도 관리자 페이지를 쓸 수 없어요.`)) return;
    if (check(await sb.from("admins").delete().eq("email", email), "관리자 권한을 삭제했어요.")) loaders.admins();
  });

  // ── 시작 ───────────────────────────────────────────────
  const { data: { session } } = await sb.auth.getSession();
  if (session) showAdmin(session);
  else $("#loginScreen").hidden = false;
})();
