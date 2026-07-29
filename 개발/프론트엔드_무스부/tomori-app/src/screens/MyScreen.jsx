import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

/**
 * MY 홈 (Hi-fi 34) — 프로필 요약 + 메뉴.
 *
 * 사양 근거 / 범위(2026-07-28):
 *  · 로그인(Auth) 전이라 프로필은 「게스트」. 로그인이 붙으면 이 자리에 계정·통계가 들어온다.
 *  · 이 조각에서 실동작하는 메뉴는 「설정」(읽기도움 + 크레딧)뿐.
 *    학습통계·구독·알림·계정은 데이터/기능이 없어 노출하지 않는다(미완성 미노출).
 */
export default function MyScreen({ nav }) {
  const { t } = useTheme();
  const S = makeStyles(t);
  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.title, { color: t.textHigh }]}>MY</Text>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        {/* 프로필 요약 — 게스트. 토모(평소 밝기·말 없음)가 곁을 지킨다(MY=쉬는 화면, PRD 14.2.1). */}
        <View style={[S.profile, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
          <View style={S.tomoWrap}>
            <Tomo scale={0.7} showNote={false} />
          </View>
          <View style={S.profileText}>
            <Text style={[S.name, { color: t.textHigh }]}>게스트</Text>
            <Text style={[S.subtle, { color: t.textMid }]}>로그인은 곧 열려요</Text>
          </View>
        </View>

        {/* 메뉴 */}
        <Text style={[S.section, { color: t.textLow }]}>설정</Text>
        <MenuRow t={t} label="설정 · 읽기 도움" onPress={() => nav.push('settings')} />
        <MenuRow t={t} label="서비스 정보" onPress={() => nav.push('about')} />
      </ScrollView>
    </View>
  );
}

function MenuRow({ t, label, onPress }) {
  const S = makeStyles(t);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[S.row, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}
    >
      <Text style={[S.rowLabel, { color: t.textHigh }]}>{label}</Text>
      <Icon name="forward" size={20} color={t.textLow} />
    </Pressable>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    back: { fontSize: 26, width: 20 },
    title: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    body: { padding: 16, gap: 10 },
    profile: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: radius.md, padding: 16,
    },
    tomoWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    profileText: { flex: 1, gap: 3 },
    name: { fontFamily: fonts.ko, fontSize: 16, fontWeight: '700' },
    subtle: { fontFamily: fonts.ko, fontSize: 12 },
    section: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '600', marginTop: 6 },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: radius.md, padding: 16,
    },
    rowLabel: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600' },
    chev: { fontFamily: fonts.ko, fontSize: 22 },
  });
}
