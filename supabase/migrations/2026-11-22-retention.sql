-- ─────────────────────────────────────────────────────────────
-- 문의 보존 기간 자동 정리 (2026-11-22) — 보안-강화.md 14번
-- 처리 완료(status='done')된 문의는 접수 90일 뒤, 처리 안 된 문의도 1년 뒤에는 삭제합니다.
-- Supabase 의 pg_cron 확장으로 매일 새벽 4시(KST)에 DB 안에서 실행되므로 외부 키가 필요 없습니다.
-- SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- ─────────────────────────────────────────────────────────────
create extension if not exists pg_cron;

create or replace function public.purge_old_inquiries()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with gone as (
    delete from public.inquiries
    where (status = 'done' and created_at < now() - interval '90 days')
       or created_at < now() - interval '365 days'
    returning 1
  )
  select count(*) into n from gone;
  return n;
end;
$$;

-- 같은 이름의 예약이 있으면 지우고 다시 등록 (19:00 UTC = 04:00 KST)
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'purge-old-inquiries';
exception when others then null;
end $$;
select cron.schedule('purge-old-inquiries', '0 19 * * *', $$select public.purge_old_inquiries();$$);

-- 확인: select jobname, schedule, active from cron.job;
-- 수동 실행: select public.purge_old_inquiries();
