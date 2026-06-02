# CUBIC 증권 — 프로젝트 컨텍스트 (2025.06.02 기준)

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

### 레이아웃 구조
- App.jsx: LeftSidebar + app-main (TopBar의 티커바 + app-content)
- 좌측 고정 사이드바 (LeftSidebar.jsx) - 열림(280px)/닫힘(64px) 슬라이드 애니메이션
- 상단 티커바 (TopBar.jsx) - 지수 5개 + 환율 표시
- 우측 슬라이드 패널 (Sidebar.jsx) - 내투자/관심/최근본/실시간/퀴즈/다크모드 (현재 숨김)

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
