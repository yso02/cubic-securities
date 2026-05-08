package capstone.dto;

import lombok.Data;
import java.util.List;

@Data
public class OrderBookDto {
    private String symbol;
    private List<OrderBookEntry> asks;
    private List<OrderBookEntry> bids;
    private String totalAskQty;
    private String totalBidQty;

    @Data
    public static class OrderBookEntry {
        private String price;
        private String quantity;
    }
}
