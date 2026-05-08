package capstone.dto;

import lombok.Data;

@Data
public class StockPriceDto {
    private String symbol;      // 종목 코드 (예: AAPL)
    private String price;       // 현재가
    private String change;      // 변동가
    private String changePercent; // 변동률
}