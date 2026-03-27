import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Brain, Target, Palette, Briefcase, Loader2, CheckCircle2 } from 'lucide-react';
import { AiContext, AppLanguage } from '../types';
import { TRANSLATIONS } from '../lib/translations';

interface AiContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: AiContext;
  onSave: (context: AiContext) => Promise<void>;
  language?: AppLanguage;
}

const AiContextModal: React.FC<AiContextModalProps> = ({ isOpen, onClose, initialContext, onSave, language = 'en' }) => {
  const [context, setContext] = useState<AiContext>(initialContext || { goals: '', style: '', work: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (isOpen) {
      setContext(initialContext || { goals: '', style: '', work: '' });
      setSaveSuccess(false);
    }
  }, [isOpen, initialContext]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(context);
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to save context:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl text-white">
                  <Brain size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{t.persistentMemory}</h2>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">{t.crossSessionContext}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <p className="text-zinc-400 text-sm leading-relaxed">
                {t.memoryDescription}
              </p>

              {/* Goals */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 uppercase tracking-wider">
                  <Target size={16} className="text-blue-400" />
                  {t.yourGoals}
                </label>
                <textarea
                  value={context.goals}
                  onChange={(e) => setContext({ ...context, goals: e.target.value })}
                  placeholder={t.goalsPlaceholder}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-700 transition-all min-h-[100px] resize-none"
                />
              </div>

              {/* Style */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 uppercase tracking-wider">
                  <Palette size={16} className="text-purple-400" />
                  {t.yourStyle}
                </label>
                <textarea
                  value={context.style}
                  onChange={(e) => setContext({ ...context, style: e.target.value })}
                  placeholder={t.stylePlaceholder}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-700 transition-all min-h-[100px] resize-none"
                />
              </div>

              {/* Work */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 uppercase tracking-wider">
                  <Briefcase size={16} className="text-orange-400" />
                  {t.currentWork}
                </label>
                <textarea
                  value={context.work}
                  onChange={(e) => setContext({ ...context, work: e.target.value })}
                  placeholder={t.workPlaceholder}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-700 transition-all min-h-[100px] resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-4">
              <button
                onClick={onClose}
                className="px-6 py-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || saveSuccess}
                className={`px-8 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                  saveSuccess 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white text-black hover:bg-zinc-200 disabled:opacity-50'
                }`}
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : saveSuccess ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <Save size={18} />
                )}
                {isSaving ? t.saving : saveSuccess ? t.saved : t.saveMemory}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AiContextModal;
