// 노출 메타·구조화 데이터 검사 (브라우저 없이 파일만 읽음)
// 사용: node tools/e2e/ld.test.js
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const ORIGIN = config.origin.replace(/\/+$/, "");
const results = [];
const test = (name, fn) => { try { const d = fn(); results.push(["PASS", name, d || ""]); } catch (e) { results.push(["FAIL", name, e.message]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const lds = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const nodes = (html) => lds(html).flatMap((g) => g["@graph"] || [g]);
const attr = (html, re) => (html.match(re) || [])[1];
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const BLOCKED = /최고|최다|유일|완치|부작용 없|100%|무조건 보장|기적/;

// 정적 페이지 7개 + admin
for (const page of config.pages) {
  const html = read(page.file);
  test(`${page.file}: title·description·robots`, () => {
    if (page.title) expect(html.includes(`<title>${page.title}</title>`), "title 불일치");
    expect(/<meta name="robots" content="[^"]+"/.test(html), "robots 없음");
    if (page.robots) expect(html.includes(`content="${page.robots}"`), "robots 값 다름");
  });
  if (page.meta === "robots-only") continue;
  test(`${page.file}: canonical·og·twitter 가 origin 기준 절대주소`, () => {
    const canon = attr(html, /<link rel="canonical" href="([^"]+)"/);
    expect(canon === `${ORIGIN}/${page.path}`, `canonical ${canon}`);
    expect(attr(html, /property="og:url" content="([^"]+)"/) === canon, "og:url ≠ canonical");
    expect((attr(html, /property="og:image" content="([^"]+)"/) || "").startsWith(ORIGIN + "/assets/"), "og:image 절대주소 아님");
    expect(/name="twitter:card" content="summary_large_image"/.test(html), "twitter card 없음");
    const desc = attr(html, /<meta name="description" content="([^"]+)"/) || "";
    expect(desc.length >= 50 && desc.length <= 170, `description 길이 ${desc.length}`);
    expect(!BLOCKED.test(desc), "description 에 과장 표현");
  });
  if (page.ld !== "none") test(`${page.file}: JSON-LD 파싱·타입`, () => {
    const types = nodes(html).map((n) => n["@type"]);
    const want = { home: ["Organization", "WebSite", "WebPage", "FAQPage"], visitor: ["WebPage", "Event", "BreadcrumbList", "FAQPage"], experts: ["WebPage", "BreadcrumbList"], page: ["WebPage", "BreadcrumbList"] }[page.ld];
    for (const t of want) expect(types.includes(t), `${t} 없음 (${types.join(",")})`);
    if (page.ld === "home") {
      const faq = nodes(html).find((n) => n["@type"] === "FAQPage");
      const details = (html.match(/<details/g) || []).length;
      expect(faq.mainEntity.length === details, `FAQ ${faq.mainEntity.length} ≠ details ${details}`);
      const org = nodes(html).find((n) => n["@type"] === "Organization");
      expect(org.address.streetAddress && org.logo.url.startsWith(ORIGIN), "Organization 주소/로고");
    }
    if (page.ld === "visitor") {
      const ev = nodes(html).find((n) => n["@type"] === "Event");
      expect(new Date(ev.startDate) > new Date(Date.now() - 86400000), `Event 시작일이 과거: ${ev.startDate}`);
      expect(new Date(ev.startDate).getUTCDay() === 2 || new Date(ev.startDate).getDay() === 3, "수요일 아님");
      expect(ev.location.address.addressLocality && ev.offers.url, "location/offers 누락");
    }
    if (page.ld === "experts") {
      const wp = nodes(html).find((n) => n["@type"] === "WebPage");
      expect(wp.mainEntity.itemListElement.length >= 29, "ItemList 29 미만");
    }
    return types.join(",");
  });
}

// 글·멤버 정적 페이지
const postDirs = fs.readdirSync(path.join(ROOT, "blog")).filter((d) => fs.existsSync(path.join(ROOT, "blog", d, "index.html")));
const memberDirs = fs.readdirSync(path.join(ROOT, "member")).filter((d) => fs.existsSync(path.join(ROOT, "member", d, "index.html")));
test(`정적 글 페이지 수 = staticPosts 수`, () => {
  const vm = require("vm"); const sb = { window: {}, document: { querySelector: () => null, querySelectorAll: () => [] }, console }; sb.window.window = sb.window; vm.createContext(sb);
  for (const f of ["experts.js", "blog-data.js", "blog-legacy.js"]) vm.runInContext(read(f), sb);
  expect(postDirs.length === sb.window.staticPosts.length, `${postDirs.length} ≠ ${sb.window.staticPosts.length}`);
  expect(memberDirs.length === sb.window.staticMembers.length, `멤버 ${memberDirs.length} ≠ ${sb.window.staticMembers.length}`);
  return `글 ${postDirs.length}, 멤버 ${memberDirs.length}`;
});
const sample = (arr, n) => arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
for (const d of sample(postDirs, 5)) test(`blog/${d}/: JS 없이 본문 300자 이상, BlogPosting, canonical, base`, () => {
  const html = read(`blog/${d}/index.html`);
  const body = textOf(html.match(/<article[\s\S]*?<\/article>/)[0]);
  expect(body.length >= 300, `본문 ${body.length}자`);
  const n = nodes(html); const bp = n.find((x) => x["@type"] === "BlogPosting");
  expect(bp && bp.headline && bp.datePublished && bp.publisher, "BlogPosting 필드");
  expect(attr(html, /<link rel="canonical" href="([^"]+)"/) === `${ORIGIN}/blog/${encodeURIComponent(d)}/`, "canonical");
  expect(/<base href="\.\.\/\.\.\/" \/>/.test(html) && html.includes(`data-post-id="${d}"`), "base/postId");
  expect(!/style="|jhigjfiwjrrpatlagnll/.test(html.match(/<div class="post-body">[\s\S]*?<\/div>\s*<div class="post-cta-box">/)[0]), "본문에 style/깨진 이미지");
  return `${body.length}자`;
});
for (const d of sample(memberDirs, 5)) test(`member/${d}/: JS 없이 소개 300자 이상, Person+Business, 사진·명함 경로`, () => {
  const html = read(`member/${d}/index.html`);
  const body = textOf(html.match(/<article[\s\S]*?<\/article>/)[0]);
  expect(body.length >= 300, `본문 ${body.length}자`);
  const types = nodes(html).map((x) => x["@type"]);
  expect(types.includes("Person") && (types.includes("ProfessionalService") || types.includes("LocalBusiness")), types.join(","));
  expect(fs.existsSync(path.join(ROOT, "assets", "images", `member-${d}.jpg`)), "프로필 사진 파일 없음");
  if (html.includes(`namecard-${d}.jpg`)) expect(fs.existsSync(path.join(ROOT, "assets", "images", `namecard-${d}.jpg`)), "명함 파일 없음");
  expect(!BLOCKED.test(attr(html, /<meta name="description" content="([^"]+)"/) || ""), "description 과장 표현");
  return `${body.length}자, ${types.join(",")}`;
});

// 사이트맵·robots·llms
test("sitemap.xml: URL 수 = 정적 6 + 글 + 멤버, 모두 origin, lastmod 형식", () => {
  const xml = read("sitemap.xml"); const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const staticCount = config.pages.filter((p) => p.sitemap !== false && p.meta !== "robots-only").length;
  expect(locs.length === staticCount + postDirs.length + memberDirs.length, `${locs.length} ≠ ${staticCount}+${postDirs.length}+${memberDirs.length}`);
  expect(locs.every((l) => l.startsWith(ORIGIN + "/")), "origin 외 URL");
  expect(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(xml), "lastmod 형식");
  expect(!locs.some((l) => /admin|post\.html/.test(l)), "admin/post.html 포함");
  return `${locs.length}개`;
});
test("robots.txt: Sitemap 줄, admin 차단, AI 크롤러 허용", () => {
  const r = read("robots.txt");
  expect(r.includes(`Sitemap: ${ORIGIN}/sitemap.xml`), "Sitemap 줄");
  expect(/Disallow: \/admin\.html/.test(r), "admin 차단");
  for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) expect(new RegExp(`User-agent: ${bot}\\s+Allow: /`).test(r), `${bot} 허용 없음`);
});
test("llms.txt: 멤버 29명·글 전부 링크, 과장 표현 없음", () => {
  const t = read("llms.txt");
  const memberLinks = (t.match(new RegExp(`${ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/member/`, "g")) || []).length;
  const postLinks = (t.match(new RegExp(`${ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/blog/`, "g")) || []).length;
  expect(memberLinks >= memberDirs.length && postLinks >= postDirs.length, `멤버 ${memberLinks}, 글 ${postLinks}`);
  expect(!/TYFCB|억\s*원|상권 장악|No\.1/.test(t) && !BLOCKED.test(t), "수치 주장·과장 표현");
  return `멤버 ${memberLinks}, 글 ${postLinks}`;
});

const pass = results.filter((r) => r[0] === "PASS").length, fail = results.length - pass;
for (const [s, n, d] of results) console.log(`${s === "PASS" ? "✔" : "✘"} ${s}  ${n}${d ? "  — " + d : ""}`);
console.log(`\nld.test 결과: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
