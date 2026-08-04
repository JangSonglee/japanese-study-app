import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Image } from 'react-native';
import Ruby from '../components/Ruby';
import Tomo from '../components/Tomo';
import { fonts } from '../theme/tokens';

/**
 * 홈 (리디자인) - 배너형 — Figma `시험 일정 등록 - 제거`(node 59:3819) 재현.
 *  · 대표님 Figma→코드 파이프라인 테스트용. 이 프레임의 팔레트·에셋·문구·여백을 그대로 옮겼다.
 *    🔴 색은 앱 웜 토큰(brand #F5B942)과 다른 이 프레임 값(#F6AA13 등)을 의도적으로 사용.
 *  · 핵심 동작 = 「JLPT 시험 일정 등록」 배너의 X(제거). 좌(있음)→우(제거)를 한 화면 상태로 재현.
 *  · 히어로 토모 = 앱 Tomo(pose intellectual) 단일 아트. Figma의 스프라이트 크롭 대신 정식 컴포넌트.
 *  · 폰트 = Pretendard(fonts.ko, 400/500/600/700)·일본어 Noto Sans JP(Ruby). index.html @font-face 로드.
 *  · 여백 = Figma 구조: 바깥 gap 24 / 콘텐츠 그룹 gap 16 / 카드 padding 16 / 히어로 padding 20.
 */

const C = {
  bg: '#FCF8F2',
  surface: '#FFFFFF',
  cardWarm: '#FFFCF7',   // orange/99
  heroAmber: '#FFCA7C',
  brandAmber: '#F6AA13',
  mainText: '#303030',
  brandMainText: '#2A211D',
  sub: '#737373',
  greetSub: '#705F58',
  chipBg: '#FFD49C',     // orange/80
  chipText: '#9C5800',   // orange/30
  ctaDark: '#3B2A22',
  inverse: '#FFFFFF',
  borderStrong: '#C2C4C8',
  cardShadow: '0px 2px 6px rgba(122,84,30,0.10)',
  navShadow: '0px 0px 6px rgba(122,84,30,0.10)',
};

const A = (f) => ({ uri: `images/figma/${f}` });

// 오늘의 N3 표현 후리가나 좌표(夢は逃げない。逃げるのはいつも自分だ)
const QUOTE = '夢は逃げない。逃げるのはいつも自分だ';
const QUOTE_RUBY = [
  { s: 0, e: 1, rt: 'ゆめ' },     // 夢
  { s: 2, e: 3, rt: 'に' },       // 逃
  { s: 7, e: 8, rt: 'に' },       // 逃
  { s: 15, e: 17, rt: 'じぶん' }, // 自分
];

const TABS = [
  { key: 'home', label: '홈', icon: 'tab-home.svg', route: null },
  { key: 'learn', label: '학습하기', icon: 'tab-document.svg', route: 'jlptHub' },
  { key: 'vocab', label: '단어장', icon: 'tab-bookmark.svg', route: null },
  { key: 'trans', label: '번역', icon: 'tab-scan.svg', route: null },
  { key: 'my', label: '내 정보', icon: 'tab-profile.svg', route: 'my' },
];

export default function HomeV3Screen({ nav }) {
  const [bannerShown, setBannerShown] = useState(true);

  return (
    <View style={S.screen}>
      <ScrollView contentContainerStyle={S.body}>
        {/* 헤더 — 불씨 + 연속 학습. 🔴 fire.png는 1536×1024 통이미지(불꽃이 일부)라 작게 나와 이모지로 대체(대표님 요청 「불꽃 키움」). */}
        <View style={S.headerRow}>
          <Text style={S.fireEmoji}>🔥</Text>
          <Text style={S.streakText}>연속 학습 1일차</Text>
        </View>

        {/* 콘텐츠 그룹 (Figma gap 16) */}
        <View style={S.group}>
          {/* 인사 */}
          <View style={S.greet}>
            <Text style={S.greetTitle}>안녕하세요, 송이님</Text>
            <Text style={S.greetSub}>짧게라도 괜찮아요. 오늘의 불씨를 이어가요!</Text>
          </View>

          {/* 히어로 — 레벨 테스트 */}
          <View style={S.hero}>
            <Image source={A('paper.png')} style={S.heroPaper} resizeMode="cover" />
            <View style={S.heroTomo} pointerEvents="none">
              <Tomo pose="intellectual" scale={1.15} showNote={false} />
            </View>
            <View style={S.heroText}>
              <Text style={S.heroLabel}>JLPT</Text>
              <Text style={S.heroTitle}>레벨 테스트를 해볼까요 ?</Text>
              <View style={S.heroRow}>
                <Text style={S.heroDesc}>단어 · 어휘 · 문법</Text>
                <View style={S.timeChip}><Text style={S.timeChipText}>약 5분~10분 소요</Text></View>
              </View>
            </View>
            <View style={S.progRow}>
              <View style={S.progTrack}><View style={S.progFill} /></View>
              <Text style={S.progText}>0<Text style={S.progPct}>%</Text></Text>
            </View>
            <Pressable style={S.cta}><Text style={S.ctaText}>레벨테스트 보러 가기</Text></Pressable>
          </View>

          {/* 시험 일정 등록 배너 — X 로 제거(등록/제거) */}
          {bannerShown ? (
            <View style={S.banner}>
              <View style={S.bannerLeft}>
                <Image source={A('calendar.svg')} style={S.calIcon} resizeMode="contain" />
                <Text style={S.bannerText} numberOfLines={1}>JLPT 시험 일정 등록하고, 일정 챙기세요!</Text>
              </View>
              <Pressable
                onPress={() => setBannerShown(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="시험 일정 배너 닫기"
                style={S.bannerClose}
              >
                <Image source={A('close.svg')} style={S.closeIcon} resizeMode="contain" />
              </Pressable>
            </View>
          ) : null}

          {/* 통계 2칸 */}
          <View style={S.statRow}>
            <View style={S.statCard}>
              <View style={S.statTextWrap}>
                <Text style={S.statLabel}>오늘 진행한 학습</Text>
                <Text style={S.statBig}>0<Text style={S.statUnit}>개</Text></Text>
              </View>
              <Image source={A('notebook.png')} style={S.notebook} resizeMode="contain" />
            </View>
            <View style={S.statCard}>
              <View style={S.statTextWrap}>
                <Text style={S.statLabel}>모은 우표</Text>
                <Text style={S.statBig}>10<Text style={S.statUnit}>/14</Text></Text>
              </View>
              <Image source={A('stamps.png')} style={S.stamps} resizeMode="contain" />
            </View>
          </View>

          {/* 오늘의 N3 표현 */}
          <View style={S.quoteCard}>
            <View style={S.quoteHead}>
              <Text style={S.quoteTitle}>오늘의 N3 표현</Text>
              <View style={S.quoteToggles}>
                <View style={S.toggleChip}><Text style={S.toggleChipText}>해석</Text></View>
                <View style={S.toggleChip}><Text style={S.toggleChipText}>단어</Text></View>
              </View>
            </View>
            <View style={S.quoteBody}>
              <Ruby base={QUOTE} ruby={QUOTE_RUBY} show size={16} color={C.brandMainText} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 하단 탭 */}
      <View style={S.nav}>
        {TABS.map((tb) => {
          const active = tb.key === 'home';
          return (
            <Pressable
              key={tb.key}
              style={S.tab}
              onPress={() => { if (tb.route && nav) nav.push(tb.route); }}
              accessibilityRole="button"
              accessibilityLabel={tb.label}
            >
              <Image source={A(tb.icon)} style={[S.tabIcon, { opacity: active ? 1 : 0.55 }]} resizeMode="contain" />
              <Text style={[S.tabLabel, { color: active ? C.brandAmber : C.sub }]}>{tb.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  body: { padding: 20, gap: 24, paddingBottom: 90 },
  group: { gap: 16 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fireEmoji: { fontSize: 20, lineHeight: 24 },
  streakText: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '500', color: C.mainText },

  greet: { gap: 2 },
  greetTitle: { fontFamily: fonts.ko, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: C.brandMainText },
  greetSub: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '400', color: C.greetSub },

  hero: {
    backgroundColor: C.heroAmber, borderRadius: 16, padding: 20, gap: 12,
    overflow: 'hidden', position: 'relative', boxShadow: C.cardShadow,
  },
  // squared-paper-texture — 앰버 위 격자 질감. Figma는 mix-blend overlay·opacity .8. RN Web은 blend 지원이 불안정해
  //   opacity 로 노출(격자가 보이도록). 히어로 배경 바로 위, 텍스트·토모 아래.
  // 종이질감 — CSS(index.html)에서 mix-blend-mode:overlay 적용(RN Web은 blend 스타일 무시). opacity로 강도 조절.
  heroPaper: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.85 },
  heroTomo: { position: 'absolute', right: 2, bottom: -4 },
  heroText: { gap: 6, alignSelf: 'flex-start', maxWidth: 160 },
  heroLabel: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '500', color: C.brandAmber },
  heroTitle: { fontFamily: fonts.ko, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: C.brandMainText },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  heroDesc: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '500', color: C.brandMainText },
  timeChip: { backgroundColor: C.chipBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  timeChipText: { fontFamily: fonts.ko, fontSize: 11, fontWeight: '500', color: C.chipText },

  progRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 150 },
  progTrack: { flex: 1, height: 6, backgroundColor: C.chipBg, borderRadius: 999, overflow: 'hidden' },
  progFill: { width: 10, height: 6, backgroundColor: C.brandAmber, borderRadius: 999 },
  progText: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '500', color: C.brandMainText },
  progPct: { fontSize: 10 },

  cta: {
    backgroundColor: C.ctaDark, borderRadius: 8, height: 33, width: 150,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.ko, fontSize: 16, fontWeight: '500', color: C.inverse },

  banner: {
    backgroundColor: C.cardWarm, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, boxShadow: C.cardShadow,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  calIcon: { width: 16, height: 16 },
  bannerText: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '500', color: C.brandMainText, flexShrink: 1 },
  bannerClose: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { width: 10, height: 10 },

  statRow: { flexDirection: 'row', gap: 16 },
  statCard: {
    flex: 1, backgroundColor: C.cardWarm, borderRadius: 16, padding: 16,
    overflow: 'hidden', position: 'relative', minHeight: 76, boxShadow: C.cardShadow,
  },
  statTextWrap: { gap: 4 },
  statLabel: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600', color: C.brandMainText },
  statBig: { fontFamily: fonts.ko, fontSize: 24, fontWeight: '700', letterSpacing: -0.5, color: C.brandMainText },
  statUnit: { fontFamily: fonts.ko, fontSize: 16, fontWeight: '400' },
  notebook: { position: 'absolute', right: 6, bottom: 10, width: 36, height: 36 },
  stamps: { position: 'absolute', right: 8, bottom: 12, width: 40, height: 40 },

  quoteCard: { backgroundColor: C.cardWarm, borderRadius: 16, padding: 16, gap: 8, boxShadow: C.cardShadow },
  quoteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quoteTitle: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600', color: C.brandMainText },
  quoteToggles: { flexDirection: 'row', gap: 8 },
  toggleChip: { borderWidth: 1, borderColor: C.borderStrong, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  toggleChipText: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '500', color: C.sub },
  quoteBody: { paddingTop: 6 },

  nav: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 70,
    backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center',
    boxShadow: C.navShadow,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabIcon: { width: 18, height: 18 },
  tabLabel: { fontFamily: fonts.ko, fontSize: 11, fontWeight: '500' },
});
