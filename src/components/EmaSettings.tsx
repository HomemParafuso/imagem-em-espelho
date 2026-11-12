import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MovingAverageConfig, MovingAverageType } from "@/lib/indicators";

type EmaSettingsProps = {
  initial: MovingAverageConfig;
  onApply: (config: MovingAverageConfig) => void;
  onCancel: () => void;
};

const types: MovingAverageType[] = ["SMA", "WMA", "EMA", "SSMA"];
const fieldClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-slate-100 outline-none transition focus:border-slate-500";

export function EmaSettings({ initial, onApply, onCancel }: EmaSettingsProps) {
  const [config, setConfig] = useState(initial);
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-[1px]">
      <div className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-[#151b29]/95 p-6 shadow-2xl ring-1 ring-black/20">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              Média móvel
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Defina como a linha será calculada e exibida.
            </p>
          </div>
          <button
            aria-label="Fechar configuração da média móvel"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-4 block text-sm font-medium text-slate-300">
          Período
          <input
            type="number"
            min={1}
            step={1}
            value={config.period}
            onChange={(event) =>
              setConfig((current) => ({ ...current, period: Number(event.target.value) || 1 }))
            }
            className={fieldClassName}
          />
        </label>
        <label className="mb-4 block text-sm font-medium text-slate-300">
          Tipo
          <select
            value={config.type}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                type: event.target.value as MovingAverageType,
              }))
            }
            className={fieldClassName}
          >
            {types.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="mb-4 block text-sm font-medium text-slate-300">
          Cor
          <input
            type="color"
            value={config.color}
            onChange={(event) =>
              setConfig((current) => ({ ...current, color: event.target.value }))
            }
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/45 p-1"
          />
        </label>
        <label className="block text-sm font-medium text-slate-300">
          Espessura
          <select
            value={config.thickness}
            onChange={(event) =>
              setConfig((current) => ({ ...current, thickness: Number(event.target.value) }))
            }
            className={fieldClassName}
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-7 flex justify-end gap-3 border-t border-white/10 pt-5">
          <Button
            variant="ghost"
            className="text-slate-300 hover:bg-white/5 hover:text-white"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-xl bg-slate-100 px-5 text-slate-950 hover:bg-white"
            onClick={() => onApply({ ...config, period: Math.max(1, Math.floor(config.period)) })}
          >
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}
