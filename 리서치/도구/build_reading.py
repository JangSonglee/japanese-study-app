# -*- coding: utf-8 -*-
"""build_reading.py — N5 독해(reading) flat CSV 기계 검수 + flat→정규화 변환 헬퍼.

방법론 §8 검사 항목:
 · 루비 검증: {} 균형 · 브래킷 벗김 · 읽기 이어붙임 (import_vocab.ruby_to_json 재사용)
 · romaji_ko 기계 생성(kana_to_ko A안, 값은 CSV에 없음 → 생성). 크래시 금지(폴백).
 · 문항 정합: answer가 choice 범위, 정답 1개, content_key 유일, 선택지 중복 0
 · 필드 내 ASCII 쉼표·줄바꿈 0 (일본어 、。「」·한글은 통과)
 · 문장 길이 60자 초과 경고 · ja 문장수 ≠ ko 문장수 경고(폴백은 load에서)

이 파일의 변환 함수(split_ja/split_ko/gen_romaji_ko/pack)는 load_reading.py가 그대로 재사용한다
(변환 로직 단일 출처). 오류 0이어야 임포트 진행.

사용: python build_reading.py            # 기본 N5_독해_20.csv
      python build_reading.py <csv경로>
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
BE = os.path.join(PROJ, '개발', '백엔드_도다이')


def _load(mod, path):
    s = importlib.util.spec_from_file_location(mod, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m

k2k = _load('kana_to_ko', os.path.join(HERE, 'kana_to_ko.py'))
iv = _load('import_vocab', os.path.join(BE, 'import_vocab.py'))

HEADER = ['content_key', 'level_code', 'genre', 'passage_ja', 'passage_ko', 'question',
          'choice1', 'choice2', 'choice3', 'choice4', 'answer', 'explanation_ko']

# 일본어(히라/가타/한자)·루비 브래킷·장음부호만 남기고 나머지는 절 경계로 본다.
_KEEP = re.compile(r'[぀-ヿ一-鿿ｦ-ﾟ]')


def _is_keep(c):
    return bool(_KEEP.match(c)) or c in '{}|'


def strip_brackets(s):
    """{漢字|よみ...} -> 漢字. import_vocab.ruby_to_json 의 base 와 동일하나 검증 없이 문자열만."""
    base, _, _ = iv.ruby_to_json(s)
    return base


def pack(bracket, always=False):
    """브래킷 표기 -> (base평문, ruby_json 문자열 또는 None).
    always=True 면 루비가 없어도 {base,ruby:[]} JSON 을 만든다(문장 reading 용)."""
    base, rl, _ = iv.ruby_to_json(bracket)
    if rl or always:
        return base, json.dumps({'base': base, 'ruby': rl}, ensure_ascii=False)
    return base, None


def split_ja(text):
    """passage_ja -> 문장 리스트. 。！？ 로 분리(구분자 유지). 브래킷 안엔 구두점 없음."""
    return [p for p in re.findall(r'[^。！？]+[。！？]?', text) if p.strip()]


def split_ko(text):
    """passage_ko -> 문장 리스트. 한국어 문장부호 . ! ? 로 분리(구분자 유지)."""
    return [p.strip() for p in re.findall(r'[^.!?]+[.!?]?', text) if p.strip()]


def _clauses(s):
    """일본어 문자열을 구두점 경계로 절 단위 분리(브래킷은 통째 유지, 구두점은 버림)."""
    out, buf, i, n = [], [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '{':
            j = s.find('}', i)
            if j == -1:
                buf.append(s[i:]); break
            buf.append(s[i:j + 1]); i = j + 1; continue
        if _is_keep(c):
            buf.append(c); i += 1; continue
        if buf:
            out.append(''.join(buf)); buf = []
        i += 1
    if buf:
        out.append(''.join(buf))
    return out


def _tolerant(clause):
    """ruby_to_ko 가 못 읽는 절(외래어 가타카나 등)을 크래시 없이 최선 변환."""
    flat = k2k.flatten(clause)
    hira = [k2k.KATA2HIRA.get(c, c) for c, _ in flat]
    out, i, n = [], 0, len(hira)
    while i < n:
        h = hira[i]
        nxt = hira[i + 1] if i + 1 < n else ''
        if h + nxt in k2k.YOUON:
            out.append(k2k.YOUON[h + nxt]); i += 2; continue
        if h in ('ー', 'ｰ'):
            i += 1; continue
        if h == 'っ':
            i += 1; continue
        if h == 'ん':
            if out:
                out[-1] = k2k.add_batchim(out[-1], 'ㄴ')
            i += 1; continue
        if h in k2k.BASE:
            out.append(k2k.BASE[h]); i += 1; continue
        i += 1  # 미지 글자(소가나·기호) 스킵
    return ''.join(out)


def gen_romaji_ko(bracket):
    """일본어(루비 포함) -> 한글 발음(romaji_ko). A안. 크래시 금지.
    반환: (romaji_ko, degraded)  degraded=True 면 폴백을 한 번이라도 썼다."""
    degraded = False
    parts = []
    for cl in _clauses(bracket):
        try:
            parts.append(k2k.ruby_to_ko(cl))
        except Exception:
            degraded = True
            parts.append(_tolerant(cl))
    return ' '.join(p for p in parts if p), degraded


def _ascii_bad(v):
    return (',' in v) or ('\n' in v) or ('\r' in v)


def check_ruby(tag, field, val, errs):
    try:
        base, rl, recon = iv.ruby_to_json(val)
        return base
    except Exception as e:
        errs.append('%s %s 루비 변환 실패: %s' % (tag, field, e))
        return None


def main(path):
    rows = list(csv.DictReader(io.open(path, encoding='utf-8-sig')))
    errs, warns, keys = [], [], set()
    for i, r in enumerate(rows, 1):
        ck = r['content_key']
        tag = '[%d %s]' % (i, ck)
        # 필수
        for col in ('content_key', 'level_code', 'genre', 'passage_ja', 'passage_ko',
                    'question', 'choice1', 'choice2', 'answer', 'explanation_ko'):
            if not (r.get(col) or '').strip():
                errs.append('%s 필수 누락: %s' % (tag, col))
        # 키 유일
        if ck in keys:
            errs.append('%s content_key 중복' % tag)
        keys.add(ck)
        # ASCII 쉼표/줄바꿈
        for col in HEADER:
            v = r.get(col) or ''
            if _ascii_bad(v):
                errs.append('%s ASCII 쉼표/줄바꿈: %s' % (tag, col))
        # 루비 검증(지문·문항·선택지)
        check_ruby(tag, 'passage_ja', r['passage_ja'], errs)
        check_ruby(tag, 'question', r['question'], errs)
        choices = []
        for c in ('choice1', 'choice2', 'choice3', 'choice4'):
            v = (r.get(c) or '').strip()
            if v and v != '-':
                base = check_ruby(tag, c, v, errs)
                choices.append(base if base is not None else v)
        # 문항 정합
        try:
            ans = int((r.get('answer') or '').strip())
            if not (1 <= ans <= len(choices)):
                errs.append('%s answer(%d) 가 선택지 범위(1~%d) 밖' % (tag, ans, len(choices)))
        except Exception:
            errs.append('%s answer 정수 아님: %r' % (tag, r.get('answer')))
        if len(choices) != len(set(choices)):
            errs.append('%s 선택지 중복: %s' % (tag, choices))
        # romaji 생성(크래시 확인) + 문장 분리 정합
        ja_s = split_ja(r['passage_ja'])
        ko_s = split_ko(r['passage_ko'])
        if len(ja_s) != len(ko_s):
            warns.append('%s 문장수 불일치 ja %d ≠ ko %d (load 폴백)' % (tag, len(ja_s), len(ko_s)))
        for s in ja_s:
            _, deg = gen_romaji_ko(s)
            if deg:
                warns.append('%s romaji 폴백(외래어 추정): %r' % (tag, strip_brackets(s)[:16]))
            plain = strip_brackets(s)
            if len(plain) > 60:
                warns.append('%s 문장 60자 초과(%d): %r' % (tag, len(plain), plain[:20]))

    print('=' * 64)
    print('독해 검수: %s · 총 %d행' % (os.path.basename(path), len(rows)))
    print('오류 %d건 · 경고 %d건' % (len(errs), len(warns)))
    for e in errs[:80]:
        print('  ERR ', e)
    for w in warns[:40]:
        print('  WARN', w)
    if len(warns) > 40:
        print('  … 경고 외 %d건' % (len(warns) - 40))
    return len(errs)


if __name__ == '__main__':
    p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(JLPT, 'N5_독해_20.csv')
    if not os.path.isabs(p):
        p = os.path.join(PROJ, p)
    sys.exit(1 if main(p) else 0)
