import { Award } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { VipLevel } from '../../types';

interface VipBadgeProps {
  level: VipLevel;
  className?: string;
}

export const VipBadge = ({ level, className }: VipBadgeProps) => {
  const styles: Record<VipLevel, { text: string; bg: string }> = {
    BRONZE: { text: 'text-amber-700 dark:text-amber-500', bg: 'bg-amber-100 dark:bg-amber-950/50' },
    SILVER: { text: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
    GOLD: { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-950/50' },
    PLATINUM: { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-950/50' },
    DIAMOND: { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-950/50' },
  };

  const style = styles[level] || styles.BRONZE;

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-current/10', style.bg, style.text, className)}>
      <Award className="h-3.5 w-3.5" />
      <span>{level}</span>
    </div>
  );
};