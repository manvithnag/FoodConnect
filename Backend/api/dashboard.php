
<?php
session_start();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'Please log in to view your dashboard.'
    ]);
    exit;
}

$userId = (int) $_SESSION['user_id'];

try {
    $userStmt = $pdo->prepare(
        'SELECT id, name, email, role
         FROM users
         WHERE id = :id
         LIMIT 1'
    );

    $userStmt->execute(['id' => $userId]);
    $user = $userStmt->fetch();

    if (!$user) {
        http_response_code(401);

        echo json_encode([
            'success' => false,
            'message' => 'User account not found.'
        ]);
        exit;
    }

    $listingStmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM food_listings
         WHERE donor_id = :id'
    );

    $listingStmt->execute(['id' => $userId]);
    $totalListings = (int) $listingStmt->fetchColumn();

    $activeStmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM food_listings
         WHERE donor_id = :id
           AND status = 'available'
           AND collect_before > NOW()"
    );

    $activeStmt->execute(['id' => $userId]);
    $activeListings = (int) $activeStmt->fetchColumn();

    $requestStmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM food_requests
         WHERE requester_id = :id
           AND status = 'completed'"
    );

    $requestStmt->execute(['id' => $userId]);
    $completedRequests = (int) $requestStmt->fetchColumn();
    $donorCategory = null;
    $donorStats = [];
    $donationHistory = [];

    if ($user['role'] === 'donor') {
        // Collect successful donations for all donors so the dashboard rank uses the Hall of Fame ordering.
        $rankingsStmt = $pdo->query(
            "SELECT u.id, u.name, fl.qty
             FROM users u
             INNER JOIN food_listings fl ON fl.donor_id = u.id
             WHERE u.role = 'donor'
               AND EXISTS (
                   SELECT 1
                   FROM food_requests fr
                   WHERE fr.food_id = fl.id
                     AND LOWER(fr.status) IN ('approved', 'completed')
               )
             ORDER BY u.id, fl.id"
        );

        $donors = [];
        foreach ($rankingsStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $donorId = (int) $row['id'];
            if (!isset($donors[$donorId])) {
                $donors[$donorId] = [
                    'id' => $donorId,
                    'name' => trim((string) $row['name']) ?: 'Community Donor',
                    'total_donations' => 0,
                    'meals_served' => 0
                ];
            }

            $donors[$donorId]['total_donations']++;
            if (preg_match('/^\s*(\d{1,3}(?:,\d{3})+|\d+)/', (string) $row['qty'], $matches)) {
                $donors[$donorId]['meals_served'] += (int) str_replace(',', '', $matches[1]);
            }
        }

        $rankedDonors = array_values($donors);
        usort($rankedDonors, static function ($a, $b) {
            if ($a['meals_served'] !== $b['meals_served']) {
                return $b['meals_served'] <=> $a['meals_served'];
            }
            if ($a['total_donations'] !== $b['total_donations']) {
                return $b['total_donations'] <=> $a['total_donations'];
            }
            $nameOrder = strcasecmp($a['name'], $b['name']);
            return $nameOrder !== 0 ? $nameOrder : ($a['id'] <=> $b['id']);
        });

        $donorRank = null;
        foreach ($rankedDonors as $index => $rankedDonor) {
            if ($rankedDonor['id'] === $userId) {
                $donorRank = $index + 1;
                $donorStats = $rankedDonor;
                break;
            }
        }

        $totalMeals = (int) ($donorStats['meals_served'] ?? 0);
        if ($totalMeals >= 3000) {
            $donorCategory = 'Platinum Champion';
        } elseif ($totalMeals >= 1000) {
            $donorCategory = 'Gold Giver';
        } elseif ($totalMeals >= 200) {
            $donorCategory = 'Silver Giver';
        } elseif ($donorStats) {
            $donorCategory = 'Bronze Giver';
        }

        $historyStmt = $pdo->prepare(
            "SELECT fl.title, fl.created_at, fl.status,
                    EXISTS (
                        SELECT 1
                        FROM food_requests fr
                        WHERE fr.food_id = fl.id
                          AND LOWER(fr.status) IN ('approved', 'completed')
                    ) AS donation_completed
             FROM food_listings fl
             WHERE fl.donor_id = :id
             ORDER BY fl.created_at DESC, fl.id DESC"
        );
        $historyStmt->execute(['id' => $userId]);
        $donationHistory = $historyStmt->fetchAll(PDO::FETCH_ASSOC);

        $donorStats = [
            'total_donations' => (int) ($donorStats['total_donations'] ?? 0),
            'donor_rank' => $donorRank
        ];
    }
    echo json_encode([
        'success' => true,
        'user' => $user,
        'donor_category' => $donorCategory,
        'donor_stats' => $donorStats,
        'donation_history' => $donationHistory,
        'stats' => [
            'total_listings' => $totalListings,
            'active_listings' => $activeListings,
            'completed_requests' => $completedRequests
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load dashboard.'
    ]);
}
