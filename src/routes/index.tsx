import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type PointerEvent, type WheelEvent } from "react";
import {
  Briefcase,
  Clock,
  LayoutGrid,
  Plus,
  Minus,
  User,
  ChevronDown,
  CircleDollarSign,
  Info,
  Bell,
  Star,
  TrendingUp,
  TrendingDown,
  Pencil,
  Radio,
  X,
  Volume2,
  Settings,
  Maximize,
  LifeBuoy,
  ChevronUp,
  Timer,
  Flag,
  Bot,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useRef } from "react";
import { z } from "zod";
import { AgentSidecar } from "@/components/AgentSidecar";
import { OrdersPanel } from "@/components/OrdersPanel";
import { ManagementPanel } from "@/components/ManagementPanel";
import { IndicatorMenu } from "@/components/IndicatorMenu";
import { EmaSettings } from "@/components/EmaSettings";
import { ExpirationControl } from "@/components/ExpirationControl";
import { Button } from "@/components/ui/button";
import { useIqWebSocket, type BrokerEvent, type WsCandle } from "@/hooks/useIqWebSocket";
import { defaultRules, tradeBlock, entryAmount, type Order, type Rules } from "@/lib/trading";
import {
  aggregateCandles,
  formatTimeframe,
  mergeIntoMinuteCandle,
  TIMEFRAME_OPTIONS,
  type MarketCandle,
} from "@/lib/market-chart";
import {
  calculateSupportResistance,
  currentSupportResistance,
  SUPPORT_RESISTANCE_NAME,
} from "@/lib/support-resistance";
import { calculateMovingAverage, type MovingAverageConfig } from "@/lib/indicators";
import { applyBrokerEvent } from "@/lib/broker-events";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TradeX — EUR/USD Digital" },
      {
        name: "description",
        content: "Negocie EUR/USD com gráfico de velas ao vivo e opções digitais.",
      },
      { property: "og:title", content: "TradeX — EUR/USD Digital" },
      { property: "og:description", content: "Gráfico de velas ao vivo e opções digitais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: z.object({ thread: z.string().optional() }),
  component: Index,
});

type Candle = MarketCandle;

function getBackendHttpBase() {
  const local =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return local ? "http://127.0.0.1:4000" : window.location.origin;
}

const side = [
  [Briefcase, "PORTFÓLIO TOTAL"],
  [Clock, "HISTÓRICO DE TRADING"],
  [LayoutGrid, "MEU DESEMPENHO"],
] as const;

function Index() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [invest, setInvest] = useState(12);
  const [balance, setBalance] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const [toast, setToast] = useState(false);
  const { thread } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [agentOpen, setAgentOpen] = useState(true);
  const selectThread = useCallback(
    (id: string) => navigate({ search: { thread: id }, replace: true }),
    [navigate],
  );
  const [chartTimeframe, setChartTimeframe] = useState(60);
  const candlesRef = useRef<Candle[]>([]);
  const getMarket = useCallback(() => {
    const cs = candlesRef.current;
    const last = cs[cs.length - 1];
    const levels = currentSupportResistance(calculateSupportResistance(cs));
    return (
      `Ativo: EUR/USD (OTC). Preço atual: ${last?.c.toFixed(6)}. Últimas velas de ${formatTimeframe(chartTimeframe)} (abertura/máxima/mínima/fechamento):\n` +
      cs.map((c) => [c.o, c.h, c.l, c.c].map((v) => v.toFixed(5)).join(" / ")).join("\n") +
      `\nIndicador ${SUPPORT_RESISTANCE_NAME} ativo: ` +
      levels
        .filter((level) => level.resistance !== undefined || level.support !== undefined)
        .map(
          (level) =>
            `P${level.period} R=${level.resistance?.toFixed(5) ?? "-"} S=${level.support?.toFixed(5) ?? "-"}`,
        )
        .join("; ")
    );
  }, [chartTimeframe]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rules, setRules] = useState<Rules>(defaultRules);
  const [duration, setDuration] = useState(60);
  const [emaVisible, setEmaVisible] = useState(false);
  const [emaSettingsOpen, setEmaSettingsOpen] = useState(false);
  const [emaConfig, setEmaConfig] = useState<MovingAverageConfig>({
    period: 14,
    type: "EMA",
    color: "#c97b62",
    thickness: 1,
  });
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [timeframeMenu, setTimeframeMenu] = useState(false);
  const [visibleCount, setVisibleCount] = useState(80);
  const [panOffset, setPanOffset] = useState(0);
  const chartDrag = useRef<{ x: number; pan: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<"portfolio" | "history" | null>(null);
  const [management, setManagement] = useState(false);
  const [agentConfigRequest, setAgentConfigRequest] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [tradeError, setTradeError] = useState("");
  const ordersRef = useRef<Order[]>([]);

  // Proteção de rota simples: verificar autenticação
  useEffect(() => {
    const ssid = localStorage.getItem("parafuso_ssid");
    if (!ssid) {
      window.location.href = "/login.html";
    }
  }, []);

  // Conexão com WebSocket real
  const mergeIncomingCandles = useCallback((incoming: WsCandle[]) => {
    setCandles((prev) => {
      return mergeIntoMinuteCandle(prev, incoming);
    });
  }, []);
  const { wsStatus } = useIqWebSocket(
    (candle: WsCandle) => mergeIncomingCandles([candle]),
    mergeIncomingCandles,
    (event: BrokerEvent) => {
      if (event.name === "balance-changed") {
        const amounts = collectNumbers(event.msg, ["new_amount", "amount", "balance"]);
        const amount = amounts.find((value) => value > 0);
        if (amount !== undefined) setBalance(amount);
      }
      setOrders((current) => applyBrokerEvent(current, event));
    },
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tradex-trading-v1");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.rules) {
          const merged = { ...defaultRules, ...saved.rules };
          setRules(merged);
          setInvest(merged.entry);
        }
        if (Array.isArray(saved.orders)) setOrders(saved.orders as Order[]);
        if (typeof saved.duration === "number" && saved.duration >= 5 && saved.duration <= 3600)
          setDuration(saved.duration);
      }
    } catch {
      /* Keep demo defaults when browser storage is unavailable. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    ordersRef.current = orders;
    try {
      localStorage.setItem(
        "tradex-trading-v1",
        JSON.stringify({ orders, balance, rules, duration }),
      );
    } catch {
      /* In-memory session remains usable. */
    }
  }, [orders, balance, rules, duration, ready]);
  useEffect(() => {
    fetch(`${getBackendHttpBase()}/api/bankroll`)
      .then((response) => response.json())
      .then((result: { data?: { balance?: number } }) => {
        if (typeof result.data?.balance === "number") setBalance(result.data.balance);
      })
      .catch(() => setTradeError("Backend da corretora indisponível."));
  }, []);
  const positions = orders.filter((o) => o.closedAt === undefined);
  const chosen = orders.find((o) => o.id === selected);
  useEffect(() => {
    if (chosen?.closedAt !== undefined) setSelected(undefined);
  }, [chosen?.closedAt]);
  const changeRules = (r: Rules) => {
    setRules(r);
    setInvest(r.entry);
    setTradeError("");
  };

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  candlesRef.current = candles;
  const price = candles[candles.length - 1]?.c;
  const marketReady = wsStatus === "connected" && price !== undefined;
  const aggregatedCandles = useMemo(
    () => aggregateCandles(candles, chartTimeframe),
    [candles, chartTimeframe],
  );
  const chartRange = useMemo(() => {
    const end = Math.max(0, aggregatedCandles.length - panOffset);
    return { start: Math.max(0, end - visibleCount), end };
  }, [aggregatedCandles.length, panOffset, visibleCount]);
  const chartCandles = useMemo(
    () => aggregatedCandles.slice(chartRange.start, chartRange.end),
    [aggregatedCandles, chartRange],
  );
  const supportResistance = useMemo(
    () => calculateSupportResistance(aggregatedCandles),
    [aggregatedCandles],
  );
  const currentSupportResistanceLevels = useMemo(
    () => currentSupportResistance(supportResistance),
    [supportResistance],
  );
  const supportResistanceValues = useMemo(
    () =>
      currentSupportResistanceLevels.flatMap((level) =>
        [level.resistance, level.support].filter((value): value is number => value !== undefined),
      ),
    [currentSupportResistanceLevels],
  );
  const min = useMemo(() => {
    if (!chartCandles.length) return 1.12;
    const l = Math.min(...chartCandles.map((c) => c.l), ...supportResistanceValues);
    return l - 0.0003;
  }, [chartCandles, supportResistanceValues]);

  const max = useMemo(() => {
    if (!chartCandles.length) return 1.13;
    const h = Math.max(...chartCandles.map((c) => c.h), ...supportResistanceValues);
    return h + 0.0003;
  }, [chartCandles, supportResistanceValues]);

  const W = 1500,
    H = 900;
  const y = (v: number) => H - ((v - min) / Math.max(0.0001, max - min)) * H;
  const step = Math.max(8, Math.min(86, (W - 340) / Math.max(chartCandles.length, 1))),
    x0 = 40;
  const movingAverage = useMemo(
    () =>
      calculateMovingAverage(aggregatedCandles, emaConfig).slice(chartRange.start, chartRange.end),
    [aggregatedCandles, chartRange, emaConfig],
  );
  const lastX = x0 + (chartCandles.length - 1) * step + step / 2;
  const fmt = (d: Date | null) => (d ? d.toLocaleTimeString("pt-BR") : "--:--:--");
  const secsLeft = now ? duration - (Math.floor(now.getTime() / 1000) % duration) : 0;
  const formatRemaining = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const gridValues = [0, 1, 2, 3].map((index) => min + ((max - min) * index) / 3);
  const handleChartWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    setVisibleCount((current) =>
      Math.max(20, Math.min(200, current + (event.deltaY > 0 ? 10 : -10))),
    );
  };
  const handleChartPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    chartDrag.current = { x: event.clientX, pan: panOffset };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleChartPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!chartDrag.current) return;
    const delta = Math.round((event.clientX - chartDrag.current.x) / 12);
    setPanOffset(
      Math.max(
        0,
        Math.min(Math.max(0, aggregatedCandles.length - 20), chartDrag.current.pan + delta),
      ),
    );
  };
  const handleChartPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    chartDrag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const trade = async (dir: "up" | "down") => {
    if (!ready || !marketReady || price === undefined) return;
    const amount = entryAmount({ ...rules, entry: invest }, balance, ordersRef.current);
    const error = tradeBlock(rules, ordersRef.current, amount, balance, balance);
    if (error) {
      setTradeError(error);
      return;
    }
    setTradeError("");
    const response = await fetch(`${getBackendHttpBase()}/api/trade/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active_id: 76, direction: dir, expired_seconds: duration, amount }),
    });
    const result = (await response.json()) as {
      success?: boolean;
      message?: string;
      data?: string;
    };
    if (!result.success) {
      setTradeError(result.message ?? "A corretora recusou a ordem.");
      return;
    }
    setBalance((current) => Math.max(0, Number((current - amount).toFixed(2))));
    let brokerId: string | undefined;
    if (result.data) {
      try {
        const orderResult = JSON.parse(result.data) as { broker_id?: string };
        brokerId = orderResult.broker_id;
      } catch {
        brokerId = undefined;
      }
    }
    const time = Date.now();
    const order: Order = {
      id: crypto.randomUUID(),
      asset: "EUR/USD (OTC)",
      dir: rules.invert ? (dir === "up" ? "down" : "up") : dir,
      price,
      amt: amount,
      openedAt: time,
      expiresAt: time + duration * 1000,
      status: "open",
      ...(brokerId ? { brokerId } : {}),
    };
    const next = [...ordersRef.current, order];
    ordersRef.current = next;
    setOrders(next);
    setSelected(order.id);
    setToast(false);
  };
  const openPanel = (p: "portfolio" | "history") => {
    setPanel((current) => (current === p ? null : p));
    setAgentOpen(false);
  };
  const selectOrder = (o: Order) => {
    setSelected(o.id);
    setToast(false);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Top bar */}
      <header className="flex h-[88px] items-center gap-4 border-b border-border bg-panel px-5">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-orange text-lg font-bold text-white shadow-md">
            ⚙
          </div>
          <span className="text-3xl font-bold tracking-tight">
            parafuso<span className="text-[#ff5722]">trader</span>
          </span>
        </div>
        <button className="grid h-14 w-14 place-items-center rounded border border-border bg-panel-2">
          <LayoutGrid className="h-7 w-7" />
        </button>
        <div className="flex h-14 items-center gap-3 border-b-2 border-gold bg-panel-2 px-4">
          <Flagged />
          <div className="leading-tight">
            <div className="font-medium">EUR/USD (O...</div>
            <div className="text-xs text-muted-foreground">Digital</div>
          </div>
        </div>
        <button className="grid h-14 w-14 place-items-center rounded border border-border">
          <Plus />
        </button>
        <div className="ml-auto flex items-center gap-6">
          <div className="flex items-center gap-1">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-panel-2">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-1 text-2xl font-medium text-gold">
            ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            <ChevronDown className="h-4 w-4" />
          </div>
          <button className="flex h-14 items-center gap-3 rounded border border-up px-7 text-2xl text-up hover:bg-up/10">
            <CircleDollarSign className="h-7 w-7" />
            Depositar
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="nav-rail flex w-[92px] shrink-0 flex-col items-center gap-5 border-r border-border bg-panel py-4">
          {side.slice(0, 2).map(([Icon, label], i) => (
            <Button
              variant="ghost"
              key={label}
              onClick={() => openPanel(i === 0 ? "portfolio" : "history")}
              className={`h-auto w-full whitespace-normal rounded-none flex-col gap-1 px-1 text-center text-[11px] leading-tight ${panel === (i === 0 ? "portfolio" : "history") ? "bg-panel-2 text-foreground" : "text-muted-foreground"}`}
            >
              <Icon className="h-7 w-7" />
              {label}
            </Button>
          ))}
          <Button
            variant="ghost"
            onClick={() => {
              setAgentOpen((o) => !o);
              setPanel(null);
            }}
            className={`h-auto w-full whitespace-normal flex-col gap-1 px-1 text-center text-[11px] leading-tight ${agentOpen ? "text-up" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Bot className="h-7 w-7" />
            AGENTE IA
          </Button>
          <Button
            variant="ghost"
            onClick={() => setManagement(true)}
            className="h-auto w-full whitespace-normal flex-col gap-1 px-1 text-center text-[11px] text-muted-foreground"
          >
            <ShieldCheck className="h-7 w-7" />
            GERENCIAMENTO
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.removeItem("parafuso_ssid");
              window.location.href = "/login.html";
            }}
            className="mt-auto h-auto w-full whitespace-normal flex-col gap-1 px-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-7 w-7" />
            SAIR
          </Button>
        </aside>

        {panel && (
          <OrdersPanel
            mode={panel}
            orders={orders}
            selected={selected}
            now={now?.getTime() ?? 0}
            onSelect={selectOrder}
            onClose={() => setPanel(null)}
          />
        )}
        {agentOpen && (
          <AgentSidecar
            duration={duration}
            onDuration={setDuration}
            openConfigRequest={agentConfigRequest}
            threadId={thread}
            onSelectThread={selectThread}
            getMarket={getMarket}
            rules={rules}
            onClose={() => setAgentOpen(false)}
          />
        )}

        <main className="trading-main flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* Chart */}
            <section className="world-dots relative flex-1 overflow-hidden">
              <div className="absolute left-5 top-4 z-10">
                <div className="flex items-center gap-3">
                  <Flagged />
                  <div>
                    <div className="flex items-center gap-1 text-lg font-medium">
                      EUR/USD (OTC)
                      <ChevronDown className="h-4 w-4" />
                    </div>
                    <div className="text-sm text-muted-foreground">Digital</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="flex items-center gap-2 rounded-full bg-panel-2 px-3 py-1.5 text-sm">
                    <Info className="h-4 w-4" />
                    Info
                  </button>
                  <button className="grid h-9 w-9 place-items-center rounded-full bg-panel-2">
                    <Bell className="h-4 w-4" />
                  </button>
                  <button className="grid h-9 w-9 place-items-center rounded-full bg-panel-2">
                    <Star className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="absolute left-1/2 top-4 z-10 flex items-center gap-2">
                <span className="text-[10px] leading-tight">
                  HORA DE
                  <br />
                  COMPRA
                </span>
                <span className="text-3xl font-light">{formatRemaining(secsLeft)}</span>
              </div>

              {/* sentiment bar */}
              <div className="absolute left-1 top-[190px] z-10 flex flex-col items-center text-sm">
                <span>ACIMA</span>
                <span>--</span>
                <div className="my-1 h-[410px] w-6 overflow-hidden rounded bg-panel-2">
                  <div className="h-1/2 bg-muted/30" />
                </div>
                <span>ABAIXO</span>
                <span>--</span>
              </div>

              {chartCandles.length > 0 && (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                  onWheel={handleChartWheel}
                  onPointerDown={handleChartPointerDown}
                  onPointerMove={handleChartPointerMove}
                  onPointerUp={handleChartPointerUp}
                  style={{ touchAction: "none", cursor: chartDrag.current ? "grabbing" : "grab" }}
                >
                  {gridValues.map((v) => (
                    <g key={v}>
                      <line
                        x1={0}
                        x2={W}
                        y1={y(v)}
                        y2={y(v)}
                        stroke="var(--border)"
                        strokeOpacity={0.5}
                      />
                      <text
                        x={W - 10}
                        y={y(v) - 6}
                        textAnchor="end"
                        fontSize="16"
                        fill="var(--foreground)"
                      >
                        {v.toFixed(5)}
                      </text>
                    </g>
                  ))}
                  {currentSupportResistanceLevels.flatMap((level) =>
                    [
                      { value: level.resistance, label: `R${level.period}` },
                      { value: level.support, label: `S${level.period}` },
                    ].map(({ value, label }) =>
                      value === undefined ? null : (
                        <line
                          key={`${level.period}-${label}`}
                          x1={0}
                          x2={W}
                          y1={y(value)}
                          y2={y(value)}
                          stroke="#ff4fa3"
                          strokeOpacity={0.9}
                          strokeWidth={1}
                        />
                      ),
                    ),
                  )}
                  {emaVisible && (
                    <polyline
                      fill="none"
                      stroke={emaConfig.color}
                      strokeWidth={emaConfig.thickness}
                      points={movingAverage
                        .map((v, i) =>
                          v === undefined ? null : `${x0 + i * step + step / 2},${y(v)}`,
                        )
                        .filter((point): point is string => point !== null)
                        .join(" ")}
                    />
                  )}
                  {chartCandles.map((c, i) => {
                    const cx = x0 + i * step + step / 2,
                      up = c.c >= c.o,
                      col = up ? "var(--up)" : "var(--down)";
                    const top = y(Math.max(c.o, c.c)),
                      h = Math.max(4, Math.abs(y(c.o) - y(c.c)));
                    return (
                      <g key={i}>
                        <line
                          x1={cx}
                          x2={cx}
                          y1={y(c.h)}
                          y2={y(c.l)}
                          stroke={col}
                          strokeWidth={1.5}
                        />
                        <rect
                          x={cx - Math.max(3, step * 0.34)}
                          y={top}
                          width={Math.max(6, step * 0.68)}
                          height={h}
                          fill={col}
                        />
                      </g>
                    );
                  })}
                  {price !== undefined && (
                    <>
                      <line
                        x1={0}
                        x2={W}
                        y1={y(price)}
                        y2={y(price)}
                        stroke="var(--foreground)"
                        strokeDasharray="6 6"
                        strokeOpacity={0.7}
                      />
                      <circle cx={lastX} cy={y(price)} r={14} fill="var(--up)" opacity={0.35}>
                        <animate
                          attributeName="r"
                          values="8;18;8"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      <line
                        x1={lastX}
                        x2={lastX}
                        y1={0}
                        y2={H - 40}
                        stroke="var(--foreground)"
                        strokeDasharray="3 4"
                      />
                      <text
                        x={lastX + 60}
                        y={y(price) + 6}
                        fontSize="16"
                        fill="var(--muted-foreground)"
                      >
                        {formatRemaining(secsLeft)}
                      </text>
                    </>
                  )}
                  {positions.map((p) => (
                    <g key={p.id}>
                      <line
                        x1={0}
                        x2={W}
                        y1={y(p.price)}
                        y2={y(p.price)}
                        stroke={p.dir === "up" ? "var(--up)" : "var(--down)"}
                        strokeWidth={selected === p.id ? 4 : 2}
                      />
                      <text
                        x={120}
                        y={y(p.price) - 12}
                        fill={p.dir === "up" ? "var(--up)" : "var(--down)"}
                        fontSize={22}
                      >
                        {p.dir === "up" ? "▲" : "▼"} ${p.amt.toFixed(2)} · {p.price.toFixed(5)}
                      </text>
                    </g>
                  ))}
                </svg>
              )}

              {price !== undefined && (
                <div
                  className="absolute right-0 z-10 flex items-center"
                  style={{ top: `calc(${(y(price) / H) * 100}% - 18px)` }}
                >
                  <div className="h-9 border-y-[18px] border-r-[18px] border-y-transparent border-r-foreground" />
                  <div className="flex h-9 items-center bg-foreground px-3 font-medium text-background">
                    {price.toFixed(4)}
                    <span className="text-down">{price.toFixed(6).slice(-2)}</span>
                  </div>
                </div>
              )}
              {!marketReady && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-background/75 text-sm text-muted-foreground">
                  Aguardando dados reais da IQ Option…
                </div>
              )}

              {chosen && (
                <div
                  className="absolute left-16 right-4 top-32 z-20 flex flex-wrap items-center gap-2 rounded border border-border bg-panel p-3 text-xs"
                  data-testid="selected-order"
                >
                  <span className="font-medium">
                    {chosen.asset} · {chosen.dir === "up" ? "ACIMA" : "ABAIXO"} · $
                    {chosen.amt.toFixed(2)}
                  </span>
                  <span
                    className={
                      chosen.result === undefined
                        ? "text-gold"
                        : chosen.result >= 0
                          ? "text-up"
                          : "text-down"
                    }
                  >
                    {chosen.closedAt === undefined
                      ? `Em execução · ${Math.max(0, Math.ceil((chosen.expiresAt - (now?.getTime() ?? chosen.openedAt)) / 1000))}s`
                      : `Encerrada · resultado ${chosen.result?.toFixed(2)}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-6 w-6"
                    aria-label="Limpar seleção"
                    onClick={() => setSelected(undefined)}
                  >
                    <X />
                  </Button>
                </div>
              )}
              <div className="absolute bottom-24 left-3 z-10 flex flex-col gap-2">
                {TIMEFRAME_OPTIONS.slice(0, 3).map((option) => (
                  <button
                    key={option.seconds}
                    title={`Velas de ${option.label}`}
                    onClick={() => {
                      setChartTimeframe(option.seconds);
                      setPanOffset(0);
                    }}
                    className={`grid h-10 w-12 place-items-center rounded border bg-panel text-sm font-medium ${chartTimeframe === option.seconds ? "border-primary text-primary" : "border-border"}`}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  title="Editar período das velas"
                  aria-label="Editar período das velas"
                  onClick={() => setTimeframeMenu((open) => !open)}
                  className="grid h-10 w-12 place-items-center rounded border border-border bg-panel"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  title="Abrir indicadores"
                  aria-label="Abrir indicadores"
                  onClick={() => setIndicatorsOpen((open) => !open)}
                  className={`grid h-10 w-12 place-items-center rounded border bg-panel ${emaVisible ? "border-primary text-primary" : "border-border"}`}
                >
                  <TrendingUp className="h-4 w-4" />
                </button>
                {indicatorsOpen && (
                  <IndicatorMenu
                    emaVisible={emaVisible}
                    onToggleEma={() => setEmaVisible((visible) => !visible)}
                    onOpenEmaSettings={() => setEmaSettingsOpen(true)}
                    onClose={() => setIndicatorsOpen(false)}
                  />
                )}
                {timeframeMenu && (
                  <div className="absolute bottom-0 left-14 grid w-64 grid-cols-3 gap-1 rounded border border-border bg-panel p-2 shadow-xl">
                    {TIMEFRAME_OPTIONS.map((option) => (
                      <button
                        key={option.seconds}
                        onClick={() => {
                          setChartTimeframe(option.seconds);
                          setPanOffset(0);
                          setTimeframeMenu(false);
                        }}
                        className={`rounded px-2 py-2 text-left text-xs ${chartTimeframe === option.seconds ? "bg-primary text-primary-foreground" : "hover:bg-panel-2"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded border border-border bg-panel/95 p-1 shadow-lg">
                <button
                  title="Afastar gráfico"
                  aria-label="Afastar gráfico"
                  onClick={() => setVisibleCount((current) => Math.min(200, current + 10))}
                  className="grid h-9 w-9 place-items-center rounded text-lg hover:bg-panel-2"
                >
                  −
                </button>
                <button
                  title="Recentralizar gráfico"
                  aria-label="Recentralizar gráfico"
                  onClick={() => {
                    setPanOffset(0);
                    setVisibleCount(60);
                  }}
                  className="grid h-9 w-10 place-items-center rounded border border-border text-base hover:bg-panel-2"
                >
                  ⌖
                </button>
                <button
                  title="Aproximar gráfico"
                  aria-label="Aproximar gráfico"
                  onClick={() => setVisibleCount((current) => Math.max(20, current - 10))}
                  className="grid h-9 w-9 place-items-center rounded text-lg hover:bg-panel-2"
                >
                  +
                </button>
              </div>

              {toast && price !== undefined && (
                <div className="absolute bottom-10 left-16 z-20 flex w-96 items-center gap-4 rounded bg-panel p-6 shadow-2xl">
                  <Flagged />
                  <div>
                    <div className="text-lg">EUR/USD (OTC)</div>
                    <div className="text-sm">Preço atingido {price.toFixed(5)}</div>
                  </div>
                  <button
                    onClick={() => setToast(false)}
                    className="absolute right-3 top-3 text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="absolute bottom-2 left-0 right-0 z-10 flex items-center justify-around text-sm">
                <span>18:20:00</span>
                <span>18:25:00</span>
                <span className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  <Flag className="h-5 w-5 text-down" />
                  <span className="bg-panel-2 px-2 py-1">
                    {now ? now.toISOString().slice(0, 10).replace(/-/g, ".") : ""} {fmt(now)}
                  </span>
                </span>
                <span>18:35:00</span>
                <button className="rounded-full bg-panel-2 px-6 py-2">Mostrar tudo</button>
              </div>
              {emaSettingsOpen && (
                <EmaSettings
                  initial={emaConfig}
                  onCancel={() => setEmaSettingsOpen(false)}
                  onApply={(config) => {
                    setEmaConfig(config);
                    setEmaVisible(true);
                    setEmaSettingsOpen(false);
                  }}
                />
              )}
            </section>

            {/* Trade panel */}
            <aside className="trade-controls flex w-[150px] shrink-0 flex-col gap-2 p-2">
              <Stepper
                label="Invest"
                value={`$ ${invest}`}
                onPlus={() => setInvest((v) => v + 1)}
                onMinus={() => setInvest((v) => Math.max(1, v - 1))}
              />
              <ExpirationControl now={now} duration={duration} onDuration={setDuration} />
              <div className="mt-2 text-center">
                <div className="text-sm">Payout da corretora</div>
                <div className="text-3xl font-light text-muted-foreground">--</div>
                <div className="text-sm text-muted-foreground">Aguardando cotação</div>
              </div>
              <Button
                disabled={!marketReady || !ready}
                onClick={() => trade("up")}
                className="flex h-36 flex-col items-center justify-center gap-2 rounded bg-up text-foreground font-medium hover:bg-up/90"
              >
                <TrendingUp className="h-8 w-8" />
                ACIMA
              </Button>
              <Button
                disabled={!marketReady || !ready}
                onClick={() => trade("down")}
                className="flex h-36 flex-col items-center justify-center gap-2 rounded bg-down text-foreground font-medium hover:bg-down/90"
              >
                <TrendingDown className="h-8 w-8" />
                ABAIXO
              </Button>
              {tradeError && (
                <p role="alert" className="text-xs text-down">
                  {tradeError}
                </p>
              )}
            </aside>
          </div>

          <div className="flex h-10 items-center border-t border-border bg-panel px-6 text-sm">
            <span className="flex items-center gap-2 font-medium">
              Opções ({positions.length}) <X className="h-4 w-4" />
            </span>
            <span className="ml-auto flex items-center gap-2 text-muted-foreground">
              Exibir posições <ChevronUp className="h-4 w-4" />
            </span>
          </div>
          <div className="flex h-10 items-center justify-center gap-2 text-sm text-muted-foreground">
            {positions.length ? (
              positions.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  onClick={() => selectOrder(p)}
                  className={p.dir === "up" ? "text-up" : "text-down"}
                >
                  ${p.amt} @ {p.price.toFixed(5)}
                </Button>
              ))
            ) : (
              <>
                Você ainda não tem nenhuma posição aberta{" "}
                <Plus className="h-4 w-4 border border-border" />
              </>
            )}
          </div>
        </main>
        {management && (
          <ManagementPanel
            rules={rules}
            onChange={changeRules}
            onClose={() => setManagement(false)}
          />
        )}
      </div>

      <footer className="flex h-11 items-center gap-4 border-t border-border bg-panel px-2 text-sm text-muted-foreground">
        <button className="flex items-center gap-2 rounded bg-down px-3 py-1.5 font-medium text-foreground">
          <LifeBuoy className="h-4 w-4" />
          SUPORTE
        </button>
        <span className="text-foreground">support@tradex.com</span>
        <span>TODO DIA, A TODA HORA</span>
        <span className="ml-auto rounded bg-violet px-3 py-1 text-foreground">
          É o nosso aniversário! 🎁
        </span>
        <Volume2 className="h-5 w-5" />
        <Settings className="h-5 w-5" />
        <span>
          HORA ATUAL:{" "}
          <span className="text-foreground">
            {now
              ? now.toLocaleString("pt-BR", { day: "2-digit", month: "long" }).toUpperCase()
              : ""}
            , {fmt(now)}
          </span>
        </span>
        <Maximize className="h-5 w-5" />
      </footer>
    </div>
  );
}

function collectNumbers(value: unknown, keys: string[]): number[] {
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  const direct = keys.flatMap((key) => {
    const number = Number(object[key]);
    return Number.isFinite(number) ? [number] : [];
  });
  return [...direct, ...Object.values(object).flatMap((child) => collectNumbers(child, keys))];
}

function Flagged() {
  return (
    <div className="relative h-9 w-9 rounded-full bg-[linear-gradient(135deg,var(--violet),var(--down))]">
      <span className="absolute -bottom-1 -left-1 rounded bg-gold px-1 text-[9px] font-bold text-background">
        OTC
      </span>
    </div>
  );
}

function Stepper({
  label,
  value,
  onPlus,
  onMinus,
}: {
  label: string;
  value: string;
  onPlus: () => void;
  onMinus: () => void;
}) {
  return (
    <div className="flex rounded bg-panel-2">
      <div className="flex-1 px-3 py-2">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-lg">{value}</div>
      </div>
      <div className="flex flex-col border-l border-border">
        <button onClick={onPlus} className="grid flex-1 place-items-center px-1">
          <Plus className="h-3 w-3" />
        </button>
        <button
          onClick={onMinus}
          className="grid flex-1 place-items-center border-t border-border px-1"
        >
          <Minus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
