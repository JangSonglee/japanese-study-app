import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import Ruby from '../components/Ruby';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';
import { loadWrongNotes, graduateWrongNote } from '../data/wrongNotes';

// last_at(ISO) → 「M월 D일」. 문자열 파싱(타임존 이동 방지) — LetterBoxScreen koDate와 동일 패턴.
function koDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : '';
}

/**
 * 오답노트 모아보기 (MY › 보관함) — 틀리거나 넘어간 문항을 모아 다시 볼 수 있는 화면.
 *  · 로그인=실데이터(load_wrong_notes RPC), 게스트·조회실패=담담한 안내(로그인 유도, 데모 폴백 없음
 *    — 오답노트는 「내 기록」이라 편지함과 달리 대신 보여줄 데모가 없다).
 *  · 배지(틀림✕·넘어감⤼)는 중립 톤 — PRD 8.6 이 목록은 분류이지 감정 평가가 아니다.
 *  · 후리가나 기본 ON(PRD 8.4) — 이 화면은 복습용이라 토글 없이 항상 켜둔다.
 */
export default function WrongNoteScreen({ nav }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';

  const [notes, setNotes] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  useEffect(() => { loadWrongNotes().then(setNotes).catch(() => setNotes(null)); }, []);

  function toggleExpand(id) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function onGraduate(id) {
    try { await graduateWrongNote(id); } catch { /* ignore */ }
    setNotes((n) => (n || []).filter((x) => x.question_id !== id));
  }

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.appTitle, { color: t.textHigh }]}>오답노트</Text>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        {notes == null ? (
          <View style={S.empty}>
            <Tomo scale={0.6} pose="sit" showNote={false} />
            <Text style={[S.emptyText, { color: t.textMid }, keepAll]}>로그인하면 오답노트가 모여요.</Text>
            <Text style={[S.emptySub, { color: t.textLow }, keepAll]}>틀리거나 넘어간 문제가 여기 쌓여요.</Text>
          </View>
        ) : notes.length === 0 ? (
          <View style={S.empty}>
            <Tomo scale={0.6} pose="sit" showNote={false} />
            <Text style={[S.emptyText, { color: t.textMid }, keepAll]}>아직 오답노트가 비어 있어요.</Text>
            <Text style={[S.emptySub, { color: t.textLow }, keepAll]}>틀린 문제가 여기에 모여요.</Text>
          </View>
        ) : (
          notes.map((n) => {
            const isOpen = expanded.has(n.question_id);
            const isSkipped = n.latest_outcome === 'skipped';
            return (
              <View
                key={n.question_id}
                style={[S.item, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }]}
              >
                {/* 탭 영역(배지·문제·정답) — 해설 펼침/접힘 전용. 「이제 알아요」는 별도 Pressable(중첩 방지). */}
                <Pressable
                  onPress={() => toggleExpand(n.question_id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${isSkipped ? '넘어간' : '틀린'} 문제, 해설 ${isOpen ? '닫기' : '열기'}`}
                  style={S.itemTap}
                >
                  <View style={S.itemHead}>
                    <View style={[S.badge, { backgroundColor: t.sunk }]}>
                      <Text style={[S.badgeText, { color: t.textMid }]}>{isSkipped ? '⤼' : '✕'}</Text>
                    </View>
                    <Text style={[S.badgeLabel, { color: t.textLow }]}>{isSkipped ? '넘어감' : '틀림'}</Text>
                    <View style={S.metaRow}>
                      <Text style={[S.metaText, { color: t.textLow }]}>{n.wrong_count}회</Text>
                      {n.last_at ? <Text style={[S.metaText, { color: t.textLow }]}>{koDate(n.last_at)}</Text> : null}
                    </View>
                  </View>

                  <View style={S.qArea}>
                    {n.stem_ruby && n.stem_ruby.base ? (
                      <Ruby base={n.stem_ruby.base} ruby={n.stem_ruby.ruby} show size={17} color={t.textHigh} />
                    ) : (
                      <Text style={[S.plainJa, { color: t.textHigh }]} lang="ja">{n.stem_ja}</Text>
                    )}
                  </View>

                  <View style={S.answerRow}>
                    <Text style={[S.answerLabel, { color: t.textLow }]}>정답</Text>
                    {n.correct_ruby && n.correct_ruby.base ? (
                      <Ruby base={n.correct_ruby.base} ruby={n.correct_ruby.ruby} show size={15} color={t.textHigh} />
                    ) : (
                      <Text style={[S.plainJa, { color: t.textHigh }]} lang="ja">{n.correct_text}</Text>
                    )}
                  </View>
                </Pressable>

                {isOpen && n.explanation ? (
                  <View style={[S.explainBox, { backgroundColor: t.sunk }]}>
                    <Text style={[S.explainLabel, { color: t.textLow }]}>해설</Text>
                    <Text style={[S.explainText, { color: t.textMid }, keepAll]}>{n.explanation}</Text>
                  </View>
                ) : null}

                <View style={S.foot}>
                  <Pressable
                    onPress={() => onGraduate(n.question_id)}
                    accessibilityRole="button"
                    accessibilityLabel="이제 알아요 — 오답노트에서 지우기"
                    style={[S.graduateBtn, { borderColor: t.textLow }]}
                  >
                    <Text style={[S.graduateText, { color: t.textMid }]}>이제 알아요</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    appTitle: { flex: 1, fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600' },
    body: { padding: 16, gap: 10 },
    empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
    emptyText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '600', textAlign: 'center' },
    emptySub: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400', textAlign: 'center' },

    item: { borderRadius: radius.lg, padding: 16, gap: 10 },
    itemTap: { gap: 10 },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badge: { width: 22, height: 22, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '700' },
    badgeLabel: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '600' },
    metaRow: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    metaText: { fontFamily: fonts.ko, ...typeStyle('caption'), fontWeight: '400', fontVariant: ['tabular-nums'] },

    qArea: { paddingVertical: 2 },
    plainJa: { fontFamily: fonts.jp, fontSize: 17 },

    answerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    answerLabel: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '600' },

    explainBox: { borderRadius: radius.md, padding: 12, gap: 4 },
    explainLabel: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '600' },
    explainText: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400' },

    foot: { flexDirection: 'row', justifyContent: 'flex-end' },
    graduateBtn: { paddingHorizontal: 14, height: 36, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    graduateText: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600' },
  });
}
