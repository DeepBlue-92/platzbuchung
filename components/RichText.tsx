import React from "react";

// Shared Renderer Component
export const RichTextRenderer: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const lines = text.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const parseInlineFormatting = (str: string): React.ReactNode[] => {
    let parts: {
      type: "text" | "bold" | "italic" | "underline" | "link";
      content: string;
      url?: string;
    }[] = [{ type: "text", content: str }];

    // Bold (**bold**)
    parts = parts.flatMap((p) => {
      if (p.type !== "text") return p;
      const regex = /\*\*([^*]+)\*\*/g;
      const subParts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(p.content)) !== null) {
        if (match.index > lastIndex) {
          subParts.push({
            type: "text" as const,
            content: p.content.substring(lastIndex, match.index),
          });
        }
        subParts.push({ type: "bold" as const, content: match[1] });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < p.content.length) {
        subParts.push({
          type: "text" as const,
          content: p.content.substring(lastIndex),
        });
      }
      return subParts;
    });

    // Underline (__underline__)
    parts = parts.flatMap((p) => {
      if (p.type !== "text") return p;
      const regex = /__([^_]+)__/g;
      const subParts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(p.content)) !== null) {
        if (match.index > lastIndex) {
          subParts.push({
            type: "text" as const,
            content: p.content.substring(lastIndex, match.index),
          });
        }
        subParts.push({ type: "underline" as const, content: match[1] });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < p.content.length) {
        subParts.push({
          type: "text" as const,
          content: p.content.substring(lastIndex),
        });
      }
      return subParts;
    });

    // Italic (*italic*)
    parts = parts.flatMap((p) => {
      if (p.type !== "text") return p;
      const regex = /\*([^*]+)\*/g;
      const subParts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(p.content)) !== null) {
        if (match.index > lastIndex) {
          subParts.push({
            type: "text" as const,
            content: p.content.substring(lastIndex, match.index),
          });
        }
        subParts.push({ type: "italic" as const, content: match[1] });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < p.content.length) {
        subParts.push({
          type: "text" as const,
          content: p.content.substring(lastIndex),
        });
      }
      return subParts;
    });

    // Links ([text](url))
    parts = parts.flatMap((p) => {
      if (p.type !== "text") return p;
      const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const subParts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(p.content)) !== null) {
        if (match.index > lastIndex) {
          subParts.push({
            type: "text" as const,
            content: p.content.substring(lastIndex, match.index),
          });
        }
        subParts.push({
          type: "link" as const,
          content: match[1],
          url: match[2],
        });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < p.content.length) {
        subParts.push({
          type: "text" as const,
          content: p.content.substring(lastIndex),
        });
      }
      return subParts;
    });

    return parts.map((p, i) => {
      switch (p.type) {
        case "bold":
          return (
            <strong
              key={i}
              className="font-extrabold text-[var(--color-primary)]"
            >
              {p.content}
            </strong>
          );
        case "underline":
          return (
            <u key={i} className="underline decoration-[#c04d2b] decoration-2">
              {p.content}
            </u>
          );
        case "italic":
          return (
            <em key={i} className="italic text-slate-800">
              {p.content}
            </em>
          );
        case "link":
          return (
            <a
              key={i}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#c04d2b] hover:text-[var(--color-primary)] underline font-black transition-colors"
            >
              {p.content}
            </a>
          );
        default:
          return p.content;
      }
    });
  };

  const flushList = (key: number) => {
    if (currentList.length > 0) {
      renderedElements.push(
        <ul
          key={`ul-${key}`}
          className="list-disc pl-6 space-y-2 text-slate-600 font-medium text-xs mb-4"
        >
          {currentList}
        </ul>,
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.substring(2);
      currentList.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {parseInlineFormatting(content)}
        </li>,
      );
    } else {
      flushList(index);

      if (trimmed === "") {
        renderedElements.push(<div key={`empty-${index}`} className="h-2" />);
      } else if (trimmed.startsWith("### ")) {
        renderedElements.push(
          <h3
            key={`h3-${index}`}
            className="font-black text-slate-800 text-sm uppercase tracking-tight mt-6 mb-3 flex items-center gap-2 border-b border-slate-100 pb-1"
          >
            {parseInlineFormatting(trimmed.substring(4))}
          </h3>,
        );
      } else if (trimmed.startsWith("## ")) {
        renderedElements.push(
          <h2
            key={`h2-${index}`}
            className="font-black text-slate-800 text-base uppercase tracking-tight mt-8 mb-4 border-b border-slate-200 pb-1.5"
          >
            {parseInlineFormatting(trimmed.substring(3))}
          </h2>,
        );
      } else if (trimmed.startsWith("# ")) {
        renderedElements.push(
          <h1
            key={`h1-${index}`}
            className="font-black text-slate-800 text-lg uppercase tracking-tight mt-10 mb-6 border-b-2 border-slate-300 pb-2"
          >
            {parseInlineFormatting(trimmed.substring(2))}
          </h1>,
        );
      } else {
        renderedElements.push(
          <p
            key={`p-${index}`}
            className="text-slate-500 text-xs font-medium leading-relaxed mb-4"
          >
            {parseInlineFormatting(line)}
          </p>,
        );
      }
    }
  });

  flushList(lines.length);

  return <div className="rich-text-content space-y-1">{renderedElements}</div>;
};

// Toolbar Component
interface RichTextEditorToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (val: string) => void;
}

export const RichTextEditorToolbar: React.FC<RichTextEditorToolbarProps> = ({
  textareaRef,
  value,
  onChange,
}) => {
  const applyFormat = (
    type: "bold" | "italic" | "underline" | "heading" | "list" | "link",
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let replacement = "";
    let cursorOffsetStart = 0;
    let cursorOffsetEnd = 0;

    switch (type) {
      case "bold":
        replacement = `**${selectedText || "Fett gedruckter Text"}**`;
        cursorOffsetStart = 2;
        cursorOffsetEnd = replacement.length - 2;
        break;
      case "italic":
        replacement = `*${selectedText || "Kursiver Text"}*`;
        cursorOffsetStart = 1;
        cursorOffsetEnd = replacement.length - 1;
        break;
      case "underline":
        replacement = `__${selectedText || "Unterstrichener Text"}__`;
        cursorOffsetStart = 2;
        cursorOffsetEnd = replacement.length - 2;
        break;
      case "heading":
        replacement = `### ${selectedText || "Überschrift"}`;
        cursorOffsetStart = 4;
        cursorOffsetEnd = replacement.length;
        break;
      case "list":
        replacement = `\n- ${selectedText || "Listenelement"}`;
        cursorOffsetStart = 3;
        cursorOffsetEnd = replacement.length;
        break;
      case "link":
        replacement = `[${selectedText || "Link-Text"}](https://example.com)`;
        cursorOffsetStart = 1;
        cursorOffsetEnd = (selectedText || "Link-Text").length + 1;
        break;
    }

    const newValue =
      value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + cursorOffsetStart,
        start + cursorOffsetEnd,
      );
    }, 0);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-100 border-2 border-b-0 border-slate-200 rounded-t-2xl">
      <button
        type="button"
        onClick={() => applyFormat("bold")}
        title="Fett"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-700 hover:text-black font-black text-xs transition-all border border-transparent hover:border-slate-200"
      >
        <i className="fa-solid fa-bold"></i>
      </button>
      <button
        type="button"
        onClick={() => applyFormat("italic")}
        title="Kursiv"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-700 hover:text-black font-black text-xs transition-all border border-transparent hover:border-slate-200"
      >
        <i className="fa-solid fa-italic"></i>
      </button>
      <button
        type="button"
        onClick={() => applyFormat("underline")}
        title="Unterstrichen"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-700 hover:text-black font-black text-xs transition-all border border-transparent hover:border-slate-200"
      >
        <i className="fa-solid fa-underline"></i>
      </button>
      <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
      <button
        type="button"
        onClick={() => applyFormat("heading")}
        title="Überschrift"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-700 hover:text-black font-black text-xs transition-all border border-transparent hover:border-slate-200"
      >
        <i className="fa-solid fa-heading"></i>
      </button>
      <button
        type="button"
        onClick={() => applyFormat("list")}
        title="Aufzählung"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-700 hover:text-black font-black text-xs transition-all border border-transparent hover:border-slate-200"
      >
        <i className="fa-solid fa-list-ul"></i>
      </button>
      <button
        type="button"
        onClick={() => applyFormat("link")}
        title="Link einfügen"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-700 hover:text-black font-black text-xs transition-all border border-transparent hover:border-slate-200"
      >
        <i className="fa-solid fa-link"></i>
      </button>
    </div>
  );
};
