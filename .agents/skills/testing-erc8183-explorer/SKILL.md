---
name: testing-erc8183-explorer
description: Test the ERC-8183 Agentic Commerce Explorer end-to-end. Use when verifying UI theme changes, tab navigation, simulator flow, or RPC connectivity.
---

# Testing ERC-8183 Explorer

## Overview
Static HTML/CSS/JS app — no build step, no backend. Deploys to devinapps.com or Vercel as a frontend.

## Deployment
- **devinapps**: `deploy frontend /path/to/erc8183-explorer` — instant static deploy
- **Vercel**: User has connected the repo at https://vercel.com. Pushes to branches auto-deploy with preview URLs in PR comments.
- **Local**: Open `index.html` directly in browser (file:// protocol works since there's no backend)

## What to Test

### Tab 1: Lifecycle Visualizer (default tab)
- SVG state machine with 6 state boxes: Open, Funded, Submitted, Completed, Rejected, Expired
- Each state has a distinct colored dot indicator
- Arrow markers connect states with function labels (fund(), submit(), complete(), reject(), timeout)
- 6 state detail cards below with actor badges (Client, Provider, Evaluator, System)
- Hover on state nodes should add highlight class

### Tab 2: Job Explorer
- Search box accepts numeric Job ID
- Queries Arc Testnet RPC at `https://rpc.testnet.arc.network` via `eth_call` with `getJob(uint256)` selector
- Contract: `0x0747EEf0706327138c69792bF28Cd525089e4583`
- If job exists: displays full job card with client/provider/evaluator addresses, budget, status badge, mini lifecycle tracker
- If job doesn't exist: shows structured error "Job #N not found" (this still proves RPC works)
- A network-level failure would show a different error — use this to distinguish RPC connectivity from missing data
- Recent Lookups section tracks searched jobs in current session

### Tab 3: Simulator
- 6 steps: Create Job, Set Budget, Approve USDC, Fund Escrow, Submit Deliverable, Complete Job
- Next/Previous buttons navigate steps
- Previous disabled on Step 1, Next changes to "Done" on Step 6
- Sidebar: active step has violet/accent background, completed steps have green background
- Progress bar fills incrementally
- Each step shows: title, description, actor badge, state transition, syntax-highlighted code block

### Tab 4: Dashboard
- "What is ERC-8183?" protocol overview card
- 4 protocol feature cards: Trustless Escrow, Three-Party Model, Agent-Native, Hook System
- 4 stat cards: ERC-8183, Arc Testnet, USDC, 6 (Job States)
- Contract Details: contract address, USDC address, RPC URL, Explorer link
- Core Functions: 6 functions with role badges (CLIENT, PROVIDER, EVALUATOR, ANYONE)

## Theme Verification
When testing theme changes, verify:
- Background color (check body/card backgrounds aren't white/light)
- Accent colors on logo SVG gradient, arrow markers, state dots, badges
- Glassmorphism blur effect on header/nav (scroll page to see backdrop-filter)
- Card hover effects (lift + glow/shadow)
- Gradient text on section headings
- No leftover elements from previous themes (grep for old class names)

## No Secrets Needed
No API keys or credentials required. The app reads from Arc Testnet public RPC.
