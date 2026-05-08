package capstone.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class AiChatRequestDto {
    private String message;
    private List<Map<String, String>> history;
}
