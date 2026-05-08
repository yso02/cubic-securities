package capstone.dto;

import lombok.Data;

@Data
public class ChartDataDto {
    private String date;    // 날짜
    private String open;    // 시가
    private String high;    // 고가
    private String low;     // 저가
    private String close;   // 종가
    private String volume;  // 거래량
}