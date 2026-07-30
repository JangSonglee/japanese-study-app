import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import Ruby from '../components/Ruby';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll } from '../theme/tokens';
import { getLetter } from '../data/letters';

/**
 * 편지 상세 (토모의 이정표 편지). 소장용 편지지 레이아웃.
 *  · 🔴 본문은 일본어(대표님 2026-07-31) — 편지도 학습이 되게. 후리가나·해석은 우상단 토글.
 *    후리가나 기본 ON(읽기 부담↓), 해석 기본 OFF(스스로 먼저 읽되 한 번에 확인). PRD 8.4 위로받는 자리.
 *  · 톤: 조용한 관찰자(PRD 14.4). 폭죽·축하·밝기 헤일로 없음(헤일로는 쪽지 전용 14.2.1).
 *  · 데모 데이터(data/letters.js). 실 생성은 인증·적립 후.
 */
export default function LetterScreen({ nav, id }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const letter = getLetter(id);
  const [furi, setFuri] = useState(true);   // 후리가나 기본 ON
  const [trans, setTrans] = useState(false); // 해석 기본 OFF

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
            {/* 우상단 읽기도움 토글 — 후리가나(ON)·해석(OFF). 개별(PRD 8.4). */}
            <View style={S.toggleRow}>
              <Toggle t={t} label="후리가나" on={furi} onPress={() => setFuri((v) => !v)} />
              <Toggle t={t} label="해석" on={trans} onPress={() => setTrans((v) => !v)} />
            </View>

            <View style={S.tomoWrap}><Tomo scale={0.55} pose="read" showNote={false} /></View>
            <Text style={[S.title, { color: t.textHigh }, keepAll]}>{letter.title}</Text>
            <Text style={[S.date, { color: t.textLow }]}>{letter.dateLabel}</Text>

            <View style={S.lines}>
              {letter.lines.map((ln, i) => (
                <View key={i} style={S.lineBlock}>
                  <Ruby base={ln.base} ruby={ln.ruby} show={furi} size={17} color={t.textHigh} />
                  {trans ? <Text style={[S.trans, { color: t.textMid }, keepAll]}>{ln.ko}</Text> : null}
                </View>
              ))}
            </View>

            <Text style={[S.signoff, { color: t.brandText }]} lang="ja">{letter.signoff}</Text>
          </View>

          <Pressable style={[S.btn, { backgroundColor: t.brand }]} onPress={() => nav.pop()} accessibilityRole="button" accessibilityLabel="닫기">
            <Text style={[S.btnText, { color: t.onBrand }]}>닫기</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Toggle({ t, label, on, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label} ${on ? '끄기' : '보기'}`}
      style={[
        tStyles.toggle,
        on ? { backgroundColor: t.action, borderColor: t.action } : { backgroundColor: t.bgSurface, borderColor: t.borderStrong },
      ]}
    >
      <Text style={[tStyles.toggleText, { color: on ? t.onAction : t.textMid }]}>{label}</Text>
    </Pressable>
  );
}

const tStyles = StyleSheet.create({
  toggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
  toggleText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600' },
});

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    appTitle: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    body: { padding: 16, gap: 14 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    missing: { fontFamily: fonts.ko, fontSize: 14, textAlign: 'center' },
    paper: { borderRadius: radius.lg, padding: 22, gap: 6, alignItems: 'flex-start' },
    toggleRow: { flexDirection: 'row', alignSelf: 'flex-end', gap: 6, marginBottom: 2 },
    tomoWrap: { alignSelf: 'center', marginBottom: 6 },
    title: { fontFamily: fonts.ko, fontSize: 19, fontWeight: '700' },
    date: { fontFamily: fonts.ko, fontSize: 12, marginBottom: 10 },
    lines: { gap: 16, marginTop: 2, alignSelf: 'stretch' },
    lineBlock: { gap: 3 },
    trans: { fontFamily: fonts.ko, fontSize: 13, lineHeight: 19 },
    signoff: { fontFamily: fonts.jp, fontSize: 14, fontWeight: '700', alignSelf: 'flex-end', marginTop: 16 },
    btn: { height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
  });
}
