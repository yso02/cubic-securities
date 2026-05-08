package capstone.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ProfitItemDto {
    private String symbol;
    private String name;
    private Double sellPrice;
    private Double avgPrice;
    private Long quantity;
    private Double profit;
    private LocalDateTime createdAt;
}
