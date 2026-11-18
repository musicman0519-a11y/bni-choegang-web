# BNI 고양지역 최강챕터 홈페이지

빌드 도구 없는 정적 사이트(HTML/CSS/JS). 데이터는 Supabase(선택)에서 읽고, 연결 전에는 `site-data.js` 등에 내장된 기본 데이터로 동작한다.

## 구조
- `index.html` 홈 · `about.html` · `experts.html` 전문가 찾기 · `blog.html`/`post.html` 뉴스 · `visitor.html` 참관 신청 · `contact.html` 협업 문의 · `admin.html` 관리자(메뉴에 링크 없음, 주소 직접 입력)
- `supabase-config.js` Supabase URL·anon 키 (anon 키는 공개 키라 커밋해도 됨. service_role 키는 절대 넣지 않음)
- `site-data.js` Supabase 연결 여부 판단과 데이터 로더. 다른 스크립트는 `data-scripts` 속성으로 지연 로드
- `supabase/schema.sql` 테이블·RLS·Storage 버킷 / `supabase/functions/notify-inquiry/` 문의 알림 Edge Function / `supabase/*_안내.md` 운영자용 설정 안내
- `assets/images/` 멤버 사진은 `member-<이름>.jpg` 규칙으로 `experts.js` 가 찾음 / `assets/logo-drafts/` 로고 시안
- `docs/plans/` 작업 계획 체크리스트 (`/plan` → `/build` 로 진행)

## 로컬 실행·확인
```
python -m http.server 8080 --bind 127.0.0.1   # 프로젝트 루트에서. file:// 로 열면 데이터 로딩 안 됨
```
http://127.0.0.1:8080/ 에서 확인. 화면 확인은 Chrome 헤드리스 `--screenshot` 으로도 가능.

## 배포
- GitHub Pages, `main` 브랜치 root 에서 배포. 푸시하면 1~2분 뒤 반영.
- 공개 URL: https://musicman0519-a11y.github.io/bni-choegang-web/
- 저장소 전체가 그대로 서빙되므로 비밀값·개인 파일을 저장소에 두지 않는다. 백업 zip 은 `E:\projects\_backup\` 에 둔다(`*.zip` 은 .gitignore).
- 정적 파일 캐시는 `?v=숫자` 수동 버스팅. CSS/JS 를 고치면 HTML 의 `?v=` 숫자를 올린다.

## 규칙
- 전부 상대경로 사용(하위 경로 `/bni-choegang-web/` 에서 동작해야 함). `href="/..."` 금지.
- 로고 원본은 `assets/images/main-logo.png`(워드마크)와 `logo-cg.svg`(헤더용 CG 뱃지). JPG 변환본은 `bni-choegang-logo*.jpg`.
