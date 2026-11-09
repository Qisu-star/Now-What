import type { Priority } from '@nowwhat/shared'

export const PRIORITY_META: Record<Priority, { label: string; dot: string; chip: string }> = {
  primary: { label: '首要', dot: 'bg-rose-500', chip: 'bg-rose-500' },
  secondary: { label: '次要', dot: 'bg-amber-500', chip: 'bg-amber-500' },
  normal: { label: '普通', dot: 'bg-blue-500', chip: 'bg-blue-500' },
  pending: { label: '待定', dot: 'bg-yellow-500', chip: 'bg-yellow-500' }
}

const TASK_COLORS = [
  '#4C7DD6',
  '#3F8F5C',
  '#C0504D',
  '#C98A2B',
  '#7C5CBF',
  '#2F8F8A',
  '#B44B7F',
  '#5B6B8C'
]

export function taskColor(index: number): string {
  return TASK_COLORS[index % TASK_COLORS.length] ?? '#4C7DD6'
}
