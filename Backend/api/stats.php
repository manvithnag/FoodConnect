<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

try {
    // Keep meals and completed donations at zero for now.
    $meals = 0;
    $donations = 0;

    // Count registered donor accounts.
    $donors = (int) $pdo->query(
        "SELECT COUNT(*) FROM users WHERE role = 'donor'"
    )->fetchColumn();

    // Count registered organisation accounts.
    $organisations = (int) $pdo->query(
        "SELECT COUNT(*) FROM users WHERE role = 'organisation'"
    )->fetchColumn();

    echo json_encode([
        'success' => true,
        'stats' => [
            'total_meals' => $meals,
            'total_donations' => $donations,
            'total_donors' => $donors,
            'total_organisations' => $organisations
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load statistics.'
    ]);
}
