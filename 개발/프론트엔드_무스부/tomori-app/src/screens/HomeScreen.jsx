import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

/**
 * 홈 (Hi-fi 8) — FE 본편 첫 조각.
 *
 * 사양 근거 / 범위 결정(2026-07-28):
 *  · 스트릭·오늘의 학습·진도 위젯은 「그 사용자가 실제로 쓴 기록」이라 로그인 전엔 데이터가 없다
 *    → 가짜 위젯을 두지 않고 정직하게 생략. 로그인이 붙으면 이 자리에 채운다.
 *  · 토모 = 평소 밝기·말 없음(밝아짐은 「새 쪽지」 전용, PRD 14.2.1).
 *  · CTA 「오늘의 학습 시작」 = Primary(잉크). 결제·압박 요소 없음(PRD 1.3/12).
 *  · 하단 5탭 바 없음(이 조각). MY 는 우상단 프로필로 진입.
 */
export default function HomeScreen({ nav }) {
  const { t } = useTheme();
  const S = makeStyles(t);
  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      {/* 상단 — 브랜드 + 프로필 진입(MY). 뒤로가기 없음(루트) */}
      <View style={S.appbar}>
        <Text style={[S.brand, { color: t.textHigh }]}>토모리</Text>
        <Pressable
          onPress={() => nav.push('my')}
          accessibilityRole="button"
          accessibilityLabel="MY 화면"
          hitSlop={10}
          style={[S.profileBtn, { borderColor: t.borderStrong }]}
        >
          <Text style={[S.profileText, { color: t.textMid }]}>MY</Text>
        </Pressable>
      </View>

      {/* 가운데 — 토모 + 인사말 */}
      <View style={S.hero}>
        <Tomo scale={1.25} showNote={false} />
        <Text style={[S.greet, { color: t.textHigh }]}>오늘도 왔네요.</Text>
        <Text style={[S.sub, { color: t.textMid }]}>작은 불빛 하나, 같이 켜 볼까요.</Text>
      </View>

      {/* CTA — 오늘의 학습 시작 → 코스 목록 */}
      <View style={S.ctaWrap}>
        <Pressable
          onPress={() => nav.push('courses')}
          accessibilityRole="button"
          style={[S.cta, { backgroundColor: t.action }]}
        >
          <Text style={[S.ctaText, { color: t.onAction }]}>오늘의 학습 시작</Text>
        </Pressable>
        <Text style={[S.hint, { color: t.textMid }]}>지금은 JLPT 단어·문법부터 열려 있어요.</Text>
      </View>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: 20, paddingBottom: 24 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    brand: { fontFamily: fonts.ko, fontSize: 17, fontWeight: '700' },
    profileBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
    profileText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '700' },
    hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    greet: { fontFamily: fonts.ko, fontSize: 20, fontWeight: '700', marginTop: 8 },
    sub: { fontFamily: fonts.ko, fontSize: 14 },
    ctaWrap: { gap: 10, alignItems: 'center' },
    cta: { width: '100%', height: 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    ctaText: { fontFamily: fonts.ko, fontSize: 16, fontWeight: '700' },
    hint: { fontFamily: fonts.ko, fontSize: 12 },
  });
}
