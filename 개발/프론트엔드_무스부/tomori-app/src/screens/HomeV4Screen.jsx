import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Image, useWindowDimensions } from 'react-native';
import Ruby from '../components/Ruby';
import Icon from '../components/Icon';
import { fonts, keepAll } from '../theme/tokens';

/**
 * 홈 (리디자인 v4) — Claude Design `오늘의 표현.dc.html`(프로젝트 "홈 화면 디자인 개선") 재현.
 *  · 대표님이 Claude Design에서 확정한 홈 전체 리디자인. 구조·팔레트·문구·여백을 그대로 옮겼다.
 *  · 미리보기 단계(MY › 미리보기 진입). 데이터는 아직 데모(DEMO) — 다음 단계에서 실데이터 배선
 *    (이어서 학습=「안다」 표시 단어 수 / vocab_goal_count, 대표님 결정 2026-08-07).
 *  · 히어로 캐릭터 = 앱 Tomo(정식 아트). 🅿️ Figma cat-tomo 전용 아트/배경(cat-background)은
 *    exact-asset 스왑 대기 — 지금은 앱 Tomo + 웜 배경으로 근사.
 *  · 해석·단어 토글 = dc.html 로직(showInterp/showWords) 그대로 useState 로 구현.
 *  · 폰트 = Pretendard(fonts.ko)·일본어 Noto Sans JP(Ruby). index.html @font-face 로드.
 *
 * 🔴 색 = 이 디자인 팔레트(#F6AA13 등) — HomeV3와 동일 계열(앱 웜 토큰과 별개, 의도적).
 */

const C = {
  bg: '#FCF8F2',
  heroBg: '#FFEEDA',     // cat-background 근사(웜 크림) — exact-asset 스왑 대기
  cardWarm: '#FFFCF7',   // orange/99
  brandAmber: '#F6AA13',
  brandMainText: '#2A211D',
  mainText: '#303030',
  sub: '#737373',
  greetSub: '#705F58',
  trackBg: '#FFD49C',    // orange/80
  ctaDark: '#3B2A22',
  darkCardText: '#FFFCF7',
  inverse: '#FFFFFF',
  wordKo: '#9C948B',
  borderStrong: '#C2C4C8',
  interpText: '#333333',
  cardShadow: '0px 2px 6px rgba(122,84,30,0.10)',
  navShadow: '0px 0px 6px rgba(122,84,30,0.10)',
};

const A = (f) => ({ uri: `images/figma/${f}` });

// 오늘의 N3 표현 — 夢は逃げない。逃げるのはいつも自分だ
const QUOTE = '夢は逃げない。逃げるのはいつも自分だ';
const QUOTE_RUBY = [
  { s: 0, e: 1, rt: 'ゆめ' },     // 夢
  { s: 2, e: 3, rt: 'に' },       // 逃
  { s: 7, e: 8, rt: 'に' },       // 逃
  { s: 15, e: 17, rt: 'じぶん' }, // 自分
];
const QUOTE_INTERP = '꿈은 도망치지 않는다. 도망치는 것은 언제나 자신이다.';
const QUOTE_WORDS = [
  { ja: '夢', ko: '꿈' },
  { ja: '逃げる', ko: '도망치다' },
];

// 하단 탭 — Figma 실아이콘(색 내장: 홈=amber 활성, 나머지=#737373 비활성).
const TABS = [
  { key: 'home', label: '홈', icon: 'ic-home.svg', route: null },
  { key: 'learn', label: '학습하기', icon: 'ic-Learning.svg', route: 'jlptHub' },
  { key: 'vocab', label: '단어장', icon: 'ic-Word.svg', route: null },
  { key: 'trans', label: '번역', icon: 'ic-translation.svg', route: null },
  { key: 'my', label: '내 정보', icon: 'ic-my.svg', route: 'my' },
];

// 데모 데이터 — 다음 단계에서 실데이터로 교체
const DEMO = {
  streakDays: 23,
  user: '송이',
  level: 'N3',
  vocabDone: 360,
  vocabTotal: 400,
  todayCount: 10,
  stampHave: 10,
  stampNeed: 14,
  dday: 42,
  reviewCount: 10,
};

export default function HomeV4Screen({ nav }) {
  const [showInterp, setShowInterp] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const [saved, setSaved] = useState(() => new Set(['逃げる']));
  // 히어로 3상태 — 실제론 데이터로 자동 결정(레벨 미정 / 오늘 학습 전 / 오늘 학습 후).
  // 미리보기라 상단 전환 버튼으로 셋 다 확인 가능(dev). 기본=학습 전.
  const [heroState, setHeroState] = useState('before'); // 'level' | 'before' | 'after'
  const D = DEMO;
  const pct = Math.round((D.vocabDone / D.vocabTotal) * 100);
  const remain = Math.max(0, D.vocabTotal - D.vocabDone);

  // 상태별 히어로 구성(멘트·급수·진행바·CTA·토모 아트).
  // 🅿️ 토모 아트 = 지금은 앱 Tomo pose 근사. Figma cat-tomo1/2/3 실아트는 스왑 대기(art 필드).
  const HERO = {
    level:  { badge: null, title: '레벨 테스트를 해볼까요?', showProg: false, cta: '레벨테스트 보러 가기', art: 'cat-tomo1.png' },
    before: { badge: `JLPT ${D.level}`, title: `완료까지 ${remain}개 남았어요`, showProg: true, cta: '이어서 학습하기', art: 'cat-tomo2.png' },
    after:  { badge: `JLPT ${D.level}`, title: `오늘 총 ${D.todayCount}개 학습했어요!`, showProg: true, cta: '이어서 학습하기', art: 'cat-tomo3.png' },
  };
  const H = HERO[heroState];

  // 히어로 토모 = 화면 폭 반응. 오른쪽 끝에서 약 40% 크롭(반쯤 잘린 연출). 원본 비율 116:156.
  const { width } = useWindowDimensions();
  const tomoW = Math.round(Math.min(154, Math.max(112, width * 0.40)));
  const tomoH = Math.round(tomoW * (156 / 116));
  const tomoCrop = Math.round(tomoW * 0.40);        // 오른쪽으로 넘겨 잘라낼 폭
  const tomoVisible = tomoW - tomoCrop;             // 카드 안에 보이는 폭
  // 텍스트 최대 폭 = 히어로 안쪽 폭 − 보이는 토모 − (히어로 패딩+여유). 이 폭 안에서 제목 한 줄.
  const textMax = Math.round((width - 40) - tomoVisible - 30);

  function toggleSave(ja) {
    setSaved((s) => { const n = new Set(s); if (n.has(ja)) n.delete(ja); else n.add(ja); return n; });
  }

  return (
    <View style={S.screen}>
      <ScrollView contentContainerStyle={S.body}>
        {/* 헤더 — 불씨 + 연속 학습 */}
        <View style={S.headerRow}>
          <Image source={A('flame.png')} style={S.flame} resizeMode="contain" />
          <Text style={S.streakText}>연속 학습 {D.streakDays}일차</Text>
        </View>

        {/* 인사 */}
        <View style={S.greet}>
          <Text style={S.greetTitle}>오늘도 함께 공부해요, {D.user}님</Text>
          <Text style={S.greetSub}>짧게라도 괜찮아요. 오늘의 불씨를 이어가요!</Text>
        </View>

        {/* 카드 영역 — 카드끼리 간격 16 (대표님 요청, 헤더·인사말은 24 유지) */}
        <View style={S.cards}>
        {/* 이어서 학습 (히어로) — 3상태(실제론 데이터로 자동 결정: 레벨 미정/오늘 학습 전/후) */}
        <Pressable
          style={S.hero}
          onPress={() => nav && nav.push('jlptHub')}
          accessibilityRole="button"
          accessibilityLabel={H.cta}
        >
          <Image source={A('cat-background.png')} style={S.heroBgImg} resizeMode="cover" />
          {/* 토모 = 절대배치·화면 폭 반응 크기. 텍스트 maxWidth를 토모 폭만큼 비워 겹침 방지. */}
          <Image source={A(H.art)} style={[S.heroTomo, { width: tomoW, height: tomoH, right: -tomoCrop }]} resizeMode="contain" pointerEvents="none" />
          <View style={[S.heroText, { maxWidth: textMax }]}>
            {H.badge ? <Text style={S.heroLabel}>{H.badge}</Text> : null}
            <Text style={[S.heroTitle, keepAll]}>{H.title}</Text>
            {H.showProg ? (
              <View style={S.heroRow}>
                <Text style={S.heroDesc}>단어 · 어휘</Text>
                <Text style={S.heroDesc}>{D.vocabDone} / {D.vocabTotal}</Text>
              </View>
            ) : null}
          </View>
          {H.showProg ? (
            <View style={[S.progRow, { maxWidth: textMax }]}>
              <View style={S.progTrack}><View style={[S.progFill, { width: `${pct}%` }]} /></View>
              <Text style={S.progText}><Text style={S.progPctNum}>{pct}</Text>%</Text>
            </View>
          ) : null}
          <View style={S.cta}><Text style={S.ctaText}>{H.cta}</Text></View>
        </Pressable>

        {/* 오늘의 3분 복습 (다크 카드) */}
        <Pressable style={S.reviewCard} accessibilityRole="button" accessibilityLabel="오늘의 3분 복습">
          <View style={S.reviewLeft}>
            <Image source={A('ic-review.svg')} style={S.reviewIcon} resizeMode="contain" />
            <View>
              <Text style={S.reviewTitle}>오늘의 3분 복습</Text>
              <Text style={S.reviewSub}>학습한 단어 {D.reviewCount}개 다시 확인하기</Text>
            </View>
          </View>
          <Icon name="forward" size={18} color={C.darkCardText} />
        </Pressable>

        {/* 시험 날짜 */}
        <Pressable style={S.examCard} accessibilityRole="button" accessibilityLabel={`JLPT ${D.level} 시험 D-${D.dday}`}>
          <View style={S.examLeft}>
            <Image source={A('ic-calendar.svg')} style={S.calIcon} resizeMode="contain" />
            <Text style={S.examLabel}>JLPT {D.level} 시험</Text>
          </View>
          <View style={S.examRight}>
            <Text style={S.dday}>D-{D.dday}</Text>
            <Icon name="forward" size={18} color={C.brandMainText} />
          </View>
        </Pressable>

        {/* 통계 2칸 */}
        <View style={S.statRow}>
          <View style={S.statCard}>
            <View style={S.statTextWrap}>
              <Text style={S.statLabel}>오늘 진행한 학습</Text>
              <Text style={S.statBig}>{D.todayCount}<Text style={S.statUnit}>개</Text></Text>
            </View>
            <Image source={A('notebook.png')} style={S.notebook} resizeMode="contain" />
          </View>
          <View style={S.statCard}>
            <View style={S.statTextWrap}>
              <Text style={S.statLabel}>모은 우표</Text>
              <Text style={S.statBig}>{D.stampHave}<Text style={S.statUnit}> / {D.stampNeed}</Text></Text>
            </View>
            <Image source={A('stamps.png')} style={S.stamps} resizeMode="contain" />
          </View>
        </View>

        {/* 오늘의 N3 표현 */}
        <View style={S.quoteCard}>
          <View style={S.quoteHead}>
            <Text style={S.quoteTitle}>오늘의 {D.level} 표현</Text>
            <View style={S.quoteToggles}>
              <Pressable
                onPress={() => setShowInterp((v) => !v)}
                style={[S.toggleChip, showInterp && S.toggleChipOn]}
                accessibilityRole="button"
                accessibilityLabel={showInterp ? '해석 숨기기' : '해석 보기'}
              >
                <Text style={[S.toggleChipText, showInterp && S.toggleChipTextOn]}>해석</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowWords((v) => !v)}
                style={[S.toggleChip, showWords && S.toggleChipOn]}
                accessibilityRole="button"
                accessibilityLabel={showWords ? '단어 숨기기' : '단어 보기'}
              >
                <Text style={[S.toggleChipText, showWords && S.toggleChipTextOn]}>단어</Text>
              </Pressable>
            </View>
          </View>

          <View style={S.quoteBody}>
            <Ruby base={QUOTE} ruby={QUOTE_RUBY} show size={16} color={C.brandMainText} />
          </View>

          {showInterp ? (
            <Text style={S.interp}>{QUOTE_INTERP}</Text>
          ) : null}

          {showWords ? (
            <>
              <View style={S.wordDivider} />
              <View style={S.wordList}>
                {QUOTE_WORDS.map((w) => (
                  <View key={w.ja} style={S.wordRow}>
                    <View style={S.wordPair}>
                      <Text style={S.wordJa} lang="ja">{w.ja}</Text>
                      <Text style={S.wordKo}>{w.ko}</Text>
                    </View>
                    <Pressable
                      onPress={() => toggleSave(w.ja)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={saved.has(w.ja) ? `${w.ja} 저장 해제` : `${w.ja} 저장`}
                    >
                      <Image source={A(saved.has(w.ja) ? 'ic-star-fill.svg' : 'ic-star-line.svg')} style={S.star} resizeMode="contain" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : null}
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
              <Image source={A(tb.icon)} style={S.tabIcon} resizeMode="contain" />
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
  body: { padding: 20, paddingBottom: 98, gap: 24 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flame: { width: 18, height: 22 },
  streakText: { fontFamily: fonts.ko, fontSize: 14, lineHeight: 21, fontWeight: '500', color: C.mainText },

  greet: { gap: 0 },
  cards: { gap: 16, alignSelf: 'stretch' },
  greetTitle: { fontFamily: fonts.ko, fontSize: 20, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3, color: C.brandMainText },
  greetSub: { fontFamily: fonts.ko, fontSize: 14, lineHeight: 21, fontWeight: '400', color: C.greetSub },

  hero: {
    backgroundColor: C.heroBg, borderRadius: 16, padding: 20, gap: 12,
    overflow: 'hidden', position: 'relative', boxShadow: C.cardShadow,
  },
  heroBgImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  heroTomo: { position: 'absolute', bottom: -6 },
  heroText: { gap: 4, alignSelf: 'flex-start' },
  heroLabel: { fontFamily: fonts.ko, fontSize: 14, lineHeight: 21, fontWeight: '500', color: C.brandAmber },
  heroTitle: { fontFamily: fonts.ko, fontSize: 20, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3, color: C.brandMainText },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroDesc: { fontFamily: fonts.ko, fontSize: 14, lineHeight: 21, fontWeight: '500', color: C.brandMainText },

  progRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 170 },
  progTrack: { flex: 1, height: 6, backgroundColor: C.trackBg, borderRadius: 999, overflow: 'hidden' },
  progFill: { height: 6, backgroundColor: C.brandAmber, borderRadius: 999 },
  progText: { fontFamily: fonts.ko, fontSize: 11, lineHeight: 16.5, fontWeight: '500', color: C.brandMainText },
  progPctNum: { fontWeight: '700', color: C.brandMainText },

  cta: {
    backgroundColor: C.ctaDark, borderRadius: 8, height: 36, width: 170, maxWidth: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.ko, fontSize: 16, lineHeight: 24, fontWeight: '500', color: C.inverse },

  reviewCard: {
    backgroundColor: C.ctaDark, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', boxShadow: C.cardShadow,
  },
  reviewLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  reviewIcon: { width: 32, height: 32 },
  reviewTitle: { fontFamily: fonts.ko, fontSize: 16, lineHeight: 24, fontWeight: '600', color: C.darkCardText },
  reviewSub: { fontFamily: fonts.ko, fontSize: 14, lineHeight: 21, fontWeight: '400', color: C.darkCardText },

  examCard: {
    backgroundColor: C.cardWarm, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', boxShadow: C.cardShadow,
  },
  examLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calIcon: { width: 18, height: 18 },
  examLabel: { fontFamily: fonts.ko, fontSize: 14, lineHeight: 21, fontWeight: '500', color: C.brandMainText },
  examRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dday: { fontFamily: fonts.ko, fontSize: 18, lineHeight: 27, fontWeight: '700', letterSpacing: -0.3, color: C.brandMainText },

  statRow: { flexDirection: 'row', gap: 16 },
  statCard: {
    flex: 1, backgroundColor: C.cardWarm, borderRadius: 16, padding: 16,
    overflow: 'hidden', position: 'relative', minHeight: 78, boxShadow: C.cardShadow,
  },
  statTextWrap: { gap: 4 },
  statLabel: { fontFamily: fonts.ko, fontSize: 12, lineHeight: 18, fontWeight: '600', color: C.brandMainText },
  statBig: { fontFamily: fonts.ko, fontSize: 24, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5, color: C.brandMainText },
  statUnit: { fontFamily: fonts.ko, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  notebook: { position: 'absolute', right: 10, bottom: 12, width: 32, height: 32 },
  stamps: { position: 'absolute', right: 10, bottom: 12, width: 36, height: 36 },

  quoteCard: { backgroundColor: C.cardWarm, borderRadius: 16, padding: 16, gap: 12, boxShadow: C.cardShadow },
  quoteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quoteTitle: { fontFamily: fonts.ko, fontSize: 12, lineHeight: 18, fontWeight: '600', color: C.brandMainText },
  quoteToggles: { flexDirection: 'row', gap: 8 },
  toggleChip: {
    width: 41, height: 29, borderRadius: 8, borderWidth: 1, borderColor: C.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleChipOn: { backgroundColor: C.ctaDark, borderColor: C.ctaDark },
  toggleChipText: { fontFamily: fonts.ko, fontSize: 14, lineHeight: 21, fontWeight: '500', color: C.sub },
  toggleChipTextOn: { color: C.darkCardText },
  quoteBody: { paddingTop: 2 },
  interp: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '500', lineHeight: 18, color: C.interpText },

  wordDivider: { height: 1, backgroundColor: '#E7E1D6' },
  wordList: { gap: 8 },
  wordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordPair: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wordJa: { fontFamily: fonts.jp, fontSize: 16, lineHeight: 24, color: C.brandMainText },
  wordKo: { fontFamily: fonts.ko, fontSize: 16, lineHeight: 24, color: C.wordKo },
  star: { width: 20, height: 18 },

  nav: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 70,
    backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center',
    boxShadow: C.navShadow,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabIcon: { width: 22, height: 22 },
  tabLabel: { fontFamily: fonts.ko, fontSize: 11, lineHeight: 16.5, fontWeight: '500' },
});
