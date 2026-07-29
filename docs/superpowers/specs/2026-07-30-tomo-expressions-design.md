# 토모 정식 표정 아트 — 설계

- 날짜: 2026-07-30
- 대상: `개발/프론트엔드_무스부/tomori-app/src/components/Tomo.jsx` + 사용처 5곳
- 에셋: `public/images/tomo/*.svg` 14종(대표님 제공, 래스터 임베드 SVG viewBox 248×326)

## 1. 목적 / 문제

현재 `Tomo`는 도형(View)으로 그린 **임시 스탠드인**이고, 반응(정답/오답/모름)은 문구·색으로만
구분한다. 대표님이 14종 토모 표정 아트(SVG)를 제공 → 스탠드인을 실제 아트로 교체하고,
상황별 표정을 연동한다. Tomo 컴포넌트 한 곳만 교체하면 홈·요약·모달·MY·소개에 동시 반영된다
(기존 주석의 설계 의도 그대로).

## 2. 에셋 현황

- 14 SVG, 각 ~1.4MB(내부에 1448×1086 base64 PNG 임베드 — 벡터 아님, 색상 테마 연동 불가).
- viewBox 248×326(세로형). 파일명 = 표정 키. 총 ~20MB → **표시 크기에 맞춰 최적화 필요**.
- 목록: shine, sit, to-wait, cheer-up, read, encouragement, well-done, bright, surprise,
  worry, shyness, desperate+tears, resolution, intellectual.

## 3. 표정 매핑 (대표님 결정 2026-07-30)

**지금 배선 (화면 존재)**

| 자리 | pose | 비고 |
|---|---|---|
| 홈(HomeScreen) | `shine` | "작은 불빛 하나 같이 켜 볼까요"와 정합 |
| 정답 모달(TomoReaction correct) | `well-done` | 두 손 최고 |
| 오답 모달(TomoReaction wrong) | `encouragement` | 불씨 토닥토닥 위로 |
| 모름 모달(TomoReaction unknown) | `cheer-up` | 솔직함 격려 |
| 세션 요약(DoneView) | 성적 ≥ 70% → `well-done`, 아니면 `sit` | known/total 비율 |
| MY(MyScreen) | `bright` | 초롱초롱 인사 |
| 소개(AboutScreen) | `intellectual` | PRD 14.2 안경 토모 |

**향후 예약 (컴포넌트에 키만 존재, 화면 생기면 배선)**: read(편지) · surprise(새 쪽지) ·
to-wait(오랜만 복귀) · worry(막힘) · resolution(목표) · shyness · desperate+tears.

- 세션 요약 성적 기준: `total > 0 && known / total >= 0.7`. 미만은 `sit`(중립 — 부정 아님).
- 밝기(헤일로) 확대 축하는 여전히 「새 쪽지」 전용(PRD 14.2.1). 표정 교체는 이 규칙과 무관.

## 4. 구현

### 4.1 Tomo 컴포넌트
- `pose` prop 추가(기본 `'sit'`). 값 = 파일명 키.
- 렌더를 도형(View) → `<Image source={{ uri: `images/tomo/${pose}.svg` }} resizeMode="contain" />`로 교체.
  RN Web에서 `<img>`로 SVG를 띄운다(웹 슬라이스 한정 — Expo 정식 이식 땐 expo-image/react-native-svg로 교체, 예고된 배선 지점).
- 크기: aspect 248:326 유지. `baseH`(기본 높이) 기준 `height = baseH * scale`, `width = height * 248/326`.
  기존 `scale` 사용처 유지(홈 1.25 · 모달 1.15 · 요약 1 · MY 0.7 · 소개 1).
- `note`/`showNote`(캡션) prop은 그대로. glow(헤일로)는 제거하거나 유지 — 아트에 이미 빛 표현이 있으면 중복이므로 제거 검토(구현 시 프리뷰로 판단).

### 4.2 사용처 pose 전달
- HomeScreen: `pose="shine"`.
- QuizScreen `TomoReaction`: `kind` → pose 매핑({correct:'well-done', wrong:'encouragement', unknown:'cheer-up'}).
- WordCardScreen `DoneView`: `pose={known/total >= 0.7 ? 'well-done' : 'sit'}` (total>0 가드).
- MyScreen: `pose="bright"`. AboutScreen: `pose="intellectual"`.

### 4.3 용량 최적화
- 신규 스크립트: 각 SVG의 임베드 base64 PNG 추출 → PIL로 높이 ~400px 리사이즈(aspect 유지) →
  PNG 재인코딩(optimize) → base64 재삽입 → SVG 저장. viewBox/width/height 속성은 그대로(표시 무관).
- 목표: 각 ~1.4MB → ~100KB 안팎, 14개 합계 ~1–2MB. 원본은 `_원본_고해상도/`로 백업(vocab 패턴).

## 5. 안 건드리는 것 (YAGNI)

- 밝기 헤일로 축하 로직(「새 쪽지」 전용) — 이번 범위 밖.
- 향후 예약 표정의 실제 배선(해당 화면 없음).
- BE/DB/오답노트/인증.

## 6. 검증 방법

FE 빌드 → 5599 프리뷰:
- 홈에 `shine`, 정답 모달 `well-done`, 오답 `encouragement`, 모름 `cheer-up` 이미지 렌더(깨짐/404 없음).
- 세션 요약: 성적 ≥ 70%면 `well-done`, 미만이면 `sit`.
- MY `bright`, 소개 `intellectual`.
- 이미지 aspect 정상(찌그러짐 없음), 다크/라이트 양 테마에서 배경과 자연스러움, 콘솔 0.
- 최적화 후 dist 내 tomo 합계 용량 확인(대폭 감소).

구현·검증 후 `기획/진행상태.md`에 결정·근거 기록.
