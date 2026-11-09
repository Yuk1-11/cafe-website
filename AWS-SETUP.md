# AWS での構築手順・仕様書

この文書は、文化祭向けカフェ注文システムを AWS Academy の無料枠を使って運用するための手順書と仕様書です。

前提:
- サーバーは EC2 で運用する
- Web アプリは Apache + PHP で配信する
- DB は MariaDB を使う
- 管理者は SSH で EC2 に接続する
- 一般ユーザーは HTTPS でサイトにアクセスする
- 料金を抑えるため、DB は同一 EC2 に置く構成を採用する

## 1. 構成概要

### 1-1. 目標

- SSH でサーバーを安全に管理できる
- HTTP/HTTPS でクライアントがアクセスできる
- 管理画面と注文ページを同じドメインで運用できる
- AWS Academy の無料枠をできるだけ活用する

### 1-2. 推奨構成

- EC2: Ubuntu 22.04 LTS
- Web サーバー: Apache 2
- PHP: 8.2 以上
- DB: MariaDB 10.6 以上
- SSL: Let’s Encrypt / certbot
- ドメイン: Route 53 または既存ドメイン
- ファイル配信: `/var/www/cafe/`
- API: `/var/www/cafe/api/*.php`

### 1-3. ネットワーク設計

- SSH 接続: 管理者の PC の IP からのみ 22 番ポートを開放
- HTTPS 接続: 0.0.0.0/0 から 443 番ポートを開放
- HTTP 接続: 80 番を開放して 301 redirect で HTTPS に誘導
- DB: 3306 は EC2 からのみアクセス可能（外部公開しない）

## 2. サーバー設計

### 2-1. サーバー要件

- メモリ: 1GB 以上推奨
- CPU: 2 vCPU 程度
- ストレージ: 20GB 以上
- OS: Ubuntu 22.04 LTS

### 2-2. セキュリティグループ

インバウンドルール:
- 22/tcp: 管理者用 IP のみ
- 80/tcp: 0.0.0.0/0
- 443/tcp: 0.0.0.0/0

アウトバウンドルール:
- 0.0.0.0/0

注: MariaDB の 3306 はパブリック公開しない。EC2 ローカル接続のみ許可する。

## 3. サーバー作成手順

### 3-1. EC2 インスタンスの作成

1. AWS Console にログインする
2. EC2 を開く
3. 「インスタンスを起動」を選ぶ
4. AMI: Ubuntu Server 22.04 LTS
5. インスタンスタイプ: t2.micro / t3.micro（無料枠対象確認）
6. キーペアを作成し、PEM ファイルを保存する
7. Security Group を作成し、必要ポートを追加する
8. インスタンスを起動する

### 3-2. SSH で接続する

```bash
chmod 400 cafe-key.pem
ssh -i cafe-key.pem ubuntu@<EC2_PUBLIC_IP>
```

確認:
- この接続がサーバー管理用の SSH 接続である
- サーバー管理者だけが SSH で入れる構成になっている

### 3-3. サーバー初期設定

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y apache2 php8.2 php8.2-mysql mariadb-server certbot python3-certbot-apache unzip curl
```

### 3-4. PHP と Apache の設定

```bash
sudo a2enmod rewrite ssl
sudo systemctl enable apache2
sudo systemctl start apache2
```

PHP の確認:

```bash
php -v
```

### 3-5. MariaDB の設定

```bash
sudo mysql_secure_installation
```

- root パスワードを設定する
- 匿名ユーザー削除
- リモート root ログイン禁止
- テスト DB 削除

次に、DB とユーザーを作成する:

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE cafe_db;
CREATE USER 'cafe_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON cafe_db.* TO 'cafe_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 4. HTTPS を設定する

### 4-1. ドメインを用意する

- Route 53 でドメインを取得または既存ドメインを使用
- EC2 のパブリック IP を DNS に紐付ける
- 例: `cafe.example.com`

### 4-2. certbot で HTTPS を設定する

```bash
sudo certbot --apache -d cafe.example.com
```

設定後の確認:
- `https://cafe.example.com` にアクセスできる
- ブラウザーが HTTPS で安全に接続していることを確認する
- HTTP は 301 redirect で HTTPS に転送される

### 4-3. HTTP を HTTPS にリダイレクトする

Apache のサイト設定により、自動的にリダイレクトされる構成にする。

例:

```apache
<VirtualHost *:80>
    ServerName cafe.example.com
    Redirect permanent / https://cafe.example.com/
</VirtualHost>
```

## 5. アプリの配置

### 5-1. サイトの配置先

```bash
sudo mkdir -p /var/www/cafe
sudo chown -R www-data:www-data /var/www/cafe
```

このリポジトリの HTML/CSS/JS を `/var/www/cafe` に配置する。

### 5-2. Apache の設定

```bash
sudo nano /etc/apache2/sites-available/cafe.conf
```

```apache
<VirtualHost *:443>
    ServerName cafe.example.com
    DocumentRoot /var/www/cafe

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/cafe.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/cafe.example.com/privkey.pem

    <Directory /var/www/cafe>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/cafe_error.log
    CustomLog ${APACHE_LOG_DIR}/cafe_access.log combined
</VirtualHost>
```

有効化:

```bash
sudo a2ensite cafe.conf
sudo systemctl reload apache2
```

## 6. PHP API の設計

### 6-1. 役割

- フロントエンド: HTML / JS / CSS
- API: PHP
- DB: MariaDB
- 認証: PHP セッション
- 在庫・注文処理: サーバー側で実行

### 6-2. API 例

- `GET /api/products.php` : 商品一覧取得
- `POST /api/orders.php` : 注文作成
- `POST /api/login.php` : 管理者ログイン
- `POST /api/logout.php` : ログアウト
- `GET /api/orders.php?order_number=...&pickup_code=...` : 注文確認
- `POST /api/orders/status.php` : ステータス更新
- `POST /api/products.php` : 商品追加
- `PUT /api/products.php` : 商品更新

### 6-3. セキュリティ

- SQL インジェクション防止: prepared statement を使用
- パスワード保存: `password_hash()` を使用
- 管理画面保護: セッション認証必須
- CSRF 対策: トークン検証を実装
- 注文時の在庫確認はサーバー側で必ず実施

## 7. DB 仕様

### 7-1. products テーブル

```sql
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price INT NOT NULL,
  emoji VARCHAR(32),
  stock INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 7-2. orders テーブル

```sql
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(32) NOT NULL UNIQUE,
  pickup_code VARCHAR(16) NOT NULL,
  total INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'received',
  customer_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 7-3. order_items テーブル

```sql
CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  price INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

### 7-4. users テーブル

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 8. 利用者アクセスの考え方

### 8-1. サーバー側アクセス

- 管理者のみ SSH 接続可能
- サーバー IP へ `ssh -i ... ubuntu@IP` で接続
- 接続元 IP は必要最小限に制限する

### 8-2. クライアント側アクセス

- 一般利用者は `https://cafe.example.com` にアクセス
- 80 番ポートは HTTP を HTTPS に転送するだけに利用
- 22 番と 3306 は公開しない

この構成により、
- サーバー管理は SSH
- 一般公開は HTTPS
の役割が明確に分かれます。

## 9. 運用チェックリスト

### AWS 側

- [ ] EC2 が起動している
- [ ] 22 番ポートが管理者 IP のみ開放されている
- [ ] 80 番ポートが開いている
- [ ] 443 番ポートが開いている
- [ ] SSH 鍵が安全に保管されている
- [ ] HTTPS 証明書が有効である

### アプリ側

- [ ] `https://...` でサイトが開く
- [ ] 管理画面がログイン必須である
- [ ] 商品一覧が取得できる
- [ ] 注文時に在庫確認が行われる
- [ ] 合言葉が正しく表示される
- [ ] スタッフが注文ステータスを更新できる

## 10. 料金対策

- EC2 は無料枠の対象を選ぶ
- MariaDB は同一 EC2 内に置いて外部公開しない
- 3306 の公開を避ける
- `apt` の更新とログ監視を定期的に行う
- 無料枠超過に注意して、使い切りイベントであれば不要なインスタンスは停止する

## 11. 実際の運用ルール

- サーバーの再起動は SSH から行う
- 設定変更は `sudo` 権限で行う
- 重要な設定は `/etc/apache2` と `/etc/mysql` の状態を確認する
- 本番データは定期的にバックアップする
- 管理者の SSH 公開鍵を ICP で管理する

## 12. まとめ

この構成では、
- 管理者は SSH でサーバーに接続できる
- 利用者は HTTPS でサイトにアクセスできる
- DB は EC2 内で閉じており、外部公開しない
- 料金を抑えた短期イベント向けの運用が可能になる

この設計は、AWS Academy の無料枠を活用しながら、文化祭の短期運用に適した構成です。
