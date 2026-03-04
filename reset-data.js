/**
 * データリセットスクリプト
 * 累積回数を全て0に、割り当て履歴を全て削除する
 * メンバー一覧はそのまま残る
 */
const Database = require('better-sqlite3');
const db = new Database('task-assignment.db');

db.pragma('foreign_keys = ON');

// 割り当て詳細を全削除
db.prepare('DELETE FROM assignment_details').run();
// 割り当て履歴を全削除
db.prepare('DELETE FROM assignments').run();
// 累積回数を全て0にリセット
db.prepare('UPDATE members SET task1_count = 0, task2_count = 0, leader_other_count = 0').run();

console.log('リセット完了: 累積回数を0に、割り当て履歴を全削除しました。');
db.close();
