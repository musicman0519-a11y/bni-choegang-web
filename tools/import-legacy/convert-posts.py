"""옛 홈페이지 Supabase 덤프의 블로그 글을 새 사이트 정적 글(blog-legacy.js)로 변환.

사용: python -I tools/import-legacy/convert-posts.py <옛패키지폴더> [--only 슬러그]
입력: <옛패키지폴더>/bni_supabase_backup.sql, 새 사이트 experts.js · blog-data.js
출력: blog-legacy.js (window.staticPosts 에 덧붙임 + 겹치는 새 글 8건의 본문 채움)
      docs/plans/이관-검토-글.md (자동 분류 검토표)
선택: tools/import-legacy/overrides.json  {"슬러그": {"category": "...", "exclude": true}}
"""
import sys, os, re, json, html
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PKG = sys.argv[1]
ONLY = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
DUMP = os.path.join(PKG, "bni_supabase_backup.sql")
KST = timezone(timedelta(hours=9))
MIN_TEXT = 150
CATEGORIES = ["주간회의", "멤버소개", "파워팀소개", "121후기", "일상소개"]


# ── SQL 덤프 파싱 ─────────────────────────────────────────────
def split_vals(v):
    out, i, n = [], 0, len(v)
    while i < n:
        if v[i] == "'":
            j, buf = i + 1, []
            while j < n:
                if v[j] == "'" and j + 1 < n and v[j + 1] == "'":
                    buf.append("'"); j += 2; continue
                if v[j] == "'":
                    break
                buf.append(v[j]); j += 1
            out.append("".join(buf)); i = j + 1
        elif v[i] in ", \n":
            i += 1
        else:
            j = i
            while j < n and v[j] != ",":
                j += 1
            out.append(v[i:j].strip()); i = j
    return out


def read_table(sql, name):
    m = re.search(r"INSERT INTO public\.%s\s*\(([^)]*)\)" % name, sql)
    cols = [c.strip().strip('"') for c in m.group(1).split(",")]
    rows = []
    for body in re.findall(r"INSERT INTO public\.%s\s*\([^)]*\)\s*VALUES\s*\((.*?)\)\s*ON CONFLICT" % name, sql, re.S):
        row = dict(zip(cols, split_vals(body)))
        rows.append({k: ("" if v == "NULL" else v) for k, v in row.items()})
    return rows


# ── 본문 HTML 정리 ─────────────────────────────────────────────
ALLOWED = {"p", "h2", "h3", "ul", "ol", "li", "strong", "em", "a", "blockquote", "br"}
RENAME = {"b": "strong", "i": "em", "h1": "h2", "h4": "h3", "h5": "h3", "h6": "h3"}
BLOCKISH = {"div", "section", "article", "header", "footer", "figure", "figcaption", "table", "tr", "td", "th", "tbody", "thead"}
DROP_SUBTREE = {"script", "style", "img", "picture", "svg", "iframe", "button", "form", "input", "select", "noscript"}
BAD_LINK = re.compile(r"jhigjfiwjrrpatlagnll|^/img/|^img/|^javascript:", re.I)
DROP_CLASS = re.compile(r"member-featured-card|calc-hook|interactive-calc|member-banner|blog-cta-box", re.I)
VOID = {"img", "br", "hr", "input", "meta", "link", "source", "wbr"}


class Cleaner(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip, self.stack = [], 0, []
        self.lead, self._in_lead = "", False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in VOID:  # 닫는 태그가 없으므로 스택에 넣지 않는다
            if not self.skip and tag == "br":
                self.out.append("<br>")
            return
        if self.skip or tag in DROP_SUBTREE or DROP_CLASS.search(attrs.get("class", "") or ""):
            self.skip += 1; self.stack.append((tag, True)); return
        if tag == "p" and "blog-lead" in (attrs.get("class") or "") and not self.lead:
            self._in_lead = True; self.skip += 1; self.stack.append((tag, True)); return
        tag = RENAME.get(tag, tag)
        if tag in BLOCKISH or tag == "p":
            self.out.append("\n\n"); self.stack.append((tag, False)); return
        if tag in ALLOWED:
            if tag == "a":
                href = (attrs.get("href") or "").strip()
                if not href.startswith("http") or BAD_LINK.search(href):
                    self.stack.append(("a", False)); return
                self.out.append(f'<a href="{html.escape(href)}" target="_blank" rel="noopener">')
            elif tag == "br":
                self.out.append("<br>")
            else:
                self.out.append(f"<{tag}>")
                if tag in ("h2", "h3", "li", "blockquote", "ul", "ol"):
                    pass
        self.stack.append((tag, False))

    def handle_endtag(self, tag):
        if not self.stack:
            return
        t, skipped = self.stack.pop()
        if skipped:
            self.skip -= 1
            if self._in_lead and t == "p":
                self._in_lead = False
            return
        if t in BLOCKISH or t == "p":
            self.out.append("\n\n"); return
        if t in ALLOWED and t != "br":
            if t == "a" and (not self.out or not any("<a " in x for x in self.out[-30:])):
                return
            self.out.append(f"</{t}>")

    def handle_data(self, data):
        if self._in_lead:
            self.lead += data
        elif not self.skip:
            self.out.append(html.escape(data, quote=False))


def md_to_html(text):
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)                    # 이미지 제거
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", lambda m: "" if BAD_LINK.search(m.group(2)) else f'<a href="{html.escape(m.group(2))}" target="_blank" rel="noopener">{html.escape(m.group(1))}</a>', text)
    blocks = []
    for block in re.split(r"\n\s*\n", text):
        lines = [l.rstrip() for l in block.strip().split("\n") if l.strip()]
        if not lines:
            continue
        if all(re.match(r"^\s*[-*•]\s+", l) for l in lines):
            items = "".join(f"<li>{inline(re.sub(r'^\s*[-*•]\s+', '', l))}</li>" for l in lines)
            blocks.append(f"<ul>{items}</ul>"); continue
        if re.match(r"^#{1,6}\s", lines[0]) and len(lines) == 1:
            level = 2 if lines[0].startswith("# ") or lines[0].startswith("## ") else 3
            blocks.append(f"<h{level}>{inline(re.sub(r'^#+\s*', '', lines[0]))}</h{level}>"); continue
        blocks.append("<p>" + "<br>".join(inline(l) for l in lines) + "</p>")
    return "\n".join(blocks)


def inline(s):
    s = html.escape(s, quote=False) if "<" not in s else s
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    return s


def pre_clean(raw):
    raw = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", raw)                       # Markdown 이미지
    raw = re.sub(r"https?://jhigjfiwjrrpatlagnll\.supabase\.co/\S+", "", raw)  # 사라진 저장소 주소
    raw = re.sub(r"\\([*_~#\[\]()`>.!-])", r"\1", raw)                   # Markdown 역슬래시 이스케이프
    return raw


def clean_html(raw):
    """본문 HTML 정리. 반환: (html, 리드 문장 또는 '')"""
    raw = pre_clean(raw)
    looks_html = bool(re.search(r"<(p|div|h[1-6]|ul|br|strong|span)\b", raw, re.I))
    if not looks_html:
        return md_to_html(raw), ""
    c = Cleaner(); c.feed(raw); c.close()
    out = "".join(c.out)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    # 블록 경계(\n\n)로 나눠 p 로 감싸기, 이미 블록 태그면 그대로
    blocks = []
    for chunk in re.split(r"\n\s*\n", out):
        chunk = re.sub(r"[ \t\r\f\v]+", " ", chunk).strip()
        chunk = re.sub(r"^(<br>\s*)+|(\s*<br>)+$", "", chunk).strip()
        if not chunk or not re.sub(r"<[^>]+>|&nbsp;|\s", "", chunk):
            continue
        if re.match(r"^<(h2|h3|ul|ol|blockquote|li)\b", chunk):
            blocks.append(chunk)
        else:
            blocks.append(f"<p>{chunk}</p>")
    out = "\n".join(blocks)
    out = re.sub(r"<p>\s*</p>", "", out)
    out = re.sub(r"<li>\s*</li>", "", out)
    out = re.sub(r"<(ul|ol)>\s*</\1>", "", out)
    return out, re.sub(r"\s+", " ", c.lead).strip()


def plain_text(h):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h)).strip()


# ── 분류·메타 ───────────────────────────────────────────────
def guess_category(title):
    if re.search(r"주간회의|조찬모임|weekly", title, re.I):
        return "주간회의"
    if "121" in title:
        return "121후기"
    if re.search(r"파워팀", title):
        return "파워팀소개"
    if re.search(r"^\[|환영회|신입회원|대표\s*(\||$)|원장\s*(\||$)|매니저|지점장|시설장|소개", title):
        return "멤버소개"
    return "일상소개"


def clean_title(t):
    t = re.sub(r"\s*\|\s*BNI\s*최강챕터(?:\s*블로그)?\s*$", "", t).strip()
    return t


def fmt_date(iso):
    d = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(KST)
    return f"{d.year}.{d.month:02d}", f"{d.year}. {d.month}. {d.day}."


def js_string(s):
    return json.dumps(s, ensure_ascii=False).replace("</", "<\\/")


# ── 실행 ─────────────────────────────────────────────────────
sql = open(DUMP, encoding="utf-8", errors="replace").read()
posts = read_table(sql, "blog")
old_members = {m["id"]: m for m in read_table(sql, "members")}
overrides = {}
ov_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "overrides.json")
if os.path.exists(ov_path):
    overrides = json.load(open(ov_path, encoding="utf-8"))

experts = open(os.path.join(ROOT, "experts.js"), encoding="utf-8").read()
new_members = {}
for m in re.finditer(r'\{ name: "([^"]+)", category: "([^"]+)", company: "([^"]+)".*?tags: \[([^\]]*)\]', experts):
    company, _, role = m.group(3).partition(" · ")
    tags = re.findall(r'"([^"]+)"', m.group(4))
    new_members[m.group(1)] = {"company": company, "role": role, "category": m.group(2), "tags": tags}

blog_data = open(os.path.join(ROOT, "blog-data.js"), encoding="utf-8").read()
new_posts = {}  # 멤버 이름 → 새 글 id (멤버소개 겹침 병합용)
for m in re.finditer(r'id: "([^"]+)",\s*category: "멤버소개".*?member: "([^"]+)"', blog_data, re.S):
    new_posts[m.group(2)] = m.group(1)
new_posts_with_body = set(re.findall(r'id: "([^"]+)",(?:(?!\n  \{).)*?body: `', blog_data, re.S))

name_re = re.compile(r"([가-힣]{2,4})\s*(대표|원장|지점장|시설장|매니저)")
legacy, merged, review, skipped = [], {}, [], []
for p in sorted(posts, key=lambda r: r["created_at"]):
    slug = p["slug"] or p["id"]
    if ONLY and slug != ONLY:
        continue
    ov = overrides.get(slug, {})
    title = clean_title(p["title"])
    body, html_lead = clean_html(p["content"])
    text = plain_text(body)
    if ov.get("exclude") or len(text) < MIN_TEXT:
        skipped.append((slug, title, "제외" if ov.get("exclude") else f"텍스트 {len(text)}자")); continue
    category = ov.get("category") or guess_category(title)
    member = ""
    names_in_title = [n for n, _ in name_re.findall(title) if n in new_members]
    if p.get("member_id") and p["member_id"] in old_members:
        member = old_members[p["member_id"]]["name"]
    elif category == "멤버소개" and len(set(names_in_title)) == 1:
        member = names_in_title[0]
    if category == "멤버소개" and len(set(names_in_title)) > 1 and not p.get("member_id"):
        category = "일상소개"  # 여러 멤버를 함께 소개하는 글은 특정 멤버 글이 아님
    if member and member not in new_members:
        member = ""  # 탈퇴 멤버는 연결하지 않음
    date, published = fmt_date(p["created_at"])
    lead = plain_text(p["excerpt"]) if p["excerpt"] else html_lead
    if lead and len(lead) > 160:
        lead = lead[:157] + "…"
    info = new_members.get(member, {})
    region = ""
    for om in old_members.values():
        if om["name"] == member and om.get("region"):
            region = om["region"]
    badge = (f"{info['tags'][0]} 전문가" if info.get("tags") else category) if member else category
    post = {"id": slug, "category": category, "badge": badge, "title": title,
            "member": member or None, "role": info.get("role") or None, "company": info.get("company") or None,
            "date": date, "publishedAt": published, "region": region or None, "lead": lead or None, "body": body}
    # 새 사이트에 같은 멤버 소개 글이 있으면 본문만 채우고 옛 글은 목록에 넣지 않음
    if category == "멤버소개" and member in new_posts:
        nid = new_posts[member]
        if nid not in new_posts_with_body and nid not in merged:
            merged[nid] = {"body": body, "lead": lead or None, "publishedAt": published}
            review.append((slug, title, category, published, member, f"→ 새 글 {nid} 본문으로 병합"))
        else:
            review.append((slug, title, category, published, member, f"→ 새 글 {nid} 이 이미 본문을 갖고 있어 제외(중복)"))
        continue
    legacy.append(post)
    review.append((slug, title, category, published, member, ""))

# ── 출력: blog-legacy.js ─────────────────────────────────────
lines = ["// 옛 홈페이지(bnichoegang.com) 블로그 글 — tools/import-legacy/convert-posts.py 가 생성. 직접 고치지 말고 스크립트·overrides.json 을 수정하세요.",
         f"// 생성: {datetime.now(KST).strftime('%Y-%m-%d')} · 글 {len(legacy)}건 · 병합 {len(merged)}건",
         "(() => {", "  const legacyPosts = ["]
for post in legacy:
    fields = [f"{k}: {js_string(v)}" for k, v in post.items() if v is not None and k != "body"]
    lines.append("    { " + ", ".join(fields) + ",")
    lines.append(f"      body: {js_string(post['body'])} }},")
lines.append("  ];")
lines.append("  const legacyBodies = {")
for nid, v in merged.items():
    lines.append(f"    {js_string(nid)}: {{ body: {js_string(v['body'])}, lead: {js_string(v['lead'] or '')}, publishedAt: {js_string(v['publishedAt'])} }},")
lines.append("  };")
lines.append("""  const posts = (window.staticPosts = window.staticPosts || []);
  const existing = new Set(posts.map((p) => p.id));
  legacyPosts.forEach((p) => { if (!existing.has(p.id)) posts.push(p); });
  posts.forEach((p) => {
    const fill = legacyBodies[p.id];
    if (fill && !p.body) { p.body = fill.body; if (!p.lead && fill.lead) p.lead = fill.lead; if (!p.publishedAt) p.publishedAt = fill.publishedAt; }
  });
  // 날짜 내림차순 (새 글 '2026.09' 형식과 옛 글 publishedAt 모두 지원)
  const key = (p) => (p.publishedAt || p.date || "").replace(/[^0-9]/g, "").padEnd(8, "0");
  posts.sort((a, b) => key(b).localeCompare(key(a)));
  window.blogPosts = window.sitePosts || posts;
})();""")
open(os.path.join(ROOT, "blog-legacy.js"), "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")

# ── 출력: 검토표 ─────────────────────────────────────────────
md = ["# 옛 블로그 글 이관 검토표", "", f"생성: {datetime.now(KST).strftime('%Y-%m-%d')} · 적재 {len(legacy)}건 · 병합 {len(merged)}건 · 제외 {len(skipped)}건", "",
      "카테고리를 고치려면 `tools/import-legacy/overrides.json` 에 `{\"슬러그\": {\"category\": \"주간회의\"}}` 처럼 적고 스크립트를 다시 실행합니다. 빼려면 `{\"exclude\": true}`.", "",
      "| # | 슬러그(id) | 제목 | 자동 분류 | 날짜 | 멤버 | 비고 |", "|---|---|---|---|---|---|---|"]
for i, (slug, title, cat, pub, member, note) in enumerate(review, 1):
    md.append(f"| {i} | `{slug}` | {title} | {cat} | {pub} | {member or ''} | {note} |")
md += ["", "## 제외", ""] + [f"- `{s}` {t} ({why})" for s, t, why in skipped]
open(os.path.join(ROOT, "docs", "plans", "이관-검토-글.md"), "w", encoding="utf-8", newline="\n").write("\n".join(md) + "\n")

import collections
print(f"적재 {len(legacy)}건, 병합 {len(merged)}건, 제외 {len(skipped)}건")
print("분류:", dict(collections.Counter(p["category"] for p in legacy)))
print("멤버 연결:", sum(1 for p in legacy if p["member"]), "건")
out = open(os.path.join(ROOT, "blog-legacy.js"), encoding="utf-8").read()
print("잔여 검사 — style=:", out.count("style="), "| jhig:", out.count("jhigjfiwjrrpatlagnll"), "| /img/:", out.count("/img/"), "| <img:", out.count("<img"), "| 크기:", len(out.encode("utf-8")) // 1024, "KB")
