package capstone.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AiService {

    private final WebClient webClient;

    @Value("${claude.api.key}")
    private String apiKey;

    @Value("${claude.api.url}")
    private String apiUrl;

    private static final String SYSTEM_PROMPT =
            "당신은 주식 투자 전문 AI 어시스턴트입니다. 사용자의 투자 관련 질문에 친절하고 전문적으로 답변해주세요. " +
            "단, 모든 분석과 추천은 어디까지나 참고용이며 최종 투자 결정은 반드시 사용자 본인이 해야 한다는 점을 " +
            "항상 명심하고 강요나 단정적 표현은 피해주세요.";

    public String analyzeHoldings(String holdingsJson) {
        return callClaude(
            "당신은 주식 투자 전문 AI 어시스턴트입니다. 사용자의 보유 종목을 분석해주세요. 각 종목별로 현재 평단가 위치, 단기/장기 전망, 주요 지표 해석을 제공해주세요. 모든 분석은 참고용이며 투자 결정은 반드시 사용자 본인이 해야 합니다. 강요나 단정적 표현은 피해주세요. 모든 분석 마지막에 \"※ 위 내용은 참고용이며 최종 투자 결정은 본인의 판단으로 하시기 바랍니다.\" 문구를 포함해주세요.",
            "다음은 내 보유 종목 현황입니다. 각 종목을 분석해주세요:\n" + holdingsJson
        );
    }

    public String analyzePortfolio(String holdingsJson) {
        return callClaude(
            "당신은 주식 투자 전문 AI 어시스턴트입니다. 사용자의 포트폴리오 전체를 분석해주세요. 섹터 편중도, 리스크 수준, 투자 성향, 개선 방향을 제시해주세요. 모든 분석은 참고용이며 투자 결정은 반드시 사용자 본인이 해야 합니다. 강요나 단정적 표현은 피해주세요. 모든 분석 마지막에 \"※ 위 내용은 참고용이며 최종 투자 결정은 본인의 판단으로 하시기 바랍니다.\" 문구를 포함해주세요.",
            "다음은 내 포트폴리오 현황입니다. 전체적으로 분석해주세요:\n" + holdingsJson
        );
    }

    public String recommendStocks(String holdingsJson) {
        return callClaude(
            "당신은 주식 투자 전문 AI 어시스턴트입니다. 사용자의 현재 포트폴리오를 참고하여 추가로 관심 가질만한 섹터나 종목을 추천해주세요. 현재 보유 종목과의 연관성, 분산투자 관점에서 추천 이유를 설명해주세요. 모든 추천은 참고용이며 투자 결정은 반드시 사용자 본인이 해야 합니다. 강요나 단정적 표현은 피해주세요. 모든 분석 마지막에 \"※ 위 내용은 참고용이며 최종 투자 결정은 본인의 판단으로 하시기 바랍니다.\" 문구를 포함해주세요.",
            "다음은 내 현재 포트폴리오입니다. 추가로 관심 가질만한 섹터나 종목을 추천해주세요:\n" + holdingsJson
        );
    }

    private String callClaude(String systemPrompt, String userMessage) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", "claude-haiku-4-5-20251001");
        requestBody.put("max_tokens", 2048);
        requestBody.put("system", systemPrompt);
        requestBody.put("messages", List.of(Map.of("role", "user", "content", userMessage)));

        try {
            Map<?, ?> response = webClient.post()
                    .uri(apiUrl + "/v1/messages")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
            return (String) content.get(0).get("text");
        } catch (Exception e) {
            return "AI 응답 중 오류가 발생했습니다: " + e.getMessage();
        }
    }

    public String chat(String userMessage, List<Map<String, String>> history) {
        List<Map<String, String>> messages = new ArrayList<>();
        if (history != null) {
            messages.addAll(history);
        }
        Map<String, String> userMsg = new HashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", userMessage);
        messages.add(userMsg);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", "claude-haiku-4-5-20251001");
        requestBody.put("max_tokens", 1024);
        requestBody.put("system", SYSTEM_PROMPT);
        requestBody.put("messages", messages);

        try {
            Map<?, ?> response = webClient.post()
                    .uri(apiUrl + "/v1/messages")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
            return (String) content.get(0).get("text");
        } catch (Exception e) {
            return "AI 응답 중 오류가 발생했습니다: " + e.getMessage();
        }
    }
}
