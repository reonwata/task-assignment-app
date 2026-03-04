const { assignTasks } = require('../assign');

describe('assignTasks - ユニットテスト', () => {
  /**
   * 3名ちょうどの場合（各タスク1名）
   * Requirements: 2.1, 2.2
   */
  describe('3名ちょうどの場合', () => {
    it('各タスクに1名ずつ割り当てられる', () => {
      const members = [
        { id: 1, alias: 'alice', task1_count: 0, task2_count: 0, leader_other_count: 0 },
        { id: 2, alias: 'bob', task1_count: 0, task2_count: 0, leader_other_count: 0 },
        { id: 3, alias: 'carol', task1_count: 0, task2_count: 0, leader_other_count: 0 },
      ];
      const result = assignTasks(members);

      expect(result.task1).toHaveLength(1);
      expect(result.task2).toHaveLength(1);
      expect(result.leader_other).toHaveLength(1);

      const all = [...result.task1, ...result.task2, ...result.leader_other].sort();
      expect(all).toEqual(['alice', 'bob', 'carol']);
    });
  });

  /**
   * 余り1名の場合（Leader&Otherに+1）
   * Requirements: 2.2, 2.3
   */
  describe('余り1名の場合（n=4）', () => {
    it('Leader&Otherが2名、タスク2が1名、タスク1が1名', () => {
      const members = [
        { id: 1, alias: 'a', task1_count: 0, task2_count: 0, leader_other_count: 0 },
        { id: 2, alias: 'b', task1_count: 0, task2_count: 0, leader_other_count: 0 },
        { id: 3, alias: 'c', task1_count: 0, task2_count: 0, leader_other_count: 0 },
        { id: 4, alias: 'd', task1_count: 0, task2_count: 0, leader_other_count: 0 },
      ];
      const result = assignTasks(members);

      expect(result.leader_other).toHaveLength(2);
      expect(result.task2).toHaveLength(1);
      expect(result.task1).toHaveLength(1);
    });
  });

  /**
   * 余り2名の場合（Leader&Other, タスク2に各+1）
   * Requirements: 2.2, 2.3
   */
  describe('余り2名の場合（n=5）', () => {
    it('Leader&Otherが2名、タスク2が2名、タスク1が1名', () => {
      const members = [
        { id: 1, alias: 'a', task1_count: 0, task2_count: 0, leader_other_count: 0 },
        { id: 2, alias: 'b', task1_count: 0, task2_count: 0, leader_other_count: 0 },
        { id: 3, alias: 'c', task1_count: 0, task2_count: 0, leader_other_count: 0 },
        { id: 4, alias: 'd', task1_count: 0, task2_count: 0, leader_other_count: 0 },
        { id: 5, alias: 'e', task1_count: 0, task2_count: 0, leader_other_count: 0 },
      ];
      const result = assignTasks(members);

      expect(result.leader_other).toHaveLength(2);
      expect(result.task2).toHaveLength(2);
      expect(result.task1).toHaveLength(1);
    });
  });

  /**
   * 1名のみの場合
   * Requirements: 2.1, 2.2, 2.3
   */
  describe('1名のみの場合', () => {
    it('Leader&Otherに1名、他は0名', () => {
      const members = [
        { id: 1, alias: 'solo', task1_count: 0, task2_count: 0, leader_other_count: 0 },
      ];
      const result = assignTasks(members);

      expect(result.leader_other).toEqual(['solo']);
      expect(result.task2).toHaveLength(0);
      expect(result.task1).toHaveLength(0);
    });
  });

  /**
   * 累積回数が異なるメンバーの優先割り当て確認
   * Requirements: 2.4
   */
  describe('累積回数による優先割り当て', () => {
    it('leader_other_countが少ないメンバーがLeader&Otherに割り当てられる', () => {
      const members = [
        { id: 1, alias: 'high', task1_count: 0, task2_count: 0, leader_other_count: 10 },
        { id: 2, alias: 'mid', task1_count: 0, task2_count: 0, leader_other_count: 5 },
        { id: 3, alias: 'low', task1_count: 0, task2_count: 0, leader_other_count: 1 },
      ];
      const result = assignTasks(members);

      expect(result.leader_other).toEqual(['low']);
    });

    it('task2_countが少ないメンバーがタスク2に割り当てられる', () => {
      const members = [
        { id: 1, alias: 'a', task1_count: 0, task2_count: 10, leader_other_count: 0 },
        { id: 2, alias: 'b', task1_count: 0, task2_count: 1, leader_other_count: 0 },
        { id: 3, alias: 'c', task1_count: 0, task2_count: 5, leader_other_count: 0 },
      ];
      const result = assignTasks(members);

      // leader_other_countは全員0なので、先頭のaがLeader&Otherに割り当てられる
      // 残りのb(task2_count=1)とc(task2_count=5)のうち、bがタスク2に割り当てられる
      expect(result.task2).toContain('b');
    });

    it('task1_countが少ないメンバーがタスク1に割り当てられる', () => {
      const members = [
        { id: 1, alias: 'a', task1_count: 100, task2_count: 100, leader_other_count: 100 },
        { id: 2, alias: 'b', task1_count: 0, task2_count: 100, leader_other_count: 100 },
        { id: 3, alias: 'c', task1_count: 50, task2_count: 100, leader_other_count: 100 },
      ];
      const result = assignTasks(members);

      // leader_other_countは全員100で同じ → ソート順で最初のメンバーがLeader&Other
      // task2_countも全員100で同じ → ソート順で次のメンバーがタスク2
      // 残りの1名がタスク1
      const allAssigned = [...result.task1, ...result.task2, ...result.leader_other];
      expect(allAssigned.sort()).toEqual(['a', 'b', 'c']);
    });

    it('6名で累積回数に差がある場合、各タスクで回数が少ないメンバーが優先される', () => {
      const members = [
        { id: 1, alias: 'a', task1_count: 5, task2_count: 5, leader_other_count: 10 },
        { id: 2, alias: 'b', task1_count: 3, task2_count: 8, leader_other_count: 1 },
        { id: 3, alias: 'c', task1_count: 7, task2_count: 2, leader_other_count: 6 },
        { id: 4, alias: 'd', task1_count: 1, task2_count: 9, leader_other_count: 3 },
        { id: 5, alias: 'e', task1_count: 9, task2_count: 1, leader_other_count: 8 },
        { id: 6, alias: 'f', task1_count: 2, task2_count: 4, leader_other_count: 5 },
      ];
      const result = assignTasks(members);

      // Leader&Other (2名): leader_other_count昇順 → b(1), d(3) が選ばれる
      expect(result.leader_other.sort()).toEqual(['b', 'd']);

      // 残り: a, c, e, f
      // タスク2 (2名): task2_count昇順 → e(1), c(2) が選ばれる
      expect(result.task2.sort()).toEqual(['c', 'e']);

      // タスク1 (2名): 残りの a(5), f(2) → task1_count昇順 → f(2), a(5)
      expect(result.task1.sort()).toEqual(['a', 'f']);
    });
  });

  /**
   * 2名の場合（余り2: Leader&Other 1名, タスク2 1名, タスク1 0名）
   * Requirements: 2.2, 2.3
   */
  describe('2名の場合', () => {
    it('Leader&Otherに1名、タスク2に1名、タスク1は0名', () => {
      const members = [
        { id: 1, alias: 'x', task1_count: 0, task2_count: 0, leader_other_count: 0 },
        { id: 2, alias: 'y', task1_count: 0, task2_count: 0, leader_other_count: 0 },
      ];
      const result = assignTasks(members);

      expect(result.leader_other).toHaveLength(1);
      expect(result.task2).toHaveLength(1);
      expect(result.task1).toHaveLength(0);
    });
  });

  /**
   * 0名の場合（空配列）
   */
  describe('0名の場合', () => {
    it('全タスクが空配列を返す', () => {
      const result = assignTasks([]);

      expect(result.task1).toEqual([]);
      expect(result.task2).toEqual([]);
      expect(result.leader_other).toEqual([]);
    });
  });
});
