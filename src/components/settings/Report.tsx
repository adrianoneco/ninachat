import React, { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';

const MetricCard: React.FC<{ title: string; value: string; info?: string }> = ({ title, value, info }) => (
  <div className="rounded-xl border border-gray-300/10 dark:border-slate-200/5 bg-gray-100/40 dark:bg-slate-900/40 p-6 min-h-[88px] flex flex-col justify-between">
    <div>
      <div className="text-sm text-gray-500 dark:text-slate-400">{title}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{value}</div>
    </div>
    {info && <div className="text-xs text-gray-500 dark:text-slate-500 mt-3">{info}</div>}
  </div>
);

const Report: React.FC = () => {
  const [period, setPeriod] = useState<'today'|'7days'|'30days'>('30days');
  const [metrics, setMetrics] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [statusDist, setStatusDist] = useState<any[]>([]);
  const [mediaDist, setMediaDist] = useState<any[]>([]);
  const [hourly, setHourly] = useState<any[]>([]);
  const [weekday, setWeekday] = useState<any[]>([]);
  const [agentPerf, setAgentPerf] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async (overrideDays?: number) => {
      setLoading(true);
      try {
        const days = overrideDays ?? (period === 'today' ? 1 : period === '7days' ? 7 : 30);
        const [m, c, t, r] = await Promise.all([
          api.fetchDashboardMetrics(days),
          api.fetchChartData(days),
          api.fetchTeam(),
          api.fetchReport({ days }),
        ]);
        setMetrics(m);
        setChartData(c);
        setTeam(t || []);
        setStatusDist(r.statusDistribution || []);
        setMediaDist(r.mediaDistribution || []);
        setHourly(r.hourlyActivity || []);
        setWeekday(r.weekdayVolume || []);
        setAgentPerf(r.agentPerformance || []);
      } catch (e) {
        console.error('report load', e);
      } finally {
        setLoading(false);
      }
    };

    // If a custom date range is set, do not auto-load here (user must click Aplicar)
    if (!startDate && !endDate) {
      load();
    }
  }, [period, startDate, endDate]);

  const exportCsv = () => {
    const rows = metrics.map(m => [m.label, m.value, m.trend || ''].join(','));
    const csv = ['metric,value,trend', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Relatório WhatsApp</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Visão geral de conversas, mensagens e performance por atendente</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-gray-100/40 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-md px-2 py-1 flex items-center gap-2">
            <button onClick={() => { setStartDate(''); setEndDate(''); setPeriod('today'); }} className={`px-3 py-1 rounded-md text-sm ${period === 'today' ? 'bg-cyan-500/10 text-cyan-300' : 'text-gray-500 dark:text-slate-400'}`}>Hoje</button>
            <button onClick={() => { setStartDate(''); setEndDate(''); setPeriod('7days'); }} className={`px-3 py-1 rounded-md text-sm ${period === '7days' ? 'bg-cyan-500/10 text-cyan-300' : 'text-gray-500 dark:text-slate-400'}`}>7 dias</button>
            <button onClick={() => { setStartDate(''); setEndDate(''); setPeriod('30days'); }} className={`px-3 py-1 rounded-md text-sm ${period === '30days' ? 'bg-cyan-500/10 text-cyan-300' : 'text-gray-500 dark:text-slate-400'}`}>30 dias</button>
          </div>

          <div className="flex items-center gap-2 bg-gray-100/40 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-md px-2 py-1">
            <label className="sr-only">Data inicial</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none px-2 py-2 text-sm text-gray-900 dark:text-white" />
            <span className="text-gray-500 dark:text-slate-500 px-1">—</span>
            <label className="sr-only">Data final</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none px-2 py-2 text-sm text-gray-900 dark:text-white" />
            <button
              onClick={async () => {
                if (!startDate || !endDate) return;
                const s = new Date(startDate);
                const e = new Date(endDate);
                const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                setLoading(true);
                try {
                  const days = diff > 0 ? diff : 1;
                  const [m, c, t, r] = await Promise.all([
                    api.fetchDashboardMetrics(days),
                    api.fetchChartData(days),
                    api.fetchTeam(),
                    api.fetchReport({ days }),
                  ]);
                  setMetrics(m);
                  setChartData(c);
                  setTeam(t || []);
                  setStatusDist(r.statusDistribution || []);
                  setMediaDist(r.mediaDistribution || []);
                  setHourly(r.hourlyActivity || []);
                  setWeekday(r.weekdayVolume || []);
                  setAgentPerf(r.agentPerformance || []);
                } catch (err) {
                  console.error('apply range', err);
                } finally {
                  setLoading(false);
                }
              }}
              className="ml-2 px-3 py-2 bg-cyan-600 text-gray-900 dark:text-white rounded-md text-sm"
            >Aplicar</button>
          </div>

          <select value={selectedAgent || ''} onChange={e => setSelectedAgent(e.target.value || null)} className="bg-gray-100/40 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white">
            <option value="">Todos os Atendentes</option>
            {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={exportCsv} className="px-4 py-2 bg-emerald-500 text-gray-900 dark:text-white rounded-lg">Exportar CSV</button>
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m, idx) => (
          <MetricCard key={idx} title={m.label} value={m.value} info={m.trend} />
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="rounded-xl border border-gray-300/10 dark:border-slate-200/5 bg-gray-100/40 dark:bg-slate-900/40 p-4 h-64">
          <div className="mb-3"><strong className="text-gray-900 dark:text-white">Evolução no Período</strong></div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
              <YAxis tick={{ fill: '#94a3b8' }} />
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
              <Tooltip />
              <Area type="monotone" dataKey="chats" stroke="#06b6d4" fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-300/10 dark:border-slate-200/5 bg-gray-100/40 dark:bg-slate-900/40 p-4 h-64">
          <div className="mb-3"><strong className="text-gray-900 dark:text-white">Evolução de Mensagens Enviadas vs Recebidas</strong></div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
              <YAxis tick={{ fill: '#94a3b8' }} />
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
              <Tooltip />
              <Line type="monotone" dataKey="sent" stroke="#10b981" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="received" stroke="#06b6d4" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="rounded-xl border border-gray-300/10 dark:border-slate-200/5 bg-gray-100/40 dark:bg-slate-900/40 p-4 h-64">
          <div className="mb-3"><strong className="text-gray-900 dark:text-white">Distribuição por Status</strong></div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} fill="#8884d8" label />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-gray-300/10 dark:border-slate-200/5 bg-gray-100/40 dark:bg-slate-900/40 p-4 h-64">
          <div className="mb-3"><strong className="text-gray-900 dark:text-white">Distribuição por Tipo de Mídia</strong></div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={mediaDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} fill="#82ca9d" label />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="rounded-xl border border-gray-300/10 dark:border-slate-200/5 bg-gray-100/40 dark:bg-slate-900/40 p-4 h-64">
          <div className="mb-3"><strong className="text-gray-900 dark:text-white">Atividade por Hora do Dia</strong></div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourly}>
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8' }} />
              <YAxis tick={{ fill: '#94a3b8' }} />
              <Tooltip />
              <Bar dataKey="value" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-gray-300/10 dark:border-slate-200/5 bg-gray-100/40 dark:bg-slate-900/40 p-4 h-64">
          <div className="mb-3"><strong className="text-gray-900 dark:text-white">Volume por Dia da Semana</strong></div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weekday}>
              <XAxis dataKey="day" tick={{ fill: '#94a3b8' }} />
              <YAxis tick={{ fill: '#94a3b8' }} />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-gray-300/10 dark:border-slate-200/5 bg-gray-100/40 dark:bg-slate-900/40 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance por Atendente</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Conversas atendidas e tempo médio de resposta</p>
        <div className="mt-6 h-48 flex items-center justify-center text-gray-500 dark:text-slate-500">(Gráfico de barras)</div>
      </div>

      {/* Monitoramento moved to a dedicated sub-tab under Relatório */}
    </div>
  );
};

export default Report;
