package capstone.repository;

import capstone.domain.User;
import capstone.domain.Watchlist;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface WatchlistRepository extends JpaRepository<Watchlist, Long> {
    List<Watchlist> findByUser(User user);
    Optional<Watchlist> findByUserAndSymbol(User user, String symbol);
    boolean existsByUserAndSymbol(User user, String symbol);
}