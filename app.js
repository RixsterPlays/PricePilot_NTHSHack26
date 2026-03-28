// ── Configuration ──────────────────────────────────────────────
const SUPABASE_URL = "https://sdqsenvztfxstvmjycdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcXNlbnZ6dGZ4c3R2bWp5Y2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTMxODQsImV4cCI6MjA5MDI4OTE4NH0.5RSJJ2PmwvGIunwewKdIAiSmo-fMQZk92Sfjx1GlTck";

// ── Supabase client ───────────────────────────────────────────
let sb = null;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error("Supabase failed to initialize:", e);
}

// ── State ──────────────────────────────────────────────────────
const items = [];
const stores = [];
let currentUser = null;
let isGuest = false;
let authMode = "signin"; // "signin" or "signup"

// ══════════════════════════════════════════════════════════════
// PAGE NAVIGATION
// ══════════════════════════════════════════════════════════════
const allPages = ["landing", "login", "app", "history", "faq", "about"];

function showPage(pageId) {
  allPages.forEach((id) => {
    const el = document.getElementById(`page-${id}`);
    if (el) el.classList.toggle("hidden", id !== pageId);
  });

  // Show navbar on all pages except landing
  const navbar = document.getElementById("navbar");
  navbar.classList.toggle("hidden", pageId === "landing");

  // Close mobile menu
  document.getElementById("nav-mobile").classList.add("hidden");

  // Scroll to top
  window.scrollTo(0, 0);

  // Load history data when visiting history page
  if (pageId === "history" && currentUser) loadHistory();
}

// Nav link clicks
document.querySelectorAll("[data-page]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    const page = el.getAttribute("data-page");
    if (page === "landing") {
      // Logo click: go to app if logged in, landing if not
      if (currentUser || isGuest) {
        showPage("app");
      } else {
        showPage("landing");
      }
    } else if (page === "history" && !currentUser) {
      // Guest can't view history
      return;
    } else {
      showPage(page);
    }
  });
});

// Hamburger toggle
document.getElementById("nav-hamburger").addEventListener("click", () => {
  document.getElementById("nav-mobile").classList.toggle("hidden");
});

// ══════════════════════════════════════════════════════════════
// LANDING PAGE BUTTONS
// ══════════════════════════════════════════════════════════════
document.getElementById("landing-create-btn").addEventListener("click", () => {
  setAuthMode("signup");
  showPage("login");
});

document.getElementById("landing-signin-btn").addEventListener("click", () => {
  setAuthMode("signin");
  showPage("login");
});

document.getElementById("landing-guest-btn").addEventListener("click", () => {
  isGuest = true;
  updateNavForUser();
  showPage("app");
});

// ══════════════════════════════════════════════════════════════
// AUTH PAGE
// ══════════════════════════════════════════════════════════════
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authError = document.getElementById("auth-error");
const authPageTitle = document.getElementById("auth-page-title");
const authPageHint = document.getElementById("auth-page-hint");
const authSwitchText = document.getElementById("auth-switch-text");
const authSwitchLink = document.getElementById("auth-switch-link");
const googleSigninBtn = document.getElementById("google-signin-btn");
const loginBackBtn = document.getElementById("login-back-btn");

function setAuthMode(mode) {
  authMode = mode;
  clearAuthError();
  authEmail.value = "";
  authPassword.value = "";
  if (mode === "signup") {
    authPageTitle.textContent = "Create Account";
    authPageHint.textContent = "Join Price Pilot to save your comparisons";
    authSubmitBtn.textContent = "Create Account";
    authSwitchText.textContent = "Already have an account?";
    authSwitchLink.textContent = "Sign In";
  } else {
    authPageTitle.textContent = "Sign In";
    authPageHint.textContent = "Welcome back to Price Pilot";
    authSubmitBtn.textContent = "Sign In";
    authSwitchText.textContent = "Don't have an account?";
    authSwitchLink.textContent = "Sign Up";
  }
}

authSwitchLink.addEventListener("click", (e) => {
  e.preventDefault();
  setAuthMode(authMode === "signin" ? "signup" : "signin");
});

loginBackBtn.addEventListener("click", () => showPage("landing"));

function showAuthError(msg) {
  authError.textContent = msg;
  authError.style.color = "var(--danger)";
  authError.classList.remove("hidden");
}

function showAuthSuccess(msg) {
  authError.textContent = msg;
  authError.style.color = "var(--accent-green)";
  authError.classList.remove("hidden");
}

function clearAuthError() {
  authError.classList.add("hidden");
}

// Submit handler (shared for sign in and sign up)
async function handleAuthSubmit() {
  clearAuthError();
  if (!sb) { showAuthError("Supabase not loaded. Try refreshing."); return; }
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) {
    showAuthError("Enter both email and password.");
    return;
  }

  if (authMode === "signup") {
    if (password.length < 6) {
      showAuthError("Password must be at least 6 characters.");
      return;
    }
    const { error } = await sb.auth.signUp({ email, password });
    if (error) {
      showAuthError(error.message);
    } else {
      showAuthSuccess("Check your email to confirm, then sign in.");
    }
  } else {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) showAuthError(error.message);
    // onAuthStateChange handles the redirect
  }
}

authSubmitBtn.addEventListener("click", handleAuthSubmit);

// Enter key submits on both email and password fields
authEmail.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (authPassword.value) {
      handleAuthSubmit();
    } else {
      authPassword.focus();
    }
  }
});

authPassword.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleAuthSubmit();
  }
});

googleSigninBtn.addEventListener("click", async () => {
  clearAuthError();
  if (!sb) { showAuthError("Supabase not loaded. Try refreshing."); return; }
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href },
  });
  if (error) showAuthError(error.message);
});

// ══════════════════════════════════════════════════════════════
// AUTH STATE
// ══════════════════════════════════════════════════════════════
function updateNavForUser() {
  const navEmail = document.getElementById("nav-user-email");
  const navSignOut = document.getElementById("nav-sign-out");
  const navSignOutMobile = document.getElementById("nav-sign-out-mobile");
  const navHistoryLink = document.getElementById("nav-history-link");
  const navHistoryLinkMobile = document.getElementById("nav-history-link-mobile");

  if (currentUser) {
    navEmail.textContent = currentUser.email;
    navSignOut.classList.remove("hidden");
    navSignOutMobile.classList.remove("hidden");
    navHistoryLink.style.opacity = "1";
    navHistoryLink.style.pointerEvents = "auto";
    navHistoryLinkMobile.style.opacity = "1";
    navHistoryLinkMobile.style.pointerEvents = "auto";
  } else {
    navEmail.textContent = isGuest ? "Guest" : "";
    navSignOut.classList.toggle("hidden", !isGuest);
    navSignOutMobile.classList.toggle("hidden", !isGuest);
    // Dim history link for guests
    navHistoryLink.style.opacity = "0.35";
    navHistoryLink.style.pointerEvents = "none";
    navHistoryLinkMobile.style.opacity = "0.35";
    navHistoryLinkMobile.style.pointerEvents = "none";
  }
}

function setLoggedIn(user) {
  currentUser = user;
  isGuest = false;
  updateNavForUser();
  showPage("app");
}

function setLoggedOut() {
  currentUser = null;
  isGuest = false;
  updateNavForUser();
  showPage("landing");
}

// Sign out buttons (desktop + mobile)
document.getElementById("nav-sign-out").addEventListener("click", async () => {
  if (sb && currentUser) await sb.auth.signOut();
  setLoggedOut();
});
document.getElementById("nav-sign-out-mobile").addEventListener("click", async () => {
  if (sb && currentUser) await sb.auth.signOut();
  setLoggedOut();
});

// Check session on load
(async () => {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    setLoggedIn(session.user);
  }
})();

// Listen for auth state changes
if (sb) {
  sb.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      setLoggedIn(session.user);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// TAG HELPERS
// ══════════════════════════════════════════════════════════════
function renderTags(arr, container, removeFrom) {
  container.innerHTML = "";
  arr.forEach((val, i) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.innerHTML = `${val}<button data-idx="${i}">&times;</button>`;
    tag.querySelector("button").addEventListener("click", () => {
      removeFrom.splice(i, 1);
      renderTags(removeFrom, container, removeFrom);
      updateCompareBtn();
    });
    container.appendChild(tag);
  });
}

function capitalize(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function addTag(input, arr, container) {
  const raw = input.value.trim();
  if (!raw) return;
  const entries = raw.split(",").map((s) => capitalize(s.trim())).filter(Boolean);
  entries.forEach((entry) => {
    if (!arr.includes(entry)) arr.push(entry);
  });
  input.value = "";
  renderTags(arr, container, arr);
  updateCompareBtn();
}

// ── DOM refs ───────────────────────────────────────────────────
const zipInput = document.getElementById("zip-input");
const itemInput = document.getElementById("item-input");
const storeInput = document.getElementById("store-input");
const addItemBtn = document.getElementById("add-item-btn");
const addStoreBtn = document.getElementById("add-store-btn");
const itemsList = document.getElementById("items-list");
const storesList = document.getElementById("stores-list");
const compareBtn = document.getElementById("compare-btn");
const loading = document.getElementById("loading");
const inputSection = document.getElementById("input-section");
const resultsSection = document.getElementById("results-section");
const backBtn = document.getElementById("back-btn");

function updateCompareBtn() {
  const validZip = /^\d{5}$/.test(zipInput.value.trim());
  compareBtn.disabled = items.length === 0 || stores.length < 2 || !validZip;
}

zipInput.addEventListener("input", updateCompareBtn);

addItemBtn.addEventListener("click", () => addTag(itemInput, items, itemsList));
itemInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTag(itemInput, items, itemsList);
});

addStoreBtn.addEventListener("click", () => addTag(storeInput, stores, storesList));
storeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTag(storeInput, stores, storesList);
});

backBtn.addEventListener("click", () => {
  resultsSection.classList.add("hidden");
  inputSection.classList.remove("hidden");
});

// ══════════════════════════════════════════════════════════════
// CLAUDE PROMPT + API
// ══════════════════════════════════════════════════════════════
function buildPrompt() {
  const zip = zipInput.value.trim();
  return `You are a smart shopping assistant providing a price comparison for a user in zip code ${zip}.

**Items to buy:** ${items.join(", ")}
**Stores to compare:** ${stores.join(", ")}
**User's zip code:** ${zip}

## CRITICAL SOURCING RULES — READ CAREFULLY
1. You MUST use prices from each store's ACTUAL WEBSITE as your primary source. Go to the store's official website or app and look up prices for the user's zip code / local area. For example, walmart.com, target.com, costco.com, kroger.com, etc.
2. Use the zip code ${zip} to determine the user's local market. Many stores have region-specific pricing — use the pricing that applies to the area around zip code ${zip}.
3. Only use third-party sources, general knowledge, or estimates as a LAST RESORT if you truly cannot determine the store-website price. If you must estimate, explicitly note it in the justification.
4. Prefer store-brand / cheapest available option at each store unless the user specified a brand.

## Analysis Steps
1. For each item, look up the current retail price at each store's website for the ${zip} area. Use the cheapest matching product (e.g., store brand).
2. Calculate the total cost of all items at each store.
3. Determine the BEST SINGLE STORE: the one store where buying everything costs the least overall.
4. Determine the BEST STORE PAIR: the optimal way to split the shopping list across exactly two stores to minimize total cost. For each store in the pair, list which items should be bought there and the subtotal. Only recommend a store pair if the combined cost is strictly less than the best single store total. If a single store is already the cheapest option, explicitly say so and do NOT recommend a pair.
5. Provide a brief justification explaining your reasoning and noting which prices came from the actual store website vs. estimates.

You MUST respond with valid JSON only (no markdown, no code fences). Use this exact schema:

{
  "cost_breakdown": [
    {
      "item": "item name",
      "prices": { "Store A": 2.99, "Store B": 3.49 }
    }
  ],
  "store_totals": { "Store A": 10.50, "Store B": 12.00 },
  "best_single_store": {
    "store": "Store A",
    "total": 10.50,
    "reasoning": "why this store is best overall"
  },
  "best_pair": {
    "recommended": true,
    "store1": { "store": "Store A", "items": ["item1"], "subtotal": 4.00 },
    "store2": { "store": "Store B", "items": ["item2"], "subtotal": 5.00 },
    "combined_total": 9.00,
    "savings_vs_single": 1.50,
    "reasoning": "why this pair is better"
  },
  "justification": "overall analysis including which prices are from actual store websites and which are estimates, and any location-specific notes for zip ${zip}"
}

If a pair is NOT better than a single store, set "best_pair.recommended" to false and set reasoning to explain why a single store is sufficient. Still include placeholder values for the other pair fields (they will be ignored).`;
}

async function callClaude(prompt) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/claude`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  return await res.json();
}

// ══════════════════════════════════════════════════════════════
// SAVE COMPARISON
// ══════════════════════════════════════════════════════════════
async function saveComparison(prompt, result) {
  if (!currentUser) return;
  if (!sb) return;
  const { error } = await sb.from("comparisons").insert({
    user_id: currentUser.id,
    items: [...items],
    stores_list: [...stores],
    zip_code: zipInput.value.trim(),
    prompt: prompt,
    result: result,
    best_store: result.best_single_store?.store || null,
    best_total: result.best_single_store?.total || null,
  });
  if (error) console.error("Failed to save comparison:", error.message);
}

// ══════════════════════════════════════════════════════════════
// RENDER RESULTS
// ══════════════════════════════════════════════════════════════
function renderResults(data, storeNames) {
  const tableContainer = document.getElementById("cost-table-container");
  let html = `<table class="cost-table"><thead><tr><th>Item</th>`;
  storeNames.forEach((s) => (html += `<th>${s}</th>`));
  html += `</tr></thead><tbody>`;

  data.cost_breakdown.forEach((row) => {
    let minPrice = Infinity;
    storeNames.forEach((s) => {
      const p = row.prices[s];
      if (p != null && p < minPrice) minPrice = p;
    });
    html += `<tr><td>${row.item}</td>`;
    storeNames.forEach((s) => {
      const p = row.prices[s];
      const isBest = p != null && p === minPrice;
      html += `<td class="${isBest ? "best-price" : ""}">$${p != null ? p.toFixed(2) : "N/A"}</td>`;
    });
    html += `</tr>`;
  });

  html += `<tr class="total-row"><td>Total</td>`;
  storeNames.forEach((s) => {
    const t = data.store_totals[s];
    html += `<td>$${t != null ? t.toFixed(2) : "N/A"}</td>`;
  });
  html += `</tr></tbody></table>`;
  tableContainer.innerHTML = html;

  const singleDiv = document.getElementById("single-store-result");
  const best = data.best_single_store;
  singleDiv.innerHTML = `
    <div class="store-name">${best.store}</div>
    <div class="store-total">Total: $${best.total.toFixed(2)}</div>
    <p style="margin-top:0.5rem;color:var(--text-muted)">${best.reasoning}</p>`;

  const pairCard = document.getElementById("pair-store-card");
  const pairDiv = document.getElementById("pair-store-result");
  const pair = data.best_pair;

  if (pair.recommended) {
    pairCard.classList.remove("hidden");
    pairDiv.innerHTML = `
      <div class="store-pair">
        <div class="store-pair-item">
          <div class="store-name">${pair.store1.store}</div>
          <p>${pair.store1.items.join(", ")}</p>
          <p class="store-total">Subtotal: $${pair.store1.subtotal.toFixed(2)}</p>
        </div>
        <div class="store-pair-item">
          <div class="store-name">${pair.store2.store}</div>
          <p>${pair.store2.items.join(", ")}</p>
          <p class="store-total">Subtotal: $${pair.store2.subtotal.toFixed(2)}</p>
        </div>
      </div>
      <div class="pair-total">Combined Total: $${pair.combined_total.toFixed(2)}
        <span class="savings"> &mdash; Save $${pair.savings_vs_single.toFixed(2)} vs single store</span>
      </div>
      <p style="margin-top:0.5rem;color:var(--text-muted)">${pair.reasoning}</p>`;
  } else {
    pairCard.classList.remove("hidden");
    pairDiv.innerHTML = `
      <p class="pair-note">A single store is already the best option &mdash; no store pair beats it.</p>
      <p style="margin-top:0.4rem;color:var(--text-muted)">${pair.reasoning}</p>`;
  }

  document.getElementById("justification").textContent = data.justification;
}

// ══════════════════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════════════════
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");

async function loadHistory() {
  if (!sb || !currentUser) return;
  historyList.innerHTML = '<p class="hint">Loading...</p>';
  historyEmpty.classList.add("hidden");

  const { data, error } = await sb
    .from("comparisons")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    historyList.innerHTML = `<p class="auth-error">Failed to load history: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    historyList.innerHTML = "";
    historyEmpty.classList.remove("hidden");
    return;
  }

  historyList.innerHTML = data
    .map((row) => {
      const date = new Date(row.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const itemsStr = (row.items || []).join(", ");
      const storesStr = (row.stores_list || []).join(", ");
      return `
        <div class="card history-card" data-id="${row.id}">
          <div class="history-header">
            <span class="history-date">${date}</span>
            <span class="history-zip">ZIP ${row.zip_code || "?"}</span>
          </div>
          <p class="history-items">${itemsStr}</p>
          <p class="history-stores">${storesStr}</p>
          <div class="history-result">
            <span class="store-name" style="font-size:1rem">${row.best_store || "N/A"}</span>
            <span class="store-total" style="font-size:0.95rem;margin:0">$${row.best_total != null ? row.best_total.toFixed(2) : "?"}</span>
          </div>
          <button class="btn-secondary history-view-btn" data-id="${row.id}">View Details</button>
        </div>`;
    })
    .join("");

  historyList.querySelectorAll(".history-view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const row = data.find((r) => r.id === id || r.id === parseInt(id));
      if (row) showHistoryDetail(row);
    });
  });
}

function showHistoryDetail(row) {
  showPage("app");
  inputSection.classList.add("hidden");
  resultsSection.classList.remove("hidden");

  const storeNames = row.stores_list || [];
  renderResults(row.result, storeNames);
  document.getElementById("prompt-display").textContent = row.prompt || "";
  document.getElementById("json-display").textContent = JSON.stringify(row.result, null, 2);

  backBtn.onclick = () => {
    resultsSection.classList.add("hidden");
    inputSection.classList.remove("hidden");
    showPage("history");
    backBtn.onclick = () => {
      resultsSection.classList.add("hidden");
      inputSection.classList.remove("hidden");
    };
  };
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPARE FLOW
// ══════════════════════════════════════════════════════════════
compareBtn.addEventListener("click", async () => {
  if (SUPABASE_URL === "YOUR_SUPABASE_URL_HERE") {
    alert("Please set your Supabase URL and anon key in app.js (lines 2-3).");
    return;
  }

  inputSection.classList.add("hidden");
  loading.classList.remove("hidden");
  resultsSection.classList.add("hidden");

  try {
    const prompt = buildPrompt();
    const result = await callClaude(prompt);
    const storeNames = [...stores];
    renderResults(result, storeNames);
    document.getElementById("prompt-display").textContent = prompt;
    document.getElementById("json-display").textContent = JSON.stringify(result, null, 2);
    loading.classList.add("hidden");
    resultsSection.classList.remove("hidden");

    backBtn.onclick = () => {
      resultsSection.classList.add("hidden");
      inputSection.classList.remove("hidden");
    };

    saveComparison(prompt, result);
  } catch (err) {
    loading.classList.add("hidden");
    inputSection.classList.remove("hidden");

    const existing = document.querySelector(".error-msg");
    if (existing) existing.remove();
    const errDiv = document.createElement("div");
    errDiv.className = "error-msg";
    errDiv.textContent = `Error: ${err.message}`;
    inputSection.prepend(errDiv);
  }
});
