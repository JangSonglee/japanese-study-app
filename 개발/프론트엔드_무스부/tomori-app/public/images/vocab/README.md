# 단어 일러스트 이미지 — 넣는 곳 & 규칙

> 카드 중앙 이미지 슬롯(레퍼런스 플래시카드 스타일)에 쓰는 단어 일러스트를 여기 둔다.
> 스타일: **귀여운 플랫 + 검은 외곽선 + 부드러운 그림자**(대표님 예시 톤 유지 — 猫·花·りんご·電車·편지 등).

## 어디에 넣나
| 단계 | 위치 | 파일명 |
|---|---|---|
| **지금(웹 슬라이스 표시용)** | `public/images/vocab/` ← **여기** | 🔴 **`{content_key의 점을 밑줄로}.png`** 예: content_key `jlpt.n5.vocab.0254` → **`jlpt_n5_vocab_0254.png`** |
| **원본 초안(뜻 이름)** | `public/images/vocab/_원본_뜻이름/` | 대표님이 만든 그대로 (`고양이.png` 등) — content_key 매핑 전 임시 보관 |
| **최종(프로덕션)** | 🔴 **Supabase Storage** `asset/jlpt/{급수}/{content_key}.png` (규격 4.7) | 앱은 Storage URL로 로드 |

> 🔴 **왜 밑줄형인가**: FE 카드가 `images/vocab/{card.key의 점→밑줄}.png`로 자동 로드한다(`WordCardScreen`). content_key `jlpt.n5.vocab.0254` → 파일 `jlpt_n5_vocab_0254.png`. 파일이 있으면 카드 중앙에 뜨고, 없으면 「이미지 예정」 플레이스홀더로 폴백(스키마 변경 불필요).

## 전 급수 지원 (N5~N1)
급수는 content_key에 들어 있으므로 **모든 급수가 동일하게 동작**한다:
- N5 `jlpt_n5_vocab_0254.png` · N4 `jlpt_n4_vocab_0012.png` · N3 `jlpt_n3_vocab_...` · N2 `jlpt_n2_vocab_...` · N1 `jlpt_n1_vocab_...`
- content_key는 각 급수 CSV(`리서치/02_JLPT/N{급수}_단어_400.csv`)의 `content_key` 열에서 찾는다.

## 워크플로 (새 이미지 추가 시)
1. 이미지를 이 폴더에 `jlpt_{급수}_vocab_{연번}.png`로 넣는다.
2. **최적화 + 매니페스트 생성**:
   ```bash
   python 개발/프론트엔드_무스부/optimize_vocab_images.py
   ```
   → 원본 백업 + 가로800px·≤200KB 압축 + `manifest.json`(이미지 있는 content_key 목록) 갱신.
3. `npm run build` (public→dist 복사).
4. 앱에서 해당 급수 「단어·어휘」 진입 → **이미지 있는 단어가 세션 앞에** 뜬다(전 급수, `App.jsx`가 manifest 기반으로 우선 노출).

## 왜 파일명을 content_key로?
- 뜻 이름(고양이)은 **1:1이 아니다** — 같은 뜻의 다른 단어, 급수별 동형어가 있어 충돌한다.
- content_key(`jlpt.n5.vocab.0001`)는 **단어 1건을 유일하게** 가리킨다(규격 4.0). 음성 파일명 규칙과 동일.
- 그래서 **초안(뜻 이름)** 은 `_원본_뜻이름/`에 두고, **매핑 후 content_key로 이름을 바꿔** 이 폴더 루트에 둔다.

## 뜻 이름 → content_key 매핑
1. `리서치/02_JLPT/N5_단어_400.csv` 등에서 `meaning_ko`로 해당 단어의 `content_key`를 찾는다.
2. 예: 뜻 "고양이" → `猫`(ねこ) → 그 행의 content_key.
3. 필요하면 매핑 도우미 스크립트를 만들어 일괄 리네임한다(요청 시 슈슈/무스부가 작성).

## 🔴 스키마 변경 필요 (도다이)
- `vocab_items`에 **`image_url text`** 컬럼이 아직 없다(현재 `audio_url`만 있음).
- 이미지 파이프라인을 붙이려면 `image_url` 추가 + FE `dbRowToCard`에 image 매핑 + 카드 이미지 슬롯이 `image_url` 있으면 표시, 없으면 플레이스홀더.
- 그 전까지는 **파일명 규칙만 맞춰 이 폴더에 쌓아두면** 나중에 일괄 연결된다.

## 커밋
- 이 일러스트들은 작아서 커밋해도 된다(민감파일 아님). `.gitignore` 대상 아님.
- 단, 대량·고해상도면 용량 주의(오프라인 미리받기 용량과 직결 — 규격 4.7: 가로 1080px 이하 권장).
