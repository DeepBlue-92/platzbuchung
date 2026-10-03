import React from "react";
import { VARIABLE_BADGE_MAP } from "../../../services/blockTemplateCompiler";

interface VariableBadgeRendererProps {
  text: string;
  className?: string;
  badgeClassName?: string;
}

/**
 * Splits text by bracket tokens [Label], handlebars {{key}}, or known variable badges
 * and renders variables as consistent, rounded, italic pills with subtle border.
 */
export const VariableBadgeRenderer: React.FC<VariableBadgeRendererProps> = ({
  text,
  className = "",
  badgeClassName = "inline-flex items-center mx-0.5 px-1.5 py-0.5 rounded text-xs font-semibold italic text-slate-800 bg-slate-100 border border-slate-300 select-none shadow-2xs",
}) => {
  if (!text) return null;

  const badgeEntries = Object.entries(VARIABLE_BADGE_MAP);
  const cleanBadges = badgeEntries.map(([_, v]) => v.replace(/^\[|\]$/g, ""));

  const escapedCleanBadges = cleanBadges
    .filter((b) => b.includes("-") || b.includes("/"))
    .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const patternParts = [
    "\\[[^\\]\\n\\r]+\\]",
    "\\{\\{[^}\\n\\r]+\\}\\}",
    ...escapedCleanBadges.map((b) => `\\b${b}\\b`),
  ];
  const pattern = new RegExp(`(${patternParts.join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <span className={`inline-flex items-center flex-wrap gap-0.5 ${className}`}>
      {parts.map((part, idx) => {
        if (!part) return null;

        let cleanLabel = "";

        // Check [Badge] format
        const bracketMatch = part.match(/^\[(.*)\]$/);
        if (bracketMatch) {
          cleanLabel = bracketMatch[1].trim();
        }

        // Check {{variable}} format
        const handlebarsMatch = part.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
        if (handlebarsMatch) {
          const varKey = handlebarsMatch[1].trim();
          cleanLabel = VARIABLE_BADGE_MAP[varKey] || varKey;
        }

        // Check clean badge format
        if (!cleanLabel) {
          const isCleanBadge = cleanBadges.some(
            (b) => b.toLowerCase() === part.trim().toLowerCase()
          );
          if (isCleanBadge) {
            cleanLabel = part.trim();
          }
        }

        if (cleanLabel) {
          const displayLabel = cleanLabel.replace(/^\[+|\]+$/g, "");
          return (
            <span key={idx} className={badgeClassName}>
              [{displayLabel}]
            </span>
          );
        }

        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
};
