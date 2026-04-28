export interface SectionTheme {
  dark:  string   // Spirit dying particle color (color1 in preset)
  mid:   string   // Spirit alive particle color (color2 in preset)
  light: string   // UI ghost title color
}

export const THEMES: Record<string, SectionTheme> = {
  blue: {
    dark:  '#001020',
    mid:   '#00446d',
    light: '#5ba3c9',
  },
  green: {
    dark:  '#001508',
    mid:   '#005228',
    light: '#3d9e60',
  },
  purple: {
    dark:  '#0a0015',
    mid:   '#340060',
    light: '#9060d0',
  },
  teal: {
    dark:  '#001518',
    mid:   '#005568',
    light: '#3aaac0',
  },
  amber: {
    dark:  '#180a00',
    mid:   '#6b3200',
    light: '#d06030',
  },
}

export const DEFAULT_THEME = THEMES.blue
