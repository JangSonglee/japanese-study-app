# -*- coding: utf-8 -*-
"""furigana_annotate.py — 평문 일본어 → 후리가나 브래킷 {漢字|よみ} 자동 주석.

무엇을:
 · fugashi(MeCab+unidic-lite)로 토큰화 → 한자를 포함한 토큰만, 한자 런(run)에 읽기를 얹는다.
 · 가나 오쿠리가나는 앵커로 써서 한자 런의 읽기만 잘라낸다(食べる → {食|た}べる, 昼ご飯 → {昼|ひる}ご{飯|はん}).
 · A:「…」 같은 마크업·구두점·가나·가타카나 외래어는 그대로 통과.
 · ruby_to_json 규칙과 호환: {표기|읽기}(그룹) 또는 {표기|읽기1|…}(글자별). 여기선 런 단위 그룹 루비.

🔴 읽기는 fugashi 발음(가타→히라). 중의성 오독은 FURI_OVERRIDE 로 교정(明日=あした 등).

쓰임:
  from furigana_annotate import furigana
  furigana('きのう、私は友達と町へ行きました。')  # -> 'きのう、{私|わたし}は{友達|ともだち}と{町|まち}へ{行|い}きました。'

  python furigana_annotate.py           # 자체 검증(N5 문장 몇 개)
"""
import sys
import fugashi

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

_TAGGER = fugashi.Tagger()

# 오독 교정(표시용 후리가나). 문맥 독립적으로 안전한 것만.
FURI_OVERRIDE = {
    '私': 'わたし',
    '明日': 'あした',
    '今日': 'きょう',
    '昨日': 'きのう',
    '一日': 'いちにち',
    '二日': 'ふつか',
    '一人': 'ひとり',
    '二人': 'ふたり',
    '大人': 'おとな',
    '饒舌': 'じょうぜつ',   # fugashi 오독 にょうぜつ 교정
    '素性': 'すじょう',     # 신원·출신. fugashi 오독 そせい 교정
    '頭数': 'あたまかず',   # 사람 머릿수. fugashi 오독 とうすう 교정
}


def _is_kanji(ch):
    o = ord(ch)
    return (0x4E00 <= o <= 0x9FFF) or (0x3400 <= o <= 0x4DBF) or o == 0x3005  # CJK + 々


def _has_kanji(s):
    return any(_is_kanji(c) for c in s)


def kata_to_hira(s):
    out = []
    for ch in s or '':
        o = ord(ch)
        out.append(chr(o - 0x60) if 0x30A1 <= o <= 0x30F6 else ch)
    return ''.join(out)


def _segments(surface):
    """표면을 [한자런/가나런] 교대 세그먼트로."""
    segs = []
    for ch in surface:
        k = _is_kanji(ch)
        if segs and segs[-1][1] == k:
            segs[-1][0] += ch
        else:
            segs.append([ch, k])
    return segs


def _annotate_token(surface, reading):
    """한 토큰(surface)+읽기(hira) → 브래킷 표기. 정렬 실패 시 그룹 루비 폴백."""
    if not _has_kanji(surface):
        return surface
    if surface in FURI_OVERRIDE:
        reading = FURI_OVERRIDE[surface]
    if not reading:
        return surface
    segs = _segments(surface)
    out, ri = [], 0
    for i, (text, k) in enumerate(segs):
        if not k:  # 가나 런: 읽기에서 앵커로 매칭
            pos = reading.find(text, ri)
            if pos == -1:
                return '{%s|%s}' % (surface, reading)  # 폴백: 통째 그룹 루비
            ri = pos + len(text)
            out.append(text)
        else:      # 한자 런: 다음 가나 앵커까지의 읽기
            if i + 1 < len(segs) and not segs[i + 1][1]:
                nxt = segs[i + 1][0]
                pos = reading.find(nxt, ri)
                if pos == -1:
                    return '{%s|%s}' % (surface, reading)
                kr = reading[ri:pos]
                ri = pos
            else:
                kr = reading[ri:]
                ri = len(reading)
            if not kr:
                return '{%s|%s}' % (surface, reading)
            out.append('{%s|%s}' % (text, kr))
    return ''.join(out)


def furigana(text):
    """평문 일본어 → 후리가나 브래킷 문자열."""
    parts = []
    for w in _TAGGER(text):
        surface = w.surface
        reading = kata_to_hira(getattr(w.feature, 'kana', None) or '')
        parts.append(_annotate_token(surface, reading))
    return ''.join(parts)


if __name__ == '__main__':
    tests = [
        'きのう、私は友達と町へ行きました。',
        '昼ご飯はレストランで食べました。',
        '午後は二人で映画を見ました。',
        'あした、クラスでパーティーをします。時間は午後六時から八時までです。',
        'A:「明日のパーティー、何を持っていきましょうか。」',
    ]
    for t in tests:
        print(t)
        print('  →', furigana(t))
        print()
