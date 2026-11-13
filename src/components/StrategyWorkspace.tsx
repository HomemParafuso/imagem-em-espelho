import { useState } from "react";
import { Play, Pause, Square, Check, RotateCcw, FlaskConical, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptProposal, approveDefinition, startDemo, backtest, type Workspace, type Definition } from "@/lib/strategy-workspace";

export function StrategyWorkspace({ view, workspace: w, onChange, onDiscuss }: { view: "strategy" | "execution" | "evolution"; workspace: Workspace; onChange: (fn: (w: Workspace) => Workspace) => void; onDiscuss: (prompt: string) => void }) {
  const [error, setError] = useState("");
  const [comparison, setComparison] = useState<{ current: ReturnType<typeof backtest>; candidate: ReturnType<typeof backtest> } | null>(null);
  const approved = w.versions.at(-1);
  const closed = w.session.orders.filter(o => o.status === "closed");
  const pnl = closed.reduce((s, o) => s + (o.result ?? 0), 0);
  const action = (fn: (w: Workspace) => Workspace) => {
    try { onChange(fn); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir."); }
  };
  const edit = (patch: Partial<Definition>) => action(value => ({ ...value, draft: { ...value.draft, ...patch } }));
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm" aria-label={`Área ${view}`}>
    {error && <p role="alert" className="mb-3 border-l-2 border-down pl-3 text-down">{error}</p>}
    {view === "strategy" && <>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-medium">Contrato da estratégia</h2><ShieldCheck className="h-5 w-5 text-gold" /></div>
      <div className="space-y-3">
        <label className="block">Nome da estratégia<input className="input mt-1" aria-label="Nome da estratégia" value={w.draft.name} onChange={e => edit({ name: e.target.value })} /></label>
        <label className="block">Regra de entrada<select className="input mt-1" aria-label="Regra de entrada" value={w.draft.signal} onChange={e => edit({ signal: e.target.value === "ma-cross" ? "ma-cross" : "momentum" })}><option value="momentum">Momentum · direção das velas</option><option value="ma-cross">Cruzamento do preço com EMA</option></select></label>
        <div className="grid grid-cols-2 gap-3">{([["period", "Período (velas)", 2, 100], ["duration", "Duração (s)", 5, 3600], ["entry", "Entrada ($)", 0.01, 1000], ["stopWin", "Stop WIN ($)", 0.01, 100000], ["stopLoss", "Stop LOSS ($)", 0.01, 100000]] as const).map(([key, label, min, max]) => <label key={key}>{label}<input className="input mt-1" aria-label={label} type="number" min={min} max={max} step={key === "entry" ? 0.01 : 1} value={w.draft[key]} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) edit({ [key]: n }); }} /></label>)}</div>
        <label className="block">Conta<select className="input mt-1" aria-label="Conta da estratégia" value={w.draft.mode} onChange={e => edit({ mode: e.target.value === "real" ? "real" : "demo" })}><option value="demo">Demo · simulação isolada</option><option value="real">Real · execução bloqueada</option></select></label>
        <p className="text-xs text-muted-foreground">Saída no vencimento · payout simulado 86% · uma ordem por vez.</p>
        <Button className="w-full gap-2" disabled={w.session.status === "running"} onClick={() => action(value => approveDefinition(value))}><Check className="h-4 w-4" />Aprovar versão { (approved?.version ?? 0) + 1 }</Button>
        <p className="text-xs text-muted-foreground">{approved ? `Versão aprovada: v${approved.version}` : "Rascunho · ainda não aprovado"}</p>
      </div>
    </>}
    {view === "execution" && <>
      <div className="mb-4 flex justify-between"><h2 className="text-lg font-medium">Executor</h2><span className="text-gold">DEMO · SIMULADA</span></div>
      <p className="mb-3 text-muted-foreground">{w.session.status === "running" ? "Em execução" : w.session.status === "paused" ? "Pausado" : "Parado"} · {approved ? `v${approved.version} · ${approved.definition.name}` : "Sem versão aprovada"}</p>
      <div className="mb-5 grid grid-cols-3 gap-2 border-y border-border py-4"><Metric label="Saldo demo" value={`$${w.session.balance.toFixed(2)}`} /><Metric label="Resultado" value={`$${pnl.toFixed(2)}`} /><Metric label="Ordens" value={String(closed.length)} /></div>
      <div className="mb-4 flex gap-2"><Button className="flex-1 gap-1" disabled={w.session.status === "running"} onClick={() => action(startDemo)}><Play className="h-4 w-4" />Iniciar demo</Button><Button variant="outline" size="icon" title="Pausar" aria-label="Pausar execução" onClick={() => action(v => ({ ...v, session: { ...v.session, status: "paused" } }))}><Pause className="h-4 w-4" /></Button><Button variant="outline" size="icon" title="Parar" aria-label="Parar execução" onClick={() => action(v => ({ ...v, session: { ...v.session, status: "stopped" } }))}><Square className="h-4 w-4" /></Button></div>
      <p className="mb-4 text-xs text-muted-foreground">Cotações sintéticas, sem ordens na corretora. Trocar de conversa ou fechar o agente pausa entradas; ordens abertas vencem normalmente.</p>
      <h3 className="mb-2 font-medium">Ordens da conversa</h3>
      {!w.session.orders.length && <p className="py-3 text-muted-foreground">Nenhuma ordem.</p>}
      {w.session.orders.slice().reverse().slice(0, 30).map(o => <div key={o.id} className="flex items-center justify-between border-b border-border py-3"><div><span className={o.dir === "up" ? "text-up" : "text-down"}>{o.dir === "up" ? "CALL" : "PUT"}</span> · ${o.amt.toFixed(2)}<p className="text-xs text-muted-foreground">v{o.strategyVersion} · {new Date(o.openedAt).toLocaleTimeString("pt-BR")}</p></div><span>{o.status === "open" ? `${Math.max(0, Math.ceil((o.expiresAt - Date.now()) / 1000))}s` : `$${o.result?.toFixed(2)}`}</span></div>)}
      <h3 className="mb-2 mt-5 font-medium">Decisões e motivos</h3>{w.session.decisions.slice(-10).reverse().map((d, i) => <div key={i} className="border-b border-border py-2"><span className="text-gold">{d.signal} · v{d.version}</span><p className="text-xs text-muted-foreground">{d.reason}</p></div>)}
    </>}
    {view === "evolution" && <>
      <div className="mb-3 flex justify-between"><h2 className="text-lg font-medium">Pesquisador</h2><TrendingUp className="h-5 w-5 text-up" /></div>
      <p className="mb-4 text-xs text-muted-foreground">Propostas não alteram a execução. Sem retreinamento ou pesquisa em segundo plano.</p>
      <Button variant="outline" className="mb-3 w-full whitespace-normal" onClick={() => onDiscuss("Analise os resultados desta conversa e proponha uma melhoria verificável na estratégia. Explique evidências, limitações e riscos; não aplique mudanças.")}>Analisar resultados com o agente</Button>
      <Button variant="outline" className="mb-3 w-full gap-2" onClick={() => { const time = Date.now(); setComparison({ current: backtest(approved?.definition ?? w.draft, time), candidate: backtest(w.draft, time) }); }}><FlaskConical className="h-4 w-4" />Comparar rascunho e versão</Button>
      {comparison && <div className="mb-4 border-y border-border py-3"><p className="text-xs text-gold">100 janelas sintéticas · não valida lucro real</p><p>Aprovada: ${comparison.current.pnl} · {comparison.current.wins}/{comparison.current.trades} vitórias</p><p>Rascunho: ${comparison.candidate.pnl} · {comparison.candidate.wins}/{comparison.candidate.trades} vitórias</p></div>}
      <h3 className="mb-2 font-medium">Propostas</h3>{!w.proposals.length && <p className="mb-4 text-muted-foreground">Nenhuma proposta registrada.</p>}
      {w.proposals.slice().reverse().map(p => <article key={p.id} className="mb-3 rounded border border-border p-3"><h4 className="font-medium">{p.summary}</h4><p className="my-2 text-xs text-muted-foreground">{p.rationale}</p><dl className="text-xs">{Object.entries(p.patch).map(([key, value]) => <div key={key} className="flex justify-between gap-2"><dt>{({ name: "Nome", signal: "Regra", period: "Período", duration: "Duração", entry: "Entrada", stopWin: "Stop WIN", stopLoss: "Stop LOSS", mode: "Conta" } as Record<string, string>)[key]}</dt><dd>{String(value)}</dd></div>)}</dl><p className="my-2 text-xs text-gold">Base v{p.baseVersion} · {p.status === "pending" ? "Pendente" : p.status === "accepted" ? "Aceita" : "Rejeitada"}</p>{p.status === "pending" && <div className="flex gap-2"><Button size="sm" disabled={w.session.status === "running"} onClick={() => action(v => acceptProposal(v, p.id))}>Aprovar mudança</Button><Button variant="ghost" size="sm" onClick={() => action(v => ({ ...v, proposals: v.proposals.map(x => x.id === p.id ? { ...x, status: "rejected" } : x) }))}>Rejeitar</Button></div>}</article>)}
      <h3 className="mb-2 mt-4 font-medium">Versões aprovadas</h3>{w.versions.slice().reverse().map(v => <div key={v.version} className="flex justify-between gap-2 border-b border-border py-3"><div>v{v.version} · {v.definition.name}<p className="text-xs text-muted-foreground">{v.reason}</p></div><Button variant="ghost" size="icon" title={`Restaurar v${v.version} no rascunho`} aria-label={`Restaurar versão ${v.version}`} onClick={() => edit({ ...v.definition })}><RotateCcw className="h-4 w-4" /></Button></div>)}
    </>}
  </div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[10px] text-muted-foreground">{label}</p><p className="break-words font-medium">{value}</p></div>; }