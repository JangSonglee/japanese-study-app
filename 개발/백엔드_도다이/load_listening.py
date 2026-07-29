# -*- coding: utf-8 -*-
"""load_listening.py — N5 청해 flat CSV → 정규화 테이블 임포트(미공개).

 · listening_items 1 : listening_lines N : questions 1 : question_choices N
 · 변환 로직(턴 분리·루비·romaji)은 리서치/도구/build_listening.py 재사용.
 · load_grammar.py 구조 본뜸: db_url.txt/env 내부 접속, is_published=false, 트랜잭션.
 · 🔴 접속문자열 절대 출력 금지. 공개 플립은 하지 않는다.
 · voice_preset='jlpt_2spk_m1f1'(남1·여1 표준, 대표님 결정), speed=1.0, audio_url=<key>.m4a(파일명만).
 · 재실행 안전: 부모 ON CONFLICT DO NOTHING + id, 자식은 부모 id 기준 delete 후 재insert.

실행: python load_listening.py
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

bl = _load('build_listening', os.path.join(TOOLS, 'build_listening.py'))
br = bl.br

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

# 급수 범용화: python load_listening.py [급수] [csv경로]  (기본 N5 / JLPT/{급수}_청해_20.csv)
LEVEL = (sys.argv[1] if len(sys.argv) > 1 else 'N5').upper()
CSV_PATH = sys.argv[2] if len(sys.argv) > 2 else os.path.join(JLPT, '%s_청해_20.csv' % LEVEL)
# 🔴 tts_listening.py 의 실제 배정과 일치(A=남 Algenib / B=여 Aoede, 2026-07-29 스왑).
VOICE_PRESET = 'chirp3hd_2spk_algenib-m_aoede-f'

conn = psycopg.connect(DB)
conn.autocommit = False
cur = conn.cursor()

align_warn = []
try:
    cur.execute("select cl.id from course_levels cl join courses c on c.id=cl.course_id "
                "where c.code='jlpt' and cl.code=%s", (LEVEL,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError('course_levels(jlpt/%s) 없음' % LEVEL)
    level_id = row[0]

    rows = list(csv.DictReader(io.open(CSV_PATH, encoding='utf-8-sig')))
    n_item = n_line = n_q = n_ch = 0

    for r in rows:
        ck = r['content_key']
        typ = r['type']
        turns = bl.split_turns_ja(r['script_ja'])
        ko_turns = bl.split_turns_ko(r.get('script_ko') or '')
        spk_count = len(set(s for s, _ in turns)) or 1
        audio = ck + '.m4a'

        # ── listening_items ────────────────────────────────────────────
        cur.execute(
            """insert into listening_items
               (content_key,course_level_id,title,speaker_count,voice_preset,speed,audio_url,
                source,verify,is_published,note)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (content_key) do nothing returning id""",
            (ck, level_id, typ, spk_count, VOICE_PRESET, 1.0, audio, 'own', 'team', False, typ))
        got = cur.fetchone()
        if got:
            item_id = got[0]; n_item += 1
        else:
            cur.execute("select id from listening_items where content_key=%s", (ck,))
            item_id = cur.fetchone()[0]
        cur.execute("delete from listening_lines where listening_item_id=%s", (item_id,))

        # ── listening_lines (발화 분리, ko 화자별 정렬) ────────────────
        aligned = len(ko_turns) == len(turns)
        if ko_turns and not aligned:
            align_warn.append(ck)
        for seq, (spk, inner) in enumerate(turns, 1):
            base, ruby = br.pack(inner, always=True)
            rk, _ = br.gen_romaji_ko(inner)
            ko = None
            if aligned:
                ko = ko_turns[seq - 1][1]
            elif ko_turns:
                # 최선 매핑: 같은 화자의 seq번째 ko 턴(있으면), 없으면 None
                same = [t for s, t in ko_turns if s == spk]
                idx = sum(1 for s, _ in turns[:seq] if s == spk) - 1
                ko = same[idx] if idx < len(same) else None
            cur.execute(
                """insert into listening_lines
                   (listening_item_id,seq,speaker,ja,ruby,romaji_ko,ko)
                   values (%s,%s,%s,%s,%s::jsonb,%s,%s)""",
                (item_id, seq, spk, base, ruby, rk, ko))
            n_line += 1

        # ── questions ──────────────────────────────────────────────────
        qk = ck + '.q'
        stem_ja, stem_ruby = br.pack(r['question'])
        cur.execute(
            """insert into questions
               (content_key,question_type,course_level_id,target_item_type,target_item_key,
                stem_ja,stem_ruby,audio_url,explanation,explanation_axis,is_auto_generated,
                source,verify,is_published)
               values (%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s)
               on conflict (content_key) do nothing returning id""",
            (qk, 'listening', level_id, 'listening', ck, stem_ja, stem_ruby, audio,
             None, None, False, 'own', 'team', False))
        got = cur.fetchone()
        if got:
            q_id = got[0]; n_q += 1
        else:
            cur.execute("select id from questions where content_key=%s", (qk,))
            q_id = cur.fetchone()[0]
        cur.execute("delete from question_choices where question_id=%s", (q_id,))

        # ── question_choices (즉시응답 3지선다: '-' 스킵) ──────────────
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
cur.execute("select count(*) from listening_items")
t_li = cur.fetchone()[0]
cur.execute("select count(*) from listening_lines")
t_ll = cur.fetchone()[0]
cur.execute("select count(*) from listening_items where not is_published")
unp = cur.fetchone()[0]
cur.execute("""select count(*) from listening_lines l
               left join listening_items i on i.id=l.listening_item_id where i.id is null""")
orphan = cur.fetchone()[0]
conn.close()

print('-' * 60)
print('청해 임포트: items +%d · lines +%d · questions +%d · choices +%d'
      % (n_item, n_line, n_q, n_ch))
print('DB listening_items %d (미공개 %d) · listening_lines %d · 고아발화 %d'
      % (t_li, unp, t_ll, orphan))
if align_warn:
    print('⚠ 화자 정렬 불일치(최선매핑): %s' % ', '.join(align_warn))
else:
    print('화자 정렬 폴백: 0건')
