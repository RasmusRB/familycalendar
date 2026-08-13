import type { EventColor } from '@/types'

export const colorClasses: Record<
  EventColor,
  { solidBg: string; solidText: string; softBg: string; softText: string; dot: string; ring: string }
> = {
  'partner-a': {
    solidBg: 'bg-partner-a',
    solidText: 'text-partner-a-foreground',
    softBg: 'bg-partner-a-soft',
    softText: 'text-partner-a',
    dot: 'bg-partner-a',
    ring: 'ring-partner-a',
  },
  'partner-b': {
    solidBg: 'bg-partner-b',
    solidText: 'text-partner-b-foreground',
    softBg: 'bg-partner-b-soft',
    softText: 'text-partner-b',
    dot: 'bg-partner-b',
    ring: 'ring-partner-b',
  },
  shared: {
    solidBg: 'bg-shared',
    solidText: 'text-shared-foreground',
    softBg: 'bg-shared-soft',
    softText: 'text-shared',
    dot: 'bg-shared',
    ring: 'ring-shared',
  },
}
