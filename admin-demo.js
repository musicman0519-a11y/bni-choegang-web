// 관리자 페이지 데모 모드 (admin.html?demo)
// Supabase 연결 없이 화면 구성을 둘러보기 위한 가짜 데이터입니다. 바꾼 내용은 저장되지 않고, 새로고침하면 처음으로 돌아갑니다.
(() => {
  if (!new URLSearchParams(location.search).has("demo")) return;
  window.__adminDemo = true;
  window.SUPABASE_URL = "https://demo.local";
  window.SUPABASE_ANON_KEY = "demo";

  const now = Date.now();
  const ago = (minutes) => new Date(now - minutes * 60000).toISOString();
  const db = {
    admins: [
      { email: "demo@choegang.kr", note: "데모 관리자", created_at: ago(20000) },
      { email: "vice@choegang.kr", note: "부의장", created_at: ago(9000) },
    ],
    members: [], posts: [], banners: [], schedule: [
      { date: "2026-12-30", type: "off", label: "회의없음", note: "연말 휴회" },
      { date: "2026-11-11", type: "online", label: "화상회의", note: null },
    ],
    inquiries: [
      { id: "q1", kind: "visitor", name: "홍길동", phone: "010-1234-5678", email: "hong@example.com", company: "길동상사", category: "Medical", referrer: "이경세", message: "다음 주 수요일 조찬모임에 참관하고 싶습니다. 주차 가능한가요?", status: "new", memo: null, created_at: ago(35) },
      { id: "q2", kind: "collab", name: "김협업", phone: "010-2222-3333", email: null, company: "글로벌무역", category: "해외 / Consultant", referrer: null, message: "베트남 진출 관련해서 법률·세무 전문가 연결을 원합니다.", status: "new", memo: null, created_at: ago(180) },
      { id: "q3", kind: "visitor", name: "이참관", phone: "010-4444-5555", email: null, company: null, category: "Architecture & Interior", referrer: null, message: null, status: "done", memo: "10/8 통화 완료, 10/15 참석 예정", created_at: ago(4000) },
    ],
  };
  let seeded = false;
  const seed = () => {
    if (seeded || !window.staticMembers) return;
    seeded = true;
    db.members = window.staticMembers.map((m, i) => {
      const [company, title] = m.company.split(" · ");
      return { id: `m${i}`, name: m.name, category: m.category, company: company || "", title: title || "", description: m.description, tags: m.tags, grade: m.grade || null, rank: m.rank || null, homepage: null, photo_url: `assets/images/member-${m.name}.jpg`, namecard_url: null, sort_order: (i + 1) * 10, is_active: true, created_at: ago(9000 - i) };
    });
    db.posts = (window.staticPosts || []).map((p, i) => ({
      id: p.id, category: p.category, badge: p.badge, title: p.title, member: p.member, role: p.role, company: p.company, date: p.date, published_at: p.publishedAt || null,
      region: p.region || null, profile_field: p.profile?.field || null, profile_strength: p.profile?.strength || null, profile_area: p.profile?.area || null, lead: p.lead || null,
      body: (p.body || "").replace(/<h2>(.*?)<\/h2>/g, "\n\n## $1\n\n").replace(/<strong>(.*?)<\/strong>/g, "**$1**").replace(/<[^>]+>/g, "").replace(/\n\s*\n\s*/g, "\n\n").trim(),
      is_published: true, created_at: ago(8000 - i),
    }));
    db.banners = ["assets/images/event-1.jpg", "assets/images/event-4.jpg", "assets/images/event-7.png"].map((url, i) => ({ id: `b${i}`, image_url: url, sort_order: (i + 1) * 10, is_active: true, created_at: ago(7000 - i) }));
  };

  let seq = 1;
  const query = (table) => {
    let op = "select", payload = null, countMode = false, head = false;
    const filters = [], orders = [];
    const api = {
      select(_, opts) { countMode = Boolean(opts?.count); head = Boolean(opts?.head); return api; },
      eq(col, val) { filters.push((r) => r[col] === val); return api; },
      order(col, opts) { orders.push([col, opts?.ascending !== false]); return api; },
      limit() { return api; },
      insert(p) { op = "insert"; payload = Array.isArray(p) ? p : [p]; return api; },
      update(p) { op = "update"; payload = p; return api; },
      upsert(p) { op = "upsert"; payload = p; return api; },
      delete() { op = "delete"; return api; },
      then(resolve) {
        seed();
        const rows = db[table];
        const match = (r) => filters.every((f) => f(r));
        if (op === "insert") payload.forEach((p) => rows.push({ id: p.id || `new${seq++}`, created_at: new Date().toISOString(), is_active: true, is_published: true, status: "new", sort_order: 100, ...p }));
        else if (op === "upsert") { const i = rows.findIndex((r) => r.date === payload.date); if (i >= 0) rows[i] = { ...rows[i], ...payload }; else rows.push(payload); }
        else if (op === "update") rows.filter(match).forEach((r) => Object.assign(r, payload));
        else if (op === "delete") db[table] = rows.filter((r) => !match(r));
        if (op !== "select") return resolve({ data: null, error: null });
        const list = rows.filter(match);
        orders.slice().reverse().forEach(([c, asc]) => list.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)));
        resolve({ data: head ? null : list.map((r) => ({ ...r })), error: null, count: countMode ? list.length : null });
      },
    };
    return api;
  };
  const uploads = new Map();
  const client = {
    from: query,
    rpc: async () => ({ data: true, error: null }),
    auth: {
      getSession: async () => ({ data: { session: { user: { email: "demo@choegang.kr" } } } }),
      signInWithPassword: async () => ({ data: { session: { user: { email: "demo@choegang.kr" } } }, error: null }),
      signUp: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({}),
    },
    storage: {
      from: () => ({
        upload: async (path, file) => { uploads.set(path, URL.createObjectURL(file)); return { error: null }; },
        getPublicUrl: (path) => ({ data: { publicUrl: uploads.get(path) || "" } }),
      }),
    },
  };
  window.supabase = { createClient: () => client };
})();
