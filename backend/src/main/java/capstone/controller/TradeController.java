package capstone.controller;

import capstone.dto.TradeDto;
import capstone.service.TradeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/trade")
public class TradeController {

    private final TradeService tradeService;

    private Long getCurrentUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    @PostMapping("/buy")
    public ResponseEntity<?> buy(@RequestBody TradeDto dto) {
        try {
            return ResponseEntity.ok(tradeService.buy(getCurrentUserId(), dto));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/sell")
    public ResponseEntity<?> sell(@RequestBody TradeDto dto) {
        try {
            return ResponseEntity.ok(tradeService.sell(getCurrentUserId(), dto));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/holdings")
    public ResponseEntity<?> getHoldings() {
        return ResponseEntity.ok(tradeService.getHoldings(getCurrentUserId()));
    }

    @GetMapping("/orders")
    public ResponseEntity<?> getOrders() {
        return ResponseEntity.ok(tradeService.getOrders(getCurrentUserId()));
    }

    @GetMapping("/balance")
    public ResponseEntity<?> getBalance() {
        return ResponseEntity.ok(tradeService.getBalance(getCurrentUserId()));
    }

    @GetMapping("/profit")
    public ResponseEntity<?> getProfit(@RequestParam(defaultValue = "ALL") String period) {
        return ResponseEntity.ok(tradeService.getProfitSummary(getCurrentUserId(), period));
    }
}
