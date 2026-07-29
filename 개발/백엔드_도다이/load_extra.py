# -*- coding: utf-8 -*-
"""load_extra.py — N1 신규 + 하위재분류 추가분을 vocab_items 에 UPSERT.

load_vocab_pg.py 와 동일 로직(import_vocab.validate_and_map · on conflict do nothing).
파일명이 표준(N{급수}_단어_400.csv)과 달라 별도 드라이버로 처리한다.
접속문자열은 db_url.txt/env 에서만 읽고 **절대 출력하지 않는다.**
level_code 는 각 CSV 행에 들어 있어 파일별 급수 지정이 필요 없다.

실행: python load_extra.py
"""
import os, sys, io, csv

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
    for fn in ('db_url.txt', '.db_url'):
        p = os.path.join(HERE, fn)
        if os.path.exists(p):
            with io.open(p, encoding='utf-8-sig') as f:
                DB = f.read().strip()
            if DB:
                break
if not DB:
    print('❌ 연결문자열 없음 (env SUPABASE_DB_URL 또는 db_url.txt)')
    sys.exit(2)

import psycopg

FILES = [
    'N1_단어_390.csv',
    'N2_추가_편중도재분류_2026-07-27.csv',
    'N3_추가_편중도재분류_2026-07-27.csv',
    'N5_추가_편중도재분류_2026-07-27.csv',
]

INSERT = """insert into vocab_items
 (content_key,course_level_id,headword,reading,ruby,romaji_ko,pos,conj_type,transitivity,
  meaning_ko,meaning_ko_alt,example_ja,example_ruby,example_ko,audio_url,source,verify,note)
 values (%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s)
 on conflict (content_key) do nothing"""

conn = psycopg.connect(DB)
conn.autocommit = False
cur = conn.cursor()
cur.execute("select cl.code, cl.id from course_levels cl "
            "join courses c on c.id=cl.course_id where c.code='jlpt'")
lvl = {code: str(cid) for code, cid in cur.fetchall()}
print('급수 매핑 로드: %s' % ', '.join(sorted(lvl)))

grand_ok = grand_fail = 0
for fn in FILES:
    path = os.path.join(JLPT, fn)
    if not os.path.exists(path):
        print('  ❌ 파일 없음: %s' % fn); continue
    with io.open(path, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    params, fails = [], 0
    for row in rows:
        m, errs = iv.validate_and_map(row)
        if errs:
            fails += 1
            sys.stderr.write('SKIP %s %s\n' % (m.get('content_key'), errs[:1]))
            continue
        params.append((m['content_key'], lvl[m['level_code']], m['headword'], m['reading'],
                       m['ruby'], m['romaji_ko'], m['pos'], m['conj_type'], m['transitivity'],
                       m['meaning_ko'], m['meaning_ko_alt'], m['example_ja'], m['example_ruby'],
                       m['example_ko'], m['audio_url'], m['source'], m['verify'], m['note']))
    before = cur.rowcount
    cur.executemany(INSERT, params)
    conn.commit()
    grand_ok += len(params); grand_fail += fails
    print('  %s: 검증통과 %d / %d (실패 %d)' % (fn, len(params), len(rows), fails))

cur.execute("select cl.code, count(*) from vocab_items v "
            "join course_levels cl on cl.id=v.course_level_id group by cl.code order by cl.code")
by_level = cur.fetchall()
cur.execute("select count(*) from vocab_items")
tot = cur.fetchone()[0]
conn.close()
print('-' * 60)
print('임포트: 통과 %d / 실패 %d' % (grand_ok, grand_fail))
print('DB 총 vocab_items: %d' % tot)
print('급수별: %s' % ', '.join('%s=%d' % (c, n) for c, n in by_level))
sys.exit(1 if grand_fail else 0)
