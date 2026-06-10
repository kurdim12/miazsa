// =============================================================================
// src/lib/i18n.ts — Minimal EN dictionary + accessor.
//
// i18n-ready: structured as a flat dictionary keyed by dotted strings so AR/RTL
// can be added later (docs/13 §A.4) without touching call sites. EN only now.
// =============================================================================

export type Lang = "en" | "ar";

/** The current language. EN now; AR scaffolding can flip this later. */
export const currentLang: Lang = "en";

const en: Record<string, string> = {
  // App shell
  "app.name": "MIZAN",
  "app.tagline": "Earth Observation Environmental Intelligence for Jordan",
  "nav.dashboard": "National",
  "nav.map": "Map",
  "nav.azraq": "Azraq",
  "nav.login": "Sign in",
  "nav.signout": "Sign out",
  "footer.data": "Data: Google Earth Engine + MIZAN engine",
  "footer.country": "Jordan",

  // Scientific stance (integrity)
  "stance.title": "Scientific stance",
  "stance.body":
    "MIZAN estimates environmental indicators from satellite (Earth Observation) proxies. " +
    "It does not directly observe groundwater levels, wells, or aquifer pressure, and it makes " +
    "no legal or regulatory determination. Every number carries its source, methodology, and a " +
    "confidence score.",

  // Synthetic data banner
  "demo.banner":
    "Illustrative demo data — not real EO observations. Some metrics below are seeded for " +
    "demonstration and are clearly marked. Run an Earth Engine compute for grounded values.",

  // Empty / error / loading
  "state.loading": "Loading…",
  "state.empty.title": "No grounded data yet",
  "state.empty.body":
    "No grounded data yet for this region/period — run an EE compute to populate real values.",
  "state.error.title": "Something went wrong",
  "state.retry": "Retry",
  "state.notConfigured.title": "Backend not configured",
  "state.notConfigured.body":
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env to load data.",

  // Validation envelope
  "env.title": "Validation envelope",
  "env.metric": "Metric",
  "env.value": "Value",
  "env.unit": "Unit",
  "env.source": "Source",
  "env.date": "Date",
  "env.methodology": "Methodology",
  "env.confidence": "Confidence",
  "env.explanation": "Explanation",
  "env.noConfidence": "Confidence unavailable",
  "env.demoFlag": "Illustrative demo — not a real EO observation",
  "env.trigger": "Validation information",

  // National page
  "national.title": "National Command Center",
  "national.subtitle":
    "Groundwater-stress estimates and key Earth Observation indicators for Jordan's monitored basins.",
  "national.azraqHeadline": "Azraq Basin — groundwater stress",
  "national.viewMap": "Open Jordan map",
  "national.viewAzraq": "Open Azraq intelligence",

  // Map page
  "map.title": "Jordan Monitoring Map",
  "map.subtitle": "Select a region to view its latest indicators and groundwater-stress estimate.",
  "map.selectPrompt": "Click a region on the map to inspect it.",
  "map.panel.indicators": "Latest indicators",
  "map.panel.risk": "Groundwater stress",

  // Azraq page
  "azraq.title": "Azraq Basin Intelligence",
  "azraq.subtitle": "~12,800 km² · NE Jordan · RAMSAR wetland site",
  "azraq.lastUpdated": "Last updated",
  "azraq.subindices": "Sub-index breakdown",
  "azraq.subindices.note":
    "The groundwater-stress index is a weighted sum of five EO-proxy sub-indices (docs/08).",
  "azraq.indicators": "Key indicators",
  "azraq.trends": "Trends",
  "azraq.runAnalysis": "Run analysis",
  "azraq.running": "Running…",
  "azraq.runHint":
    "Recompute the groundwater-stress index from stored components (analyst role required).",
  "azraq.balance": "Water balance",
  "azraq.balance.note":
    "These are EO-proxy estimates, not direct measurements of groundwater levels.",

  // Login
  "login.title": "Sign in to MIZAN",
  "login.subtitle": "Public data is readable without an account. Sign in for analyst actions.",
  "login.email": "Email",
  "login.password": "Password",
  "login.signin": "Sign in",
  "login.signup": "Create account",
  "login.toggleToSignup": "Need an account? Create one",
  "login.toggleToSignin": "Have an account? Sign in",
  "login.working": "Please wait…",
  "login.checkEmail": "Account created. Check your email if confirmation is required, then sign in.",
};

/** Translate a dotted key. Falls back to the key itself if missing. */
export function t(key: string): string {
  return en[key] ?? key;
}
