<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- AI agent calls go through `askAgent` server fn (src/lib/agent.functions.ts) using @lovable.dev/ai-gateway; agent config, threads and tasks persist in browser localStorage — user chose browser storage, no login.
- Opening the agent or switching browser-stored conversations must not require or clear a broker session; broker APIs remain responsible for authorizing trading.
- Scheduled agent tasks run client-side while the page is open — no backend scheduler exists.
- Demo orders and management settings persist in browser storage; settlement uses simulated prices while the page is open, with overdue orders settled on reopening, never live broker execution.
- Local agent requests use the browser's Ollama HTTP API so localhost targets the user's machine; no credentials are stored and browser local-network/CORS permissions apply.
- Management execution supports entry sizing, Martingale, Soros, recovery, stops and direction inversion; external filters and undefined strategies remain disabled until their integrations and formulas are supplied.

- Conversation strategy workspaces are isolated by thread ID and versioned independently; global management settings are copied only at creation to avoid silently modifying approved contracts.
- The strategy executor uses synthetic quotes and a separate demo bankroll, never broker trade endpoints; explicit start is required after reopening or switching conversations.
- Research proposals contain validated definition patches and require approval against their base version while execution is paused; model text never authorizes trading or changes an approved version.
