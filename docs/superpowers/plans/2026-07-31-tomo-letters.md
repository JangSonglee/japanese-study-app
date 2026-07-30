# 토모의 편지·편지함 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토모가 우표 마일스톤마다 보내는 「이정표 편지」와 이를 소장하는 편지함을 FE에 데모로 구현한다(실 생성·적립은 인증 후).

**Architecture:** 데모 데이터(`data/letters.js`)를 두 신규 화면(`LetterBoxScreen` 목록, `LetterScreen` 상세)이 읽는다. 손수 스택 라우터에 `letterBox`·`letter` 라우트를 추가하고, 진입점은 MY(편지함 메뉴)와 홈 우표 위젯(도착 상태)이다.

**Tech Stack:** React + React Native Web + Vite, 디자인시스템 v3.3 토큰(`theme/tokens.js`), 손수 스택 네비(`nav/router.js`).

## Global Constraints

- 🔴 유닛 테스트 프레임워크 없음. **검증 = `npm run build` 성공 + 브라우저 프리뷰(@5599, `.claude/launch.json`의 `fe`) + 콘솔0.**
- 🔴 원시 hex 금지 — `theme/tokens.js` 토큰만(앰버=`t.brand`/`t.brandText`/`t.onBrand`). 카드=`radius.lg`.
- 🔴 한국어 문장형 텍스트엔 `keepAll` 스프레드.
- 🔴 **밝기 헤일로·폭죽·축하 연출 금지** — 토모 톤(조용한 관찰자, PRD 14.4). 밝기 헤일로는 「새 쪽지」 전용(14.2.1)이라 편지엔 쓰지 않는다.
- 🔴 커밋은 각 태스크 끝에서. Bash 툴(POSIX)로 커밋(PowerShell heredoc 금지).
- 앱 루트 = `C:/github/JangSonglee/japanese-study-app`. FE = `개발/프론트엔드_무스부/tomori-app`.

---

## File Structure

- `개발/프론트엔드_무스부/tomori-app/src/data/letters.js` — **신규**. `LETTERS` 데모 + `getLetter(id)`.
- `개발/프론트엔드_무스부/tomori-app/src/screens/LetterScreen.jsx` — **신규**. 편지 상세.
- `개발/프론트엔드_무스부/tomori-app/src/screens/LetterBoxScreen.jsx` — **신규**. 편지함 목록.
- `개발/프론트엔드_무스부/tomori-app/src/App.jsx` — **수정**. `letterBox`·`letter` 라우트 배선.
- `개발/프론트엔드_무스부/tomori-app/src/screens/MyScreen.jsx` — **수정**. 「편지함」 메뉴 행.
- `개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx` — **수정**. 우표 위젯 도착 상태.
- `기획/PRD.md` · `기획/project_master.md` — **수정**. 편지·편지함 정의 정합(v2.9).

---

## Task 1: 편지 데이터 + 편지함 + 편지 상세 (MY에서 진입)

데이터·두 화면·라우트·MY 진입점을 한 태스크로. 산출물 = MY → 편지함 → 목록 → 편지 상세가 동작.

**Files:**
- Create: `개발/프론트엔드_무스부/tomori-app/src/data/letters.js`
- Create: `개발/프론트엔드_무스부/tomori-app/src/screens/LetterScreen.jsx`
- Create: `개발/프론트엔드_무스부/tomori-app/src/screens/LetterBoxScreen.jsx`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/App.jsx`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/MyScreen.jsx`

**Interfaces:**
- Produces: `LETTERS` (배열, 최신순), `getLetter(id)→letter|null` from `data/letters.js`. 라우트 `letter`(params `{id}`)·`letterBox`.

- [ ] **Step 1: `data/letters.js` 생성**

```js
// 토모의 편지 — 데모 데이터. 편지 = 토모의 이정표 편지(감성 회고, 한국어).
// 톤: 조용한 관찰자(PRD 14.4) — 짧고 절제, 허용체, 재촉·과장 없음.
// 🔴 실 생성(학습 데이터 집계+문안 채움)·적립은 인증 후. 지금은 데모 2통.
export const LETTERS = [
  {
    id: 'l2',
    seq: 2,
    dateLabel: '7월 30일',
    title: '2주가 지났어요',
    preview: '2주 동안, 열네 번 함께했어요.',
    paragraphs: [
      '송이 님께,',
      '2주 동안, 열네 번 함께했어요.',
      '동사 활용에서 자주 멈췄는데, 요즘은 덜 멈추더라고요. 저는 봤어요.',
      '서두르지 않아도 돼요. 불은 계속 켜 둘게요.',
    ],
    signoff: '— 토모',
    unread: true,
  },
  {
    id: 'l1',
    seq: 1,
    dateLabel: '7월 16일',
    title: '첫 편지예요',
    preview: '사흘째, 불을 켜러 와 줬어요.',
    paragraphs: [
      '송이 님께,',
      '사흘째, 불을 켜러 와 줬어요.',
      '아직 시작이지만, 시작을 세 번 한 사람은 많지 않아요.',
      '오늘 배운 말들, 제가 다 봤어요.',
    ],
    signoff: '— 토모',
    unread: false,
  },
];

export function getLetter(id) {
  return LETTERS.find((l) => l.id === id) || null;
}
```

- [ ] **Step 2: `screens/LetterScreen.jsx` 생성**

```jsx
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll } from '../theme/tokens';
import { getLetter } from '../data/letters';

/**
 * 편지 상세 (토모의 이정표 편지). 소장용 편지지 레이아웃.
 *  · 톤: 조용한 관찰자(PRD 14.4). 폭죽·축하·밝기 헤일로 없음(헤일로는 쪽지 전용 14.2.1).
 *  · 데모 데이터(data/letters.js). 실 생성은 인증·적립 후.
 */
export default function LetterScreen({ nav, id }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const letter = getLetter(id);

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.appTitle, { color: t.textHigh }]}>토모의 편지</Text>
      </View>

      {!letter ? (
        <View style={S.center}><Text style={[S.missing, { color: t.textMid }, keepAll]}>편지를 찾을 수 없어요.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={S.body}>
          <View style={[S.paper, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }]}>
            <View style={S.tomoWrap}><Tomo scale={0.55} pose="read" showNote={false} /></View>
            <Text style={[S.title, { color: t.textHigh }, keepAll]}>{letter.title}</Text>
            <Text style={[S.date, { color: t.textLow }]}>{letter.dateLabel}</Text>
            <View style={S.paras}>
              {letter.paragraphs.map((p, i) => (
                <Text key={i} style={[S.para, { color: t.textHigh }, keepAll]}>{p}</Text>
              ))}
            </View>
            <Text style={[S.signoff, { color: t.brandText }, keepAll]}>{letter.signoff}</Text>
          </View>

          <Pressable style={[S.btn, { backgroundColor: t.brand }]} onPress={() => nav.pop()} accessibilityRole="button" accessibilityLabel="닫기">
            <Text style={[S.btnText, { color: t.onBrand }]}>닫기</Text>
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
    appTitle: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    body: { padding: 16, gap: 14 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    missing: { fontFamily: fonts.ko, fontSize: 14, textAlign: 'center' },
    paper: { borderRadius: radius.lg, padding: 22, gap: 6, alignItems: 'flex-start' },
    tomoWrap: { alignSelf: 'center', marginBottom: 6 },
    title: { fontFamily: fonts.ko, fontSize: 19, fontWeight: '700' },
    date: { fontFamily: fonts.ko, fontSize: 12, marginBottom: 8 },
    paras: { gap: 12, marginTop: 2 },
    para: { fontFamily: fonts.ko, fontSize: 15, lineHeight: 24 },
    signoff: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '700', alignSelf: 'flex-end', marginTop: 14 },
    btn: { height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
  });
}
```

- [ ] **Step 3: `screens/LetterBoxScreen.jsx` 생성**

```jsx
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll } from '../theme/tokens';
import { LETTERS } from '../data/letters';

/**
 * 편지함 (MY) — 받은 토모의 편지 컬렉션(데모). 받은 편지만 모은다(쪽지·요약 PDF는 별도).
 *  · 빈 상태는 담담하게(압박·빨간점 없음). 실 도착은 인증·적립 후.
 */
export default function LetterBoxScreen({ nav }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const letters = LETTERS;

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.appTitle, { color: t.textHigh }]}>편지함</Text>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        {letters.length === 0 ? (
          <View style={S.empty}>
            <Tomo scale={0.6} pose="sit" showNote={false} />
            <Text style={[S.emptyText, { color: t.textMid }, keepAll]}>아직 토모의 편지가 없어요.</Text>
            <Text style={[S.emptySub, { color: t.textLow }, keepAll]}>우표를 모으면 편지가 와요.</Text>
          </View>
        ) : (
          letters.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => nav.push('letter', { id: l.id })}
              accessibilityRole="button"
              accessibilityLabel={`${l.title} 편지 열기`}
              style={[S.item, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }]}
            >
              <View style={S.itemText}>
                <View style={S.itemHead}>
                  <Text style={[S.itemTitle, { color: t.textHigh }, keepAll]}>{l.title}</Text>
                  {l.unread ? <View style={[S.dot, { backgroundColor: t.brand }]} /> : null}
                </View>
                <Text style={[S.itemPreview, { color: t.textMid }, keepAll]} numberOfLines={1}>{l.preview}</Text>
                <Text style={[S.itemDate, { color: t.textLow }]}>{l.dateLabel}</Text>
              </View>
              <Icon name="forward" size={20} color={t.textLow} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    appTitle: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    body: { padding: 16, gap: 10 },
    empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
    emptyText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    emptySub: { fontFamily: fonts.ko, fontSize: 13, textAlign: 'center' },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 16 },
    itemText: { flex: 1, gap: 4 },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    itemTitle: { fontFamily: fonts.ko, fontSize: 16, fontWeight: '700' },
    dot: { width: 7, height: 7, borderRadius: radius.full },
    itemPreview: { fontFamily: fonts.ko, fontSize: 13 },
    itemDate: { fontFamily: fonts.ko, fontSize: 11 },
  });
}
```

- [ ] **Step 4: `App.jsx` 라우트 배선**

상단 import에 추가:
```js
import LetterBoxScreen from './screens/LetterBoxScreen';
import LetterScreen from './screens/LetterScreen';
```
화면 스위치에서 `about` 분기 바로 다음(닫는 `) : null}` 앞)에 두 분기 추가:
```jsx
          ) : name === 'about' ? (
            <AboutScreen nav={nav} />
          ) : name === 'letterBox' ? (
            <LetterBoxScreen nav={nav} />
          ) : name === 'letter' ? (
            <LetterScreen nav={nav} id={params.id} />
          ) : null}
```
(기존 `about` 분기는 그대로 두고 그 아래에 붙인다.)

- [ ] **Step 5: `MyScreen.jsx` 에 편지함 진입점 추가**

프로필 카드(및 게스트 Google 버튼 블록) 다음, 「학습」 섹션 바로 앞에 「보관함」 섹션을 삽입:
```jsx
        {/* 보관함 — 토모의 편지 컬렉션 */}
        <Text style={[S.section, { color: t.textLow }]}>보관함</Text>
        <MenuRow t={t} label="편지함" onPress={() => nav.push('letterBox')} />

        {/* 학습 — 코스 전환. IA(03·Core Flows): 코스 전환은 MY·설정에서. */}
        <Text style={[S.section, { color: t.textLow }]}>학습</Text>
```
(기존 「학습」 섹션 라인 앞에 보관함 2줄 + 학습 주석/섹션을 넣는 형태. 기존 `<MenuRow ... 코스 전환 ... />` 등은 그대로.)

- [ ] **Step 6: 빌드 + 프리뷰 검증**

Run: `cd "개발/프론트엔드_무스부/tomori-app" && npm run build` → `✓ built` 0 errors.
프리뷰(@5599): 홈 → MY → 「보관함 › 편지함」 → 목록(2통: 「2주가 지났어요」 unread 점 + 「첫 편지예요」) → 「2주가 지났어요」 탭 → 편지 상세(제목·날짜·문단 4줄·「— 토모」 서명·토모 read)·닫기로 복귀. 라이트/다크·`read_console_messages(onlyErrors)` = 0. 스크린샷 1~2장.

- [ ] **Step 7: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/src/data/letters.js" "개발/프론트엔드_무스부/tomori-app/src/screens/LetterScreen.jsx" "개발/프론트엔드_무스부/tomori-app/src/screens/LetterBoxScreen.jsx" "개발/프론트엔드_무스부/tomori-app/src/App.jsx" "개발/프론트엔드_무스부/tomori-app/src/screens/MyScreen.jsx"
git commit -m "feat(letter): 토모의 편지 데이터 + 편지함·편지 상세 화면 (MY 진입)"
```

---

## Task 2: 홈 우표 위젯 — 편지 도착 상태

우표가 목표치에 도달한 순간을 「편지가 도착했어요」로 표현하고, 탭하면 최신 편지를 연다.

**Files:**
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx`

**Interfaces:**
- Consumes: 라우트 `letter`(`{id}`)·`letterBox` (Task 1). `HOME_DEMO`.

- [ ] **Step 1: `HOME_DEMO` 에 편지 도착 데모 플래그 추가**

`HomeScreen.jsx` 의 `HOME_DEMO` 객체에서 `stamp: { have: 12, need: 14 },` 다음 줄에 추가:
```js
  // 편지 도착 데모(우표 목표 도달 순간). 실 트리거는 인증·적립 후. newestLetterId = data/letters.js 최신.
  letterWaiting: true,
  newestLetterId: 'l2',
```

- [ ] **Step 2: 우표 위젯을 도착/진행 분기 Pressable 로 교체**

기존 우표 카드(라벨 「모은 우표」 블록)를 아래로 교체:
```jsx
        <Pressable
          onPress={() => (D.letterWaiting ? nav.push('letter', { id: D.newestLetterId }) : nav.push('letterBox'))}
          style={[card, S.col]}
          accessibilityRole="button"
          accessibilityLabel={D.letterWaiting ? '도착한 편지 열기' : '편지함'}
        >
          {D.letterWaiting ? (
            <>
              <Text style={[S.cardLbl, { color: t.textMid }, KEEP]}>토모의 편지</Text>
              <Text style={[S.letterArrived, { color: t.brandText }, KEEP]}>편지가 도착했어요</Text>
              <Text style={[S.cardSub, { color: t.textMid }, KEEP]}>열어보기 ›</Text>
            </>
          ) : (
            <>
              <Text style={[S.cardLbl, { color: t.textMid }, KEEP]}>모은 우표</Text>
              <View style={S.bigRow}><Text style={[S.big, { color: t.textHigh }]}>{D.stamp.have}</Text><Text style={[S.bigUnit, { color: t.textMid }]}>/ {D.stamp.need}</Text></View>
              <ProgressBar t={t} pct={D.stamp.have / D.stamp.need} color={t.brand} />
              <Text style={[S.cardSub, { color: t.textLow }, KEEP]}>다음 편지까지 {D.stamp.need - D.stamp.have}장</Text>
            </>
          )}
        </Pressable>
```
(기존 블록은 `<View style={[card, S.col]}>` 로 시작해 「다음 편지까지 …장」 Text 로 끝난다. 그 `<View>…</View>` 전체를 위 `<Pressable>…</Pressable>` 로 바꾼다.)

- [ ] **Step 3: `letterArrived` 스타일 추가**

`makeStyles` 의 `cardSub` 아래에 추가:
```js
    letterArrived: { fontFamily: fonts.ko, fontSize: 17, fontWeight: '700', marginTop: 2 },
```

- [ ] **Step 4: 빌드 + 프리뷰 검증**

Run: `cd "개발/프론트엔드_무스부/tomori-app" && npm run build` → 0 errors.
프리뷰: 홈 우표 위젯이 「토모의 편지 / 편지가 도착했어요 / 열어보기 ›」(앰버, 폭죽·헤일로 없음) → 탭 → 편지 상세(「2주가 지났어요」). 라이트/다크·콘솔0. 스크린샷 1장.

- [ ] **Step 5: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx"
git commit -m "feat(letter): 홈 우표 위젯 편지 도착 상태 — 탭 시 최신 편지 열기"
```

---

## Task 3: PRD·project_master 정합 (v2.9)

편지 정의(=이정표 편지)·편지함(=편지 컬렉션)·도착 신호(우표 위젯)를 문서에 정합.

**Files:**
- Modify: `기획/PRD.md`
- Modify: `기획/project_master.md`

- [ ] **Step 1: PRD 14.5 「편지 vs 쪽지」 표 갱신**

`기획/PRD.md` 의 표(현재):
```
| 무엇 | 오늘의 학습 요약 PDF | 격려 문장 |
| 받는 법 | **우표 7장 필요** | 그냥 열림 |
| 성격 | 정식·소장용 | 가볍게 보고 지나감 |
```
을 아래로 교체:
```
| 무엇 | **토모의 이정표 편지**(그 기간을 담담히 회고하는 감성 손편지) | 격려 문장 |
| 받는 법 | **우표 마일스톤**(첫 편지 3장·이후 14장, 12.2) | 그냥 열림 |
| 성격 | 소장용(편지함에 쌓임, 8.3) | 가볍게 보고 지나감 |
```
그리고 그 아래 문장 `→ 무게 차이가 …` 뒤에 한 줄 추가:
```
> **v2.9 개정**: 편지는 더 이상 요약 PDF가 아니다(우표 컬렉션 모델, 12.2). 요약 PDF는 우표와 무관한 결과물(무료 월 5회, 12.1)로 분리됐고, 편지는 토모의 감성 리워드다. 도착은 홈 우표 위젯이 「편지 도착」으로 알린다(밝기 헤일로는 쪽지 전용 14.2.1 유지).
```

- [ ] **Step 2: PRD 8.3 편지함 재정의**

`기획/PRD.md` 8.3 문단(현재 「날짜별로 쌓인 "오늘의 학습 요약"을 모아보는 목록 화면. MY 탭 안에 신설하며 …」)의 **첫 문장**을 아래로 교체(나머지 문장은 유지):
```
날짜별로 받은 **토모의 편지**를 모아보는 화면(브랜드 표기 "편지함"). MY 탭 안에 신설하며, 항목을 탭하면 그 편지가 열린다.
```
그리고 문단 끝에 한 줄 추가:
```
> **v2.9**: 편지함은 「토모의 편지 컬렉션」이다(옛 「일별 요약 모아보기」에서 재정의). 일별 세션 요약은 세션 종료 화면·요약 PDF로 남고 편지함엔 넣지 않는다.
```

- [ ] **Step 3: PRD 개정 이력 v2.9 행 추가**

`기획/PRD.md` 개정 이력 표의 v2.8 행 다음에 추가:
```
| **v2.9** | **토모의 편지·편지함 정의**(14.5·8.3) — 편지=토모의 이정표 편지(감성 회고, 우표 마일스톤), 편지함=받은 편지 컬렉션, 도착=홈 우표 위젯. 밝기 헤일로는 쪽지 전용 유지. FE 데모 구현. 근거: `docs/superpowers/specs/2026-07-31-tomo-letters-design.md` |
```
그리고 문서 상단 「문서 상태」·「최종 갱신」의 버전을 v2.9·2026년 7월 31일로 갱신.

- [ ] **Step 4: project_master 정합**

`기획/project_master.md` 에서 편지/편지함을 언급하는 문단(우표 시스템 인근)에, 편지=토모의 이정표 편지·편지함=받은 편지 컬렉션·도착=우표 위젯임을 한 줄로 반영(옛 「편지=요약 PDF」 서술이 있으면 정정). 구체 위치는 `grep -n "편지" 기획/project_master.md` 로 확인 후, 사실과 어긋난 서술만 최소 수정.

- [ ] **Step 5: 커밋**

```bash
git add "기획/PRD.md" "기획/project_master.md"
git commit -m "docs: 편지·편지함 정의 정합 (PRD v2.9) — 이정표 편지·편지 컬렉션·우표 위젯 도착"
```

---

## 완료 후

`기획/진행상태.md` 에 세션 요약(편지·편지함 FE 데모 완료·범위 밖 후속=실 생성·적립·쪽지) 기록 + 커밋.

## Self-Review 결과 (작성자 점검)

- **Spec coverage**: 콘텐츠 모델(Task1 letters.js)·편지 상세(Task1 LetterScreen)·편지함(Task1 LetterBoxScreen)·홈 도착 신호(Task2)·PRD 정합(Task3) — 스펙 전 항목 매핑. 범위 밖(실 생성·적립·쪽지·영속화)은 태스크 없음(정상).
- **Placeholder scan**: 모든 코드·문서 실제 내용. 데모 편지 2통 실문안 포함. Task3 Step4만 grep-후-최소수정(문서 위치 가변이라 정당).
- **Type consistency**: `LETTERS`/`getLetter(id)` Task1 정의 = Task1 LetterScreen·Task2 소비 일치. 라우트 `letter{id}`·`letterBox` App.jsx↔MyScreen↔HomeScreen 일치. `HOME_DEMO.letterWaiting`·`newestLetterId` Task2 Step1 정의 = Step2 사용 일치. 스타일 `letterArrived` Step3 정의 = Step2 사용 일치.
