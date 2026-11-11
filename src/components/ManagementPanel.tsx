import { useState, type ReactNode } from "react";
import { ExternalLink, Info, Save, Settings, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Rules } from "@/lib/trading";

type Detail = "cycles" | "masaniello" | "virtualLoss";

export function ManagementPanel({
  rules: r,
  onChange,
  onClose,
}: {
  rules: Rules;
  onChange: (r: Rules) => void;
  onClose: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const set = <K extends keyof Rules>(key: K, value: Rules[K]) => onChange({ ...r, [key]: value });
  const number = (key: keyof Rules, label: string, min = 0, step = 1) => (
    <Field label={label} required>
      <input
        aria-label={label}
        className="management-input"
        type="number"
        min={min}
        step={step}
        value={Number(r[key])}
        onChange={(e) => {
          const value = Number(e.target.value);
          if (Number.isFinite(value) && value >= min) set(key, value);
        }}
      />
    </Field>
  );
  const select = (key: keyof Rules, label: string, options: string[]) => (
    <Field label={label} required>
      <select
        aria-label={label}
        className="management-input"
        value={String(r[key])}
        onChange={(e) => set(key, e.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
  const toggle = (key: keyof Rules, label: string, unavailable = false) => (
    <label
      className={`management-toggle ${unavailable ? "is-disabled" : ""}`}
      title={
        unavailable ? "Disponível após integração com a corretora e fontes de sinais" : undefined
      }
    >
      <input
        type="checkbox"
        disabled={unavailable}
        checked={Boolean(r[key])}
        onChange={(e) => set(key, e.target.checked)}
      />
      <span className="management-check" aria-hidden="true" />
      {label}
      <Info className="management-info" />
    </label>
  );
  const card = (title: string, children: ReactNode, className = "") => (
    <section className={`management-card ${className}`}>
      <h3>{title}</h3>
      <div className="management-card-body">{children}</div>
    </section>
  );
  const detailTitle =
    detail === "cycles" ? "Ciclos" : detail === "masaniello" ? "Masaniello" : "Loss virtual";

  return (
    <div
      className="management-shell absolute inset-0 z-40 overflow-y-auto"
      role="dialog"
      aria-label="Gerenciamento"
    >
      <header className="management-header">
        <div>
          <span className="management-kicker">TRADEX · CONTA DEMONSTRATIVA</span>
          <h2>Gerenciamento</h2>
          <p>Configure a proteção das entradas e salve as preferências neste navegador.</p>
        </div>
        <div className="management-header-actions">
          <span className="management-save-state">● Salvo localmente</span>
          <Button variant="ghost" size="icon" aria-label="Fechar gerenciamento" onClick={onClose}>
            <X />
          </Button>
        </div>
      </header>
      <main className="management-content">
        <div className="management-grid">
          {card(
            "Geral",
            <div className="management-fields">
              {select("broker", "Corretora", ["TradeX"])}
              {select("account", "Tipo de conta", ["Demo"])}
              {select("entryMode", "Tipo de entrada", ["Valor", "Porcentagem"])}
              {number("entry", "Valor de entrada", 0.01, 0.01)}
              {select("payoutType", "Opção payout", ["Digital"])}
              {number("minPayout", "Payout mínimo (%)", 0)}
              {select("delay", "Modo delay", ["Automático"])}
            </div>,
          )}
          {card(
            "Gerenciamento",
            <div className="management-columns">
              <div>
                {toggle("martingale", "Martingale")}
                <div className="management-fields management-fields-2">
                  {number("multiplier", "Multiplicador", 1, 0.1)}
                  {number("mgLevels", "Níveis", 1)}
                </div>
                {toggle("sorosgale", "Sorosgale", true)}
                {number("sgLevels", "Níveis Sorosgale", 1)}
                {toggle("recovery", "Recuperação de loss")}
                <div className="management-fields management-fields-2">
                  {number("recoveryPercent", "Porcentagem", 0)}
                  {toggle("invert", "Inverter direção")}
                </div>
              </div>
              <div className="management-column-divider">
                {toggle("soros", "Soros")}
                <div className="management-fields management-fields-2">
                  {number("sorosPercent", "Porcentagem", 0)}
                  {number("sorosLevels", "Níveis", 1)}
                </div>
                {(
                  [
                    ["cycles", "Ciclos"],
                    ["masaniello", "Masaniello"],
                    ["virtualLoss", "Loss virtual"],
                  ] as const
                ).map(([key, label]) => (
                  <div className="management-option" key={key}>
                    {toggle(key, label, true)}
                    <Button
                      variant="ghost"
                      size="icon"
                      title={`Configurar ${label}`}
                      onClick={() => setDetail(key)}
                    >
                      <Settings />
                    </Button>
                  </div>
                ))}
                {toggle("noDelay", "Martingale sem delay", true)}
                {toggle("simultaneous", "Sinais simultâneos")}
              </div>
            </div>,
          )}
          {card(
            "Stop WIN e LOSS",
            <div className="management-stop-grid">
              <div>
                {select("stopMode", "Modo", ["Valor", "Porcentagem"])}
                {toggle("trailing", "Stop Móvel")}
                {toggle("preStop", "Pré Stop LOSS")}
              </div>
              <div>
                {number("stopWin", "Stop WIN", 0.01)}
                {number("stopLoss", "Stop LOSS", 0.01)}
              </div>
            </div>,
          )}
          {card(
            "Filtros de proteção",
            <div className="management-columns">
              <div>
                {toggle("trend", "Análise Tendência", true)}
                {toggle("investing", "Análise Investing", true)}
                {toggle("news", "Notícias", true)}
                {toggle("aiFilter", "IA Filtro", true)}
              </div>
              <div className="management-column-divider">
                {toggle("timerZone", "Trader Timer Zone", true)}
                {toggle("candleHit", "Hit de vela", true)}
                <Button
                  variant="outline"
                  className="management-advanced-button"
                  onClick={() => setAdvanced(true)}
                >
                  <ExternalLink />
                  Modo avançado
                </Button>
              </div>
            </div>,
          )}
        </div>
        <section className="management-guard">
          <div className="management-guard-icon">
            <ShieldCheck />
          </div>
          <div>
            <div className="management-guard-title">
              Guardião de sessão <span>PRO</span>
              <Info />
            </div>
            <p>Proteção automática para sua sessão</p>
            <small>
              Ao detectar uma sequência de risco, o Guardião pausa as entradas reais e acompanha
              sinais no modo virtual.
            </small>
          </div>
          <Button variant="outline" className="management-pro-button">
            Desbloquear no PRO <ExternalLink />
          </Button>
        </section>
        <Button className="management-save-button" onClick={onClose}>
          <Save />
          Salvar
        </Button>
      </main>
      {(advanced || detail) && (
        <div className="management-modal-backdrop">
          <div
            className="management-modal"
            role="dialog"
            aria-label={advanced ? "Filtros modo avançado" : "Parâmetros de gerenciamento"}
          >
            <header>
              <div>
                <span className="management-kicker">CONFIGURAÇÃO AVANÇADA</span>
                <h3>{advanced ? "Modo avançado" : detailTitle}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fechar parâmetros"
                onClick={() => {
                  setAdvanced(false);
                  setDetail(null);
                }}
              >
                <X />
              </Button>
            </header>
            {advanced ? (
              <div className="management-modal-grid">
                <div>
                  {number("period", "Período", 1)}
                  {select("average", "Média", ["EMA", "SMA"])}
                  {select("investingMode", "Modo Investing", ["Normal", "Forte", "Neutro"])}
                  {select("confidence", "Confiança mínima", ["Baixa", "Média", "Alta"])}
                </div>
                <div>
                  {number("newsBefore", "Minutos antes", 0)}
                  {number("newsAfter", "Minutos depois", 0)}
                  {select("impact", "Impacto", ["1", "2", "3"])}
                </div>
              </div>
            ) : (
              <div className="management-modal-fields">
                {detail === "cycles" ? (
                  <>
                    {number("cycleCount", "Quantidade de ciclos", 1)}
                    {number("cycleTarget", "Meta por ciclo", 1)}
                  </>
                ) : detail === "masaniello" ? (
                  <>
                    {number("masanielloTrades", "Total de operações", 1)}
                    {number("masanielloWins", "Vitórias previstas", 1)}
                  </>
                ) : (
                  number("virtualLossCount", "Perdas virtuais antes da entrada", 1)
                )}
                <p>Parâmetros salvos. A execução permanece indisponível na conta demonstrativa.</p>
              </div>
            )}
            <Button
              className="management-save-button"
              onClick={() => {
                setAdvanced(false);
                setDetail(null);
              }}
            >
              Concluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="management-field">
      <span>
        {label}
        {required && <b>*</b>}
      </span>
      {children}
    </label>
  );
}
