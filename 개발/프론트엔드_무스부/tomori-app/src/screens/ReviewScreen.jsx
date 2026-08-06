import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from '../components/Icon';
import Ruby from '../components/Ruby';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll } from '../theme/tokens';
import { loadReviewItems } from '../data/home';

/**
 * 오늘의 3분 복습 — 오늘 학습한 세션들 중 랜덤 1세션(홈에서 review_sig 전달)을
 * 읽기 전용으로 다시 보여준다(다시 확인용, 채점·기록 없음).
 *  · 단어/문법 = 표제어·문형 + 뜻(+예문). 독해/청해 = 지문/스크립트 + 문제·정답·해설.
 *  · 게스트·서명 없음·항목 0건이면 담담한 안내.
 */
const AREA_LABEL = { vocab: '단어 · 어휘', grammar: '문법 · 문형', reading: '독해', listening: '청해' };

export default function ReviewScreen({ nav, sig }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const [data, setData] = useState(undefined); // undefined=로딩, { source, items }

  useEffect(() => {
    let alive = true;
    loadReviewItems(sig).then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setData({ source: '', items: [] }); });
    return () => { alive = false; };
  }, [sig]);

  const source = data && data.source ? data.source : '';
  const items = data && data.items ? data.items : [];
  const card = [S.card, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }];

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.appTitle, { color: t.textHigh }]}>오늘의 3분 복습</Text>
      </View>

      {data === undefined ? (
        <View style={S.center}><ActivityIndicator color={t.brand} /><Text style={[S.dim, { color: t.textMid }]}>불러오는 중…</Text></View>
      ) : items.length === 0 ? (
        <View style={S.center}>
          <Tomo scale={0.6} pose="sit" showNote={false} />
          <Text style={[S.dim, { color: t.textMid }, keepAll]}>복습할 세션이 없어요.</Text>
          <Text style={[S.dimSub, { color: t.textLow }, keepAll]}>오늘 학습을 완료하면 여기서 다시 볼 수 있어요.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={S.body}>
          <View style={S.headRow}>
            <View style={[S.areaChip, { backgroundColor: t.sunk }]}>
              <Text style={[S.areaChipText, { color: t.textMid }]}>{AREA_LABEL[source] || '학습'}</Text>
            </View>
            <Text style={[S.headCount, { color: t.textMid }]}>{items.length}개 다시 보기</Text>
          </View>

          {items.map((c, i) => (
            <View key={c.key || i} style={card}>
              {source === 'vocab' || source === 'grammar' ? (
                <>
                  <Ruby base={(c.front && c.front.base) || c.headword || c.pattern || ''} ruby={(c.front && c.front.ruby) || []} show size={source === 'vocab' ? 20 : 18} color={t.textHigh} />
                  {source === 'vocab' && c.reading ? <Text style={[S.reading, { color: t.textLow }]} lang="ja">{c.reading}</Text> : null}
                  <Text style={[S.meaning, { color: t.textMid }, keepAll]}>{c.meaning}</Text>
                  {c.example ? (
                    <View style={[S.exBox, { backgroundColor: t.sunk }]}>
                      <Ruby base={c.example.base} ruby={c.example.ruby || []} show size={14} color={t.textMid} />
                      {c.exampleKo ? <Text style={[S.exKo, { color: t.textLow }, keepAll]}>{c.exampleKo}</Text> : null}
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  {c.title ? <Text style={[S.title, { color: t.textHigh }, keepAll]}>{c.title}</Text> : null}
                  {c.question ? (
                    <>
                      <Text style={[S.qLabel, { color: t.textLow }]}>문제</Text>
                      <Ruby base={(c.question.stem && c.question.stem.base) || ''} ruby={(c.question.stem && c.question.stem.ruby) || []} show size={16} color={t.textHigh} />
                      {(c.question.choices || []).filter((x) => x.correct).map((ch, j) => (
                        <Text key={j} style={[S.answer, { color: t.success }]} lang="ja">정답 · {ch.front && ch.front.base}</Text>
                      ))}
                      {c.question.explanation ? (
                        <View style={[S.exBox, { backgroundColor: t.sunk }]}>
                          <Text style={[S.exKo, { color: t.textMid }, keepAll]}>{c.question.explanation}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}
            </View>
          ))}

          <Pressable style={[S.doneBtn, { backgroundColor: t.brand }]} onPress={() => nav.pop()} accessibilityRole="button">
            <Text style={[S.doneBtnText, { color: t.onBrand }]}>복습 완료</Text>
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
    appTitle: { flex: 1, fontFamily: fonts.ko, fontSize: 16, fontWeight: '600' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
    dim: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    dimSub: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '400', textAlign: 'center' },

    body: { padding: 16, gap: 10, paddingBottom: 40 },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
    areaChip: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    areaChipText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600' },
    headCount: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '500' },

    card: { borderRadius: radius.lg, padding: 16, gap: 8 },
    reading: { fontFamily: fonts.jp, fontSize: 14 },
    meaning: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '500', lineHeight: 22 },
    title: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
    qLabel: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600' },
    answer: { fontFamily: fonts.jp, fontSize: 15, fontWeight: '600' },
    exBox: { borderRadius: radius.md, padding: 12, gap: 4 },
    exKo: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '400', lineHeight: 20 },

    doneBtn: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    doneBtnText: { fontFamily: fonts.ko, fontSize: 16, fontWeight: '600' },
  });
}
