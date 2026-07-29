# 토모 정식 표정 아트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 도형 스탠드인 `Tomo`를 14종 SVG 표정 아트로 교체하고, 상황별 표정(홈·정답/오답/모름·요약·MY·소개)을 연동한다. 에셋 용량은 최적화한다.

**Architecture:** `Tomo` 컴포넌트에 `pose` prop을 추가해 `<Image>`로 `images/tomo/{pose}.svg`를 렌더한다. 사용처 5곳이 상황에 맞는 pose를 넘긴다. 임베드 PNG는 표시 크기에 맞춰 리사이즈해 dist를 가볍게 한다.

**Tech Stack:** React Native Web(`Image` → `<img>`). Python + Pillow(에셋 리사이즈). 유닛 테스트 러너 없음 → 검증은 빌드 + 5599 프리뷰(이미지 로드/aspect/콘솔). RN Web navigate 직후 좌표 클릭 무시 → `javascript_tool` DOM 확인.

## Global Constraints

- 밝기(헤일로) 확대 축하는 「새 쪽지」 전용(PRD 14.2.1) — 표정 교체는 이와 무관, 새 축하 연출 추가 금지.
- 에셋 파일명 = pose 키(그대로). 앱 접근 경로 `images/tomo/{pose}.svg`(public 기준).
- 표정 매핑 확정값: 홈=`shine`, 정답=`well-done`, 오답=`encouragement`, 모름=`cheer-up`, 요약=(`known/total>=0.7`?`well-done`:`sit`), MY=`bright`, 소개=`intellectual`.
- 원본 SVG는 손실 전 `_원본_고해상도/`로 백업(vocab 패턴).
- 검증 기준: `npm run build` 성공 + 5599 프리뷰 이미지 렌더/aspect 정상 + 콘솔 0.

---

### Task 1: 에셋 용량 최적화

**Files:**
- Create: `개발/프론트엔드_무스부/tomori-app/optimize_tomo_images.py`
- Modify(생성물): `public/images/tomo/*.svg`(임베드 PNG 리사이즈) + `_원본_고해상도/` 백업

**Interfaces:**
- Consumes: `public/images/tomo/*.svg` 14종(임베드 base64 PNG).
- Produces: 같은 파일명·경로의 경량 SVG(렌더 무변화, 용량만 감소). Task 2가 이 파일들을 렌더.

- [ ] **Step 1: Pillow 설치 확인**

Run:
```bash
cd "개발/프론트엔드_무스부/tomori-app" && python -c "import PIL; print('Pillow', PIL.__version__)"
```
Expected: 버전 출력. 없으면 `python -m pip install Pillow` 후 재확인.

- [ ] **Step 2: 최적화 스크립트 작성**

`개발/프론트엔드_무스부/tomori-app/optimize_tomo_images.py`:
```python
# -*- coding: utf-8 -*-
"""optimize_tomo_images.py — 토모 표정 SVG의 임베드 PNG를 표시 크기에 맞춰 축소.
각 SVG(래스터 임베드)의 base64 PNG를 추출 → 높이 TARGET_H로 리사이즈 → 재압축 → 되삽입.
원본은 _원본_고해상도/ 로 1회 백업. viewBox/width/height 속성은 건드리지 않는다(표시 무관)."""
import re, base64, io, os, glob, sys
from PIL import Image

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
TOMO = os.path.join(HERE, 'public', 'images', 'tomo')
BACKUP = os.path.join(TOMO, '_원본_고해상도')
os.makedirs(BACKUP, exist_ok=True)
TARGET_H = 400  # 표시 최대(홈 120px)의 3배 여유

total_before = total_after = 0
for f in sorted(glob.glob(os.path.join(TOMO, '*.svg'))):
    name = os.path.basename(f)
    s = io.open(f, encoding='utf-8').read()
    m = re.search(r'(data:image/png;base64,)([A-Za-z0-9+/=]+)', s)
    if not m:
        print('skip(no png):', name); continue
    raw = base64.b64decode(m.group(2))
    img = Image.open(io.BytesIO(raw))
    if img.height <= TARGET_H:
        print('skip(small):', name); continue
    bpath = os.path.join(BACKUP, name)
    if not os.path.exists(bpath):
        io.open(bpath, 'w', encoding='utf-8').write(s)  # 원본 1회 백업
    w = round(img.width * TARGET_H / img.height)
    img2 = img.convert('RGBA').resize((w, TARGET_H), Image.LANCZOS)
    buf = io.BytesIO(); img2.save(buf, format='PNG', optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    s2 = s[:m.start(2)] + b64 + s[m.end(2):]
    io.open(f, 'w', encoding='utf-8').write(s2)
    total_before += len(raw); total_after += len(buf.getvalue())
    print('%-24s %5dKB -> %4dKB' % (name, len(raw)//1024, len(buf.getvalue())//1024))
print('---\n합계 임베드: %dKB -> %dKB' % (total_before//1024, total_after//1024))
```

- [ ] **Step 3: 실행 + 용량 확인**

Run:
```bash
cd "개발/프론트엔드_무스부/tomori-app" && PYTHONIOENCODING=utf-8 python -X utf8 optimize_tomo_images.py && du -sh public/images/tomo/*.svg | sort -h | tail -3
```
Expected: 각 파일 ~1400KB → ~100KB대, 합계 대폭 감소. 14개 전부 처리(skip은 이미 작을 때만).

- [ ] **Step 4: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/optimize_tomo_images.py" "개발/프론트엔드_무스부/tomori-app/public/images/tomo/"
git commit -m "chore: 토모 표정 SVG 임베드 PNG 최적화(리사이즈·재압축)"
```

---

### Task 2: Tomo 컴포넌트 교체 + 사용처 배선

**Files:**
- Modify: `개발/프론트엔드_무스부/tomori-app/src/components/Tomo.jsx`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/QuizScreen.jsx`(TomoReaction)
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/WordCardScreen.jsx`(DoneView)
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/MyScreen.jsx`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/AboutScreen.jsx`

**Interfaces:**
- Consumes: `public/images/tomo/{pose}.svg`(Task 1 산출).
- Produces: `Tomo({ scale, pose, note, showNote })` — `pose` 기본 `'sit'`, `<Image>` 렌더. 사용처는 pose만 넘기면 됨.

- [ ] **Step 1: Tomo.jsx를 이미지 렌더로 교체**

파일 전체를 아래로 교체한다. glow(후광 View)는 제거한다(아트에 빛 표현이 있어 중복 — Step 5 프리뷰에서 어색하면 복원).
```jsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

/**
 * 토모 — 등불 캐릭터. 표정 아트(SVG, public/images/tomo/{pose}.svg).
 *
 * 사양 근거:
 *  · 밝기 = 「학습 상태」 신호. 밝아짐(헤일로 확대)은 「새 쪽지」 전용(PRD 14.2.1) — 여기선 표정만.
 *  · pose 한 곳으로 홈·요약·모달·MY·소개에 동시 반영.
 *  · 🔴 웹 슬라이스는 <Image>가 <img>로 SVG를 렌더. Expo 정식 이식 땐 expo-image/react-native-svg로 교체.
 *
 * props:
 *   scale = 크기 배율(기본 높이 96px 기준)
 *   pose  = 표정 키(파일명). 기본 'sit'
 *   note / showNote = 아래 캡션
 */
const ASPECT = 248 / 326;   // viewBox 폭/높이
const BASE_H = 96;          // scale 1 기준 높이(px)

export default function Tomo({ scale = 1, pose = 'sit', note = '토모', showNote = true }) {
  const { t } = useTheme();
  const h = BASE_H * scale;
  const w = h * ASPECT;
  return (
    <View style={styles.stage}>
      <Image
        source={{ uri: `images/tomo/${pose}.svg` }}
        style={{ width: w, height: h }}
        resizeMode="contain"
        accessibilityLabel="토모"
      />
      {showNote ? <Text style={[styles.note, { color: t.textLow }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  note: { fontFamily: fonts.ko, fontSize: 11 },
});
```

- [ ] **Step 2: HomeScreen — pose="shine"**

현재 `<Tomo scale={1.25} showNote={false} />`를 교체:
```jsx
        <Tomo scale={1.25} pose="shine" showNote={false} />
```

- [ ] **Step 3: QuizScreen TomoReaction — kind→pose**

`TomoReaction` 안의 `<Tomo scale={1.15} showNote={false} />`를 교체한다. `ok`/`unknown`은 이미 함수 내에 있다.
```jsx
        <Tomo scale={1.15} pose={ok ? 'well-done' : unknown ? 'cheer-up' : 'encouragement'} showNote={false} />
```

- [ ] **Step 4: DoneView / MyScreen / AboutScreen**

(a) WordCardScreen `DoneView`의 `<Tomo scale={1} note="토모 — 임시 스탠드인 (평소 밝기)" />`를 교체(성적 기반 pose, 캡션 정리):
```jsx
      <Tomo scale={1} pose={total > 0 && known / total >= 0.7 ? 'well-done' : 'sit'} note="토모" />
```

(b) MyScreen `<Tomo scale={0.7} showNote={false} />` → `<Tomo scale={0.7} pose="bright" showNote={false} />`

(c) AboutScreen `<Tomo scale={1} showNote={false} />` → `<Tomo scale={1} pose="intellectual" showNote={false} />`

- [ ] **Step 5: 빌드**

Run:
```bash
cd "개발/프론트엔드_무스부/tomori-app" && npm run build
```
Expected: `✓ built in ...` (에러 0).

- [ ] **Step 6: 프리뷰 검증 (5599)**

`preview_start {name:"fe"}` → `navigate http://localhost:5599`.
- 홈: `javascript_tool`로 `document.querySelector('img[src*="tomo/shine.svg"]')` 존재 + `naturalWidth>0`(로드 성공) 확인. 이미지 찌그러짐 없는지 aspect 비교(`naturalWidth/naturalHeight` ≈ 248/326).
- 독해 진입 → 오답 제출 → 모달 img src에 `encouragement.svg`. 정답 → `well-done.svg`. 모름 → `cheer-up.svg`.
- 세션 요약까지 진행(오답 위주) → img src `sit.svg`(성적<70%). 
- MyScreen(홈 MY 버튼) → `bright.svg`. AboutScreen 진입 경로 있으면 `intellectual.svg`.
- 다크/라이트 양 테마에서 배경과 자연스러운지(스크린샷 시도, 안 되면 DOM으로 대체).
- `read_console_messages` 에러 0.
- glow 없이 어색하면(빛 표현 부재) Step 1에 glow 복원 후 재빌드.

- [ ] **Step 7: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/src/components/Tomo.jsx" "개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx" "개발/프론트엔드_무스부/tomori-app/src/screens/QuizScreen.jsx" "개발/프론트엔드_무스부/tomori-app/src/screens/WordCardScreen.jsx" "개발/프론트엔드_무스부/tomori-app/src/screens/MyScreen.jsx" "개발/프론트엔드_무스부/tomori-app/src/screens/AboutScreen.jsx"
git commit -m "feat: 토모 도형 스탠드인 → 정식 표정 아트(pose별 SVG) 교체"
```

---

### Task 3: 진행상태 문서 기록

**Files:**
- Modify: `기획/진행상태.md`

**Interfaces:**
- Consumes: Task 1·2 완료.
- Produces: 없음(문서).

- [ ] **Step 1: 진행상태.md에 기록 추가**

내용: 토모 정식 표정 아트(14종 SVG) 도입, 표정 매핑 확정(홈 shine·정답 well-done·오답 encouragement·모름 cheer-up·요약 성적≥70% well-done else sit·MY bright·소개 intellectual), 향후 예약 표정, Tomo pose prop + Image 렌더, 용량 최적화 수치, 검증 결과, 스펙·계획 경로.

- [ ] **Step 2: 커밋**

```bash
git add "기획/진행상태.md"
git commit -m "docs: 진행상태에 토모 표정 아트 기록"
```

---

## Self-Review

- **Spec coverage:** 매핑 7자리=Task2 Step2~4 / pose prop+Image=Step1 / 요약 성적 기준=Step4a / 최적화=Task1 / 향후 예약 표정=문서(Task3). 모든 스펙 항목에 태스크 있음.
- **Placeholder scan:** 스크립트·컴포넌트 전체 코드 포함. glow 복원은 조건부 지시(프리뷰 판단)로 명시.
- **Type consistency:** `Tomo` prop 이름 `scale`/`pose`/`note`/`showNote` 전 사용처 일치. TomoReaction의 `ok`/`unknown` 변수는 기존 함수 내 존재(선행 기능). DoneView `known`/`total` prop 기존 존재. 파일 경로 `images/tomo/{pose}.svg` 스크립트 출력 경로와 일치.
