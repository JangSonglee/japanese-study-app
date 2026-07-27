import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemeProvider } from './theme/ThemeContext';
import { getTheme, fonts } from './theme/tokens';
import WordCardScreen from './screens/WordCardScreen';
import { loadN5Cards } from './data/vocab';

/**
 * App — 수직 슬라이스 셸.
 *  · 실제 N5 CSV(public/data/N5_vocab.csv)를 fetch → 10장 카드.
 *  · 폰 프레임(320px) 안에 WordCardScreen. Hi-fi 목업과 폭을 맞춘다.
 *  · 라이트/다크 토글 — 두 테마 모두 눈으로 확인하기 위함.
 */
export default function App() {
  const [cards, setCards] = useState(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState('light');
  const t = getTheme(mode);

  useEffect(() => {
    loadN5Cards(10)
      .then((cs) => setCards(cs))
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  return (
    <View style={styles.stage}>
      <View style={styles.topbar}>
        <Text style={styles.brand}>토모리 · 단어 카드 (FE 슬라이스)</Text>
        <Pressable style={styles.modeBtn} onPress={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}>
          <Text style={styles.modeBtnText}>{mode === 'dark' ? '☀ 라이트' : '🌙 다크'}</Text>
        </Pressable>
      </View>

      <View style={[styles.phone, { backgroundColor: t.bgBase, borderColor: t.borderStrong }]}>
        <ThemeProvider mode={mode}>
          {err ? (
            <Text style={[styles.msg, { color: '#B5533D' }]}>데이터 로드 실패: {err}</Text>
          ) : !cards ? (
            <View style={styles.center}><ActivityIndicator /><Text style={[styles.msg, { color: t.textMid }]}>N5 카드 불러오는 중…</Text></View>
          ) : (
            <WordCardScreen cards={cards} />
          )}
        </ThemeProvider>
      </View>

      <Text style={styles.note}>실 Supabase N5 10장 · 후리가나/발음 토글은 카드 안에서</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    minHeight: '100%', alignItems: 'center', paddingVertical: 28, gap: 14,
    backgroundColor: '#EFE9E1',
  },
  topbar: {
    width: 320, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  brand: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '600', color: '#5D554C' },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#1A1613' },
  modeBtnText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600', color: '#FFF9EC' },
  phone: {
    width: 320, height: 640, borderRadius: 26, borderWidth: 1, overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(26,22,19,.18)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  msg: { fontFamily: fonts.ko, fontSize: 13, padding: 16, textAlign: 'center' },
  note: { fontFamily: fonts.ko, fontSize: 12, color: '#9C948B' },
});
