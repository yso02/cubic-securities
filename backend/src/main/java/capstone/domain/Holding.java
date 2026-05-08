package capstone.domain;

import jakarta.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Data
public class Holding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;


    @JsonIgnoreProperties({"password", "balance", "email"})
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private String symbol;      // 종목코드
    private String name;        // 종목명
    private String market;      // 시장
    private Long quantity;   // 보유수량
    private Double avgPrice;    // 평균매수가
}