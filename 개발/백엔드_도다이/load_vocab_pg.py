# -*- coding: utf-8 -*-
"""
load_vocab_pg.py — 단어 CSV를 Supabase(PostgreSQL) vocab_items 에 직접 UPSERT.

· import_vocab.validate_and_map 를 재사용(검증된 루비 좌표 변환).
· DB 접속은 환경변수 SUPABASE_DB_URL 에서만 읽는다(비밀번호가 로그·컨텍스트에 안 남음).
· on conflict(content_key) do nothing → 재실행 안전(이미 넣은 40건은 건너뜀).
· is_published 는 손대지 않음(기본 false = 미공개). license 는 null.

실행:
  set  SUPABASE_DB_URL=postgresql://...   (또는 setx 후 새 셸)
  python load_vocab_pg.py                 # N5~N2 전량
  python load_vocab_pg.py N5 N4           # 특정 급수만
"""
import os, sys, io, csv, json, glob

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(os.path.join(HERE, '..', '..'))
JLPT = os.path.join(PROJ, '리서치', '02_JLPT')
sys.path.insert(0, HERE)
import import_vocab as iv

DB = os.environ.get('SUPABASE_DB_URL')
if not DB:
    # 폴백: 같은 폴더의 db_url.txt (또는 .db_url) 한 줄. 🔴 비밀번호 포함 — 커밋 금지.
    for fn in ('db_url.txt', '.db_url'):
        p = os.path.join(HERE, fn)
        if os.path.exists(p):
            with io.open(p, encoding='utf-8-sig') as f:
                DB = f.read().strip()
            if DB:
                break
if not DB:
    print('❌ 연결문자열이 없습니다. 아래 중 하나:')
    print('   · 환경변수 SUPABASE_DB_URL 설정, 또는')
    print('   · %s 에 연결문자열 한 줄 저장' % os.path.join(HERE, 'db_url.txt'))
    sys.exit(2)

# psycopg v3 우선, 없으면 psycopg2
try:
    import psycopg
    connect = lambda: psycopg.connect(DB)
    DRIVER = 'psycopg3'
except ImportError:
    try:
        import psycopg2
        connect = lambda: psycopg2.connect(DB)
        DRIVER = 'psycopg2'
    except ImportError:
        print('❌ psycopg 미설치.  pip install "psycopg[binary]"  (또는 psycopg2-binary)')
        sys.exit(3)

LEVELS = [a.upper() for a in sys.argv[1:]] or ['N5', 'N4', 'N3', 'N2']
FILES = {'N5': 'N5_단어_400.csv', 'N4': 'N4_단어_400.csv',
         'N3': 'N3_단어_400.csv', 'N2': 'N2_단어_400.csv'}

INSERT = """insert into vocab_items
 (content_key,course_level_id,headword,reading,ruby,romaji_ko,pos,conj_type,transitivity,
  meaning_ko,meaning_ko_alt,example_ja,example_ruby,example_ko,audio_url,source,verify,note)
 values (%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s)
 on conflict (content_key) do nothing"""

print('드라이버: %s' % DRIVER)
conn = connect()
conn.autocommit = False
cur = conn.cursor()

# 급수 code → uuid
cur.execute("select cl.code, cl.id from course_levels cl "
            "join courses c on c.id=cl.course_id where c.code='jlpt'")
lvl = {code: str(cid) for code, cid in cur.fetchall()}
print('급수 매핑: %s' % ', '.join('%s→%s' % (k, v[:8]) for k, v in lvl.items()))

grand_ok = grand_fail = 0
for lc in LEVELS:
    path = os.path.join(JLPT, FILES[lc])
    with io.open(path, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    params, fails = [], 0
    for row in rows:
        m, errs = iv.validate_and_map(row)
        if errs:
            fails += 1
            sys.stderr.write('SKIP %s %s\n' % (m['content_key'], errs[:1]))
            continue
        params.append((m['content_key'], lvl[m['level_code']], m['headword'], m['reading'],
                       m['ruby'], m['romaji_ko'], m['pos'], m['conj_type'], m['transitivity'],
                       m['meaning_ko'], m['meaning_ko_alt'], m['example_ja'], m['example_ruby'],
                       m['example_ko'], m['audio_url'], m['source'], m['verify'], m['note']))
    cur.executemany(INSERT, params)
    conn.commit()
    grand_ok += len(params); grand_fail += fails
    print('  %s: 검증통과 %d / %d  (실패 %d)' % (lc, len(params), len(rows), fails))

# 검증
cur.execute("select count(*), count(*) filter (where jsonb_array_length(ruby->'ruby')>0) from vocab_items")
tot, withruby = cur.fetchone()
cur.execute("select code, count(*) from vocab_items v "
            "join course_levels cl on cl.id=v.course_level_id group by code order by code")
by_level = cur.fetchall()
conn.close()

print('-' * 60)
print('임포트 완료: 통과 %d / 실패 %d' % (grand_ok, grand_fail))
print('DB 총 vocab_items: %d  (한자 루비 있는 것 %d)' % (tot, withruby))
print('급수별: %s' % ', '.join('%s=%d' % (c, n) for c, n in by_level))
sys.exit(1 if grand_fail else 0)
