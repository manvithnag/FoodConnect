<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../db.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); header('Allow: POST'); echo json_encode(['success'=>false,'message'=>'Only POST requests are allowed.']); exit; }
if (empty($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['success'=>false,'message'=>'Please log in first.']); exit; }
$data = json_decode(file_get_contents('php://input'), true); if (!is_array($data)) $data = [];
$userId = (int) $_SESSION['user_id']; $action = strtolower(trim((string)($data['action'] ?? '')));

if ($action !== '') {
    if (($_SESSION['user_role'] ?? '') !== 'donor') { http_response_code(403); echo json_encode(['success'=>false,'message'=>'Only the donor can confirm or reject a request.']); exit; }
    $requestId = filter_var($data['request_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$requestId || $requestId < 1 || !in_array($action, ['confirm','reject'], true)) { http_response_code(422); echo json_encode(['success'=>false,'message'=>'A valid request ID and action are required.']); exit; }
    try {
        $pdo->beginTransaction();
        // Lock the listing first so two simultaneous confirmations cannot both win.
        $findListing = $pdo->prepare("SELECT fl.id, fl.status FROM food_listings fl INNER JOIN food_requests fr ON fr.food_id = fl.id WHERE fr.id = :request_id AND fl.donor_id = :donor_id LIMIT 1 FOR UPDATE");
        $findListing->execute(['request_id'=>$requestId,'donor_id'=>$userId]); $listing = $findListing->fetch(PDO::FETCH_ASSOC);
        if (!$listing) { $pdo->rollBack(); http_response_code(404); echo json_encode(['success'=>false,'message'=>'Request not found for your donations.']); exit; }
        $findRequest = $pdo->prepare("SELECT id, food_id, status FROM food_requests WHERE id = :id LIMIT 1 FOR UPDATE");
        $findRequest->execute(['id'=>$requestId]); $request = $findRequest->fetch(PDO::FETCH_ASSOC);
        if (!$request || $request['status'] !== 'pending') { $pdo->rollBack(); http_response_code(409); echo json_encode(['success'=>false,'message'=>'This request has already been handled.']); exit; }

        if ($action === 'confirm') {
            if ($listing['status'] !== 'available') { $pdo->rollBack(); http_response_code(409); echo json_encode(['success'=>false,'message'=>'This food listing is no longer available to confirm.']); exit; }
            $update = $pdo->prepare("UPDATE food_requests SET status = 'approved' WHERE id = :id AND status = 'pending'"); $update->execute(['id'=>$requestId]);
            if ($update->rowCount() !== 1) throw new RuntimeException('Request changed; please refresh and try again.');
            $listingUpdate = $pdo->prepare("UPDATE food_listings SET status = 'requested' WHERE id = :id AND status = 'available'"); $listingUpdate->execute(['id'=>$request['food_id']]);
            if ($listingUpdate->rowCount() !== 1) throw new RuntimeException('Listing is no longer available.');
            $rejectOthers = $pdo->prepare("UPDATE food_requests SET status = 'rejected' WHERE food_id = :food_id AND id <> :request_id AND status = 'pending'");
            $rejectOthers->execute(['food_id'=>$request['food_id'],'request_id'=>$requestId]);
            $pdo->commit(); echo json_encode(['success'=>true,'message'=>'Donation confirmed. Other pending requests for this food were automatically rejected.']); exit;
        }
        $reject = $pdo->prepare("UPDATE food_requests SET status = 'rejected' WHERE id = :id AND status = 'pending'"); $reject->execute(['id'=>$requestId]);
        $pdo->commit(); echo json_encode(['success'=>true,'message'=>'Food request rejected.']); exit;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack(); http_response_code(500); echo json_encode(['success'=>false,'message'=>'Unable to update this request. Please try again.']); exit;
    }
}

if (($_SESSION['user_role'] ?? '') !== 'organisation') { http_response_code(403); echo json_encode(['success'=>false,'message'=>'Only registered organisations can request food.']); exit; }
$foodId = filter_var($data['food_id'] ?? null, FILTER_VALIDATE_INT);
if (!$foodId || $foodId < 1) { http_response_code(422); echo json_encode(['success'=>false,'message'=>'A valid food listing ID is required.']); exit; }
try {
    $stmt = $pdo->prepare("SELECT id FROM food_listings WHERE id = :id AND status = 'available' AND collect_before > NOW() LIMIT 1");
    $stmt->execute(['id'=>$foodId]); if (!$stmt->fetch()) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'This food listing is no longer available.']); exit; }
    $insert = $pdo->prepare("INSERT INTO food_requests (food_id, requester_id, status) VALUES (:food_id, :requester_id, 'pending')");
    $insert->execute(['food_id'=>$foodId,'requester_id'=>$userId]); http_response_code(201); echo json_encode(['success'=>true,'request_id'=>(int)$pdo->lastInsertId(),'message'=>'Food request submitted. Waiting for donor confirmation.']);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') { http_response_code(409); echo json_encode(['success'=>false,'message'=>'You have already requested this food.']); }
    else { http_response_code(500); echo json_encode(['success'=>false,'message'=>'Unable to submit the food request.']); }
}
