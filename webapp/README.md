# Recovery Orchestrator — Web Application

Enterprise frontend for the Procurement Material Recovery Orchestrator.
**Synthetic academic prototype**: every supplier, part number, quantity, cost,
and person shown is fictional mock data — no real Bosch, supplier, or ERP data.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS (dark-mode-first token system) ·
shadcn-style components on Radix primitives · React Router (hash routing) ·
Zustand (persisted UI state) · Recharts · Framer Motion (subtle transitions
only) · Lucide icons.

## Run it

```bash
cd webapp
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build to dist/
npm run lint       # oxlint
```

## Architecture

```
src/
  types/        domain model (cases, agents, suppliers, events, …)
  constants/    labels, orderings, the synthetic-data notice
  mocks/        seeded synthetic dataset + analytics series (deterministic)
  services/     CaseService / AgentService / SupplierService / … interfaces
                with mock implementations — swap these for SAP S/4HANA,
                supplier APIs, Teams/Outlook without touching UI code
  stores/       zustand: UI prefs (theme, sidebar, filters, pins — persisted),
                notifications, optimistic case mutations (approve/reject)
  hooks/        useAsync (mock fetching), useChartColors (validated palette),
                useKeyboardShortcuts (g+<key> chords)
  components/
    ui/         shadcn-style primitives (button, badge, card, dialog, …)
    layout/     AppShell, Sidebar, Topbar, CommandPalette, NotificationCenter
    domain/     SeverityBadge, StatusBadge, ConfidenceMeter, InvestigationSteps
    charts/     ChartCard + tooltip styling
  pages/        one file per route
public/
  live-flow.html  the original animated orchestration diagram, embedded
                  unchanged by the Live Recovery Flow page (theme-sync shim only)
```

## Product decisions (deviations from the brief, made deliberately)

- **Case Detail is not a top-level nav item.** It is contextual — reached from
  Cases, the dashboard, notifications, or the command palette — like a Jira
  issue. A nav item pointing at "no case selected" would be a dead end.
- **"Recommendations" is the permanent right-side panel** on Case Detail, not a
  tab: it is where the approve/reject decision happens and must stay visible
  while the user reads evidence in any tab. "Agent Activity" is folded into the
  Investigation tab — same records, one home.
- **The animated diagram is embedded, not ported.** It is a finished,
  self-contained artifact (Start/Stop player, interactive human checkpoint);
  rewriting it in React would have replaced it, which the brief forbade.
- **Chart palette is CVD-validated.** The categorical order (blue → green →
  purple → amber) passes colorblind-separation, lightness-band, and contrast
  checks in both themes; red is reserved for status/negative and is never a
  series color.

## Keyboard

- `Ctrl/⌘ K` — command palette (pages + case search)
- `G` then `D / C / T / I / A / N` — go to Dashboard / Cases / Timeline /
  Investigation / Agents / Analytics
