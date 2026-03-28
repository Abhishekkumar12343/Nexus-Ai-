import React, { useState, useEffect, useMemo } from 'react';
import { Search, Sparkles, Loader2, Zap, Github, Twitter, AlertCircle, XCircle, Heart, User as UserIcon, LogOut, Brain, CheckCircle2, Globe, BarChart3, Youtube, Briefcase, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TOOLS_DB, CATEGORIES } from './lib/tools-db';
import { WORKFLOW_TEMPLATES } from './lib/workflows-db';
import { Tool, UserProfile, AiContext, AppLanguage, WorkflowTemplate, UserBudget, PrivacySettings } from './types';
import ToolCard from './components/ToolCard';
import CategoryPills from './components/CategoryPills';
import AiContextModal from './components/AiContextModal';
import { WorkflowSection } from './components/WorkflowSection';
import { CostIntelligence } from './components/CostIntelligence';
import { PrivacyTransparency } from './components/PrivacyTransparency';
import { TRANSLATIONS } from './lib/translations';
import { calculateCost } from './lib/cost-utils';
import { auth, loginWithGoogle, logout, onAuthStateChanged, db, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, User, handleFirestoreError, OperationType } from './firebase';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSmartSearch, setIsSmartSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [smartResults, setSmartResults] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Auth & Favorites State
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isAiContextModalOpen, setIsAiContextModalOpen] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [translatedDescriptions, setTranslatedDescriptions] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem('nexus_translations');
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      console.error('Failed to parse cached translations:', e);
      return {};
    }
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [appliedWorkflowId, setAppliedWorkflowId] = useState<string | null>(null);

  const t = TRANSLATIONS[language];

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Fetch or create user profile
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUserProfile(profile);
            setFavorites(profile.favorites || []);
            if (profile.language) setLanguage(profile.language);
          } else {
            // Create initial profile
            const initialProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              favorites: [],
              language: 'en',
              role: 'user',
              createdAt: new Date().toISOString(),
              budget: { limit: 5.00, alertThreshold: 80 },
              totalSpend: 0,
              costHistory: [],
              privacy: {
                dataLogging: false,
                trainingOptOut: true,
                retentionDays: 30
              }
            };
            await setDoc(userDocRef, initialProfile);
            setUserProfile(initialProfile);
            setFavorites([]);
            setLanguage('en');
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setUserProfile(null);
        setFavorites([]);
        setShowFavoritesOnly(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Debounce logic for standard search
  useEffect(() => {
    if (isSmartSearch) {
      setDebouncedSearchQuery(searchQuery);
      return;
    }
    
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, isSmartSearch]);

  // Reset smart results and errors only when mode changes, not on every keystroke
  useEffect(() => {
    setSmartResults(null);
    setError(null);
  }, [isSmartSearch]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Login failed:', err);
      if (err.code === 'auth/popup-blocked') {
        setError("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        console.log('Popup request cancelled');
      } else if (err.code === 'auth/popup-closed-by-user') {
        console.log('Popup closed by user');
      } else {
        setError(err.message || "An error occurred during sign-in.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleApplyWorkflow = async (template: WorkflowTemplate) => {
    setAppliedWorkflowId(template.id);
    setSearchQuery(template.query);
    
    // Apply suggested context if user is logged in
    if (user && template.suggestedContext) {
      const userDocRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userDocRef, { aiContext: template.suggestedContext });
        setUserProfile(prev => prev ? { ...prev, aiContext: template.suggestedContext } : null);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    }

    // Scroll to tools section
    const toolsSection = document.getElementById('tools-section');
    if (toolsSection) {
      toolsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Reset applied status after some time
    setTimeout(() => setAppliedWorkflowId(null), 3000);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (isSmartSearch) {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/smart-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: searchQuery,
            aiContext: userProfile?.aiContext,
            language: language
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to perform smart search');
        }

        const data = await response.json();
        if (data.recommendedIds) {
          setSmartResults(data.recommendedIds);
          if (data.recommendedIds.length === 0) {
            setError("AI couldn't find specific tools for this request. Try a different description.");
          }
          
          if (data.usage) {
            updateCostHistory('smart-search', data.model, data.usage.promptTokenCount, data.usage.candidatesTokenCount);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'api/smart-search');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleFavorite = async (toolId: string) => {
    if (!user) {
      setError("Please sign in to favorite tools.");
      return;
    }

    const isFavorited = favorites.includes(toolId);
    const userDocRef = doc(db, 'users', user.uid);

    try {
      if (isFavorited) {
        await updateDoc(userDocRef, { favorites: arrayRemove(toolId) });
        setFavorites(prev => prev.filter(id => id !== toolId));
      } else {
        await updateDoc(userDocRef, { favorites: arrayUnion(toolId) });
        setFavorites(prev => [...prev, toolId]);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleSaveAiContext = async (context: AiContext) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, { aiContext: context });
      setUserProfile(prev => prev ? { ...prev, aiContext: context } : null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLanguageChange = async (newLang: AppLanguage) => {
    setLanguage(newLang);
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userDocRef, { language: newLang });
        setUserProfile(prev => prev ? { ...prev, language: newLang } : null);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  const handleUpdateBudget = async (budget: UserBudget) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, { budget });
      setUserProfile(prev => prev ? { ...prev, budget } : null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleUpdatePrivacy = async (privacy: PrivacySettings) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, { privacy });
      setUserProfile(prev => prev ? { ...prev, privacy } : null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateCostHistory = async (operation: string, model: string, inputTokens: number, outputTokens: number) => {
    if (!user || !userProfile) return;
    
    const cost = calculateCost(model, inputTokens, outputTokens);
    const newRecord = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      operation,
      model,
      inputTokens,
      outputTokens,
      cost
    };

    const newTotalSpend = (userProfile.totalSpend || 0) + cost;
    const newHistory = [...(userProfile.costHistory || []), newRecord].slice(-50); // Keep last 50

    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, { 
        totalSpend: newTotalSpend,
        costHistory: newHistory
      });
      setUserProfile(prev => prev ? { 
        ...prev, 
        totalSpend: newTotalSpend, 
        costHistory: newHistory 
      } : null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const filteredTools = useMemo(() => {
    let tools = TOOLS_DB;

    // Apply Favorites Filter
    if (showFavoritesOnly) {
      tools = tools.filter(t => favorites.includes(t.id));
    }

    // Apply Smart Search results if available
    if (isSmartSearch) {
      if (smartResults) {
        return tools.filter(t => smartResults.includes(t.id));
      }
      // If in smart search mode but no results yet, and query is empty, show all
      if (!searchQuery.trim()) return tools;
      // If there's a query but no results yet, show nothing or previous tools
      // Let's show nothing to indicate we're waiting for a search
      return [];
    }

    // Apply Category Filter
    if (activeCategory) {
      tools = tools.filter(t => t.category === activeCategory);
    }

    // Apply Standard Search (using debounced query)
    if (!isSmartSearch && debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      tools = tools.filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return tools;
  }, [debouncedSearchQuery, activeCategory, isSmartSearch, smartResults, favorites, showFavoritesOnly]);

  // Translation logic
  useEffect(() => {
    if (language === 'en' || filteredTools.length === 0) {
      return;
    }

    const translateTools = async () => {
      // Get pre-translated tools from the translation file
      const preTranslated = t.toolDescriptions || {};
      
      // Only translate the first 24 tools to avoid massive API calls
      // Filter out tools that are already in state, in localStorage, or pre-translated
      const toolsToTranslate = filteredTools.slice(0, 24).filter(t => 
        !translatedDescriptions[`${language}_${t.id}`] && !preTranslated[t.id]
      );
      
      if (toolsToTranslate.length === 0) return;

      setIsTranslating(true);
      try {
        const response = await fetch('/api/translate-tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolIds: toolsToTranslate.map(t => t.id),
            language: language
          })
        });

        if (response.ok) {
          const data = await response.json();
          const newTranslations: Record<string, string> = {};
          Object.entries(data.translations).forEach(([id, text]) => {
            newTranslations[`${language}_${id}`] = text as string;
          });

          if (data.usage) {
            updateCostHistory('translate-tools', data.model, data.usage.promptTokenCount, data.usage.candidatesTokenCount);
          }

          setTranslatedDescriptions(prev => {
            const updated = { ...prev, ...newTranslations };
            localStorage.setItem('nexus_translations', JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'api/translate-tools');
      } finally {
        setIsTranslating(false);
      }
    };

    const timeoutId = setTimeout(translateTools, 200);
    return () => clearTimeout(timeoutId);
  }, [language, filteredTools, t.toolDescriptions]);

  // Reset translations state is not needed as we use language prefix in keys
  
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-white selection:text-black">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <Zap size={20} className="text-black fill-black" />
            </div>
            <span className="text-xl font-bold tracking-tight">NEXUS</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <a href="#" className="hover:text-white transition-colors">{t.directory}</a>
            <a href="#" className="hover:text-white transition-colors">{t.submitTool}</a>
            <a href="#" className="hover:text-white transition-colors">{t.newsletter}</a>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group/lang">
              <button className="flex items-center gap-1.5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
                <Globe size={18} />
                <span className="text-xs font-bold uppercase">{language}</span>
              </button>
              <div className="absolute top-full right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl opacity-0 invisible group-hover/lang:opacity-100 group-hover/lang:visible transition-all z-[100] overflow-hidden">
                {(['en', 'hi', 'hinglish', 'ta', 'te'] as AppLanguage[]).map(lang => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                    className={`w-full px-4 py-2 text-left text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors ${language === lang ? 'text-white bg-zinc-800' : 'text-zinc-500'}`}
                  >
                    {lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : lang === 'hinglish' ? 'Hinglish' : lang === 'ta' ? 'Tamil' : 'Telugu'}
                  </button>
                ))}
              </div>
            </div>
            {user ? (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsAiContextModalOpen(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                    userProfile?.aiContext?.goals || userProfile?.aiContext?.style || userProfile?.aiContext?.work
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                  }`}
                >
                  <Brain size={14} />
                  {userProfile?.aiContext?.goals || userProfile?.aiContext?.style || userProfile?.aiContext?.work ? t.memoryActive : t.setMemory}
                </button>
                <button 
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`p-2 rounded-full transition-all ${showFavoritesOnly ? 'bg-red-500/20 text-red-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                >
                  <Heart size={20} fill={showFavoritesOnly ? "currentColor" : "none"} />
                </button>
                <div className="flex items-center gap-3 pl-4 border-l border-zinc-800">
                  <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-zinc-700" />
                  <button onClick={logout} className="text-zinc-400 hover:text-white transition-colors">
                    <LogOut size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? <Loader2 size={16} className="animate-spin" /> : <UserIcon size={16} />}
                {isLoggingIn ? t.signingIn : t.signIn}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-4 max-w-7xl mx-auto">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
              {t.heroTitle}
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
              {t.heroSubtitle}
            </p>
          </motion.div>

          {/* Search Bar Container */}
          <div className="max-w-3xl mx-auto relative">
            <form onSubmit={handleSearch} className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-white transition-colors">
                {isSmartSearch ? <Sparkles size={20} /> : <Search size={20} />}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isSmartSearch ? t.smartSearchPlaceholder : t.searchPlaceholder}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-5 pl-14 pr-40 text-lg focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-zinc-700 transition-all placeholder:text-zinc-600"
              />
              <div className="absolute inset-y-2 right-2 flex items-center gap-2">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSmartResults(null);
                    }}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <XCircle size={20} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSmartSearch(!isSmartSearch)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    isSmartSearch 
                      ? 'bg-white text-black shadow-lg shadow-white/10' 
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  <Sparkles size={14} />
                  {isSmartSearch ? t.smartMode : t.standardMode}
                </button>
                {isSmartSearch && (
                  <button
                    type="submit"
                    disabled={isLoading || !searchQuery.trim()}
                    className="bg-zinc-100 text-black px-4 py-2 rounded-xl text-sm font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                    {isLoading ? t.thinking : t.search}
                  </button>
                )}
              </div>
            </form>
            
            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm"
                >
                  <AlertCircle size={18} />
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="ml-auto text-red-400/50 hover:text-red-400">
                    <XCircle size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Search Suggestions */}
            {!searchQuery && isSmartSearch && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {['remove background from audio', 'generate realistic portraits', 'write code for a landing page'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setSearchQuery(suggestion)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors border border-zinc-800 px-3 py-1 rounded-full hover:border-zinc-700"
                  >
                    "{suggestion}"
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Cost Intelligence Section */}
        {userProfile && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <CostIntelligence 
              profile={userProfile} 
              onUpdateBudget={handleUpdateBudget}
              language={language}
            />
            <PrivacyTransparency 
              profile={userProfile} 
              onUpdatePrivacy={handleUpdatePrivacy}
              language={language}
            />
          </div>
        )}

        {/* Workflows Section */}
        <WorkflowSection 
          onApply={handleApplyWorkflow} 
          translations={t} 
          appliedId={appliedWorkflowId} 
        />

        {/* Filters and Grid */}
        <section id="tools-section">
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CategoryPills 
              categories={CATEGORIES} 
              activeCategory={activeCategory} 
              onSelect={setActiveCategory} 
              translations={t.categories}
            />
            {user && (
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  showFavoritesOnly 
                    ? 'bg-red-500 text-white border-red-500' 
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <Heart size={16} fill={showFavoritesOnly ? "currentColor" : "none"} />
                {t.favoritesOnly}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                {isLoading ? t.aiThinking : `${filteredTools.length} ${t.toolsFound}`}
                {isTranslating && (
                  <span className="flex items-center gap-1 text-blue-400 animate-pulse">
                    <Loader2 size={12} className="animate-spin" />
                    {t.translating}
                  </span>
                )}
              </h2>
              {isSmartSearch && smartResults && (
                <span className="px-2 py-0.5 bg-white/10 text-white/60 text-[10px] font-bold uppercase tracking-tighter rounded border border-white/5">
                  {t.aiRecommended}
                </span>
              )}
            </div>
            <div className="h-px flex-1 bg-zinc-800/50 mx-6"></div>
          </div>

          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl aspect-[4/3] animate-pulse">
                    <div className="w-full h-1/2 bg-zinc-800 rounded-t-2xl"></div>
                    <div className="p-5 space-y-3">
                      <div className="h-6 w-1/2 bg-zinc-800 rounded"></div>
                      <div className="h-4 w-full bg-zinc-800 rounded"></div>
                      <div className="h-4 w-3/4 bg-zinc-800 rounded"></div>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                key="grid"
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {filteredTools.map((tool) => (
                  <motion.div
                    key={tool.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="relative"
                  >
                    <ToolCard 
                      tool={tool} 
                      freeAlternativeLabel={t.freeAlternative} 
                      translatedDescription={translatedDescriptions[`${language}_${tool.id}`] || t.toolDescriptions?.[tool.id]}
                    />
                    {user && (
                      <button
                        onClick={() => toggleFavorite(tool.id)}
                        className={`absolute top-4 right-16 p-2 rounded-full backdrop-blur-md transition-all z-10 ${
                          favorites.includes(tool.id) 
                            ? 'bg-red-500 text-white' 
                            : 'bg-black/20 text-white/70 hover:bg-black/40 hover:text-white'
                        }`}
                      >
                        <Heart size={18} fill={favorites.includes(tool.id) ? "currentColor" : "none"} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {!isLoading && filteredTools.length === 0 && (
            <div className="py-20 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 mb-4">
                <Search size={32} className="text-zinc-700" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-300 mb-2">{t.noToolsFound}</h3>
              <p className="text-zinc-500">{t.noToolsSubtitle}</p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center">
              <Zap size={14} className="text-zinc-400" />
            </div>
            <span className="text-lg font-bold tracking-tight text-zinc-400">NEXUS</span>
          </div>
          
          <div className="flex gap-8 text-sm text-zinc-500">
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-4 text-zinc-500">
            <Twitter size={18} className="hover:text-white transition-colors cursor-pointer" />
            <Github size={18} className="hover:text-white transition-colors cursor-pointer" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto text-center mt-8 text-xs text-zinc-700">
          © 2026 Nexus AI Aggregator. All rights reserved.
        </div>
      </footer>

      <AiContextModal 
        isOpen={isAiContextModalOpen} 
        onClose={() => setIsAiContextModalOpen(false)} 
        initialContext={userProfile?.aiContext}
        onSave={handleSaveAiContext}
        language={language}
      />
    </div>
  );
}
