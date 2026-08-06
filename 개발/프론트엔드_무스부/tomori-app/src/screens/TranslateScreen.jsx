import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, keepAll } from '../theme/tokens';

/**
 * 번역 탭 (플레이스홀더) — 사진·문장 번역. 화면 구현은 추후.
 */
export default function TranslateScreen() {
  const { t } = useTheme();
  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.head}><Text style={[S.title, { color: t.textHigh }]}>번역</Text></View>
      <View style={S.center}>
        <Tomo scale={0.7} pose="read" showNote={false} />
        <Text style={[S.msg, { color: t.textMid }, keepAll]}>사진·문장을 일본어로 번역해요.</Text>
        <Text style={[S.sub, { color: t.textLow }, keepAll]}>카메라·텍스트 번역이 들어올 자리예요. (준비 중)</Text>
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
