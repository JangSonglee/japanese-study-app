# 작업 규칙 — 토모리(Tomori) 프로젝트

> **작업 디렉터리 = 프로젝트 루트** (`C:\github\JangSonglee\japanese-study-app`).
> 2026-07-27 D:→C: 이전 때 예전의 `chicken`/`Japanese-app` 분리를 통합했다. **`기획/`·`디자인/`·`개발/`·`리서치/`가 이 루트 바로 아래** 있다.
> GitHub: https://github.com/JangSonglee/japanese-study-app (private).

## 프로젝트 한 줄 요약
**토모리(Tomori)** — 일본어 학습 앱. 캐릭터 **토모(작은 등불)**, 리워드 **우표 → 편지**.
핵심 철학: **"학습 의지를 꺾지 않고 북돋아 준다. 수익 요소가 학습을 방해하지 않는다."**

## 🔴 대화 압축(compaction) 시 반드시 보존할 것
압축으로 요약이 만들어질 때, 아래는 **길이를 줄이더라도 반드시 남긴다.**

1. **수정·생성한 파일 목록** — 어떤 파일을 건드렸는지. 경로 포함.
2. **실행·확인 명령어** — 아래 "확인 방법" 항목의 URL과 명령.
3. **미해결 항목 / 대표님 결정 대기 중인 질문** — 답을 못 받은 채 넘어간 것.
4. **결정의 *이유*** — "무엇을 정했는가"보다 **"왜 그렇게 정했는가"**가 더 중요하다. 근거가 사라지면 나중에 같은 논의를 반복하게 된다.
5. **진행 중인 서브에이전트 작업** — 누가 무엇을 하고 있었는지.

> ⚠️ 단, 압축은 시스템이 수행하므로 이 지침이 100% 보장되지는 않는다.
> **가장 확실한 보존 수단은 파일 기록이다.** 중요한 결정은 대화에만 남기지 말고 반드시 아래 문서에 쓴다.

## 기준 문서 (여기가 진실의 원본)
| 문서 | 내용 |
|---|---|
| `기획/진행상태.md` | **⭐ 여기부터 읽을 것** — 현재 단계·완료·다음 할 일 |
| `기획/PRD.md` | 제품 요구사항 (개정 이력이 문서 맨 위에 있음) |
| `기획/claude_code_handoff.md` | 화면 목록 |
| `기획/JLPT_플로우_검토.md` · `코스별_플로우_검토.md` | 화면별 결정과 근거 |
| `디자인/디자인시스템/design_system_spec.md` | 컬러·타이포·폰트·컴포넌트 |

**원본과 사본**: 대표님 바탕화면(`Desktop/송이/portpolio/일본어 앱/`)에 원본 md가 있지만,
**작업 기준본은 `기획/` 안의 사본**이다. 원본이 갱신되면 사본을 다시 복사한다.

## 확인 방법
### 기획·디자인 (정적 산출물 — 브라우저로 연다)
```bash
# 미리보기 서버 (.claude/launch.json의 wireframe, 포트 5500 = 프로젝트 루트 서빙)
```
| 산출물 | URL |
|---|---|
| Lo-fi 와이어프레임 | `http://localhost:5500/디자인/tomori_lofi_wireframe.html` |
| Hi-fi 목업 | `http://localhost:5500/디자인/tomori_hifi_mockup.html` |
| 디자인 시스템 | `http://localhost:5500/디자인/디자인시스템/tomori_design_system.html` |
| 폰트 검증 | `http://localhost:5500/디자인/디자인시스템/font_verification.html` |

구조 점검용(프레임 수 == memo 수, 항상 1:1):
```bash
cd "C:/github/JangSonglee/japanese-study-app/디자인" && \
echo "프레임 $(grep -o 'class="frame"' tomori_hifi_mockup.html | wc -l) / memo $(grep -o 'class="memo"' tomori_hifi_mockup.html | wc -l)"
```

### BE / FE (2026-07 추가 — 상세는 `기획/진행상태.md`)
- **Supabase DB `tomori`** 라이브: 스키마+RLS+단어 1,600건. **Supabase MCP 연결됨**(프로젝트 ref `vtbprgphfksfffivfnrf`).
- **FE 단어 카드**(`개발/프론트엔드_무스부/tomori-app`, Vite+RN Web): 빌드 `vite build` → `vite preview --port 5598`. 실 Supabase에서 N5를 읽음.
- 🔴 **민감파일**: `개발/백엔드_도다이/db_url.txt`(DB 비번)·Google 키(repo 밖 `C:\Users\hd\.secrets\tomori\`로 이동됨)는 커밋 금지(.gitignore). 커밋 전 `git status` 확인.

## 팀 (AI 서브에이전트 6명)
키카쿠(PM·기획/) · 슈슈(리서치/) · 아토(디자인/) · 무스부(FE) · 도다이(BE) · 시라베(QA)
각 폴더 `README.md`에 담당·업무범위가 있다.

## 작업 방식
- **결정하면 즉시 문서에 쓴다.** 대화에만 남기지 않는다.
- **이유를 함께 적는다.** 나중에 "왜 이렇게 했지?"가 반드시 나온다.
- 와이어프레임은 **그레이스케일**, 설명은 **프레임 밖 memo**로 분리 (Hi-fi·디자인시스템은 실제 색 사용).
- 화면 번호는 **재부여하지 않는다.** 신규는 뒤에 이어붙인다.
- 문서를 고칠 때 기존 결정을 뒤집게 되면, **뒤집는 이유를 개정 이력에 남긴다.**
- 대표님께는 **부드러운 해요체**로. 단, 틀린 건 틀렸다고 분명히 말한다.
