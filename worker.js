/**
 * Cloudflare Workers エントリーポイント (Hono)
 * DB操作・割り当てアルゴリズムを内包したスタンドアロン版
 */

import { Hono } from 'hono';
import { createClient } from '@libsql/client';

const app = new Hono();

// --- 定数 ---
const VALID_TASKS = ['task1', 'task2', 'leader_other'];
const INITIAL_MEMBERS = [
  'nozayuka', 'yosihatt', 'uekeisu', 'koniryo', 'yonghyun',
  'sawmadok', 'riikaa', 'sakagyun', 'nyunn', 'yamshoic',
  'daikikk', 'cseungj', 'sagawa', 'takumr', 'ryoanz',
  'wyamash', 'yamkohe', 'yosmi', 'isswada', 'mizoyuka',
  'kitetsu', 'curakawa', 'reonwata', 'ayakura', 'yuukaigt'
];

let db;
let initialized = false;

// --- DB初期化 ---
async function initializeDatabase(env) {
  if (initialized && db) return db;
  db = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN
  });
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT, alias TEXT NOT NULL UNIQUE,
      task1_count INTEGER NOT NULL DEFAULT 0, task2_count INTEGER NOT NULL DEFAULT 0,
      leader_other_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
      cancelled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS assignment_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT, assignment_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL, task TEXT NOT NULL,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);
  const count = await db.execute('SELECT COUNT(*) as count FROM members');
  if (Number(count.rows[0].count) === 0) {
    // メンバー一括登録（batch）
    await db.batch(
      INITIAL_MEMBERS.map(alias => ({ sql: 'INSERT INTO members (alias) VALUES (?)', args: [alias] })),
      'write'
    );
  }
  // シードデータは初回リクエストでは投入しない（サブリクエスト制限回避）
  // /api/reseed エンドポイントで手動投入する
  initialized = true;
  return db;
}

async function seedData() {
  // メンバーIDマップを1回のクエリで取得
  const allMembers = await db.execute('SELECT id, alias FROM members');
  const memberMap = {};
  for (const m of allMembers.rows) {
    memberMap[m.alias] = Number(m.id);
  }

  const seeds = [
    ['2026-03-03', { task1: ['uekeisu','kitetsu','sakagyun','yamshoic','yamkohe','yuukaigt'], task2: ['koniryo','riikaa','nyunn','ryoanz','curakawa'], leader_other: ['isswada','yonghyun','cseungj','wyamash','ayakura'] }],
    ['2026-03-04', { task1: ['sawmadok','daikikk','sagawa','yosmi','reonwata'], task2: ['koniryo','riikaa','nyunn','yamshoic','kitetsu'], leader_other: ['yonghyun','cseungj','wyamash','yamkohe','isswada'] }],
    ['2026-03-05', { task1: ['cseungj','isswada','curakawa','nyunn','yamshoic','kitetsu'], task2: ['daikikk','sagawa','mizoyuka','yamkohe','yonghyun'], leader_other: ['sawmadok','riikaa','reonwata'] }],
    ['2026-03-06', { task1: ['isswada','curakawa','sawmadok'], task2: ['yuukaigt','reonwata','cseungj'], leader_other: ['daikikk','sagawa','mizoyuka','kitetsu'] }],
    ['2026-03-07', { task1: ['koniryo','sagawa','reonwata','cseungj'], task2: ['nozayuka','uekeisu','ayakura','isswada','sawmadok'], leader_other: ['sakagyun','takumr','ryoanz','curakawa','yuukaigt'] }],
    ['2026-03-08', { task1: ['ryoanz','reonwata'], task2: ['sakagyun','takumr','wyamash','sagawa'], leader_other: ['nozayuka','uekeisu','koniryo','nyunn','sawmadok'] }],
    ['2026-03-09', { task1: [], task2: ['daikikk','takumr','ryoanz','yamkohe','mizoyuka','ayakura','wyamash'], leader_other: ['yosihatt','yamshoic','yosmi','sakagyun','nyunn','kitetsu','cseungj'] }],
    ['2026-03-10', { task1: ['daikikk','ryoanz','yamkohe','cseungj','yosmi','nyunn','wyamash'], task2: [], leader_other: ['mizoyuka','kitetsu','curakawa','yuukaigt','sakagyun','yamshoic'] }],
    ['2026-03-11', { task1: [], task2: ['nyunn','yamshoic','wyamash','yamkohe','yuukaigt'], leader_other: ['mizoyuka','kitetsu','curakawa','reonwata'] }],
    ['2026-03-12', { task1: ['mizoyuka','yuukaigt','curakawa','kitetsu','reonwata','cseungj'], task2: [], leader_other: ['daikikk','takumr','yamkohe','yosmi','ayakura','nyunn','yamshoic'] }],
    ['2026-03-13', { task1: [], task2: ['sakagyun','cseungj','curakawa','kitetsu','mizoyuka'], leader_other: ['ryoanz','takumr','yosmi','reonwata','ayakura','yuukaigt'] }],
    ['2026-03-14', { task1: ['takumr','ayakura','yuukaigt','curakawa','reonwata'], task2: [], leader_other: ['yonghyun','ryoanz','wyamash','isswada','sakagyun'] }],
    ['2026-03-15', { task1: [], task2: ['reonwata','ayakura','sakagyun','wyamash'], leader_other: ['yamkohe','nyunn','yamshoic','takumr','ryoanz'] }],
    ['2026-03-17', { task1: [], task2: ['yosmi','curakawa','ryoanz','mizoyuka'], leader_other: ['yosihatt','daikikk','yonghyun','wyamash','yamkohe'] }],
    ['2026-03-20', { task1: ['ayakura','ryoanz','yuukaigt'], task2: [], leader_other: ['daikikk','yosmi','curakawa','reonwata'] }],
    ['2026-03-21', { task1: ['sakagyun','ayakura','ryoanz','reonwata'], task2: ['sawmadok','cseungj','yuukaigt','takumr'], leader_other: ['nozayuka','uekeisu','riikaa','sagawa'] }],
  ];

  // 各日付ごとに: 1回のassignment INSERT + 1回のbatch(details + counts)
  for (const [date, data] of seeds) {
    const ar = await db.execute({ sql: 'INSERT INTO assignments (date) VALUES (?)', args: [date] });
    const assignmentId = Number(ar.lastInsertRowid);
    const stmts = [];
    for (const task of VALID_TASKS) {
      for (const alias of (data[task] || [])) {
        const memberId = memberMap[alias];
        if (!memberId) throw new Error(`メンバーが見つかりません: ${alias}`);
        stmts.push({ sql: 'INSERT INTO assignment_details (assignment_id, member_id, task) VALUES (?, ?, ?)', args: [assignmentId, memberId, task] });
        stmts.push({ sql: `UPDATE members SET ${task}_count = ${task}_count + 1 WHERE id = ?`, args: [memberId] });
      }
    }
    await db.batch(stmts, 'write');
  }
}

// --- DB操作関数 ---
async function getMembers() {
  return (await db.execute('SELECT id, alias, task1_count, task2_count, leader_other_count FROM members ORDER BY id')).rows;
}
async function getMemberById(id) {
  const r = await db.execute({ sql: 'SELECT id, alias, task1_count, task2_count, leader_other_count FROM members WHERE id = ?', args: [id] });
  if (r.rows.length === 0) throw new Error('メンバーが見つかりません');
  return r.rows[0];
}
async function addMember(alias) {
  if (!alias || typeof alias !== 'string' || alias.trim().length === 0) throw new Error('エイリアス名は必須です');
  const trimmed = alias.trim();
  const existing = await db.execute({ sql: 'SELECT id FROM members WHERE alias = ?', args: [trimmed] });
  if (existing.rows.length > 0) throw new Error('このエイリアス名は既に登録されています');
  const r = await db.execute({ sql: 'INSERT INTO members (alias) VALUES (?)', args: [trimmed] });
  return getMemberById(Number(r.lastInsertRowid));
}
async function deleteMember(id) {
  await getMemberById(id);
  await db.execute({ sql: 'DELETE FROM members WHERE id = ?', args: [id] });
}
async function updateTaskCount(id, task, count) {
  if (!VALID_TASKS.includes(task)) throw new Error('無効なタスク名です');
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) throw new Error('累積回数は非負整数である必要があります');
  await getMemberById(id);
  await db.execute({ sql: `UPDATE members SET ${task}_count = ? WHERE id = ?`, args: [count, id] });
  return getMemberById(id);
}
async function resetAllCounts() {
  await db.execute('UPDATE members SET task1_count = 0, task2_count = 0, leader_other_count = 0');
}
async function saveAssignment(date, assignments) {
  // 全エイリアスを収集
  const allAliases = [];
  for (const task of VALID_TASKS) {
    for (const alias of (assignments[task] || [])) {
      if (!allAliases.includes(alias)) allAliases.push(alias);
    }
  }
  // メンバーIDマップを1回のクエリで取得
  const allMembers = await db.execute('SELECT id, alias FROM members');
  const memberMap = {};
  for (const m of allMembers.rows) {
    memberMap[m.alias] = Number(m.id);
  }
  for (const alias of allAliases) {
    if (!memberMap[alias]) throw new Error(`メンバーが見つかりません: ${alias}`);
  }

  // assignments挿入
  const ar = await db.execute({ sql: 'INSERT INTO assignments (date) VALUES (?)', args: [date] });
  const assignmentId = Number(ar.lastInsertRowid);

  // details挿入 + カウント更新をbatchで実行
  const stmts = [];
  const details = [];
  for (const task of VALID_TASKS) {
    for (const alias of (assignments[task] || [])) {
      const memberId = memberMap[alias];
      stmts.push({ sql: 'INSERT INTO assignment_details (assignment_id, member_id, task) VALUES (?, ?, ?)', args: [assignmentId, memberId, task] });
      stmts.push({ sql: `UPDATE members SET ${task}_count = ${task}_count + 1 WHERE id = ?`, args: [memberId] });
      details.push({ alias, task });
    }
  }
  if (stmts.length > 0) {
    await db.batch(stmts, 'write');
  }

  return { id: assignmentId, date, cancelled: false, details };
}

async function getAssignments() {
  const rows = (await db.execute('SELECT id, date, cancelled, created_at FROM assignments ORDER BY created_at ASC')).rows;
  if (rows.length === 0) return [];
  // 全detailsを1回のクエリで取得
  const allDetails = (await db.execute('SELECT ad.assignment_id, m.alias, ad.task FROM assignment_details ad JOIN members m ON ad.member_id = m.id')).rows;
  // assignment_idごとにグループ化
  const detailMap = {};
  for (const d of allDetails) {
    const aid = Number(d.assignment_id);
    if (!detailMap[aid]) detailMap[aid] = [];
    detailMap[aid].push({ alias: d.alias, task: d.task });
  }
  return rows.map(a => ({
    id: Number(a.id),
    date: a.date,
    cancelled: Number(a.cancelled) === 1,
    details: detailMap[Number(a.id)] || []
  }));
}
async function cancelAssignment(id) {
  const r = await db.execute({ sql: 'SELECT id, cancelled FROM assignments WHERE id = ?', args: [id] });
  if (r.rows.length === 0) throw new Error('割り当てが見つかりません');
  if (Number(r.rows[0].cancelled) === 1) throw new Error('この割り当ては既に取り消し済みです');
  const details = (await db.execute({ sql: 'SELECT ad.member_id, ad.task FROM assignment_details ad WHERE ad.assignment_id = ?', args: [id] })).rows;
  const stmts = [];
  for (const d of details) {
    stmts.push({ sql: `UPDATE members SET ${d.task}_count = MAX(${d.task}_count - 1, 0) WHERE id = ?`, args: [d.member_id] });
  }
  stmts.push({ sql: 'UPDATE assignments SET cancelled = 1 WHERE id = ?', args: [id] });
  await db.batch(stmts, 'write');
}
async function deleteAssignment(id) {
  const r = await db.execute({ sql: 'SELECT id, cancelled FROM assignments WHERE id = ?', args: [id] });
  if (r.rows.length === 0) throw new Error('割り当てが見つかりません');
  if (Number(r.rows[0].cancelled) !== 1) throw new Error('取り消し済みの割り当てのみ削除できます');
  await db.batch([
    { sql: 'DELETE FROM assignment_details WHERE assignment_id = ?', args: [id] },
    { sql: 'DELETE FROM assignments WHERE id = ?', args: [id] }
  ], 'write');
}

// --- 割り当てアルゴリズム ---
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
  const taskSlots = {};
  let extraIdx = 0;
  for (const t of priority) {
    taskSlots[t] = base + (extraIdx < remainder ? 1 : 0);
    extraIdx++;
  }

  // 各メンバー×各タスクの組み合わせを作り、累積回数が少ない順にソート
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
  // 累積回数が少ない順 → 同点ならランダム
  candidates.sort((a, b) => a.count - b.count || a.rand - b.rand);

  // 貪欲法で割り当て: 累積回数が少ないタスクに優先配置
  for (const c of candidates) {
    if (assigned.has(c.member.id)) continue;
    if (taskSlots[c.task] <= 0) continue;
    result[c.task].push(c.member.alias);
    assigned.add(c.member.id);
    taskSlots[c.task]--;
  }

  // 未割り当てメンバーがいたら空きタスクに入れる
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

// --- ミドルウェア: DB初期化 ---
app.use('/api/*', async (c, next) => {
  await initializeDatabase(c.env);
  await next();
});

// --- APIルート ---
app.get('/api/members', async (c) => {
  try { return c.json({ members: await getMembers() }); }
  catch (err) { return c.json({ error: '内部サーバーエラーが発生しました' }, 500); }
});

app.post('/api/members', async (c) => {
  try {
    const { alias } = await c.req.json();
    return c.json({ member: await addMember(alias) });
  } catch (err) {
    if (err.message === 'エイリアス名は必須です') return c.json({ error: err.message }, 400);
    if (err.message === 'このエイリアス名は既に登録されています') return c.json({ error: err.message }, 409);
    return c.json({ error: '内部サーバーエラーが発生しました' }, 500);
  }
});

app.delete('/api/members/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ error: '無効なメンバーIDです' }, 400);
    await deleteMember(id);
    return c.json({ success: true });
  } catch (err) {
    if (err.message === 'メンバーが見つかりません') return c.json({ error: err.message }, 404);
    return c.json({ error: '内部サーバーエラーが発生しました' }, 500);
  }
});

app.post('/api/assign', async (c) => {
  try {
    const { memberIds, selectedTasks } = await c.req.json();
    if (!Array.isArray(memberIds) || memberIds.length === 0) return c.json({ error: '出勤メンバーを1名以上選択してください' }, 400);
    const validTasks = ['task1', 'task2', 'leader_other'];
    const tasks = Array.isArray(selectedTasks) && selectedTasks.length > 0
      ? selectedTasks.filter(t => validTasks.includes(t))
      : validTasks;
    if (tasks.length === 0) return c.json({ error: 'タスクを1つ以上選択してください' }, 400);
    // 全メンバーを1回で取得してフィルタ
    const allMembers = await getMembers();
    const memberMap = {};
    for (const m of allMembers) memberMap[Number(m.id)] = m;
    const members = [];
    for (const id of memberIds) {
      if (!memberMap[id]) return c.json({ error: `メンバーが見つかりません (ID: ${id})` }, 404);
      members.push(memberMap[id]);
    }
    const result = assignTasks(members, tasks);
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const date = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
    const assignment = await saveAssignment(date, result);
    return c.json({ assignment: { id: assignment.id, date: assignment.date, task1: result.task1, task2: result.task2, leader_other: result.leader_other } });
  } catch (err) { return c.json({ error: '内部サーバーエラーが発生しました' }, 500); }
});

app.put('/api/members/:id/counts', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ error: '無効なメンバーIDです' }, 400);
    const { task, count } = await c.req.json();
    return c.json({ member: await updateTaskCount(id, task, count) });
  } catch (err) {
    if (err.message === 'メンバーが見つかりません') return c.json({ error: err.message }, 404);
    if (err.message === '無効なタスク名です' || err.message === '累積回数は非負整数である必要があります') return c.json({ error: err.message }, 400);
    return c.json({ error: '内部サーバーエラーが発生しました' }, 500);
  }
});

app.post('/api/reset', async (c) => {
  try { await resetAllCounts(); return c.json({ success: true }); }
  catch (err) { return c.json({ error: '内部サーバーエラーが発生しました' }, 500); }
});

app.get('/api/assignments', async (c) => {
  try { return c.json({ assignments: await getAssignments() }); }
  catch (err) { return c.json({ error: '内部サーバーエラーが発生しました', detail: err.message }, 500); }
});

app.get('/api/debug', async (c) => {
  try {
    const members = await db.execute('SELECT COUNT(*) as count FROM members');
    const assignments = await db.execute('SELECT COUNT(*) as count FROM assignments');
    const details = await db.execute('SELECT COUNT(*) as count FROM assignment_details');
    const sampleAssign = await db.execute('SELECT * FROM assignments LIMIT 3');
    return c.json({
      memberCount: Number(members.rows[0].count),
      assignmentCount: Number(assignments.rows[0].count),
      detailCount: Number(details.rows[0].count),
      sampleAssignments: sampleAssign.rows
    });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.post('/api/reseed', async (c) => {
  try {
    await db.batch([
      { sql: 'DELETE FROM assignment_details', args: [] },
      { sql: 'DELETE FROM assignments', args: [] },
      { sql: 'UPDATE members SET task1_count = 0, task2_count = 0, leader_other_count = 0', args: [] }
    ], 'write');
    await seedData();
    return c.json({ success: true, message: '初期データを再投入しました' });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/assignments/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ error: '無効な割り当てIDです' }, 400);
    await deleteAssignment(id);
    return c.json({ success: true });
  } catch (err) {
    if (err.message === '割り当てが見つかりません') return c.json({ error: err.message }, 404);
    if (err.message === '取り消し済みの割り当てのみ削除できます') return c.json({ error: err.message }, 400);
    return c.json({ error: '内部サーバーエラーが発生しました' }, 500);
  }
});

app.put('/api/assignments/:id/cancel', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ error: '無効な割り当てIDです' }, 400);
    await cancelAssignment(id);
    return c.json({ success: true });
  } catch (err) {
    if (err.message === '割り当てが見つかりません') return c.json({ error: err.message }, 404);
    if (err.message === 'この割り当ては既に取り消し済みです') return c.json({ error: err.message }, 400);
    return c.json({ error: '内部サーバーエラーが発生しました' }, 500);
  }
});

export default app;
