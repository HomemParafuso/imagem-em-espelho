import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase, Clock, LayoutGrid, Plus, Minus, User, ChevronDown, CircleDollarSign, Info, Bell, Star, TrendingUp,
  TrendingDown, Pencil, Radio, X, Volume2, Settings, Maximize, LifeBuoy, ChevronUp, Timer, Flag, Bot, ShieldCheck,
} from "lucide-react";
import { useCallback, useRef } from "react";
import { z } from "zod";
import { AgentSidecar } from "@/components/AgentSidecar";
import { OrdersPanel } from "@/components/OrdersPanel";
import { ManagementPanel } from "@/components/ManagementPanel";
import { Button } from "@/components/ui/button";
import { defaultRules, settleOrder, tradeBlock, entryAmount, type Order, type Rules } from "@/lib/trading";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TradeX — EUR/USD Digital" },
      { name: "description", content: "Negocie EUR/USD com gráfico de velas ao vivo e opções digitais." },
      { property: "og:title", content: "TradeX — EUR/USD Digital" },
      { property: "og:description", content: "Gráfico de velas ao vivo e opções digitais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: z.object({ thread: z.string().optional() }),
  component: Index,
});

type Candle = { o: number; h: number; l: number; c: number };

function seed(): Candle[] {
  const out: Candle[] = [];
  let p = 1.1262;
  const drift = [0.0004, 0, 0.0003, 0.0007, 0.0006, -0.0001, 0.0006, 0.0002, 0.0012, -0.0002, -0.0003, 0];
  for (const d of drift) {
    const o = p, c = p + d;
    out.push({ o, c, h: Math.max(o, c) + 0.0001, l: Math.min(o, c) - 0.0001 });
    p = c;
  }
  return out;
}

const side = [
  [Briefcase, "PORTFÓLIO TOTAL"], [Clock, "HISTÓRICO DE TRADING"], [LayoutGrid, "MEU DESEMPENHO"],
] as const;

function Index() {
  const [candles, setCandles] = useState<Candle[]>(seed);
  const [invest, setInvest] = useState(12);
  const [balance, setBalance] = useState(1104.42);
  const [now, setNow] = useState<Date | null>(null);
  const [toast, setToast] = useState(true);
  const { thread } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [agentOpen, setAgentOpen] = useState(true);
  const selectThread = useCallback((id: string) => navigate({ search: { thread: id }, replace: true }), [navigate]);
  const candlesRef = useRef<Candle[]>([]);
  const getMarket = useCallback(() => {
    const cs = candlesRef.current; const last = cs[cs.length - 1];
    return `Ativo: EUR/USD (OTC). Preço atual: ${last?.c.toFixed(6)}. Últimas velas de 1m (abertura/máxima/mínima/fechamento):\n` +
      cs.map((c) => [c.o, c.h, c.l, c.c].map((v) => v.toFixed(5)).join(" / ")).join("\n");
  }, []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rules, setRules] = useState<Rules>(defaultRules);
  const [duration, setDuration] = useState(60);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<"portfolio" | "history" | null>(null);
  const [management, setManagement] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [tradeError, setTradeError] = useState("");
  const ordersRef = useRef<Order[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tradex-trading-v1");
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.orders)) { setOrders(saved.orders); ordersRef.current = saved.orders; }
        if (typeof saved.balance === "number") setBalance(saved.balance);
        if (saved.rules) { const merged = {...defaultRules,...saved.rules}; setRules(merged); setInvest(merged.entry); }
        if (typeof saved.duration === "number" && saved.duration >= 5 && saved.duration <= 3600) setDuration(saved.duration);
      }
    } catch { /* Keep demo defaults when browser storage is unavailable. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    ordersRef.current = orders;
    try { localStorage.setItem("tradex-trading-v1", JSON.stringify({orders,balance,rules,duration})); } catch { /* In-memory session remains usable. */ }
  }, [orders,balance,rules,duration,ready]);
  const positions = orders.filter(o => o.closedAt === undefined);
  const chosen = orders.find(o => o.id === selected);
  const changeRules = (r: Rules) => { setRules(r); setInvest(r.entry); setTradeError(""); };

  useEffect(() => {
    setNow(new Date());
    let tick = 0;
    const id = setInterval(() => {
      setNow(new Date());
      tick++;
      setCandles((cs) => {
        const previous = cs[cs.length - 1];
        if (!previous) return cs;
        const last: Candle = { ...previous };
        const c = last.c + (Math.random() - 0.5) * 0.00012;
        last.c = c; last.h = Math.max(last.h, c); last.l = Math.min(last.l, c);
        const next = [...cs.slice(0, -1), last];
        if (tick % 15 === 0) next.push({ o: c, h: c, l: c, c });
        return next.slice(-14);
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  candlesRef.current = candles;
  const price = candles[candles.length - 1]?.c ?? 1.1262;
  useEffect(() => {
    if (!ready || !now) return;
    const time = now.getTime();
    let credit = 0;
    const next = ordersRef.current.map(o => {
      const closed = settleOrder(o, price, time);
      if (closed !== o) credit += o.amt + (closed.result ?? 0);
      return closed;
    });
    if (next.some((o,i) => o !== ordersRef.current[i])) {
      ordersRef.current = next;
      setOrders(next);
      setBalance(b => Number((b + credit).toFixed(2)));
    }
  }, [now,price,ready]);
  const W = 1500, H = 900, min = 1.1250, max = 1.1325;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const step = 86, x0 = 40;
  const ma = useMemo(() => candles.map((_, i) => {
    const s = candles.slice(Math.max(0, i - 3), i + 1);
    return s.reduce((a, b) => a + b.c, 0) / s.length;
  }), [candles]);
  const lastX = x0 + (candles.length - 1) * step + step / 2;
  const fmt = (d: Date | null) => d ? d.toLocaleTimeString("pt-BR") : "--:--:--";
  const secsLeft = now ? 60 - now.getSeconds() : 0;

  const trade = (dir: "up" | "down") => {
    if (!ready) return;
    const amount = entryAmount({...rules,entry:invest},balance,ordersRef.current);
    const error = tradeBlock(rules,ordersRef.current,amount,balance,1104.42);
    if (error) { setTradeError(error); return; }
    const time = Date.now();
    const order: Order = {id:crypto.randomUUID(),asset:"EUR/USD (OTC)",dir:rules.invert ? dir === "up" ? "down" : "up" : dir,price,amt:amount,openedAt:time,expiresAt:time + duration * 1000};
    const next = [...ordersRef.current,order]; ordersRef.current = next; setOrders(next);
    setBalance(b => Number((b-amount).toFixed(2))); setSelected(order.id); setTradeError(""); setToast(false);
  };
  const openPanel = (p: "portfolio" | "history") => { setPanel(current => current === p ? null : p); setAgentOpen(false); };
  const selectOrder = (o: Order) => {setSelected(o.id);setToast(false);};

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Top bar */}
      <header className="flex h-[88px] items-center gap-4 border-b border-border bg-panel px-5">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-down text-lg font-bold">X</div>
          <span className="text-3xl font-light tracking-tight">tradex</span>
        </div>
        <button className="grid h-14 w-14 place-items-center rounded border border-border bg-panel-2"><LayoutGrid className="h-7 w-7" /></button>
        <div className="flex h-14 items-center gap-3 border-b-2 border-gold bg-panel-2 px-4">
          <Flagged />
          <div className="leading-tight"><div className="font-medium">EUR/USD (O...</div><div className="text-xs text-muted-foreground">Digital</div></div>
        </div>
        <button className="grid h-14 w-14 place-items-center rounded border border-border"><Plus /></button>
        <div className="ml-auto flex items-center gap-6">
          <div className="flex items-center gap-1"><div className="grid h-14 w-14 place-items-center rounded-full bg-panel-2"><User className="h-8 w-8 text-muted-foreground" /></div><ChevronDown className="h-4 w-4 text-muted-foreground" /></div>
          <div className="flex items-center gap-1 text-2xl font-medium text-gold">${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}<ChevronDown className="h-4 w-4" /></div>
          <button className="flex h-14 items-center gap-3 rounded border border-up px-7 text-2xl text-up hover:bg-up/10"><CircleDollarSign className="h-7 w-7" />Depositar</button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="nav-rail flex w-[92px] shrink-0 flex-col items-center gap-5 border-r border-border bg-panel py-4">
          {side.slice(0,2).map(([Icon, label],i) => (
            <Button variant="ghost" key={label} onClick={() => openPanel(i === 0 ? "portfolio" : "history")} className={`h-auto w-full whitespace-normal rounded-none flex-col gap-1 px-1 text-center text-[11px] leading-tight ${panel === (i === 0 ? "portfolio" : "history") ? "bg-panel-2 text-foreground" : "text-muted-foreground"}`}>
              <Icon className="h-7 w-7" />{label}
            </Button>
          ))}
          <Button variant="ghost" onClick={() => {setAgentOpen((o) => !o);setPanel(null);}} className={`h-auto w-full whitespace-normal flex-col gap-1 px-1 text-center text-[11px] leading-tight ${agentOpen ? "text-up" : "text-muted-foreground hover:text-foreground"}`}>
            <Bot className="h-7 w-7" />AGENTE IA
          </Button>
          <Button variant="ghost" onClick={() => setManagement(true)} className="h-auto w-full whitespace-normal flex-col gap-1 px-1 text-center text-[11px] text-muted-foreground"><ShieldCheck className="h-7 w-7" />GERENCIAMENTO</Button>
          <Button variant="ghost" onClick={() => setManagement(true)} className="mt-auto h-auto w-full whitespace-normal flex-col gap-1 px-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Settings className="h-7 w-7" />CONFIGURAÇÃO
          </Button>
        </aside>

        {panel && <OrdersPanel mode={panel} orders={orders} selected={selected} now={now?.getTime() ?? 0} onSelect={selectOrder} onClose={() => setPanel(null)} />}
        {agentOpen && <AgentSidecar duration={duration} onDuration={setDuration} threadId={thread} onSelectThread={selectThread} getMarket={getMarket} onClose={() => setAgentOpen(false)} />}

        <main className="trading-main flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* Chart */}
            <section className="world-dots relative flex-1 overflow-hidden">
              <div className="absolute left-5 top-4 z-10">
                <div className="flex items-center gap-3"><Flagged /><div><div className="flex items-center gap-1 text-lg font-medium">EUR/USD (OTC)<ChevronDown className="h-4 w-4" /></div><div className="text-sm text-muted-foreground">Digital</div></div></div>
                <div className="mt-3 flex gap-2">
                  <button className="flex items-center gap-2 rounded-full bg-panel-2 px-3 py-1.5 text-sm"><Info className="h-4 w-4" />Info</button>
                  <button className="grid h-9 w-9 place-items-center rounded-full bg-panel-2"><Bell className="h-4 w-4" /></button>
                  <button className="grid h-9 w-9 place-items-center rounded-full bg-panel-2"><Star className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="absolute left-1/2 top-4 z-10 flex items-center gap-2">
                <span className="text-[10px] leading-tight">HORA DE<br />COMPRA</span>
                <span className="text-3xl font-light">00:{String(Math.max(0, secsLeft - 30)).padStart(2, "0")}</span>
              </div>

              {/* sentiment bar */}
              <div className="absolute left-1 top-[190px] z-10 flex flex-col items-center text-sm">
                <span>ACIMA</span><span>49%</span>
                <div className="my-1 h-[410px] w-6 overflow-hidden rounded">
                  <div className="h-[49%] bg-up/70" /><div className="h-[51%] bg-down/70" />
                </div>
                <span>ABAIXO</span><span>51%</span>
              </div>

              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                {[1.132, 1.130, 1.128, 1.126].map((v) => (
                  <g key={v}><line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeOpacity={0.5} />
                  <text x={W - 10} y={y(v) - 6} textAnchor="end" fontSize="16" fill="var(--foreground)">{v.toFixed(3)}</text></g>
                ))}
                {[1.1306, 1.13015, 1.1254].map((v) => <line key={v} x1={60} x2={W - 70} y1={y(v)} y2={y(v)} stroke="var(--magenta)" strokeWidth={1.5} />)}
                <polyline fill="none" stroke="var(--violet)" strokeWidth={3} points={candles.map((_, i) => `${x0 + i * step + step / 2},${y(1.1278 + i * 0.00008 + (i > 6 ? (i - 6) * 0.0001 : 0))}`).join(" ")} />
                <polyline fill="none" stroke="var(--up)" strokeWidth={2.5} points={ma.map((v, i) => `${x0 + i * step + step / 2},${y(v - 0.0006)}`).join(" ")} />
                {candles.map((c, i) => {
                  const cx = x0 + i * step + step / 2, up = c.c >= c.o, col = up ? "var(--up)" : "var(--down)";
                  const top = y(Math.max(c.o, c.c)), h = Math.max(4, Math.abs(y(c.o) - y(c.c)));
                  return <g key={i}><line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1.5} /><rect x={cx - 30} y={top} width={60} height={h} fill={col} /></g>;
                })}
                <line x1={0} x2={W} y1={y(price)} y2={y(price)} stroke="var(--foreground)" strokeDasharray="6 6" strokeOpacity={0.7} />
                <circle cx={lastX} cy={y(price)} r={14} fill="var(--up)" opacity={0.35}><animate attributeName="r" values="8;18;8" dur="1.5s" repeatCount="indefinite" /></circle>
                <line x1={lastX} x2={lastX} y1={0} y2={H - 40} stroke="var(--foreground)" strokeDasharray="3 4" />
                <line x1={lastX + 50} x2={lastX + 50} y1={0} y2={H - 40} stroke="var(--down)" strokeWidth={3} />
                <text x={lastX + 60} y={y(price) + 6} fontSize="16" fill="var(--muted-foreground)">00:{String(secsLeft).padStart(2, "0")}</text>
                {(chosen ? [chosen] : positions).map(p => <g key={p.id}><line x1={0} x2={W} y1={y(p.price)} y2={y(p.price)} stroke={p.dir === "up" ? "var(--up)" : "var(--down)"} strokeWidth={selected === p.id ? 4 : 2} /><text x={120} y={y(p.price)-12} fill={p.dir === "up" ? "var(--up)" : "var(--down)"} fontSize={22}>{p.dir === "up" ? "▲" : "▼"} ${p.amt.toFixed(2)} · {p.price.toFixed(5)}</text></g>)}
              </svg>

              <div className="absolute right-0 z-10 flex items-center" style={{ top: `calc(${(y(price) / H) * 100}% - 18px)` }}>
                <div className="h-9 border-y-[18px] border-r-[18px] border-y-transparent border-r-foreground" />
                <div className="flex h-9 items-center bg-foreground px-3 font-medium text-background">{price.toFixed(4)}<span className="text-down">{price.toFixed(6).slice(-2)}</span></div>
              </div>

              {chosen && <div className="absolute left-16 right-4 top-32 z-20 flex flex-wrap items-center gap-2 rounded border border-border bg-panel p-3 text-xs" data-testid="selected-order"><span className="font-medium">{chosen.asset} · {chosen.dir === "up" ? "ACIMA" : "ABAIXO"} · ${chosen.amt.toFixed(2)}</span><span className={chosen.result === undefined ? "text-gold" : chosen.result >= 0 ? "text-up" : "text-down"}>{chosen.closedAt === undefined ? `Em execução · ${Math.max(0,Math.ceil((chosen.expiresAt-(now?.getTime() ?? chosen.openedAt))/1000))}s` : `Encerrada · resultado ${chosen.result?.toFixed(2)}`}</span><Button variant="ghost" size="icon" className="ml-auto h-6 w-6" aria-label="Limpar seleção" onClick={() => setSelected(undefined)}><X /></Button></div>}
              <div className="absolute bottom-24 left-3 z-10 flex flex-col gap-2">
                {[<Radio key="a" className="h-4 w-4" />, "1m", <Radio key="b" className="h-4 w-4" />, <Pencil key="c" className="h-4 w-4" />, <TrendingUp key="d" className="h-4 w-4" />, "5m"].map((el, i) => (
                  <button key={i} className="grid h-10 w-10 place-items-center rounded border border-border bg-panel text-sm font-medium">{el}</button>
                ))}
              </div>

              {toast && (
                <div className="absolute bottom-10 left-16 z-20 flex w-96 items-center gap-4 rounded bg-panel p-6 shadow-2xl">
                  <Flagged /><div><div className="text-lg">EUR/USD (OTC)</div><div className="text-sm">Preço atingido {price.toFixed(5)}</div></div>
                  <button onClick={() => setToast(false)} className="absolute right-3 top-3 text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
              )}

              <div className="absolute bottom-2 left-0 right-0 z-10 flex items-center justify-around text-sm">
                <span>18:20:00</span><span>18:25:00</span>
                <span className="flex items-center gap-2"><Timer className="h-5 w-5" /><Flag className="h-5 w-5 text-down" /><span className="bg-panel-2 px-2 py-1">{now ? now.toISOString().slice(0, 10).replace(/-/g, ".") : ""} {fmt(now)}</span></span>
                <span>18:35:00</span>
                <button className="rounded-full bg-panel-2 px-6 py-2">Mostrar tudo</button>
              </div>
            </section>

            {/* Trade panel */}
            <aside className="trade-controls flex w-[150px] shrink-0 flex-col gap-2 p-2">
              <Stepper label="Invest" value={`$ ${invest}`} onPlus={() => setInvest((v) => v + 1)} onMinus={() => setInvest((v) => Math.max(1, v - 1))} />
              <Stepper label="Duração" value={`${duration}s`} onPlus={() => setDuration(v => Math.min(3600,v+5))} onMinus={() => setDuration(v => Math.max(5,v-5))} />
              <div className="mt-2 text-center"><div className="text-sm">Lucro</div><div className="text-5xl font-light text-up">+86<span className="text-2xl">%</span></div><div className="text-xl font-medium text-up">+${(invest * 0.86).toFixed(2)}</div></div>
              <Button disabled={!ready} onClick={() => trade("up")} className="flex h-36 flex-col items-center justify-center gap-2 rounded bg-up text-foreground font-medium hover:bg-up/90"><TrendingUp className="h-8 w-8" />ACIMA</Button>
              <Button disabled={!ready} onClick={() => trade("down")} className="flex h-36 flex-col items-center justify-center gap-2 rounded bg-down text-foreground font-medium hover:bg-down/90"><TrendingDown className="h-8 w-8" />ABAIXO</Button>
              {tradeError && <p role="alert" className="text-xs text-down">{tradeError}</p>}
            </aside>
          </div>

          <div className="flex h-10 items-center border-t border-border bg-panel px-6 text-sm">
            <span className="flex items-center gap-2 font-medium">Opções ({positions.length}) <X className="h-4 w-4" /></span>
            <span className="ml-auto flex items-center gap-2 text-muted-foreground">Exibir posições <ChevronUp className="h-4 w-4" /></span>
          </div>
          <div className="flex h-10 items-center justify-center gap-2 text-sm text-muted-foreground">
            {positions.length ? positions.map(p => <Button key={p.id} variant="ghost" onClick={() => selectOrder(p)} className={p.dir === "up" ? "text-up" : "text-down"}>${p.amt} @ {p.price.toFixed(5)}</Button>) : <>Você ainda não tem nenhuma posição aberta <Plus className="h-4 w-4 border border-border" /></>}
          </div>
        </main>
        {management && <ManagementPanel rules={rules} onChange={changeRules} onClose={() => setManagement(false)} />}
      </div>

      <footer className="flex h-11 items-center gap-4 border-t border-border bg-panel px-2 text-sm text-muted-foreground">
        <button className="flex items-center gap-2 rounded bg-down px-3 py-1.5 font-medium text-foreground"><LifeBuoy className="h-4 w-4" />SUPORTE</button>
        <span className="text-foreground">support@tradex.com</span><span>TODO DIA, A TODA HORA</span>
        <span className="ml-auto rounded bg-violet px-3 py-1 text-foreground">É o nosso aniversário! 🎁</span>
        <Volume2 className="h-5 w-5" /><Settings className="h-5 w-5" />
        <span>HORA ATUAL: <span className="text-foreground">{now ? now.toLocaleString("pt-BR", { day: "2-digit", month: "long" }).toUpperCase() : ""}, {fmt(now)}</span></span>
        <Maximize className="h-5 w-5" />
      </footer>
    </div>
  );
}

function Flagged() {
  return <div className="relative h-9 w-9 rounded-full bg-[linear-gradient(135deg,var(--violet),var(--down))]"><span className="absolute -bottom-1 -left-1 rounded bg-gold px-1 text-[9px] font-bold text-background">OTC</span></div>;
}

function Stepper({ label, value, onPlus, onMinus }: { label: string; value: string; onPlus: () => void; onMinus: () => void }) {
  return (
    <div className="flex rounded bg-panel-2">
      <div className="flex-1 px-3 py-2"><div className="text-sm text-muted-foreground">{label}</div><div className="text-lg">{value}</div></div>
      <div className="flex flex-col border-l border-border">
        <button onClick={onPlus} className="grid flex-1 place-items-center px-1"><Plus className="h-3 w-3" /></button>
        <button onClick={onMinus} className="grid flex-1 place-items-center border-t border-border px-1"><Minus className="h-3 w-3" /></button>
      </div>
    </div>
  );
}
