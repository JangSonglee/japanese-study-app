# -*- coding: utf-8 -*-
"""N1 단어 400 CSV 생성 + 자체 검수.

build_n2.py 와 **같은 QA 기계**(루비 검증·한글발음 기계생성·중복·품사·CSV파손)를 그대로
쓴다. 달라진 것은 **선정축**뿐이다 — N1은 JF Can-do(교재 축)가 A2에서 끝나 존재하지 않으므로,
N5~N2의 ①JF Can-do 자리를 **①장르 편중도(genre-skew)** 가 대신한다(방법론 리포트
`N1_어휘방법론_조사_2026-07-25.md`, Phase1 `N1_Phase1_편중도엔진_2026-07-25.md`).

행 형식(n1_data*.py): (ruby, pos, conj_type, transitivity, meaning_ko, meaning_ko_alt,
                       example_ja, example_ko)
  · headword / reading 은 ruby 에서 기계가 뽑는다(사람이 세 번 적으면 세 번 흔들린다).
  · **장르·편중도z·zipf·Tanos 판정은 여기서 기계가 채운다** — 랭킹 CSV
    `N1_후보풀_전량랭킹_2026-07-25.csv`(skew_rank.py 산출)에서 headword로 조인.
    즉 작성자(슈슈)는 언어적 내용(뜻·예문·품사)만 쓰고, 선정 근거는 엔진이 붙인다.
  · Tanos: 후보 풀 자체가 Tanos N1_HW 이므로 대부분 'Tanos N1 일치'. note 에만 기록
    (source 아님 — 우리는 Tanos 목록을 옮긴 앱이 아니다. 규격 8장 / 진행상태 결정 참조).

실행: python 도구/build_n1.py
"""
import io, os, re, csv, sys, collections

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.dirname(HERE)                      # 리서치/
JLPT = os.path.join(RES, '02_JLPT')
sys.path.insert(0, HERE)

import importlib.util
spec = importlib.util.spec_from_file_location('k', HERE + '/kana_to_ko.py')
K = importlib.util.module_from_spec(spec); spec.loader.exec_module(K)

import tanos_ref_n3 as TAN                        # 참조본 v2 (N1~N5 전량)

RANK_CSV = os.path.join(JLPT, 'N1_후보풀_전량랭킹_2026-07-25.csv')

SOURCE = 'ref_only:tanos_n1+genre_skew'
HEADER = ('content_key,level_code,headword,reading,ruby,romaji_ko,pos,conj_type,transitivity,'
          'meaning_ko,meaning_ko_alt,example_ja,example_ko,audio_file,source,verify,note')

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


# ── 랭킹 CSV → headword별 (장르라벨, 편중도z, zipf) 메타 ─────────────────────────
def load_skew_meta():
    meta = {}
    with io.open(RANK_CSV, encoding='utf-8-sig') as f:
        rows = list(csv.reader(f))
    header = rows[1]
    idx = {n: i for i, n in enumerate(header)}
    for r in rows[2:]:
        if not r or not r[idx['word']].strip():
            continue
        meta[r[idx['word']]] = {
            'genre': r[idx['상위장르']],
            'z': r[idx['편중도']],
            'zipf': r[idx['일반빈도zipf']],
        }
    return meta


def skew_note(hw):
    m = SKEW.get(hw)
    if not m:
        return '①장르편중도: 랭킹풀 미검출(감수 추가어 — 편중도 재계산 필요)'
    return '①장르편중도 %s z=%s / ②일반빈도 zipf %s' % (m['genre'], m['z'], m['zipf'])


def tanos_verdict(hw, rd, pos):
    if pos in ('counter', 'suffix', 'prefix'):
        return 'Tanos교차: 대조제외(조수사·접사는 목록 대상 아님)'
    lv = TAN.lookup(hw, rd)
    if lv == 'N1':
        return 'Tanos교차: N1 일치'
    if lv in ('N2', 'N3', 'N4', 'N5'):
        return 'Tanos교차: %s 분류 — 편중도 기준으로 N1 선정(선정축 우선)' % lv
    return 'Tanos교차: 전급수 목록밖 — 편중도 기반 현대 격식어로 판단'


# 🔴 대표님 검수(2026-07-27)로 하위급수 재분류되어 N1에서 제외되는 20건.
# 이들의 예문·뜻은 N2/N3/N5 애드addendum CSV로 이동됨(確り은 이미 N4에 있어 이동 없이 제외).
REMOVED = {
    '捕らえる', '押さえる', '偏る', '跨ぐ', '仮', '一定', 'ぶら下げる', '吊るす', '主任',
    '徐々', '地方', '審判', '留める', '節', '正に', '屡', '容易い', '確り', '如何', '色々',
}


def load_rows():
    from n1_data1 import ROWS1
    all_rows = list(ROWS1)
    for mod in ('n1_data2', 'n1_data3', 'n1_data4', 'n1_data5'):
        try:
            m = __import__(mod)
            attr = [a for a in dir(m) if a.startswith('ROWS')][0]
            all_rows += list(getattr(m, attr))
        except Exception:
            pass
    # 하위 재분류 20건 필터
    return [r for r in all_rows if strip_ruby(r[0]) not in REMOVED]


SKEW = load_skew_meta()


def main():
    ROWS = load_rows()
    errs, seen, out_rows = [], set(), []
    for i, r in enumerate(ROWS, 1):
        (ruby, pos, conj, tr, mk, mka, exj, exk) = r
        key = 'jlpt.n1.vocab.%04d' % i
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

        note = '선정축: %s; %s' % (skew_note(hw), tanos_verdict(hw, rd, pos))

        row = [key, 'N1', hw, rd, ruby, rk, pos, conj, tr, mk, mka, exj, exk,
               'jlpt.n1.vocab.%04d.m4a' % i, SOURCE, 'draft', note]
        for c in row:
            if c == '' or c is None:
                errs.append('[빈칸] %s' % key)
            if ',' in str(c) or '\n' in str(c):
                errs.append('[CSV파손] %s %r' % (key, c))
        out_rows.append(row)

    # 기존 5파일과의 중복 (N5·N4·N3·N2·파일럿)
    prev = {}
    for f in ('N5_단어_400.csv', 'N4_단어_400.csv', 'N3_단어_400.csv',
              'N2_단어_400.csv', 'N3_단어_파일럿_100.csv'):
        p = os.path.join(JLPT, f)
        if not os.path.exists(p):
            continue
        for x in csv.DictReader(io.open(p, encoding='utf-8-sig')):
            prev[(x['headword'], x['reading'])] = f
    for r in out_rows:
        if (r[2], r[3]) in prev:
            errs.append('[기존중복] %s <- %s' % (r[2], prev[(r[2], r[3])]))

    path = os.path.join(JLPT, 'N1_단어_390.csv')
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write('﻿' + HEADER + '\n')
        for row in out_rows:
            f.write(','.join(row) + '\n')

    print('생성 %d행 -> %s' % (len(out_rows), path))
    print('검수 오류 %d건' % len(errs))
    for e in errs[:80]:
        print('  ', e)
    print('pos 분포:', collections.Counter(r[6] for r in out_rows).most_common())
    gd = collections.Counter(SKEW.get(r[2], {}).get('genre', '미검출') for r in out_rows)
    print('장르 분포:', gd.most_common())
    tv = collections.Counter(re.search(r'Tanos교차: ([^—;]+)', r[16]).group(1).strip()
                             for r in out_rows)
    print('Tanos 판정:', tv.most_common())


if __name__ == '__main__':
    main()
