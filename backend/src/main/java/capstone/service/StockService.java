package capstone.service;

import capstone.dto.OrderBookDto;
import capstone.dto.StockDetailDto;
import capstone.dto.StockPriceDto;
import capstone.dto.StockSearchDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import capstone.dto.ChartDataDto;
import java.util.LinkedHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class StockService {

    private final RestTemplate restTemplate;
    private final KisAuthService kisAuthService;

    @Value("${kis.api.url}")
    private String baseUrl;

    @Value("${fmp.api.url}")
    private String fmpBaseUrl;

    @Value("${fmp.api.key}")
    private String fmpApiKey;

    // 국내 주식 현재가
    public StockPriceDto getDomesticStockPrice(String symbol) {
        String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-price"
                + "?fid_cond_mrkt_div_code=J"
                + "&fid_input_iscd=" + symbol;

        HttpHeaders headers = new HttpHeaders();
        headers.set("authorization", "Bearer " + kisAuthService.getAccessToken());
        headers.set("appkey", appKeyFromProperties());
        headers.set("appsecret", appSecretFromProperties());
        headers.set("tr_id", "FHKST01010100");
        headers.set("custtype", "P");

        HttpEntity<Void> request = new HttpEntity<>(headers);
        Map<String, Object> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class).getBody();

        Map<String, String> output = (Map<String, String>) response.get("output");

        StockPriceDto dto = new StockPriceDto();
        dto.setSymbol(symbol);
        dto.setPrice(output.get("stck_prpr"));        // 현재가
        dto.setChange(output.get("prdy_vrss"));       // 전일대비
        dto.setChangePercent(output.get("prdy_ctrt")); // 등락률

        return dto;
    }

    @Value("${kis.api.key}")
    private String appKey;

    @Value("${kis.api.secret}")
    private String appSecret;

    private String appKeyFromProperties() { return appKey; }
    private String appSecretFromProperties() { return appSecret; }

    // 미국 주식 현재가
    public StockPriceDto getOverseasStockPrice(String symbol, String exchange) {
        String url = baseUrl + "/uapi/overseas-price/v1/quotations/price"
                + "?AUTH="
                + "&EXCD=" + exchange
                + "&SYMB=" + symbol;

        HttpHeaders headers = new HttpHeaders();
        headers.set("authorization", "Bearer " + kisAuthService.getAccessToken());
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", "HHDFS00000300");
        headers.set("custtype", "P");

        HttpEntity<Void> request = new HttpEntity<>(headers);
        Map<String, Object> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class).getBody();

        Map<String, String> output = (Map<String, String>) response.get("output");

        StockPriceDto dto = new StockPriceDto();
        dto.setSymbol(symbol);
        dto.setPrice(output.get("last"));
        dto.setChange(output.get("diff"));
        dto.setChangePercent(output.get("rate"));

        return dto;
    }

    // 국내 주식 종목 검색
    public List<StockSearchDto> searchDomesticStock(String keyword) {
        String url = baseUrl + "/uapi/domestic-stock/v1/quotations/search-stock-info"
                + "?PRDT_TYPE_CD=300"
                + "&PDNO=" + keyword;

        HttpHeaders headers = new HttpHeaders();
        headers.set("authorization", "Bearer " + kisAuthService.getAccessToken());
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", "CTPF1002R");
        headers.set("custtype", "P");

        HttpEntity<Void> request = new HttpEntity<>(headers);
        Map<String, Object> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class).getBody();

        List<Map<String, String>> output = (List<Map<String, String>>) response.get("output");

        List<StockSearchDto> result = new ArrayList<>();
        if (output != null) {
            for (Map<String, String> item : output) {
                StockSearchDto dto = new StockSearchDto();
                dto.setSymbol(item.get("pdno"));
                dto.setName(item.get("prdt_abrv_name"));
                dto.setMarket(item.get("prdt_type_cd"));
                result.add(dto);
            }
        }
        return result;
    }

    // 국내 주식 차트 데이터 (일/주/월/년)
    public List<ChartDataDto> getDomesticChartData(String symbol, String period) {
        String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
                + "?fid_cond_mrkt_div_code=J"
                + "&fid_input_iscd=" + symbol
                + "&fid_input_date_1=19000101"
                + "&fid_input_date_2=99991231"
                + "&fid_period_div_code=" + period
                + "&fid_org_adj_prc=1";

        HttpHeaders headers = new HttpHeaders();
        headers.set("authorization", "Bearer " + kisAuthService.getAccessToken());
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", "FHKST03010100");
        headers.set("custtype", "P");

        HttpEntity<Void> request = new HttpEntity<>(headers);
        Map<String, Object> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class).getBody();

        List<Map<String, String>> output = (List<Map<String, String>>) response.get("output2");

        List<ChartDataDto> result = new ArrayList<>();
        if (output != null) {
            for (Map<String, String> item : output) {
                ChartDataDto dto = new ChartDataDto();
                dto.setDate(item.get("stck_bsop_date"));   // 날짜
                dto.setOpen(item.get("stck_oprc"));         // 시가
                dto.setHigh(item.get("stck_hgpr"));         // 고가
                dto.setLow(item.get("stck_lwpr"));          // 저가
                dto.setClose(item.get("stck_clpr"));        // 종가
                dto.setVolume(item.get("acml_vol"));        // 거래량
                result.add(dto);
            }
        }
        return result;
    }

    // 미국 주식 차트 데이터
    public List<ChartDataDto> getOverseasChartData(String symbol, String exchange, String period) {
        String url = baseUrl + "/uapi/overseas-price/v1/quotations/dailyprice"
                + "?AUTH="
                + "&EXCD=" + exchange
                + "&SYMB=" + symbol
                + "&GUBN=" + period
                + "&BYMD="
                + "&MODP=1";

        HttpHeaders headers = new HttpHeaders();
        headers.set("authorization", "Bearer " + kisAuthService.getAccessToken());
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", "HHDFS76240000");
        headers.set("custtype", "P");

        HttpEntity<Void> request = new HttpEntity<>(headers);
        Map<String, Object> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class).getBody();

        List<Map<String, String>> output = (List<Map<String, String>>) response.get("output2");

        List<ChartDataDto> result = new ArrayList<>();
        if (output != null) {
            for (Map<String, String> item : output) {
                ChartDataDto dto = new ChartDataDto();
                dto.setDate(item.get("xymd"));    // 날짜
                dto.setOpen(item.get("open"));    // 시가
                dto.setHigh(item.get("high"));    // 고가
                dto.setLow(item.get("low"));      // 저가
                dto.setClose(item.get("clos"));   // 종가
                dto.setVolume(item.get("tvol"));  // 거래량
                result.add(dto);
            }
        }
        return result;
    }

    // 국내 주식 분봉 데이터
    public List<ChartDataDto> getDomesticMinuteData(String symbol, String timeUnit) {
        String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice"
                + "?fid_etc_cls_code="
                + "&fid_cond_mrkt_div_code=J"
                + "&fid_input_iscd=" + symbol
                + "&fid_input_hour_1=160000"
                + "&fid_pw_data_incu_yn=Y"
                + "&fid_time_dvsn=" + timeUnit;

        HttpHeaders headers = new HttpHeaders();
        headers.set("authorization", "Bearer " + kisAuthService.getAccessToken());
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", "FHKST03010200");
        headers.set("custtype", "P");

        HttpEntity<Void> request = new HttpEntity<>(headers);
        Map<String, Object> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class).getBody();

        List<Map<String, String>> output = (List<Map<String, String>>) response.get("output2");

        List<ChartDataDto> result = new ArrayList<>();
        if (output != null) {
            for (Map<String, String> item : output) {
                ChartDataDto dto = new ChartDataDto();
                dto.setDate(item.get("stck_cntg_hour"));  // 시간
                dto.setOpen(item.get("stck_oprc"));        // 시가
                dto.setHigh(item.get("stck_hgpr"));        // 고가
                dto.setLow(item.get("stck_lwpr"));         // 저가
                dto.setClose(item.get("stck_prpr"));       // 현재가
                dto.setVolume(item.get("cntg_vol"));       // 거래량
                result.add(dto);
            }
        }
        return result;
    }
    // 미국 주식 분봉 데이터
    public List<ChartDataDto> getOverseasMinuteData(String symbol, String exchange, String timeUnit) {
        String url = baseUrl + "/uapi/overseas-price/v1/quotations/inquire-time-itemchartprice"
                + "?AUTH="
                + "&EXCD=" + exchange
                + "&SYMB=" + symbol
                + "&NMIN=" + timeUnit
                + "&PINC=1"
                + "&NEXT="
                + "&NREC=120"
                + "&FILL="
                + "&KEYB=";

        HttpHeaders headers = new HttpHeaders();
        headers.set("authorization", "Bearer " + kisAuthService.getAccessToken());
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", "HHDFS76950200");
        headers.set("custtype", "P");

        HttpEntity<Void> request = new HttpEntity<>(headers);
        Map<String, Object> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class).getBody();

        List<Map<String, String>> output = (List<Map<String, String>>) response.get("output2");

        List<ChartDataDto> result = new ArrayList<>();
        if (output != null) {
            for (Map<String, String> item : output) {
                ChartDataDto dto = new ChartDataDto();
                dto.setDate(item.get("kymd") + item.get("khms")); // 날짜+시간
                dto.setOpen(item.get("open"));
                dto.setHigh(item.get("high"));
                dto.setLow(item.get("low"));
                dto.setClose(item.get("last"));
                dto.setVolume(item.get("evol"));
                result.add(dto);
            }
        }
        return result;
    }

    // 국내 주식 상세정보
    public StockDetailDto getDomesticStockDetail(String symbol) {
        String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-price"
                + "?fid_cond_mrkt_div_code=J"
                + "&fid_input_iscd=" + symbol;

        HttpHeaders headers = new HttpHeaders();
        headers.set("authorization", "Bearer " + kisAuthService.getAccessToken());
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", "FHKST01010100");
        headers.set("custtype", "P");

        HttpEntity<Void> request = new HttpEntity<>(headers);
        Map<String, Object> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class).getBody();
        Map<String, String> output = (Map<String, String>) response.get("output");

        StockDetailDto dto = new StockDetailDto();
        dto.setSymbol(symbol);
        dto.setMarket(output.get("rprs_mrkt_kor_name"));
        dto.setPrice(output.get("stck_prpr"));
        dto.setChange(output.get("prdy_vrss"));
        dto.setChangePercent(output.get("prdy_ctrt"));
        dto.setMarketCap(output.get("hts_avls"));
        dto.setPer(output.get("per"));
        dto.setEps(output.get("eps"));
        dto.setPbr(output.get("pbr"));
        dto.setBps(output.get("bps"));
        dto.setHigh52(output.get("w52_hgpr"));
        dto.setLow52(output.get("w52_lwpr"));
        dto.setVolume(output.get("acml_vol"));
        dto.setTradingValue(output.get("acml_tr_pbmn"));

        return dto;
    }

    // 미국 주식 상세정보 (현재가: KIS, 재무데이터: FMP)
    public StockDetailDto getOverseasStockDetail(String symbol, String exchange) {
        // KIS: 현재가 / 전일대비 / 거래량
        String kisUrl = baseUrl + "/uapi/overseas-price/v1/quotations/price"
                + "?AUTH=&EXCD=" + exchange + "&SYMB=" + symbol;

        HttpHeaders kisHeaders = new HttpHeaders();
        kisHeaders.set("authorization", "Bearer " + kisAuthService.getAccessToken());
        kisHeaders.set("appkey", appKey);
        kisHeaders.set("appsecret", appSecret);
        kisHeaders.set("tr_id", "HHDFS00000300");
        kisHeaders.set("custtype", "P");

        Map<String, Object> kisResponse = restTemplate
                .exchange(kisUrl, HttpMethod.GET, new HttpEntity<>(kisHeaders), Map.class).getBody();
        Map<String, String> kisOutput = (Map<String, String>) kisResponse.get("output");

        StockDetailDto dto = new StockDetailDto();
        dto.setSymbol(symbol);
        dto.setPrice(kisOutput.get("last"));
        dto.setChange(kisOutput.get("diff"));
        dto.setChangePercent(kisOutput.get("rate"));
        dto.setVolume(kisOutput.get("tvol"));

        // FMP profile: 시가총액 / 베타 / 52주 범위 / 배당금 / 거래량
        try {
            List<Map<String, Object>> profileRes = restTemplate.getForObject(
                    fmpBaseUrl + "/profile?symbol=" + symbol + "&apikey=" + fmpApiKey, List.class);
            if (profileRes != null && !profileRes.isEmpty()) {
                Map<String, Object> p = profileRes.get(0);
                Object mktCap = p.get("marketCap");
                if (mktCap != null) {
                    dto.setMarketCap(String.valueOf(((Number) mktCap).longValue()));
                }
                dto.setBeta(String.valueOf(p.getOrDefault("beta", "")));
                String dividendYield = p.get("dividendYield") != null
                        ? String.valueOf(p.get("dividendYield"))
                        : String.valueOf(p.getOrDefault("lastDividend", ""));
                dto.setLastDividend(dividendYield);
                dto.setVolume(String.valueOf(p.getOrDefault("volume", dto.getVolume())));
                String range = (String) p.get("range");
                if (range != null && range.contains("-")) {
                    String[] parts = range.split("-", 2);
                    dto.setLow52(parts[0].trim());
                    dto.setHigh52(parts[1].trim());
                }
            }
        } catch (Exception e) {
            log.warn("FMP profile 호출 실패 ({}): {}", symbol, e.getMessage());
        }

        // FMP ratios-ttm: PER / PBR
        try {
            List<Map<String, Object>> ratiosRes = restTemplate.getForObject(
                    fmpBaseUrl + "/ratios-ttm?symbol=" + symbol + "&apikey=" + fmpApiKey, List.class);
            if (ratiosRes != null && !ratiosRes.isEmpty()) {
                Map<String, Object> r = ratiosRes.get(0);
                dto.setPer(formatRatio(r.get("priceToEarningsRatioTTM")));
                dto.setPbr(formatRatio(r.get("priceToBookRatioTTM")));
            }
        } catch (Exception e) {
            log.warn("FMP ratios-ttm 호출 실패 ({}): {}", symbol, e.getMessage());
        }

        return dto;
    }

    // 미국 주식 연봉 데이터 (월봉 데이터로 변환)
    public List<ChartDataDto> getOverseasYearlyData(String symbol, String exchange) {
        // 월봉 데이터 가져오기
        List<ChartDataDto> monthlyData = getOverseasChartData(symbol, exchange, "2");

        // 연도별로 그룹핑
        Map<String, List<ChartDataDto>> groupedByYear = new LinkedHashMap<>();
        for (ChartDataDto item : monthlyData) {
            String year = item.getDate().substring(0, 4); // 앞 4자리가 연도
            groupedByYear.computeIfAbsent(year, k -> new ArrayList<>()).add(item);
        }

        // 연봉으로 변환
        List<ChartDataDto> result = new ArrayList<>();
        for (Map.Entry<String, List<ChartDataDto>> entry : groupedByYear.entrySet()) {
            List<ChartDataDto> monthList = entry.getValue();

            String open = monthList.get(monthList.size() - 1).getOpen();   // 첫달 시가
            String close = monthList.get(0).getClose();                     // 마지막달 종가
            String high = monthList.stream()
                    .map(d -> Double.parseDouble(d.getHigh()))
                    .max(Double::compareTo)
                    .map(String::valueOf)
                    .orElse("0");
            String low = monthList.stream()
                    .map(d -> Double.parseDouble(d.getLow()))
                    .min(Double::compareTo)
                    .map(String::valueOf)
                    .orElse("0");
            long totalVolume = monthList.stream()
                    .mapToLong(d -> Long.parseLong(d.getVolume()))
                    .sum();

            ChartDataDto dto = new ChartDataDto();
            dto.setDate(entry.getKey());
            dto.setOpen(open);
            dto.setHigh(high);
            dto.setLow(low);
            dto.setClose(close);
            dto.setVolume(String.valueOf(totalVolume));
            result.add(dto);
        }
        return result;
    }

    // 국내주식 호가 조회
    public OrderBookDto getDomesticOrderBook(String symbol) {
        String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn"
                + "?fid_cond_mrkt_div_code=J"
                + "&fid_input_iscd=" + symbol;

        HttpHeaders headers = new HttpHeaders();
        headers.set("authorization", "Bearer " + kisAuthService.getAccessToken());
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", "FHKST01010200");
        headers.set("custtype", "P");

        HttpEntity<Void> request = new HttpEntity<>(headers);
        Map<String, Object> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class).getBody();
        Map<String, String> output1 = (Map<String, String>) response.get("output1");

        OrderBookDto dto = new OrderBookDto();
        dto.setSymbol(symbol);
        dto.setTotalAskQty(output1.get("total_askp_rsqn"));
        dto.setTotalBidQty(output1.get("total_bidp_rsqn"));

        List<OrderBookDto.OrderBookEntry> asks = new ArrayList<>();
        for (int i = 10; i >= 1; i--) {
            OrderBookDto.OrderBookEntry entry = new OrderBookDto.OrderBookEntry();
            entry.setPrice(output1.get("askp" + i));
            entry.setQuantity(output1.get("askp_rsqn" + i));
            asks.add(entry);
        }
        dto.setAsks(asks);

        List<OrderBookDto.OrderBookEntry> bids = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            OrderBookDto.OrderBookEntry entry = new OrderBookDto.OrderBookEntry();
            entry.setPrice(output1.get("bidp" + i));
            entry.setQuantity(output1.get("bidp_rsqn" + i));
            bids.add(entry);
        }
        dto.setBids(bids);

        return dto;
    }

    private String formatRatio(Object value) {
        if (value == null) return "";
        String str = value.toString().trim();
        if (str.isEmpty() || str.equals("null")) return "";
        try {
            return String.format("%.2f", Double.parseDouble(str));
        } catch (NumberFormatException e) {
            return "";
        }
    }

}