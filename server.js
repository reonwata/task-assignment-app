/**
 * Express サーバー + APIルート定義
 * タスク割り当てアプリのエントリーポイント
 */

const express = require('express');
const path = require('path');
const { initializeDatabase, getMembers, getMemberById, addMember, deleteMember, updateTaskCount, resetAllCounts, saveAssignment, getAssignments, cancelAssignment, deleteAssignment } = require('./db');
const { assignTasks } = require('./assign');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- APIエンドポイント ---

// GET /api/members — メンバー一覧取得
app.get('/api/members', async (req, res) => {
  try {
    const members = await getMembers();
    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// POST /api/members — メンバー追加
app.post('/api/members', async (req, res) => {
  try {
    const { alias } = req.body;
    const member = await addMember(alias);
    res.json({ member });
  } catch (err) {
    if (err.message === 'エイリアス名は必須です') {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'このエイリアス名は既に登録されています') {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// DELETE /api/members/:id — メンバー削除
app.delete('/api/members/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: '無効なメンバーIDです' });
    }
    await deleteMember(id);
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'メンバーが見つかりません') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// POST /api/assign — タスク割り当て実行
app.post('/api/assign', async (req, res) => {
  try {
    const { memberIds, selectedTasks } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: '出勤メンバーを1名以上選択してください' });
    }
    const validTasks = ['task1', 'task2', 'leader_other'];
    const tasks = Array.isArray(selectedTasks) && selectedTasks.length > 0
      ? selectedTasks.filter(t => validTasks.includes(t))
      : validTasks;
    if (tasks.length === 0) {
      return res.status(400).json({ error: 'タスクを1つ以上選択してください' });
    }

    // 各メンバーのデータを取得
    const members = [];
    for (const id of memberIds) {
      try {
        const member = await getMemberById(id);
        members.push(member);
      } catch (err) {
        return res.status(404).json({ error: `メンバーが見つかりません (ID: ${id})` });
      }
    }

    // 割り当て実行
    const result = assignTasks(members, tasks);

    // 今日の日付（YYYY-MM-DD形式、日本時間）
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const date = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;

    // DB保存（累積回数更新 + 履歴保存）
    const assignment = await saveAssignment(date, result);

    res.json({
      assignment: {
        id: assignment.id,
        date: assignment.date,
        task1: result.task1,
        task2: result.task2,
        leader_other: result.leader_other
      }
    });
  } catch (err) {
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// PUT /api/members/:id/counts — 累積回数更新
app.put('/api/members/:id/counts', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: '無効なメンバーIDです' });
    }
    const { task, count } = req.body;
    const member = await updateTaskCount(id, task, count);
    res.json({ member });
  } catch (err) {
    if (err.message === 'メンバーが見つかりません') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === '無効なタスク名です' || err.message === '累積回数は非負整数である必要があります') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// POST /api/reset — 累積回数一括リセット
app.post('/api/reset', async (req, res) => {
  try {
    await resetAllCounts();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// GET /api/assignments — 割り当て履歴取得
app.get('/api/assignments', async (req, res) => {
  try {
    const assignments = await getAssignments();
    res.json({ assignments });
  } catch (err) {
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// DELETE /api/assignments/:id — 取り消し済み割り当て削除
app.delete('/api/assignments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: '無効な割り当てIDです' });
    }
    await deleteAssignment(id);
    res.json({ success: true });
  } catch (err) {
    if (err.message === '割り当てが見つかりません') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === '取り消し済みの割り当てのみ削除できます') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// PUT /api/assignments/:id/cancel — 割り当て取り消し
app.put('/api/assignments/:id/cancel', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: '無効な割り当てIDです' });
    }
    await cancelAssignment(id);
    res.json({ success: true });
  } catch (err) {
    if (err.message === '割り当てが見つかりません') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'この割り当ては既に取り消し済みです') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// --- サーバー起動 ---
async function startServer() {
  await initializeDatabase();

  // 初期データ投入（履歴が空の場合のみ）
  const seedAssignments = await getAssignments();
  if (seedAssignments.length === 0) {
    try {
      await saveAssignment('2026-03-03', {
        task1: ['uekeisu', 'kitetsu', 'sakagyun', 'yamshoic', 'yamkohe', 'yuukaigt'],
        task2: ['koniryo', 'riikaa', 'nyunn', 'ryoanz', 'curakawa'],
        leader_other: ['isswada', 'yonghyun', 'cseungj', 'wyamash', 'ayakura']
      });
      await saveAssignment('2026-03-04', {
        task1: ['sawmadok', 'daikikk', 'sagawa', 'yosmi', 'reonwata'],
        task2: ['koniryo', 'riikaa', 'nyunn', 'yamshoic', 'kitetsu'],
        leader_other: ['yonghyun', 'cseungj', 'wyamash', 'yamkohe', 'isswada']
      });
      await saveAssignment('2026-03-05', {
        task1: ['cseungj', 'isswada', 'curakawa', 'nyunn', 'yamshoic', 'kitetsu'],
        task2: ['daikikk', 'sagawa', 'mizoyuka', 'yamkohe', 'yonghyun'],
        leader_other: ['sawmadok', 'riikaa', 'reonwata']
      });
      await saveAssignment('2026-03-06', {
        task1: ['isswada', 'curakawa', 'sawmadok'],
        task2: ['yuukaigt', 'reonwata', 'cseungj'],
        leader_other: ['daikikk', 'sagawa', 'mizoyuka', 'kitetsu']
      });
      await saveAssignment('2026-03-07', {
        task1: ['koniryo', 'sagawa', 'reonwata', 'cseungj'],
        task2: ['nozayuka', 'uekeisu', 'ayakura', 'isswada', 'sawmadok'],
        leader_other: ['sakagyun', 'takumr', 'ryoanz', 'curakawa', 'yuukaigt']
      });
      await saveAssignment('2026-03-08', {
        task1: ['ryoanz', 'reonwata'],
        task2: ['sakagyun', 'takumr', 'wyamash', 'sagawa'],
        leader_other: ['nozayuka', 'uekeisu', 'koniryo', 'nyunn', 'sawmadok']
      });
      await saveAssignment('2026-03-09', {
        task1: [],
        task2: ['daikikk', 'takumr', 'ryoanz', 'yamkohe', 'mizoyuka', 'ayakura', 'wyamash'],
        leader_other: ['yosihatt', 'yamshoic', 'yosmi', 'sakagyun', 'nyunn', 'kitetsu', 'cseungj']
      });
      await saveAssignment('2026-03-10', {
        task1: ['daikikk', 'ryoanz', 'yamkohe', 'cseungj', 'yosmi', 'nyunn', 'wyamash'],
        task2: [],
        leader_other: ['mizoyuka', 'kitetsu', 'curakawa', 'yuukaigt', 'sakagyun', 'yamshoic']
      });
      await saveAssignment('2026-03-11', {
        task1: [],
        task2: ['nyunn', 'yamshoic', 'wyamash', 'yamkohe', 'yuukaigt'],
        leader_other: ['mizoyuka', 'kitetsu', 'curakawa', 'reonwata']
      });
      console.log('初期データ（3/3〜3/11）を投入しました');
    } catch (err) {
      console.log('初期データ投入スキップ:', err.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`タスク割り当てアプリが起動しました: http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('サーバー起動エラー:', err);
  process.exit(1);
});

module.exports = app;
