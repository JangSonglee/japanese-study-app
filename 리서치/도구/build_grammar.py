# -*- coding: utf-8 -*-
"""문법(grammar_items) 배치 검수 기계 — 단어 build_n2 QA 로직의 문법판.

하는 일 (규격 4.2 / 문법_방법론 §7):
 · 루비 브래킷 검증: strip(pattern_ruby)==pattern, strip(example_ruby)==example_ja
 · 한글 발음 기계 생성: romaji_ko = ruby_to_ko(pattern_ruby에서 〜…/ 등 플레이스홀더 제거)
   → CSV의 romaji_ko가 '-'거나 불일치면 채워/교정하고 리포트
 · content_key 유일 · 동일 급수 pattern 중복 · politeness enum · connection/meaning 필수
 · 출력: 검수 리포트 + romaji_ko 채운 `*_filled.csv`

🔴 예문 어휘 급수 제약(방법론 §4.1)은 형태소 분석이 필요해 여기서 자동화하지 않는다
   (기계가 후보 좁히고 사람 판정 — 규격 3.2.5-2와 같은 원칙). 예문은 대표님 QA에서 본다.

사용: python build_grammar.py N5_문법_파일럿.csv
"""
import csv, io, re, sys, importlib.util, os

HERE = os.path.dirname(os.path.abspath(__file__))

def _load(mod, path):
    s = importlib.util.spec_from_file_location(mod, os.path.join(HERE, path))
    m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m

k2k = _load('kana_to_ko', 'kana_to_ko.py')

HEADER = ['content_key','level_code','pattern','pattern_ruby','romaji_ko','connection',
          'meaning_ko','usage_note','example_ja','example_ko','example_ruby',
          'politeness','source','verify','note']
POLITE = {'casual','polite','humble','honorific','-'}
BRACKET = re.compile(r'\{([^|}]*)\|[^}]*\}')
PLACEHOLDER = re.compile(r'[〜～…・／/（）()　\s]')   # 문형 자리표시(물결·삼점·슬래시·괄호·공백)

def strip_ruby(s):
    """{漢字|よみ} -> 漢字, 나머지는 그대로."""
    return BRACKET.sub(lambda m: m.group(1), s)

def gen_romaji(pattern_ruby):
    """패턴의 한글 발음 기계 생성 — 플레이스홀더(〜…/) 제거 후 ruby_to_ko."""
    cleaned = PLACEHOLDER.sub('', pattern_ruby)
    if not cleaned:
        return '-'
    return k2k.ruby_to_ko(cleaned)

def main(path):
    rows = list(csv.DictReader(io.open(path, encoding='utf-8-sig')))
    errs, warns, keys, per_level = [], [], set(), {}
    for i, r in enumerate(rows, 1):
        ck = r['content_key']
        tag = f'[{i} {ck}]'
        # 필수
        for col in ('content_key','level_code','pattern','pattern_ruby','connection','meaning_ko','politeness','source','verify'):
            if not (r.get(col) or '').strip():
                errs.append(f'{tag} 필수 누락: {col}')
        # 키 유일
        if ck in keys: errs.append(f'{tag} content_key 중복')
        keys.add(ck)
        # 급수 내 pattern 중복
        lv = r['level_code']; per_level.setdefault(lv, {})
        if r['pattern'] in per_level[lv]:
            # 동음이의 문형(そうです 전문/양태 등)은 정당 — 경고만. content_key는 유일해 임포트 무해.
            warns.append(f'{tag} 동일 급수 pattern 동음이의(확인): {r["pattern"]}')
        per_level[lv][r['pattern']] = ck
        # 루비 검증 (pattern)
        if strip_ruby(r['pattern_ruby']) != r['pattern']:
            errs.append(f'{tag} pattern_ruby strip != pattern: {strip_ruby(r["pattern_ruby"])!r} vs {r["pattern"]!r}')
        # 루비 검증 (example)
        ej, er = (r.get('example_ja') or '').strip(), (r.get('example_ruby') or '').strip()
        if ej and ej != '-' and er and er != '-':
            if strip_ruby(er) != ej:
                errs.append(f'{tag} example_ruby strip != example_ja')
        # politeness enum
        if r['politeness'] not in POLITE:
            errs.append(f'{tag} politeness enum 밖: {r["politeness"]}')
        # 한글 발음 기계 생성/교정
        try:
            want = gen_romaji(r['pattern_ruby'])
        except Exception as e:
            errs.append(f'{tag} romaji 생성 실패: {e}'); want = r.get('romaji_ko','')
        if (r.get('romaji_ko') or '').strip() not in (want, '', '-') and r['romaji_ko'] != want:
            errs.append(f'{tag} romaji_ko 불일치: 파일 {r["romaji_ko"]!r} ≠ 생성 {want!r}')
        r['romaji_ko'] = want   # 기계값으로 채움/교정

    # 출력
    outp = path.replace('.csv', '_filled.csv')
    w = csv.DictWriter(io.open(outp, 'w', encoding='utf-8-sig', newline=''), fieldnames=HEADER)
    w.writeheader()
    for r in rows: w.writerow({h: r.get(h, '') for h in HEADER})

    print(f'행 {len(rows)} · 급수별 ' + ' · '.join(f'{lv} {len(p)}' for lv, p in per_level.items()))
    print(f'검수 오류 {len(errs)}건 · 경고 {len(warns)}건')
    for e in errs[:60]: print('  ERR', e)
    for wmsg in warns[:20]: print('  WARN', wmsg)
    print('출력:', os.path.basename(outp))
    return len(errs)

if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1]) else 0)
