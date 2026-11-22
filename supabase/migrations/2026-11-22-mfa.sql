-- ─────────────────────────────────────────────────────────────
-- 2단계 인증(MFA) 강제 (2026-11-22) — 보안-강화.md 11번
-- ★ 관리자 전원이 admin.html 에서 인증 앱 등록을 마친 뒤에 실행하세요.
--   실행 후에는 인증 앱 6자리를 거치지 않은 세션(aal1)은 관리자 권한이 없습니다.
-- 되돌리기: 아래 함수를 schema.sql 의 원래 is_admin() 으로 다시 만들면 됩니다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'))
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
