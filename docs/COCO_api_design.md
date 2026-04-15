# COCO API設計書（MVP）

## 1. 前提
- クライアントは React Native + Expo
- バックエンド基盤は Supabase
- API設計はアプリ視点での論理設計として記述する
- 認証は Supabase Auth
- レスポンスは JSON
- 認証が必要なAPIはログイン済みユーザーのみ利用可能
- 位置履歴は持たず、最新位置のみを扱う
- 状態画面では、複数エリア該当時に最も狭いエリアを代表表示する
- 地図画面・エリア詳細画面では、実際の包含関係で判定する

## 2. 共通仕様
### 2.1 ベース
- Base URL: `/api/v1`

### 2.2 認証
- 認証が必要なAPIは Bearer token を利用
- 形式: `Authorization: Bearer <access_token>`

### 2.3 共通レスポンス形式
#### 成功
```json
{
  "data": {}
}
```

#### 失敗
```json
{
  "error": {
    "code": "string_code",
    "message": "human readable message"
  }
}
```

### 2.4 主なHTTPステータス
- `200 OK` 取得成功
- `201 Created` 作成成功
- `204 No Content` 削除成功
- `400 Bad Request` リクエスト不正
- `401 Unauthorized` 未認証
- `403 Forbidden` 権限なし
- `404 Not Found` 対象なし
- `409 Conflict` 重複などの競合
- `422 Unprocessable Entity` バリデーションエラー

## 3. 認証API
※ 実装は Supabase Auth を利用するが、アプリ設計上必要な入出力を明文化する。

### 3.1 サインアップ
`POST /auth/signup`

#### 用途
- 新規登録画面

#### リクエスト
```json
{
  "displayName": "Yuki",
  "email": "yuki@example.com",
  "password": "password123"
}
```

#### 処理
- Authユーザー作成
- `users` テーブルにユーザー情報作成
- `icon_url` にはデフォルト画像URLを保存

#### レスポンス
```json
{
  "data": {
    "user": {
      "id": "uuid-user-1",
      "displayName": "Yuki",
      "email": "yuki@example.com",
      "iconUrl": "https://example.com/default-user-icon.png"
    },
    "session": {
      "accessToken": "token",
      "refreshToken": "token"
    }
  }
}
```

### 3.2 ログイン
`POST /auth/login`

#### 用途
- ログイン画面

#### リクエスト
```json
{
  "email": "yuki@example.com",
  "password": "password123"
}
```

#### レスポンス
```json
{
  "data": {
    "user": {
      "id": "uuid-user-1",
      "displayName": "Yuki",
      "email": "yuki@example.com",
      "iconUrl": "https://example.com/default-user-icon.png"
    },
    "session": {
      "accessToken": "token",
      "refreshToken": "token"
    }
  }
}
```

### 3.3 ログアウト
`POST /auth/logout`

#### 用途
- 設定画面

#### レスポンス
```json
{
  "data": {
    "success": true
  }
}
```

### 3.4 現在ユーザー取得
`GET /auth/me`

#### 用途
- アプリ起動時
- 設定画面
- 自分情報表示

#### レスポンス
```json
{
  "data": {
    "id": "uuid-user-1",
    "displayName": "Yuki",
    "email": "yuki@example.com",
    "iconUrl": "https://example.com/default-user-icon.png"
  }
}
```

## 4. 状態API
### 4.1 状態トップ一覧取得
`GET /status/groups`

#### 用途
- 状態トップ画面

#### 内容
- 自分以外の状態一覧を返す
- 各グループについて、グループ名、グループアイコン、自分以外にエリア内ユーザーがいるかを返す

#### レスポンス
```json
{
  "data": [
    {
      "groupId": "uuid-group-1",
      "groupName": "家族",
      "groupIconUrl": "https://example.com/group-family.png",
      "hasOtherUsersInsideArea": true,
      "latestActivityAt": "2026-04-15T10:30:00Z"
    },
    {
      "groupId": "uuid-group-2",
      "groupName": "旅行",
      "groupIconUrl": "https://example.com/group-trip.png",
      "hasOtherUsersInsideArea": false,
      "latestActivityAt": "2026-04-15T09:10:00Z"
    }
  ]
}
```

#### 並び順
- グループ内誰かの最新位置更新時刻の降順

### 4.2 自分状態一覧取得
`GET /status/me`

#### 用途
- 自分画面

#### 内容
- 各グループにおける自分の状態を返す
- 表示は「エリア内 / エリア外」

#### レスポンス
```json
{
  "data": [
    {
      "groupId": "uuid-group-1",
      "groupName": "家族",
      "groupIconUrl": "https://example.com/group-family.png",
      "isInsideAnyArea": true
    },
    {
      "groupId": "uuid-group-2",
      "groupName": "旅行",
      "groupIconUrl": "https://example.com/group-trip.png",
      "isInsideAnyArea": false
    }
  ]
}
```

### 4.3 状態更新
`POST /status/update`

#### 用途
- グループ詳細画面の右上メニュー / ボタン群の状態更新

#### リクエスト
```json
{
  "latitude": 35.658,
  "longitude": 139.7016
}
```

#### 処理
- `user_locations` を更新または作成
- 各グループの状態は保存せず、表示時に計算する

#### レスポンス
```json
{
  "data": {
    "recordedAt": "2026-04-15T10:40:00Z"
  }
}
```

## 5. グループAPI
### 5.1 グループ作成
`POST /groups`

#### 用途
- 地図画面の右上プラスボタン → グループ作成画面

#### リクエスト
```json
{
  "name": "家族",
  "iconUrl": "https://example.com/default-group-icon.png"
}
```

#### 処理
- `groups` 作成
- 作成者を `group_members` に追加
- 有効な招待リンクを1本作成

#### レスポンス
```json
{
  "data": {
    "id": "uuid-group-1",
    "name": "家族",
    "iconUrl": "https://example.com/default-group-icon.png"
  }
}
```

#### 画面遷移
- 作成成功後はグループ詳細画面へ遷移する

### 5.2 所属グループ一覧取得
`GET /groups`

#### 用途
- 地図画面のグループ切り替えUI

#### レスポンス
```json
{
  "data": [
    {
      "id": "uuid-group-1",
      "name": "家族",
      "iconUrl": "https://example.com/group-family.png"
    },
    {
      "id": "uuid-group-2",
      "name": "旅行",
      "iconUrl": "https://example.com/group-trip.png"
    }
  ]
}
```

### 5.3 グループ詳細取得
`GET /groups/:groupId/detail`

#### 用途
- グループ詳細画面

#### 内容
- グループ情報
- 招待URL
- メンバー一覧
- 各メンバーの代表表示状態

#### レスポンス
```json
{
  "data": {
    "group": {
      "id": "uuid-group-1",
      "name": "家族",
      "iconUrl": "https://example.com/group-family.png",
      "ownerUserId": "uuid-user-1"
    },
    "inviteLink": {
      "url": "coco://invite/abc123",
      "token": "abc123"
    },
    "members": [
      {
        "userId": "uuid-user-1",
        "displayName": "Yuki",
        "iconUrl": "https://example.com/user1.png",
        "displayArea": {
          "type": "area",
          "areaId": "uuid-area-1",
          "areaName": "渋谷駅周辺"
        },
        "recordedAt": "2026-04-15T10:40:00Z",
        "isMe": true
      },
      {
        "userId": "uuid-user-2",
        "displayName": "Aki",
        "iconUrl": "https://example.com/user2.png",
        "displayArea": {
          "type": "outside"
        },
        "recordedAt": "2026-04-15T10:25:00Z",
        "isMe": false
      }
    ]
  }
}
```

#### 注記
- `recordedAt` は一覧表示用ではなく、ユーザー簡易モーダル用の情報として利用する
- `displayArea` は代表表示用で、複数エリア該当時は最も狭いエリアを返す

### 5.4 グループ離脱
`DELETE /groups/:groupId/members/me`

#### 用途
- グループから抜ける

#### レスポンス
```json
{
  "data": {
    "success": true,
    "groupDeleted": false
  }
}
```

#### 備考
- 離脱後メンバーが0人ならグループ削除
- その場合 `groupDeleted: true`

## 6. 招待URL API
### 6.1 招待リンク情報取得
`GET /invite-links/:token`

#### 用途
- 招待URL参加確認画面

#### レスポンス
```json
{
  "data": {
    "group": {
      "id": "uuid-group-1",
      "name": "家族",
      "iconUrl": "https://example.com/group-family.png"
    },
    "isActive": true
  }
}
```

### 6.2 招待リンク参加
`POST /invite-links/:token/join`

#### 用途
- 招待URL参加確認画面の参加ボタン

#### レスポンス
```json
{
  "data": {
    "groupId": "uuid-group-1",
    "joined": true
  }
}
```

#### 画面遷移
- 参加成功後はグループ詳細画面へ遷移
- キャンセル時は状態トップ画面へ戻る

### 6.3 招待リンク再発行
`POST /groups/:groupId/invite-link/regenerate`

#### 用途
- グループ詳細画面の招待URL再発行

#### 権限
- オーナーのみ実行可能

#### 処理
- 旧リンクを `is_active = false`
- 新リンクを作成

#### レスポンス
```json
{
  "data": {
    "url": "coco://invite/xyz789",
    "token": "xyz789"
  }
}
```

#### 主なエラー
- `GROUP_NOT_FOUND`
- `NOT_GROUP_MEMBER`
- `NOT_GROUP_OWNER`

## 7. 地図・エリアAPI
### 7.1 地図画面用データ取得
`GET /groups/:groupId/map`

#### 用途
- 地図画面

#### 内容
- グループ情報
- エリア一覧
- 各エリアについて「ユーザーがいる / いない」

#### レスポンス
```json
{
  "data": {
    "group": {
      "id": "uuid-group-1",
      "name": "家族",
      "iconUrl": "https://example.com/group-family.png"
    },
    "areas": [
      {
        "id": "uuid-area-1",
        "name": "渋谷",
        "centerLatitude": 35.658,
        "centerLongitude": 139.7016,
        "radiusMeters": 500,
        "hasUsersInside": true
      },
      {
        "id": "uuid-area-2",
        "name": "渋谷駅周辺",
        "centerLatitude": 35.6595,
        "centerLongitude": 139.7005,
        "radiusMeters": 200,
        "hasUsersInside": true
      },
      {
        "id": "uuid-area-3",
        "name": "自宅",
        "centerLatitude": 35.68,
        "centerLongitude": 139.76,
        "radiusMeters": 100,
        "hasUsersInside": false
      }
    ]
  }
}
```

#### 表示ルール
- 地図画面は実包含ベース
- 複数エリアに属するユーザーは、該当するすべてのエリアで `hasUsersInside = true` になりうる

### 7.2 エリア作成
`POST /groups/:groupId/areas`

#### 用途
- 地図画面でのエリア作成

#### リクエスト
```json
{
  "name": "渋谷",
  "centerLatitude": 35.658,
  "centerLongitude": 139.7016,
  "radiusMeters": 500
}
```

#### レスポンス
```json
{
  "data": {
    "id": "uuid-area-1",
    "name": "渋谷",
    "centerLatitude": 35.658,
    "centerLongitude": 139.7016,
    "radiusMeters": 500
  }
}
```

### 7.3 エリア詳細取得
`GET /areas/:areaId`

#### 用途
- エリア詳細画面

#### 内容
- エリア情報
- エリア内ユーザー一覧

#### レスポンス
```json
{
  "data": {
    "area": {
      "id": "uuid-area-1",
      "groupId": "uuid-group-1",
      "name": "渋谷",
      "centerLatitude": 35.658,
      "centerLongitude": 139.7016,
      "radiusMeters": 500
    },
    "users": [
      {
        "userId": "uuid-user-1",
        "displayName": "Yuki",
        "iconUrl": "https://example.com/user1.png",
        "recordedAt": "2026-04-15T10:40:00Z"
      },
      {
        "userId": "uuid-user-2",
        "displayName": "Aki",
        "iconUrl": "https://example.com/user2.png",
        "recordedAt": "2026-04-15T10:25:00Z"
      }
    ]
  }
}
```

### 7.4 エリア更新
`PATCH /areas/:areaId`

#### 用途
- エリア編集画面

#### MVPで更新可能な項目
- `name` のみ

#### リクエスト
```json
{
  "name": "渋谷エリア"
}
```

#### レスポンス
```json
{
  "data": {
    "id": "uuid-area-1",
    "name": "渋谷エリア"
  }
}
```

### 7.5 エリア削除
`DELETE /areas/:areaId`

#### 用途
- エリア詳細画面の削除ボタン

#### レスポンス
```json
{
  "data": {
    "success": true
  }
}
```

## 8. 画面とAPIの対応表
### 新規登録画面
- `POST /auth/signup`

### ログイン画面
- `POST /auth/login`

### 状態トップ画面
- `GET /status/groups`

### 自分画面
- `GET /status/me`

### グループ詳細画面
- `GET /groups/:groupId/detail`
- `POST /status/update`
- `POST /groups/:groupId/invite-link/regenerate`

### 地図画面
- `GET /groups`
- `GET /groups/:groupId/map`
- `POST /groups`
- `POST /groups/:groupId/areas`

### エリア詳細画面
- `GET /areas/:areaId`
- `DELETE /areas/:areaId`

### エリア編集画面
- `PATCH /areas/:areaId`

### 招待URL参加確認画面
- `GET /invite-links/:token`
- `POST /invite-links/:token/join`

## 9. 補足設計
### 9.1 最終更新時刻
- 一覧には出さない
- 自分以外のユーザー押下時の簡易モーダルで利用する
- APIでは `recordedAt` を返してよい

### 9.2 状態計算の責務
表示用状態はDB保存せず、取得APIで計算する。

#### 代表表示用
- `GET /groups/:groupId/detail`
- `GET /status/me`
- `GET /status/groups`

#### 実包含用
- `GET /groups/:groupId/map`
- `GET /areas/:areaId`

### 9.3 招待URLのログイン前挙動
- 未ログイン時に招待URLを開いた場合、ログインまたは新規登録へ遷移
- 認証完了後、元の招待URL参加確認画面へ戻る

## 10. MVPで作らないAPI
- フレンド追加 / 招待API
- 他ユーザーの詳細位置取得API
- 自動更新設定API
- 通知API
- 履歴取得API
