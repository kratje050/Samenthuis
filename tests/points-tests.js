import { calculateRoutinePoints, calculateTaskPoints, summarizeWeeklyPoints, withAutomaticTaskPoints } from '../js/services/points-service.js';

function equal(actual, expected, message = '') {
  if (actual !== expected) throw new Error(message || `Verwacht ${expected}, kreeg ${actual}`);
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

export const pointsTests = [
  ['taakpunten worden automatisch op basis van tijd berekend', async () => {
    equal(calculateTaskPoints({ title: 'Tafel afnemen', estimatedMinutes: 5, priority: 'normal' }).points, 3);
    equal(calculateTaskPoints({ title: 'Badkamer schoonmaken', estimatedMinutes: 60, priority: 'normal' }).points, 20);
    equal(calculateTaskPoints({ title: 'Schuur opruimen', estimatedMinutes: 180, priority: 'normal' }).points, 50);
  }],
  ['taakpunten gebruiken lokale zwaarte- en prioriteitsregels', async () => {
    const normal = calculateTaskPoints({ title: 'Was opvouwen', priority: 'normal' });
    const urgent = calculateTaskPoints({ title: 'Was opvouwen', priority: 'urgent' });
    const unpopular = calculateTaskPoints({ title: 'Toilet schoonmaken', priority: 'normal' });
    equal(normal.points, 10);
    equal(urgent.points, 15);
    assert(unpopular.points > normal.points, 'Een minder populaire klus hoort een kleine bonus te krijgen.');
  }],
  ['automatische taakmetadata bewaart uitleg en punten', async () => {
    const task = withAutomaticTaskPoints({ title: 'Vaatwasser legen', priority: 'high' });
    equal(task.rewardPoints, 8);
    equal(task.pointsAutomatic, true);
    assert(task.pointsReason.includes('hoge prioriteit'), 'De uitleg mist de prioriteitsbonus.');
  }],
  ['routinepunten groeien mee met het aantal stappen', async () => {
    equal(calculateRoutinePoints({ items: [{ text: 'Tanden poetsen' }] }).points, 5);
    equal(calculateRoutinePoints({ items: Array.from({ length: 6 }, (_, index) => ({ text: `Stap ${index}` })) }).points, 15);
  }],
  ['weekscore telt afgeronde taken en routines per gezinslid', async () => {
    const members = [{ id: 'roy', name: 'Roy' }, { id: 'demy', name: 'Demy' }];
    const result = summarizeWeeklyPoints({
      members,
      now: new Date(2026, 6, 15, 12),
      tasks: [
        { status: 'done', completedAt: '2026-07-14T10:00:00.000Z', completedBy: 'roy', rewardPoints: 20 },
        { status: 'open', completedAt: null, assignedTo: 'roy', rewardPoints: 50 },
        { status: 'done', completedAt: '2026-07-15T10:00:00.000Z', assignedTo: 'demy', rewardPoints: 10 }
      ],
      routines: [{
        status: 'active', memberId: 'demy', pointValue: 7,
        completionHistory: [{ date: '2026-07-16', completedAt: '2026-07-16T08:00:00.000Z' }]
      }]
    });
    equal(result.ranking.find((entry) => entry.name === 'Roy').points, 20);
    equal(result.ranking.find((entry) => entry.name === 'Demy').points, 17);
    equal(result.teamPoints, 37);
  }]
];
