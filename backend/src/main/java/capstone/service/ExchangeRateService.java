package capstone.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.net.ssl.*;
import java.security.cert.X509Certificate;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ExchangeRateService {

    private final RestTemplate eximRestTemplate;

    @Value("${koreaexim.api.key}")
    private String apiKey;

    private volatile double cachedRate = 1300.0;

    public ExchangeRateService() {
        disableSslVerification();
        this.eximRestTemplate = new RestTemplate();
    }

    private static void disableSslVerification() {
        try {
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, new TrustManager[]{new X509TrustManager() {
                public void checkClientTrusted(X509Certificate[] chain, String authType) {}
                public void checkServerTrusted(X509Certificate[] chain, String authType) {}
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            }}, null);
            SSLContext.setDefault(sslContext);
            HttpsURLConnection.setDefaultSSLSocketFactory(sslContext.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);
        } catch (Exception e) {
            log.warn("SSL 검증 비활성화 실패: {}", e.getMessage());
        }
    }

    public double getCurrentRate() {
        return cachedRate;
    }

    @Scheduled(fixedRate = 3600000)
    public void refreshRate() {
        Double rate = fetchRate();
        if (rate != null) {
            cachedRate = rate;
            log.info("환율 갱신: {} KRW/USD", cachedRate);
        }
    }

    private Double fetchRate() {
        LocalDate date = LocalDate.now();
        for (int i = 0; i < 5; i++) {
            String searchDate = date.minusDays(i).format(DateTimeFormatter.ofPattern("yyyyMMdd"));
            try {
                String url = "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON"
                        + "?authkey=" + apiKey
                        + "&searchdate=" + searchDate
                        + "&data=AP01";
                List<Map<String, Object>> response = eximRestTemplate.getForObject(url, List.class);
                if (response == null || response.isEmpty()) continue;
                for (Map<String, Object> item : response) {
                    if ("USD".equals(item.get("cur_unit"))) {
                        String rateStr = (String) item.get("deal_bas_r");
                        if (rateStr != null && !rateStr.isBlank()) {
                            return Double.parseDouble(rateStr.replace(",", ""));
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("환율 조회 실패 ({}): {}", searchDate, e.getMessage());
            }
        }
        return null;
    }
}
