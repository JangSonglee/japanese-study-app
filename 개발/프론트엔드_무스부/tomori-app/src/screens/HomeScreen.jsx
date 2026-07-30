import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

/**
 * 홈 (기획 8) — 위젯 홈. EOND UI 원칙 반영 리디자인(2026-07-30 검토).
 *
 * 적용 원칙:
 *  ① 한국어 조판 — 모든 한글에 word-break: keep-all(어절 단위 줄바꿈).
 *  ② 팔레트 다이어트 — 앰버(brand)를 유일 강조색으로. 파랑(courseJlpt)은 코스 뱃지에만.
 *     숫자·본문은 뉴트럴(ink/mid), 액션·진행은 앰버.
 *  ③ 강약 레이아웃 — 「이어서 학습」을 인사 다음 히어로로. 통계는 작은 보조 카드.
 *  ④ 4px 그리드 여백 · 타입 위계 정리.
 *
 * 🔴 데이터 = 데모 목업(HOME_DEMO). 인증·DB 붙으면 위젯별 TODO 지점을 실데이터로 교체.
 *    토모 = 평소 밝기·말 없음(밝아짐은 「새 쪽지」 전용, PRD 14.2.1).
 */
const HOME_DEMO = {
  user: '송이',
  streak: { days: 7, week: [true, true, true, true, true, false, false] },
  dday: { label: 'JLPT N3', d: 42, date: '12월 3일' },
  cont: { course: 'JLPT', level: 'N3', area: '독해', route: 'readingSession', done: 3, total: 12 },
  progress: { level: 'N3', pct: 34 },
  // 우표 컬렉션(PRD 12.2 v2.8): 첫 편지=우표 3장, 이후 14장마다 1통. 여기선 2통째 진행 중(다음 편지까지 14장 중 12장).
  stamp: { have: 12, need: 14 },
  advice: '어제는 동사 활용에서 좀 헤맸어요. 오늘 그 부분 다시 볼까요?',
};

// 한국어 조판 — 어절 단위 줄바꿈(RN Web에서 CSS로 전달)
const KEEP = { wordBreak: 'keep-all' };

export default function HomeScreen({ nav }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const card = [S.card, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }];
  const D = HOME_DEMO;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgBase }} contentContainerStyle={S.body}>
      {/* 앱바 */}
      <View style={S.appbar}>
        <Text style={[S.brand, { color: t.textHigh }, KEEP]}>토모리</Text>
        <View style={S.appbarRight}>
          {/* 활성 코스 = JLPT. 탭하면 코스 허브(단어·문법·독해·청해)로 바로 간다.
              코스 '전환'(다른 코스 고르기)은 MY로 옮겼다 — IA(03·Core Flows): 학습=활성 코스만, 코스 전환은 MY·설정.
              코스 선택 자체는 온보딩(관심분야→추천)이 담당하고, 5개 목록은 메인 플로우의 단계가 아니다. */}
          <Pressable onPress={() => nav.push('jlptHub')} style={[S.coursePill, { backgroundColor: t.sunk }]} accessibilityRole="button" accessibilityLabel="JLPT 학습 메뉴">
            <Text style={[S.coursePillText, { color: t.textMid }]}>JLPT</Text>
          </Pressable>
          <Pressable onPress={() => nav.push('my')} style={[S.myPill, { borderColor: t.borderStrong }]} accessibilityRole="button" accessibilityLabel="MY 화면">
            <Text style={[S.myText, { color: t.textMid }]}>MY</Text>
          </Pressable>
        </View>
      </View>

      {/* 인사 */}
      <View style={S.greet}>
        <Tomo scale={0.6} pose="shine" showNote={false} />
        <View style={S.greetText}>
          <Text style={[S.greetTitle, { color: t.textHigh }, KEEP]}>오늘도 왔네요, {D.user}님</Text>
          <Text style={[S.greetSub, { color: t.textMid }, KEEP]}>일곱 밤째 함께 불을 켰어요.</Text>
        </View>
      </View>

      {/* 이어서 학습 — 히어로(가장 강조) · TODO: 마지막 학습 위치 로컬 저장 */}
      <Pressable onPress={() => nav.push(D.cont.route, { level: D.cont.level })} style={card} accessibilityRole="button" accessibilityLabel="이어서 학습">
        <View style={S.contHead}>
          <View style={[S.courseBadge, { backgroundColor: t.courseJlpt }]}>
            <Text style={[S.courseBadgeText, { color: '#FFF9EC' }]}>{D.cont.course}</Text>
          </View>
          <Text style={[S.contLbl, { color: t.textMid }, KEEP]}>이어서 학습</Text>
        </View>
        <Text style={[S.contTitle, { color: t.textHigh }, KEEP]}>{D.cont.level} 독해를 이어서 해요</Text>
        <View style={S.progRow}>
          <ProgressBar t={t} pct={D.cont.done / D.cont.total} color={t.brand} />
          <Text style={[S.progText, { color: t.textMid }]}>{D.cont.done} / {D.cont.total}</Text>
        </View>
        <View style={[S.contBtn, { backgroundColor: t.brand }]}>
          <Text style={[S.contBtnText, { color: t.onBrand }]}>이어서 하기</Text>
        </View>
      </Pressable>

      {/* 스트릭 | D-day · TODO: 실데이터 */}
      <View style={S.row2}>
        <View style={[card, S.col]}>
          <Text style={[S.cardLbl, { color: t.textMid }, KEEP]}>연속 학습</Text>
          <View style={S.bigRow}><Text style={[S.big, { color: t.textHigh }]}>{D.streak.days}</Text><Text style={[S.bigUnit, { color: t.textMid }]}>일째</Text></View>
          <View style={S.dots}>{D.streak.week.map((on, i) => (<View key={i} style={[S.dot, { backgroundColor: on ? t.brand : t.sunk }]} />))}</View>
        </View>
        <View style={[card, S.col]}>
          <Text style={[S.cardLbl, { color: t.textMid }, KEEP]}>{D.dday.label} 시험</Text>
          <View style={S.bigRow}><Text style={[S.big, { color: t.textHigh }]}>D-{D.dday.d}</Text></View>
          <Text style={[S.cardSub, { color: t.textLow }, KEEP]}>{D.dday.date}</Text>
        </View>
      </View>

      {/* 진도 | 우표 · TODO: 실데이터 */}
      <View style={S.row2}>
        <View style={[card, S.col]}>
          <Text style={[S.cardLbl, { color: t.textMid }, KEEP]}>{D.progress.level} 진도</Text>
          <View style={S.bigRow}><Text style={[S.big, { color: t.textHigh }]}>{D.progress.pct}</Text><Text style={[S.bigUnit, { color: t.textMid }]}>%</Text></View>
          <ProgressBar t={t} pct={D.progress.pct / 100} color={t.brand} />
        </View>
        <View style={[card, S.col]}>
          <Text style={[S.cardLbl, { color: t.textMid }, KEEP]}>모은 우표</Text>
          <View style={S.bigRow}><Text style={[S.big, { color: t.textHigh }]}>{D.stamp.have}</Text><Text style={[S.bigUnit, { color: t.textMid }]}>/ {D.stamp.need}</Text></View>
          <ProgressBar t={t} pct={D.stamp.have / D.stamp.need} color={t.brand} />
          <Text style={[S.cardSub, { color: t.textLow }, KEEP]}>다음 편지까지 {D.stamp.need - D.stamp.have}장</Text>
        </View>
      </View>

      {/* 오늘의 조언 · TODO: 오답 패턴 기반 실 생성 */}
      <View style={[card, S.advCard]}>
        <Tomo scale={0.42} pose="intellectual" showNote={false} />
        <View style={S.advText}>
          <Text style={[S.advLbl, { color: t.brandText }, KEEP]}>오늘의 조언</Text>
          <Text style={[S.advBody, { color: t.textMid }, KEEP]}>{D.advice}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function ProgressBar({ t, pct, color }) {
  const p = Math.max(0, Math.min(1, pct || 0));
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: t.sunk, overflow: 'hidden', flexGrow: 1, minWidth: 40 }}>
      <View style={{ width: `${p * 100}%`, height: 8, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    body: { padding: 20, gap: 16, paddingBottom: 32 },
    appbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
    brand: { fontFamily: fonts.ko, fontSize: 18, fontWeight: '700' },
    appbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    coursePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
    coursePillText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600' },
    myPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
    myText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '700' },
    greet: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    greetText: { flex: 1, gap: 3 },
    greetTitle: { fontFamily: fonts.ko, fontSize: 21, fontWeight: '700' },
    greetSub: { fontFamily: fonts.ko, fontSize: 14 },
    row2: { flexDirection: 'row', gap: 12 },
    col: { flex: 1 },
    card: { borderRadius: radius.lg, padding: 16, gap: 12 },
    cardLbl: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '500' },
    cardSub: { fontFamily: fonts.ko, fontSize: 11 },
    bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    big: { fontFamily: fonts.ko, fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
    bigUnit: { fontFamily: fonts.ko, fontSize: 14, marginBottom: 4 },
    dots: { flexDirection: 'row', gap: 5, marginTop: 2 },
    dot: { width: 8, height: 8, borderRadius: 999 },
    contHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    courseBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
    courseBadgeText: { fontFamily: fonts.ko, fontSize: 11, fontWeight: '700' },
    contLbl: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '500' },
    contTitle: { fontFamily: fonts.ko, fontSize: 19, fontWeight: '700', marginTop: 2 },
    progRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    progText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600' },
    contBtn: { height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    contBtnText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
    advCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    advText: { flex: 1, gap: 4 },
    advLbl: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '700' },
    advBody: { fontFamily: fonts.ko, fontSize: 13.5, lineHeight: 20 },
  });
}
