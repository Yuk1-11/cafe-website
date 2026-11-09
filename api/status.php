<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$pdo = require __DIR__ . '/db.php';
$orderNumber = trim((string)($input['order_number'] ?? ''));
$pickupCode = trim((string)($input['pickup_code'] ?? ''));

if ($orderNumber === '' || $pickupCode === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing order data']);
    exit;
}

$stmt = $pdo->prepare('SELECT status FROM orders WHERE order_number = :order_number AND pickup_code = :pickup_code LIMIT 1');
$stmt->execute([':order_number' => $orderNumber, ':pickup_code' => $pickupCode]);
$order = $stmt->fetch();
if (!$order) {
    http_response_code(404);
    echo json_encode(['error' => 'Order not found']);
    exit;
}

echo json_encode(['status' => $order['status']], JSON_UNESCAPED_UNICODE);
