"""옛 사이트 멤버 소개 카드(img/members/<이름>.jpg)를 새 사이트 명함 이미지로 변환.
사용: python -I tools/import-legacy/resize-namecards.py <옛패키지폴더>
결과: assets/images/namecard-<이름>.jpg (긴 변 1600px, JPEG 품질 82)
"""
import sys, os
from PIL import Image, ImageOps

src_dir = os.path.join(sys.argv[1], "img", "members")
out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "images")
MAX_EDGE, QUALITY = 1600, 82
done = []
for name in sorted(os.listdir(src_dir)):
    stem, ext = os.path.splitext(name)
    if ext.lower() not in (".jpg", ".jpeg", ".png"):
        continue
    im = ImageOps.exif_transpose(Image.open(os.path.join(src_dir, name))).convert("RGB")
    im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    out = os.path.join(out_dir, f"namecard-{stem}.jpg")
    im.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    done.append((stem, im.size, os.path.getsize(out) // 1024))
for stem, size, kb in done:
    print(f"{stem:6} {size[0]}x{size[1]} {kb}KB")
print(f"총 {len(done)}장")
