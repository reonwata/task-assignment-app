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
  const slots = {};
  let extraIdx = 0;
  for (const t of priority) {
    slots[t] = base + (extraIdx < remainder ? 1 : 0);
    extraIdx++;
  }

  // 各メンバーに最適なタスクを割り当てる
  // 戦略: 各メンバーの「各タスクの累積回数」を見て、回数が少ないタスクに優先配置
  const assigned = new Set();
  const taskSlots = {};
  for (const t of priority) {
    taskSlots[t] = slots[t];
  }

  // 全メンバー×全タスクの組み合わせを作り、スコア（累積回数）でソート
  const candidates = [];
  for (const m of members) {
    for (const t of priority) {
      candidates.push({
        member: m,
        task: t,
        count: m[t + '_count'],
        // 同点時のランダム化用
        rand: Math.random()
      });
    }
  }

  // ソート: 累積回数が少ない順 → 同点ならランダム
  candidates.sort((a, b) => a.count - b.count || a.rand - b.rand);

  // 貪欲法で割り当て
  for (const c of candidates) {
    if (assigned.has(c.member.id)) continue;
    if (taskSlots[c.task] <= 0) continue;
    result[c.task].push(c.member.alias);
    assigned.add(c.member.id);
    taskSlots[c.task]--;
  }

  // 万が一未割り当てのメンバーがいたら、空きのあるタスクに入れる
  for (const m of members) {
    if (assigned.has(m.id)) continue;
    for (const t of priority) {
      if (taskSlots[t] > 0) {
        result[t].push(m.alias);
        assigned.add(m.id);
        taskSlots[t]--;
        break;
      }
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
    `SIM：${at(assignments.task1)}`,
    `Case：${at(assignments.task2)}`,
    `Mail：${at(assignments.leader_other)}`
  ];
  return lines.join('\n');
}

module.exports = { assignTasks, formatAssignmentText };
