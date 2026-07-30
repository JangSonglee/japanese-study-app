import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Linking } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, keepAll } from '../theme/tokens';

// JLPT 급수 데이터 대조에 tanos.co.uk를 썼다. 라이선스 CC BY의 조건 = 출처(사이트) 표기.
// 🔴 이행 의무(진행상태.md · 규격 8장 ②) — 이 출처 표기를 지우면 라이선스 위반.
const TANOS_URL = 'https://www.tanos.co.uk/jlpt/';

/**
 * 서비스 정보 (About) — 서비스 개요 + 하단 출처.
 *
 * 배치 결정(2026-07-28, 대표님): 출처(Tanos 크레딧)를 설정 화면에 직접 노출하지 않고,
 * MY › 「서비스 정보」를 눌렀을 때 서비스 개요와 함께 **하단**에 보인다.
 * CC BY는 출처가 접근 가능하기만 하면 충족 — About 화면이 표준적이고 자연스러운 자리.
 */
export default function AboutScreen({ nav }) {
  const { t } = useTheme();
  const S = makeStyles(t);
  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.title, { color: t.textHigh }]}>서비스 정보</Text>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        {/* 서비스 개요 */}
        <View style={S.hero}>
          <Tomo scale={1} pose="intellectual" showNote={false} />
          <Text style={[S.brand, { color: t.textHigh }]}>토모리 (Tomori)</Text>
          <Text style={[S.tagline, { color: t.textMid }]}>밝혀주되, 끌지 않아요.</Text>
        </View>

        <Text style={[S.overview, { color: t.textMid }]}>
          토모리는 일본어를 함께 켜 나가는 학습 앱이에요. 작은 등불 토모가 곁에서 비춰 주고,
          모은 우표는 편지가 되어 돌아와요. 시험을 위한 채점이 아니라, 학습 의지를 북돋는 것이 목표예요.
        </Text>

        {/* 하단 — 출처·크레딧 */}
        <View style={[S.divider, { backgroundColor: t.border }]} />
        <Text style={[S.section, { color: t.textLow }]}>출처</Text>
        <Text style={[S.credit, { color: t.textMid }]}>
          JLPT 급수 분류 대조에 Jonathan Waller 님의 자료(tanos.co.uk)를 참고했어요.
          Creative Commons BY 라이선스입니다.
        </Text>
        <Pressable
          onPress={() => Linking.openURL(TANOS_URL)}
          accessibilityRole="link"
          accessibilityLabel="tanos.co.uk 열기"
          hitSlop={8}
          style={S.linkRow}
        >
          <Text style={[S.link, { color: t.courseJlptText }]}>tanos.co.uk</Text>
          <Icon name="external" size={14} color={t.courseJlptText} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    title: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    body: { padding: 16, gap: 12 },
    hero: { alignItems: 'center', gap: 8, paddingVertical: 12 },
    brand: { fontFamily: fonts.ko, fontSize: 18, fontWeight: '700', marginTop: 6 },
    tagline: { fontFamily: fonts.ko, fontSize: 13, ...keepAll },
    overview: { fontFamily: fonts.ko, fontSize: 14, lineHeight: 22, ...keepAll },
    divider: { height: 1, marginTop: 8 },
    section: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '600' },
    credit: { fontFamily: fonts.ko, fontSize: 13, lineHeight: 20, ...keepAll },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    link: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '600' },
  });
}
