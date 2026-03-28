# タスク割り当てツール — プロジェクトコンテキスト

移行・引き継ぎ用ドキュメント。ツールの全体像、仕様、変更履歴、注意事項をまとめたもの。

---

## 1. プロジェクト概要

チーム内の日次固定タスク（タスク1、タスク2、Leader&Other）を、出勤メンバーに公平に自動割り当てするWebアプリ。
毎朝、代表者1名がブラウザからアクセスし、出勤メンバーにチェックを入れて「割り当て実行」を押すだけで使える。

### 解決している課題
- 以前はQuickSuite（AIチャット）にプロンプトを貼り付けて割り振りしていたが、累計回数を毎回手動で更新する必要があった
- このツールは累計タスク回数を自動で記憶するため、手動更新が不要
- 同じタスクばかり割り振られる偏りを防止

### 技術スタック
- バックエンド: Cloudflare Workers + Hono（メイン本番環境）
- ローカル開発: Node.js + Express（server.js / db.js）
- データベース: Turso（libSQL、永続化）
- フロントエンド: 素のHTML/CSS/JavaScript（フレームワークなし）
- ホスティング: Cloudflare Workers（無料プラン、長期利用可能）
- リポジトリ: https://github.com/reonwata/task-assignment-app
- 本番URL: https://task-assignment-app.reonwata.workers.dev
- Turso DB: libsql://task-assignment-app-reonwata.aws-ap-northeast-1.turso.io

---

## 2. ファイル構成

```
├── worker.js              # Cloudflare Workers エントリーポイント（Hono + Turso）
├── server.js              # Express サーバー（ローカル開発 / Railway フォールバック用）
├── db.js                  # SQLite データベース操作（ローカル開発用）
├── assign.js              # 割り当てアルゴリズム（純粋関数、worker.jsにもインライン実装あり）
├── wrangler.toml          # Cloudflare Workers 設定
├── package.json           # 依存関係
├── public/
│   ├── index.html         # メインページ（割り当て実行、タスク選択、履歴、メンバー管理）
│   └── counts.html        # 累積タスク回数の表示・編集ページ
├── delete-cancelled.js    # 取り消し済み履歴をローカルDBから削除するスクリプト
├── reset-data.js          # ローカルDB全データリセットスクリプト
├── seed-history.js        # シードデータ投入スクリプト
├── tests/
│   ├── assign.test.js     # 割り当てアルゴリズムの単体テスト
│   └── assign.property.test.js  # プロパティベーステスト
├── PROJECT_CONTEXT.md     # このドキュメント
└── .kiro/specs/           # Kiro spec ファイル
```

---

## 3. データベース構造

### members テーブル
| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER PK | 自動採番 |
| alias | TEXT UNIQUE | メンバーのエイリアス名 |
| task1_count | INTEGER | タスク1の累積回数 |
| task2_count | INTEGER | タスク2の累積回数 |
| leader_other_count | INTEGER | Leader&Otherの累積回数 |

### assignments テーブル
| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER PK | 自動採番 |
| date | TEXT | 割り当て日（YYYY-MM-DD） |
| cancelled | INTEGER | 取り消しフラグ（0=有効, 1=取り消し済み） |
| created_at | TEXT | 作成日時 |

### assignment_details テーブル
| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER PK | 自動採番 |
| assignment_id | INTEGER FK | assignments.id |
| member_id | INTEGER FK | members.id |
| task | TEXT | タスク名（task1, task2, leader_other） |

---

## 4. 割り当てアルゴリズム（assign.js / worker.js内）

### ロジック（3タスク選択時）
1. 出勤メンバー数 n を3で割り、各タスクの人数を決定
   - base = floor(n / 3)
   - 余り1人 → Leader&Otherに+1
   - 余り2人 → Leader&Otherに+1、タスク2に+1
   - つまり人数が均等でない場合: Leader&Other ≥ タスク2 ≥ タスク1
2. Leader&Other → leader_other_count が少ない順に割り当て
3. タスク2 → 残りメンバーから task2_count が少ない順に割り当て
4. タスク1 → 残り全員

### タスク選択機能（2タスク / 1タスク選択時）
- ユーザーが実行するタスクを選択可能（タスク1、タスク2、Leader&Other）
- 選択されたタスク数で人数を分割
- 優先順位: leader_other → task2 → task1
- 選択されなかったタスクは空配列（履歴では「—」表示）

### 重要な仕様
- 割り当ては累積回数に基づく公平性を保証
- 同じ累積回数の場合、ソートの安定性に依存（完全ランダムではない）
- 割り当て実行時に累積回数が自動で+1される
- 取り消し時に累積回数が自動で-1される（0未満にはならない）

---

## 5. APIエンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | /api/members | メンバー一覧取得 |
| POST | /api/members | メンバー追加（body: {alias}） |
| DELETE | /api/members/:id | メンバー削除 |
| PUT | /api/members/:id/counts | 累積回数更新（body: {task, count}） |
| POST | /api/reset | 累積回数一括リセット |
| POST | /api/assign | 割り当て実行（body: {memberIds: [], selectedTasks: []}） |
| GET | /api/assignments | 割り当て履歴取得（古い順） |
| PUT | /api/assignments/:id/cancel | 割り当て取り消し |
| DELETE | /api/assignments/:id | 取り消し済み割り当て削除 |
| POST | /api/reseed | シードデータ再投入（Turso DB初期化用） |
| GET | /api/debug | DB状態確認（メンバー数、履歴数、詳細数） |

---

## 6. UI機能一覧（public/index.html）

### メインページ
- 使い方ガイド（ページ上部に常時表示、3ステップ）
- 出勤メンバー選択（チェックボックス、全員選択/全員解除ボタン）
- 今日のタスク選択（チェックボックス: タスク1、タスク2、Leader＆Other、デフォルト全選択）
- 割り当て実行ボタン（確認ダイアログあり）
- 割り当て結果表示 + コピーボタン（選択されたタスクのみ表示）
- 累積タスク回数ページへのリンク
- メンバー管理（折りたたみ式アコーディオン）
  - メンバー追加（エイリアス入力）
  - メンバー削除（確認ダイアログあり）
- 割り当て履歴（折りたたみ式アコーディオン）
  - 取り消しボタン（確認ダイアログあり）
  - 取り消し済みは半透明表示 + バッジ
  - メンバーなしのタスクは「—」表示

### 累積タスク回数ページ（counts.html）
- 全メンバーの累積回数一覧テーブル
- 各回数を直接編集可能（確認ダイアログあり）
- 全リセットボタン（確認ダイアログあり）
- メインページへの戻りリンク

---

## 7. 表示フォーマット

### 割り当て結果（コピー用テキスト）
```
■ 本日（2026/03/08）のタスク割り振り
タスク1：@ryoanz、@reonwata
タスク2：@sakagyun、@takumr、@wyamash、@sagawa
Leader＆Other：@nozayuka、@uekeisu、@koniryo、@nyunn、@sawmadok
```
- エイリアスには `@` プレフィックスが付く（Slackメンション対応）
- 区切りは「、」（読点）
- 日付はYYYY/MM/DD形式
- 選択されなかったタスクはコピーテキストに含まれない

### 履歴表示
- 日付はYYYY/MM/DD形式
- エイリアスに `@` は付かない
- 区切りは「、」（読点）
- メンバーなしのタスクは「—」表示

---

## 8. 初期メンバー一覧（25名）

nozayuka, yosihatt, uekeisu, koniryo, yonghyun, sawmadok, riikaa, sakagyun, nyunn, yamshoic, daikikk, cseungj, sagawa, takumr, ryoanz, wyamash, yamkohe, yosmi, isswada, mizoyuka, kitetsu, curakawa, reonwata, ayakura, yuukaigt

---

## 9. 日付処理

- Cloudflare Workers上では `new Date()` はUTCを返す
- 日本時間（JST, UTC+9）で日付を生成するため、手動オフセット
- `new Date(now.getTime() + 9 * 60 * 60 * 1000)` でJST変換

---

## 10. Cloudflare Workers + Turso 固有の注意事項

### サブリクエスト制限
- Cloudflare Workers無料プランは1リクエストあたり50サブリクエスト制限
- 全DB操作はこの制限内に収まるよう最適化済み
- `db.batch()` を使用してクエリをまとめる（`db.transaction()` はCF Workers上のTursoでは非対応）
- シードデータは `initializeDatabase` では投入しない（制限回避のため `/api/reseed` で手動投入）

### 最適化ポイント
- メンバーINSERTはbatch化
- `getAssignments` は2クエリ（N+1回避）
- `saveAssignment` は1 SELECT + 1 INSERT + 1 batch
- `/api/assign` は全メンバーを1クエリで取得

### デプロイ（自動）
- GitHub Actionsで自動デプロイ設定済み（.github/workflows/deploy.yml）
- `git push origin main` するだけでCloudflare Workersに自動デプロイされる
- GitHub Secrets: `CLOUDFLARE_API_TOKEN`（Cloudflare API Token、workflowスコープ付き）
- 手動デプロイも可能: `npx wrangler deploy`

### シードデータ再投入（DB初期化が必要な場合のみ）
```
curl -X POST https://task-assignment-app.reonwata.workers.dev/api/reseed
```

### DB状態確認
```
curl https://task-assignment-app.reonwata.workers.dev/api/debug
```

### Secrets（Cloudflare Workers）
- `TURSO_DATABASE_URL` — Turso接続URL
- `TURSO_AUTH_TOKEN` — Turso認証トークン
- 設定: `npx wrangler secret put <SECRET_NAME>`

---

## 11. デプロイ・運用上の注意事項

### Turso DBは永続化
- Railwayと異なり、Turso DBはデプロイしてもデータが消えない
- シードデータの更新はDB初期化時のみ必要（通常のpushでは不要）

### GitHubへのpush手順
```
cd C:\work\固定タスク
git add .
git commit -m "コミットメッセージ"
git push origin main
```
- GitHubのパスワード入力時はPAT（Personal Access Token）を使用

### wrangler.toml設定
- `main = "worker.js"` — エントリーポイント
- `[assets] directory = "./public"` — 静的ファイル配信
- `compatibility_flags = ["nodejs_compat"]` — Node.js互換モード

---

## 12. シードデータ（3/3〜3/10）

worker.js と server.js の両方にシードデータを保持。現在8日分:
- 3/3〜3/8: 全3タスク割り当て
- 3/9: タスク2 + Leader&Other のみ（タスク1なし）
- 3/10: タスク1 + Leader&Other のみ（タスク2なし）

---

## 13. 変更履歴

| 日付 | 内容 |
|------|------|
| 3/3 | 初期実装完了。メンバー選択、割り当て実行、累積回数管理、履歴、取り消し機能 |
| 3/3 | エイリアスに@プレフィックス追加（Slackメンション対応） |
| 3/3 | 全破壊的操作に確認ダイアログ追加 |
| 3/3 | 累積タスク回数を別ページ（counts.html）に分離 |
| 3/3 | UIタイトルを「タスク割り当てツール」に変更、使い方ガイド追加 |
| 3/3 | メンバー管理・履歴セクションを折りたたみ式アコーディオンに変更 |
| 3/3 | Railwayにデプロイ |
| 3/4 | 日付のタイムゾーンをJST（UTC+9）に修正 |
| 3/4 | 履歴の並び順を時系列順（古い順）に変更 |
| 3/5 | テストデータ削除の仕組み構築 |
| 3/5 | delete-cancelled.js作成（ローカルDB用の取り消し済み履歴削除スクリプト） |
| 3/7 | 区切り文字の変更作業（Slackメンション対応関連） |
| 3/8 | DB初期化によるデータ消失 → シードデータに3/5〜3/7を追加して復旧 |
| 3/10 | Railway → Cloudflare Workers + Hono + Turso に移行（無料・永続化） |
| 3/10 | タスク選択機能追加（実行するタスクをチェックボックスで選択可能） |
| 3/10 | 3/9〜3/10のシードデータ追加 |
| 3/27 | タスク表示名をSIM/Case/Mailに変更（表示のみ、DB変更なし） |
| 3/27 | GitHub Actions自動デプロイ設定（git push → 自動wrangler deploy） |

---

## 14. やってはいけないこと（禁止事項）

1. 修正時に修正点以外の機能や表示を変更しない — ユーザーからの明確な指示
2. 取り消していない履歴や累積回数を誤って削除しない
3. npm/node コマンドをKiro環境内で実行しない — PATHに入っていない
4. 長時間実行コマンド（npm run dev等）をKiro内で実行しない
5. Cloudflare Workers の50サブリクエスト制限を超えるDB操作を書かない

---

## 15. インフラ制限・料金まとめ（2026年3月時点）

### Cloudflare Workers（無料プラン）
- Workerの数: 無制限
- リクエスト: 1日10万リクエスト（静的アセットはカウント外・無制限）
- CPU時間: 1リクエストあたり10ms
- デプロイ: 無制限
- 料金: 無料

### Turso（無料 Starterプラン）
- DB数: 月間アクティブ3個まで
- ストレージ: 500MB
- 行読み取り: 月500万行
- 行書き込み: 月25万行
- 10日間アクセスなしでDBがアーカイブ（自動復帰、データは消えない）
- Point-in-Time Recovery: 過去24時間のみ
- 料金: 無料

### GitHub（無料プラン）
- リポジトリ数: 無制限（パブリック・プライベート両方）
- GitHub Actions: 月2,000分（パブリックリポジトリは無制限）
- ストレージ: リポジトリあたり推奨5GB以下
- 料金: 無料

### 今後の新規ツール構築テンプレート
同じ構成（Cloudflare Workers + Turso + 単一HTML）で新しいツールを作る場合：
1. GitHubに新リポジトリ作成
2. wrangler.toml + worker.js + public/ の構成で実装
3. Turso DBを作成（無料枠3個まで。超える場合は既存DBにテーブル追加）
4. Cloudflare Workers Secrets に TURSO_DATABASE_URL, TURSO_AUTH_TOKEN を設定
5. GitHub Secrets に CLOUDFLARE_API_TOKEN を設定（既存トークン再利用可）
6. .github/workflows/deploy.yml を配置（git push で自動デプロイ）

---

## 16. 今後の予定（タスク割り当てツール）

- タスク名をSIM/Case/Mailに完全移行（DB含む）
- 既存社員のエイリアスを追加（NHメンバーだけでなくチーム全体）
- 累積回数リセット（新タスク名での運用開始時）
- 鯨岡さんとの要件すり合わせ後にブラッシュアップ

---

## 17. ユーザー（reonwata）の運用スタイル

- 開発者ではないため、コマンドライン操作はステップバイステップで案内が必要
- 作業環境: Windows 10, bash shell, ワークスペース `C:\work\固定タスク`
- GitHub: reonwata, push時にPATトークンをパスワードとして入力
- Cloudflareアカウント: Reonwata@amazon.co.jp, サブドメイン: reonwata.workers.dev
- UIテキスト・エラーメッセージは全て日本語
- 絵文字は業務メッセージでは使わない
- 変更は慎重に、既存機能を壊さないことを最優先
