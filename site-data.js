// 사이트 데이터 로더
// supabase-config.js 에 연결 정보가 있으면 Supabase 에서 멤버·블로그·배너·일정을 불러온 뒤
// data-scripts 에 적힌 페이지 스크립트를 순서대로 실행합니다.
// 연결 정보가 없거나 불러오기에 실패하면 각 스크립트에 들어 있는 기본 데이터로 동작합니다.
(() => {
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  const me = document.currentScript;
  const pageScripts = (me?.dataset.scripts || "").split(/\s+/).filter(Boolean);
  const configured = Boolean(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);
  window.siteConfigured = configured;

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`스크립트를 불러오지 못했습니다: ${src}`));
    document.head.append(script);
  });

  let client = null;
  window.getSupabase = async () => {
    if (!configured) return null;
    if (client) return client;
    if (!window.supabase?.createClient) await loadScript(SDK_URL);
    client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return client;
  };

  // DB 행 → 사이트에서 쓰는 형태
  window.rowToMember = (row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    company: row.title ? `${row.company} · ${row.title}` : row.company,
    description: row.description || "",
    tags: row.tags || [],
    grade: row.grade || undefined,
    rank: row.rank || undefined,
    homepage: row.homepage || undefined,
    photo: row.photo_url || undefined,
    namecard: row.namecard_url || undefined,
  });
  window.rowToPost = (row) => ({
    id: row.id,
    category: row.category,
    badge: row.badge,
    title: row.title,
    member: row.member,
    role: row.role,
    company: row.company,
    date: row.date,
    publishedAt: row.published_at || undefined,
    region: row.region || undefined,
    profile: row.profile_field || row.profile_strength || row.profile_area
      ? { field: row.profile_field || "", strength: row.profile_strength || "", area: row.profile_area || "" }
      : undefined,
    lead: row.lead || undefined,
    bodyText: row.body || "",
    video: row.video_url || undefined,
    cover: row.cover_url || undefined,
  });

  async function loadData() {
    if (!configured) return;
    try {
      const sb = await window.getSupabase();
      const [members, posts, banners, schedule] = await Promise.all([
        sb.from("members").select("*").eq("is_active", true).order("sort_order").order("created_at"),
        sb.from("posts").select("*").eq("is_published", true).order("created_at", { ascending: false }),
        sb.from("banners").select("*").eq("is_active", true).order("sort_order").order("created_at"),
        sb.from("schedule").select("*"),
      ]);
      // 아직 아무것도 등록하지 않은 표는 기본 데이터를 그대로 씁니다.
      if (!members.error && members.data.length) window.siteMembers = members.data.map(window.rowToMember);
      if (!posts.error && posts.data.length) window.sitePosts = posts.data.map(window.rowToPost);
      if (!banners.error && banners.data.length) window.siteBanners = banners.data.map((row) => row.image_url);
      if (!schedule.error) {
        window.siteSchedule = Object.fromEntries(schedule.data.map((row) => [row.date, { type: row.type, label: row.label, note: row.note || undefined }]));
      }
    } catch (error) {
      console.warn("Supabase 데이터를 불러오지 못해 기본 데이터로 표시합니다.", error);
    }
  }

  async function runPageScripts() {
    for (const src of pageScripts) {
      try {
        await loadScript(src);
      } catch (error) {
        console.error(error);
      }
    }
  }

  loadData().finally(runPageScripts);
})();
