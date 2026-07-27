# -*- coding: utf-8 -*-
"""
skew_rank.py  —  토모리 N1 어휘 「장르 편중도(genre-skew)」 엔진 · 2단계 (v2 균형보정)
================================================================================
목적 : build_corpus.py 가 만든 4장르 빈도표+문서빈도(sdf)를 읽어, Tanos N1 후보
       어휘의 「장르 편중도」를 계산하고 파일럿 순위 CSV를 낸다.

⚠️  PILOT_방법검증_최종아님. Tanos 상업 라이선스는 서면확인 대기 → 방법 검증용
    후보 풀로만 참조(재배포 아님). 최종 N1 400건 확정이 아니다.

────────────────────────────────────────────────────────────────────────────
■ v1(2026-07-25 오전)의 문제와 v2 보정  ─ 코디 지적 반영
────────────────────────────────────────────────────────────────────────────
 v1은 상위250 중 law 153 / academic 55 / literature 34 / opinion 8 로 **법률 과대**.
 진단(데이터로 확인):
   ① [근본 버그] v1 offset을 「일상어 30개」로만 추정 → 법률문은 일상어(食べる 등)를
      거의 안 써서 law offset이 -0.79(음수)로 나왔고, skew=raw-offset 에서 음수를
      빼며 **모든 법률어에 ≈+1.5의 가짜 부스트**를 줬다. (law 전체분포 실제 median은
      +0.708인데 -0.789를 썼으니 어긋남 ≈1.5.)
   ② [토픽 집중] 会社法(코퍼스의 큰 비중)이 株式·設立 같은 **한 법령에만 몰린 어휘**를
      장르특징어처럼 부풀림.
 보정:
   (A) offset을 「일상어 30개」가 아니라 **장르 전체 lemma 분포의 median/MAD로
       데이터 재추정**(robust 표준화). 각 장르의 blanket 팽창을 median이 흡수하고,
       퍼짐은 MAD로 정규화 → "z=+2"가 어느 장르에서나 「그 장르 기준으로도 이례적」의
       같은 뜻이 된다. 마법의 상수 없음.
   (B) **분산 필터(source_df≥2)**: 후보어가 그 장르의 **2개 이상 문서**(법령=조문,
       작품, 기사)에 나와야 그 장르에서 인정. 会社法에만 있는 株式(sdf=1)은 탈락.
   (C) **장르 쿼터**(한 장르 ≤ QUOTA_FRAC): 지표가 한쪽으로 기울어도 최종 목록은
       네 장르가 고르게 섞이도록. 투명한 안전망.

■ 지표 정의(정식)
   general_pm(w) = wordfreq per-million. 表記·읽기 중 max(희귀한자 오검출 방지).
   genre_pm(w,g) = 장르 g 코퍼스 내 w 표제형 빈도 / g 내용어총토큰 × 1e6
   raw_skew(w,g) = log10( genre_pm(w,g) / general_pm(w) )
   z(w,g)        = ( raw_skew(w,g) − median_g ) / MAD_g        ← (A) 표준화 offset
   편중도(w)     = max_g z(w,g),  단  count(w,g)≥MIN_COUNT ∧ sdf(w,g)≥MIN_SDF  ← (B)
   최종 순위     = 편중도 내림차순, 단 (C) 장르 쿼터 적용.

작성 : 슈슈(리서치) 2026-07-25 (v2)
"""
import sys, os, csv, json, math, statistics
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from wordfreq import word_frequency, zipf_frequency
import fugashi

HERE = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.join(HERE, 'corpus')
JLPT = os.path.abspath(os.path.join(HERE, '..', '..', '02_JLPT'))
TOOLS = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, TOOLS)

GEN_FLOOR  = 0.10   # per-million. wordfreq 미등재 시 바닥값(무한대 skew 방지)
MIN_COUNT  = 3      # 장르 내 최소 출현 횟수(노이즈 컷)
MIN_SDF    = 2      # (B) 분산 필터: 장르 내 최소 문서 수(토픽 집중어 탈락)
CONC_MAX   = 0.88   # (B2) 집중도 상한. 이 이상 = 한 출처(토픽)에 몰림
ZIPF_COMMON= 4.0    # (B2) 이 이상 = 일반빈도로도 이미 흔함
                    #  ⚠️ B2 제외조건 = conc>CONC_MAX  그리고(AND)  zipf>ZIPF_COMMON.
                    #     「이미 흔한데 한 토픽에만 몰려 편중어처럼 보이는」 N2 비즈니스어
                    #     (株式·設立)만 정확히 제거. 저빈도 집중어(取り締まり·清算)나
                    #     고빈도 분산어(概念·定義)는 둘 중 하나만 걸려 살아남는다.
LIT_PENALTY= 0.80   # (D) 문학 가중치 하향. 青空文庫 PD의 고어 노이즈(拵える·仮令 등)를
                    #     억제하려고 문학 z에서 일정폭 감점. ⚠️ 완전 제거가 아님(문학어
                    #     커버는 유지). 대표님 최종 방침 확정 대기(리포트 명시).

GENRE_LABEL = {'literature':'문학','opinion':'논설·행정','law':'법률',
               'academic':'학술','admin':'행정백서'}
GENRES = ['literature','opinion','law','academic','admin']

def load_all():
    man = json.load(open(os.path.join(CORPUS,'manifest.json'), encoding='utf-8'))
    freqs, sdf, conc, totals, ndocs = {}, {}, {}, {}, {}
    for g in GENRES:
        freqs[g] = json.load(open(os.path.join(CORPUS,f'freq_{g}.json'), encoding='utf-8'))
        sdf[g]   = json.load(open(os.path.join(CORPUS,f'sdf_{g}.json'),  encoding='utf-8'))
        conc[g]  = json.load(open(os.path.join(CORPUS,f'conc_{g}.json'), encoding='utf-8'))
        totals[g]= man[g]['content_tokens']
        ndocs[g] = man[g].get('n_docs', 0)
    return man, freqs, sdf, conc, totals, ndocs

_TAGGER = fugashi.Tagger()
_KATA = {chr(c): chr(c-0x60) for c in range(0x30A1, 0x30F7)}
def reading_of(w):
    kana = []
    for t in _TAGGER(w):
        k = getattr(t.feature,'kana',None) or getattr(t.feature,'pron',None) or t.surface
        kana.append(k)
    return ''.join(_KATA.get(ch,ch) for ch in ''.join(kana))

def general_pm(w, reading=None):
    """일반빈도 per-million. 表記+읽기 max로 희귀한자 오검출 방지."""
    f = word_frequency(w,'ja')
    if reading:
        f = max(f, word_frequency(reading,'ja'))
    pm = f*1e6
    return pm if pm > GEN_FLOOR else GEN_FLOOR

def genre_stats(freqs, totals, sdf):
    """(A) 장르별 raw_skew 분포의 robust 통계(median, MAD). 표준화 offset의 재료.
       모집단 = 후보와 같은 자격(count≥MIN_COUNT ∧ sdf≥MIN_SDF)의 lemma 전체."""
    stat = {}
    for g in GENRES:
        vals = []
        for w, c in freqs[g].items():
            if c < MIN_COUNT or sdf[g].get(w,0) < MIN_SDF:
                continue
            gpm = c/totals[g]*1e6
            vals.append(math.log10(gpm / general_pm(w, reading_of(w))))
        med = statistics.median(vals)
        mad = statistics.median([abs(v-med) for v in vals]) or 1e-9
        stat[g] = (med, mad, len(vals))
    return stat

def zscore(w, g, freqs, totals, sdf, conc, stat, gpm_all, zipf):
    c = freqs[g].get(w,0)
    if c < MIN_COUNT or sdf[g].get(w,0) < MIN_SDF:
        return None
    # (B2) 이미 흔한데(zipf 높음) 한 출처에만 몰린(conc 높음) 어휘 = 토픽어 → 제외
    if conc[g].get(w,1.0) > CONC_MAX and zipf > ZIPF_COMMON:
        return None
    raw = math.log10((c/totals[g]*1e6) / gpm_all)
    med, mad, _ = stat[g]
    return (raw - med)/mad

def load_existing_headwords():
    hs = set()
    for fn in ['N5_단어_400.csv','N4_단어_400.csv','N3_단어_400.csv','N2_단어_400.csv']:
        with open(os.path.join(JLPT, fn), encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                h = (row.get('headword') or '').strip()
                if h: hs.add(h)
    return hs

def main():
    man, freqs, sdf, conc, totals, ndocs = load_all()
    stat = genre_stats(freqs, totals, sdf)
    print('장르 통계(표준화 offset=median, 퍼짐=MAD):')
    for g in GENRES:
        m,a,n = stat[g]
        print(f'  {g:11} median={m:+.3f} MAD={a:.3f} (모집단 {n}, 문서 {ndocs[g]})')

    import tanos_ref_n3 as t
    existing = load_existing_headwords()
    candidates = sorted(t.N1_HW - existing)
    dup = len(t.N1_HW) - len(candidates)
    print(f'Tanos N1_HW {len(t.N1_HW)} − 기존헤드워드중복 {dup} = 후보 {len(candidates)}')

    rows = []
    n_nocorpus = n_filtered = 0
    for w in candidates:
        rd = reading_of(w)
        gpm_all = general_pm(w, rd)
        zipf = zipf_frequency(w,'ja')
        best_z, best_g, per = None, None, {}
        any_corpus = False
        for g in GENRES:
            c = freqs[g].get(w,0)
            if c: any_corpus = True
            z = zscore(w, g, freqs, totals, sdf, conc, stat, gpm_all, zipf)
            if z is None:
                continue
            if g == 'literature':      # (D) 문학 가중치 하향
                z -= LIT_PENALTY
            per[g] = (z, c, sdf[g].get(w,0))
            if best_z is None or z > best_z:
                best_z, best_g = z, g
        if best_z is None:
            if any_corpus: n_filtered += 1
            else: n_nocorpus += 1
            continue
        rows.append({'word':w,'reading':rd,'z':round(best_z,3),'g':best_g,
                     'zipf':round(zipf_frequency(w,'ja'),2),'per':per})
    rows.sort(key=lambda r:-r['z'])
    print(f'코퍼스미출현 {n_nocorpus} · 분산필터(sdf<{MIN_SDF})/저빈도탈락 {n_filtered} · 순위대상 {len(rows)}')

    from collections import Counter
    def dist_of(sub): return {GENRE_LABEL[g]:c for g,c in Counter(r['g'] for r in sub).items()}
    print('상위400 장르분포:', dist_of(rows[:400]))
    print('전체 장르분포:', dist_of(rows))

    # ── 전량 랭킹 CSV (N1 후보 풀 전체) ─────────────────────────────────
    out_csv = os.path.join(JLPT, 'N1_후보풀_전량랭킹_2026-07-25.csv')
    with open(out_csv,'w',encoding='utf-8-sig',newline='') as f:
        wr = csv.writer(f)
        wr.writerow(['N1_후보풀_전량랭킹_방법검증_최종아님'])
        wr.writerow(['rank','word','reading','편중도','상위장르','일반빈도zipf','tanos_tag','note'])
        for i, r in enumerate(rows, 1):
            gl = GENRE_LABEL[r['g']]
            per_str = ' '.join(
                f'{GENRE_LABEL[g]}{c}회/{sd}문서(z{z:+.2f})'
                for g,(z,c,sd) in sorted(r['per'].items(), key=lambda x:-x[1][0]))
            low = '일반빈도낮음→장르부상' if r['zipf'] < 4.0 else ''
            note = f'{per_str}; {low}'.strip('; ')
            wr.writerow([i, r['word'], r['reading'], r['z'], gl, r['zipf'], 'N1', note])
    print(f'→ 전량 랭킹 CSV: {out_csv}  (순위대상 {len(rows)}건 전량)')

    # 검증용 통계
    stats = {
        'offsets_median': {g:round(stat[g][0],3) for g in GENRES},
        'mad':            {g:round(stat[g][1],3) for g in GENRES},
        'n_docs':         ndocs,
        'candidates_total': len(candidates), 'dup_removed': dup,
        'ranked': len(rows), 'no_corpus': n_nocorpus, 'filtered': n_filtered,
        'lit_penalty': LIT_PENALTY,
        'genre_dist_top400': dist_of(rows[:400]),
        'genre_dist_all': dist_of(rows),
        'top50': [{'word':r['word'],'reading':r['reading'],'z':r['z'],
                   'genre':r['g'],'zipf':r['zipf']} for r in rows[:50]],
    }
    json.dump(stats, open(os.path.join(HERE,'rank_stats.json'),'w',encoding='utf-8'),
              ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
