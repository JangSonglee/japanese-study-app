import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import BottomSheet from '../components/BottomSheet';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';
import { LEVELS } from '../data/vocab';

// 급수별 난이도 라벨 — 0/xxx·0% 같은 사기 저하 숫자 대신 「어디쯤인지」만 담백하게(철학: 북돋는다).
const LEVEL_LABEL = { N5: '입문', N4: '초급', N3: '중급', N2: '중상급', N1: '고급' };

/**
 * JLPT 허브 (Hi-fi 11) — 급수 선택 + 영역 리스트.
 *
 * 사양 근거(JLPT_플로우 섹션 C):
 *  · 영역 선택은 「가로 탭」이 아니라 세로 리스트(급수 + 영역별 진행률 + >). 이게 영역 전환 UI.
 *  · 코스 아래 단위(영역)는 콘텐츠 없으면 「아예 노출하지 않는다」 → 지금은 단어만 보인다.
 *    (문법/독해/청해는 슈슈 콘텐츠 수집 후 이 리스트에 켠다 — 병렬 트랙 2-c.)
 *  · 진행률(수집형 누적)은 서버 원장 연결 후. 지금은 비워 정직 표기.
 *  · 코스색은 4px 액센트 바 + 글자로만(사양서 2장).
 */
const AREAS = [
  { key: 'vocab', name: '단어·어휘', route: 'wordSession', ready: true },
  { key: 'grammar', name: '문법·문형', route: 'grammarSession', ready: true },
  { key: 'reading', name: '독해', route: 'readingSession', ready: true },
  { key: 'listening', name: '청해', route: 'listeningSession', ready: true },
];

export default function JlptHubScreen({ nav }) {
  const { t } = useTheme();
  const [level, setLevel] = useState('N5');
  const [sheetOpen, setSheetOpen] = useState(false);
  const S = makeStyles(t);

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <View style={S.titleWrap}>
          <View style={[S.accent, { backgroundColor: t.courseJlpt }]} />
          <Text style={[S.title, { color: t.courseJlptText }]}>JLPT</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        {/* 급수 선택 — 셀렉트 박스 → 바텀시트 (레퍼런스 패턴). 칩 나열 대신 스케일되는 선택 UI. */}
        <Text style={[S.section, { color: t.textLow }]}>급수</Text>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`급수 선택, 현재 ${level}`}
          style={[S.select, { backgroundColor: t.bgSurface, borderColor: t.borderStrong }]}
        >
          <LevelBadge t={t} level={level} />
          <View style={S.selectText}>
            <Text style={[S.selectName, { color: t.textHigh }]}>JLPT {level}</Text>
            <Text style={[S.selectSub, { color: t.textMid }]}>{LEVEL_LABEL[level]}</Text>
          </View>
          <Icon name="down" size={20} color={t.textMid} />
        </Pressable>

        {/* 영역 리스트 */}
        <Text style={[S.section, { color: t.textLow, marginTop: 8 }]}>영역</Text>
        {AREAS.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => nav.push(a.route, { level })}
            accessibilityRole="button"
            style={[S.areaCard, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}
          >
            <View style={S.areaText}>
              <Text style={[S.areaName, { color: t.textHigh }]}>{a.name}</Text>
              <Text style={[S.areaProg, { color: t.textMid }]}>{level} · 진행률은 로그인 후 표시</Text>
            </View>
            <Icon name="forward" size={20} color={t.textLow} />
          </Pressable>
        ))}

        <Text style={[S.note, { color: t.textMid }]}>
          청해는 음성을 들으며 대본으로 함께 확인할 수 있어요.
        </Text>
      </ScrollView>

      {/* 급수 선택 바텀시트 */}
      <BottomSheet visible={sheetOpen} title="JLPT 급수" onClose={() => setSheetOpen(false)}>
        <View style={S.sheetList}>
          {LEVELS.map((lv) => {
            const active = lv === level;
            return (
              <Pressable
                key={lv}
                onPress={() => { setLevel(lv); setSheetOpen(false); }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[S.sheetRow, active && { backgroundColor: t.sunk }]}
              >
                <LevelBadge t={t} level={lv} />
                <View style={S.selectText}>
                  <Text style={[S.selectName, { color: t.textHigh }]}>JLPT {lv}</Text>
                  <Text style={[S.selectSub, { color: t.textMid }]}>{LEVEL_LABEL[lv]}</Text>
                </View>
                {active ? <Icon name="star" size={16} color={t.courseJlptText} filled /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

function LevelBadge({ t, level }) {
  return (
    <View style={[bS.badge, { backgroundColor: t.courseJlpt }]}>
      <Text style={[bS.badgeText, { color: '#FFF9EC' }]}>{level}</Text>
    </View>
  );
}

const bS = StyleSheet.create({
  badge: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '700', fontVariant: ['tabular-nums'] },
});

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    back: { fontSize: 26, width: 20 },
    titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    accent: { width: 4, height: 16, borderRadius: radius.full },
    title: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
    body: { padding: 16, gap: 10 },
    section: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600' },
    select: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: radius.lg, borderWidth: 1, padding: 12,
    },
    selectText: { flex: 1, gap: 2 },
    selectName: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
    selectSub: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '400' },
    sheetList: { paddingHorizontal: 8, paddingBottom: 8 },
    sheetRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    },
    areaCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: radius.lg, padding: 16,
    },
    areaText: { flex: 1, gap: 3 },
    areaName: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
    areaProg: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '400', ...keepAll },
    chev: { fontFamily: fonts.ko, fontSize: 22 },
    note: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '400', marginTop: 6, ...keepAll },
  });
}
