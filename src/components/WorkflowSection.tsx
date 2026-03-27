import React from 'react';
import { motion } from 'motion/react';
import { BarChart3, Youtube, Briefcase, GraduationCap, ArrowRight, Check, Code, Globe, Zap, Palette } from 'lucide-react';
import { WORKFLOW_TEMPLATES } from '../lib/workflows-db';
import { WorkflowTemplate } from '../types';

const iconMap: Record<string, any> = {
  BarChart3,
  Youtube,
  Briefcase,
  GraduationCap,
  Code,
  Globe,
  Zap,
  Palette
};

interface WorkflowSectionProps {
  onApply: (template: WorkflowTemplate) => void;
  translations: any;
  appliedId: string | null;
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({ onApply, translations, appliedId }) => {
  return (
    <section className="mt-16 mb-24">
      <div className="flex flex-col items-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">{translations.workflows}</h2>
        <p className="text-zinc-500">{translations.workflowsSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {WORKFLOW_TEMPLATES.map((template) => {
          const Icon = iconMap[template.icon] || Briefcase;
          const isApplied = appliedId === template.id;

          return (
            <motion.div
              key={template.id}
              whileHover={{ y: -5 }}
              className={`relative p-6 rounded-3xl border transition-all cursor-pointer group ${
                isApplied 
                  ? 'bg-blue-500/10 border-blue-500/50' 
                  : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
              }`}
              onClick={() => onApply(template)}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
                isApplied ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:text-white group-hover:bg-zinc-700'
              }`}>
                <Icon size={24} />
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                {translations[template.titleKey]}
              </h3>
              <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
                {translations[template.descriptionKey]}
              </p>

              <div className="flex items-center gap-2 text-sm font-bold transition-colors">
                {isApplied ? (
                  <span className="text-blue-400 flex items-center gap-2">
                    <Check size={16} />
                    {translations.workflowApplied}
                  </span>
                ) : (
                  <span className="text-zinc-400 group-hover:text-white flex items-center gap-2">
                    {translations.applyWorkflow}
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
