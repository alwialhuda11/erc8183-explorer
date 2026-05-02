// ============================================
// ERC-8183 Agentic Commerce Explorer
// Application Logic
// ============================================

const ARC_RPC = "https://rpc.testnet.arc.network";
const CONTRACT_ADDRESS = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const ARCSCAN_BASE = "https://testnet.arcscan.app";

const STATUS_NAMES = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];
const STATUS_CLASSES = ["status-open", "status-funded", "status-submitted", "status-completed", "status-rejected", "status-expired"];

// ABI for getJob - encoded function selector
const GET_JOB_SELECTOR = "0xbf8ecf9c"; // keccak256("getJob(uint256)") first 4 bytes

// ── Particles ──
function initParticles() {
  const container = document.getElementById("particles");
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = Math.random() * 100 + "%";
    particle.style.animationDelay = Math.random() * 8 + "s";
    particle.style.animationDuration = 6 + Math.random() * 6 + "s";
    const colors = ["#8B5CF6", "#A78BFA", "#C4A462", "#22D3EE", "#10B981"];
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.width = (1 + Math.random() * 2) + "px";
    particle.style.height = particle.style.width;
    container.appendChild(particle);
  }
}

// ── Tab Navigation ──
function initTabs() {
  const buttons = document.querySelectorAll(".nav-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
      const tabId = "tab-" + btn.dataset.tab;
      document.getElementById(tabId).classList.add("active");
    });
  });
}

// ── State Machine Hover Effects ──
function initStateMachine() {
  const nodes = document.querySelectorAll(".state-node");
  nodes.forEach(node => {
    node.addEventListener("mouseenter", () => {
      node.classList.add("highlight");
    });
    node.addEventListener("mouseleave", () => {
      node.classList.remove("highlight");
    });
  });
}

// ── RPC Call Helpers ──
function encodeUint256(value) {
  const hex = BigInt(value).toString(16);
  return hex.padStart(64, "0");
}

function decodeAddress(hex) {
  return "0x" + hex.slice(24);
}

function decodeUint256(hex) {
  return BigInt("0x" + hex);
}

function decodeString(fullData, offsetSlot) {
  // offset is stored in the slot, pointing to where the string data begins
  const offset = Number(decodeUint256(fullData.slice(offsetSlot * 64, (offsetSlot + 1) * 64)));
  const wordOffset = offset / 32;
  const length = Number(decodeUint256(fullData.slice(wordOffset * 64, (wordOffset + 1) * 64)));
  const dataStart = (wordOffset + 1) * 64;
  const dataEnd = dataStart + length * 2;
  const hexStr = fullData.slice(dataStart, dataEnd);
  
  let str = "";
  for (let i = 0; i < hexStr.length; i += 2) {
    str += String.fromCharCode(parseInt(hexStr.substr(i, 2), 16));
  }
  return str;
}

async function ethCall(to, data) {
  const response = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to, data }, "latest"],
      id: 1,
    }),
  });
  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message || "RPC error");
  }
  return result.result;
}

// ── Job Explorer ──
let recentJobs = [];

async function fetchJob(jobId) {
  const data = GET_JOB_SELECTOR + encodeUint256(jobId);
  const result = await ethCall(CONTRACT_ADDRESS, data);
  
  // Remove 0x prefix
  const hex = result.slice(2);
  
  // The result is a tuple: (id, client, provider, evaluator, description, budget, expiredAt, status, hook)
  // Each field is 32 bytes (64 hex chars), except description which is dynamic
  const id = decodeUint256(hex.slice(0, 64));
  const client = decodeAddress(hex.slice(64, 128));
  const provider = decodeAddress(hex.slice(128, 192));
  const evaluator = decodeAddress(hex.slice(192, 256));
  // slot 4 (256-320) is the offset to the description string
  const budget = decodeUint256(hex.slice(320, 384));
  const expiredAt = decodeUint256(hex.slice(384, 448));
  const status = Number(decodeUint256(hex.slice(448, 512)));
  const hook = decodeAddress(hex.slice(512, 576));
  
  let description = "";
  try {
    description = decodeString(hex, 4);
  } catch (e) {
    description = "(unable to decode)";
  }
  
  return {
    id: Number(id),
    client,
    provider,
    evaluator,
    description,
    budget,
    expiredAt: Number(expiredAt),
    status,
    hook,
  };
}

function formatUSDC(raw) {
  const val = Number(raw) / 1e6;
  return val.toFixed(2) + " USDC";
}

function formatAddress(addr) {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    return "0x0000...0000 (none)";
  }
  return addr.slice(0, 8) + "..." + addr.slice(-6);
}

function formatTimestamp(ts) {
  if (ts === 0) return "N/A";
  const date = new Date(ts * 1000);
  return date.toLocaleString();
}

function displayJob(job) {
  document.getElementById("result-job-id").textContent = job.id;
  
  const statusBadge = document.getElementById("result-status");
  statusBadge.textContent = STATUS_NAMES[job.status] || "Unknown";
  statusBadge.className = "job-status-badge " + (STATUS_CLASSES[job.status] || "");
  
  document.getElementById("result-client").textContent = job.client;
  document.getElementById("result-provider").textContent = job.provider;
  document.getElementById("result-evaluator").textContent = job.evaluator;
  document.getElementById("result-budget").textContent = formatUSDC(job.budget);
  document.getElementById("result-description").textContent = job.description || "(empty)";
  document.getElementById("result-expires").textContent = formatTimestamp(job.expiredAt);
  document.getElementById("result-hook").textContent = job.hook;
  
  document.getElementById("result-arcscan").href = 
    `${ARCSCAN_BASE}/address/${CONTRACT_ADDRESS}`;
  
  // Update mini lifecycle
  const steps = document.querySelectorAll(".lifecycle-step");
  const connectors = document.querySelectorAll(".lifecycle-connector");
  
  steps.forEach((step, i) => {
    step.classList.remove("active", "completed");
    if (i < job.status) {
      step.classList.add("completed");
    } else if (i === job.status) {
      step.classList.add("active");
    }
  });
  
  connectors.forEach((conn, i) => {
    conn.classList.remove("active");
    if (i < job.status) {
      conn.classList.add("active");
    }
  });
  
  document.getElementById("job-result").classList.remove("hidden");
  document.getElementById("job-loading").classList.add("hidden");
  document.getElementById("job-error").classList.add("hidden");
  
  // Add to recent jobs
  const exists = recentJobs.find(j => j.id === job.id);
  if (!exists) {
    recentJobs.unshift({ id: job.id, status: job.status, description: job.description });
    if (recentJobs.length > 12) recentJobs.pop();
    renderRecentJobs();
  }
}

function renderRecentJobs() {
  const container = document.getElementById("recent-jobs-list");
  if (recentJobs.length === 0) {
    container.innerHTML = '<div class="empty-state">No jobs looked up yet. Try searching for Job ID 1!</div>';
    return;
  }
  
  container.innerHTML = recentJobs.map(job => `
    <div class="recent-job-item" data-jobid="${job.id}">
      <span class="rj-id">Job #${job.id}</span>
      <span class="rj-status job-status-badge ${STATUS_CLASSES[job.status]}">${STATUS_NAMES[job.status]}</span>
    </div>
  `).join("");
  
  container.querySelectorAll(".recent-job-item").forEach(item => {
    item.addEventListener("click", () => {
      const id = item.dataset.jobid;
      document.getElementById("job-id-input").value = id;
      searchJob(parseInt(id));
    });
  });
}

async function searchJob(jobId) {
  document.getElementById("job-result").classList.add("hidden");
  document.getElementById("job-error").classList.add("hidden");
  document.getElementById("job-loading").classList.remove("hidden");
  
  try {
    const job = await fetchJob(jobId);
    
    // Check if the job exists (id=0 and all addresses are zero means no job)
    if (job.id === 0 && job.client === "0x0000000000000000000000000000000000000000") {
      throw new Error("Job not found. This Job ID does not exist on Arc Testnet.");
    }
    
    displayJob(job);
  } catch (error) {
    document.getElementById("job-loading").classList.add("hidden");
    document.getElementById("job-error").classList.remove("hidden");
    let msg = error.message || "Failed to fetch job";
    if (msg.includes("execution reverted") || msg.includes("revert")) {
      msg = `Job #${jobId} not found. This job hasn't been created yet on Arc Testnet. Try creating one using the ERC-8183 quickstart guide!`;
    }
    document.getElementById("error-message").textContent = msg;
  }
}

function initExplorer() {
  const searchBtn = document.getElementById("search-btn");
  const input = document.getElementById("job-id-input");
  
  searchBtn.addEventListener("click", () => {
    const jobId = parseInt(input.value);
    if (!isNaN(jobId) && jobId >= 0) {
      searchJob(jobId);
    }
  });
  
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const jobId = parseInt(input.value);
      if (!isNaN(jobId) && jobId >= 0) {
        searchJob(jobId);
      }
    }
  });
}

// ── Simulator ──
const SIM_STEPS = [
  {
    title: "Step 1: Create Job",
    desc: "The <strong>client</strong> initiates the ERC-8183 flow by calling <code>createJob()</code> on the AgenticCommerce contract. This defines the provider, evaluator, expiry timestamp, job description, and optional hook contract.",
    actors: [{ type: "client-actor", label: "Client (Caller)" }],
    stateChange: { from: "None", to: "Open", fromColor: "#334155", toColor: "#6366f1" },
    code: `<span class="comment">// Client creates a new job</span>
<span class="keyword">await</span> contract.<span class="function">createJob</span>(
  providerAddress,      <span class="comment">// who will do the work</span>
  evaluatorAddress,     <span class="comment">// who judges the deliverable</span>
  expiredAt,            <span class="comment">// unix timestamp deadline</span>
  <span class="string">"Build an AI agent"</span>, <span class="comment">// job description</span>
  <span class="string">"0x0000...0000"</span>      <span class="comment">// hook (none)</span>
);`,
    detail: "The createJob function emits a <code>JobCreated</code> event with the new jobId. The job starts in the <strong>Open</strong> state."
  },
  {
    title: "Step 2: Set Budget",
    desc: "The <strong>provider</strong> sets the price for the job by calling <code>setBudget()</code>. This defines how much USDC the client needs to lock in escrow.",
    actors: [{ type: "provider-actor", label: "Provider (Pricer)" }],
    stateChange: { from: "Open", to: "Open", fromColor: "#6366f1", toColor: "#6366f1" },
    code: `<span class="comment">// Provider sets the job price (5 USDC)</span>
<span class="keyword">const</span> JOB_BUDGET = <span class="function">parseUnits</span>(<span class="string">"5"</span>, <span class="number">6</span>);

<span class="keyword">await</span> contract.<span class="function">setBudget</span>(
  jobId,       <span class="comment">// the job to price</span>
  JOB_BUDGET,  <span class="comment">// 5 USDC (6 decimals)</span>
  <span class="string">"0x"</span>         <span class="comment">// optional params</span>
);`,
    detail: "The budget is stored on-chain. The job remains in <strong>Open</strong> state until the client funds it."
  },
  {
    title: "Step 3: Approve USDC",
    desc: "Before funding, the <strong>client</strong> must approve the AgenticCommerce contract to spend their USDC. This is a standard ERC-20 approval.",
    actors: [{ type: "client-actor", label: "Client (Approver)" }],
    stateChange: { from: "Open", to: "Open", fromColor: "#6366f1", toColor: "#6366f1" },
    code: `<span class="comment">// Approve ERC-8183 contract to spend USDC</span>
<span class="keyword">await</span> usdc.<span class="function">approve</span>(
  AGENTIC_COMMERCE_CONTRACT,  <span class="comment">// spender</span>
  JOB_BUDGET                   <span class="comment">// amount</span>
);`,
    detail: "The USDC contract on Arc Testnet is at <code>0x3600...0000</code>. The approval must be >= the budget amount."
  },
  {
    title: "Step 4: Fund Escrow",
    desc: "The <strong>client</strong> calls <code>fund()</code> to transfer USDC into the contract's escrow. This locks the budget and signals the provider to start working.",
    actors: [{ type: "client-actor", label: "Client (Funder)" }],
    stateChange: { from: "Open", to: "Funded", fromColor: "#6366f1", toColor: "#22d3ee" },
    code: `<span class="comment">// Fund the job escrow with USDC</span>
<span class="keyword">await</span> contract.<span class="function">fund</span>(
  jobId,   <span class="comment">// the job to fund</span>
  <span class="string">"0x"</span>     <span class="comment">// optional params</span>
);

<span class="comment">// Job state: Open -> Funded</span>
<span class="comment">// USDC is now locked in escrow</span>`,
    detail: "The USDC is transferred from the client's wallet to the contract. The job transitions to <strong>Funded</strong>."
  },
  {
    title: "Step 5: Submit Deliverable",
    desc: "The <strong>provider</strong> completes the work and submits a <code>bytes32</code> deliverable hash. This could be a hash of a file, IPFS CID, or any proof of work.",
    actors: [{ type: "provider-actor", label: "Provider (Deliverer)" }],
    stateChange: { from: "Funded", to: "Submitted", fromColor: "#22d3ee", toColor: "#f59e0b" },
    code: `<span class="comment">// Hash the deliverable</span>
<span class="keyword">const</span> deliverableHash = <span class="function">keccak256</span>(
  <span class="function">toHex</span>(<span class="string">"arc-erc8183-demo-deliverable"</span>)
);

<span class="comment">// Submit the deliverable</span>
<span class="keyword">await</span> contract.<span class="function">submit</span>(
  jobId,             <span class="comment">// the job</span>
  deliverableHash,   <span class="comment">// proof of work</span>
  <span class="string">"0x"</span>               <span class="comment">// optional params</span>
);

<span class="comment">// Job state: Funded -> Submitted</span>`,
    detail: "The deliverable hash is stored on-chain. The evaluator can now review the work."
  },
  {
    title: "Step 6: Complete Job",
    desc: "The <strong>evaluator</strong> reviews and approves the deliverable by calling <code>complete()</code>. This triggers settlement &mdash; USDC is released from escrow to the provider.",
    actors: [{ type: "evaluator-actor", label: "Evaluator (Judge)" }],
    stateChange: { from: "Submitted", to: "Completed", fromColor: "#f59e0b", toColor: "#10b981" },
    code: `<span class="comment">// Evaluator approves the deliverable</span>
<span class="keyword">const</span> reasonHash = <span class="function">keccak256</span>(
  <span class="function">toHex</span>(<span class="string">"deliverable-approved"</span>)
);

<span class="keyword">await</span> contract.<span class="function">complete</span>(
  jobId,       <span class="comment">// the job</span>
  reasonHash,  <span class="comment">// approval reason</span>
  <span class="string">"0x"</span>         <span class="comment">// optional params</span>
);

<span class="comment">// Job state: Submitted -> Completed</span>
<span class="comment">// USDC released to provider!</span>`,
    detail: "Settlement is automatic. The escrowed USDC is transferred to the provider's wallet. The job reaches its final <strong>Completed</strong> state."
  },
];

let currentSimStep = 0;

function renderSimStep(step) {
  const content = document.getElementById("sim-content");
  const data = SIM_STEPS[step];
  
  content.innerHTML = `
    <h3>${data.title}</h3>
    <p class="sim-desc">${data.desc}</p>
    <div class="sim-actors-display">
      ${data.actors.map(a => `<div class="sim-actor ${a.type}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        ${a.label}
      </div>`).join("")}
    </div>
    <div class="sim-state-change">
      <span class="sim-state-from" style="background: ${data.stateChange.fromColor}20; color: ${data.stateChange.fromColor}; border: 1px solid ${data.stateChange.fromColor}40">${data.stateChange.from}</span>
      <span class="sim-state-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </span>
      <span class="sim-state-to" style="background: ${data.stateChange.toColor}20; color: ${data.stateChange.toColor}; border: 1px solid ${data.stateChange.toColor}40">${data.stateChange.to}</span>
    </div>
    <div class="sim-code">${data.code}</div>
    <p class="sim-desc">${data.detail}</p>
  `;
  
  // Update sidebar
  document.querySelectorAll(".sim-step").forEach((el, i) => {
    el.classList.remove("active", "completed");
    if (i < step) el.classList.add("completed");
    if (i === step) el.classList.add("active");
  });
  
  // Update progress bar
  const progress = ((step + 1) / SIM_STEPS.length) * 100;
  document.getElementById("sim-progress-bar").style.width = progress + "%";
  
  // Update buttons
  document.getElementById("sim-prev").disabled = step === 0;
  document.getElementById("sim-next").disabled = step === SIM_STEPS.length - 1;
  document.getElementById("sim-next").innerHTML = step === SIM_STEPS.length - 1
    ? 'Done <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
    : 'Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
}

function initSimulator() {
  renderSimStep(0);
  
  document.getElementById("sim-next").addEventListener("click", () => {
    if (currentSimStep < SIM_STEPS.length - 1) {
      currentSimStep++;
      renderSimStep(currentSimStep);
    }
  });
  
  document.getElementById("sim-prev").addEventListener("click", () => {
    if (currentSimStep > 0) {
      currentSimStep--;
      renderSimStep(currentSimStep);
    }
  });
  
  // Sidebar click
  document.querySelectorAll(".sim-step").forEach((el, i) => {
    el.addEventListener("click", () => {
      currentSimStep = i;
      renderSimStep(currentSimStep);
    });
  });
}

// ── Contract Badge Copy ──
function initContractBadge() {
  const badge = document.querySelector(".contract-badge");
  badge.addEventListener("click", () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS).then(() => {
      const original = badge.querySelector("span").textContent;
      badge.querySelector("span").textContent = "Copied!";
      setTimeout(() => {
        badge.querySelector("span").textContent = original;
      }, 1500);
    });
  });
}

// ── Initialize ──
document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  initTabs();
  initStateMachine();
  initExplorer();
  initSimulator();
  initContractBadge();
});
