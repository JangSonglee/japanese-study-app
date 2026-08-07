import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';

/**
 * MY 홈 (Hi-fi 34) — 프로필 요약 + 메뉴.
 * 인증 스캐폴드(2026-07-31): 게스트=「Google로 시작하기」, 로그인=닉네임·이메일+로그아웃.
 *  · 콘텐츠 학습은 게스트도 무제한(PRD 1.3). 로그인은 내 데이터(오답노트·스트릭·진도·우표)를 남기는 선택.
 *  · 🔴 provider 미설정(GCP 키 전)엔 signInWithGoogle이 에러 → 「준비 중」 안내로 방어(크래시 금지).
 */
export default function MyScreen({ nav }) {
  const { t } = useTheme();
  const { user, signInWithGoogle, signOut } = useAuth();
  const [authMsg, setAuthMsg] = useState('');
  const S = makeStyles(t);

  const nickname = user ? (user.user_metadata?.name || user.email?.split('@')[0] || '학습자') : null;

  async function onGoogle() {
    setAuthMsg('');
    const r = await signInWithGoogle();
    if (!r.ok) setAuthMsg('로그인 준비 중이에요. 곧 열려요.');
    // 성공 시엔 Google 로 리다이렉트되어 이 화면을 떠난다.
  }

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.title, { color: t.textHigh }]}>MY</Text>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        {/* 프로필 요약 — 게스트/로그인 분기. 토모(평소 밝기·말 없음). */}
        <View style={[S.profile, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
          <View style={S.tomoWrap}>
            <Tomo scale={0.7} pose="bright" showNote={false} />
          </View>
          <View style={S.profileText}>
            <Text style={[S.name, { color: t.textHigh }]}>{user ? nickname : '게스트'}</Text>
            <Text style={[S.subtle, { color: t.textMid }, keepAll]}>
              {user ? user.email : '로그인하면 오답노트·스트릭·진도가 기기 너머로 이어져요'}
            </Text>
          </View>
        </View>

        {/* 로그인 액션 (게스트일 때만) */}
        {!user ? (
          <>
            <Pressable
              onPress={onGoogle}
              accessibilityRole="button"
              accessibilityLabel="Google로 시작하기"
              style={[S.googleBtn, { backgroundColor: t.brand }]}
            >
              <Text style={[S.googleText, { color: t.onBrand }]}>Google로 시작하기</Text>
            </Pressable>
            {authMsg ? <Text style={[S.authMsg, { color: t.textMid }, keepAll]}>{authMsg}</Text> : null}
          </>
        ) : null}

        {/* 보관함 — 토모의 편지 컬렉션 */}
        <Text style={[S.section, { color: t.textLow }]}>보관함</Text>
        <MenuRow t={t} label="편지함" onPress={() => nav.push('letterBox')} />
        <MenuRow t={t} label="오답노트" onPress={() => nav.push('wrongNote')} />

        {/* 학습 — 코스 전환. IA(03·Core Flows): 코스 전환은 MY·설정에서. */}
        <Text style={[S.section, { color: t.textLow }]}>학습</Text>
        <MenuRow t={t} label="코스 추천 다시 받기" onPress={() => nav.push('onboarding')} />
        <MenuRow t={t} label="코스 전환" onPress={() => nav.push('courses')} />

        {/* 🧪 Figma 재현 테스트 진입 (임시) — 홈 리디자인(배너형) */}
        <Text style={[S.section, { color: t.textLow }]}>미리보기 (테스트)</Text>
        <MenuRow t={t} label="홈 리디자인 · 배너형" onPress={() => nav.push('homeV3')} />
        <MenuRow t={t} label="홈 리디자인 · 오늘의 표현(v4)" onPress={() => nav.push('homeV4')} />
        <MenuRow t={t} label="전역 5탭 셸 (홈·학습·단어장·번역·MY)" onPress={() => nav.push('shell')} />

        {/* 설정 */}
        <Text style={[S.section, { color: t.textLow }]}>설정</Text>
        <MenuRow t={t} label="설정 · 읽기 도움" onPress={() => nav.push('settings')} />
        <MenuRow t={t} label="서비스 정보" onPress={() => nav.push('about')} />

        {/* 계정 (로그인일 때만) */}
        {user ? (
          <>
            <Text style={[S.section, { color: t.textLow }]}>계정</Text>
            <MenuRow t={t} label="로그아웃" onPress={signOut} />
          </>
        ) : null}
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
    title: { flex: 1, fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600' },
    body: { padding: 16, paddingBottom: 88, gap: 10 },
    profile: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: radius.lg, padding: 16,
    },
    tomoWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    profileText: { flex: 1, gap: 3 },
    name: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
    subtle: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '400', ...keepAll },
    googleBtn: { height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    googleText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
    authMsg: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '400', textAlign: 'center', ...keepAll },
    section: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600', marginTop: 6 },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: radius.lg, padding: 16,
    },
    rowLabel: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '600' },
    chev: { fontFamily: fonts.ko, fontSize: 22 },
  });
}
