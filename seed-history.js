/**
 * 3/3と3/4の割り当て履歴を投入するスクリプト
 * saveAssignment を使うので累積回数も自動で加算される
 */
const { initializeDatabase, saveAssignment } = require('./db');

initializeDatabase();

// 3/3の割り当て
saveAssignment('2026-03-03', {
  task1: ['uekeisu', 'kitetsu', 'sakagyun', 'yamshoic', 'yamkohe', 'yuukaigt'],
  task2: ['koniryo', 'riikaa', 'nyunn', 'ryoanz', 'curakawa'],
  leader_other: ['isswada', 'yonghyun', 'cseungj', 'wyamash', 'ayakura']
});

console.log('3/3 の割り当てを登録しました');

// 3/4の割り当て
saveAssignment('2026-03-04', {
  task1: ['sawmadok', 'daikikk', 'sagawa', 'yosmi', 'reonwata'],
  task2: ['koniryo', 'riikaa', 'nyunn', 'yamshoic', 'kitetsu'],
  leader_other: ['yonghyun', 'cseungj', 'wyamash', 'yamkohe', 'isswada']
});

console.log('3/4 の割り当てを登録しました');
console.log('完了: 履歴と累積回数が反映されました');
