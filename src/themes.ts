export const backgrounds = [
  { id: 'black', name: 'Чёрный', color: '#000000' },
  { id: 'graphite', name: 'Графит', color: '#1B1E23' },
  { id: 'slate', name: 'Сланец', color: '#29333E' },
  { id: 'blue', name: 'Синий', color: '#243C50' },
  { id: 'sage', name: 'Шалфей', color: '#2D3C35' },
  { id: 'plum', name: 'Слива', color: '#3E3242' },
] as const;

export type Background = typeof backgrounds[number]['id'];

export function themeTokens(id: Background) {
  const background = backgrounds.find(item => item.id === id) ?? backgrounds[0];
  const mix = (amount: number) => `#${background.color.slice(1).match(/../g)!.map(hex => Math.round(parseInt(hex, 16) * (1 - amount) + 255 * amount).toString(16).padStart(2, '0')).join('')}`;
  return {
    '--bg': background.color,
    '--surface': mix(0.065),
    '--line': mix(0.16),
    '--control-border': mix(0.4),
    '--track': mix(0.4),
    '--muted': id === 'black' ? '#A5A5A5' : '#C0C9D2',
    '--dim': id === 'black' ? '#888888' : '#ACB8C4',
    '--past': id === 'black' ? '#AAAAAA' : '#C0C9D2',
    '--red': '#FFA0A4',
  };
}
