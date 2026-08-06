import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Ruby from '../components/Ruby';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';
import { loadSavedWords, unsaveWord } from '../data/wordbook';

/**
 * 단어장 (나만의 단어장 · JLPT MVP) — 저장한 단어 모아보기.
 *  · 단어 카드·오늘의 표현에서 별(★)로 저장한 단어가 실 Supabase(saved_words)에서 모여 온다.
 *  · PRD §6: 단일 태그(현재 JLPT만) + 급수(N5~N1) 하위필터. 콘텐츠가 JLPT뿐이라 급수 필터만 노출.
 *  · 게스트는 로그인 안내. 별을 다시 누르면 목록에서 해제(unsave).
 */
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export default function VocabBookScreen({ nav }) {
  const { t } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState(null);   // null=로딩, []=없음
  const [level, setLevel] = useState('전체');
  const S = makeStyles(t);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRows([]); return; }
    let alive = true;
    loadSavedWords().then((r) => { if (alive) setRows(r); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [user, authLoading]);

  // 급수별 개수 — 필터 칩에 표시. 저장 단어가 있는 급수만 칩 노출.
  const counts = useMemo(() => {
    const c = {};
    (rows || []).forEach((r) => { if (r.level) c[r.level] = (c[r.level] || 0) + 1; });
    return c;
  }, [rows]);
  const chips = useMemo(() => ['전체', ...LEVELS.filter((l) => counts[l])], [counts]);

  const visible = useMemo(
    () => (rows || []).filter((r) => level === '전체' || r.level === level),
    [rows, level],
  );

  async function onUnsave(dedup) {
    setRows((prev) => (prev || []).filter((r) => r.dedup !== dedup)); // 낙관적 제거
    try { await unsaveWord(dedup); } catch { /* 실패해도 목록 유지 안 함(다음 로드시 복원) */ }
  }

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.head}>
        <Text style={[S.title, { color: t.textHigh }]}>단어장</Text>
        {rows && rows.length ? <Text style={[S.countTop, { color: t.textLow }]}>{rows.length}개</Text> : null}
      </View>

      {/* 급수 필터 — 저장 단어가 여러 급수에 있을 때만 노출 */}
      {chips.length > 2 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.chipScroll} contentContainerStyle={S.chipRow}>
          {chips.map((c) => {
            const on = c === level;
            return (
              <Pressable
                key={c}
                onPress={() => setLevel(c)}
                style={[S.chip, { borderColor: on ? t.brand : t.border, backgroundColor: on ? t.brand : 'transparent' }]}
                accessibilityRole="button"
                accessibilityLabel={`${c} 필터`}
              >
                <Text style={[S.chipText, { color: on ? t.onBrand : t.textMid }]}>
                  {c}{c !== '전체' ? ` ${counts[c]}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {rows === null ? (
        <View style={S.center}><Text style={[S.msg, { color: t.textLow }]}>불러오는 중…</Text></View>
      ) : !user ? (
        <View style={S.center}>
          <Tomo scale={0.7} pose="sit" showNote={false} />
          <Text style={[S.msg, { color: t.textMid }, keepAll]}>로그인하면 저장한 단어가 모여요.</Text>
          <Text style={[S.sub, { color: t.textLow }, keepAll]}>내 정보 탭에서 로그인할 수 있어요.</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={S.center}>
          <Tomo scale={0.7} pose="sit" showNote={false} />
          <Text style={[S.msg, { color: t.textMid }, keepAll]}>저장한 단어가 여기 모여요.</Text>
          <Text style={[S.sub, { color: t.textLow }, keepAll]}>단어 카드나 오늘의 표현에서 별(★)로 담아보세요.</Text>
        </View>
      ) : (
        <ScrollView style={S.listScroll} contentContainerStyle={S.list}>
          {visible.map((r) => (
            <View key={r.dedup} style={[S.row, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
              <View style={S.rowText}>
                <View style={S.jaLine}>
                  {r.ruby && r.ruby.base ? (
                    <Ruby base={r.ruby.base} ruby={r.ruby.ruby || []} show size={18} rubyRatio={0.6} color={t.textHigh} />
                  ) : (
                    <Text style={[S.ja, { color: t.textHigh }]} lang="ja">{r.ja}</Text>
                  )}
                  {r.level ? <View style={[S.lvBadge, { backgroundColor: t.bgBase, borderColor: t.border }]}><Text style={[S.lvText, { color: t.textMid }]}>{r.level}</Text></View> : null}
                </View>
                <Text style={[S.meaning, { color: t.textMid }, keepAll]}>{r.meaning}</Text>
              </View>
              <Pressable onPress={() => onUnsave(r.dedup)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${r.ja} 저장 해제`}>
                <Icon name="star" size={22} color={t.brand} filled />
              </Pressable>
            </View>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    head: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
    title: { fontFamily: fonts.ko, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
    countTop: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '500' },

    chipScroll: { flexGrow: 0, flexShrink: 0 },
    chipRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, flexDirection: 'row' },
    listScroll: { flex: 1 },
    chip: { height: 32, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    chipText: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, paddingBottom: 100 },
    msg: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    sub: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '400', textAlign: 'center' },

    list: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 16 },
    rowText: { flex: 1, gap: 6, minWidth: 0 },
    jaLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    ja: { fontFamily: fonts.jp, fontSize: 18, lineHeight: 27 },
    lvBadge: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6, borderWidth: 1 },
    lvText: { fontFamily: fonts.ko, fontSize: 11, lineHeight: 16.5, fontWeight: '600' },
    meaning: { fontFamily: fonts.ko, fontSize: 14, lineHeight: 21, fontWeight: '400' },
  });
}
