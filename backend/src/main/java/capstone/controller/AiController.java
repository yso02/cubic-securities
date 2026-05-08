package capstone.controller;

import capstone.domain.Holding;
import capstone.dto.AiChatRequestDto;
import capstone.dto.AiChatResponseDto;
import capstone.repository.HoldingRepository;
import capstone.service.AiService;
import capstone.service.StockService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final HoldingRepository holdingRepository;
    private final StockService stockService;

    @PostMapping("/chat")
    public ResponseEntity<AiChatResponseDto> chat(@RequestBody AiChatRequestDto request) {
        String reply = aiService.chat(request.getMessage(), request.getHistory());
        return ResponseEntity.ok(new AiChatResponseDto(reply));
    }

    @PostMapping("/analyze/holdings")
    public ResponseEntity<AiChatResponseDto> analyzeHoldings() {
        String holdingsText = buildHoldingsText();
        if (holdingsText == null) {
            return ResponseEntity.ok(new AiChatResponseDto("보유 종목이 없습니다. 먼저 주식을 매수해주세요."));
        }
        return ResponseEntity.ok(new AiChatResponseDto(aiService.analyzeHoldings(holdingsText)));
    }

    @PostMapping("/analyze/portfolio")
    public ResponseEntity<AiChatResponseDto> analyzePortfolio() {
        String holdingsText = buildHoldingsText();
        if (holdingsText == null) {
            return ResponseEntity.ok(new AiChatResponseDto("보유 종목이 없습니다. 먼저 주식을 매수해주세요."));
        }
        return ResponseEntity.ok(new AiChatResponseDto(aiService.analyzePortfolio(holdingsText)));
    }

    @PostMapping("/analyze/recommend")
    public ResponseEntity<AiChatResponseDto> recommendStocks() {
        String holdingsText = buildHoldingsText();
        if (holdingsText == null) {
            return ResponseEntity.ok(new AiChatResponseDto("보유 종목이 없습니다. 먼저 주식을 매수해주세요."));
        }
        return ResponseEntity.ok(new AiChatResponseDto(aiService.recommendStocks(holdingsText)));
    }

    private static final Set<String> OVERSEAS = Set.of("NASDAQ", "NYSE", "AMEX", "OTHER");

    private String buildHoldingsText() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<Holding> holdings = holdingRepository.findByUserId(userId);
        if (holdings.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (Holding h : holdings) {
            boolean isOverseas = OVERSEAS.contains(h.getMarket());
            double currentPrice;
            try {
                if (isOverseas) {
                    String exchange = switch (h.getMarket()) {
                        case "NYSE" -> "NYS";
                        case "AMEX" -> "AMS";
                        default -> "NAS";
                    };
                    currentPrice = Double.parseDouble(stockService.getOverseasStockPrice(h.getSymbol(), exchange).getPrice());
                } else {
                    currentPrice = Double.parseDouble(stockService.getDomesticStockPrice(h.getSymbol()).getPrice());
                }
            } catch (Exception e) {
                currentPrice = h.getAvgPrice();
            }
            double profitRate = (currentPrice - h.getAvgPrice()) / h.getAvgPrice() * 100;
            String profitStr = String.format("%+.2f%%", profitRate);
            if (isOverseas) {
                sb.append(String.format("%s(%s) | %s | 보유수량: %d주 | 평균매수가: $%.2f | 현재가: $%.2f | 수익률: %s%n",
                    h.getName(), h.getSymbol(), h.getMarket(), h.getQuantity(), h.getAvgPrice(), currentPrice, profitStr));
            } else {
                sb.append(String.format("%s(%s) | %s | 보유수량: %d주 | 평균매수가: %,.0f원 | 현재가: %,.0f원 | 수익률: %s%n",
                    h.getName(), h.getSymbol(), h.getMarket(), h.getQuantity(), h.getAvgPrice(), currentPrice, profitStr));
            }
        }
        return sb.toString();
    }
}
