import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Users,
  UserCog,
  Trophy,
  CreditCard,
  Search,
  ChevronDown,
  X,
  ArrowLeft,
  HelpCircle,
  Sparkles,
  BookOpen,
  CheckCircle2
} from 'lucide-react';
import { USER_HELP_CATEGORIES, HelpCategory, HelpArticle } from '../../data/docs/userHelpData';
import { RichTextRenderer } from '../RichText';

interface UserHelpModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  isLoggedIn?: boolean;
  isModal?: boolean;
}

export const UserHelpModal: React.FC<UserHelpModalProps> = ({
  isOpen = true,
  onClose,
  onBack,
  isLoggedIn = true,
  isModal = false,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(USER_HELP_CATEGORIES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({
    [USER_HELP_CATEGORIES[0].articles[0].id]: true // First article expanded by default
  });

  const toggleArticle = (id: string) => {
    setExpandedArticles((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Calendar':
        return <Calendar className="w-4 h-4 shrink-0" />;
      case 'Users':
        return <Users className="w-4 h-4 shrink-0" />;
      case 'UserCog':
        return <UserCog className="w-4 h-4 shrink-0" />;
      case 'Trophy':
        return <Trophy className="w-4 h-4 shrink-0" />;
      case 'CreditCard':
        return <CreditCard className="w-4 h-4 shrink-0" />;
      default:
        return <BookOpen className="w-4 h-4 shrink-0" />;
    }
  };

  // Search filter across all categories & articles
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const results: { category: HelpCategory; article: HelpArticle }[] = [];
    USER_HELP_CATEGORIES.forEach((cat) => {
      cat.articles.forEach((art) => {
        const matchesTitle = art.title.toLowerCase().includes(q);
        const matchesSummary = art.summary.toLowerCase().includes(q);
        const matchesContent = art.content.toLowerCase().includes(q);
        const matchesKeywords = art.keywords.some((kw) => kw.toLowerCase().includes(q));

        if (matchesTitle || matchesSummary || matchesContent || matchesKeywords) {
          results.push({ category: cat, article: art });
        }
      });
    });
    return results;
  }, [searchQuery]);

  const activeCategory = useMemo(() => {
    return USER_HELP_CATEGORIES.find((c) => c.id === activeCategoryId) || USER_HELP_CATEGORIES[0];
  }, [activeCategoryId]);

  if (!isOpen && isModal) return null;

  const content = (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden flex flex-col h-full max-h-[90dvh] select-text">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#1b4332] to-[#2d6a4f] text-white p-5 sm:p-7 relative shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer mr-1"
                title="Zurück"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-lime-400">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                Hilfe &amp; Funktionen
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-lime-400 text-slate-950">
                  Offiziell
                </span>
              </h2>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                Schritt-für-Schritt-Anleitungen für alle Club-Mitglieder
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Global Search Bar */}
        <div className="mt-4 relative">
          <Search className="w-4 h-4 text-emerald-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Suchbegriff eingeben (z. B. Stornieren, Gastspieler, Meisterschaft, Passwort)..."
            className="w-full bg-white/15 hover:bg-white/20 focus:bg-white text-white focus:text-slate-900 placeholder:text-emerald-200/70 focus:placeholder:text-slate-400 text-xs sm:text-sm pl-10 pr-9 py-2.5 rounded-xl border border-white/20 focus:border-white outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Container: Split Desktop, Stacked Mobile */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/60">
        {/* Left Column: Category Navigation (hidden when searching) */}
        {!searchResults && (
          <div className="w-full md:w-72 lg:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200/80 p-3 sm:p-4 shrink-0 overflow-x-auto md:overflow-y-auto no-scrollbar">
            <span className="hidden md:block text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 mb-2">
              Themenbereiche
            </span>
            <div className="flex md:flex-col gap-1.5 min-w-max md:min-w-0">
              {USER_HELP_CATEGORIES.map((cat) => {
                const isActive = cat.id === activeCategoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#1b4332] text-white shadow-sm font-bold'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className={isActive ? 'text-lime-300' : 'text-slate-400'}>
                      {getCategoryIcon(cat.iconName)}
                    </span>
                    <span className="truncate">{cat.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Right Column: Articles Accordion Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4">
          {searchResults ? (
            /* Search Results View */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700">
                  Suchergebnisse für <span className="text-[#1b4332]">„{searchQuery}“</span> ({searchResults.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-[#1b4332] hover:underline font-semibold cursor-pointer"
                >
                  Suche zurücksetzen
                </button>
              </div>

              {searchResults.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold text-slate-600">Keine passenden Hilfeeinträge gefunden</p>
                  <p className="text-xs mt-1">Versuche es mit einem anderen Begriff wie „Buchen“, „Gast“ oder „Profil“.</p>
                </div>
              ) : (
                searchResults.map(({ category, article }) => (
                  <ArticleAccordionCard
                    key={article.id}
                    article={article}
                    categoryBadge={category.title}
                    isExpanded={expandedArticles[article.id] ?? true}
                    onToggle={() => toggleArticle(article.id)}
                  />
                ))
              )}
            </div>
          ) : (
            /* Selected Category View */
            <div className="space-y-4">
              {/* Category Header */}
              <div className="pb-3 border-b border-slate-200/80">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-[#1b4332] tracking-wider mb-1">
                  {getCategoryIcon(activeCategory.iconName)}
                  <span>{activeCategory.title}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  {activeCategory.description}
                </p>
              </div>

              {/* Accordion List */}
              <div className="space-y-3">
                {activeCategory.articles.map((article, idx) => (
                  <ArticleAccordionCard
                    key={article.id}
                    article={article}
                    isExpanded={expandedArticles[article.id] ?? idx === 0}
                    onToggle={() => toggleArticle(article.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[2500] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-4xl h-full max-h-[88dvh]">{content}</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto h-full flex flex-col py-2 sm:py-6 px-2 sm:px-4 animate-in fade-in duration-300">
      {content}
    </div>
  );
};

interface ArticleAccordionCardProps {
  article: HelpArticle;
  categoryBadge?: string;
  isExpanded: boolean;
  onToggle: () => void;
}

const ArticleAccordionCard: React.FC<ArticleAccordionCardProps> = ({
  article,
  categoryBadge,
  isExpanded,
  onToggle
}) => {
  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isExpanded
          ? 'bg-white border-[#1b4332]/40 shadow-sm ring-1 ring-[#1b4332]/10'
          : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-xs'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 sm:p-5 text-left flex items-start justify-between gap-3 cursor-pointer outline-none group"
      >
        <div className="space-y-1 pr-2">
          {categoryBadge && (
            <span className="inline-block text-[10px] font-black uppercase tracking-wider text-[#1b4332] bg-emerald-50 px-2 py-0.5 rounded-md mb-1">
              {categoryBadge}
            </span>
          )}
          <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#1b4332] transition-colors leading-snug">
            {article.title}
          </h4>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {article.summary}
          </p>
        </div>
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-180 bg-slate-100 text-[#1b4332]' : 'text-slate-400 group-hover:text-slate-600'
          }`}
        >
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 sm:px-6 pb-5 pt-1 border-t border-slate-100 bg-slate-50/50 animate-in fade-in duration-150">
          <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed pt-2">
            <RichTextRenderer text={article.content} />
          </div>

          {article.keywords && article.keywords.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Schlagwörter:</span>
              {article.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="text-[10px] font-medium bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-md"
                >
                  #{kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserHelpModal;
