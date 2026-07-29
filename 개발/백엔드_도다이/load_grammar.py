# -*- coding: utf-8 -*-
"""load_grammar.py — N5 문법 48항목을 grammar_items 에 UPSERT.

 · import_vocab.ruby_to_json 재사용(브래킷 → jsonb 좌표, 규격 3.1).
 · pattern_ruby·example_ruby(CSV의 브래킷 표기) → jsonb 좌표로 변환해 넣는다.
 · level_code(N5) → course_level_id(jlpt) 매핑.
 · is_published=false 로 넣는다. **공개는 별도 마이그레이션으로 플립**(미공개≠잠금).
 · 🔴 접속문자열은 db_url.txt/env 에서만 읽고 절대 출력하지 않는다.

실행: python load_grammar.py
"""
import os, sys, io, csv, json

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

# 인자로 파일명(02_JLPT 기준) 지정 가능. 기본 N5. level_code는 각 행에서 읽어 급수 매핑.
CSV_NAME = sys.argv[1] if len(sys.argv) > 1 else 'N5_문법_48_filled.csv'
CSV_PATH = CSV_NAME if os.path.isabs(CSV_NAME) else os.path.join(JLPT, CSV_NAME)

def dash(v):
    v = (v or '').strip()
    return None if v in ('', '-') else v

def ruby_json(bracket):
    bracket = (bracket or '').strip()
    if not bracket or bracket == '-':
        return None
    base, rl, _ = iv.ruby_to_json(bracket)
    return json.dumps({'base': base, 'ruby': rl}, ensure_ascii=False)

INSERT = """insert into grammar_items
 (content_key,course_level_id,pattern,pattern_ruby,connection,romaji_ko,meaning_ko,usage_note,
  politeness,example_ja,example_ruby,example_ko,source,license,verify,is_published,note)
 values (%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s)
 on conflict (content_key) do nothing"""

conn = psycopg.connect(DB)
conn.autocommit = False
cur = conn.cursor()
cur.execute("select cl.code, cl.id from course_levels cl join courses c on c.id=cl.course_id "
            "where c.code='jlpt'")
lvl = {code: str(cid) for code, cid in cur.fetchall()}

rows = list(csv.DictReader(io.open(CSV_PATH, encoding='utf-8-sig')))
params, fails = [], 0
for r in rows:
    try:
        pr = ruby_json(r['pattern_ruby'])
        er = ruby_json(r['example_ruby'])
    except Exception as e:
        fails += 1
        sys.stderr.write('SKIP %s %s\n' % (r.get('content_key'), e))
        continue
    params.append((r['content_key'], lvl[r['level_code']], r['pattern'], pr, dash(r['connection']),
                   dash(r['romaji_ko']), r['meaning_ko'], dash(r['usage_note']),
                   dash(r['politeness']), dash(r['example_ja']), er, dash(r['example_ko']),
                   r['source'], None, r['verify'], False, dash(r['note'])))

cur.executemany(INSERT, params)
conn.commit()
cur.execute("select count(*) from grammar_items")
tot = cur.fetchone()[0]
cur.execute("select count(*) from grammar_items where is_published")
pub = cur.fetchone()[0]
conn.close()
print('-' * 60)
print('임포트 통과 %d / %d (실패 %d)' % (len(params), len(rows), fails))
print('DB grammar_items 총 %d · 공개 %d (임포트는 미공개로 — 공개는 마이그레이션)' % (tot, pub))
sys.exit(1 if fails else 0)
