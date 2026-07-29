# -*- coding: utf-8 -*-
"""load_reading.py — N5 독해 flat CSV → 정규화 테이블 임포트(미공개).

 · reading_texts 1 : reading_sentences N : questions 1 : question_choices N
 · 변환 로직(문장분리·루비·romaji)은 리서치/도구/build_reading.py 재사용(단일 출처).
 · load_grammar.py 구조 본뜸: db_url.txt/env 내부 접속, is_published=false, 트랜잭션.
 · 🔴 접속문자열은 절대 출력·로그 금지. 공개(is_published=true)는 하지 않는다(오케스트레이터 몫).
 · 재실행 안전: 부모 ON CONFLICT(content_key) DO NOTHING + RETURNING/SELECT id,
   자식은 부모 id 기준 delete 후 재insert.

실행: python load_reading.py
"""
import os, sys, io, csv, json, importlib.util

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(os.path.join(HERE, '..', '..'))
TOOLS = os.path.join(PROJ, '리서치', '도구')
JLPT = os.path.join(PROJ, '리서치', '02_JLPT')


def _load(mod, path):
    s = importlib.util.spec_from_file_location(mod, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m

br = _load('build_reading', os.path.join(TOOLS, 'build_reading.py'))

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

# 급수 범용화: python load_reading.py [급수] [csv경로]  (기본 N5 / JLPT/{급수}_독해_20.csv)
LEVEL = (sys.argv[1] if len(sys.argv) > 1 else 'N5').upper()
CSV_PATH = sys.argv[2] if len(sys.argv) > 2 else os.path.join(JLPT, '%s_독해_20.csv' % LEVEL)

conn = psycopg.connect(DB)
conn.autocommit = False
cur = conn.cursor()

fallback_keys = []
try:
    cur.execute("select cl.id from course_levels cl join courses c on c.id=cl.course_id "
                "where c.code='jlpt' and cl.code=%s", (LEVEL,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError('course_levels(jlpt/%s) 없음' % LEVEL)
    level_id = row[0]

    rows = list(csv.DictReader(io.open(CSV_PATH, encoding='utf-8-sig')))
    n_text = n_sent = n_q = n_ch = 0

    for r in rows:
        ck = r['content_key']
        genre = r['genre']
        # ── reading_texts ──────────────────────────────────────────────
        cur.execute(
            """insert into reading_texts
               (content_key,course_level_id,title,has_memo,est_minutes,source,verify,is_published,note)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (content_key) do nothing returning id""",
            (ck, level_id, genre, False, 1, 'own', 'team', False, genre))
        got = cur.fetchone()
        if got:
            text_id = got[0]; n_text += 1
        else:
            cur.execute("select id from reading_texts where content_key=%s", (ck,))
            text_id = cur.fetchone()[0]
        # 자식 재실행 안전
        cur.execute("delete from reading_sentences where text_id=%s", (text_id,))

        # ── reading_sentences (문장 분리) ──────────────────────────────
        ja_s = br.split_ja(r['passage_ja'])
        ko_s = br.split_ko(r['passage_ko'])
        if len(ja_s) != len(ko_s):
            # 폴백: 문장 1개(ja 전체 평문, ko 전체) — ko NOT NULL 보호
            fallback_keys.append(ck)
            base, ruby = br.pack(r['passage_ja'], always=True)
            rk, _ = br.gen_romaji_ko(r['passage_ja'])
            cur.execute(
                """insert into reading_sentences (text_id,seq,ja,reading,romaji_ko,ko)
                   values (%s,%s,%s,%s::jsonb,%s,%s)""",
                (text_id, 1, base, ruby, rk, r['passage_ko']))
            n_sent += 1
        else:
            for seq, (sja, sko) in enumerate(zip(ja_s, ko_s), 1):
                base, ruby = br.pack(sja, always=True)
                rk, _ = br.gen_romaji_ko(sja)
                cur.execute(
                    """insert into reading_sentences (text_id,seq,ja,reading,romaji_ko,ko)
                       values (%s,%s,%s,%s::jsonb,%s,%s)""",
                    (text_id, seq, base, ruby, rk, sko))
                n_sent += 1

        # ── questions ──────────────────────────────────────────────────
        qk = ck + '.q'
        stem_ja, stem_ruby = br.pack(r['question'])
        cur.execute(
            """insert into questions
               (content_key,question_type,course_level_id,target_item_type,target_item_key,
                stem_ja,stem_ruby,explanation,explanation_axis,is_auto_generated,source,verify,is_published)
               values (%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s)
               on conflict (content_key) do nothing returning id""",
            (qk, 'mcq', level_id, 'reading', ck, stem_ja, stem_ruby,
             r['explanation_ko'], 'reading', False, 'own', 'team', False))
        got = cur.fetchone()
        if got:
            q_id = got[0]; n_q += 1
        else:
            cur.execute("select id from questions where content_key=%s", (qk,))
            q_id = cur.fetchone()[0]
        cur.execute("delete from question_choices where question_id=%s", (q_id,))

        # ── question_choices ──────────────────────────────────────────
        ans = int((r['answer'] or '').strip())
        seq = 0
        for c in ('choice1', 'choice2', 'choice3', 'choice4'):
            v = (r.get(c) or '').strip()
            if not v or v == '-':
                continue
            seq += 1
            ctext, cruby = br.pack(v)
            cur.execute(
                """insert into question_choices
                   (question_id,seq,choice_text,choice_ruby,is_correct)
                   values (%s,%s,%s,%s::jsonb,%s)""",
                (q_id, seq, ctext, cruby, seq == ans))
            n_ch += 1

    conn.commit()
except Exception:
    conn.rollback()
    raise

# ── 검증 ──────────────────────────────────────────────────────────────
cur.execute("select count(*) from reading_texts")
t_rt = cur.fetchone()[0]
cur.execute("select count(*) from reading_sentences")
t_rs = cur.fetchone()[0]
cur.execute("select count(*) from reading_texts where not is_published")
unp = cur.fetchone()[0]
cur.execute("""select count(*) from reading_sentences s
               left join reading_texts t on t.id=s.text_id where t.id is null""")
orphan = cur.fetchone()[0]
conn.close()

print('-' * 60)
print('독해 임포트: texts +%d · sentences +%d · questions +%d · choices +%d'
      % (n_text, n_sent, n_q, n_ch))
print('DB reading_texts %d (미공개 %d) · reading_sentences %d · 고아문장 %d'
      % (t_rt, unp, t_rs, orphan))
if fallback_keys:
    print('⚠ 문장수 불일치 폴백: %s' % ', '.join(fallback_keys))
else:
    print('문장 정렬 폴백: 0건')
