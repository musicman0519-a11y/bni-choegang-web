-- ─────────────────────────────────────────────────────────────
-- BNI 최강챕터 홈페이지 · Supabase 설정
-- Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run 하세요.
-- 마지막 줄의 관리자 이메일을 본인 이메일로 바꾼 뒤 실행해야 합니다.
-- ─────────────────────────────────────────────────────────────

-- 관리자 목록: 여기에 등록된 이메일로 로그인한 사람만 데이터를 고칠 수 있습니다.
create table if not exists public.admins (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);
alter table public.admins add column if not exists note text;
alter table public.admins add column if not exists created_at timestamptz not null default now();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- 멤버
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Consultant',
  company text not null default '',
  title text not null default '대표',
  description text not null default '',
  tags text[] not null default '{}',
  grade text,            -- GOLD CLUB / GREEN CLUB / GREEN LIGHT
  rank text,             -- 의장 / 부의장 / ST 등
  homepage text,
  photo_url text,
  namecard_url text,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 블로그
create table if not exists public.posts (
  id text primary key,   -- 주소에 쓰이는 영문 아이디 (예: kim-hajeong)
  category text not null default '멤버소개',
  badge text not null default '',
  title text not null,
  member text,           -- 글의 멤버 이름 (members.name)
  role text,
  company text,
  date text not null default to_char(now(), 'YYYY.MM'),
  published_at text,
  region text,
  profile_field text,
  profile_strength text,
  profile_area text,
  lead text,
  body text not null default '',   -- 빈 줄로 문단 구분, "## 제목", **굵게**
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.posts add column if not exists video_url text;   -- 유튜브 등 영상 주소
alter table public.posts add column if not exists cover_url text;   -- 대표 이미지

-- 메인 배너 사진
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 일정 (특정 날짜만 등록 · 매주 수요일 조찬회의는 자동 표시)
create table if not exists public.schedule (
  date date primary key,
  type text not null default 'meeting' check (type in ('meeting', 'online', 'off', 'event')),
  label text not null,
  note text
);

-- 비지터 · 협업 문의
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('visitor', 'collab')),
  name text not null check (char_length(name) between 1 and 50),
  phone text not null check (char_length(phone) between 6 and 30),
  email text check (email is null or char_length(email) <= 120),
  company text check (company is null or char_length(company) <= 100),
  category text check (category is null or char_length(category) <= 100),
  referrer text check (referrer is null or char_length(referrer) <= 50),
  message text check (message is null or char_length(message) <= 3000),
  status text not null default 'new' check (status in ('new', 'done')),
  memo text,
  created_at timestamptz not null default now()
);

-- ── 보안 규칙(RLS) ──────────────────────────────────────────
alter table public.admins enable row level security;
alter table public.members enable row level security;
alter table public.posts enable row level security;
alter table public.banners enable row level security;
alter table public.schedule enable row level security;
alter table public.inquiries enable row level security;

drop policy if exists "admins read self" on public.admins;
drop policy if exists "admins manage admins" on public.admins;
create policy "admins manage admins" on public.admins for all using (public.is_admin()) with check (public.is_admin());

-- 관리자로 등록된 이메일만 계정을 만들 수 있게 막습니다 (관리자 페이지의 '계정 만들기')
create or replace function public.only_registered_admins_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.admins where lower(email) = lower(new.email)) then
    raise exception '관리자로 등록되지 않은 이메일입니다.';
  end if;
  return new;
end;
$$;
drop trigger if exists only_registered_admins_signup on auth.users;
create trigger only_registered_admins_signup
  before insert on auth.users
  for each row execute function public.only_registered_admins_signup();

drop policy if exists "public read members" on public.members;
create policy "public read members" on public.members for select using (is_active or public.is_admin());
drop policy if exists "admin write members" on public.members;
create policy "admin write members" on public.members for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read posts" on public.posts;
create policy "public read posts" on public.posts for select using (is_published or public.is_admin());
drop policy if exists "admin write posts" on public.posts;
create policy "admin write posts" on public.posts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read banners" on public.banners;
create policy "public read banners" on public.banners for select using (is_active or public.is_admin());
drop policy if exists "admin write banners" on public.banners;
create policy "admin write banners" on public.banners for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read schedule" on public.schedule;
create policy "public read schedule" on public.schedule for select using (true);
drop policy if exists "admin write schedule" on public.schedule;
create policy "admin write schedule" on public.schedule for all using (public.is_admin()) with check (public.is_admin());

-- 문의: 누구나 보낼 수 있고(새 문의만), 읽기·수정·삭제는 관리자만
drop policy if exists "anyone can send inquiry" on public.inquiries;
create policy "anyone can send inquiry" on public.inquiries for insert with check (status = 'new' and memo is null);
drop policy if exists "admin manage inquiries" on public.inquiries;
create policy "admin manage inquiries" on public.inquiries for all using (public.is_admin()) with check (public.is_admin());

-- ── 사진 저장소 ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "admin upload media" on storage.objects;
create policy "admin upload media" on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "admin update media" on storage.objects;
create policy "admin update media" on storage.objects for update using (bucket_id = 'media' and public.is_admin());
drop policy if exists "admin delete media" on storage.objects;
create policy "admin delete media" on storage.objects for delete using (bucket_id = 'media' and public.is_admin());

-- ── 관리자 등록 ─────────────────────────────────────────────
-- 아래 이메일을 어드민으로 로그인할 이메일로 바꾸세요. 여러 명이면 줄을 추가하세요.
insert into public.admins (email, note) values ('admin@example.com', '최초 관리자') on conflict do nothing;
