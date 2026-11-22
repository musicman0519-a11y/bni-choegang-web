# BNI 고양지역 최강챕터 홈페이지

공개 주소: https://choegang.co.kr/ · 관리자: https://choegang.co.kr/admin.html

- 정적 사이트(GitHub Pages) + Supabase. 글·멤버는 관리자 페이지에서 수정하고, 정적 페이지·사이트맵은 `npm run build` 로 다시 만들어 커밋한다.
- 로컬 확인: `python -m http.server 8080 --bind 127.0.0.1` 후 http://127.0.0.1:8080/ · 테스트: `npm test`
- 운영 안내: `supabase/관리자_설정_안내.md`(관리자 추가·복구 절차), `supabase/알림_설정_안내.md`(문의 메일 알림). 작업 계획은 `docs/plans/`.
