<?php
$pdo = require __DIR__ . '/db.php';

$pdo->exec('CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price INT NOT NULL,
    emoji VARCHAR(32) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)');

$pdo->exec('CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(64) NOT NULL UNIQUE,
    pickup_code VARCHAR(16) NOT NULL,
    total INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT "受付済み",
    table_number INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)');

$pdo->exec('CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    price INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
)');

$pdo->exec('CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT "staff",
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)');

$defaultProducts = [
    ['ドットラテ', 'まろやかミルクと香ばしいコーヒー。', 350, '☕', 20],
    ['しゅわしゅわソーダ', 'カラフルな果実を浮かべた、見た目も楽しいソーダ。', 400, '🥤', 12],
    ['水玉クリームケーキ', 'ふんわりスポンジに、ころんとかわいい水玉クリーム。', 450, '🍰', 8],
    ['ドットクッキー', 'さくさく手作り。コーヒーと一緒にどうぞ。', 200, '🍪', 0],
];

foreach ($defaultProducts as $index => $product) {
    $stmt = $pdo->prepare('SELECT id FROM products WHERE name = :name LIMIT 1');
    $stmt->execute([':name' => $product[0]]);
    if (!$stmt->fetch()) {
        $pdo->prepare('INSERT INTO products (name, description, price, emoji, stock, active, sort_order) VALUES (:name, :description, :price, :emoji, :stock, 1, :sort_order)')->execute([
            ':name' => $product[0],
            ':description' => $product[1],
            ':price' => $product[2],
            ':emoji' => $product[3],
            ':stock' => $product[4],
            ':sort_order' => $index + 1,
        ]);
    }
}

$adminEmail = 'admin@dotcafe.local';
$adminPasswordHash = password_hash('admin123', PASSWORD_DEFAULT);
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
$stmt->execute([':email' => $adminEmail]);
if (!$stmt->fetch()) {
    $pdo->prepare('INSERT INTO users (email, password_hash, role) VALUES (:email, :password_hash, :role)')->execute([
        ':email' => $adminEmail,
        ':password_hash' => $adminPasswordHash,
        ':role' => 'admin',
    ]);
}

echo json_encode(['ok' => true, 'message' => 'Database initialized']);
