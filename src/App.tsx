import React, { useState, useEffect, useMemo } from 'react';
import { Search, Sparkles, Loader2, Zap, Github, Twitter, AlertCircle, XCircle, Heart, User as UserIcon, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TOOLS_DB, CATEGORIES } from './lib/tools-db';
import { Tool } from './types';
import ToolCard from './components/ToolCard';
import CategoryPills from './components/CategoryPills';
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
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

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
            setFavorites(userDoc.data().favorites || []);
          } else {
            // Create initial profile
            const initialProfile = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              favorites: [],
              role: 'user',
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, initialProfile);
            setFavorites([]);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
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

  // Reset smart results and errors when query changes or mode changes
  useEffect(() => {
    setSmartResults(null);
    setError(null);
  }, [searchQuery, isSmartSearch]);

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
          body: JSON.stringify({ query: searchQuery }),
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
        }
      } catch (err) {
        console.error('Smart search failed:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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

  const filteredTools = useMemo(() => {
    let tools = TOOLS_DB;

    // Apply Favorites Filter
    if (showFavoritesOnly) {
      tools = tools.filter(t => favorites.includes(t.id));
    }

    // Apply Smart Search results if available
    if (isSmartSearch && smartResults) {
      return tools.filter(t => smartResults.includes(t.id));
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
            <a href="#" className="hover:text-white transition-colors">Directory</a>
            <a href="#" className="hover:text-white transition-colors">Submit Tool</a>
            <a href="#" className="hover:text-white transition-colors">Newsletter</a>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
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
                {isLoggingIn ? 'Signing in...' : 'Sign In'}
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
              Find the perfect AI <br /> for any task.
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
              Nexus is the world's most advanced AI tool directory. 
              Use our smart search to find solutions by describing your problem.
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
                placeholder={isSmartSearch ? "Describe what you want to achieve..." : "Search by name, category, or tags..."}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-5 pl-14 pr-32 text-lg focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-zinc-700 transition-all placeholder:text-zinc-600"
              />
              <div className="absolute inset-y-2 right-2 flex items-center gap-2">
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
                  {isSmartSearch ? 'Smart' : 'Standard'}
                </button>
                {isSmartSearch && (
                  <button
                    type="submit"
                    disabled={isLoading || !searchQuery.trim()}
                    className="bg-zinc-100 text-black px-4 py-2 rounded-xl text-sm font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Search'}
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

        {/* Filters and Grid */}
        <section>
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CategoryPills 
              categories={CATEGORIES} 
              activeCategory={activeCategory} 
              onSelect={setActiveCategory} 
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
                Favorites Only
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
              {isLoading ? 'AI is thinking...' : `${filteredTools.length} Tools Found`}
            </h2>
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
                    <ToolCard tool={tool} />
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
              <h3 className="text-xl font-semibold text-zinc-300 mb-2">No tools found</h3>
              <p className="text-zinc-500">Try adjusting your search or filters to find what you're looking for.</p>
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
    </div>
  );
}
