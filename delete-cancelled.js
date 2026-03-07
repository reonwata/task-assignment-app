/**
 * 取り消し済みの割り当て履歴のみを削除するスクリプト
 * 累計回数・メンバー・取り消していない履歴には一切触りません
 *
 * 使い方: node delete-cancelled.js
 */

const { initializeDatabase, getAssignments, deleteAssignment } = require('./db');

initializeDatabase();

const assignments = getAssignments();
const cancelled = assignments.filter(a => a.cancelled);

if (cancelled.length === 0) {
  console.log('取り消し済みの履歴はありません。');
} else {
  console.log('取り消し済みの履歴を削除します（' + cancelled.length + '件）:');
  for (const a of cancelled) {
    console.log('  削除: ID=' + a.id + ', 日付=' + a.date);
    deleteAssignment(a.id);
  }
  console.log('完了しました。');
}
