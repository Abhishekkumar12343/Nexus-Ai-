import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Tool } from '../types';

interface ToolCardProps {
  tool: Tool;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  const getPricingColor = (model: string) => {
    switch (model) {
      case 'Free': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'Freemium': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Paid': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="group relative bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-2xl hover:shadow-zinc-950/50">
      <div className="aspect-video w-full overflow-hidden bg-zinc-800">
        <img 
          src={tool.imageUrl} 
          alt={tool.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
      </div>
      
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-semibold text-zinc-100 group-hover:text-white transition-colors">
            {tool.name}
          </h3>
          <a 
            href={tool.websiteUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all"
          >
            <ExternalLink size={16} />
          </a>
        </div>
        
        <p className="text-zinc-400 text-sm line-clamp-2 mb-4 h-10">
          {tool.description}
        </p>
        
        <div className="flex flex-wrap gap-2 items-center">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
            {tool.category}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getPricingColor(tool.pricingModel)}`}>
            {tool.pricingModel}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ToolCard;
