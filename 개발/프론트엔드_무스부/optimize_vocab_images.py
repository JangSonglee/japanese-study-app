# -*- coding: utf-8 -*-
"""optimize_vocab_images.py — 단어 카드 일러스트 PNG 일괄 최적화.

규격 4.7: 가로 1080px 이하 · 200KB 이하(오프라인 미리받기 용량 직결).
동작:
  1. 원본을 `_원본_고해상도/`에 **백업**(최초 1회). 이후엔 백업 원본에서 다시 최적화 → **재실행 안전(멱등)**.
  2. 가로 MAX_W(기본 800px) 초과면 리사이즈(LANCZOS, 알파 유지).
  3. PNG optimize 저장. 여전히 TARGET_KB 초과면 **색상 양자화**(FASTOCTREE, 알파 유지) — 플랫 일러스트라 손실 거의 없음.
  4. before/after 용량 리포트.

파일명은 그대로 유지(content_key 규칙). PNG 유지(FE가 .png 로드).

설치: pip install Pillow
실행: python optimize_vocab_images.py            # 기본 public/images/vocab
      python optimize_vocab_images.py <폴더> <가로px> <KB상한>
"""
import os, sys, glob, shutil

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

try:
    from PIL import Image
except ImportError:
    print('❌ Pillow 필요: pip install Pillow'); sys.exit(2)

HERE = os.path.dirname(os.path.abspath(__file__))
FOLDER = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'tomori-app', 'public', 'images', 'vocab')
MAX_W = int(sys.argv[2]) if len(sys.argv) > 2 else 800
TARGET = (int(sys.argv[3]) if len(sys.argv) > 3 else 200) * 1024
BACKUP = os.path.join(FOLDER, '_원본_고해상도')

def kb(n): return f'{n/1024:.0f}KB'

def main():
    if not os.path.isdir(FOLDER):
        print('❌ 폴더 없음:', FOLDER); return 1
    os.makedirs(BACKUP, exist_ok=True)
    pngs = [p for p in glob.glob(os.path.join(FOLDER, '*.png'))]
    if not pngs:
        print('처리할 PNG 없음:', FOLDER); return 0
    print(f'대상 {len(pngs)}개 · 가로≤{MAX_W}px · ≤{TARGET//1024}KB\n' + '-' * 56)
    total_before = total_after = 0
    for p in sorted(pngs):
        name = os.path.basename(p)
        bpath = os.path.join(BACKUP, name)
        if not os.path.exists(bpath):
            shutil.copy2(p, bpath)                 # 최초 1회 원본 백업
        src_size = os.path.getsize(bpath)
        im = Image.open(bpath).convert('RGBA')     # 항상 원본에서 재최적화(멱등)
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        im.save(p, 'PNG', optimize=True)
        if os.path.getsize(p) > TARGET:
            try:
                q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
                q.save(p, 'PNG', optimize=True)
            except Exception as e:
                sys.stderr.write(f'  양자화 실패({name}): {e}\n')
        out_size = os.path.getsize(p)
        total_before += src_size; total_after += out_size
        flag = '✅' if out_size <= TARGET else '⚠️초과'
        print(f'  {name:32s} {kb(src_size):>8s} → {kb(out_size):>8s}  {flag}')
    print('-' * 56)
    print(f'합계 {kb(total_before)} → {kb(total_after)}  (원본 백업: _원본_고해상도/)')
    # manifest.json — 이미지 있는 content_key 목록(파일명 밑줄→점). FE가 이걸 읽어 세션에 우선 노출.
    import json
    keys = sorted(os.path.splitext(os.path.basename(p))[0].replace('_', '.') for p in pngs)
    with open(os.path.join(FOLDER, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(keys, f, ensure_ascii=False, indent=0)
    print(f'manifest.json 갱신: {len(keys)}개 content_key')
    print('🔴 최적화본·manifest가 dist에 반영되려면 npm run build 다시.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
