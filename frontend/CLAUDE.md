# CUBIC 증권 — 프로젝트 컨텍스트 (2025.06.03 기준)

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
├── public/
│   └── cube-icon.svg                ← CUBIC 증권 로고 (투명 배경 그라데이션 큐브)
├── src/
│   ├── api/stockApi.js              ← 전체 API + 유틸 + 로고 맵
│   ├── components/
│   │   ├── LeftSidebar.jsx / .css   ← 좌측 네비게이션 사이드바 (고정)
│   │   ├── TopBar.jsx / .css        ← 상단 바 (시장지수 티커 + 검색 + AI분석)
│   │   ├── Sidebar.jsx / .css       ← 우측 사이드바 (display:none, 미사용)
│   │   ├── OrderBook.jsx / .css     ← 호가창 (국내+해외 WebSocket, 체결탭)
│   │   ├── StockChart.jsx / .css    ← TradingView 캔들차트 (MA, 거래량, 다크모드)
│   │   ├── TradeModal.jsx / .css    ← 매수/매도 모달
│   │   ├── QuizModal.jsx / .css     ← 퀴즈 모달
│   ├── hooks/
│   │   └── useRealtimePrice.js      ← WebSocket 실시간 가격 훅
│   ├── pages/
│   │   ├── MainDashboard.jsx / .css ← 홈 대시보드 (포트폴리오 퍼포먼스, 내포트폴리오, 관심종목)
│   │   ├── MarketPage.jsx / .css    ← 시장 페이지 (TOP4카드, 종목리스트, 실시간)
│   │   ├── StockDetailPage.jsx/.css ← 종목 상세 (차트+호가 탭, 종목정보 탭)
│   │   ├── AccountPage.jsx / .css   ← 내 계좌 (좌측탭, 환전버튼, 총투자금액)
│   │   ├── AiPage.jsx / .css        ← AI 챗봇 + 포트폴리오 분석
│   │   ├── LoginPage.jsx / .css     ← 로그인/회원가입
│   ├── App.jsx / App.css            ← 라우팅 + 전역 레이아웃
│   ├── index.css                    ← 글로벌 CSS 변수
│   └── main.jsx
├── vite.config.js
└── package.json
```

---

## 라우팅 (App.jsx)
```
/           → MainDashboard (홈 대시보드)
/login      → LoginPage
/ai         → AiPage
/stock/:symbol → StockDetailPage
/market     → MarketPage (시장)
/account    → AccountPage (로그인 필요)
/watchlist  → (관심종목, 추후 구현)
```

## 전역 레이아웃 (App.jsx)
```jsx
<div className="app-layout">           ← height:100vh, overflow:hidden, display:flex
  <LeftSidebar user={user} onLogout={handleLogout} />
  <div className="app-main">           ← flex:1, overflow-y:auto (스크롤 영역)
    <TopBar user={user} />
    <div className="app-content">
      <Routes>...</Routes>
    </div>
  </div>
  <Sidebar user={user} />              ← display:none (미사용)
</div>
```
⚠️ `app-main`이 스크롤 컨테이너 → LeftSidebar는 자연스럽게 고정됨

---

## 핵심 컴포넌트 상세

### LeftSidebar ✅ 2025.06.03
- `position: sticky; top: 0; height: 100vh` (app-main 스크롤로 자연 고정)
- 로고: `/public/cube-icon.svg` (투명 배경 그라데이션 큐브)
- 총 자산 표시 (WebSocket 실시간, 보유종목 avgPrice 기준)
- 메뉴: 대시보드 / 포트폴리오 / 관심종목 / 시장
- 하단: 프로필(→ /account) + **로그아웃 버튼** (→ 아이콘, 호버 시 빨간색)
- 입금/출금 모달 (+ 버튼)
- collapsed 상태 토글 (아이콘만 표시)

### TopBar
- 상단 티커 바: 코스피/코스닥/S&P500/나스닥/달러환율 실시간
- 종목 검색 (debounce 300ms, 드롭다운)
- AI 분석 버튼
- 다크모드 토글

### MainDashboard (홈) ✅ 2025.06.03
- 포트폴리오 퍼포먼스 차트
- 내 포트폴리오 테이블 (WebSocket 실시간 가격 반영)
- 관심종목 패널
- 종목 클릭 → **모달 오버레이** (차트+호가창, 매수/매도 버튼)
- `handleSelectStock`: navigate 대신 stockModal state로 모달 오픈
- `cubic_trade_complete` 이벤트 수신 시 포트폴리오 자동 갱신

### MarketPage (/market) ✅ 2025.06.03
- TOP4 카드 (거래대금 기준 상위 4종목, 스파크라인)
- 국내/해외 탭 + 거래대금/시가총액/급상승/급하락 정렬
- 실시간 가격 (WebSocket)
- 종목 클릭 → **모달 오버레이** (차트+호가창) — navigate 아님
- `stock-modal-overlay` CSS 클래스로 모달 스타일

### StockDetailPage (/stock/:symbol)
- 토스 스타일 헤더: 로고+이름+코드 / 가격+등락률 / 매수·매도 버튼
- 탭: 차트·호가 / 종목정보 (준비 중)
- 매수/매도 완료 시 `cubic_trade_complete` 이벤트 발생

### OrderBook ✅
- **국내**: REST 초기 로드 + WebSocket 실시간
- **해외**: WebSocket만 (REST 없음), 정규장(22:30~05:00 서머타임)만
- 매도호가 내림차순 `.sort((a,b) => b.price - a.price)`
- 체결 탭: 매수=빨강, 매도=파랑 (라벨 없음)
- 체결 필드: `price`, `quantity`, `side` (BUY/SELL)

### AccountPage (/account) ✅
- 좌측탭: 자산 / 주문내역 / 수익분석
- 자산탭: 총 자산 + 환전버튼 (인라인 패널) + 원화/달러/총투자금액(국내+해외 서브)
- 보유종목 실시간 (WebSocket)
- `cubic_trade_complete` 이벤트 수신 시 자동 갱신

### StockChart ✅
- MutationObserver로 다크모드 변경 감지 → 즉시 재렌더링
- 분봉/일봉/주봉/월봉 지원

---

## 백엔드 API 요약

### 회원
- `POST /api/users/signup` / `login` → JWT
- `GET /api/users/me`
- `POST /api/trade/deposit` / `withdraw` → 입출금

### 매매
- `POST /api/trade/buy` / `sell`
- `GET /api/trade/balance` / `holdings` / `orders`
- `GET /api/trade/profit?period=DAY|WEEK|MONTH|YEAR|ALL`

### 시세/호가/차트
- `GET /api/stocks/domestic/{symbol}` / `overseas/{symbol}?exchange=NAS`
- `GET /api/stocks/orderbook/domestic/{symbol}` (해외 REST 없음)
- `GET /api/stocks/chart/domestic/{symbol}?period=D`
- `GET /api/stocks/chart/overseas/{symbol}?exchange=NAS&period=0`
- `GET /api/stocks/chart/domestic/{symbol}/minute?timeUnit=5`
- `GET /api/stocks/search?keyword=`

### 시장/뉴스
- `GET /api/market/domestic/ranking?type=VOLUME|RISE|FALL|MARKET_CAP`
- `GET /api/market/overseas/ranking?type=VOLUME|RISE|FALL|MARKET_CAP`
- `GET /api/market/indices` / `news`

### AI / 환율 / 관심종목
- `POST /api/ai/chat` / `analyze/holdings` / `portfolio` / `recommend`
- `GET /api/exchange/rate`
- `POST /api/exchange/krw-to-usd` / `usd-to-krw`
- `GET/POST/DELETE /api/watchlist`

---

## WebSocket 구조

```javascript
brokerURL: "wss://rockiness-venture-reptilian.ngrok-free.dev/ws/websocket"
connectHeaders: { "ngrok-skip-browser-warning": "true" }
```
⚠️ 반드시 `/ws/websocket` (SockJS `/ws`는 ngrok CORS 차단)

### 국내
- 가격만: `/app/subscribe/domestic/price` → `/topic/domestic/{symbol}`
- 가격+호가: `/app/subscribe/domestic` → `/topic/orderbook/{symbol}`, `/topic/tradetick/{symbol}`

### 해외
- 가격: `/app/subscribe/overseas` + `AAPL,NAS` → `/topic/overseas/AAPL`
- 호가: `/app/subscribe/overseas/orderbook` + `AAPL,NAS` → `/topic/orderbook/AAPL`
- 체결: `/topic/tradetick/overseas/AAPL`
- ⚠️ 호가/체결은 미국 정규장(22:30~05:00 서머타임)에만 수신

---

## 커스텀 이벤트
- `cubic_recent_update`: 최근 본 종목 변경 시 동기화
- `cubic_trade_complete`: 매수/매도 완료 시 AccountPage + MainDashboard 자동 갱신

---

## CSS 변수 (index.css)
```css
--c-bg, --c-surface, --c-hover
--c-text, --c-text-sub, --c-text-muted
--c-border, --c-border-light
--c-primary, --c-primary-muted, --c-primary-border
--r-sm, --r-md, --r-lg
```
다크모드: `[data-theme="dark"]` 속성

---

## 최근 작업 이력

### baek-02 작업
- LeftSidebar 전면 리디자인 (collapsed, 총자산, 메뉴, 프로필)
- TopBar (티커바 + 검색 + AI버튼)
- MarketPage 전면 개편 (TOP4카드, 스파크라인, 정렬탭)
- MainDashboard 전면 개편 (포트폴리오 퍼포먼스 차트)
- QuizModal 추가
- 입금/출금 API (`/api/trade/deposit`, `/api/trade/withdraw`)

### 내 작업 (Claude 지원)
- **[05.27] OrderBook 해외 WebSocket + 체결 필드 수정**
- **[05.28] 체결 탭 UI (매수=빨강/매도=파랑), 매도호가 정렬 수정**
- **[05.29] StockDetailPage 토스 스타일 리디자인**
- **[05.29] AccountPage 토스 스타일 리디자인 (좌측탭, 환전, 총투자금액)**
- **[05.29] Sidebar 내투자/실시간체결 WebSocket 구현**
- **[05.29] StockChart 다크모드 실시간 반영**
- **[05.29] 매매 후 AccountPage 자동갱신 (cubic_trade_complete)**
- **[06.03] MainDashboard 포트폴리오 WebSocket 실시간 반영**
- **[06.03] LeftSidebar 총자산 WebSocket 실시간 반영**
- **[06.03] MainDashboard + MarketPage 종목 클릭 모달 구현** (navigate → 모달)
- **[06.03] App.css: app-main overflow-y:auto 스크롤 구조 변경** (LeftSidebar 고정)
- **[06.03] LeftSidebar 로그아웃 버튼 추가**
- **[06.03] 로고 변경**: cube-icon.svg (투명 배경 그라데이션 큐브)
- **[06.03] index.css #root height → min-height 수정**

---

## 남은 작업 / TODO
- [ ] 종목정보 탭 내용 구현 (StockDetailPage)
- [ ] 관심종목 페이지 (/watchlist)
- [ ] Vercel 프로덕션 WebSocket
- [ ] 다크모드 세부 스타일 보완
- [ ] 해외 호가 WebSocket 정규장 실데이터 확인
- [ ] LeftSidebar 총자산 WebSocket 실시간 반영 고도화

---

## 작업 시 주의사항
1. **WebSocket URL**: 반드시 `/ws/websocket`
2. **국내 구독**: 홈은 `/price`, 상세(호가포함)는 `/app/subscribe/domestic`
3. **체결 데이터 필드**: `price`, `quantity`, `side` (BUY/SELL)
4. **스크롤 구조**: `app-main`이 스크롤 컨테이너 (`overflow-y: auto`)
5. **종목 클릭**: MainDashboard/MarketPage는 모달, StockDetailPage는 /stock/:symbol 라우트
6. **해외 호가/체결**: 22:30~05:00(서머타임)에만 수신
7. **LeftSidebar onLogout**: App.jsx에서 `apiLogout()` 호출하는 함수 전달
8. **로고**: `public/cube-icon.svg` (검정 배경 path 제거된 버전)
9. **Sidebar.jsx**: 현재 `display:none`으로 미사용 (LeftSidebar로 대체됨)
