package capstone.service;

import org.springframework.stereotype.Service;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class StockSubscriptionService {

    // 구독 중인 국내 종목 목록
    private final Set<String> domesticSymbols = ConcurrentHashMap.newKeySet();

    // 구독 중인 해외 종목 목록
    private final Set<String> overseasSymbols = ConcurrentHashMap.newKeySet();

    public void subscribeDomestic(String symbol) {
        domesticSymbols.add(symbol);
    }

    public void unsubscribeDomestic(String symbol) {
        domesticSymbols.remove(symbol);
    }

    public void subscribeOverseas(String symbol) {
        overseasSymbols.add(symbol);
    }

    public void unsubscribeOverseas(String symbol) {
        overseasSymbols.remove(symbol);
    }

    public Set<String> getDomesticSymbols() {
        return domesticSymbols;
    }

    public Set<String> getOverseasSymbols() {
        return overseasSymbols;
    }

    // 기존 구독 전부 취소하고 새로 구독
    public void subscribeOverseasOnly(String symbolWithExchange) {
        overseasSymbols.clear();
        overseasSymbols.add(symbolWithExchange);
    }

    public void subscribeDomesticOnly(String symbol) {
        domesticSymbols.clear();
        domesticSymbols.add(symbol);
    }
}