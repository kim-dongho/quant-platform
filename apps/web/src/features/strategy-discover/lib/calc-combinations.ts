// 자동 탐색에서 평가될 룰 조합 수 계산.
//
// 1-clause: factor × op(2) × percentile(5)
// 2-clause: 위 조합 중 서로 다른 factor끼리 페어링 (같은 factor 내 페어 제외)
const N_OPS = 2; // <, >
const N_PERCENTILES = 5; // 10/30/50/70/90

export const calcCombinations = (factorCount: number, n: 1 | 2): number => {
  if (factorCount === 0) return 0;
  const singles = factorCount * N_OPS * N_PERCENTILES;
  if (n === 1) return singles;
  const perFactor = N_OPS * N_PERCENTILES;
  const sameFactorPairs = (factorCount * (perFactor * (perFactor - 1))) / 2;
  const allPairs = (singles * (singles - 1)) / 2;
  return allPairs - sameFactorPairs;
};
