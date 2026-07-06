export type Die = 1 | 2 | 3 | 4 | 5 | 6;

export type ScoreKey =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'threeOfKind'
  | 'fourOfKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'yahtzee'
  | 'chance';

export interface ScoreCategory {
  key: ScoreKey;
  label: string;
  labelFr: string;
}

export const UPPER_KEYS: ScoreKey[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER_KEYS: ScoreKey[] = [
  'threeOfKind',
  'fourOfKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
];
export const ALL_KEYS: ScoreKey[] = [...UPPER_KEYS, ...LOWER_KEYS];

export const CATEGORY_META: Record<
  ScoreKey,
  { label: string; labelFr: string; desc: string; descFr: string }
> = {
  ones: { label: 'Ones', labelFr: 'As', desc: 'Sum of 1s', descFr: 'Somme des 1' },
  twos: { label: 'Twos', labelFr: 'Deux', desc: 'Sum of 2s', descFr: 'Somme des 2' },
  threes: { label: 'Threes', labelFr: 'Trois', desc: 'Sum of 3s', descFr: 'Somme des 3' },
  fours: { label: 'Fours', labelFr: 'Quatre', desc: 'Sum of 4s', descFr: 'Somme des 4' },
  fives: { label: 'Fives', labelFr: 'Cinq', desc: 'Sum of 5s', descFr: 'Somme des 5' },
  sixes: { label: 'Sixes', labelFr: 'Six', desc: 'Sum of 6s', descFr: 'Somme des 6' },
  threeOfKind: {
    label: '3 of a Kind',
    labelFr: 'Brelan',
    desc: 'Sum all if 3+ same',
    descFr: 'Somme si 3+ pareils',
  },
  fourOfKind: {
    label: '4 of a Kind',
    labelFr: 'Carré',
    desc: 'Sum all if 4+ same',
    descFr: 'Somme si 4+ pareils',
  },
  fullHouse: {
    label: 'Full House',
    labelFr: 'Full',
    desc: '3+2 of different → 25',
    descFr: '3+2 différents → 25',
  },
  smallStraight: {
    label: 'Sm. Straight',
    labelFr: 'Petite suite',
    desc: '4 consecutive → 30',
    descFr: '4 consécutifs → 30',
  },
  largeStraight: {
    label: 'Lg. Straight',
    labelFr: 'Grande suite',
    desc: '5 consecutive → 40',
    descFr: '5 consécutifs → 40',
  },
  yahtzee: { label: 'Yahtzee', labelFr: 'Yahtzee', desc: '5 same → 50', descFr: '5 pareils → 50' },
  chance: { label: 'Chance', labelFr: 'Chance', desc: 'Sum all', descFr: 'Somme de tous' },
};

export function rollDie(): Die {
  return (Math.floor(Math.random() * 6) + 1) as Die;
}

export function rollDice(count = 5): Die[] {
  return Array.from({ length: count }, () => rollDie()) as Die[];
}

function diceCounts(dice: Die[]): Record<number, number> {
  const c: Record<number, number> = {};
  for (const d of dice) c[d] = (c[d] ?? 0) + 1;
  return c;
}

export function scoreFor(key: ScoreKey, dice: Die[]): number {
  const c = diceCounts(dice);
  const vals = Object.values(c);
  const total = dice.reduce((s, d) => s + d, 0);
  switch (key) {
    case 'ones':
      return (c[1] ?? 0) * 1;
    case 'twos':
      return (c[2] ?? 0) * 2;
    case 'threes':
      return (c[3] ?? 0) * 3;
    case 'fours':
      return (c[4] ?? 0) * 4;
    case 'fives':
      return (c[5] ?? 0) * 5;
    case 'sixes':
      return (c[6] ?? 0) * 6;
    case 'threeOfKind':
      return vals.some((v) => v >= 3) ? total : 0;
    case 'fourOfKind':
      return vals.some((v) => v >= 4) ? total : 0;
    case 'fullHouse':
      return vals.includes(3) && vals.includes(2) ? 25 : 0;
    case 'smallStraight': {
      const uniq = [...new Set(dice)].sort((a, b) => a - b).join('');
      return ['1234', '2345', '3456'].some((s) => uniq.includes(s)) ? 30 : 0;
    }
    case 'largeStraight': {
      const uniq = [...new Set(dice)].sort((a, b) => a - b).join('');
      return uniq === '12345' || uniq === '23456' ? 40 : 0;
    }
    case 'yahtzee':
      return vals.some((v) => v >= 5) ? 50 : 0;
    case 'chance':
      return total;
  }
}

export function upperTotal(scores: Partial<Record<ScoreKey, number>>): number {
  return UPPER_KEYS.reduce((t, k) => t + (scores[k] ?? 0), 0);
}

export function upperBonus(scores: Partial<Record<ScoreKey, number>>): boolean {
  return upperTotal(scores) >= 63;
}

export function grandTotal(
  scores: Partial<Record<ScoreKey, number>>,
  yahtzeeBonus: number
): number {
  const upper = upperTotal(scores) + (upperBonus(scores) ? 35 : 0);
  const lower = LOWER_KEYS.reduce((t, k) => t + (scores[k] ?? 0), 0);
  return upper + lower + yahtzeeBonus * 100;
}
