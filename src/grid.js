export const DEFAULT_MAP_SIZE = 64;
export const MAP_SIZE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'standard', size: 64, name: '标准地图', detail: '64 × 64 · 适合轻量开局', populationEstimate: '预估约 6 万人' }),
  Object.freeze({ id: 'large', size: 80, name: '大型地图', detail: '80 × 80 · 约多 56% 土地', populationEstimate: '预估约 6–10 万人' }),
  Object.freeze({ id: 'metropolis', size: 96, name: '超大型地图', detail: '96 × 96 · 约多 125% 土地', populationEstimate: '预估 10 万人以上' }),
]);

export const MAP_SIZES = Object.freeze(MAP_SIZE_OPTIONS.map(option => option.size));
export const MAX_MAP_SIZE = Math.max(...MAP_SIZES);

export function validMapSize(value) {
  return Number.isInteger(value) && MAP_SIZES.includes(value);
}

export function mapSize(state) {
  if (validMapSize(state?.mapSize)) return state.mapSize;
  const inferred = Math.sqrt(state?.tiles?.length || 0);
  return validMapSize(inferred) ? inferred : DEFAULT_MAP_SIZE;
}

export const gridIndex = (state, x, y) => y * mapSize(state) + x;
export const gridPoint = (state, index) => ({ x: index % mapSize(state), y: Math.floor(index / mapSize(state)) });
export const inGrid = (state, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < mapSize(state) && y < mapSize(state);
export const gridNeighbors = (state, x, y) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([nextX, nextY]) => inGrid(state, nextX, nextY));
