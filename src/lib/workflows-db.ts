import { WorkflowTemplate } from '../types/index.ts';

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'data-analyst',
    titleKey: 'dataAnalystTitle',
    descriptionKey: 'dataAnalystDesc',
    icon: 'BarChart3',
    query: 'best ai tools for data analysis and visualization',
    suggestedContext: {
      goals: 'Analyze large datasets and create visual reports',
      style: 'Professional and data-driven',
      work: 'Data Science / Business Intelligence'
    },
    toolIds: ['1', '7', '8'] // ChatGPT, Claude, Perplexity
  },
  {
    id: 'youtuber',
    titleKey: 'youtuberTitle',
    descriptionKey: 'youtuberDesc',
    icon: 'Youtube',
    query: 'ai tools for video editing, script writing, and thumbnails',
    suggestedContext: {
      goals: 'Grow a YouTube channel with high-quality content',
      style: 'Engaging and creative',
      work: 'Content Creation'
    },
    toolIds: ['2', '5', '9'] // Midjourney, Luma, Descript
  },
  {
    id: 'freelancer',
    titleKey: 'freelancerTitle',
    descriptionKey: 'freelancerDesc',
    icon: 'Briefcase',
    query: 'ai tools for productivity, invoicing, and client communication',
    suggestedContext: {
      goals: 'Manage multiple clients and projects efficiently',
      style: 'Organized and professional',
      work: 'Freelancing / Consulting'
    },
    toolIds: ['1', '4', '8'] // ChatGPT, Jasper, Perplexity
  },
  {
    id: 'student',
    titleKey: 'studentTitle',
    descriptionKey: 'studentDesc',
    icon: 'GraduationCap',
    query: 'ai tools for research, studying, and essay writing',
    suggestedContext: {
      goals: 'Excel in academics and research',
      style: 'Academic and thorough',
      work: 'Education'
    },
    toolIds: ['1', '7', '8'] // ChatGPT, Claude, Perplexity
  },
  {
    id: 'developer',
    titleKey: 'developerTitle',
    descriptionKey: 'developerDesc',
    icon: 'Code',
    query: 'best ai tools for coding, documentation, and testing',
    suggestedContext: {
      goals: 'Build high-quality software faster',
      style: 'Technical and efficient',
      work: 'Software Engineering'
    },
    toolIds: ['3', '1', '7'] // GitHub Copilot, ChatGPT, Claude
  },
  {
    id: 'marketer',
    titleKey: 'marketerTitle',
    descriptionKey: 'marketerDesc',
    icon: 'Globe',
    query: 'ai tools for seo, social media, and ad copy',
    suggestedContext: {
      goals: 'Drive traffic and conversions',
      style: 'Persuasive and creative',
      work: 'Digital Marketing'
    },
    toolIds: ['4', '1', '8'] // Jasper, ChatGPT, Perplexity
  },
  {
    id: 'entrepreneur',
    titleKey: 'entrepreneurTitle',
    descriptionKey: 'entrepreneurDesc',
    icon: 'Zap',
    query: 'ai tools for business planning, pitching, and market research',
    suggestedContext: {
      goals: 'Launch and scale a successful business',
      style: 'Strategic and bold',
      work: 'Startup / Entrepreneurship'
    },
    toolIds: ['1', '8', '4'] // ChatGPT, Perplexity, Jasper
  },
  {
    id: 'designer',
    titleKey: 'designerTitle',
    descriptionKey: 'designerDesc',
    icon: 'Palette',
    query: 'ai tools for image generation, UI/UX, and creative assets',
    suggestedContext: {
      goals: 'Create stunning visuals and user experiences',
      style: 'Aesthetic and innovative',
      work: 'Design / Creative'
    },
    toolIds: ['2', '10', '1'] // Midjourney, Canva, ChatGPT
  }
];
