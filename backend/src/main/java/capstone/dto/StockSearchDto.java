package capstone.dto;

import lombok.Data;

@Data
public class StockSearchDto {
    private String symbol;      // 종목 코드
    private String name;        // 종목명
    private String market;      // 시장 (KOSPI, KOSDAQ 등)
}