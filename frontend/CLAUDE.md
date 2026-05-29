# CUBIC 증권 — 프로젝트 컨텍스트 (2025.05.28 기준)

## 프로젝트 개요
React 기반 모의 증권 거래 웹앱 (캡스톤). 토스증권 스타일 UI.
- **프론트엔드**: React + Vite (localhost:5173)
- **백엔드**: Spring Boot + ngrok 고정 주소
- **인증**: JWT 토큰 (sessionStorage)
- **실시간**: WebSocket (STOMP, raw WebSocket)
- **배포**: Vercel (yso02/cubic-securities, Root Directory: `frontend`)
- **GitHub**: `origin` = 학교 (Hanshin-OSS-Hub), `mine` = 개인 (yso02/cubic-securities)

---

## ngrok 고정 주소
```
https://rockiness-venture-reptilian.ngrok-free.dev
```
모든 API 호출에 `ngrok-skip-browser-warning: true` 헤더 필수.

---

## 파일 구조 (최신)
```
frontend/
├── src/
│   ├── api/stockApi.js              ← 전체 API + 유틸 + 로고 맵
│   ├── components/
│   │   ├── Navbar.jsx / .css        ← 상단 네비바 (검색 드롭다운, 72px 높이)
│   │   ├── Sidebar.jsx / .css       ← 전역 사이드바 (관심/최근본/실시간/다크모드)
│   │   ├── StockChart.jsx / .css    ← TradingView 캔들차트 (전체화면 토글, MA, 거래량)
│   │   ├── TradeModal.jsx / .css    ← 매수/매도 모달
│   │   ├── OrderBook.jsx / .css     ← 호가창 (국내+해외 WebSocket, 체결탭)
│   ├── hooks/
│   │   └── useRealtimePrice.js      ← WebSocket 실시간 가격 훅
│   ├── pages/
│   │   ├── MainDashboard.jsx / .css ← 홈 (시장지수, 순위리스트, 뉴스패널, 티커)
│   │   ├── StockDetailPage.jsx/.css ← 종목 상세 (차트+호가+매수매도+뉴스)
│   │   ├── LoginPage.jsx / .css     ← 로그인/회원가입
│   │   ├── AccountPage.jsx / .css   ← 내 계좌 (환전, 주문내역, 실현손익)
│   │   ├── AiPage.jsx / .css        ← AI 챗봇 + 포트폴리오 분석 (마크다운)
│   ├── App.jsx / App.css            ← 라우팅 + 전역 레이아웃 (Navbar + Routes + Sidebar)
│   ├── index.css                    ← 글로벌 CSS 변수
│   └── main.jsx
├── vite.config.js                   ← WebSocket 프록시 설정
└── package.json
```

---

## 라우팅 (App.jsx)
```
/           → MainDashboard (홈)
/login      → LoginPage
/ai         → AiPage (AI 챗봇/분석)
/stock/:symbol → StockDetailPage (종목 상세)
/account    → AccountPage (로그인 필요)
```

**전역 레이아웃 (App.jsx):**
```jsx
<Navbar />
<div style={{ display: "flex" }}>
  <Routes>...</Routes>    ← 메인 콘텐츠
  <Sidebar user={user} /> ← 전역 사이드바 (모든 페이지)
</div>
```

---

## 핵심 컴포넌트 상세

### Navbar (72px 높이)
- CUBIC 증권 로고 + 홈/AI분석/내계좌 링크
- 종목 검색 (debounce 300ms, 드롭다운 결과, 클릭→상세 페이지)
- 유저 아바타 + 로그아웃 (로그인 시) / 로그인 버튼 (비로그인)
- baek-02가 높이 52→72px로 변경, 배포 시간 표시 추가

### Sidebar (전역, App.jsx 레벨)
- **관심**: 관심종목 패널 (서버 DB, ★ 토글)
- **최근본**: sessionStorage 기반 최근 본 종목 10개
- **실시간**: 실시간 체결 (placeholder)
- **다크모드**: 하단 🌙/☀️ 토글 (localStorage)
- 접기/펼치기 `<` `>` 토글 (아이콘열 항상 표시, 패널만 슬라이드)

### MainDashboard (홈)
- **시장 지수 바**: 달러 환율(✅실시간), 코스피/코스닥/나스닥/S&P500 (getMarketIndices API 연동됨)
- **종목 티커**: 상위 종목 실시간 스크롤
- **시장 탭**: 국내주식 / 해외주식
- **정렬**: 거래대금(VOLUME) / 시가총액(MARKET_CAP) / 급상승(RISE) / 급하락(FALL)
- **종목 리스트**: 순위+로고+이름+현재가+등락률+거래대금, 클릭→/stock/:symbol 이동
- **우측 뉴스 패널**: AI 시장 뉴스 (getMarketNews API 연동됨)
- **WebSocket**: 홈에서 국내/해외 전 종목 실시간 가격 구독
- **푸터**: 면책 안내

### StockDetailPage (/stock/:symbol)
- ← 홈으로 뒤로가기
- 종목 헤더 (로고+이름+코드+실시간 가격)
- 매수/매도 버튼
- 캔들차트 (StockChart, 전체화면 토글 지원)
- 호가창 (OrderBook, 국내+해외 모두 표시)
- 뉴스 자리 (API 연동 예정)
- WebSocket 실시간 구독
- 브라우저 탭 타이틀에 실시간 가격 표시
- ⚠️ `isDomestic()` 조건 제거됨 → 해외주식도 OrderBook 렌더링

### OrderBook (국내+해외) ✅ 2025.05.28 완성
- **국내**: REST `getDomesticOrderbook` + WebSocket `/topic/orderbook/{symbol}` + 체결 `/topic/tradetick/{symbol}`
- **해외**: REST 없음 (API 미제공) → WebSocket만 사용. 정규장(한국 22:30~05:00, 서머타임)에만 데이터 수신
- **호가 탭**: 매도호가 내림차순 정렬(`.sort((a,b) => b.price - a.price)`), 매수호가 그대로
- **체결 탭**: 체결가 + 체결량 (매수=빨강, 매도=파랑 색상으로 구분, 라벨 없음)
- **체결 데이터 필드**: `price`, `quantity`, `side` (`BUY`/`SELL`) — `volume`/`tradeType` 아님
- 해외 장외 시간 안내 문구 표시 (서머타임 기준 22:30~05:00)
- ⚠️ WebSocket URL 반드시 `/ws/websocket` 사용 (SockJS `/ws`는 ngrok CORS 차단)

### AccountPage (내 계좌)
- 총 자산 / 원화 예수금 / 실시간 평가액 카드
- 환전 (토스 스타일: 🇰🇷↔🇺🇸, 실시간 미리보기)
- 보유 종목 (클릭→상세 페이지)
- 주문 내역 (매수/매도 구분, 시간)
- 실현 손익 (기간별: DAY/WEEK/MONTH/YEAR/ALL)
- WebSocket 실시간 평가금액 업데이트

### AiPage (AI 분석)
- 💬 AI 채팅 (멀티턴, react-markdown 렌더링)
- 📊 종목 분석 / 📈 포트폴리오 / 🎯 추천
- 비로그인 시 로그인 유도

---

## 백엔드 API 요약

### 회원
- `POST /api/users/signup` → { email, password, name }
- `POST /api/users/login` → { token, name } (JWT)
- `GET /api/users/me` → { id, email, name, balance, dollarBalance }
- 토큰 유효기간: 24시간

### 매매
- `POST /api/trade/buy` / `sell` → { symbol, name, quantity, price, market, exchange? }
- `GET /api/trade/balance` / `holdings` / `orders`
- `GET /api/trade/profit?period=DAY|WEEK|MONTH|YEAR|ALL`

### 시세
- `GET /api/stocks/domestic/{symbol}` → 국내 현재가
- `GET /api/stocks/overseas/{symbol}?exchange=NAS` → 해외 현재가
- `GET /api/stocks/search?keyword=` → 종목 검색
- `GET /api/stocks/chart/domestic/{symbol}?period=D` → 캔들차트
- `GET /api/stocks/chart/overseas/{symbol}?exchange=NAS&period=0`
- `GET /api/stocks/chart/domestic/{symbol}/minute?timeUnit=5` → 분봉
- `GET /api/stocks/chart/overseas/{symbol}/minute?exchange=NAS&timeUnit=5`

### 호가
- `GET /api/stocks/orderbook/domestic/{symbol}` → 국내 호가 (REST)
- ⚠️ 해외 호가 REST API 없음 → WebSocket으로만 수신

### 관심종목
- `GET/POST/DELETE /api/watchlist`

### 시장 순위
- `GET /api/market/domestic/ranking?type=VOLUME|RISE|FALL|MARKET_CAP`
- `GET /api/market/overseas/ranking?type=VOLUME|RISE|FALL|MARKET_CAP`

### 시장 지수/뉴스
- `GET /api/market/indices` → [{ code, name, price, change, changePercent }]
- `GET /api/market/news` → { updatedAt, headlines, positive, negative, summary }

### AI
- `POST /api/ai/chat` → { message, history[] }
- `POST /api/ai/analyze/holdings` / `portfolio` / `recommend`

### 환율/환전
- `GET /api/exchange/rate` → { rate }
- `POST /api/exchange/krw-to-usd` / `usd-to-krw`

---

## WebSocket 구조

### 연결
```javascript
brokerURL: "wss://rockiness-venture-reptilian.ngrok-free.dev/ws/websocket"
connectHeaders: { "ngrok-skip-browser-warning": "true" }
```
⚠️ SockJS(`/ws`)는 ngrok CORS 차단됨 → raw WebSocket(`/ws/websocket`) 사용
⚠️ OrderBook.jsx 포함 모든 컴포넌트에서 `/ws/websocket` 통일

### 국내주식
- 홈(가격만): `client.publish({ destination: "/app/subscribe/domestic/price", body: "005930" })`
- 상세(가격+호가): `client.publish({ destination: "/app/subscribe/domestic", body: "005930" })`
- 가격 수신: `/topic/domestic/005930`
- 호가 수신: `/topic/orderbook/005930` (자동)
- 체결 수신: `/topic/tradetick/005930` (자동)

### 해외주식
- 구독: `client.publish({ destination: "/app/subscribe/overseas", body: "AAPL,NAS" })`
- 가격 수신: `/topic/overseas/AAPL`
- 호가 구독: `destination: "/app/subscribe/overseas/orderbook", body: "AAPL,NAS"`
- 호가 수신: `/topic/orderbook/AAPL`
- 체결 수신: `/topic/tradetick/overseas/AAPL`
- ⚠️ 호가/체결은 미국 정규장(한국 22:30~05:00, 서머타임 기준)에만 수신됨

---

## 로고 시스템 (baek-02 작업)
- Logo.dev API: `https://img.logo.dev/{domain}?token={LOGO_DEV_TOKEN}&size=40`
- `DOMESTIC_LOGO_MAP`: 종목코드 → 기업 도메인 (50개+)
- `OVERSEAS_LOGO_MAP`: 종목코드 → 기업 도메인 (20개+)
- `getLogoUrl(symbol, market)`: 로고 URL 반환 (없으면 null → 이니셜 fallback)

---

## CSS 변수 (index.css)
```css
--c-bg, --c-surface, --c-hover
--c-text, --c-text-sub, --c-text-muted
--c-border, --c-border-light
--c-primary-muted, --c-primary-border
--r-sm, --r-md, --r-lg (border-radius)
```
다크모드: `[data-theme="dark"]` 속성으로 전환

---

## 유틸 함수 (stockApi.js)
- `isDomestic(market)`: KOSPI/KOSDAQ/ETF → true
- `getExchangeCode(market)`: NASDAQ→NAS, NYSE→NYS, AMEX→AMS
- `fmt(n)`: 숫자 콤마 포맷 (ko-KR)
- `fmtPrice(price, market)`: 국내 "75,000원", 해외 "$123.45"
- `fmtChange(cp)`: "+1.23%", "-0.55%"
- `isUp(cp)`: 양수 여부

---

## 최근 작업 이력 (날짜순)

### baek-02 작업
- Logo.dev API 기업 로고 표시
- WebSocket URL `/ws` → `/ws/websocket` (CORS 우회)
- 국내 구독 경로 `/app/subscribe/domestic` → `/app/subscribe/domestic/price`
- 네브바 높이 52→72px 확장 + 배포 시간 표시
- 홈화면 AI 시장 뉴스 연동 (getMarketNews)
- 시장 지수 실시간 표시 (getMarketIndices)
- 주식목록:뉴스 비율 7:3
- App 레이아웃 수정 (alignItems flex-start)
- 사이드바 높이/위치 72px 기준

### 내 작업 (Claude 지원)
- 토스증권 스타일 UI 리디자인 (중앙 카드 레이아웃)
- JWT 인증 (세션→JWT 전환)
- WebSocket 실시간 가격 (홈, 상세, 계좌)
- 관심종목 (서버 DB)
- 환전 UI (토스 스타일 🇰🇷↔🇺🇸)
- AI 챗봇/분석 페이지 (마크다운 렌더링)
- 종목 상세 페이지 분리 (/stock/:symbol)
- 사이드바 전역화 (App.jsx 레벨)
- 시가총액(MARKET_CAP) 정렬 추가 (MainDashboard 정렬 탭)
- **[2025.05.27] OrderBook.jsx 해외 호가/체결 WebSocket 지원** (URL 버그 `/ws`→`/ws/websocket` 수정 포함)
- **[2025.05.27] stockApi.js `getOverseasOrderbook` 함수 추가**
- **[2025.05.27] 국내주식 실시간 체결 WebSocket 정상화**
- **[2025.05.28] StockDetailPage `isDomestic` 조건 제거** → 해외주식도 OrderBook 렌더링
- **[2025.05.28] 해외 호가 REST 제거** (API 미제공, WebSocket만 사용)
- **[2025.05.28] 체결 데이터 필드 수정** (`volume`→`quantity`, `tradeType`→`side`)
- **[2025.05.28] 체결 탭 UI 개선** (매수/매도 라벨 제거, 체결량 색상으로 구분: 매수=빨강/매도=파랑)
- **[2025.05.28] 매도호가 정렬 수정** (`.reverse()` → `.sort()` 내림차순 명시)
- **[2025.05.28] 서머타임 안내 문구 수정** (23:30 → 22:30~05:00)

---

## 남은 작업 / TODO
- [ ] 뉴스 API 종목별 연동 (StockDetailPage 뉴스 영역)
- [ ] Vercel 프로덕션 WebSocket (프록시는 dev 전용)
- [ ] 테마·섹터 탭 내용
- [ ] 실시간 패널 체결 데이터 표시
- [ ] 다크모드 세부 스타일 보완
- [ ] 해외 호가 WebSocket 데이터 수신 확인 (정규장 시간 테스트 필요)

---

## 필요 패키지
```bash
npm install axios sockjs-client @stomp/stompjs lightweight-charts react-markdown
```

---

## 작업 시 주의사항
1. **stockApi.js 수정 주의**: baek-02와 동시 작업 중. export 이름 변경 시 Navbar/Sidebar/MainDashboard 등에서 import 에러 발생
2. **네브바 높이 72px**: MainDashboard, Sidebar 등에서 `calc(100vh - 72px)` 사용 중
3. **WebSocket URL**: 반드시 `/ws/websocket` (raw WebSocket). `/ws`는 SockJS용이며 ngrok CORS 차단됨
4. **국내주식 구독 경로**: 홈은 `/app/subscribe/domestic/price`, 상세(호가 포함)는 `/app/subscribe/domestic`
5. **최근 본 종목**: sessionStorage `cubic_recent` + `cubic_recent_update` 이벤트로 Sidebar 동기화
6. **해외 호가/체결**: 미국 정규장(한국 22:30~05:00, 서머타임 기준)에만 데이터 수신. 장외 시간엔 안내 문구 정상
7. **체결 데이터 필드**: `price`, `quantity`, `side` (`BUY`/`SELL`) 사용. `volume`/`tradeType` 아님
