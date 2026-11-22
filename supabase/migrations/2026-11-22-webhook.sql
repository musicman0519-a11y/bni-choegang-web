-- ─────────────────────────────────────────────────────────────
-- 문의 저장 → notify-inquiry Edge Function 호출 (2026-11-22) — 배포-준비.md 21번
-- 대시보드의 Database Webhooks 와 같은 역할을 pg_net 트리거로 직접 만듭니다.
-- 실행 전에 아래 두 자리를 바꾸세요:
--   <<FUNCTION_URL>>   Edge Functions → notify-inquiry → Overview 의 URL (https://…/functions/v1/notify-inquiry)
--   <<WEBHOOK_SECRET>> Edge Functions → Secrets 의 WEBHOOK_SECRET 값
-- ─────────────────────────────────────────────────────────────
create extension if not exists pg_net;

create or replace function public.notify_inquiry_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := '<<FUNCTION_URL>>',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '<<WEBHOOK_SECRET>>'),
    body := jsonb_build_object('type', 'INSERT', 'table', 'inquiries', 'schema', 'public', 'record', to_jsonb(new)),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- 알림 실패가 문의 저장을 막지 않도록 삼킨다
  return new;
end;
$$;

drop trigger if exists notify_inquiry_webhook on public.inquiries;
create trigger notify_inquiry_webhook
  after insert on public.inquiries
  for each row execute function public.notify_inquiry_webhook();

-- 확인: select * from net._http_response order by created desc limit 3;  (status_code 200 이면 함수 호출 성공)
