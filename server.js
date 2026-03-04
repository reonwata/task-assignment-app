/**
 * Express サーバー + APIルート定義
 * タスク割り当てアプリのエントリーポイント
 */

const express = require('express');
const path = require('path');
const { initializeDatabase, getMembers, getMemberById, addMember, deleteMember, updateTaskCount, resetAllCounts, saveAssignment, getAssignments, cancelAssignment } = require('./db');
const { assignTasks } = require('./assign');

const app = express();
const PORT = 3000;

// ミドルウェア
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// データベース初期化
initializeDatabase();

// --- APIエンドポイント ---

// GET /api/members — メンバー一覧取得
app.get('/api/members', (req, res) => {
  try {
    const members = getMembers();
    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// POST /api/members — メンバー追加
app.post('/api/members', (req, res) => {
  try {
    const { alias } = req.body;
    const member = addMember(alias);
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
app.delete('/api/members/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: '無効なメンバーIDです' });
    }
    deleteMember(id);
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'メンバーが見つかりません') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// POST /api/assign — タスク割り当て実行
app.post('/api/assign', (req, res) => {
  try {
    const { memberIds } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: '出勤メンバーを1名以上選択してください' });
    }

    // 各メンバーのデータを取得
    const members = [];
    for (const id of memberIds) {
      try {
        const member = getMemberById(id);
        members.push(member);
      } catch (err) {
        return res.status(404).json({ error: `メンバーが見つかりません (ID: ${id})` });
      }
    }

    // 割り当て実行
    const result = assignTasks(members);

    // 今日の日付（YYYY-MM-DD形式）
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // DB保存（累積回数更新 + 履歴保存）
    const assignment = saveAssignment(date, result);

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
app.put('/api/members/:id/counts', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: '無効なメンバーIDです' });
    }
    const { task, count } = req.body;
    const member = updateTaskCount(id, task, count);
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
app.post('/api/reset', (req, res) => {
  try {
    resetAllCounts();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// GET /api/assignments — 割り当て履歴取得
app.get('/api/assignments', (req, res) => {
  try {
    const assignments = getAssignments();
    res.json({ assignments });
  } catch (err) {
    res.status(500).json({ error: '内部サーバーエラーが発生しました' });
  }
});

// PUT /api/assignments/:id/cancel — 割り当て取り消し
app.put('/api/assignments/:id/cancel', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: '無効な割り当てIDです' });
    }
    cancelAssignment(id);
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

// サーバー起動
app.listen(PORT, () => {
  console.log(`タスク割り当てアプリが起動しました: http://localhost:${PORT}`);
});

module.exports = app;
