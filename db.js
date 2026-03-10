/**
 * データベースモジュール（Turso / libSQL対応）
 * クラウドSQLiteデータベースの初期化と全データ操作を提供する
 */

const { createClient } = require('@libsql/client');

const VALID_TASKS = ['task1', 'task2', 'leader_other'];

const INITIAL_MEMBERS = [
  'nozayuka', 'yosihatt', 'uekeisu', 'koniryo', 'yonghyun',
  'sawmadok', 'riikaa', 'sakagyun', 'nyunn', 'yamshoic',
  'daikikk', 'cseungj', 'sagawa', 'takumr', 'ryoanz',
  'wyamash', 'yamkohe', 'yosmi', 'isswada', 'mizoyuka',
  'kitetsu', 'curakawa', 'reonwata', 'ayakura', 'yuukaigt'
];

let db;

/**
 * データベースを初期化する
 * @returns {object} libSQL クライアントインスタンス
 */
async function initializeDatabase() {
  db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:task-assignment.db',
    authToken: process.env.TURSO_AUTH_TOKEN || undefined
  });

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alias TEXT NOT NULL UNIQUE,
      task1_count INTEGER NOT NULL DEFAULT 0,
      task2_count INTEGER NOT NULL DEFAULT 0,
      leader_other_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      cancelled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS assignment_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      task TEXT NOT NULL,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);

  // 初期メンバーが未登録の場合のみ投入
  const count = await db.execute('SELECT COUNT(*) as count FROM members');
  if (count.rows[0].count === 0) {
    for (const alias of INITIAL_MEMBERS) {
      await db.execute({ sql: 'INSERT INTO members (alias) VALUES (?)', args: [alias] });
    }
  }

  return db;
}

/**
 * 現在のDBインスタンスを取得する（テスト用）
 */
function getDb() {
  return db;
}

/**
 * メンバー一覧と累積回数を取得する
 */
async function getMembers() {
  const result = await db.execute('SELECT id, alias, task1_count, task2_count, leader_other_count FROM members ORDER BY id');
  return result.rows;
}

/**
 * 特定メンバーを取得する
 */
async function getMemberById(id) {
  const result = await db.execute({ sql: 'SELECT id, alias, task1_count, task2_count, leader_other_count FROM members WHERE id = ?', args: [id] });
  if (result.rows.length === 0) {
    throw new Error('メンバーが見つかりません');
  }
  return result.rows[0];
}

/**
 * メンバーを追加する
 */
async function addMember(alias) {
  if (!alias || typeof alias !== 'string' || alias.trim().length === 0) {
    throw new Error('エイリアス名は必須です');
  }
  const trimmed = alias.trim();
  // 重複チェック
  const existing = await db.execute({ sql: 'SELECT id FROM members WHERE alias = ?', args: [trimmed] });
  if (existing.rows.length > 0) {
    throw new Error('このエイリアス名は既に登録されています');
  }
  const result = await db.execute({ sql: 'INSERT INTO members (alias) VALUES (?)', args: [trimmed] });
  return getMemberById(Number(result.lastInsertRowid));
}

/**
 * メンバーを削除する
 */
async function deleteMember(id) {
  await getMemberById(id);
  await db.execute({ sql: 'DELETE FROM members WHERE id = ?', args: [id] });
}

/**
 * 累積回数を更新する
 */
async function updateTaskCount(id, task, count) {
  if (!VALID_TASKS.includes(task)) {
    throw new Error('無効なタスク名です');
  }
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('累積回数は非負整数である必要があります');
  }
  await getMemberById(id);
  const column = task + '_count';
  await db.execute({ sql: `UPDATE members SET ${column} = ? WHERE id = ?`, args: [count, id] });
  return getMemberById(id);
}

/**
 * 割り当て履歴を保存し、累積回数を一括増加する
 */
async function saveAssignment(date, assignments) {
  const tx = await db.transaction('write');
  try {
    const assignResult = await tx.execute({ sql: 'INSERT INTO assignments (date) VALUES (?)', args: [date] });
    const assignmentId = Number(assignResult.lastInsertRowid);
    const details = [];

    for (const task of VALID_TASKS) {
      const aliases = assignments[task] || [];
      for (const alias of aliases) {
        const memberResult = await tx.execute({ sql: 'SELECT id FROM members WHERE alias = ?', args: [alias] });
        if (memberResult.rows.length === 0) {
          throw new Error(`メンバーが見つかりません: ${alias}`);
        }
        const memberId = memberResult.rows[0].id;
        await tx.execute({ sql: 'INSERT INTO assignment_details (assignment_id, member_id, task) VALUES (?, ?, ?)', args: [assignmentId, memberId, task] });
        details.push({ alias, task });
        const column = task + '_count';
        await tx.execute({ sql: `UPDATE members SET ${column} = ${column} + 1 WHERE id = ?`, args: [memberId] });
      }
    }

    await tx.commit();
    return { id: assignmentId, date, cancelled: false, details };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/**
 * 取り消し時の累積回数一括減少
 */
async function decrementTaskCounts(assignmentId) {
  const details = await db.execute({
    sql: `SELECT ad.member_id, ad.task, m.alias
          FROM assignment_details ad
          JOIN members m ON ad.member_id = m.id
          WHERE ad.assignment_id = ?`,
    args: [assignmentId]
  });
  for (const detail of details.rows) {
    const column = detail.task + '_count';
    await db.execute({ sql: `UPDATE members SET ${column} = MAX(${column} - 1, 0) WHERE id = ?`, args: [detail.member_id] });
  }
}

/**
 * 全累積回数をリセットする
 */
async function resetAllCounts() {
  await db.execute('UPDATE members SET task1_count = 0, task2_count = 0, leader_other_count = 0');
}

/**
 * 割り当て履歴を取得する（作成日時の昇順）
 */
async function getAssignments() {
  const assignments = await db.execute('SELECT id, date, cancelled, created_at FROM assignments ORDER BY created_at ASC');
  const result = [];
  for (const a of assignments.rows) {
    const details = await db.execute({
      sql: `SELECT m.alias, ad.task
            FROM assignment_details ad
            JOIN members m ON ad.member_id = m.id
            WHERE ad.assignment_id = ?`,
      args: [a.id]
    });
    result.push({
      id: a.id,
      date: a.date,
      cancelled: a.cancelled === 1,
      details: details.rows
    });
  }
  return result;
}

/**
 * 割り当てを取り消す
 */
async function cancelAssignment(id) {
  const result = await db.execute({ sql: 'SELECT id, cancelled FROM assignments WHERE id = ?', args: [id] });
  if (result.rows.length === 0) {
    throw new Error('割り当てが見つかりません');
  }
  if (result.rows[0].cancelled === 1) {
    throw new Error('この割り当ては既に取り消し済みです');
  }
  await decrementTaskCounts(id);
  await db.execute({ sql: 'UPDATE assignments SET cancelled = 1 WHERE id = ?', args: [id] });
}

/**
 * 割り当て履歴を削除する（取り消し済みのみ削除可能）
 */
async function deleteAssignment(id) {
  const result = await db.execute({ sql: 'SELECT id, cancelled FROM assignments WHERE id = ?', args: [id] });
  if (result.rows.length === 0) {
    throw new Error('割り当てが見つかりません');
  }
  if (result.rows[0].cancelled !== 1) {
    throw new Error('取り消し済みの割り当てのみ削除できます');
  }
  await db.execute({ sql: 'DELETE FROM assignment_details WHERE assignment_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM assignments WHERE id = ?', args: [id] });
}

module.exports = {
  initializeDatabase,
  getDb,
  getMembers,
  getMemberById,
  addMember,
  deleteMember,
  updateTaskCount,
  decrementTaskCounts,
  resetAllCounts,
  saveAssignment,
  getAssignments,
  cancelAssignment,
  deleteAssignment
};
