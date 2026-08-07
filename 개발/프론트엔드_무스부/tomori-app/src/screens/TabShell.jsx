import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import TabIcon from '../components/TabIcon';
import { fonts } from '../theme/tokens';
import HomeV4Screen from './HomeV4Screen';
import JlptHubScreen from './JlptHubScreen';
import VocabBookScreen from './VocabBookScreen';
import TranslateScreen from './TranslateScreen';
import MyScreen from './MyScreen';

/**
 * 전역 5탭 셸 — 홈·학습하기·단어장·번역·내 정보.
 *  · 탭 = 화면 전환(스택 push 아님). 하단 바 항상 유지, 활성 탭 앰버.
 *  · 상세 화면(세션·복습·설정 등)은 탭 화면이 nav.push 로 셸 위에 풀스크린으로 띄운다(탭 바 없이).
 *    → 그 사이 활성 탭은 모듈 레벨 SHELL_TAB 으로 보존(셸 재마운트 시 복원).
 *  · 홈 탭은 HomeV4(hideTabBar) — 자체 탭 바 대신 셸 바를 쓴다.
 */
const C = {
  bg: '#FCF8F2', navBg: '#FFFFFF', activeAmber: '#F6AA13', inactive: '#737373',
  navShadow: '0px 0px 6px rgba(122,84,30,0.10)',
};

const TABS = [
  { key: 'home', label: '홈' },
  { key: 'learn', label: '학습하기' },
  { key: 'vocab', label: '단어장' },
  { key: 'trans', label: '번역' },
  { key: 'my', label: '내 정보' },
];

let SHELL_TAB = 'home'; // 상세 push/pop 사이 활성 탭 보존

export default function TabShell({ nav, params }) {
  const [tab, setTab] = useState((params && params.tab) || SHELL_TAB);
  const switchTab = (k) => { SHELL_TAB = k; setTab(k); };

  return (
    <View style={S.screen}>
      <View style={S.content}>
        {tab === 'home' ? (
          <HomeV4Screen nav={nav} hideTabBar />
        ) : tab === 'learn' ? (
          <JlptHubScreen nav={nav} />
        ) : tab === 'vocab' ? (
          <VocabBookScreen nav={nav} />
        ) : tab === 'trans' ? (
          <TranslateScreen nav={nav} />
        ) : (
          <MyScreen nav={nav} />
        )}
      </View>

      <View style={S.nav}>
        {TABS.map((tb) => {
          const active = tb.key === tab;
          const col = active ? C.activeAmber : C.inactive;
          return (
            <Pressable
              key={tb.key}
              style={S.tab}
              onPress={() => switchTab(tb.key)}
              accessibilityRole="button"
              accessibilityLabel={tb.label}
            >
              <TabIcon name={tb.key} size={24} color={col} />
              <Text style={[S.tabLabel, { color: col }]}>{tb.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1 },
  // 🔴 nav = flex 형제(absolute 아님). 콘텐츠(flex:1)가 nav 위 공간만 차지 → 화면 내 BottomSheet가
  //    nav를 넘지 않고, nav는 항상 뷰포트 바닥에 고정(스테이지가 height 100%로 고정된 덕).
  nav: {
    height: 70, flexShrink: 0,
    backgroundColor: C.navBg, flexDirection: 'row', alignItems: 'center', boxShadow: C.navShadow,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontFamily: fonts.ko, fontSize: 11, lineHeight: 16.5, fontWeight: '500' },
});
