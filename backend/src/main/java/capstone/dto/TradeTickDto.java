package capstone.dto;

import lombok.Data;

@Data
public class TradeTickDto {
    private String symbol;
    private String price;
    private String quantity;
    private String side;
    private String time;
}
