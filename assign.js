/**
 * タスク割り当てアルゴリズム
 * 出勤メンバーを3つのタスク（タスク1、タスク2、Leader&Other）に公平に割り当てる純粋関数
 */

/**
 * @param {Array<{id: number, alias: string, task1_count: number, task2_count: number, leader_other_count: number}>} members
 * @returns {{task1: string[], task2: string[], leader_other: string[]}}
 */
function assignTasks(members, selectedTasks) {
  const n = members.length;
  const tasks = selectedTasks || ['task1', 'task2', 'leader_other'];
  const taskCount = tasks.length;
  const result = { task1: [], task2: [], leader_other: [] };
  if (n === 0 || taskCount === 0) return result;

  const base = Math.floor(n / taskCount);
  const remainder = n % taskCount;

  // タスクの優先順位: leader_other → task2 → task1（余りはこの順に+1）
  const priority = ['leader_other', 'task2', 'task1'].filter(t => tasks.includes(t));
  const counts = {};
  let extraIdx = 0;
  for (const t of priority) {
    counts[t] = base + (extraIdx < remainder ? 1 : 0);
    extraIdx++;
  }

  const remaining = [...members];

  // 優先順位順に割り当て（累積回数が少ない人から）
  for (const t of priority) {
    if (counts[t] > 0 && remaining.length > 0) {
      remaining.sort((a, b) => a[t + '_count'] - b[t + '_count']);
      result[t] = remaining.splice(0, counts[t]).map(m => m.alias);
    }
  }

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
