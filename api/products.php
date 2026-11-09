<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$pdo = require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query('SELECT * FROM products ORDER BY sort_order ASC, id ASC');
    echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    $name = trim((string)($input['name'] ?? ''));
    $description = trim((string)($input['description'] ?? ''));
    $price = (int)($input['price'] ?? 0);
    $emoji = trim((string)($input['emoji'] ?? ''));
    $stock = (int)($input['stock'] ?? 0);

    if ($name === '' || $description === '' || $emoji === '') {
        http_response_code(400);
        echo json_encode(['error' => '商品名・説明・絵文字は必須です']);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $stmt = $pdo->prepare('INSERT INTO products (name, description, price, emoji, stock, active, sort_order) VALUES (:name, :description, :price, :emoji, :stock, 1, 0)');
        $stmt->execute([
            ':name' => $name,
            ':description' => $description,
            ':price' => $price,
            ':emoji' => $emoji,
            ':stock' => $stock,
        ]);
        echo json_encode(['ok' => true, 'message' => 'Product created']);
        exit;
    }

    $productId = (int)($input['id'] ?? 0);
    $stmt = $pdo->prepare('UPDATE products SET name = :name, description = :description, price = :price, emoji = :emoji, stock = :stock WHERE id = :id');
    $stmt->execute([
        ':name' => $name,
        ':description' => $description,
        ':price' => $price,
        ':emoji' => $emoji,
        ':stock' => $stock,
        ':id' => $productId,
    ]);
    echo json_encode(['ok' => true, 'message' => 'Product updated']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
