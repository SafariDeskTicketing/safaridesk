import React from 'react';
import { clsx } from 'clsx';
import type { LabelItem } from '../../types';
import { getLabelBadgeStyle } from '../../utils/labels';

interface LabelBadgeProps {
  label: LabelItem;
  size?: 'xs' | 'sm' | 'md' | 'table';
  className?: string;
}

export const LabelBadge: React.FC<LabelBadgeProps> = ({
  label,
  size = 'sm',
  className,
}) => {
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[8px]',
    sm: 'px-2 py-0.5 text-[14px]',
    md: 'px-2.5 py-1 text-[14px]',
    table: 'px-2 py-0.5 text-[12px]',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border font-medium leading-none transition-colors',
        sizeClasses[size],
        !label.is_active && 'opacity-70',
        className,
      )}
      style={getLabelBadgeStyle(label)}
      title={label.description || label.name}
    >
      {label.name}
    </span>
  );
};

export default LabelBadge;
