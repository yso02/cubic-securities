package capstone.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnoreProperties({"password", "balance", "email"})
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private String symbol;           // 종목코드
    private String name;             // 종목명
    private String type;             // BUY or SELL
    private Long quantity;           // 주문수량
    private Double price;            // 체결가
    private Double avgPrice;         // 매도 시 평균매수가 (SELL 전용)
    private LocalDateTime createdAt; // 주문시간

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }
}