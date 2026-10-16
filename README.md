# ● ドットカフェ モバイルオーダーシステム

文化祭限定のドットカフェをイメージした、スマートフォンから注文できるレトロポップなWebアプリケーションです。

お客さんが自分のスマートフォンから商品を注文し、店員はPCから注文状況や在庫を管理できるシステムを目指します。

## 🎯 プロジェクトの目的

- 注文受付を効率化する
- 注文の間違いや受け渡しミスを減らす
- 商品の在庫をリアルタイムで管理する
- お客さんがスマートフォンから簡単に注文できるようにする

## ✨ 主な機能

### お客さん向け機能
- [x] メニュー一覧の表示
- [x] 商品の価格・説明・画像の表示
- [x] カートへの追加・数量変更・削除
- [x] 注文内容と合計金額の確認
- [x] 注文の確定と注文番号の発行
- [x] 注文状況の確認（注文完了画面）
- [x] 売り切れ商品の表示と注文制限

### 店員向け管理機能
- [x] 管理画面へのログイン（Firebase Authenticationとスタッフ権限）
- [x] 注文一覧の表示
- [x] 注文内容・数量・合計金額の確認
- [x] 注文状況の更新
- [ ] 商品の追加・編集（次段階）
- [x] 在庫数の管理
- [x] 商品の売り切れ設定
- [x] 注文履歴の確認

## 🛠 使用技術

| 技術 | 用途 |
|---|---|
| HTML | Webページの構造 |
| CSS | デザイン・レイアウト |
| JavaScript | 画面操作・注文処理 |
| Firebase Hosting | Webサイトの公開 |
| Cloud Firestore | 商品・注文・在庫データの保存 |
| Firebase Authentication | 店員のログイン認証 |
| Cloud Functions for Firebase | 注文確定・在庫更新などのサーバー側処理 |

## 🏗 システム構成

1. お客さんがWebサイトから商品を選択する
2. 注文内容を確認して注文を確定する
3. サーバー側で在庫を確認し、注文情報を保存する
4. 店員用管理画面に注文が反映される
5. 店員が調理状況を更新する
6. お客さんが注文状況を確認する

## 📁 ディレクトリ構成（予定）

```text
cultural-festival-cafe/
├── index.html          # お客さん向け注文画面
├── admin.html          # 店員向け管理画面
├── css/
│   └── style.css       # 共通スタイル
├── js/
│   ├── firebase.js     # Firebase初期化
│   ├── menu.js         # メニュー表示
│   ├── order.js        # 注文処理
│   └── admin.js        # 注文・在庫管理
├── functions/          # サーバー側処理
├── firestore.rules     # データベースのアクセス制御
├── firestore.indexes.json
├── firebase.json
└── README.md
```

※ ディレクトリ構成は開発の進行に合わせて変更します。

## 🔐 セキュリティ方針

- 店員用管理画面は認証を必須にする
- Firestore Security Rulesでアクセス権限を制限する
- 在庫確認と注文確定は信頼できるサーバー側処理で行う
- クライアントから送信された価格や合計金額をそのまま信用しない
- Firebaseの秘密鍵や認証情報をGitHubに公開しない

## 🚀 開発予定

- [ ] GitHubリポジトリの作成
- [x] 基本的な画面デザインの作成
- [x] メニュー表示機能の実装
- [ ] Firebaseプロジェクトの設定
- [x] 商品データと在庫管理の実装（Cloud FirestoreとCloud Functions）
- [x] 注文機能の実装
- [x] 店員用管理画面の実装
- [x] 認証・アクセス制御の実装（Custom ClaimsとFirestore Security Rules）
- [x] テストと動作確認（JavaScript構文・ブラウザ画面）
- [ ] Firebase Hostingで公開
- [ ] 文化祭本番に向けた負荷・運用テスト

## 📝 備考

本プロジェクトは文化祭での利用を目的として開発しています。

開発状況や必要な機能に応じて、仕様を随時更新します。

## 現在の実装について

Firebase連携コードとデプロイ設定を用意しています。実際の注文受付を有効にするには、`js/firebase-config.js` にプロジェクトのWeb設定を入力し、Firebaseの各サービスを有効化してデプロイしてください。Firebase設定がない場合はメニューのプレビューだけが表示されます。

注文カートと注文状況確認用トークンはブラウザーのストレージに一時保存し、商品・在庫・注文はCloud Firestoreで管理します。

## ドットカフェのデザイン

水玉模様とレトロポップな色使いをテーマに、文化祭で立ち寄りたくなるカフェの注文ページにしています。メニューはドットラテ、しゅわしゅわソーダ、水玉クリームケーキ、ドットクッキーです。

## Firebaseの設定と公開

このサイトはFirebase Hosting、Cloud Firestore、Firebase Authentication、Callable Cloud Functionsを使います。Firebaseプロジェクトごとに必要な設定を行ってからデプロイしてください。

### 1. FirebaseプロジェクトとWebアプリを設定する

1. Firebase Consoleでプロジェクトを作成し、Webアプリを追加します。
2. Webアプリの設定値を `js/firebase-config.js` にコピーします。Firebase Web APIキーはブラウザーに配布される公開設定値です。Admin SDKの秘密鍵はここやGitHubに置かないでください。
3. Authenticationでメール/パスワードのログインを有効にし、スタッフのユーザーを作成します。
4. Firestore Databaseを作成します。最初の商品カタログは、スタッフが管理画面へ初回ログインしたときに登録されます。
5. Cloud FunctionsをデプロイするにはFirebaseプロジェクトをBlaze料金プランにする必要があります。料金・無料枠を確認してから有効にしてください。

### 2. スタッフ権限を設定する

管理画面にログインさせる前に、スタッフアカウントへ `staff: true` のCustom Claimを付けます。Google Cloud SDKをインストールし、Firebaseプロジェクトに対するFirebase Authentication管理権限を持つGoogleアカウントで次を実行します。

```powershell
gcloud auth application-default login
node .\functions\scripts\set-staff.js <PROJECT_ID> <スタッフのメールアドレス> grant
```

権限を外す場合は最後の `grant` を `revoke` にします。Claimを変更した後はスタッフがいったんログアウトして、もう一度ログインしてください。ブラウザー側だけのデモコードによる認証は使用しません。

### 3. Hostingとバックエンドをデプロイする

Node.js 22とFirebase CLIを用意してから、プロジェクトのルートで実行します。

```powershell
npm install --prefix functions
npx firebase-tools login
npx firebase-tools deploy --project <PROJECT_ID>
```

デプロイにはHostingサイト、Firestore Security Rules、Cloud Functionsが含まれます。公開URLはFirebase ConsoleのHosting画面で確認できます。`<PROJECT_ID>` は実際のFirebaseプロジェクトIDに置き換えてください。

### データの保護と動作

- 商品メニューはFirestoreからリアルタイムに読み込みます。
- 注文確定はCloud Functionsが価格と在庫をFirestoreトランザクションで再検証してから注文を保存します。ブラウザーから送られた価格・合計金額は利用しません。
- お客さまの注文状況確認には注文番号に加え、注文時に発行する推測困難な確認トークンを使います。
- 注文の閲覧、注文状況・在庫の変更はスタッフCustom Claimを持つアカウントに限定します。Firestoreクライアントからの直接書き込みはSecurity Rulesで拒否されます。
- Firebase設定が未入力の間はメニューのプレビューのみ表示し、注文受付とスタッフログインは無効です。
