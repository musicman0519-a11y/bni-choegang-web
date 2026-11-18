# 브라우저 테스트

설치된 Chrome 을 puppeteer-core 로 구동해 홈·전문가 찾기·명함·블로그·글 상세·관리자(데모)·옛 주소 리다이렉트를 확인합니다.

```
cd tools/e2e
npm i puppeteer-core@23          # 처음 한 번 (브라우저 다운로드 없음)
node site.test.js http://127.0.0.1:8080/                                   # 로컬 (python -m http.server 8080 실행 중이어야 함)
node site.test.js https://musicman0519-a11y.github.io/bni-choegang-web/     # 공개 URL (리다이렉트 테스트 포함)
```
