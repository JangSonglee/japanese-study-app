import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';

// 코스 표시 정보(이름·설명) — CourseListScreen 과 동일 톤.
const COURSE_META = {
  jlpt:   { name: 'JLPT',      desc: '급수별 단어·문법·독해·청해' },
  travel: { name: '여행 회화',  desc: '상황별 표현' },
  biz:    { name: '비즈니스',   desc: '이메일·전화·회의' },
  news:   { name: '뉴스·시사',  desc: '읽기형 콘텐츠' },
  folk:   { name: '전래동화',   desc: '읽기형 콘텐츠' },
};

/**
 * 추천 결과 — 진단 뒤 메인 코스 1장(PRD 10.3). 담담한 톤·강제 없음.
 *  · 메인이 준비 중이면 "곧 열려요 · 먼저 JLPT로" 안내(대표님 결정).
 */
export default function RecommendScreen({ result, onStart }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const main = COURSE_META[result.mainCourse] || COURSE_META.jlpt;
  const sub = result.subCourse ? COURSE_META[result.subCourse] : null;

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <ScrollView contentContainerStyle={S.body}>
        <View style={S.tomoWrap}><Tomo scale={0.7} pose="shine" showNote={false} /></View>
        <Text style={[S.lead, { color: t.textMid }, keepAll]}>이런 코스가 잘 맞을 것 같아요</Text>

        {/* 메인 코스 카드 */}
        <View style={[S.card, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }]}>
          <View style={[S.accent, { backgroundColor: result.mainReady ? t.courseJlpt : t.borderStrong }]} />
          <Text style={[S.courseName, { color: t.textHigh }, keepAll]}>{main.name}</Text>
          <Text style={[S.courseDesc, { color: t.textMid }, keepAll]}>{main.desc}</Text>
          {!result.mainReady ? (
            <View style={[S.soonRow, { backgroundColor: t.sunk }]}>
              <Text style={[S.soonText, { color: t.textMid }, keepAll]}>
                아직 준비 중이에요 · 먼저 JLPT로 시작해볼까요?
              </Text>
            </View>
          ) : null}
        </View>

        {sub ? (
          <Text style={[S.subNote, { color: t.textMid }, keepAll]}>
            함께 보면 좋은 코스 · {sub.name}
          </Text>
        ) : null}
      </ScrollView>

      <View style={S.foot}>
        <Pressable onPress={onStart} accessibilityRole="button" style={[S.btnPri, { backgroundColor: t.brand }]}>
          <Text style={[S.btnPriText, { color: t.onBrand }]}>시작하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    body: { padding: 20, gap: 12, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
    tomoWrap: { marginBottom: 4 },
    lead: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400', textAlign: 'center' },
    card: { alignSelf: 'stretch', borderRadius: radius.lg, padding: 20, gap: 6 },
    accent: { width: 40, height: 4, borderRadius: radius.full, marginBottom: 6 },
    courseName: { fontFamily: fonts.ko, ...typeStyle('title'), fontWeight: '700' },
    courseDesc: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400' },
    soonRow: { borderRadius: radius.md, padding: 12, marginTop: 8 },
    soonText: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600' },
    subNote: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400', textAlign: 'center' },
    foot: { padding: 16 },
    btnPri: { height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnPriText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
  });
}
