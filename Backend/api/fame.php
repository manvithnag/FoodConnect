<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

try {
    // Match the donor dashboard: approved or completed requests count as served.
    // EXISTS keeps each listing from being counted more than once if it has
    // multiple qualifying requests.
    $stmt = $pdo->query(
        "SELECT u.id, u.name, fl.id AS listing_id, fl.qty
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

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $id = (int) $row['id'];

        if (!isset($donors[$id])) {
            $donors[$id] = [
                'id' => $id,
                'name' => trim((string) $row['name']) ?: 'Community Donor',
                'completed_donations' => 0,
                'meals_served' => 0,
                'meals_recorded' => false
            ];
        }

        $donors[$id]['completed_donations']++;
        $quantity = trim((string) ($row['qty'] ?? ''));

        // Quantity is stored as text (for example, "25 meals"). Count a
        // serving total only when the entry starts with a numeric quantity.
        if (preg_match('/^\s*(\d{1,3}(?:,\d{3})+|\d+)/', $quantity, $matches)) {
            $servings = (int) str_replace(',', '', $matches[1]);

            if ($servings > 0) {
                $donors[$id]['meals_served'] += $servings;
                $donors[$id]['meals_recorded'] = true;
            }
        }
    }

    $contributors = array_values($donors);

    foreach ($contributors as &$donor) {
        if ($donor['meals_served'] >= 3000) {
            $donor['category'] = 'Platinum Champion';
            $donor['category_key'] = 'platinum';
        } elseif ($donor['meals_served'] >= 1000) {
            $donor['category'] = 'Gold Giver';
            $donor['category_key'] = 'gold';
        } elseif ($donor['meals_served'] >= 200) {
            $donor['category'] = 'Silver Giver';
            $donor['category_key'] = 'silver';
        } else {
            $donor['category'] = 'Bronze Giver';
            $donor['category_key'] = 'bronze';
        }
    }
    unset($donor);

    usort($contributors, static function ($a, $b) {
        if ($a['meals_served'] !== $b['meals_served']) {
            return $b['meals_served'] <=> $a['meals_served'];
        }

        if ($a['completed_donations'] !== $b['completed_donations']) {
            return $b['completed_donations'] <=> $a['completed_donations'];
        }

        $nameOrder = strcasecmp($a['name'], $b['name']);
        return $nameOrder !== 0 ? $nameOrder : ($a['id'] <=> $b['id']);
    });

    foreach ($contributors as $index => &$donor) {
        $donor['rank'] = $index + 1;
        unset($donor['id']);
    }
    unset($donor);

    echo json_encode([
        'success' => true,
        'contributors' => $contributors
    ]);
} catch (PDOException $e) {
    error_log('FoodConnect Hall of Fame query failed: ' . $e->getMessage());
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load donor rankings.'
    ]);
}
