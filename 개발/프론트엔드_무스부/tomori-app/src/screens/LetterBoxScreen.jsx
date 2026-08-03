import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';
import { LETTERS, getLetterBySeq } from '../data/letters';
import { loadDeliveredLetters } from '../data/stamps';

// 배달일 ISO(YYYY-MM-DD) → 「M월 D일」. 문자열 파싱(타임존 이동 방지).
function koDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : (iso || '');
}

/**
 * 편지함 (MY) — 받은 토모의 편지 컬렉션. 받은 편지만 모은다(쪽지·요약 PDF는 별도).
 *  · 로그인=배달 목록(user_letters) 실데이터, 게스트·조회실패=데모(LETTERS) 폴백.
 *  · 빈 상태는 담담하게(압박·빨간점 없음).
 */
export default function LetterBoxScreen({ nav }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';

  const [delivered, setDelivered] = useState(null);
  useEffect(() => { loadDeliveredLetters().then(setDelivered).catch(() => setDelivered(null)); }, []);

  // 실데이터(delivered) 있으면 배달 목록과 편지 콘텐츠를 조인, 없으면(게스트·조회실패) 기존 데모 목록.
  const isReal = delivered != null;
  const letters = isReal
    ? delivered
        .map((d) => {
          const c = getLetterBySeq(d.letter_seq);
          if (!c) return null;
          return { seq: d.letter_seq, title: c.title, preview: c.preview, dateLabel: koDate(d.delivered_on), unread: !d.read_at };
        })
        .filter(Boolean)
    : LETTERS;

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.appTitle, { color: t.textHigh }]}>편지함</Text>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        {letters.length === 0 ? (
          <View style={S.empty}>
            <Tomo scale={0.6} pose="sit" showNote={false} />
            <Text style={[S.emptyText, { color: t.textMid }, keepAll]}>아직 토모의 편지가 없어요.</Text>
            <Text style={[S.emptySub, { color: t.textLow }, keepAll]}>우표를 모으면 편지가 와요.</Text>
          </View>
        ) : (
          letters.map((l) => (
            <Pressable
              key={l.seq}
              onPress={() => nav.push('letter', isReal ? { seq: l.seq } : { id: l.id })}
              accessibilityRole="button"
              accessibilityLabel={`${l.title} 편지 열기`}
              style={[S.item, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }]}
            >
              <View style={S.itemText}>
                <View style={S.itemHead}>
                  <Text style={[S.itemTitle, { color: t.textHigh }, keepAll]}>{l.title}</Text>
                  {l.unread ? <View style={[S.dot, { backgroundColor: t.brand }]} /> : null}
                </View>
                <Text style={[S.itemPreview, { color: t.textMid }, keepAll]} numberOfLines={1}>{l.preview}</Text>
                <Text style={[S.itemDate, { color: t.textLow }]}>{l.dateLabel}</Text>
              </View>
              <Icon name="forward" size={20} color={t.textLow} />
            </Pressable>
          ))
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
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 16 },
    itemText: { flex: 1, gap: 4 },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    itemTitle: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
    dot: { width: 7, height: 7, borderRadius: radius.full },
    itemPreview: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400' },
    itemDate: { fontFamily: fonts.ko, ...typeStyle('caption'), fontWeight: '400' },
  });
}
