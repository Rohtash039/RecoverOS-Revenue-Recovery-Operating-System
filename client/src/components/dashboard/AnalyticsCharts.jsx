import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { formatINR, formatShortINR } from '../../utils/formatters';

export function AnalyticsCharts({ categories = [], expectedVsActual = {}, casesByState = {} }) {
  const chartData = categories.map(cat => ({
    name: cat.category.replace(/_/g, ' '),
    atRisk: cat.initialAtRisk,
    recovered: cat.recovered,
    rate: cat.rate,
    casesCount: cat.casesCount,
    recoveredCount: cat.recoveredCount,
    isHardProhibited: ['FRAUD_RISK', 'HARD_DECLINE', 'ACCOUNT_CLOSED'].includes(cat.category)
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 p-3 rounded-md text-xs space-y-1 shadow-lg text-neutral-900 dark:text-neutral-100 font-sans">
          <div className="font-semibold pb-1 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
            <span>{label}</span>
            {data.isHardProhibited && (
              <span className="text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-1.5 py-0.2 rounded font-mono">
                Hard Stop (0% Target)
              </span>
            )}
          </div>
          <div className="text-neutral-500 dark:text-neutral-400">Cases: <span className="text-neutral-900 dark:text-neutral-100 font-mono font-medium">{data.casesCount}</span></div>
          <div className="text-neutral-500 dark:text-neutral-400">Initial at Risk: <span className="text-neutral-900 dark:text-neutral-100 font-mono font-medium">{formatINR(data.atRisk)}</span></div>
          <div className="text-neutral-700 dark:text-neutral-300">Recovered: <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatINR(data.recovered)} ({data.recoveredCount} cases)</span></div>
          <div className="text-neutral-500 dark:text-neutral-400">Recovery Rate: <span className="text-neutral-900 dark:text-neutral-100 font-mono font-bold">{data.rate}%</span></div>
        </div>
      );
    }
    return null;
  };

  const recoveredCount = casesByState.RECOVERED || 0;
  const escalatedCount = casesByState.ESCALATED || 0;
  const stoppedCount = casesByState.STOPPED || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">

      <div className="lg:col-span-2 p-4 rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Recovery Performance by Failure Category
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Exposed Revenue vs Recovered Revenue</p>
          </div>
          <span className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 rounded">
            Dynamic Attribution
          </span>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#737373" strokeOpacity={0.2} vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#A3A3A3"
                fontSize={10}
                angle={-15}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                stroke="#A3A3A3"
                fontSize={10}
                tickFormatter={(val) => formatShortINR(val)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={26}
                formatter={(value) => <span className="text-xs text-neutral-600 dark:text-neutral-400">{value === 'atRisk' ? 'Initial at Risk' : 'Recovered'}</span>}
              />
              <Bar
                dataKey="atRisk"
                fill="#A3A3A3"
                radius={[2, 2, 0, 0]}
                name="atRisk"
                isAnimationActive={true}
                animationDuration={300}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="recovered"
                fill="#16A34A"
                radius={[2, 2, 0, 0]}
                name="recovered"
                isAnimationActive={true}
                animationDuration={300}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-3.5">

        <div className="p-4 rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 space-y-2.5 transition-colors">
          <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
            Attribution vs Model Estimate
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Pre-execution Estimate:</span>
              <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">{formatINR(expectedVsActual.expected || 0)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Actual Realized:</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatINR(expectedVsActual.actual || 0)}</span>
            </div>
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Attainment Ratio:</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-bold font-mono">{expectedVsActual.expectedRecoveryAttainment || 0}%</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800 space-y-2.5 transition-colors">
          <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
            Terminal State Breakdown
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                Recovered:
              </span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{recoveredCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                <span className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-400" />
                Escalated (Human Review):
              </span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{escalatedCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                <span className="w-2 h-2 rounded-full bg-rose-600 dark:bg-rose-400" />
                Stopped by Policy:
              </span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{stoppedCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

