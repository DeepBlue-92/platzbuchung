import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Save,
  RotateCcw,
  Eye,
  Monitor,
  Smartphone,
  Send,
  Code,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy,
  Layers,
  Sparkles,
  X,
  Lock,
  ChevronUp,
  ChevronDown,
  LayoutTemplate,
} from "lucide-react";
import {
  EmailTemplate,
  NotificationEventKey,
  TemplateBlock,
  TemplateBlockType,
  TextBlockConfig,
  ButtonBlockConfig,
  EmailTemplateGlobalSettings,
  SendMailResult,
  EmailTemplateAssignments,
} from "../../types/notifications";
import {
  DEFAULT_EMAIL_TEMPLATES,
  NOTIFICATION_EVENT_DEFINITIONS,
  DEFAULT_MOCK_PAYLOAD,
} from "../../services/notificationTemplates";
import {
  getLiveEmailPreview,
  sendTestEmailApi,
} from "../../services/notificationClient";
import {
  compileBlocksToEmailHtml,
  createTextBlock,
  createButtonBlock,
  createImageBlock,
  createHeaderBlock,
  createColumnsBlock,
  migrateHeaderToColumns,
  getDynamicTestPayload,
} from "../../services/blockTemplateCompiler";
import {
  loadClubEmailTemplatesData,
  saveClubEmailTemplatesData,
  createNewTemplate,
} from "../../services/emailTemplateStorage";
import { listenToSettings } from "../../services/db";
import { User } from "../../types";
import { CanvasBlockRenderer } from "./emailDesigner/CanvasBlockRenderer";
import { CanvasSubjectHeader } from "./emailDesigner/CanvasSubjectHeader";
import { InlineBlockInsert } from "./emailDesigner/InlineBlockInsert";
import { InspectorPanel } from "./emailDesigner/InspectorPanel";
import { TemplateLibraryTable } from "./emailDesigner/TemplateLibraryTable";

interface EmailTemplateManagerProps {
  currentUser?: User | null;
  clubName?: string;
  currentClubId?: string;
  templates?: EmailTemplate[];
  assignments?: EmailTemplateAssignments;
  activeEditingId?: string | null;
  setActiveEditingId?: (id: string | null) => void;
  onUpdateTemplates?: (updated: EmailTemplate[]) => Promise<void> | void;
  onUpdateAssignments?: (updated: EmailTemplateAssignments) => Promise<void> | void;
  tenantColors?: string[];
}

export const EmailTemplateManager: React.FC<EmailTemplateManagerProps> = ({
  currentUser,
  clubName = "Tennis-Club e.V.",
  currentClubId = "sv-neuhausen",
  templates: propTemplates,
  assignments: propAssignments,
  activeEditingId: propActiveEditingId,
  setActiveEditingId: propSetActiveEditingId,
  onUpdateTemplates: propOnUpdateTemplates,
  onUpdateAssignments: propOnUpdateAssignments,
  tenantColors,
}) => {
  // Active tenant branding colors
  const [activeTenantColors, setActiveTenantColors] = useState<string[]>(
    tenantColors && tenantColors.length > 0 ? tenantColors : []
  );

  useEffect(() => {
    if (tenantColors && tenantColors.length > 0) {
      setActiveTenantColors(tenantColors);
    }
  }, [tenantColors]);

  useEffect(() => {
    if (!currentClubId) return;
    const unsubscribe = listenToSettings(currentClubId, (s) => {
      const colors = [
        s.primaryColor,
        s.accentColor,
        s.accentColor2,
        s.accentColor3,
      ].filter(Boolean) as string[];
      if (colors.length > 0) {
        setActiveTenantColors(colors);
      }
    });
    return () => unsubscribe();
  }, [currentClubId]);

  // 1. Internal state fallback if not controlled by parent
  const [internalTemplates, setInternalTemplates] = useState<EmailTemplate[]>([]);
  const [internalAssignments, setInternalAssignments] = useState<EmailTemplateAssignments>({});
  const [internalActiveEditingId, setInternalActiveEditingId] = useState<string | null>(null);

  const templates = propTemplates ?? internalTemplates;
  const assignments = propAssignments ?? internalAssignments;
  const activeEditingId = propActiveEditingId !== undefined ? propActiveEditingId : internalActiveEditingId;
  const setActiveEditingId = propSetActiveEditingId ?? setInternalActiveEditingId;

  // Load templates on mount if not provided via props
  useEffect(() => {
    if (!propTemplates) {
      loadClubEmailTemplatesData(currentClubId).then(({ templates: loadedT, assignments: loadedA }) => {
        setInternalTemplates(loadedT);
        setInternalAssignments(loadedA);
      });
    }
  }, [currentClubId, propTemplates]);

  // Currently editing template
  const editingTemplate = useMemo(() => {
    if (!activeEditingId) return null;
    return templates.find((t) => t.id === activeEditingId) || null;
  }, [activeEditingId, templates]);

  // 2. Draft State
  const [draftName, setDraftName] = useState<string>("");
  const [draftSubject, setDraftSubject] = useState<string>("");
  const [draftBlocks, setDraftBlocks] = useState<TemplateBlock[]>([]);
  const [globalSettings, setGlobalSettings] = useState<EmailTemplateGlobalSettings>({
    fontFamily: "system-sans",
  });

  // 3. Selection state for inspector
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // 4. Canvas View Options
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [showHtmlCodeModal, setShowHtmlCodeModal] = useState<boolean>(false);
  const [showTestMailModal, setShowTestMailModal] = useState<boolean>(false);
  const [saveWarningModal, setSaveWarningModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    missingToken: string;
    onConfirm: () => void;
  } | null>(null);

  // Unified dynamic fields payload for preview & test emails
  const dynamicTestPayload = useMemo(() => getDynamicTestPayload(clubName), [clubName]);

  // Test mail sending state
  const [recipientEmail, setRecipientEmail] = useState<string>(
    currentUser?.email || "mitglied@beispiel-tennis.de"
  );
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<SendMailResult | null>(null);

  // Toasts
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);

  // Ref for smooth scrolling to editor
  const editorRef = useRef<HTMLDivElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);

  // Sync draft when editingTemplate changes
  useEffect(() => {
    if (editingTemplate) {
      setDraftName(editingTemplate.name);
      setDraftSubject(editingTemplate.subject);
      setDraftBlocks(
        editingTemplate.blocks && editingTemplate.blocks.length > 0
          ? JSON.parse(JSON.stringify(editingTemplate.blocks))
          : [createHeaderBlock(), createTextBlock()]
      );
      setGlobalSettings(
        editingTemplate.globalSettings
          ? { ...editingTemplate.globalSettings }
          : { fontFamily: "system-sans" }
      );
      setSelectedBlockId(null);
      setSendResult(null);

      // Smooth scroll without flickering or sudden jumping
      const timer = setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [editingTemplate?.id]);

  // Current selected block object
  const selectedBlock = useMemo(() => {
    if (!selectedBlockId) return null;
    return draftBlocks.find((b) => b.id === selectedBlockId) || null;
  }, [selectedBlockId, draftBlocks]);

  // Event metadata
  const currentEventDef = useMemo(() => {
    if (!editingTemplate) return undefined;
    return NOTIFICATION_EVENT_DEFINITIONS.find((d) => d.key === editingTemplate.eventType);
  }, [editingTemplate]);

  // Compiled Table-Based HTML for email preview & Resend
  const compiledEmailHtml = useMemo(() => {
    return compileBlocksToEmailHtml(draftBlocks, globalSettings);
  }, [draftBlocks, globalSettings]);

  // Group blocks for 1, 2, or 3-column tile layouts
  const canvasRows = useMemo(() => {
    const rows: Array<{
      id: string;
      columnCount: number;
      isTwoColumn?: boolean;
      items: Array<{
        block: TemplateBlock;
        index: number;
      }>;
      insertIndexAfter: number;
    }> = [];

    let i = 0;
    while (i < draftBlocks.length) {
      const current = draftBlocks[i];

      // Header block must strictly be full width (1 column row)
      if (current.type === "header" || current.columnSpan === "full" || !current.columnSpan) {
        rows.push({
          id: `row_${current.id}`,
          columnCount: 1,
          items: [{ block: current.type === "header" ? { ...current, columnSpan: "full" } : current, index: i }],
          insertIndexAfter: i + 1,
        });
        i += 1;
        continue;
      }

      if (current.columnSpan === "third") {
        const next1 = draftBlocks[i + 1];
        const next2 = draftBlocks[i + 2];
        if (next1 && next1.columnSpan === "third" && next2 && next2.columnSpan === "third") {
          rows.push({
            id: `row_${current.id}_${next1.id}_${next2.id}`,
            columnCount: 3,
            items: [
              { block: current, index: i },
              { block: next1, index: i + 1 },
              { block: next2, index: i + 2 },
            ],
            insertIndexAfter: i + 3,
          });
          i += 3;
        } else if (next1 && next1.columnSpan === "third") {
          rows.push({
            id: `row_${current.id}_${next1.id}`,
            columnCount: 2,
            isTwoColumn: true,
            items: [
              { block: current, index: i },
              { block: next1, index: i + 1 },
            ],
            insertIndexAfter: i + 2,
          });
          i += 2;
        } else {
          rows.push({
            id: `row_${current.id}`,
            columnCount: 1,
            items: [{ block: current, index: i }],
            insertIndexAfter: i + 1,
          });
          i += 1;
        }
      } else if (current.columnSpan === "half") {
        const next = draftBlocks[i + 1];
        if (next && next.columnSpan === "half") {
          rows.push({
            id: `row_${current.id}_${next.id}`,
            columnCount: 2,
            isTwoColumn: true,
            items: [
              { block: current, index: i },
              { block: next, index: i + 1 },
            ],
            insertIndexAfter: i + 2,
          });
          i += 2;
        } else {
          rows.push({
            id: `row_${current.id}`,
            columnCount: 1,
            items: [{ block: current, index: i }],
            insertIndexAfter: i + 1,
          });
          i += 1;
        }
      } else {
        rows.push({
          id: `row_${current.id}`,
          columnCount: 1,
          items: [{ block: current, index: i }],
          insertIndexAfter: i + 1,
        });
        i += 1;
      }
    }
    return rows;
  }, [draftBlocks]);

  // Real-time full email layout preview
  const livePreview = useMemo(() => {
    if (!editingTemplate) return { renderedSubject: "", fullHtml: "" };
    return getLiveEmailPreview(
      {
        ...editingTemplate,
        subject: draftSubject,
        bodyHtml: compiledEmailHtml,
        blocks: draftBlocks,
        globalSettings,
      },
      dynamicTestPayload,
      clubName
    );
  }, [editingTemplate, draftSubject, compiledEmailHtml, draftBlocks, globalSettings, dynamicTestPayload, clubName]);

  // -------------------------------------------------------------
  // TEMPLATE MANAGEMENT HANDLERS (LIBRARY & STORAGE)
  // -------------------------------------------------------------

  const updateTemplatesList = async (newList: EmailTemplate[]) => {
    if (propOnUpdateTemplates) {
      await propOnUpdateTemplates(newList);
    } else {
      setInternalTemplates(newList);
      await saveClubEmailTemplatesData(currentClubId, newList, assignments);
    }
  };

  const handleCreateTemplate = async (
    name: string,
    eventType: NotificationEventKey,
    baseTemplateId?: string
  ) => {
    const baseTemplate = baseTemplateId
      ? templates.find((t) => t.id === baseTemplateId)
      : null;
    const newTemplate = createNewTemplate(name, eventType, baseTemplate);
    const updatedList = [newTemplate, ...templates];

    await updateTemplatesList(updatedList);
    setActiveEditingId(newTemplate.id);

    setToastMessage({
      type: "success",
      text: `Vorlage „${newTemplate.name}“ erfolgreich angelegt!`,
    });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSoftDelete = async (templateId: string) => {
    const updatedList = templates.map((t) =>
      t.id === templateId ? { ...t, deletedAt: new Date().toISOString() } : t
    );
    await updateTemplatesList(updatedList);

    if (activeEditingId === templateId) {
      setActiveEditingId(null);
    }

    setToastMessage({
      type: "info",
      text: "Vorlage in den Papierkorb verschoben (wird nach 30 Tagen automatisch bereinigt).",
    });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRestore = async (templateId: string) => {
    const updatedList = templates.map((t) =>
      t.id === templateId ? { ...t, deletedAt: null } : t
    );
    await updateTemplatesList(updatedList);

    setToastMessage({
      type: "success",
      text: "Vorlage erfolgreich wiederhergestellt!",
    });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handlePermanentDelete = async (templateId: string) => {
    const updatedList = templates.filter((t) => t.id !== templateId);
    await updateTemplatesList(updatedList);

    if (activeEditingId === templateId) {
      setActiveEditingId(null);
    }

    setToastMessage({
      type: "info",
      text: "Vorlage endgültig gelöscht.",
    });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // -------------------------------------------------------------
  // BLOCK MANIPULATION HANDLERS
  // -------------------------------------------------------------

  const handleUpdateBlock = (updated: TemplateBlock) => {
    setDraftBlocks((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
  };

  const handleInsertBlockAtIndex = (type: TemplateBlockType, index: number) => {
    let newBlock: TemplateBlock;
    if (type === "columns") newBlock = createColumnsBlock("25-75");
    else if (type === "header") newBlock = createColumnsBlock("25-75");
    else if (type === "button") newBlock = createButtonBlock();
    else if (type === "image") newBlock = createImageBlock();
    else newBlock = createTextBlock();

    setDraftBlocks((prev) => {
      const next = [...prev];
      next.splice(index, 0, newBlock);
      return next;
    });
    setSelectedBlockId(newBlock.id);
  };

  const handleInsertColumn = (
    blockIndex: number,
    side: "left" | "right",
    type: TemplateBlockType
  ) => {
    const current = draftBlocks[blockIndex];
    if (!current || current.type === "header") return; // Header cannot be multi-column
    if (type === "header") return; // Header must always be full-width

    // Find row that contains this block
    const targetRow = canvasRows.find((r) =>
      r.items.some((item) => item.index === blockIndex)
    );
    if (!targetRow || targetRow.columnCount >= 3) return;

    // If row currently has 1 column -> becomes 2 columns ("half")
    // If row currently has 2 columns -> becomes 3 columns ("third")
    const nextSpan: "half" | "third" = targetRow.columnCount === 1 ? "half" : "third";

    let newBlock: TemplateBlock;
    if (type === "button") {
      newBlock = {
        ...createButtonBlock(),
        columnSpan: nextSpan,
      };
    } else if (type === "image") {
      newBlock = {
        ...createImageBlock(),
        columnSpan: nextSpan,
      };
    } else {
      newBlock = {
        ...createTextBlock(),
        columnSpan: nextSpan,
        config: {
          content: "Neuer Spaltentext...",
          fontSize: 14,
          lineHeight: 1.5,
          paddingY: 12,
          paddingX: 16,
          backgroundColor: "#f8fafc",
          color: "#334155",
        } as TextBlockConfig,
      };
    }

    const rowBlockIds = new Set(targetRow.items.map((item) => item.block.id));

    setDraftBlocks((prev) => {
      const next = prev.map((b) =>
        rowBlockIds.has(b.id) ? { ...b, columnSpan: nextSpan } : b
      );
      const insertAt = side === "left" ? blockIndex : blockIndex + 1;
      next.splice(insertAt, 0, newBlock);
      return next;
    });

    setSelectedBlockId(newBlock.id);
  };

  // Reorder entire rows up or down
  const handleMoveRow = (rowIndex: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? rowIndex - 1 : rowIndex + 1;
    if (targetIndex < 0 || targetIndex >= canvasRows.length) return;

    const newRows = [...canvasRows];
    const [moved] = newRows.splice(rowIndex, 1);
    newRows.splice(targetIndex, 0, moved);

    const flattened: TemplateBlock[] = [];
    for (const r of newRows) {
      for (const item of r.items) {
        flattened.push(item.block);
      }
    }
    setDraftBlocks(flattened);
  };

  // Delete single block. If it was part of a 2- or 3-column row, adjust remaining siblings.
  const handleDeleteBlock = (blockId: string) => {
    const blockIndex = draftBlocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) return;

    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }

    const targetRow = canvasRows.find((r) =>
      r.items.some((item) => item.block.id === blockId)
    );

    let nextBlocks = draftBlocks.filter((b) => b.id !== blockId);

    if (targetRow) {
      const remainingSiblings = targetRow.items
        .filter((item) => item.block.id !== blockId)
        .map((item) => item.block.id);

      if (remainingSiblings.length === 1) {
        // 2-card row reduced to 1 -> expands to 100% full width
        nextBlocks = nextBlocks.map((b) =>
          remainingSiblings.includes(b.id) ? { ...b, columnSpan: "full" } : b
        );
      } else if (remainingSiblings.length === 2) {
        // 3-card row reduced to 2 -> adjusts to 50% half width
        nextBlocks = nextBlocks.map((b) =>
          remainingSiblings.includes(b.id) ? { ...b, columnSpan: "half" } : b
        );
      }
    }

    setDraftBlocks(nextBlocks);
    setToastMessage({
      type: "info",
      text: "Kachel / Block entfernt.",
    });
    setTimeout(() => setToastMessage(null), 2500);
  };

  // -------------------------------------------------------------
  // SAVE & RESET
  // -------------------------------------------------------------

  const handleSaveTemplate = async (force = false) => {
    if (!editingTemplate) return;

    if (!force) {
      if (editingTemplate.eventType === "USER_ACTIVATION") {
        const hasActivationButton = draftBlocks.some(
          (b) => b.type === "button" && (b.config as ButtonBlockConfig)?.dynamicLinkKey === "activation_link"
        );
        const hasActivationText = draftBlocks.some(
          (b) =>
            b.type === "text" &&
            typeof (b.config as TextBlockConfig)?.content === "string" &&
            ((b.config as TextBlockConfig).content.includes("activation_link") ||
              (b.config as TextBlockConfig).content.includes("[Aktivierungs-Link]") ||
              (b.config as TextBlockConfig).content.includes("{{activation_link}}"))
        );

        if (!hasActivationButton && !hasActivationText) {
          setSaveWarningModal({
            isOpen: true,
            title: "Aktivierungs-Link fehlt im Template",
            message:
              "In dieser Vorlage für die „Initiale Passwortvergabe“ wurde kein Button oder Link mit dem Aktivierungs-Link ([activation_link]) gefunden. Neu eingeladene Mitglieder können ohne diesen Link ihr persönliches Passwort nicht vergeben.",
            missingToken: "{{activation_link}}",
            onConfirm: () => {
              setSaveWarningModal(null);
              handleSaveTemplate(true);
            },
          });
          return;
        }
      } else if (editingTemplate.eventType === "PASSWORD_RESET") {
        const hasResetButton = draftBlocks.some(
          (b) => b.type === "button" && (b.config as ButtonBlockConfig)?.dynamicLinkKey === "password_reset_link"
        );
        const hasResetText = draftBlocks.some(
          (b) =>
            b.type === "text" &&
            typeof (b.config as TextBlockConfig)?.content === "string" &&
            ((b.config as TextBlockConfig).content.includes("password_reset_link") ||
              (b.config as TextBlockConfig).content.includes("[Passwort-Reset-Link]") ||
              (b.config as TextBlockConfig).content.includes("{{password_reset_link}}"))
        );

        if (!hasResetButton && !hasResetText) {
          setSaveWarningModal({
            isOpen: true,
            title: "Passwort-Reset-Link fehlt im Template",
            message:
              "In dieser Vorlage für „Passwort zurücksetzen“ wurde kein Button oder Link mit dem Passwort-Reset-Link ([password_reset_link]) gefunden. Mitglieder können ohne diesen Link ihr Passwort nicht zurücksetzen.",
            missingToken: "{{password_reset_link}}",
            onConfirm: () => {
              setSaveWarningModal(null);
              handleSaveTemplate(true);
            },
          });
          return;
        }
      }
    }

    const compiledBody = compileBlocksToEmailHtml(draftBlocks, globalSettings);

    const updated: EmailTemplate = {
      ...editingTemplate,
      name: draftName.trim() || editingTemplate.name,
      subject: draftSubject,
      bodyHtml: compiledBody,
      blocks: draftBlocks,
      globalSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || currentUser?.firstName || "Administrator",
    };

    const nextTemplates = templates.map((t) =>
      t.id === editingTemplate.id ? updated : t
    );

    await updateTemplatesList(nextTemplates);

    setToastMessage({
      type: "success",
      text: `Vorlage „${updated.name}“ erfolgreich gespeichert!`,
    });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleResetToDefault = () => {
    if (!editingTemplate) return;
    const factory = DEFAULT_EMAIL_TEMPLATES[editingTemplate.eventType];
    if (!factory) return;

    setDraftSubject(factory.subject);
    setDraftBlocks(
      factory.blocks && factory.blocks.length > 0
        ? JSON.parse(JSON.stringify(factory.blocks))
        : [createHeaderBlock(), createTextBlock()]
    );
    setGlobalSettings(
      factory.globalSettings
        ? { ...factory.globalSettings }
        : { fontFamily: "system-sans" }
    );
    setSelectedBlockId(null);

    setToastMessage({
      type: "info",
      text: `Design auf Standardbausteine zurückgesetzt. Klicke auf „Vorlage speichern“, um dauerhaft zu übernehmen.`,
    });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // -------------------------------------------------------------
  // TEST MAIL SENDER
  // -------------------------------------------------------------

  const handleSendTestMail = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      setToastMessage({
        type: "error",
        text: "Bitte gib eine gültige E-Mail-Adresse an.",
      });
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    if (!editingTemplate) return;

    setIsSending(true);
    setSendResult(null);

    const compiledBody = compileBlocksToEmailHtml(draftBlocks, globalSettings);

    try {
      const res = await sendTestEmailApi({
        eventKey: editingTemplate.eventType,
        recipientEmail,
        payload: dynamicTestPayload,
        customTemplate: {
          ...editingTemplate,
          name: draftName,
          subject: draftSubject,
          bodyHtml: compiledBody,
          blocks: draftBlocks,
          globalSettings,
        },
        clubName,
      });

      setSendResult(res);
      if (res.success) {
        setToastMessage({
          type: "success",
          text: res.simulated
            ? "Test-E-Mail generiert (Simulationsmodus)!"
            : `Test-E-Mail erfolgreich via Resend an ${recipientEmail} versendet!`,
        });
      } else {
        setToastMessage({
          type: "error",
          text: res.message || "Fehler beim Versenden der Test-E-Mail.",
        });
      }
    } catch (err: any) {
      console.error("Test email error:", err);
      setToastMessage({
        type: "error",
        text: err.message || "Unerwarteter Fehler beim Test-Versand.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(livePreview.fullHtml);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2500);
    } catch (err) {
      console.error("Failed to copy HTML:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150 shadow-sm ${
            toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : toastMessage.type === "error"
              ? "bg-red-50 text-red-900 border border-red-200"
              : "bg-blue-50 text-blue-900 border border-blue-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : toastMessage.type === "error" ? (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 1. Vorlagen-Bibliothek Tabelle */}
      <TemplateLibraryTable
        templates={templates}
        assignments={assignments}
        activeEditingId={activeEditingId}
        onSelectEdit={(id) => setActiveEditingId(id)}
        onCreateTemplate={handleCreateTemplate}
        onSoftDelete={handleSoftDelete}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
      />

      {/* 2. Visueller Block-Editor (Klappt erst auf, wenn eine Vorlage zum Bearbeiten gewählt ist) */}
      {editingTemplate && (
        <div
          ref={editorRef}
          className="pt-4 border-t border-slate-200 animate-in fade-in duration-200 space-y-5"
        >
          {/* Active Editor Header Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
                  <Layers className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="text-base sm:text-lg font-black text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:outline-none transition-colors px-1 flex-1 min-w-[240px] max-w-xl"
                      title="Klicken, um den Namen der Vorlage zu bearbeiten"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      {assignments[editingTemplate.eventType] === editingTemplate.id && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Aktiv zugewiesen</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
                    {currentEventDef?.description || "Bearbeite das Design visuell im Canvas"}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions for currently open editor */}
            <div className="flex items-center flex-wrap gap-2 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Design auf Standardbausteine zurücksetzen"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Standard</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTestMailModal(true)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>Testmail</span>
              </button>

              <button
                type="button"
                onClick={handleSaveTemplate}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Vorlage speichern</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveEditingId(null)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="Editor einklappen"
              >
                <X className="w-3.5 h-3.5" />
                <span>Schließen</span>
              </button>
            </div>
          </div>

          {/* MAIN TWO-PANE LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ============================================================== */}
            {/* LEFT COLUMN: LIVE CANVAS (7 cols)                             */}
            {/* ============================================================== */}
            <div className="lg:col-span-7 space-y-4">
              {/* Canvas Toolbar */}
              <div className="bg-slate-100/95 border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                {/* View Mode Label */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-emerald-800" />
                    <span>Editor-Vorschau</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                    &bull; Dynamische Felder sind einheitlich kursiv dargestellt
                  </span>
                </div>

                {/* Right Tools (Device Switcher & HTML code) */}
                <div className="flex items-center gap-1.5 ml-auto">
                  {/* Device Toggle */}
                  <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-lg text-xs shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice("desktop")}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold ${
                        previewDevice === "desktop"
                          ? "bg-slate-800 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="Desktop-Breite (600px)"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">600px</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice("mobile")}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold ${
                        previewDevice === "mobile"
                          ? "bg-slate-800 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="Mobil-Breite (360px)"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Mobil</span>
                    </button>
                  </div>

                  {/* HTML Code Inspect */}
                  <button
                    type="button"
                    onClick={() => setShowHtmlCodeModal(true)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    title="Kompilierten HTML-Code für E-Mail-Clients einsehen"
                  >
                    <Code className="w-3 h-3 text-slate-500" />
                    <span>&lt;/&gt; HTML</span>
                  </button>
                </div>
              </div>

              {/* Statischer, dauerhaft verankerter Betreffzeilen-Header mit Live-Badges */}
              <CanvasSubjectHeader
                subject={draftSubject}
                onChangeSubject={setDraftSubject}
                inputRef={subjectInputRef}
              />

              {/* Canvas Device Container */}
              <div className="bg-slate-200/80 p-6 sm:p-8 rounded-3xl border border-slate-300/70 shadow-inner flex justify-center items-start overflow-x-auto">
                <div
                  style={{
                    width: previewDevice === "desktop" ? "600px" : "360px",
                    maxWidth: "100%",
                    transition: "width 0.2s ease-in-out",
                  }}
                  className="bg-white rounded-none shadow-xl border border-slate-300 relative w-full h-fit self-start overflow-hidden"
                >
                  {/* Subtle Mac/Window Header Decoration (ohne Zähler) */}
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between select-none">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate max-w-[200px]">
                      {clubName} &bull; Posteingang
                    </div>
                  </div>

                  {/* Canvas Body: Blocks List (starts directly with dynamic blocks, no hardcoded header banner) */}
                  <div className="p-0 space-y-0 bg-white">
                    {/* Top Inline Insert (Index 0) */}
                    <InlineBlockInsert onInsert={(type) => handleInsertBlockAtIndex(type, 0)} />

                    {/* Empty State when no blocks */}
                    {draftBlocks.length === 0 && (
                      <div className="py-16 px-6 text-center text-slate-400">
                        <LayoutTemplate className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-600">Keine Bausteine vorhanden</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Klicke oben auf das „+“-Symbol, um eine Kopfzeile, Text, Button oder eine Grafik einzufügen.
                        </p>
                      </div>
                    )}

                    {/* Stacked Canvas Rows */}
                    {canvasRows.map((row, rowIndex) => (
                      <div key={row.id} className="space-y-0 relative group/row">
                        {/* Left Outer Reorder Buttons (Idee A) */}
                        {canvasRows.length > 1 && (
                          <div className="absolute -left-9 sm:-left-10 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rowIndex, "up")}
                              disabled={rowIndex === 0}
                              className="w-6 h-6 rounded-md bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed shadow-xs flex items-center justify-center cursor-pointer transition-all"
                              title="Ganze Zeile nach oben verschieben"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rowIndex, "down")}
                              disabled={rowIndex === canvasRows.length - 1}
                              className="w-6 h-6 rounded-md bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed shadow-xs flex items-center justify-center cursor-pointer transition-all"
                              title="Ganze Zeile nach unten verschieben"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Row Render */}
                        <div
                          className={`w-full ${
                            row.columnCount === 3
                              ? "grid grid-cols-1 sm:grid-cols-3 gap-0"
                              : row.columnCount === 2
                              ? "grid grid-cols-1 sm:grid-cols-2 gap-0"
                              : "grid grid-cols-1 gap-0"
                          }`}
                        >
                          {row.items.map(({ block, index }, itemIndex) => {
                            const canAddMore =
                              row.columnCount < 3 &&
                              block.type !== "header" &&
                              block.type !== "columns";
                            const canAddLeft = canAddMore && (row.columnCount === 1 || itemIndex === 0);
                            const canAddRight = canAddMore;

                            return (
                              <div key={block.id} className="relative group">
                                <CanvasBlockRenderer
                                  block={block}
                                  isSelected={selectedBlockId === block.id}
                                  onSelect={() => setSelectedBlockId(block.id)}
                                  onUpdateBlock={handleUpdateBlock}
                                  onDelete={() => handleDeleteBlock(block.id)}
                                  canAddColumnLeft={canAddLeft}
                                  canAddColumnRight={canAddRight}
                                  onInsertColumn={(side, type) =>
                                    handleInsertColumn(index, side, type)
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Inline Insert After this Row */}
                        <InlineBlockInsert
                          onInsert={(type) =>
                            handleInsertBlockAtIndex(type, row.insertIndexAfter)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* RIGHT COLUMN: INSPECTOR & GLOBAL SETTINGS (5 cols)             */}
            {/* ============================================================== */}
            <div className="lg:col-span-5 space-y-4">
              <InspectorPanel
                selectedBlock={selectedBlock}
                draftSubject={draftSubject}
                onChangeSubject={setDraftSubject}
                globalSettings={globalSettings}
                onChangeGlobalSettings={setGlobalSettings}
                onUpdateBlock={handleUpdateBlock}
                onDeselect={() => setSelectedBlockId(null)}
                onDeleteBlock={() => {
                  if (selectedBlockId) {
                    handleDeleteBlock(selectedBlockId);
                  }
                }}
                totalBlocksCount={draftBlocks.length}
                currentEventDef={
                  currentEventDef || {
                    key: editingTemplate.eventType,
                    label: editingTemplate.name,
                    category: "booking",
                    description: "",
                    defaultEnabled: true,
                    targetAudience: "Empfänger",
                  }
                }
                tenantColors={activeTenantColors}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL 1: TEST EMAIL SEND MODAL                                   */}
      {/* ================================================================ */}
      {showTestMailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Echte Test-E-Mail senden</h3>
                  <p className="text-[11px] text-slate-500">
                    Gezielter Vorlagen-Test an ein echtes E-Mail-Postfach
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTestMailModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Empfänger E-Mail-Adresse:
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="deine.adresse@domain.de"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-slate-600 text-[11px]">
                <div className="font-bold text-slate-800">Versand-Parameter:</div>
                <div>&bull; Event: <code className="text-emerald-700 font-bold">{editingTemplate?.eventType}</code></div>
                <div>&bull; Betreff: <span className="font-medium text-slate-700 truncate block">{livePreview.renderedSubject || draftSubject}</span></div>
                <div>&bull; Verein: <span className="font-medium">{clubName}</span></div>
              </div>

              {sendResult && (
                <div
                  className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
                    sendResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-medium"
                      : "bg-red-50 border-red-200 text-red-900 font-medium"
                  }`}
                >
                  <div className="font-bold mb-0.5">
                    {sendResult.success ? "✅ Versand erfolgreich" : "❌ Fehler beim Versand"}
                  </div>
                  <div>{sendResult.message}</div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTestMailModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Schließen
                </button>
                <button
                  type="button"
                  onClick={handleSendTestMail}
                  disabled={isSending}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? "Wird versendet..." : "Jetzt absenden"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL 2: RAW HTML CODE VIEWER                                    */}
      {/* ================================================================ */}
      {showHtmlCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800">
                <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center">
                  <Code className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Kompilierter E-Mail HTML-Code</h3>
                  <p className="text-[11px] text-slate-500">
                    Tabellenbasiertes HTML, optimiert für alle E-Mail-Clients
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHtmlCodeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed">
              <pre className="whitespace-pre-wrap">{livePreview.fullHtml}</pre>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopyHtml}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedHtml ? "Kopiert!" : "HTML in Zwischenablage"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHtmlCodeModal(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200/60 cursor-pointer"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Token Warning Modal */}
      {saveWarningModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-amber-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  {saveWarningModal.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {saveWarningModal.message}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 flex items-center justify-between">
              <span className="font-medium">Erforderliches Token:</span>
              <code className="bg-white px-2 py-0.5 rounded border border-amber-300 font-mono font-bold text-amber-800">
                {saveWarningModal.missingToken}
              </code>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSaveWarningModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Abbrechen & Link einfügen
              </button>
              <button
                type="button"
                onClick={saveWarningModal.onConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                Trotzdem speichern
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
