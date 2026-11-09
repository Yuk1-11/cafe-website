<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$pdo = require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $orderNumber = $_GET['order_number'] ?? '';
    $pickupCode = $_GET['pickup_code'] ?? '';

    if ($orderNumber !== '' || $pickupCode !== '') {
        if ($orderNumber === '' || $pickupCode === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Missing order_number or pickup_code']);
            exit;
        }

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_number = :order_number AND pickup_code = :pickup_code LIMIT 1');
        $stmt->execute([':order_number' => $orderNumber, ':pickup_code' => $pickupCode]);
        $order = $stmt->fetch();

        if (!$order) {
            http_response_code(404);
            echo json_encode(['error' => 'Order not found']);
            exit;
        }

        echo json_encode(['order_number' => $order['order_number'], 'status' => $order['status'], 'pickup_code' => $order['pickup_code']], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $pdo->query('SELECT o.*, GROUP_CONCAT(CONCAT(i.product_name, " x ", i.quantity) SEPARATOR " / ") AS items_text FROM orders o LEFT JOIN order_items i ON i.order_id = o.id GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100');
    $orders = $stmt->fetchAll();

    $result = [];
    foreach ($orders as $order) {
        $items = [];
        $itemStmt = $pdo->prepare('SELECT product_name, quantity, price FROM order_items WHERE order_id = :order_id');
        $itemStmt->execute([':order_id' => $order['id']]);
        foreach ($itemStmt->fetchAll() as $item) {
            $items[] = [
                'name' => $item['product_name'],
                'quantity' => (int)$item['quantity'],
                'price' => (int)$item['price'],
            ];
        }

        $result[] = [
            'id' => (string)$order['id'],
            'orderNumber' => $order['order_number'],
            'pickupCode' => $order['pickup_code'],
            'total' => (int)$order['total'],
            'status' => $order['status'],
            'items' => $items,
            'createdAt' => $order['created_at'],
        ];
    }

    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    $tableNumber = (int)($input['table_number'] ?? 0);
    $items = $input['items'] ?? [];
    if ($tableNumber < 1 || !is_array($items) || empty($items)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid order data']);
        exit;
    }

    $orderNumber = 'D' . date('ymd') . '-' . str_pad((string)random_int(1, 999), 3, '0', STR_PAD_LEFT);
    $pickupCode = strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
    $total = 0;

    $pdo->beginTransaction();
    try {
        foreach ($items as $item) {
            $productId = (int)($item['id'] ?? 0);
            $quantity = (int)($item['quantity'] ?? 0);
            if ($productId <= 0 || $quantity <= 0) {
                throw new Exception('Invalid item');
            }

            $productStmt = $pdo->prepare('SELECT * FROM products WHERE id = :id LIMIT 1 FOR UPDATE');
            $productStmt->execute([':id' => $productId]);
            $product = $productStmt->fetch();
            if (!$product || (int)$product['active'] !== 1 || (int)$product['stock'] < $quantity) {
                throw new Exception('Product unavailable');
            }

            $total += (int)$product['price'] * $quantity;
            $pdo->prepare('UPDATE products SET stock = stock - :qty WHERE id = :id')->execute([
                ':qty' => $quantity,
                ':id' => $productId,
            ]);
        }

        $stmt = $pdo->prepare('INSERT INTO orders (order_number, pickup_code, total, status, table_number, created_at) VALUES (:order_number, :pickup_code, :total, :status, :table_number, NOW())');
        $stmt->execute([
            ':order_number' => $orderNumber,
            ':pickup_code' => $pickupCode,
            ':total' => $total,
            ':status' => '受付済み',
            ':table_number' => $tableNumber,
        ]);
        $orderId = (int)$pdo->lastInsertId();

        foreach ($items as $item) {
            $productId = (int)($item['id'] ?? 0);
            $quantity = (int)($item['quantity'] ?? 0);
            $productStmt = $pdo->prepare('SELECT name, price FROM products WHERE id = :id LIMIT 1');
            $productStmt->execute([':id' => $productId]);
            $product = $productStmt->fetch();

            $itemStmt = $pdo->prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (:order_id, :product_id, :product_name, :quantity, :price)');
            $itemStmt->execute([
                ':order_id' => $orderId,
                ':product_id' => $productId,
                ':product_name' => $product['name'],
                ':quantity' => $quantity,
                ':price' => $product['price'],
            ]);
        }

        $pdo->commit();
        echo json_encode([
            'orderNumber' => $orderNumber,
            'trackingToken' => hash('sha256', $orderNumber . ':' . $pickupCode),
            'pickupCode' => $pickupCode,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['error' => $e->getMessage()]);
        exit;
    }
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
