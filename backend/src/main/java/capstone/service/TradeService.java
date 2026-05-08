package capstone.service;

import capstone.domain.Holding;
import capstone.domain.Order;
import capstone.domain.User;
import capstone.dto.ProfitDto;
import capstone.dto.ProfitItemDto;
import capstone.dto.TradeDto;
import capstone.repository.HoldingRepository;
import capstone.repository.OrderRepository;
import capstone.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TradeService {

    private static final Set<String> OVERSEAS_MARKETS = Set.of("NASDAQ", "NYSE", "AMEX", "OTHER");

    private final UserRepository userRepository;
    private final HoldingRepository holdingRepository;
    private final OrderRepository orderRepository;

    // 매수
    @Transactional
    public String buy(Long userId, TradeDto dto) {
        if (dto.getQuantity() < 1) throw new RuntimeException("수량은 1주 이상이어야 합니다.");

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));

        double totalPrice = dto.getPrice() * dto.getQuantity();
        boolean overseas = OVERSEAS_MARKETS.contains(dto.getMarket());

        if (overseas) {
            if (user.getDollarBalance() < totalPrice) {
                throw new RuntimeException("달러 잔고가 부족합니다.");
            }
            user.setDollarBalance(user.getDollarBalance() - totalPrice);
        } else {
            if (user.getBalance() < totalPrice) {
                throw new RuntimeException("잔고가 부족합니다.");
            }
            user.setBalance(user.getBalance() - totalPrice);
        }
        userRepository.save(user);

        // 보유종목 업데이트
        Optional<Holding> existingHolding = holdingRepository.findByUserAndSymbol(user, dto.getSymbol());
        if (existingHolding.isPresent()) {
            // 기존 보유 종목이면 평균단가 재계산
            Holding holding = existingHolding.get();
            Long newQuantity = holding.getQuantity() + dto.getQuantity();
            double newAvgPrice = ((holding.getAvgPrice() * holding.getQuantity()) + totalPrice) / newQuantity;
            holding.setQuantity(newQuantity);
            holding.setAvgPrice(newAvgPrice);
            holdingRepository.save(holding);
        } else {
            // 새로운 종목이면 새로 추가
            Holding holding = new Holding();
            holding.setUser(user);
            holding.setSymbol(dto.getSymbol());
            holding.setName(dto.getName());
            holding.setMarket(dto.getMarket());
            holding.setQuantity(dto.getQuantity());
            holding.setAvgPrice(dto.getPrice());
            holdingRepository.save(holding);
        }

        // 주문 내역 저장
        Order order = new Order();
        order.setUser(user);
        order.setSymbol(dto.getSymbol());
        order.setName(dto.getName());
        order.setType("BUY");
        order.setQuantity(dto.getQuantity());
        order.setPrice(dto.getPrice());
        orderRepository.save(order);

        return "매수 완료";
    }

    // 매도
    @Transactional
    public String sell(Long userId, TradeDto dto) {
        if (dto.getQuantity() < 1) throw new RuntimeException("수량은 1주 이상이어야 합니다.");

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));

        Holding holding = holdingRepository.findByUserAndSymbol(user, dto.getSymbol())
                .orElseThrow(() -> new RuntimeException("보유하지 않은 종목입니다."));

        // 보유수량 확인
        if (holding.getQuantity() < dto.getQuantity()) {
            throw new RuntimeException("보유 수량이 부족합니다.");
        }

        double totalPrice = dto.getPrice() * dto.getQuantity();
        boolean overseas = OVERSEAS_MARKETS.contains(dto.getMarket());

        if (overseas) {
            user.setDollarBalance(user.getDollarBalance() + totalPrice);
        } else {
            user.setBalance(user.getBalance() + totalPrice);
        }
        userRepository.save(user);

        // 보유종목 업데이트
        if (holding.getQuantity().equals(dto.getQuantity())) {
            // 전량 매도면 삭제
            holdingRepository.delete(holding);
        } else {
            // 일부 매도면 수량 감소
            holding.setQuantity(holding.getQuantity() - dto.getQuantity());
            holdingRepository.save(holding);
        }

        // 주문 내역 저장
        Order order = new Order();
        order.setUser(user);
        order.setSymbol(dto.getSymbol());
        order.setName(dto.getName());
        order.setType("SELL");
        order.setQuantity(dto.getQuantity());
        order.setPrice(dto.getPrice());
        order.setAvgPrice(holding.getAvgPrice());
        orderRepository.save(order);

        return "매도 완료";
    }

    // 보유 종목 조회
    public List<Holding> getHoldings(Long userId) {
        return holdingRepository.findByUserId(userId);
    }

    // 주문 내역 조회
    public List<Order> getOrders(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));
        return orderRepository.findByUserOrderByCreatedAtDesc(user);
    }

    // 잔고 조회
    public Double getBalance(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));
        return user.getBalance();
    }

    // 실현손익 조회
    public ProfitDto getProfitSummary(Long userId, String period) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));

        List<Order> orders;
        if ("ALL".equalsIgnoreCase(period)) {
            orders = orderRepository.findByUserAndTypeOrderByCreatedAtDesc(user, "SELL");
        } else {
            LocalDateTime after = switch (period.toUpperCase()) {
                case "DAY"   -> LocalDateTime.now().toLocalDate().atStartOfDay();
                case "WEEK"  -> LocalDateTime.now().minusDays(7);
                case "MONTH" -> LocalDateTime.now().minusDays(30);
                case "YEAR"  -> LocalDateTime.now().minusDays(365);
                default      -> LocalDateTime.now().toLocalDate().atStartOfDay();
            };
            orders = orderRepository.findByUserAndTypeAndCreatedAtAfterOrderByCreatedAtDesc(user, "SELL", after);
        }

        List<ProfitItemDto> profitList = orders.stream().map(o -> {
            ProfitItemDto item = new ProfitItemDto();
            item.setSymbol(o.getSymbol());
            item.setName(o.getName());
            item.setSellPrice(o.getPrice());
            item.setAvgPrice(o.getAvgPrice());
            item.setQuantity(o.getQuantity());
            item.setCreatedAt(o.getCreatedAt());
            double profit = (o.getAvgPrice() != null)
                    ? (o.getPrice() - o.getAvgPrice()) * o.getQuantity()
                    : 0.0;
            item.setProfit(profit);
            return item;
        }).collect(Collectors.toList());

        double totalProfit = profitList.stream().mapToDouble(ProfitItemDto::getProfit).sum();

        ProfitDto dto = new ProfitDto();
        dto.setPeriod(period.toUpperCase());
        dto.setTotalProfit(totalProfit);
        dto.setProfitList(profitList);
        return dto;
    }
}