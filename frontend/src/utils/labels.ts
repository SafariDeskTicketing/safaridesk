import type { LabelItem } from '../types';

const DARK_TEXT = '#000000';
const LIGHT_TEXT = '#FFFFFF';

export const normalizeHexColor = (hex?: string | null): string | null => {
  if (!hex) {
    return null;
  }

  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  if (expanded.length !== 6) {
    return null;
  }

  return `#${expanded.toUpperCase()}`;
};

export const withLabelAlpha = (hex: string, alpha: number) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const shadeHex = (hex: string, amount: number) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return hex;
  }

  const adjustChannel = (channel: number) => {
    const next = amount >= 0
      ? channel + ((255 - channel) * amount)
      : channel * (1 + amount);

    return Math.max(0, Math.min(255, Math.round(next)));
  };

  const red = adjustChannel(Number.parseInt(normalized.slice(1, 3), 16));
  const green = adjustChannel(Number.parseInt(normalized.slice(3, 5), 16));
  const blue = adjustChannel(Number.parseInt(normalized.slice(5, 7), 16));

  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
};

export const getLabelTextColorFallback = (color: string) => {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return DARK_TEXT;
  }

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);

  return luminance >= 160 ? DARK_TEXT : LIGHT_TEXT;
};

export const getLabelBadgeStyle = (label: Pick<LabelItem, 'color' | 'text_color'>) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const normalizedTextColor = normalizeHexColor(label.text_color) || getLabelTextColorFallback(label.color);

  if (isDark) {
    // Dark mode: slightly stronger alpha background, lighter (brightened) text for legibility
    return {
      backgroundColor: withLabelAlpha(label.color, 0.22),
      borderColor: withLabelAlpha(label.color, 0.48),
      color: shadeHex(label.color, 0.35), // lighten toward white
    };
  }

  const textColor = normalizedTextColor === DARK_TEXT
    ? shadeHex(label.color, -0.7)
    : shadeHex(label.color, -0.05);

  return {
    backgroundColor: withLabelAlpha(label.color, 0.16),
    borderColor: withLabelAlpha(label.color, 0.36),
    color: textColor,
  };
};

const findBestLabelMatch = (query: string, labels: LabelItem[]) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    labels.find((labelItem) => labelItem.name.toLowerCase() === normalized)
    || labels.find((labelItem) => labelItem.name.toLowerCase().startsWith(normalized))
    || labels.find((labelItem) => labelItem.name.toLowerCase().includes(normalized))
    || null
  );
};

export const resolveLabelTokenIds = (value: string | undefined, labels: LabelItem[]) => {
  if (!value) {
    return [];
  }

  const queries = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const resolvedIds: number[] = [];
  for (const query of queries) {
    const match = findBestLabelMatch(query, labels);
    if (match && !resolvedIds.includes(match.id)) {
      resolvedIds.push(match.id);
    }
  }

  return resolvedIds;
};

export const getLabelNamesByIds = (labelIds: number[], labels: LabelItem[]) => (
  labelIds
    .map((labelId) => labels.find((labelItem) => labelItem.id === labelId)?.name)
    .filter(Boolean)
    .join(', ')
);
