import Handlebars from "handlebars";
import { getEmailLayoutWrapper, EmailWrapperOptions } from "./emailWrapper";

export interface RenderTemplateOptions {
  subjectTemplate: string;
  bodyTemplate: string;
  payload: Record<string, any>;
  wrapperOptions?: EmailWrapperOptions;
}

export interface RenderResult {
  renderedSubject: string;
  renderedBody: string;
  fullHtml: string;
}

/**
 * Configure Handlebars with custom helpers and safe fallback handling.
 */
const hbsInstance = Handlebars.create();

// Helper to provide default value if variable is missing or empty
hbsInstance.registerHelper("defaultVal", function (value, fallback) {
  return value !== undefined && value !== null && value !== "" ? value : fallback;
});

// Helper for formatting dates or strings cleanly
hbsInstance.registerHelper("uppercase", function (str) {
  return typeof str === "string" ? str.toUpperCase() : "";
});

/**
 * Sanitizes and normalizes payload data so missing keys have graceful fallbacks
 * instead of printing "undefined" or causing runtime crashes.
 */
export function normalizePayload(payload: Record<string, any> = {}): Record<string, any> {
  const safePayload: Record<string, any> = { ...payload };

  // Common fallbacks for expected keys
  if (!safePayload.user_name) safePayload.user_name = "Vereinsmitglied";
  if (!safePayload.court_name) safePayload.court_name = "Tennisplatz";
  if (!safePayload.date) safePayload.date = "Datum laut Buchungsplan";
  if (!safePayload.time) safePayload.time = "Zeit laut Buchungsplan";
  if (!safePayload.cancellation_link) safePayload.cancellation_link = "#";
  if (!safePayload.club_name) safePayload.club_name = "Tennis-Club e.V.";
  if (!safePayload.booking_id) safePayload.booking_id = "BK-0000";

  return safePayload;
}

/**
 * Compiles and renders both subject and body, then wraps the body into the HTML email layout.
 */
export function renderEmail(options: RenderTemplateOptions): RenderResult {
  const safeData = normalizePayload(options.payload);

  // 1. Render Subject
  let renderedSubject = "";
  try {
    const compiledSubject = hbsInstance.compile(options.subjectTemplate || "");
    renderedSubject = compiledSubject(safeData);
  } catch (err: any) {
    console.error("Error compiling subject template:", err);
    // Simple regex fallback if Handlebars throws on malformed syntax
    renderedSubject = (options.subjectTemplate || "").replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_, key) => safeData[key] ?? ""
    );
  }

  // 2. Render Body Content
  let renderedBody = "";
  try {
    const compiledBody = hbsInstance.compile(options.bodyTemplate || "");
    renderedBody = compiledBody(safeData);
  } catch (err: any) {
    console.error("Error compiling body template:", err);
    renderedBody = (options.bodyTemplate || "").replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_, key) => safeData[key] ?? ""
    );
  }

  // 3. Inject into Email Wrapper ({{{content}}})
  const wrapperTemplate = getEmailLayoutWrapper({
    ...options.wrapperOptions,
    title: renderedSubject,
    clubName: safeData.club_name || options.wrapperOptions?.clubName,
  });

  let fullHtml = "";
  try {
    const compiledWrapper = hbsInstance.compile(wrapperTemplate);
    fullHtml = compiledWrapper({
      ...safeData,
      title: renderedSubject,
      content: renderedBody,
    });
  } catch (err: any) {
    console.error("Error injecting content into email wrapper:", err);
    fullHtml = wrapperTemplate.replace("{{{content}}}", renderedBody);
  }

  return {
    renderedSubject,
    renderedBody,
    fullHtml,
  };
}
