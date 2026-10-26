# Gemini 4 Argon 실사용 노트 (2026-10-09 ~ 10-21)

출시(9/30 제한 공개, 10/13 GA) 후 2주간 수집한 1차 사용기에서 **둘 이상의 독립 출처가 일치한 관찰**만 적는다. 규칙(`rules/AGENTS.md` `<argon_runtime_constraints>`)과 스킬의 근거 문서다. 수치는 각 출처의 자체 측정이며 재현하지 않았다.

## 1. 호스트(Antigravity) 수준 제약

| 관찰 | 출처 |
|---|---|
| 큰 단일 `write_to_file`(10KB+, ~1,200줄)이나 긴 사고 뒤 "Model unavailable, retrying (k/9)" 루프. 실체는 무응답 60초 컷오프(79건 중앙값 60.35초). 100줄 이하 분할로 완화 | Google AI 개발자 포럼 189559 (10/15), note.com masa_wunder(80행 분할로 완주), CyberQ(샌드박스 연결 끊김 25건) |
| 자동 컴팩션 2회 뒤 재검증 없이 편집 → 존재하지 않는 식별자 6개 도입, 쓰기 후 재열람 없음 | 개발자 포럼 189476 (10/15), Theo(t3.gg: 1시간 파일만 읽다 스레드 초기화) |
| 첫 토큰 전 5분 이상 사고 → 외부 하네스 헤더 타임아웃, 출력 32K에서 `finish: length`로 파일 유실 | dev.to akartit (opencode), Qiita htani0817 (비스트리밍 10분 종료) |
| CLI의 컨텍스트 컴팩션이 비결정적 | HN charm137 |
| API 키 모드(`modelProvider: "gemini"`)에서 `gemini-4-argon` 미인식 → Gemini 3.8 Flash(High)로 무음 폴백 | GitHub antigravity-cli #1228 |
| Antigravity 앱·CLI의 Argon은 처음엔 Ultra·Enterprise만이었다가 **10/15부터 유료 Pro에도 배포**(체험판 제외). Pro는 3.8 Flash와 별도인 주간 전용 Argon 쿼터, MEDIUM/HIGH만 | Antigravity 블로그(10/13), 클리앙 19277177, i-Style, @antigravity X(10/15), 개발자 포럼 189734/189741/189731 |
| Windows 샌드박스에서 language server 크래시 | 클리앙 19277539 |

### 1-1. 하네스 차이

| 관찰 | 출처 |
|---|---|
| 같은 모델도 하네스에 따라 점수가 크게 갈림: 105개 실버그 벤치에서 Gemini CLI 33 → Antigravity CLI(`agy`) 40.7 | Paweł Huryn |
| Gemini CLI가 보내는 thinking budget을 Gemini 4가 거부해 어댑터 필요. agy headless는 자기 페이지 스크린샷 7회 확인, Gemini CLI는 브라우저 스크립트 실패 | ohmyunicorn |
| 외부 하네스는 헤더 타임아웃(5분+ 첫 토큰)과 출력 상한(≥65,536)을 올려야 파일이 유실되지 않음. `max_output_tokens`에 사고 토큰 포함, temperature/top_p 무시 | dev.to akartit, Qiita htani0817 |
| Argon 전용 컨텍스트 옵션 256K(기본)/512K/900K, 턴당 쿼터 배수 ≈1.3×/≈1.8×(UI 관찰값, 미검증) | LuminaBench, TestingCatalog |
| 이미지 툴 결과 뒤 대화 전체 재전송으로 캐시 적중 약 4%, T3 Code 연동 시 70~80% | dev.to akartit, Theo |

## 2. 모델 행동

| 관찰 | 출처 |
|---|---|
| 출력·사고 토큰 과다: 실행당 ~24K(Sonnet ~3K), AA 과제당 62K(Astra 27K), low→high 전환 시 6배 시간·13배 비용 | HN ariwilson, eesel/AA, i-Style, ritsuto("トークン消費量がえげつない") |
| 기본 사고 수준 MEDIUM, 벤치 수치는 HIGH 기준. medium/high 점수차(1.4)보다 run 편차(33~46)가 큼 | TechTimes 10/15, Paweł Huryn |
| 5시간 한도: Ultra에서 무거운 과제 3~4개(또는 10개 미만)로 창 소진, Pro는 질문 몇 개 | 虎嗅, ritsuto, 개발자 포럼 189085, 경향·에펨·디시 |
| 추론 루프 / 10회 중 1회 루프 또는 에러 | HN gertlabs·saejox·jiggawatts, 클리앙(10분 후 실패) |
| reasoning 블록 경계 누락 | HN gertlabs·Bobaso |
| 요청 범위 그대로만 처리("완전성"을 안 물으면 절반만), 모호하면 동일 기능 함수 중복 생성 | CyberQ, masa_wunder |
| 테스트 통과 즉시 완료 선언, 브라우저 미확인(리뷰 단계 30ms 종료 17/38회) | BrainBytes Lab, AGIラボ(브라우저 0회), Every Vibe Check |
| 코드베이스 "설명·감사" 환각: 감사 결과 60~70% 허위, 30행 수정을 1,200행으로, 리포 skill 파일 무시 | Theo(t3.gg), Every(리팩터링 21%) |
| 자기 보고 수치 불일치(글자수 167 vs 실제 163), 산술 오류 | note.com kazu_t, HN eyalitki |
| 출처 없는 수치("約98%")를 단정형으로 작성, 페이지 안 "Benchmark" 패널에 지어낸 값 | Zenn 大賀, ohmyunicorn |
| 환각은 낮지만(AA 15%) 유보가 많아서임(어려운 사실 정답률 50% vs Astra 63%), 안전 필터 잦은 발동 | Techzine, DeepLearning.AI, HN dom96, 포럼 189556 |
| 글쓰기·법률·문서 추론은 최상위(Vals 1위, LexisNexis 인용 검증 호평), 구조 편집 강함, 원샷 초안은 밀도 과다 | HN svara·mwigdahl, 경향, 에펨, Every |
| 터미널·에이전틱 코딩은 Opus 5.5·Astra 열세(Terminal-Bench 4.0 최하위), 하네스에 따라 극단적으로 갈림(Gemini CLI 33 → agy 40.7) | Google 자체 표, Techzine, Huryn, HN meowface |
| 프론트엔드 감각은 3.8 Flash보다 좋지만 모바일 레이아웃 깨짐 | TestingCatalog, HN jatins 외, GeekNews |
| 간접 프롬프트 인젝션 저항 학습(자체 ASR 0.7%), 1차 외부 검증 없음 | eesel/AA, DeepLearning.AI |
| 한국어 1차 품질 데이터 없음. 일본어 퇴고는 보수적(90본 중 68본 원문 그대로), 중국어는 따옴표 남용, em dash 재등장 | Zenn, 虎嗅, GeekNews |
| 과잉 검증 루프: 로그에 답이 있는데 검색 15회·웹 33페이지 후 404로 답안 미작성. 시간 제한 없으면 과제당 ~30분 자율 실행 | CyberQ, MindStudio |
| 비전: 탐지·OCR 벤치는 상위지만 손글씨 JSON 추출·다이얼 판독 실패, 이미지당 13~20초. 모델 오디오 전사에 명백한 오류. 음성·영상 분리 입력 시 날조 최소 | Roboflow, bilibili BV1Sqpy6KE2p, masa_wunder |
| 장면이 성적 묘사로 넘어가는 시점에 즉시 차단(3.x는 통과) | 개발자 포럼 189556 |
| 리포 skill 파일 무시, CI/lint 실패·리뷰봇 코멘트 무시, 기존 PR 2건 미확인 | Theo(t3.gg) |

## 2-1. 10/15 ~ 10/17 신규 (이슈 트래커·포럼 원문 확인)

| 관찰 | 출처 |
|---|---|
| UI는 1.0M을 표시하지만 요청 메타데이터의 `max_context_tokens`는 256000, 240~280K에서 강제 컴팩션. `AGY_CLI_AUTO_COMPACT_OVERRIDE`는 효과 없음. 컴팩션마다 캐시 0. 요약 뒤 ID·스케일·SHA 날조로 리포트 사실 21/64 오류(recall 테스트는 40/40) | antigravity-cli #1245 |
| 60초 침묵 절단의 원인이 클라이언트 HTTP 설정(HTTP/2·KeepAlive 비활성)으로 좁혀짐. `write_to_file` 인자 25KB 초과나 긴 thinking이 트리거, 8회 재시도 전부 실패. 약 5,000 출력 토큰 / 100줄 단위 분할로 해결 | antigravity-cli #1255, 개발자 포럼 189747 |
| agy 1.3.6: 스트림 5분 정지 시 자동 재시도(60초 문제는 미해결), 따옴표 없는 `description:`의 콜론으로 skill·rule·agent 로딩 실패하던 문제 수정, plugin 이름 대소문자 무시 | antigravity-cli 1.3.6 릴리스 노트 |
| agy 1.4.0: `agy plugin validate --strict --json`이 실제 로더 규칙으로 검사, plugin MCP 헤더 `${TOKEN}` 치환 수정. 같은 버전에서 `agy -p "/skills"`가 빈 목록을 반환하는 회귀 | 1.4.0 릴리스 노트, antigravity-cli #1266 |
| 규칙 파일이 토큰 예산을 넘으면 잘리지 않고 통째로 빠짐: 118,908B `AGENTS.md`는 0 주입, 24,024B는 전부 주입 | antigravity-cli #1254 |
| 서브에이전트가 한 턴에 도구 2개 이상을 부르고 그중 하나가 승인 대상이면 승인이 다음 단계로 잘못 가서 병렬 웨이브가 멈춤 | antigravity-cli #1249 |
| 하루 사이 C++ UAF·race 디버깅, 리버싱·PE 헤더 프롬프트가 Gemini 필터에 차단. 한 번 차단된 스레드는 계속 막힘. 스태프가 Claude는 별도 분류기라며 우회책으로 권장, 오탐 신고에 버전·모델·사고 수준 요청 | 개발자 포럼 189611, 189748 |
| 쿼터: Pro TL=Medium에서 50줄 작업 하나가 한도의 44%(3.1 Pro는 6%). Pro 첫날 주간 59%, 캐시 히트 약 21.0M으로 캐시 비율 자체는 높음. 턴당 소비는 컨텍스트 길이에 비례, 작업이 바뀌면 새 대화 권고 | 포럼 190078·189788·189731, locdd 100913 |
| 앱 2.22.0 업데이트 뒤 커스텀 skill 664개가 UI에서 사라짐. 스태프가 skill 경로 5곳 공개 | 포럼 189763 |
| 일부 지역 결제 Ultra 계정에서 `userTier`가 비어 Starter 쿼터 적용 | 포럼 189620 |
| Windows 앱 2.23.1에서 긴 작업이 "task cancelled by user"로 자동 취소 | 포럼 189646 |

모순: 공식 발표는 Pro 쿼터가 "weekly-only"인데 5시간 한도 도달 보고가 있다(포럼 190078). 캐시는 "컴팩션마다 0"(#1245)과 "0은 trailer 누락에 의한 기록 착시"(189747)가 엇갈린다.

## 2-2. 10/16 ~ 10/21 신규 (릴리스·롱 디코드·캐시·한일중 실무 후기)

| 관찰 | 출처 |
|---|---|
| `antigravity-cli` 1.4.1~1.4.3: `GEMINI_API_KEY` 모드에서 `--model` Argon 표시 수정, 컴팩션 직후 서브에이전트 상태 유실 수정, 안전 명령 중복 승인 생략, `/diff` 내 `/search`(`n`/`N`) 추가 | GitHub antigravity-cli releases 1.4.1~1.4.3 |
| 호스트·티어 이슈: 단독형 레거시 IDE 지원 배제(데스크톱 앱 v2.24+, CLI, VS Code/JetBrains 확장만 지원), App 2.24.0에서 Google AI Pro 가족 공유(Family Sharing) 구성원 계정 Argon "Unavailable" 표시 버그 | Google AI 개발자 포럼 |
| 롱 디코드(65K+)와 `CONTINUATION` 루프: 단일 동기 출력 상한은 65K이며 장문 출력은 `finish_reason=CONTINUATION` 토큰 핸드셰이크로 이어짐(수동 `"continue"` 입력 시 스트림 단절). 홉마다 누적되는 프리필을 하네스가 컨텍스트 초과로 오인해 조기 컴팩션을 발동하는 함정 보고 | Gen AI SDK 문서, 개발자 포럼 |
| 암시적 캐싱(Implicit Caching, ≥6,144 토큰 정적 접두사 95% 할인): 명시적 캐시 미지원, 6,144토큰 이상 정적 접두사에 자동 95% 할인 적용. 정적 규칙·원문 증거를 상단에 고정하고 동적 질의를 하단에 배치해야 캐시 적중 유지 | 개발자 문서, 개발자 포럼 |
| 한국어 초장문·법률/문서 추론("문과 최강"): 1.5만자 이상 초장문·법률/비즈니스 윤문에서 맥락 이탈 없는 최상위 문장력 확인. ①역할 부여 → ②원문 Context 상단 선주입 → ③3단계 사고(쟁점→리스크→초안) → ④출력 포맷 하단 고정의 4단 프롬프트 구조 정석화. 단순 질의에도 기본 thinking 토큰이 대량 차감되어 가벼운 작업은 Flash 분리 필수 | 아카라이브(10/18), 루리웹(10/17), 위시켓, 클리앙, 에펨코리아 |
| 일본·중국 실사용 및 PDF 비전: 일본 Zenn(10/18) 퇴고 실험에서 불필요한 완곡어(헤징)를 제거하고 원문 단정형을 보존하는 특성 및 Blender/MuJoCo MCP 자율 루프(note.com 10/19, Qiita 10/17) 확인. 중국 知乎(10/19)에서 비표준 워크플로·레거시 마이그레이션 강점과 함께 2026 지식을 보유하고도 컷오프 질문에 2025년이라 답하는 MoE 자기인식 불일치 보고. 복합 PDF·도표는 페이지 번호와 바운딩/공간 레이아웃 좌표를 명시할 때 판독 정확도가 급상승 | Zenn(10/18), note.com(10/19), Qiita(10/17), 知乎(10/19) |

## 2-3. 10/21 ~ 10/26 신규 (CLI 1.4.4~1.4.6·롱런타임·캐시 프리픽스·실무 세션 포렌식/카빙)

| 관찰 | 출처 |
|---|---|
| `antigravity-cli` 1.4.4~1.4.6: idle CPU 점유율 최적화(정적 화면 리프레시 일시 정지), 장문 대화 히스토리 터미널 렌더링 최적화, 대화형 `/diff` 내 접힌 라인 검색 매칭수 표기, Cron 스케줄 분산, 모델 안전필터 발동 시 "retrying..." 무한 무음 재시도 루프 수정, `plugin.json` 단일 문자열 경로 로딩 패치 | GitHub antigravity-cli 릴리스 1.4.4~1.4.6 |
| thinking_level: HIGH와 HTTP 타임아웃: 복잡한 추론 시 첫 토큰 전 지연(2~4분) 발생 환경에서 프록시/VPN 타임아웃 방지를 위한 300초+ 타임아웃 및 keep-alive 유지 필수 | Google AI 개발자 포럼 (10/22~10/25) |
| 암시적 캐싱(Implicit Caching) 접두사 민감도: 프롬프트 상단 정적 접두사가 1바이트라도 변경(가변 타임스탬프 등)되면 캐시 히트(95% 할인)가 0%로 무효화됨. 동적 메타데이터는 반드시 최하단에 배치 | Gen AI SDK 문서, 개발자 포럼 |
| PostToolUse 사후 게이트 오탐 버그: 실무 포렌식 세션(a0551456)에서 `.lazyargon/pins.md` 등 내부 에이전트 오케스트레이션/핀 파일 쓰기를 보고서로 오인해 FAIL_CLOSED로 차단하는 문제 실측 확인. 내부 메타 파일 제외 필수 | 로컬 세션 a0551456 (10/22) |
| SQLite freelist/WAL 카빙 및 세션 복구 실증: 삭제된 대화 복원 실무에서 `sqlite-evidence-query`의 freelist/WAL 카빙과 protobuf 디코딩을 통한 세션 복구 성공 확인 | 로컬 세션 1049b798 (10/22) |
| SPA 동적 라이브 채증 시 DOM 대기: 동적 라이브(숲 악플 채증 등) 시 `locator.click` 타임아웃 및 브라우저 evaluate 레퍼런스 에러 방지를 위한 waitForSelector 필수 | 로컬 세션 edb82dff, 4ce21098 |

## 3. 규칙으로의 매핑

| 노트 | 규칙·스킬 |
|---|---|
| §1 60초 컷오프, 컴팩션 편집 | `<argon_runtime_constraints>` 1–3, `ulw` Step 1 재개 규칙, `frontend` 청크 쓰기 |
| §1 무음 폴백, Ultra 한정 | `session_start.mjs` 세션 모델 주입, `<model_routing>` |
| §2 토큰·한도 | `<delegation_rules>` 예산 줄, 레인 티어, `ulw-research` 권장 구성 |
| §2 루프 | 워커 종료 조건, 1회 재시도 후 제외 |
| §2 범위 리터럴리즘, 중복 함수 | `ulw` 완전성 게이트, `<anti_slop_invariants>` 중복 구현 금지 |
| §2 테스트=완료, 감사 환각 | `gf-qa-behavioral-verification` 5–6, `<verification>` 감사 수치 규칙, `dual-verify` Pass 3 |
| §2 자기 보고 수치 | `<claim_evidence>` 마지막 항목 |
| §2 밀도·지어낸 수치 | `frontend` 카피 밀도 상한, `diagram-design` 안티패턴, `<anti_slop_invariants>` 밀도 상한 |
| §2 유보 | `<argon_runtime_constraints>` 7, workspace `GEMINI.md` 모델 유보 규칙, `verify_report.py unverified` |
| §2 사고 블록 누락 | `markdown_structure_guard` `leaked_reasoning_block` |
| §1-1, §2-1 실제 상한 256K·컴팩션 후 ID 날조 | `<argon_runtime_constraints>` 2, `.lazyargon/pins.md` + `SessionStart` 재주입, workspace `GEMINI.md` 제약 (2) |
| §2-1 25KB 인자·긴 thinking 뒤 절단 | `<argon_runtime_constraints>` 1 (100줄·20KB, 사고 후 쓰기 분리) |
| §2-1 규칙 파일 통째 누락 | `rules/AGENTS.md` 21.9KB → 10KB 축소, 키워드 표 `docs/keyword-routing.md` 분리, workspace `GEMINI.md` 중복 계약 제거, `doctor.mjs` `rules.budget` |
| §2-1 승인 오배정으로 웨이브 정지 | 워커 계약 `도구 규칙`(승인 도구 한 턴 하나) |
| §2-1 차단 스레드 지속, 보안 디버깅 차단 | `<argon_runtime_constraints>` 7, workspace `GEMINI.md` 민감 증거 규칙(새 대화·Claude 레인) |
| §2-1 Pro 배포·주간 쿼터·컨텍스트 비례 소비 | `<argon_runtime_constraints>` 9, workspace `GEMINI.md`·`antigravity-tools.md` 모델 표 |
| §2-1 description 콜론·skill 소실·validate | `doctor.mjs` `frontmatter.description_colon`, workspace README 트러블슈팅 |
| §2 과잉 검증 루프(로컬 로그에 답이 있는데 검색 15회·웹 33페이지), 무제한 시 과제당 ~30분 | `<argon_runtime_constraints>` 11, 워커 계약 `시간 예산`·`근거 순서` |
| §2 리포 skill·CI·리뷰봇·기존 PR 무시, 30행 → 1,200행 | `<argon_runtime_constraints>` 12, `ulw` 저장소 규약 먼저, `git-master` PR Readiness Gate |
| §1-1 이미지 캐시 적중 저조 | `<argon_runtime_constraints>` 13, workspace `media-analysis` 프레임 1회 판독·20프레임 개괄 |
| §2 손글씨·다이얼 판독 실패, 모델 전사 오류, 음성/영상 분리 시 날조 최소 | workspace `GEMINI.md` 비전 판독 규칙, `media-analysis` OCR·STT 전용 인용 |
| §2 성적 묘사 전환 시 즉시 차단(3.x보다 엄격) | workspace `GEMINI.md` 민감 증거 원문은 스크립트가 다룬다 |
| §2 퇴고 보수성(90본 중 68본 무변경), 출처 없는 수치 단정 | workspace `humanize-korean` Argon 세션 주의 |
| §1 API 키 모드 무음 폴백 | `scripts/doctor.mjs` `antigravity.model_provider` 경고 |
| §1 Windows 샌드박스 language server 크래시 | workspace README 트러블슈팅 |
| `google-research/harness2` (`arXiv:2610.14224`) 표면 무결성·산출물 형태 불변·레버 비용 계층 | `scripts/doctor.mjs` (`skills.routing_coverage`, `skills.script_refs`), `rules/AGENTS.md` `<operating_principles>`, `ulw` Step 1 (`[fact]`/`[proc]` 분리)·Step 4 (`Deliverable Shape Invariant`, `KEEP_BASE`), `dual-verify` `P4` |
| §2-2 암시적 캐싱(≥6,144 토큰 정적 접두사 95% 할인)·롱 디코드 `CONTINUATION`·4단 프롬프트 구조 | `rules/AGENTS.md` `<argon_runtime_constraints>` (정적 규칙·원문 상단 고정, 동적 질의 하단 배치), `legal-draft-builder`·`forensic-report` 초안 구조 |
| §2-2 복합 PDF 페이지 번호·바운딩 좌표 명시 시 판독률 급상승 | `rules/AGENTS.md` `<argon_runtime_constraints>` 13, workspace `korean-doc-parser`·`media-analysis` |
| §2-2 한국어 초장문·완곡어 제거 특성 및 Flash/Argon 엄격 분리 | `<delegation_rules>` 레인 분리, `humanize-korean` 단정형 보존 |
| §2-3 CLI 1.4.4+ 안전필터 무한루프 수정, 300s+ 타임아웃 | `<argon_runtime_constraints>` 14, 워커 계약 |
| §2-3 암시적 캐시 보존(정적 접두사 불변, 가변 메타 최하단) | `<argon_runtime_constraints>` 9, 15 |
| §2-3 PostToolUse 내부 메타파일 오탐 방지 | `lazyargon-workspace/scripts/hallucination_guard.mjs` `isAgentInternalFile` |
| §2-3 SQLite freelist/WAL 카빙 및 세션 복구 | `skills/sqlite-evidence-query/SKILL.md` |
| §2-3 SPA 동적 증거 채증 시 DOM 대기 | `skills/web-evidence-capture/SKILL.md` |

## 4. 출처 목록

HN 50073879 · Techzine 144960 · Analytics Vidhya 10/14 · 경향신문 202610141113011/202610142044005 · AI타임스 216220 · DeepLearning.AI The Batch 10/09 · TestingCatalog 10/11 · online-tech-tips · Antigravity 블로그 10/13 · 개발자 포럼 189559/189476/189085/189556/189699 · GitHub antigravity-cli #1228/#1245/#1249/#1254/#1255/#1266, 릴리스 1.3.6/1.4.0/1.4.1/1.4.2/1.4.3/1.4.4/1.4.5/1.4.6 · @antigravity X 10/15 · 개발자 포럼 189611/189620/189646/189731/189734/189741/189747/189748/189763/189788/190078/190412/190533 · Gen AI SDK 문서(Implicit Caching / `CONTINUATION`) · locdd 100913 · CyberQ 10/14 · note.com masa_wunder/kazu_t/10-19/10-24 · Zenn algoartis/10-18/10-23 · 虎嗅 4897290 · 知乎 10/19/10-24 · ritsuto Substack · dev.to akartit · BrainBytes Lab · ohmyunicorn · BigGo(Theo, Every 요약) · AGIラボ · i-Style · MindStudio · Roboflow · 新智元/163 · bilibili BV1Sqpy6KE2p · LuminaBench · TechTimes 329026 · Qiita htani0817/10-17/10-23 · 클리앙 19277187/19277177/19277539/19280145 · 에펨코리아 10448101474/10444308272 · 디시 thesingularity 1479216, ai_utilize 132243 · 루리웹 77025045/10-17 · 아카라이브 10/18/10-24 · 위시켓 · GeekNews 35306 · GitHub `google-research/harness2` (`arXiv:2610.14224`) · 로컬 brain 세션 실무(a0551456, 1049b798, edb82dff, 4ce21098).
