import Handlebars from "handlebars";
import { getEmailLayoutWrapper, EmailWrapperOptions } from "./emailWrapper";
import { TemplateBlock, EmailTemplateGlobalSettings } from "../types/notifications";
import { compileBlocksToEmailHtml, VARIABLE_BADGE_MAP } from "./blockTemplateCompiler";

export interface RenderTemplateOptions {
  subjectTemplate: string;
  bodyTemplate?: string;
  blocks?: TemplateBlock[];
  globalSettings?: EmailTemplateGlobalSettings;
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
 * Uniform token generation for dynamic variables so that fields appear
 * 1:1 identical in the template canvas, live preview, and in the received test email.
 */
export function getUniformDynamicToken(rawBadge: string): string {
  const clean = rawBadge.replace(/^\[+|\]+$/g, "").trim();
  return `<em style="font-style: italic; font-weight: 600; color: #1e293b; background-color: #f1f5f9; padding: 1px 6px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block;">[${clean}]</em>`;
}

/**
 * Sanitizes and normalizes payload data without mock test data.
 * Dynamic fields that are unfilled are rendered in uniform italic badge style.
 */
export function normalizePayload(payload: Record<string, any> = {}): Record<string, any> {
  const safePayload: Record<string, any> = { ...payload };

  // For any variable in VARIABLE_BADGE_MAP without explicit value:
  // Render uniform italic token instead of artificial mock names
  for (const [key, rawBadge] of Object.entries(VARIABLE_BADGE_MAP)) {
    if (safePayload[key] === undefined || safePayload[key] === null || safePayload[key] === "") {
      safePayload[key] = new Handlebars.SafeString(getUniformDynamicToken(rawBadge));
    } else if (typeof safePayload[key] === "string" && safePayload[key].startsWith("<em")) {
      safePayload[key] = new Handlebars.SafeString(safePayload[key]);
    }
  }

  if (!safePayload.club_name) safePayload.club_name = "Tennis-Club e.V.";
  if (!safePayload.cancellation_link) safePayload.cancellation_link = "#";
  if (!safePayload.booking_link) safePayload.booking_link = "#";
  if (!safePayload.league_link) safePayload.league_link = "#";
  if (!safePayload.match_link) safePayload.match_link = "#";

  return safePayload;
}

/**
 * Compiles and renders both subject and body, then wraps the body into the HTML email layout.
 */
export function renderEmail(options: RenderTemplateOptions): RenderResult {
  const safeData = normalizePayload(options.payload);

  // 1. Render Subject (clean plain text, strip HTML tags from badges so e.g. [Spieler-Name] appears)
  let renderedSubject = "";
  try {
    const subjectData: Record<string, string> = {};
    for (const [k, v] of Object.entries(safeData)) {
      const strVal = typeof v === "object" && v !== null && "toHTML" in v ? (v as any).toHTML() : String(v ?? "");
      subjectData[k] = strVal.replace(/<[^>]*>/g, "");
    }
    const compiledSubject = hbsInstance.compile(options.subjectTemplate || "");
    renderedSubject = compiledSubject(subjectData);
  } catch (err: any) {
    console.error("Error compiling subject template:", err);
    // Simple regex fallback if Handlebars throws on malformed syntax
    renderedSubject = (options.subjectTemplate || "").replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_, key) => {
        const val = safeData[key];
        const strVal = typeof val === "object" && val !== null && "toHTML" in val ? (val as any).toHTML() : String(val ?? "");
        return strVal.replace(/<[^>]*>/g, "");
      }
    );
  }

  // 2. Render Body Content
  const rawBodySource =
    options.blocks && options.blocks.length > 0
      ? compileBlocksToEmailHtml(options.blocks, options.globalSettings)
      : options.bodyTemplate || "";

  let renderedBody = "";
  try {
    const compiledBody = hbsInstance.compile(rawBodySource);
    renderedBody = compiledBody(safeData);
  } catch (err: any) {
    console.error("Error compiling body template:", err);
    renderedBody = rawBodySource.replace(
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
