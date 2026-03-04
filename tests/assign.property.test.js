const fc = require('fast-check');
const { assignTasks } = require('../assign');

/**
 * メンバー生成用Arbitrary
 * ユニークなエイリアスを持つメンバー配列を生成する
 */
const memberArbitrary = fc
  .uniqueArray(
    fc.record({
      alias: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
      task1_count: fc.nat({ max: 1000 }),
      task2_count: fc.nat({ max: 1000 }),
      leader_other_count: fc.nat({ max: 1000 }),
    }),
    { minLength: 1, maxLength: 50, selector: m => m.alias }
  )
  .map(members => members.map((m, i) => ({ id: i + 1, ...m })));

/**
 * Property 1: 全メンバーの割り当て完全性
 * Feature: task-assignment-app, Property 1: 全メンバーの割り当て完全性
 *
 * 全出勤メンバーがいずれか1つのタスクに重複なく割り当てられること
 * Validates: Requirements 2.1
 */
describe('Property 1: 全メンバーの割り当て完全性', () => {
  it('全出勤メンバーがいずれか1つのタスクに重複なく割り当てられる', () => {
    fc.assert(
      fc.property(memberArbitrary, (members) => {
        const result = assignTasks(members);
        const allAssigned = [...result.task1, ...result.task2, ...result.leader_other];
        const inputAliases = members.map(m => m.alias).sort();
        const assignedSorted = [...allAssigned].sort();

        // 全メンバーが割り当てられている
        expect(assignedSorted).toEqual(inputAliases);
        // 重複がない
        expect(new Set(allAssigned).size).toBe(allAssigned.length);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 2: タスク人数の正確な分配
 * Feature: task-assignment-app, Property 2: タスク人数の正確な分配
 *
 * base/remainderに基づく各タスクの人数が正しいこと
 * Validates: Requirements 2.2, 2.3
 */
describe('Property 2: タスク人数の正確な分配', () => {
  it('base/remainderに基づく各タスクの人数が正しい', () => {
    fc.assert(
      fc.property(memberArbitrary, (members) => {
        const n = members.length;
        const base = Math.floor(n / 3);
        const remainder = n % 3;

        const expectedLeaderOther = base + (remainder >= 1 ? 1 : 0);
        const expectedTask2 = base + (remainder >= 2 ? 1 : 0);
        const expectedTask1 = base;

        const result = assignTasks(members);

        expect(result.leader_other.length).toBe(expectedLeaderOther);
        expect(result.task2.length).toBe(expectedTask2);
        expect(result.task1.length).toBe(expectedTask1);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 3: 累積回数優先割り当て
 * Feature: task-assignment-app, Property 3: 累積回数優先割り当て
 *
 * 各タスクに割り当てられたメンバーの累積回数が、割り当てられなかったメンバー以下であること
 * Validates: Requirements 2.4
 */
describe('Property 3: 累積回数優先割り当て', () => {
  it('各タスクに割り当てられたメンバーの累積回数が、割り当てられなかったメンバー以下である', () => {
    fc.assert(
      fc.property(memberArbitrary, (members) => {
        const result = assignTasks(members);
        const memberMap = new Map(members.map(m => [m.alias, m]));

        // Leader&Other: 割り当てられたメンバーのleader_other_countの最大値 <=
        //               割り当てられなかったメンバーのleader_other_countの最小値
        if (result.leader_other.length > 0) {
          const assignedMax = Math.max(
            ...result.leader_other.map(a => memberMap.get(a).leader_other_count)
          );
          const notAssigned = members.filter(m => !result.leader_other.includes(m.alias));
          if (notAssigned.length > 0) {
            const notAssignedMin = Math.min(
              ...notAssigned.map(m => m.leader_other_count)
            );
            expect(assignedMax).toBeLessThanOrEqual(notAssignedMin);
          }
        }

        // タスク2: leader_otherに割り当て済みのメンバーを除いた残りの中で検証
        const afterLeaderOther = members.filter(m => !result.leader_other.includes(m.alias));
        if (result.task2.length > 0) {
          const assignedMax = Math.max(
            ...result.task2.map(a => memberMap.get(a).task2_count)
          );
          const notAssigned = afterLeaderOther.filter(m => !result.task2.includes(m.alias));
          if (notAssigned.length > 0) {
            const notAssignedMin = Math.min(
              ...notAssigned.map(m => m.task2_count)
            );
            expect(assignedMax).toBeLessThanOrEqual(notAssignedMin);
          }
        }

        // タスク1: leader_other, task2に割り当て済みのメンバーを除いた残りの中で検証
        const afterTask2 = afterLeaderOther.filter(m => !result.task2.includes(m.alias));
        if (result.task1.length > 0) {
          const assignedMax = Math.max(
            ...result.task1.map(a => memberMap.get(a).task1_count)
          );
          const notAssigned = afterTask2.filter(m => !result.task1.includes(m.alias));
          if (notAssigned.length > 0) {
            const notAssignedMin = Math.min(
              ...notAssigned.map(m => m.task1_count)
            );
            expect(assignedMax).toBeLessThanOrEqual(notAssignedMin);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
