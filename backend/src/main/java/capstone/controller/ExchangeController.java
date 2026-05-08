package capstone.controller;

import capstone.domain.User;
import capstone.dto.ExchangeRequestDto;
import capstone.repository.UserRepository;
import capstone.service.ExchangeRateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/exchange")
public class ExchangeController {

    private final ExchangeRateService exchangeRateService;
    private final UserRepository userRepository;

    private Long getCurrentUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    private User getUser() {
        return userRepository.findById(getCurrentUserId())
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));
    }

    @GetMapping("/rate")
    public ResponseEntity<?> getRate() {
        return ResponseEntity.ok(Map.of("rate", exchangeRateService.getCurrentRate()));
    }

    @PostMapping("/krw-to-usd")
    @Transactional
    public ResponseEntity<?> krwToUsd(@RequestBody ExchangeRequestDto dto) {
        double krwAmount = dto.getAmount();
        double rate = exchangeRateService.getCurrentRate();
        User user = getUser();

        if (user.getBalance() < krwAmount) {
            return ResponseEntity.badRequest().body("원화 잔고가 부족합니다.");
        }

        double usdAmount = krwAmount / rate;
        user.setBalance(user.getBalance() - krwAmount);
        user.setDollarBalance(user.getDollarBalance() + usdAmount);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "balance", user.getBalance(),
                "dollarBalance", user.getDollarBalance(),
                "exchanged", usdAmount,
                "rate", rate
        ));
    }

    @PostMapping("/usd-to-krw")
    @Transactional
    public ResponseEntity<?> usdToKrw(@RequestBody ExchangeRequestDto dto) {
        double usdAmount = dto.getAmount();
        double rate = exchangeRateService.getCurrentRate();
        User user = getUser();

        if (user.getDollarBalance() < usdAmount) {
            return ResponseEntity.badRequest().body("달러 잔고가 부족합니다.");
        }

        double krwAmount = usdAmount * rate;
        user.setDollarBalance(user.getDollarBalance() - usdAmount);
        user.setBalance(user.getBalance() + krwAmount);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "balance", user.getBalance(),
                "dollarBalance", user.getDollarBalance(),
                "exchanged", krwAmount,
                "rate", rate
        ));
    }
}
