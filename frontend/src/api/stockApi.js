// src/api/stockApi.js
import axios from "axios";

const NGROK_URL = "https://rockiness-venture-reptilian.ngrok-free.dev";

const api = axios.create({
  baseURL: NGROK_URL,
  headers: { "ngrok-skip-browser-warning": "true", "Content-Type": "application/json" },
  timeout: 10000,
});

// JWT 토큰 자동 첨부
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("cubic_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ═══════════ 회원 ═══════════ */
export const signUp = async (email, password, name) => {
  const res = await api.post("/api/users/signup", { email, password, name });
  return res.data;
};

export const login = async (email, password) => {
  const res = await api.post("/api/users/login", { email, password });
  // { token, name } — 토큰 자동 저장
  if (res.data?.token) sessionStorage.setItem("cubic_token", res.data.token);
  return res.data;
};

export const logout = () => {
  sessionStorage.removeItem("cubic_token");
  sessionStorage.removeItem("cubic_user");
};

export const getMyInfo = async () => {
  const res = await api.get("/api/users/me");
  return res.data; // { id, email, name, balance, dollarBalance }
};

/* ═══════════ 매매 ═══════════ */
export const buyStock = async (payload) => {
  const res = await api.post("/api/trade/buy", payload);
  return res.data;
};
export const sellStock = async (payload) => {
  const res = await api.post("/api/trade/sell", payload);
  return res.data;
};
export const getBalance = async () => { const r = await api.get("/api/trade/balance"); return r.data; };
export const getHoldings = async () => { const r = await api.get("/api/trade/holdings"); return r.data; };
export const getOrders = async () => { const r = await api.get("/api/trade/orders"); return r.data; };
export const getProfit = async (period = "ALL") => {
  const r = await api.get(`/api/trade/profit?period=${period}`);
  return r.data; // { period, totalProfit, profitList }
};

/* ═══════════ 관심종목 (서버 저장) ═══════════ */
export const getWatchlist = async () => { const r = await api.get("/api/watchlist"); return r.data; };
export const addWatchlist = async (symbol, name, market) => {
  const r = await api.post("/api/watchlist", { symbol, name, market });
  return r.data;
};
export const removeWatchlist = async (symbol) => {
  const r = await api.delete(`/api/watchlist/${symbol}`);
  return r.data;
};

/* ═══════════ 시세 ═══════════ */
export const searchStocks = async (keyword) => {
  const res = await api.get(`/api/stocks/search?keyword=${encodeURIComponent(keyword)}`);
  return res.data;
};
export const getDomesticPrice = async (symbol) => {
  const res = await api.get(`/api/stocks/domestic/${symbol}`);
  return res.data;
};
export const getOverseasPrice = async (symbol, exchange = "NAS") => {
  const res = await api.get(`/api/stocks/overseas/${symbol}?exchange=${exchange}`);
  return res.data;
};

/* ═══════════ 상세정보 ═══════════ */
export const getDomesticDetail = async (symbol) => {
  const res = await api.get(`/api/stocks/detail/domestic/${symbol}`);
  return res.data;
};
export const getOverseasDetail = async (symbol, exchange = "NAS") => {
  const res = await api.get(`/api/stocks/detail/overseas/${symbol}?exchange=${exchange}`);
  return res.data;
};

/* ═══════════ 호가창 ═══════════ */
export const getDomesticOrderbook = async (symbol) => {
  const res = await api.get(`/api/stocks/orderbook/domestic/${symbol}`);
  return res.data;
};

/* ═══════════ 차트 ═══════════ */
export const getDomesticChart = async (symbol, period = "D") => {
  const res = await api.get(`/api/stocks/chart/domestic/${symbol}?period=${period}`);
  return res.data;
};
export const getOverseasChart = async (symbol, exchange = "NAS", period = "0") => {
  const res = await api.get(`/api/stocks/chart/overseas/${symbol}?exchange=${exchange}&period=${period}`);
  return res.data;
};
export const getDomesticMinute = async (symbol, timeUnit = 5) => {
  const res = await api.get(`/api/stocks/chart/domestic/${symbol}/minute?timeUnit=${timeUnit}`);
  return res.data;
};
export const getOverseasMinute = async (symbol, exchange = "NAS", timeUnit = 5) => {
  const res = await api.get(`/api/stocks/chart/overseas/${symbol}/minute?exchange=${exchange}&timeUnit=${timeUnit}`);
  return res.data;
};

/* ═══════════ 시장 순위 ═══════════ */
export const getDomesticRanking = async (type = "VOLUME") => {
  const res = await api.get(`/api/market/domestic/ranking?type=${type}`);
  return (res.data || []).map(s => ({ ...s, market: s.market || "KOSPI" }));
};
export const getOverseasRanking = async (type = "VOLUME") => {
  const res = await api.get(`/api/market/overseas/ranking?type=${type}`);
  return (res.data || []).map(s => ({ ...s, market: s.market || "NASDAQ" }));
};

/* ═══════════ 시장 지수 ═══════════ */
export const getMarketIndices = async () => {
  const res = await api.get("/api/market/indices");
  return res.data; // [{ code, name, price, change, changePercent }]
};

/* ═══════════ AI 시장 뉴스 ═══════════ */
export const getMarketNews = async () => {
  const res = await api.get("/api/market/news");
  return res.data; // { updatedAt, headlines, positive, negative, summary }
};

/* ═══════════ AI ═══════════ */
export const aiChat = async (message, history = []) => {
  const res = await api.post("/api/ai/chat", { message, history });
  return res.data; // { message }
};
export const aiAnalyzeHoldings = async () => {
  const res = await api.post("/api/ai/analyze/holdings");
  return res.data; // { message }
};
export const aiAnalyzePortfolio = async () => {
  const res = await api.post("/api/ai/analyze/portfolio");
  return res.data; // { message }
};
export const aiRecommend = async () => {
  const res = await api.post("/api/ai/analyze/recommend");
  return res.data; // { message }
};

/* ═══════════ 환율/환전 ═══════════ */
export const getExchangeRate = async () => {
  const res = await api.get("/api/exchange/rate");
  return res.data; // { rate }
};
export const exchangeKrwToUsd = async (amount) => {
  const res = await api.post("/api/exchange/krw-to-usd", { amount });
  return res.data; // { exchanged, dollarBalance, balance, rate }
};
export const exchangeUsdToKrw = async (amount) => {
  const res = await api.post("/api/exchange/usd-to-krw", { amount });
  return res.data;
};

/* ═══════════ 유틸 ═══════════ */
export const getExchangeCode = (market) => ({ NASDAQ: "NAS", NYSE: "NYS", AMEX: "AMS" }[market] || "NAS");
export const isDomestic = (market) => ["KOSPI", "KOSDAQ", "ETF"].includes(market);
export const fmt = (n) => { const num = Number(n); return isNaN(num) ? n : num.toLocaleString("ko-KR"); };
export const fmtPrice = (price, market) => !price ? "-" : isDomestic(market) ? `${fmt(price)}원` : `$${Number(price).toFixed(2)}`;
// 변동률 포맷: "+0.55" → "+0.55%", "-2.23" → "-2.23%"  (중복 부호 방지)
export const fmtChange = (cp) => {
  if (!cp && cp !== 0) return "-";
  const n = Number(String(cp).replace(/[+]/g, ""));
  if (isNaN(n)) return "-";
  return `${n >= 0 ? "+" : ""}${n}%`;
};
export const isUp = (cp) => Number(String(cp).replace(/[+]/g, "")) >= 0;

export const DOMESTIC_STOCKS = [
  { symbol: "005930", name: "삼성전자", market: "KOSPI" },
  { symbol: "000660", name: "SK하이닉스", market: "KOSPI" },
  { symbol: "373220", name: "LG에너지솔루션", market: "KOSPI" },
  { symbol: "005380", name: "현대차", market: "KOSPI" },
  { symbol: "000270", name: "기아", market: "KOSPI" },
  { symbol: "006400", name: "삼성SDI", market: "KOSPI" },
  { symbol: "051910", name: "LG화학", market: "KOSPI" },
  { symbol: "035420", name: "NAVER", market: "KOSPI" },
  { symbol: "035720", name: "카카오", market: "KOSPI" },
  { symbol: "068270", name: "셀트리온", market: "KOSPI" },
  { symbol: "005490", name: "POSCO홀딩스", market: "KOSPI" },
  { symbol: "055550", name: "신한지주", market: "KOSPI" },
  { symbol: "003670", name: "포스코퓨처엠", market: "KOSDAQ" },
  { symbol: "247540", name: "에코프로비엠", market: "KOSDAQ" },
  { symbol: "086520", name: "에코프로", market: "KOSDAQ" },
  { symbol: "041510", name: "에스엠", market: "KOSDAQ" },
];
export const OVERSEAS_STOCKS = [
  { symbol: "AAPL", name: "Apple", market: "NASDAQ", exchange: "NAS" },
  { symbol: "NVDA", name: "NVIDIA", market: "NASDAQ", exchange: "NAS" },
  { symbol: "TSLA", name: "Tesla", market: "NASDAQ", exchange: "NAS" },
  { symbol: "MSFT", name: "Microsoft", market: "NASDAQ", exchange: "NAS" },
  { symbol: "AMZN", name: "Amazon", market: "NASDAQ", exchange: "NAS" },
  { symbol: "GOOG", name: "Alphabet", market: "NASDAQ", exchange: "NAS" },
  { symbol: "META", name: "Meta", market: "NASDAQ", exchange: "NAS" },
];

export { NGROK_URL };
export default api;

export const LOGO_DEV_TOKEN = "pk_WZdBD7DGSR2HtYYW9uOP0g";

export const DOMESTIC_LOGO_MAP = {
  '005930': 'samsung.com',
  '000660': 'skhynix.com',
  '005380': 'hyundai.com',
  '000270': 'kia.com',
  '005490': 'posco.com',
  '035420': 'naver.com',
  '035720': 'kakao.com',
  '051910': 'lgchem.com',
  '006400': 'samsungsdi.co.kr',
  '028260': 'samsung.com',
  '066570': 'lg.com',
  '096770': 'skoil.co.kr',
  '017670': 'sktelecom.com',
  '030200': 'kt.com',
  '055550': 'shinhan.com',
  '105560': 'kb.co.kr',
  '086790': 'hanafinancial.com',
  '032830': 'samsunglife.com',
  '003550': 'lgcorp.com',
  '009150': 'samsungelectro.com',
  '012330': 'mobis.co.kr',
  '018260': 'samsung-sds.com',
  '034730': 'sk.com',
  '015760': 'kepco.co.kr',
  '024110': 'ibk.co.kr',
  '000810': 'samsungfire.com',
  '032640': 'lguplus.com',
  '011200': 'hmm21.com',
  '003490': 'koreanair.com',
  '090430': 'amorepacific.com',
  '068270': 'celltrion.com',
  '207940': 'samsungbio.com',
  '373220': 'lgensol.com',
  '000720': 'hdec.co.kr',
  '009540': 'hd-hyundai.com',
  '042660': 'hanwhaocean.com',
  '329180': 'hd-hyundai.com',
  '005935': 'samsung.com',
  '316140': 'wooribank.com',
  '097950': 'cjcheiljedang.co.kr',
  '000100': 'yuhan.co.kr',
  '161390': 'hanwha.com',
  '003670': 'posco.com',
  '247540': 'ecoprobm.com',
  '086520': 'ecopro.co.kr',
  '122630': 'mirae-asset.com',
  '252670': 'mirae-asset.com',
  '114800': 'mirae-asset.com',
  '069500': 'blackrock.com',
  '396500': 'tigeretf.com',
};

export const OVERSEAS_LOGO_MAP = {
  'NVDA': 'nvidia.com',
  'TSLA': 'tesla.com',
  'AAPL': 'apple.com',
  'MSFT': 'microsoft.com',
  'AMZN': 'amazon.com',
  'META': 'meta.com',
  'GOOGL': 'google.com',
  'GOOG': 'google.com',
  'INTC': 'intel.com',
  'AMD': 'amd.com',
  'NFLX': 'netflix.com',
  'JPM': 'jpmorganchase.com',
  'V': 'visa.com',
  'MA': 'mastercard.com',
  'WMT': 'walmart.com',
  'BABA': 'alibaba.com',
  'TSM': 'tsmc.com',
  'ASML': 'asml.com',
  'SHOP': 'shopify.com',
  'SPOT': 'spotify.com',
};

export const getLogoUrl = (symbol, market) => {
  const isOverseas = !isDomestic(market);
  const map = isOverseas ? OVERSEAS_LOGO_MAP : DOMESTIC_LOGO_MAP;
  const domain = map[symbol];
  if (!domain) return null;
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=40`;
};
