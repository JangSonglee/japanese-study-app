# -*- coding: utf-8 -*-
"""N2 단어 400 CSV 생성 + 자체 검수.

build_n3.py 와 같은 구조다. 달라진 것은 셋뿐이고, 셋 다 **급수가 올라가서** 생긴 것이다.

 ① ①축이 **B1 → B2** 로 올라간다(`jf_cando_b2.py`, 86건).
    B2는 양이 아니라 성격이 다르다 — 「論述する」「レポートや記事を書く」
    「フォーマルな場面で議論する」가 B1에는 아예 없다. 그래서 기능축에 **F7·F8을 신설**했다.
 ② Tanos 판정 기준 급수가 N3 → **N2** 다. N1은 「위」, N3~N5는 「아래」로 문구가 갈린다.
 ③ 주제축의 「仕事と職業」에 **상한(cap)** 을 건다. 아래 QUOTA 주석 참조.

실행: python 도구/build_n2.py
"""
import io, os, re, csv, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.dirname(HERE)                      # 리서치/
sys.path.insert(0, HERE)

import importlib.util
spec = importlib.util.spec_from_file_location('k', HERE + '/kana_to_ko.py')
K = importlib.util.module_from_spec(spec); spec.loader.exec_module(K)

from n2_data1 import ROWS1
from n2_data2 import ROWS2
from n2_data3 import ROWS3
from n2_data4 import ROWS4
import tanos_ref_n3 as TAN                        # 참조본 v2 (N1~N5 전량)
from n2_freq_data import FREQ, POP

ROWS = ROWS1 + ROWS2 + ROWS3 + ROWS4

HEADER = ('content_key,level_code,headword,reading,ruby,romaji_ko,pos,conj_type,transitivity,'
          'meaning_ko,meaning_ko_alt,example_ja,example_ko,audio_file,source,verify,note')

# ── 선정축 코드 → ① JF Can-do B2 주제/언어활동 이름 ─────────────────────────────
# 🔴 T코드는 N3(build_n3.py)과 **같은 주제**를 가리킨다. 코드가 급수마다 다른 것을
#    가리키면 note 를 급수 간에 비교할 수 없게 되고, 그러면 "왜 골랐는가"의 추적이 끊긴다.
# 🔴 F1~F6도 N3과 같다. **F7·F8만 N2 신설**이다(B2에서 처음 나온 카테고리).
AXIS = {
    'T01': 'B2「自分と家族」', 'T02': 'B2「自由時間と娯楽」', 'T03': 'B2「生活と人生」',
    'T04': 'B2「旅行と交通」', 'T05': 'B2「健康」', 'T06': 'B2「買い物」',
    'T07': 'B2「食生活」', 'T08': 'B2「自然と環境」', 'T09': 'B2「学校と教育」',
    'T10': 'B2「言語と文化」', 'T11': 'B2「仕事と職業」', 'T12': 'B2「科学技術」',
    'T13': 'B2「住まいと住環境」', 'T14': 'B2「社会」', 'T15': 'B2「人との関係」',
    'F1': 'B2 언어활동「論述する·立場を明確に述べる」',
    'F2': 'B2 언어활동「社交的なやりとり·感情と評価を示す」',
    'F3': 'B2 언어활동「根拠·論拠を示す·仮説を立てる」',
    'F4': 'B2 언어활동「比較する·程度と傾向を言う」',
    'F5': 'B2 언어활동「経過·手順を順序だてて説明する」',
    'F6': 'B2 언어활동「情報交換·報告·必要な情報を探し出す」',
    'F7': 'B2 언어활동「フォーマルな場面で議論する·交渉する」🆕',
    'F8': 'B2 언어활동「レポートや記事を書く·専門テクストを読む」🆕',
}
SOURCE = 'ref_only:jfs_cando_b2+corpus_freq'

# ── 쿼터 (근거는 jf_cando_b2.TOPIC_COUNT / CATEGORY_COUNT) ─────────────────────
# 주제축 200 : 기능축 200 으로 잡았다. N3은 236:164였다.
#   왜 기능축을 키웠는가 — B1→B2의 변화가 **주제가 아니라 기능 쪽에 몰려 있다.**
#   주제 목록은 15개 그대로인데, 카테고리에 「論述する」「レポートや記事を書く」
#   「フォーマルな場面で議論する」「必要な情報を探し出す」가 새로 들어온다.
#   N2의 추상어는 주제가 아니라 **이 기능들이 불러온다.**
#
# 🔴 「仕事と職業」에 상한을 걸었다 — B2 86건 중 26건(30%)이지만 30건(15%)만 준다.
#   ① B2의 仕事 Can-do를 실제로 읽어 보면 내용이 「報告する·交渉する·議論する·説明する」이고
#      **무대만 직장**이다. 그 기능은 F5~F8이 이미 가져간다. 주제축에서까지 30%를 주면
#      같은 것을 두 번 세는 것이 된다.
#   ② 비즈니스 코스가 경어와 직장 장면을 따로 다룬다. 여기서 미리 소모하면 그쪽이 빈다.
#   → 남는 15%는 나머지 14개 주제에 비례 배분했다.
QUOTA = {'T01': 2, 'T02': 34, 'T03': 14, 'T04': 14, 'T05': 10, 'T06': 4, 'T07': 2,
         'T08': 10, 'T09': 26, 'T10': 12, 'T11': 30, 'T12': 10, 'T13': 8, 'T14': 12,
         'T15': 12,
         'F1': 30, 'F2': 20, 'F3': 28, 'F4': 24, 'F5': 22, 'F6': 24, 'F7': 26, 'F8': 26}

TOKEN = re.compile(r'\{([^|{}]+)((?:\|[^|{}]*)+)\}')
KANJI = re.compile(r'[一-鿿々]')


def strip_ruby(s):
    return TOKEN.sub(lambda m: m.group(1), s)


def ruby_readings(s):
    out, pos = [], 0
    for m in TOKEN.finditer(s):
        out.append(s[pos:m.start()])
        out.append(''.join(m.group(2).split('|')[1:]))
        pos = m.end()
    out.append(s[pos:])
    return ''.join(out)


# ── ③ Tanos 교차검증 (기계가 찍는다) ───────────────────────────────────────────
def tanos_verdict(hw, rd, pos):
    if pos in ('counter', 'suffix', 'prefix'):
        return 'Tanos교차: 대조제외(조수사·접사는 목록 대상 아님)'
    lv = TAN.lookup(hw, rd)
    if lv == 'N2':
        return 'Tanos교차: N2 일치'
    if lv in ('N3', 'N4', 'N5'):
        return 'Tanos교차: %s 분류 — 우리 %s 400 미수록 잔여분을 N2로 흡수' % (lv, lv)
    if lv == 'N1':
        return 'Tanos교차: N1 분류(구시험 기준) — 선정축 판단을 우선해 N2 유지'
    return 'Tanos교차: 전급수 목록밖 — Tanos(구시험 어휘)에 없는 현대어로 판단'


def freq_note(hw):
    z, rk = FREQ.get(hw, (0.0, 0))
    if z <= 0:
        return '②빈도 코퍼스 미검출(복합어·표기변이 추정)'
    if rk:
        return '②빈도 zipf %.2f / 내용어 %d위(모집단 %d)' % (z, rk, POP)
    return '②빈도 zipf %.2f / 순위표 밖' % z


def main():
    errs, seen, out_rows = [], set(), []
    for i, r in enumerate(ROWS, 1):
        (ruby, pos, conj, tr, mk, mka, exj, exk, topic, cando) = r
        key = 'jlpt.n2.vocab.%04d' % i
        hw = strip_ruby(ruby)
        rd = ruby_readings(ruby)

        if not re.fullmatch(r'[ぁ-ゟァ-ヿー]+', rd):
            errs.append('[읽기] %s %s -> %s (가나 아닌 문자)' % (key, ruby, rd))
        for m in TOKEN.finditer(ruby):
            n = len(m.group(2).split('|')) - 1
            if n not in (1, len(m.group(1))):
                errs.append('[루비수] %s %s 읽기%d개 vs 표기%d자' % (key, m.group(0), n, len(m.group(1))))
            if not KANJI.search(m.group(1)):
                errs.append('[루비대상] %s %s 한자가 아닌데 루비' % (key, m.group(0)))
        for m in TOKEN.finditer(exj):
            n = len(m.group(2).split('|')) - 1
            if n not in (1, len(m.group(1))):
                errs.append('[예문루비] %s %s' % (key, m.group(0)))
        if KANJI.search(re.sub(TOKEN, '', exj)):
            errs.append('[예문루비누락] %s %s' % (key, re.sub(TOKEN, '', exj)))

        try:
            rk = K.ruby_to_ko(ruby)
        except Exception as e:
            errs.append('[변환] %s %s %s' % (key, ruby, e)); rk = '-'
        if not re.fullmatch(r'[가-힣 ]+', rk):
            errs.append('[발음표기] %s %s' % (key, rk))

        if (hw, rd) in seen:
            errs.append('[중복] %s %s|%s' % (key, hw, rd))
        seen.add((hw, rd))
        if pos not in ('noun', 'verb', 'i_adj', 'na_adj', 'adv', 'conj', 'pron',
                       'counter', 'prefix', 'suffix', 'interj', 'expr'):
            errs.append('[pos] %s %s' % (key, pos))
        if conj not in ('g1', 'g2', 'g3_suru', 'g3_kuru', 'suru_noun', 'i_adj', 'na_adj', '-'):
            errs.append('[conj_type] %s %s' % (key, conj))
        if tr not in ('vi', 'vt', 'vi_vt', '-'):
            errs.append('[transitivity] %s %s' % (key, tr))
        if pos == 'verb' and (conj == '-' or tr == '-'):
            errs.append('[동사필수] %s conj=%s tr=%s' % (key, conj, tr))
        if topic not in AXIS:
            errs.append('[선정축] %s %s' % (key, topic))

        note = '선정축: ①%s %s / %s; %s' % (
            AXIS.get(topic, topic), cando, freq_note(hw), tanos_verdict(hw, rd, pos))

        row = [key, 'N2', hw, rd, ruby, rk, pos, conj, tr, mk, mka, exj, exk,
               'jlpt.n2.vocab.%04d.m4a' % i, SOURCE, 'draft', note]
        for c in row:
            if c == '' or c is None:
                errs.append('[빈칸] %s' % key)
            if ',' in str(c) or '\n' in str(c):
                errs.append('[CSV파손] %s %r' % (key, c))
        out_rows.append(row)

    # 쿼터 실측 대조 — 계획과 결과가 어긋나면 계획서 쪽이 거짓말이 된다
    got = collections.Counter(r[8] for r in ROWS)
    for k in sorted(QUOTA):
        if got[k] != QUOTA[k]:
            errs.append('[쿼터] %s 계획%d != 실제%d' % (k, QUOTA[k], got[k]))

    # 기존 4파일과의 중복 (N5·N4·N3·파일럿)
    prev = {}
    for f in ('N5_단어_400.csv', 'N4_단어_400.csv', 'N3_단어_400.csv', 'N3_단어_파일럿_100.csv'):
        for x in csv.DictReader(io.open(RES + '/02_JLPT/' + f, encoding='utf-8-sig')):
            prev[(x['headword'], x['reading'])] = f
    for r in out_rows:
        if (r[2], r[3]) in prev:
            errs.append('[기존중복] %s <- %s' % (r[2], prev[(r[2], r[3])]))

    path = RES + '/02_JLPT/N2_단어_400.csv'
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write('﻿' + HEADER + '\n')
        for row in out_rows:
            f.write(','.join(row) + '\n')

    print('생성 %d행 -> %s' % (len(out_rows), path))
    print('검수 오류 %d건' % len(errs))
    for e in errs[:80]:
        print('  ', e)
    print('pos 분포:', collections.Counter(r[6] for r in out_rows).most_common())
    print('선정축 분포:', got.most_common())
    tv = collections.Counter(re.search(r'Tanos교차: ([^—;]+)', r[16]).group(1).strip()
                             for r in out_rows)
    print('Tanos 판정:', tv.most_common())


if __name__ == '__main__':
    main()
