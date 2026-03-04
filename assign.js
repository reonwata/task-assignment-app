/**
 * タスク割り当てアルゴリズム
 * 出勤メンバーを3つのタスク（タスク1、タスク2、Leader&Other）に公平に割り当てる純粋関数
 */

/**
 * @param {Array<{id: number, alias: string, task1_count: number, task2_count: number, leader_other_count: number}>} members
 * @returns {{task1: string[], task2: string[], leader_other: string[]}}
 */
function assignTasks(members) {
  const n = members.length;
  if (n === 0) {
    return { task1: [], task2: [], leader_other: [] };
  }

  const base = Math.floor(n / 3);
  const remainder = n % 3;

  const leaderOtherCount = base + (remainder >= 1 ? 1 : 0);
  const task2Count = base + (remainder >= 2 ? 1 : 0);
  const task1Count = base;

  const remaining = [...members];
  const result = { task1: [], task2: [], leader_other: [] };

  // Leader&Other — leader_other_count昇順で割り当て
  remaining.sort((a, b) => a.leader_other_count - b.leader_other_count);
  const leaderOtherMembers = remaining.splice(0, leaderOtherCount);
  result.leader_other = leaderOtherMembers.map(m => m.alias);

  // タスク2 — task2_count昇順で割り当て
  remaining.sort((a, b) => a.task2_count - b.task2_count);
  const task2Members = remaining.splice(0, task2Count);
  result.task2 = task2Members.map(m => m.alias);

  // タスク1 — task1_count昇順で割り当て
  remaining.sort((a, b) => a.task1_count - b.task1_count);
  const task1Members = remaining.splice(0, task1Count);
  result.task1 = task1Members.map(m => m.alias);

  return result;
}

/**
 * 割り当て結果をコピー用テキストにフォーマットする純粋関数
 * @param {{task1: string[], task2: string[], leader_other: string[]}} assignments - 割り当て結果
 * @param {string} date - 日付文字列（YYYY/MM/DD形式）
 * @returns {string} フォーマット済みテキスト
 */
function formatAssignmentText(assignments, date) {
  const at = names => names.map(n => '@' + n).join('、');
  const lines = [
    `■ 本日（${date}）のタスク割り振り`,
    `タスク1：${at(assignments.task1)}`,
    `タスク2：${at(assignments.task2)}`,
    `Leader＆Other：${at(assignments.leader_other)}`
  ];
  return lines.join('\n');
}

module.exports = { assignTasks, formatAssignmentText };
