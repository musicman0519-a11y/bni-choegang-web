// 외부 스크립트 SRI 해시 계산: node tools/build/sri.js <URL>
const https = require("https"); const crypto = require("crypto");
const url = process.argv[2]; if (!url) { console.error("사용: node tools/build/sri.js <URL>"); process.exit(1); }
https.get(url, (res) => { const h = crypto.createHash("sha384"); res.on("data", (d) => h.update(d)); res.on("end", () => console.log(`sha384-${h.digest("base64")}`)); });
