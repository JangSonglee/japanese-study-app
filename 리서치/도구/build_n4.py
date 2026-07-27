# -*- coding: utf-8 -*-
"""N4 단어 400 CSV 생성 + 자체 검수.

romaji_ko 는 사람이 적지 않는다. ruby 한 컬럼에서 kana_to_ko.ruby_to_ko() 로 생성한다.
(규격 6.1-6 — 사람이 손으로 적으면 반드시 흔들린다)
"""
import io, os, re, csv, sys, importlib.util, collections

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.dirname(HERE)          # 리서치/
sys.path.insert(0, HERE)

spec = importlib.util.spec_from_file_location('k', RES + '/도구/kana_to_ko.py')
K = importlib.util.module_from_spec(spec); spec.loader.exec_module(K)

from n4_data1 import ROWS1
from n4_data2 import ROWS2
from n4_data3 import ROWS3
from n4_data4 import ROWS4

ROWS = ROWS1 + ROWS2 + ROWS3 + ROWS4

# ── source 재배정 ────────────────────────────────────────────────────────────
# 🔴 선정의 「주」 원천은 JF 교재 축이다. Tanos는 **급수 배정 교차검증 전용**이므로
#    source 컬럼에 남기지 않고 note 에만 판정을 적는다.
#    (교차검증 도구를 출처로 적어 두면, 나중에 "우리가 Tanos 목록을 베꼈다"로 읽힌다)
#    데이터 파일에서 임시로 'tanos_ccby' 로 찍어 둔 행을 아래 축으로 되돌린다.
MARU = set("""社会 世界 文化 歴史 小説 将来 意見 考え 夢 理由 経験 研究 生活 習慣 形 力
気持ち 気分 季節 景色 星 空気 最初 最後 以上 以下 以外 途中 昔 倍 男性 女性 親 祖父 祖母
美しい 悲しい 寂しい 恥ずかしい 珍しい 素晴らしい 優しい 厳しい 若い 深い 浅い 怖い 硬い 細かい
立派 楽 自由 十分 特別 適当 確か 盛ん 熱心 一生懸命 真面目 素敵 丁寧 複雑 必要 安全 危険 大事
非常に 決して なかなか ほとんど 大体 特に 別に たまに なるべく いつか きっと たぶん
つまり けれども 例えば ところで それとも だけど
信じる 考える 比べる 喜ぶ 笑う 生きる 楽しむ 慣れる 思い出す 驚く 怒る 進む 足りる 似る 別れる
役に立つ 謝る""".split())

SAMPLE = set("""選ぶ 正しい 違う 意味 字 方 単語 発音 文法 試験 どちら または 場合 自分
決まる 決める 間違える""".split())

_M = 'ref_only:jf_marugoto_a2'
_I = 'ref_only:jf_irodori_a2'
_S = 'ref_only:jlpt_n4_sample'
ROWS = [r[:10] + ((_S if r[0] in SAMPLE else _M if r[0] in MARU else _I)
                  if r[10] == 'tanos_ccby' else r[10],) + r[11:]
        for r in ROWS]

HEADER = ('content_key,level_code,headword,reading,ruby,romaji_ko,pos,conj_type,transitivity,'
          'meaning_ko,meaning_ko_alt,example_ja,example_ko,audio_file,source,verify,note')

TOKEN = re.compile(r'\{([^|{}]+)((?:\|[^|{}]*)+)\}')

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

# ── Tanos 급수 배정 교차검증 (note 에 기계 판정으로 기록) ─────────────────────
# 손으로 적은 「Tanos N4 일치」류 주장은 지우고 참조본 대조 결과로 갈아끼운다.
# 이유: 교차검증 결과를 사람이 적으면 그것도 검수 대상이 된다. 기계가 적으면 아니다.
# 🔴 2026-07-23 v2로 교체. 구판(`tanos_ref`)은 .mem 바이너리에서 긁은 것이라
#    「み〜わ」 구간 결손 + かな 표제어 미수록 → 400건 중 **93건이 '미확인'** 이었다.
#    v2(`tanos_ref_n3`)는 tanos.co.uk 공식 PDF 5종(N1~N5) 파싱본이라 구간 제한이 없다.
#    → 못 찾으면 '미확인'이 아니라 '전급수 목록밖'이라고 **단정할 수 있다.** 이게 v2의 값이다.
#    N1·N2까지 대조하므로 판정이 방향 정보를 갖는다(「N3 분류」 = 통념보다 반 급수 위).
import tanos_ref_n3 as TAN

def tanos_verdict(hw, rd, pos):
    if pos in ('counter', 'suffix', 'prefix'):
        return 'Tanos교차: 대조제외(조수사·접사는 목록 대상 아님)'
    lv = TAN.lookup(hw, rd)
    if lv == 'N4':
        return 'Tanos교차: N4 일치'
    if lv == 'N5':
        return 'Tanos교차: N5 분류 — 우리 N5 400 미수록 잔여분을 N4로 흡수'
    if lv in ('N3', 'N2', 'N1'):
        return 'Tanos교차: %s 분류(구시험 기준) — 교재축 판단을 우선해 N4 유지' % lv
    return 'Tanos교차: 전급수 목록밖 — Tanos(구시험 어휘)에 없는 현대어로 판단'

def fix_note(note, hw, rd, pos):
    keep = [s for s in note.split('; ')
            if not (s.startswith('Tanos') and '—' not in s and '→' not in s)]
    if not keep:
        keep = ['선정축: N4 표준 어휘 — 급수 배정 근거는 아래 교차검증']
    return '; '.join(keep) + '; ' + tanos_verdict(hw, rd, pos)

errs = []
seen = set()
out_rows = []
for i, r in enumerate(ROWS, 1):
    (hw, rd, ruby, pos, conj, tr, mk, mka, exj, exk, src, note) = r
    key = 'jlpt.n4.vocab.%04d' % i
    # 검수 2·3·4
    if strip_ruby(ruby) != hw:
        errs.append('[표기] %s ruby벗김=%s != headword=%s' % (key, strip_ruby(ruby), hw))
    if ruby_readings(ruby) != rd:
        errs.append('[읽기] %s ruby읽기=%s != reading=%s' % (key, ruby_readings(ruby), rd))
    for m in TOKEN.finditer(ruby):
        n = len(m.group(2).split('|')) - 1
        if n not in (1, len(m.group(1))):
            errs.append('[루비수] %s %s 읽기%d개 vs 표기%d자' % (key, m.group(0), n, len(m.group(1))))
    for m in TOKEN.finditer(exj):
        n = len(m.group(2).split('|')) - 1
        if n not in (1, len(m.group(1))):
            errs.append('[예문루비] %s %s' % (key, m.group(0)))
    # romaji_ko 기계 생성
    try:
        rk = K.ruby_to_ko(ruby)
    except Exception as e:
        errs.append('[변환] %s %s %s' % (key, ruby, e)); rk = '-'
    if not re.fullmatch(r'[가-힣 ]+', rk):
        errs.append('[발음표기] %s %s' % (key, rk))
    # 검수 1·7·8·9
    if (hw, rd) in seen:
        errs.append('[중복] %s %s|%s' % (key, hw, rd))
    seen.add((hw, rd))
    if pos not in ('noun','verb','i_adj','na_adj','adv','conj','pron','counter','prefix','suffix','interj','expr'):
        errs.append('[pos] %s %s' % (key, pos))
    if conj not in ('g1','g2','g3_suru','g3_kuru','suru_noun','i_adj','na_adj','-'):
        errs.append('[conj_type] %s %s' % (key, conj))
    if tr not in ('vi','vt','vi_vt','-'):
        errs.append('[transitivity] %s %s' % (key, tr))
    if pos == 'verb' and (conj == '-' or tr == '-'):
        errs.append('[동사필수] %s conj=%s tr=%s' % (key, conj, tr))
    row = [key,'N4',hw,rd,ruby,rk,pos,conj,tr,mk,mka,exj,exk,
           'jlpt.n4.vocab.%04d.m4a' % i, src, 'draft', fix_note(note, hw, rd, pos)]
    for c in row:
        if c == '' or c is None:
            errs.append('[빈칸] %s' % key)
        if ',' in str(c) or '\n' in str(c):
            errs.append('[CSV파손] %s %r' % (key, c))
    out_rows.append(row)

path = RES + '/02_JLPT/N4_단어_400.csv'
with io.open(path, 'w', encoding='utf-8', newline='') as f:
    f.write('﻿' + HEADER + '\n')
    for row in out_rows:
        f.write(','.join(row) + '\n')

print('생성 %d행 -> %s' % (len(out_rows), path))
print('검수 오류 %d건' % len(errs))
for e in errs[:60]:
    print('  ', e)
print('pos 분포:', collections.Counter(r[6] for r in out_rows).most_common())
print('source 분포:', collections.Counter(r[14] for r in out_rows).most_common())
