import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, Eye, CheckCircle2, XCircle, Info, Settings, Save, Database, Server, UserCheck } from 'lucide-react';
import { UserProfile, PrivacySettings, AppLanguage } from '../types';
import { TRANSLATIONS } from '../lib/translations';

interface PrivacyTransparencyProps {
  profile: UserProfile;
  onUpdatePrivacy: (settings: PrivacySettings) => Promise<void>;
  language?: AppLanguage;
}

export const PrivacyTransparency: React.FC<PrivacyTransparencyProps> = ({ profile, onUpdatePrivacy, language = 'en' }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>(profile.privacy || {
    dataLogging: false,
    trainingOptOut: true,
    retentionDays: 30
  });
  const [isSaving, setIsSaving] = useState(false);

  const t = TRANSLATIONS[language];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdatePrivacy(settings);
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-xl text-green-400">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t.privacyTransparencyTitle}</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">{t.enterpriseDataHandling}</p>
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
        {/* Training Status */}
        <div className="space-y-3 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
            <Database size={14} />
            {t.trainingStatus}
          </div>
          <div className="flex items-center gap-2 text-white font-bold">
            {settings.trainingOptOut ? (
              <CheckCircle2 size={18} className="text-green-500" />
            ) : (
              <XCircle size={18} className="text-red-500" />
            )}
            {settings.trainingOptOut ? t.optedOut : t.optedIn}
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            {t.trainingStatusDesc}
          </p>
        </div>

        {/* Data Logging */}
        <div className="space-y-3 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
            <Eye size={14} />
            {t.dataLogging}
          </div>
          <div className="flex items-center gap-2 text-white font-bold">
            {settings.dataLogging ? (
              <CheckCircle2 size={18} className="text-blue-500" />
            ) : (
              <XCircle size={18} className="text-green-500" />
            )}
            {settings.dataLogging ? t.loggingEnabled : t.noLogging}
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            {t.dataLoggingDesc}
          </p>
        </div>

        {/* Provider Info */}
        <div className="space-y-3 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
            <Server size={14} />
            {t.cloudProvider}
          </div>
          <div className="text-white font-bold flex items-center gap-2">
            <Lock size={18} className="text-zinc-400" />
            {t.googleCloudVertex}
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            {t.cloudProviderDesc}
          </p>
        </div>
      </div>

      {/* Privacy Settings Modal */}
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
                    <Shield size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-white">{t.privacyControls}</h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-500 hover:text-white">
                  <XCircle size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                {/* Training Opt-Out Toggle */}
                <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">{t.trainingOptOut}</h4>
                    <p className="text-[10px] text-zinc-500">{t.trainingOptOutDesc}</p>
                  </div>
                  <button 
                    onClick={() => setSettings(s => ({ ...s, trainingOptOut: !s.trainingOptOut }))}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings.trainingOptOut ? 'bg-green-500' : 'bg-zinc-800'}`}
                  >
                    <motion.div 
                      animate={{ x: settings.trainingOptOut ? 26 : 2 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {/* Data Logging Toggle */}
                <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">{t.queryMetadataLogging}</h4>
                    <p className="text-[10px] text-zinc-500">{t.queryMetadataLoggingDesc}</p>
                  </div>
                  <button 
                    onClick={() => setSettings(s => ({ ...s, dataLogging: !s.dataLogging }))}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings.dataLogging ? 'bg-blue-500' : 'bg-zinc-800'}`}
                  >
                    <motion.div 
                      animate={{ x: settings.dataLogging ? 26 : 2 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {/* Retention Period */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.dataRetention}</label>
                    <span className="text-xs font-bold text-white">{settings.retentionDays} Days</span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="90"
                    step="1"
                    value={settings.retentionDays}
                    onChange={(e) => setSettings(s => ({ ...s, retentionDays: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <p className="text-[10px] text-zinc-500 italic">{t.dataRetentionDesc}</p>
                </div>

                <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-4 flex gap-3">
                  <UserCheck size={16} className="text-green-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t.enterprisePrivacyNote}
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-8 py-2 bg-white text-black rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Database size={18} className="animate-pulse" /> : <Save size={18} />}
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
