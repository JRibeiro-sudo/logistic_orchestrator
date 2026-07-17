import { useUIStore } from '@/stores/ui'

/** CVD-validated categorical palette (fixed order: blue, green, purple,
 *  amber — never cycled; red is reserved for status/negative). Hex values
 *  validated per mode with the dataviz palette validator. */
const PALETTES = {
  dark: {
    categorical: ['#3494f4', '#279259', '#a864d8', '#c98418'],
    negative: '#da5c5c',
    positive: '#3aa06b',
    grid: 'rgba(148, 163, 184, 0.12)',
    axis: '#8b93a1',
    tooltipBg: '#1e2530',
    tooltipBorder: '#2b3442',
  },
  light: {
    categorical: ['#2377cf', '#0f7d5c', '#8a4bbf', '#aa6408'],
    negative: '#c23b3b',
    positive: '#1f7a4d',
    grid: 'rgba(71, 85, 105, 0.12)',
    axis: '#64748b',
    tooltipBg: '#ffffff',
    tooltipBorder: '#d8dce3',
  },
} as const

export function useChartColors() {
  const theme = useUIStore((s) => s.theme)
  return PALETTES[theme]
}
