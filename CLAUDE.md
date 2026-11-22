# BNI 고양지역 최강챕터 홈페이지

정적 사이트(HTML/CSS/JS) + 생성 스크립트(`npm run build`). 데이터는 Supabase(프로젝트 bni-choegang, 2026-11-22 연결)에서 읽고, 표가 비어 있거나 연결 실패 시에는 `experts.js`·`blog-data.js`·`blog-legacy.js` 에 내장된 기본 데이터로 동작한다.

## 구조
- `index.html` 홈 · `about.html` · `experts.html` 전문가 찾기 · `blog.html`/`post.html` 뉴스 · `visitor.html` 참관 신청 · `contact.html` 협업 문의 · `admin.html` 관리자(메뉴에 링크 없음, 주소 직접 입력)
- `supabase-config.js` Supabase URL·anon 키 (anon 키는 공개 키라 커밋해도 됨. service_role 키는 절대 넣지 않음)
- `site-data.js` Supabase 연결 여부 판단과 데이터 로더. 다른 스크립트는 `data-scripts` 속성으로 지연 로드
- `supabase/schema.sql` 테이블·RLS·Storage 버킷 / `supabase/functions/notify-inquiry/` 문의 알림 Edge Function / `supabase/*_안내.md` 운영자용 설정 안내
- `assets/images/` 멤버 사진은 `member-<이름>.jpg` 규칙으로 `experts.js` 가 찾음 / `assets/logo-drafts/` 로고 시안
- `docs/plans/` 작업 계획 체크리스트 (`/plan` → `/build` 로 진행)
- `site.config.json` 사이트 주소·이름·주소·모임시간·페이지별 title/description. **도메인이 바뀌면 `origin` 만 고치고 `npm run build`**
- `tools/build/prerender.js` 노출 파일 생성기: 정적 페이지 `<head>` 의 `<!-- meta:start/end -->`·`<!-- ld:start/end -->` 블록, `blog/<글id>/index.html`, `member/<이름>/index.html`, `sitemap.xml`, `robots.txt`, `llms.txt`. 생성물은 커밋한다
- `journey.js` 방문 여정 기록(sessionStorage): 채널·유입 출처·경로·체류·기기. 문의 insert 의 `journey jsonb` 컬럼에 담기고 관리자 문의 카드의 "유입 경로" 블록에 표시. 모든 페이지 `data-scripts` 맨 앞. `?journey=off` 로 기록 끔
- `body-format.js` 글 본문 서식 공용 모듈: `formatBody`(텍스트→HTML: 빈 줄 문단, `##`/`###` 소제목, `- ` 목록, `**굵게**`)와 `htmlToText`(HTML→텍스트). blog.js·admin.js 가 `window.formatBody/htmlToText` 로 씀. DB 의 `posts.body` 는 이 텍스트 형식으로 저장
- `blog-legacy.js` 옛 홈페이지 글 44건(자동 생성, 직접 수정 금지). 원본은 `E:\projects\_backup\bni_clean`, 재생성은 `tools/import-legacy/convert-posts.py`
- `tools/e2e/` 테스트 4종: `journey.test.js`(여정 로직), `format-body.test.js`(본문 왕복, 파일만), `ld.test.js`(메타·JSON-LD·사이트맵·llms, 파일만), `site.test.js <주소>`(puppeteer-core + 설치된 Chrome, 실 DB 케이스는 연결 시에만). `npm test`(로컬 3종) / `npm run test:public`(도메인)
- `.github/workflows/keepalive.yml` Supabase 정지 방지 핑(월·목) / `backup.yml` 공개 표 4개 JSON 백업(월요일, artifact 90일. 문의는 제외)
- `supabase/migrations/*.sql` 이미 만든 DB 에 추가로 실행한 SQL(보안 제약·MFA 강제·90일 정리). 새 프로젝트는 schema.sql 뒤에 순서대로 실행
- 관리자 로그인은 비밀번호 + TOTP 2단계(`gateMfa`). `is_admin()` 이 aal2 를 요구하므로 2단계 없이는 쓰기 불가. 데모 모드는 건너뜀
- `CNAME`(choegang.co.kr)·`google6a71a3acd1bc1ab6.html`(구글 소유확인)은 지우지 않는다. 네이버 인증 태그는 `site.config.json` 의 `verification` 에서 생성기가 넣는다

## 로컬 실행·확인
```
python -m http.server 8080 --bind 127.0.0.1   # 프로젝트 루트에서. file:// 로 열면 데이터 로딩 안 됨
```
http://127.0.0.1:8080/ 에서 확인. 화면 확인은 Chrome 헤드리스 `--screenshot` 으로도 가능. 관리자 화면은 `admin.html?demo` 로 가짜 데이터 모드.

## 글·멤버를 고친 뒤 할 일
`blog-data.js`·`blog-legacy.js`·`experts.js`·`site.config.json`·정적 HTML 의 FAQ 를 고치면 **`npm run build`** 를 돌려 정적 페이지·사이트맵·llms.txt 를 다시 만들고 함께 커밋한다. 두 번 돌려도 결과가 같아야 한다(멱등).
글의 정본 주소는 `blog/<id>/`, 멤버는 `member/<이름>/`. `post.html?id=` 는 DB 에만 있는 글용이며 canonical 로 정본을 가리킨다.

## Supabase (연결됨)
조직 BNI 최강챕터 / 프로젝트 bni-choegang (`dwqdevzlwnpsqaztjhlh`, 싱가포르). `supabase-config.js` 의 키는 publishable(공개) 키. 관리자 musicman0519@gmail.com, 멤버 29·글 52·배너 3 가져오기 완료. Confirm email 꺼짐, TOTP 켜짐, Max rows 300. 옛 사이트 Supabase(lsqhefnqteovhnbmsekg)는 쓰지 않는다. 테스트에서 실제 문의를 넣으려면 `E2E_REAL_SUBMIT=1`.

## 배포
- GitHub Pages, `main` 브랜치 root 에서 배포. 푸시하면 1~2분 뒤 반영.
- 공개 URL: **https://choegang.co.kr/** (가비아 DNS → GitHub Pages, `CNAME` 파일). 옛 주소 https://musicman0519-a11y.github.io/bni-choegang-web/ 은 새 도메인으로 301.
- 저장소 전체가 그대로 서빙되므로 비밀값·개인 파일을 저장소에 두지 않는다. 백업 zip 은 `E:\projects\_backup\` 에 둔다(`*.zip` 은 .gitignore).
- 정적 파일 캐시는 `?v=숫자` 수동 버스팅. CSS/JS 를 고치면 HTML 의 `?v=` 숫자를 올린다.

## 규칙
- 전부 상대경로 사용(도메인 루트와 github.io 하위 경로 양쪽에서 동작해야 함). `href="/..."` 금지(404.html 만 예외).
- 로고 원본은 `assets/images/main-logo.png`(워드마크)와 `logo-cg.svg`(헤더용 CG 뱃지). JPG 변환본은 `bni-choegang-logo*.jpg`.
