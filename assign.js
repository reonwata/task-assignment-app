/**
 * タスク割り当てアルゴリズム
 * 出勤メンバーを3つのタスク（SIM、Case、Mail）に公平に割り当てる純粋関数
 */

/**
 * @param {Array<{id: number, alias: string, sim_count: number, case_count: number, mail_count: number}>} members
 * @returns {{sim: string[], case: string[], mail: string[]}}
 */
function assignTasks(members, selectedTasks) {
  const n = members.length;
  const tasks = selectedTasks || ['sim', 'case', 'mail'];
  const taskCount = tasks.length;
  const result = { sim: [], case: [], mail: [] };
  if (n === 0 || taskCount === 0) return result;

  const base = Math.floor(n / taskCount);
  const remainder = n % taskCount;

  // タスクの優先順位: mail → case → sim（余りはこの順に+1）
  const priority = ['mail', 'case', 'sim'].filter(t => tasks.includes(t));
  const taskSlots = {};
  let extraIdx = 0;
  for (const t of priority) {
    taskSlots[t] = base + (extraIdx < remainder ? 1 : 0);
    extraIdx++;
  }

  const assigned = new Set();
  const candidates = [];
  for (const m of members) {
    for (const t of priority) {
      candidates.push({
        member: m,
        task: t,
        count: m[t + '_count'],
        rand: Math.random()
      });
    }
  }

  candidates.sort((a, b) => a.count - b.count || a.rand - b.rand);

  for (const c of candidates) {
    if (assigned.has(c.member.id)) continue;
    if (taskSlots[c.task] <= 0) continue;
    result[c.task].push(c.member.alias);
    assigned.add(c.member.id);
    taskSlots[c.task]--;
  }

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
 * @param {{sim: string[], case: string[], mail: string[]}} assignments - 割り当て結果
 * @param {string} date - 日付文字列（YYYY/MM/DD形式）
 * @returns {string} フォーマット済みテキスト
 */
function formatAssignmentText(assignments, date) {
  const at = names => names.map(n => '@' + n).join('、');
  const lines = [
    `■ 本日（${date}）のタスク割り振り`,
    `SIM：${at(assignments.sim)}`,
    `Case：${at(assignments.case)}`,
    `Mail：${at(assignments.mail)}`
  ];
  return lines.join('\n');
}

module.exports = { assignTasks, formatAssignmentText };
