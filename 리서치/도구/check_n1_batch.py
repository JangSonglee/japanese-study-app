# -*- coding: utf-8 -*-
"""check_n1_batch.py — N1 배치 1개를 **독립적으로** 검수(다른 배치 불필요).

build_n1.py 는 4배치를 합쳐 조립하므로 병렬 작성 중에는 못 돌린다. 이 스크립트는
n1_data{N}.py 한 개만 import 해서 그 배치의 ROWS 를 build_n1 과 동일한 규칙으로 검사한다.
CSV 를 쓰지 않고 오류만 보고한다. 최종 조립·전체 중복검사는 build_n1.py 가 한다.

사용: python 도구/check_n1_batch.py n1_data2
"""
import io, os, re, sys, importlib, collections

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.dirname(HERE)
JLPT = os.path.join(RES, '02_JLPT')
sys.path.insert(0, HERE)

import importlib.util
spec = importlib.util.spec_from_file_location('k', HERE + '/kana_to_ko.py')
K = importlib.util.module_from_spec(spec); spec.loader.exec_module(K)

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


def load_existing():
    prev = {}
    for f in ('N5_단어_400.csv', 'N4_단어_400.csv', 'N3_단어_400.csv',
              'N2_단어_400.csv', 'N3_단어_파일럿_100.csv'):
        p = os.path.join(JLPT, f)
        if not os.path.exists(p):
            continue
        import csv
        for x in csv.DictReader(io.open(p, encoding='utf-8-sig')):
            prev[(x['headword'], x['reading'])] = f
    return prev


def main():
    mod_name = sys.argv[1] if len(sys.argv) > 1 else 'n1_data1'
    mod = importlib.import_module(mod_name)
    rows_attr = [a for a in dir(mod) if a.startswith('ROWS')]
    if not rows_attr:
        print('오류: %s 에 ROWS* 리스트가 없음' % mod_name); return
    ROWS = getattr(mod, rows_attr[0])

    errs, seen = [], set()
    prev = load_existing()
    for i, r in enumerate(ROWS, 1):
        tag = '%s[%d]' % (mod_name, i)
        if not (isinstance(r, (tuple, list)) and len(r) == 8):
            errs.append('[필드수] %s 8필드 아님(%d)' % (tag, len(r) if hasattr(r, '__len__') else -1)); continue
        (ruby, pos, conj, tr, mk, mka, exj, exk) = r
        hw = strip_ruby(ruby); rd = ruby_readings(ruby)
        if not re.fullmatch(r'[ぁ-ゟァ-ヿー]+', rd):
            errs.append('[읽기] %s %s -> %s' % (tag, ruby, rd))
        for m in TOKEN.finditer(ruby):
            n = len(m.group(2).split('|')) - 1
            if n not in (1, len(m.group(1))):
                errs.append('[루비수] %s %s' % (tag, m.group(0)))
            if not KANJI.search(m.group(1)):
                errs.append('[루비대상] %s %s' % (tag, m.group(0)))
        for m in TOKEN.finditer(exj):
            n = len(m.group(2).split('|')) - 1
            if n not in (1, len(m.group(1))):
                errs.append('[예문루비] %s %s' % (tag, m.group(0)))
        if KANJI.search(re.sub(TOKEN, '', exj)):
            errs.append('[예문루비누락] %s %s' % (tag, re.sub(TOKEN, '', exj)))
        try:
            rk = K.ruby_to_ko(ruby)
            if not re.fullmatch(r'[가-힣 ]+', rk):
                errs.append('[발음표기] %s %s' % (tag, rk))
        except Exception as e:
            errs.append('[변환] %s %s %s' % (tag, ruby, e))
        if (hw, rd) in seen:
            errs.append('[배치내중복] %s %s|%s' % (tag, hw, rd))
        seen.add((hw, rd))
        if pos not in ('noun', 'verb', 'i_adj', 'na_adj', 'adv', 'conj', 'pron',
                       'counter', 'prefix', 'suffix', 'interj', 'expr'):
            errs.append('[pos] %s %s' % (tag, pos))
        if conj not in ('g1', 'g2', 'g3_suru', 'g3_kuru', 'suru_noun', 'i_adj', 'na_adj', '-'):
            errs.append('[conj_type] %s %s' % (tag, conj))
        if tr not in ('vi', 'vt', 'vi_vt', '-'):
            errs.append('[transitivity] %s %s' % (tag, tr))
        if pos == 'verb' and (conj == '-' or tr == '-'):
            errs.append('[동사필수] %s conj=%s tr=%s' % (tag, conj, tr))
        for c in (ruby, pos, conj, tr, mk, mka, exj, exk):
            if c == '' or c is None:
                errs.append('[빈칸] %s' % tag)
            if ',' in str(c) or '\n' in str(c):
                errs.append('[CSV파손] %s %r' % (tag, c))
        if (hw, rd) in prev:
            errs.append('[기존중복] %s %s <- %s' % (tag, hw, prev[(hw, rd)]))

    print('%s: %d행, 검수 오류 %d건' % (mod_name, len(ROWS), len(errs)))
    for e in errs[:100]:
        print('  ', e)
    print('pos 분포:', collections.Counter(r[1] for r in ROWS if len(r) == 8).most_common())


if __name__ == '__main__':
    main()
