export enum SizeUnit {
  B = 'B',
  KB = 'KB',
  MB = 'MB',
  GB = 'GB',
  TB = 'TB',
}

export const unitVal: {[key in SizeUnit]: {rank: number; val: number}} = {
  B: {rank: 0, val: 1},
  KB: {rank: 1, val: Math.pow(10, 3)},
  MB: {rank: 2, val: Math.pow(10, 6)},
  GB: {rank: 3, val: Math.pow(10, 9)},
  TB: {rank: 4, val: Math.pow(10, 12)},
};

export function mostRelevantUnit(val: number) {
  let log10 = Math.max(0, Math.floor(Math.log10(val) / 3));
  const sizeUnit: SizeUnit =
    (Object.entries(unitVal)
      .filter(([key, value]) => value.rank === log10)
      .map(([key]) => key as SizeUnit)?.[0]) || SizeUnit.TB;

  return prefixWithUnit(val, sizeUnit);
}

export function prefixWithUnit(nb: number, unit: SizeUnit) {
  const {val} = unitVal[unit];

  return `${nb / val} ${unit}`;
}
