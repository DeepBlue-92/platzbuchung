import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Settings,
  CreditCard,
  Shield,
  Users,
  LayoutGrid,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  FileText
} from "lucide-react";
import { ADMIN_WIKI_CATEGORIES, AdminWikiCategory, AdminWikiArticle } from "../data/docs/adminWikiData";
import { RichTextRenderer } from "./RichText";

export const AdminDocumentation: React.FC = () => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(ADMIN_WIKI_CATEGORIES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({
    [ADMIN_WIKI_CATEGORIES[0].articles[0].id]: true
  });

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case "Users":
        return <Users className="w-4 h-4 shrink-0" />;
      case "LayoutGrid":
        return <LayoutGrid className="w-4 h-4 shrink-0" />;
      case "Shield":
        return <Shield className="w-4 h-4 shrink-0" />;
      case "Settings":
        return <Settings className="w-4 h-4 shrink-0" />;
      case "CreditCard":
        return <CreditCard className="w-4 h-4 shrink-0" />;
      default:
        return <BookOpen className="w-4 h-4 shrink-0" />;
    }
  };

  const toggleArticle = (id: string) => {
    setExpandedArticles((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Search filter across all wiki categories and articles
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const results: { category: AdminWikiCategory; article: AdminWikiArticle }[] = [];
    ADMIN_WIKI_CATEGORIES.forEach((cat) => {
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
    return ADMIN_WIKI_CATEGORIES.find((c) => c.id === activeCategoryId) || ADMIN_WIKI_CATEGORIES[0];
  }, [activeCategoryId]);

  return (
    <div id="admin-documentation-root" className="w-full flex flex-col gap-6">
      {/* Top Header Card */}
      <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-[var(--color-primary)] rounded-xl shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              Administratoren-Handbuch &amp; System-Wiki
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#1b4332] text-white">
                Global &amp; Zentral
              </span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Zentrale Dokumentation zu Berechnungsmodellen, Rollen, Plätzen, Schnittstellen und Systemtarifen.
            </p>
          </div>
        </div>

        {/* Search input in Admin Wiki */}
        <div className="w-full sm:w-72 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Wiki durchsuchen..."
            className="w-full h-9 pl-8 pr-7 bg-white text-xs text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Mobile dropdown selector */}
        {!searchResults && (
          <div className="md:hidden w-full">
            <label htmlFor="wiki-category-select" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Kapitel auswählen
            </label>
            <select
              id="wiki-category-select"
              value={activeCategoryId}
              onChange={(e) => setActiveCategoryId(e.target.value)}
              className="w-full h-11 px-4 bg-white text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] cursor-pointer shadow-xs font-sans font-medium"
            >
              {ADMIN_WIKI_CATEGORIES.map((cat, idx) => (
                <option key={cat.id} value={cat.id}>
                  {idx + 1}. {cat.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Desktop Navigation */}
        {!searchResults && (
          <div className="hidden md:block w-72 shrink-0">
            <div className="flex flex-col gap-1 bg-slate-50 p-2 rounded-2xl border border-slate-200/50">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-3 py-1">
                Wiki-Kapitel
              </span>
              {ADMIN_WIKI_CATEGORIES.map((cat, idx) => {
                const isActive = cat.id === activeCategoryId;
                return (
                  <button
                    key={cat.id}
                    id={`desktop-tab-${cat.id}`}
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`flex items-center gap-2.5 py-3 px-3.5 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-[var(--color-primary)] font-bold shadow-xs border border-slate-200/70"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                  >
                    <span className={isActive ? "text-[var(--color-primary)]" : "text-slate-400"}>
                      {getCategoryIcon(cat.iconName)}
                    </span>
                    <span className="truncate">{idx + 1}. {cat.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {searchResults ? (
            /* Search Results */
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700">
                  Suchergebnisse im Admin-Wiki für <span className="text-[var(--color-primary)] font-black">„{searchQuery}“</span> ({searchResults.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-[var(--color-primary)] hover:underline font-semibold cursor-pointer"
                >
                  Suche zurücksetzen
                </button>
              </div>

              {searchResults.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold text-slate-600">Keine passenden Wiki-Einträge gefunden</p>
                  <p className="text-xs mt-1">Versuche es mit Begriffen wie „Rollen“, „Plätze“, „Gastspiel“ oder „Timeline“.</p>
                </div>
              ) : (
                searchResults.map(({ category, article }) => (
                  <WikiArticleCard
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
            /* Category Details */
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
              <div className="pb-4 border-b border-slate-150">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-[var(--color-primary)] tracking-wider mb-1">
                  {getCategoryIcon(activeCategory.iconName)}
                  <span>{activeCategory.title}</span>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {activeCategory.description}
                </p>
              </div>

              {/* Articles List */}
              <div className="space-y-4">
                {activeCategory.articles.map((article, idx) => (
                  <WikiArticleCard
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
};

interface WikiArticleCardProps {
  article: AdminWikiArticle;
  categoryBadge?: string;
  isExpanded: boolean;
  onToggle: () => void;
}

const WikiArticleCard: React.FC<WikiArticleCardProps> = ({
  article,
  categoryBadge,
  isExpanded,
  onToggle
}) => {
  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isExpanded
          ? "bg-white border-emerald-600/40 shadow-xs ring-1 ring-emerald-600/10"
          : "bg-white border-slate-200/90 hover:border-slate-300"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 sm:p-5 text-left flex items-start justify-between gap-3 cursor-pointer outline-none group"
      >
        <div className="space-y-1 pr-2">
          {categoryBadge && (
            <span className="inline-block text-[10px] font-black uppercase tracking-wider text-[var(--color-primary)] bg-emerald-50 px-2 py-0.5 rounded-md mb-1">
              {categoryBadge}
            </span>
          )}
          <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[var(--color-primary)] transition-colors leading-snug">
            {article.title}
          </h4>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {article.summary}
          </p>
        </div>
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
            isExpanded ? "rotate-180 bg-slate-100 text-[var(--color-primary)]" : "text-slate-400 group-hover:text-slate-600"
          }`}
        >
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 sm:px-6 pb-5 pt-1 border-t border-slate-100 bg-slate-50/40 animate-in fade-in duration-150">
          <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed pt-2">
            <RichTextRenderer text={article.content} />
          </div>

          {article.keywords && article.keywords.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Schlagwörter:</span>
              {article.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="text-[10px] font-medium bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded-md"
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
