-- ─────────────────────────────────────────────────────────────
-- 보안 강화 마이그레이션 (2026-11-22) — 보안-강화.md 2·3번
-- 이미 schema.sql 을 실행한 프로젝트의 SQL Editor 에 이 파일 전체를 붙여넣고 Run 하세요.
-- 새 프로젝트는 schema.sql 에 같은 내용이 포함돼 있어 따로 실행할 필요 없습니다.
-- ─────────────────────────────────────────────────────────────

-- 1) 문의 입력값 제약 보강 (길이·형식·journey 크기)
alter table public.inquiries drop constraint if exists inquiries_phone_format;
alter table public.inquiries add constraint inquiries_phone_format
  check (phone ~ '^[0-9+()\- ]{6,30}$');
alter table public.inquiries drop constraint if exists inquiries_email_format;
alter table public.inquiries add constraint inquiries_email_format
  check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table public.inquiries drop constraint if exists inquiries_journey_size;
alter table public.inquiries add constraint inquiries_journey_size
  check (journey is null or pg_column_size(journey) <= 8192);

-- 2) 문의 폭주 제한: 같은 전화번호 1시간 3건, 전체 10분 30건
create or replace function public.inquiries_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text := regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g');
  same_phone int;
  recent_all int;
begin
  select count(*) into same_phone from public.inquiries
    where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = digits
      and created_at > now() - interval '1 hour';
  if same_phone >= 3 then
    raise exception '같은 연락처로 1시간 안에 접수가 너무 많습니다. 잠시 후 다시 시도해 주세요.' using errcode = 'P0001';
  end if;
  select count(*) into recent_all from public.inquiries where created_at > now() - interval '10 minutes';
  if recent_all >= 30 then
    raise exception '접수가 일시적으로 몰려 있습니다. 잠시 후 다시 시도해 주세요.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists inquiries_rate_limit on public.inquiries;
create trigger inquiries_rate_limit
  before insert on public.inquiries
  for each row execute function public.inquiries_rate_limit();
