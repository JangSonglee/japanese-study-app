# -*- coding: utf-8 -*-
"""build_listening.py — N5 청해(listening) flat CSV 기계 검수 + 변환 헬퍼.

방법론 §8 검사:
 · 화자 라벨 A:/B: 파싱 가능 여부(대본 → 턴 분리), 화자 수 산출
 · 루비 검증(발화·문항·선택지) · romaji_ko 기계 생성(크래시 금지)
 · 간투사 표기 확인: えーと/ええと/あのー 뒤 …… 없으면 경고(규격 4.4.1 TTS)
 · 문항 정합: answer 범위(즉시응답 3지선다 '-' 허용), 정답 1개, 키 유일, 선택지 중복 0
 · 필드 내 ASCII 쉼표·줄바꿈 0

변환 함수(split_turns_ja/split_turns_ko/gen_romaji_ko/pack)는 load_listening.py 가 재사용.

사용: python build_listening.py [<csv경로>]
"""
import os, sys, io, csv, json, re, importlib.util

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(os.path.join(HERE, '..', '..'))
JLPT = os.path.join(PROJ, '리서치', '02_JLPT')

# 변환·romaji 로직은 build_reading 과 동일 → 그대로 재사용(단일 출처)
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import build_reading as br
iv = br.iv
pack = br.pack
gen_romaji_ko = br.gen_romaji_ko
strip_brackets = br.strip_brackets

HEADER = ['content_key', 'level_code', 'type', 'script_ja', 'script_ko',
          'question', 'choice1', 'choice2', 'choice3', 'choice4', 'answer']

TURN_JA = re.compile(r'([AB])\s*:\s*「(.*?)」')
TURN_KO = re.compile(r'([AB])\s*:\s*(?:「(.*?)」|([^AB]*?))(?=\s*[AB]\s*:|$)', re.S)
FILLER = ('えーと', 'ええと', 'あのー', 'あのう', 'えっと')


def split_turns_ja(script):
    """script_ja -> [(speaker, inner_bracket)]. 「」 안 원문(브래킷 포함) 유지."""
    return [(m.group(1), m.group(2)) for m in TURN_JA.finditer(script)]


def split_turns_ko(script):
    """script_ko -> [(speaker, text)]. 「」 있으면 그 안, 없으면 라벨 사이 텍스트."""
    out = []
    for m in TURN_KO.finditer(script):
        txt = (m.group(2) if m.group(2) is not None else (m.group(3) or '')).strip()
        txt = txt.strip('。.').strip()
        if txt:
            out.append((m.group(1), txt))
    return out


def main(path):
    rows = list(csv.DictReader(io.open(path, encoding='utf-8-sig')))
    errs, warns, keys = [], [], set()
    for i, r in enumerate(rows, 1):
        ck = r['content_key']
        tag = '[%d %s]' % (i, ck)
        for col in ('content_key', 'level_code', 'type', 'script_ja', 'question',
                    'choice1', 'choice2', 'answer'):
            if not (r.get(col) or '').strip():
                errs.append('%s 필수 누락: %s' % (tag, col))
        if ck in keys:
            errs.append('%s content_key 중복' % tag)
        keys.add(ck)
        for col in HEADER:
            v = r.get(col) or ''
            if (',' in v) or ('\n' in v) or ('\r' in v):
                errs.append('%s ASCII 쉼표/줄바꿈: %s' % (tag, col))
        # 화자 턴 파싱
        turns = split_turns_ja(r['script_ja'])
        if not turns:
            errs.append('%s script_ja 화자 라벨 A:/B: 파싱 실패' % tag)
        spk = sorted(set(s for s, _ in turns))
        for s, inner in turns:
            try:
                iv.ruby_to_json(inner)
            except Exception as e:
                errs.append('%s 발화 루비 실패: %s' % (tag, e))
            _, deg = gen_romaji_ko(inner)
            if deg:
                warns.append('%s romaji 폴백(외래어 추정): %r' % (tag, strip_brackets(inner)[:16]))
        # ko 턴 정합
        ko_turns = split_turns_ko(r.get('script_ko') or '')
        if ko_turns and len(ko_turns) != len(turns):
            warns.append('%s ja턴 %d ≠ ko턴 %d (load 최선매핑)' % (tag, len(turns), len(ko_turns)))
        # 간투사 표기(규격 4.4.1)
        for s, inner in turns:
            for f in FILLER:
                if f in inner and '……' not in inner and '…' not in inner:
                    warns.append('%s 간투사 %r 뒤 …… 표기 없음(TTS 권고)' % (tag, f))
        # 문항 정합
        try:
            check_ruby_q(tag, r['question'], errs)
        except Exception:
            pass
        choices = []
        for c in ('choice1', 'choice2', 'choice3', 'choice4'):
            v = (r.get(c) or '').strip()
            if v and v != '-':
                try:
                    base, _, _ = iv.ruby_to_json(v)
                except Exception as e:
                    errs.append('%s %s 루비 실패: %s' % (tag, c, e)); base = v
                choices.append(base)
        try:
            ans = int((r.get('answer') or '').strip())
            if not (1 <= ans <= len(choices)):
                errs.append('%s answer(%d) 범위(1~%d) 밖' % (tag, ans, len(choices)))
        except Exception:
            errs.append('%s answer 정수 아님: %r' % (tag, r.get('answer')))
        if len(choices) != len(set(choices)):
            errs.append('%s 선택지 중복: %s' % (tag, choices))

    print('=' * 64)
    print('청해 검수: %s · 총 %d행' % (os.path.basename(path), len(rows)))
    print('오류 %d건 · 경고 %d건' % (len(errs), len(warns)))
    for e in errs[:80]:
        print('  ERR ', e)
    for w in warns[:40]:
        print('  WARN', w)
    if len(warns) > 40:
        print('  … 경고 외 %d건' % (len(warns) - 40))
    return len(errs)


def check_ruby_q(tag, val, errs):
    try:
        iv.ruby_to_json(val)
    except Exception as e:
        errs.append('%s question 루비 실패: %s' % (tag, e))


if __name__ == '__main__':
    p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(JLPT, 'N5_청해_20.csv')
    if not os.path.isabs(p):
        p = os.path.join(PROJ, p)
    sys.exit(1 if main(p) else 0)
