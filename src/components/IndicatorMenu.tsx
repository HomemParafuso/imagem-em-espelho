import { useState } from "react";
import { Check, LineChart, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryDescriptions, indicatorDescriptions } from "@/lib/indicator-descriptions";

type IndicatorMenuProps = {
  emaVisible: boolean;
  onToggleEma: () => void;
  onOpenEmaSettings: () => void;
  onClose: () => void;
};

const categories = [
  "Adicionados",
  "Scripts",
  "Popular",
  "Momentum",
  "Tendência",
  "Volatilidade",
  "Médias móveis",
  "Volume",
];
const itemsByCategory: Record<string, string[]> = {
  Adicionados: ["Suporte e resistência"],
  Scripts: ["Suporte e resistência"],
  Popular: [
    "Alligator",
    "Average Directional Movement Index",
    "Average True Range",
    "Awesome Oscillator",
    "Bollinger Bands",
    "Commodity Channel Index",
    "Detrended Price Oscillator (DPO)",
    "Fractal",
    "MACD",
    "Momentum",
  ],
  Momentum: [
    "Aroon Oscillator",
    "Awesome Oscillator",
    "Balance of Power",
    "Belkhayate Timing",
    "Center of Gravity",
    "Chande Forecast Oscillator",
    "Chande Momentum Oscillator",
    "DeMarker",
    "Detrended Price Oscillator (DPO)",
    "DiNapoli MACD",
    "DiNapoli Preferred Stochastic",
  ],
  Tendência: [
    "ATR Trailing Stops",
    "Aroon",
    "Average Directional Movement Index",
    "Bollinger Bands %B",
    "Chop Zone",
    "Commodity Channel Index",
    "Darvas Box",
    "Disparity Index",
    "Ehler Fisher Transform",
    "Elder Impulse System",
    "Ichimoku Cloud",
  ],
  Volatilidade: [
    "ATR Bands",
    "Average True Range",
    "Bollinger Bands",
    "Chaikin Volatility",
    "Donchian Channels",
    "Donchian Width",
    "Gopalakrishnan Range Index",
    "High Low Bands",
    "Historical Volatility",
    "Keltner Channels",
    "Relative Volatility",
  ],
  "Médias móveis": [
    "EMA",
    "SMA",
    "Arnaud Legoux Moving Average (ALMA)",
    "Envelopes",
    "Kaufman's Adaptive Moving Average (KAMA)",
    "Least Squares Moving Average (LSMA)",
    "Moving Average Deviation",
    "Rainbow Moving Averages",
  ],
  Volume: ["Accumulation/Distribution", "Net Volume", "Volume Oscillator", "Weis Wave Volume"],
};

export function IndicatorMenu({
  emaVisible,
  onToggleEma,
  onOpenEmaSettings,
  onClose,
}: IndicatorMenuProps) {
  const [selectedCategory, setSelectedCategory] = useState("Scripts");
  const items =
    selectedCategory === "Adicionados" && emaVisible
      ? ["Suporte e resistência", "EMA"]
      : (itemsByCategory[selectedCategory] ?? []);
  const [hoveredDescription, setHoveredDescription] = useState(categoryDescriptions["Scripts"]);
  return (
    <div className="absolute bottom-24 left-16 z-30 flex w-[620px] overflow-visible rounded border border-border bg-[#1d2334] shadow-2xl">
      <div className="w-[220px] shrink-0 border-r border-border p-2">
        <div className="mb-2 flex items-center justify-between px-3 py-2 text-sm text-muted-foreground">
          <span>Indicadores</span>
          <Button variant="ghost" size="icon" aria-label="Fechar indicadores" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => {
              setSelectedCategory(category);
              setHoveredDescription(categoryDescriptions[category] ?? "");
            }}
            onMouseEnter={() => setHoveredDescription(categoryDescriptions[category] ?? "")}
            className={`flex w-full items-center gap-3 rounded px-3 py-3 text-left text-sm ${selectedCategory === category ? "bg-panel-2 text-foreground" : "text-muted-foreground hover:bg-panel-2 hover:text-foreground"}`}
          >
            {selectedCategory === category ? (
              <LineChart className="h-5 w-5 text-primary" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>{category}</span>
            {category === "Scripts" && (
              <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                1
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1 p-2">
        <div className="px-3 py-3 text-lg font-medium">{selectedCategory}</div>
        {!items.length && (
          <div className="px-3 py-8 text-sm text-muted-foreground">
            Nenhum indicador nesta categoria.
          </div>
        )}
        {items.map((script) => {
          const active = script === "Suporte e resistência" || (script === "EMA" && emaVisible);
          const supported = script === "Suporte e resistência" || script === "EMA";
          return (
            <div
              key={script}
              onMouseEnter={() => setHoveredDescription(indicatorDescriptions[script] ?? "")}
              title={indicatorDescriptions[script]}
            >
              <button
                disabled={!supported}
                onClick={
                  script === "EMA" ? (emaVisible ? onToggleEma : onOpenEmaSettings) : undefined
                }
                className={`flex w-full items-center gap-3 border-t border-border px-3 py-3 text-left ${supported ? "hover:bg-panel-2" : "cursor-not-allowed opacity-45"}`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded ${active ? "bg-primary/20 text-primary" : "bg-panel-2 text-muted-foreground"}`}
                >
                  {active ? <Check className="h-4 w-4" /> : <LineChart className="h-4 w-4" />}
                </span>
                <span className="flex-1">{script}</span>
                {script === "Suporte e resistência" && (
                  <span className="text-xs text-primary">Ativo</span>
                )}
                {script === "EMA" && (
                  <span className="text-xs text-muted-foreground">
                    {emaVisible ? "Ativo" : "Adicionar"}
                  </span>
                )}
                {!supported && <span className="text-xs text-muted-foreground">Em breve</span>}
              </button>
            </div>
          );
        })}
      </div>
      {hoveredDescription && (
        <div className="absolute bottom-3 left-[640px] w-72 rounded bg-[#5b6272] p-4 text-sm leading-5 text-white shadow-xl">
          {hoveredDescription}
        </div>
      )}
    </div>
  );
}
