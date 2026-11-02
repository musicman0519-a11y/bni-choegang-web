// 새 문의 알림 (Supabase Edge Function)
// inquiries 표에 새 문의가 저장되면 Database Webhook 이 이 함수를 부르고,
// 관리자에게 메일(Resend)과 문자(SOLAPI)를 보냅니다.
//
// 필요한 Secrets (Supabase 대시보드 → Edge Functions → Secrets)
//   WEBHOOK_SECRET      웹훅 헤더 x-webhook-secret 와 같은 아무 긴 문자열
//   ADMIN_URL           관리자 페이지 주소 (예: https://choegang.kr/admin.html)
//   RESEND_API_KEY      Resend API 키
//   MAIL_FROM           보내는 주소 (예: "최강챕터 알림 <noreply@choegang.kr>")
//   NOTIFY_EMAILS       받을 메일, 쉼표로 여러 개
//   SOLAPI_API_KEY      솔라피 API Key
//   SOLAPI_API_SECRET   솔라피 API Secret
//   SOLAPI_SENDER       솔라피에 등록한 발신번호 (숫자만)
//   NOTIFY_PHONES       받을 휴대폰 번호, 쉼표로 여러 개
// 메일이나 문자 설정이 비어 있으면 그 알림만 건너뜁니다.

type Inquiry = {
  id?: string;
  kind: "visitor" | "collab";
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  category?: string | null;
  referrer?: string | null;
  message?: string | null;
  created_at?: string;
};

const env = (key: string) => (Deno.env.get(key) ?? "").trim();
const list = (key: string) => env(key).split(",").map((v) => v.trim()).filter(Boolean);
const digits = (value: string) => value.replace(/[^0-9]/g, "");
const esc = (text: unknown) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const kindLabel = (row: Inquiry) => (row.kind === "visitor" ? "참관 신청" : "협업 문의");
const timeKST = (iso?: string) =>
  new Date(iso ?? Date.now()).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

// ── 메일 (Resend) ─────────────────────────────────────────
async function sendEmail(row: Inquiry) {
  const key = env("RESEND_API_KEY");
  const to = list("NOTIFY_EMAILS");
  if (!key || !to.length) return "메일: 설정 없음, 건너뜀";

  const fields: [string, unknown][] = [
    ["이름", row.name],
    ["연락처", row.phone],
    ["이메일", row.email],
    ["회사/소속", row.company],
    [row.kind === "visitor" ? "관심 업종" : "범위 · 분야", row.category],
    ["추천인", row.referrer],
    ["접수 시각", timeKST(row.created_at)],
  ];
  const rows = fields
    .filter(([, value]) => value)
    .map(([label, value]) => `<tr><th align="left" style="padding:6px 14px 6px 0;color:#6b7280;font-weight:600;white-space:nowrap">${esc(label)}</th><td style="padding:6px 0">${esc(value)}</td></tr>`)
    .join("");
  const adminUrl = env("ADMIN_URL");
  const html = `
    <div style="font-family:'Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;color:#1c242c">
      <div style="background:#2C2A6B;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
        <b style="font-size:17px">새 ${esc(kindLabel(row))}${row.kind === "visitor" ? "이" : "가"} 들어왔어요</b>
      </div>
      <div style="border:1px solid #e3e5ec;border-top:0;padding:18px 22px;border-radius:0 0 10px 10px">
        <table style="border-collapse:collapse;font-size:14px">${rows}</table>
        ${row.message ? `<div style="margin-top:14px;padding:12px 14px;background:#f5f6f9;border-radius:8px;white-space:pre-wrap;font-size:14px;line-height:1.7">${esc(row.message)}</div>` : ""}
        ${adminUrl ? `<p style="margin:20px 0 0"><a href="${esc(adminUrl)}" style="display:inline-block;background:#2C2A6B;color:#fff;padding:10px 18px;border-radius:7px;text-decoration:none;font-weight:700">관리자 페이지에서 확인하기</a></p>` : ""}
      </div>
    </div>`;
  const text = `${fields.filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`).join("\n")}${row.message ? `\n\n${row.message}` : ""}${adminUrl ? `\n\n${adminUrl}` : ""}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("MAIL_FROM") || "최강챕터 알림 <onboarding@resend.dev>",
      to,
      reply_to: row.email || undefined,
      subject: `[최강챕터] 새 ${kindLabel(row)} · ${row.name}`,
      html,
      text,
    }),
  });
  if (!res.ok) throw new Error(`메일 실패 ${res.status}: ${await res.text()}`);
  return `메일: ${to.length}명 발송`;
}

// ── 문자 (SOLAPI) ─────────────────────────────────────────
async function solapiAuthHeader(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(date + salt));
  const hex = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${hex}`;
}

async function sendSms(row: Inquiry) {
  const apiKey = env("SOLAPI_API_KEY");
  const apiSecret = env("SOLAPI_API_SECRET");
  const from = digits(env("SOLAPI_SENDER"));
  const phones = list("NOTIFY_PHONES").map(digits).filter(Boolean);
  if (!apiKey || !apiSecret || !from || !phones.length) return "문자: 설정 없음, 건너뜀";

  // 짧게 보내면 단문(SMS), 길면 솔라피가 자동으로 장문(LMS)으로 보냅니다.
  const detail = row.category ? ` · ${row.category}` : "";
  const memo = row.message ? `\n${row.message.replace(/\s+/g, " ").slice(0, 60)}` : "";
  const text = `[최강챕터] 새 ${kindLabel(row)}\n${row.name} ${row.phone}${detail}${memo}`;

  const res = await fetch("https://api.solapi.com/messages/v4/send-many", {
    method: "POST",
    headers: { Authorization: await solapiAuthHeader(apiKey, apiSecret), "Content-Type": "application/json" },
    body: JSON.stringify({ messages: phones.map((to) => ({ to, from, text })) }),
  });
  if (!res.ok) throw new Error(`문자 실패 ${res.status}: ${await res.text()}`);
  return `문자: ${phones.length}명 발송`;
}

// ── 웹훅 받기 ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const secret = env("WEBHOOK_SECRET");
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  // Database Webhook 형식 { type, table, record } 또는 문의 행 그대로
  const row: Inquiry | undefined = payload?.record ?? payload;
  if (payload?.type && payload.type !== "INSERT") return new Response("skip");
  if (!row?.name || !row?.phone) return new Response("no inquiry", { status: 400 });

  const results = await Promise.allSettled([sendEmail(row), sendSms(row)]);
  const report = results.map((r) => (r.status === "fulfilled" ? r.value : String(r.reason)));
  console.log(report.join(" / "));
  const failed = results.some((r) => r.status === "rejected");
  return Response.json({ ok: !failed, report }, { status: failed ? 500 : 200 });
});
