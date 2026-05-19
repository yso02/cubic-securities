# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
npm run lint       # ESLint check
```

No test framework is configured.

## Architecture

**Stack**: React 19 + Vite 8, plain JSX (no TypeScript), React Router v7, Axios, STOMP/SockJS WebSocket, lightweight-charts.

**Routing** (App.jsx):
- `/` → MainDashboard — stock rankings, chart, real-time ticker, trading
- `/login` → LoginPage — signup/login with JWT stored in `sessionStorage` as `cubic_token`
- `/ai` → AiPage — AI chatbot + portfolio analysis (protected)
- `/account` → AccountPage — balance, holdings, transaction history (protected)

Auth guard lives in App.jsx: checks a `user` state object, redirects unauthenticated users away from `/ai` and `/account`.

**API layer** (`src/api/stockApi.js`):
- Single Axios instance with base URL hardcoded to an ngrok tunnel (`https://rockiness-venture-reptilian.ngrok-free.dev`). **Change this when the backend URL changes.**
- Request interceptor attaches `Authorization: Bearer {token}` from sessionStorage and `ngrok-skip-browser-warning: true` header.
- Exports named functions for every backend endpoint: auth, trading, watchlist, prices, charts, orderbook, AI, and currency exchange.
- Hardcoded lists of 16 domestic (KOSPI/KOSDAQ) and 7 overseas (NASDAQ) symbols at the top of the file.

**Real-time prices**:
- `src/hooks/useRealtimePrice.js` — reusable STOMP hook; subscribes to `/topic/domestic/{symbol}` or `/topic/overseas/{symbol}` after publishing to `/app/subscribe/{type}`.
- MainDashboard.jsx also maintains its own separate STOMP client for the ticker strip and list updates (duplicate connection — be aware when debugging WebSocket issues).
- WebSocket URL is derived by converting the Axios base URL to `wss://` (or `ws://` for plain HTTP).

**State management**: All local `useState`; no Context or Redux. Auth state (`user`) is lifted to App.jsx and passed as props. sessionStorage is used as a backup/cache (`cubic_user`).

**Key components**:
- `StockChart.jsx` — wraps lightweight-charts for candlestick/line chart rendering
- `OrderBook.jsx` — domestic stock order book display
- `TradeModal.jsx` — buy/sell order execution modal
- `Navbar.jsx` — top nav with user profile, logout

## Notable Patterns & Constraints

- `index.html` has a `window.global = window` polyfill required by the STOMP/SockJS libraries.
- The news section in MainDashboard is a skeleton placeholder — API integration is pending ("API 연동 예정").
- Market index widgets (KOSPI, KOSDAQ, NASDAQ, S&P 500) are UI-only with no live data.
- AI responses are rendered with `react-markdown`; the AI page uses quick-action buttons to inject prompts.
- `sessionStorage` (not `localStorage`) is used for auth — tokens are cleared on tab close.
