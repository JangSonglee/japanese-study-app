# -*- coding: utf-8 -*-
"""optimize_tomo_images.py — 토모 표정 SVG의 임베드 PNG를 표시 크기에 맞춰 축소.
각 SVG(래스터 임베드)의 base64 PNG를 추출 → 높이 TARGET_H로 리사이즈 → 재압축 → 되삽입.
원본은 _원본_고해상도/ 로 1회 백업. viewBox/width/height 속성은 건드리지 않는다(표시 무관)."""
import re, base64, io, os, glob, sys
from PIL import Image

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
TOMO = os.path.join(HERE, 'public', 'images', 'tomo')
BACKUP = os.path.join(TOMO, '_원본_고해상도')
os.makedirs(BACKUP, exist_ok=True)
TARGET_H = 400  # 표시 최대(홈 120px)의 3배 여유

total_before = total_after = 0
for f in sorted(glob.glob(os.path.join(TOMO, '*.svg'))):
    name = os.path.basename(f)
    s = io.open(f, encoding='utf-8').read()
    m = re.search(r'(data:image/png;base64,)([A-Za-z0-9+/=]+)', s)
    if not m:
        print('skip(no png):', name); continue
    raw = base64.b64decode(m.group(2))
    img = Image.open(io.BytesIO(raw))
    if img.height <= TARGET_H:
        print('skip(small):', name); continue
    bpath = os.path.join(BACKUP, name)
    if not os.path.exists(bpath):
        io.open(bpath, 'w', encoding='utf-8').write(s)  # 원본 1회 백업
    w = round(img.width * TARGET_H / img.height)
    img2 = img.convert('RGBA').resize((w, TARGET_H), Image.LANCZOS)
    buf = io.BytesIO(); img2.save(buf, format='PNG', optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    s2 = s[:m.start(2)] + b64 + s[m.end(2):]
    io.open(f, 'w', encoding='utf-8').write(s2)
    total_before += len(raw); total_after += len(buf.getvalue())
    print('%-24s %5dKB -> %4dKB' % (name, len(raw)//1024, len(buf.getvalue())//1024))
print('---\n합계 임베드: %dKB -> %dKB' % (total_before//1024, total_after//1024))
