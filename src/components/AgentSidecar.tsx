import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  Plus,
  Settings,
  CalendarClock,
  Trash2,
  Send,
  X,
  Play,
  Loader2,
  PanelLeftClose,
} from "lucide-react";
import { askAgent, AGENT_MODELS } from "@/lib/agent.functions";
import { askLocalAgent } from "@/lib/local-agent";
import { extractWorkspaceProposal, workspaceKey } from "@/lib/strategy-workspace";
import { useStrategyWorkspace } from "@/hooks/use-strategy-workspace";
import { StrategyWorkspace } from "@/components/StrategyWorkspace";
import type { Rules } from "@/lib/trading";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "assistant"; content: string };
type Thread = { id: string; title: string; updatedAt: number; messages: Msg[] };
type Config = {
  name: string;
  instructions: string;
  model: (typeof AGENT_MODELS)[number];
  temperature: number;
  useChart: boolean;
  provider: "gateway" | "local";
  localUrl: string;
  localModel: string;
};
type Task = {
  id: string;
  name: string;
  prompt: string;
  everyMin: number;
  enabled: boolean;
  lastRun: number;
  threadId?: string;
};
type Store = {
  config: Config;
  threads: Thread[];
  tasks: Task[];
};

const KEY = "tradex-agent-v1";
const MODEL_LABEL: Record<Config["model"], string> = {
  "openai/gpt-6-astra": "GPT-6 Astra (padrão)",
  "openai/gpt-6.1-terra": "GPT-6.1 Terra",
  "openai/gpt-5.5": "GPT-5.5",
  "openai/gpt-5.4-mini": "GPT-5.4 Mini (rápido)",
};
const newThread = (title = "Nova conversa"): Thread => ({
  id: crypto.randomUUID().slice(0, 8),
  title,
  updatedAt: Date.now(),
  messages: [],
});
const defaults = (): Store => ({
  config: {
    name: "Analista",
    instructions:
      "Você é um analista de mercado. Responda em português, de forma curta e objetiva.",
    model: "openai/gpt-6-astra",
    temperature: 0.7,
    useChart: true,
    provider: "gateway",
    localUrl: "http://localhost:11434",
    localModel: "llama3.2",
  },
  threads: [newThread()],
  tasks: [],
});

export function AgentSidecar({
  threadId,
  onSelectThread,
  getMarket,
  onClose,
  duration,
  onDuration,
  openConfigRequest,
  rules,
}: {
  threadId: string | undefined;
  onSelectThread: (id: string) => void;
  getMarket: () => string;
  onClose: () => void;
  duration: number;
  onDuration: (n: number) => void;
  openConfigRequest?: number;
  rules?: Rules;
}) {
  const [store, setStore] = useState<Store | null>(null);
  const [view, setView] = useState<"chat" | "config" | "tasks" | "strategy" | "execution" | "evolution">("chat");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const storeRef = useRef<Store | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let s: Store;
    try {
      s = JSON.parse(localStorage.getItem(KEY) || "null") ?? defaults();
    } catch {
      s = defaults();
    }
    if (!s.threads.length) s.threads = [newThread()];
    s.config = {
      ...s.config,
      provider: s.config.provider ?? "gateway",
      localUrl: s.config.localUrl ?? "http://localhost:11434",
      localModel: s.config.localModel ?? "llama3.2",
    };
    localStorage.setItem(KEY, JSON.stringify(s));
    storeRef.current = s;
    setStore(s);
  }, []);

  const update = useCallback((fn: (s: Store) => Store) => {
    setStore((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      storeRef.current = next;
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const active = store?.threads.find((t) => t.id === threadId) ?? store?.threads[0];
  const { workspace, update: updateWorkspace, get: getWorkspace, updateFor: updateWorkspaceFor } = useStrategyWorkspace(active?.id, rules, duration);
  useEffect(() => {
    if (store && active && active.id !== threadId) onSelectThread(active.id);
  }, [store, active, threadId, onSelectThread]);
  useEffect(() => {
    if (openConfigRequest) setView("config");
  }, [openConfigRequest]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    taRef.current?.focus();
  }, [active?.messages.length, busy, view]);

  const run = useCallback(
    async (tid: string, text: string) => {
      const s = storeRef.current;
      if (!s) return;
      const thread = s.threads.find((t) => t.id === tid);
      if (!thread) return;
      const messages = [...thread.messages, { role: "user" as const, content: text }];
      update((st) => ({
        ...st,
        threads: st.threads.map((t) =>
          t.id === tid
            ? {
                ...t,
                messages,
                updatedAt: Date.now(),
                title: t.messages.length ? t.title : text.slice(0, 40),
              }
            : t,
        ),
      }));
      setBusy(tid);
      try {
        const c = s.config;
        const contract = getWorkspace(tid);
        const instructions = `Seu nome é ${c.name}. ${c.instructions}
Você é o pesquisador de estratégias. Ordens nesta conversa são exclusivamente simulações sintéticas, nunca operações na corretora. Não afirme ter iniciado, pausado ou aprovado operações: esses comandos exigem confirmação nos controles. Não há aprendizado ou retreinamento em segundo plano. Contrato e resultados desta conversa:
${JSON.stringify({ draft: contract.draft, approved: contract.versions.at(-1), session: { status: contract.session.status, balance: contract.session.balance, orders: contract.session.orders.slice(-20), decisions: contract.session.decisions.slice(-10) } })}
Regras executáveis: momentum (direção das últimas N velas) ou ma-cross (cruzamento do preço com EMA). Saída por duração de 5 a 3600 segundos, payout simulado 86%, uma ordem por vez, stops absolutos. Outros sinais não estão implementados. Para propor ajustes acrescente <strategy-proposal>{"summary":"...","rationale":"...","patch":{"signal":"momentum","period":5,"duration":60,"entry":12,"stopWin":100,"stopLoss":100}}</strategy-proposal>. Inclua somente os campos alterados no patch. Valores válidos: period inteiro 2-100; entry 0.01-1000; stops 0.01-100000; mode demo ou real (execução real bloqueada). Nunca aplique uma proposta sem aprovação. Se a estratégia discutida exigir outra fórmula, explique a limitação em vez de inventar execução.`;

        const res =
          c.provider === "local"
            ? await askLocalAgent({
                url: c.localUrl,
                model: c.localModel,
                instructions,
                temperature: c.temperature,
                marketContext: c.useChart ? getMarket() : undefined,
                messages,
              })
            : await askAgent({
                data: {
                  model: c.model,
                  instructions,
                  temperature: c.temperature,
                  marketContext: c.useChart ? getMarket() : undefined,
                  messages,
                },
              });
        const content = res.ok ? res.text : `⚠️ ${res.text}`;
        const proposal = res.ok ? extractWorkspaceProposal(content, contract) : null;
        update((st) => ({
          ...st,
          threads: st.threads.map((t) =>
            t.id === tid
              ? {
                  ...t,
                  messages: [...t.messages, { role: "assistant", content }],
                  updatedAt: Date.now(),
                }
              : t,
          ),
        }));
        if (proposal) updateWorkspaceFor(tid, w => ({ ...w, proposals: [...w.proposals, proposal] }));
      } catch {
        update((st) => ({
          ...st,
          threads: st.threads.map((t) =>
            t.id === tid
              ? {
                  ...t,
                  messages: [
                    ...t.messages,
                    {
                      role: "assistant",
                      content:
                        s.config.provider === "local"
                          ? "⚠️ Não foi possível acessar o Ollama. Verifique endereço, modelo instalado, OLLAMA_ORIGINS e a permissão de conexões locais no navegador."
                          : "⚠️ Não foi possível falar com o agente.",
                    },
                  ],
                }
              : t,
          ),
        }));
      } finally {
        setBusy(null);
      }
    },
    [getMarket, update, getWorkspace, updateWorkspaceFor],
  );

  // scheduler (runs while this page is open)
  useEffect(() => {
    const id = setInterval(() => {
      const s = storeRef.current;
      if (!s || busy) return;
      const due = s.tasks.find((t) => t.enabled && Date.now() - t.lastRun >= t.everyMin * 60000);
      if (!due) return;
      let tid =
        due.threadId && s.threads.some((t) => t.id === due.threadId) ? due.threadId : undefined;
      if (!tid) {
        const th = newThread(`⏱ ${due.name}`);
        tid = th.id;
        const next = { ...s, threads: [th, ...s.threads] };
        storeRef.current = next;
        setStore(next);
      }
      update((st) => ({
        ...st,
        tasks: st.tasks.map((t) =>
          t.id === due.id ? { ...t, lastRun: Date.now(), threadId: tid } : t,
        ),
      }));
      void run(tid, due.prompt);
    }, 5000);
    return () => clearInterval(id);
  }, [busy, run, update]);

  if (!store || !active) return <aside className="w-[340px] border-r border-border bg-panel" />;

  const send = () => {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    void run(active.id, t);
  };
  const createThread = () => {
    const th = newThread();
    update((s) => ({ ...s, threads: [th, ...s.threads] }));
    onSelectThread(th.id);
    setView("chat");
  };
  const removeThread = (id: string) => {
    localStorage.removeItem(workspaceKey(id));
    update((s) => {
      const rest = s.threads.filter((t) => t.id !== id);
      return { ...s, threads: rest.length ? rest : [newThread()] };
    });
  };
  const cfg = store.config;
  const setCfg = (p: Partial<Config>) => update((s) => ({ ...s, config: { ...s.config, ...p } }));

  return (
    <aside aria-label="Agente de estratégias" className="strategy-sidecar flex min-h-0 w-[380px] shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-up/20 text-up">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 truncate font-medium">
          {cfg.name}
          <div className="text-[10px] font-normal text-muted-foreground">
            Estratégia v{workspace?.versions.at(-1)?.version ?? 0} · {workspace?.draft.mode === "real" ? "REAL BLOQUEADA" : "DEMO"}
          </div>
        </div>
        <IconBtn
          title="Tarefas"
          active={view === "tasks"}
          onClick={() => setView(view === "tasks" ? "chat" : "tasks")}
        >
          <CalendarClock className="h-4 w-4" />
          <span className="text-xs">Tarefas</span>
        </IconBtn>
        <IconBtn
          title="Configurar"
          active={view === "config"}
          onClick={() => setView(view === "config" ? "chat" : "config")}
        >
          <Settings className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="Fechar" onClick={onClose}>
          <PanelLeftClose className="h-4 w-4" />
        </IconBtn>
      </div>

      <nav className="grid shrink-0 grid-cols-4 border-b border-border" aria-label="Áreas do agente">
        {([["chat", "Chat"], ["strategy", "Estratégia"], ["execution", "Execução"], ["evolution", "Evolução"]] as const).map(([key, label]) => <Button key={key} variant="ghost" onClick={() => setView(key)} aria-pressed={view === key} className={`rounded-none px-1 text-xs ${view === key ? "border-b-2 border-up text-up" : "text-muted-foreground"}`}>{label}</Button>)}
      </nav>
      {workspace && (view === "strategy" || view === "execution" || view === "evolution") && <StrategyWorkspace key={`${active.id}:${view}`} view={view} workspace={workspace} onChange={updateWorkspace} onDiscuss={prompt => { setInput(prompt); setView("chat"); }} />}

      {view === "config" && (
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <Field label="Nome">
            <input
              className="input"
              value={cfg.name}
              onChange={(e) => setCfg({ name: e.target.value })}
            />
          </Field>
          <Field label="Instruções">
            <textarea
              rows={6}
              className="input"
              value={cfg.instructions}
              onChange={(e) => setCfg({ instructions: e.target.value })}
            />
          </Field>
          <Field label="Provedor">
            <select
              aria-label="Provedor"
              className="input"
              value={cfg.provider}
              onChange={(e) =>
                setCfg({ provider: e.target.value === "local" ? "local" : "gateway" })
              }
            >
              <option value="gateway">Lovable AI</option>
              <option value="local">Local — Ollama</option>
            </select>
          </Field>
          {cfg.provider === "local" && (
            <>
              <Field label="Endereço do Ollama">
                <input
                  className="input"
                  aria-label="Endereço do Ollama"
                  value={cfg.localUrl}
                  onChange={(e) => setCfg({ localUrl: e.target.value })}
                />
              </Field>
              <Field label="Modelo local">
                <input
                  className="input"
                  aria-label="Modelo local"
                  value={cfg.localModel}
                  onChange={(e) => setCfg({ localModel: e.target.value })}
                />
              </Field>
            </>
          )}
          <Field label="Duração das ordens (segundos)">
            <input
              className="input"
              type="number"
              aria-label="Duração das ordens (segundos)"
              min={5}
              max={3600}
              value={duration}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 5 && n <= 3600) onDuration(n);
              }}
            />
          </Field>
          <Field label="Modelo de IA (Lovable AI)">
            <select
              className="input"
              value={cfg.model}
              onChange={(e) => setCfg({ model: e.target.value as Config["model"] })}
            >
              {AGENT_MODELS.map((m) => (
                <option key={m} value={m}>
                  {MODEL_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Criatividade: ${cfg.temperature.toFixed(1)}`}>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={cfg.temperature}
              onChange={(e) => setCfg({ temperature: +e.target.value })}
              className="w-full accent-up"
            />
            {cfg.provider === "gateway" && cfg.model !== "openai/gpt-5.4-mini" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Só tem efeito no modelo GPT-5.4 Mini.
              </p>
            )}
          </Field>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={cfg.useChart}
              onChange={(e) => setCfg({ useChart: e.target.checked })}
              className="accent-up"
            />
            Enviar dados do gráfico ao agente
          </label>
          <Button
            variant="ghost"
            onClick={() => setView("chat")}
            className="w-full rounded bg-up py-2 font-medium"
          >
            Pronto
          </Button>
        </div>
      )}

      {view === "tasks" && (
        <TasksView
          tasks={store.tasks}
          busy={!!busy}
          onChange={(tasks) => update((s) => ({ ...s, tasks }))}
          onRunNow={(t) =>
            update((s) => ({
              ...s,
              tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, lastRun: 0, enabled: true } : x)),
            }))
          }
        />
      )}

      {view === "chat" && (
        <>
          <div className="max-h-40 shrink-0 overflow-y-auto border-b border-border p-2">
            <Button
              variant="ghost"
              onClick={createThread}
              className="mb-1 flex w-full items-center gap-2 rounded border border-dashed border-border px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Nova conversa
            </Button>
            {store.threads
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-center rounded text-sm ${t.id === active.id ? "bg-panel-2" : "hover:bg-panel-2/60"}`}
                >
                  <Button
                    variant="ghost"
                    onClick={() => onSelectThread(t.id)}
                    className="flex-1 truncate px-2 py-1.5 text-left"
                  >
                    {t.title}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => removeThread(t.id)}
                    className="px-2 text-muted-foreground opacity-0 hover:text-down group-hover:opacity-100"
                    aria-label="Apagar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {!active.messages.length && (
              <p className="mt-8 text-center text-muted-foreground">
                {active.title} · conversa sem mensagens
              </p>
            )}
            {active.messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-8 rounded-lg bg-up/25 px-3 py-2">
                  {m.content}
                </div>
              ) : (
                <div key={i} className="prose-chat">
                  <ReactMarkdown>{m.content.replace(/<strategy-proposal>[\s\S]*?<\/strategy-proposal>/gi, "")}</ReactMarkdown>
                </div>
              ),
            )}
            {busy === active.id && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Pensando…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="flex items-end gap-2 border-t border-border p-2">
            <textarea
              ref={taRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Mensagem…"
              className="input flex-1 resize-none"
            />
            <Button
              variant="ghost"
              onClick={send}
              disabled={!!busy || !input.trim()}
              className="grid h-10 w-10 place-items-center rounded bg-up disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}

function TasksView({
  tasks,
  busy,
  onChange,
  onRunNow,
}: {
  tasks: Task[];
  busy: boolean;
  onChange: (t: Task[]) => void;
  onRunNow: (t: Task) => void;
}) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [every, setEvery] = useState(15);
  const add = () => {
    if (!prompt.trim()) return;
    onChange([
      ...tasks,
      {
        id: crypto.randomUUID().slice(0, 8),
        name: name.trim() || "Tarefa",
        prompt: prompt.trim(),
        everyMin: Math.max(1, every),
        enabled: true,
        lastRun: Date.now(),
      },
    ]);
    setName("");
    setPrompt("");
  };
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
      <p className="text-xs text-muted-foreground">
        As tarefas rodam automaticamente enquanto esta página estiver aberta. Cada uma grava as
        respostas na sua própria conversa.
      </p>
      <div className="space-y-2 rounded border border-border p-3">
        <input
          className="input"
          placeholder="Nome (ex: Resumo do mercado)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="input"
          rows={3}
          placeholder="O que o agente deve fazer?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex items-center gap-2">
          A cada{" "}
          <input
            type="number"
            min={1}
            className="input w-20"
            value={every}
            onChange={(e) => setEvery(+e.target.value)}
          />{" "}
          min
          <Button
            variant="ghost"
            onClick={add}
            className="ml-auto rounded bg-up px-3 py-1.5 font-medium"
          >
            Agendar
          </Button>
        </div>
      </div>
      {tasks.map((t) => (
        <div key={t.id} className="rounded bg-panel-2 p-3">
          <div className="flex items-center gap-2">
            <span className="flex-1 font-medium">{t.name}</span>
            <Button
              variant="ghost"
              disabled={busy}
              title="Rodar agora"
              onClick={() => onRunNow(t)}
              className="text-up disabled:opacity-40"
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              title="Remover"
              onClick={() => onChange(tasks.filter((x) => x.id !== t.id))}
              className="text-muted-foreground hover:text-down"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 line-clamp-2 text-muted-foreground">{t.prompt}</p>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="accent-up"
              checked={t.enabled}
              onChange={(e) =>
                onChange(
                  tasks.map((x) => (x.id === t.id ? { ...x, enabled: e.target.checked } : x)),
                )
              }
            />
            Ativa · a cada {t.everyMin} min
          </label>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function IconBtn({
  children,
  title,
  onClick,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      title={title}
      onClick={onClick}
      className={`flex h-8 items-center gap-1 rounded px-2 ${active ? "bg-panel-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </Button>
  );
}
