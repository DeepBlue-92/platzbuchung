import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, MoreVertical, EyeOff, ArrowRight } from 'lucide-react';
import { User } from '../types';
import { updateUserAiAssistant, updateUserAceWelcomeSeen } from '../services/db';
import { USER_HELP_CATEGORIES } from '../data/docs/userHelpData';
import { findKnowledgeAnswer, loadPersonality } from '../services/assistantKnowledge';

interface TennisAssistantWidgetProps {
  currentUser: User | null;
  onUpdateUser?: (updatedUser: User) => void;
  primaryColor?: string;
  triggerWelcomeBubble?: boolean;
  isGlobalChatbotEnabled?: boolean;
}

interface Message {
  id: string;
  sender: 'ace' | 'user';
  text: string;
  timestamp: string;
  category?: string;
}

// Clean, structured Markdown & block formatter for chat bubbles
const FormattedMessageContent: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
  if (!text) return null;

  // Inline formatter for bold, italic, underline, code, and links
  const renderInline = (lineText: string, keyPrefix: string): React.ReactNode => {
    const tokenRegex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|`[^`]+`)/g;
    const parts = lineText.split(tokenRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Bold **text**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={`${keyPrefix}-b-${index}`} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      // Underline __text__
      if (part.startsWith('__') && part.endsWith('__') && part.length >= 4) {
        return (
          <span key={`${keyPrefix}-u-${index}`} className="underline">
            {part.slice(2, -2)}
          </span>
        );
      }
      // Italic *text*
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={`${keyPrefix}-i-${index}`} className="italic">
            {part.slice(1, -1)}
          </em>
        );
      }
      // Code `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={`${keyPrefix}-c-${index}`}
            className={`px-1 py-0.5 rounded text-[11px] font-mono ${
              isUser ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800'
            }`}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      // Link [text](url)
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={`${keyPrefix}-a-${index}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline font-semibold ${
              isUser ? 'text-white' : 'text-emerald-700 hover:text-emerald-900'
            }`}
          >
            {linkMatch[1]}
          </a>
        );
      }

      return part;
    });
  };

  const rawLines = text.split('\n');
  const blocks: Array<
    | { type: 'heading'; level: number; text: string }
    | { type: 'numbered-list'; items: string[] }
    | { type: 'bullet-list'; items: string[] }
    | { type: 'paragraph'; lines: string[] }
  > = [];

  let currentNumberedList: string[] | null = null;
  let currentBulletList: string[] | null = null;
  let currentParagraphLines: string[] | null = null;

  const flushParagraph = () => {
    if (currentParagraphLines && currentParagraphLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: currentParagraphLines });
      currentParagraphLines = null;
    }
  };

  const flushNumberedList = () => {
    if (currentNumberedList && currentNumberedList.length > 0) {
      blocks.push({ type: 'numbered-list', items: currentNumberedList });
      currentNumberedList = null;
    }
  };

  const flushBulletList = () => {
    if (currentBulletList && currentBulletList.length > 0) {
      blocks.push({ type: 'bullet-list', items: currentBulletList });
      currentBulletList = null;
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushNumberedList();
    flushBulletList();
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    // Heading: e.g. "### Überschrift" or "# Überschrift"
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushAll();
      const cleanHeading = headingMatch[2].replace(/#+$/, '').trim();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: cleanHeading
      });
      continue;
    }

    // Numbered list: e.g. "1. Schritt" or "1) Schritt"
    const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      flushBulletList();
      if (!currentNumberedList) {
        currentNumberedList = [];
      }
      currentNumberedList.push(numberedMatch[2].replace(/^#+\s*/, '').trim());
      continue;
    }

    // Bullet list: e.g. "- Item", "* Item", "• Item"
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      flushNumberedList();
      if (!currentBulletList) {
        currentBulletList = [];
      }
      currentBulletList.push(bulletMatch[1].replace(/^#+\s*/, '').trim());
      continue;
    }

    // Standard paragraph line (strip any stray markdown hashtags)
    flushNumberedList();
    flushBulletList();
    if (!currentParagraphLines) {
      currentParagraphLines = [];
    }
    const cleanParagraph = trimmed.replace(/^#+\s*/, '').replace(/\s*#+$/, '').trim();
    if (cleanParagraph) {
      currentParagraphLines.push(cleanParagraph);
    }
  }

  flushAll();

  return (
    <div className="space-y-1.5">
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          return (
            <div
              key={`h-${idx}`}
              className={`text-sm font-bold mt-2 mb-1 ${
                isUser ? 'text-white' : 'text-slate-800'
              }`}
            >
              {renderInline(block.text, `h-${idx}`)}
            </div>
          );
        }

        if (block.type === 'numbered-list') {
          return (
            <ol key={`ol-${idx}`} className="list-decimal pl-4 space-y-1 my-1.5">
              {block.items.map((item, itemIdx) => (
                <li key={`ol-item-${itemIdx}`} className="leading-relaxed">
                  {renderInline(item, `ol-${idx}-${itemIdx}`)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'bullet-list') {
          return (
            <ul key={`ul-${idx}`} className="list-disc pl-4 space-y-1 my-1.5">
              {block.items.map((item, itemIdx) => (
                <li key={`ul-item-${itemIdx}`} className="leading-relaxed">
                  {renderInline(item, `ul-${idx}-${itemIdx}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`p-${idx}`} className="leading-relaxed my-1">
            {block.lines.map((pLine, lIdx) => (
              <React.Fragment key={`p-line-${lIdx}`}>
                {lIdx > 0 && <br />}
                {renderInline(pLine, `p-${idx}-${lIdx}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};

// Comprehensive ITF / DTB Tennis Knowledge Base for instantaneous, accurate answers
const KNOWLEDGE_BASE: Array<{
  keywords: string[];
  title: string;
  answer: string;
}> = [
  {
    keywords: ['tiebreak', 'tie-break', 'tie break', 'punkte tiebreak', 'seitenwechsel tiebreak'],
    title: 'Offizielle Tie-Break Regeln (DTB / ITF)',
    answer: 'Ein regulärer Tie-Break wird bis 7 Punkte gespielt (mindestens 2 Punkte Vorsprung bei 6:6):\n\n• Zählweise: Einfache Zahlen (1, 2, 3... statt 15, 30, 40).\n• Aufschlagfolge: Spieler A beginnt mit 1 Aufschlag von rechts. Danach schlägt Spieler B 2 Mal auf (erst von links, dann von rechts). Anschließend wechseln sich die Spieler alle 2 Punkte ab.\n• Seitenwechsel: Nach jeweils 6 gespielten Punkten (z. B. bei 4:2, 6:6, 9:9 usw.) wechseln die Spieler die Seiten.',
  },
  {
    keywords: ['match-tiebreak', 'match tiebreak', 'champions tiebreak', 'champion tiebreak', 'dritter satz'],
    title: 'Match-Tiebreak (Champions-Tiebreak)',
    answer: 'Der Match-Tiebreak ersetzt häufig den 3. Satz:\n\n• Er wird bis 10 Punkte gespielt (mindestens 2 Punkte Vorsprung bei 9:9).\n• Die Aufschlagfolge und Seitenwechsel (alle 6 Punkte) laufen genauso ab wie beim regulären Tie-Break.\n• Der Gewinner des Match-Tiebreaks gewinnt das gesamte Match.',
  },
  {
    keywords: ['netz', 'netzberührung', 'netz berühren', 'schläger am netz', 'körper netz'],
    title: 'Netzberührung mit Schläger oder Körper',
    answer: 'Eindeutige Regel nach ITF Rule 24g:\n\n• Berührt ein Spieler während des laufenden Ballwechsels mit Schläger, Kleidung oder Körper das Netz, das Netzband oder die Netzpfosten, verliert er SOFORT den Punkt!\n• Ausnahme: Nach Ende des Ballwechsels (der Ball ist bereits im Aus oder doppelt aufgesprungen) führt eine Netzberührung nicht mehr zum Punktverlust.',
  },
  {
    keywords: ['linie', 'aus', 'linienball', 'kratzt linie', 'abdruck', 'gut oder aus'],
    title: 'Ball auf der Linie / Aus-Entscheidungen',
    answer: 'Laut Tennisregel gilt:\n\n• Berührt der Ball auch nur minimal die Außenkante einer Begrenzungslinie, ist er GUT!\n• Jeder Spieler entscheidet die Bälle auf seiner eigenen Platzhälfte.\n• Grundsatz des Fairplay: Kann ein Spieler den Ball nicht zu 100% sicher im Aus sehen, MUSS der Ball zugunsten des Gegners als "GUT" gewertet werden.',
  },
  {
    keywords: ['fußfehler', 'fussfehler', 'foot fault', 'übertreten', 'aufschlag linie treten'],
    title: 'Fußfehler beim Aufschlag (Foot Fault)',
    answer: 'Während des Aufschlagvorgangs (ab Ausholbewegung bis zum Balltreffpunkt):\n\n• Darf der Aufschläger weder die Grundlinie mit den Füßen berühren noch übertreten.\n• Darf er die gedachte Verlängerung der Mittelmarkierung oder Seitenlinie nicht überschreiten.\n• Das Berühren der Grundlinie vor dem Treffen des Balls ist ein Fehlaufschlag (1. Aufschlag verloren bzw. Doppelfehler beim 2. Aufschlag).',
  },
  {
    keywords: ['let', 'netzaufschlag', 'netz beim aufschlag', 'wiederholung', 'netzroller aufschlag'],
    title: 'Netzaufschlag (Let / Wiederholung)',
    answer: 'Trifft der Ball beim Aufschlag das Netz, Netzband oder Netzpfosten:\n\n• Landet er danach im korrekten Aufschlagfeld, ist es ein "Let" – der Aufschlag wird ohne Punktabzug wiederholt!\n• Berührt er das Netz und landet im Aus oder im falschen Feld, ist es ein normaler Fehler (1. Fehler bzw. Doppelfehler).',
  },
  {
    keywords: ['doppel', 'aufschlag doppel', 'seiten doppel', 'rückschlag doppel'],
    title: 'Doppel-Regeln & Aufstellung',
    answer: 'Im Doppel gilt:\n\n• Zu Beginn jedes Satzes bestimmt das aufschlagende Paar, wer von beiden zuerst aufschlägt.\n• Ebenso legt das rückschlagende Team zu Beginn jedes Satzes fest, wer auf der Einstand- (rechts) und wer auf der Vorteilseite (links) retourniert.\n• Diese festgelegte Reihenfolge darf innerhalb eines laufenden Satzes NICHT verändert werden!',
  },
  {
    keywords: ['regen', 'platzpflege', 'abziehen', 'wässern', 'linien fegen', 'sandplatz'],
    title: 'Sandplatz-Pflege & Regen',
    answer: 'Tipps für lange Platzqualität:\n\n• Nach JEDEM Match: Den Platz von außen nach innen kreisförmig mit dem Schleppnetz abziehen und die Linien mit dem Linienbesen säubern.\n• Bei Trockenheit: Platz vor und nach dem Spiel gründlich bewässern.\n• Nach Regen: Auf keinen Fall Pfützen mit Besen oder Schleppnetz wegschieben (schwemmt das feine Ziegelmehl aus). Erst spielen, wenn der Platz trittfest und matt abgetrocknet ist.',
  },
  {
    keywords: ['buchen', 'reservieren', 'stornieren', 'storno', 'buchung', 'platzreservierung'],
    title: 'Platzbuchung & Stornierung im Club',
    answer: 'So funktioniert die Platzreservierung:\n\n• Wähle im Tages- oder Wochenplan ein freies Zeitfenster aus.\n• Wähle deinen Spielpartner aus der Mitgliederliste aus und klicke auf "Jetzt buchen".\n• Stornierung: Tippe auf deine eigene bestehende Buchung und wähle "Buchung stornieren", falls du nicht spielen kannst.',
  },
  {
    keywords: ['aufschlag von oben', 'aufschlag von unten', 'von unten servieren', 'unterhand'],
    title: 'Aufschlag von unten (Underhand Serve)',
    answer: 'Vollkommen regelkonform!\n\n• Der Aufschlag von unten ist nach offiziellem DTB/ITF Regelwerk ausdrücklich erlaubt, solange der Ball aus der Hand losgelassen/geworfen wird, bevor der Schläger ihn trifft, und der Aufschläger hinter der Grundlinie bleibt.',
  }
];

export const TennisAssistantWidget: React.FC<TennisAssistantWidgetProps> = ({
  currentUser,
  onUpdateUser,
  primaryColor = '#1b4332',
  triggerWelcomeBubble = false,
  isGlobalChatbotEnabled = true,
}) => {
  const vorname = currentUser?.firstName || (currentUser as any)?.displayName?.split(' ')[0] || currentUser?.name?.split(' ')[0] || '';
  const [personalityPrompt, setPersonalityPrompt] = useState<string>('');

  const getWelcomeGreeting = (name: string) => {
    const greeting = name ? `Servus ${name}!` : `Servus!`;
    return `${greeting} Ich bin Ace, dein persönlicher Vereins- und Tennis-Assistent der DJK Fürth. 🎾\nFrag mi gerne nach Tennisregeln, Platzreservierungen, Arbeitseinsätzen oder Vereinsspielen!`;
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showWelcomeBubble, setShowWelcomeBubble] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ace',
      text: getWelcomeGreeting(vorname),
      timestamp: 'Jetzt'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load personality from public/personality dynamically
  useEffect(() => {
    let isMounted = true;
    loadPersonality(vorname).then((prompt) => {
      if (isMounted) {
        setPersonalityPrompt(prompt);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [vorname]);

  // Synchronize welcome message when vorname is updated
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [{
          ...prev[0],
          text: getWelcomeGreeting(vorname)
        }];
      }
      return prev;
    });
  }, [vorname]);

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Check and trigger welcome bubble for first-time onboarding completion
  const checkAndShowWelcome = useCallback(() => {
    if (!currentUser) return;
    const userKey = currentUser.id || currentUser.name || 'default';
    const storageKey = `has_seen_ace_welcome_${userKey}`;
    const hasSeenLocal = typeof window !== 'undefined' && localStorage.getItem(storageKey) === 'true';
    const hasSeenUser = currentUser.has_seen_ace_welcome === true;

    if (!hasSeenLocal && !hasSeenUser) {
      setShowWelcomeBubble(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, 'true');
      }
      updateUserAceWelcomeSeen(currentUser.id).catch(() => {});
      if (onUpdateUser) {
        onUpdateUser({ ...currentUser, has_seen_ace_welcome: true });
      }
    }
  }, [currentUser, onUpdateUser]);

  useEffect(() => {
    if (triggerWelcomeBubble) {
      checkAndShowWelcome();
    }
  }, [triggerWelcomeBubble, checkAndShowWelcome]);

  // Support global custom event trigger
  useEffect(() => {
    const handleEvent = () => checkAndShowWelcome();
    window.addEventListener('ace:show-welcome', handleEvent);
    return () => window.removeEventListener('ace:show-welcome', handleEvent);
  }, [checkAndShowWelcome]);

  // Auto-dismiss welcome bubble after 8 seconds
  useEffect(() => {
    if (showWelcomeBubble) {
      const timer = setTimeout(() => {
        setShowWelcomeBubble(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [showWelcomeBubble]);

  // When opening chat, dismiss welcome bubble
  useEffect(() => {
    if (isOpen && showWelcomeBubble) {
      setShowWelcomeBubble(false);
    }
  }, [isOpen, showWelcomeBubble]);

  // Auto-scroll inside chat smoothly
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Answer matching logic grounded on public/tutorial & public/personality
  const handleAskQuestion = async (questionText: string) => {
    if (!questionText.trim()) return;

    const trimmedQuestion = questionText.trim();
    const userMsg: Message = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: trimmedQuestion,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    let replyText = '';

    // Step 1: Attempt server-side Gemini response (with public/personality & public/tutorial)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedQuestion,
          history: messages.slice(-4),
          vorname,
          systemInstruction: personalityPrompt || undefined,
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.reply) {
          replyText = data.reply;
        }
      }
    } catch {
      // Server AI not reachable or timed out, will fall back immediately to local tutorial knowledge
    }

    // Step 2: Instant knowledge base matching from public/tutorial (Single Source of Truth)
    if (!replyText) {
      const knowledgeMatch = findKnowledgeAnswer(trimmedQuestion);
      if (knowledgeMatch) {
        replyText = `**${knowledgeMatch.title}**\n\n${knowledgeMatch.content}`;
      }
    }

    // Step 3: Match user help documentation
    if (!replyText) {
      const lowerQ = trimmedQuestion.toLowerCase();
      let matchedHelpArticle: { title: string; summary: string; content: string } | null = null;
      for (const cat of USER_HELP_CATEGORIES) {
        for (const art of cat.articles) {
          const titleMatch = art.title.toLowerCase().includes(lowerQ) || lowerQ.includes(art.title.toLowerCase());
          const kwMatch = art.keywords.some(kw => lowerQ.includes(kw.toLowerCase()));
          if (titleMatch || kwMatch) {
            matchedHelpArticle = art;
            break;
          }
        }
        if (matchedHelpArticle) break;
      }
      if (matchedHelpArticle) {
        replyText = `**${matchedHelpArticle.title}**\n\n${matchedHelpArticle.content}`;
      }
    }

    // Step 4: Comprehensive Club & Tutorial Fallback adhering to personality
    if (!replyText) {
      replyText = `Dazu hob i im Handbuch leider nix g'funden – frag am besten kurz direkt beim Sportwart oder beim Vorstand nach.\n\nIn unserem **Vereins-Handbuch** findest du alle wichtigen Regeln und Abläufe:\n\n• **Plätze reservieren:** Einzel 60 Min, Doppel bis 120 Min. Es muss immer ein Partner, ein Gast oder die Ballmaschine eingetragen sein.\n• **Gastspiele:** Keine Barzahlung auf der Anlage – die Abrechnung erfolgt bequem am Saisonende per SEPA-Lastschrift.\n• **Meisterschaft:** Bei 1:1 Sätzen wird kein 3. Satz gespielt, sondern direkt ein Match-Tiebreak bis 10 Punkte.\n• **Arbeitseinsätze:** 10 Soll-Stunden pro Saison (Übersicht und Einreichung im Menü *Arbeitseinsätze*).\n• **Platzpflege:** Nach dem Spiel kreisförmig abziehen, Linien säubern und wässern (keine Pfützen wegschieben).\n\nFrag mi gerne zu einem dieser Bereiche genauer! 🎾`;
    }

    // Enforce Rule 1: First answer must start with "Servus {{VORNAME}}!" (or "Servus!")
    const hasPreviousAceAnswer = messages.some(m => m.sender === 'ace' && m.id !== 'welcome');
    if (!hasPreviousAceAnswer && !replyText.trim().startsWith('Servus')) {
      const greetingHeader = vorname ? `Servus ${vorname}!` : `Servus!`;
      replyText = `${greetingHeader}\n\n${replyText}`;
    }

    // Strip raw markdown hashtags at the start of any line to ensure clean presentation
    replyText = replyText.replace(/^#{1,6}\s+(.*)$/gm, '**$1**');

    // Short natural delay for conversational feel if not already delayed
    setTimeout(() => {
      setIsTyping(false);
      const aceMsg: Message = {
        id: `ace_${Date.now()}`,
        sender: 'ace',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aceMsg]);
    }, 250);
  };

  // Immediate disable without confirmation dialog
  const handleDirectDisable = async () => {
    if (!currentUser) return;
    setIsOpen(false);
    setIsMenuOpen(false);

    // Trigger toast for 4 seconds
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
    }, 4000);

    // Save showAiAssistant: false to Firestore immediately
    try {
      await updateUserAiAssistant(currentUser.id, false);
    } catch (err) {
      console.error('Fehler beim Deaktivieren des Assistenten:', err);
    }

    // Update parent user state immediately
    if (onUpdateUser) {
      onUpdateUser({
        ...currentUser,
        showAiAssistant: false
      });
    }
  };

  // GLOBAL SETTING RULE: If chatbot is globally disabled by SuperAdmin, mascot & dialog are NOT rendered!
  if (isGlobalChatbotEnabled === false) {
    return null;
  }

  // STRICT RULE: If showAiAssistant is false or user is absent, mascot & dialog are NOT rendered!
  if (!currentUser || currentUser.showAiAssistant === false) {
    if (showToast) {
      return (
        <div
          id="ace-deactivated-toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[calc(100%-32px)] bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md flex items-center justify-between gap-3 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base shrink-0">ℹ️</span>
            <span className="leading-snug">
              Assistent ausgeblendet. Du kannst ihn jederzeit in deinem Profil wieder aktivieren.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowToast(false)}
            className="text-slate-400 hover:text-white transition-colors p-1 shrink-0 cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes aceBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.12); }
        }
        @keyframes aceFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        .ace-eye-blink {
          animation: aceBlink 4.5s infinite ease-in-out;
          transform-origin: center;
        }
        .ace-floating-btn {
          animation: aceFloat 3.8s infinite ease-in-out;
        }
      `}</style>

      {/* Deactivated Toast (shown when still mounted) */}
      {showToast && (
        <div
          id="ace-deactivated-toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[calc(100%-32px)] bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md flex items-center justify-between gap-3 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base shrink-0">ℹ️</span>
            <span className="leading-snug">
              Assistent ausgeblendet. Du kannst ihn jederzeit in deinem Profil wieder aktivieren.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowToast(false)}
            className="text-slate-400 hover:text-white transition-colors p-1 shrink-0 cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ace Onboarding Welcome Speech Bubble / Callout Tooltip */}
      {showWelcomeBubble && !isOpen && (
        <div
          id="ace-welcome-speech-bubble"
          role="status"
          aria-live="polite"
          onClick={() => {
            setIsOpen(true);
            setShowWelcomeBubble(false);
          }}
          className="fixed bottom-[148px] right-4 sm:bottom-24 sm:right-6 z-[45] w-[290px] sm:w-[320px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.18)] border border-lime-400 p-3.5 sm:p-4 animate-in fade-in slide-in-from-bottom-3 duration-300 select-none cursor-pointer group hover:border-lime-500 transition-all print:hidden"
        >
          {/* Directional arrow/pointer pointing down towards the Ace floating button */}
          <div className="absolute -bottom-2 right-6 sm:right-8 w-4 h-4 bg-white border-b border-r border-lime-400 transform rotate-45" />

          <div className="flex items-start justify-between gap-2 relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-base animate-bounce">👋</span>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                Hi, ich bin ACE!
              </h4>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowWelcomeBubble(false);
              }}
              className="w-5 h-5 -mr-1 -mt-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Hinweis schließen"
              title="Schließen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-medium relative z-10">
            Du hast Fragen zum Buchen, zu Gästen oder zur Meisterschaft? Klick einfach hier – ich helfe dir jederzeit weiter!
          </p>

          <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-emerald-700 group-hover:text-emerald-800 transition-colors relative z-10">
            <span>Jetzt Chat öffnen</span>
            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Floating Mascot Button */}
      {/* Strict positioning: Desktop fixed bottom-6 right-6, Mobile fixed bottom-20 right-4 (safely above the 64px tab-bar!) */}
      <div
        id="ace-assistant-floating-button"
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 select-none print:hidden"
      >
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          title="Tennis-Assistent 'Ace' öffnen"
          aria-label="Tennis-Assistent 'Ace' öffnen"
          className="ace-floating-btn group relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.25)] border-2 border-lime-400 hover:border-lime-500 active:scale-95 transition-all duration-200 cursor-pointer outline-none focus:ring-4 focus:ring-lime-300/60"
        >
          {/* Subtle online pulse indicator */}
          <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
          </span>

          {/* SVG Mascot: Pure React SVG tennis ball with felt seams, sporty headband, friendly blinking eyes, and smile */}
          <svg
            viewBox="0 0 100 100"
            className="w-11 h-11 sm:w-13 sm:h-13 drop-shadow-sm transition-transform group-hover:scale-105"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="aceBodyGrad" cx="38%" cy="32%" r="65%">
                <stop offset="0%" stopColor="#e2fb52" />
                <stop offset="65%" stopColor="#bada25" />
                <stop offset="100%" stopColor="#96be12" />
              </radialGradient>
              <filter id="aceSoftGlow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#4b6005" floodOpacity="0.25" />
              </filter>
            </defs>

            {/* Ball body */}
            <circle cx="50" cy="50" r="46" fill="url(#aceBodyGrad)" />

            {/* Tennis felt seams (classic white curves) */}
            <path
              d="M 16 26 C 36 34, 38 66, 16 74"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.2"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M 84 26 C 64 34, 62 66, 84 74"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.2"
              strokeLinecap="round"
              opacity="0.9"
            />

            {/* Sporty Headband (White band with green club accent line) */}
            <path
              d="M 12 40 C 35 34, 65 34, 88 40 L 86 31 C 65 25, 35 25, 14 31 Z"
              fill="#ffffff"
              filter="url(#aceSoftGlow)"
            />
            <path
              d="M 13 36 C 35 30, 65 30, 87 36"
              fill="none"
              stroke={primaryColor || "#1b4332"}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Friendly blinking eyes with light highlights */}
            <g className="ace-eye-blink">
              {/* Left Eye */}
              <ellipse cx="40" cy="53" rx="4.8" ry="6.2" fill="#1e293b" />
              <circle cx="38.5" cy="51" r="1.8" fill="#ffffff" />
              <circle cx="42" cy="55.5" r="0.8" fill="#ffffff" />

              {/* Right Eye */}
              <ellipse cx="60" cy="53" rx="4.8" ry="6.2" fill="#1e293b" />
              <circle cx="58.5" cy="51" r="1.8" fill="#ffffff" />
              <circle cx="62" cy="55.5" r="0.8" fill="#ffffff" />
            </g>

            {/* Cheerful rosy cheeks */}
            <ellipse cx="32" cy="62" rx="4" ry="2.2" fill="#ff7f7f" opacity="0.38" />
            <ellipse cx="68" cy="62" rx="4" ry="2.2" fill="#ff7f7f" opacity="0.38" />

            {/* Friendly smile */}
            <path
              d="M 43 64 Q 50 71 57 64"
              fill="none"
              stroke="#1e293b"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Interactive Assistant Modal / Dialog */}
      {isOpen && (
        <div
          id="ace-assistant-dialog"
          role="dialog"
          aria-label="Tennis-Assistent Ace Dialog"
          className="fixed bottom-20 right-3 sm:right-6 sm:bottom-24 z-50 h-[500px] max-h-[75vh] w-[92vw] sm:w-[380px] md:h-[640px] md:max-h-[82vh] md:w-[420px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200 select-none print:hidden"
        >
          {/* Header - Cleaned: Only Avatar + Name on left, Menu + Close on right */}
          <div className="bg-gradient-to-r from-emerald-900 via-[#1b4332] to-[#2d6a4f] text-white p-3.5 px-4 flex items-center justify-between shadow-sm shrink-0 relative">
            {/* Left: Avatar-Icon + Name "Ace" */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center p-0.5 border border-white/20">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="46" fill="#c8e630" />
                  <path d="M 18 26 C 36 34, 38 66, 18 74" fill="none" stroke="#fff" strokeWidth="4" />
                  <path d="M 82 26 C 64 34, 62 66, 82 74" fill="none" stroke="#fff" strokeWidth="4" />
                  <ellipse cx="40" cy="52" rx="4.5" ry="6" fill="#1e293b" />
                  <circle cx="38.5" cy="50" r="1.6" fill="#fff" />
                  <ellipse cx="60" cy="52" rx="4.5" ry="6" fill="#1e293b" />
                  <circle cx="58.5" cy="50" r="1.6" fill="#fff" />
                  <path d="M 43 64 Q 50 70 57 64" fill="none" stroke="#1e293b" strokeWidth="2.8" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-sm font-black tracking-tight text-white">Ace</h3>
            </div>

            {/* Right: Drei-Punkte-Menü (Option: "Assistent deaktivieren") und Schließen-Icon (X) */}
            <div className="flex items-center gap-1 relative">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(prev => !prev)}
                  title="Menü öffnen"
                  aria-label="Menü öffnen"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-20 text-slate-700 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleDirectDisable();
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Assistent deaktivieren</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsOpen(false);
                }}
                title="Schließen"
                aria-label="Dialog schließen"
                className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 pb-4 space-y-3 bg-slate-50/70 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3 shadow-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#1b4332] text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                  }`}
                >
                  <FormattedMessageContent text={msg.text} isUser={msg.sender === 'user'} />
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}
            {isTyping && (
              <div className="flex flex-col items-start animate-in fade-in duration-200">
                <div className="bg-white text-slate-500 border border-slate-200/80 rounded-2xl rounded-bl-xs px-3.5 py-2.5 shadow-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.18s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.36s]"></span>
                  <span className="text-[10px] text-slate-400 ml-1 font-medium">Ace liest im Club-Handbuch...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Text Input Footer - directly below chat history (no quick chips) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion(inputText);
            }}
            className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Frage zu Regeln oder Club stellen..."
              className="flex-1 bg-slate-100 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1b4332] focus:bg-white placeholder:text-slate-400 transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-9 h-9 rounded-xl bg-[#1b4332] hover:bg-black text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-sm active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default TennisAssistantWidget;
