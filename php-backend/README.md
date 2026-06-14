# PHPバックエンド

Next.jsの画面はそのまま使い、登録データをPHP側のJSONファイルへ保存・復元するための小さなAPIです。

## 起動方法

```bash
cd php-backend
php -S 127.0.0.1:8080 router.php
```

起動後、Next.js側の設定ページで「PHP接続をテスト」を押してください。

## API

- `GET /api/health`: PHPサーバーの起動確認
- `GET /api/data`: 保存済みデータの取得
- `POST /api/data`: アカウント・投稿データの保存

保存先は `php-backend/data/app-data.json` です。

## 注意

このPHPバックエンドはローカル運用向けの簡易版です。公開サーバーで使う場合は、認証、権限、入力検証、DB保存を追加してください。
