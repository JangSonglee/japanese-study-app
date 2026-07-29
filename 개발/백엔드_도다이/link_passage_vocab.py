# -*- coding: utf-8 -*-
"""link_passage_vocab.py — 지문/대본 ↔ 단어(vocab_items) 매핑을 content_vocab_links 에 채운다.

무엇을:
 · 공개된 reading_texts(문장 reading_sentences.ja)·listening_items(대본 listening_lines.ja)를
   fugashi(MeCab+unidic-lite)로 형태소 분석 → 각 내용어를 「우리 사전(vocab_items, 공개분)」과 대조 →
   포함된 단어를 content_vocab_links 에 링크한다. FE 「이 글의 단어」(급수별·즐겨찾기)의 실데이터.

매칭 규칙(정밀 우선 + 한자·읽기 정합 게이트):
 1. 표면형(surface) == vocab.headword           (예: 昼ご飯→昼ご飯 ✓, 肉→肉 ✓, とても→とても ✓)
 2. 원형(lemma)   == vocab.headword + 정합       (예: 食べ→食べる ✓, 楽しかっ→楽しい ✓)
 3. 읽기(가나→히라) == vocab.reading + 「딱 하나」 + 정합   (예: 友達→友だち ✓, けん→軒 ✓)
 · 🔴 정합 게이트(오매칭 방지의 핵심): fugashi lemma 는 다른 한자로 정규화되기도 한다(帰り→返る,
   すみ→済む). 그래서 「매칭된 단어가 실제로 그 표기인가」를 검사한다 —
     · 표면에 한자가 있으면 → 매칭 단어 headword 와 한자가 하나라도 겹쳐야 한다(帰り{帰}↔返る{返} 거절).
     · 표면이 전부 가나면 → 읽기가 정확히 같아야 한다(すみ↔済む=すむ 거절, ほう↔方=かた 거절).
 · 조사/조동사/기호/공백은 제외. 사전에 없는 단어는 애초에 안 붙는다(뜻·급수가 사전에서 나오므로).

🔴 보안: 접속문자열은 db_url.txt/env 에서 내부로만 읽고 절대 출력·로그 금지.
🔴 공개(is_published) 조작 안 함 — 파생 링크만 쓴다. RLS 가 부모·단어 공개 여부로 노출을 게이트.
재실행 안전: item 별 기존 링크 delete 후 재insert(멱등).

실행: python link_passage_vocab.py
"""
import os, sys, io

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))

# ── 접속문자열(출력 금지) ────────────────────────────────────────────────
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
import fugashi

TAGGER = fugashi.Tagger()

# 내용어만 — 조사/조동사/기호/공백/접두·접미 제외
EXCLUDE_POS = {'助詞', '助動詞', '補助記号', '記号', '空白', '接頭辞', '接尾辞'}


def kata_to_hira(s):
    if not s:
        return ''
    out = []
    for ch in s:
        o = ord(ch)
        # 가타카나 블록 → 히라가나(−0x60). 장음 기호(ー)·기타는 그대로.
        if 0x30A1 <= o <= 0x30F6:
            out.append(chr(o - 0x60))
        else:
            out.append(ch)
    return ''.join(out)


def kanji_set(s):
    """문자열에서 한자(CJK 통합 한자)만 뽑은 집합. 표기 정합 검사용."""
    return {c for c in (s or '') if 0x4E00 <= ord(c) <= 0x9FFF}


# 각 색인 레코드 = (id, level, headword, reading_hira)
def build_vocab_index(cur):
    """공개 vocab → 표면색인(headword)·읽기색인(reading, 히라가나)."""
    cur.execute(
        """select v.id, v.headword, v.reading, cl.code
           from vocab_items v join course_levels cl on cl.id = v.course_level_id
           where v.is_published = true""")
    by_head = {}          # headword -> rec
    by_read = {}          # reading(히라) -> [rec, ...]
    head_collisions = 0
    for vid, head, read, lvl in cur.fetchall():
        r = kata_to_hira(read or '')
        rec = (vid, lvl, head, r)
        if head in by_head:
            head_collisions += 1
        else:
            by_head[head] = rec
        if r:
            by_read.setdefault(r, []).append(rec)
    return by_head, by_read, head_collisions


def _consistent(surface, token_read_hira, rec):
    """매칭된 단어(rec)가 실제로 이 표면의 표기인지 — 오매칭(帰り→返る 등) 게이트."""
    tk = kanji_set(surface)
    if tk:                                   # 한자 표면 → 한자가 하나라도 겹쳐야
        return bool(tk & kanji_set(rec[2]))
    return token_read_hira == rec[3]         # 가나 표면 → 읽기가 정확히 같아야


def match_tokens(ja, by_head, by_read):
    """문장 하나 → 매칭된 [(vocab_id, level, headword, surface)] (중복 허용, 호출측서 dedup)."""
    hits = []
    for w in TAGGER(ja):
        f = w.feature
        if f.pos1 in EXCLUDE_POS:
            continue
        surface = w.surface
        lemma = getattr(f, 'lemma', None) or surface
        read_hira = kata_to_hira(getattr(f, 'kana', None) or '')
        rec = None
        # 1) 표면형 완전일치(가장 확실)
        if surface in by_head:
            rec = by_head[surface]
        else:
            # 2) 원형 일치 + 정합 게이트
            cand = by_head.get(lemma)
            if cand is not None and _consistent(surface, read_hira, cand):
                rec = cand
            elif read_hira:
                # 3) 읽기 폴백 — 유일 + 정합 게이트(表記 변형 友達→友だち 만 통과)
                cands = by_read.get(read_hira)
                if cands and len(cands) == 1 and _consistent(surface, read_hira, cands[0]):
                    rec = cands[0]
        if rec is not None:
            hits.append((rec[0], rec[1], rec[2], surface))
    return hits


def collect_item_links(seq_ja_pairs, by_head, by_read):
    """[(seq, ja)] → {vocab_id: (level, headword, surface, first_seq)} (단어별 1링크, 최초 등장 seq)."""
    found = {}
    for seq, ja in seq_ja_pairs:
        if not ja:
            continue
        for vid, lvl, head, surface in match_tokens(ja, by_head, by_read):
            if vid not in found:
                found[vid] = (lvl, head, surface, seq)
    return found


def main():
    conn = psycopg.connect(DB)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        by_head, by_read, head_col = build_vocab_index(cur)
        print('사전 색인: 표면 %d · 읽기 %d (headword 중복 %d)' % (len(by_head), len(by_read), head_col))

        total_links = 0
        stats = {'reading': [0, 0], 'listening': [0, 0]}  # [items, links]

        # ── 독해 ────────────────────────────────────────────────────────
        cur.execute("select id, content_key from reading_texts order by content_key")
        for text_id, ck in cur.fetchall():
            cur.execute("select seq, ja from reading_sentences where text_id=%s order by seq", (text_id,))
            pairs = cur.fetchall()
            found = collect_item_links(pairs, by_head, by_read)
            cur.execute("delete from content_vocab_links where item_type='reading' and item_content_key=%s", (ck,))
            for vid, (lvl, head, surface, seq) in found.items():
                cur.execute(
                    """insert into content_vocab_links (item_type,item_content_key,vocab_item_id,surface,first_seq)
                       values ('reading',%s,%s,%s,%s)
                       on conflict (item_type,item_content_key,vocab_item_id) do nothing""",
                    (ck, vid, surface, seq))
            stats['reading'][0] += 1
            stats['reading'][1] += len(found)
            total_links += len(found)

        # ── 청해 ────────────────────────────────────────────────────────
        cur.execute("select id, content_key from listening_items order by content_key")
        for item_id, ck in cur.fetchall():
            cur.execute("select seq, ja from listening_lines where listening_item_id=%s order by seq", (item_id,))
            pairs = cur.fetchall()
            found = collect_item_links(pairs, by_head, by_read)
            cur.execute("delete from content_vocab_links where item_type='listening' and item_content_key=%s", (ck,))
            for vid, (lvl, head, surface, seq) in found.items():
                cur.execute(
                    """insert into content_vocab_links (item_type,item_content_key,vocab_item_id,surface,first_seq)
                       values ('listening',%s,%s,%s,%s)
                       on conflict (item_type,item_content_key,vocab_item_id) do nothing""",
                    (ck, vid, surface, seq))
            stats['listening'][0] += 1
            stats['listening'][1] += len(found)
            total_links += len(found)

        conn.commit()

        # ── 검증 ──────────────────────────────────────────────────────────
        cur.execute("select count(*) from content_vocab_links")
        tot = cur.fetchone()[0]
        cur.execute("""select count(*) from content_vocab_links l
                       left join vocab_items v on v.id=l.vocab_item_id where v.id is null""")
        orphan = cur.fetchone()[0]
        cur.execute("""select count(distinct item_content_key) from content_vocab_links where item_type='reading'""")
        rd_items = cur.fetchone()[0]
        cur.execute("""select count(distinct item_content_key) from content_vocab_links where item_type='listening'""")
        ls_items = cur.fetchone()[0]

        print('-' * 60)
        print('독해  : %d개 지문 · 링크 %d' % (stats['reading'][0], stats['reading'][1]))
        print('청해  : %d개 대본 · 링크 %d' % (stats['listening'][0], stats['listening'][1]))
        print('DB content_vocab_links %d (독해지문 %d · 청해대본 %d) · 고아 %d' % (tot, rd_items, ls_items, orphan))
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
