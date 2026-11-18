// BNI 최강챕터 사이트 브라우저 테스트 (puppeteer-core + 설치된 Chrome)
// 사용: node site.test.js <base-url>   예) http://127.0.0.1:8080/  또는 https://musicman0519-a11y.github.io/bni-choegang-web/
const puppeteer = require("puppeteer-core");
const BASE = (process.argv[2] || "http://127.0.0.1:8080/").replace(/\/?$/, "/");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const results = [];
const test = async (name, fn) => {
  try { const detail = await fn(); results.push(["PASS", name, detail || ""]); }
  catch (e) { results.push(["FAIL", name, e.message.split("\n")[0]]); }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--window-size=1280,900"] });
  const errors = {};
  const open = async (path, opts = {}) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    errors[path] = [];
    page.on("pageerror", (e) => errors[path].push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errors[path].push("console: " + m.text()); });
    page.on("requestfailed", (r) => { if (!/favicon/.test(r.url())) errors[path].push("requestfailed: " + r.url()); });
    await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 60000, ...opts });
    return page;
  };
  const visible = (page, sel) => page.$eval(sel, (el) => !el.hidden && el.offsetParent !== null).catch(() => false);
  const count = (page, sel) => page.$$eval(sel, (els) => els.length);
  const visibleCount = (page, sel) => page.$$eval(sel, (els) => els.filter((el) => el.offsetParent !== null && !el.hidden).length);

  // ── 홈 ──────────────────────────────────────────────
  await test("홈: 제목과 최신 뉴스 타일 4개(blog.js 설계값), 스크립트 오류 없음", async () => {
    const page = await open("index.html");
    const title = await page.title();
    expect(/최강챕터/.test(title), "제목에 최강챕터 없음: " + title);
    const tiles = await count(page, ".news-tile");
    expect(tiles === 4, `뉴스 타일 ${tiles}개 (기대 4)`);
    expect(errors["index.html"].length === 0, errors["index.html"].join(" | "));
    await page.close();
    return `타일 ${tiles}개`;
  });

  // ── 전문가 찾기 · 명함 · 홈페이지 링크 ───────────────
  await test("전문가 찾기: 멤버 카드 29개, 명함보기 버튼 29개", async () => {
    const page = await open("experts.html");
    const n = await count(page, "[data-namecard]");
    expect(n === 29, `명함보기 버튼 ${n}개`);
    expect(errors["experts.html"].length === 0, errors["experts.html"].join(" | "));
    await page.close();
  });
  await test("명함보기: 윤성기 → 옛 사이트 소개 카드 이미지가 보인다", async () => {
    const page = await open("experts.html");
    await page.click('[data-namecard="윤성기"]');
    await page.waitForFunction(() => { const img = document.querySelector(".namecard-image"); return img && !img.hidden && img.complete && img.naturalWidth > 0; }, { timeout: 15000 });
    const info = await page.$eval(".namecard-image", (img) => ({ src: img.getAttribute("src"), w: img.naturalWidth, h: img.naturalHeight, madeHidden: document.querySelector(".namecard-made").hidden }));
    expect(/namecard-윤성기\.jpg$/.test(decodeURIComponent(info.src)), "src 가 다름: " + info.src);
    expect(info.madeHidden === true, "자동 생성 명함이 같이 보임");
    await page.close();
    return `${info.w}x${info.h}`;
  });
  await test("명함보기: 박성찬(카드 없음) → 자동 생성 명함으로 대체된다", async () => {
    const page = await open("experts.html");
    await page.click('[data-namecard="박성찬"]');
    await page.waitForSelector("dialog[open]", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));
    const made = await page.$eval(".namecard-made", (el) => !el.hidden);
    const img = await page.$eval(".namecard-image", (el) => el.hidden);
    const name = await page.$eval(".namecard-name", (el) => el.textContent);
    expect(made && img, `made=${made} imageHidden=${img}`);
    expect(name === "박성찬", "이름 " + name);
    await page.close();
  });
  await test("홈페이지 버튼: 윤성기는 네이버 플레이스 새 창, 박정호(링크 없음)는 member/박정호/ 프로필 페이지로", async () => {
    const page = await open("experts.html");
    const a = await page.$eval('[data-homepage="윤성기"]', (el) => ({ href: el.href, target: el.target }));
    const b = await page.$eval('[data-homepage="박정호"]', (el) => el.getAttribute("href"));
    expect(/map\.naver\.com/.test(a.href) && a.target === "_blank", JSON.stringify(a));
    expect(/^member\/.+\/$/.test(decodeURIComponent(b)), "박정호 href: " + b);
    await page.close();
    return a.href.slice(0, 40) + "…";
  });

  // ── 블로그 목록 · 필터 ───────────────────────────────
  await test("블로그 목록: 글 카드 52개", async () => {
    const page = await open("blog.html");
    const n = await count(page, ".blog-card");
    expect(n === 52, `카드 ${n}개`);
    expect(errors["blog.html"].length === 0, errors["blog.html"].join(" | "));
    await page.close();
  });
  await test("블로그 필터: 주간회의 9 · 멤버소개 33 · 121후기 3 · 일상소개 7 · 파워팀소개 0", async () => {
    const page = await open("blog.html");
    const expected = { "주간회의": 9, "멤버소개": 33, "121후기": 3, "일상소개": 7, "파워팀소개": 0 };
    const got = {};
    for (const [cat, n] of Object.entries(expected)) {
      await page.click(`.blog-filter[data-category="${cat}"]`);
      await new Promise((r) => setTimeout(r, 200));
      got[cat] = await visibleCount(page, ".blog-card");
      expect(got[cat] === n, `${cat} ${got[cat]}개 (기대 ${n})`);
    }
    await page.click('.blog-filter[data-category="전체"]');
    await new Promise((r) => setTimeout(r, 200));
    const all = await visibleCount(page, ".blog-card");
    expect(all === 52, `전체 ${all}개`);
    await page.close();
    return JSON.stringify(got);
  });

  // ── 글 상세 ─────────────────────────────────────────
  await test("글 상세(옛 HTML 글): 이재상 소개글에 소제목 3개 이상, 인라인 스타일·이미지 없음, 멤버 박스 표시", async () => {
    const page = await open("post.html?id=auto-repair-lee-jaesang");
    const h1 = await page.$eval(".post-title", (el) => el.textContent);
    expect(/이재상/.test(h1), "제목: " + h1);
    const body = await page.$eval(".post-body", (el) => ({ h2: el.querySelectorAll("h2").length, style: /style=/.test(el.innerHTML), img: el.querySelectorAll("img").length, len: el.textContent.trim().length }));
    expect(body.h2 >= 3, `h2 ${body.h2}개`);
    expect(!body.style && body.img === 0, `style=${body.style} img=${body.img}`);
    expect(body.len > 500, `본문 ${body.len}자`);
    const profile = await visible(page, ".post-profile");
    expect(profile, "멤버 프로필 박스 없음");
    expect(errors["post.html?id=auto-repair-lee-jaesang"].length === 0, errors["post.html?id=auto-repair-lee-jaesang"].join(" | "));
    await page.close();
    return `h2 ${body.h2}개, ${body.len}자`;
  });
  await test("글 상세(병합 글): 이병길 글이 '준비 중' 대신 본문을 보여준다", async () => {
    const page = await open("post.html?id=lee-byeonggil");
    const pending = await count(page, ".post-pending");
    const len = await page.$eval(".post-body", (el) => el.textContent.trim().length);
    expect(pending === 0 && len > 500, `pending=${pending} 본문 ${len}자`);
    await page.close();
    return `${len}자`;
  });
  await test("글 상세(옛 Markdown 글): 5월 13일 주간회의 본문에 굵은 글씨와 박웅희 언급", async () => {
    const page = await open("post.html?id=weekly-meeting-20260513");
    const info = await page.$eval(".post-body", (el) => ({ strong: el.querySelectorAll("strong").length, text: el.textContent, md: /\*\*|!\[|\\\*/.test(el.textContent) }));
    expect(info.strong > 0, "strong 없음");
    expect(/박웅희/.test(info.text), "박웅희 없음");
    expect(!info.md, "Markdown 기호가 남아 있음");
    await page.close();
    return `strong ${info.strong}개`;
  });
  await test("글 상세(없는 id): '글을 찾을 수 없습니다' 안내", async () => {
    const page = await open("post.html?id=no-such-post");
    const txt = await page.$eval(".post-title", (el) => el.textContent);
    expect(/찾을 수 없습니다/.test(txt), txt);
    await page.close();
  });

  // ── 관리자 ──────────────────────────────────────────
  await test("관리자(연결 전): 설정 안내 화면이 뜬다", async () => {
    const page = await open("admin.html");
    const setup = await visible(page, "#setupScreen");
    const app = await visible(page, "#adminApp");
    expect(setup && !app, `setup=${setup} app=${app}`);
    expect(errors["admin.html"].length === 0, errors["admin.html"].join(" | "));
    await page.close();
  });
  await test("관리자(데모): 자동 로그인, 데모 표시줄, 새 문의 2건 → '전체 상태'로 바꾸면 3건", async () => {
    const page = await open("admin.html?demo");
    await page.waitForFunction(() => !document.querySelector("#adminApp").hidden, { timeout: 15000 });
    const demo = await visible(page, "#demoBar");
    const email = await page.$eval("#adminEmail", (el) => el.textContent);
    await page.waitForFunction(() => document.querySelectorAll("#inquiryList > *").length >= 2, { timeout: 10000 });
    const fresh = await count(page, "#inquiryList > *");
    await page.select("#inquiryStatus", "");
    await page.waitForFunction(() => document.querySelectorAll("#inquiryList > *").length >= 3, { timeout: 10000 }).catch(() => {});
    const all = await count(page, "#inquiryList > *");
    expect(demo, "데모 표시줄 없음");
    expect(email === "demo@choegang.kr", "이메일 " + email);
    expect(fresh === 2 && all === 3, `새 문의 ${fresh}건, 전체 ${all}건`);
    await page.close();
    return `새 ${fresh} / 전체 ${all}`;
  });
  await test("관리자(데모): 멤버 29명 · 글 52건 · 배너 3장 · 일정 2건 · 관리자 2명 탭이 모두 열린다", async () => {
    const page = await open("admin.html?demo");
    await page.waitForFunction(() => !document.querySelector("#adminApp").hidden, { timeout: 15000 });
    const counts = {};
    const tabs = [["members", "#memberRows > *", 29], ["posts", "#postRows > *", 52], ["banners", "#bannerGrid figure", 3], ["schedule", "#scheduleRows > *", 2], ["admins", "#adminRows > *", 2]];
    for (const [tab, sel, want] of tabs) {
      await page.click(`.admin-tabs [data-tab="${tab}"]`);
      await page.waitForFunction((s, w) => document.querySelectorAll(s).length >= w, { timeout: 10000 }, sel, want).catch(() => {});
      counts[tab] = await count(page, sel);
      const panelShown = await page.$eval(`[data-panel="${tab}"]`, (el) => !el.hidden);
      expect(panelShown, `${tab} 패널이 안 보임`);
      expect(counts[tab] === want, `${tab} ${counts[tab]}개 (기대 ${want})`);
    }
    expect(errors["admin.html?demo"].length === 0, errors["admin.html?demo"].join(" | "));
    await page.close();
    return JSON.stringify(counts);
  });
  await test("관리자(데모): 글 탭의 가져오기 안내가 숨겨지고(이미 52건), 멤버 검색이 동작한다", async () => {
    const page = await open("admin.html?demo");
    await page.waitForFunction(() => !document.querySelector("#adminApp").hidden, { timeout: 15000 });
    await page.click('.admin-tabs [data-tab="posts"]');
    await page.waitForFunction(() => document.querySelectorAll("#postRows > *").length >= 52, { timeout: 10000 });
    const seedHidden = await page.$eval("#postSeed", (el) => el.hidden);
    await page.click('.admin-tabs [data-tab="members"]');
    await page.waitForFunction(() => document.querySelectorAll("#memberRows > *").length >= 29, { timeout: 10000 });
    await page.type("#memberSearch", "윤성기");
    await new Promise((r) => setTimeout(r, 400));
    const shown = await visibleCount(page, "#memberRows > *");
    expect(seedHidden, "글 52건이 있는데 가져오기 안내가 보임");
    expect(shown === 1, `검색 결과 ${shown}행`);
    await page.close();
  });


  // ── 정적 글·멤버 페이지 (prerender) ─────────────────
  await test("정적 글 페이지 blog/<id>/: JS 실행 후에도 같은 글, 오류 없음, 뒤로가기·CTA 링크가 루트 기준", async () => {
    const page = await open("blog/weekly-meeting-20260513/");
    await page.waitForFunction(() => document.querySelector(".post-title")?.textContent.includes("5월 13일"), { timeout: 10000 });
    const links = await page.$$eval(".post-back, .post-cta-button", (els) => els.map((a) => a.href));
    expect(links.every((h) => /\/(blog|visitor)\.html$/.test(h)), "링크: " + links.join(" "));
    const canon = await page.$eval('link[rel="canonical"]', (l) => l.href);
    expect(/\/blog\/weekly-meeting-20260513\/$/.test(canon), "canonical " + canon);
    const errs = errors["blog/weekly-meeting-20260513/"];
    expect(errs.length === 0, errs.join(" | "));
    await page.close();
  });
  await test("post.html?id= 로 연 정적 글은 canonical 이 blog/<id>/ 를 가리킨다", async () => {
    const page = await open("post.html?id=weekly-meeting-20260513");
    await page.waitForSelector(".post-title", { timeout: 10000 });
    const canon = await page.$eval('link[rel="canonical"]', (l) => l.href);
    expect(/\/blog\/weekly-meeting-20260513\/$/.test(canon), "canonical " + canon);
    await page.close();
  });
  await test("멤버 페이지 member/박웅희/: 제목·소개·명함 이미지 로드, 메뉴 동작, 오류 없음", async () => {
    const page = await open("member/%EB%B0%95%EC%9B%85%ED%9D%AC/");
    const h1 = await page.$eval(".post-title", (el) => el.textContent);
    expect(/박웅희/.test(h1), "h1 " + h1);
    const imgs = await page.$$eval("article img", (els) => els.map((i) => ({ src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0 })));
    expect(imgs.length >= 2 && imgs.every((i) => i.ok), "이미지 로드 실패: " + JSON.stringify(imgs.filter((i) => !i.ok)));
    const nav = await page.$eval('.main-nav a[href="experts.html"]', (a) => a.href);
    expect(/\/experts\.html$/.test(nav), "메뉴 링크 " + nav);
    const errs = errors["member/%EB%B0%95%EC%9B%85%ED%9D%AC/"];
    expect(errs.length === 0, errs.join(" | "));
    await page.close();
    return `이미지 ${imgs.length}개`;
  });
  await test("멤버 페이지 390px: 가로 스크롤 없음", async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(BASE + "member/%EB%B0%95%EC%9B%85%ED%9D%AC/", { waitUntil: "networkidle0", timeout: 60000 });
    const w = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    expect(w.scroll <= w.inner + 1, `scrollWidth ${w.scroll} > ${w.inner}`);
    await page.close();
    return `${w.scroll}/${w.inner}`;
  });
  await test("전문가 찾기: 멤버 이름이 member/<이름>/ 프로필로 링크된다", async () => {
    const page = await open("experts.html");
    const href = await page.$eval('.expert-card h2 a', (a) => a.getAttribute("href"));
    expect(/^member\/.+\/$/.test(decodeURIComponent(href)), "href " + href);
    await page.close();
  });


  // ── 실 DB 모드 (supabase-config.js 에 연결 정보가 있을 때만) ──
  {
    const probe = await open("index.html");
    const configured = await probe.evaluate(() => Boolean(window.siteConfigured));
    await probe.close();
    if (configured) {
      await test("실 DB: 홈이 Supabase 멤버 데이터로 렌더된다(siteMembers 29명 이상)", async () => {
        const page = await open("index.html");
        const n = await page.evaluate(() => (window.siteMembers || []).length);
        expect(n >= 29, `siteMembers ${n}`);
        await page.close();
        return `${n}명`;
      });
      await test("실 DB: 참관 신청 폼 제출 → '접수되었습니다' (테스트 건은 관리자 문의 탭에서 삭제)", async () => {
        const page = await open("visitor.html");
        await page.type('#visitorForm [name="name"]', "자동테스트 삭제요망");
        await page.type('#visitorForm [name="phone"]', "010-0000-0000");
        await page.type('#visitorForm [name="message"]', `e2e 자동 테스트 ${new Date().toISOString()} — 관리자 페이지에서 삭제해 주세요`);
        await page.click('#visitorForm [type="submit"]');
        await page.waitForFunction(() => { const s = document.querySelector("#visitorFormStatus"); return s && !s.hidden && s.textContent.trim(); }, { timeout: 20000 });
        const msg = await page.$eval("#visitorFormStatus", (el) => el.textContent.trim());
        expect(/접수되었습니다/.test(msg), msg);
        await page.close();
        return msg.slice(0, 20);
      });
      await test("실 DB: 필수값(이름·전화) 비우면 브라우저가 제출을 막는다", async () => {
        const page = await open("visitor.html");
        await page.click('#visitorForm [type="submit"]');
        const invalid = await page.$eval("#visitorForm", (f) => !f.checkValidity());
        const shown = await page.$eval("#visitorFormStatus", (el) => !el.hidden && el.textContent.trim().length > 0).catch(() => false);
        expect(invalid && !shown, `invalid=${invalid} statusShown=${shown}`);
        await page.close();
      });
    } else {
      results.push(["SKIP", "실 DB 모드 3건 — supabase-config.js 미연결이라 건너뜀", ""]);
    }
  }

  // ── 옛 주소 리다이렉트 (공개 URL 에서만 404.html 이 동작) ──
  if (/github\.io|choegang\.co\.kr/.test(BASE)) {
    for (const [from, to] of [["blog/weekly-meeting-20260513", "blog/weekly-meeting-20260513/"], ["blog/no-such-post-xyz", "post.html?id=no-such-post-xyz"], ["members.html", "experts.html"], ["collaborate.html", "contact.html"], ["blogs.html", "blog.html"]]) {
      await test(`옛 주소 /${from} → ${to}`, async () => {
        const page = await browser.newPage();
        await page.goto(BASE + from, { waitUntil: "networkidle0", timeout: 60000 });
        const url = page.url();
        expect(url.endsWith(to), "최종 주소: " + url);
        await page.close();
      });
    }
  }

  await browser.close();
  const pass = results.filter((r) => r[0] === "PASS").length, skip = results.filter((r) => r[0] === "SKIP").length, fail = results.length - pass - skip;
  console.log(`\n대상: ${BASE}`);
  for (const [s, name, d] of results) console.log(`${s === "PASS" ? "✔" : s === "SKIP" ? "–" : "✘"} ${s}  ${name}${d ? "  — " + d : ""}`);
  console.log(`\n결과: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("테스트 실행 오류:", e); process.exit(2); });
