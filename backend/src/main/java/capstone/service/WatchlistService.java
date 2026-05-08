package capstone.service;

import capstone.domain.User;
import capstone.domain.Watchlist;
import capstone.dto.WatchlistDto;
import capstone.repository.UserRepository;
import capstone.repository.WatchlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class WatchlistService {

    private final WatchlistRepository watchlistRepository;
    private final UserRepository userRepository;

    // 관심 종목 추가
    public String add(Long userId, WatchlistDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));

        if (watchlistRepository.existsByUserAndSymbol(user, dto.getSymbol())) {
            throw new RuntimeException("이미 관심 종목에 추가된 종목입니다.");
        }

        Watchlist watchlist = new Watchlist();
        watchlist.setUser(user);
        watchlist.setSymbol(dto.getSymbol());
        watchlist.setName(dto.getName());
        watchlist.setMarket(dto.getMarket());
        watchlistRepository.save(watchlist);

        return "관심 종목 추가 완료";
    }

    // 관심 종목 삭제
    public String remove(Long userId, String symbol) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));

        Watchlist watchlist = watchlistRepository.findByUserAndSymbol(user, symbol)
                .orElseThrow(() -> new RuntimeException("관심 종목에 없는 종목입니다."));

        watchlistRepository.delete(watchlist);
        return "관심 종목 삭제 완료";
    }

    // 관심 종목 조회
    public List<Watchlist> getList(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));
        return watchlistRepository.findByUser(user);
    }
}