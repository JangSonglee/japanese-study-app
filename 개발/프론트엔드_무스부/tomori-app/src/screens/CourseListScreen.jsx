import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

/**
 * 코스 목록 (Hi-fi 10) — 5개 코스.
 *
 * 사양 근거:
 *  · 5개 코스가 있다는 사실은 보여준다 → 미완성 코스는 「곧 열려요」(코스 *단위*엔 허용).
 *    코스 아래 단위(영역·급수)는 아예 노출하지 않는다(진행상태.md 「곧 열려요는 코스 단위에만」).
 *  · 지금 콘텐츠가 있는 건 JLPT 단어뿐 → JLPT만 활성. 나머지 4개는 진입 불가(잠금 아님·미완성).
 *  · 코스색 대면적 배경 금지(사양서 2장) → 4px 액센트 바 + 코스색 글자로만.
 */
const COURSES = [
  { key: 'jlpt', name: 'JLPT', desc: '급수별 단어·문법·독해·청해', ready: true },
  { key: 'travel', name: '여행 회화', desc: '상황별 표현', ready: false },
  { key: 'biz', name: '비즈니스', desc: '이메일·전화·회의', ready: false },
  { key: 'news', name: '뉴스·시사', desc: '읽기형 콘텐츠', ready: false },
  { key: 'folk', name: '전래동화', desc: '읽기형 콘텐츠', ready: false },
];

export default function CourseListScreen({ nav }) {
  const { t } = useTheme();
  const S = makeStyles(t);
  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.title, { color: t.textHigh }]}>학습 · 코스</Text>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        {COURSES.map((c) => (
          <CourseCard key={c.key} t={t} course={c} onPress={() => c.ready && nav.push('jlptHub')} />
        ))}
      </ScrollView>
    </View>
  );
}

function CourseCard({ t, course, onPress }) {
  const S = makeStyles(t);
  const { name, desc, ready } = course;
  return (
    <Pressable
      onPress={ready ? onPress : undefined}
      disabled={!ready}
      accessibilityRole="button"
      accessibilityState={{ disabled: !ready }}
      style={[
        S.card,
        { backgroundColor: t.bgSurface, boxShadow: t.sh1 },
        !ready && { opacity: 0.6 },
      ]}
    >
      <View style={[S.accent, { backgroundColor: ready ? t.courseJlpt : t.borderStrong }]} />
      <View style={S.cardText}>
        <Text style={[S.name, { color: ready ? t.textHigh : t.textMid }]}>{name}</Text>
        <Text style={[S.desc, { color: t.textMid }]}>{desc}</Text>
      </View>
      {ready ? (
        <Icon name="forward" size={20} color={t.textLow} />
      ) : (
        <View style={[S.soon, { backgroundColor: t.sunk }]}>
          <Text style={[S.soonText, { color: t.textMid }]}>곧 열려요</Text>
        </View>
      )}
    </Pressable>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    back: { fontSize: 26, width: 20 },
    title: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    body: { padding: 16, gap: 10 },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: radius.md, padding: 14,
    },
    accent: { width: 4, height: 34, borderRadius: radius.full },
    cardText: { flex: 1, gap: 3 },
    name: { fontFamily: fonts.ko, fontSize: 16, fontWeight: '700' },
    desc: { fontFamily: fonts.ko, fontSize: 12 },
    chev: { fontFamily: fonts.ko, fontSize: 22, fontWeight: '400' },
    soon: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
    soonText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600' },
  });
}
