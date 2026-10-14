// Centralized theme registry for Next.js frontend
// Provides typed theme keys and full Tailwind class strings to ensure JIT picking.

export type ThemeKey = 'cyber' | 'cosmic' | 'obsidian' | 'aurora';

export interface Theme {
  name: string;
  // Full Tailwind classes for usage
  primaryBg: string;           // e.g. bg-emerald-500
  primaryBgHover: string;      // e.g. hover:bg-emerald-400
  primaryText: string;         // e.g. text-emerald-500
  primaryBorder: string;       // e.g. border-emerald-500
  
  accentBg: string;
  accentText: string;
  
  bgBase: string;              // e.g. bg-slate-950
  
  // Gradient classes
  gradient: string; 
  
  // Shadow classes (new)
  shadow: string;              // e.g. shadow-emerald-500/20
  
  // For charts/inline styles
  primaryHex: string;

  // Typography
  fontMain: string;
  fontMono: string;
}

export const THEMES: Record<ThemeKey, Theme> = {
  cyber: {
    name: 'Cyber',
    primaryBg: 'bg-emerald-500',
    primaryBgHover: 'hover:bg-emerald-400',
    primaryText: 'text-emerald-400', 
    primaryBorder: 'border-emerald-500',
    
    accentBg: 'bg-cyan-500',
    accentText: 'text-cyan-400',
    
    bgBase: 'bg-slate-950',
    gradient: 'from-emerald-900/20 via-slate-950 to-slate-950',
    shadow: 'shadow-emerald-500/20',
    primaryHex: '#10b981',
    fontMain: 'font-sans',
    fontMono: 'font-mono',
  },
  cosmic: {
    name: 'Cosmic',
    primaryBg: 'bg-violet-500',
    primaryBgHover: 'hover:bg-violet-400',
    primaryText: 'text-violet-400',
    primaryBorder: 'border-violet-500',
    
    accentBg: 'bg-fuchsia-500',
    accentText: 'text-fuchsia-400',
    
    bgBase: 'bg-zinc-950',
    gradient: 'from-violet-900/20 via-zinc-950 to-zinc-950',
    shadow: 'shadow-violet-500/20',
    primaryHex: '#8b5cf6',
    fontMain: 'font-sans',
    fontMono: 'font-mono',
  },
  obsidian: {
    name: 'Obsidian',
    primaryBg: 'bg-orange-500',
    primaryBgHover: 'hover:bg-orange-400',
    primaryText: 'text-orange-400',
    primaryBorder: 'border-orange-500',
    
    accentBg: 'bg-red-500',
    accentText: 'text-red-400',
    
    bgBase: 'bg-stone-950',
    gradient: 'from-orange-900/20 via-stone-950 to-stone-950',
    shadow: 'shadow-orange-500/20',
    primaryHex: '#f97316',
    fontMain: 'font-sans',
    fontMono: 'font-mono',
  },
  aurora: {
    name: 'Aurora',
    primaryBg: 'bg-teal-500',
    primaryBgHover: 'hover:bg-teal-400',
    primaryText: 'text-teal-400',
    primaryBorder: 'border-teal-500',
    
    accentBg: 'bg-pink-500',
    accentText: 'text-pink-400',
    
    bgBase: 'bg-gray-950',
    gradient: 'from-teal-900/20 via-gray-950 to-gray-950',
    shadow: 'shadow-teal-500/20',
    primaryHex: '#14b8a6',
    fontMain: 'font-sans',
    fontMono: 'font-mono',
  },
};

export const DEFAULT_THEME: ThemeKey = 'cyber';
