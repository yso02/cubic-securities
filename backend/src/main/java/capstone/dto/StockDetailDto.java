package capstone.dto;

import lombok.Data;

@Data
public class StockDetailDto {
    private String symbol;        // 종목코드
    private String market;        // 시장

    // 현재가 정보
    private String price;         // 현재가
    private String change;        // 전일대비
    private String changePercent; // 등락률

    // 상세 정보
    private String marketCap;     // 시가총액
    private String per;           // PER
    private String eps;           // EPS
    private String pbr;           // PBR
    private String bps;           // BPS
    private String high52;        // 52주 최고
    private String low52;         // 52주 최저
    private String volume;        // 거래량
    private String tradingValue;  // 거래대금

    // 미국주식 전용 (FMP)
    private String beta;          // 베타
    private String lastDividend;  // 배당금
}
