// 정적 노출 파일 생성기
//   - 정적 페이지 <head> 에 메타 블록(canonical·OG·twitter·robots)과 JSON-LD 블록 삽입(마커로 멱등)
//   - blog/<글id>/index.html, member/<이름>/index.html 정적 페이지
//   - sitemap.xml, robots.txt, llms.txt
// 사용: node tools/build/prerender.js      (모든 주소는 site.config.json 의 origin 기준)
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const ORIGIN = config.origin.replace(/\/+$/, "");
const url = (p = "") => `${ORIGIN}/${String(p).replace(/^\/+/, "")}`;
const today = new Date().toISOString().slice(0, 10);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const write = (rel, content) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\r\n/g, "\n"), "utf8");
  return rel;
};
// 과장·의료광고 표현 필터 (메타·스키마 문구에만 적용)
const BLOCKED = /최고|최다|유일|1\s*등|완치|부작용\s*없|100\s*%|(?:원금|수익|성공|무조건)\s*보장|기적|절대\s*안전|No\.?\s*1/gi;
const safe = (s, fallback = "") => { const t = String(s || "").replace(BLOCKED, "").replace(/\s{2,}/g, " ").trim(); return t || fallback; };
const plain = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const clip = (s, n = 155) => (s.length > n ? s.slice(0, n - 1).trim() + "…" : s);
const isoDate = (post) => {
  const m = String(post.publishedAt || "").match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const d = String(post.date || "").match(/(\d{4})\.(\d{1,2})/);
  return d ? `${d[1]}-${d[2].padStart(2, "0")}-01` : today;
};
const ldScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
const ORG_ID = url("#organization");
const WEBSITE_ID = url("#website");

// ── 사이트 데이터 로드 (experts.js · blog-data.js · blog-legacy.js 를 브라우저 흉내로 실행) ──
const sandbox = { window: {}, document: { querySelector: () => null, querySelectorAll: () => [], currentScript: null }, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
for (const f of ["experts.js", "blog-data.js", "blog-legacy.js"]) vm.runInContext(read(f), sandbox, { filename: f });
const members = sandbox.window.staticMembers;
const posts = sandbox.window.staticPosts;
const memberByName = new Map(members.map((m) => [m.name, m]));
const splitCompany = (m) => { const [company, role] = String(m.company).split(" · "); return { company, role: role || "" }; };
const memberPhoto = (m) => `assets/images/member-${m.name}.jpg`;
const namecardOf = (m) => (exists(`assets/images/namecard-${m.name}.jpg`) ? `assets/images/namecard-${m.name}.jpg` : "");
const memberPath = (m) => `member/${encodeURIComponent(m.name)}/`;
const postPath = (p) => `blog/${encodeURIComponent(p.id)}/`;
const localBusiness = new RegExp(config.localBusinessMatch);

// ── 공통 JSON-LD 조각 ───────────────────────────────────
const organization = () => ({
  "@type": "Organization", "@id": ORG_ID, name: config.name, alternateName: [config.shortName, "BNI 최강챕터 고양", "bni고양"],
  url: url(""), logo: { "@type": "ImageObject", url: url(config.logo) }, image: url(config.ogImage), description: safe(config.description),
  address: { "@type": "PostalAddress", streetAddress: config.address.street, addressLocality: config.address.locality, addressRegion: config.address.region, addressCountry: config.address.country },
  areaServed: config.areaServed.map((name) => ({ "@type": "City", name })), sameAs: config.sameAs,
  knowsAbout: ["BNI", "비즈니스 네트워킹", "조찬모임", "고양 비즈니스 모임", "일산 전문가"],
});
const website = () => ({
  "@type": "WebSite", "@id": WEBSITE_ID, url: url(""), name: config.name, inLanguage: "ko-KR", publisher: { "@id": ORG_ID },
  potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: url("experts.html?q={search_term_string}") }, "query-input": "required name=search_term_string" },
});
const breadcrumb = (items) => ({
  "@type": "BreadcrumbList", itemListElement: [{ name: "홈", path: "" }, ...items].map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: url(it.path) })),
});
const webPage = (page, extra = {}) => ({
  "@type": "WebPage", "@id": url(page.path) + "#webpage", url: url(page.path), name: safe(page.title), description: safe(page.description),
  isPartOf: { "@id": WEBSITE_ID }, about: { "@id": ORG_ID }, inLanguage: "ko-KR", ...extra,
});
const faqFrom = (html) => {
  const items = [];
  for (const m of html.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi)) {
    const q = plain(m[1]), a = plain(m[2]);
    if (q && a) items.push({ "@type": "Question", name: safe(q, q), acceptedAnswer: { "@type": "Answer", text: safe(a, a) } });
  }
  return items.length ? { "@type": "FAQPage", mainEntity: items } : null;
};
const nextWednesday = () => {
  const now = new Date(Date.now() + 9 * 3600 * 1000); // KST
  for (let add = 0; add < 8; add += 1) {
    const d = new Date(now.getTime() + add * 86400000);
    if (d.getUTCDay() !== 3) continue;
    if (add === 0 && now.getUTCHours() >= 9) continue;
    return d.toISOString().slice(0, 10);
  }
  return now.toISOString().slice(0, 10);
};
const breakfastEvent = () => {
  const day = nextWednesday();
  return {
    "@type": "Event", "@id": url("visitor.html#breakfast-event"), name: `${config.shortName} 조찬모임`,
    description: safe(`매주 수요일 아침 고양·일산에서 열리는 ${config.shortName} 비즈니스 네트워킹 조찬모임. 비지터 참관 신청 가능.`),
    startDate: `${day}T${config.meeting.start}:00+09:00`, endDate: `${day}T${config.meeting.end}:00+09:00`,
    eventSchedule: { "@type": "Schedule", byDay: `https://schema.org/${config.meeting.weekday}`, repeatFrequency: "P1W", startTime: config.meeting.start, endTime: config.meeting.end, scheduleTimezone: "Asia/Seoul" },
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled",
    image: [url(config.ogImage)], organizer: { "@id": ORG_ID }, url: url("visitor.html"),
    location: { "@type": "Place", name: `${config.address.locality} ${config.address.street} 인근`, address: { "@type": "PostalAddress", streetAddress: config.address.street, addressLocality: config.address.locality, addressRegion: config.address.region, addressCountry: config.address.country } },
    offers: { "@type": "Offer", url: url("visitor.html"), price: 0, priceCurrency: "KRW", availability: "https://schema.org/InStock", description: "비지터 참관 신청 (일정·장소는 신청 후 안내)" },
  };
};

// ── <head> 메타 블록 / JSON-LD 블록 삽입 (마커로 멱등) ──
const META_RE = /\s*<!-- meta:start -->[\s\S]*?<!-- meta:end -->/;
const LD_RE = /\s*<!-- ld:start -->[\s\S]*?<!-- ld:end -->/;
function metaBlock({ title, description, canonical, image, robots = "index, follow, max-image-preview:large, max-snippet:-1", type = "website", imageAlt }) {
  const v = config.verification || {};
  const lines = [
    config.csp ? `<meta http-equiv="Content-Security-Policy" content="${esc(config.csp)}" />` : "",
    v.naver ? `<meta name="naver-site-verification" content="${esc(v.naver)}" />` : "",
    v.google ? `<meta name="google-site-verification" content="${esc(v.google)}" />` : "",
    `<meta name="robots" content="${robots}" />`,
    canonical ? `<link rel="canonical" href="${esc(canonical)}" />` : "",
    `<meta property="og:type" content="${type}" />`, `<meta property="og:site_name" content="${esc(config.shortName)}" />`, `<meta property="og:locale" content="${config.locale}" />`,
    `<meta property="og:title" content="${esc(title)}" />`, `<meta property="og:description" content="${esc(description)}" />`,
    canonical ? `<meta property="og:url" content="${esc(canonical)}" />` : "",
    `<meta property="og:image" content="${esc(image)}" />`, `<meta property="og:image:alt" content="${esc(imageAlt || title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`, `<meta name="twitter:title" content="${esc(title)}" />`, `<meta name="twitter:description" content="${esc(description)}" />`, `<meta name="twitter:image" content="${esc(image)}" />`,
  ].filter(Boolean);
  return `\n    <!-- meta:start -->\n    ${lines.join("\n    ")}\n    <!-- meta:end -->`;
}
function injectHead(html, { title, description, meta, ld }) {
  let out = html.replace(META_RE, "").replace(LD_RE, "");
  if (title) out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  if (description) out = out.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`);
  out = out.replace(/(<title>[^<]*<\/title>)/, `$1${meta}`);
  if (ld && ld.length) out = out.replace(/\n?\s*<\/head>/, `\n    <!-- ld:start -->\n    ${ld.map(ldScript).join("\n    ")}\n    <!-- ld:end -->\n  </head>`);
  return out;
}
const withContext = (nodes) => ({ "@context": "https://schema.org", "@graph": nodes });

// ── 1) 정적 페이지 8개 ─────────────────────────────────
const sitemapEntries = [];
const addUrl = (p, { lastmod = today, changefreq = "monthly", priority = "0.5" } = {}) =>
  sitemapEntries.push(`  <url>\n    <loc>${esc(url(p))}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`);

for (const page of config.pages) {
  const html = read(page.file);
  if (page.meta === "robots-only") {
    const cspLine = config.csp ? `
    <meta http-equiv="Content-Security-Policy" content="${esc(config.csp)}" />` : "";
    const out = html.replace(META_RE, "").replace(/(<title>[^<]*<\/title>)/, `$1\n    <!-- meta:start -->${cspLine}\n    <meta name="robots" content="${page.robots}" />\n    <!-- meta:end -->`);
    write(page.file, out); continue;
  }
  const canonical = url(page.path);
  const ld = [];
  if (page.ld === "home") {
    ld.push(withContext([organization(), website(), webPage(page), faqFrom(html)].filter(Boolean)));
  } else if (page.ld === "visitor") {
    ld.push(withContext([webPage(page), breakfastEvent(), breadcrumb([{ name: page.crumb, path: page.path }]), faqFrom(html)].filter(Boolean)));
  } else if (page.ld === "experts") {
    const list = { "@type": "ItemList", name: "BNI 최강챕터 업종별 전문가", itemListElement: members.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: `${splitCompany(m).company} ${m.name}`, url: url(memberPath(m)) })) };
    ld.push(withContext([webPage(page, { mainEntity: list }), breadcrumb([{ name: page.crumb, path: page.path }])]));
  } else if (page.ld === "page") {
    ld.push(withContext([webPage(page), breadcrumb([{ name: page.crumb, path: page.path }])]));
  }
  const meta = metaBlock({ title: page.title, description: page.description, canonical, image: url(config.ogImage), robots: page.robots });
  write(page.file, injectHead(html, { title: page.title, description: page.description, meta, ld }));
  if (page.sitemap !== false) addUrl(page.path, page);
}

// ── 2) 글 정적 페이지 blog/<id>/ ───────────────────────
const postTemplate = read("post.html");
const sourceOf = (post) => (post.member ? `${post.company || ""} ${post.member} ${post.role || ""}`.trim() : config.shortName);
function postArticle(post) {
  const m = memberByName.get(post.member);
  const tags = m?.tags || [];
  const profile = post.profile || { field: post.badge, strength: tags.join(", "), area: "고양·일산" };
  const body = post.body || `<p>${esc(m?.description || "")}</p>`;
  const memberBox = post.member ? `
      <div class="post-profile">
        <img src="${memberPhoto(m || { name: post.member })}" alt="${esc(post.member)}" />
        <div>
          <span>BNI 최강챕터 공인 비즈니스 마스터</span>
          <strong>${esc(post.company)} ${esc(post.member)} ${esc(post.role)}</strong>
          <p><b>전문분야:</b> ${esc(profile.field)} | <b>핵심역량:</b> ${esc(profile.strength)} | <b>활동지역:</b> ${esc(profile.area)}</p>
        </div>
      </div>` : "";
  const memberFoot = post.member ? `
      <p class="post-member-label">이 글의 멤버</p>
      <div class="post-member">
        <div class="post-member-info">
          <img src="${memberPhoto(m || { name: post.member })}" alt="" />
          <div>
            ${post.region ? `<span class="post-member-region">${esc(post.region)}</span>` : ""}
            <strong>${esc(post.member)}</strong>
            <small>${esc(post.company)} · ${esc(post.role)}</small>
            ${tags.length ? `<p>${tags.map(esc).join(", ")}</p>` : ""}
          </div>
        </div>
        <div class="post-member-actions">
          <a class="primary" href="contact.html">전문가 연결 문의</a>
          <a href="${m ? memberPath(m) : `experts.html?q=${encodeURIComponent(post.member)}`}">챕터 프로필</a>
        </div>
      </div>` : "";
  return `
      <a class="post-back" href="blog.html">← 뉴스 목록</a>
      <h1 class="post-title">${esc(post.title)}</h1>
      <p class="post-date">${esc(sourceOf(post))} · ${esc(post.publishedAt || post.date)}</p>${memberBox}
      ${post.lead ? `<blockquote class="post-lead">${esc(post.lead)}</blockquote>` : ""}
      <div class="post-body">
        ${body}
      </div>
      <div class="post-cta-box">
        <h2>BNI 최강챕터 비즈니스 조찬 참관 안내</h2>
        <p>매주 수요일 아침, 신뢰할 수 있는 지역 대표님들과의 비즈니스 네트워킹을 경험해보세요.</p>
        <a class="button post-cta-button" href="visitor.html">조찬 비지터 신청하기</a>
      </div>${memberFoot}
      <div class="post-bottom-actions">
        <a class="button post-cta-button" href="visitor.html">조찬모임 참석하기</a>
        <a class="button post-outline-button" href="contact.html">비즈니스 협업 문의</a>
      </div>`;
}
function staticShell(template, { base, postId, bodyHtml, articleAttrs }) {
  let out = template.replace(/<meta charset="utf-8" \/>/, `<meta charset="utf-8" />\n    <base href="${base}" />`);
  // <base> 때문에 페이지 내 앵커가 루트로 가지 않도록
  out = out.replace(/href="#main"/g, `href="${postId ? postPath({ id: postId }) : ""}#main"`);
  if (postId) out = out.replace(/<html lang="ko">/, `<html lang="ko" data-post-id="${esc(postId)}">`); // CSP: 인라인 스크립트 대신 data 속성
  out = out.replace(/<article class="post-article" id="blogPost"><\/article>/, `<article class="post-article"${articleAttrs || ' id="blogPost"'}>${bodyHtml}\n          </article>`);
  return out;
}
const postPages = [];
for (const post of posts) {
  const m = memberByName.get(post.member);
  const title = `${safe(post.title, "최강챕터 뉴스")} | ${config.shortName}`;
  const description = clip(safe(post.lead || plain(post.body), `${config.shortName} 뉴스`));
  const canonical = url(postPath(post));
  const image = m ? url(memberPhoto(m)) : url(config.ogImage);
  const dateIso = isoDate(post);
  const ld = [withContext([
    { "@type": "BlogPosting", "@id": canonical + "#article", headline: safe(post.title), description, image: { "@type": "ImageObject", url: image },
      datePublished: dateIso, dateModified: dateIso, inLanguage: "ko-KR", articleSection: post.category, mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      author: post.member ? { "@type": "Person", name: post.member, url: m ? url(memberPath(m)) : undefined } : { "@id": ORG_ID },
      publisher: { "@id": ORG_ID }, about: m ? { "@id": url(memberPath(m)) + "#business" } : undefined },
    breadcrumb([{ name: "최강챕터 뉴스", path: "blog.html" }, { name: safe(post.title), path: postPath(post) }]),
  ])];
  const meta = metaBlock({ title, description, canonical, image, type: "article", imageAlt: post.member ? `${post.member} ${post.role || ""}` : title });
  let html = injectHead(postTemplate, { title, description, meta, ld });
  html = staticShell(html, { base: "../../", postId: post.id, bodyHtml: postArticle(post) });
  postPages.push(write(`${decodeURIComponent(postPath(post))}index.html`, html));
  addUrl(postPath(post), { lastmod: dateIso, changefreq: "monthly", priority: "0.7" });
}

// ── 3) 멤버 정적 페이지 member/<이름>/ ─────────────────
function memberArticle(m) {
  const { company, role } = splitCompany(m);
  const card = namecardOf(m);
  const related = posts.filter((p) => p.member === m.name);
  const badges = [m.grade, m.rank].filter(Boolean).map((b) => `<span class="blog-badge">${esc(b)}</span>`).join(" ");
  return `
      <a class="post-back" href="experts.html">← 전문가 찾기</a>
      <h1 class="post-title">${esc(company)} ${esc(m.name)} ${esc(role)}</h1>
      <p class="post-date">${esc(m.category)} · BNI 최강챕터 멤버${badges ? " · " + badges : ""}</p>
      <div class="post-profile">
        <img src="${memberPhoto(m)}" alt="${esc(m.name)} ${esc(role)} 프로필 사진" />
        <div>
          <span>BNI 최강챕터 공인 비즈니스 마스터</span>
          <strong>${esc(company)} ${esc(m.name)} ${esc(role)}</strong>
          <p><b>전문분야:</b> ${m.tags.map(esc).join(", ")} | <b>활동지역:</b> 고양·일산·파주·김포</p>
        </div>
      </div>
      <blockquote class="post-lead">${esc(m.description)}</blockquote>
      <div class="post-body">
        <h2>${esc(m.name)} ${esc(role)}은 어떤 일을 하나요?</h2>
        <p>${esc(company)}의 ${esc(m.name)} ${esc(role)}은 BNI 고양지역 최강챕터에서 ${esc(m.category)} 분야를 맡고 있는 멤버입니다. ${esc(m.description)}</p>
        <ul>${m.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        ${card ? `<h2>소개 카드</h2>\n        <p><img src="${card}" alt="${esc(company)} ${esc(m.name)} ${esc(role)} 소개 카드 (전문분야·주요 이력·연락처)" loading="lazy" style="max-width:100%;height:auto;border-radius:12px;" /></p>` : ""}
        ${related.length ? `<h2>관련 글</h2>\n        <ul>${related.map((p) => `<li><a href="${postPath(p)}">${esc(p.title)}</a> <small>(${esc(p.publishedAt || p.date)})</small></li>`).join("")}</ul>` : ""}
        <h2>어떻게 연결되나요?</h2>
        <p>BNI 최강챕터는 매주 수요일 아침 고양·일산에서 조찬모임을 엽니다. ${esc(m.name)} ${esc(role)}과 상담이나 협업이 필요하면 협업 문의를 남기거나, 조찬모임에 비지터로 참석해 직접 만나 보세요.</p>
      </div>
      <div class="post-bottom-actions">
        ${m.homepage ? `<a class="button post-cta-button" href="${esc(m.homepage)}" target="_blank" rel="noopener">홈페이지 · 플레이스</a>` : ""}
        <a class="button post-outline-button" href="contact.html">전문가 연결 문의</a>
        <a class="button post-outline-button" href="visitor.html">조찬모임 참석하기</a>
      </div>`;
}
const memberPages = [];
for (const m of members) {
  const { company, role } = splitCompany(m);
  const title = `${safe(m.tags[0] || m.category)} | ${safe(company)} ${m.name} ${role} | ${config.shortName} 고양`;
  const description = clip(safe(`${company} ${m.name} ${role}. ${m.description} 고양·일산 BNI 최강챕터 ${m.category} 멤버, 전문분야 ${m.tags.join("·")}.`));
  const pagePath = memberPath(m);
  const canonical = url(pagePath);
  const bizType = localBusiness.test(`${company} ${m.category} ${m.tags.join(" ")}`) ? "LocalBusiness" : "ProfessionalService";
  const ld = [withContext([
    { "@type": "Person", "@id": canonical + "#person", name: m.name, jobTitle: role || undefined, worksFor: { "@id": canonical + "#business" }, image: url(memberPhoto(m)), url: canonical, memberOf: { "@id": ORG_ID }, sameAs: m.homepage ? [m.homepage] : undefined, knowsAbout: m.tags },
    { "@type": bizType, "@id": canonical + "#business", name: company, description: safe(m.description), url: m.homepage || canonical, image: url(memberPhoto(m)), areaServed: config.areaServed, parentOrganization: { "@id": ORG_ID }, founder: { "@id": canonical + "#person" } },
    webPage({ path: pagePath, title, description }, { about: { "@id": canonical + "#business" }, primaryImageOfPage: url(memberPhoto(m)) }),
    breadcrumb([{ name: "전문가 찾기", path: "experts.html" }, { name: `${company} ${m.name}`, path: pagePath }]),
  ])];
  const meta = metaBlock({ title, description, canonical, image: url(memberPhoto(m)), type: "profile", imageAlt: `${m.name} ${role}` });
  let html = injectHead(postTemplate, { title, description, meta, ld });
  html = html.replace(/<script src="site-data\.js[^>]*data-scripts="[^"]*"><\/script>/, (s) => s.replace(/data-scripts="[^"]*"/, 'data-scripts="journey.js?v=1 experts.js?v=10 app.js?v=16 namecard.js?v=5 menu.js?v=1"'));
  html = html.replace(/<a class="active" href="blog\.html" aria-current="page">최강챕터 뉴스<\/a>/, '<a href="blog.html">최강챕터 뉴스</a>').replace(/<a href="experts\.html">전문가 찾기<\/a>/, '<a class="active" href="experts.html" aria-current="page">전문가 찾기</a>');
  html = staticShell(html, { base: "../../", postId: "", bodyHtml: memberArticle(m), articleAttrs: ' id="memberPage"' });
  html = html.replace(/href="#main"/g, `href="${pagePath}#main"`);
  memberPages.push(write(`${decodeURIComponent(pagePath)}index.html`, html));
  addUrl(pagePath, { changefreq: "monthly", priority: "0.8" });
}

// ── 4) sitemap.xml · robots.txt · llms.txt ─────────────
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join("\n")}\n</urlset>\n`);
write("robots.txt", `# ${config.name} — ${ORIGIN}
User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /post.html
Disallow: /tools/
Disallow: /docs/
Disallow: /supabase/

# AI 검색 크롤러 — 공개 콘텐츠 허용 (관리자 페이지 제외)
User-agent: GPTBot
Allow: /
Disallow: /admin.html
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
Disallow: /admin.html
User-agent: PerplexityBot
Allow: /
Disallow: /admin.html
User-agent: Google-Extended
Allow: /

# AI 요약용 사이트 설명: ${url("llms.txt")}
Sitemap: ${url("sitemap.xml")}
`);

const byCategory = {};
for (const m of members) (byCategory[m.category] = byCategory[m.category] || []).push(m);
const llms = `# ${config.name} (${config.shortName})
> ${safe(config.description)} 이 문서는 검색엔진과 생성형 AI 가 ${config.shortName}를 정확히 인용할 수 있도록 사이트 운영자가 제공하는 요약입니다.

## 기본 정보
- 이름: ${config.name} (BNI Choegang Chapter, Goyang)
- 공식 사이트: ${url("")}
- 모임: ${config.meeting.label}, ${config.address.region} ${config.address.locality} ${config.address.street} 인근
- 활동 권역: ${config.areaServed.join(", ")}
- 성격: BNI 시스템을 따르는 비즈니스 네트워킹 챕터. 업종당 1명 원칙으로 ${members.length}명의 대표·전문가가 매주 만나 소개와 추천을 주고받습니다.
- 비지터(방문객) 참석: 멤버십 결정 전 1회 참관 가능. 신청: ${url("visitor.html")}
- 협업·전문가 연결 문의: ${url("contact.html")}

## 업종별 멤버 디렉터리
${Object.entries(byCategory).map(([cat, list]) => `### ${cat}\n${list.map((m) => { const { company, role } = splitCompany(m); return `- ${company} ${m.name} ${role} — ${m.tags.join(", ")} · ${url(memberPath(m))}`; }).join("\n")}`).join("\n\n")}

## 핵심 페이지
- 홈: ${url("")}
- 전문가 찾기(업종별 디렉터리): ${url("experts.html")}
- 비지터 참관 신청: ${url("visitor.html")}
- 협업 문의: ${url("contact.html")}
- BNI 소개: ${url("about.html")}
- 최강챕터 뉴스: ${url("blog.html")}
- 사이트맵: ${url("sitemap.xml")}

## 공개 글 (${posts.length}건)
${posts.map((p) => `- [${p.category}] ${safe(p.title, p.title)} (${p.publishedAt || p.date}) · ${url(postPath(p))}`).join("\n")}

## 인용 안내
- 인용 명칭: "BNI 고양지역 최강챕터" 또는 "BNI 최강챕터 (고양·일산)"
- 멤버 정보는 소개·연결 목적입니다. 의료·법률·금융 멤버에 대해 치료 효과나 결과를 보장하는 표현으로 인용하지 마세요.
- 모임 시간·장소는 바뀔 수 있으니 참석 전 참관 신청 페이지에서 확인하도록 안내해 주세요.
`;
write("llms.txt", llms);

console.log(`origin ${ORIGIN}`);
console.log(`정적 페이지 ${config.pages.length}개 head 갱신 · 글 ${postPages.length}개 · 멤버 ${memberPages.length}개 · 사이트맵 URL ${sitemapEntries.length}개 · llms.txt ${Buffer.byteLength(llms) / 1024 | 0}KB`);
