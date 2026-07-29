# -*- coding: utf-8 -*-
"""select_n1.py — N1 후보풀 전량랭킹 → 장르 쿼터 적용 400건 shortlist.

skew_rank.py 가 낸 `N1_후보풀_전량랭킹_*.csv`(편중도 z 내림차순, 순위대상 전량)를 읽어
**장르 쿼터 ≤40%(=160/400)** 를 적용해 최종 400건 후보를 고른다.

⚠️ 이것은 「후보 shortlist」다 — 예문·뜻은 아직 없다. 다음 단계(사람 감수 → build_n1)
   에서 고어 컷 + 예문·뜻 작성이 이뤄진다. 여기서는 **어떤 단어가 뽑혔나 + 감수 우선
   대상**만 낸다.

정책(2026-07-27 대표님 결정):
  · 장르 쿼터: 한 장르 ≤ QUOTA(=160). 국회(논설) 61.5% 편중을 균형화.
  · 문학 고어: LIT_PENALTY(skew_rank)로 억제됐으나 완전제거 아님 → **사람 감수**로 컷.
    여기선 auto-cut 하지 않고 「감수우선」 플래그만 단다(즉 拵える·仮令류를 사람이 판정).

실행: python 도구/select_n1.py
"""
import sys, os, csv, io

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
JLPT = os.path.abspath(os.path.join(HERE, '..', '02_JLPT'))
SRC = os.path.join(JLPT, 'N1_후보풀_전량랭킹_2026-07-25.csv')
OUT = os.path.join(JLPT, 'N1_선정_400_shortlist_2026-07-27.csv')
SUMMARY = os.path.join(HERE, 'n1_skew', '_select_summary.txt')

TARGET = 400
QUOTA = 160          # 한 장르 ≤ 40%
LOWZIPF = 1.3        # 이 미만 = 「감수우선:저빈도」 힌트(고어일 수도, 정당한 격식어일 수도)

def load_rows():
    with io.open(SRC, encoding='utf-8-sig') as f:
        rdr = csv.reader(f)
        rows = list(rdr)
    # rows[0]=marker, rows[1]=header, rest=data
    header = rows[1]
    idx = {name: i for i, name in enumerate(header)}
    data = []
    for r in rows[2:]:
        if not r or not r[idx['word']].strip():
            continue
        data.append({
            'rank': int(r[idx['rank']]),
            'word': r[idx['word']],
            'reading': r[idx['reading']],
            'z': float(r[idx['편중도']]),
            'genre': r[idx['상위장르']],
            'zipf': float(r[idx['일반빈도zipf']]),
            'tanos': r[idx['tanos_tag']],
        })
    return data

def main():
    data = load_rows()  # 이미 z 내림차순
    selected, counts, overflow = [], {}, {}
    for r in data:
        if len(selected) >= TARGET:
            break
        g = r['genre']
        if counts.get(g, 0) >= QUOTA:
            overflow[g] = overflow.get(g, 0) + 1
            continue
        counts[g] = counts.get(g, 0) + 1
        selected.append(r)

    # 감수우선 플래그
    for r in selected:
        flags = []
        if r['genre'] == '문학':
            flags.append('문학고어의심')
        if r['zipf'] < LOWZIPF:
            flags.append('저빈도')
        r['review'] = '+'.join(flags)

    # shortlist CSV
    with io.open(OUT, 'w', encoding='utf-8-sig', newline='') as f:
        wr = csv.writer(f)
        wr.writerow(['N1_선정_400_shortlist_방법검증_예문없음_감수전'])
        wr.writerow(['sel_rank', 'orig_rank', 'word', 'reading', '편중도z', '상위장르', 'zipf', 'tanos_tag', '감수우선'])
        for i, r in enumerate(selected, 1):
            wr.writerow([i, r['rank'], r['word'], r['reading'], r['z'], r['genre'], r['zipf'], r['tanos'], r['review']])

    # 요약
    from collections import Counter
    dist = Counter(r['genre'] for r in selected)
    review = [r for r in selected if r['review']]
    out = io.open(SUMMARY, 'w', encoding='utf-8')
    w = out.write
    w(f"선정 {len(selected)}/{TARGET}  (쿼터 {QUOTA}/장르)\n\n")
    w("=== 선정 400 장르분포 ===\n")
    for g, c in dist.most_common():
        ov = overflow.get(g, 0)
        w(f"  {g:8} {c:3}건" + (f"  (쿼터초과로 제외 {ov}건)" if ov else "") + "\n")
    w(f"\n=== 감수우선 대상 {len(review)}건 (auto-cut 아님 — 사람 판정) ===\n")
    for r in sorted(review, key=lambda x: x['zipf']):
        w(f"  {r['word']:10} z={r['z']:+.2f} {r['genre']:6} zipf={r['zipf']:.2f}  [{r['review']}]\n")
    w(f"\n=== 선정 400 하위 20 (경계선) ===\n")
    for r in selected[-20:]:
        w(f"  sel{selected.index(r)+1:3} {r['word']:10} z={r['z']:+.2f} {r['genre']:6} zipf={r['zipf']:.2f}\n")
    out.close()
    print("done:", OUT)
    print("summary:", SUMMARY)

if __name__ == '__main__':
    main()
