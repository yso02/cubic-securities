# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the application (port 8080)
./gradlew bootRun

# Build
./gradlew build

# Run tests
./gradlew test

# Clean build
./gradlew clean
```

## Architecture

Spring Boot backend for a stock trading simulation platform. No frontend code lives here — the frontend (Vite on port 5173) is a separate repo.

**Layer structure:** Controller → Service → Repository → JPA Entity

```
src/main/java/capstone/
├── config/          # Security (SecurityConfig, JwtTokenProvider, JwtAuthenticationFilter),
│                    # WebSocket (WebSocketConfig), beans (AppConfig), CORS (CorsConfig - 빈 껍데기)
├── controller/      # REST + WebSocket message handlers
├── service/         # Business logic + KIS API calls
├── repository/      # Spring Data JPA interfaces
├── domain/          # JPA entities: User, Holding, Order, Watchlist
└── dto/             # Request/response objects
```

### External API: Korea Investment & Securities (KIS)

`KisAuthService` manages OAuth tokens. `StockService` wraps all KIS REST calls (domestic + overseas prices, charts, minute/yearly data). API credentials go in `application-secret.properties` (git-ignored):

```properties
kis.api.key=YOUR_KEY
kis.api.secret=YOUR_SECRET
jwt.secret=YOUR_JWT_SECRET
fmp.api.key=YOUR_FMP_KEY
koreaexim.api.key=YOUR_EXIM_KEY
claude.api.key=YOUR_CLAUDE_KEY
```

**FMP (Financial Modeling Prep)** — 미국주식 재무데이터 전용:
- `GET /stable/profile?symbol={symbol}&apikey={key}` → 시가총액(`marketCap`), 베타(`beta`), 52주 범위(`range`: `"low-high"` split), 배당금(`dividendYield` → fallback `lastDividend`), 거래량(`volume`)
- `GET /stable/ratios-ttm?symbol={symbol}&apikey={key}` → PER(`priceToEarningsRatioTTM`), PBR(`priceToBookRatioTTM`)
- PER, PBR은 `formatRatio()`로 소수점 2자리 반올림. null·빈값·파싱 불가 시 빈 문자열 반환

### Authentication

JWT (Bearer 토큰) 방식. 세션 방식은 제거됨.

- 로그인 성공 응답: `{ "token": "...", "name": "..." }`
- 보호된 API 요청 시 헤더 필수: `Authorization: Bearer {token}`
- `JwtTokenProvider` → 토큰 생성/파싱/검증 (HS256, 24시간 만료)
- `JwtAuthenticationFilter` → `OncePerRequestFilter`, SecurityContextHolder에 userId(Long) 설정
- `SecurityConfig` → `/api/users/signup`, `/api/users/login`, `/ws/**`, `/api/stocks/**`, `/h2-console/**` 인증 없이 허용; 나머지 `/api/**` 인증 필요
- 컨트롤러에서 userId 추출: `(Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal()`
- 비밀번호: `BCryptPasswordEncoder`로 암호화 저장, `matches()`로 검증

### WebSocket / Real-time Data

STOMP over SockJS. Clients send to `/app/subscribe/domestic` or `/app/subscribe/overseas`; the server publishes price updates to `/topic/domestic/{symbol}` or `/topic/overseas/{symbol}`. `StockSubscriptionService` manages active subscriptions; `StockWebSocketService` does the broadcasting.

### Database

- **Development/Production:** MySQL (`jdbc:mysql://localhost:3306/capstone`), DDL auto-update

### CORS

`SecurityConfig`에서 모든 origin 허용 (`allowedOriginPatterns("*")`)으로 설정. CSRF 비활성화, 세션 STATELESS. `CorsConfig`는 빈 껍데기로 유지 (충돌 방지). WebSocket(`WebSocketConfig`)은 별도로 `setAllowedOriginPatterns("*")` 설정.

## Implemented Features

- 회원가입 / 로그인 / 로그아웃 (JWT 기반, BCrypt 비밀번호 암호화)
- 모의 매수 / 매도 / 보유종목 / 잔고 / 주문내역
- 종목 검색 (KOSPI / KOSDAQ / ETF / 미국주식)
- 현재가 / 차트 / 분봉 / 연봉 (국내 + 미국)
- WebSocket 실시간 주가 스트리밍
- 관심종목 추가/삭제/조회 (Watchlist 도메인, `/api/watchlist`)
- 종목별 상세정보 조회 (`/api/stocks/detail/domestic/{symbol}`, `/api/stocks/detail/overseas/{symbol}`)
  - 미국주식 상세정보는 KIS API 미제공으로 재무데이터(PER, EPS, 시가총액 등) 없음, 추후 Yahoo Finance 연동 예정
- KIS 웹소켓 실시간 연동 (`ws://ops.koreainvestment.com:21000`)
  - 국내주식 정규장(09:00~15:30) → `KisWebSocketClient`로 실시간 수신 후 `/topic/domestic/{symbol}` 브로드캐스트
  - 시간외/야간/주말 → 종가 고정 (`getDomesticStockPrice`, 3초 폴링)
  - 미국주식 정규장 → KIS 웹소켓 실시간 수신 (tr_id: HDFSCNT0, tr_key: D+거래소3자리+심볼, 예: DNASAAPL)
  - 미국주식 장외 → REST API 3초 폴링
  - 새 파일: `MarketTimeService.java` (시간대 판별), `KisWebSocketClient.java` (KIS WS 연결/구독/파싱)
- 호가창: `OrderBookDto`, `GET /api/stocks/orderbook/domestic/{symbol}` (tr_id: FHKST01010200)
  - 실시간 호가 웹소켓: H0STASP0 → `/topic/orderbook/{symbol}`
  - 실시간 체결 웹소켓: H0STCNT0 → `/topic/tradetick/{symbol}` (TradeTickDto)
  - 국내주식 구독 시 H0STCNT0 + H0STASP0 동시 구독
  - 체결 필드: 1건 = 46개 필드, `fields[offset+21]` 매수매도구분 (1=매수, 5=매도), offset = (fields.length/46 - 1) * 46
  - 호가 필드: 1건 = 62개 필드, offset = (fields.length/62 - 1) * 62
- 매매 수량 유효성 검사: 프론트(trade 함수) + 백엔드(TradeService.buy/sell) 모두 quantity < 1 차단
- 보유종목 실시간 DOM 업데이트: WebSocket 수신 시 `loadHoldings()` 대신 `updateHoldingRow(symbol)`으로 해당 행만 갱신
- Spring Security + JWT: `JwtTokenProvider`, `JwtAuthenticationFilter`, `SecurityConfig` 구현. 세션 방식 완전 제거, Stateless 인증
- 실현손익 조회: `Order.avgPrice` 저장, `GET /api/trade/profit?period=` (DAY/WEEK/MONTH/YEAR/ALL), `ProfitDto`, `ProfitItemDto`
- 환율: `ExchangeRateService` (한국수출입은행 API `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON`, 주말/공휴일 최대 5일 이전 재시도, 1시간 캐싱 `@Scheduled`, SSL 검증 비활성화 적용)
- 환전 API: `ExchangeController` — `GET /api/exchange/rate`, `POST /api/exchange/krw-to-usd`, `POST /api/exchange/usd-to-krw`
- 달러 잔고: `User.dollarBalance`, 미국주식 매매 시 dollarBalance 차감/추가 (`TradeService.OVERSEAS_MARKETS`)
- 전체 계좌 현황: 원화 잔고 + 달러 잔고(KRW 환산) + 보유주식 평가금액 합산, `updateTotalAssets()` (async, /api/users/me + /api/exchange/rate 실시간 조회)
- 미국주식 금액 $ 표시: `isOverseas(market)` / `isOverseasSymbol(symbol)` 분기, `fmtMoney()` 헬퍼
- 미국주식 검색 개선: 대소문자 무관 검색 (`toUpperCase()` 비교), 종목명 정제 (`cleanName()` — " - " 이후·Inc./Corp./Ltd. 등 접미사 제거), 결과 표시 "Apple (AAPL)" 형태
- JPA 로그 정리: `spring.jpa.show-sql=false`, `spring.jpa.open-in-view=false`
- AI 챗봇: `AiController`, `AiService` 구현
  - POST /api/ai/chat (로그인 필요)
  - 멀티턴 대화 지원 (history 파라미터)
  - 모델: claude-haiku-4-5-20251001
  - 시스템 프롬프트: 주식 투자 전문 어시스턴트, 참고용 답변만 제공
  - WebClient로 Anthropic API 호출 (https://api.anthropic.com/v1/messages)
- AI 포트폴리오 분석: `AiController.buildHoldingsText()` — StockService로 실시간 현재가 조회 후 수익률 계산
  - POST /api/ai/analyze/holdings → 종목별 개별 분석
  - POST /api/ai/analyze/portfolio → 포트폴리오 전체 분석
  - POST /api/ai/analyze/recommend → 섹터/종목 추천
  - 국내주식: getDomesticStockPrice(), 미국주식: getOverseasStockPrice() 호출
  - 현재가 조회 실패 시 avgPrice fallback 처리
  - max_tokens: 2048 (챗봇보다 길게 설정)

## 알려진 이슈

- 국내주식 호가창 잔량 1/2 문제:
  - REST API(FHKST01010200), 웹소켓(H0STASP0) 모두 실제값의 약 1/2 반환
  - KIS 오픈API 한계로 추정, 코드 자체는 정상
  - `handleOrderBook`: 호가 1건=62필드, 매도호가[3~12], 매수호가[13~22], 매도잔량[23~32], 매수잔량[33~42]

## Key Design Notes

- `StockSearchService` searches across KOSPI, KOSDAQ, ETF, NASDAQ, and NYSE using CSV data parsed with OpenCSV.
- Initial user balance is 10,000,000 KRW, set at signup in `UserService`.
- `TradeService` enforces balance/holdings checks before buy/sell and records every trade in the `Order` entity.
- The in-memory STOMP broker is not production-grade — a migration to RabbitMQ/Redis is on the roadmap.
