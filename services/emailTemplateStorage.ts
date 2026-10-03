import { EmailTemplate, NotificationEventKey, EmailTemplateAssignments, SystemwideNotificationSettings, UserNotificationSettings } from "../types/notifications";
import { DEFAULT_EMAIL_TEMPLATES, NOTIFICATION_EVENT_DEFINITIONS, DEFAULT_SYSTEMWIDE_NOTIFICATION_SETTINGS, DEFAULT_USER_NOTIFICATION_SETTINGS } from "./notificationTemplates";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getNormalizedVereinsId } from "./db";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Checks if a soft-deleted item has exceeded the 30-day retention window.
 */
export function isOlderThan30Days(deletedAt?: string | null): boolean {
  if (!deletedAt) return false;
  try {
    const deletedTime = new Date(deletedAt).getTime();
    if (isNaN(deletedTime)) return false;
    return Date.now() - deletedTime > THIRTY_DAYS_MS;
  } catch {
    return false;
  }
}

/**
 * Generates initial 5 default templates for a club.
 */
export function getDefaultTemplateLibrary(): EmailTemplate[] {
  const defaults: EmailTemplate[] = [
    {
      ...DEFAULT_EMAIL_TEMPLATES.RESERVATION_CONFIRMED,
      id: "tmpl_default_reservation_confirmed",
      name: "Standard Buchungsbestätigung",
      eventType: "RESERVATION_CONFIRMED",
      is_system_template: true,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      ...DEFAULT_EMAIL_TEMPLATES.RESERVATION_CANCELLED,
      id: "tmpl_default_reservation_cancelled",
      name: "Standard Buchungsstornierung",
      eventType: "RESERVATION_CANCELLED",
      is_system_template: true,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      ...DEFAULT_EMAIL_TEMPLATES.RESERVATION_MODIFIED,
      id: "tmpl_default_reservation_modified",
      name: "Standard Buchungsänderung",
      eventType: "RESERVATION_MODIFIED",
      is_system_template: true,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      ...DEFAULT_EMAIL_TEMPLATES.HOBBYLIGA_NEW_POST,
      id: "tmpl_default_hobbyliga_new_post",
      name: "Standard Hobbyligapost",
      eventType: "HOBBYLIGA_NEW_POST",
      is_system_template: true,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      ...DEFAULT_EMAIL_TEMPLATES.MATCH_RESULT_SUBMITTED,
      id: "tmpl_default_match_result_submitted",
      name: "Standard Matchergebnis",
      eventType: "MATCH_RESULT_SUBMITTED",
      is_system_template: true,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      ...DEFAULT_EMAIL_TEMPLATES.USER_ACTIVATION,
      id: "tmpl_default_user_activation",
      name: "Standard Initiale Passwortvergabe",
      eventType: "USER_ACTIVATION",
      is_system_template: true,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      ...DEFAULT_EMAIL_TEMPLATES.PASSWORD_RESET,
      id: "tmpl_default_password_reset",
      name: "Standard Passwort zurücksetzen",
      eventType: "PASSWORD_RESET",
      is_system_template: true,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];
  return defaults;
}

/**
 * Generates default 1:1 event assignments pointing to the default templates.
 */
export function getDefaultEventAssignments(): EmailTemplateAssignments {
  return {
    RESERVATION_CONFIRMED: "tmpl_default_reservation_confirmed",
    RESERVATION_CANCELLED: "tmpl_default_reservation_cancelled",
    RESERVATION_MODIFIED: "tmpl_default_reservation_modified",
    HOBBYLIGA_NEW_POST: "tmpl_default_hobbyliga_new_post",
    MATCH_RESULT_SUBMITTED: "tmpl_default_match_result_submitted",
    USER_ACTIVATION: "tmpl_default_user_activation",
    PASSWORD_RESET: "tmpl_default_password_reset",
  };
}

/**
 * Creates a brand new template for a specific event type.
 * Can duplicate blocks & styles from a base template if provided.
 */
export function createNewTemplate(
  name: string,
  eventType: NotificationEventKey,
  baseTemplate?: EmailTemplate | null
): EmailTemplate {
  const uniqueId = `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fallbackDef = DEFAULT_EMAIL_TEMPLATES[eventType] || DEFAULT_EMAIL_TEMPLATES.RESERVATION_CONFIRMED;

  return {
    id: uniqueId,
    name: name.trim() || `Vorlage (${eventType})`,
    eventType,
    description: baseTemplate?.description || fallbackDef.description || "",
    subject: baseTemplate?.subject || fallbackDef.subject || "Benachrichtigung",
    bodyHtml: baseTemplate?.bodyHtml || "",
    blocks: baseTemplate?.blocks ? JSON.parse(JSON.stringify(baseTemplate.blocks)) : JSON.parse(JSON.stringify(fallbackDef.blocks || [])),
    globalSettings: baseTemplate?.globalSettings ? { ...baseTemplate.globalSettings } : { ...(fallbackDef.globalSettings || { fontFamily: "system-sans" }) },
    availableVariables: baseTemplate?.availableVariables || fallbackDef.availableVariables || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };
}

/**
 * Deep cleans an object removing undefined values for defensive Firestore writes.
 */
function cleanForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) {
    return obj.map((i) => cleanForFirestore(i)) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const copy: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        copy[k] = cleanForFirestore(v);
      }
    }
    return copy;
  }
  return obj;
}

/**
 * Loads club templates, event assignments, and systemwide master settings.
 * Scoped strictly to the vereinsId.
 */
export async function loadClubEmailTemplatesData(
  vereinsId: string
): Promise<{
  templates: EmailTemplate[];
  assignments: EmailTemplateAssignments;
  systemwideActive: SystemwideNotificationSettings;
  onboardingDefaults: UserNotificationSettings;
  isGlobalEmailPaused: boolean;
}> {
  const normalizedId = getNormalizedVereinsId(vereinsId || "sv-neuhausen");
  const localCacheKey = `tennis_app_templates_${normalizedId}`;
  const localAssignKey = `tennis_app_template_assignments_${normalizedId}`;
  const localSystemwideKey = `tennis_app_systemwide_active_${normalizedId}`;
  const localOnboardingKey = `tennis_app_onboarding_defaults_${normalizedId}`;
  const localPausedKey = `tennis_app_global_paused_${normalizedId}`;

  let templates: EmailTemplate[] | null = null;
  let assignments: EmailTemplateAssignments | null = null;
  let systemwideActive: SystemwideNotificationSettings | null = null;
  let onboardingDefaults: UserNotificationSettings | null = null;
  let isGlobalEmailPaused = false;

  // 1. Try reading from Firestore club document
  try {
    const clubRef = doc(db, "vereine", normalizedId);
    const snap = await getDoc(clubRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.email_templates) && data.email_templates.length > 0) {
        templates = data.email_templates;
      }
      if (data.email_template_assignments && typeof data.email_template_assignments === "object") {
        assignments = data.email_template_assignments;
      }
      if (data.systemwide_active_events && typeof data.systemwide_active_events === "object") {
        systemwideActive = data.systemwide_active_events;
      }
      if (data.notification_defaults && typeof data.notification_defaults === "object") {
        onboardingDefaults = data.notification_defaults;
      }
      if (typeof data.is_global_email_paused === "boolean") {
        isGlobalEmailPaused = data.is_global_email_paused;
      }
    }
  } catch (err) {
    console.warn(`[emailTemplateStorage] Firestore read error for club ${normalizedId}, using local cache:`, err);
  }

  // 2. Fallback to localStorage if Firestore had no data or was offline
  if (!templates) {
    try {
      const raw = localStorage.getItem(localCacheKey);
      if (raw) {
        templates = JSON.parse(raw);
      }
    } catch (e) {
      console.warn("[emailTemplateStorage] LocalStorage read failed:", e);
    }
  }

  if (!assignments) {
    try {
      const rawA = localStorage.getItem(localAssignKey);
      if (rawA) {
        assignments = JSON.parse(rawA);
      }
    } catch (e) {
      console.warn("[emailTemplateStorage] LocalStorage assignments read failed:", e);
    }
  }

  if (!systemwideActive) {
    try {
      const rawS = localStorage.getItem(localSystemwideKey);
      if (rawS) {
        systemwideActive = JSON.parse(rawS);
      }
    } catch (e) {
      console.warn("[emailTemplateStorage] LocalStorage systemwideActive read failed:", e);
    }
  }

  if (!onboardingDefaults) {
    try {
      const rawO = localStorage.getItem(localOnboardingKey);
      if (rawO) {
        onboardingDefaults = JSON.parse(rawO);
      }
    } catch (e) {
      console.warn("[emailTemplateStorage] LocalStorage onboardingDefaults read failed:", e);
    }
  }

  try {
    const rawP = localStorage.getItem(localPausedKey);
    if (rawP !== null) {
      isGlobalEmailPaused = JSON.parse(rawP) === true;
    }
  } catch {}

  // 3. Initialize default library if first time
  if (!templates || templates.length === 0) {
    templates = getDefaultTemplateLibrary();
  }

  if (!assignments || Object.keys(assignments).length === 0) {
    assignments = getDefaultEventAssignments();
  }

  const mergedSystemwide: SystemwideNotificationSettings = {
    ...DEFAULT_SYSTEMWIDE_NOTIFICATION_SETTINGS,
    ...(systemwideActive || {}),
  };

  const mergedOnboarding: UserNotificationSettings = {
    ...DEFAULT_USER_NOTIFICATION_SETTINGS,
    ...(onboardingDefaults || {}),
  };

  // 4. Filter out any soft-deleted templates older than 30 days
  const filteredTemplates = templates.filter((t) => !isOlderThan30Days(t.deletedAt));

  // Ensure system templates exist for USER_ACTIVATION and PASSWORD_RESET even in pre-existing club data
  const hasUserActivation = filteredTemplates.some((t) => t.eventType === "USER_ACTIVATION" && !t.deletedAt);
  if (!hasUserActivation && DEFAULT_EMAIL_TEMPLATES.USER_ACTIVATION) {
    const actTemplate: EmailTemplate = {
      ...DEFAULT_EMAIL_TEMPLATES.USER_ACTIVATION,
      id: "tmpl_default_user_activation",
      name: "Standard Initiale Passwortvergabe",
      eventType: "USER_ACTIVATION",
      is_system_template: true,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    filteredTemplates.push(actTemplate);
    if (!assignments.USER_ACTIVATION) {
      assignments.USER_ACTIVATION = actTemplate.id;
    }
  }

  const hasPasswordReset = filteredTemplates.some((t) => t.eventType === "PASSWORD_RESET" && !t.deletedAt);
  if (!hasPasswordReset && DEFAULT_EMAIL_TEMPLATES.PASSWORD_RESET) {
    const rstTemplate: EmailTemplate = {
      ...DEFAULT_EMAIL_TEMPLATES.PASSWORD_RESET,
      id: "tmpl_default_password_reset",
      name: "Standard Passwort zurücksetzen",
      eventType: "PASSWORD_RESET",
      is_system_template: true,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    filteredTemplates.push(rstTemplate);
    if (!assignments.PASSWORD_RESET) {
      assignments.PASSWORD_RESET = rstTemplate.id;
    }
  }

  // 5. Ensure each known event type has an active assignment if templates exist
  for (const def of NOTIFICATION_EVENT_DEFINITIONS) {
    const matchingActive = filteredTemplates.find(
      (t) => t.eventType === def.key && !t.deletedAt
    );
    if (!assignments[def.key] && matchingActive) {
      assignments[def.key] = matchingActive.id;
    }
  }

  // Update local cache
  try {
    localStorage.setItem(localCacheKey, JSON.stringify(filteredTemplates));
    localStorage.setItem(localAssignKey, JSON.stringify(assignments));
    localStorage.setItem(localSystemwideKey, JSON.stringify(mergedSystemwide));
    localStorage.setItem(localOnboardingKey, JSON.stringify(mergedOnboarding));
    localStorage.setItem(localPausedKey, JSON.stringify(isGlobalEmailPaused));
  } catch {}

  return {
    templates: filteredTemplates,
    assignments,
    systemwideActive: mergedSystemwide,
    onboardingDefaults: mergedOnboarding,
    isGlobalEmailPaused,
  };
}

/**
 * Saves club templates, event assignments, systemwide settings and global pause state to Firestore & local cache.
 * Automatically purges soft-deleted items older than 30 days.
 */
export async function saveClubEmailTemplatesData(
  vereinsId: string,
  templates: EmailTemplate[],
  assignments: EmailTemplateAssignments,
  systemwideActive?: SystemwideNotificationSettings,
  onboardingDefaults?: UserNotificationSettings,
  isGlobalEmailPaused?: boolean
): Promise<boolean> {
  const normalizedId = getNormalizedVereinsId(vereinsId || "sv-neuhausen");
  const localCacheKey = `tennis_app_templates_${normalizedId}`;
  const localAssignKey = `tennis_app_template_assignments_${normalizedId}`;
  const localSystemwideKey = `tennis_app_systemwide_active_${normalizedId}`;
  const localOnboardingKey = `tennis_app_onboarding_defaults_${normalizedId}`;
  const localPausedKey = `tennis_app_global_paused_${normalizedId}`;

  // Purge expired (> 30 days) deleted templates
  const cleanList = templates.filter((t) => !isOlderThan30Days(t.deletedAt));

  // Update local cache immediately
  try {
    localStorage.setItem(localCacheKey, JSON.stringify(cleanList));
    localStorage.setItem(localAssignKey, JSON.stringify(assignments));
    if (systemwideActive) {
      localStorage.setItem(localSystemwideKey, JSON.stringify(systemwideActive));
    }
    if (onboardingDefaults) {
      localStorage.setItem(localOnboardingKey, JSON.stringify(onboardingDefaults));
    }
    if (isGlobalEmailPaused !== undefined) {
      localStorage.setItem(localPausedKey, JSON.stringify(isGlobalEmailPaused));
    }
  } catch (err) {
    console.error("[emailTemplateStorage] Local storage save failed:", err);
  }

  // Defensive write to Firestore
  try {
    const clubRef = doc(db, "vereine", normalizedId);
    const sanitizedTemplates = cleanForFirestore(cleanList);
    const sanitizedAssignments = cleanForFirestore(assignments);

    const updatePayload: Record<string, any> = {
      email_templates: sanitizedTemplates,
      email_template_assignments: sanitizedAssignments,
      lastTemplateUpdate: new Date().toISOString(),
    };

    if (systemwideActive !== undefined) {
      updatePayload.systemwide_active_events = cleanForFirestore(systemwideActive);
    }
    if (onboardingDefaults !== undefined) {
      updatePayload.notification_defaults = cleanForFirestore(onboardingDefaults);
    }
    if (isGlobalEmailPaused !== undefined) {
      updatePayload.is_global_email_paused = isGlobalEmailPaused;
    }

    await setDoc(clubRef, updatePayload, { merge: true });
    return true;
  } catch (err) {
    console.error(`[emailTemplateStorage] Firestore write error for club ${normalizedId}:`, err);
    return false;
  }
}

/**
 * Checks synchronously whether all emails are globally paused in the club.
 */
export function isGlobalEmailPausedSync(vereinsId: string): boolean {
  try {
    const normalizedId = getNormalizedVereinsId(vereinsId || "sv-neuhausen");
    const raw = localStorage.getItem(`tennis_app_global_paused_${normalizedId}`);
    if (raw !== null) {
      return JSON.parse(raw) === true;
    }
  } catch {}
  return false;
}

/**
 * Checks asynchronously whether all emails are globally paused in the club.
 */
export async function isGlobalEmailPaused(vereinsId: string): Promise<boolean> {
  try {
    const data = await loadClubEmailTemplatesData(vereinsId);
    return data.isGlobalEmailPaused === true;
  } catch {
    return isGlobalEmailPausedSync(vereinsId);
  }
}

/**
 * Checks synchronously whether an event is active systemwide (using local cache).
 */
export function isEventGloballyActiveSync(
  vereinsId: string,
  eventKey: NotificationEventKey
): boolean {
  try {
    const normalizedId = getNormalizedVereinsId(vereinsId || "sv-neuhausen");
    const raw = localStorage.getItem(`tennis_app_systemwide_active_${normalizedId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed[eventKey] === "boolean") {
        return parsed[eventKey];
      }
    }
  } catch {}
  return true; // Default is active
}

/**
 * Checks asynchronously whether an event is active systemwide.
 */
export async function isEventGloballyActive(
  vereinsId: string,
  eventKey: NotificationEventKey
): Promise<boolean> {
  try {
    const { systemwideActive } = await loadClubEmailTemplatesData(vereinsId);
    return systemwideActive[eventKey] !== false;
  } catch {
    return isEventGloballyActiveSync(vereinsId, eventKey);
  }
}

/**
 * Resolves the currently active template for a given notification event.
 */
export function getActiveTemplateForEvent(
  eventKey: NotificationEventKey,
  templates: EmailTemplate[],
  assignments: EmailTemplateAssignments
): EmailTemplate {
  const activeId = assignments[eventKey];
  if (activeId) {
    const found = templates.find((t) => t.id === activeId && !t.deletedAt);
    if (found) return found;
  }

  // Fallback: first non-deleted template of matching eventType
  const fallbackMatching = templates.find((t) => t.eventType === eventKey && !t.deletedAt);
  if (fallbackMatching) return fallbackMatching;

  // Ultimate fallback: static default template
  const staticDef = DEFAULT_EMAIL_TEMPLATES[eventKey] || DEFAULT_EMAIL_TEMPLATES.RESERVATION_CONFIRMED;
  return {
    ...staticDef,
    id: `static_${eventKey}`,
    eventType: eventKey,
    createdAt: new Date().toISOString(),
  };
}
