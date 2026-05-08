package capstone.service;

import capstone.dto.StockSearchDto;
import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class StockSearchService {

    private final List<StockSearchDto> stockList = new ArrayList<>();

    @PostConstruct
    public void loadStockData() {
        loadCsv("stocks.csv", "주식");
        loadCsv("etf.csv", "ETF");
        loadUsStocks();
    }

    private void loadCsv(String filename, String type) {
        try (CSVReader reader = new CSVReaderBuilder(
                new InputStreamReader(
                        Objects.requireNonNull(
                                getClass().getClassLoader().getResourceAsStream(filename)),
                        StandardCharsets.UTF_8))
                .withSkipLines(1)
                .build()) {

            String[] line;
            while ((line = reader.readNext()) != null) {
                if (line.length < 2) continue;

                StockSearchDto dto = new StockSearchDto();

                if (type.equals("ETF")) {
                    dto.setSymbol(line[0].trim());
                    dto.setName(line[1].trim());
                    dto.setMarket("ETF");
                } else {
                    dto.setSymbol(line[1].trim());
                    dto.setName(line[3].trim());
                    String market = line[6].trim();
                    if (market.equals("KOSDAQ GLOBAL")) market = "KOSDAQ";
                    dto.setMarket(market);
                }

                stockList.add(dto);
            }

            System.out.println(type + " 데이터 로드 완료: " + stockList.size() + "개");

        } catch (Exception e) {
            System.err.println(type + " 데이터 로드 실패: " + e.getMessage());
        }
    }

    private void loadUsStocks() {
        loadUsStockFile("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt", "NAS");
        loadUsStockFile("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt", "OTHER");
    }

    private void loadUsStockFile(String url, String type) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String content = restTemplate.getForObject(url, String.class);

            if (content == null) return;

            String[] lines = content.split("\n");
            boolean isFirst = true;

            for (String line : lines) {
                if (isFirst) {
                    isFirst = false;
                    continue;
                }

                String[] parts = line.split("\\|");
                if (parts.length < 2) continue;

                String symbol = parts[0].trim();
                String name = parts[1].trim();

                if (symbol.startsWith("File Creation Time")) continue;
                if (parts.length > 3 && parts[3].trim().equals("Y")) continue;

                StockSearchDto dto = new StockSearchDto();
                dto.setSymbol(symbol);
                dto.setName(cleanName(name));

                if (type.equals("NAS")) {
                    dto.setMarket("NASDAQ");
                } else {
                    if (parts.length > 3) {
                        String exchange = parts[3].trim();
                        if (exchange.equals("A")) dto.setMarket("AMEX");
                        else if (exchange.equals("N")) dto.setMarket("NYSE");
                        else dto.setMarket("OTHER");
                    }
                }

                stockList.add(dto);
            }

            System.out.println(type + " 미국주식 데이터 로드 완료");

        } catch (Exception e) {
            System.err.println("미국주식 데이터 로드 실패: " + e.getMessage());
        }
    }

    private String cleanName(String name) {
        int dashIdx = name.indexOf(" - ");
        if (dashIdx >= 0) name = name.substring(0, dashIdx);
        name = name.replaceAll(", Inc\\.?", "")
                   .replaceAll(" Inc\\.?", "")
                   .replaceAll(" Corporation", "")
                   .replaceAll(" Corp\\.?", "")
                   .replaceAll(" Limited", "")
                   .replaceAll(" Ltd\\.?", "")
                   .replaceAll(" Co\\.?", "");
        return name.trim();
    }

    public List<StockSearchDto> search(String keyword) {
        String upper = keyword.toUpperCase();
        return stockList.stream()
                .filter(stock ->
                        stock.getName().toUpperCase().contains(upper) ||
                                stock.getSymbol().toUpperCase().contains(upper))
                .limit(20)
                .collect(Collectors.toList());
    }
}