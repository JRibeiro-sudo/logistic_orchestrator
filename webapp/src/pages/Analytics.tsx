import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/layout/PageHeader'
import { ChartCard, chartTooltipStyle } from '@/components/charts/ChartCard'
import { useChartColors } from '@/hooks/useChartColors'
import {
  agentPerformance,
  approvalStats,
  financialImpact,
  problematicMaterials,
  recoveredProductionHours,
  recoveryTimeTrend,
  rootCauseBreakdown,
  supplierIncidents,
  transportDelayTrend,
} from '@/mocks/analytics'

export default function Analytics() {
  const colors = useChartColors()
  const tooltip = chartTooltipStyle(colors.tooltipBg, colors.tooltipBorder)
  const axisProps = {
    stroke: colors.axis,
    fontSize: 11,
    tickLine: false,
    axisLine: false,
  } as const

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Analytics"
        description="Executive view — recovery performance, root causes, suppliers, and financial impact (synthetic data, last 10 weeks)."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Average recovery time" description="Hours from trigger to resolution, weekly">
          <ResponsiveContainer>
            <LineChart data={recoveryTimeTrend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="week" {...axisProps} />
              <YAxis {...axisProps} unit="h" />
              <Tooltip contentStyle={tooltip} cursor={{ stroke: colors.axis, strokeOpacity: 0.3 }} />
              <Line
                type="monotone"
                dataKey="hours"
                name="Avg hours"
                stroke={colors.categorical[0]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Root causes" description="Confirmed diagnoses, rolling quarter">
          <ResponsiveContainer>
            <BarChart data={rootCauseBreakdown} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 40 }}>
              <CartesianGrid stroke={colors.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="cause" {...axisProps} width={110} />
              <Tooltip contentStyle={tooltip} cursor={{ fill: colors.grid }} />
              <Bar dataKey="count" name="Cases" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 11, fill: colors.axis }}>
                {rootCauseBreakdown.map((_, i) => (
                  <Cell key={i} fill={colors.categorical[i % colors.categorical.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Approval outcomes" description="Human checkpoint decisions, rolling quarter">
          <ResponsiveContainer>
            <PieChart>
              <Tooltip contentStyle={tooltip} />
              <Pie
                data={approvalStats}
                dataKey="count"
                nameKey="outcome"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                stroke="transparent"
                label={({ name, value }) => `${name} ${value}`}
                fontSize={11}
              >
                {approvalStats.map((_, i) => (
                  <Cell key={i} fill={colors.categorical[i % colors.categorical.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Supplier incident ranking" description="Shortage incidents per supplier, 12 months">
          <ResponsiveContainer>
            <BarChart data={supplierIncidents} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 60 }}>
              <CartesianGrid stroke={colors.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="supplier" {...axisProps} width={130} />
              <Tooltip contentStyle={tooltip} cursor={{ fill: colors.grid }} />
              <Bar
                dataKey="incidents"
                name="Incidents"
                fill={colors.categorical[0]}
                radius={[0, 4, 4, 0]}
                barSize={14}
                label={{ position: 'right', fontSize: 11, fill: colors.axis }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Most problematic materials" description="Open + resolved cases per part family">
          <ResponsiveContainer>
            <BarChart data={problematicMaterials} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="material" {...axisProps} interval={0} angle={-18} textAnchor="end" height={52} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip contentStyle={tooltip} cursor={{ fill: colors.grid }} />
              <Bar dataKey="cases" name="Cases" fill={colors.categorical[2]} radius={[4, 4, 0, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Transport delays" description="Carrier-side delay events per week">
          <ResponsiveContainer>
            <LineChart data={transportDelayTrend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="week" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip contentStyle={tooltip} cursor={{ stroke: colors.axis, strokeOpacity: 0.3 }} />
              <Line
                type="monotone"
                dataKey="delays"
                name="Delay events"
                stroke={colors.categorical[3]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Financial impact"
          description="Production loss avoided vs recovery spend (EUR/week)"
          className="md:col-span-2"
        >
          <ResponsiveContainer>
            <AreaChart data={financialImpact} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="week" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={tooltip}
                formatter={(v) => `€${Number(v).toLocaleString()}`}
                cursor={{ stroke: colors.axis, strokeOpacity: 0.3 }}
              />
              <Area
                type="monotone"
                dataKey="savedEur"
                name="Loss avoided"
                stroke={colors.positive}
                fill={colors.positive}
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="spentEur"
                name="Recovery spend"
                stroke={colors.categorical[3]}
                fill={colors.categorical[3]}
                fillOpacity={0.14}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Recovered production hours" description="Line hours protected per week">
          <ResponsiveContainer>
            <BarChart data={recoveredProductionHours} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="week" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltip} cursor={{ fill: colors.grid }} />
              <Bar dataKey="hours" name="Hours" fill={colors.categorical[1]} radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Agent success rate"
          description="Completed runs without failure, per agent"
          className="md:col-span-2 xl:col-span-3"
        >
          <ResponsiveContainer>
            <BarChart data={agentPerformance} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="agent" {...axisProps} interval={0} />
              <YAxis {...axisProps} domain={[85, 100]} unit="%" />
              <Tooltip contentStyle={tooltip} cursor={{ fill: colors.grid }} />
              <Bar
                dataKey="successPct"
                name="Success rate"
                fill={colors.categorical[0]}
                radius={[4, 4, 0, 0]}
                barSize={26}
                label={{ position: 'top', fontSize: 10, fill: colors.axis, formatter: (v: unknown) => `${v}%` }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
