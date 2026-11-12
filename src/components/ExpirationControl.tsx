import { useMemo, useState } from "react";
import { Clock, Minus, Plus } from "lucide-react";
import { TIMEFRAME_OPTIONS } from "@/lib/market-chart";

type ExpirationControlProps = {
  now: Date | null;
  duration: number;
  onDuration: (duration: number) => void;
};

const expirationOptions = TIMEFRAME_OPTIONS.slice(0, 5);

function nextExpiration(now: Date | null, duration: number) {
  if (!now) return null;
  const milliseconds = duration * 1000;
  return new Date(Math.ceil(now.getTime() / milliseconds) * milliseconds);
}

function formatClock(date: Date | null) {
  return date ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
}

function formatRemaining(now: Date | null, expiration: Date | null) {
  if (!now || !expiration) return "--:--";
  const seconds = Math.max(0, Math.ceil((expiration.getTime() - now.getTime()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ExpirationControl({ now, duration, onDuration }: ExpirationControlProps) {
  const [open, setOpen] = useState(false);
  const expiration = useMemo(() => nextExpiration(now, duration), [duration, now]);
  const step = (direction: -1 | 1) => {
    const index = Math.max(
      0,
      expirationOptions.findIndex((option) => option.seconds === duration),
    );
    const next =
      expirationOptions[Math.min(expirationOptions.length - 1, Math.max(0, index + direction))];
    if (next) onDuration(next.seconds);
  };

  return (
    <div className="relative">
      <div className="rounded border border-border bg-panel-2">
        <div className="flex items-center justify-between px-3 pt-2 text-xs text-muted-foreground">
          <span>Expiração</span>
          <span className="text-[10px]">{formatRemaining(now, expiration)}</span>
        </div>
        <div className="flex h-12 items-center">
          <button
            className="flex flex-1 items-center gap-2 px-3 text-left text-xl"
            aria-label="Abrir tempos de expiração"
            onClick={() => setOpen((value) => !value)}
          >
            <Clock className="h-5 w-5 text-muted-foreground" />
            {formatClock(expiration)}
          </button>
          <div className="flex h-full flex-col border-l border-border">
            <button
              aria-label="Aumentar expiração"
              className="grid flex-1 place-items-center px-3 hover:bg-panel"
              onClick={() => step(1)}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              aria-label="Diminuir expiração"
              className="grid flex-1 place-items-center border-t border-border px-3 hover:bg-panel"
              onClick={() => step(-1)}
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="absolute bottom-0 right-full z-40 mr-2 w-56 rounded border border-border bg-panel p-2 shadow-2xl">
          <div className="px-3 py-2 text-sm text-muted-foreground">Tempo / Restante</div>
          {expirationOptions.slice(0, 3).map((option) => {
            const optionExpiration = nextExpiration(now, option.seconds);
            return (
              <button
                key={option.seconds}
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left hover:bg-panel-2 ${option.seconds === duration ? "bg-panel-2" : ""}`}
                onClick={() => {
                  onDuration(option.seconds);
                  setOpen(false);
                }}
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatClock(optionExpiration)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRemaining(now, optionExpiration)} · {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
