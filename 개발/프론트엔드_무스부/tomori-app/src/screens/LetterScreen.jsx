import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll } from '../theme/tokens';
import { getLetter } from '../data/letters';

/**
 * 편지 상세 (토모의 이정표 편지). 소장용 편지지 레이아웃.
 *  · 톤: 조용한 관찰자(PRD 14.4). 폭죽·축하·밝기 헤일로 없음(헤일로는 쪽지 전용 14.2.1).
 *  · 데모 데이터(data/letters.js). 실 생성은 인증·적립 후.
 */
export default function LetterScreen({ nav, id }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const letter = getLetter(id);

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.appTitle, { color: t.textHigh }]}>토모의 편지</Text>
      </View>

      {!letter ? (
        <View style={S.center}><Text style={[S.missing, { color: t.textMid }, keepAll]}>편지를 찾을 수 없어요.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={S.body}>
          <View style={[S.paper, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }]}>
            <View style={S.tomoWrap}><Tomo scale={0.55} pose="read" showNote={false} /></View>
            <Text style={[S.title, { color: t.textHigh }, keepAll]}>{letter.title}</Text>
            <Text style={[S.date, { color: t.textLow }]}>{letter.dateLabel}</Text>
            <View style={S.paras}>
              {letter.paragraphs.map((p, i) => (
                <Text key={i} style={[S.para, { color: t.textHigh }, keepAll]}>{p}</Text>
              ))}
            </View>
            <Text style={[S.signoff, { color: t.brandText }, keepAll]}>{letter.signoff}</Text>
          </View>

          <Pressable style={[S.btn, { backgroundColor: t.brand }]} onPress={() => nav.pop()} accessibilityRole="button" accessibilityLabel="닫기">
            <Text style={[S.btnText, { color: t.onBrand }]}>닫기</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    appTitle: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    body: { padding: 16, gap: 14 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    missing: { fontFamily: fonts.ko, fontSize: 14, textAlign: 'center' },
    paper: { borderRadius: radius.lg, padding: 22, gap: 6, alignItems: 'flex-start' },
    tomoWrap: { alignSelf: 'center', marginBottom: 6 },
    title: { fontFamily: fonts.ko, fontSize: 19, fontWeight: '700' },
    date: { fontFamily: fonts.ko, fontSize: 12, marginBottom: 8 },
    paras: { gap: 12, marginTop: 2 },
    para: { fontFamily: fonts.ko, fontSize: 15, lineHeight: 24 },
    signoff: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '700', alignSelf: 'flex-end', marginTop: 14 },
    btn: { height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
  });
}
