# COCO DB設計書（MVP）

## 1. 設計方針
COCO のMVPでは、保存するデータと表示時に計算するデータを分ける。

### 保存するデータ
- ユーザー
- グループ
- 所属関係
- 招待リンク
- エリア
- ユーザーの最新位置

### 表示時に計算するデータ
- 状態画面での代表エリア
- エリア外判定
- 地図画面での「いる / いない」
- エリア詳細画面のユーザー一覧

本MVPでは表示用状態テーブルは持たず、既存テーブルから都度計算する。

---

## 2. テーブル一覧
- users
- groups
- group_members
- group_invite_links
- areas
- user_locations

---

## 3. テーブル定義

### 3.1 users
ユーザー情報を保持する。

| カラム名 | 型 | NULL | 制約 | 説明 |
|---|---|---:|---|---|
| id | uuid | NO | PK | ユーザーID |
| display_name | varchar | NO |  | 表示名 |
| email | varchar | NO | UNIQUE | ログイン用メールアドレス |
| password_hash | varchar | YES |  | ハッシュ化済みパスワード。Supabase Auth利用時はアプリ側参照不要でも可 |
| icon_url | varchar | NO |  | アイコン画像URL。未設定時もデフォルト画像URLを保存する |
| created_at | timestamp | NO |  | 作成日時 |
| updated_at | timestamp | NO |  | 更新日時 |

#### 備考
- `id` は Supabase Auth に合わせて `uuid`
- `display_name` は必須
- `icon_url` は未設定でもデフォルト画像URLを保存する
- 画像本体ではなくURLのみを保存する

---

### 3.2 groups
グループ情報を保持する。

| カラム名 | 型 | NULL | 制約 | 説明 |
|---|---|---:|---|---|
| id | uuid | NO | PK | グループID |
| name | varchar | NO |  | グループ名 |
| icon_url | varchar | NO |  | グループアイコンURL。未設定時もデフォルト画像URLを保存する |
| owner_user_id | uuid | NO | FK -> users.id | グループ作成者 |
| created_at | timestamp | NO |  | 作成日時 |
| updated_at | timestamp | NO |  | 更新日時 |

#### 備考
- グループ名は必須
- グループ名の重複は許可する
- `updated_at` はグループ名またはグループアイコン変更時に更新する

---

### 3.3 group_members
ユーザーとグループの所属関係を保持する。

| カラム名 | 型 | NULL | 制約 | 説明 |
|---|---|---:|---|---|
| id | uuid | NO | PK | 所属関係ID |
| group_id | uuid | NO | FK -> groups.id | グループID |
| user_id | uuid | NO | FK -> users.id | ユーザーID |
| joined_at | timestamp | NO |  | 参加日時 |

#### 制約
- `(group_id, user_id)` は一意

#### 備考
- MVPでは role カラムは持たない
- グループ離脱は物理削除で扱う
- 離脱履歴は保持しない

---

### 3.4 group_invite_links
招待URL情報を保持する。

| カラム名 | 型 | NULL | 制約 | 説明 |
|---|---|---:|---|---|
| id | uuid | NO | PK | 招待リンクID |
| group_id | uuid | NO | FK -> groups.id | 対象グループID |
| token | varchar | NO | UNIQUE | 招待URL用トークン |
| created_by_user_id | uuid | NO | FK -> users.id | 発行者ユーザーID |
| is_active | boolean | NO |  | 有効フラグ |
| created_at | timestamp | NO |  | 作成日時 |
| updated_at | timestamp | NO |  | 更新日時 |

#### 備考
- MVPでは1グループ1有効リンクのみ
- 有効期限は持たない
- 再発行時は旧リンクを自動で無効化する
- 招待リンクの再発行は owner のみ可能

---

### 3.5 areas
グループごとの円形エリア定義を保持する。

| カラム名 | 型 | NULL | 制約 | 説明 |
|---|---|---:|---|---|
| id | uuid | NO | PK | エリアID |
| group_id | uuid | NO | FK -> groups.id | 所属グループID |
| name | varchar | NO |  | エリア名 |
| center_latitude | decimal(10,7) | NO |  | 中心緯度 |
| center_longitude | decimal(10,7) | NO |  | 中心経度 |
| radius_meters | decimal(10,2) | NO | CHECK > 0 | 半径（m） |
| created_by_user_id | uuid | NO | FK -> users.id | 作成者ユーザーID |
| created_at | timestamp | NO |  | 作成日時 |
| updated_at | timestamp | NO |  | 更新日時 |

#### 制約
- 同一グループ内での `name` 重複は不可
- `UNIQUE(group_id, name)`

#### 備考
- MVPでは円形エリアのみ
- エリア編集はMVPでは名前変更のみ
- `updated_at` はエリア名変更時に更新する

---

### 3.6 user_locations
ユーザーの最新位置情報のみを保持する。

| カラム名 | 型 | NULL | 制約 | 説明 |
|---|---|---:|---|---|
| id | uuid | NO | PK | 位置情報ID |
| user_id | uuid | NO | UNIQUE, FK -> users.id | ユーザーID |
| latitude | decimal(10,7) | NO |  | 緯度 |
| longitude | decimal(10,7) | NO |  | 経度 |
| recorded_at | timestamp | NO |  | 位置更新日時 |

#### 備考
- 各ユーザーにつき最新1件のみ保持する
- 位置更新時は上書きする
- 一度も更新していないユーザーはレコードを持たない
- 最終更新時刻は `recorded_at` を使う

---

## 4. 外部キーと削除方針

### users
- MVPでは退会を考えないため削除仕様は定義しない

### groups
- グループの所属メンバーが0人になった場合、グループを削除する
- グループ削除時は以下を連鎖削除する
  - group_members
  - group_invite_links
  - areas

### group_members
- ユーザーがグループから抜ける場合は、該当レコードを物理削除する

### group_invite_links
- グループ削除時に削除される
- 再発行時は旧リンクを `is_active = false` に更新する

### areas
- グループ削除時に削除される
- エリア削除時、そのエリアに関する表示は消えてよい

### user_locations
- ユーザーに最新位置がない場合はレコードなしで表現する

---

## 5. 画面表示用の計算ルール

### 5.1 グループ詳細画面
- 対象グループ内で各ユーザーの最新位置とエリア群を照合する
- 複数エリアに属する場合、最も狭いエリアを代表表示エリアとする
- どのエリアにも属さない場合は「エリア外」とする

### 5.2 状態トップ画面
- 各グループについて、自分以外の更新済みユーザーのうち、いずれかのエリアに属しているユーザーが1人以上いれば「いる」
- そうでなければ「いない」

### 5.3 自分画面
- 代表表示エリアが存在すれば「エリア内」
- 存在しなければ「エリア外」

### 5.4 地図画面
- 地図画面では実包含ベースで判定する
- 同一グループ内で複数エリアに属するユーザーは、該当するすべてのエリアで「いる」と扱う

### 5.5 エリア詳細画面
- 当該エリアの範囲内にいるユーザーを一覧表示する
- 重複エリアに属するユーザーは、該当するすべてのエリア詳細画面に表示されうる

---

## 6. 並び順仕様

### 状態トップ画面のグループ一覧
- そのグループに属する誰かの最新位置情報更新時刻順で表示する
- 将来的には優先表示設定を追加可能とする

### その他一覧
- 基本は時刻順とする

---

## 7. 補足
- アイコン画像はDBにバイナリ保存せず、外部ストレージURLのみ保持する
- 位置履歴はMVPでは保持しない
- 表示用状態テーブルは持たず、既存データから都度計算する
