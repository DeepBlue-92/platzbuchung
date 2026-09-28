import {
  TemplateBlock,
  TextBlockConfig,
  ButtonBlockConfig,
  ImageBlockConfig,
  HeaderBlockConfig,
  EmailTemplateGlobalSettings,
  EmailFontFamily,
} from "../types/notifications";
import { AVAILABLE_TEMPLATE_VARIABLES } from "./notificationTemplates";

/**
 * 100% DSGVO- & datenschutzkonforme, lokale Web-Safe Schriftarten
 * Ohne externe CDNs / Google Fonts; rendert nativ auf allen Betriebssystemen & E-Mail-Clients.
 */
export const EMAIL_FONT_OPTIONS = [
  {
    id: "system-sans",
    label: "System Sans (Modern)",
    stack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  {
    id: "arial",
    label: "Arial / Helvetica (Neutral)",
    stack: "Arial, Helvetica, sans-serif",
  },
  {
    id: "trebuchet",
    label: "Trebuchet MS (Prägnant)",
    stack: "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif",
  },
  {
    id: "georgia",
    label: "Georgia (Elegant Serif)",
    stack: "Georgia, Cambria, 'Times New Roman', serif",
  },
  {
    id: "times",
    label: "Times New Roman (Klassisch)",
    stack: "'Times New Roman', Times, serif",
  },
  {
    id: "courier",
    label: "Courier New (Monospace)",
    stack: "'Courier New', Courier, monospace",
  },
  {
    id: "verdana",
    label: "Verdana (Hohe Lesbarkeit)",
    stack: "Verdana, Geneva, sans-serif",
  },
] as const;

/**
 * Mapping of variable keys to user-facing badge labels.
 * E.g. user_name -> "Spieler-Name"
 */
export const VARIABLE_BADGE_MAP: Record<string, string> = {
  user_name: "Spieler-Name",
  court_name: "Platz-Bezeichnung",
  date: "Datum",
  time: "Uhrzeit",
  old_court_name: "Vorheriger Platz",
  old_date: "Vorheriges Datum",
  old_time: "Vorherige Uhrzeit",
  players: "Mitspieler / Partner",
  cancellation_link: "Stornierungs-Link",
  club_name: "Vereinsname",
  booking_id: "Buchungs-Nummer",
  league_name: "Liga-Name",
  author_name: "Verfasser-Name",
  post_title: "Beitrags-Titel",
  post_content: "Beitrags-Text",
  league_link: "Hobbyliga-Link",
  submitter_name: "Eintragender Spieler",
  opponent_name: "Gegner-Name",
  result_score: "Match-Ergebnis",
  match_date: "Match-Datum",
  match_link: "Match-Link",
  booking_link: "Buchungs-Link",
};

/**
 * Reverse mapping from badge label to variable key
 */
export const BADGE_TO_VARIABLE_MAP: Record<string, string> = Object.entries(
  VARIABLE_BADGE_MAP
).reduce((acc, [key, badge]) => {
  const clean = badge.replace(/^\[|\]$/g, "").toLowerCase();
  acc[clean] = key;
  acc[`[${clean}]`] = key;
  return acc;
}, {} as Record<string, string>);

/**
 * Available dynamic link targets for Button blocks
 */
export const AVAILABLE_DYNAMIC_LINKS = [
  { key: "cancellation_link", label: "Stornierungs-Link", description: "Direktlink zur Stornierung / Buchungsübersicht" },
  { key: "cancellation_link", label: "Umbuchungs-Link", description: "Direktlink zur Umbuchung / Bearbeitung" },
  { key: "league_link", label: "Hobbyliga-Link", description: "Direktlink zur Hobbyliga & Pinnwand" },
  { key: "match_link", label: "Match-Link", description: "Direktlink zur Spielansicht & Bestätigung" },
  { key: "booking_link", label: "Buchungs-Link", description: "Direktlink zum Buchungskalender" },
];

/**
 * Converts badge tokens like "[Spieler-Name]" or "Spieler-Name" to Handlebars tags "{{{user_name}}}"
 */
export function convertBadgesToHandlebars(text: string): string {
  if (!text) return "";
  let result = text;
  for (const [key, rawBadge] of Object.entries(VARIABLE_BADGE_MAP)) {
    const cleanBadge = rawBadge.replace(/^\[|\]$/g, "");
    const escaped = cleanBadge.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Replace bracketed version [Badge] first
    result = result.replace(new RegExp(`\\[\\s*${escaped}\\s*\\]`, "gi"), `{{{${key}}}}`);
    // Replace standalone badge token if it's hyphenated or distinct
    if (cleanBadge.includes("-") || ["club_name", "players"].includes(key)) {
      result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), `{{{${key}}}}`);
    }
  }
  // Convert any existing double-brace Handlebars variables to triple-brace so HTML isn't escaped
  result = result.replace(/(?<!\{)\{\{\s*([a-zA-Z0-9_]+)\s*\}\}(?!\})/g, "{{{$1}}}");
  return result;
}

/**
 * Converts Handlebars tags "{{user_name}}" to user-friendly badge tokens
 */
export function convertHandlebarsToBadges(text: string): string {
  if (!text) return "";
  let result = text;
  for (const [key, rawBadge] of Object.entries(VARIABLE_BADGE_MAP)) {
    const cleanBadge = rawBadge.replace(/^\[|\]$/g, "");
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
    result = result.replace(regex, `[${cleanBadge}]`);
  }
  return result;
}

/**
 * Returns dynamic fields payload for test emails and previews with unified italic badges.
 * Fields that are dynamically populated are marked uniformly (italic with subtle badge frame)
 * matching the template canvas display 1:1.
 */
export function getDynamicTestPayload(clubName = "Tennis-Club e.V."): Record<string, string> {
  const payload: Record<string, string> = {
    club_name: clubName,
  };
  for (const [key, rawBadge] of Object.entries(VARIABLE_BADGE_MAP)) {
    const clean = rawBadge.replace(/^\[|\]$/g, "");
    payload[key] = `<em style="font-style: italic; font-weight: 600; color: #1e293b; background-color: #f1f5f9; padding: 1px 6px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block;">[${clean}]</em>`;
  }
  return payload;
}

/**
 * Replaces badge tokens and "{{user_name}}" with preview data values.
 */
export function replaceTokensWithPreview(
  text: string,
  payload: Record<string, any> = {}
): string {
  if (!text) return "";
  let result = text;

  for (const [key, rawBadge] of Object.entries(VARIABLE_BADGE_MAP)) {
    const val = payload[key] !== undefined && payload[key] !== null ? String(payload[key]) : "";
    if (val) {
      const cleanBadge = rawBadge.replace(/^\[|\]$/g, "");
      const escaped = cleanBadge.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`\\[\\s*${escaped}\\s*\\]`, "gi"), val);
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), val);
      if (cleanBadge.includes("-") || ["club_name", "players"].includes(key)) {
        result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), val);
      }
    }
  }

  // Also replace any remaining {{key}} with payload[key] or fallback
  result = result.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    return payload[k] !== undefined && payload[k] !== null ? String(payload[k]) : "";
  });

  return result;
}

/**
 * Font family CSS values: 100% datenschutzkonforme, lokale Web-Safe Stacks
 */
export function getFontFamilyCss(family?: EmailFontFamily): string {
  switch (family) {
    case "arial":
      return "Arial, Helvetica, sans-serif";
    case "trebuchet":
      return "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif";
    case "georgia":
    case "serif":
      return "Georgia, Cambria, 'Times New Roman', serif";
    case "times":
      return "'Times New Roman', Times, serif";
    case "courier":
    case "mono":
      return "'Courier New', Courier, monospace";
    case "verdana":
      return "Verdana, Geneva, sans-serif";
    case "system-sans":
    case "sans":
    default:
      return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }
}

/**
 * Generates email-client safe, table-based HTML from an array of blocks.
 * Designed to render flawlessly across Apple Mail, Gmail, and Outlook (MSO).
 * Supports 2-column tile layouts (Workday-style) and edge-to-edge section control.
 */
export function compileSingleBlockHtml(
  block: TemplateBlock,
  globalFont: EmailFontFamily = "system-sans"
): string {
  const defaultFontCss = getFontFamilyCss(globalFont);

  switch (block.type) {
    case "text": {
      const cfg = block.config as TextBlockConfig;
      const fontCss = getFontFamilyCss(cfg.fontFamily || globalFont);
      const fontSize = cfg.fontSize || 15;
      const lineHeight = cfg.lineHeight || 1.6;
      const textAlign = cfg.textAlign || "left";
      const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
      const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 20;
      const color = cfg.color || "#334155";
      const bgColor = cfg.backgroundColor || "transparent";

      // Convert badges to Handlebars variables for backend rendering
      const contentWithHandlebars = convertBadgesToHandlebars(cfg.content || "");

      // Convert double newlines into clean paragraph spacing, single newlines into <br />
      const paragraphs = contentWithHandlebars
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      const htmlParagraphs = paragraphs.length > 0
        ? paragraphs
            .map((p, idx) => {
              const lineFormatted = p.replace(/\n/g, "<br />");
              const marginBottom = idx === paragraphs.length - 1 ? 0 : 12;
              return `<p style="margin: 0 0 ${marginBottom}px 0; font-family: ${fontCss}; font-size: ${fontSize}px; line-height: ${lineHeight}; color: ${color}; text-align: ${textAlign};">${lineFormatted}</p>`;
            })
            .join("")
        : `<p style="margin: 0; font-family: ${fontCss}; font-size: ${fontSize}px; line-height: ${lineHeight}; color: ${color}; text-align: ${textAlign};">${contentWithHandlebars}</p>`;

      return `<!-- Block: Text -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgColor}; border-collapse: collapse;">
  <tr>
    <td style="padding: ${paddingY}px ${paddingX}px; font-family: ${fontCss}; font-size: ${fontSize}px; line-height: ${lineHeight}; color: ${color}; text-align: ${textAlign};">
      ${htmlParagraphs}
    </td>
  </tr>
</table>`;
    }

    case "button": {
      const cfg = block.config as ButtonBlockConfig;
      const align = cfg.align || "left";
      const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
      const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 24;
      const buttonColor = cfg.buttonColor || "#047857";
      const textColor = cfg.textColor || "#ffffff";
      const backgroundColor = cfg.backgroundColor || "transparent";
      const label = cfg.label || "Aktion ausführen";

      let borderRadius = "8px";
      let msoArcSize = "15%";
      if (cfg.shape === "pill") {
        borderRadius = "9999px";
        msoArcSize = "50%";
      } else if (cfg.shape === "square") {
        borderRadius = "0px";
        msoArcSize = "0%";
      }

      // Link resolution
      let href = "#";
      if (cfg.linkType === "dynamic") {
        href = `{{${cfg.dynamicLinkKey || "cancellation_link"}}}`;
      } else {
        href = cfg.staticUrl || "https://tennis-club.app";
      }

      return `<!-- Block: Button -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${backgroundColor}; border-collapse: collapse;">
  <tr>
    <td align="${align}" style="padding: ${paddingY}px ${paddingX}px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="${msoArcSize}" stroke="f" fillcolor="${buttonColor}">
        <w:anchorlock/>
        <center style="color:${textColor};font-family:${defaultFontCss};font-size:14px;font-weight:bold;">${label}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
        <tr>
          <td align="center" style="border-radius: ${borderRadius}; background-color: ${buttonColor};">
            <a href="${href}" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: ${defaultFontCss}; font-size: 14px; font-weight: 700; color: ${textColor}; text-decoration: none; border-radius: ${borderRadius}; background-color: ${buttonColor}; line-height: 20px;">
              ${label}
            </a>
          </td>
        </tr>
      </table>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
    }

    case "image": {
      const cfg = block.config as ImageBlockConfig;
      const align = cfg.align || "center";
      const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
      const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 0;
      const widthVal = cfg.widthValue || 100;
      const widthUnit = cfg.widthUnit || "%";
      const widthCss = widthUnit === "%" ? `${widthVal}%` : `${widthVal}px`;
      const altText = cfg.altText || "Grafik";
      const imageUrl = cfg.imageUrl || "https://placehold.co/600x160/047857/ffffff?text=Vereinsgrafik";

      const imageTag = `<img src="${imageUrl}" alt="${altText}" border="0" style="display: inline-block; max-width: 100%; width: ${widthCss}; height: auto; outline: none; border: 0; text-decoration: none; border-radius: 0px;" />`;

      return `<!-- Block: Image / Banner -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
  <tr>
    <td align="${align}" style="padding: ${paddingY}px ${paddingX}px;">
      ${cfg.targetUrl ? `<a href="${cfg.targetUrl}" target="_blank" style="text-decoration: none; display: inline-block;">${imageTag}</a>` : imageTag}
    </td>
  </tr>
</table>`;
    }

    case "header": {
      const cfg = block.config as HeaderBlockConfig;
      const fontCss = getFontFamilyCss(cfg.fontFamily || globalFont);
      const fontSize = cfg.fontSize || 20;
      const subtitleFontSize = cfg.subtitleFontSize || 13;
      const lineHeight = cfg.lineHeight || 1.3;
      const textAlign = cfg.textAlign || "center";
      const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 20;
      const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 24;
      const color = cfg.color || "#0f172a";
      const subtitleColor = cfg.subtitleColor || "#64748b";
      const bgColor = cfg.backgroundColor || "#ffffff";

      const titleHtml = convertBadgesToHandlebars(cfg.title || "");
      const subtitleHtml = cfg.subtitle ? convertBadgesToHandlebars(cfg.subtitle) : "";

      const logoImgTag = cfg.logoUrl
        ? `<div style="margin-bottom: 12px; text-align: ${textAlign};"><img src="${cfg.logoUrl}" alt="${cfg.logoAlt || 'Logo'}" height="${cfg.logoHeight || 44}" border="0" style="display: inline-block; max-height: ${cfg.logoHeight || 44}px; height: auto; max-width: 100%; border: 0; outline: none; text-decoration: none;" /></div>`
        : "";

      return `<!-- Block: Kopfleiste / Header -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgColor}; border-collapse: collapse;">
  <tr>
    <td align="${textAlign}" style="padding: ${paddingY}px ${paddingX}px; font-family: ${fontCss}; text-align: ${textAlign};">
      ${logoImgTag}
      <h1 style="margin: 0; padding: 0; font-family: ${fontCss}; font-size: ${fontSize}px; line-height: ${lineHeight}; font-weight: 800; color: ${color}; text-align: ${textAlign};">
        ${titleHtml}
      </h1>
      ${subtitleHtml ? `<p style="margin: 6px 0 0 0; padding: 0; font-family: ${fontCss}; font-size: ${subtitleFontSize}px; line-height: 1.4; color: ${subtitleColor}; text-align: ${textAlign};">${subtitleHtml}</p>` : ""}
    </td>
  </tr>
</table>`;
    }

    default:
      return "";
  }
}

export function compileBlocksToEmailHtml(
  blocks: TemplateBlock[],
  globalSettings?: EmailTemplateGlobalSettings
): string {
  if (!blocks || blocks.length === 0) {
    return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding: 24px 20px; color: #64748b; font-family: sans-serif; font-size: 14px; text-align: center;">(Kein Inhalt hinterlegt)</td></tr>
    </table>`;
  }

  const globalFont = globalSettings?.fontFamily || "sans";
  const outputParts: string[] = [];

  let i = 0;
  while (i < blocks.length) {
    const current = blocks[i];

    if (current.columnSpan === "third") {
      const next1 = blocks[i + 1];
      const next2 = blocks[i + 2];
      if (next1 && next1.columnSpan === "third" && next2 && next2.columnSpan === "third") {
        const html1 = compileSingleBlockHtml(current, globalFont);
        const html2 = compileSingleBlockHtml(next1, globalFont);
        const html3 = compileSingleBlockHtml(next2, globalFont);
        outputParts.push(`<!-- 3-Column Row -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; table-layout: fixed;">
  <tr>
    <td width="33.33%" valign="top" style="padding-right: 4px; box-sizing: border-box;">
      ${html1}
    </td>
    <td width="33.33%" valign="top" style="padding-left: 2px; padding-right: 2px; box-sizing: border-box;">
      ${html2}
    </td>
    <td width="33.34%" valign="top" style="padding-left: 4px; box-sizing: border-box;">
      ${html3}
    </td>
  </tr>
</table>`);
        i += 3;
        continue;
      } else if (next1 && next1.columnSpan === "third") {
        const html1 = compileSingleBlockHtml(current, globalFont);
        const html2 = compileSingleBlockHtml(next1, globalFont);
        outputParts.push(`<!-- 2-Column Row (from 2 third-span tiles) -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; table-layout: fixed;">
  <tr>
    <td width="50%" valign="top" style="padding-right: 6px; box-sizing: border-box;">
      ${html1}
    </td>
    <td width="50%" valign="top" style="padding-left: 6px; box-sizing: border-box;">
      ${html2}
    </td>
  </tr>
</table>`);
        i += 2;
        continue;
      } else {
        outputParts.push(compileSingleBlockHtml(current, globalFont));
        i += 1;
        continue;
      }
    } else if (current.columnSpan === "half") {
      const next = blocks[i + 1];
      if (next && next.columnSpan === "half") {
        const html1 = compileSingleBlockHtml(current, globalFont);
        const html2 = compileSingleBlockHtml(next, globalFont);
        outputParts.push(`<!-- 2-Column Row (Workday Kacheln) -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; table-layout: fixed;">
  <tr>
    <td width="50%" valign="top" style="padding-right: 6px; box-sizing: border-box;">
      ${html1}
    </td>
    <td width="50%" valign="top" style="padding-left: 6px; box-sizing: border-box;">
      ${html2}
    </td>
  </tr>
</table>`);
        i += 2;
        continue;
      } else {
        const html1 = compileSingleBlockHtml(current, globalFont);
        outputParts.push(`<!-- 2-Column Row (Single Tile) -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; table-layout: fixed;">
  <tr>
    <td width="50%" valign="top" style="padding-right: 6px; box-sizing: border-box;">
      ${html1}
    </td>
    <td width="50%" valign="top" style="padding-left: 6px;">
      &nbsp;
    </td>
  </tr>
</table>`);
        i += 1;
        continue;
      }
    } else {
      outputParts.push(compileSingleBlockHtml(current, globalFont));
      i += 1;
    }
  }

  return outputParts.join("\n\n");
}

/**
 * Creates a unique block ID
 */
export function generateBlockId(): string {
  return "blk_" + Math.random().toString(36).substring(2, 9);
}

/**
 * Factory for creating a new Header block (Kopfleiste)
 */
export function createHeaderBlock(
  title?: string,
  subtitle?: string,
  columnSpan: "full" | "half" | "third" = "full"
): TemplateBlock {
  return {
    id: generateBlockId(),
    type: "header",
    columnSpan,
    config: {
      logoUrl: "",
      logoAlt: "Vereins-Logo",
      logoHeight: 44,
      title: title || "[Vereinsname]",
      subtitle: subtitle || "Offizielle Benachrichtigung & Reservierung",
      fontFamily: "sans",
      fontSize: 20,
      subtitleFontSize: 13,
      lineHeight: 1.3,
      textAlign: "center",
      paddingY: 20,
      paddingX: 24,
      color: "#0f172a",
      subtitleColor: "#64748b",
      backgroundColor: "#f8fafc",
    } as HeaderBlockConfig,
  };
}

/**
 * Factory for creating a new Text block
 */
export function createTextBlock(initialContent?: string, columnSpan: "full" | "half" | "third" = "full"): TemplateBlock {
  return {
    id: generateBlockId(),
    type: "text",
    columnSpan,
    config: {
      content:
        initialContent ||
        "Hallo [Spieler-Name],\n\nhier ist eine wichtige Benachrichtigung zu deiner Buchung auf [Platz-Bezeichnung] am [Datum].",
      fontFamily: "sans",
      fontSize: 15,
      lineHeight: 1.6,
      textAlign: "left",
      paddingY: 12,
      paddingX: 20,
      color: "#334155",
      backgroundColor: "transparent",
    } as TextBlockConfig,
  };
}

/**
 * Factory for creating a new Button block
 */
export function createButtonBlock(initialLabel?: string, columnSpan: "full" | "half" | "third" = "full"): TemplateBlock {
  return {
    id: generateBlockId(),
    type: "button",
    columnSpan,
    config: {
      label: initialLabel || "Buchung verwalten oder stornieren",
      linkType: "dynamic",
      dynamicLinkKey: "cancellation_link",
      staticUrl: "https://tennis-club.app",
      align: "left",
      paddingY: 12,
      paddingX: 20,
      shape: "rounded",
      buttonColor: "#047857",
      textColor: "#ffffff",
      backgroundColor: "transparent",
    } as ButtonBlockConfig,
  };
}

/**
 * Factory for creating a new Image block
 */
export function createImageBlock(imageUrl?: string, columnSpan: "full" | "half" | "third" = "full"): TemplateBlock {
  return {
    id: generateBlockId(),
    type: "image",
    columnSpan,
    config: {
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=80",
      altText: "Tennis Club Banner",
      widthUnit: "%",
      widthValue: 100,
      align: "center",
      targetUrl: "",
      paddingY: 12,
      paddingX: 0,
    } as ImageBlockConfig,
  };
}
