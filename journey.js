// 방문 여정 기록 — 참관 신청·협업 문의에 "어디서 와서 어떤 페이지를 거쳐 얼마나 머물다 신청했는지"를 붙입니다.
// 서버·외부 분석 도구 없이 브라우저 sessionStorage 만 씁니다. 개인 식별 정보(IP·세밀한 기기 정보)는 저장하지 않습니다.
//   window.getJourney()      현재 세션 요약 객체 (기록이 꺼져 있으면 null)
//   window.formatJourney(j)  관리자용 8줄 요약 문구
//   window.classifyChannel(refHost, utm) 채널 분류
// 끄기: 주소 뒤에 ?journey=off (관리자·테스트 트래픽), 다시 켜기: ?journey=on
(() => {
  const CHANNELS = [
    [/(^|\.)naver\.(com|net)$/i, "naver", "네이버"],
    [/(^|\.)google\./i, "google", "구글"],
    [/(^|\.)(daum\.net|kakao\.com)$/i, "daum", "다음·카카오"],
    [/(^|\.)instagram\.com$/i, "instagram", "인스타그램"],
    [/(^|\.)(facebook\.com|fb\.com)$/i, "facebook", "페이스북"],
    [/(^|\.)(youtube\.com|youtu\.be)$/i, "youtube", "유튜브"],
    [/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.)/i, "search", "기타 검색"],
    [/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com)$/i, "ai", "AI 검색"],
  ];
  const classifyChannel = (refHost, utm) => {
    const u = utm || {};
    if (u.source) {
      const src = String(u.source).toLowerCase();
      const label = `${u.source}${u.medium ? " / " + u.medium : ""}`;
      if (/qr|namecard|card/.test(src) || /qr/.test(String(u.medium || "").toLowerCase())) return { channel: "qr", label: `명함·QR (${label})` };
      return { channel: `utm:${src}`, label: `캠페인 ${label}` };
    }
    const host = String(refHost || "").toLowerCase();
    if (!host) return { channel: "direct", label: "직접 입력 · 즐겨찾기 · 명함 QR" };
    for (const [re, channel, label] of CHANNELS) if (re.test(host)) return { channel, label };
    return { channel: "referral", label: `외부 링크 (${host})` };
  };

  const detectDevice = (ua) => {
    const s = String(ua || "");
    const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(s);
    const inApp = /KAKAOTALK/i.test(s) ? "카카오톡" : /NAVER\(inapp|NAVER\//i.test(s) ? "네이버" : /Instagram/i.test(s) ? "인스타그램" : /FBAN|FBAV/i.test(s) ? "페이스북" : /Line\//i.test(s) ? "라인" : "";
    return { device: mobile ? "mobile" : "desktop", in_app: inApp };
  };

  const normalizePath = (pathname) => (String(pathname || "/").replace(/^\/bni-choegang-web(?=\/|$)/, "") || "/");
  const hostOf = (ref) => { try { return ref ? new URL(ref).hostname.replace(/^www\./, "") : ""; } catch (_) { return ""; } };

  // 순수 로직: 상태 객체를 받아 갱신한 새 상태를 돌려준다(테스트용)
  const start = ({ now, path, referrer, ownHost, search, userAgent }) => {
    const q = new URLSearchParams(search || "");
    const refHost = hostOf(referrer);
    const utm = {};
    for (const k of ["source", "medium", "campaign", "term", "content"]) { const v = q.get("utm_" + k); if (v) utm[k] = String(v).slice(0, 80); }
    const own = String(ownHost || "").replace(/^www\./, "");
    return {
      v: 1, session_start: now, entry_ref_host: refHost && refHost !== own ? refHost : "", entry_path: normalizePath(path), utm,
      ...detectDevice(userAgent), history: [normalizePath(path)], page_views: 1, prev_path: "", current_path: normalizePath(path),
    };
  };
  const visit = (state, path) => {
    const p = normalizePath(path);
    if (state.current_path === p) return state;
    const history = [...(state.history || []), p].slice(-8);
    return { ...state, prev_path: state.current_path, current_path: p, page_views: (state.page_views || 1) + 1, history };
  };
  const summarize = (state, { now, pageStart }) => {
    const ch = classifyChannel(state.entry_ref_host, state.utm);
    return {
      ...state, channel: ch.channel, channel_label: ch.label,
      session_dwell_sec: Math.max(0, Math.round((now - state.session_start) / 1000)),
      page_dwell_sec: Math.max(0, Math.round((now - pageStart) / 1000)),
    };
  };
  const formatJourney = (j) => {
    if (!j) return "";
    const ch = j.channel_label || classifyChannel(j.entry_ref_host, j.utm).label;
    const campaign = j.utm && j.utm.campaign ? ` (캠페인: ${j.utm.campaign}${j.utm.term ? " / 키워드: " + j.utm.term : ""})` : "";
    const device = `${j.device === "mobile" ? "모바일" : "데스크톱"}${j.in_app ? ` (${j.in_app} 앱)` : ""}`;
    const history = (j.history || []).join(" → ") || j.current_path || "/";
    return [
      `• 매체/채널: ${ch}${campaign}`,
      `• 유입 출처: ${j.entry_ref_host || "(없음 · 직접 입력)"}`,
      `• 최초 진입: ${j.entry_path || "/"}`,
      `• 직전 페이지: ${j.prev_path || "(없음)"}`,
      `• 탐색 경로: ${history} (총 ${j.page_views || 1}개 페이지)`,
      `• 체류 시간: 총 ${j.session_dwell_sec ?? 0}초 (신청 페이지: ${j.page_dwell_sec ?? 0}초)`,
      `• 접속 환경: ${device}`,
      `• 여정: 착륙 → 탐색 ${j.page_views || 1}페이지 → 폼 제출`,
    ].join("\n");
  };

  const core = { classifyChannel, detectDevice, normalizePath, start, visit, summarize, formatJourney };
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  if (typeof window === "undefined") return;

  // ── 브라우저: 세션 기록 ─────────────────────────────
  const KEY = "cg_journey_v1", OFF = "cg_journey_off";
  const q = new URLSearchParams(location.search);
  try {
    if (q.get("journey") === "off") localStorage.setItem(OFF, "1");
    if (q.get("journey") === "on") localStorage.removeItem(OFF);
  } catch (_) { /* 저장소 차단 시 무시 */ }
  let off = false;
  try { off = localStorage.getItem(OFF) === "1"; } catch (_) { off = false; }
  const now = Date.now();
  const pageStart = (typeof performance !== "undefined" && performance.timeOrigin) ? Math.round(performance.timeOrigin) : now;
  let state = null;
  try { state = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (_) { state = null; }
  if (!state || state.v !== 1) state = start({ now, path: location.pathname, referrer: document.referrer, ownHost: location.hostname, search: location.search, userAgent: navigator.userAgent });
  else state = visit(state, location.pathname);
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }

  window.getJourney = () => (off ? null : summarize(state, { now: Date.now(), pageStart }));
  window.formatJourney = formatJourney;
  window.classifyChannel = classifyChannel;
  window.journeyOff = off;
})();
