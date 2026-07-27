# -*- coding: utf-8 -*-
"""N3 단어 400 CSV 생성 + 자체 검수.

N4 빌드(build_n4.py)와 달라진 것 3가지 — 전부 "사람이 같은 값을 두 번 적지 않게" 하려는 것이다.

 ① `headword` · `reading` 을 **사람이 적지 않는다.** ruby 한 컬럼에서 기계가 뽑는다.
    N4 때는 셋을 따로 적고 빌드가 대조했는데, 대조는 틀린 걸 찾아 줄 뿐 **틀리는 것 자체를 못 막는다.**
    하나만 적으면 불일치라는 오류 종류가 통째로 사라진다.
 ② `note` 에 **선정 근거 두 축을 숫자까지** 적는다 — ①어느 B1 Can-do가 이 단어를 부르는가,
    ②코퍼스 빈도 몇 위인가. 규격 1.2의 목적("나중에 어느 것을 지울지 답할 수 있게")은
    출처 이름만으로는 달성되지 않는다. **왜 골랐는지**가 있어야 한다.
 ③ Tanos 판정이 **N1~N5 5급수 전체 대조**다(tanos_ref_n3.py). '일치/목록밖' 2값이 아니라
    'N2 분류' 같은 방향 정보가 나온다.

실행: python 도구/build_n3.py
"""
import io, os, re, csv, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.dirname(HERE)                      # 리서치/
sys.path.insert(0, HERE)

import importlib.util
spec = importlib.util.spec_from_file_location('k', HERE + '/kana_to_ko.py')
K = importlib.util.module_from_spec(spec); spec.loader.exec_module(K)

from n3_data1 import ROWS1
from n3_data2 import ROWS2
from n3_data3 import ROWS3
from n3_data4 import ROWS4
import tanos_ref_n3 as TAN
from n3_freq_data import FREQ, POP

ROWS = ROWS1 + ROWS2 + ROWS3 + ROWS4

HEADER = ('content_key,level_code,headword,reading,ruby,romaji_ko,pos,conj_type,transitivity,'
          'meaning_ko,meaning_ko_alt,example_ja,example_ko,audio_file,source,verify,note')

# 선정축 코드 → ① JF Can-do B1 주제/언어활동 이름
AXIS = {
    'T01': 'B1「自分と家族」', 'T02': 'B1「自由時間と娯楽」', 'T03': 'B1「生活と人生」',
    'T04': 'B1「旅行と交通」', 'T05': 'B1「健康」', 'T06': 'B1「買い物」',
    'T07': 'B1「食生活」', 'T08': 'B1「自然と環境」', 'T09': 'B1「学校と教育」',
    'T10': 'B1「言語と文化」', 'T11': 'B1「仕事と職業」', 'T12': 'B1「科学技術」',
    'T13': 'B1「住まいと住環境」', 'T14': 'B1「社会」', 'T15': 'B1「人との関係」',
    'F1': 'B1 언어활동「意見を述べる·論述する」', 'F2': 'B1 언어활동「感情·共感を示す」',
    'F3': 'B1 언어활동「理由·根拠を説明する」', 'F4': 'B1 언어활동「比較する·程度を言う」',
    'F5': 'B1 언어활동「順序だてて説明する」', 'F6': 'B1 언어활동「情報交換·問い合わせ·依頼」',
}
SOURCE = 'ref_only:jfs_cando_b1+corpus_freq'

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


# ── ③ Tanos 교차검증 (기계가 찍는다. 사람이 적으면 검증하려던 것이 검증 대상이 된다) ──
def tanos_verdict(hw, rd, pos):
    if pos in ('counter', 'suffix', 'prefix'):
        return 'Tanos교차: 대조제외(조수사·접사는 목록 대상 아님)'
    lv = TAN.lookup(hw, rd)
    if lv == 'N3':
        return 'Tanos교차: N3 일치'
    if lv in ('N4', 'N5'):
        return 'Tanos교차: %s 분류 — 우리 %s 400 미수록 잔여분을 N3으로 흡수' % (lv, lv)
    if lv in ('N2', 'N1'):
        return 'Tanos교차: %s 분류(구시험 기준) — 선정축 판단을 우선해 N3 유지' % lv
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
        key = 'jlpt.n3.vocab.%04d' % i
        hw = strip_ruby(ruby)
        rd = ruby_readings(ruby)

        # 검수 — 루비 자체의 정합성
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

        # romaji_ko 기계 생성 (규격 6.1-6 — 사람이 적으면 반드시 흔들린다)
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

        row = [key, 'N3', hw, rd, ruby, rk, pos, conj, tr, mk, mka, exj, exk,
               'jlpt.n3.vocab.%04d.m4a' % i, SOURCE, 'draft', note]
        for c in row:
            if c == '' or c is None:
                errs.append('[빈칸] %s' % key)
            if ',' in str(c) or '\n' in str(c):
                errs.append('[CSV파손] %s %r' % (key, c))
        out_rows.append(row)

    # 기존 3파일과의 중복 (N5·N4·N3 파일럿)
    prev = {}
    for f in ('N5_단어_400.csv', 'N4_단어_400.csv', 'N3_단어_파일럿_100.csv'):
        for x in csv.DictReader(io.open(RES + '/02_JLPT/' + f, encoding='utf-8-sig')):
            prev[(x['headword'], x['reading'])] = f
    dup = [(r[2], prev[(r[2], r[3])]) for r in out_rows if (r[2], r[3]) in prev]
    for hw, f in dup:
        errs.append('[기존중복] %s <- %s' % (hw, f))

    path = RES + '/02_JLPT/N3_단어_400.csv'
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write('﻿' + HEADER + '\n')
        for row in out_rows:
            f.write(','.join(row) + '\n')

    print('생성 %d행 -> %s' % (len(out_rows), path))
    print('검수 오류 %d건' % len(errs))
    for e in errs[:80]:
        print('  ', e)
    print('pos 분포:', collections.Counter(r[6] for r in out_rows).most_common())
    print('선정축 분포:', collections.Counter(r[8] for r in ROWS).most_common())
    tv = collections.Counter(re.search(r'Tanos교차: ([^—;]+)', r[16]).group(1).strip()
                             for r in out_rows)
    print('Tanos 판정:', tv.most_common())


if __name__ == '__main__':
    main()
