// 본문 서식 왕복 테스트 — body-format.js (브라우저 없이)
// 사용: node tools/e2e/format-body.test.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..", "..");
const { formatBody, htmlToText } = require(path.join(ROOT, "body-format.js"));
const results = [];
const test = (name, fn) => { try { const d = fn(); results.push(["PASS", name, d || ""]); } catch (e) { results.push(["FAIL", name, e.message]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
// 내용 있는 태그만 센다(원본 데이터의 <strong></strong> 같은 빈 태그는 제외)
const count = (html, tag) => (html.match(new RegExp(`<${tag}\\b[^>]*>(?:(?!<\\/${tag}>)[\\s\\S])*?[^\\s<][\\s\\S]*?<\\/${tag}>`, "g")) || []).length;

test("문단: 빈 줄로 나뉘고 줄바꿈은 <br>", () => {
  const h = formatBody("첫 문단\n둘째 줄\n\n둘째 문단");
  expect(h === "<p>첫 문단<br />둘째 줄</p>\n<p>둘째 문단</p>", h);
});
test("## 소제목 → h2, ### → h3", () => {
  const h = formatBody("## 큰 제목\n\n### 작은 제목\n\n본문");
  expect(h.includes("<h2>큰 제목</h2>") && h.includes("<h3>작은 제목</h3>") && h.includes("<p>본문</p>"), h);
});
test("- 목록 3줄 → ul/li 3개, • 도 허용", () => {
  const h = formatBody("- 하나\n- 둘\n• 셋");
  expect(h === "<ul><li>하나</li><li>둘</li><li>셋</li></ul>", h);
});
test("**굵게** → strong, HTML 특수문자는 이스케이프", () => {
  const h = formatBody("**중요** <script>x</script> & 끝");
  expect(h.includes("<strong>중요</strong>") && h.includes("&lt;script&gt;") && h.includes("&amp;"), h);
});
test("빈 입력·공백만 → 빈 문자열", () => {
  expect(formatBody("") === "" && formatBody("  \n\n  ") === "", "비어야 함");
});
test("htmlToText: h2·h3·ul·strong·br·엔티티", () => {
  const t = htmlToText("<h2>제목</h2><p>본문 <strong>강조</strong>&amp;<br>둘째</p><ul><li>a</li><li>b</li></ul><h3>작은</h3>");
  expect(t === "## 제목\n\n본문 **강조**&\n둘째\n\n- a\n- b\n\n### 작은", JSON.stringify(t));
});
test("왕복: 텍스트 → HTML → 텍스트 가 같다", () => {
  const src = "## 소제목\n\n문단 하나 **굵게**\n둘째 줄\n\n- 목록1\n- 목록2\n\n### 작은 소제목\n\n마지막";
  const back = htmlToText(formatBody(src));
  expect(back === src, JSON.stringify(back));
});

// 실제 글 52건: HTML → 텍스트 → HTML 에서 h2/h3/li/strong 개수 보존
const sb = { window: {}, document: { querySelector: () => null, querySelectorAll: () => [] }, console }; sb.window.window = sb.window; vm.createContext(sb);
for (const f of ["experts.js", "blog-data.js", "blog-legacy.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sb);
const posts = sb.window.staticPosts.filter((p) => p.body);
const decode = (h) => h.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const plainChars = (html) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, "");
const boldChars = (html) => (html.match(/<strong[^>]*>[\s\S]*?<\/strong>/g) || []).map(plainChars).join("").length;
test(`정적 글 ${posts.length}건 왕복: 소제목·목록 개수, 굵게 글자 수, 본문 글자가 모두 보존된다`, () => {
  const bad = [];
  for (const p of posts) {
    const back = formatBody(htmlToText(p.body));
    const diff = ["h2", "h3", "li"].filter((t) => count(p.body, t) !== count(back, t));
    if (boldChars(p.body) !== boldChars(back)) diff.push(`굵게 ${boldChars(p.body)}→${boldChars(back)}`);
    if (plainChars(p.body) !== plainChars(back)) diff.push(`본문 ${plainChars(p.body).length}→${plainChars(back).length}`);
    if (diff.length) bad.push(`${p.id}(${diff.join(",")})`);
  }
  expect(bad.length === 0, bad.slice(0, 5).join(" | "));
  return `${posts.length}건 통과`;
});

const pass = results.filter((r) => r[0] === "PASS").length, fail = results.length - pass;
for (const [s, n, d] of results) console.log(`${s === "PASS" ? "✔" : "✘"} ${s}  ${n}${d ? "  — " + d : ""}`);
console.log(`\nformat-body 결과: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
