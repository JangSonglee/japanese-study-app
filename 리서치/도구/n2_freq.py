# -*- coding: utf-8 -*-
"""② 빈도축 스냅샷 생성기 (N2) — 선정 근거로 쓴 코퍼스 빈도를 **얼려서** 파일로 남긴다.

n3_freq.py 와 같은 파이프라인이다. 데이터 모듈만 n2_data* 로 바뀐다.
얼리는 이유·표제형 합산을 쓰는 이유는 n3_freq.py 의 주석과 규격 §7.3-2-1 참조.

🔴 표면형이 아니라 **표제형(lemma)으로 합산**한다. 안 그러면 활용이 있는 동사·형용사가
   조직적으로 과소평가되어 상위가 명사로만 채워진다. N2는 한자어 추상명사가 원래 많으므로
   이 편향이 걸리면 품사 균형이 N3보다 더 크게 무너진다 — 여기서 반드시 지켜야 한다.

사용: python 도구/n2_freq.py   →  도구/n2_freq_data.py 를 덮어쓴다.
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def collect_headwords():
    TOKEN = re.compile(r'\{([^|{}]+)((?:\|[^|{}]*)+)\}')
    rows = []
    for i in (1, 2, 3, 4):
        m = __import__('n2_data%d' % i)
        rows += getattr(m, 'ROWS%d' % i)
    return [TOKEN.sub(lambda m: m.group(1), r[0]) for r in rows]


def main():
    import math
    from wordfreq import get_frequency_dict, zipf_frequency
    import fugashi
    tg = fugashi.Tagger()
    KEEP = {'名詞', '動詞', '形容詞', '形状詞', '副詞', '接続詞'}

    agg = {}
    for tok, fr in get_frequency_dict('ja').items():
        ts = list(tg(tok))
        if len(ts) != 1:
            continue
        t = ts[0]
        if t.feature.pos1 not in KEEP:
            continue
        lm = re.sub(r'-.*$', '', t.feature.lemma or t.surface)
        if len(lm) < 2 or not re.fullmatch(r'[ぁ-ゟァ-ヿ一-鿿々ー]+', lm):
            continue
        agg[lm] = agg.get(lm, 0.0) + fr

    zipf = {k: round(math.log10(v * 1e9), 2) for k, v in agg.items()}
    order = sorted(zipf, key=lambda k: -zipf[k])
    rank = {w: i + 1 for i, w in enumerate(order)}

    out = {}
    for hw in collect_headwords():
        cands = [hw]
        ts = list(tg(hw))
        if ts:
            lm = re.sub(r'-.*$', '', ts[0].feature.lemma or '')
            if len(ts) == 1 and lm:
                cands.append(lm)
        hit = [(zipf[c], rank[c]) for c in cands if c in zipf]
        out[hw] = max(hit) if hit else (round(zipf_frequency(hw, 'ja'), 2), 0)

    with io.open(HERE + '/n2_freq_data.py', 'w', encoding='utf-8', newline='\n') as f:
        f.write('# -*- coding: utf-8 -*-\n')
        f.write('"""자동 생성 — n2_freq.py 가 만든다. 손으로 고치지 말 것.\n'
                '{표제어: (zipf, 코퍼스 내용어 순위)}  순위 0 = 순위표에 없음(저빈도/복합어).\n'
                '순위표 모집단 %d어종. wordfreq (ja), 표제형 합산."""\n' % len(order))
        f.write('POP = %d\n' % len(order))
        f.write('FREQ = {\n')
        for k in sorted(out):
            f.write('  %r: %r,\n' % (k, out[k]))
        f.write('}\n')
    print('표제어 %d건 / 순위표 모집단 %d어종 -> n2_freq_data.py' % (len(out), len(order)))
    miss = [k for k, v in out.items() if v[0] == 0]
    print('빈도 0(코퍼스 미검출) %d건: %s' % (len(miss), ' '.join(miss[:40])))


if __name__ == '__main__':
    main()
