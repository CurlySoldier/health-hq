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

type RestingHeartRatePoint = {
  day: string;
  restingHr?: number;
  rolling7?: number;
  rolling30?: number;
  baseline30?: number;
  stdDev30?: number;
  isAnomaly: boolean;
};

type RestingHeartRateResponse = {
  fromDay: string;
  toDay: string;
  availableDays: number;
  points: RestingHeartRatePoint[];
};

type SleepStagesPoint = {
  day: string;
  hasData: boolean;
  deepHours: number;
  lightHours: number;
  remHours: number;
  awakeHours: number;
  totalSleepHours: number;
  rolling7SleepHours?: number;
  bedtimeMinute?: number;
  wakeMinute?: number;
};

type SleepStagesResponse = {
  fromDay: string;
  toDay: string;
  availableDays: number;
  points: SleepStagesPoint[];
};

type StepsHeatmapPoint = {
  day: string;
  steps: number;
  hasData: boolean;
};

type StepsHeatmapResponse = {
  fromDay: string;
  toDay: string;
  minSteps: number;
  maxSteps: number;
  defaultGoal: number;
  points: StepsHeatmapPoint[];
};

type MonthlyLifeSnapshot = {
  avgRestingHr?: number;
  avgSleepHours?: number;
  avgDeepSleepPct?: number;
  totalSteps: number;
  totalActiveMinutes: number;
  longestActivityLabel: string;
  longestActivityScore: number;
  activeDays: number;
};

type MonthlyLifeResponse = {
  month: string;
  current: MonthlyLifeSnapshot;
  previous: MonthlyLifeSnapshot;
  deltas: {
    avgRestingHr?: number;
    avgSleepHours?: number;
    avgDeepSleepPct?: number;
    totalSteps: number;
    totalActiveMinutes: number;
    longestActivityScore: number;
    activeDays: number;
  };
};

type MetricOption = {
  key: string;
  label: string;
};

type CorrelationPoint = {
  day: string;
  compareDay: string;
  x: number;
  y: number;
};

type CorrelationResponse = {
  fromDay: string;
  toDay: string;
  metricA: string;
  metricB: string;
  lag: number;
  correlation?: number;
  metricOptions: MetricOption[];
  points: CorrelationPoint[];
};

type ActivityNextSleepCandidate = {
  id: string;
  startTime: string;
  name: string;
  type: string;
  durationMinutes: number;
  distanceKm?: number;
};

type ActivityNextSleepResponse = {
  activity: ActivityDetail;
  nightDay: string;
  sleep?: {
    day: string;
    totalSleepHours: number;
    deepSleepHours: number;
    lightSleepHours: number;
    remSleepHours: number;
    awakeHours: number;
    schedule?: {
      bedtime?: string;
      wakeTime?: string;
    };
  };
  comparison: {
    averageSleepHours?: number;
    averageDeepHours?: number;
    sleepDelta?: number;
    deepDelta?: number;
  };
};

type WeeklyTypeLoad = {
  type: string;
  durationMinutes: number;
  distanceKm: number;
  calories: number;
  load: number;
};

type WeeklyLoadPoint = {
  weekStart: string;
  weekKey: string;
  totalDurationMinutes: number;
  totalDistanceKm: number;
  totalCalories: number;
  totalLoad: number;
  byType: WeeklyTypeLoad[];
  trailingAverageDuration?: number;
  spikeWarning: boolean;
  detrainingWarning: boolean;
};

type WeeklyTrainingLoadResponse = {
  fromDay: string;
  toDay: string;
  points: WeeklyLoadPoint[];
};

type HrZonePoint = {
  periodStart: string;
  label: string;
  zone1Minutes: number;
  zone2Minutes: number;
  zone3Minutes: number;
  zone4Minutes: number;
  zone5Minutes: number;
  totalMinutes: number;
};

type HrZoneDistributionResponse = {
  period: "week" | "month";
  maxHr: number;
  fromDay: string;
  toDay: string;
  points: HrZonePoint[];
};

type StressPoint = {
  minute: number;
  value: number;
};

type StressBodyBatteryResponse = {
  day: string;
  available: boolean;
  message: string;
  stressPoints: StressPoint[];
  bodyBatteryPoints: StressPoint[];
  activityBlocks: Array<{
    id: string;
    name: string;
    startMinute: number;
    endMinute: number;
  }>;
  sleepWindow?: {
    startMinute: number;
    endMinute: number;
  };
};

type RunningSummary = {
  totalRuns: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  avgPaceMinPerKm?: number;
  currentWeeklyStreak: number;
  bestEverPace?: {
    day: string;
    activityId: string;
    paceMinPerKm: number;
    distanceKm?: number;
  };
};

type RunningPacePoint = {
  day: string;
  activityId: string;
  paceMinPerKm?: number;
  distanceKm?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  elevationGainPerKm?: number;
  normalizedPaceElevation?: number;
  normalizedPaceHr?: number;
  rolling10RunPace?: number;
};

type RunningWeeklyVolumePoint = {
  weekStart: string;
  weekKey: string;
  distanceKm: number;
  trailing4WeekDistanceKm?: number;
  spikeWarning: boolean;
  detrainingWarning: boolean;
};

type RunningMonthlyVolumePoint = {
  month: string;
  label: string;
  distanceKm: number;
};

type RunningEfficiencyPoint = {
  month: string;
  label: string;
  ratio?: number;
  runCount: number;
};

type RunningSplitPoint = {
  distanceKm: number;
  durationMinutes: number;
  paceMinPerKm?: number;
  averageHeartRate?: number;
  elevationGainM?: number;
  cadenceSpm?: number;
};

type RunningPacingRun = {
  day: string;
  activityId: string;
  name: string;
  fadeIndex?: number;
  splits: RunningSplitPoint[];
};

type RunningPrDistanceRow = {
  label: string;
  targetDistanceKm: number;
  activityId?: string;
  day?: string;
  distanceKm?: number;
  durationMinutes?: number;
  equivalentDurationMinutes?: number;
  paceMinPerKm?: number;
};

type RunningRacePredictionRow = {
  label: string;
  distanceKm: number;
  predictedMinutes: number;
  actualMinutes?: number;
  actualActivityId?: string;
  deltaMinutes?: number;
};

type RunningInsightsResponse = {
  fromDay: string;
  toDay: string;
  summary: RunningSummary;
  paceTrend: {
    points: RunningPacePoint[];
  };
  volumeTrend: {
    weekly: RunningWeeklyVolumePoint[];
    monthly: RunningMonthlyVolumePoint[];
  };
  efficiencyTrend: {
    monthly: RunningEfficiencyPoint[];
  };
  pacingConsistency: {
    fadeTrend: Array<{
      day: string;
      activityId: string;
      fadeIndex: number;
    }>;
    runs: RunningPacingRun[];
  };
  prTable: {
    distancePrs: RunningPrDistanceRow[];
    longestRun?: {
      activityId: string;
      day: string;
      distanceKm?: number;
      durationMinutes: number;
      paceMinPerKm?: number;
    };
    mostElevation?: {
      activityId: string;
      day: string;
      elevationGainM?: number;
      distanceKm?: number;
      durationMinutes: number;
    };
  };
  racePredictor: {
    source?: {
      activityId: string;
      day: string;
      distanceKm: number;
      durationMinutes: number;
      paceMinPerKm?: number;
    };
    predictions: RunningRacePredictionRow[];
  };
  runs: Array<{
    day: string;
    activityId: string;
    name: string;
    distanceKm?: number;
    durationMinutes: number;
    paceMinPerKm?: number;
    averageHeartRate?: number;
    maxHeartRate?: number;
    elevationGainM?: number;
    cadenceSpm?: number;
    fadeIndex?: number;
    efficiencyRatio?: number;
    zone34Ratio?: number;
    elevationGainPerKm?: number;
    normalizedPaceElevation?: number;
    normalizedPaceHr?: number;
  }>;
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

type HealthPetMood = "thriving" | "happy" | "neutral" | "tired" | "unwell" | "lonely";
type HealthPetFlavorKey = "energy" | "happiness" | "health" | "engagement";
type HealthPetDirection = "up" | "down";

type HealthPetResponse = {
  day: string;
  generatedAt: string;
  isNightTime: boolean;
  mood: HealthPetMood;
  careStreak: number;
  dailySummary: {
    tone: "great" | "steady" | "rough";
    message: string;
  };
  stats: {
    energy: {
      value: number;
      sleepHours?: number;
      sleepEfficiencyPct?: number;
    };
    happiness: {
      value: number;
      currentMovement?: number;
      baseline30?: number;
      deltaPct?: number;
    };
    health: {
      value: number;
      restingHr7?: number;
      restingHr30?: number;
      delta?: number;
    };
    engagement: {
      value: number;
      loggedDays: number;
      windowDays: number;
    };
  };
  flavorHint: {
    key: HealthPetFlavorKey;
    direction: HealthPetDirection;
    magnitude: number;
  };
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
type InsightRangePreset = "30" | "90" | "365" | "custom";
type RunningRangePreset = "90" | "ytd" | "all" | "custom";
type HeatmapScaleMode = "relative" | "goal";

type ThemeOption = {
  id: string;
  label: string;
  cssFile: string;
  isDefault?: boolean;
};

type ThemeManifest = {
  themes: ThemeOption[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const THEME_STORAGE_KEY = "health-hq-theme";
const THEME_LINK_ID = "theme-stylesheet";
const PET_SUMMARY_ENABLED_KEY = "health-hq-pet-summary-enabled";
const PET_SUMMARY_DISMISSED_DAY_KEY = "health-hq-pet-summary-dismissed-day";
const PET_SUMMARY_EVENT = "health-hq-pet-summary-pref";
const FALLBACK_THEMES: ThemeOption[] = [
  { id: "dark", label: "Dark", cssFile: "/themes/dark.css", isDefault: true },
  { id: "light", label: "Light", cssFile: "/themes/light.css" }
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

function readPetSummaryEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(PET_SUMMARY_ENABLED_KEY) === "true";
}

function writePetSummaryEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PET_SUMMARY_ENABLED_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new Event(PET_SUMMARY_EVENT));
}

function readPetSummaryDismissedDay() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(PET_SUMMARY_DISMISSED_DAY_KEY) ?? "";
}

function writePetSummaryDismissedDay(day: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PET_SUMMARY_DISMISSED_DAY_KEY, day);
  window.dispatchEvent(new Event(PET_SUMMARY_EVENT));
}

const PET_MOOD_LABELS: Record<HealthPetMood, string> = {
  thriving: "Thriving",
  happy: "Happy",
  neutral: "Neutral",
  tired: "Tired",
  unwell: "Unwell",
  lonely: "Lonely"
};

const PET_FLAVOR_TEMPLATES: Record<HealthPetFlavorKey, Record<HealthPetDirection, Array<(pet: HealthPetResponse) => string>>> = {
  energy: {
    up: [
      (pet) => typeof pet.stats.energy.sleepHours === "number"
        ? `Charged up after ${formatHours(pet.stats.energy.sleepHours)} of sleep.`
        : "Charged up after a strong night.",
      (pet) => `Energy is humming today after a strong night.`,
      (pet) => `Plenty of spark in the tank this morning.`
    ],
    down: [
      (pet) => `Running low today after a short night.`,
      (pet) => `A little sleepy right now; tonight's rest can turn it around.`,
      (pet) => `Energy is soft today, easing into recovery mode.`
    ]
  },
  happiness: {
    up: [
      (pet) => `Big bounce from recent movement: ${formatSignedPct(pet.stats.happiness.deltaPct)} vs baseline.`,
      () => "Movement is ahead of normal, so the mood is extra bright.",
      () => "Strong activity trend today and the pet is feeling it."
    ],
    down: [
      (pet) => `Movement is ${formatSignedPct(pet.stats.happiness.deltaPct)} vs baseline, so mood is a bit flat.`,
      () => "A quieter activity day makes the pet a little mopey.",
      () => "Below-normal movement today, keeping things calm and low-key."
    ]
  },
  health: {
    up: [
      () => "Resting heart rate trend looks steady, so your pet seems strong.",
      () => "Vitals trend is in a good lane right now.",
      () => "Heart-rate baseline check looks favorable today."
    ],
    down: [
      () => "Resting heart rate is running above baseline, so the pet looks off-color.",
      () => "A mild stress signal is showing in resting heart rate trend.",
      () => "Health trend is a little strained today; gentle recovery helps."
    ]
  },
  engagement: {
    up: [
      (pet) => `Great check-in rhythm: ${pet.stats.engagement.loggedDays}/${pet.stats.engagement.windowDays} days logged.`,
      () => "Consistent logging keeps your pet attentive and content.",
      () => "Manual check-ins are strong this week; the pet feels cared for."
    ],
    down: [
      (pet) => `Only ${pet.stats.engagement.loggedDays}/${pet.stats.engagement.windowDays} recent logging days, so the pet feels distant.`,
      () => "Fewer recent check-ins make your pet seem a little lonely.",
      () => "Logging cadence dipped this week; the pet is waiting for a check-in."
    ]
  }
};

function hashString(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function formatSignedPct(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0%";
  }

  const asPercent = value * 100;
  const sign = asPercent > 0 ? "+" : "";
  return `${sign}${asPercent.toFixed(0)}%`;
}

function buildPetFlavorText(pet: HealthPetResponse) {
  const direction = pet.flavorHint.direction;
  const templates = PET_FLAVOR_TEMPLATES[pet.flavorHint.key][direction];
  const seed = `${pet.day}:${pet.mood}:${pet.flavorHint.key}:${direction}`;
  const selected = templates[hashString(seed) % templates.length];
  return selected(pet);
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

function getLocalIsoDay(referenceDate = new Date()) {
  const tzOffset = referenceDate.getTimezoneOffset() * 60_000;
  return new Date(referenceDate.getTime() - tzOffset).toISOString().slice(0, 10);
}

function addDaysToIsoDay(isoDay: string, offsetDays: number) {
  const base = new Date(`${isoDay}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function formatHours(hours: number | undefined) {
  if (typeof hours !== "number" || !Number.isFinite(hours)) {
    return "-";
  }
  return `${hours.toFixed(2)} h`;
}

function formatHourMinute(totalMinutes: number) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatIsoWeekLabel(weekKey: string) {
  const [year, week] = weekKey.split("-W");
  if (!year || !week) {
    return weekKey;
  }
  return `W${week} '${year.slice(-2)}`;
}

function shiftedMinuteOfDay(totalMinutes: number) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  return normalized < 18 * 60 ? normalized + 1440 : normalized;
}

function buildInsightQuery(range: {
  preset: InsightRangePreset;
  fromDay: string;
  toDay: string;
}) {
  if (range.preset === "custom") {
    const params = new URLSearchParams();
    params.set("from", range.fromDay);
    params.set("to", range.toDay);
    return params.toString();
  }

  const params = new URLSearchParams();
  params.set("range", range.preset);
  return params.toString();
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

type InsightDateRange = {
  preset: InsightRangePreset;
  fromDay: string;
  toDay: string;
};

type RunningDateRange = {
  preset: RunningRangePreset;
  fromDay: string;
  toDay: string;
};

function createDateRangeFromPreset(preset: Exclude<InsightRangePreset, "custom">): InsightDateRange {
  const toDay = getLocalIsoDay();
  const offset = preset === "30" ? -29 : preset === "90" ? -89 : -364;
  return {
    preset,
    fromDay: addDaysToIsoDay(toDay, offset),
    toDay
  };
}

function DateRangeSelector({
  value,
  onChange,
  includeCustom = true
}: {
  value: InsightDateRange;
  onChange: (next: InsightDateRange) => void;
  includeCustom?: boolean;
}) {
  const presets: InsightRangePreset[] = includeCustom ? ["30", "90", "365", "custom"] : ["30", "90", "365"];

  return (
    <section className="panel controls">
      <div className="chip-row">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`chip ${value.preset === preset ? "chip-active" : ""}`}
            onClick={() => {
              if (preset === "custom") {
                onChange({ ...value, preset: "custom" });
                return;
              }

              onChange(createDateRangeFromPreset(preset));
            }}
          >
            {preset === "custom" ? "Custom" : `${preset} days`}
          </button>
        ))}
      </div>

      {value.preset === "custom" ? (
        <div className="date-range-row">
          <label>
            From
            <input
              type="date"
              value={value.fromDay}
              onChange={(event) => onChange({ ...value, fromDay: event.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={value.toDay}
              onChange={(event) => onChange({ ...value, toDay: event.target.value })}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}

function createRunningDateRangeFromPreset(preset: Exclude<RunningRangePreset, "custom">): RunningDateRange {
  const toDay = getLocalIsoDay();
  if (preset === "90") {
    return {
      preset,
      fromDay: addDaysToIsoDay(toDay, -89),
      toDay
    };
  }

  if (preset === "ytd") {
    return {
      preset,
      fromDay: `${toDay.slice(0, 4)}-01-01`,
      toDay
    };
  }

  return {
    preset,
    fromDay: "2000-01-01",
    toDay
  };
}

function buildRunningInsightQuery(range: RunningDateRange) {
  const params = new URLSearchParams();
  if (range.preset === "custom") {
    params.set("from", range.fromDay);
    params.set("to", range.toDay);
    return params.toString();
  }

  params.set("range", range.preset);
  return params.toString();
}

function RunningDateRangeSelector({
  value,
  onChange
}: {
  value: RunningDateRange;
  onChange: (next: RunningDateRange) => void;
}) {
  const presets: RunningRangePreset[] = ["90", "ytd", "all", "custom"];

  return (
    <section className="panel controls">
      <div className="chip-row">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`chip ${value.preset === preset ? "chip-active" : ""}`}
            onClick={() => {
              if (preset === "custom") {
                onChange({ ...value, preset: "custom" });
                return;
              }

              onChange(createRunningDateRangeFromPreset(preset));
            }}
          >
            {preset === "90" ? "90 days" : preset === "ytd" ? "YTD" : preset === "all" ? "All" : "Custom"}
          </button>
        ))}
      </div>

      {value.preset === "custom" ? (
        <div className="date-range-row">
          <label>
            From
            <input type="date" value={value.fromDay} onChange={(event) => onChange({ ...value, fromDay: event.target.value })} />
          </label>
          <label>
            To
            <input type="date" value={value.toDay} onChange={(event) => onChange({ ...value, toDay: event.target.value })} />
          </label>
        </div>
      ) : null}
    </section>
  );
}

function formatPaceMinPerKm(pace: number | undefined | null) {
  if (typeof pace !== "number" || !Number.isFinite(pace) || pace <= 0) {
    return "-";
  }

  const totalSeconds = Math.round(pace * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`;
}

function formatDurationClock(totalMinutes: number | undefined | null) {
  if (typeof totalMinutes !== "number" || !Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "-";
  }

  const totalSeconds = Math.round(totalMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

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

function RestingHeartRateLines({ points }: { points: RestingHeartRatePoint[] }) {
  const ordered = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const hrValues = ordered.flatMap((point) => [point.restingHr, point.rolling7, point.rolling30]).filter(
    (value): value is number => typeof value === "number"
  );

  if (ordered.length === 0 || hrValues.length === 0) {
    return <p className="empty">No resting heart rate values found in this date range.</p>;
  }

  const width = Math.max(540, ordered.length * 28);
  const height = 220;
  const pad = 24;
  const minY = pad;
  const maxY = height - 32;
  const minHr = Math.min(...hrValues) - 2;
  const maxHr = Math.max(...hrValues) + 2;
  const xStep = ordered.length > 1 ? (width - pad * 2) / (ordered.length - 1) : 1;
  const xFor = (index: number) => pad + xStep * index;
  const yFor = (hr: number) => {
    if (Math.abs(maxHr - minHr) < 0.001) {
      return (minY + maxY) / 2;
    }

    return maxY - ((hr - minHr) / (maxHr - minHr)) * (maxY - minY);
  };

  const pathFor = (selector: (point: RestingHeartRatePoint) => number | undefined) => {
    let hasSegment = false;
    return ordered
      .map((point, index) => {
        const value = selector(point);
        if (typeof value !== "number") {
          hasSegment = false;
          return "";
        }

        const command = hasSegment ? "L" : "M";
        hasSegment = true;
        return `${command}${xFor(index)},${yFor(value)}`;
      })
      .join(" ")
      .trim();
  };

  const restingPath = pathFor((point) => point.restingHr);
  const rolling7Path = pathFor((point) => point.rolling7);
  const rolling30Path = pathFor((point) => point.rolling30);

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Resting heart rate trend with rolling averages">
        <line x1={pad} y1={maxY} x2={width - pad} y2={maxY} className="chart-axis" />
        {rolling30Path ? <path d={rolling30Path} className="line-rhr-30" /> : null}
        {rolling7Path ? <path d={rolling7Path} className="line-rhr-7" /> : null}
        {restingPath ? <path d={restingPath} className="line-rhr" /> : null}
        {ordered.map((point, index) => {
          if (typeof point.restingHr !== "number") {
            return null;
          }

          const isLabelPoint = index === 0 || index === ordered.length - 1 || index === Math.floor(ordered.length / 2);
          return (
            <g key={`${point.day}-${index}`}>
              <circle cx={xFor(index)} cy={yFor(point.restingHr)} r={point.isAnomaly ? 4.2 : 2.8} className={point.isAnomaly ? "dot-anomaly" : "dot-rhr"} />
              {isLabelPoint ? (
                <text x={xFor(index)} y={height - 9} textAnchor="middle" className="chart-label">
                  {formatDay(point.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="legend">Solid: daily RHR, dashed: 7d avg, dotted: 30d avg. Red markers show days above baseline + 1 SD.</p>
    </div>
  );
}

function SleepStagesStackedBars({ points }: { points: SleepStagesPoint[] }) {
  const ordered = [...points].sort((a, b) => a.day.localeCompare(b.day));
  if (ordered.length === 0) {
    return <p className="empty">No sleep stage data yet.</p>;
  }

  const width = Math.max(520, ordered.length * 26);
  const height = 222;
  const pad = 24;
  const maxY = height - 32;
  const minY = pad;
  const chartHeight = maxY - minY;
  const gap = 7;
  const barWidth = Math.max(5, Math.floor((width - pad * 2 - gap * (ordered.length - 1)) / ordered.length));
  const maxTotal = Math.max(...ordered.map((point) => point.totalSleepHours + point.awakeHours), 1);

  let totalHasSegment = false;
  const linePath = ordered
    .map((point, index) => {
      if (!point.hasData) {
        totalHasSegment = false;
        return "";
      }
      const x = pad + index * (barWidth + gap) + barWidth / 2;
      const y = maxY - ((point.totalSleepHours / maxTotal) * chartHeight);
      const command = totalHasSegment ? "L" : "M";
      totalHasSegment = true;
      return `${command}${x},${y}`;
    })
    .join(" ")
    .trim();

  let rollingHasSegment = false;
  const rollingPath = ordered
    .map((point, index) => {
      if (typeof point.rolling7SleepHours !== "number") {
        rollingHasSegment = false;
        return "";
      }
      const x = pad + index * (barWidth + gap) + barWidth / 2;
      const y = maxY - ((point.rolling7SleepHours / maxTotal) * chartHeight);
      const command = rollingHasSegment ? "L" : "M";
      rollingHasSegment = true;
      return `${command}${x},${y}`;
    })
    .join(" ")
    .trim();

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sleep stage composition over time">
        <line x1={pad} y1={maxY} x2={width - pad} y2={maxY} className="chart-axis" />
        {ordered.map((point, index) => {
          const x = pad + index * (barWidth + gap);
          const isLabelPoint = index === 0 || index === ordered.length - 1 || index === Math.floor(ordered.length / 2);

          if (!point.hasData) {
            return (
              <g key={`${point.day}-empty`}>
                <rect x={x} y={maxY - 2} width={barWidth} height={2} rx={1} className="bar-missing" />
                {isLabelPoint ? (
                  <text x={x + barWidth / 2} y={height - 9} textAnchor="middle" className="chart-label">
                    {formatDay(point.day)}
                  </text>
                ) : null}
              </g>
            );
          }

          const segments = [
            { className: "bar-stage-deep", value: point.deepHours },
            { className: "bar-stage-light", value: point.lightHours },
            { className: "bar-stage-rem", value: point.remHours },
            { className: "bar-stage-awake", value: point.awakeHours }
          ];

          let currentY = maxY;

          return (
            <g key={point.day}>
              {segments.map((segment) => {
                const segmentHeight = Math.max(1, (segment.value / maxTotal) * chartHeight);
                currentY -= segmentHeight;
                return <rect key={`${point.day}-${segment.className}`} x={x} y={currentY} width={barWidth} height={segmentHeight} rx={2} className={segment.className} />;
              })}
              {isLabelPoint ? (
                <text x={x + barWidth / 2} y={height - 9} textAnchor="middle" className="chart-label">
                  {formatDay(point.day)}
                </text>
              ) : null}
            </g>
          );
        })}
        {linePath ? <path d={linePath} className="line-sleep-total" /> : null}
        {rollingPath ? <path d={rollingPath} className="line-sleep-rolling" /> : null}
      </svg>
      <p className="legend">Stacked bars: deep/light/REM/awake. Solid line: total sleep. Dashed line: 7-day average.</p>
    </div>
  );
}

function SleepScheduleScatter({ points }: { points: SleepStagesPoint[] }) {
  const ordered = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const withSchedule = ordered.filter((point) => typeof point.bedtimeMinute === "number" || typeof point.wakeMinute === "number");
  if (withSchedule.length < 2) {
    return <p className="empty">Not enough bedtime/wake-time points in this range.</p>;
  }

  const width = Math.max(520, ordered.length * 26);
  const height = 210;
  const pad = 24;
  const maxY = height - 34;
  const minY = pad;
  const xStep = ordered.length > 1 ? (width - pad * 2) / (ordered.length - 1) : 1;

  const yFor = (minute: number) => {
    const shifted = shiftedMinuteOfDay(minute);
    const minMinute = 18 * 60;
    const maxMinute = 36 * 60;
    return maxY - ((shifted - minMinute) / (maxMinute - minMinute)) * (maxY - minY);
  };

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bedtime and wake-time consistency">
        <line x1={pad} y1={maxY} x2={width - pad} y2={maxY} className="chart-axis" />
        {[18 * 60, 24 * 60, 30 * 60, 36 * 60].map((tick) => (
          <g key={tick}>
            <line x1={pad} y1={yFor(tick)} x2={width - pad} y2={yFor(tick)} className="chart-gridline" />
            <text x={6} y={yFor(tick) + 4} className="chart-label">{formatHourMinute(tick)}</text>
          </g>
        ))}
        {ordered.map((point, index) => {
          const x = pad + index * xStep;
          const isLabelPoint = index === 0 || index === ordered.length - 1 || index === Math.floor(ordered.length / 2);
          return (
            <g key={point.day}>
              {typeof point.bedtimeMinute === "number" ? <circle cx={x} cy={yFor(point.bedtimeMinute)} r={3.6} className="dot-bedtime" /> : null}
              {typeof point.wakeMinute === "number" ? <circle cx={x} cy={yFor(point.wakeMinute)} r={3.6} className="dot-waketime" /> : null}
              {isLabelPoint ? (
                <text x={x} y={height - 8} textAnchor="middle" className="chart-label">
                  {formatDay(point.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="legend">Blue dots: bedtime. Gold dots: wake time. Y-axis runs 18:00 to 12:00 to expose irregular schedules.</p>
    </div>
  );
}

function StepsCalendarHeatmap({
  points,
  scaleMode,
  goal
}: {
  points: StepsHeatmapPoint[];
  scaleMode: HeatmapScaleMode;
  goal: number;
}) {
  if (points.length === 0) {
    return <p className="empty">No steps data available for this range.</p>;
  }

  const ordered = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const firstDate = new Date(`${ordered[0].day}T00:00:00Z`);
  const firstDayOfWeek = firstDate.getUTCDay();
  const padded: Array<StepsHeatmapPoint | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    padded.push(null);
  }
  padded.push(...ordered);

  const maxSteps = Math.max(...ordered.map((point) => point.steps), 1);
  const minSteps = Math.min(...ordered.filter((point) => point.hasData).map((point) => point.steps), 0);
  const cells = padded.map((point, index) => {
    if (!point) {
      return <span key={`pad-${index}`} className="heatmap-cell heatmap-cell-empty" />;
    }

    const ratio =
      scaleMode === "goal"
        ? Math.min(1, point.steps / Math.max(goal, 1))
        : maxSteps <= minSteps
          ? 0
          : Math.max(0, Math.min(1, (point.steps - minSteps) / (maxSteps - minSteps)));
    const intensity = point.hasData ? ratio : 0;
    const bg = point.hasData
      ? `color-mix(in srgb, var(--heatmap-low) ${100 - Math.round(intensity * 100)}%, var(--heatmap-high) ${Math.round(intensity * 100)}%)`
      : "var(--heatmap-empty)";

    return (
      <Link
        key={point.day}
        to={`/steps/${point.day}`}
        className="heatmap-cell"
        style={{ background: bg }}
        title={`${formatDay(point.day)}: ${point.steps.toLocaleString()} steps`}
        aria-label={`${point.day} with ${point.steps.toLocaleString()} steps`}
      >
        <span className="sr-only">{point.steps}</span>
      </Link>
    );
  });

  return (
    <div className="stack">
      <div className="heatmap-grid">{cells}</div>
      <p className="legend">Tap any day for exact steps; from there you can jump into daily sleep details.</p>
    </div>
  );
}

function CorrelationScatter({ points, metricA, metricB }: { points: CorrelationPoint[]; metricA: string; metricB: string }) {
  if (points.length < 2) {
    return <p className="empty">Not enough paired days to compute a meaningful correlation.</p>;
  }

  const width = Math.max(420, points.length * 16);
  const height = 250;
  const pad = 28;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const xFor = (value: number) => {
    if (Math.abs(maxX - minX) < 0.0001) return width / 2;
    return pad + ((value - minX) / (maxX - minX)) * (width - pad * 2);
  };
  const yFor = (value: number) => {
    if (Math.abs(maxY - minY) < 0.0001) return height / 2;
    return height - pad - ((value - minY) / (maxY - minY)) * (height - pad * 2);
  };

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metricA} vs ${metricB} scatter plot`}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="chart-axis" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="chart-axis" />
        {points.map((point) => (
          <circle key={`${point.day}-${point.compareDay}`} cx={xFor(point.x)} cy={yFor(point.y)} r={3.4} className="dot-correlation" />
        ))}
      </svg>
      <p className="legend">X: {metricA}. Y: {metricB}. Each dot is one lag-aligned day pair.</p>
    </div>
  );
}

function WeeklyLoadChart({ points }: { points: WeeklyLoadPoint[] }) {
  if (points.length === 0) {
    return <p className="empty">No weekly load data available for this range.</p>;
  }

  const sorted = [...points].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const width = Math.max(560, sorted.length * 40);
  const height = 240;
  const pad = 24;
  const maxY = height - 34;
  const minY = pad;
  const chartHeight = maxY - minY;
  const gap = 10;
  const barWidth = Math.max(8, Math.floor((width - pad * 2 - gap * (sorted.length - 1)) / sorted.length));
  const maxDuration = Math.max(...sorted.map((point) => point.totalDurationMinutes), 1);
  const palette = ["var(--stack-a)", "var(--stack-b)", "var(--stack-c)", "var(--stack-d)", "var(--stack-e)"];
  const typeColor = new Map<string, string>();
  let colorIndex = 0;

  sorted.forEach((point) => {
    point.byType.forEach((segment) => {
      if (!typeColor.has(segment.type)) {
        typeColor.set(segment.type, palette[colorIndex % palette.length]);
        colorIndex++;
      }
    });
  });

  let trendHasSegment = false;
  const trendPath = sorted
    .map((point, index) => {
      const x = pad + index * (barWidth + gap) + barWidth / 2;
      const y = maxY - ((point.totalDurationMinutes / maxDuration) * chartHeight);
      const command = trendHasSegment ? "L" : "M";
      trendHasSegment = true;
      return `${command}${x},${y}`;
    })
    .join(" ");

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weekly training load with warning flags">
        <line x1={pad} y1={maxY} x2={width - pad} y2={maxY} className="chart-axis" />
        {sorted.map((point, index) => {
          const x = pad + index * (barWidth + gap);
          let cursorY = maxY;
          const isLabelPoint = index === 0 || index === sorted.length - 1 || index === Math.floor(sorted.length / 2);
          return (
            <g key={point.weekStart}>
              {point.byType.map((segment) => {
                const segmentHeight = Math.max(1, (segment.durationMinutes / maxDuration) * chartHeight);
                cursorY -= segmentHeight;
                return (
                  <rect
                    key={`${point.weekStart}-${segment.type}`}
                    x={x}
                    y={cursorY}
                    width={barWidth}
                    height={segmentHeight}
                    rx={2}
                    style={{ fill: typeColor.get(segment.type) }}
                  />
                );
              })}
              {point.spikeWarning ? <circle cx={x + barWidth / 2} cy={minY + 6} r={4} className="dot-warning" /> : null}
              {point.detrainingWarning ? <rect x={x + barWidth / 2 - 4} y={minY + 12} width={8} height={8} className="dot-detrain" /> : null}
              {isLabelPoint ? (
                <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="chart-label">
                  {formatIsoWeekLabel(point.weekKey)}
                </text>
              ) : null}
            </g>
          );
        })}
        <path d={trendPath} className="line-trend" />
      </svg>
      <p className="legend">Dot = spike warning (&gt;50% over trailing 4-week avg). Square = de-training warning (&lt;25% for 2+ weeks).</p>
    </div>
  );
}

function HrZoneStackedBars({ points }: { points: HrZonePoint[] }) {
  if (points.length === 0) {
    return <p className="empty">No HR zone distribution available in this range.</p>;
  }

  const ordered = [...points].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const maxTotal = Math.max(...ordered.map((point) => point.totalMinutes), 1);

  return (
    <div className="stack">
      {ordered.map((point) => {
        const segments = [
          { label: "Z1", value: point.zone1Minutes, className: "zone-1" },
          { label: "Z2", value: point.zone2Minutes, className: "zone-2" },
          { label: "Z3", value: point.zone3Minutes, className: "zone-3" },
          { label: "Z4", value: point.zone4Minutes, className: "zone-4" },
          { label: "Z5", value: point.zone5Minutes, className: "zone-5" }
        ];

        return (
          <div key={point.periodStart} className="zone-row">
            <div className="zone-row-header">
              <strong>{point.label}</strong>
              <span className="muted">{Math.round(point.totalMinutes)} min total</span>
            </div>
            <div className="zone-bar-shell">
              {segments.map((segment) => (
                <div
                  key={`${point.periodStart}-${segment.label}`}
                  className={`zone-segment ${segment.className}`}
                  style={{ width: `${Math.max(0, (segment.value / maxTotal) * 100)}%` }}
                  title={`${segment.label}: ${segment.value.toFixed(1)} min`}
                />
              ))}
            </div>
          </div>
        );
      })}
      <p className="legend">Zone model uses 5 bands from % of configured max heart rate.</p>
    </div>
  );
}

function StressBatteryTimeline({ data }: { data: StressBodyBatteryResponse }) {
  if (!data.available) {
    return <p className="empty">{data.message}</p>;
  }

  const width = 760;
  const height = 230;
  const pad = 26;
  const minY = pad;
  const maxY = height - 30;
  const xFor = (minute: number) => pad + (Math.max(0, Math.min(1440, minute)) / 1440) * (width - pad * 2);
  const values = [...data.stressPoints.map((point) => point.value), ...data.bodyBatteryPoints.map((point) => point.value)];
  const minValue = values.length === 0 ? 0 : Math.min(...values);
  const maxValue = values.length === 0 ? 100 : Math.max(...values);
  const yFor = (value: number) => {
    if (Math.abs(maxValue - minValue) < 0.001) {
      return (minY + maxY) / 2;
    }
    return maxY - ((value - minValue) / (maxValue - minValue)) * (maxY - minY);
  };

  const makePath = (points: StressPoint[]) => {
    if (points.length === 0) return "";
    return points
      .sort((a, b) => a.minute - b.minute)
      .map((point, index) => `${index === 0 ? "M" : "L"}${xFor(point.minute)},${yFor(point.value)}`)
      .join(" ");
  };

  const stressPath = makePath(data.stressPoints);
  const batteryPath = makePath(data.bodyBatteryPoints);

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Stress and body battery over the day">
        <line x1={pad} y1={maxY} x2={width - pad} y2={maxY} className="chart-axis" />
        {data.sleepWindow ? (
          <rect
            x={xFor(data.sleepWindow.startMinute)}
            y={minY}
            width={Math.max(2, xFor(data.sleepWindow.endMinute) - xFor(data.sleepWindow.startMinute))}
            height={maxY - minY}
            className="timeline-sleep"
          />
        ) : null}
        {data.activityBlocks.map((activity) => (
          <rect
            key={activity.id}
            x={xFor(activity.startMinute)}
            y={maxY + 3}
            width={Math.max(2, xFor(activity.endMinute) - xFor(activity.startMinute))}
            height={8}
            className="timeline-activity"
          />
        ))}
        {stressPath ? <path d={stressPath} className="line-stress" /> : null}
        {batteryPath ? <path d={batteryPath} className="line-battery" /> : null}
      </svg>
      <p className="legend">Stress line + body battery line with sleep shading and activity blocks at the bottom.</p>
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

function HealthPetAvatar({ mood, isNightTime, compact = false }: { mood: HealthPetMood; isNightTime: boolean; compact?: boolean }) {
  return (
    <div className={`pet-avatar pet-avatar-${mood} ${compact ? "pet-avatar-compact" : ""} ${isNightTime ? "pet-avatar-night" : ""}`} aria-hidden="true">
      <div className="pet-ears" />
      <div className="pet-face">
        <span className="pet-eye pet-eye-left" />
        <span className="pet-eye pet-eye-right" />
        <span className="pet-mouth" />
      </div>
      <div className="pet-body" />
    </div>
  );
}

function HealthPetStatRow({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="pet-stat-row">
      <p className="muted">{label}</p>
      <p className="value small">{Math.round(clamped)}</p>
      <div className="pet-stat-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped)} aria-label={label}>
        <div className="pet-stat-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function HealthPetWidget() {
  const location = useLocation();
  const { data } = useFetch<HealthPetResponse>("/api/dashboard/health-pet");
  if (location.pathname === "/pet") {
    return null;
  }

  const mood = data?.mood ?? "neutral";
  return (
    <Link className="pet-widget" to="/pet" aria-label="Open health pet">
      <HealthPetAvatar mood={mood} isNightTime={Boolean(data?.isNightTime)} compact />
      <div className="pet-widget-copy">
        <p className="eyebrow">Health pet</p>
        <p>{PET_MOOD_LABELS[mood]}</p>
      </div>
    </Link>
  );
}

function HealthPetDailyBanner() {
  const location = useLocation();
  const { data } = useFetch<HealthPetResponse>("/api/dashboard/health-pet");
  const [enabled, setEnabled] = React.useState(readPetSummaryEnabled);
  const [dismissedDay, setDismissedDay] = React.useState(readPetSummaryDismissedDay);

  React.useEffect(() => {
    const refresh = () => {
      setEnabled(readPetSummaryEnabled());
      setDismissedDay(readPetSummaryDismissedDay());
    };

    window.addEventListener("storage", refresh);
    window.addEventListener(PET_SUMMARY_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(PET_SUMMARY_EVENT, refresh);
    };
  }, []);

  if (!enabled || !data || dismissedDay === data.day || location.pathname === "/pet") {
    return null;
  }

  const toneClass = `pet-banner-${data.dailySummary.tone}`;

  return (
    <section className={`pet-banner ${toneClass}`}>
      <p className="pet-banner-copy">{data.dailySummary.message}</p>
      <div className="pet-banner-actions">
        <Link className="button button-compact" to="/pet">Open pet</Link>
        <button className="button button-compact" type="button" onClick={() => writePetSummaryDismissedDay(data.day)}>Dismiss</button>
      </div>
    </section>
  );
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
            <Link to="/insights">Insights</Link>
            <Link to="/training">Training</Link>
            <Link to="/settings">Settings</Link>
            <Link to="/shopping">Shopping</Link>
            <Link to="/body">Body</Link>
            <Link to="/pet">Pet</Link>
          </nav>
        </div>
      </header>
      <main>
        <HealthPetDailyBanner />
        {children}
      </main>
      <HealthPetWidget />
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

function InsightsHubPage() {
  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insights</p>
          <h2>Trend and recovery explorer</h2>
          <p className="muted">Use the dedicated views for resting HR, sleep stages, daily activity rhythm, and monthly deltas.</p>
        </div>
      </header>

      <div className="grid dashboard-grid">
        <article className="panel stack">
          <h3>Running analytics</h3>
          <p className="muted">Pace, volume, efficiency, pacing consistency, PR detection, and race projection in one running-specific screen.</p>
          <Link className="button" to="/insights/running">Open running analytics</Link>
        </article>

        <article className="panel stack">
          <h3>Resting heart rate trend</h3>
          <p className="muted">Monitor 7-day and 30-day overlays and anomaly days above baseline + 1 SD.</p>
          <Link className="button" to="/insights/resting-heart-rate">Open RHR trend</Link>
        </article>

        <article className="panel stack">
          <h3>Sleep stages over time</h3>
          <p className="muted">Inspect deep/light/REM/awake composition with total and rolling sleep trends.</p>
          <Link className="button" to="/insights/sleep-stages">Open sleep stages</Link>
        </article>

        <article className="panel stack">
          <h3>Steps calendar heatmap</h3>
          <p className="muted">Spot streaks and slumps with a contributions-style view of daily steps.</p>
          <Link className="button" to="/insights/steps-heatmap">Open steps heatmap</Link>
        </article>

        <article className="panel stack">
          <h3>Monthly life dashboard</h3>
          <p className="muted">See month-over-month deltas and deep-link into each detailed view.</p>
          <Link className="button" to="/insights/monthly">Open monthly dashboard</Link>
        </article>

        <article className="panel stack">
          <h3>Cross-metric correlation explorer</h3>
          <p className="muted">Test your own hypotheses with lag-aware daily metric scatter plots.</p>
          <Link className="button" to="/insights/correlation">Open correlation explorer</Link>
        </article>

        <article className="panel stack">
          <h3>Activity to next-night sleep</h3>
          <p className="muted">Pick a workout and inspect the immediately following night’s sleep profile.</p>
          <Link className="button" to="/insights/activity-next-sleep">Open activity to sleep detail</Link>
        </article>

        <article className="panel stack">
          <h3>Weekly training load summary</h3>
          <p className="muted">Track trend direction with spike and de-training warnings.</p>
          <Link className="button" to="/insights/weekly-load">Open weekly load summary</Link>
        </article>

        <article className="panel stack">
          <h3>HR zone distribution</h3>
          <p className="muted">Understand time in zone by week or month with configurable max HR.</p>
          <Link className="button" to="/insights/hr-zones">Open HR zone distribution</Link>
        </article>

        <article className="panel stack">
          <h3>Body battery and stress (optional)</h3>
          <p className="muted">Checks whether stress/body battery series are present and charts the day if available.</p>
          <Link className="button" to="/insights/stress-battery">Open stress timeline</Link>
        </article>
      </div>
    </section>
  );
}

function RestingHeartRatePage() {
  const [range, setRange] = React.useState<InsightDateRange>(() => createDateRangeFromPreset("90"));
  const query = React.useMemo(() => buildInsightQuery(range), [range]);
  const { data, loading, error } = useFetch<RestingHeartRateResponse>(`/api/dashboard/resting-heart-rate?${query}`);

  if (loading) return <p>Loading resting heart rate trends...</p>;
  if (error || !data) return <p>Could not load resting heart rate trends.</p>;

  const anomalies = data.points.filter((point) => point.isAnomaly).length;
  const latest = [...data.points].reverse().find((point) => typeof point.restingHr === "number");

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insight screen 1</p>
          <h2>Resting heart rate trend</h2>
          <p className="muted">Long-term cardiovascular trend with anomaly highlighting for illness, overtraining, or poor recovery.</p>
        </div>
        <Link className="button" to="/insights">Back to insights hub</Link>
      </header>

      <DateRangeSelector value={range} onChange={setRange} />

      <div className="grid cards-grid">
        <article className="card">
          <h3>Days with data</h3>
          <p className="value">{data.availableDays}</p>
          <p className="hint">In selected range</p>
        </article>
        <article className="card">
          <h3>Anomaly days</h3>
          <p className="value">{anomalies}</p>
          <p className="hint">RHR above 30d avg + 1 SD</p>
        </article>
        <article className="card">
          <h3>Latest RHR</h3>
          <p className="value">{latest?.restingHr ?? "-"}</p>
          <p className="hint">Most recent day with value</p>
        </article>
        <article className="card">
          <h3>Latest 30d avg</h3>
          <p className="value">{latest?.rolling30?.toFixed(1) ?? "-"}</p>
          <p className="hint">Baseline trendline</p>
        </article>
      </div>

      <article className="panel">
        <h3>RHR with 7d/30d rolling averages</h3>
        <RestingHeartRateLines points={data.points} />
      </article>
    </section>
  );
}

function SleepStagesPage() {
  const [range, setRange] = React.useState<InsightDateRange>(() => createDateRangeFromPreset("90"));
  const query = React.useMemo(() => buildInsightQuery(range), [range]);
  const { data, loading, error } = useFetch<SleepStagesResponse>(`/api/dashboard/sleep-stages?${query}`);

  if (loading) return <p>Loading sleep stage trends...</p>;
  if (error || !data) return <p>Could not load sleep stage trends.</p>;

  const recordedDays = data.points.filter((point) => point.hasData);
  const averageSleep = recordedDays.length === 0
    ? null
    : recordedDays.reduce((sum, point) => sum + point.totalSleepHours, 0) / recordedDays.length;
  const latestRecorded = recordedDays.length === 0 ? null : recordedDays[recordedDays.length - 1];

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insight screen 2</p>
          <h2>Sleep stages over time</h2>
          <p className="muted">Track sleep quality trends, stage composition, and schedule consistency.</p>
        </div>
        <Link className="button" to="/insights">Back to insights hub</Link>
      </header>

      <DateRangeSelector value={range} onChange={setRange} />

      <div className="grid cards-grid">
        <article className="card">
          <h3>Nights with data</h3>
          <p className="value">{recordedDays.length}</p>
          <p className="hint">Selected range</p>
        </article>
        <article className="card">
          <h3>Average sleep</h3>
          <p className="value">{averageSleep ? `${averageSleep.toFixed(2)} h` : "-"}</p>
          <p className="hint">Per night</p>
        </article>
        <article className="card">
          <h3>Latest total</h3>
          <p className="value">{formatHours(latestRecorded?.totalSleepHours)}</p>
          <p className="hint">Most recent night</p>
        </article>
        <article className="card">
          <h3>Latest 7d avg</h3>
          <p className="value">{formatHours(latestRecorded?.rolling7SleepHours)}</p>
          <p className="hint">Rolling mean</p>
        </article>
      </div>

      <article className="panel">
        <h3>Stage composition + total sleep overlay</h3>
        <SleepStagesStackedBars points={data.points} />
      </article>

      <article className="panel">
        <h3>Bedtime and wake-time consistency</h3>
        <SleepScheduleScatter points={data.points} />
      </article>
    </section>
  );
}

function StepsHeatmapPage() {
  const [range, setRange] = React.useState<InsightDateRange>(() => createDateRangeFromPreset("365"));
  const [scaleMode, setScaleMode] = React.useState<HeatmapScaleMode>("relative");
  const [goal, setGoal] = React.useState(10000);
  const query = React.useMemo(() => buildInsightQuery(range), [range]);
  const { data, loading, error } = useFetch<StepsHeatmapResponse>(`/api/dashboard/steps-heatmap?${query}`);

  React.useEffect(() => {
    if (data?.defaultGoal) {
      setGoal(data.defaultGoal);
    }
  }, [data?.defaultGoal]);

  if (loading) return <p>Loading steps heatmap...</p>;
  if (error || !data) return <p>Could not load steps heatmap.</p>;

  const activeDays = data.points.filter((point) => point.hasData && point.steps > 0).length;
  const bestDay = [...data.points].sort((a, b) => b.steps - a.steps)[0];

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insight screen 3</p>
          <h2>Steps calendar heatmap</h2>
          <p className="muted">GitHub-style daily activity map for streaks, slumps, and seasonal patterns.</p>
        </div>
        <Link className="button" to="/insights">Back to insights hub</Link>
      </header>

      <DateRangeSelector value={range} onChange={setRange} />

      <section className="panel controls">
        <div className="chip-row">
          <button type="button" className={`chip ${scaleMode === "relative" ? "chip-active" : ""}`} onClick={() => setScaleMode("relative")}>
            Personal min/max
          </button>
          <button type="button" className={`chip ${scaleMode === "goal" ? "chip-active" : ""}`} onClick={() => setScaleMode("goal")}>
            Goal-based
          </button>
        </div>
        {scaleMode === "goal" ? (
          <div className="goal-row">
            <label>
              Daily goal (steps)
              <input
                type="number"
                min={1000}
                step={500}
                value={goal}
                onChange={(event) => setGoal(Math.max(1000, Number(event.target.value) || 10000))}
              />
            </label>
          </div>
        ) : null}
      </section>

      <div className="grid cards-grid">
        <article className="card">
          <h3>Active days</h3>
          <p className="value">{activeDays}</p>
          <p className="hint">Days with recorded steps</p>
        </article>
        <article className="card">
          <h3>Best day</h3>
          <p className="value small">{bestDay ? bestDay.steps.toLocaleString() : "-"}</p>
          <p className="hint">{bestDay ? formatDay(bestDay.day) : "No data"}</p>
        </article>
        <article className="card">
          <h3>Range max</h3>
          <p className="value">{data.maxSteps.toLocaleString()}</p>
          <p className="hint">Highest daily count</p>
        </article>
        <article className="card">
          <h3>Goal</h3>
          <p className="value">{goal.toLocaleString()}</p>
          <p className="hint">Used in goal scale mode</p>
        </article>
      </div>

      <article className="panel">
        <h3>Daily steps heatmap</h3>
        <StepsCalendarHeatmap points={data.points} scaleMode={scaleMode} goal={goal} />
      </article>
    </section>
  );
}

function MonthlyLifeDashboardPage() {
  const [month, setMonth] = React.useState(() => getLocalIsoDay().slice(0, 7));
  const { data, loading, error } = useFetch<MonthlyLifeResponse>(`/api/dashboard/monthly-life?month=${month}`);

  if (loading) return <p>Loading monthly life dashboard...</p>;
  if (error || !data) return <p>Could not load monthly life dashboard.</p>;

  const deltaLabel = (value: number | undefined, suffix = "") => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "No baseline";
    }

    const arrow = value > 0 ? "↑" : value < 0 ? "↓" : "→";
    return `${arrow} ${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
  };

  const cards: Array<{ title: string; value: string; delta: string; to: string }> = [
    {
      title: "Avg resting HR",
      value: data.current.avgRestingHr == null ? "-" : `${data.current.avgRestingHr.toFixed(1)} bpm`,
      delta: deltaLabel(data.deltas.avgRestingHr, " bpm"),
      to: "/insights/resting-heart-rate"
    },
    {
      title: "Avg total sleep",
      value: data.current.avgSleepHours == null ? "-" : `${data.current.avgSleepHours.toFixed(2)} h`,
      delta: deltaLabel(data.deltas.avgSleepHours, " h"),
      to: "/insights/sleep-stages"
    },
    {
      title: "Avg deep sleep %",
      value: data.current.avgDeepSleepPct == null ? "-" : `${data.current.avgDeepSleepPct.toFixed(1)}%`,
      delta: deltaLabel(data.deltas.avgDeepSleepPct, "%"),
      to: "/insights/sleep-stages"
    },
    {
      title: "Total steps",
      value: data.current.totalSteps.toLocaleString(),
      delta: deltaLabel(data.deltas.totalSteps),
      to: "/insights/steps-heatmap"
    },
    {
      title: "Total active minutes",
      value: Math.round(data.current.totalActiveMinutes).toLocaleString(),
      delta: deltaLabel(data.deltas.totalActiveMinutes),
      to: "/insights/weekly-load"
    },
    {
      title: "Longest single activity",
      value: data.current.longestActivityLabel,
      delta: deltaLabel(data.deltas.longestActivityScore),
      to: "/insights/activity-next-sleep"
    },
    {
      title: "Number of active days",
      value: String(data.current.activeDays),
      delta: deltaLabel(data.deltas.activeDays),
      to: "/insights/weekly-load"
    }
  ];

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insight screen 8</p>
          <h2>Monthly life dashboard</h2>
          <p className="muted">One-glance monthly summary with deltas versus the previous month.</p>
        </div>
        <Link className="button" to="/insights">Back to insights hub</Link>
      </header>

      <section className="panel controls">
        <label className="month-picker">
          Month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </section>

      <div className="grid cards-grid">
        {cards.map((card) => (
          <Link key={card.title} to={card.to} className="card card-link">
            <h3>{card.title}</h3>
            <p className="value small">{card.value}</p>
            <p className="hint">{card.delta} vs previous month</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CorrelationExplorerPage() {
  const [range, setRange] = React.useState<InsightDateRange>(() => createDateRangeFromPreset("90"));
  const [metricA, setMetricA] = React.useState("activeMinutes");
  const [metricB, setMetricB] = React.useState("deepSleepMinutes");
  const [lag, setLag] = React.useState(1);

  const query = React.useMemo(() => {
    const params = new URLSearchParams(buildInsightQuery(range));
    params.set("metricA", metricA);
    params.set("metricB", metricB);
    params.set("lag", String(lag));
    return params.toString();
  }, [range, metricA, metricB, lag]);

  const { data, loading, error } = useFetch<CorrelationResponse>(`/api/dashboard/correlation?${query}`);

  if (loading) return <p>Loading cross-metric correlation...</p>;
  if (error || !data) return <p>Could not load correlation explorer.</p>;

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insight screen 6</p>
          <h2>Cross-metric correlation explorer</h2>
          <p className="muted">Compare two daily metrics and inspect lagged relationships with Pearson correlation.</p>
        </div>
        <Link className="button" to="/insights">Back to insights hub</Link>
      </header>

      <DateRangeSelector value={range} onChange={setRange} />

      <section className="panel controls">
        <div className="filter-row">
          <label>
            Metric A
            <select value={metricA} onChange={(event) => setMetricA(event.target.value)}>
              {data.metricOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Metric B
            <select value={metricB} onChange={(event) => setMetricB(event.target.value)}>
              {data.metricOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Lag (days)
            <input type="number" min={-7} max={7} step={1} value={lag} onChange={(event) => setLag(Math.max(-7, Math.min(7, Number(event.target.value) || 0)))} />
          </label>
        </div>
      </section>

      <div className="grid cards-grid">
        <article className="card">
          <h3>Pearson r</h3>
          <p className="value">{typeof data.correlation === "number" ? data.correlation.toFixed(3) : "-"}</p>
          <p className="hint">Correlation coefficient</p>
        </article>
        <article className="card">
          <h3>Data pairs</h3>
          <p className="value">{data.points.length}</p>
          <p className="hint">Lag-aligned days</p>
        </article>
      </div>

      <article className="panel">
        <h3>Daily scatter</h3>
        <CorrelationScatter points={data.points} metricA={metricA} metricB={metricB} />
      </article>
    </section>
  );
}

function ActivityNextSleepPage() {
  const [range, setRange] = React.useState<InsightDateRange>(() => createDateRangeFromPreset("90"));
  const candidatesQuery = React.useMemo(() => buildInsightQuery(range), [range]);
  const { data: candidatesData, loading: candidatesLoading, error: candidatesError } = useFetch<{ candidates: ActivityNextSleepCandidate[] }>(`/api/dashboard/activity-next-sleep/candidates?${candidatesQuery}`);
  const [selectedId, setSelectedId] = React.useState<string>("");

  React.useEffect(() => {
    if (!selectedId && candidatesData?.candidates && candidatesData.candidates.length > 0) {
      setSelectedId(candidatesData.candidates[0].id);
    }
  }, [candidatesData?.candidates, selectedId]);

  const { data, loading, error } = useFetch<ActivityNextSleepResponse>(selectedId ? `/api/dashboard/activity-next-sleep/${selectedId}` : "");

  if (candidatesLoading) return <p>Loading activity candidates...</p>;
  if (candidatesError || !candidatesData) return <p>Could not load activity candidates.</p>;

  const sleepPoint: SleepStagesPoint[] = data?.sleep
    ? [{
      day: data.sleep.day,
      hasData: true,
      deepHours: data.sleep.deepSleepHours,
      lightHours: data.sleep.lightSleepHours,
      remHours: data.sleep.remSleepHours,
      awakeHours: data.sleep.awakeHours,
      totalSleepHours: data.sleep.totalSleepHours,
      rolling7SleepHours: data.comparison.averageSleepHours,
      bedtimeMinute: undefined,
      wakeMinute: undefined
    }]
    : [];

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insight screen 7</p>
          <h2>Activity to next-night sleep detail</h2>
          <p className="muted">Select an activity and inspect how the following night compares to your 30-day baseline.</p>
        </div>
        <Link className="button" to="/insights">Back to insights hub</Link>
      </header>

      <DateRangeSelector value={range} onChange={setRange} />

      <section className="panel controls">
        <label>
          Activity
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {candidatesData.candidates.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {new Date(activity.startTime).toLocaleDateString()} - {activity.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? <p>Loading selected activity detail...</p> : null}
      {error || !data ? <p>Select an activity to view matched sleep data.</p> : (
        <>
          <article className="panel comparison-strip">
            <p>
              Night total: {data.sleep ? `${data.sleep.totalSleepHours.toFixed(2)} h` : "-"} ({data.comparison.sleepDelta == null ? "no baseline" : `${data.comparison.sleepDelta >= 0 ? "+" : ""}${data.comparison.sleepDelta.toFixed(2)} h vs 30d avg`})
            </p>
            <p>
              Deep sleep: {data.sleep ? `${data.sleep.deepSleepHours.toFixed(2)} h` : "-"} ({data.comparison.deepDelta == null ? "no baseline" : `${data.comparison.deepDelta >= 0 ? "+" : ""}${data.comparison.deepDelta.toFixed(2)} h vs 30d avg`})
            </p>
          </article>

          <div className="grid dashboard-grid">
            <article className="panel">
              <h3>Activity detail (HR + route)</h3>
              <p className="muted">{formatDateTime(data.activity.startTime)} | {formatDurationMinutes(data.activity.durationMinutes)}</p>
              <HeartRateLineChart samples={data.activity.heartRateSamples ?? []} />
              {sourceAllowsRouteMap(data.activity.source) ? <RouteMap points={data.activity.routePoints ?? []} /> : null}
            </article>

            <article className="panel">
              <h3>That night’s sleep stages</h3>
              {sleepPoint.length === 0 ? <p className="empty">No sleep summary found for this calendar night.</p> : <SleepStagesStackedBars points={sleepPoint} />}
            </article>
          </div>
        </>
      )}
    </section>
  );
}

function WeeklyTrainingLoadPage() {
  const [range, setRange] = React.useState<InsightDateRange>(() => createDateRangeFromPreset("365"));
  const query = React.useMemo(() => buildInsightQuery(range), [range]);
  const { data, loading, error } = useFetch<WeeklyTrainingLoadResponse>(`/api/dashboard/weekly-training-load?${query}`);

  if (loading) return <p>Loading weekly training load...</p>;
  if (error || !data) return <p>Could not load weekly training load.</p>;

  const spikes = data.points.filter((point) => point.spikeWarning).length;
  const detraining = data.points.filter((point) => point.detrainingWarning).length;

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insight screen 4</p>
          <h2>Weekly training load summary</h2>
          <p className="muted">Weekly stacked duration by activity type with trend and warning logic.</p>
        </div>
        <Link className="button" to="/insights">Back to insights hub</Link>
      </header>

      <DateRangeSelector value={range} onChange={setRange} />

      <div className="grid cards-grid">
        <article className="card">
          <h3>Weeks</h3>
          <p className="value">{data.points.length}</p>
          <p className="hint">In selected range</p>
        </article>
        <article className="card">
          <h3>Spike warnings</h3>
          <p className="value">{spikes}</p>
          <p className="hint">&gt;50% over trailing avg</p>
        </article>
        <article className="card">
          <h3>De-training warnings</h3>
          <p className="value">{detraining}</p>
          <p className="hint">&lt;25% for 2+ weeks</p>
        </article>
      </div>

      <article className="panel">
        <h3>Weekly stacked load + trend line</h3>
        <WeeklyLoadChart points={data.points} />
      </article>
    </section>
  );
}

function HrZoneDistributionPage() {
  const [range, setRange] = React.useState<InsightDateRange>(() => createDateRangeFromPreset("90"));
  const [period, setPeriod] = React.useState<"week" | "month">("week");
  const [maxHr, setMaxHr] = React.useState(190);
  const query = React.useMemo(() => {
    const params = new URLSearchParams(buildInsightQuery(range));
    params.set("period", period);
    params.set("maxHr", String(maxHr));
    return params.toString();
  }, [range, period, maxHr]);
  const { data, loading, error } = useFetch<HrZoneDistributionResponse>(`/api/dashboard/hr-zone-distribution?${query}`);

  if (loading) return <p>Loading HR zone distribution...</p>;
  if (error || !data) return <p>Could not load HR zone distribution.</p>;

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insight screen 5</p>
          <h2>HR zone distribution</h2>
          <p className="muted">Review aggregate time spent in zones to improve training awareness.</p>
        </div>
        <Link className="button" to="/insights">Back to insights hub</Link>
      </header>

      <DateRangeSelector value={range} onChange={setRange} />

      <section className="panel controls">
        <div className="chip-row">
          <button type="button" className={`chip ${period === "week" ? "chip-active" : ""}`} onClick={() => setPeriod("week")}>Weekly</button>
          <button type="button" className={`chip ${period === "month" ? "chip-active" : ""}`} onClick={() => setPeriod("month")}>Monthly</button>
        </div>
        <div className="goal-row">
          <label>
            Max HR for zone model
            <input type="number" min={120} max={230} value={maxHr} onChange={(event) => setMaxHr(Math.max(120, Math.min(230, Number(event.target.value) || 190)))} />
          </label>
        </div>
      </section>

      <article className="panel">
        <h3>Time in zones</h3>
        <HrZoneStackedBars points={data.points} />
      </article>
    </section>
  );
}

function StressBatteryPage() {
  const [day, setDay] = React.useState(() => getLocalIsoDay());
  const { data, loading, error } = useFetch<StressBodyBatteryResponse>(`/api/dashboard/stress-body-battery/${day}`);

  if (loading) return <p>Loading stress and body battery timeline...</p>;
  if (error || !data) return <p>Could not load stress and body battery data.</p>;

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insight screen 9 (optional)</p>
          <h2>Body battery and stress over day</h2>
          <p className="muted">This screen auto-detects whether stress/body battery series are populated by your Garmin sync.</p>
        </div>
        <Link className="button" to="/insights">Back to insights hub</Link>
      </header>

      <section className="panel controls">
        <label className="month-picker">
          Day
          <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
        </label>
      </section>

      <article className="panel">
        <h3>Timeline</h3>
        <StressBatteryTimeline data={data} />
      </article>
    </section>
  );
}

type RunningTip = {
  id: string;
  title: string;
  message: string;
  sectionId: string;
  tone: "up" | "caution" | "low";
};

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function generateTips(data: RunningInsightsResponse): RunningTip[] {
  const tips: RunningTip[] = [];

  const weekly = data.volumeTrend.weekly;
  const efficiency = data.efficiencyTrend.monthly.map((point) => point.ratio).filter((value): value is number => typeof value === "number");
  const recentWeekly = weekly.slice(-4).map((point) => point.distanceKm);
  const priorWeekly = weekly.slice(Math.max(0, weekly.length - 8), Math.max(0, weekly.length - 4)).map((point) => point.distanceKm);
  const recentEff = efficiency.slice(-3);
  const priorEff = efficiency.slice(Math.max(0, efficiency.length - 6), Math.max(0, efficiency.length - 3));

  const recentWeeklyAvg = average(recentWeekly);
  const priorWeeklyAvg = average(priorWeekly);
  const recentEffAvg = average(recentEff);
  const priorEffAvg = average(priorEff);

  if (
    recentWeeklyAvg != null
    && priorWeeklyAvg != null
    && recentWeeklyAvg > priorWeeklyAvg * 1.1
    && recentEffAvg != null
    && priorEffAvg != null
    && recentEffAvg >= priorEffAvg - 0.02
  ) {
    tips.push({
      id: "easy-runs-too-hard",
      title: "Volume is up but efficiency is flat",
      message: "Your mileage increased without a matching efficiency gain. Easy days may be drifting too hard - slow base runs down.",
      sectionId: "running-efficiency",
      tone: "caution"
    });
  }

  const fadeValues = data.pacingConsistency.fadeTrend.map((point) => point.fadeIndex);
  const recentFade = average(fadeValues.slice(-5));
  const priorFade = average(fadeValues.slice(Math.max(0, fadeValues.length - 10), Math.max(0, fadeValues.length - 5)));
  if (recentFade != null && priorFade != null && recentFade > priorFade + 0.04) {
    tips.push({
      id: "fade-rising",
      title: "Fade index is drifting upward",
      message: "You are slowing more in second halves. Try starting first kilometer easier and finish with a controlled negative split.",
      sectionId: "running-pacing",
      tone: "caution"
    });
  }

  const hasSpike = weekly.some((point) => point.spikeWarning);
  const endedWithGap = weekly.slice(-2).every((point) => point.distanceKm < 1);
  if (hasSpike && endedWithGap) {
    tips.push({
      id: "spike-gap-pattern",
      title: "Spike then drop pattern detected",
      message: "There is at least one >30% weekly spike followed by a gap. Cap progression to around 10% per week to reduce injury risk.",
      sectionId: "running-volume",
      tone: "caution"
    });
  }

  const zoneRuns = data.runs.filter((run) => typeof run.zone34Ratio === "number");
  const zone34Heavy = zoneRuns.length > 0 && zoneRuns.filter((run) => (run.zone34Ratio ?? 0) > 0.8).length / zoneRuns.length > 0.8;
  if (zone34Heavy) {
    tips.push({
      id: "zone-balance",
      title: "Most runs are drifting into moderate/hard zones",
      message: "More than 80% of runs spend heavy time in zones 3-4. Consider a polarized split: more easy volume plus fewer quality hard sessions.",
      sectionId: "running-efficiency",
      tone: "low"
    });
  }

  if (tips.length < 3) {
    tips.push({
      id: "keep-benchmarking",
      title: "Run a benchmark effort soon",
      message: "If you have not done a near-5k, 10k, or half-distance effort recently, schedule one to calibrate trends and race projections.",
      sectionId: "running-prs",
      tone: "up"
    });
  }

  return tips.slice(0, 5);
}

function RunningPaceScatter({ points }: { points: RunningPacePoint[] }) {
  const [mode, setMode] = React.useState<"raw" | "elevation" | "hr">("raw");
  const enriched = points
    .map((point) => {
      const value = mode === "raw"
        ? point.paceMinPerKm
        : mode === "elevation"
          ? point.normalizedPaceElevation ?? point.paceMinPerKm
          : point.normalizedPaceHr ?? point.paceMinPerKm;
      return { ...point, value };
    })
    .filter((point): point is RunningPacePoint & { value: number } => typeof point.value === "number");

  if (enriched.length === 0) {
    return <p className="empty">No pace points in this range.</p>;
  }

  const width = Math.max(560, enriched.length * 34);
  const height = 260;
  const pad = 26;
  const minPace = Math.min(...enriched.map((point) => point.value));
  const maxPace = Math.max(...enriched.map((point) => point.value));
  const minDist = Math.min(...enriched.map((point) => point.distanceKm ?? 0));
  const maxDist = Math.max(...enriched.map((point) => point.distanceKm ?? 0), 0.01);
  const xStep = enriched.length > 1 ? (width - pad * 2) / (enriched.length - 1) : 1;
  const xFor = (index: number) => pad + index * xStep;
  const yFor = (pace: number) => {
    if (Math.abs(maxPace - minPace) < 0.001) return height / 2;
    return height - pad - ((maxPace - pace) / (maxPace - minPace)) * (height - pad * 2);
  };

  const rollingPath = enriched
    .map((point, index) => {
      const value = mode === "raw"
        ? point.rolling10RunPace
        : mode === "elevation"
          ? point.normalizedPaceElevation
          : point.normalizedPaceHr;
      if (typeof value !== "number") {
        return "";
      }

      return `${index === 0 ? "M" : "L"}${xFor(index)},${yFor(value)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className="stack">
      <div className="chip-row">
        <button type="button" className={`chip ${mode === "raw" ? "chip-active" : ""}`} onClick={() => setMode("raw")}>Raw pace</button>
        <button type="button" className={`chip ${mode === "elevation" ? "chip-active" : ""}`} onClick={() => setMode("elevation")}>Normalized (elev)</button>
        <button type="button" className={`chip ${mode === "hr" ? "chip-active" : ""}`} onClick={() => setMode("hr")}>Normalized (%max HR)</button>
      </div>
      <div className="chart-shell">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Running pace trend scatter">
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="chart-axis" />
          {rollingPath ? <path d={rollingPath} className="line-running-rolling" /> : null}
          {enriched.map((point, index) => {
            const distance = point.distanceKm ?? 0;
            const ratio = maxDist - minDist < 0.001 ? 0.5 : (distance - minDist) / (maxDist - minDist);
            const radius = 3 + ratio * 4;
            return (
              <a key={point.activityId} href={`/activity/${point.activityId}`}>
                <circle
                  cx={xFor(index)}
                  cy={yFor(point.value)}
                  r={radius}
                  style={{ fill: `color-mix(in srgb, var(--running-point-low) ${100 - Math.round(ratio * 100)}%, var(--running-point-high) ${Math.round(ratio * 100)}%)` }}
                >
                  <title>{`${formatDay(point.day)} - ${formatPaceMinPerKm(point.value)} (${distance.toFixed(2)} km)`}</title>
                </circle>
              </a>
            );
          })}
        </svg>
      </div>
      <p className="legend">Y-axis is inverted: faster pace appears higher. Dot size/color scales by distance. Line shows 10-run rolling average.</p>
    </div>
  );
}

function RunningVolumeChart({
  weekly,
  monthly
}: {
  weekly: RunningWeeklyVolumePoint[];
  monthly: RunningMonthlyVolumePoint[];
}) {
  const [mode, setMode] = React.useState<"weekly" | "monthly">("weekly");
  const weeklySorted = [...weekly].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const monthlySorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
  const points = mode === "weekly" ? weeklySorted : monthlySorted;

  if (points.length === 0) {
    return <p className="empty">No volume data in this range.</p>;
  }

  const width = Math.max(560, points.length * 34);
  const height = 240;
  const pad = 24;
  const maxY = height - 32;
  const minY = pad;
  const maxDistance = Math.max(...points.map((point) => point.distanceKm), 1);
  const gap = 8;
  const barWidth = Math.max(8, Math.floor((width - pad * 2 - gap * (points.length - 1)) / points.length));

  const trailingPath = mode === "weekly"
    ? weeklySorted
      .map((point, index) => {
        if (typeof point.trailing4WeekDistanceKm !== "number") {
          return "";
        }

        const x = pad + index * (barWidth + gap) + barWidth / 2;
        const y = maxY - (point.trailing4WeekDistanceKm / maxDistance) * (maxY - minY);
        return `${index === 0 ? "M" : "L"}${x},${y}`;
      })
      .filter(Boolean)
      .join(" ")
    : "";

  return (
    <div className="stack">
      <div className="chip-row">
        <button type="button" className={`chip ${mode === "weekly" ? "chip-active" : ""}`} onClick={() => setMode("weekly")}>Weekly</button>
        <button type="button" className={`chip ${mode === "monthly" ? "chip-active" : ""}`} onClick={() => setMode("monthly")}>Monthly</button>
      </div>
      <div className="chart-shell">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Running volume trend">
          <line x1={pad} y1={maxY} x2={width - pad} y2={maxY} className="chart-axis" />
          {points.map((point, index) => {
            const x = pad + index * (barWidth + gap);
            const barHeight = Math.max(2, (point.distanceKm / maxDistance) * (maxY - minY));
            const y = maxY - barHeight;
            const isLabelPoint = index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2);
            const label = mode === "weekly"
              ? formatIsoWeekLabel((point as RunningWeeklyVolumePoint).weekKey)
              : (point as RunningMonthlyVolumePoint).label.slice(5);
            return (
              <g key={mode === "weekly" ? (point as RunningWeeklyVolumePoint).weekStart : (point as RunningMonthlyVolumePoint).month}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx={3} className="bar-running-volume" />
                {mode === "weekly" && (point as RunningWeeklyVolumePoint).spikeWarning ? <circle cx={x + barWidth / 2} cy={minY + 8} r={4} className="dot-warning" /> : null}
                {mode === "weekly" && (point as RunningWeeklyVolumePoint).detrainingWarning ? <rect x={x + barWidth / 2 - 4} y={minY + 14} width={8} height={8} className="dot-detrain" /> : null}
                {isLabelPoint ? <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="chart-label">{label}</text> : null}
              </g>
            );
          })}
          {mode === "weekly" && trailingPath ? <path d={trailingPath} className="line-running-rolling" /> : null}
        </svg>
      </div>
      <p className="legend">Weekly mode shows warning markers: dot = &gt;30% above trailing 4-week average, square = 3+ weeks below 50% of trailing average.</p>
    </div>
  );
}

function RunningEfficiencyChart({ points }: { points: RunningEfficiencyPoint[] }) {
  const usable = points.filter((point) => typeof point.ratio === "number");
  if (usable.length === 0) {
    return <p className="empty">Not enough HR + pace runs to calculate efficiency trend.</p>;
  }

  const width = Math.max(540, usable.length * 46);
  const height = 230;
  const pad = 24;
  const minRatio = Math.min(...usable.map((point) => point.ratio ?? 0));
  const maxRatio = Math.max(...usable.map((point) => point.ratio ?? 0));
  const xStep = usable.length > 1 ? (width - pad * 2) / (usable.length - 1) : 1;
  const yFor = (ratio: number) => {
    if (Math.abs(maxRatio - minRatio) < 0.0001) return height / 2;
    return height - pad - ((ratio - minRatio) / (maxRatio - minRatio)) * (height - pad * 2);
  };

  const path = usable.map((point, index) => `${index === 0 ? "M" : "L"}${pad + index * xStep},${yFor(point.ratio ?? 0)}`).join(" ");

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Running efficiency monthly trend">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="chart-axis" />
        <path d={path} className="line-running-efficiency" />
        {usable.map((point, index) => {
          const x = pad + index * xStep;
          const y = yFor(point.ratio ?? 0);
          const isLabelPoint = index === 0 || index === usable.length - 1 || index === Math.floor(usable.length / 2);
          return (
            <g key={point.month}>
              <circle cx={x} cy={y} r={3.6} className="dot-running-efficiency" />
              {isLabelPoint ? <text x={x} y={height - 8} textAnchor="middle" className="chart-label">{point.label.slice(5)}</text> : null}
            </g>
          );
        })}
      </svg>
      <p className="legend">Efficiency ratio = average HR / pace. A lower line over time generally indicates improving aerobic fitness.</p>
    </div>
  );
}

function RunningFadeTrendChart({ points }: { points: Array<{ day: string; activityId: string; fadeIndex: number }> }) {
  if (points.length === 0) {
    return <p className="empty">No split-derived fade index values available yet.</p>;
  }

  const ordered = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const width = Math.max(540, ordered.length * 34);
  const height = 220;
  const pad = 24;
  const minValue = Math.min(...ordered.map((point) => point.fadeIndex));
  const maxValue = Math.max(...ordered.map((point) => point.fadeIndex));
  const xStep = ordered.length > 1 ? (width - pad * 2) / (ordered.length - 1) : 1;
  const yFor = (value: number) => {
    if (Math.abs(maxValue - minValue) < 0.0001) return height / 2;
    return height - pad - ((value - minValue) / (maxValue - minValue)) * (height - pad * 2);
  };

  const path = ordered.map((point, index) => `${index === 0 ? "M" : "L"}${pad + index * xStep},${yFor(point.fadeIndex)}`).join(" ");

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fade index trend">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="chart-axis" />
        <path d={path} className="line-running-fade" />
        {ordered.map((point, index) => {
          const x = pad + index * xStep;
          const y = yFor(point.fadeIndex);
          const isLabelPoint = index === 0 || index === ordered.length - 1 || index === Math.floor(ordered.length / 2);
          return (
            <a key={point.activityId} href={`/activity/${point.activityId}`}>
              <circle cx={x} cy={y} r={3.2} className="dot-running-fade" />
              {isLabelPoint ? <text x={x} y={height - 8} textAnchor="middle" className="chart-label">{formatDay(point.day)}</text> : null}
            </a>
          );
        })}
      </svg>
      <p className="legend">Fade index = second-half pace minus first-half pace (min/km). Lower is better; negative means stronger finish.</p>
    </div>
  );
}

function RunningSplitBars({ run }: { run: RunningPacingRun }) {
  if (run.splits.length === 0) {
    return <p className="empty">No split records found for this run.</p>;
  }

  const maxPace = Math.max(...run.splits.map((split) => split.paceMinPerKm ?? 0), 0.01);
  return (
    <div className="stack">
      {run.splits.map((split, index) => {
        const pace = split.paceMinPerKm ?? 0;
        const widthPct = Math.max(6, (pace / maxPace) * 100);
        return (
          <div key={`${run.activityId}-split-${index}`} className="split-row">
            <span className="muted">Split {index + 1}</span>
            <div className="split-bar-shell">
              <div className="split-bar" style={{ width: `${widthPct}%` }} />
            </div>
            <span>{formatPaceMinPerKm(split.paceMinPerKm)}</span>
          </div>
        );
      })}
    </div>
  );
}

function RunningInsightsPage() {
  const [range, setRange] = React.useState<RunningDateRange>(() => createRunningDateRangeFromPreset("90"));
  const [selectedPacingRunId, setSelectedPacingRunId] = React.useState("");
  const query = React.useMemo(() => buildRunningInsightQuery(range), [range]);
  const { data, loading, error } = useFetch<RunningInsightsResponse>(`/api/dashboard/running?${query}`);

  React.useEffect(() => {
    if (!data) {
      return;
    }

    if (selectedPacingRunId && data.pacingConsistency.runs.some((run) => run.activityId === selectedPacingRunId)) {
      return;
    }

    const firstWithSplits = data.pacingConsistency.runs.find((run) => run.splits.length > 0);
    setSelectedPacingRunId(firstWithSplits?.activityId ?? data.pacingConsistency.runs[0]?.activityId ?? "");
  }, [data, selectedPacingRunId]);

  if (loading) return <p>Loading running analytics...</p>;
  if (error || !data) return <p>Could not load running analytics.</p>;

  const tips = generateTips(data);
  const selectedRun = data.pacingConsistency.runs.find((run) => run.activityId === selectedPacingRunId);

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Insights</p>
          <h2>Running analytics</h2>
          <p className="muted">Running-specific trends from pace, volume, efficiency, consistency, and PR history.</p>
        </div>
        <Link className="button" to="/insights">Back to insights hub</Link>
      </header>

      <RunningDateRangeSelector value={range} onChange={setRange} />

      <section id="running-summary" className="grid cards-grid">
        <article className="card">
          <h3>Total runs</h3>
          <p className="value">{data.summary.totalRuns}</p>
          <p className="hint">In selected range</p>
        </article>
        <article className="card">
          <h3>Total distance</h3>
          <p className="value">{data.summary.totalDistanceKm.toFixed(1)} km</p>
          <p className="hint">Running only</p>
        </article>
        <article className="card">
          <h3>Total time</h3>
          <p className="value small">{formatDurationMinutes(data.summary.totalDurationMinutes, true)}</p>
          <p className="hint">Elapsed run time</p>
        </article>
        <article className="card">
          <h3>Average pace</h3>
          <p className="value small">{formatPaceMinPerKm(data.summary.avgPaceMinPerKm)}</p>
          <p className="hint">Weighted by distance</p>
        </article>
        <article className="card">
          <h3>Current weekly streak</h3>
          <p className="value">{data.summary.currentWeeklyStreak}</p>
          <p className="hint">Consecutive active weeks</p>
        </article>
        <article className="card">
          <h3>Best ever pace</h3>
          <p className="value small">{formatPaceMinPerKm(data.summary.bestEverPace?.paceMinPerKm)}</p>
          <p className="hint">
            {data.summary.bestEverPace ? <Link to={`/activity/${data.summary.bestEverPace.activityId}`}>{formatDay(data.summary.bestEverPace.day)}</Link> : "No qualifying run yet"}
          </p>
        </article>
      </section>

      <article id="running-pace" className="panel">
        <h3>Pace trend</h3>
        <RunningPaceScatter points={data.paceTrend.points} />
      </article>

      <article id="running-volume" className="panel">
        <h3>Volume trend</h3>
        <RunningVolumeChart weekly={data.volumeTrend.weekly} monthly={data.volumeTrend.monthly} />
      </article>

      <article id="running-tips" className="panel">
        <h3>Coaching tips</h3>
        <div className="grid cards-grid">
          {tips.map((tip) => (
            <article key={tip.id} className="card stack">
              <p className={`badge badge-${tip.tone}`}>{tip.tone}</p>
              <h4>{tip.title}</h4>
              <p className="muted">{tip.message}</p>
              <a className="button button-compact" href={`#${tip.sectionId}`}>Open source section</a>
            </article>
          ))}
        </div>
      </article>

      <article id="running-efficiency" className="panel">
        <h3>Efficiency trend</h3>
        <RunningEfficiencyChart points={data.efficiencyTrend.monthly} />
      </article>

      <article id="running-pacing" className="panel stack">
        <h3>Pacing consistency</h3>
        <RunningFadeTrendChart points={data.pacingConsistency.fadeTrend} />
        <section className="panel controls">
          <label>
            Per-run splits
            <select value={selectedPacingRunId} onChange={(event) => setSelectedPacingRunId(event.target.value)}>
              {data.pacingConsistency.runs.map((run) => (
                <option key={run.activityId} value={run.activityId}>
                  {formatDay(run.day)} - {run.name}
                </option>
              ))}
            </select>
          </label>
          {selectedRun ? <RunningSplitBars run={selectedRun} /> : <p className="empty">Select a run to inspect split pacing.</p>}
        </section>
      </article>

      <article id="running-prs" className="panel stack">
        <h3>PR table</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Distance</th>
                <th>Best time</th>
                <th>Equivalent time</th>
                <th>Pace</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.prTable.distancePrs.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{formatDurationClock(row.durationMinutes)}</td>
                  <td>{formatDurationClock(row.equivalentDurationMinutes)}</td>
                  <td>{formatPaceMinPerKm(row.paceMinPerKm)}</td>
                  <td>{row.activityId && row.day ? <Link to={`/activity/${row.activityId}`}>{formatDay(row.day)}</Link> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid cards-grid">
          <article className="card">
            <h3>Longest run</h3>
            <p className="value small">{data.prTable.longestRun?.distanceKm ? `${data.prTable.longestRun.distanceKm.toFixed(2)} km` : "-"}</p>
            <p className="hint">
              {data.prTable.longestRun?.activityId && data.prTable.longestRun.day ? <Link to={`/activity/${data.prTable.longestRun.activityId}`}>{formatDay(data.prTable.longestRun.day)}</Link> : "No run yet"}
            </p>
          </article>
          <article className="card">
            <h3>Most elevation</h3>
            <p className="value small">{typeof data.prTable.mostElevation?.elevationGainM === "number" ? `${Math.round(data.prTable.mostElevation.elevationGainM)} m` : "-"}</p>
            <p className="hint">
              {data.prTable.mostElevation?.activityId && data.prTable.mostElevation.day ? <Link to={`/activity/${data.prTable.mostElevation.activityId}`}>{formatDay(data.prTable.mostElevation.day)}</Link> : "No elevation data"}
            </p>
          </article>
        </div>
      </article>

      <article id="running-race-predictor" className="panel stack">
        <h3>Race predictor (Riegel)</h3>
        {!data.racePredictor.source ? (
          <p className="empty">Need a recent effort (3 km+) to estimate race times.</p>
        ) : (
          <>
            <p className="muted">
              Source effort: <Link to={`/activity/${data.racePredictor.source.activityId}`}>{formatDay(data.racePredictor.source.day)}</Link> - {data.racePredictor.source.distanceKm.toFixed(2)} km in {formatDurationClock(data.racePredictor.source.durationMinutes)}.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Distance</th>
                    <th>Predicted</th>
                    <th>Actual recent</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {data.racePredictor.predictions.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{formatDurationClock(row.predictedMinutes)}</td>
                      <td>{row.actualActivityId && typeof row.actualMinutes === "number" ? <Link to={`/activity/${row.actualActivityId}`}>{formatDurationClock(row.actualMinutes)}</Link> : "-"}</td>
                      <td>{typeof row.deltaMinutes === "number" ? `${row.deltaMinutes >= 0 ? "+" : ""}${row.deltaMinutes.toFixed(2)} min` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
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
  const [garminStartDate, setGarminStartDate] = React.useState("2026-01-01");
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
                <p className="muted">Load JSON files or paste payloads and import directly into Health HQ.</p>
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

  async function deleteMetricEntry(entry: BodyMetricEntry) {
    if (!window.confirm(`Delete metric entry for ${formatDay(entry.day)}?`)) {
      return;
    }

    setMessage("Deleting metric entry...");
    const response = await fetch(`/api/body-metrics/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Could not delete metric entry.");
      return;
    }

    setEntries((current) => current.filter((item) => item.id !== entry.id));
    setMessage("Metric entry deleted.");
  }

  async function deleteVitalEntry(entry: VitalSignEntry) {
    if (!window.confirm(`Delete vital reading from ${formatDateTime(entry.measuredAt)}?`)) {
      return;
    }

    setVitalMessage("Deleting vital reading...");
    const response = await fetch(`/api/vital-signs/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setVitalMessage("Could not delete vital reading.");
      return;
    }

    setVitalSigns((current) => current.filter((item) => item.id !== entry.id));
    setVitalMessage("Vital reading deleted.");
  }

  function statusTone(value: string): "success" | "error" | "info" {
    const normalized = value.toLowerCase();
    if (
      normalized.includes("could not") ||
      normalized.includes("please") ||
      normalized.includes("enter ") ||
      normalized.includes("use realistic") ||
      normalized.includes("lower than")
    ) {
      return "error";
    }

    if (normalized.includes("saved") || normalized.includes("deleted")) {
      return "success";
    }

    return "info";
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
        </form>
      </div>

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {message ? <p className={`status-toast status-toast-${statusTone(message)}`}>{message}</p> : null}
        {vitalMessage ? <p className={`status-toast status-toast-${statusTone(vitalMessage)}`}>{vitalMessage}</p> : null}
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
                  <th>Action</th>
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
                    <td>
                      <button className="button button-danger button-compact" type="button" onClick={() => deleteMetricEntry(entry)}>
                        Delete
                      </button>
                    </td>
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {vitalSigns.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.measuredAt)}</td>
                    <td>{entry.systolic}/{entry.diastolic} mmHg</td>
                    <td>{entry.pulse} bpm</td>
                    <td>
                      <button className="button button-danger button-compact" type="button" onClick={() => deleteVitalEntry(entry)}>
                        Delete
                      </button>
                    </td>
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

function PetPage() {
  const { data, loading, error } = useFetch<HealthPetResponse>("/api/dashboard/health-pet");
  const [dailySummaryEnabled, setDailySummaryEnabled] = React.useState(readPetSummaryEnabled);

  if (loading) return <p>Loading health pet...</p>;
  if (error || !data) return <p>Could not load health pet.</p>;

  const flavorText = buildPetFlavorText(data);

  return (
    <section className="stack-lg">
      <header className="panel panel-header">
        <div>
          <p className="eyebrow">Health pet</p>
          <h2>{PET_MOOD_LABELS[data.mood]} mood <span className="pet-streak">🔥 {data.careStreak}</span></h2>
          <p className="muted">{flavorText}</p>
        </div>
        <p className="muted">Updated {formatDateTime(data.generatedAt)}</p>
      </header>

      <article className="panel controls">
        <label className="pet-summary-toggle">
          Daily pet summary banner
          <input
            type="checkbox"
            checked={dailySummaryEnabled}
            onChange={(event) => {
              const next = event.target.checked;
              setDailySummaryEnabled(next);
              writePetSummaryEnabled(next);
            }}
          />
        </label>
        <p className="muted">Off by default. When on, an in-app summary appears once per day.</p>
      </article>

      <article className="panel pet-hero">
        <HealthPetAvatar mood={data.mood} isNightTime={data.isNightTime} />
      </article>

      <article className="panel stack">
        <h3>Daily state</h3>
        <HealthPetStatRow label="Energy" value={data.stats.energy.value} />
        <HealthPetStatRow label="Happiness" value={data.stats.happiness.value} />
        <HealthPetStatRow label="Health" value={data.stats.health.value} />
        <HealthPetStatRow label="Engagement" value={data.stats.engagement.value} />
      </article>

      <article className="panel stack pet-context-grid">
        <div>
          <p className="muted">Sleep</p>
          <p>
            {typeof data.stats.energy.sleepHours === "number" ? `${data.stats.energy.sleepHours.toFixed(2)} h` : "-"} at {typeof data.stats.energy.sleepEfficiencyPct === "number" ? `${data.stats.energy.sleepEfficiencyPct.toFixed(0)}%` : "-"} efficiency
          </p>
        </div>
        <div>
          <p className="muted">Activity vs baseline</p>
          <p>{formatSignedPct(data.stats.happiness.deltaPct)}</p>
        </div>
        <div>
          <p className="muted">Resting HR trend (7d vs 30d)</p>
          <p>
            {typeof data.stats.health.restingHr7 === "number" ? data.stats.health.restingHr7.toFixed(1) : "-"} / {typeof data.stats.health.restingHr30 === "number" ? data.stats.health.restingHr30.toFixed(1) : "-"} bpm
          </p>
        </div>
        <div>
          <p className="muted">Check-ins in last 7 days</p>
          <p>{data.stats.engagement.loggedDays}/7 days</p>
        </div>
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
          <Route path="/insights" element={<InsightsHubPage />} />
          <Route path="/insights/running" element={<RunningInsightsPage />} />
          <Route path="/insights/resting-heart-rate" element={<RestingHeartRatePage />} />
          <Route path="/insights/sleep-stages" element={<SleepStagesPage />} />
          <Route path="/insights/steps-heatmap" element={<StepsHeatmapPage />} />
          <Route path="/insights/monthly" element={<MonthlyLifeDashboardPage />} />
          <Route path="/insights/correlation" element={<CorrelationExplorerPage />} />
          <Route path="/insights/activity-next-sleep" element={<ActivityNextSleepPage />} />
          <Route path="/insights/weekly-load" element={<WeeklyTrainingLoadPage />} />
          <Route path="/insights/hr-zones" element={<HrZoneDistributionPage />} />
          <Route path="/insights/stress-battery" element={<StressBatteryPage />} />
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
          <Route path="/pet" element={<PetPage />} />
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
