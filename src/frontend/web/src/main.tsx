import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import "./styles.css";

type DashboardSummary = {
  activityCountLast7Days: number;
  acuteLoad: number;
  chronicLoad: number;
  acwr: number;
  vitalityPointsThisWeek: number;
  averageStepsLast7Days?: number;
  averageSleepHoursLast7Days?: number;
  latestBmi?: number;
  latestWeightKg?: number;
  latestWeightCategory?: string;
  activeMealPlans: number;
  activeDiscounts: number;
};

type GarminStatus = {
  configured: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
  credentialsUpdatedAt?: string;
  activitiesDatabaseExists: boolean;
  activitiesDatabaseLastWriteUtc?: string;
  lastImportedAt?: string;
  recentRuns: Array<{
    id: string;
    provider: string;
    startedAt: string;
    finishedAt?: string;
    status: string;
    importedCount: number;
    error?: string;
  }>;
};

type ActivityItem = {
  id: string;
  source: string;
  type: string;
  name?: string;
  startTime: string;
  durationMinutes: number;
  distanceKm?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  loadScore: number;
};

type ActivityDailyTrendPoint = {
  day: string;
  count: number;
  durationMinutes: number;
  load: number;
};

type DailyStepsTrendPoint = {
  day: string;
  totalSteps: number;
  distanceKm?: number;
  activeKilocalories?: number;
};

type SleepDailyTrendPoint = {
  day: string;
  sleepHours: number;
  deepSleepHours: number;
  lightSleepHours: number;
  remSleepHours: number;
  awakeHours: number;
  sleepScore?: number;
};

type ActivityDetail = {
  id: string;
  source: string;
  externalId: string;
  name?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  distanceKm?: number;
  steps?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  loadScore?: number;
  type: string;
  routePoints?: Array<{ latitude: number; longitude: number }>;
  heartRateSamples?: Array<{ offsetSeconds: number; heartRate: number }>;
  raw: unknown;
};

type StravaSettings = {
  enabled: boolean;
  connected: boolean;
  updatedAt?: string;
};

type DailyStepsDetail = {
  id: string;
  source: string;
  day: string;
  totalSteps: number;
  distanceKm?: number;
  activeKilocalories?: number;
  raw: unknown;
};

type SleepDetail = {
  id: string;
  source: string;
  day: string;
  sleepHours: number;
  deepSleepHours: number;
  lightSleepHours: number;
  remSleepHours: number;
  awakeHours: number;
  sleepScore?: number;
  raw: unknown;
};

type ImportStatusResponse = {
  totals: {
    activities: number;
    stepDays: number;
    sleepDays: number;
    manualImports: number;
  };
  providers: Array<{
    provider: string;
    totalRuns: number;
    failedRuns: number;
    importedTotal: number;
    lastRunAt?: string;
    lastRunStatus?: string;
    lastRunImportedCount?: number;
    lastFailure?: string;
    lastImportedAt?: string;
  }>;
  recentFailures: Array<{
    id: string;
    provider: string;
    startedAt: string;
    finishedAt?: string;
    error?: string;
  }>;
  recentRuns: Array<{
    id: string;
    provider: string;
    startedAt: string;
    finishedAt?: string;
    status: string;
    importedCount: number;
    error?: string;
  }>;
};

type BodyMetricsTrendPoint = {
  day: string;
  weightKg: number;
  bmi: number;
  category: string;
};

type InsightItem = {
  key: string;
  title: string;
  status: string;
  message: string;
};

type DashboardInsights = {
  summary: DashboardSummary;
  recentActivities: ActivityItem[];
  activityDailyTrend: ActivityDailyTrendPoint[];
  dailyStepsTrend: DailyStepsTrendPoint[];
  sleepDailyTrend: SleepDailyTrendPoint[];
  bodyMetricsTrend: BodyMetricsTrendPoint[];
  insights: InsightItem[];
  generatedAt: string;
};

type BodyMetricEntry = {
  id: string;
  day: string;
  heightCm: number;
  weightKg: number;
  bmi: number;
  category: string;
  createdAt: string;
};

type VitalSignEntry = {
  id: string;
  measuredAt: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  createdAt: string;
};

type ShoppingListItem = {
  id: string;
  name: string;
  payloadJson: string;
  estimatedTotal: number;
  estimatedSavings: number;
  createdAt: string;
};

type ShoppingListLine = {
  ingredient: string;
  store: string;
  discounted: boolean;
  price: number;
  savings: number;
};

type MealPlan = {
  id: string;
  name: string;
  payloadJson: string;
  createdAt: string;
};

type TrainingPlan = {
  id: string;
  weekKey: string;
  payloadJson: string;
  createdAt: string;
};

type TrainingSession = {
  day: string;
  workout: string;
  durationMinutes: number;
  notes?: string;
};

type TrainingPlanPayload = {
  focus?: string;
  notes?: string;
  sessions: TrainingSession[];
};

type Recipe = {
  id: string;
  name: string;
  description?: string;
  ingredients: string[];
  steps: string[];
  prepMinutes?: number;
  cookMinutes?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type PlannerDay = {
  day: string;
  breakfastRecipeId?: string;
  lunchRecipeId?: string;
  dinnerRecipeId?: string;
  breakfastText?: string;
  lunchText?: string;
  dinnerText?: string;
};

type MealPlanPayload = {
  weekStart?: string;
  days: PlannerDay[];
};

type DiscountRecord = {
  id: string;
  storeName: string;
  itemName: string;
  originalPrice: number;
  discountedPrice: number;
  unit: string;
  validFrom: string;
  validTo: string;
  createdAt: string;
};

type WindowDays = 7 | 30 | 90;
type ActivitySort = "newest" | "oldest" | "load-high" | "duration-high";
type MealSlot = "breakfast" | "lunch" | "dinner";
type SettingsSectionId = "general" | "connections" | "imports" | "import-status";

type ThemeOption = {
  id: string;
  label: string;
  cssFile: string;
  isDefault?: boolean;
};

type ThemeManifest = {
  themes: ThemeOption[];
};

type ImportTemplate = {
  id: string;
  label: string;
  payloadType: string;
  payload: unknown;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const THEME_STORAGE_KEY = "health-hq-theme";
const THEME_LINK_ID = "theme-stylesheet";
const FALLBACK_THEMES: ThemeOption[] = [
  { id: "dark", label: "Dark", cssFile: "/themes/dark.css", isDefault: true },
  { id: "light", label: "Light", cssFile: "/themes/light.css" }
];

const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    id: "recipe-single",
    label: "Recipe (single)",
    payloadType: "recipe",
    payload: {
      id: "",
      name: "Greek Yogurt Berry Bowl",
      description: "Fast high-protein breakfast.",
      ingredients: ["Greek yogurt", "Mixed berries", "Chia seeds", "Honey"],
      steps: ["Add yogurt to a bowl.", "Top with berries and chia seeds.", "Drizzle honey and serve."],
      prepMinutes: 5,
      cookMinutes: 0,
      tags: ["breakfast", "high-protein"],
      createdAt: "0001-01-01T00:00:00+00:00",
      updatedAt: "0001-01-01T00:00:00+00:00"
    }
  },
  {
    id: "recipe-multiple",
    label: "Recipes (multiple)",
    payloadType: "recipes",
    payload: [
      {
        id: "",
        name: "Oatmeal Power Bowl",
        description: "Simple hot breakfast.",
        ingredients: ["Rolled oats", "Milk", "Banana", "Peanut butter"],
        steps: ["Cook oats with milk.", "Top with banana and peanut butter."],
        prepMinutes: 3,
        cookMinutes: 7,
        tags: ["breakfast"],
        createdAt: "0001-01-01T00:00:00+00:00",
        updatedAt: "0001-01-01T00:00:00+00:00"
      }
    ]
  },
  {
    id: "meal-plan",
    label: "Meal plan",
    payloadType: "meal-plan",
    payload: {
      id: "",
      name: "Weekday Plan",
      payloadJson: "{\"weekStart\":\"2026-06-15\",\"days\":[{\"day\":\"Monday\",\"breakfastText\":\"Yogurt bowl\",\"lunchText\":\"Chicken salad\",\"dinnerText\":\"Salmon and rice\"}]}",
      createdAt: "0001-01-01T00:00:00+00:00"
    }
  },
  {
    id: "discounts",
    label: "Discounts",
    payloadType: "discount",
    payload: [
      {
        id: "",
        storeName: "Market Basket",
        itemName: "Greek Yogurt",
        originalPrice: 5.49,
        discountedPrice: 3.99,
        unit: "32 oz",
        validFrom: "2026-06-16",
        validTo: "2026-06-23",
        createdAt: "0001-01-01T00:00:00+00:00"
      }
    ]
  },
  {
    id: "training-plan",
    label: "Training plan",
    payloadType: "training-plan",
    payload: {
      id: "",
      weekKey: "2026-W25",
      payloadJson: "{\"sessions\":[{\"day\":\"Monday\",\"workout\":\"Easy Run\",\"durationMinutes\":45}]}",
      createdAt: "0001-01-01T00:00:00+00:00"
    }
  }
];

const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  description: string;
}> = [
  { id: "general", label: "General", description: "Theme and interface preferences" },
  { id: "connections", label: "Connections", description: "Strava and Garmin providers" },
  { id: "imports", label: "Imports", description: "Manual JSON import tools" },
  { id: "import-status", label: "Import status", description: "Sync totals, runs, and failures" }
];

function resolveSettingsSection(hashValue: string): SettingsSectionId {
  const normalized = hashValue.replace("#", "").trim().toLowerCase();
  return SETTINGS_SECTIONS.some((section) => section.id === normalized as SettingsSectionId)
    ? (normalized as SettingsSectionId)
    : "general";
}

function resolveDefaultThemeId(themes: ThemeOption[]) {
  const defaultTheme = themes.find((theme) => theme.isDefault);
  return defaultTheme?.id ?? themes[0]?.id ?? "dark";
}

function getStoredThemeId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY);
}

function applyThemeStylesheet(cssFile: string) {
  if (typeof document === "undefined") {
    return;
  }

  let link = document.getElementById(THEME_LINK_ID);
  if (!link) {
    link = document.createElement("link");
    link.id = THEME_LINK_ID;
    link.setAttribute("rel", "stylesheet");
    document.head.appendChild(link);
  }

  link.setAttribute("href", cssFile);
}

function resolveActiveThemeId(themes: ThemeOption[]) {
  const storedThemeId = getStoredThemeId();
  if (storedThemeId && themes.some((theme) => theme.id === storedThemeId)) {
    return storedThemeId;
  }

  return resolveDefaultThemeId(themes);
}

function useFetch<T>(url: string) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!url) {
      setData(null);
      setError("Missing URL");
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    fetch(url)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Request failed (${r.status})`);
        }
        return r.json();
      })
      .then((json) => {
        if (mounted) {
          setData(json as T);
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(String(e));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [url]);

  return { data, loading, error };
}

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getTodayIsoDay() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentIsoWeekKey(referenceDate = new Date()) {
  const target = new Date(Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()));
  const dayNumber = target.getUTCDay() === 0 ? 7 : target.getUTCDay();
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getWeekdayLabel(referenceDate = new Date()) {
  return referenceDate.toLocaleDateString(undefined, { weekday: "long" });
}

function getNowLocalMinuteInput() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function parseShoppingLines(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as ShoppingListLine[];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const line = item as Record<string, unknown>;
        if (typeof line.ingredient !== "string" || typeof line.store !== "string") {
          return null;
        }

        return {
          ingredient: line.ingredient,
          store: line.store,
          discounted: Boolean(line.discounted),
          price: typeof line.price === "number" ? line.price : 0,
          savings: typeof line.savings === "number" ? line.savings : 0
        } satisfies ShoppingListLine;
      })
      .filter((line): line is ShoppingListLine => line !== null);
  } catch {
    return [] as ShoppingListLine[];
  }
}

function parseMealPlanPayload(payloadJson: string): MealPlanPayload {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { days: [] };
    }

    const root = parsed as Record<string, unknown>;
    const days = root.days;
    if (!Array.isArray(days)) {
      return { days: [] };
    }

    const normalizedDays = days
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const mealDay = item as Record<string, unknown>;
        if (typeof mealDay.day !== "string") {
          return null;
        }

        const readRecipeId = (key: string) => (typeof mealDay[key] === "string" ? String(mealDay[key]) : undefined);
        const readLegacyText = (key: string) => (typeof mealDay[key] === "string" ? String(mealDay[key]) : undefined);

        const normalized: PlannerDay = {
          day: mealDay.day,
          breakfastRecipeId: readRecipeId("breakfastRecipeId"),
          lunchRecipeId: readRecipeId("lunchRecipeId"),
          dinnerRecipeId: readRecipeId("dinnerRecipeId"),
          breakfastText: readLegacyText("breakfast"),
          lunchText: readLegacyText("lunch"),
          dinnerText: readLegacyText("dinner")
        };

        return normalized;
      })
      .filter((item): item is PlannerDay => Boolean(item));

    return {
      weekStart: typeof root.weekStart === "string" ? root.weekStart : undefined,
      days: normalizedDays
    };
  } catch {
    return { days: [] };
  }
}

function parseTrainingPlanPayload(payloadJson: string): TrainingPlanPayload {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { sessions: [] };
    }

    const root = parsed as Record<string, unknown>;
    const sessions = Array.isArray(root.sessions) ? root.sessions : [];

    const normalizedSessions: TrainingSession[] = [];
    sessions.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      const session = item as Record<string, unknown>;
      if (typeof session.day !== "string" || typeof session.workout !== "string") {
        return;
      }

      const durationValue = typeof session.durationMinutes === "number"
        ? session.durationMinutes
        : Number(session.durationMinutes);
      const durationMinutes = Number.isFinite(durationValue) ? Math.max(0, durationValue) : 0;

      normalizedSessions.push({
        day: session.day,
        workout: session.workout,
        durationMinutes: Math.round(durationMinutes),
        notes: typeof session.notes === "string" ? session.notes : undefined
      });
    });

    return {
      focus: typeof root.focus === "string" ? root.focus : undefined,
      notes: typeof root.notes === "string" ? root.notes : undefined,
      sessions: normalizedSessions
    };
  } catch {
    return { sessions: [] };
  }
}

function serializeTrainingPlanPayload(payload: TrainingPlanPayload) {
  const normalizedPayload: TrainingPlanPayload = {
    focus: payload.focus?.trim() ? payload.focus.trim() : undefined,
    notes: payload.notes?.trim() ? payload.notes.trim() : undefined,
    sessions: payload.sessions.map((session) => ({
      day: session.day.trim(),
      workout: session.workout.trim(),
      durationMinutes: Math.max(0, Math.round(session.durationMinutes)),
      notes: session.notes?.trim() ? session.notes.trim() : undefined
    }))
  };

  return JSON.stringify(normalizedPayload);
}

function getTrainingSessionCount(plan: TrainingPlan) {
  return parseTrainingPlanPayload(plan.payloadJson).sessions.length;
}

function serializeMealPlanPayload(payload: MealPlanPayload) {
  return JSON.stringify({
    weekStart: payload.weekStart,
    days: payload.days.map((day) => ({
      day: day.day,
      breakfastRecipeId: day.breakfastRecipeId,
      lunchRecipeId: day.lunchRecipeId,
      dinnerRecipeId: day.dinnerRecipeId,
      breakfast: day.breakfastText,
      lunch: day.lunchText,
      dinner: day.dinnerText
    }))
  });
}

function getDefaultWeekDays() {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ({ day })) as PlannerDay[];
}

const SLOT_LABELS: Array<{ key: MealSlot; label: string }> = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" }
];

function getRecipeIdBySlot(day: PlannerDay, slot: MealSlot) {
  if (slot === "breakfast") {
    return day.breakfastRecipeId;
  }
  if (slot === "lunch") {
    return day.lunchRecipeId;
  }
  return day.dinnerRecipeId;
}

function getLegacyTextBySlot(day: PlannerDay, slot: MealSlot) {
  if (slot === "breakfast") {
    return day.breakfastText;
  }
  if (slot === "lunch") {
    return day.lunchText;
  }
  return day.dinnerText;
}

function setSlotRecipe(day: PlannerDay, slot: MealSlot, recipeId?: string): PlannerDay {
  if (slot === "breakfast") {
    return { ...day, breakfastRecipeId: recipeId, breakfastText: recipeId ? undefined : day.breakfastText };
  }
  if (slot === "lunch") {
    return { ...day, lunchRecipeId: recipeId, lunchText: recipeId ? undefined : day.lunchText };
  }
  return { ...day, dinnerRecipeId: recipeId, dinnerText: recipeId ? undefined : day.dinnerText };
}

function ActivityBars({ points }: { points: ActivityDailyTrendPoint[] }) {
  if (points.length === 0) {
    return <p className="empty">No activity trend data yet.</p>;
  }

  const chartHeight = 170;
  const chartWidth = Math.max(360, points.length * 28);
  const topPad = 10;
  const barBase = 142;
  const maxLoad = Math.max(...points.map((point) => point.load), 1);
  const gap = 8;
  const barWidth = Math.max(6, Math.floor((chartWidth - gap * (points.length - 1)) / points.length));

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Activity load over time">
        <line x1={0} y1={barBase + 6} x2={chartWidth} y2={barBase + 6} className="chart-axis" />
        {points.map((point, index) => {
          const x = index * (barWidth + gap);
          const barHeight = Math.max(3, Math.round((point.load / maxLoad) * (barBase - topPad)));
          const y = barBase - barHeight;
          const isLabelPoint = index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2);

          return (
            <g key={`${point.day}-${index}`}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} className="bar-load" />
              {isLabelPoint ? (
                <text x={x + barWidth / 2} y={chartHeight - 6} textAnchor="middle" className="chart-label">
                  {formatDay(point.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StepsBars({ points }: { points: DailyStepsTrendPoint[] }) {
  if (points.length === 0) {
    return <p className="empty">No steps data yet.</p>;
  }

  const chartHeight = 170;
  const chartWidth = Math.max(360, points.length * 28);
  const topPad = 10;
  const barBase = 142;
  const maxSteps = Math.max(...points.map((point) => point.totalSteps), 1);
  const gap = 8;
  const barWidth = Math.max(6, Math.floor((chartWidth - gap * (points.length - 1)) / points.length));

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Daily steps over time">
        <line x1={0} y1={barBase + 6} x2={chartWidth} y2={barBase + 6} className="chart-axis" />
        {points.map((point, index) => {
          const x = index * (barWidth + gap);
          const barHeight = Math.max(3, Math.round((point.totalSteps / maxSteps) * (barBase - topPad)));
          const y = barBase - barHeight;
          const isLabelPoint = index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2);

          return (
            <g key={`${point.day}-${index}`}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} className="bar-load" />
              {isLabelPoint ? (
                <text x={x + barWidth / 2} y={chartHeight - 6} textAnchor="middle" className="chart-label">
                  {formatDay(point.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SleepBars({ points }: { points: SleepDailyTrendPoint[] }) {
  if (points.length === 0) {
    return <p className="empty">No sleep data yet.</p>;
  }

  const chartHeight = 170;
  const chartWidth = Math.max(360, points.length * 28);
  const topPad = 10;
  const barBase = 142;
  const maxSleepHours = Math.max(...points.map((point) => point.sleepHours), 1);
  const gap = 8;
  const barWidth = Math.max(6, Math.floor((chartWidth - gap * (points.length - 1)) / points.length));

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Sleep duration over time">
        <line x1={0} y1={barBase + 6} x2={chartWidth} y2={barBase + 6} className="chart-axis" />
        {points.map((point, index) => {
          const x = index * (barWidth + gap);
          const barHeight = Math.max(3, Math.round((point.sleepHours / maxSleepHours) * (barBase - topPad)));
          const y = barBase - barHeight;
          const isLabelPoint = index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2);

          return (
            <g key={`${point.day}-${index}`}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} className="bar-load" />
              {isLabelPoint ? (
                <text x={x + barWidth / 2} y={chartHeight - 6} textAnchor="middle" className="chart-label">
                  {formatDay(point.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BodyTrendLines({ points }: { points: BodyMetricsTrendPoint[] }) {
  if (points.length < 2) {
    return <p className="empty">Add at least two body entries to see trend lines.</p>;
  }

  const ordered = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const width = Math.max(360, ordered.length * 54);
  const height = 190;
  const pad = 24;
  const minY = pad;
  const maxY = height - 38;
  const minWeight = Math.min(...ordered.map((point) => point.weightKg));
  const maxWeight = Math.max(...ordered.map((point) => point.weightKg));
  const minBmi = Math.min(...ordered.map((point) => point.bmi));
  const maxBmi = Math.max(...ordered.map((point) => point.bmi));
  const xStep = ordered.length > 1 ? (width - pad * 2) / (ordered.length - 1) : 1;

  const normalize = (value: number, min: number, max: number) => {
    if (max - min < 0.001) {
      return (minY + maxY) / 2;
    }
    return maxY - ((value - min) / (max - min)) * (maxY - minY);
  };

  const weightPath = ordered
    .map((point, index) => `${index === 0 ? "M" : "L"}${pad + xStep * index},${normalize(point.weightKg, minWeight, maxWeight)}`)
    .join(" ");

  const bmiPath = ordered
    .map((point, index) => `${index === 0 ? "M" : "L"}${pad + xStep * index},${normalize(point.bmi, minBmi, maxBmi)}`)
    .join(" ");

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weight and BMI trends">
        <line x1={pad} y1={maxY} x2={width - pad} y2={maxY} className="chart-axis" />
        <path d={weightPath} className="line-weight" />
        <path d={bmiPath} className="line-bmi" />
        {ordered.map((point, index) => {
          const x = pad + xStep * index;
          const yWeight = normalize(point.weightKg, minWeight, maxWeight);
          const yBmi = normalize(point.bmi, minBmi, maxBmi);
          const isLabelPoint = index === 0 || index === ordered.length - 1;
          return (
            <g key={`${point.day}-${index}`}>
              <circle cx={x} cy={yWeight} r={3.5} className="dot-weight" />
              <circle cx={x} cy={yBmi} r={3.5} className="dot-bmi" />
              {isLabelPoint ? (
                <text x={x} y={height - 9} textAnchor="middle" className="chart-label">
                  {formatDay(point.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="legend">Weight (kg) and BMI shown as relative trend lines.</p>
    </div>
  );
}

function VitalTrendLines({ points }: { points: VitalSignEntry[] }) {
  if (points.length < 2) {
    return <p className="empty">Add at least two readings to see blood pressure trends.</p>;
  }

  const ordered = [...points].sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
  const width = Math.max(360, ordered.length * 46);
  const height = 192;
  const pad = 24;
  const minY = pad;
  const maxY = height - 38;
  const minPressure = Math.min(...ordered.map((point) => Math.min(point.systolic, point.diastolic)));
  const maxPressure = Math.max(...ordered.map((point) => Math.max(point.systolic, point.diastolic)));
  const minPulse = Math.min(...ordered.map((point) => point.pulse));
  const maxPulse = Math.max(...ordered.map((point) => point.pulse));
  const xStep = ordered.length > 1 ? (width - pad * 2) / (ordered.length - 1) : 1;

  const normalize = (value: number, min: number, max: number) => {
    if (max - min < 0.001) {
      return (minY + maxY) / 2;
    }
    return maxY - ((value - min) / (max - min)) * (maxY - minY);
  };

  const systolicPath = ordered
    .map((point, index) => `${index === 0 ? "M" : "L"}${pad + xStep * index},${normalize(point.systolic, minPressure, maxPressure)}`)
    .join(" ");

  const diastolicPath = ordered
    .map((point, index) => `${index === 0 ? "M" : "L"}${pad + xStep * index},${normalize(point.diastolic, minPressure, maxPressure)}`)
    .join(" ");

  const pulsePath = ordered
    .map((point, index) => `${index === 0 ? "M" : "L"}${pad + xStep * index},${normalize(point.pulse, minPulse, maxPulse)}`)
    .join(" ");

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Blood pressure and pulse trends">
        <line x1={pad} y1={maxY} x2={width - pad} y2={maxY} className="chart-axis" />
        <path d={systolicPath} className="line-systolic" />
        <path d={diastolicPath} className="line-diastolic" />
        <path d={pulsePath} className="line-pulse" />
        {ordered.map((point, index) => {
          const x = pad + xStep * index;
          const ySystolic = normalize(point.systolic, minPressure, maxPressure);
          const yDiastolic = normalize(point.diastolic, minPressure, maxPressure);
          const yPulse = normalize(point.pulse, minPulse, maxPulse);
          const isLabelPoint = index === 0 || index === ordered.length - 1;

          return (
            <g key={point.id}>
              <circle cx={x} cy={ySystolic} r={3.5} className="dot-systolic" />
              <circle cx={x} cy={yDiastolic} r={3.5} className="dot-diastolic" />
              <circle cx={x} cy={yPulse} r={3.2} className="dot-pulse" />
              {isLabelPoint ? (
                <text x={x} y={height - 9} textAnchor="middle" className="chart-label">
                  {new Date(point.measuredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="legend">Systolic, diastolic (mmHg), and pulse (bpm) shown as trend lines.</p>
    </div>
  );
}

function HeartRateLineChart({ samples }: { samples: Array<{ offsetSeconds: number; heartRate: number }> }) {
  if (samples.length < 2) {
    return <p className="empty">Heart rate stream is not available for this activity.</p>;
  }

  const ordered = [...samples].sort((a, b) => a.offsetSeconds - b.offsetSeconds);
  const width = Math.max(380, ordered.length * 8);
  const height = 200;
  const pad = 24;
  const minY = pad;
  const maxY = height - 32;
  const minHr = Math.min(...ordered.map((point) => point.heartRate));
  const maxHr = Math.max(...ordered.map((point) => point.heartRate));
  const totalSeconds = Math.max(ordered[ordered.length - 1].offsetSeconds, 1);
  const xFor = (offsetSeconds: number) => pad + ((width - pad * 2) * offsetSeconds) / totalSeconds;
  const yFor = (heartRate: number) => {
    if (Math.abs(maxHr - minHr) < 0.001) {
      return (minY + maxY) / 2;
    }
    return maxY - ((heartRate - minHr) / (maxHr - minHr)) * (maxY - minY);
  };

  const path = ordered.map((point, index) => `${index === 0 ? "M" : "L"}${xFor(point.offsetSeconds)},${yFor(point.heartRate)}`).join(" ");
  const checkpoints = [0, Math.round(totalSeconds / 2), totalSeconds];

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Heart rate during activity">
        <line x1={pad} y1={maxY} x2={width - pad} y2={maxY} className="chart-axis" />
        <path d={path} className="line-pulse" />
        {checkpoints.map((offsetSeconds) => (
          <text key={offsetSeconds} x={xFor(offsetSeconds)} y={height - 10} textAnchor="middle" className="chart-label">
            {formatDurationLabel(offsetSeconds)}
          </text>
        ))}
      </svg>
      <p className="legend">{minHr} to {maxHr} bpm across the session.</p>
    </div>
  );
}

function RouteMap({ points }: { points: Array<{ latitude: number; longitude: number }> }) {
  if (points.length < 2) {
    return <p className="empty">Map is not available for this activity.</p>;
  }

  const width = 480;
  const height = 260;
  const pad = 16;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lngRange = Math.max(maxLng - minLng, 0.0001);

  const project = (latitude: number, longitude: number) => {
    const x = pad + ((longitude - minLng) / lngRange) * (width - pad * 2);
    const y = height - pad - ((latitude - minLat) / latRange) * (height - pad * 2);
    return `${x},${y}`;
  };

  const line = points.map((point) => project(point.latitude, point.longitude)).join(" ");
  const start = project(points[0].latitude, points[0].longitude).split(",");
  const finish = project(points[points.length - 1].latitude, points[points.length - 1].longitude).split(",");

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Activity route map">
        <rect x={0} y={0} width={width} height={height} className="map-bg" />
        <polyline points={line} className="route-line" />
        <circle cx={start[0]} cy={start[1]} r={5} className="route-start" />
        <circle cx={finish[0]} cy={finish[1]} r={5} className="route-finish" />
      </svg>
      <p className="legend">Start and finish shown with markers.</p>
    </div>
  );
}

function formatDurationLabel(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDurationMinutes(totalMinutes: number, allowDays = false) {
  const minutes = Math.max(0, Math.round(totalMinutes));

  if (allowDays && minutes >= 24 * 60) {
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

function sourceAllowsRouteMap(source: string) {
  return source.toLowerCase() === "strava" || source.toLowerCase() === "garmin";
}

function Shell({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <header className="topbar">
        <h1>Health HQ</h1>
        <div className="topbar-actions">
          <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/activities">Activities</Link>
            <Link to="/sleep">Sleep</Link>
            <Link to="/training">Training</Link>
            <Link to="/settings">Settings</Link>
            <Link to="/shopping">Shopping</Link>
            <Link to="/body">Body</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function DashboardPage() {
  const { data, loading, error } = useFetch<DashboardInsights>("/api/dashboard/insights");
  const { data: trainingPlansData, loading: trainingPlansLoading } = useFetch<TrainingPlan[]>("/api/training/plans");
  const [windowDays, setWindowDays] = React.useState<WindowDays>(7);
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");

  if (loading) return <p>Loading dashboard insights...</p>;
  if (error || !data) return <p>Could not load dashboard insights.</p>;

  const cutoff = Date.now() - (windowDays - 1) * DAY_MS;

  const byWindow = data.recentActivities.filter((item) => new Date(item.startTime).getTime() >= cutoff);
  const availableSources = Array.from(new Set(byWindow.map((item) => item.source))).sort((a, b) => a.localeCompare(b));
  const availableTypes = Array.from(new Set(byWindow.map((item) => item.type))).sort((a, b) => a.localeCompare(b));

  const filteredActivities = byWindow
    .filter((item) => (sourceFilter === "all" ? true : item.source === sourceFilter))
    .filter((item) => (typeFilter === "all" ? true : item.type === typeFilter));

  const trendPoints = data.activityDailyTrend.filter((point) => new Date(`${point.day}T00:00:00Z`).getTime() >= cutoff);
  const stepsTrendPoints = data.dailyStepsTrend.filter((point) => new Date(`${point.day}T00:00:00Z`).getTime() >= cutoff);
  const sleepTrendPoints = data.sleepDailyTrend.filter((point) => new Date(`${point.day}T00:00:00Z`).getTime() >= cutoff);
  const stepsByRecentDay = [...stepsTrendPoints].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14);
  const sleepByRecentDay = [...sleepTrendPoints].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14);
  const bodyTrendPoints = data.bodyMetricsTrend.filter(
    (point) => new Date(`${point.day}T00:00:00Z`).getTime() >= Date.now() - 90 * DAY_MS
  );
  const currentWeekKey = getCurrentIsoWeekKey();
  const orderedTrainingPlans = [...(trainingPlansData ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const selectedTrainingPlan = orderedTrainingPlans.find((plan) => plan.weekKey === currentWeekKey) ?? orderedTrainingPlans[0];
  const selectedTrainingPayload = selectedTrainingPlan ? parseTrainingPlanPayload(selectedTrainingPlan.payloadJson) : null;
  const previewSession = selectedTrainingPayload?.sessions[0];

  const cards: Array<{ title: string; value: string; hint: string }> = [
    {
      title: "Activities (7d)",
      value: String(data.summary.activityCountLast7Days),
      hint: `${windowDays}d view has ${filteredActivities.length}`
    },
    {
      title: "ACWR",
      value: data.summary.acwr.toFixed(2),
      hint: `Acute ${data.summary.acuteLoad.toFixed(1)} / Chronic ${data.summary.chronicLoad.toFixed(1)}`
    },
    {
      title: "Avg steps (7d)",
      value: data.summary.averageStepsLast7Days ? data.summary.averageStepsLast7Days.toLocaleString() : "-",
      hint: "Daily average"
    },
    {
      title: "Avg sleep (7d)",
      value: data.summary.averageSleepHoursLast7Days ? `${data.summary.averageSleepHoursLast7Days.toFixed(1)} h` : "-",
      hint: "Nightly average"
    },
    {
      title: "Weight",
      value: data.summary.latestWeightKg ? `${data.summary.latestWeightKg.toFixed(1)} kg` : "-",
      hint: data.summary.latestWeightCategory ?? "No category yet"
    },
    {
      title: "BMI",
      value: data.summary.latestBmi ? data.summary.latestBmi.toFixed(2) : "-",
      hint: "Latest check-in"
    },
    {
      title: "Vitality points",
      value: String(data.summary.vitalityPointsThisWeek),
      hint: "This week"
    },
    {
      title: "Active discounts",
      value: String(data.summary.activeDiscounts),
      hint: `${data.summary.activeMealPlans} meal plans ready`
    }
  ];

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Interactive dashboard</p>
          <h2>Training and body insights</h2>
        </div>
        <p className="muted">Updated {formatDateTime(data.generatedAt)}</p>
      </header>

      <div className="grid cards-grid">
        {cards.map((card) => (
          <article className="card" key={card.title}>
            <h3>{card.title}</h3>
            <p className="value">{card.value}</p>
            <p className="hint">{card.hint}</p>
          </article>
        ))}
      </div>

      <section className="panel controls">
        <div className="chip-row">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              className={`chip ${windowDays === days ? "chip-active" : ""}`}
              onClick={() => setWindowDays(days as WindowDays)}
            >
              {days} days
            </button>
          ))}
        </div>
        <div className="filter-row">
          <label>
            Source
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="all">All sources</option>
              {availableSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <label>
            Activity type
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {availableTypes.map((activityType) => (
                <option key={activityType} value={activityType}>
                  {activityType}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid dashboard-grid">
        <article className="panel">
          <h3>Daily activity load</h3>
          <ActivityBars points={trendPoints} />
        </article>

        <article className="panel">
          <h3>Daily steps</h3>
          <StepsBars points={stepsTrendPoints} />
        </article>

        <article className="panel">
          <h3>Sleep duration</h3>
          <SleepBars points={sleepTrendPoints} />
        </article>

        <article className="panel">
          <h3>Insight callouts</h3>
          <div className="insight-stack">
            {data.insights.map((insight) => (
              <div className="insight" key={insight.key}>
                <p className={`badge badge-${insight.status.replace(/\s+/g, "-")}`}>{insight.status}</p>
                <h4>{insight.title}</h4>
                <p>{insight.message}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="panel">
        <h3>Weight and BMI trend</h3>
        <BodyTrendLines points={bodyTrendPoints} />
      </article>

      <article className="panel training-snapshot">
        <h3>Training plan snapshot</h3>
        {trainingPlansLoading ? <p className="muted">Loading training plans...</p> : null}
        {!trainingPlansLoading && !selectedTrainingPlan ? (
          <div className="stack">
            <p className="empty">No training plans yet. Create your first week to start planning.</p>
            <Link className="button" to="/training">Open training planner</Link>
          </div>
        ) : null}
        {!trainingPlansLoading && selectedTrainingPlan ? (
          <div className="stack">
            <p>
              Week <strong>{selectedTrainingPlan.weekKey}</strong> with {selectedTrainingPayload?.sessions.length ?? 0} session(s).
            </p>
            {previewSession ? (
              <p className="muted">
                Next: {previewSession.day} - {previewSession.workout} ({formatDurationMinutes(previewSession.durationMinutes)})
              </p>
            ) : (
              <p className="muted">No sessions added yet.</p>
            )}
            <Link className="button" to="/training">Edit training plan</Link>
          </div>
        ) : null}
      </article>

      <div className="grid dashboard-grid">
        <article className="panel stack">
          <h3>Activities hub</h3>
          <p className="muted">Deep-dive into activity filters, load trends, and all recent sessions.</p>
          <p>{filteredActivities.length} activities match current filters in the last {windowDays} days.</p>
          <Link className="button" to="/activities">Open activities hub</Link>
        </article>

        <article className="panel stack">
          <h3>Sleep hub</h3>
          <p className="muted">Track nightly quality metrics, trends, and sleep-stage balance in one place.</p>
          <p>{sleepByRecentDay.length} sleep days available in the current window.</p>
          <Link className="button" to="/sleep">Open sleep hub</Link>
        </article>
      </div>

      <article className="panel">
        <h3>Daily steps (recent)</h3>
        {stepsByRecentDay.length === 0 ? (
          <p className="empty">No daily steps to inspect.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Steps</th>
                  <th>Distance</th>
                  <th>Active kcal</th>
                </tr>
              </thead>
              <tbody>
                {stepsByRecentDay.map((entry) => (
                  <tr key={entry.day}>
                    <td>
                      <Link className="button" to={`/steps/${entry.day}`}>
                        {formatDay(entry.day)}
                      </Link>
                    </td>
                    <td>{entry.totalSteps.toLocaleString()}</td>
                    <td>{entry.distanceKm ? `${entry.distanceKm.toFixed(2)} km` : "-"}</td>
                    <td>{entry.activeKilocalories ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

function ActivitiesHubPage() {
  const { data, loading, error } = useFetch<DashboardInsights>("/api/dashboard/insights");
  const [windowDays, setWindowDays] = React.useState<WindowDays>(30);
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [sort, setSort] = React.useState<ActivitySort>("newest");

  if (loading) return <p>Loading activities...</p>;
  if (error || !data) return <p>Could not load activities.</p>;

  const cutoff = Date.now() - (windowDays - 1) * DAY_MS;
  const byWindow = data.recentActivities.filter((item) => new Date(item.startTime).getTime() >= cutoff);
  const availableSources = Array.from(new Set(byWindow.map((item) => item.source))).sort((a, b) => a.localeCompare(b));
  const availableTypes = Array.from(new Set(byWindow.map((item) => item.type))).sort((a, b) => a.localeCompare(b));

  const filteredActivities = byWindow
    .filter((item) => (sourceFilter === "all" ? true : item.source === sourceFilter))
    .filter((item) => (typeFilter === "all" ? true : item.type === typeFilter));

  const sortedActivities = [...filteredActivities].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      case "load-high":
        return b.loadScore - a.loadScore;
      case "duration-high":
        return b.durationMinutes - a.durationMinutes;
      case "newest":
      default:
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    }
  });

  const trendPoints = data.activityDailyTrend.filter((point) => new Date(`${point.day}T00:00:00Z`).getTime() >= cutoff);
  const totalDuration = sortedActivities.reduce((sum, activity) => sum + activity.durationMinutes, 0);
  const avgLoad = sortedActivities.length === 0 ? 0 : sortedActivities.reduce((sum, activity) => sum + activity.loadScore, 0) / sortedActivities.length;
  const avgHeartRateValues = sortedActivities
    .map((activity) => activity.averageHeartRate)
    .filter((value): value is number => typeof value === "number");
  const avgHeartRate = avgHeartRateValues.length === 0 ? null : Math.round(avgHeartRateValues.reduce((sum, value) => sum + value, 0) / avgHeartRateValues.length);

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Activities</p>
          <h2>Activities hub</h2>
          <p className="muted">Filter and inspect training sessions by source, type, load, and time.</p>
        </div>
        <Link className="button" to="/activities">Back to activities</Link>
      </header>

      <div className="grid cards-grid">
        <article className="card">
          <h3>Sessions</h3>
          <p className="value">{sortedActivities.length}</p>
          <p className="hint">{windowDays}-day window</p>
        </article>
        <article className="card">
          <h3>Total duration</h3>
          <p className="value">{formatDurationMinutes(totalDuration, true)}</p>
          <p className="hint">Filtered sessions</p>
        </article>
        <article className="card">
          <h3>Avg load</h3>
          <p className="value">{avgLoad.toFixed(1)}</p>
          <p className="hint">Across visible sessions</p>
        </article>
        <article className="card">
          <h3>Avg heart rate</h3>
          <p className="value">{avgHeartRate == null ? "-" : `${avgHeartRate} bpm`}</p>
          <p className="hint">Only sessions with HR data</p>
        </article>
      </div>

      <section className="panel controls">
        <div className="chip-row">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              className={`chip ${windowDays === days ? "chip-active" : ""}`}
              onClick={() => setWindowDays(days as WindowDays)}
            >
              {days} days
            </button>
          ))}
        </div>
        <div className="filter-row">
          <label>
            Source
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="all">All sources</option>
              {availableSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <label>
            Activity type
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {availableTypes.map((activityType) => (
                <option key={activityType} value={activityType}>
                  {activityType}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as ActivitySort)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="load-high">Highest load</option>
              <option value="duration-high">Longest duration</option>
            </select>
          </label>
        </div>
      </section>

      <article className="panel">
        <h3>Daily activity load</h3>
        <ActivityBars points={trendPoints} />
      </article>

      <article className="panel">
        <h3>Recent activities</h3>
        {sortedActivities.length === 0 ? (
          <p className="empty">No activities match the current filters.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Duration</th>
                  <th>Distance</th>
                  <th>Avg HR</th>
                  <th>Load</th>
                </tr>
              </thead>
              <tbody>
                {sortedActivities.map((activity) => (
                  <tr key={activity.id}>
                    <td>
                      <Link className="button" to={`/activity/${activity.id}`}>
                        {formatDateTime(activity.startTime)}
                      </Link>
                    </td>
                    <td>{activity.name ?? "-"}</td>
                    <td>{activity.type}</td>
                    <td>{activity.source}</td>
                    <td>{formatDurationMinutes(activity.durationMinutes)}</td>
                    <td>{activity.distanceKm ? `${activity.distanceKm.toFixed(2)} km` : "-"}</td>
                    <td>{activity.averageHeartRate ?? "-"}</td>
                    <td>{activity.loadScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

function SleepHubPage() {
  const { data, loading, error } = useFetch<DashboardInsights>("/api/dashboard/insights");
  const [windowDays, setWindowDays] = React.useState<WindowDays>(30);

  if (loading) return <p>Loading sleep data...</p>;
  if (error || !data) return <p>Could not load sleep data.</p>;

  const cutoff = Date.now() - (windowDays - 1) * DAY_MS;
  const sleepTrendPoints = data.sleepDailyTrend
    .filter((point) => new Date(`${point.day}T00:00:00Z`).getTime() >= cutoff)
    .sort((a, b) => a.day.localeCompare(b.day));
  const sleepByRecentDay = [...sleepTrendPoints].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 21);

  const totalSleep = sleepTrendPoints.reduce((sum, point) => sum + point.sleepHours, 0);
  const totalAwake = sleepTrendPoints.reduce((sum, point) => sum + point.awakeHours, 0);
  const totalDeep = sleepTrendPoints.reduce((sum, point) => sum + point.deepSleepHours, 0);
  const totalRem = sleepTrendPoints.reduce((sum, point) => sum + point.remSleepHours, 0);
  const nights = sleepTrendPoints.length;
  const avgSleepHours = nights === 0 ? 0 : totalSleep / nights;
  const efficiency = totalSleep + totalAwake <= 0 ? 0 : (totalSleep / (totalSleep + totalAwake)) * 100;
  const restorativePct = totalSleep <= 0 ? 0 : ((totalDeep + totalRem) / totalSleep) * 100;
  const targetHours = 7.5;
  const debtHours = sleepTrendPoints.reduce((sum, point) => sum + Math.max(0, targetHours - point.sleepHours), 0);
  const variance =
    nights <= 1
      ? 0
      : sleepTrendPoints.reduce((sum, point) => sum + Math.pow(point.sleepHours - avgSleepHours, 2), 0) / (nights - 1);
  const stdDev = Math.sqrt(Math.max(variance, 0));

  const latestThree = sleepTrendPoints.slice(-3);
  const priorSeven = sleepTrendPoints.slice(Math.max(0, sleepTrendPoints.length - 10), Math.max(0, sleepTrendPoints.length - 3));
  const latestThreeAvg = latestThree.length === 0 ? 0 : latestThree.reduce((sum, point) => sum + point.sleepHours, 0) / latestThree.length;
  const priorSevenAvg = priorSeven.length === 0 ? 0 : priorSeven.reduce((sum, point) => sum + point.sleepHours, 0) / priorSeven.length;
  const trendLabel =
    priorSeven.length === 0
      ? "Not enough history"
      : latestThreeAvg > priorSevenAvg + 0.25
        ? "Improving"
        : latestThreeAvg < priorSevenAvg - 0.25
          ? "Declining"
          : "Holding steady";

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Sleep</p>
          <h2>Sleep hub</h2>
          <p className="muted">Monitor duration, stage balance, and recovery signals over time.</p>
        </div>
        <Link className="button" to="/sleep">Back to sleep hub</Link>
      </header>

      <section className="panel controls">
        <div className="chip-row">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              className={`chip ${windowDays === days ? "chip-active" : ""}`}
              onClick={() => setWindowDays(days as WindowDays)}
            >
              {days} days
            </button>
          ))}
        </div>
      </section>

      <div className="grid cards-grid">
        <article className="card">
          <h3>Avg sleep</h3>
          <p className="value">{avgSleepHours.toFixed(2)} h</p>
          <p className="hint">Per night in selected window</p>
        </article>
        <article className="card">
          <h3>Sleep efficiency</h3>
          <p className="value">{efficiency.toFixed(0)}%</p>
          <p className="hint">Sleep vs awake time in bed</p>
        </article>
        <article className="card">
          <h3>Restorative share</h3>
          <p className="value">{restorativePct.toFixed(0)}%</p>
          <p className="hint">Deep + REM proportion</p>
        </article>
        <article className="card">
          <h3>Sleep debt</h3>
          <p className="value">{debtHours.toFixed(1)} h</p>
          <p className="hint">Gap to 7.5h nightly target</p>
        </article>
        <article className="card">
          <h3>Consistency</h3>
          <p className="value">±{stdDev.toFixed(2)} h</p>
          <p className="hint">Night-to-night variability</p>
        </article>
        <article className="card">
          <h3>Trend</h3>
          <p className="value">{trendLabel}</p>
          <p className="hint">Last 3 nights vs prior 7</p>
        </article>
      </div>

      <article className="panel">
        <h3>Sleep duration</h3>
        <SleepBars points={sleepTrendPoints} />
      </article>

      <article className="panel">
        <h3>Sleep (recent)</h3>
        {sleepByRecentDay.length === 0 ? (
          <p className="empty">No sleep days to inspect.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Total</th>
                  <th>Deep</th>
                  <th>REM</th>
                  <th>Awake</th>
                </tr>
              </thead>
              <tbody>
                {sleepByRecentDay.map((entry) => (
                  <tr key={entry.day}>
                    <td>
                      <Link className="button" to={`/sleep/${entry.day}`}>
                        {formatDay(entry.day)}
                      </Link>
                    </td>
                    <td>{entry.sleepHours.toFixed(2)} h</td>
                    <td>{entry.deepSleepHours.toFixed(2)} h</td>
                    <td>{entry.remSleepHours.toFixed(2)} h</td>
                    <td>{entry.awakeHours.toFixed(2)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

function ActivityDetailPage() {
  const params = useParams<{ id: string }>();
  const activityId = params.id;
  const { data, loading, error } = useFetch<ActivityDetail>(activityId ? `/api/dashboard/activities/${activityId}` : "");

  if (!activityId) {
    return <p>Activity id is missing.</p>;
  }

  if (loading) return <p>Loading activity details...</p>;
  if (error || !data) return <p>Could not load activity details.</p>;

  const insightList = [
    data.durationMinutes >= 45 ? "Long duration effort" : "Shorter effort session",
    data.averageHeartRate && data.maxHeartRate
      ? `HR range ${data.averageHeartRate}-${data.maxHeartRate} bpm`
      : "Heart rate stream is limited",
    data.loadScore ? `Load score ${data.loadScore.toFixed(1)}` : "Load score unavailable"
  ];

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Activity details</p>
          <h2>{data.name ?? data.type}</h2>
          <p className="muted">{data.type} from {data.source}</p>
        </div>
        <Link className="button" to="/">Back to dashboard</Link>
      </header>

      <article className="panel">
        <p>
          {formatDateTime(data.startTime)} | {formatDurationMinutes(data.durationMinutes)} | Distance {data.distanceKm ? `${data.distanceKm.toFixed(2)} km` : "-"}
        </p>
        <p>
          Avg HR {data.averageHeartRate ?? "-"} | Max HR {data.maxHeartRate ?? "-"} | Load {data.loadScore?.toFixed(1) ?? "-"}
        </p>
      </article>

      <div className="grid dashboard-grid">
        <article className="panel">
          <h3>Heart rate graph</h3>
          <HeartRateLineChart samples={data.heartRateSamples ?? []} />
        </article>

        <article className="panel">
          <h3>Route map</h3>
          {sourceAllowsRouteMap(data.source) ? (
            <RouteMap points={data.routePoints ?? []} />
          ) : (
            <p className="empty">Map is only available for providers with coordinate streams.</p>
          )}
        </article>
      </div>

      <article className="panel">
        <h3>Insights</h3>
        <ul className="stack">
          {insightList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="panel">
        <h3>Raw payload</h3>
        <pre>{JSON.stringify(data.raw, null, 2)}</pre>
      </article>
    </section>
  );
}

function StepsDetailPage() {
  const params = useParams<{ day: string }>();
  const day = params.day;
  const { data, loading, error } = useFetch<DailyStepsDetail>(day ? `/api/dashboard/steps/${day}` : "");

  if (!day) {
    return <p>Day is missing.</p>;
  }

  if (loading) return <p>Loading steps details...</p>;
  if (error || !data) return <p>Could not load steps details.</p>;

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Daily steps detail</p>
          <h2>{formatDay(data.day)}</h2>
        </div>
        <Link className="button" to="/">Back to dashboard</Link>
      </header>

      <article className="panel">
        <p>
          Steps {data.totalSteps.toLocaleString()} | Distance {data.distanceKm ? `${data.distanceKm.toFixed(2)} km` : "-"} | Active kcal {data.activeKilocalories ?? "-"}
        </p>
      </article>

      <article className="panel">
        <h3>Raw payload</h3>
        <pre>{JSON.stringify(data.raw, null, 2)}</pre>
      </article>
    </section>
  );
}

function SleepDetailPage() {
  const params = useParams<{ day: string }>();
  const day = params.day;
  const { data, loading, error } = useFetch<SleepDetail>(day ? `/api/dashboard/sleep/${day}` : "");

  if (!day) {
    return <p>Day is missing.</p>;
  }

  if (loading) return <p>Loading sleep details...</p>;
  if (error || !data) return <p>Could not load sleep details.</p>;

  const total = Math.max(data.sleepHours, 0.1);
  const deepPct = Math.round((data.deepSleepHours / total) * 100);
  const lightPct = Math.round((data.lightSleepHours / total) * 100);
  const remPct = Math.round((data.remSleepHours / total) * 100);

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Sleep detail</p>
          <h2>{formatDay(data.day)}</h2>
        </div>
        <Link className="button" to="/">Back to dashboard</Link>
      </header>

      <article className="panel stack">
        <p>Total {data.sleepHours.toFixed(2)} h | Awake {data.awakeHours.toFixed(2)} h</p>
        <div className="sleep-stages">
          <div className="sleep-stage sleep-stage-deep" style={{ width: `${deepPct}%` }}>Deep {deepPct}%</div>
          <div className="sleep-stage sleep-stage-light" style={{ width: `${lightPct}%` }}>Light {lightPct}%</div>
          <div className="sleep-stage sleep-stage-rem" style={{ width: `${remPct}%` }}>REM {remPct}%</div>
        </div>
        <p className="muted">Deep {data.deepSleepHours.toFixed(2)}h | Light {data.lightSleepHours.toFixed(2)}h | REM {data.remSleepHours.toFixed(2)}h</p>
      </article>

      <article className="panel">
        <h3>Insights</h3>
        <ul className="stack">
          <li>{data.sleepHours >= 7 ? "Recovered sleep duration" : "Sleep duration below target"}</li>
          <li>{data.remSleepHours >= 1.2 ? "REM duration looks healthy" : "REM duration is on the low side"}</li>
          <li>{data.awakeHours <= 0.7 ? "Night awakenings were limited" : "Higher awake time overnight"}</li>
        </ul>
      </article>

      <article className="panel">
        <h3>Raw payload</h3>
        <pre>{JSON.stringify(data.raw, null, 2)}</pre>
      </article>
    </section>
  );
}

function ConnectionsPage() {
  const [stravaStatus, setStravaStatus] = React.useState<string>("idle");
  const [stravaSettings, setStravaSettings] = React.useState<StravaSettings | null>(null);
  const [stravaEnabled, setStravaEnabled] = React.useState(false);
  const [garminStatus, setGarminStatus] = React.useState<GarminStatus | null>(null);
  const [garminUsername, setGarminUsername] = React.useState("");
  const [garminPassword, setGarminPassword] = React.useState("");
  const [garminStartDate, setGarminStartDate] = React.useState("2020-01-01");
  const [garminMessage, setGarminMessage] = React.useState("");

  async function loadGarminStatus() {
    const res = await fetch("/api/ingestion/garmin/status");
    if (!res.ok) {
      return;
    }

    const json = (await res.json()) as GarminStatus;
    setGarminStatus(json);
  }

  async function loadStravaSettings() {
    const res = await fetch("/api/ingestion/strava/settings");
    if (!res.ok) {
      return;
    }

    const json = (await res.json()) as StravaSettings;
    setStravaSettings(json);
    setStravaEnabled(json.enabled);
    setStravaStatus(json.enabled ? (json.connected ? "connected" : "ready") : "disabled");
  }

  React.useEffect(() => {
    void loadGarminStatus();
    void loadStravaSettings();
  }, []);

  async function syncNow() {
    if (!stravaSettings?.enabled) {
      setStravaStatus("disabled");
      return;
    }

    setStravaStatus("syncing");
    const res = await fetch("/api/ingestion/strava/sync", { method: "POST" });
    setStravaStatus(res.ok ? "done" : "failed");
  }

  async function saveStravaSettings() {
    setStravaStatus("saving");
    const res = await fetch("/api/ingestion/strava/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: stravaEnabled })
    });

    if (!res.ok) {
      setStravaStatus("failed");
      return;
    }

    await loadStravaSettings();
    setStravaStatus(stravaEnabled ? "enabled" : "disabled");
  }

  async function saveGarminSettings(e: React.FormEvent) {
    e.preventDefault();
    setGarminMessage("Saving...");

    const payload = {
      username: garminUsername,
      password: garminPassword || null,
      startDate: garminStartDate,
      downloadLatestActivities: 25
    };

    const res = await fetch("/api/ingestion/garmin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setGarminPassword("");
      setGarminMessage("Garmin credentials saved.");
      await loadGarminStatus();
      return;
    }

    setGarminMessage("Could not save Garmin credentials.");
  }

  async function syncGarminNow() {
    setGarminMessage("Syncing Garmin import...");
    const res = await fetch("/api/ingestion/garmin/sync", { method: "POST" });
    if (res.ok) {
      setGarminMessage("Garmin import completed.");
      await loadGarminStatus();
      return;
    }

    setGarminMessage("Garmin import failed.");
  }

  async function backfillGarminHistory() {
    setGarminMessage("Backfilling Garmin history...");
    const res = await fetch("/api/ingestion/garmin/backfill", { method: "POST" });
    if (res.ok) {
      setGarminMessage("Garmin history backfill completed.");
      await loadGarminStatus();
      return;
    }

    setGarminMessage("Garmin history backfill failed.");
  }

  return (
    <section className="stack">
      <article className="connection-block stack">
        <div className="settings-pane-subheader">
          <h4>Strava</h4>
          <span className={`settings-status-pill ${stravaSettings?.enabled ? "settings-status-pill-ok" : ""}`}>
            {stravaSettings?.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <label>
          <input
            type="checkbox"
            checked={stravaEnabled}
            onChange={(event) => setStravaEnabled(event.target.checked)}
          />
          Enable Strava integration
        </label>
        <div className="connection-actions">
          <button className="button" onClick={saveStravaSettings}>Save Strava Setting</button>
          {stravaSettings?.enabled ? (
            <>
              <a className="button" href="/api/ingestion/strava/connect" target="_blank" rel="noreferrer">
                Connect Strava
              </a>
              <button className="button" onClick={syncNow}>Sync Now</button>
            </>
          ) : null}
        </div>
        <p className="connection-status">Status: {stravaStatus}{stravaSettings?.enabled ? "" : " (historical Strava data is hidden)"}</p>
      </article>

      <article className="connection-block stack">
        <div className="settings-pane-subheader">
          <h4>Garmin</h4>
          <span className={`settings-status-pill ${garminStatus?.configured ? "settings-status-pill-ok" : ""}`}>
            {garminStatus?.configured ? "Configured" : "Not configured"}
          </span>
        </div>
        <form className="stack" onSubmit={saveGarminSettings}>
          <label>
            Username
            <input
              value={garminUsername}
              onChange={(e) => setGarminUsername(e.target.value)}
              placeholder="Garmin username"
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={garminPassword}
              onChange={(e) => setGarminPassword(e.target.value)}
              placeholder="Enter to set or rotate"
              autoComplete="current-password"
            />
          </label>
          <label>
            Start date
            <input type="date" value={garminStartDate} onChange={(e) => setGarminStartDate(e.target.value)} />
          </label>
          <button className="button" type="submit">Save Garmin Credentials</button>
        </form>
        <div className="connection-actions">
          <button className="button" onClick={syncGarminNow}>Sync Garmin Import Now</button>
          <button className="button" onClick={backfillGarminHistory}>Backfill Garmin History</button>
        </div>
        {garminMessage ? <p className="connection-status">{garminMessage}</p> : null}
        <div className="stat-strip connection-stats">
          <p>
            Garmin configured: {garminStatus?.configured ? "yes" : "no"} | username stored: {garminStatus?.hasUsername ? "yes" : "no"} |
            password stored: {garminStatus?.hasPassword ? "yes" : "no"}
          </p>
          <p>
            Garmin DB present: {garminStatus?.activitiesDatabaseExists ? "yes" : "no"} | last import: {garminStatus?.lastImportedAt ?? "-"}
          </p>
        </div>
      </article>
    </section>
  );
}

function SettingsPage({
  themes,
  themeId,
  onThemeChange
}: {
  themes: ThemeOption[];
  themeId: string;
  onThemeChange: (nextThemeId: string) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = React.useState<SettingsSectionId>(() => resolveSettingsSection(location.hash));

  React.useEffect(() => {
    setActiveSection(resolveSettingsSection(location.hash));
  }, [location.hash]);

  function openSection(sectionId: SettingsSectionId) {
    if (sectionId === activeSection) {
      return;
    }

    navigate(`/settings#${sectionId}`);
  }

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">System</p>
          <h2>Settings</h2>
          <p className="muted">Manage app behavior, provider connections, and manual imports.</p>
        </div>
      </header>

      <div className="settings-layout">
        <aside className="panel stack settings-sidebar">
          <h3>Categories</h3>
          <div className="stack settings-nav-list">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`settings-nav-item ${activeSection === section.id ? "settings-nav-item-active" : ""}`}
                onClick={() => openSection(section.id)}
              >
                <strong>{section.label}</strong>
                <small>{section.description}</small>
              </button>
            ))}
          </div>
        </aside>

        <article className="panel stack settings-content-panel">
          {activeSection === "general" ? (
            <>
              <div className="settings-pane-header">
                <h3>General</h3>
                <p className="muted">Applies immediately and is stored for future sessions.</p>
              </div>
              <div className="connection-block stack settings-theme-panel">
                <h4>Theme</h4>
                <label htmlFor="theme-select">
                  Choose theme
                  <select
                    className="settings-theme-select"
                    id="theme-select"
                    value={themeId}
                    onChange={(event) => onThemeChange(event.target.value)}
                  >
                    {themes.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          ) : null}

          {activeSection === "connections" ? (
            <>
              <div className="settings-pane-header">
                <h3>Connections</h3>
                <p className="muted">Configure upstream providers and trigger sync runs.</p>
              </div>
              <ConnectionsPage />
            </>
          ) : null}

          {activeSection === "imports" ? (
            <>
              <div className="settings-pane-header">
                <h3>Imports</h3>
                <p className="muted">Load JSON files or templates and import directly into Health HQ.</p>
              </div>
              <ImportsPage />
            </>
          ) : null}

          {activeSection === "import-status" ? (
            <>
              <div className="settings-pane-header">
                <h3>Import status</h3>
                <p className="muted">See totals, sync outcomes, and recent failures.</p>
              </div>
              <ImportStatusPage />
            </>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function ImportsPage() {
  const [payloadType, setPayloadType] = React.useState("meal-plan");
  const [payload, setPayload] = React.useState("{}");
  const [message, setMessage] = React.useState("");
  const [selectedFileName, setSelectedFileName] = React.useState("");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");

  function isImportEnvelope(value: unknown): value is { payloadType: string; payload: unknown } {
    return (
      typeof value === "object" &&
      value !== null &&
      "payloadType" in value &&
      typeof (value as { payloadType?: unknown }).payloadType === "string" &&
      "payload" in value
    );
  }

  function inferPayloadType(value: unknown, fallback: string): string {
    function isRecipeShape(candidate: unknown): boolean {
      if (typeof candidate !== "object" || candidate === null) {
        return false;
      }

      const recipe = candidate as { name?: unknown; ingredients?: unknown; steps?: unknown };
      return typeof recipe.name === "string" && Array.isArray(recipe.ingredients) && Array.isArray(recipe.steps);
    }

    if (Array.isArray(value) && value.length > 0 && value.every((item) => isRecipeShape(item))) {
      return "recipes";
    }

    if (isRecipeShape(value)) {
      return "recipe";
    }

    return fallback;
  }

  function handlePayloadChange(value: string) {
    setPayload(value);
    try {
      const parsed = JSON.parse(value) as unknown;
      if (isImportEnvelope(parsed)) {
        setPayloadType(parsed.payloadType);
        return;
      }

      setPayloadType((current) => inferPayloadType(parsed, current));
    } catch {
      // Keep current payload type until valid JSON is provided.
    }
  }

  async function loadPayloadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const fileText = await file.text();
      setPayload(fileText);
      setSelectedFileName(file.name);

      try {
        const parsed = JSON.parse(fileText) as unknown;
        if (isImportEnvelope(parsed)) {
          setPayloadType(parsed.payloadType);
        }
      } catch {
        // Keep raw file text in the editor and let submit show validation feedback.
      }

      setMessage(`Loaded ${file.name}`);
    } catch {
      setMessage("Could not read file");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const parsed = JSON.parse(payload) as unknown;
      const requestBody = isImportEnvelope(parsed)
        ? parsed
        : { payloadType: inferPayloadType(parsed, payloadType), payload: parsed };

      setPayloadType(requestBody.payloadType);

      const response = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        setMessage("Imported");
        return;
      }

      try {
        const error = (await response.json()) as { message?: string };
        setMessage(error.message ? `Import failed: ${error.message}` : "Import failed");
      } catch {
        setMessage("Import failed");
      }
    } catch {
      setMessage("Invalid JSON");
    }
  }

  function applyTemplate(event: React.ChangeEvent<HTMLSelectElement>) {
    const templateId = event.target.value;
    setSelectedTemplateId(templateId);
    if (!templateId) {
      return;
    }

    const template = IMPORT_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setPayloadType(template.payloadType);
    setPayload(JSON.stringify(template.payload, null, 2));
    setSelectedFileName("");
    setMessage(`Loaded ${template.label} template`);
  }

  return (
    <form className="stack imports-form" onSubmit={submit}>
      <div className="settings-pane-subheader">
        <h4>JSON Import</h4>
      </div>
      <label>
        Payload type
        <select value={payloadType} onChange={(e) => setPayloadType(e.target.value)}>
          <option value="meal-plan">Meal plan</option>
          <option value="discount">Discounts</option>
          <option value="recipe">Recipe</option>
          <option value="recipes">Recipes</option>
          <option value="training-plan">Training plan</option>
        </select>
      </label>
      <label>
        Load template
        <select value={selectedTemplateId} onChange={applyTemplate}>
          <option value="">Select a sample template</option>
          {IMPORT_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Select JSON file
        <input type="file" accept=".json,application/json" onChange={loadPayloadFile} />
      </label>
      {selectedFileName ? <p className="muted">Loaded file: {selectedFileName}</p> : null}
      <textarea value={payload} onChange={(e) => handlePayloadChange(e.target.value)} rows={12} />
      <div className="connection-actions">
        <button className="button" type="submit">Run Import</button>
      </div>
      {message ? <p className="connection-status">{message}</p> : null}
    </form>
  );
}

function ImportStatusPage() {
  const { data, loading, error } = useFetch<ImportStatusResponse>("/api/ingestion/import-status");

  if (loading) {
    return <p className="muted">Loading import status...</p>;
  }

  if (error || !data) {
    return <p className="empty">Could not load import status.</p>;
  }

  return (
    <section className="stack">
      <div className="grid cards-grid">
        <article className="card">
          <h3>Activities</h3>
          <p className="value">{data.totals.activities.toLocaleString()}</p>
        </article>
        <article className="card">
          <h3>Step days</h3>
          <p className="value">{data.totals.stepDays.toLocaleString()}</p>
        </article>
        <article className="card">
          <h3>Sleep days</h3>
          <p className="value">{data.totals.sleepDays.toLocaleString()}</p>
        </article>
        <article className="card">
          <h3>Manual imports</h3>
          <p className="value">{data.totals.manualImports.toLocaleString()}</p>
        </article>
      </div>

      <article className="panel">
        <h4>Provider health</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Last run</th>
                <th>Status</th>
                <th>Imported total</th>
                <th>Failed runs</th>
                <th>Last imported at</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((provider) => (
                <tr key={provider.provider}>
                  <td>{provider.provider}</td>
                  <td>{provider.lastRunAt ? formatDateTime(provider.lastRunAt) : "-"}</td>
                  <td>{provider.lastRunStatus ?? "-"}</td>
                  <td>{provider.importedTotal}</td>
                  <td>{provider.failedRuns}</td>
                  <td>{provider.lastImportedAt ? formatDateTime(provider.lastImportedAt) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <h4>Recent failures</h4>
        {data.recentFailures.length === 0 ? (
          <p className="muted">No recent sync failures.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Provider</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFailures.map((failure) => (
                  <tr key={failure.id}>
                    <td>{formatDateTime(failure.startedAt)}</td>
                    <td>{failure.provider}</td>
                    <td>{failure.error ?? "Unknown failure"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

function TrainingPage() {
  const [plans, setPlans] = React.useState<TrainingPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedPlanId, setSelectedPlanId] = React.useState("");
  const [weekKey, setWeekKey] = React.useState(getCurrentIsoWeekKey());
  const [focus, setFocus] = React.useState("");
  const [planNotes, setPlanNotes] = React.useState("");
  const [sessions, setSessions] = React.useState<TrainingSession[]>([]);
  const [jsonDraft, setJsonDraft] = React.useState("{}");
  const [showJsonEditor, setShowJsonEditor] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;

  function createSessionDraft(): TrainingSession {
    return {
      day: getWeekdayLabel(),
      workout: "",
      durationMinutes: 45,
      notes: ""
    };
  }

  function applyPlanToEditor(plan: TrainingPlan | null) {
    if (!plan) {
      const defaultPayload: TrainingPlanPayload = { sessions: [createSessionDraft()] };
      setWeekKey(getCurrentIsoWeekKey());
      setFocus("");
      setPlanNotes("");
      setSessions(defaultPayload.sessions);
      setJsonDraft(JSON.stringify(defaultPayload, null, 2));
      return;
    }

    const parsed = parseTrainingPlanPayload(plan.payloadJson);
    const normalizedPayload: TrainingPlanPayload = {
      focus: parsed.focus,
      notes: parsed.notes,
      sessions: parsed.sessions.length > 0 ? parsed.sessions : [createSessionDraft()]
    };

    setWeekKey(plan.weekKey || getCurrentIsoWeekKey());
    setFocus(normalizedPayload.focus ?? "");
    setPlanNotes(normalizedPayload.notes ?? "");
    setSessions(normalizedPayload.sessions);
    setJsonDraft(JSON.stringify(normalizedPayload, null, 2));
  }

  React.useEffect(() => {
    async function loadPlans() {
      setLoading(true);
      setMessage("");

      const response = await fetch("/api/training/plans");
      if (!response.ok) {
        setLoading(false);
        setMessage("Could not load training plans.");
        return;
      }

      const loadedPlans = (await response.json()) as TrainingPlan[];
      const ordered = [...loadedPlans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPlans(ordered);
      setLoading(false);
    }

    void loadPlans();
  }, []);

  React.useEffect(() => {
    if (plans.length === 0) {
      setSelectedPlanId("");
      applyPlanToEditor(null);
      return;
    }

    if (!selectedPlanId || !plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  React.useEffect(() => {
    applyPlanToEditor(selectedPlan);
  }, [selectedPlan]);

  function updateSession(index: number, updater: (session: TrainingSession) => TrainingSession) {
    setSessions((current) => current.map((session, currentIndex) => (currentIndex === index ? updater(session) : session)));
  }

  function addSessionRow() {
    setSessions((current) => [...current, createSessionDraft()]);
  }

  function removeSessionRow(index: number) {
    setSessions((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function buildPayloadFromEditor(): TrainingPlanPayload | null {
    const normalizedSessions = sessions
      .map((session) => ({
        day: session.day.trim(),
        workout: session.workout.trim(),
        durationMinutes: Math.max(0, Math.round(Number(session.durationMinutes) || 0)),
        notes: session.notes?.trim() ? session.notes.trim() : undefined
      }))
      .filter((session) => session.day || session.workout || session.notes || session.durationMinutes > 0);

    if (normalizedSessions.length === 0) {
      setMessage("Add at least one training session before saving.");
      return null;
    }

    if (normalizedSessions.some((session) => !session.day || !session.workout || session.durationMinutes <= 0)) {
      setMessage("Each session needs day, workout, and duration greater than zero.");
      return null;
    }

    return {
      focus: focus.trim() || undefined,
      notes: planNotes.trim() || undefined,
      sessions: normalizedSessions
    };
  }

  async function createPlan() {
    const payload = buildPayloadFromEditor();
    if (!payload) {
      return;
    }

    const normalizedWeekKey = weekKey.trim() || getCurrentIsoWeekKey();
    setMessage("Creating training plan...");

    const response = await fetch("/api/training/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "",
        weekKey: normalizedWeekKey,
        payloadJson: serializeTrainingPlanPayload(payload),
        createdAt: new Date().toISOString()
      })
    });

    if (!response.ok) {
      setMessage("Could not create training plan.");
      return;
    }

    const created = (await response.json()) as TrainingPlan;
    setPlans((current) => [created, ...current]);
    setSelectedPlanId(created.id);
    setMessage(`Created plan for ${created.weekKey}.`);
  }

  async function savePlan() {
    if (!selectedPlan) {
      return;
    }

    const payload = buildPayloadFromEditor();
    if (!payload) {
      return;
    }

    const normalizedWeekKey = weekKey.trim() || getCurrentIsoWeekKey();
    setMessage("Saving training plan...");

    const response = await fetch(`/api/training/plans/${selectedPlan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...selectedPlan,
        weekKey: normalizedWeekKey,
        payloadJson: serializeTrainingPlanPayload(payload)
      })
    });

    if (!response.ok) {
      setMessage("Could not save training plan.");
      return;
    }

    const updated = (await response.json()) as TrainingPlan;
    setPlans((current) =>
      current
        .map((plan) => (plan.id === updated.id ? updated : plan))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
    setJsonDraft(JSON.stringify(parseTrainingPlanPayload(updated.payloadJson), null, 2));
    setMessage("Training plan saved.");
  }

  async function deletePlan() {
    if (!selectedPlan) {
      return;
    }

    if (!window.confirm(`Delete plan ${selectedPlan.weekKey}?`)) {
      return;
    }

    setMessage("Deleting training plan...");
    const response = await fetch(`/api/training/plans/${selectedPlan.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Could not delete training plan.");
      return;
    }

    setPlans((current) => current.filter((plan) => plan.id !== selectedPlan.id));
    setMessage("Training plan deleted.");
  }

  function applyJsonDraft() {
    const parsed = parseTrainingPlanPayload(jsonDraft);
    if (parsed.sessions.length === 0) {
      setMessage("JSON needs at least one valid session with day and workout.");
      return;
    }

    setFocus(parsed.focus ?? "");
    setPlanNotes(parsed.notes ?? "");
    setSessions(parsed.sessions);
    setJsonDraft(JSON.stringify(parsed, null, 2));
    setMessage("Applied JSON to planner fields.");
  }

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Training planner</p>
          <h2>Weekly training plans</h2>
          <p className="muted">Build, edit, and manage your sessions in one place.</p>
        </div>
      </header>

      <div className="grid training-layout">
        <article className="panel stack training-plans-panel">
          <div className="training-plan-list-header">
            <h3>Plans</h3>
            <button className="button" type="button" onClick={createPlan}>Create from current draft</button>
          </div>

          {loading ? <p className="muted">Loading plans...</p> : null}
          {!loading && plans.length === 0 ? <p className="empty">No training plans yet.</p> : null}

          <div className="training-plan-list">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className={`training-plan-item ${selectedPlanId === plan.id ? "training-plan-item-active" : ""}`}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <strong>{plan.weekKey}</strong>
                <small>{getTrainingSessionCount(plan)} session(s)</small>
                <small>Created {formatDateTime(plan.createdAt)}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="panel stack">
          <div className="planner-controls">
            <label>
              Week key
              <input value={weekKey} onChange={(event) => setWeekKey(event.target.value)} placeholder="YYYY-W##" />
            </label>
            <label>
              Focus
              <input value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="Example: Build endurance" />
            </label>
          </div>

          <label>
            Plan notes
            <textarea value={planNotes} onChange={(event) => setPlanNotes(event.target.value)} rows={3} />
          </label>

          <div className="training-session-list">
            <div className="training-session-list-header">
              <h3>Sessions</h3>
              <button className="button" type="button" onClick={addSessionRow}>Add session</button>
            </div>
            {sessions.map((session, index) => (
              <div className="training-session-row" key={`session-${index}`}>
                <label>
                  Day
                  <input
                    value={session.day}
                    onChange={(event) => updateSession(index, (current) => ({ ...current, day: event.target.value }))}
                  />
                </label>
                <label>
                  Workout
                  <input
                    value={session.workout}
                    onChange={(event) => updateSession(index, (current) => ({ ...current, workout: event.target.value }))}
                  />
                </label>
                <label>
                  Duration (min)
                  <input
                    type="number"
                    min={1}
                    value={session.durationMinutes}
                    onChange={(event) =>
                      updateSession(index, (current) => ({ ...current, durationMinutes: Number(event.target.value) || 0 }))
                    }
                  />
                </label>
                <label>
                  Notes
                  <input
                    value={session.notes ?? ""}
                    onChange={(event) => updateSession(index, (current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>
                <button className="training-remove" type="button" onClick={() => removeSessionRow(index)}>Remove</button>
              </div>
            ))}
          </div>

          <div className="planner-actions">
            <button className="button" type="button" onClick={savePlan} disabled={!selectedPlanId}>Save selected plan</button>
            <button className="button button-danger" type="button" onClick={deletePlan} disabled={!selectedPlanId}>Delete selected plan</button>
            <button className="button" type="button" onClick={() => setShowJsonEditor((current) => !current)}>
              {showJsonEditor ? "Hide JSON fallback" : "Show JSON fallback"}
            </button>
          </div>

          {showJsonEditor ? (
            <div className="stack">
              <label>
                JSON fallback
                <textarea value={jsonDraft} onChange={(event) => setJsonDraft(event.target.value)} rows={10} />
              </label>
              <button className="button" type="button" onClick={applyJsonDraft}>Apply JSON to fields</button>
            </div>
          ) : null}

          {message ? <p className="muted">{message}</p> : null}
        </article>
      </div>
    </section>
  );
}

function ShoppingPage() {
  const [lists, setLists] = React.useState<ShoppingListItem[]>([]);
  const [plans, setPlans] = React.useState<MealPlan[]>([]);
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [discounts, setDiscounts] = React.useState<DiscountRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>("");
  const [weekStart, setWeekStart] = React.useState<string>(getTodayIsoDay());
  const [editableDays, setEditableDays] = React.useState<PlannerDay[]>(getDefaultWeekDays());
  const [selectedDayIndex, setSelectedDayIndex] = React.useState(0);
  const [selectedSlot, setSelectedSlot] = React.useState<MealSlot>("breakfast");
  const [plannerMessage, setPlannerMessage] = React.useState("");
  const [recipeQuery, setRecipeQuery] = React.useState("");
  const [editingRecipeId, setEditingRecipeId] = React.useState<string | null>(null);
  const [recipeName, setRecipeName] = React.useState("");
  const [recipeDescription, setRecipeDescription] = React.useState("");
  const [ingredientInput, setIngredientInput] = React.useState("");
  const [stepsInput, setStepsInput] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [prepMinutes, setPrepMinutes] = React.useState("");
  const [cookMinutes, setCookMinutes] = React.useState("");
  const [recipeMessage, setRecipeMessage] = React.useState("");

  const recipeMap = React.useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);

  React.useEffect(() => {
    async function load() {
      setLoading(true);

      const [listRes, planRes, recipeRes, discountRes] = await Promise.all([
        fetch("/api/shopping/lists"),
        fetch("/api/nutrition/meal-plans"),
        fetch("/api/nutrition/recipes"),
        fetch("/api/nutrition/discounts")
      ]);

      if (listRes.ok) {
        setLists((await listRes.json()) as ShoppingListItem[]);
      }

      if (planRes.ok) {
        setPlans((await planRes.json()) as MealPlan[]);
      }

      if (recipeRes.ok) {
        setRecipes((await recipeRes.json()) as Recipe[]);
      }

      if (discountRes.ok) {
        setDiscounts((await discountRes.json()) as DiscountRecord[]);
      }

      setLoading(false);
    }

    void load();
  }, []);

  React.useEffect(() => {
    if (plans.length === 0) {
      setSelectedPlanId("");
      return;
    }

    if (!selectedPlanId || !plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

  React.useEffect(() => {
    if (!selectedPlan) {
      setEditableDays(getDefaultWeekDays());
      setWeekStart(getTodayIsoDay());
      return;
    }

    const parsed = parseMealPlanPayload(selectedPlan.payloadJson);
    setEditableDays(parsed.days.length > 0 ? parsed.days : getDefaultWeekDays());
    setWeekStart(parsed.weekStart ?? getTodayIsoDay());
    setSelectedDayIndex(0);
    setSelectedSlot("breakfast");
  }, [selectedPlan]);

  const totalEstimated = lists.reduce((sum, list) => sum + list.estimatedTotal, 0);
  const totalSavings = lists.reduce((sum, list) => sum + list.estimatedSavings, 0);
  const latestListLines = lists[0] ? parseShoppingLines(lists[0].payloadJson) : [];
  const discountedItems = latestListLines.filter((line) => line.discounted).length;
  const assignedMealCount = editableDays.reduce(
    (count, day) => count + [day.breakfastRecipeId, day.lunchRecipeId, day.dinnerRecipeId].filter(Boolean).length,
    0
  );

  const selectedDay = editableDays[selectedDayIndex] ?? editableDays[0];
  const selectedRecipeId = selectedDay ? getRecipeIdBySlot(selectedDay, selectedSlot) : undefined;
  const selectedRecipe = selectedRecipeId ? recipeMap.get(selectedRecipeId) : undefined;
  const selectedLegacyText = selectedDay ? getLegacyTextBySlot(selectedDay, selectedSlot) : undefined;

  const filteredRecipes = recipes.filter((recipe) => {
    if (!recipeQuery.trim()) {
      return true;
    }

    const query = recipeQuery.toLowerCase();
    return (
      recipe.name.toLowerCase().includes(query) ||
      (recipe.description ?? "").toLowerCase().includes(query) ||
      recipe.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  function assignRecipe(recipeId: string) {
    if (!selectedDay) {
      return;
    }

    setEditableDays((current) => current.map((day, index) => (index === selectedDayIndex ? setSlotRecipe(day, selectedSlot, recipeId) : day)));
    setPlannerMessage("Recipe assigned to slot.");
  }

  function clearSlot() {
    if (!selectedDay) {
      return;
    }

    setEditableDays((current) => current.map((day, index) => (index === selectedDayIndex ? setSlotRecipe(day, selectedSlot, undefined) : day)));
    setPlannerMessage("Meal slot cleared.");
  }

  async function savePlan() {
    if (!selectedPlan) {
      return;
    }

    setPlannerMessage("Saving meal plan...");
    const payloadJson = serializeMealPlanPayload({ weekStart, days: editableDays });
    const response = await fetch(`/api/nutrition/meal-plans/${selectedPlan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...selectedPlan, payloadJson })
    });

    if (!response.ok) {
      setPlannerMessage("Could not save meal plan.");
      return;
    }

    const saved = (await response.json()) as MealPlan;
    setPlans((current) => current.map((plan) => (plan.id === saved.id ? saved : plan)));
    setPlannerMessage("Meal plan saved.");
  }

  async function generateFromPlan() {
    if (!selectedPlan) {
      return;
    }

    const ingredientSet = new Set<string>();
    editableDays.forEach((day) => {
      [day.breakfastRecipeId, day.lunchRecipeId, day.dinnerRecipeId]
        .map((id) => (id ? recipeMap.get(id) : undefined))
        .filter((recipe): recipe is Recipe => Boolean(recipe))
        .forEach((recipe) => {
          recipe.ingredients.forEach((ingredient) => ingredientSet.add(ingredient));
        });
    });

    if (ingredientSet.size === 0) {
      setPlannerMessage("Assign at least one recipe before generating a list.");
      return;
    }

    setPlannerMessage("Generating shopping list...");
    const response = await fetch("/api/shopping/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${selectedPlan.name} - ${weekStart}`,
        ingredients: Array.from(ingredientSet)
      })
    });

    if (!response.ok) {
      setPlannerMessage("Could not generate shopping list.");
      return;
    }

    const list = (await response.json()) as ShoppingListItem;
    setLists((current) => [list, ...current]);
    setPlannerMessage("Shopping list generated from selected week.");
  }

  function loadRecipeIntoForm(recipe: Recipe) {
    setEditingRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setRecipeDescription(recipe.description ?? "");
    setIngredientInput(recipe.ingredients.join("\n"));
    setStepsInput(recipe.steps.join("\n"));
    setTagInput(recipe.tags.join(", "));
    setPrepMinutes(recipe.prepMinutes ? String(recipe.prepMinutes) : "");
    setCookMinutes(recipe.cookMinutes ? String(recipe.cookMinutes) : "");
    setRecipeMessage(`Editing ${recipe.name}`);
  }

  function resetRecipeForm() {
    setEditingRecipeId(null);
    setRecipeName("");
    setRecipeDescription("");
    setIngredientInput("");
    setStepsInput("");
    setTagInput("");
    setPrepMinutes("");
    setCookMinutes("");
    setRecipeMessage("Creating new recipe.");
  }

  async function saveRecipe() {
    const ingredients = ingredientInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const steps = stepsInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!recipeName.trim() || ingredients.length === 0 || steps.length === 0) {
      setRecipeMessage("Recipe name, ingredients, and steps are required.");
      return;
    }

    const requestBody = {
      id: editingRecipeId ?? "",
      name: recipeName,
      description: recipeDescription || undefined,
      ingredients,
      steps,
      prepMinutes: prepMinutes ? Number(prepMinutes) : undefined,
      cookMinutes: cookMinutes ? Number(cookMinutes) : undefined,
      tags: tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setRecipeMessage(editingRecipeId ? "Updating recipe..." : "Saving recipe...");
    const response = await fetch(editingRecipeId ? `/api/nutrition/recipes/${editingRecipeId}` : "/api/nutrition/recipes", {
      method: editingRecipeId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      setRecipeMessage("Could not save recipe.");
      return;
    }

    const saved = (await response.json()) as Recipe;
    setRecipes((current) => {
      const exists = current.some((recipe) => recipe.id === saved.id);
      if (exists) {
        return current.map((recipe) => (recipe.id === saved.id ? saved : recipe));
      }
      return [saved, ...current];
    });

    loadRecipeIntoForm(saved);
    setRecipeMessage("Recipe saved.");
  }

  async function deleteRecipe() {
    if (!editingRecipeId) {
      setRecipeMessage("Select a recipe to delete.");
      return;
    }

    const response = await fetch(`/api/nutrition/recipes/${editingRecipeId}`, { method: "DELETE" });
    if (!response.ok) {
      setRecipeMessage("Could not delete recipe.");
      return;
    }

    setRecipes((current) => current.filter((recipe) => recipe.id !== editingRecipeId));
    setEditableDays((current) =>
      current.map((day) => ({
        ...day,
        breakfastRecipeId: day.breakfastRecipeId === editingRecipeId ? undefined : day.breakfastRecipeId,
        lunchRecipeId: day.lunchRecipeId === editingRecipeId ? undefined : day.lunchRecipeId,
        dinnerRecipeId: day.dinnerRecipeId === editingRecipeId ? undefined : day.dinnerRecipeId
      }))
    );

    const refreshedPlansResponse = await fetch("/api/nutrition/meal-plans");
    if (refreshedPlansResponse.ok) {
      setPlans((await refreshedPlansResponse.json()) as MealPlan[]);
    }

    resetRecipeForm();
    setRecipeMessage("Recipe deleted. Linked meal slots were cleared.");
  }

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Kitchen planner</p>
          <h2>Shopping and recipes</h2>
        </div>
        <p className="muted">Pulling from shopping lists, meal plans, and active discounts.</p>
      </header>

      <div className="grid cards-grid">
        <article className="card">
          <h3>Total basket</h3>
          <p className="value">${totalEstimated.toFixed(2)}</p>
          <p className="hint">Across {lists.length} saved lists</p>
        </article>
        <article className="card">
          <h3>Projected savings</h3>
          <p className="value">${totalSavings.toFixed(2)}</p>
          <p className="hint">Discount overlap in your ingredients</p>
        </article>
        <article className="card">
          <h3>Recipe days</h3>
          <p className="value">{editableDays.length}</p>
          <p className="hint">In selected weekly plan</p>
        </article>
        <article className="card">
          <h3>Assigned meals</h3>
          <p className="value">{assignedMealCount}</p>
          <p className="hint">Recipe slots currently assigned</p>
        </article>
      </div>

      <div className="grid shopping-planner-grid">
        <article className="panel stack">
          <h3>Weekly planner</h3>
          {loading ? <p>Loading planner...</p> : null}
          {!loading && plans.length === 0 ? <p className="empty">No meal plans found.</p> : null}
          {plans.length > 0 ? (
            <>
              <div className="planner-controls">
                <label>
                  Plan
                  <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Week start
                  <input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
                </label>
              </div>

              <div className="planner-actions">
                <button type="button" onClick={savePlan}>Save plan</button>
                <button type="button" onClick={generateFromPlan}>Generate shopping list</button>
                <p className="muted">{plannerMessage}</p>
              </div>

              <div className="week-grid">
                {editableDays.map((day, dayIndex) => (
                  <article key={`${day.day}-${dayIndex}`} className="week-day">
                    <h4>{day.day}</h4>
                    <div className="meal-slots">
                      {SLOT_LABELS.map((slot) => {
                        const recipe = recipeMap.get(getRecipeIdBySlot(day, slot.key) ?? "");
                        const legacyText = getLegacyTextBySlot(day, slot.key);
                        const isSelected = dayIndex === selectedDayIndex && slot.key === selectedSlot;
                        return (
                          <button
                            key={`${day.day}-${slot.key}`}
                            type="button"
                            className={`meal-slot ${isSelected ? "meal-slot-selected" : ""}`}
                            onClick={() => {
                              setSelectedDayIndex(dayIndex);
                              setSelectedSlot(slot.key);
                            }}
                          >
                            <span>{slot.label}</span>
                            <strong>{recipe?.name ?? legacyText ?? "Assign recipe"}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </article>

        <article className="panel stack">
          <h3>Recipe workspace</h3>
          {selectedDay ? (
            <>
              <section className="recipe-card">
                <div className="shopping-card-head">
                  <h4>
                    {selectedDay.day} - {SLOT_LABELS.find((slot) => slot.key === selectedSlot)?.label}
                  </h4>
                  <button type="button" onClick={clearSlot}>Clear slot</button>
                </div>

                {selectedRecipe ? (
                  <div className="stack">
                    <p className="muted">{selectedRecipe.description ?? "No description yet."}</p>
                    <div className="chip-row">
                      {selectedRecipe.prepMinutes ? <span className="chip">Prep {selectedRecipe.prepMinutes}m</span> : null}
                      {selectedRecipe.cookMinutes ? <span className="chip">Cook {selectedRecipe.cookMinutes}m</span> : null}
                      {selectedRecipe.tags.map((tag) => (
                        <span key={`${selectedRecipe.id}-${tag}`} className="chip">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="stack">
                      <h5>Ingredients</h5>
                      {selectedRecipe.ingredients.map((ingredient) => (
                        <p key={`${selectedRecipe.id}-ingredient-${ingredient}`}>- {ingredient}</p>
                      ))}
                    </div>

                    <div className="stack">
                      <h5>Steps</h5>
                      {selectedRecipe.steps.map((step, index) => (
                        <p key={`${selectedRecipe.id}-step-${index + 1}`}>{index + 1}. {step}</p>
                      ))}
                    </div>
                  </div>
                ) : selectedLegacyText ? (
                  <p className="empty">Legacy meal text: {selectedLegacyText}. Assign a recipe to convert this slot.</p>
                ) : (
                  <p className="empty">No recipe assigned to this slot yet.</p>
                )}

                <label>
                  Find recipe
                  <input
                    type="text"
                    placeholder="Search by name, description, or tag"
                    value={recipeQuery}
                    onChange={(event) => setRecipeQuery(event.target.value)}
                  />
                </label>

                <div className="recipe-library-list">
                  {filteredRecipes.length === 0 ? (
                    <p className="empty">No recipes match this search.</p>
                  ) : (
                    filteredRecipes.map((recipe) => (
                      <button key={recipe.id} type="button" className="recipe-pick" onClick={() => assignRecipe(recipe.id)}>
                        <span>{recipe.name}</span>
                        <small>{recipe.ingredients.length} ingredients</small>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="deal-radar">
                <h4>Deal radar</h4>
                {discounts.length === 0 ? (
                  <p className="empty">No discounts available.</p>
                ) : (
                  <div className="chip-row">
                    {discounts.slice(0, 8).map((discount) => (
                      <span key={discount.id} className="chip chip-deal">
                        {discount.itemName} ${discount.discountedPrice.toFixed(2)}/{discount.unit}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section className="recipe-card stack">
                <div className="shopping-card-head">
                  <h4>{editingRecipeId ? "Edit recipe" : "New recipe"}</h4>
                  <button type="button" onClick={resetRecipeForm}>New</button>
                </div>

                <label>
                  Name
                  <input value={recipeName} onChange={(event) => setRecipeName(event.target.value)} placeholder="Recipe name" />
                </label>
                <label>
                  Description
                  <input value={recipeDescription} onChange={(event) => setRecipeDescription(event.target.value)} placeholder="Optional" />
                </label>
                <label>
                  Ingredients (one per line)
                  <textarea value={ingredientInput} onChange={(event) => setIngredientInput(event.target.value)} rows={5} />
                </label>
                <label>
                  Steps (one per line)
                  <textarea value={stepsInput} onChange={(event) => setStepsInput(event.target.value)} rows={5} />
                </label>
                <label>
                  Tags (comma-separated)
                  <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="breakfast, high-protein" />
                </label>

                <div className="planner-controls">
                  <label>
                    Prep minutes
                    <input type="number" value={prepMinutes} onChange={(event) => setPrepMinutes(event.target.value)} />
                  </label>
                  <label>
                    Cook minutes
                    <input type="number" value={cookMinutes} onChange={(event) => setCookMinutes(event.target.value)} />
                  </label>
                </div>

                <div className="planner-actions">
                  <button type="button" onClick={saveRecipe}>Save recipe</button>
                  <button type="button" onClick={deleteRecipe}>Delete recipe</button>
                </div>
                <p className="muted">{recipeMessage}</p>

                <div className="recipe-days">
                  {recipes.map((recipe) => (
                    <button key={recipe.id} type="button" className="recipe-pick" onClick={() => loadRecipeIntoForm(recipe)}>
                      <span>{recipe.name}</span>
                      <small>{recipe.tags.join(", ") || "No tags"}</small>
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <p className="empty">Choose a meal slot to view recipe details.</p>
          )}
        </article>
      </div>

      <div className="grid dashboard-grid">
        <article className="panel stack">
          <h3>Shopping lists</h3>
          {loading ? (
            <p>Loading shopping lists...</p>
          ) : lists.length === 0 ? (
            <p className="empty">No shopping lists yet. Generate one from your planner.</p>
          ) : (
            <div className="stack">
              {lists.map((list) => {
                const lines = parseShoppingLines(list.payloadJson);
                return (
                  <section key={list.id} className="shopping-card">
                    <div className="shopping-card-head">
                      <h4>{list.name}</h4>
                      <p className="muted">{formatDateTime(list.createdAt)}</p>
                    </div>
                    <div className="chip-row">
                      <span className="chip">{lines.length} items</span>
                      <span className="chip">${list.estimatedTotal.toFixed(2)} total</span>
                      <span className="chip chip-save">Save ${list.estimatedSavings.toFixed(2)}</span>
                      <span className="chip">{discountedItems} deal matches</span>
                    </div>
                    <div className="shopping-lines">
                      {lines.map((line, index) => (
                        <div key={`${list.id}-${line.ingredient}-${index}`} className={`shopping-line ${line.discounted ? "shopping-line-hit" : ""}`}>
                          <p>{line.ingredient}</p>
                          <p className="muted">{line.store === "n/a" ? "No deal" : line.store}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </article>
      </div>

      <article className="panel stack">
        <h3>Automation endpoint</h3>
        <p className="muted">Use this API to generate price-aware shopping lists from ingredient sets.</p>
        <code>POST /api/shopping/generate</code>
      </article>
    </section>
  );
}

function BodyPage() {
  const [entries, setEntries] = React.useState<BodyMetricEntry[]>([]);
  const [vitalSigns, setVitalSigns] = React.useState<VitalSignEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [vitalsLoading, setVitalsLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const [vitalMessage, setVitalMessage] = React.useState("");
  const [day, setDay] = React.useState(getTodayIsoDay());
  const [heightCm, setHeightCm] = React.useState("178");
  const [weightKg, setWeightKg] = React.useState("");
  const [measuredAt, setMeasuredAt] = React.useState(getNowLocalMinuteInput());
  const [systolic, setSystolic] = React.useState("");
  const [diastolic, setDiastolic] = React.useState("");
  const [pulse, setPulse] = React.useState("");

  const heightValue = Number(heightCm);
  const weightValue = Number(weightKg);
  const previewBmi = heightValue > 0 && weightValue > 0 ? weightValue / ((heightValue / 100) * (heightValue / 100)) : null;
  const previewCategory = previewBmi == null ? "-" : previewBmi < 18.5 ? "underweight" : previewBmi < 25 ? "healthy" : previewBmi < 30 ? "overweight" : "obese";

  async function loadEntries() {
    setLoading(true);
    const response = await fetch("/api/body-metrics");
    if (response.ok) {
      const json = (await response.json()) as BodyMetricEntry[];
      setEntries(json);
    }
    setLoading(false);
  }

  async function loadVitalSigns() {
    setVitalsLoading(true);
    const response = await fetch("/api/vital-signs");
    if (response.ok) {
      const json = (await response.json()) as VitalSignEntry[];
      setVitalSigns(json);
    }
    setVitalsLoading(false);
  }

  React.useEffect(() => {
    void Promise.all([loadEntries(), loadVitalSigns()]);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!day) {
      setMessage("Please choose a date.");
      return;
    }

    if (!Number.isFinite(heightValue) || !Number.isFinite(weightValue) || heightValue < 80 || heightValue > 250 || weightValue < 20 || weightValue > 400) {
      setMessage("Use realistic metric values (height 80-250 cm, weight 20-400 kg).");
      return;
    }

    setMessage("Saving body metrics...");

    const response = await fetch("/api/body-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, heightCm: heightValue, weightKg: weightValue })
    });

    if (!response.ok) {
      setMessage("Could not save metrics.");
      return;
    }

    setMessage("Saved. Dashboard insights updated.");
    await loadEntries();
  }

  async function submitVitalSign(e: React.FormEvent) {
    e.preventDefault();

    if (!measuredAt) {
      setVitalMessage("Please choose a date and time.");
      return;
    }

    const systolicValue = Number(systolic);
    const diastolicValue = Number(diastolic);
    const pulseValue = Number(pulse);

    if (!Number.isFinite(systolicValue) || !Number.isFinite(diastolicValue) || !Number.isFinite(pulseValue)) {
      setVitalMessage("Enter systolic, diastolic, and pulse values.");
      return;
    }

    if (systolicValue < 70 || systolicValue > 260 || diastolicValue < 40 || diastolicValue > 160 || pulseValue < 30 || pulseValue > 230) {
      setVitalMessage("Use realistic vitals (systolic 70-260, diastolic 40-160, pulse 30-230).");
      return;
    }

    if (diastolicValue >= systolicValue) {
      setVitalMessage("Diastolic should be lower than systolic.");
      return;
    }

    setVitalMessage("Saving vitals...");

    const localDate = new Date(measuredAt);
    const response = await fetch("/api/vital-signs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        measuredAt: localDate.toISOString(),
        systolic: Math.round(systolicValue),
        diastolic: Math.round(diastolicValue),
        pulse: Math.round(pulseValue)
      })
    });

    if (!response.ok) {
      setVitalMessage("Could not save vitals.");
      return;
    }

    setVitalMessage("Saved blood pressure and pulse.");
    await loadVitalSigns();
  }

  const orderedForChart = [...entries].sort((a, b) => a.day.localeCompare(b.day));
  const latest = entries[0];
  const oldest = entries[entries.length - 1];
  const delta = latest && oldest ? latest.weightKg - oldest.weightKg : null;
  const recentVitals = vitalSigns.slice(0, 40);
  const latestVital = vitalSigns[0];

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Body metrics</p>
          <h2>Log body check-ins and vitals</h2>
        </div>
        <p className="muted">Metric units only: cm, kg, mmHg, bpm.</p>
      </header>

      <div className="grid body-grid">
        <form className="panel stack" onSubmit={submit}>
          <h3>New check-in</h3>
          <label>
            Date
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label>
            Height (cm)
            <input
              type="number"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="178"
            />
          </label>
          <label>
            Weight (kg)
            <input
              type="number"
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="77.5"
            />
          </label>

          <div className="stat-strip">
            <div>
              <p className="muted">Live BMI</p>
              <p className="value small">{previewBmi ? previewBmi.toFixed(2) : "-"}</p>
            </div>
            <div>
              <p className="muted">Category</p>
              <p className="value small">{previewCategory}</p>
            </div>
          </div>

          <button className="button" type="submit">Save metrics</button>
          <p>{message}</p>
        </form>

        <form className="panel stack" onSubmit={submitVitalSign}>
          <h3>Blood pressure and pulse</h3>
          <label>
            Measured at
            <input type="datetime-local" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} />
          </label>
          <label>
            Systolic (mmHg)
            <input
              type="number"
              inputMode="numeric"
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
              placeholder="120"
            />
          </label>
          <label>
            Diastolic (mmHg)
            <input
              type="number"
              inputMode="numeric"
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
              placeholder="80"
            />
          </label>
          <label>
            Pulse (bpm)
            <input
              type="number"
              inputMode="numeric"
              value={pulse}
              onChange={(e) => setPulse(e.target.value)}
              placeholder="62"
            />
          </label>
          <button className="button" type="submit">Save vitals</button>
          <p>{vitalMessage}</p>
        </form>
      </div>

      <div className="grid body-grid">

        <article className="panel stack">
          <h3>Progress snapshot</h3>
          {loading ? (
            <p>Loading body metrics...</p>
          ) : entries.length === 0 ? (
            <p className="empty">No entries yet. Add your first check-in.</p>
          ) : (
            <>
              <div className="stat-strip">
                <div>
                  <p className="muted">Latest weight</p>
                  <p className="value small">{latest ? `${latest.weightKg.toFixed(1)} kg` : "-"}</p>
                </div>
                <div>
                  <p className="muted">Weight change</p>
                  <p className="value small">{delta == null ? "-" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)} kg`}</p>
                </div>
              </div>
              <BodyTrendLines
                points={orderedForChart.map((entry) => ({
                  day: entry.day,
                  weightKg: entry.weightKg,
                  bmi: entry.bmi,
                  category: entry.category
                }))}
              />
            </>
          )}
        </article>

        <article className="panel stack">
          <h3>Vitals snapshot</h3>
          {vitalsLoading ? (
            <p>Loading vital signs...</p>
          ) : vitalSigns.length === 0 ? (
            <p className="empty">No readings yet. Add your first blood pressure reading.</p>
          ) : (
            <>
              <div className="stat-strip stat-strip-vitals">
                <div>
                  <p className="muted">Latest blood pressure</p>
                  <p className="value small">{latestVital ? `${latestVital.systolic}/${latestVital.diastolic} mmHg` : "-"}</p>
                </div>
                <div>
                  <p className="muted">Latest pulse</p>
                  <p className="value small">{latestVital ? `${latestVital.pulse} bpm` : "-"}</p>
                </div>
              </div>
              <VitalTrendLines points={recentVitals} />
            </>
          )}
        </article>
      </div>

      <article className="panel">
        <h3>Metric history</h3>
        {entries.length === 0 ? (
          <p className="empty">No body metrics logged yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Height</th>
                  <th>Weight</th>
                  <th>BMI</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDay(entry.day)}</td>
                    <td>{entry.heightCm.toFixed(1)} cm</td>
                    <td>{entry.weightKg.toFixed(1)} kg</td>
                    <td>{entry.bmi.toFixed(2)}</td>
                    <td>{entry.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="panel">
        <h3>Blood pressure history</h3>
        {vitalSigns.length === 0 ? (
          <p className="empty">No blood pressure readings logged yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Measured</th>
                  <th>Blood pressure</th>
                  <th>Pulse</th>
                </tr>
              </thead>
              <tbody>
                {vitalSigns.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.measuredAt)}</td>
                    <td>{entry.systolic}/{entry.diastolic} mmHg</td>
                    <td>{entry.pulse} bpm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

function App() {
  const [themes, setThemes] = React.useState<ThemeOption[]>(FALLBACK_THEMES);
  const [themeId, setThemeId] = React.useState<string>(() => resolveActiveThemeId(FALLBACK_THEMES));

  React.useEffect(() => {
    let mounted = true;

    fetch("/themes/themes.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load themes manifest.");
        }
        return response.json() as Promise<ThemeManifest>;
      })
      .then((manifest) => {
        const loadedThemes = Array.isArray(manifest.themes)
          ? manifest.themes.filter((theme) => theme && theme.id && theme.label && theme.cssFile)
          : [];
        if (!mounted || loadedThemes.length === 0) {
          return;
        }

        setThemes(loadedThemes);
        setThemeId(resolveActiveThemeId(loadedThemes));
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setThemes(FALLBACK_THEMES);
        setThemeId(resolveActiveThemeId(FALLBACK_THEMES));
      });

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    const activeTheme = themes.find((theme) => theme.id === themeId);
    if (!activeTheme) {
      return;
    }

    applyThemeStylesheet(activeTheme.cssFile);
    window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme.id);
  }, [themeId, themes]);

  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/activities" element={<ActivitiesHubPage />} />
          <Route path="/sleep" element={<SleepHubPage />} />
          <Route path="/activity/:id" element={<ActivityDetailPage />} />
          <Route path="/steps/:day" element={<StepsDetailPage />} />
          <Route path="/sleep/:day" element={<SleepDetailPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route
            path="/settings"
            element={<SettingsPage themes={themes} themeId={themeId} onThemeChange={setThemeId} />}
          />
          <Route path="/connections" element={<Navigate to="/settings" replace />} />
          <Route path="/imports" element={<Navigate to="/settings#imports" replace />} />
          <Route path="/shopping" element={<ShoppingPage />} />
          <Route path="/body" element={<BodyPage />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
