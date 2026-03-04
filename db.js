/**
 * データベースモジュール
 * SQLiteデータベースの初期化と全データ操作を提供する
 */

const Database = require('better-sqlite3');

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
 * @param {string} [dbPath='task-assignment.db'] - データベースファイルのパス
 * @returns {object} better-sqlite3 データベースインスタンス
 */
function initializeDatabase(dbPath = 'task-assignment.db') {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
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
  const count = db.prepare('SELECT COUNT(*) as count FROM members').get();
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO members (alias) VALUES (?)');
    const insertMany = db.transaction((members) => {
      for (const alias of members) {
        insert.run(alias);
      }
    });
    insertMany(INITIAL_MEMBERS);
  }

  return db;
}

/**
 * 現在のDBインスタンスを取得する（テスト用）
 * @returns {object} better-sqlite3 データベースインスタンス
 */
function getDb() {
  return db;
}

/**
 * メンバー一覧と累積回数を取得する
 * @returns {Array<{id: number, alias: string, task1_count: number, task2_count: number, leader_other_count: number}>}
 */
function getMembers() {
  return db.prepare('SELECT id, alias, task1_count, task2_count, leader_other_count FROM members ORDER BY id').all();
}

/**
 * 特定メンバーを取得する
 * @param {number} id - メンバーID
 * @returns {{id: number, alias: string, task1_count: number, task2_count: number, leader_other_count: number}}
 */
function getMemberById(id) {
  const member = db.prepare('SELECT id, alias, task1_count, task2_count, leader_other_count FROM members WHERE id = ?').get(id);
  if (!member) {
    throw new Error('メンバーが見つかりません');
  }
  return member;
}

/**
 * メンバーを追加する
 * @param {string} alias - エイリアス名
 * @returns {{id: number, alias: string, task1_count: number, task2_count: number, leader_other_count: number}}
 */
function addMember(alias) {
  if (!alias || typeof alias !== 'string' || alias.trim().length === 0) {
    throw new Error('エイリアス名は必須です');
  }
  const trimmed = alias.trim();
  try {
    const result = db.prepare('INSERT INTO members (alias) VALUES (?)').run(trimmed);
    return getMemberById(result.lastInsertRowid);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      throw new Error('このエイリアス名は既に登録されています');
    }
    throw err;
  }
}

/**
 * メンバーを削除する
 * @param {number} id - メンバーID
 */
function deleteMember(id) {
  // 存在チェック
  getMemberById(id);
  db.prepare('DELETE FROM members WHERE id = ?').run(id);
}

/**
 * 累積回数を更新する
 * @param {number} id - メンバーID
 * @param {string} task - タスク名 ('task1', 'task2', 'leader_other')
 * @param {number} count - 新しい累積回数（非負整数）
 * @returns {{id: number, alias: string, task1_count: number, task2_count: number, leader_other_count: number}}
 */
function updateTaskCount(id, task, count) {
  if (!VALID_TASKS.includes(task)) {
    throw new Error('無効なタスク名です');
  }
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('累積回数は非負整数である必要があります');
  }
  // 存在チェック
  getMemberById(id);
  const column = task + '_count';
  db.prepare(`UPDATE members SET ${column} = ? WHERE id = ?`).run(count, id);
  return getMemberById(id);
}

/**
 * 割り当て履歴を保存し、累積回数を一括増加する（トランザクション）
 * @param {string} date - 割り当て日（YYYY-MM-DD形式）
 * @param {{task1: string[], task2: string[], leader_other: string[]}} assignments - 割り当て結果
 * @returns {{id: number, date: string, cancelled: boolean, details: Array<{alias: string, task: string}>}}
 */
function saveAssignment(date, assignments) {
  const saveTransaction = db.transaction(() => {
    // 割り当てレコード作成
    const assignResult = db.prepare('INSERT INTO assignments (date) VALUES (?)').run(date);
    const assignmentId = assignResult.lastInsertRowid;

    const insertDetail = db.prepare('INSERT INTO assignment_details (assignment_id, member_id, task) VALUES (?, ?, ?)');
    const details = [];

    for (const task of VALID_TASKS) {
      const aliases = assignments[task] || [];
      for (const alias of aliases) {
        const member = db.prepare('SELECT id FROM members WHERE alias = ?').get(alias);
        if (!member) {
          throw new Error(`メンバーが見つかりません: ${alias}`);
        }
        insertDetail.run(assignmentId, member.id, task);
        details.push({ alias, task });

        // 累積回数を1増加
        const column = task + '_count';
        db.prepare(`UPDATE members SET ${column} = ${column} + 1 WHERE id = ?`).run(member.id);
      }
    }

    return {
      id: assignmentId,
      date,
      cancelled: false,
      details
    };
  });

  return saveTransaction();
}

/**
 * 割り当て後の累積回数一括増加（saveAssignmentのエイリアス）
 * @param {string} date - 割り当て日
 * @param {{task1: string[], task2: string[], leader_other: string[]}} assignments - 割り当て結果
 * @returns {{id: number, date: string, cancelled: boolean, details: Array<{alias: string, task: string}>}}
 */
function incrementTaskCounts(date, assignments) {
  return saveAssignment(date, assignments);
}

/**
 * 取り消し時の累積回数一括減少（トランザクション）
 * @param {number} assignmentId - 割り当てID
 */
function decrementTaskCounts(assignmentId) {
  const decrementTransaction = db.transaction(() => {
    const details = db.prepare(`
      SELECT ad.member_id, ad.task, m.alias
      FROM assignment_details ad
      JOIN members m ON ad.member_id = m.id
      WHERE ad.assignment_id = ?
    `).all(assignmentId);

    for (const detail of details) {
      const column = detail.task + '_count';
      db.prepare(`UPDATE members SET ${column} = MAX(${column} - 1, 0) WHERE id = ?`).run(detail.member_id);
    }
  });

  decrementTransaction();
}

/**
 * 全累積回数をリセットする
 */
function resetAllCounts() {
  db.prepare('UPDATE members SET task1_count = 0, task2_count = 0, leader_other_count = 0').run();
}

/**
 * 割り当て履歴を取得する（作成日時の降順）
 * @returns {Array<{id: number, date: string, cancelled: boolean, details: Array<{alias: string, task: string}>}>}
 */
function getAssignments() {
  const assignments = db.prepare('SELECT id, date, cancelled, created_at FROM assignments ORDER BY created_at DESC').all();

  const getDetails = db.prepare(`
    SELECT m.alias, ad.task
    FROM assignment_details ad
    JOIN members m ON ad.member_id = m.id
    WHERE ad.assignment_id = ?
  `);

  return assignments.map(a => ({
    id: a.id,
    date: a.date,
    cancelled: a.cancelled === 1,
    details: getDetails.all(a.id)
  }));
}

/**
 * 割り当てを取り消す（トランザクション）
 * @param {number} id - 割り当てID
 */
function cancelAssignment(id) {
  const cancelTransaction = db.transaction(() => {
    const assignment = db.prepare('SELECT id, cancelled FROM assignments WHERE id = ?').get(id);
    if (!assignment) {
      throw new Error('割り当てが見つかりません');
    }
    if (assignment.cancelled === 1) {
      throw new Error('この割り当ては既に取り消し済みです');
    }

    // 累積回数を減少
    decrementTaskCounts(id);

    // 取り消し済みにマーク
    db.prepare('UPDATE assignments SET cancelled = 1 WHERE id = ?').run(id);
  });

  cancelTransaction();
}

/**
 * 割り当て履歴を削除する（取り消し済みのみ削除可能）
 * @param {number} id - 割り当てID
 */
function deleteAssignment(id) {
  const deleteTransaction = db.transaction(() => {
    const assignment = db.prepare('SELECT id, cancelled FROM assignments WHERE id = ?').get(id);
    if (!assignment) {
      throw new Error('割り当てが見つかりません');
    }
    if (assignment.cancelled !== 1) {
      throw new Error('取り消し済みの割り当てのみ削除できます');
    }
    db.prepare('DELETE FROM assignment_details WHERE assignment_id = ?').run(id);
    db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
  });

  deleteTransaction();
}

module.exports = {
  initializeDatabase,
  getDb,
  getMembers,
  getMemberById,
  addMember,
  deleteMember,
  updateTaskCount,
  incrementTaskCounts,
  decrementTaskCounts,
  resetAllCounts,
  saveAssignment,
  getAssignments,
  cancelAssignment,
  deleteAssignment
};
