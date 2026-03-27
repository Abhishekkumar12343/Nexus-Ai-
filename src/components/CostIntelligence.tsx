import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, TrendingUp, AlertTriangle, Settings, X, Save, BarChart3, Info } from 'lucide-react';
import { UserProfile, UserBudget, AppLanguage } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { formatCurrency } from '../lib/cost-utils';

interface CostIntelligenceProps {
  profile: UserProfile;
  onUpdateBudget: (budget: UserBudget) => Promise<void>;
  language?: AppLanguage;
}

export const CostIntelligence: React.FC<CostIntelligenceProps> = ({ profile, onUpdateBudget, language = 'en' }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newLimit, setNewLimit] = useState(profile.budget?.limit || 5.00);
  const [newThreshold, setNewThreshold] = useState(profile.budget?.alertThreshold || 80);
  const [isSaving, setIsSaving] = useState(false);

  const t = TRANSLATIONS[language];
  const totalSpend = profile.totalSpend || 0;
  const budgetLimit = profile.budget?.limit || 5.00;
  const spendPercentage = (totalSpend / budgetLimit) * 100;
  const isOverBudget = totalSpend >= budgetLimit;
  const isNearBudget = spendPercentage >= (profile.budget?.alertThreshold || 80);

  const handleSaveBudget = async () => {
    setIsSaving(true);
    try {
      await onUpdateBudget({ limit: newLimit, alertThreshold: newThreshold });
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Failed to save budget:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
            <Wallet size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t.costIntelligenceTitle}</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">{t.spendTracking}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-all"
        >
          <Settings size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Spend */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.totalSpend}</span>
            <TrendingUp size={14} className="text-zinc-600" />
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(totalSpend)}
          </div>
          <div className="text-[10px] text-zinc-500">{t.sinceAccountCreation}</div>
        </div>

        {/* Budget Progress */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {t.budgetUsage} ({spendPercentage.toFixed(1)}%)
            </span>
            <span className="text-xs font-bold text-zinc-300">
              {formatCurrency(totalSpend)} / {formatCurrency(budgetLimit)}
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(spendPercentage, 100)}%` }}
              className={`h-full rounded-full transition-colors duration-500 ${
                isOverBudget ? 'bg-red-500' : isNearBudget ? 'bg-orange-500' : 'bg-blue-500'
              }`}
            />
          </div>
          {isNearBudget && (
            <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${
              isOverBudget ? 'text-red-400' : 'text-orange-400'
            }`}>
              <AlertTriangle size={12} />
              {isOverBudget ? t.budgetLimitReached : t.approachingBudgetLimit}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Mini-Chart (Visual Only) */}
      <div className="mt-8 pt-6 border-t border-zinc-800/50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 size={14} />
            {t.recentQueryCosts}
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-tighter">Search</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-tighter">Translate</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-end gap-1 h-12">
          {profile.costHistory?.slice(-20).map((record, i) => (
            <motion.div
              key={record.id}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max((record.cost / 0.001) * 100, 10)}%` }}
              className={`flex-1 rounded-t-sm ${
                record.operation.includes('search') ? 'bg-blue-500/40' : 'bg-purple-500/40'
              }`}
              title={`${record.operation}: ${formatCurrency(record.cost)}`}
            />
          )) || (
            <div className="w-full flex items-center justify-center text-[10px] text-zinc-600 uppercase tracking-widest italic">
              {t.noRecentActivity}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl text-white">
                    <Settings size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-white">{t.budgetSettings}</h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.monthlyLimit}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input 
                      type="number"
                      step="0.01"
                      value={newLimit}
                      onChange={(e) => setNewLimit(parseFloat(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 pl-8 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-700 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.alertThreshold}</label>
                    <span className="text-xs font-bold text-white">{newThreshold}%</span>
                  </div>
                  <input 
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(parseInt(e.target.value))}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <p className="text-[10px] text-zinc-500 italic">We'll notify you when your spend reaches this percentage of your limit.</p>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-3">
                  <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t.budgetSettingsDesc}
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
                <button
                  onClick={handleSaveBudget}
                  disabled={isSaving}
                  className="px-8 py-2 bg-white text-black rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
                >
                  {isSaving ? <TrendingUp size={18} className="animate-pulse" /> : <Save size={18} />}
                  {isSaving ? t.savingChanges : t.saveChanges}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
