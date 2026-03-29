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

// ── Theme Toggle ──────────────────────────────────────────────
function toggleTheme() {
  document.body.classList.toggle("light-mode");
  localStorage.setItem(
    "pp-theme",
    document.body.classList.contains("light-mode") ? "light" : "dark"
  );
}

// Restore saved preference
if (localStorage.getItem("pp-theme") === "light") {
  document.body.classList.add("light-mode");
}

// Both toggles (navbar + landing page) share the same function
document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
document
  .getElementById("theme-toggle-landing")
  .addEventListener("click", toggleTheme);

// ── State ──────────────────────────────────────────────────────
const items = [];
const stores = [];
let currentUser = null;
let isGuest = false;
let authMode = "signin"; // "signin" or "signup"
let editingPurchaseId = null;

// ══════════════════════════════════════════════════════════════
// PAGE NAVIGATION
// ══════════════════════════════════════════════════════════════
const allPages = ["landing", "login", "app", "history", "purchases", "predictions", "faq", "about"];

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

  // Load data when visiting relevant pages
  if (pageId === "history" && currentUser) loadHistory();
  if (pageId === "purchases" && currentUser) loadPurchases();
  if (pageId === "predictions" && currentUser) loadPredictions();
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
    } else if ((page === "history" || page === "purchases" || page === "predictions") && !currentUser) {
      // Guest can't view history, purchases, or predictions
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
  const navPurchasesLink = document.getElementById("nav-purchases-link");
  const navPurchasesLinkMobile = document.getElementById("nav-purchases-link-mobile");
  const navPredictionsLink = document.getElementById("nav-predictions-link");
  const navPredictionsLinkMobile = document.getElementById("nav-predictions-link-mobile");

  const authLinks = [
    navHistoryLink, navHistoryLinkMobile,
    navPurchasesLink, navPurchasesLinkMobile,
    navPredictionsLink, navPredictionsLinkMobile,
  ];

  if (currentUser) {
    navEmail.textContent = currentUser.email;
    navSignOut.classList.remove("hidden");
    navSignOutMobile.classList.remove("hidden");
    authLinks.forEach((l) => { l.style.opacity = "1"; l.style.pointerEvents = "auto"; });
  } else {
    navEmail.textContent = isGuest ? "Guest" : "";
    navSignOut.classList.toggle("hidden", !isGuest);
    navSignOutMobile.classList.toggle("hidden", !isGuest);
    authLinks.forEach((l) => { l.style.opacity = "0.35"; l.style.pointerEvents = "none"; });
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
// SAVE INDIVIDUAL PURCHASE ITEMS
// ══════════════════════════════════════════════════════════════
async function savePurchaseItems(result) {
  if (!currentUser || !sb) return;
  const zip = zipInput.value.trim();
  const today = new Date().toISOString().split("T")[0];

  const rows = [];
  for (const row of result.cost_breakdown || []) {
    let bestStore = null;
    let bestPrice = Infinity;
    for (const [store, price] of Object.entries(row.prices || {})) {
      if (price != null && price < bestPrice) {
        bestPrice = price;
        bestStore = store;
      }
    }
    if (bestStore) {
      rows.push({
        user_id: currentUser.id,
        item: row.item,
        store: bestStore,
        price: bestPrice,
        quantity: 1,
        zip_code: zip,
        purchased_at: today,
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await sb.from("purchase_items").insert(rows);
    if (error) console.error("Failed to save purchase items:", error.message);
  }
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
    savePurchaseItems(result);
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

// ══════════════════════════════════════════════════════════════
// PURCHASES PAGE (CRUD)
// ══════════════════════════════════════════════════════════════
async function loadPurchases() {
  if (!sb || !currentUser) return;
  const listEl = document.getElementById("purchases-list");
  const emptyEl = document.getElementById("purchases-empty");
  listEl.innerHTML = '<p class="hint">Loading...</p>';
  emptyEl.classList.add("hidden");

  const { data, error } = await sb
    .from("purchase_items")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("purchased_at", { ascending: false })
    .limit(200);

  if (error) {
    listEl.innerHTML = `<p class="auth-error">Failed to load: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }

  listEl.innerHTML = data
    .map((row) => {
      const date = new Date(row.purchased_at + "T00:00:00").toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" }
      );
      return `
      <div class="purchase-row" data-id="${row.id}">
        <div class="purchase-row-info">
          <div class="purchase-row-item">${row.item}</div>
          <div class="purchase-row-meta">${row.store} &middot; ${date} &middot; Qty: ${row.quantity || 1}</div>
        </div>
        <div class="purchase-row-price">$${Number(row.price).toFixed(2)}</div>
        <div class="purchase-row-actions">
          <button class="purchase-edit-btn" data-id="${row.id}">Edit</button>
          <button class="purchase-delete-btn" data-id="${row.id}">Delete</button>
        </div>
      </div>`;
    })
    .join("");

  listEl.querySelectorAll(".purchase-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = data.find((r) => r.id === btn.getAttribute("data-id"));
      if (row) showPurchaseForm(row);
    });
  });

  listEl.querySelectorAll(".purchase-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this purchase record?")) return;
      const { error } = await sb
        .from("purchase_items")
        .delete()
        .eq("id", btn.getAttribute("data-id"));
      if (error) alert("Failed to delete: " + error.message);
      else loadPurchases();
    });
  });
}

function showPurchaseForm(row) {
  const form = document.getElementById("purchase-form");
  document.getElementById("purchase-form-title").textContent = row
    ? "Edit Purchase"
    : "Add Purchase";
  document.getElementById("pf-item").value = row ? row.item : "";
  document.getElementById("pf-store").value = row ? row.store : "";
  document.getElementById("pf-price").value = row ? row.price : "";
  document.getElementById("pf-quantity").value = row ? row.quantity || 1 : "1";
  document.getElementById("pf-date").value = row
    ? row.purchased_at
    : new Date().toISOString().split("T")[0];
  editingPurchaseId = row ? row.id : null;
  form.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth" });
}

function hidePurchaseForm() {
  document.getElementById("purchase-form").classList.add("hidden");
  editingPurchaseId = null;
}

async function savePurchaseForm() {
  if (!sb || !currentUser) return;
  const item = capitalize(document.getElementById("pf-item").value.trim());
  const store = capitalize(document.getElementById("pf-store").value.trim());
  const price = parseFloat(document.getElementById("pf-price").value);
  const quantity = parseInt(document.getElementById("pf-quantity").value) || 1;
  const date = document.getElementById("pf-date").value;

  if (!item || !store || isNaN(price) || !date) {
    alert("Please fill in all fields.");
    return;
  }

  if (editingPurchaseId) {
    const { error } = await sb
      .from("purchase_items")
      .update({ item, store, price, quantity, purchased_at: date })
      .eq("id", editingPurchaseId);
    if (error) {
      alert("Failed to update: " + error.message);
      return;
    }
  } else {
    const { error } = await sb.from("purchase_items").insert({
      user_id: currentUser.id,
      item,
      store,
      price,
      quantity,
      zip_code: zipInput.value.trim() || null,
      purchased_at: date,
    });
    if (error) {
      alert("Failed to save: " + error.message);
      return;
    }
  }

  hidePurchaseForm();
  loadPurchases();
}

document
  .getElementById("add-purchase-btn")
  .addEventListener("click", () => showPurchaseForm(null));
document.getElementById("pf-save").addEventListener("click", savePurchaseForm);
document.getElementById("pf-cancel").addEventListener("click", hidePurchaseForm);

// ══════════════════════════════════════════════════════════════
// PREDICTIONS PAGE
// ══════════════════════════════════════════════════════════════
const LOADING_MESSAGES = [
  "Analyzing your shopping patterns...",
  "Consulting the ancient scrolls of grocery wisdom...",
  "Judging your milk-to-cereal ratio...",
  "Teaching AI what a vegetable is...",
  "Counting how many times you've bought eggs...",
  "Asking Claude if you really need more snacks...",
  "Calculating optimal bread freshness windows...",
  "Cross-referencing your cart with your fridge...",
  "Detecting suspiciously frequent chip purchases...",
  "Almost done — probably.",
];

let loadingMsgInterval = null;

function startLoadingMessages() {
  const el = document.getElementById("predictions-loading-msg");
  let index = 0;
  el.textContent = LOADING_MESSAGES[0];
  el.style.transition = "opacity 0.4s ease";
  el.style.opacity = "1";

  loadingMsgInterval = setInterval(() => {
    el.style.opacity = "0";
    setTimeout(() => {
      index = (index + 1) % LOADING_MESSAGES.length;
      el.textContent = LOADING_MESSAGES[index];
      el.style.opacity = "1";
    }, 400);
  }, 2800);
}

function stopLoadingMessages() {
  clearInterval(loadingMsgInterval);
  loadingMsgInterval = null;
}

async function loadPredictions() {
  if (!sb || !currentUser) return;

  const loadingEl = document.getElementById("predictions-loading");
  const emptyEl = document.getElementById("predictions-empty");
  const resultsEl = document.getElementById("predictions-results");

  loadingEl.classList.remove("hidden");
  emptyEl.classList.add("hidden");
  resultsEl.classList.add("hidden");
  startLoadingMessages();

  // Fetch last 30 days of purchases
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
  const cutoff = oneMonthAgo.toISOString().split("T")[0];

  const { data, error } = await sb
    .from("purchase_items")
    .select("*")
    .eq("user_id", currentUser.id)
    .gte("purchased_at", cutoff)
    .order("purchased_at", { ascending: false });

  if (error) {
    stopLoadingMessages();
    loadingEl.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    emptyEl.querySelector(".card").innerHTML =
      `<p style="color:var(--danger)">Failed to load purchases: ${error.message}</p>`;
    return;
  }

  // Need data with at least one recurring item
  const counts = {};
  (data || []).forEach((r) => (counts[r.item] = (counts[r.item] || 0) + 1));
  const hasRecurring = Object.values(counts).some((c) => c > 1);

  if (!data || data.length < 2 || !hasRecurring) {
    stopLoadingMessages();
    loadingEl.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    return;
  }

  try {
    const prompt = buildPredictionPrompt(data);
    const result = await callClaude(prompt);

    document.getElementById("predictions-prompt-display").textContent = prompt;
    document.getElementById("predictions-json-display").textContent = JSON.stringify(result, null, 2);

    renderPredictions(result);
    stopLoadingMessages();
    loadingEl.classList.add("hidden");
    resultsEl.classList.remove("hidden");
  } catch (err) {
    stopLoadingMessages();
    loadingEl.classList.add("hidden");
    resultsEl.classList.remove("hidden");
    document.getElementById("predictions-list").innerHTML =
      `<div class="card" style="text-align:center"><p style="color:var(--danger)">Failed to get predictions: ${err.message}</p></div>`;
    document.getElementById("predictions-add-all").classList.add("hidden");
  }
}

function buildPredictionPrompt(purchases) {
  const today = new Date().toISOString().split("T")[0];
  const lines = purchases.map(
    (p) =>
      `${p.purchased_at} | ${p.item} | ${p.store} | $${Number(p.price).toFixed(2)} | qty ${p.quantity || 1}`
  );

  return `You are a smart shopping assistant that predicts recurring grocery purchases.

Today's date: ${today}

Here is the user's purchase history from the LAST 30 DAYS (date | item | store | price | quantity):
${lines.join("\n")}

Analyze the purchase patterns and identify items the user is likely to need THIS WEEK (within the next 7 days). Consider:
1. Purchase frequency — how often each item was bought in this 2-week window
2. Time since last purchase vs the typical interval between purchases
3. Whether the item appears to be a recurring staple vs a one-time buy
4. Common grocery replenishment cycles (milk ~weekly, bread ~weekly, eggs ~2 weeks, etc.)

Suggest items with clear recurring patterns. For items purchased only once in the window, only suggest them if they are common weekly staples (milk, bread, eggs, etc.) and enough time has passed that a repurchase is likely.

You MUST respond with valid JSON only (no markdown, no code fences). Use this exact schema:

{
  "suggestions": [
    {
      "item": "Milk",
      "confidence": "high",
      "reason": "Purchased every 7 days, last bought 8 days ago",
      "avg_price": 3.49,
      "usual_store": "Walmart"
    }
  ],
  "summary": "Brief overall analysis of shopping patterns and what drives these predictions"
}

If there is insufficient data to make any predictions, return:
{
  "suggestions": [],
  "summary": "Not enough purchase history to make predictions yet. Keep shopping and check back!"
}`;
}

function renderPredictions(data) {
  const listEl = document.getElementById("predictions-list");
  const addAllBtn = document.getElementById("predictions-add-all");

  if (!data.suggestions || data.suggestions.length === 0) {
    listEl.innerHTML = `<div class="card" style="text-align:center;padding:2rem">
      <p style="color:var(--text-muted)">${data.summary || "No predictions available yet."}</p>
    </div>`;
    addAllBtn.classList.add("hidden");
    return;
  }

  addAllBtn.classList.remove("hidden");

  let html = data.suggestions
    .map(
      (s) => `
    <div class="prediction-card card">
      <div class="prediction-top">
        <div class="prediction-info">
          <span class="suggestion-confidence confidence-${s.confidence}">${s.confidence}</span>
          <span class="prediction-item-name">${s.item}</span>
        </div>
        <button class="prediction-add-btn btn-secondary" data-item="${s.item}" style="padding:0.4rem 0.9rem;font-size:0.85rem">+ Add to Compare</button>
      </div>
      <p class="prediction-reason">${s.reason}</p>
      <p class="prediction-meta">~$${Number(s.avg_price).toFixed(2)} at ${s.usual_store}</p>
    </div>`
    )
    .join("");

  if (data.summary) {
    html += `<div class="card predictions-summary-card"><p>${data.summary}</p></div>`;
  }

  listEl.innerHTML = html;

  listEl.querySelectorAll(".prediction-add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemName = capitalize(btn.getAttribute("data-item"));
      if (!items.includes(itemName)) {
        items.push(itemName);
        renderTags(items, itemsList, items);
        updateCompareBtn();
      }
      btn.disabled = true;
      btn.textContent = "Added";
    });
  });
}

document.getElementById("predictions-add-all").addEventListener("click", () => {
  document.querySelectorAll(".prediction-add-btn:not(:disabled)").forEach((btn) => {
    const itemName = capitalize(btn.getAttribute("data-item"));
    if (!items.includes(itemName)) items.push(itemName);
    btn.disabled = true;
    btn.textContent = "Added";
  });
  renderTags(items, itemsList, items);
  updateCompareBtn();
  showPage("app");
});

document.getElementById("predictions-refresh").addEventListener("click", loadPredictions);
