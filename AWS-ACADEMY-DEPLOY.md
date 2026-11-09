# AWS Academy での公開手順（EC2 + Apache + PHP + MariaDB）

このドキュメントは、AWS Academy の環境でこのカフェ注文システムを公開できるようにするための手順です。

前提:
- AWS Academy Lab で EC2 を使える
- EC2 にパブリック IP がある
- VPC の default public subnet を使うのが最も安定
- PHP + Apache + MariaDB を同じ EC2 に置く
- 一般公開は HTTPS でアクセスする

## 1. まず確認すること

AWS Academy では、ネットワークの制限がかかることがあります。公開ができるかどうかは、次の4つが全て揃っているかで決まります。

- EC2 が public subnet にいる
- Route table に `0.0.0.0/0 -> Internet Gateway` がある
- Security Group の outbound が `0.0.0.0/0` になっている
- EC2 にパブリック IP が割り当てられている

この4つが揃っていないと、`apt update` も `curl` も `certbot` もできません。

## 2. EC2 の作成

### 2-1. EC2 を作る

AWS Console から:
- EC2
- インスタンスを起動
- Ubuntu Server 22.04 LTS などを選ぶ
- インスタンスタイプ: t2.micro / t3.micro
- キーペアを作成
- Security Group を作成

### 2-2. Security Group

Inbound:
- 22/tcp: 自分の IP のみ
- 80/tcp: 0.0.0.0/0
- 443/tcp: 0.0.0.0/0

Outbound:
- All traffic -> 0.0.0.0/0

### 2-3. Public subnet

- VPC の default VPC を使うのが最も簡単
- EC2 を default public subnet に置く
- Auto-assign public IP: 有効

## 3. SSH 接続

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

## 4. サーバー環境のインストール

```bash
sudo apt update
sudo apt install -y apache2 mariadb-server php php-mysql php-cli php-curl php-xml php-mbstring php-json unzip curl openssl
sudo systemctl enable --now apache2 mariadb
```

もし `php` が見つからない場合は、OSのバージョンに応じて次も試します。

```bash
sudo apt search php | head
sudo apt install -y php8.2 php8.2-mysql
```

## 5. MariaDB の設定

```bash
sudo mysql_secure_installation
sudo mysql -u root -p
```

```sql
CREATE DATABASE cafe_db;
CREATE USER 'cafe_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON cafe_db.* TO 'cafe_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 6. データベースの初期化

このリポジトリには `api/init-db.php` があるので、EC2 にアップロードして実行します。

```bash
cd /var/www
sudo mkdir -p cafe
sudo chown -R ubuntu:ubuntu /var/www/cafe
```

ローカルからこのプロジェクトを EC2 に送る場合は SFTP / SCP を使います。

```bash
scp -i your-key.pem -r ./* ubuntu@<EC2_PUBLIC_IP>:/var/www/cafe/
```

そのあと、DB 初期化を実行します。

```bash
cd /var/www/cafe
php api/init-db.php
```

## 7. Apache の設定

### 7-1. ドキュメントルートを作る

```bash
sudo mkdir -p /var/www/cafe
sudo chown -R www-data:www-data /var/www/cafe
```

### 7-2. vhost を作成する

```bash
sudo nano /etc/apache2/sites-available/cafe.conf
```

```apache
<VirtualHost *:80>
    ServerName cafe.example.com
    DocumentRoot /var/www/cafe

    <Directory /var/www/cafe>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/cafe_error.log
    CustomLog ${APACHE_LOG_DIR}/cafe_access.log combined
</VirtualHost>
```

### 7-3. 有効化

```bash
sudo a2ensite cafe.conf
sudo a2enmod rewrite
sudo systemctl reload apache2
```

## 8. HTTPS の設定

### 8-1. ドメインがある場合

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d cafe.example.com
```

証明書が入ると、HTTPS で公開可能になります。

### 8-2. ドメインがまだない場合

- Route 53 でドメインを買う
- もしくは、EC2 のパブリック IP に直接アクセスする
- 先に http で動作確認してから HTTPS を入れる

AWS Academy ではドメインの取得が難しいことがあるので、最初は EC2 のパブリック IP で確認が現実的です。

## 9. このプロジェクトの公開方法

このリポジトリの中身を公開するには、以下をサーバーにコピーします。

- `index.html`
- `admin.html`
- `css/`
- `js/`
- `api/`

公開場所:
- `/var/www/cafe`

`index.html` と `admin.html` はそのままブラウザから開けます。

## 10. API の確認

ブラウザから確認できるように、API を動作させます。

```bash
curl http://localhost/api/products.php
curl -X POST http://localhost/api/orders.php \
  -H "Content-Type: application/json" \
  -d '{"table_number":1,"items":[{"id":1,"quantity":1}]}'
```

## 11. どこが public になるか

公開される範囲は次の通りです。

- 管理者: SSH で EC2 に入る
- 利用者: `https://<EC2_PUBLIC_IP>` または `https://cafe.example.com` でアクセス
- DB: localhost のみ接続可能にする（外部公開しない）

この設計で、SSH と HTTPS の役割が分かれます。

## 12. AWS Academy で公開できるか

結論:
- 技術的には可能です
- ただし、AWS Academy のネットワーク制限があるので、最初に public subnet / route table / outbound を確認してから進める必要があります
- `apt update` ができないなら、通常はネットワーク設定が原因です

もし AWS Academy のラボ環境で外向き通信が禁止されている場合は、次のどちらかになります。

- 別の AWS アカウントで EC2 を作る
- もしくは Academy の管理者に外向き通信の許可を確認する

## 13. 一番簡単な公開手順のまとめ

1. default VPC を使う
2. public subnet に EC2 を置く
3. Security Group を 22/80/443 で開く
4. Outbound を 0.0.0.0/0 にする
5. Route table に 0.0.0.0/0 -> IGW を追加する
6. EC2 に SSH 接続する
7. Apache / PHP / MariaDB を install する
8. このプロジェクトを `/var/www/cafe` に置く
9. `api/init-db.php` を実行してテーブルを作る
10. Apache で公開
11. `https://<EC2_PUBLIC_IP>` で確認する

## 14. 重要な注意点

- 22 番ポートは自分の IP のみ許可する
- DB の 3306 は外部公開しない
- 80 を HTTPS にリダイレクトする
- 本番環境では、管理者用のパスワードを安全に保管する
- `db.php` は本番では環境変数にするのが安全です

## 15. 最短コマンド一覧

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

sudo apt update
sudo apt install -y apache2 mariadb-server php php-mysql php-cli php-curl php-xml php-mbstring unzip curl openssl
sudo systemctl enable --now apache2 mariadb

sudo mysql -u root -p
# CREATE DATABASE cafe_db;
# CREATE USER 'cafe_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
# GRANT ALL PRIVILEGES ON cafe_db.* TO 'cafe_user'@'localhost';
# FLUSH PRIVILEGES;
# EXIT;

cd /var/www
sudo mkdir -p cafe
sudo chown -R ubuntu:ubuntu /var/www/cafe
scp -i your-key.pem -r ./* ubuntu@<EC2_PUBLIC_IP>:/var/www/cafe/
php /var/www/cafe/api/init-db.php
```

この手順で、AWS Academy 上で公開可能な構成まで進められます。
