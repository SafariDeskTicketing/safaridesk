import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DashboardBreakdownItem,
  DashboardDualSeriesPoint,
  DashboardSingleSeriesPoint,
} from '../../types';

export const DASHBOARD_CHART_COLORS = [
  '#2A7FFF',
  '#257A42',
  '#00C8FF',
  '#F5B942',
  '#FF6B57',
  '#4F9A73',
  '#A7B4AE',
];

const AxisTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string | number } }) => (
  <g transform={`translate(${x ?? 0},${y ?? 0})`}>
    <text x={0} y={0} dy={10} textAnchor="middle" fill="var(--text-muted)" fontSize={11} fontWeight={600}>
      {payload?.value}
    </text>
  </g>
);

const CompactTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: number | string }>;
  label?: string;
}> = ({ active, payload, label }) => {
  const visiblePayload = (payload || []).filter((entry) => entry.name);

  if (!active || visiblePayload.length === 0) return null;

  return (
    <div className="min-w-[132px] rounded-[12px] border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 shadow-[0_8px_20px_rgba(16,24,40,0.08)] dark:shadow-[0_10px_22px_rgba(1,4,9,0.2)]">
      <p className="text-[11px] font-semibold text-[var(--text-primary)]">{label}</p>
      <div className="mt-2 space-y-1.5">
        {visiblePayload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || '#20B8CD' }} />
              <span className="text-[var(--text-secondary)]">{entry.name}</span>
            </div>
            <span className="font-semibold text-[var(--text-primary)]">{entry.value ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DashboardSparklineChart: React.FC<{
  data: number[];
  color: string;
}> = ({ data, color }) => {
  const chartData = (data.length > 0 ? data : [0, 0, 0, 0]).map((value, index) => ({
    index,
    value,
  }));

  return (
    <div className="h-12 w-[96px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 6, right: 0, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip cursor={false} content={<CompactTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.2}
            fill={`url(#spark-${color.replace('#', '')})`}
            dot={false}
            activeDot={{ r: 3, fill: color }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DashboardHeroAreaChart: React.FC<{
  data: DashboardDualSeriesPoint[];
  primaryKey: 'created' | 'assigned';
  secondaryKey: 'resolved';
  primaryLabel: string;
  secondaryLabel: string;
}> = ({ data, primaryKey, secondaryKey, primaryLabel, secondaryLabel }) => {
  const sourceData = data.length > 0 ? data : [{ label: 'No data', [primaryKey]: 0, [secondaryKey]: 0 }];
  const chartData = sourceData.map((point, index, items) => {
    const primaryValue = Number(point[primaryKey] || 0);
    const secondaryValue = Number(point[secondaryKey] || 0);
    const prevPrimary = index > 0 ? Number(items[index - 1][primaryKey] || 0) : primaryValue;
    const nextPrimary = index < items.length - 1 ? Number(items[index + 1][primaryKey] || 0) : primaryValue;
    const prevSecondary = index > 0 ? Number(items[index - 1][secondaryKey] || 0) : secondaryValue;
    const nextSecondary = index < items.length - 1 ? Number(items[index + 1][secondaryKey] || 0) : secondaryValue;
    const ambient = Math.max(
      (prevPrimary + primaryValue + nextPrimary) / 3,
      (prevSecondary + secondaryValue + nextSecondary) / 3
    ) * 0.72;

    return {
      ...point,
      ambient,
    };
  });

  return (
    <div className="h-[270px] sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 14, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="dashboard-ambient-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--surface-muted)" stopOpacity={0.42} />
              <stop offset="42%" stopColor="var(--surface-muted)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--surface-muted)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="dashboard-primary-glow-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00C8FF" stopOpacity={0.32} />
              <stop offset="48%" stopColor="#00C8FF" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#00C8FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="dashboard-primary-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00C8FF" stopOpacity={0.48} />
              <stop offset="38%" stopColor="#00C8FF" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#00C8FF" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="dashboard-secondary-glow-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#257A42" stopOpacity={0.24} />
              <stop offset="48%" stopColor="#257A42" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#257A42" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="dashboard-secondary-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#257A42" stopOpacity={0.32} />
              <stop offset="42%" stopColor="#257A42" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#257A42" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border-color)" strokeOpacity={0.48} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={<AxisTick />} />
          <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }} />
          <Tooltip cursor={{ stroke: 'rgba(42, 127, 255, 0.18)', strokeDasharray: '3 3' }} content={<CompactTooltip />} />
          <Area
            type="natural"
            dataKey="ambient"
            name=""
            stroke="none"
            fill="url(#dashboard-ambient-fill)"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            type="natural"
            dataKey={secondaryKey}
            name=""
            stroke="none"
            fill="url(#dashboard-secondary-glow-fill)"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            type="natural"
            dataKey={primaryKey}
            name=""
            stroke="none"
            fill="url(#dashboard-primary-glow-fill)"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            type="natural"
            dataKey={secondaryKey}
            name={secondaryLabel}
            stroke="#257A42"
            strokeWidth={2.4}
            fill="url(#dashboard-secondary-fill)"
            dot={false}
            activeDot={{ r: 4, fill: '#257A42', stroke: '#ffffff', strokeWidth: 2 }}
            strokeLinecap="round"
            connectNulls
            isAnimationActive={false}
          />
          <Area
            type="natural"
            dataKey={primaryKey}
            name={primaryLabel}
            stroke="#00C8FF"
            strokeWidth={2.7}
            fill="url(#dashboard-primary-fill)"
            dot={false}
            activeDot={{ r: 4, fill: '#00C8FF', stroke: '#ffffff', strokeWidth: 2 }}
            strokeLinecap="round"
            connectNulls
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DashboardDonutSummaryChart: React.FC<{
  data: DashboardBreakdownItem[];
  centerValue: number | string;
  centerLabel: string;
}> = ({ data, centerValue, centerLabel }) => {
  const chartData = data.length > 0 ? data : [{ label: 'No data', value: 1 }];

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="label"
            innerRadius={60}
            outerRadius={84}
            paddingAngle={3}
            stroke="var(--card-bg)"
            strokeWidth={3}
            isAnimationActive={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`${entry.label}-${index}`}
                fill={DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length]}
              />
            ))}
            <Label
              position="center"
              content={() => (
                <g>
                  <text x="50%" y="47%" textAnchor="middle" className="fill-[var(--text-muted)] text-[11px] font-semibold">
                    {centerLabel}
                  </text>
                  <text x="50%" y="58%" textAnchor="middle" className="fill-[var(--text-primary)] text-[28px] font-bold">
                    {centerValue}
                  </text>
                </g>
              )}
            />
          </Pie>
          <Tooltip content={<CompactTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DashboardCompactBarChart: React.FC<{
  data: DashboardBreakdownItem[];
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  onItemClick?: (item: DashboardBreakdownItem) => void;
}> = ({ data, orientation = 'horizontal', color = '#28B7D3', onItemClick }) => {
  const safeData = data.length > 0 ? data : [{ label: 'No data', value: 0 }];
  const isHorizontal = orientation === 'horizontal';

  return (
    <div className="h-[160px] sm:h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={safeData}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 10, right: 8, left: isHorizontal ? 14 : -22, bottom: 0 }}
          barCategoryGap={18}
        >
          <CartesianGrid vertical={false} stroke="var(--border-color)" strokeOpacity={0.52} />
          <XAxis
            type={isHorizontal ? 'number' : 'category'}
            dataKey={isHorizontal ? undefined : 'label'}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tick={<AxisTick />}
          />
          <YAxis
            type={isHorizontal ? 'category' : 'number'}
            dataKey={isHorizontal ? 'label' : undefined}
            axisLine={false}
            tickLine={false}
            width={isHorizontal ? 108 : 24}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }}
          />
          <Tooltip content={<CompactTooltip />} cursor={{ fill: 'rgba(42, 127, 255, 0.08)' }} />
          <Bar
            dataKey="value"
            fill={color}
            radius={isHorizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            maxBarSize={26}
            isAnimationActive={false}
            onClick={(_, index: number) => {
              const item = safeData[index];
              if (item && item.value > 0 && onItemClick) {
                onItemClick(item);
              }
            }}
            cursor={onItemClick ? 'pointer' : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DashboardMiniAreaTrendChart: React.FC<{
  data: DashboardSingleSeriesPoint[];
  color: string;
}> = ({ data, color }) => {
  const chartData = data.length > 0 ? data : [{ label: 'No data', value: 0 }];

  return (
    <div className="h-[110px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id={`mini-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border-color)" strokeOpacity={0.52} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={<AxisTick />} />
          <YAxis hide />
          <Tooltip content={<CompactTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.2}
            fill={`url(#mini-fill-${color.replace('#', '')})`}
            dot={false}
            activeDot={{ r: 3, fill: color }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DashboardStatusSparkline: React.FC<{
  tone: 'healthy' | 'warning' | 'error';
}> = ({ tone }) => {
  const toneMap: Record<typeof tone, { color: string; data: number[] }> = {
    healthy: { color: '#3DBA73', data: [3, 4, 3.6, 4.4, 4.1, 4.8] },
    warning: { color: '#F5B942', data: [2.8, 2.7, 3.2, 2.9, 3.1, 2.6] },
    error: { color: '#FF6B57', data: [3.8, 3.1, 3.3, 2.2, 2.4, 1.9] },
  };

  const chartData = toneMap[tone].data.map((value, index) => ({ index, value }));

  return (
    <div className="h-8 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`status-${tone}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={toneMap[tone].color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={toneMap[tone].color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={toneMap[tone].color}
            strokeWidth={2}
            fill={`url(#status-${tone})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
