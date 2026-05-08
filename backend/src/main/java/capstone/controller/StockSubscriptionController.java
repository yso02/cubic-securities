package capstone.controller;

import capstone.service.StockSubscriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class StockSubscriptionController {

    private final StockSubscriptionService subscriptionService;

    // 국내 주식 구독
    @MessageMapping("/subscribe/domestic")
    public void subscribeDomestic(@Payload String symbol) {
        subscriptionService.subscribeDomesticOnly(symbol);  // 변경
    }

    // 국내 주식 구독 취소
    @MessageMapping("/unsubscribe/domestic")
    public void unsubscribeDomestic(@Payload String symbol) {
        subscriptionService.unsubscribeDomestic(symbol);
    }

    // 미국 주식 구독
    @MessageMapping("/subscribe/overseas")
    public void subscribeOverseas(@Payload String symbol) {
        subscriptionService.subscribeOverseasOnly(symbol);  // 변경
    }

    // 미국 주식 구독 취소
    @MessageMapping("/unsubscribe/overseas")
    public void unsubscribeOverseas(@Payload String symbol) {
        subscriptionService.unsubscribeOverseas(symbol);
    }
}
