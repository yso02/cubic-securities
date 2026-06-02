# CUBIC 증권 — 프로젝트 컨텍스트 (2025.05.29 기준)

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
│   │   ├── Sidebar.jsx / .css       ← 전역 사이드바 (내투자/관심/최근본/실시간/다크모드)
│   │   ├── StockChart.jsx / .css    ← TradingView 캔들차트 (전체화면, MA, 거래량, 다크모드)
│   │   ├── TradeModal.jsx / .css    ← 매수/매도 모달
│   │   ├── OrderBook.jsx / .css     ← 호가창 (국내+해외 WebSocket, 체결탭)
│   ├── hooks/
│   │   └── useRealtimePrice.js      ← WebSocket 실시간 가격 훅
│   ├── pages/
│   │   ├── MainDashboard.jsx / .css ← 홈 (시장지수, 순위리스트, 뉴스패널, 티커)
│   │   ├── StockDetailPage.jsx/.css ← 종목 상세 (토스 스타일 헤더, 탭, 차트+호가)
│   │   ├── LoginPage.jsx / .css     ← 로그인/회원가입
│   │   ├── AccountPage.jsx / .css   ← 내 계좌 (토스 스타일 좌측탭, 환전버튼, 총투자금액)
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

---

## 핵심 컴포넌트 상세

### Navbar (72px 높이)
- CUBIC 증권 로고 + 홈/AI분석/내계좌 링크
- 종목 검색 (debounce 300ms, 드롭다운 결과, 클릭→상세 페이지)
- 유저 아바타 + 로그아웃 / 로그인 버튼

### Sidebar (전역, App.jsx 레벨) ✅ 2025.05.29 개편
- **내투자**: 원화/달러 잔고 + 보유종목 실시간 평가금액 (WebSocket)
- **관심**: 관심종목 패널 (서버 DB, ★ 토글)
- **최근본**: sessionStorage 기반 최근 본 종목 10개
- **실시간**: 주요 종목 실시간 체결 (국내 5종목 + 해외 5종목 WebSocket 구독)
- **다크모드**: 하단 🌙/☀️ 토글 (localStorage)
- 장 상태 배지: 국내(09:00~15:30) / 미국(22:30~05:00 서머타임) 장중/장외 표시
- 체결 데이터 있을 때 실시간 버튼에 빨간 점 알림 표시

### MainDashboard (홈)
- **시장 지수 바**: 달러 환율(✅실시간), 코스피/코스닥/나스닥/S&P500
- **정렬**: 거래대금(VOLUME) / 시가총액(MARKET_CAP) / 급상승(RISE) / 급하락(FALL)
- **종목 리스트**: 순위+로고+이름+현재가+등락률, 클릭→/stock/:symbol
- **우측 뉴스 패널**: AI 시장 뉴스
- **WebSocket**: 국내/해외 전 종목 실시간 가격 구독

### StockDetailPage (/stock/:symbol) ✅ 2025.05.29 리디자인
- 토스 스타일 헤더: 로고+이름+코드 좌측, 가격+등락률 좌측, 매수/매도 버튼 우측 (컴팩트)
- 탭: 차트·호가 / 종목정보 (종목정보는 준비 중)
- 전체화면 없이 좌측 차트 + 우측 호가창 레이아웃
- 매수/매도 완료 시 `cubic_trade_complete` 이벤트 발생 → AccountPage 자동 갱신

### OrderBook (국내+해외) ✅ 2025.05.29 완성
- **국내**: REST `getDomesticOrderbook` + WebSocket 호가/체결
- **해외**: WebSocket만 사용 (REST API 없음), 정규장(22:30~05:00)에만 수신
- 매도호가 내림차순 정렬 `.sort((a,b) => b.price - a.price)`
- 체결 탭: 체결가 + 수량 (매수=빨강, 매도=파랑, 라벨 없음)
- 체결 데이터 필드: `price`, `quantity`, `side` (`BUY`/`SELL`)
- ⚠️ WebSocket URL 반드시 `/ws/websocket`

### StockChart ✅ 2025.05.29 다크모드 대응
- MutationObserver로 `data-theme` 변경 감지 → 차트 즉시 재렌더링
- 다크모드 전환 시 배경/그리드/텍스트 색상 자동 변경

### AccountPage (내 계좌) ✅ 2025.05.29 토스 스타일 리디자인
- **좌측 사이드바 탭**: 자산 / 주문내역 / 수익분석
- **자산 탭**:
  - 총 자산 + 환전 버튼 (클릭 시 인라인 패널 펼침)
  - 자산 구성: 원화 / 달러 / 총 투자 금액 (국내주식+해외주식 서브항목)
  - 보유 종목 테이블 (실시간 평가금액/수익률)
- **환전**: 총 자산 옆 버튼 클릭 → 달러사기/달러팔기 인라인 패널
- **총 자산 계산**: 원화 + 달러(원화환산) + 보유종목 실시간 평가액
- **매매 후 자동 갱신**: `cubic_trade_complete` 이벤트 수신 시 fetchAll() 호출
- WebSocket: `/ws/websocket` (수정됨)

### AiPage (AI 분석)
- 💬 AI 채팅 (멀티턴, react-markdown 렌더링)
- 📊 종목 분석 / 📈 포트폴리오 / 🎯 추천

---

## 백엔드 API 요약

### 회원
- `POST /api/users/signup` → { email, password, name }
- `POST /api/users/login` → { token, name } (JWT)
- `GET /api/users/me` → { id, email, name, balance, dollarBalance }

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
⚠️ 모든 컴포넌트에서 `/ws/websocket` 사용 (SockJS `/ws`는 ngrok CORS 차단)

### 국내주식
- 홈/계좌(가격만): `/app/subscribe/domestic/price`
- 상세(가격+호가): `/app/subscribe/domestic`
- 가격: `/topic/domestic/{symbol}`
- 호가: `/topic/orderbook/{symbol}` (자동)
- 체결: `/topic/tradetick/{symbol}` (자동)

### 해외주식
- 가격: `/app/subscribe/overseas` + `AAPL,NAS`
- 가격 수신: `/topic/overseas/AAPL`
- 호가 구독: `/app/subscribe/overseas/orderbook` + `AAPL,NAS`
- 호가 수신: `/topic/orderbook/AAPL`
- 체결 수신: `/topic/tradetick/overseas/AAPL`
- ⚠️ 호가/체결은 미국 정규장(22:30~05:00, 서머타임)에만 수신

---

## 커스텀 이벤트
- `cubic_recent_update`: 최근 본 종목 변경 시 Sidebar 동기화
- `cubic_trade_complete`: 매수/매도 완료 시 AccountPage 자동 갱신

---

## 로고 시스템
- Logo.dev API: `https://img.logo.dev/{domain}?token={LOGO_DEV_TOKEN}&size=40`
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
- `fmt(n)`: 숫자 콤마 포맷
- `fmtPrice(price, market)`: 국내 "75,000원", 해외 "$123.45"
- `fmtChange(cp)`: "+1.23%", "-0.55%"
- `isUp(cp)`: 양수 여부

---

## 최근 작업 이력

### baek-02 작업
- Logo.dev API 기업 로고 표시
- WebSocket URL `/ws` → `/ws/websocket`
- 네브바 높이 52→72px + 배포 시간 표시
- 홈화면 AI 시장 뉴스 연동
- 시장 지수 실시간 표시
- **[2025.05.29] 미국주식 호가창 WebSocket 데이터 표시 버그 수정** (OrderBook.jsx)

### 내 작업 (Claude 지원)
- 토스증권 스타일 UI 리디자인
- JWT 인증, WebSocket 실시간 가격
- 관심종목, 환전 UI, AI 챗봇 페이지
- **[2025.05.27] OrderBook 해외 호가/체결 WebSocket 지원**
- **[2025.05.28] 체결 데이터 필드 수정** (`quantity`, `side`)
- **[2025.05.28] 매도호가 정렬 수정, 서머타임 문구 수정**
- **[2025.05.29] StockDetailPage 토스 스타일 리디자인** (헤더/탭/버튼)
- **[2025.05.29] AccountPage 토스 스타일 리디자인** (좌측탭/환전버튼/총투자금액)
- **[2025.05.29] Sidebar 내투자 패널 추가** (원화/달러잔고 + 보유종목 실시간)
- **[2025.05.29] Sidebar 실시간 체결 구현** (국내5+해외5 종목 WebSocket)
- **[2025.05.29] StockChart 다크모드 실시간 반영** (MutationObserver)
- **[2025.05.29] 매매 후 AccountPage 자동 갱신** (cubic_trade_complete 이벤트)
- **[2025.05.29] 총 자산 계산 구조** (원화+달러환산+실시간평가액)

---

## 남은 작업 / TODO
- [ ] 뉴스 API 종목별 연동 (StockDetailPage 뉴스 영역)
- [ ] Vercel 프로덕션 WebSocket
- [ ] 종목정보 탭 내용 구현
- [ ] 다크모드 세부 스타일 보완
- [ ] 해외 호가 WebSocket 정규장 시간 실데이터 확인

---

## 필요 패키지
```bash
npm install axios sockjs-client @stomp/stompjs lightweight-charts react-markdown
```

---

## 작업 시 주의사항
1. **WebSocket URL**: 반드시 `/ws/websocket`. `/ws`는 ngrok CORS 차단
2. **국내 구독 경로**: 홈/계좌는 `/app/subscribe/domestic/price`, 상세(호가포함)는 `/app/subscribe/domestic`
3. **체결 데이터 필드**: `price`, `quantity`, `side` (`BUY`/`SELL`)
4. **매매 후 갱신**: StockDetailPage `onSuccess`에서 `cubic_trade_complete` 이벤트 발생
5. **총 자산**: 원화 + (달러 × 환율) + 보유종목 실시간 평가액
6. **해외 호가/체결**: 정규장(22:30~05:00)에만 수신, 장외엔 안내 문구 정상
7. **stockApi.js 수정 주의**: export 이름 변경 시 여러 컴포넌트 import 에러 발생
8. **네브바 높이 72px**: 여러 컴포넌트에서 `calc(100vh - 72px)` 사용 중
