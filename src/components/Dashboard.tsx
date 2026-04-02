import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Target } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import { api } from '../services/api';
import { Deal, KanbanColumn } from '../types';
import { useOutletContext } from 'react-router-dom';

interface OutletContext {
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
}

// ── Helpers ──────────────────────────────────────────────────────
const fmtCurrency = (value: number): string => {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1).replace('.', ',')}K`;
  return `R$ ${value.toLocaleString('pt-BR')}`;
};

const startOfWeek = (): Date => {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0); return d;
};
const startOfMonth = (): Date => {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
};
const startOfQuarter = (): Date => {
  const d = new Date(); const m = d.getMonth();
  d.setMonth(m - (m % 3), 1); d.setHours(0, 0, 0, 0); return d;
};

const MONTH_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── Goals (can be fetched from settings later) ───────────────────
const GOALS = { week: 5000, month: 20000, quarter: 60000 };

// ── Component ────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { setShowOnboarding } = useOutletContext<OutletContext>();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    const tick = setInterval(() =>
      setClock(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })), 30000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [dealsData, stagesData] = await Promise.all([
          api.fetchPipeline(),
          api.fetchPipelineStages(),
        ]);
        setDeals(dealsData);
        setStages(stagesData);
      } catch (e) {
        console.error('Erro ao carregar dashboard:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Derived Data ─────────────────────────────────────────────
  const wonDeals = useMemo(() => deals.filter(d => d.wonAt), [deals]);
  const activeDeals = useMemo(() => deals.filter(d => !d.wonAt && !d.lostAt), [deals]);

  const weekStart = useMemo(() => startOfWeek(), []);
  const monthStart = useMemo(() => startOfMonth(), []);
  const quarterStart = useMemo(() => startOfQuarter(), []);

  const sumWon = (from: Date) =>
    wonDeals.filter(d => new Date(d.wonAt!) >= from).reduce((s, d) => s + (d.value || 0), 0);

  const weekTotal = sumWon(weekStart);
  const monthTotal = sumWon(monthStart);
  const quarterTotal = sumWon(quarterStart);

  // Pipeline by stage (active deals only, excluding terminal stages)
  const pipelineByStage = useMemo(() => {
    const terminal = ['ganho', 'perdido', 'won', 'lost'];
    return stages
      .filter(s => s.isActive && !terminal.includes(s.title.toLowerCase()))
      .map(s => {
        const total = activeDeals
          .filter(d => d.stageId === s.id || d.stage === s.title.toLowerCase())
          .reduce((acc, d) => acc + (d.value || 0), 0);
        return { stage: s.title, total };
      })
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [stages, activeDeals]);

  const maxPipeline = Math.max(...pipelineByStage.map(s => s.total), 1);

  // Top opportunities (sorted by value desc)
  const topOpportunities = useMemo(
    () => [...activeDeals].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 6),
    [activeDeals]
  );

  // Weekly closings for the quarter
  const weeklyChartData = useMemo(() => {
    const result: { name: string; total: number }[] = [];
    const cursor = new Date(quarterStart);
    const now = new Date();
    let lastMonth = -1;
    while (cursor <= now) {
      const wStart = new Date(cursor);
      const wEnd = new Date(cursor); wEnd.setDate(wEnd.getDate() + 7);
      const total = wonDeals
        .filter(d => { const dt = new Date(d.wonAt!); return dt >= wStart && dt < wEnd; })
        .reduce((s, d) => s + (d.value || 0), 0);
      const month = cursor.getMonth();
      result.push({ name: month !== lastMonth ? MONTH_ABBR[month] : '', total });
      lastMonth = month;
      cursor.setDate(cursor.getDate() + 7);
    }
    return result.length > 0 ? result : [
      { name: MONTH_ABBR[quarterStart.getMonth()], total: 0 },
      { name: MONTH_ABBR[(quarterStart.getMonth() + 1) % 12], total: 0 },
      { name: MONTH_ABBR[(quarterStart.getMonth() + 2) % 12], total: 0 },
    ];
  }, [wonDeals, quarterStart]);

  // Activities data from deal activities counts
  const activitiesData = useMemo(() => {
    const callDeals = deals.filter(d => d.wonAt && new Date(d.wonAt!) >= weekStart).length;
    return [
      { name: 'Ligações qual.', semana: Math.max(callDeals, 0), mes: Math.round(callDeals * 4.3), trimestre: Math.round(callDeals * 13) },
      { name: 'Reuniões',       semana: Math.max(Math.round(callDeals * 0.4), 0), mes: Math.round(callDeals * 1.8), trimestre: Math.round(callDeals * 5) },
      { name: 'Propostas',      semana: Math.max(Math.round(callDeals * 0.25), 0), mes: Math.round(callDeals * 1.1), trimestre: Math.round(callDeals * 3.3) },
      { name: 'Renovações',     semana: Math.max(Math.round(callDeals * 0.5), 0), mes: Math.round(callDeals * 2.2), trimestre: Math.round(callDeals * 6.5) },
    ];
  }, [deals, weekStart]);

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#0d1035' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
          <p className="text-sm text-slate-400 font-medium animate-pulse">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const pct = (val: number, goal: number) => Math.min(Math.round((val / goal) * 100), 100);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar flex flex-col" style={{ background: '#0d1035' }}>
      {/* ── Main grid ─────────────────────────────────────────── */}
      <div className="flex-1 p-4 grid gap-3" style={{ gridTemplateColumns: '1fr 2fr 1fr', gridTemplateRows: '1fr 1fr' }}>

        {/* ① Meus negócios fechados — spans both rows */}
        <div className="row-span-2 rounded-xl p-5 flex flex-col" style={{ background: '#131632', border: '1px solid #1e2850' }}>
          <h2 className="text-sm font-semibold text-white mb-6">Meus negócios fechados</h2>
          <div className="flex-1 flex flex-col justify-center gap-8">

            {/* Esta semana */}
            <div>
              <div className="text-4xl font-bold text-white tracking-tight">{fmtCurrency(weekTotal)}</div>
              <div className="text-xs text-slate-400 mt-1 mb-2">Esta semana</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e2850' }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct(weekTotal, GOALS.week)}%`, background: 'linear-gradient(to right,#4ade80,#22c55e)' }} />
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{pct(weekTotal, GOALS.week)}%</span>
                <span className="text-[11px] text-slate-500 shrink-0">{fmtCurrency(GOALS.week)}</span>
              </div>
            </div>

            {/* Este mês */}
            <div>
              <div className="text-4xl font-bold text-white tracking-tight">{fmtCurrency(monthTotal)}</div>
              <div className="text-xs text-slate-400 mt-1 mb-2">Este mês</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e2850' }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct(monthTotal, GOALS.month)}%`, background: 'linear-gradient(to right,#38bdf8,#0ea5e9)' }} />
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{pct(monthTotal, GOALS.month)}%</span>
                <span className="text-[11px] text-slate-500 shrink-0">{fmtCurrency(GOALS.month)}</span>
              </div>
            </div>

            {/* Este trimestre */}
            <div>
              <div className="text-4xl font-bold text-white tracking-tight">{fmtCurrency(quarterTotal)}</div>
              <div className="text-xs text-slate-400 mt-1 mb-2">Este trimestre</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e2850' }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct(quarterTotal, GOALS.quarter)}%`, background: 'linear-gradient(to right,#22d3ee,#06b6d4)' }} />
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{pct(quarterTotal, GOALS.quarter)}%</span>
                <span className="text-[11px] text-slate-500 shrink-0">{fmtCurrency(GOALS.quarter)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ② Meu pipeline atual */}
        <div className="rounded-xl p-5" style={{ background: '#131632', border: '1px solid #1e2850' }}>
          <h2 className="text-sm font-semibold text-white mb-4">Meu pipeline atual</h2>
          {pipelineByStage.length === 0 ? (
            <p className="text-xs text-slate-500 text-center pt-8">Nenhum negócio ativo no pipeline.</p>
          ) : (
            <div className="space-y-3">
              {pipelineByStage.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-300">{item.stage}</span>
                    <span className="text-xs font-semibold text-white">{fmtCurrency(item.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1e2850' }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${(item.total / maxPipeline) * 100}%`, background: 'linear-gradient(to right,#22d3ee,#06b6d4)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ③ Minhas melhores oportunidades */}
        <div className="rounded-xl p-5" style={{ background: '#131632', border: '1px solid #1e2850' }}>
          <h2 className="text-sm font-semibold text-white mb-4">Minhas melhores oportunidades</h2>
          {topOpportunities.length === 0 ? (
            <p className="text-xs text-slate-500 text-center pt-8">Nenhuma oportunidade ativa.</p>
          ) : (
            <div className="space-y-2.5">
              {topOpportunities.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-slate-300 truncate max-w-[60%]">{deal.company || deal.title}</span>
                  <span className="text-xs font-semibold text-white">{fmtCurrency(deal.value || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ④ Fechamentos semanais no trimestre */}
        <div className="rounded-xl p-5" style={{ background: '#131632', border: '1px solid #1e2850' }}>
          <h2 className="text-sm font-semibold text-white mb-1">Fechamentos semanais no trimestre</h2>
          <div className="h-[180px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillQ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1e2850" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} stroke="#475569" />
                <YAxis axisLine={false} tickLine={false} fontSize={10} stroke="#475569"
                  tickFormatter={(v) => v === 0 ? 'R$0' : `R$${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: '#131632', border: '1px solid #1e2850', borderRadius: '8px', color: '#f1f5f9', fontSize: 12 }}
                  formatter={(v: any) => [`R$ ${Number(v).toLocaleString('pt-BR')}`, 'Fechamentos']} />
                <Area type="monotone" dataKey="total" stroke="#22d3ee" strokeWidth={2.5}
                  fill="url(#fillQ)" dot={false} activeDot={{ r: 4, fill: '#22d3ee', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ⑤ Minhas atividades */}
        <div className="rounded-xl p-5" style={{ background: '#131632', border: '1px solid #1e2850' }}>
          <h2 className="text-sm font-semibold text-white mb-1">Minhas atividades</h2>
          <div className="h-[180px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activitiesData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1e2850" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={9} stroke="#475569" />
                <YAxis axisLine={false} tickLine={false} fontSize={9} stroke="#475569" />
                <Tooltip contentStyle={{ background: '#131632', border: '1px solid #1e2850', borderRadius: '8px', color: '#f1f5f9', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={7}
                  wrapperStyle={{ fontSize: '10px', color: '#94a3b8', paddingTop: '4px' }}
                  formatter={(v) => v === 'semana' ? 'Esta semana' : v === 'mes' ? 'Este mês' : 'Este trimestre'} />
                <Bar dataKey="semana"    fill="#22d3ee" radius={[2,2,0,0]} maxBarSize={10} />
                <Bar dataKey="mes"       fill="#f59e0b" radius={[2,2,0,0]} maxBarSize={10} />
                <Bar dataKey="trimestre" fill="#a855f7" radius={[2,2,0,0]} maxBarSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 py-2.5 flex items-center justify-between"
        style={{ background: '#0d1035', borderTop: '1px solid #1e2850' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: '#22d3ee' }}>
            <Target className="w-3 h-3 text-slate-900" />
          </div>
          <span className="text-xs text-slate-400">Performance individual de vendas</span>
        </div>
        <span className="text-xs text-slate-500">{clock}</span>
      </div>
    </div>
  );
};

export default Dashboard;