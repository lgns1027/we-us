# WE-US 서비스 분석 리포트

> **"우리가 되어가는 3분의 시간"**
> 익명 실시간 대화 & 토론 매칭 플랫폼

---

## 목차

1. [서비스 개요](#1-서비스-개요)
2. [기술 스택](#2-기술-스택)
3. [폴더 구조](#3-폴더-구조)
4. [핵심 기능](#4-핵심-기능)
5. [데이터 모델](#5-데이터-모델)
6. [실시간 통신 이벤트](#6-실시간-통신-socket-io-이벤트)
7. [화면 구성 및 컴포넌트](#7-화면-구성-및-컴포넌트)
8. [인증 및 보안](#8-인증-및-보안)
9. [AI 통합 구조](#9-ai-통합-구조)
10. [배포 아키텍처](#10-배포-아키텍처)
11. [데이터 흐름 분석](#11-데이터-흐름-분석)
12. [아키텍처 패턴](#12-아키텍처-패턴)
13. [종합 평가](#13-종합-평가)

---

## 1. 서비스 개요

**WE-US**는 낯선 두 사람을 주제 기반으로 매칭시켜 **3분간 실시간 익명 대화**를 나누게 하는 소셜 플랫폼입니다.

단순한 채팅 앱이 아니라, 대화가 끝난 후 **AI가 대화 내용을 분석**하여 논리력·언어력·공감력을 점수화하고, 사용자에게 **페르소나 타이틀**을 부여하는 **게이미피케이션** 요소를 갖추고 있습니다.

### 서비스 핵심 가치
| 키워드 | 설명 |
|--------|------|
| **익명성** | 기본 닉네임 "익명의 소통러"로 진입, 부담 없는 대화 |
| **제한된 시간** | 3분 타이머로 집중도 높은 대화 유도 |
| **AI 피드백** | Gemini API로 대화 품질 자동 분석 |
| **관전 시스템** | 다른 사람들의 토론을 실시간으로 구경 + 투표 |
| **성장 기록** | 누적 대화 통계로 자신의 소통 스타일 파악 |

---

## 2. 기술 스택

### 프론트엔드
| 기술 | 버전 | 역할 |
|------|------|------|
| Next.js | 16.1.6 | App Router 기반 SPA/SSR 프레임워크 |
| React | 19.2.3 | UI 렌더링 |
| TypeScript | 5 | 타입 안정성 |
| Tailwind CSS | v4 | 유틸리티 기반 스타일링 |
| Socket.IO Client | 4.8.3 | 실시간 양방향 통신 |
| NextAuth | 4.24.13 | Google OAuth 인증 |
| html2canvas | - | 리포트 카드 스크린샷 공유 |
| Vercel Analytics | - | 사용자 행동 분석 |

### 백엔드
| 기술 | 버전 | 역할 |
|------|------|------|
| Node.js + Express | 5.2.1 | REST API 서버 |
| Socket.IO | 4.8.3 | 실시간 이벤트 처리 |
| MongoDB + Mongoose | 9.3.0 | 데이터 영속성 |
| Google Generative AI | - | Gemini AI 분석 엔진 |
| dotenv | 17.3.1 | 환경변수 관리 |

### 외부 서비스
- **Google OAuth** — 소셜 로그인
- **Google Gemini API** — 대화 내용 AI 분석
- **MongoDB Atlas** — 클라우드 데이터베이스
- **Expo Push Notification** — 모바일 푸시 알림
- **Vercel** — 프론트엔드 배포
- **Render** — 백엔드 서버 배포

---

## 3. 폴더 구조

```
we-us/
├── app/                              # Next.js App Router
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts          # Google OAuth 엔드포인트
│   ├── components/                   # 핵심 UI 컴포넌트
│   │   ├── ChatRoom.tsx              # 토론방 (메인 대화 화면)
│   │   ├── LobbyView.tsx             # 로비 (카테고리 선택)
│   │   ├── LoungeRoom.tsx            # 오픈 라운지 (전체 채팅)
│   │   ├── ProfileView.tsx           # 프로필 & DM 관리
│   │   ├── RecordView.tsx            # 통계 & 기록 열람
│   │   ├── SpectatorList.tsx         # 진행 중인 토론 목록
│   │   └── SpectatorRoom.tsx         # 실시간 관전 화면
│   ├── AuthProvider.tsx              # NextAuth 세션 공급자
│   ├── layout.tsx                    # 루트 레이아웃
│   ├── page.tsx                      # 앱 진입점 (상태 라우터)
│   └── globals.css                   # 전역 스타일
├── server.js                         # Socket.IO 백엔드 (메인 서버, 36KB)
├── package.json
├── tsconfig.json
├── next.config.ts
├── .env                              # API 키 및 DB URI
└── README.md
```

---

## 4. 핵심 기능

### 4-1. 대화 카테고리

사용자는 로비에서 4가지 카테고리 중 하나를 선택합니다.

| 카테고리 | 아이콘 | 설명 |
|----------|--------|------|
| 데일리 라운지 | ☕ | 일상 가벼운 대화 |
| 언어 튜터링 | 🌍 | AI 파트너와 외국어 연습 |
| 딥토크 살롱 | 🍷 | 심층 철학/가치관 토론 |
| 도파민 롤플레이 | 🎭 | 스트레스 해소 시나리오 |

### 4-2. 사전 정의된 토론 주제 예시
- "100억 받기 VS 무병장수"
- "자본주의 생존기"
- "최악의 이불킥 경험"
- "진상손님 방어전"
- "압박 면접"

### 4-3. 매칭 시스템
- 동일 토픽 대기열에서 상대방을 찾아 **자동 매칭**
- 매칭 성공 시 전용 `room_[timestamp]` 소켓 룸 생성
- 상대방 없을 경우 **AI 싱글 플레이 모드** 지원

### 4-4. 3분 대화 (ChatRoom)

```
┌─────────────────────────────────┐
│  토픽: 압박면접     [roleA] ⏱ 2:34 │
├─────────────────────────────────┤
│                  [상대방 메시지] │
│  [내 메시지]                    │
│                  [상대방 메시지] │
├─────────────────────────────────┤
│  💡 사이라노 도움 요청           │
├─────────────────────────────────┤
│  [ 메시지 입력...          전송 ]│
└─────────────────────────────────┘
```

**주요 기능:**
- 역할 기반 대화 (roleA / roleB)
- 💡 **사이라노 시스템**: AI가 실시간 대화 제안 제공
- **MBTI 예측**: 종료 30초 전, 상대방 역할 추측 미니게임
- **시간 연장 투표**: 양측 동의 시 +2분 (최대 2회)
- 욕설 필터링 + 연속 메시지 속도 제한

### 4-5. AI 분석 리포트 (영수증 카드)

대화 종료 후 Gemini가 전체 대화 로그를 분석합니다.

```
╔══════════════════════════════╗
║     🧾 대화 분석 리포트      ║
╠══════════════════════════════╣
║  LOGIC        ████████░░ 82  ║
║  LINGUISTICS  ██████░░░░ 61  ║
║  EMPATHY      █████████░ 91  ║
╠══════════════════════════════╣
║  페르소나: 따뜻한 조언자 ⚖️  ║
╚══════════════════════════════╝
```

**6가지 페르소나 타입:**

| 페르소나 | 특성 |
|----------|------|
| 🧊 차가운 팩트폭격기 | 논리 ↑, 공감 ↓ |
| ⚖️ 따뜻한 조언자 | 균형형 |
| ✨ 감성적인 음유시인 | 언어 ↑, 감성 ↑ |
| 🕊️ 천사표 리스너 | 공감 ↑, 경청형 |
| 👑 무자비한 토론 제왕 | 논리·언어 모두 ↑↑ |
| 🌱 성장하는 소통러 | 전반적으로 성장 중 |

**티어 시스템:**
- 상위 1% / 10% / 30% / 50% / 비랭킹

**공유 기능:**
- html2canvas로 리포트 카드 캡처 → 인스타그램 스토리 공유

### 4-6. 관전 시스템 (콜로세움)

```
┌──────────────────────────────────┐
│  [방 1] 압박면접   👁 5명 관전   │
│  [방 2] 이불킥 경험 👁 12명 관전 │
└──────────────────────────────────┘
```

- 진행 중인 토론을 실시간으로 구경
- **실시간 투표**: roleA vs roleB 중 누가 더 잘하는지 투표
- 낙관적 UI 업데이트(로컬 즉시 반영 후 서버 동기화)
- 승률 게이지 바 실시간 애니메이션

### 4-7. 데일리 스페셜 이벤트

요일별로 다른 특별 주제가 배너로 노출됩니다.

- **팩션 투표**: Team T vs Team F 파벌 경쟁
- 누적 점수 추적 및 결과 공개
- 서버에서 `new Date().getDay()`로 동적 주제 선택

### 4-8. 오픈 라운지 (광장)

- 매칭 없이 전체 사용자가 참여하는 실시간 채팅
- 최근 100개 메시지 히스토리 유지
- 접속 인원 수 실시간 표시
- 7연속 메시지 → 3초 뮤트 자동 적용

### 4-9. 소셜 기능

```
인사이트 인맥 (친구 시스템)
├── 대화한 상대방 친구 추가
├── DM (1:1 다이렉트 메시지)
├── 친구 목록 관리
└── 차단 기능
```

---

## 5. 데이터 모델

### User (사용자)
```typescript
{
  userId: string,          // 고유 사용자 ID (user_[9자리][timestamp])
  nickname: string,        // 닉네임 (기본: "익명의 소통러")
  friends: string[],       // 친구 userId 배열
  pushToken: string,       // Expo 푸시 토큰
  blockedUsers: string[],  // 차단한 사용자 ID 배열
  createdAt: Date
}
```

### Report (대화 리포트)
```typescript
{
  roomName: string,        // 토론방 식별자
  userIds: string[],       // 참여자 userId 배열
  type: "single" | "multi", // AI 혼자 | 2인 대화
  topic: string,           // 토론 주제
  participants: number,    // 참여자 수
  fullLog: Message[],      // 전체 메시지 로그
  aiReport: string,        // Gemini 분석 텍스트
  stats: {
    logic: number,         // 논리력 (0~100)
    linguistics: number,   // 언어력 (0~100)
    empathy: number        // 공감력 (0~100)
  },
  createdAt: Date
}
```

### DM (다이렉트 메시지)
```typescript
{
  senderId: string,
  receiverId: string,
  text: string,
  createdAt: Date
}
```

### Blacklist (신고/차단)
```typescript
{
  reporterId: string,
  roomName: string,
  reason: string,
  createdAt: Date
}
```

---

## 6. 실시간 통신 (Socket.IO 이벤트)

### 연결 및 계정
| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `recover_account_by_token` | Client → Server | 토큰으로 세션 복구 |
| `register_push_token` | Client → Server | 모바일 푸시 토큰 등록 |
| `get_profile` | Client → Server | 프로필 조회 |
| `update_nickname` | Client → Server | 닉네임 변경 |

### 매칭
| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `join_queue` | Client → Server | 대기열 진입 |
| `leave_queue` | Client → Server | 대기열 이탈 |
| `matched` | Server → Client | 매칭 완료 알림 |
| `join_lounge` | Client → Server | 라운지 입장 |

### 대화
| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `send_message` | Client → Server | 메시지 전송 |
| `receive_message` | Server → Client | 메시지 수신 |
| `request_cyrano_help` | Client → Server | AI 제안 요청 |
| `submit_mbti_guess` | Client → Server | 역할 예측 제출 |
| `vote_extend` | Client → Server | 시간 연장 투표 |
| `request_chemistry_report` | Client → Server | AI 분석 요청 |
| `receive_report` | Server → Client | 분석 결과 수신 |

### 소셜
| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `add_friend` | Client → Server | 친구 추가 |
| `get_dms` | Client → Server | DM 내역 조회 |
| `send_dm` | Client → Server | DM 전송 |
| `new_dm_arrived` | Server → Client | 새 DM 알림 |
| `block_user` | Client → Server | 사용자 차단 |
| `report_user` | Client → Server | 사용자 신고 |

### 관전
| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `request_live_rooms` | Client → Server | 진행 중 방 목록 요청 |
| `join_as_spectator` | Client → Server | 관전 입장 |
| `spectator_vote` | Client → Server | 관전 투표 |
| `vote_update` | Server → Client | 투표 결과 브로드캐스트 |

---

## 7. 화면 구성 및 컴포넌트

### 화면 흐름

```
page.tsx (상태 기반 라우터)
│
├── view === 'lobby'      → LobbyView.tsx
├── view === 'chat'       → ChatRoom.tsx
├── view === 'spectatorList' → SpectatorList.tsx
├── view === 'spectator'  → SpectatorRoom.tsx
├── view === 'lounge'     → LoungeRoom.tsx
├── view === 'profile'    → ProfileView.tsx
└── view === 'record'     → RecordView.tsx
```

> Next.js의 파일 기반 라우팅을 사용하지 않고, **단일 page.tsx에서 상태(view)로 화면 전환**하는 SPA 방식을 채택했습니다.

### 컴포넌트별 상세

#### LobbyView — 로비
- 4개 카테고리 그리드 (카드 형태)
- 데일리 이벤트 배너 (요일별 주제)
- 🔥 콜로세움 관전 버튼
- 하단 내비게이션 탭 (LOBBY / RECORD / PROFILE)

#### ChatRoom — 대화방
- 헤더: 주제명 + 내 역할 + 카운트다운 타이머
- 메시지 스트림 (좌/우 정렬로 나와 상대방 구분)
- 💡 사이라노 패널 (AI 대화 제안)
- MBTI 예측 팝업 (종료 30초 전)
- 리포트 카드 오버레이 (영수증 디자인)
- 공유 버튼 (인스타그램 / 로비 복귀)

#### ProfileView — 프로필
- 닉네임 편집 + 아바타
- 티어 & 페르소나 표시
- 인사이트 인맥 (친구) 목록
- DM 채팅 모달

#### RecordView — 기록
- 누적 대화 시간
- 페르소나 타이틀 + 티어 랭킹
- Logic / Linguistics / Empathy 게이지 바
- 과거 대화 세션 리스트

#### SpectatorList — 관전 목록
- 실시간 진행 중인 토론방 그리드
- 주제명 + 역할 + 관전자 수 뱃지

#### SpectatorRoom — 관전 화면
- 실시간 메시지 스트림 (읽기 전용)
- roleA vs roleB 실시간 투표 버튼
- 승률 퍼센트 바 애니메이션

#### LoungeRoom — 오픈 라운지
- 전체 공개 채팅
- 실시간 접속자 수
- 7연속 메시지 속도 제한

---

## 8. 인증 및 보안

### 인증 방식

```
┌─────────────────────────────────────┐
│           하이브리드 인증            │
├──────────────────┬──────────────────┤
│  익명 (기본)      │  소셜 로그인      │
│  localStorage ID  │  Google OAuth    │
│  user_[random]    │  NextAuth v4     │
└──────────────────┴──────────────────┘
```

- 앱 진입 시 로컬스토리지에 `user_[9자리][timestamp]` 형식의 고유 ID 자동 생성
- Google 로그인은 선택 사항 (강제하지 않음)
- Push 토큰으로 세션 재연결 지원

### 보안 조치
- 욕설/비속어 필터링 (하드코딩된 금지어 배열)
- 연속 메시지 속도 제한 (7회 → 3초 뮤트)
- 사용자 차단 및 신고 시스템
- MongoDB 쿼리에 `$set`/`$setOnInsert` 사용 (덮어쓰기 방지)
- 객체 주입 방어 (사용자 데이터 추출 함수)

---

## 9. AI 통합 구조

### Gemini 모델 폴백 체인

```
gemma-3-12b (1차 시도)
    ↓ 실패 시
gemma-3-27b (2차 시도)
    ↓ 실패 시
gemma-3-4b  (3차 시도)
```

### 분석 파이프라인

```
1. 대화 종료 (타이머 0:00)
2. 전체 메시지 로그 수집
3. Gemini API에 프롬프트 전송
   - 역할별 시스템 프롬프트 적용
   - maxOutputTokens: 300 (간결한 응답 유도)
4. 정규식으로 LOGIC/LINGUISTICS/EMPATHY 점수 파싱
5. MongoDB에 리포트 저장
6. 클라이언트에 결과 전송
```

### AI 활용 케이스

| 기능 | AI 역할 |
|------|---------|
| 사이라노 | 실시간 대화 제안 생성 |
| 언어 튜터링 | AI 파트너로 외국어 대화 |
| 리포트 분석 | 대화 품질 점수화 + 페르소나 결정 |

---

## 10. 배포 아키텍처

```
사용자 브라우저/앱
        │
        ├── HTTPS ──→ Vercel (Next.js 프론트엔드)
        │
        └── WebSocket ──→ Render (Node.js + Socket.IO 백엔드)
                                    │
                                    ├──→ MongoDB Atlas (데이터 영속성)
                                    │
                                    └──→ Google Gemini API (AI 분석)
```

| 구성요소 | 플랫폼 | URL |
|----------|--------|-----|
| 프론트엔드 | Vercel | - |
| 백엔드 서버 | Render | `https://we-us-backend.onrender.com` |
| 데이터베이스 | MongoDB Atlas | `retryWrites=true&w=majority` |
| AI 엔진 | Google Gemini | Gemini API |

---

## 11. 데이터 흐름 분석

### 매칭 플로우

```
1. 사용자 → "START 🚀" 클릭 (토픽 선택)
2. Client → emit('join_queue', { topic, role })
3. Server → waitingQueues[topic]에 추가
4. Server → tryMatch() 실행
5. 상대방 발견 시 → room_[timestamp] 룸 생성
6. Server → 양측에 emit('matched', { roomName }) 전송
7. 양측 소켓이 해당 룸 join
```

### 리포트 생성 플로우

```
1. 타이머 0:00 도달
2. Client → emit('request_chemistry_report')
3. Server → isGeneratingReport = true 설정
4. (2초 지연) 광고 노출
5. Server → Gemini API 호출 (전체 대화 로그 전달)
6. Server → MongoDB에 Report 저장
7. Server → emit('receive_report', stats) 전송
8. Client → 영수증 카드 UI 렌더링
```

### 관전 투표 플로우 (낙관적 UI)

```
1. 관전자 투표 버튼 클릭
2. Local state 즉시 업데이트 (낙관적)
3. Client → emit('spectator_vote', { side })
4. Server → roomData.votesA/B 증가
5. Server → io.to(room).emit('vote_update', totals)
6. 모든 관전자 클라이언트 → 게이지 바 재렌더링
```

---

## 12. 아키텍처 패턴

### 프론트엔드
- **단일 page.tsx SPA**: `view` 상태로 화면 전환 (파일 기반 라우팅 미사용)
- **useRef로 소켓 관리**: `socketRef.current`로 재생성 방지
- **낙관적 UI**: 투표 결과를 서버 응답 전에 즉시 반영
- **Mobile-first 반응형**: Tailwind `sm:` 브레이크포인트
- **메모리 효율**: `messagesRef`로 AI 요청 시 히스토리 전달

### 백엔드
- **룸 기반 격리**: 각 토론은 독립 Socket.IO 룸
- **좀비 룸 정리**: 10분 주기 백그라운드 인터벌로 비활성 룸 삭제
- **연결 해제 유예**: 10초 대기 후 상대방에게 알림 (일시적 끊김 보호)
- **대기열 필터링**: 정리 주기마다 끊어진 소켓 제거

---

## 13. 종합 평가

### 서비스 성격 요약

**WE-US는 "소통 능력 성장 게임"입니다.**

단순 채팅 앱이 아니라, 3분이라는 제약된 시간 안에서 낯선 사람과 대화하고, AI로부터 피드백을 받으며, 자신의 소통 스타일을 점수와 페르소나로 시각화하는 **게이미파이된 소셜 플랫폼**입니다.

### 강점

| 항목 | 평가 |
|------|------|
| 실시간 아키텍처 | Socket.IO 기반의 탄탄한 이벤트 설계 |
| AI 활용 | 대화 분석, 실시간 제안, AI 파트너 3중 활용 |
| 게이미피케이션 | 페르소나·티어·팩션 투표로 재방문 유도 |
| UX 디테일 | 낙관적 UI, 시간 연장 투표, MBTI 예측 등 |
| 익명성 | 부담 없는 진입 (로그인 불필요) |

### 개선 포인트

| 항목 | 설명 |
|------|------|
| 서버사이드 검증 | 클라이언트 메시지 유효성 추가 필요 |
| 소켓 연결 제한 | 소켓 연결 자체의 rate limit 없음 |
| 상태 관리 복잡도 | 단일 page.tsx에 모든 상태 집중 → 분리 필요 |
| 환경변수 보안 | API 키 .env에만 의존 (Vault 고려) |

### 타겟 사용자

- MZ세대 대화 연습 / 자기 표현 향상에 관심 있는 사람
- 익명으로 낯선 사람과 가볍게 대화하고 싶은 사람
- 소통 스타일 분석 / 자기계발에 관심 있는 사람
- 외국어 스피킹 연습이 필요한 사람

---

*분석 일자: 2026-04-01*
*분석 대상: `c:\Users\jihun\Desktop\jihun\we-us` 전체 소스코드*
