# -*- coding: utf-8 -*-
"""② 빈도축 스냅샷 생성기 — 선정 근거로 쓴 코퍼스 빈도를 **얼려서** 파일로 남긴다.

왜 얼리는가: build_n3.py 가 매번 wordfreq/fugashi 를 부르면
 ① 빌드가 무거워지고 ② 라이브러리 버전이 바뀌면 note 의 숫자가 조용히 달라진다.
 note 는 "그때 무엇을 보고 골랐는가"의 기록이므로 **재현 가능해야** 한다.

원천: wordfreq 3.1.1 (`ja`), 데이터 CC BY-SA 4.0 / 코드 MIT.
      https://github.com/rspeer/wordfreq — 일본어는 Wikipedia·자막·뉴스·웹 혼합 코퍼스.
      🔴 국립국어연구소 BCCWJ 語彙表를 1순위로 잡았으나 repository.ninjal.ac.jp 가
         2026-07-23 시점 502로 내려가 있어 받지 못했다. 규격 7.3-2 ②의 대체 원천이며,
         BCCWJ 語彙表는 "研究・教育目的" 한정이라 상용 앱에는 그대로 쓰기 어렵다는 문제도 있다.
         (자세한 사정은 규격 §7.3-2-1)

사용: python 도구/n3_freq.py   →  도구/n3_freq_data.py 를 덮어쓴다.
      wordfreq·fugashi·unidic-lite 가 필요하다. 없으면 실행하지 말고 기존 스냅샷을 쓴다.
"""
import io, os, re, sys, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def collect_headwords():
    """데이터 모듈의 ruby 에서 표제어를 뽑는다(빌드와 같은 규칙)."""
    TOKEN = re.compile(r'\{([^|{}]+)((?:\|[^|{}]*)+)\}')
    rows = []
    for i in (1, 2, 3, 4):
        m = __import__('n3_data%d' % i)
        rows += getattr(m, 'ROWS%d' % i)
    return [TOKEN.sub(lambda m: m.group(1), r[0]) for r in rows]


def main():
    """🔴 표제형 그대로 조회하면 **동사가 조직적으로 과소평가된다.**
    `問い合わせる` 의 표면형 빈도는 zipf 2.71 인데, 실제로는 「問い合わせて/問い合わせた/
    問い合わせます」로 흩어져 쓰인다. 명사는 활용이 없어 이 문제가 없으므로,
    표면형으로 재면 **명사만 상위에 오는 편향**이 생긴다 — 품사 균형을 망치는 원인이다.
    → 코퍼스 토큰을 형태소분석해 **표제형(lemma)으로 합산**한 뒤 zipf 를 다시 계산한다.
    """
    import math
    from wordfreq import get_frequency_dict
    import fugashi
    tg = fugashi.Tagger()
    KEEP = {'名詞', '動詞', '形容詞', '形状詞', '副詞', '接続詞'}

    agg = collections = {}
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

    # 표기 불일치 보정 — UniDic 의 lemma 는 한자 정서법을 쓴다(さらに→更に · うるさい→五月蠅い).
    # 우리 표제어가 かな 표기면 집계표에서 못 찾으므로, 표제어를 한 번 분석해 lemma 로도 조회한다.
    # 그래도 없으면 표면형 zipf 로 떨어진다(0 이 되는 것보다 낫다. 대신 순위는 0 으로 남긴다).
    from wordfreq import zipf_frequency
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

    with io.open(HERE + '/n3_freq_data.py', 'w', encoding='utf-8') as f:
        f.write('# -*- coding: utf-8 -*-\n')
        f.write('"""자동 생성 — n3_freq.py 가 만든다. 손으로 고치지 말 것.\n'
                '{표제어: (zipf, 코퍼스 내용어 순위)}  순위 0 = 순위표에 없음(저빈도/복합어).\n'
                '순위표 모집단 %d어종. wordfreq 3.1.1 ja."""\n' % len(order))
        f.write('POP = %d\n' % len(order))
        f.write('FREQ = {\n')
        for k in sorted(out):
            f.write('  %r: %r,\n' % (k, out[k]))
        f.write('}\n')
    print('표제어 %d건 / 순위표 모집단 %d어종 -> n3_freq_data.py' % (len(out), len(order)))
    miss = [k for k, v in out.items() if v[0] == 0]
    print('빈도 0(코퍼스 미검출) %d건: %s' % (len(miss), ' '.join(miss[:40])))


if __name__ == '__main__':
    main()
