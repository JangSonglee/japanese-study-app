# 토모리 디자인 토큰 시스템 (v4 · 2026-07-31)

> **Figma 정본**: 파일 `eAn9df9nedEuQD8UaV2wOm` (포트폴리오 작업 공간). `Color System` 페이지에 스와치·타이포 시안.
> **왜 이 문서**: 기존엔 "타이포 크기·여백·라운딩 규칙이 안 정해져 일관되게 못 고치는" 상태였고, `tokens.js`(코드)와 `design_system_spec.md`(문서)의 값이 서로 달랐다. → **토큰으로 단일화**하고, 값은 한 곳(프리미티브)에서만 바꾸도록 3층 구조로 세웠다.
> **적용 상태**: Figma 토큰 = 정본 완료. **앱 `tokens.js` 정합은 후속 작업(step 4)** — 현재 앱은 아직 옛 웜(warm) 팔레트/스케일을 쓴다. 이 문서와 앱 코드가 다르면 "정합 전"이라는 뜻.

---

## 1. 토큰 아키텍처 — 3층

```
프리미티브 (raw 값)        Color 168 · Radius 5 · Spacing 11 · Font Size 8
      ↓ 별칭(alias)
시맨틱 (의미)              Brand · Text · bg · border · status
      ↓ 별칭(alias)
컴포넌트 (부품)            button · card …
```

**핵심 규칙: 값은 「프리미티브」에서만 바꾼다.** 시맨틱·컴포넌트는 프리미티브를 가리키는 별칭이라, 프리미티브 하나를 바꾸면 위 두 층이 자동 반영된다. 화면에서 색·크기를 직접 하드코딩하지 말고 **가장 위(컴포넌트 있으면 컴포넌트, 없으면 시맨틱) 토큰**을 쓴다.

---

## 2. Color

### 2.1 Primitive (Figma 컬렉션 `Primitives`, 168색)
톤 스케일 방식: 각 색 계열 = `계열/톤`(예 `blue/50`), 톤 **99=가장 밝음 → 5=가장 어두움**.
- 무채색: `common/100`(#FFFFFF)·`common/0`(#000000), `neutral/*`(순수 회색 14), `coolNeutral/*`(살짝 푸른 회색 21)
- 유채색: `blue`·`red`·`green`·`orange`·`redOrange`·`lime`·`cyan`·`lightBlue`·`violet`·`purple`·`pink` (각 10~14톤)
- **브랜드 프리미티브(팔레트에 없어 추가)**: `brand/amber`(#F5B942)·`brand/blue`(#2F6FD0)

### 2.2 Semantic (컬렉션 `Brand`·`Text`·`Semantic`)
| 시맨틱 토큰 | → 프리미티브 | 값 | 용도 |
|---|---|---|---|
| `brand/primary` | brand/amber | #F5B942 | 브랜드 강조·리워드·CTA |
| `brand/secondary` | brand/blue | #2F6FD0 | 보조·코스/정보 |
| `text/main` | neutral/22 | #303030 | 본문·제목 (기본 글자) |
| `text/sub` | neutral/50 | #737373 | 보조 설명 |
| `text/tertiary` | neutral/70 | #9B9B9B | 힌트·비활성·타임스탬프 |
| `text/inverse` | common/100 | #FFFFFF | 어두운/컬러 배경 위 글자 |
| `bg/base` | coolNeutral/99 | #F7F7F8 | 페이지 배경 |
| `bg/surface` | common/100 | #FFFFFF | 카드·표면 |
| `bg/sunk` | coolNeutral/97 | #EAEBEC | 눌린 면·트랙 |
| `border/default` | coolNeutral/95 | #D6DCDF | 기본 테두리 |
| `border/strong` | coolNeutral/90 | #C2C4C8 | 강한 테두리 |
| `status/success` | green/50 | #00BF40 | 성공 |
| `status/error` | red/50 | #FF4242 | 오류 |
| `status/info` | blue/50 | #0066FF | 정보 |

### 2.3 색 사용 규칙
- **`brand/primary`(앰버)는 브랜드·리워드·주요 CTA 전용.** 남발 금지.
- 읽는 글자에 `text/tertiary`(흐린 회색)를 쓰지 않는다 — 힌트·비활성에만.
- 정오(정답 success / 오답 error)는 `status/*`. 감정 신호(오답노트 ✕/⤼ 등)는 중립 톤.

---

## 3. Radius (컬렉션 `Radius`)
| 토큰 | 값 | 컴포넌트 매핑 |
|---|---|---|
| `sm` | 8 | 버튼·칩·인풋·토글 |
| `md` | 12 | 이미지 썸네일·중첩 블록 |
| `lg` | 16 | **콘텐츠 카드**(주 카드) |
| `xl` | 24 | 대형 컨테이너·바텀시트 |
| `full` | 999 | pill·원형·아바타·진행바 |

---

## 4. Spacing — 4px 그리드 (컬렉션 `Spacing`)
값: `2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`

**판별 한 줄**: *요소 안 → 12 이하 · **카드 안 → 16** · 카드 밖(카드 사이) → 24 · 섹션 사이 → 32~40 · 화면 좌우 여백 → 20.*
- 인라인(아이콘-텍스트, 뱃지 안): 4~8
- 카드 내부 세로 gap·패딩: 12~16
- 카드-카드: 24 / 섹션-섹션: 32~40
- 4의 배수 밖 값(14·13·11·9·6…) 금지 — 그리드 톤으로 정규화.

---

## 5. Typography

### 5.1 폰트 패밀리 (앱 `tokens.js` 정본)
| 용도 | 폰트 | Figma 상태 |
|---|---|---|
| **KO 전체** | **Pretendard** | 🔴 Figma 미설치(Google Fonts에 없음). KO 텍스트 스타일은 **현재 Noto Sans KR 스탠드인**(각 스타일 description에 명시). Pretendard를 Figma에 로컬설치/팀업로드하면 KO 스타일을 Pretendard로 교체 예정. |
| **JP 콘텐츠**(단어·예문·후리가나) | **Noto Sans JP** | ✅ `Type/JP Body`·`Type/JP Headword` |
| **JP 브랜드/토모** | **Zen Maru Gothic** | ✅ `Type/Brand` |

### 5.2 타입 스케일 8단 (컬렉션 `Font Size` + 스타일 `Type/*`)
근거: 본문 16 기준(14 미만 지양)·헤딩 1.25~1.5배·행간(본문 ~1.5·제목 ~1.2). 대표님 예시(16·18·24·14·12) 수용 + 표준 갭(32·20·11) 보강.

| 역할 | 크기 | 행간(px) | 굵기 | 용도 |
|---|---|---|---|---|
| `display` | 32 | 40 | Bold | 온보딩 대제목·빈 상태 |
| `title` | 24 | 32 | Bold | 화면 제목 |
| `heading` | 20 | 28 | Bold | 섹션 헤더 |
| `subtitle` | 18 | 26 | Medium | 히어로 카드 제목 |
| `body` (기본) | 16 | 24 | Regular | 한국어 본문 |
| `body-small` | 14 | 20 | Regular | 보조 본문 |
| `label` | 12 | 16 | Medium | 라벨·캡션 |
| `caption` | 11 | 16 | Medium | 배지·타임스탬프 |

일본어는 후리가나 여백 때문에 행간을 더 크게: `Type/JP Body`(16/28)·`Type/JP Headword`(30/44, 카드 앞면 큰 글자).

---

## 6. Component 토큰 (컬렉션 `Component`)
모두 시맨틱·파운데이션 토큰을 참조(3층 별칭). 화면은 이 토큰만 쓰면 된다.

**Button**
| 토큰 | → 참조 | 값 |
|---|---|---|
| `button/radius` | radius/sm | 8 |
| `button/height` | spacing/48 | 48 |
| `button/padding-x` | spacing/16 | 16 |
| `button/primary/bg` | brand/primary | #F5B942 |
| `button/primary/label` | text/main | #303030 (앰버 위 다크 텍스트) |
| `button/secondary/bg` | neutral/15 | #1C1C1C (잉크) |
| `button/secondary/label` | text/inverse | #FFFFFF |
| `button/ghost/bg` | bg/surface | #FFFFFF |
| `button/ghost/label` | text/main | #303030 |
| `button/ghost/border` | border/strong | #C2C4C8 |

**Card**
| 토큰 | → 참조 | 값 |
|---|---|---|
| `card/radius` | radius/lg | 16 |
| `card/padding` | spacing/16 | 16 |
| `card/gap` | spacing/12 | 12 |
| `card/bg` | bg/surface | #FFFFFF |
| `card/border` | border/default | #D6DCDF |

---

## 7. Consistency Contract (반 페이지 · 머리에 담을 규칙)
- **카드** = radius `lg`(16) + 안쪽 패딩 16 + 그림자 sh1(다크는 +1px border). 내부 gap 12.
- **버튼** = radius `sm`(8) + 높이 48. primary=앰버 bg+다크 라벨 / secondary=잉크 bg+흰 라벨 / ghost=surface+border+다크 라벨.
- **본문** = `body` 16/24 (KO Pretendard). 일본어는 `JP Body` 16/28.
- **작은 글자** = `label` 12/16. 힌트·비활성만 `text/tertiary`.
- **카드 안 gap 12~16 · 카드 사이 24 · 섹션 32~40 · 화면 좌우 20.**
- **앰버는 브랜드·리워드 전용.** 코스/정보는 파랑(secondary/info).

---

## 8. 상태 & 다음
- ✅ **Figma 토큰 정본 완료**: 3층(프리미티브→시맨틱→컴포넌트) 별칭 검증됨.
- 🅿️ **KO 폰트**: Pretendard를 Figma에 추가하면 KO 텍스트 스타일 교체.
- 🅿️ **앱 `tokens.js` 정합(step 4)**: 앱 코드를 이 토큰 값·규칙으로 맞추기 — 라운딩 주석 정정, 행간/자간/`number` 롤 추가, off-grid 정규화, (색 팔레트 웜→쿨 전환 여부는 대표님 결정 필요).
- 🔴 옛 `design_system_spec.md`(v3.3, 웜 팔레트 기준)와 값이 다름 — 앱 정합 시 함께 개정.
