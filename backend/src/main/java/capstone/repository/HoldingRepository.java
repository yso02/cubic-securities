package capstone.repository;

import capstone.domain.Holding;
import capstone.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface HoldingRepository extends JpaRepository<Holding, Long> {
    List<Holding> findByUser(User user);
    List<Holding> findByUserId(Long userId);
    Optional<Holding> findByUserAndSymbol(User user, String symbol);
}