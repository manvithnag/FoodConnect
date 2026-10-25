<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please log in to view your dashboard.']);
    exit;
}

$userId = (int) $_SESSION['user_id'];

try {
    $userStmt = $pdo->prepare('SELECT id, name, email, role FROM users WHERE id = :id LIMIT 1');
    $userStmt->execute(['id' => $userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'User account not found.']);
        exit;
    }

    $payload = ['success' => true, 'user' => $user];

    if ($user['role'] === 'donor') {
        // One row per food listing for the donor's complete donation history.
        // Any donor-approved request counts as Completed for the donor's requested dashboard definition.
        $donationsStmt = $pdo->prepare("
            SELECT
                fl.id,
                fl.title,
                fl.kind,
                fl.qty,
                fl.addr,
                fl.collect_before,
                fl.created_at,
                fl.status AS listing_status,
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM food_requests fr_done
                        WHERE fr_done.food_id = fl.id
                          AND fr_done.status IN ('approved', 'completed')
                    ) THEN 'completed'
                    WHEN EXISTS (
                        SELECT 1 FROM food_requests fr_pending
                        WHERE fr_pending.food_id = fl.id
                          AND fr_pending.status = 'pending'
                    ) THEN 'awaiting confirmation'
                    WHEN EXISTS (
                        SELECT 1 FROM food_requests fr_rejected
                        WHERE fr_rejected.food_id = fl.id
                          AND fr_rejected.status = 'rejected'
                    ) THEN 'rejected'
                    WHEN fl.status = 'expired' THEN 'expired'
                    ELSE 'pending'
                END AS display_status
            FROM food_listings fl
            WHERE fl.donor_id = :donor_id
            ORDER BY fl.created_at DESC, fl.id DESC
        ");
        $donationsStmt->execute(['donor_id' => $userId]);
        $donations = $donationsStmt->fetchAll(PDO::FETCH_ASSOC);

        // Total and rank are based on donor-approved requests, not merely created listings.
        $countStmt = $pdo->prepare("
            SELECT COUNT(DISTINCT fl.id)
            FROM food_listings fl
            INNER JOIN food_requests fr ON fr.food_id = fl.id
            WHERE fl.donor_id = :donor_id
              AND fr.status IN ('approved', 'completed')
        ");
        $countStmt->execute(['donor_id' => $userId]);
        $totalDonations = (int) $countStmt->fetchColumn();

        $rankStmt = $pdo->prepare("
            SELECT 1 + COUNT(*) AS donor_rank
            FROM (
                SELECT fl2.donor_id, COUNT(DISTINCT fl2.id) AS total
                FROM food_listings fl2
                INNER JOIN food_requests fr2 ON fr2.food_id = fl2.id
                WHERE fr2.status IN ('approved', 'completed')
                GROUP BY fl2.donor_id
            ) other_donors
            WHERE other_donors.total > (
                SELECT COUNT(DISTINCT fl3.id)
                FROM food_listings fl3
                INNER JOIN food_requests fr3 ON fr3.food_id = fl3.id
                WHERE fl3.donor_id = :donor_id
                  AND fr3.status IN ('approved', 'completed')
            )
        ");
        $rankStmt->execute(['donor_id' => $userId]);
        $rank = $totalDonations > 0 ? (int) $rankStmt->fetchColumn() : null;

        // All pending requests belonging to this donor, with request and food IDs.
        $incomingStmt = $pdo->prepare("
            SELECT
                fr.id AS request_id,
                fr.food_id AS listing_id,
                fr.food_id,
                fr.status AS request_status,
                fr.status,
                fr.created_at AS requested_at,
                fl.title AS food_name,
                fl.title,
                fl.qty,
                fl.kind,
                u.name AS organisation_name,
                u.name AS requester_name
            FROM food_requests fr
            INNER JOIN food_listings fl ON fl.id = fr.food_id
            INNER JOIN users u ON u.id = fr.requester_id
            WHERE fl.donor_id = :donor_id
              AND fr.status = 'pending'
            ORDER BY fr.created_at ASC, fr.id ASC
        ");
        $incomingStmt->execute(['donor_id' => $userId]);
        $incoming = $incomingStmt->fetchAll(PDO::FETCH_ASSOC);

        $payload['donations'] = $donations;
        $payload['incoming_requests'] = $incoming;
        $payload['stats'] = [
            'total_donations' => $totalDonations,
            'donor_rank' => $rank
        ];
    } elseif ($user['role'] === 'organisation') {
        $orgStmt = $pdo->prepare("
            SELECT
                fr.id AS request_id,
                fr.food_id AS listing_id,
                fr.status,
                fr.created_at AS requested_at,
                fr.updated_at,
                fl.title AS food_name,
                fl.qty,
                fl.kind,
                fl.addr,
                fl.collect_before,
                du.name AS donor_name
            FROM food_requests fr
            INNER JOIN food_listings fl ON fl.id = fr.food_id
            INNER JOIN users du ON du.id = fl.donor_id
            WHERE fr.requester_id = :requester_id
            ORDER BY fr.created_at DESC, fr.id DESC
        ");
        $orgStmt->execute(['requester_id' => $userId]);
        $payload['organisation_requests'] = $orgStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load dashboard data.']);
}
