import React from 'react';

interface CategoryPillsProps {
  categories: string[];
  activeCategory: string | null;
  onSelect: (category: string | null) => void;
  translations?: Record<string, string>;
}

const CategoryPills: React.FC<CategoryPillsProps> = ({ categories, activeCategory, onSelect, translations = {} }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
      <button
        onClick={() => onSelect(null)}
        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
          activeCategory === null
            ? 'bg-white text-black border-white'
            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
        }`}
      >
        {translations["All"] || "All Tools"}
      </button>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
            activeCategory === category
              ? 'bg-white text-black border-white'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          {translations[category] || category}
        </button>
      ))}
    </div>
  );
};

export default CategoryPills;
