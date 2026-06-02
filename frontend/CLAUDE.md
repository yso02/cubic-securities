<<<<<<< HEAD
# CUBIC 증권 — 프로젝트 컨텍스트 (2025.05.29 기준)
=======
# CUBIC 증권 — 프로젝트 컨텍스트 (2025.06.02 기준)
>>>>>>> 6d24d15cd091c4352660a95ed5e731a7ae622706

## 백엔드 (capstone-backend)

### 프로젝트 개요
- Spring Boot, Java 17, MySQL, Gradle
- ngrok 고정 주소: https://rockiness-venture-reptilian.ngrok-free.dev

### 구현된 주요 기능
- JWT 인증, 회원가입/로그인
- 모의 매수/매도/잔고/주문내역/실현손익
- 입금/출금 API (POST /api/trade/deposit, POST /api/trade/withdraw)
- 관심종목 (서버 저장)
- 종목 검색 (KOSPI/KOSDAQ/ETF/미국주식 CSV)
- 현재가/차트/분봉/연봉 (국내+미국)
- 호가창 (국내+미국)
- KIS WebSocket 실시간 (국내 정규장 H0STCNT0, 호가 H0STASP0)
- 국내 시간외 단일가 WebSocket (H0STOUP0, H0STOAA0) - 16:00~18:00
- 미국 실시간 WebSocket (HDFSCNT0, HDFSASP0)
- 환율/달러잔고/환전 (한국수출입은행 API)
- 시장 순위 API (거래대금/시가총액/급상승/급하락, 국내+미국)
- 시장 지수 API (코스피/코스닥/나스닥/S&P500)
- AI 시장 뉴스 (국내/해외 분리, Claude Haiku)
- 데일리 퀴즈 (OX/4지선다, 정답 시 랜덤 1주 지급, 현재 개발모드)
- AI 챗봇 + AI 포트폴리오 분석
- 종목정보 AI 분석 (GET /api/stocks/info/{symbol}?market={market})
  - 시가총액, 시총순위, PER, PBR + Claude Haiku AI 분석
  - 국내: KIS 차트 API + 시총순위 API
  - 미국: FMP API (priceToEarningsRatioTTM, priceToBookRatioTTM)
- 투자자별 매매동향 (GET /api/stocks/investor/{symbol}?market={market})
  - KIS FHPTJ04160001, 최근 10거래일
  - 15:40 기준 당일/전일 자동 분기
  - 국내주식만 제공

### 시간대별 국내주식 동작
- 09:00~15:30: 정규장 WebSocket (H0STCNT0)
- 15:30~16:00: REST 폴링
- 16:00~18:00: 시간외 단일가 WebSocket (H0STOUP0)
- 18:00~09:00: REST 폴링

### 주요 파일 경로
- src/main/java/capstone/service/
- src/main/java/capstone/controller/
- src/main/java/capstone/dto/
- src/main/java/capstone/domain/
- application-secret.properties (git-ignored)

### PENDING 작업
- 종목정보 DB 캐싱 (stock_info_cache 테이블, 24시간 TTL)
- ETF 종목정보 별도 처리 (PER/PBR 숨김, ETF 전용 AI 프롬프트)
- 체결창 초기 데이터 + 체결강도 (FHPST01060000)
- 미국주식 프리/애프터마켓 MTYP 필드 파싱
- 퀴즈 하루 1회 제한 활성화 (alreadySolved 로직 주석 해제)
- 내 계좌 페이지 미국주식 원화 표시
- 오늘의 수익 API
- 3D 큐빅 모델 매수/홀드/매도 신호 API

---

## 프론트엔드 (cubic-securities)

### 프로젝트 개요
- React (Vite), Vercel 배포
- GitHub: https://github.com/yso02/cubic-securities

<<<<<<< HEAD
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
=======
### 레이아웃 구조
- App.jsx: LeftSidebar + app-main (TopBar의 티커바 + app-content)
- 좌측 고정 사이드바 (LeftSidebar.jsx) - 열림(280px)/닫힘(64px) 슬라이드 애니메이션
- 상단 티커바 (TopBar.jsx) - 지수 5개 + 환율 표시
- 우측 슬라이드 패널 (Sidebar.jsx) - 내투자/관심/최근본/실시간/퀴즈/다크모드 (현재 숨김)
>>>>>>> 6d24d15cd091c4352660a95ed5e731a7ae622706

### 주요 페이지
- MainDashboard.jsx (/): 대시보드
  - 환영 헤더 + 검색창 + AI 어시스턴트 버튼 (그라디언트 애니메이션)
  - 포트폴리오 퍼포먼스 카드 (더미 차트, 오늘의 수익/최저/최고)
  - 내 포트폴리오 테이블 (현재가/보유/손익/평가금액/매수매도신호)
  - 관심종목 테이블 (현재가/등락률/Trends/신호)
  - 확장 오버레이 모달
- MarketPage.jsx (/market): 주식 시장
  - TOP4 카드 (거래대금 상위 4종목, 스파크라인)
  - 국내/미국 탭 + 거래대금/시가총액/급상승/급하락 필터
  - 종목 리스트 (스파크라인, 등락률, 현재가, 거래대금, 신호)
  - 종목 검색
- StockDetailPage.jsx (/stock/:symbol): 종목 상세
  - 차트·호가 탭, 종목정보 탭
  - 종목정보: 시가총액/시총순위/PER/PBR 카드 + AI 분석 + 투자자별 매매동향
- AccountPage.jsx (/account): 내 계좌
- AiPage.jsx (/ai): AI 분석

### 사이드바 메뉴 구조
- MAIN: 대시보드(/), 포트폴리오(/account), 관심종목(/watchlist 예정)
- 탐색: 시장(/market)
- 하단: 프로필(이름/이메일), 빌드 정보

<<<<<<< HEAD
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
=======
### 디자인 시스템
- CSS 변수: index.css (라이트/다크 모드)
- 주요 색상: --c-primary(#14b8a6), --c-bg(#f8f9fa), --c-surface(#fff)
- 버튼: 매수(빨강 그라디언트), 매도(파랑 그라디언트), 입체감 box-shadow
- 세그먼트 컨트롤: 거래대금/시가총액/급상승/급하락 필터
- 스파크라인: 등락률 기반 더미 SVG (추후 실제 데이터로 교체 예정)

### 주요 파일
- src/pages/MainDashboard.jsx + .css
- src/pages/MarketPage.jsx + .css
- src/pages/StockDetailPage.jsx + .css
- src/components/LeftSidebar.jsx + .css
- src/components/TopBar.jsx + .css
- src/components/Sidebar.jsx + .css (현재 숨김)
- src/api/stockApi.js

### PENDING 작업
- 관심종목 페이지 (/watchlist)
- 포트폴리오 실제 차트 구현
- 오늘의 수익 실제 API 연동
- 관심종목/포트폴리오 실시간 WebSocket 가격
- 스파크라인 실제 차트 데이터 연동
- 우측 Sidebar 재활성화 또는 재설계
- 3D 큐빅 신호 표시 연동
>>>>>>> 6d24d15cd091c4352660a95ed5e731a7ae622706
