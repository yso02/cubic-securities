package capstone.controller;

import capstone.dto.OrderBookDto;
import capstone.dto.StockDetailDto;
import capstone.dto.StockPriceDto;
import capstone.dto.StockSearchDto;
import capstone.service.StockSearchService;
import capstone.service.StockService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import capstone.dto.ChartDataDto;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/stocks")
public class StockController {

    private final StockService stockService;
    private final StockSearchService stockSearchService;

    // 국내 주식
    @GetMapping("/domestic/{symbol}")
    public StockPriceDto getDomesticStock(@PathVariable String symbol) {
        return stockService.getDomesticStockPrice(symbol);
    }

    // 미국 주식
    @GetMapping("/overseas/{symbol}")
    public StockPriceDto getOverseasStock(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "NAS") String exchange) {
        return stockService.getOverseasStockPrice(symbol, exchange);
    }

    // 국내 주식 종목 검색
    @GetMapping("/search/domestic")
    public List<StockSearchDto> searchDomesticStock(@RequestParam String keyword) {
        return stockService.searchDomesticStock(keyword);
    }

    // 종목 검색
    @GetMapping("/search")
    public List<StockSearchDto> searchStock(@RequestParam String keyword) {
        return stockSearchService.search(keyword);
    }

    // 국내 주식 차트 데이터
    @GetMapping("/chart/domestic/{symbol}")
    public List<ChartDataDto> getDomesticChart(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "D") String period) {
        return stockService.getDomesticChartData(symbol, period);
    }

    // 미국 주식 차트 데이터
    @GetMapping("/chart/overseas/{symbol}")
    public List<ChartDataDto> getOverseasChart(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "NAS") String exchange,
            @RequestParam(defaultValue = "0") String period) {
        return stockService.getOverseasChartData(symbol, exchange, period);
    }

    // 국내 주식 분봉
    @GetMapping("/chart/domestic/{symbol}/minute")
    public List<ChartDataDto> getDomesticMinuteChart(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "1") String timeUnit) {
        return stockService.getDomesticMinuteData(symbol, timeUnit);
    }

    // 미국 주식 분봉
    @GetMapping("/chart/overseas/{symbol}/minute")
    public List<ChartDataDto> getOverseasMinuteChart(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "NAS") String exchange,
            @RequestParam(defaultValue = "1") String timeUnit) {
        return stockService.getOverseasMinuteData(symbol, exchange, timeUnit);
    }

    // 국내 주식 상세정보
    @GetMapping("/detail/domestic/{symbol}")
    public StockDetailDto getDomesticStockDetail(@PathVariable String symbol) {
        return stockService.getDomesticStockDetail(symbol);
    }

    // 미국 주식 상세정보
    @GetMapping("/detail/overseas/{symbol}")
    public StockDetailDto getOverseasStockDetail(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "NAS") String exchange) {
        return stockService.getOverseasStockDetail(symbol, exchange);
    }

    // 미국 주식 연봉
    @GetMapping("/chart/overseas/{symbol}/yearly")
    public List<ChartDataDto> getOverseasYearlyChart(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "NAS") String exchange) {
        return stockService.getOverseasYearlyData(symbol, exchange);
    }

    // 국내주식 호가 조회
    @GetMapping("/orderbook/domestic/{symbol}")
    public OrderBookDto getDomesticOrderBook(@PathVariable String symbol) {
        return stockService.getDomesticOrderBook(symbol);
    }

}
