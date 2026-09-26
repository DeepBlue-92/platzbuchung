import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Mail,
  Send,
  Eye,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Smartphone,
  Monitor,
  Copy,
  Check,
  Code,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { EmailTemplate, NotificationEventKey, SendMailResult } from "../../types/notifications";
import {
  AVAILABLE_TEMPLATE_VARIABLES,
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_MOCK_PAYLOAD,
} from "../../services/notificationTemplates";
import {
  loadClientEmailTemplates,
  saveClientEmailTemplates,
  getLiveEmailPreview,
  sendTestEmailApi,
} from "../../services/notificationClient";
import { User } from "../../types";

interface EmailTemplateManagerProps {
  currentUser?: User | null;
  clubName?: string;
}

export const EmailTemplateManager: React.FC<EmailTemplateManagerProps> = ({
  currentUser,
  clubName = "Tennis-Club e.V.",
}) => {
  // Loaded templates
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>(() =>
    loadClientEmailTemplates()
  );

  // Selected template key
  const [selectedKey, setSelectedKey] = useState<NotificationEventKey>(
    "RESERVATION_CONFIRMED"
  );

  // Current active draft
  const currentTemplate = templates[selectedKey] || DEFAULT_EMAIL_TEMPLATES[selectedKey];
  const [draftSubject, setDraftSubject] = useState<string>(currentTemplate.subject);
  const [draftBodyHtml, setDraftBodyHtml] = useState<string>(currentTemplate.bodyHtml);

  // Active input ref for cursor insertion (subject or body)
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Preview device mode
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [showPayloadEditor, setShowPayloadEditor] = useState<boolean>(false);
  const [mockPayload, setMockPayload] = useState<Record<string, string>>({
    ...DEFAULT_MOCK_PAYLOAD,
    club_name: clubName,
    user_name: currentUser?.name || currentUser?.firstName
      ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || currentUser.name
      : DEFAULT_MOCK_PAYLOAD.user_name,
  });

  // Test mail sending state
  const [recipientEmail, setRecipientEmail] = useState<string>(
    currentUser?.email || "mitglied@beispiel-tennis.de"
  );
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<SendMailResult | null>(null);

  // General feedback (Save, Reset, Copy)
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);

  // When changing template selection, update local drafts
  useEffect(() => {
    const t = templates[selectedKey] || DEFAULT_EMAIL_TEMPLATES[selectedKey];
    setDraftSubject(t.subject);
    setDraftBodyHtml(t.bodyHtml);
    setSendResult(null);
  }, [selectedKey, templates]);

  // Real-time live preview computation
  const livePreview = useMemo(() => {
    return getLiveEmailPreview(
      {
        ...currentTemplate,
        subject: draftSubject,
        bodyHtml: draftBodyHtml,
      },
      mockPayload,
      clubName
    );
  }, [currentTemplate, draftSubject, draftBodyHtml, mockPayload, clubName]);

  // Insert variable tag at cursor position
  const handleInsertVariable = (placeholder: string) => {
    if (activeField === "subject") {
      const input = subjectInputRef.current;
      if (!input) {
        setDraftSubject((prev) => `${prev} ${placeholder}`);
        return;
      }
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const nextText =
        draftSubject.substring(0, start) + placeholder + draftSubject.substring(end);
      setDraftSubject(nextText);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    } else {
      const textarea = bodyTextareaRef.current;
      if (!textarea) {
        setDraftBodyHtml((prev) => `${prev} ${placeholder}`);
        return;
      }
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const nextText =
        draftBodyHtml.substring(0, start) + placeholder + draftBodyHtml.substring(end);
      setDraftBodyHtml(nextText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    }
  };

  // Save current template
  const handleSaveTemplate = () => {
    const updated: EmailTemplate = {
      ...currentTemplate,
      subject: draftSubject,
      bodyHtml: draftBodyHtml,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || "Administrator",
    };

    const nextTemplates = {
      ...templates,
      [selectedKey]: updated,
    };

    setTemplates(nextTemplates);
    saveClientEmailTemplates(nextTemplates);

    // Also notify server endpoint in background
    fetch("/api/email-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch((err) => console.warn("Could not sync template to server:", err));

    setToastMessage({
      type: "success",
      text: `Vorlage „${currentTemplate.name}“ erfolgreich gespeichert!`,
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Reset to default factory template
  const handleResetToDefault = () => {
    const factory = DEFAULT_EMAIL_TEMPLATES[selectedKey];
    if (!factory) return;

    if (
      window.confirm(
        `Möchtest du die Vorlage „${factory.name}“ wirklich auf den Auslieferungszustand zurücksetzen?`
      )
    ) {
      setDraftSubject(factory.subject);
      setDraftBodyHtml(factory.bodyHtml);

      const nextTemplates = { ...templates, [selectedKey]: factory };
      setTemplates(nextTemplates);
      saveClientEmailTemplates(nextTemplates);

      setToastMessage({
        type: "info",
        text: `Vorlage „${factory.name}“ auf den Standard zurückgesetzt.`,
      });
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Send Test Mail
  const handleSendTestMail = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      setToastMessage({
        type: "error",
        text: "Bitte gib eine gültige E-Mail-Adresse für den Testversand an.",
      });
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const res = await sendTestEmailApi({
        eventKey: selectedKey,
        recipientEmail,
        payload: mockPayload,
        customTemplate: {
          subject: draftSubject,
          bodyHtml: draftBodyHtml,
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
        text: err.message || "Unerwarteter Fehler beim E-Mail-Testversand.",
      });
    } finally {
      setIsSending(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Copy full HTML to clipboard
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
      {/* Top Banner & Introduction */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>E-Mail-Benachrichtigungen & Vorlagen</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Resend & Handlebars
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Passe E-Mail-Texte für Buchungsbestätigungen und Stornierungen flexibel an. Der Inhalt wird automatisch in ein tabellenbasiertes HTML-Layout mit Header und Footer eingebunden.
              </p>
            </div>
          </div>
        </div>

        {/* Global Save / Reset Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            title="Auf Standard zurücksetzen"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Zurücksetzen</span>
          </button>

          <button
            type="button"
            onClick={handleSaveTemplate}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Vorlage speichern</span>
          </button>
        </div>
      </div>

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

      {/* Template Selector Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
            Vorlage auswählen:
          </label>
          <div className="relative flex-1 sm:w-80">
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value as NotificationEventKey)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 shadow-2xs cursor-pointer"
            >
              <option value="RESERVATION_CONFIRMED">
                🎾 Buchungsbestätigung (RESERVATION_CONFIRMED)
              </option>
              <option value="RESERVATION_CANCELLED">
                ❌ Buchungsstornierung (RESERVATION_CANCELLED)
              </option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 italic">
          {currentTemplate.description}
        </div>
      </div>

      {/* Main Two-Column Layout (Editor Left, Live Preview Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Template Editor (5 or 6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Card: Subject & Body Editor */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
            {/* Subject Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>E-Mail-Betreffzeile</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">
                    (unterstützt Platzhalter)
                  </span>
                </label>
                {activeField === "subject" && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Aktiv für Klick-Einfügen
                  </span>
                )}
              </div>
              <input
                ref={subjectInputRef}
                type="text"
                value={draftSubject}
                onFocus={() => setActiveField("subject")}
                onChange={(e) => setDraftSubject(e.target.value)}
                placeholder="z. B. Buchung bestätigt: {{court_name}} am {{date}}"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors shadow-2xs"
              />
            </div>

            {/* Clickable Variable Badges */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Verfügbare Platzhalter (Klick zum Einfügen):</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Fügt in {activeField === "subject" ? "Betreff" : "Text"} ein
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_TEMPLATE_VARIABLES.map((v) => {
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => handleInsertVariable(v.placeholder)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 transition-all cursor-pointer shadow-2xs active:scale-95"
                      title={`${v.label} - Beispiel: "${v.example}"`}
                    >
                      <code className="font-mono text-[11px] text-emerald-700">
                        {v.placeholder}
                      </code>
                      <span className="text-[10px] text-emerald-900/80 hidden sm:inline">
                        ({v.label})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body Content Editor */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nachrichten-Inhalt (HTML & Text)</span>
                </label>
                {activeField === "body" && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Aktiv für Klick-Einfügen
                  </span>
                )}
              </div>
              <textarea
                ref={bodyTextareaRef}
                value={draftBodyHtml}
                onFocus={() => setActiveField("body")}
                onChange={(e) => setDraftBodyHtml(e.target.value)}
                rows={14}
                className="w-full p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors leading-relaxed shadow-2xs"
                placeholder="<p>Hallo {{user_name}}, ...</p>"
              />
              <p className="text-[11px] text-slate-500 leading-normal">
                💡 <strong>Tipp:</strong> Der Inhalt wird automatisch in das tabellenbasierte Corporate-Design des Tennisclubs mit Kopfbereich und Footer eingebettet. Verwende Absätze (<code>&lt;p&gt;</code>) oder Standard-HTML-Tags für eine saubere Formatierung.
              </p>
            </div>
          </div>

          {/* Card: Testmail senden */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-emerald-700" />
              <span>Testmail an echte E-Mail-Adresse senden</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Empfänger-Adresse, z. B. vorstand@mein-verein.de"
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600 shadow-2xs"
              />
              <button
                type="button"
                onClick={handleSendTestMail}
                disabled={isSending}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSending ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isSending ? "Wird versendet..." : "Testmail senden"}</span>
              </button>
            </div>

            {/* Test Mail Result Display */}
            {sendResult && (
              <div
                className={`p-3 rounded-xl text-xs space-y-1 ${
                  sendResult.success
                    ? sendResult.simulated
                      ? "bg-amber-50 text-amber-900 border border-amber-200"
                      : "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "bg-red-50 text-red-900 border border-red-200"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {sendResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  <span>Status: {sendResult.status.toUpperCase()}</span>
                </div>
                <p className="leading-relaxed">{sendResult.message}</p>
                {sendResult.messageId && (
                  <div className="text-[10px] text-slate-500 font-mono">
                    ID: {sendResult.messageId}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Live Preview (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Preview Toolbar */}
          <div className="bg-slate-100/90 border border-slate-200/90 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Eye className="w-4 h-4 text-emerald-700" />
              <span>Echtzeit-Live-Vorschau</span>
            </div>

            <div className="flex items-center gap-2">
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
                  title="Desktop-Ansicht (600px)"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold ${
                    previewDevice === "mobile"
                      ? "bg-slate-800 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Smartphone-Ansicht (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mobil</span>
                </button>
              </div>

              {/* Toggle Payload Inspector */}
              <button
                type="button"
                onClick={() => setShowPayloadEditor((prev) => !prev)}
                className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  showPayloadEditor
                    ? "bg-amber-100 border-amber-300 text-amber-900"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                title="Beispieldaten anpassen"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="text-[11px] hidden sm:inline">Beispieldaten</span>
              </button>

              {/* Copy Full HTML */}
              <button
                type="button"
                onClick={handleCopyHtml}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs flex items-center gap-1 text-[11px] font-semibold"
                title="Vollständigen E-Mail-HTML-Code kopieren"
              >
                {copiedHtml ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{copiedHtml ? "Kopiert" : "HTML"}</span>
              </button>
            </div>
          </div>

          {/* Optional Payload Editor Drawer */}
          {showPayloadEditor && (
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span>Vorschau-Beispieldaten (Test-Variablen):</span>
                <span className="text-[10px] text-amber-700">Änderungen wirken live</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(mockPayload).map(([key, val]) => (
                  <div key={key} className="space-y-0.5">
                    <label className="text-[10px] font-mono text-slate-600 uppercase font-bold">
                      {key}
                    </label>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) =>
                        setMockPayload((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subject Preview Pill */}
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-2xs space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Gerenderter Betreff im Posteingang:
            </span>
            <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {livePreview.renderedSubject || "(Kein Betreff)"}
            </div>
          </div>

          {/* Simulated Email Client Container / Iframe */}
          <div className="flex justify-center bg-slate-200/70 p-3 sm:p-5 rounded-2xl border border-slate-300/80 overflow-hidden">
            <div
              className={`bg-white rounded-xl shadow-xl border border-slate-300/60 overflow-hidden transition-all duration-200 ${
                previewDevice === "mobile" ? "w-[375px]" : "w-full max-w-[620px]"
              }`}
            >
              {/* Browser/Client Header Simulation */}
              <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
                  {clubName} &bull; Posteingang
                </div>
                <div className="text-[10px] text-slate-400">HTML Mail</div>
              </div>

              {/* Sandboxed Iframe rendering the real email table layout */}
              <iframe
                title="E-Mail Live-Vorschau"
                srcDoc={livePreview.fullHtml}
                className="w-full h-[580px] border-0 bg-slate-50"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
