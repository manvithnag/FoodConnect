<?php
header('Content-Type: application/json; charset=utf-8');

session_start();
require_once __DIR__ . '/../db.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: Return available food listings and whether this organisation
    // has already requested each listing. This makes the button state persist
    // after refresh, logout, and login.
    if ($method === 'GET') {
        $requesterId = !empty($_SESSION['user_id'])
            && ($_SESSION['user_role'] ?? '') !== 'donor'
            ? (int) $_SESSION['user_id']
            : 0;

        $sql = "SELECT
                    fl.id,
                    fl.title,
                    fl.description,
                    fl.kind,
                    fl.qty,
                    fl.addr,
                    fl.collect_before,
                    fl.status,
                    u.name AS donor_name,
                    CASE
                        WHEN EXISTS (
                            SELECT 1
                            FROM food_requests fr
                            WHERE fr.food_id = fl.id
                              AND fr.requester_id = :requester_id
                              AND fr.status IN ('pending', 'approved', 'completed')
                        ) THEN 1
                        ELSE 0
                    END AS requested_by_me,
                    (
                        SELECT fr2.status
                        FROM food_requests fr2
                        WHERE fr2.food_id = fl.id
                          AND fr2.requester_id = :requester_id_status
                        ORDER BY fr2.created_at DESC, fr2.id DESC
                        LIMIT 1
                    ) AS my_request_status
                FROM food_listings fl
                INNER JOIN users u ON u.id = fl.donor_id
                WHERE fl.status = 'available'
                  AND fl.collect_before > NOW()
                ORDER BY fl.created_at DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':requester_id' => $requesterId,
            ':requester_id_status' => $requesterId,
        ]);
        $listings = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Return a real boolean for consistent JavaScript checks.
        foreach ($listings as &$listing) {
            $listing['requested_by_me'] = (bool) $listing['requested_by_me'];
        }
        unset($listing);

        echo json_encode([
            'success' => true,
            'listings' => $listings
        ]);
        exit;
    }

    // POST: Create a new food listing
    if ($method === 'POST') {
        // Only a logged-in donor can add food.
        if (
            empty($_SESSION['user_id']) ||
            ($_SESSION['user_role'] ?? '') !== 'donor'
        ) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Please log in as a donor to add a food listing.'
            ]);
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid JSON request.'
            ]);
            exit;
        }

        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $kind = trim($input['kind'] ?? '');
        $qty = trim($input['qty'] ?? '');
        $addr = trim($input['addr'] ?? '');
        $collectBefore = trim($input['collect_before'] ?? '');

        if ($title === '' || $qty === '' || $addr === '' || $collectBefore === '') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Title, quantity, address and collection deadline are required.'
            ]);
            exit;
        }

        if (strlen($title) > 150 || strlen($qty) > 100 || strlen($addr) > 255) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'One or more fields exceed the allowed length.'
            ]);
            exit;
        }

        $deadline = strtotime($collectBefore);

        if ($deadline === false || $deadline <= time()) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'The collection deadline must be a valid future date and time.'
            ]);
            exit;
        }

        $sql = "INSERT INTO food_listings
                    (donor_id, title, description, kind, qty, addr, collect_before)
                VALUES
                    (:donor_id, :title, :description, :kind, :qty, :addr, :collect_before)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':donor_id' => $_SESSION['user_id'],
            ':title' => $title,
            ':description' => $description,
            ':kind' => $kind !== '' ? $kind : null,
            ':qty' => $qty,
            ':addr' => $addr,
            ':collect_before' => date('Y-m-d H:i:s', $deadline)
        ]);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Food listing created successfully.',
            'listing_id' => (int) $pdo->lastInsertId()
        ]);
        exit;
    }

    // Other HTTP methods are not allowed.
    http_response_code(405);
    header('Allow: GET, POST');

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

} catch (PDOException $e) {
    error_log('Food listing API error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to process the food listing request.'
    ]);
}
