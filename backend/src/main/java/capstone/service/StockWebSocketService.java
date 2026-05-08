package capstone.service;

import capstone.dto.StockPriceDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
@EnableScheduling
public class StockWebSocketService {

    private final SimpMessagingTemplate messagingTemplate;
    private final StockService stockService;
    private final StockSubscriptionService subscriptionService;
    private final KisWebSocketClient kisWebSocketClient;
    private final MarketTimeService marketTimeService;

    // 국내 주식 - 정규장이면 KIS 웹소켓, 아니면 REST API 폴링
    @Scheduled(fixedDelay = 3000)
    public void sendDomesticStockPrices() {
        for (String symbol : subscriptionService.getDomesticSymbols()) {
            try {
                if (marketTimeService.isKoreanMarketOpen()) {
                    kisWebSocketClient.subscribe(symbol);
                } else {
                    StockPriceDto price = stockService.getDomesticStockPrice(symbol);
                    messagingTemplate.convertAndSend("/topic/domestic/" + symbol, price);
                }
                Thread.sleep(100);
            } catch (Exception e) {
                log.error("국내주식 처리 실패: {}", e.getMessage());
            }
        }
    }

    // 미국 주식 - 정규장이면 KIS 웹소켓, 아니면 REST API
    @Scheduled(fixedDelay = 3000, initialDelay = 2000)
    public void sendOverseasStockPrices() {
        for (String symbolWithExchange : subscriptionService.getOverseasSymbols()) {
            try {
                String[] parts = symbolWithExchange.split(",");
                String symbol = parts[0];
                String exchange = parts.length > 1 ? parts[1] : "NAS";
                if (marketTimeService.isUsMarketOpen()) {
                    kisWebSocketClient.subscribeOverseas(symbolWithExchange);
                } else {
                    StockPriceDto price = stockService.getOverseasStockPrice(symbol, exchange);
                    messagingTemplate.convertAndSend("/topic/overseas/" + symbol, price);
                }
                Thread.sleep(100);
            } catch (Exception e) {
                log.error("해외주식 조회 실패: {}", e.getMessage());
            }
        }
    }
}
