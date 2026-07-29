# -*- coding: utf-8 -*-
"""
import_vocab.py — 단어 CSV(규격 4.1, 17열)를 vocab_items 스키마에 넣는 임포터.

이 스크립트가 하는 일 (규격은 지금까지 "손 안 대고 들어간다"고 말로만 했다. 처음으로 실제로 넣어본다):
  1. CSV 17열을 읽는다 (UTF-8 BOM 제거).
  2. 🔴 ruby 브래킷 표기 → 좌표 JSON 변환 (규격 3.1). = vocab_items.ruby(jsonb)에 들어갈 값.
  3. 규격 6.1 기계검사: base==headword / 읽기이음==reading / romaji_ko 역생성 일치 / 코드표 / 필수칸.
     · romaji_ko 역생성은 리서치팀 참조구현 kana_to_ko.ruby_to_ko 를 재사용한다.
  4. schema.sql 의 vocab 부분을 SQLite로 옮겨 실제로 400건을 INSERT → "정말 들어가는가"를 증명.
  5. 한 건이라도 실패하면 원인을 [CSV] / [스키마] / [규격] 중 무엇인지 판정해 보고한다.

실행:
  python import_vocab.py                      # 기본: N5_단어_400.csv, dry-run + SQLite 검증
  python import_vocab.py 리서치/02_JLPT/N4_단어_400.csv
  python import_vocab.py --all                # 02_JLPT 전 단어 CSV
  python import_vocab.py --no-sqlite          # 파싱·검증만(메모리 dry-run)

Windows cp949 콘솔 방어.
"""
import sys, os, io, csv, json, re, sqlite3, glob

# 🔴 Windows 콘솔은 cp949 → 유니코드 출력에서 죽는다.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# --- 경로 ---------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(os.path.join(HERE, '..', '..'))          # japanese-study-app/ (프로젝트 루트)
TOOLS = os.path.join(PROJ, '리서치', '도구')
DEFAULT_CSV = os.path.join(PROJ, '리서치', '02_JLPT', 'N5_단어_400.csv')

# --- 리서치팀 참조구현 재사용 (규격 6.1-6) -----------------------------------
# ruby → romaji_ko(한글발음) 역생성기. WORD_EXCEPTIONS(조사 は·복합어 경계)까지 포함.
sys.path.insert(0, TOOLS)
try:
    import kana_to_ko
except Exception as e:
    print('kana_to_ko 임포트 실패 (%s에 있어야 함): %s' % (TOOLS, e))
    sys.exit(2)

# --- 코드표 (규격 4.1 / 6.1-7) ------------------------------------------------
POS = {'noun','verb','i_adj','na_adj','adv','conj','pron','counter',
       'prefix','suffix','interj','expr'}
CONJ = {'g1','g2','g3_suru','g3_kuru','suru_noun','i_adj','na_adj','-'}
TRANS = {'vi','vt','vi_vt','-'}
VERIFY = {'draft','team','native'}

HEADER = ['content_key','level_code','headword','reading','ruby','romaji_ko','pos',
          'conj_type','transitivity','meaning_ko','meaning_ko_alt','example_ja',
          'example_ko','audio_file','source','verify','note']

# 브래킷 토큰 {표기|읽기|읽기…}
TOKEN = re.compile(r'\{([^|{}]+)((?:\|[^|{}]*)+)\}')


# =============================================================================
# 🔴 규격 3.1 — ruby 브래킷 → 좌표 JSON 변환
# =============================================================================
def ruby_to_json(ruby):
    """브래킷 표기 -> {"base":..., "ruby":[{"s","e","rt"}]} + 재구성 reading.

    좌표 s/e = 코드포인트 기준 인덱스(0-based, 끝 미포함). Python str은 코드포인트
    단위라 서로게이트 페어 한자(𠮟)도 1글자로 세어진다(규격 3.1 UTF-16 주의).

    규칙:
      · {}밖 순가나 → base에 그대로, 루비 없음
      · {표기|읽기}         읽기 1개  → 표기 전체에 그룹 루비 1개
      · {표기|읽기1|…|읽기N} 읽기 N개=표기 글자수 → 글자별 모노 루비
      · 그 외 → ValueError (조용히 넘어가지 않는다, 규격 3.1-4)
    반환: (base, ruby_list, reading_recon)
    """
    base_parts, ruby_list, reading_parts = [], [], []
    base_len = 0
    pos = 0
    for m in TOKEN.finditer(ruby):
        # 브래킷 앞 순가나
        plain = ruby[pos:m.start()]
        if plain:
            base_parts.append(plain)
            reading_parts.append(plain)
            base_len += len(plain)
        surface = m.group(1)                       # 표기
        readings = m.group(2).split('|')[1:]       # 읽기들
        n_s = len(surface)
        n_r = len(readings)
        start = base_len
        base_parts.append(surface)
        reading_parts.append(''.join(readings))
        base_len += n_s
        if n_r == 1:                               # 그룹 루비
            ruby_list.append({'s': start, 'e': start + n_s, 'rt': readings[0]})
        elif n_r == n_s:                           # 글자별 모노 루비
            for i, rt in enumerate(readings):
                ruby_list.append({'s': start + i, 'e': start + i + 1, 'rt': rt})
        else:
            raise ValueError('읽기 개수(%d)가 표기 글자수(%d)와 안 맞음: %s'
                             % (n_r, n_s, m.group(0)))
        pos = m.end()
    tail = ruby[pos:]
    if tail:
        base_parts.append(tail)
        reading_parts.append(tail)
    base = ''.join(base_parts)
    return base, ruby_list, ''.join(reading_parts)


# =============================================================================
# 행 검증 + 매핑 (규격 6.1). 실패 시 (원인계층, 메시지) 리스트 반환.
# =============================================================================
def validate_and_map(row):
    """CSV 한 행 -> (mapped_dict, errors). errors=[] 면 통과.
    원인계층: 'CSV'(값 오류) / '스키마'(컬럼 부족) / '규격'(규칙 자체 문제)."""
    errs = []
    key = row.get('content_key', '').strip()

    # (0) 필수칸 (규격 6.1-8) — 빈 값은 '-'여야 함
    for col in ['content_key','level_code','headword','reading','ruby','romaji_ko',
                'pos','conj_type','transitivity','meaning_ko','source','verify']:
        if row.get(col, '') == '':
            errs.append(('CSV', '필수칸 비어있음: %s' % col))

    # (0-b) 필드 안 쉼표·줄바꿈 (규격 6.1-9) — csv 파서가 이미 나눴으니 줄바꿈만 체크
    for col, v in row.items():
        if v and '\n' in v:
            errs.append(('CSV', '필드 안 줄바꿈: %s' % col))

    # (1) ruby 브래킷 → 좌표 JSON (규격 3.1)
    base = ruby_json = reading_recon = None
    try:
        base, ruby_json, reading_recon = ruby_to_json(row['ruby'])
    except Exception as e:
        errs.append(('CSV', 'ruby 변환 실패: %s' % e))

    # (2) base == headword (규격 6.1-2)
    if base is not None and base != row['headword']:
        errs.append(('CSV', 'ruby에서 {}벗긴 base(%r) != headword(%r)' % (base, row['headword'])))

    # (3) 읽기이음 == reading (규격 6.1-3)
    if reading_recon is not None and reading_recon != row['reading']:
        errs.append(('CSV', 'ruby 읽기이음(%r) != reading(%r)' % (reading_recon, row['reading'])))

    # (6) romaji_ko 역생성 일치 (규격 6.1-6) — 가장 강한 검사
    try:
        gen = kana_to_ko.ruby_to_ko(row['ruby'])
        if gen != row['romaji_ko']:
            errs.append(('CSV', 'romaji_ko 역생성(%r) != 표기(%r)' % (gen, row['romaji_ko'])))
    except Exception as e:
        errs.append(('CSV', 'romaji_ko 역생성 실패: %s' % e))

    # (7) 코드표 (규격 6.1-7)
    if row.get('pos') not in POS:
        errs.append(('CSV', 'pos 코드밖: %r' % row.get('pos')))
    if row.get('conj_type') not in CONJ:
        errs.append(('CSV', 'conj_type 코드밖: %r' % row.get('conj_type')))
    if row.get('transitivity') not in TRANS:
        errs.append(('CSV', 'transitivity 코드밖: %r' % row.get('transitivity')))
    if row.get('verify') not in VERIFY:
        errs.append(('CSV', 'verify 코드밖: %r' % row.get('verify')))

    # 매핑 — CSV 17열 → vocab_items 컬럼 ('-'는 null로)
    def nn(v):  # '-' 또는 '' → None
        v = (v or '').strip()
        return None if v in ('', '-') else v

    example_ruby = None
    if nn(row.get('example_ja')):
        try:
            _, example_ruby, _ = ruby_to_json(row['example_ja'])
        except Exception:
            example_ruby = None    # 예문 루비 실패는 치명적 아님(본 단어가 아님)

    mapped = {
        'content_key':    key,
        'level_code':     row['level_code'],          # → course_level_id 매핑
        'headword':       row['headword'],
        'reading':        row['reading'],
        'ruby':           json.dumps({'base': base or row['headword'],
                                       'ruby': ruby_json or []}, ensure_ascii=False),
        'romaji_ko':      row['romaji_ko'],
        'pos':            row['pos'],
        'conj_type':      row['conj_type'],
        'transitivity':   row['transitivity'],
        'meaning_ko':     row['meaning_ko'],
        'meaning_ko_alt': nn(row.get('meaning_ko_alt')),
        'example_ja':     nn(row.get('example_ja')),
        'example_ruby':   json.dumps(example_ruby, ensure_ascii=False) if example_ruby else None,
        'example_ko':     nn(row.get('example_ko')),
        'audio_url':      nn(row.get('audio_file')),
        'source':         row['source'],
        'verify':         row['verify'],
        'note':           nn(row.get('note')),
    }
    return mapped, errs


# =============================================================================
# SQLite 실임포트 — schema.sql 의 vocab 부분을 옮겨 실제로 INSERT
# =============================================================================
SQLITE_DDL = """
create table course_levels (
  id integer primary key,
  course_id integer,
  code text not null,
  label text,
  is_published integer not null default 0,
  unique(code)
);
create table vocab_items (
  id integer primary key autoincrement,
  content_key text unique not null,
  course_level_id integer not null references course_levels(id),
  headword text not null,
  reading text not null,
  ruby text not null,                 -- SQLite엔 jsonb 없음 → text(JSON). PG에선 jsonb
  romaji_ko text not null,
  pos text not null,
  conj_type text not null default '-',
  transitivity text not null default '-',
  meaning_ko text not null,
  meaning_ko_alt text,
  example_ja text,
  example_ruby text,
  example_ko text,
  audio_url text,
  source text not null,
  license text,
  verify text not null default 'draft',
  is_published integer not null default 0,
  note text,
  check (pos in ('noun','verb','i_adj','na_adj','adv','conj','pron','counter',
                 'prefix','suffix','interj','expr')),
  check (conj_type in ('g1','g2','g3_suru','g3_kuru','suru_noun','i_adj','na_adj','-')),
  check (transitivity in ('vi','vt','vi_vt','-')),
  check (verify in ('draft','team','native'))
);
"""

def sqlite_import(mapped_rows):
    """실제로 400건이 INSERT 되는지 SQLite로 증명. (반환: 성공수, 오류리스트)"""
    con = sqlite3.connect(':memory:')
    con.execute('pragma foreign_keys=on')
    con.executescript(SQLITE_DDL)
    # 등장한 level_code 마다 course_levels 행 생성 → uuid 대신 정수 id 매핑
    level_ids = {}
    for m in mapped_rows:
        lc = m['level_code']
        if lc not in level_ids:
            cur = con.execute('insert into course_levels(code,label) values(?,?)', (lc, lc))
            level_ids[lc] = cur.lastrowid
    ok, errs = 0, []
    for m in mapped_rows:
        try:
            con.execute("""insert into vocab_items
              (content_key,course_level_id,headword,reading,ruby,romaji_ko,pos,
               conj_type,transitivity,meaning_ko,meaning_ko_alt,example_ja,
               example_ruby,example_ko,audio_url,source,verify,note)
              values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (m['content_key'], level_ids[m['level_code']], m['headword'], m['reading'],
               m['ruby'], m['romaji_ko'], m['pos'], m['conj_type'], m['transitivity'],
               m['meaning_ko'], m['meaning_ko_alt'], m['example_ja'], m['example_ruby'],
               m['example_ko'], m['audio_url'], m['source'], m['verify'], m['note']))
            ok += 1
        except Exception as e:
            errs.append(('스키마', '%s INSERT 거절: %s' % (m['content_key'], e)))
    con.commit()
    # 실제 저장 확인 + ruby JSON 이 유효 JSON 인지 되읽어 검증
    n_db = con.execute('select count(*) from vocab_items').fetchone()[0]
    bad_json = 0
    for (ck, rj) in con.execute('select content_key, ruby from vocab_items'):
        try:
            json.loads(rj)
        except Exception:
            bad_json += 1
            errs.append(('스키마', '%s ruby JSON 파싱불가' % ck))
    con.close()
    return ok, n_db, bad_json, errs


# =============================================================================
def run(path, use_sqlite=True):
    name = os.path.basename(path)
    print('=' * 70)
    print('임포트 대상: %s' % name)
    print('=' * 70)
    with io.open(path, encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        got_header = reader.fieldnames
        rows = list(reader)

    # 헤더 확인
    if got_header != HEADER:
        print('⚠ 헤더 불일치')
        print('  기대: %s' % ','.join(HEADER))
        print('  실제: %s' % ','.join(got_header or []))
    else:
        print('헤더 17열 일치 ✅')
    print('총 %d행' % len(rows))

    mapped_rows, fail = [], []
    seen_keys = set()
    for i, row in enumerate(rows, start=2):   # CSV 2행부터 데이터
        m, errs = validate_and_map(row)
        # content_key 유일성 (규격 6.1-1)
        if m['content_key'] in seen_keys:
            errs.append(('CSV', 'content_key 중복: %s' % m['content_key']))
        seen_keys.add(m['content_key'])
        if errs:
            fail.append((i, m['content_key'], errs))
        else:
            mapped_rows.append(m)

    print('-' * 70)
    print('검증 통과: %d / %d' % (len(mapped_rows), len(rows)))
    if fail:
        # 원인계층 집계
        by_layer = {'CSV': 0, '스키마': 0, '규격': 0}
        for _, _, errs in fail:
            for layer, _msg in errs:
                by_layer[layer] = by_layer.get(layer, 0) + 1
        print('실패: %d행  (원인: CSV %d · 스키마 %d · 규격 %d)'
              % (len(fail), by_layer['CSV'], by_layer['스키마'], by_layer['규격']))
        for i, ck, errs in fail[:40]:
            for layer, msg in errs:
                print('  [%s] %d행 %s: %s' % (layer, i, ck, msg))
        if len(fail) > 40:
            print('  … 외 %d행' % (len(fail) - 40))

    # 실임포트 (SQLite) — 통과분만
    if use_sqlite and mapped_rows:
        ok, n_db, bad_json, serrs = sqlite_import(mapped_rows)
        print('-' * 70)
        print('SQLite 실임포트: INSERT 성공 %d / 검증통과 %d / DB 실제행 %d'
              % (ok, len(mapped_rows), n_db))
        print('ruby JSON 되읽기 검증: 파손 %d건' % bad_json)
        for layer, msg in serrs[:20]:
            print('  [%s] %s' % (layer, msg))

    # 샘플: 루비 좌표 변환 결과 몇 개
    print('-' * 70)
    print('루비 좌표 변환 샘플:')
    shown = 0
    for m in mapped_rows:
        rj = json.loads(m['ruby'])
        if rj['ruby'] and shown < 6:
            print('  %s  %s' % (m['headword'], json.dumps(rj, ensure_ascii=False)))
            shown += 1
    return len(mapped_rows), len(rows), len(fail)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = set(a for a in sys.argv[1:] if a.startswith('--'))
    use_sqlite = '--no-sqlite' not in flags

    if '--all' in flags:
        paths = sorted(glob.glob(os.path.join(PROJ, '리서치', '02_JLPT', '*단어*.csv')))
    elif args:
        paths = [args[0] if os.path.isabs(args[0]) else os.path.join(PROJ, args[0])]
    else:
        paths = [DEFAULT_CSV]

    grand_ok = grand_total = grand_fail = 0
    for p in paths:
        ok, total, nfail = run(p, use_sqlite)
        grand_ok += ok; grand_total += total; grand_fail += nfail
        print()
    if len(paths) > 1:
        print('=' * 70)
        print('전체 합계: 통과 %d / %d  (실패 %d)' % (grand_ok, grand_total, grand_fail))
    sys.exit(1 if grand_fail else 0)
