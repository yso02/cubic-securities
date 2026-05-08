package capstone.dto;

import lombok.Data;

@Data
public class TradeDto {
    private String symbol;      // 종목코드
    private String name;        // 종목명
    private String market;      // 시장
    private String type;        // BUY or SELL
    private Long quantity;   // 주문수량
    private Double price;       // 체결가
}