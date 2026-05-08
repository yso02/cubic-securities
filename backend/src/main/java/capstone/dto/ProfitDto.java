package capstone.dto;

import lombok.Data;
import java.util.List;

@Data
public class ProfitDto {
    private String period;
    private Double totalProfit;
    private List<ProfitItemDto> profitList;
}
