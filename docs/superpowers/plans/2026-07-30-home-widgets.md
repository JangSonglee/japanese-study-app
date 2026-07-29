# 실제 홈(위젯) FE 구현 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `HomeScreen`을 기획 8번 위젯 홈으로 재작성 — 인사·스트릭·D-day·이어서 학습·진도·우표·오늘의 조언(데모 목업).

**Architecture:** 단일 파일 `HomeScreen.jsx` 재작성. `ScrollView`에 위젯 카드들을 세로 배치. 데이터는 `HOME_DEMO` 상수(실데이터는 인증/DB 후 배선, TODO 표식). 테마 토큰으로 라이트/다크 자동 대응.

**Tech Stack:** React Native Web. 유닛 테스트 러너 없음 → 검증은 빌드 + 5599 프리뷰(위젯 렌더·네비·라이트/다크·콘솔).

## Global Constraints

- 데이터는 `HOME_DEMO` 상수(데모). 각 위젯에 `// TODO: 실데이터(인증/DB) 배선`. 실 API 호출 없음.
- 밝기(헤일로) 축하 없음(PRD 14.2.1) — 토모는 pose만.
- 색/타이포는 테마 토큰만(`t.brand`·`t.courseJlpt`·`t.brandText`·`radius`·`fonts`). 원시 hex 금지.
- 다크 카드는 border(`isDark && {borderWidth:1, borderColor:t.border}`) — 기존 패턴.
- 네비: 이어서 하기 → `nav.push('readingSession',{level:'N3'})`, MY → `nav.push('my')`, 코스 pill → `nav.push('courses')`.
- 검증 기준: 빌드 성공 + 5599 위젯 렌더 + 네비 동작 + 콘솔 0.

---

### Task 1: HomeScreen 위젯 홈 재작성

**Files:**
- Rewrite: `개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx`

**Interfaces:**
- Consumes: `nav`(useRouter — push/pop), `Tomo`(pose prop), `useTheme`(t, mode), `fonts`/`radius`.
- Produces: 데모 위젯 홈. 라우트 진입점은 기존과 동일(`home`).

- [ ] **Step 1: HomeScreen.jsx 전체 교체**

파일 전체를 아래로 교체:
```jsx
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

/**
 * 홈 (기획 8) — 위젯 홈.
 *
 * 🔴 데이터 = 데모 목업(HOME_DEMO). 스트릭·진도·우표·조언은 학습기록(인증·DB), D-day·이어서학습은 로컬 저장 대상.
 *    지금은 슬라이스/데모 단계라 완성형으로 보여준다(대표님 결정 2026-07-30, 기존 "정직한 생략" 원칙 이번 한정 유보).
 *    인증(Google OAuth)·학습기록 DB가 붙으면 위젯별 TODO 지점을 실데이터로 교체.
 *  · 토모 = 평소 밝기·말 없음(밝아짐은 「새 쪽지」 전용, PRD 14.2.1).
 */
const HOME_DEMO = {
  user: '송이',
  streak: { days: 7, week: [true, true, true, true, true, false, false] },
  dday: { label: 'JLPT N3 시험', d: 42, date: '12월 3일' },
  cont: { course: 'JLPT', level: 'N3', area: '독해', route: 'readingSession', done: 3, total: 12 },
  progress: { level: 'N3', pct: 34 },
  stamp: { have: 12, need: 20 },
  advice: '어제는 동사 활용에서 좀 헤맸어요. 오늘 그 부분 다시 볼까요?',
};

export default function HomeScreen({ nav }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const cardBase = [S.card, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }];
  const D = HOME_DEMO;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bgBase }} contentContainerStyle={S.body}>
      {/* 앱바 — 브랜드 · 코스 전환 · MY */}
      <View style={S.appbar}>
        <Text style={[S.brand, { color: t.textHigh }]}>토모리</Text>
        <View style={S.appbarRight}>
          <Pressable onPress={() => nav.push('courses')} style={[S.coursePill, { backgroundColor: t.sunk }]} accessibilityRole="button" accessibilityLabel="코스 전환">
            <Text style={[S.coursePillText, { color: t.textMid }]}>JLPT ▾</Text>
          </Pressable>
          <Pressable onPress={() => nav.push('my')} style={[S.myPill, { borderColor: t.borderStrong }]} accessibilityRole="button" accessibilityLabel="MY 화면">
            <Text style={[S.myText, { color: t.textMid }]}>MY</Text>
          </Pressable>
        </View>
      </View>

      {/* 인사 — 토모(shine) + 인사말 */}
      <View style={S.greet}>
        <Tomo scale={0.62} pose="shine" showNote={false} />
        <View style={S.greetText}>
          <Text style={[S.greetTitle, { color: t.textHigh }]}>오늘도 왔네요, {D.user}님</Text>
          <Text style={[S.greetSub, { color: t.textMid }]}>일곱 밤째 함께 불을 켰어요.</Text>
        </View>
      </View>

      {/* 스트릭 | D-day  · TODO: 실데이터(인증·DB / 시험일 로컬설정) */}
      <View style={S.row2}>
        <View style={[cardBase, S.col]}>
          <Text style={[S.cardLbl, { color: t.textMid }]}>연속 학습</Text>
          <View style={S.bigRow}><Text style={[S.big, { color: t.brandText }]}>{D.streak.days}</Text><Text style={[S.bigUnit, { color: t.textMid }]}>일</Text></View>
          <View style={S.dots}>{D.streak.week.map((on, i) => (<View key={i} style={[S.dot, { backgroundColor: on ? t.brand : t.sunk }]} />))}</View>
        </View>
        <View style={[cardBase, S.col]}>
          <Text style={[S.cardLbl, { color: t.textMid }]}>{D.dday.label}</Text>
          <View style={S.bigRow}><Text style={[S.big, { color: t.courseJlpt }]}>D-{D.dday.d}</Text></View>
          <Text style={[S.cardSub, { color: t.textLow }]}>{D.dday.date}</Text>
        </View>
      </View>

      {/* 이어서 학습 (강조) · TODO: 마지막 학습 위치 로컬 저장 */}
      <View style={[cardBase, S.contCard, { borderWidth: 1.5, borderColor: t.brand }]}>
        <View style={S.contHead}>
          <Text style={[S.contLbl, { color: t.brandText }]}>이어서 학습</Text>
          <Text style={[S.chev, { color: t.textLow }]}>›</Text>
        </View>
        <Text style={[S.contTitle, { color: t.textHigh }]}>{D.cont.course} · {D.cont.level} · {D.cont.area}</Text>
        <View style={S.progRow}>
          <ProgressBar t={t} pct={D.cont.done / D.cont.total} color={t.courseJlpt} />
          <Text style={[S.progText, { color: t.textMid }]}>{D.cont.done} / {D.cont.total}</Text>
        </View>
        <Pressable onPress={() => nav.push(D.cont.route, { level: D.cont.level })} style={[S.contBtn, { backgroundColor: t.action }]} accessibilityRole="button">
          <Text style={[S.contBtnText, { color: t.onAction }]}>이어서 하기</Text>
        </Pressable>
      </View>

      {/* 진도 | 우표 · TODO: 실데이터(인증·DB) */}
      <View style={S.row2}>
        <View style={[cardBase, S.col]}>
          <Text style={[S.cardLbl, { color: t.textMid }]}>{D.progress.level} 진도</Text>
          <View style={S.bigRow}><Text style={[S.big, { color: t.textHigh }]}>{D.progress.pct}</Text><Text style={[S.bigUnit, { color: t.textMid }]}>%</Text></View>
          <ProgressBar t={t} pct={D.progress.pct / 100} color={t.courseJlpt} />
        </View>
        <View style={[cardBase, S.col]}>
          <Text style={[S.cardLbl, { color: t.textMid }]}>우표</Text>
          <View style={S.bigRow}><Text style={[S.big, { color: t.brandText }]}>{D.stamp.have}</Text><Text style={[S.bigUnit, { color: t.textMid }]}>/ {D.stamp.need}</Text></View>
          <ProgressBar t={t} pct={D.stamp.have / D.stamp.need} color={t.brand} />
          <Text style={[S.cardSub, { color: t.textLow }]}>다음 편지까지 {D.stamp.need - D.stamp.have}장</Text>
        </View>
      </View>

      {/* 오늘의 조언 · TODO: 오답 패턴 기반 실 생성 */}
      <View style={[cardBase, S.advCard]}>
        <Tomo scale={0.42} pose="intellectual" showNote={false} />
        <View style={S.advText}>
          <Text style={[S.advLbl, { color: t.brandText }]}>오늘의 조언</Text>
          <Text style={[S.advBody, { color: t.textMid }]}>{D.advice}</Text>
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
    body: { padding: 16, gap: 12, paddingBottom: 28 },
    appbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
    brand: { fontFamily: fonts.ko, fontSize: 18, fontWeight: '700' },
    appbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    coursePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
    coursePillText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600' },
    myPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
    myText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '700' },
    greet: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    greetText: { flex: 1, gap: 2 },
    greetTitle: { fontFamily: fonts.ko, fontSize: 17, fontWeight: '700' },
    greetSub: { fontFamily: fonts.ko, fontSize: 13 },
    row2: { flexDirection: 'row', gap: 12 },
    col: { flex: 1 },
    card: { borderRadius: radius.md, padding: 14, gap: 8 },
    cardLbl: { fontFamily: fonts.ko, fontSize: 12 },
    cardSub: { fontFamily: fonts.ko, fontSize: 11 },
    bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    big: { fontFamily: fonts.ko, fontSize: 26, fontWeight: '800' },
    bigUnit: { fontFamily: fonts.ko, fontSize: 14, marginBottom: 3 },
    dots: { flexDirection: 'row', gap: 5, marginTop: 2 },
    dot: { width: 9, height: 9, borderRadius: 999 },
    contCard: { gap: 10 },
    contHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    contLbl: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '700' },
    chev: { fontFamily: fonts.ko, fontSize: 18 },
    contTitle: { fontFamily: fonts.ko, fontSize: 17, fontWeight: '700' },
    progRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    progText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600' },
    contBtn: { height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    contBtnText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
    advCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    advText: { flex: 1, gap: 3 },
    advLbl: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '700' },
    advBody: { fontFamily: fonts.ko, fontSize: 13, lineHeight: 19 },
  });
}
```

- [ ] **Step 2: 빌드**

Run:
```bash
cd "개발/프론트엔드_무스부/tomori-app" && npm run build
```
Expected: `✓ built in ...` (에러 0).

- [ ] **Step 3: 프리뷰 검증 (5599)**

`preview_start {name:"fe"}` → `navigate http://localhost:5599`(홈이 첫 화면).
- 스크린샷: 위젯 6종 + 인사 렌더, 토모 shine(인사)·intellectual(조언) 이미지.
- 다크 토글(topbar 다크 버튼 = DOM 클릭) 후 스크린샷: 카드 border·색 반전 정상.
- `javascript_tool`로 [이어서 하기] 클릭 → state `readingSession · N3` 확인. 뒤로 → 홈.
- MY 클릭 → `my` 확인.
- `read_console_messages` 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx"
git commit -m "feat: 홈을 위젯 홈으로 재작성(스트릭·D-day·이어서 학습·진도·우표·조언, 데모)"
```

---

### Task 2: 진행상태 문서 기록

**Files:**
- Modify: `기획/진행상태.md`

**Interfaces:**
- Consumes: Task 1 완료.
- Produces: 없음(문서).

- [ ] **Step 1: 진행상태.md에 기록 추가**

내용: 실제 홈(위젯) FE 구현, 위젯 6종+인사, 데모 목업(HOME_DEMO)+실데이터 TODO, 🔴 기존 "정직한 생략" 원칙 이번 한정 유보 이유(대표님 결정), 네비 연결, 검증 결과, 스펙·계획 경로, Figma 07 페이지 홈 참조.

- [ ] **Step 2: 커밋**

```bash
git add "기획/진행상태.md"
git commit -m "docs: 진행상태에 위젯 홈 구현 기록"
```

---

## Self-Review

- **Spec coverage:** 앱바·인사·스트릭·D-day·이어서학습·진도·우표·조언=Step1 전체 코드 / 데모 목업 상수=HOME_DEMO / 네비=onPress push / 토모 shine·intellectual=Step1 / 원칙 유보 이유=주석+Task2. 스펙 전 항목 커버.
- **Placeholder scan:** 전체 코드 포함. "TODO 배선"은 의도된 실데이터 표식(데모 단계).
- **Type consistency:** `HOME_DEMO` 필드(streak/dday/cont/progress/stamp/advice)와 렌더 참조 일치. `ProgressBar({t,pct,color})` 시그니처와 호출 일치. `cont.route='readingSession'` + `nav.push(route,{level})`가 App.jsx 라우트와 일치. `t.courseJlpt`(토큰명, jlpt 아님) 사용 확인.
