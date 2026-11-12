import { useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/trading";

export function OrdersPanel({
  mode,
  orders,
  selected,
  now,
  onSelect,
  onClose,
}: {
  mode: "portfolio" | "history";
  orders: Order[];
  selected?: string | undefined;
  now: number;
  onSelect: (o: Order) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const rows = orders
    .filter((o) =>
      mode === "portfolio"
        ? o.status !== "closed" && o.status !== "rejected"
        : o.status === "closed",
    )
    .filter(
      (o) => filter === "all" || (filter === "win" ? (o.result ?? 0) > 0 : (o.result ?? 0) < 0),
    )
    .sort((a, b) => b.openedAt - a.openedAt);
  return (
    <aside className="order-sidebar flex min-h-0 w-[350px] shrink-0 flex-col border-r border-border bg-panel">
      <header className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-xl">
          {mode === "portfolio" ? "Portfólio total" : "Histórico de trading"}
        </h2>
        <Button variant="ghost" size="icon" aria-label="Fechar painel" onClick={onClose}>
          <X />
        </Button>
      </header>
      <div className="border-b border-border p-4">
        {mode === "history" ? (
          <select
            className="input"
            aria-label="Filtrar histórico"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todas as posições</option>
            <option value="win">Lucro</option>
            <option value="loss">Prejuízo</option>
          </select>
        ) : (
          <div className="flex justify-between">
            <span>{rows.length} ordens abertas</span>
            <span className="text-gold">${rows.reduce((s, o) => s + o.amt, 0).toFixed(2)}</span>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {!rows.length && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {mode === "portfolio" ? "Nenhuma ordem aberta" : "Nenhuma ordem encerrada"}
          </p>
        )}
        {rows.map((o) => (
          <Button
            key={o.id}
            variant="ghost"
            onClick={() => onSelect(o)}
            className={`h-auto w-full justify-start rounded-none border-b border-border p-4 text-left ${selected === o.id ? "bg-panel-2" : ""}`}
          >
            <div className="w-12 shrink-0">
              <div className="text-base">
                {new Date(o.openedAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(o.openedAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                })}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base">{o.asset}</span>
                {o.dir === "up" ? (
                  <TrendingUp className="text-up" />
                ) : (
                  <TrendingDown className="text-down" />
                )}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Digital · ${o.amt.toFixed(2)}</span>
                <span
                  className={
                    o.result === undefined ? "text-gold" : o.result >= 0 ? "text-up" : "text-down"
                  }
                >
                  {o.status === "pending"
                    ? "Aguardando confirmação"
                    : o.status === "open"
                      ? `${Math.max(0, Math.ceil((o.expiresAt - now) / 1000))}s · aberta`
                      : o.result === undefined
                        ? "Liquidada pela corretora"
                        : `${o.result >= 0 ? "+" : "−"}$${Math.abs(o.result).toFixed(2)} (${((o.result / o.amt) * 100).toFixed(0)}%)`}
                </span>
              </div>
            </div>
          </Button>
        ))}
      </div>
      <div className="border-t border-border p-3 text-xs text-muted-foreground">
        Conta demo · cotação e liquidação reais da IQ Option
      </div>
    </aside>
  );
}
