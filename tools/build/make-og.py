"""OG 이미지(1200x630) 생성: 메인 로고 + 문구. 사용: python -I tools/build/make-og.py"""
import os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
W, H = 1200, 630
im = Image.new("RGB", (W, H), "#ffffff")
d = ImageDraw.Draw(im)
d.rectangle([0, 0, 18, H], fill="#C8102E")                      # 왼쪽 빨간 띠
logo = Image.open(os.path.join(ROOT, "assets/images/main-logo.png")).convert("RGBA")
lw = 560; lh = round(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
im.paste(logo, (80, 110), logo)
def font(size, bold=True):
    for name in (["malgunbd.ttf", "malgun.ttf"] if bold else ["malgun.ttf"]):
        p = os.path.join(os.environ.get("WINDIR", "C:/Windows"), "Fonts", name)
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()
d.text((84, 330), "BNI 고양지역 최강챕터", font=font(58), fill="#1B1F27")
d.text((86, 410), "고양·일산 비즈니스 조찬 네트워크", font=font(34, False), fill="#444a57")
d.text((86, 462), "매주 수요일 오전 6:30 · 킨텍스 인근 · 업종별 전문가 29명", font=font(28, False), fill="#444a57")
d.rounded_rectangle([86, 530, 86 + 330, 530 + 56], radius=28, fill="#C8102E")
d.text((86 + 165, 530 + 28), "비지터 참관 신청 안내", font=font(26), fill="#ffffff", anchor="mm")
out = os.path.join(ROOT, "assets/images/og-image.jpg")
im.save(out, "JPEG", quality=88, optimize=True, progressive=True)
print(out, im.size, os.path.getsize(out) // 1024, "KB")
