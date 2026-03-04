# 実装計画: タスク割り当てアプリ

## 概要

Node.js + Express + SQLiteによるタスク割り当てWebアプリケーションの実装計画。バックエンドのコアロジック（割り当てアルゴリズム、DB操作）から着手し、APIエンドポイント、フロントエンドの順に構築する。各ステップでテストを組み込み、段階的に機能を統合する。

## タスク

- [x] 1. プロジェクト初期化とコアインターフェース定義
  - [x] 1.1 package.jsonを作成し、依存関係（express, better-sqlite3）と開発依存関係（jest, fast-check）を定義する
    - scriptsにtestコマンド（jest）を設定
    - _Requirements: 7.3_

  - [x] 1.2 assign.jsを作成し、割り当てアルゴリズム（assignTasks関数）を純粋関数として実装する
    - 入力: メンバー配列 `[{ id, alias, task1_count, task2_count, leader_other_count }]`
    - 出力: `{ task1: [alias, ...], task2: [alias, ...], leader_other: [alias, ...] }`
    - base = Math.floor(n / 3), remainder = n % 3 で人数分配
    - 割り当て順序: Leader&Other → タスク2 → タスク1
    - 各タスクで累積回数が少ないメンバーを優先
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.3 assign.property.test.jsを作成し、割り当てアルゴリズムのプロパティテストを実装する
    - **Property 1: 全メンバーの割り当て完全性** — 全出勤メンバーがいずれか1つのタスクに重複なく割り当てられること
    - **Validates: Requirements 2.1**
    - **Property 2: タスク人数の正確な分配** — base/remainderに基づく各タスクの人数が正しいこと
    - **Validates: Requirements 2.2, 2.3**
    - **Property 3: 累積回数優先割り当て** — 各タスクに割り当てられたメンバーの累積回数が、割り当てられなかったメンバー以下であること
    - **Validates: Requirements 2.4**

  - [x] 1.4 assign.test.jsを作成し、割り当てアルゴリズムのユニットテストを実装する
    - 3名ちょうどの場合（各タスク1名）
    - 余り1名の場合（Leader&Otherに+1）
    - 余り2名の場合（Leader&Other, タスク2に各+1）
    - 1名のみの場合
    - 累積回数が異なるメンバーの優先割り当て確認
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. チェックポイント - 割り当てアルゴリズムの検証
  - 全てのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 3. データベースモジュールの実装
  - [x] 3.1 db.jsを作成し、SQLiteデータベースの初期化と全データ操作関数を実装する
    - initializeDatabase(): members, assignments, assignment_detailsテーブル作成、25名の初期データ投入
    - getMembers(): メンバー一覧と累積回数取得
    - getMemberById(id): 特定メンバー取得
    - addMember(alias): メンバー追加（重複チェック付き）
    - deleteMember(id): メンバー削除
    - updateTaskCount(id, task, count): 累積回数更新（バリデーション付き）
    - incrementTaskCounts(assignments): 割り当て後の累積回数一括増加
    - decrementTaskCounts(assignmentId): 取り消し時の累積回数一括減少
    - resetAllCounts(): 全累積回数リセット
    - saveAssignment(date, assignments): 割り当て履歴保存
    - getAssignments(): 割り当て履歴取得（日付降順）
    - cancelAssignment(id): 割り当て取り消し（取り消し済みチェック付き）
    - 割り当て実行時はトランザクションで累積回数更新と履歴保存を一括処理
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.1, 8.5, 9.2, 9.3, 9.5, 10.2, 10.5, 11.3_

  - [ ]* 3.2 db.property.test.jsを作成し、DB操作のプロパティテストを実装する
    - **Property 4: 割り当て・取り消しのラウンドトリップ** — 割り当て実行後に取り消すと累積回数が元に戻ること
    - **Validates: Requirements 2.6, 9.2**
    - **Property 5: 累積回数更新のラウンドトリップ** — 累積回数を更新後に取得すると更新値と一致すること
    - **Validates: Requirements 4.3, 5.1**
    - **Property 6: 不正リクエストのエラーレスポンス** — 不正な入力に対してエラーをスローすること
    - **Validates: Requirements 6.4**
    - **Property 7: 割り当て履歴の保存と取得** — 割り当て実行後に履歴取得すると全情報が含まれること
    - **Validates: Requirements 8.1, 8.5**
    - **Property 8: 履歴の日付降順** — 複数回割り当て後、履歴が作成日時の降順で並ぶこと
    - **Validates: Requirements 8.2**
    - **Property 9: 取り消し済みマーク** — 取り消し実行でcancelledフラグがtrue、再取り消しはエラーとなること
    - **Validates: Requirements 9.3, 9.5**
    - **Property 10: メンバー追加・削除のラウンドトリップ** — メンバー追加で累積回数0登録、削除で一覧から消えること
    - **Validates: Requirements 10.2, 10.5**
    - **Property 11: 累積回数一括リセット** — リセット実行で全メンバーの全累積回数がゼロになること
    - **Validates: Requirements 11.3**

  - [ ]* 3.3 db.test.jsを作成し、DB操作のユニットテストを実装する
    - 初期化時に25名が登録されること
    - 重複エイリアスでのメンバー追加がエラーになること
    - 存在しないメンバーIDでの操作がエラーになること
    - 無効なタスク名での累積回数更新がエラーになること
    - 負の累積回数での更新がエラーになること
    - 取り消し済み割り当ての再取り消しがエラーになること
    - _Requirements: 4.3, 4.5, 5.1, 5.2, 5.3, 6.4, 9.5, 10.7_

- [x] 4. チェックポイント - データベースモジュールの検証
  - 全てのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 5. コピーテキストフォーマット関数の実装
  - [x] 5.1 assign.jsにformatAssignmentText関数を追加する（純粋関数としてエクスポート）
    - 入力: 割り当て結果オブジェクトと日付文字列
    - 出力: 「■ 本日（YYYY/MM/DD）のタスク割り振り\nタスク1：〇〇、〇〇\nタスク2：〇〇、〇〇\nLeader＆Other：〇〇、〇〇」形式のテキスト
    - _Requirements: 13.2, 13.5_

  - [ ]* 5.2 format.property.test.jsを作成し、フォーマット関数のプロパティテストを実装する
    - **Property 12: コピーテキストフォーマット** — 生成テキストが所定フォーマットに従い、全メンバー名と正しい日付を含むこと
    - **Validates: Requirements 13.2, 13.5**

  - [ ]* 5.3 format.test.jsを作成し、フォーマット関数のユニットテストを実装する
    - 各タスク1名ずつの基本ケース
    - 各タスク複数名のケース
    - 日付フォーマット（YYYY/MM/DD）の確認
    - _Requirements: 13.2, 13.5_

- [x] 6. Expressサーバーと全APIエンドポイントの実装
  - [x] 6.1 server.jsを作成し、Expressアプリケーションと全8つのAPIエンドポイントを実装する
    - Express初期化、静的ファイル配信（public/ディレクトリ）
    - GET /api/members — メンバー一覧取得
    - POST /api/members — メンバー追加（エイリアス名バリデーション）
    - DELETE /api/members/:id — メンバー削除
    - POST /api/assign — タスク割り当て実行（assign.jsのassignTasks呼び出し、DB保存）
    - PUT /api/members/:id/counts — 累積回数更新（タスク名・回数バリデーション）
    - POST /api/reset — 累積回数一括リセット
    - GET /api/assignments — 割り当て履歴取得
    - PUT /api/assignments/:id/cancel — 割り当て取り消し
    - 全APIレスポンスはJSON形式
    - エラーハンドリング: 適切なHTTPステータスコード（400, 404, 409, 500）
    - サーバー起動（ポート3000）
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.4, 9.6, 10.8, 10.9, 11.6_

- [x] 7. チェックポイント - バックエンド全体の検証
  - 全てのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 8. フロントエンドの実装
  - [x] 8.1 public/index.htmlを作成し、全6セクションを含む単一HTMLファイルを実装する
    - 出勤メンバー選択エリア: チェックボックス付きメンバー一覧、全員選択/全員解除ボタン
    - 割り当て実行ボタン
    - 割り当て結果表示エリア: 結果表示 + コピーボタン
    - 累積タスク回数一覧: 編集可能テーブル + リセットボタン
    - メンバー管理エリア: 追加フォーム + 削除ボタン
    - 割り当て履歴エリア: 履歴一覧 + 取り消しボタン
    - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.3, 7.4, 12.1, 12.2_

  - [x] 8.2 index.html内のJavaScriptでAPI通信と全UI操作を実装する
    - ページ読み込み時にGET /api/membersでメンバー一覧取得・表示
    - チェックボックスによる出勤メンバー選択
    - 全員選択/全員解除ボタンの動作
    - 割り当て実行ボタン → POST /api/assign → 結果表示
    - コピーボタン → formatAssignmentTextと同等のフォーマットでクリップボードにコピー
    - 累積回数の編集 → PUT /api/members/:id/counts
    - リセットボタン → 確認ダイアログ → POST /api/reset
    - メンバー追加 → POST /api/members
    - メンバー削除 → DELETE /api/members/:id
    - 履歴表示 → GET /api/assignments
    - 割り当て取り消し → PUT /api/assignments/:id/cancel
    - 全fetch呼び出しでtry-catchによるエラーハンドリング
    - 成功/エラー通知の表示
    - _Requirements: 1.1, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.4, 4.5, 8.2, 8.3, 9.1, 9.4, 9.5, 10.1, 10.3, 10.4, 10.6, 10.7, 11.1, 11.2, 11.4, 11.5, 12.3, 12.4, 12.5, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 9. 最終チェックポイント - 全体統合の検証
  - 全てのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きのタスクはオプションであり、MVP実装時にはスキップ可能
- 各タスクは対応する要件番号を参照しており、トレーサビリティを確保
- チェックポイントで段階的に動作を検証
- プロパティテストは設計書の正当性プロパティ（Property 1〜12）に対応
- ユニットテストは具体的な例とエッジケースを検証
