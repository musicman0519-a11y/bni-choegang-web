// 글 본문 서식 변환 — 사이트(blog.js)와 관리자(admin.js)가 함께 씁니다. 브라우저·Node 양쪽에서 동작(DOM 불필요).
//   formatBody(text): 관리자 본문 텍스트 → HTML.  빈 줄 = 문단, "## " 소제목, "### " 작은 소제목, "- " 목록, **굵게**, 줄바꿈 = <br>
//   htmlToText(html): HTML(옛 글·정적 글) → 위 텍스트 형식.  formatBody(htmlToText(html)) 가 소제목·목록·굵게를 보존합니다.
(() => {
  const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const inline = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const formatBody = (text) => String(text || "").split(/\n\s*\n/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => /^[-•]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-•]\s+/, ""))}</li>`).join("")}</ul>`;
    if (lines.length === 1 && /^#{2,3}\s*$/.test(trimmed)) return ""; // 내용 없는 소제목은 버린다
    if (lines.length === 1 && /^###\s+/.test(trimmed)) return `<h3>${inline(trimmed.replace(/^###\s+/, ""))}</h3>`;
    if (lines.length === 1 && /^##\s+/.test(trimmed)) return `<h2>${inline(trimmed.replace(/^##\s+/, ""))}</h2>`;
    return `<p>${lines.map(inline).join("<br />")}</p>`;
  }).filter(Boolean).join("\n");

  // HTML → 텍스트. 엔티티(&lt; 등)는 그대로 둔 채 태그만 다루고 맨 마지막에 한 번만 decode 한다.
  // (먼저 decode 하면 본문 속 "< 숫자 >" 같은 글자가 태그로 오인돼 사라진다)
  const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const stripTags = (h) => String(h).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  // 굵게는 줄 단위로 표시한다(줄바꿈을 가로지르는 **…** 는 formatBody 가 못 읽으므로 줄마다 나눠 감싼다)
  const bold = (inner) => stripTags(inner).split("\n").map((l) => (l.trim() ? `**${l.trim()}**` : "")).join("\n");
  const inlineRaw = (html) => stripTags(String(html).replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, t, c) => bold(c)))
    .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim();
  const heading = (level, c) => { const t = inlineRaw(c).replace(/\n+/g, " ").trim(); return t ? `\n\n${"#".repeat(level)} ${t}\n\n` : "\n\n"; };

  const htmlToText = (html) => {
    let s = String(html || "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
    s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (m, c) => `- ${inlineRaw(c).replace(/\n+/g, " ")}\n`);
    s = s.replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n\n");
    s = s.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (m, c) => heading(2, c));
    s = s.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (m, c) => heading(3, c));
    s = s.replace(/<(p|div|blockquote|section|article)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, t, c) => `\n\n${inlineRaw(c)}\n\n`);
    s = inlineRaw(s);
    return decode(s.replace(/\n{3,}/g, "\n\n")).trim();
  };

  const api = { formatBody, htmlToText };
  if (typeof window !== "undefined") Object.assign(window, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
