// 방문 여정 기록 로직 테스트 — journey.js (브라우저 없이 순수 함수만)
// 사용: node tools/e2e/journey.test.js
const path = require("path");
const { classifyChannel, detectDevice, normalizePath, start, visit, summarize, formatJourney } = require(path.resolve(__dirname, "..", "..", "journey.js"));
const results = [];
const test = (name, fn) => { try { const d = fn(); results.push(["PASS", name, d || ""]); } catch (e) { results.push(["FAIL", name, e.message]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const T0 = 1_700_000_000_000;

test("채널 분류: 네이버·구글·인스타·없음·UTM·외부 링크", () => {
  expect(classifyChannel("m.search.naver.com").channel === "naver", "naver");
  expect(classifyChannel("www.google.com").channel === "google", "google");
  expect(classifyChannel("l.instagram.com").channel === "instagram", "instagram");
  expect(classifyChannel("").channel === "direct", "direct");
  expect(classifyChannel("naver.com", { source: "namecard", medium: "qr" }).channel === "qr", "qr");
  expect(classifyChannel("", { source: "kakao", medium: "message" }).label.includes("캠페인 kakao / message"), "utm label");
  expect(classifyChannel("bni.com").label.includes("외부 링크 (bni.com)"), "referral");
  expect(classifyChannel("chatgpt.com").channel === "ai", "ai");
});
test("기기·인앱 감지", () => {
  expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) NAVER(inapp; search; 2000)").in_app === "네이버", "naver app");
  expect(detectDevice("Mozilla/5.0 (Linux; Android 14) KAKAOTALK").device === "mobile", "mobile");
  expect(detectDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120").device === "desktop" && !detectDevice("Chrome").in_app, "desktop");
});
test("경로 정규화: github.io 하위 경로 접두어 제거, 빈 값은 /", () => {
  expect(normalizePath("/bni-choegang-web/visitor.html") === "/visitor.html", "prefix");
  expect(normalizePath("/bni-choegang-web") === "/", "prefix only");
  expect(normalizePath("/blog/slug/") === "/blog/slug/", "keep");
  expect(normalizePath("") === "/", "empty");
});
test("세션 시작: 리퍼러 호스트·진입 경로·UTM·기기 저장, 자기 사이트 리퍼러는 비움", () => {
  const s = start({ now: T0, path: "/about.html", referrer: "https://m.search.naver.com/search?q=bni", ownHost: "choegang.co.kr", search: "?utm_source=naver&utm_campaign=spring", userAgent: "iPhone NAVER(inapp" });
  expect(s.entry_ref_host === "m.search.naver.com" && s.entry_path === "/about.html", JSON.stringify(s));
  expect(s.utm.source === "naver" && s.utm.campaign === "spring", "utm");
  expect(s.device === "mobile" && s.in_app === "네이버" && s.page_views === 1 && s.history.length === 1, "device/history");
  const own = start({ now: T0, path: "/", referrer: "https://www.choegang.co.kr/blog.html", ownHost: "choegang.co.kr", search: "", userAgent: "" });
  expect(own.entry_ref_host === "", "자기 사이트 리퍼러");
});
test("페이지 이동 3회: history 3개, page_views 3, prev_path 정확, 같은 페이지 새로고침은 안 셈", () => {
  let s = start({ now: T0, path: "/", referrer: "", ownHost: "x", search: "", userAgent: "" });
  s = visit(s, "/about.html"); s = visit(s, "/about.html"); s = visit(s, "/visitor.html");
  expect(s.history.join(" → ") === "/ → /about.html → /visitor.html", s.history.join(","));
  expect(s.page_views === 3 && s.prev_path === "/about.html" && s.current_path === "/visitor.html", JSON.stringify(s));
});
test("history 는 최근 8개만", () => {
  let s = start({ now: T0, path: "/p0", referrer: "", ownHost: "x", search: "", userAgent: "" });
  for (let i = 1; i <= 12; i += 1) s = visit(s, `/p${i}`);
  expect(s.history.length === 8 && s.history[0] === "/p5" && s.page_views === 13, JSON.stringify(s.history));
});
test("요약: 체류 시간 계산과 채널 라벨", () => {
  const s = visit(start({ now: T0, path: "/", referrer: "https://www.google.com/", ownHost: "x", search: "", userAgent: "" }), "/visitor.html");
  const j = summarize(s, { now: T0 + 116_000, pageStart: T0 + 63_000 });
  expect(j.session_dwell_sec === 116 && j.page_dwell_sec === 53, `${j.session_dwell_sec}/${j.page_dwell_sec}`);
  expect(j.channel === "google" && j.channel_label === "구글", j.channel_label);
});
test("문구: 8줄, 옛 사이트 항목 이름 유지", () => {
  const s = visit(start({ now: T0, path: "/about.html", referrer: "https://m.search.naver.com/", ownHost: "x", search: "", userAgent: "iPhone NAVER(inapp" }), "/visitor.html");
  const text = formatJourney(summarize(s, { now: T0 + 116_000, pageStart: T0 + 63_000 }));
  const lines = text.split("\n");
  expect(lines.length === 8, `${lines.length}줄`);
  for (const k of ["매체/채널: 네이버", "유입 출처: m.search.naver.com", "최초 진입: /about.html", "직전 페이지: /about.html", "탐색 경로: /about.html → /visitor.html (총 2개 페이지)", "체류 시간: 총 116초 (신청 페이지: 53초)", "접속 환경: 모바일 (네이버 앱)", "탐색 2페이지"]) expect(text.includes(k), "없음: " + k);
  expect(formatJourney(null) === "", "null → 빈 문자열");
});

const pass = results.filter((r) => r[0] === "PASS").length, fail = results.length - pass;
for (const [s, n, d] of results) console.log(`${s === "PASS" ? "✔" : "✘"} ${s}  ${n}${d ? "  — " + d : ""}`);
console.log(`\njourney 결과: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
