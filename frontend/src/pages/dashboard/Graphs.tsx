import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Filter } from '../../components/icons/AppIcons';
import type { DashboardStats } from '../../types';
import { useUIStore } from '../../stores/uiStore';
import Select from '../../components/ui/Select';

type Props = {
  type?: 'tickets' | 'tasks';
  data?: DashboardStats | null;
  embedded?: boolean;
};

type DisplayMode = 'line' | 'area' | 'bar';

type ChartPoint = {
  label: string;
  actual: number;
};

const getYAxisDomain = (values: number[]) => {
  const maxValue = Math.max(...values, 0);

  if (maxValue <= 5) {
    return 5;
  }

  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  return Math.ceil(maxValue / magnitude) * magnitude;
};

const formatLabel = (period: string) => {
  if (!period) return '';
  // "Week 1" / "week 1" → "W1"
  const weekMatch = period.match(/^[Ww]eek\s*(\d+)$/);
  if (weekMatch) return `W${weekMatch[1]}`;
  // "2025-01" style ISO month → "Jan"
  const isoMonth = period.match(/^\d{4}-(\d{2})$/);
  if (isoMonth) {
    const m = parseInt(isoMonth[1], 10) - 1;
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m] ?? period;
  }
  // Already short enough
  if (period.length <= 3) return period;
  return period.slice(0, 3);
};

export const GraphComponent: React.FC<Props> = ({
  type = 'tickets',
  data = null,
  embedded = false,
}) => {
  const [displayMode, setDisplayMode] = React.useState<DisplayMode>('line');
  const { theme } = useUIStore();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const chartData = useMemo<ChartPoint[]>(() => {
    const raw = type === 'tickets' ? data?.ticket.graph : data?.task.graph;
    if (!raw || raw.length === 0) {
      return [];
    }

    return raw.map((item) => ({
      label: formatLabel(item.period),
      actual: item.all,
    }));
  }, [data, type]);

  const yAxisMax = useMemo(
    () => getYAxisDomain(chartData.map((item) => item.actual)),
    [chartData]
  );

  const stroke = '#315EFB';
  const axisColor = isDark ? '#9AA5B2' : '#7B857F';
  const gridColor = isDark ? '#323A35' : '#EDF1ED';
  const surface = isDark ? '#202723' : '#FFFFFF';
  const areaStart = isDark ? 'rgba(49, 94, 251, 0.20)' : 'rgba(49, 94, 251, 0.14)';
  const areaEnd = isDark ? 'rgba(49, 94, 251, 0.04)' : 'rgba(49, 94, 251, 0.02)';

  if (!data || chartData.length === 0) {
    return (
      <div
        className={
          embedded
            ? 'rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-3.5'
            : 'rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-3.5'
        }
      >
        <div className="mb-2.5 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] text-[var(--text-muted)]"
            aria-label="Chart filter"
          >
            <Filter size={14} stroke={1.8} />
          </button>
          <Select
            value={displayMode}
            onChange={(value) => setDisplayMode(value as DisplayMode)}
            size="sm"
            className="w-[132px]"
            options={[
              { value: 'line', label: 'Line Graph' },
              { value: 'area', label: 'Area Graph' },
              { value: 'bar', label: 'Bar Graph' },
            ]}
          />
        </div>
        <div className="flex h-[220px] items-center justify-center text-center">
          <div>
            <p className="text-[var(--font-body)] font-medium text-[var(--text-primary)]">No data available</p>
            <p className="mt-1 text-[var(--font-meta)] text-[var(--text-muted)]">
              Activity will appear here once records start moving through the system.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? 'rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-3.5'
          : 'rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-3.5'
      }
    >
      <div className="mb-2.5 flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] text-[var(--text-muted)] transition-colors hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)]"
          aria-label="Chart filter"
        >
          <Filter size={14} stroke={1.8} />
        </button>
        <Select
          value={displayMode}
          onChange={(value) => setDisplayMode(value as DisplayMode)}
          size="sm"
          className="w-[132px]"
          options={[
            { value: 'line', label: 'Line Graph' },
            { value: 'area', label: 'Area Graph' },
            { value: 'bar', label: 'Bar Graph' },
          ]}
        />
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          {displayMode === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: axisColor }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickCount={5}
                domain={[0, yAxisMax]}
                tick={{ fontSize: 12, fill: axisColor }}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(38,58,51,0.03)' }}
                contentStyle={{
                  borderRadius: 8,
                  borderColor: isDark ? '#323A35' : '#E3E9E3',
                  background: surface,
                  boxShadow: '0 8px 24px rgba(16, 24, 40, 0.08)',
                }}
                formatter={(value: number, _name, item) => [`${item.payload.actual} records`, 'Volume']}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="actual" fill={stroke} radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          ) : displayMode === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id={`dashboard-${type}-area`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaStart} />
                  <stop offset="100%" stopColor={areaEnd} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: axisColor }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickCount={5}
                domain={[0, yAxisMax]}
                tick={{ fontSize: 12, fill: axisColor }}
              />
              <Tooltip
                cursor={{ stroke: gridColor, strokeWidth: 1 }}
                contentStyle={{
                  borderRadius: 8,
                  borderColor: isDark ? '#323A35' : '#E3E9E3',
                  background: surface,
                  boxShadow: '0 8px 24px rgba(16, 24, 40, 0.08)',
                }}
                formatter={(value: number, _name, item) => [`${item.payload.actual} records`, 'Volume']}
                labelFormatter={(label) => `${label}`}
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#dashboard-${type}-area)`}
                dot={false}
                activeDot={{ r: 4, fill: stroke, stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: axisColor }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickCount={5}
                domain={[0, yAxisMax]}
                tick={{ fontSize: 12, fill: axisColor }}
              />
              <Tooltip
                cursor={{ stroke: gridColor, strokeWidth: 1 }}
                contentStyle={{
                  borderRadius: 8,
                  borderColor: isDark ? '#323A35' : '#E3E9E3',
                  background: surface,
                  boxShadow: '0 8px 24px rgba(16, 24, 40, 0.08)',
                }}
                formatter={(value: number, _name, item) => [`${item.payload.actual} records`, 'Volume']}
                labelFormatter={(label) => `${label}`}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke={stroke}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: stroke, stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
