package capstone.repository;

import capstone.domain.Order;
import capstone.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserOrderByCreatedAtDesc(User user);
    List<Order> findByUserAndTypeAndCreatedAtAfterOrderByCreatedAtDesc(User user, String type, LocalDateTime after);
    List<Order> findByUserAndTypeOrderByCreatedAtDesc(User user, String type);
}