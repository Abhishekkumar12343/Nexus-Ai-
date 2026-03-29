import React, { useState, useEffect, useMemo } from 'react';
import { Search, Sparkles, Loader2, Zap, Github, Twitter, AlertCircle, XCircle, Heart, User as UserIcon, LogOut, Brain, CheckCircle2, Globe, BarChart3, Youtube, Briefcase, GraduationCap, Menu, X, ChevronDown, Mic, Image as ImageIcon, Maximize2, Minimize2, Settings2, Send, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TOOLS_DB, CATEGORIES } from './lib/tools-db';
import { WORKFLOW_TEMPLATES } from './lib/workflows-db';
import { Tool, UserProfile, AiContext, AppLanguage, WorkflowTemplate, UserBudget, PrivacySettings } from './types';
import ToolCard from './components/ToolCard';
import CategoryPills from './components/CategoryPills';
import AiContextModal from './components/AiContextModal';
import { WorkflowSection } from './components/WorkflowSection';
import { smartSearch, translateTools as translateToolsService, generateImage, connectLive } from './services/gemini';
import { CostIntelligence } from './components/CostIntelligence';
import { PrivacyTransparency } from './components/PrivacyTransparency';
import { TRANSLATIONS } from './lib/translations';
import { calculateCost } from './lib/cost-utils';
import { auth, loginWithGoogle, logout, onAuthStateChanged, db, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, User, handleFirestoreError, OperationType } from './firebase';

// --- Components ---
const ImageGenerator = ({ onGenerate, isLoading, result, language }: { onGenerate: (prompt: string, ratio: string) => void, isLoading: boolean, result: string | null, language: AppLanguage }) => {
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const ratios = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
          <ImageIcon size={20} />
        </div>
        <h3 className="text-lg font-bold tracking-tight">AI Image Studio</h3>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Prompt</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to create..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-all h-32 resize-none"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Aspect Ratio</label>
            <div className="grid grid-cols-4 gap-2">
              {ratios.map(r => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                    ratio === r 
                      ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={() => onGenerate(prompt, ratio)}
            disabled={isLoading || !prompt.trim()}
            className="w-full bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Wand2 size={20} />}
            Generate Image
          </button>
        </div>
        
        <div className="aspect-square bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center overflow-hidden relative group">
          {result ? (
            <>
              <img src={result} alt="Generated" className="w-full h-full object-contain" />
              <a 
                href={result} 
                download="nexus-ai-image.png"
                className="absolute bottom-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Maximize2 size={20} />
              </a>
            </>
          ) : (
            <div className="text-center space-y-2">
              <ImageIcon size={48} className="mx-auto text-zinc-800" />
              <p className="text-sm text-zinc-600">Your masterpiece will appear here</p>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="animate-spin text-purple-400" />
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Painting...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LiveConversation = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const sessionRef = React.useRef<any>(null);

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const session = await connectLive({
        onopen: () => {
          setIsConnected(true);
          setIsConnecting(false);
          setIsRecording(true);
        },
        onmessage: (message: any) => {
          if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
            const text = message.serverContent.modelTurn.parts[0].text;
            setTranscript(prev => [...prev, { role: 'model', text }]);
          }
          if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
            // Play audio
            const base64 = message.serverContent.modelTurn.parts[0].inlineData.data;
            playAudio(base64);
          }
        },
        onclose: () => {
          setIsConnected(false);
          setIsRecording(false);
        },
        onerror: (err: any) => {
          console.error('Live API Error:', err);
          setIsConnecting(false);
        }
      });
      sessionRef.current = session;
    } catch (err) {
      console.error('Failed to connect to Live API:', err);
      setIsConnecting(false);
    }
  };

  const playAudio = async (base64: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    // Live API returns raw PCM 16bit 16kHz
    const audioBuffer = audioContextRef.current.createBuffer(1, bytes.length / 2, 16000);
    const channelData = audioBuffer.getChannelData(0);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = view.getInt16(i * 2, true) / 32768;
    }
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    setIsConnected(false);
    setIsRecording(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col h-[80vh] shadow-2xl shadow-blue-500/10"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`} />
            <h3 className="font-bold tracking-tight">Live Voice Conversation</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {transcript.length === 0 && !isConnecting && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400">
                <Mic size={48} />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold">Ready to talk?</h4>
                <p className="text-zinc-500 max-w-xs mx-auto">Have a real-time conversation with Nexus AI about tools, workflows, or anything else.</p>
              </div>
              <button 
                onClick={startSession}
                className="bg-blue-500 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
              >
                Start Conversation
              </button>
            </div>
          )}
          
          {isConnecting && (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 size={48} className="animate-spin text-blue-400" />
              <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Establishing Secure Link...</p>
            </div>
          )}
          
          {transcript.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        
        {isConnected && (
          <div className="p-8 border-t border-zinc-800 bg-zinc-900/50 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4, 5].map(i => (
                <motion.div 
                  key={i}
                  animate={{ height: [10, 30, 10] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                  className="w-1 bg-blue-400 rounded-full"
                />
              ))}
            </div>
            <button 
              onClick={stopSession}
              className="bg-red-500/10 text-red-400 border border-red-500/20 px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
            >
              End Session
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSmartSearch, setIsSmartSearch] = useState(false);
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [smartResults, setSmartResults] = useState<string[] | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Auth & Favorites State
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isAiContextModalOpen, setIsAiContextModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  // Image Generation State
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  // Live API State
  const [isLiveOpen, setIsLiveOpen] = useState(false);

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
              budget: { monthlyLimit: 5.00, alertThreshold: 80 },
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
    setAiExplanation(null);
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
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`This domain is not authorized for Firebase Authentication. Please add "${window.location.hostname}" to the "Authorized Domains" list in the Firebase Console (Authentication > Settings).`);
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
      setAiExplanation(null);
      try {
        const data = await smartSearch(
          searchQuery,
          userProfile?.aiContext,
          language,
          isDeepResearch
        );
        
        if (data.recommendedIds) {
          setSmartResults(data.recommendedIds);
          setAiExplanation(data.explanation);
          if (data.recommendedIds.length === 0 && !data.explanation) {
            setError("AI couldn't find specific tools or provide an answer for this request. Try a different description.");
          }
          
          if (data.usage) {
            updateCostHistory('smart-search', 'gemini-3-flash-preview', data.usage.promptTokenCount, data.usage.candidatesTokenCount);
          }
        }
      } catch (err: any) {
        console.error('Smart Search Error:', err);
        setError(err.message || 'An error occurred during smart search.');
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

  const handleGenerateImage = async (prompt: string, ratio: string) => {
    setIsGeneratingImage(true);
    setError(null);
    try {
      const result = await generateImage(prompt, ratio);
      setGeneratedImage(result);
      updateCostHistory('image-generation', 'gemini-3.1-flash-image-preview', 100, 1000); // Estimated
    } catch (err: any) {
      console.error('Image Generation Error:', err);
      setError(err.message || 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const updateCostHistory = async (operation: string, model: string, inputTokens: number, outputTokens: number) => {
    if (!user || !userProfile) return;
    
    const cost = calculateCost(model, inputTokens, outputTokens);
    const newRecord = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
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
        const data = await translateToolsService(
          toolsToTranslate.map(t => t.id),
          language
        );

        if (data.translations) {
          const newTranslations: Record<string, string> = {};
          Object.entries(data.translations).forEach(([id, text]) => {
            newTranslations[`${language}_${id}`] = text as string;
          });

          if (data.usage) {
            updateCostHistory('translate-tools', 'gemini-3-flash-preview', data.usage.promptTokenCount, data.usage.candidatesTokenCount);
          }

          setTranslatedDescriptions(prev => {
            const updated = { ...prev, ...newTranslations };
            localStorage.setItem('nexus_translations', JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) {
        console.error('Translation Error:', err);
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
      {/* Live Conversation Modal */}
      <LiveConversation isOpen={isLiveOpen} onClose={() => setIsLiveOpen(false)} />

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-80 bg-zinc-950 border-l border-zinc-800 z-[70] p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                    <Zap size={20} className="text-black fill-black" />
                  </div>
                  <span className="text-xl font-bold tracking-tight">NEXUS</span>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex flex-col gap-2 mb-8">
                <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-900 transition-colors group">
                  <Globe size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                  <span className="font-medium">{t.directory}</span>
                </a>
                <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-900 transition-colors group">
                  <Briefcase size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                  <span className="font-medium">{t.submitTool}</span>
                </a>
                <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-900 transition-colors group">
                  <Youtube size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                  <span className="font-medium">{t.newsletter}</span>
                </a>
              </nav>

              <div className="mt-auto pt-6 border-t border-zinc-900">
                {user ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                      <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-10 h-10 rounded-full border border-zinc-700" />
                      <div className="overflow-hidden">
                        <p className="font-bold text-sm truncate">{user.displayName}</p>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        logout();
                        setIsSidebarOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold"
                    >
                      <LogOut size={18} />
                      {t.logout}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      handleLogin();
                      setIsSidebarOpen(false);
                    }}
                    className="w-full bg-white text-black p-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
                  >
                    <UserIcon size={18} />
                    {t.signIn}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Zap size={20} className="text-black fill-black" />
              </div>
              <span className="text-xl font-bold tracking-tight">NEXUS</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-1 bg-zinc-900/50 p-1 rounded-full border border-zinc-800/50">
              <a href="#" className="px-4 py-1.5 rounded-full text-sm font-medium text-white bg-zinc-800 shadow-sm transition-all">{t.directory}</a>
              <a href="#" className="px-4 py-1.5 rounded-full text-sm font-medium text-zinc-400 hover:text-white transition-all">{t.submitTool}</a>
              <a href="#" className="px-4 py-1.5 rounded-full text-sm font-medium text-zinc-400 hover:text-white transition-all">{t.newsletter}</a>
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative group/lang">
              <button className="flex items-center gap-1.5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
                <Globe size={18} />
                <span className="hidden sm:inline text-xs font-bold uppercase">{language}</span>
                <ChevronDown size={14} className="hidden sm:inline opacity-50 group-hover:rotate-180 transition-transform" />
              </button>
              <div className="absolute top-full right-0 mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl opacity-0 invisible group-hover/lang:opacity-100 group-hover/lang:visible transition-all z-[100] overflow-hidden">
                {(['en', 'hi', 'hinglish', 'ta', 'te'] as AppLanguage[]).map(lang => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                    className={`w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors flex items-center justify-between ${language === lang ? 'text-white bg-zinc-800' : 'text-zinc-500'}`}
                  >
                    {lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : lang === 'hinglish' ? 'Hinglish' : lang === 'ta' ? 'Tamil' : 'Telugu'}
                    {language === lang && <CheckCircle2 size={12} className="text-blue-400" />}
                  </button>
                ))}
              </div>
            </div>

            {user ? (
              <div className="flex items-center gap-2 md:gap-4">
                <button 
                  onClick={() => setIsAiContextModalOpen(true)}
                  className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
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

                <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-zinc-800">
                  <div className="relative group/user">
                    <button className="flex items-center gap-2">
                      <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-zinc-700" />
                    </button>
                    <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all z-[100] overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-800">
                        <p className="text-xs font-bold text-white truncate">{user.displayName}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                      </div>
                      <button 
                        onClick={logout}
                        className="w-full px-4 py-3 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                      >
                        <LogOut size={14} />
                        {t.logout}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? <Loader2 size={14} className="animate-spin" /> : <UserIcon size={14} />}
                <span className="hidden sm:inline">{isLoggingIn ? t.signingIn : t.signIn}</span>
              </button>
            )}

            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <Menu size={20} />
            </button>
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
            className="relative"
          >
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
              <button 
                onClick={() => setIsLiveOpen(true)}
                className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500/20 transition-all"
              >
                <Mic size={14} />
                Live Voice
              </button>
            </div>
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
                    type="button"
                    onClick={() => setIsDeepResearch(!isDeepResearch)}
                    className={`flex flex-col items-start px-3 py-1.5 rounded-xl transition-all border ${
                      isDeepResearch 
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                        : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Brain size={14} className={isDeepResearch ? 'animate-pulse' : ''} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{t.deepResearch}</span>
                    </div>
                    <span className="text-[8px] opacity-60 leading-none">{t.deepResearchDesc}</span>
                  </button>
                )}
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

        {/* Image Generation Section */}
        <ImageGenerator 
          onGenerate={handleGenerateImage}
          isLoading={isGeneratingImage}
          result={generatedImage}
          language={language}
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
            {aiExplanation && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Brain size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
                      <Sparkles size={16} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">AI Insights</span>
                  </div>
                  <p className="text-lg md:text-xl font-medium text-zinc-200 leading-relaxed max-w-3xl">
                    {aiExplanation}
                  </p>
                </div>
              </motion.div>
            )}

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
