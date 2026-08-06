import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, keepAll } from '../theme/tokens';

/**
 * 단어장 탭 (플레이스홀더) — 저장한 단어 모아보기. 화면 구현은 추후.
 */
export default function VocabBookScreen() {
  const { t } = useTheme();
  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.head}><Text style={[S.title, { color: t.textHigh }]}>단어장</Text></View>
      <View style={S.center}>
        <Tomo scale={0.7} pose="sit" showNote={false} />
        <Text style={[S.msg, { color: t.textMid }, keepAll]}>저장한 단어가 여기 모여요.</Text>
        <Text style={[S.sub, { color: t.textLow }, keepAll]}>단어 카드에서 별(★)로 저장하면 담겨요. (준비 중)</Text>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1 },
  head: { height: 56, justifyContent: 'center', paddingHorizontal: 20 },
  title: { fontFamily: fonts.ko, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, paddingBottom: 90 },
  msg: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  sub: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '400', textAlign: 'center' },
});
