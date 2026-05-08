package capstone.controller;

import capstone.dto.WatchlistDto;
import capstone.service.WatchlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/watchlist")
public class WatchlistController {

    private final WatchlistService watchlistService;

    private Long getCurrentUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    @PostMapping
    public ResponseEntity<?> add(@RequestBody WatchlistDto dto) {
        try {
            return ResponseEntity.ok(watchlistService.add(getCurrentUserId(), dto));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{symbol}")
    public ResponseEntity<?> remove(@PathVariable String symbol) {
        try {
            return ResponseEntity.ok(watchlistService.remove(getCurrentUserId(), symbol));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> getList() {
        return ResponseEntity.ok(watchlistService.getList(getCurrentUserId()));
    }
}
