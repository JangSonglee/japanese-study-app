import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll } from '../theme/tokens';
import { LETTERS } from '../data/letters';

/**
 * 편지함 (MY) — 받은 토모의 편지 컬렉션(데모). 받은 편지만 모은다(쪽지·요약 PDF는 별도).
 *  · 빈 상태는 담담하게(압박·빨간점 없음). 실 도착은 인증·적립 후.
 */
export default function LetterBoxScreen({ nav }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const letters = LETTERS;

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
              key={l.id}
              onPress={() => nav.push('letter', { id: l.id })}
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
    appTitle: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    body: { padding: 16, gap: 10 },
    empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
    emptyText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    emptySub: { fontFamily: fonts.ko, fontSize: 13, textAlign: 'center' },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 16 },
    itemText: { flex: 1, gap: 4 },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    itemTitle: { fontFamily: fonts.ko, fontSize: 16, fontWeight: '700' },
    dot: { width: 7, height: 7, borderRadius: radius.full },
    itemPreview: { fontFamily: fonts.ko, fontSize: 13 },
    itemDate: { fontFamily: fonts.ko, fontSize: 11 },
  });
}
