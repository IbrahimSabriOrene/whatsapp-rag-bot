"use client";

import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import Image from 'next/image';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  Legend
} from 'recharts';
import { 
  Terminal, 
  MessageSquare, 
  Database, 
  Settings, 
  Cpu, 
  Shield, 
  Activity, 
  LogOut, 
  Menu, 
  X, 
  CheckCircle, 
  Play, 
  Save, 
  RefreshCw,
  Search,
  Smartphone,
  Send,
  Bot,
  User,
  Layers,
  Zap,
  ArrowLeft,
  Paperclip,
  Mic,
  LucideIcon
} from 'lucide-react';

// --- Theme Tokens ---
import { THEMES, type ThemeKey } from './theme';

// --- Type Definitions ---

interface GlobalStylesProps {
  theme: ThemeKey;
}

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  className?: string;
  icon?: LucideIcon;
  themeName: ThemeKey;
  disabled?: boolean;
}

interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  themeName: ThemeKey;
}



interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

interface LandingPageProps {
  onLogin: () => void;
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
}

interface LoginPageProps {
  onComplete: () => void;
  theme: ThemeKey;
}

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  theme: ThemeKey;
  trend?: string;
  good?: boolean;
}

interface DashboardConfig {
  llmProvider: string;
  localUrl: string;
  embeddingDim: string;
  triggerPrefix: string;
  targetGroup: string;
  contextLimit: number;
}

interface DashboardProps {
  onLogout: () => void;
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
}

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  theme: ThemeKey;
  collapsed?: boolean;
}

interface ChatMessage {
    role: 'user' | 'bot';
    text: string;
    loading?: boolean;
}

// --- Global Styles & Animations ---
const GlobalStyles: React.FC<GlobalStylesProps> = ({ theme }) => (
  <style>{`
    :root {
      --theme-primary: ${THEMES[theme].primaryHex};
    }
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    @keyframes grid-move {
      0% { transform: translateY(0); }
      100% { transform: translateY(40px); }
    }
    @keyframes scan {
      0% { top: 0%; opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { top: 100%; opacity: 0; }
    }
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-grid { animation: grid-move 2s linear infinite; }
    .animate-scan { animation: scan 2s linear infinite; }
    .glass-panel {
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    }
    .glass-card {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .holo-grid {
      background-size: 40px 40px;
      background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
      mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
    }
  `}</style>
);

// --- Reusable Components ---

const Button: React.FC<ButtonProps> = ({ children, onClick, variant = 'primary', className = '', icon: Icon, themeName, disabled }) => {
  const t = THEMES[themeName];
  
  const variants: Record<string, string> = {
    primary: `px-6 py-2.5 rounded-lg font-bold shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 ${t.primaryBg} ${t.primaryBgHover} ${t.shadow} ${
      themeName === 'cosmic' ? 'text-white' : themeName === 'cyber' ? 'text-slate-900' : 'text-stone-900'
    }`,
    secondary: "px-6 py-2.5 rounded-lg font-medium bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all flex items-center justify-center gap-2 active:scale-95",
    outline: `px-6 py-2.5 rounded-lg font-medium bg-transparent border transition-all flex items-center justify-center gap-2 ${t.primaryBorder} ${t.primaryText} hover:bg-white/5`,
    danger: "px-6 py-2.5 rounded-lg font-medium bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500/20 flex items-center justify-center gap-2 active:scale-95",
    ghost: "px-4 py-2 rounded-lg font-medium bg-transparent text-white/60 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, placeholder, type = "text", themeName }) => (
  <div className="flex flex-col gap-1.5 mb-4 w-full">
    <label className="text-xs font-bold text-white/40 uppercase tracking-wider">{label}</label>
    <input 
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none transition-colors placeholder:text-white/20
        focus:${THEMES[themeName].primaryBorder}
      `}
    />
  </div>
);



// --- Navigation Components ---

const BottomNav: React.FC<{ 
  currentTab: string; 
  setTab: (t: any) => void; 
  theme: ThemeKey;
}> = ({ currentTab, setTab, theme }) => {
  const t = THEMES[theme];
  const items = [
    { id: 'overview', icon: Activity, label: 'Overview' },
    { id: 'whatsapp', icon: Smartphone, label: 'Chats' },
    { id: 'chat', icon: Bot, label: 'Ask AI' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <div className="lg:hidden shrink-0 h-16 border-t border-white/5 bg-[#0b141a] flex items-center justify-around px-2 z-50">
      {items.map(item => {
         const isActive = currentTab === item.id;
         return (
           <button 
             key={item.id}
             onClick={() => setTab(item.id)}
             className={`flex flex-col items-center justify-center w-16 gap-1 transition-all duration-300 ${isActive ? t.primaryText : 'text-white/40'}`}
           >
             <div className={`
               p-1.5 rounded-full transition-all
               ${isActive ? `${t.primaryBg}/10` : 'bg-transparent'}
             `}>
               <item.icon size={isActive ? 22 : 20} className={isActive ? 'scale-110' : ''} />
             </div>
             <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
           </button>
         )
      })}
    </div>
  );
};

// --- Pages ---

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, theme, setTheme }) => {
  const t = THEMES[theme];

  const features: Feature[] = [
    { icon: Database, title: "Hybrid Retrieval", desc: "Semantic + Temporal querying for perfect context." },
    { icon: Shield, title: "Zero Data Leak", desc: "Embeddings and Inference run locally on your hardware." },
    { icon: Zap, title: "Instant Insights", desc: "Real-time vector search of your entire chat history." }
  ];

  // Helper to get a valid gradient color based on theme
  const getGradientColor = () => {
    switch(theme) {
      case 'cyber': return 'to-emerald-500';
      case 'cosmic': return 'to-violet-500';
      case 'obsidian': return 'to-orange-500';
      case 'aurora': return 'to-teal-500';
      default: return 'to-emerald-500';
    }
  };

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden text-white transition-colors duration-500 ${t.bgBase}`}>
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
          <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-br ${t.gradient} opacity-60`} />
          <div className="absolute top-0 left-0 w-full h-[50%] holo-grid animate-grid opacity-30" />
          
          {/* Floating Glows */}
          <div className={`absolute top-1/4 left-1/4 w-96 h-96 ${t.primaryBg}/20 rounded-full blur-[100px] animate-float`} />
          <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 ${t.accentBg}/10 rounded-full blur-[100px] animation-delay-2000`} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-black font-bold ${t.primaryBg}`}>R</div>
          <span className="font-bold text-xl tracking-tight">RAG<span className={t.primaryText}>Bot</span></span>
        </div>
        
        <div className="flex items-center gap-4">
            {/* Theme Switcher Mini */}
            <div className="hidden md:flex bg-black/30 rounded-full p-1 border border-white/5 backdrop-blur-md">
              {Object.keys(THEMES).map((k) => (
                  <button 
                    key={k}
                    onClick={() => setTheme(k as ThemeKey)}
                    className={`w-6 h-6 rounded-full transition-all ${theme === k ? `${THEMES[k as ThemeKey].primaryBg} shadow-lg scale-110` : 'bg-transparent hover:bg-white/10'}`}
                    title={THEMES[k as ThemeKey].name}
                  />
              ))}
            </div>
            <Button variant="outline" onClick={onLogin} icon={Smartphone} themeName={theme}>Link WhatsApp</Button>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 mt-8">
        <div className="animate-fade-in max-w-4xl">
          <span className={`px-4 py-1.5 rounded-full ${t.primaryBg}/10 border ${t.primaryBorder}/30 text-xs ${t.primaryText} font-bold mb-8 inline-block tracking-widest uppercase`}>
            Next Gen Local Intelligence
          </span>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Your Group Chat <br/>
            <span className={`bg-clip-text text-transparent bg-gradient-to-r from-white via-white ${getGradientColor()}`}>
                Evolved.
            </span>
          </h1>
          <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Autonomous context retrieval, local privacy, and intelligent summarization. 
            Connect your WhatsApp and let the AI handle the memory.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={onLogin} icon={Play} themeName={theme}>Launch Console</Button>
            <Button variant="secondary" onClick={() => {}} icon={Layers} themeName={theme}>System Architecture</Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-24 mb-20 w-full px-4">
          {features.map((feature, idx) => (
            <div key={idx} className="glass-card p-8 rounded-2xl text-left hover:bg-white/5 group border border-white/5 hover:border-white/10">
              <div className={`w-14 h-14 rounded-xl ${t.primaryBg}/10 flex items-center justify-center ${t.primaryText} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon size={28} />
              </div>
              <h3 className={`text-xl font-bold mb-3 text-white group-hover:${t.primaryText} transition-colors`}>{feature.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

const LoginPage: React.FC<LoginPageProps> = ({ onComplete, theme }) => {
  type Status = 'idle' | 'initial' | 'qr' | 'authenticated' | 'ready' | 'disconnected' | 'auth_failure' | 'error';
  const [status, setStatus] = useState<Status>('idle');
  const [qrData, setQrData] = useState<string | null>(null);
  const [showFullscreen, setShowFullscreen] = useState<boolean>(false);
  const [reloading, setReloading] = useState<boolean>(false);
  const t = THEMES[theme];

  const reloadWhatsApp = async () => {
    setReloading(true);
    try {
      setQrData(null);
      await fetch('http://localhost:4000/api/whatsapp/reload', { method: 'POST' });
    } catch {
    } finally {
      setReloading(false);
    }
  };

  // Poll backend for WhatsApp status and QR
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const sRes = await fetch('http://localhost:4000/api/whatsapp/status');
        const sData = await sRes.json();
        if (!mounted) return;
        const raw = (sData && typeof sData.status === 'string') ? sData.status : 'error';
        const st: Status = (raw === 'initial' || raw === 'qr' || raw === 'authenticated' || raw === 'ready' || raw === 'disconnected' || raw === 'auth_failure')
          ? (raw as Status)
          : (raw === 'error' ? 'error' : 'idle');
        setStatus(st);
        if (st === 'qr') {
          const qRes = await fetch('http://localhost:4000/api/whatsapp/qr');
          if (qRes.ok) {
            const qData = await qRes.json();
            if (!mounted) return;
            setQrData(qData.qr);
          }
        } else if (st === 'authenticated' || st === 'ready') {
          // proceed after a short delay to let UI show success
          setTimeout(() => { if (mounted) onComplete(); }, 800);
        }
      } catch {
        setStatus('error');
      }
    };
    const id = setInterval(poll, 1500);
    poll();
    return () => { mounted = false; clearInterval(id); };
  }, [onComplete]);

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden ${t.bgBase} transition-colors duration-500`}>
       <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${t.gradient} opacity-50`} />
       <div className="absolute inset-0 holo-grid opacity-20" />

      <div className="glass-panel w-full max-w-md rounded-2xl p-8 flex flex-col items-center text-center relative z-10 shadow-2xl border-t border-white/10">
        <h2 className="text-2xl font-bold text-white mb-2">Secure Link</h2>
        <p className="text-white/40 text-sm mb-8">Scan to authorize local scraping agent.</p>

        <div className={`relative w-80 h-80 bg-white rounded-xl mb-8 p-4 overflow-hidden shadow-[0_0_40px_-10px_rgba(0,0,0,0.3)] ${t.shadow} border border-black/10`}>
            <div className={`w-full h-full flex items-center justify-center`}>
              {qrData ? (
                <QRCodeCanvas value={qrData} size={320} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin={true} />
              ) : (
                <div className="text-black/60 text-xs">Waiting for QR…</div>
              )}
            </div>
            
            {!qrData && (
              <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg relative z-10">
                      <Smartphone className={`${t.primaryText.replace('text', 'text')}`} size={32} />
                  </div>
                  <div className={`absolute w-16 h-16 rounded-full ${t.primaryBg}/30 animate-ping`} />
              </div>
            )}

            {status === 'qr' && (
                <div className={`absolute left-0 w-full h-1 ${t.primaryBg} shadow-[0_0_20px_var(--theme-primary)] animate-scan z-20`} />
            )}

            {status === 'ready' && (
                <div className={`absolute inset-0 ${t.primaryBg}/90 flex flex-col items-center justify-center text-white z-30 backdrop-blur-sm`}>
                    <CheckCircle size={48} className="mb-2" />
                    <span className="font-bold tracking-wider">LINKED</span>
                </div>
            )}
        </div>

        <div className="flex items-center gap-3 mb-6">
          {qrData && (
            <Button variant="secondary" icon={Smartphone} themeName={theme} onClick={() => setShowFullscreen(true)}>Fullscreen QR</Button>
          )}
          <Button variant="secondary" icon={RefreshCw} themeName={theme} onClick={reloadWhatsApp}>
            {reloading ? 'Reloading…' : 'Reload'}
          </Button>
          {qrData && <span className="text-white/40 text-xs">Tip: Increase screen brightness for easier scanning.</span>}
        </div>

        <div className="flex items-center gap-2 text-sm font-medium font-mono">  
            {status === 'authenticated' && <span className="text-white/40">Generating Keys...</span>}
            {status === 'qr' && <span className={`${t.primaryText} animate-pulse`}>Waiting for device...</span>}
            {status === 'ready' && <span className={`${t.primaryText}`}>Handshaking...</span>}
            {status === 'initial' && <span className="text-white/40">Starting session...</span>}
            {status === 'disconnected' && <span className="text-white/40">Disconnected</span>}
            {status === 'auth_failure' && <span className="text-white/40">Auth failure</span>}
            {status === 'error' && <span className="text-white/40">Backend unavailable</span>}
        </div>
      </div>

      {showFullscreen && qrData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center">
            <QRCodeCanvas 
              value={qrData} 
              size={512} 
              bgColor="#ffffff" 
              fgColor="#000000" 
              level="H" 
              includeMargin={true} 
            />
            <div className="mt-4">
              <Button variant="secondary" icon={X} themeName={theme} onClick={() => setShowFullscreen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Dashboard Tabs (Internal Components) ---

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, theme, trend, good }) => {
  const t = THEMES[theme];
  return (
    <div className="glass-card p-6 rounded-xl flex flex-col justify-between hover:bg-white/5 transition-colors group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${t.primaryBg}/10 ${t.primaryText} group-hover:${t.primaryBg}/20 transition-colors`}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className={`text-xs font-bold ${trend.startsWith('+') ? (good ? 'text-emerald-400' : 'text-emerald-400') : 'text-red-400'}`}>
              {trend}
          </span>
        )}
      </div>
      <div>
        <h4 className="text-2xl font-bold text-white mb-1">{value}</h4>
        <p className="text-white/40 text-xs font-bold uppercase tracking-wider">{title}</p>
      </div>
    </div>
  );
};

const OverviewTab: React.FC<GlobalStylesProps> = ({ theme }) => {
    const t = THEMES[theme];
    type OverviewData = {
      ok: true;
      timestamp: number;
      whatsapp?: { status?: string };
      vectorStore?: { pointsCount?: number };
      llm?: { provider?: string; model?: string };
      embedding?: { provider?: string; model?: string };
    };
    type OverviewEvent = { ts: number } & Record<string, unknown>;
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [events, setEvents] = useState<OverviewEvent[]>([]);

    useEffect(() => {
      let mounted = true;
      const load = async () => {
        setLoading(true);
        try {
          const res = await fetch('http://localhost:4000/api/overview');
          const data = await res.json();
          if (mounted) setOverview(data && data.ok ? data : null);
        } catch {
          if (mounted) setOverview(null);
        } finally {
          if (mounted) setLoading(false);
        }
      };
      const id = setInterval(load, 2500);
      load();
      return () => { mounted = false; clearInterval(id); };
    }, []);

    useEffect(() => {
      const es = new EventSource('http://localhost:4000/api/events');
      es.onmessage = (ev) => {
        try {
          const parsed: unknown = JSON.parse(ev.data);
          const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
          if (!obj) return;
          setEvents((prev) => [...prev, { ts: Date.now(), ...obj }].slice(-12));
        } catch {}
      };
      es.onerror = () => {};
      return () => { try { es.close(); } catch {} };
    }, []);

    const indexed = overview?.vectorStore?.pointsCount;
    const waStatus = overview?.whatsapp?.status;
    const llmProvider = overview?.llm?.provider;
    const llmModel = overview?.llm?.model;
    const embProvider = overview?.embedding?.provider;
    const embModel = overview?.embedding?.model;

    // --- Chart Data & Theme ---
    const colors = React.useMemo(() => {
        switch(theme) {
          case 'cyber': return { main: '#10b981', sec: '#06b6d4', grid: 'rgba(255,255,255,0.05)', text: '#94a3b8' };
          case 'cosmic': return { main: '#8b5cf6', sec: '#d946ef', grid: 'rgba(255,255,255,0.05)', text: '#94a3b8' };
          case 'obsidian': return { main: '#f97316', sec: '#ef4444', grid: 'rgba(255,255,255,0.05)', text: '#94a3b8' };
          case 'aurora': return { main: '#14b8a6', sec: '#3b82f6', grid: 'rgba(255,255,255,0.05)', text: '#94a3b8' };
          default: return { main: '#10b981', sec: '#06b6d4', grid: 'rgba(255,255,255,0.05)', text: '#94a3b8' };
        }
    }, [theme]);

    const activityData = [
      { time: '00:00', incoming: 12, processed: 10 },
      { time: '04:00', incoming: 5, processed: 5 },
      { time: '08:00', incoming: 45, processed: 42 },
      { time: '12:00', incoming: 120, processed: 115 },
      { time: '16:00', incoming: 85, processed: 80 },
      { time: '20:00', incoming: 55, processed: 55 },
      { time: '23:59', incoming: 20, processed: 20 },
    ];

    const storageData = [
        { name: 'Text', value: 400, color: colors.main },
        { name: 'Images', value: 300, color: colors.sec },
        { name: 'Audio', value: 100, color: '#64748b' },
        { name: 'Docs', value: 50, color: '#475569' },
    ];

    const processingData = [
        { name: 'Mon', speed: 240 },
        { name: 'Tue', speed: 139 },
        { name: 'Wed', speed: 980 },
        { name: 'Thu', speed: 390 },
        { name: 'Fri', speed: 480 },
        { name: 'Sat', speed: 380 },
        { name: 'Sun', speed: 430 },
    ];
    
    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Indexed Msgs" value={typeof indexed === 'number' ? indexed.toLocaleString() : (loading ? '…' : '-')} icon={Database} theme={theme} />
                <StatCard title="WhatsApp" value={typeof waStatus === 'string' ? waStatus : (loading ? '…' : '-')} icon={Smartphone} theme={theme} good={waStatus === 'ready'} />
                <StatCard title="LLM Provider" value={llmProvider ? String(llmProvider).split(' ')[0] : (loading ? '…' : '-')} icon={Cpu} theme={theme} />
                <StatCard title="Embedding" value={embProvider ? String(embProvider).split(' ')[0] : (loading ? '…' : '-')} icon={Search} theme={theme} />
            </div>

            {/* Main Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Area Chart */}
                <div className="lg:col-span-2 glass-panel rounded-xl p-6 min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Activity size={16} /> 24h Message Activity
                    </h3>
                    <div className="flex-1 w-full min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activityData}>
                                <defs>
                                    <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={colors.main} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={colors.main} stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorSec" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={colors.sec} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={colors.sec} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                                <XAxis dataKey="time" stroke={colors.text} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                                <YAxis stroke={colors.text} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="incoming" stroke={colors.main} fillOpacity={1} fill="url(#colorMain)" strokeWidth={2} />
                                <Area type="monotone" dataKey="processed" stroke={colors.sec} fillOpacity={1} fill="url(#colorSec)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Storage Pie Chart */}
                <div className="glass-panel rounded-xl p-6 min-h-[300px] flex flex-col">
                     <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Database size={16} /> Data Distribution
                    </h3>
                    <div className="flex-1 w-full min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={storageData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {storageData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.2)" />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Processing Speed Bar Chart */}
                <div className="glass-panel rounded-xl p-6 min-h-[300px] flex flex-col">
                     <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Zap size={16} /> Token Processing (T/s)
                    </h3>
                    <div className="flex-1 w-full min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={processingData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                                <XAxis dataKey="name" stroke={colors.text} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                                <YAxis stroke={colors.text} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                                <RechartsTooltip
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                />
                                <Bar dataKey="speed" fill={colors.main} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Live Feed */}
                <div className="glass-panel rounded-xl p-6 min-h-[300px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                             <Terminal size={16} /> System Events
                        </h3>
                        <div className={`text-[10px] px-2 py-0.5 rounded-full ${t.primaryBg}/10 ${t.primaryText} border ${t.primaryBorder}/20 font-mono`}>
                            REALTIME
                        </div>
                    </div>
                    <div className="space-y-2 font-mono text-sm overflow-y-auto max-h-[220px] pr-2 custom-scrollbar">
                        {events.length === 0 ? (
                          <div className="p-3 rounded bg-black/20 border border-white/5 text-white/50 text-xs">Waiting for system events...</div>
                        ) : (
                          events.slice().reverse().map((e, i) => (
                              <div key={i} className="flex items-center gap-3 p-2 rounded bg-black/20 border border-white/5 text-xs animate-fade-in">
                              <span className={`${t.primaryText} shrink-0 w-16`}>{new Date(e.ts || Date.now()).toLocaleTimeString()}</span>
                              <span className="text-white/70 truncate flex-1">{String((e as Record<string, unknown>).type ?? 'event')}</span>
                              <div className={`w-1.5 h-1.5 rounded-full ${t.primaryBg}`} />
                            </div>
                          ))
                        )}
                    </div>
                </div>
            </div>
            
            {/* System Info Footer */}
             <div className="glass-panel rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/30">
                <div className="flex gap-4">
                    <span>Model: <span className="text-white/50">{llmModel || 'N/A'}</span></span>
                    <span>Embed: <span className="text-white/50">{embModel || 'N/A'}</span></span>
                </div>
                <div>
                   Local Inference Engine v2.1.0 • Running on localhost
                </div>
             </div>
        </div>
    );
};

const ChatPlayground: React.FC<GlobalStylesProps> = ({ theme }) => {
    const t = THEMES[theme];
    const [msgs, setMsgs] = useState<ChatMessage[]>([
        { role: 'bot', text: 'Hybrid RAG System Online. Context: 4028 messages indexed. How can I help you with your chat history?' }
    ]);
    const [input, setInput] = useState<string>('');
    const [chatId, setChatId] = useState<string>('');
    const endRef = useRef<HTMLDivElement>(null);

    // Load default context chat from backend settings
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('http://localhost:4000/api/settings');
                if (!res.ok) return;
                const data = await res.json();
                if (data?.targetChatId) setChatId(data.targetChatId);
            } catch {
            }
        })();
    }, []);

    const handleSend = async () => {
        if(!input.trim()) return;
        const userQ = input.trim();
        setMsgs(prev => [...prev, { role: 'user', text: userQ }]);
        setInput('');
        setMsgs(prev => [...prev, { role: 'bot', text: 'Thinking...', loading: true }]);

        try {
            const res = await fetch('http://localhost:4000/api/chat/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: userQ, chatId })
            });
            const data = await res.json() as { answer?: string };
            const answer: string = data && typeof data.answer === 'string' ? data.answer : 'No answer available.';
            setMsgs(prev => {
                const filtered = prev.filter(m => !m.loading);
                return [...filtered, { role: 'bot', text: answer }];
            });
        } catch (err: unknown) {
            setMsgs(prev => {
                const filtered = prev.filter(m => !m.loading);
                const msg = err instanceof Error ? err.message : 'failed to fetch answer';
                return [...filtered, { role: 'bot', text: `Error: ${msg}` }];
            });
        }
    };

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [msgs]);

    return (
        <div className="flex flex-col h-full glass-panel rounded-xl overflow-hidden animate-fade-in">
             <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-2">
                    <Bot className={`${t.primaryText}`} size={20} />
                    <span className="font-bold text-white">Interactive Session</span>
                 </div>
                 <div className="flex gap-2 text-xs items-center">
                    <span className="hidden md:inline-block px-2 py-1 rounded bg-white/5 text-white/50">Model: Llama-3-8B</span>
                    <span className="px-2 py-1 rounded bg-white/5 text-white/50">Context: {chatId || 'default'}</span>
                 </div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/10">
                 {msgs.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] md:max-w-[80%] rounded-2xl p-4 ${
                              m.role === 'user' 
                              ? `${t.primaryBg} text-slate-900 font-medium rounded-tr-none` 
                              : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5'
                            }`}>
                              {m.loading ? (
                                  <div className="flex gap-1">
                                      <div className="w-2 h-2 rounded-full bg-white/50 animate-bounce" />
                                      <div className="w-2 h-2 rounded-full bg-white/50 animate-bounce delay-100" />
                                      <div className="w-2 h-2 rounded-full bg-white/50 animate-bounce delay-200" />
                                  </div>
                              ) : (
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                              )}
                          </div>
                      </div>
                  ))}
                  <div ref={endRef} />
             </div>

             <div className="p-4 bg-black/20 border-t border-white/5 shrink-0">
                 <div className="flex gap-2">
                    <input 
                       className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
                       placeholder="Ask about your chats..."
                       value={input}
                       onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                       onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSend()}
                    />
                    <Button onClick={handleSend} icon={Send} themeName={theme}>
                      {msgs.some(m => m.loading) ? '...' : 'Send'}
                    </Button>
                 </div>
                 {!chatId && (
                   <p className="mt-2 text-xs text-white/40">Using default context from backend settings. Set a target in Settings for better results.</p>
                 )}
             </div>
        </div>
    );
};

type ChatItem = { id: string; name: string; isGroup: boolean };
type WhatsMsg = { id: string; chatId: string; type: string; body: string; hasMedia: boolean; timestamp: number; author?: string; mediaUrl?: string; fromMe?: boolean };
  type ReasoningLog = { step: string; message: string; details?: unknown; ts: number };

  const WhatsAppPage: React.FC<{ theme: ThemeKey; onViewImage: (url: string) => void }> = ({ theme, onViewImage }) => {
    const t = THEMES[theme];
    const [chats, setChats] = useState<ChatItem[]>([]);
    const [loadingChats, setLoadingChats] = useState<boolean>(false);
    const [chatSearch, setChatSearch] = useState<string>('');
    const [selected, setSelected] = useState<ChatItem | null>(null);
    const [msgs, setMsgs] = useState<WhatsMsg[]>([]);
    const [msgLoading, setMsgLoading] = useState<boolean>(false);
    const [text, setText] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<'image' | 'audio' | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const msgCacheRef = useRef<Map<string, WhatsMsg[]>>(new Map());
    
    const [agentMsgs, setAgentMsgs] = useState<{ role: 'user' | 'bot', text: string, loading?: boolean }[]>([]);
    const [agentInput, setAgentInput] = useState('');
    const [isAgentOpen, setIsAgentOpen] = useState(false);
    const [agentSessionId, setAgentSessionId] = useState<string>('');
    const [reasoningLogs, setReasoningLogs] = useState<ReasoningLog[]>([]);
    const agentCacheRef = useRef<Map<string, { msgs: { role: 'user' | 'bot', text: string, loading?: boolean }[]; sessionId: string; logs: ReasoningLog[] }>>(new Map());
    const agentEndRef = useRef<HTMLDivElement>(null);
    const agentActiveChatIdRef = useRef<string>('');
  
  // Scroll agent chat to bottom
  useEffect(() => {
    if (isAgentOpen) {
        agentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agentMsgs, reasoningLogs, isAgentOpen]);

  useEffect(() => {
    const activeId = agentActiveChatIdRef.current;
    if (!activeId) return;
    agentCacheRef.current.set(activeId, { msgs: agentMsgs, sessionId: agentSessionId || `web:${activeId}`, logs: reasoningLogs });
    try {
      if (agentSessionId) localStorage.setItem(`session:${activeId}`, agentSessionId);
    } catch {}
  }, [agentMsgs, agentSessionId, reasoningLogs]);

  const handleAgentSend = async () => {
    if (!agentInput.trim() || !selected) return;
    const q = agentInput.trim();
    setAgentInput('');
    setReasoningLogs([]); // Clear logs for new query
    setAgentMsgs(prev => [...prev, { role: 'user', text: q }]);
    setAgentMsgs(prev => [...prev, { role: 'bot', text: 'Thinking...', loading: true }]);
    
    try {
        const res = await fetch('http://localhost:4000/api/chat/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q, chatId: selected.id, sessionId: agentSessionId || `web:${selected.id}` })
        });
        const data = await res.json();
        if (data && typeof data.sessionId === 'string') {
          setAgentSessionId(data.sessionId);
          try { localStorage.setItem(`session:${selected.id}`, data.sessionId); } catch {}
        }
        const ans = data && typeof data.answer === 'string' ? data.answer : 'No answer available.';
        setAgentMsgs(prev => {
            const filtered = prev.filter(m => !m.loading);
            return [...filtered, { role: 'bot', text: ans }];
        });
    } catch (err: unknown) {
         setAgentMsgs(prev => {
            const filtered = prev.filter(m => !m.loading);
            const msg = err instanceof Error ? err.message : 'failed';
            return [...filtered, { role: 'bot', text: `Error: ${msg}` }];
        });
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoadingChats(true);
      try {
        const resp = await fetch('http://localhost:4000/api/chats').then(r => r.json()).catch(() => ({ ok: false }));
        const list: ChatItem[] = [];
        if (resp && resp.ok && Array.isArray(resp.chats)) {
          resp.chats.forEach((x: { id: string; name: string; isGroup: boolean }) => list.push({ id: String(x.id), name: String(x.name), isGroup: Boolean(x.isGroup) }));
        }
        setChats(list);
        setSelected((prev) => {
          if (prev) return prev;
          try {
            if (window.matchMedia && window.matchMedia('(min-width: 1280px)').matches) return list[0] || null;
          } catch {}
          return prev;
        });
      } finally {
        setLoadingChats(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      try {
        const ws = new WebSocket('ws://localhost:4000/ws');
        wsRef.current = ws;

        ws.onmessage = (ev) => {
          try {
            const j = JSON.parse(ev.data);
            
            // Reasoning Events
            if (j && j.type === 'reasoning' && j.payload) {
              const p = j.payload as Record<string, unknown>;
              const chatId = String(p.chatId || '');
              if (chatId === agentActiveChatIdRef.current) {
                   setReasoningLogs(prev => [...prev, {
                       step: String(p.step || ''),
                       message: String(p.message || ''),
                       details: p.details,
                       ts: Number(p.ts || Date.now())
                   }]);
                   // Scroll to bottom
                   if (agentEndRef.current) requestAnimationFrame(() => agentEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
              }
            }

            // Message Events
            if (j && j.type === 'message' && j.payload) {
              const currentChatId = agentActiveChatIdRef.current;
              if (!currentChatId) return;
              const p = j.payload as Record<string, unknown>;
              const chatId = String(p.chatId || '');
              if (chatId !== currentChatId) return;
              const id = String(p.id || '');
              if (!id) return;

              setMsgs(prev => {
                if (prev.some(m => m.id === id)) return prev;
                const next = [...prev, {
                  id,
                  chatId,
                  type: String(p.type || ''),
                  body: typeof p.body === 'string' ? p.body : '',
                  hasMedia: Boolean(p.hasMedia),
                  timestamp: typeof p.timestamp === 'number' ? p.timestamp : Date.now(),
                  mediaUrl: typeof p.mediaUrl === 'string' ? p.mediaUrl : undefined,
                  author: typeof p.author === 'string' ? p.author : undefined,
                  fromMe: Boolean(p.fromMe)
                }];
                msgCacheRef.current.set(currentChatId, next);
                return next;
              });
              if (endRef.current) requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }));
            }
          } catch {}
        };

        ws.onclose = () => {
          if (stopped) return;
          retryTimer = setTimeout(connect, 1500);
        };
      } catch {
        retryTimer = setTimeout(connect, 1500);
      }
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      try { ws?.close(); } catch {}
    };
  }, []);

  const filteredChats = chats.filter((c) => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  });

  const selectedId = selected?.id || '';

  const fetchChatMessages = async (chatId: string) => {
    const activeAtStart = chatId;
    try {
      const res = await fetch(`http://localhost:4000/api/chat/${encodeURIComponent(chatId)}/messages?limit=50&includeMedia=true`);
      if (!res.ok) throw new Error('fail');
      const data = await res.json() as { messages?: unknown[] };
      const normalizeMsg = (m: unknown): WhatsMsg => {
        const o = m as Record<string, unknown>;
        return {
          id: String(o.id ?? ''),
          chatId: String(o.chatId ?? ''),
          type: String(o.type ?? ''),
          body: typeof o.body === 'string' ? o.body : '',
          hasMedia: Boolean(o.hasMedia),
          timestamp: typeof o.timestamp === 'number' ? o.timestamp : Date.now(),
          author: typeof o.author === 'string' ? o.author : undefined,
          mediaUrl: typeof o.mediaUrl === 'string' ? o.mediaUrl : undefined,
          fromMe: Boolean(o.fromMe)
        };
      };
      const arr: WhatsMsg[] = Array.isArray(data.messages) ? data.messages.map(normalizeMsg) : [];
      msgCacheRef.current.set(chatId, arr);
      if (agentActiveChatIdRef.current === activeAtStart) {
        setMsgs(arr);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
      }
    } finally {
      if (agentActiveChatIdRef.current === activeAtStart) {
        setMsgLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    agentActiveChatIdRef.current = selectedId;
    const cached = msgCacheRef.current.get(selectedId);
    if (cached && cached.length) {
      setMsgs(cached);
      setMsgLoading(false);
    } else {
      setMsgLoading(true);
      setMsgs([]);
    }

    const cachedAgent = agentCacheRef.current.get(selectedId);
    if (cachedAgent) {
      setAgentMsgs(cachedAgent.msgs || []);
      setAgentSessionId(cachedAgent.sessionId || `web:${selectedId}`);
    } else {
      setAgentMsgs([]);
      let sid = `web:${selectedId}`;
      try {
        const s = localStorage.getItem(`session:${selectedId}`);
        if (s) sid = s;
      } catch {}
      setAgentSessionId(sid);
    }
    
    (async () => {
      await fetchChatMessages(selectedId);
    })();
  }, [selectedId]);

  const onSelectChat = (c: ChatItem) => {
    setSelected(c);
    setIsAgentOpen(false);
    // Mobile toggle logic removed or can be re-added if you want a separate view
  };

  const onBack = () => {
    // Mobile back logic
    setSelected(null);
    setIsAgentOpen(false);
  };

  const onSelectFile = (f: File | null) => {
    setFile(f);
    if (!f) { setFileType(null); return; }
    const mt = f.type || '';
    if (mt.startsWith('image/')) setFileType('image');
    else if (mt.startsWith('audio/')) setFileType('audio');
    else setFileType(null);
  };

  const send = async () => {
    if (!selected) return;
    if (file && fileType) {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String((r.result || '')).split(',').pop() || '');
        r.onerror = () => reject(new Error('read error'));
        r.readAsDataURL(file);
      });
      const res = await fetch(`http://localhost:4000/api/chat/${encodeURIComponent(selected.id)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: fileType, base64: b64, mimetype: file.type })
      });
      if (res.ok) { setFile(null); setFileType(null); }
      return;
    }
    const cleaned = text.trim();
    if (!cleaned) return;
    const res = await fetch(`http://localhost:4000/api/chat/${encodeURIComponent(selected.id)}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'text', text: cleaned })
    });
    if (res.ok) setText('');
  };

  return (
    <div className="h-full grid grid-cols-1 xl:grid-cols-12 xl:gap-4 relative overflow-hidden">
      {/* Chat List */}
      <div className={`xl:col-span-3 glass-panel rounded-none xl:rounded-xl overflow-hidden flex flex-col h-full absolute inset-0 z-10 xl:static bg-black/90 xl:bg-transparent transition-transform duration-300 ${selected ? '-translate-x-full xl:translate-x-0 pointer-events-none xl:pointer-events-auto' : 'translate-x-0 pointer-events-auto'}`}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className={`text-sm font-bold ${t.primaryText}`}>Chats</span>
          <span className="text-xs text-white/40">{loadingChats ? 'Loading…' : `${filteredChats.length}`}</span>
        </div>
        <div className="p-3 border-b border-white/5">
          <input
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map(c => (
            <button key={c.id} onClick={() => onSelectChat(c)} className={`w-full flex items-center justify-between px-4 py-3 border-b border-white/5 hover:bg-white/5 ${selected?.id===c.id ? `${t.primaryBg}/10` : ''}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-10 h-10 shrink-0 rounded-full ${t.primaryBg}/20 border ${t.primaryBorder}/30 flex items-center justify-center ${t.primaryText} font-bold`}>{c.name.slice(0,1).toUpperCase()}</div>
                <div className="text-left overflow-hidden">
                  <div className="text-white font-bold text-sm truncate">{c.name}</div>
                  <div className="text-white/40 text-xs truncate">{c.id.split('@')[0]}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`xl:col-span-6 glass-panel rounded-none xl:rounded-xl overflow-hidden flex flex-col h-full absolute inset-0 z-20 xl:static bg-[#0b141a] xl:bg-transparent transition-transform duration-300 ${selected ? 'translate-x-0 pointer-events-auto' : 'translate-x-full xl:translate-x-0 pointer-events-none xl:pointer-events-auto'}`}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#202c33] xl:bg-transparent">
          <div className="flex items-center gap-3">
             {/* Back Button for Mobile */}
            <button className="xl:hidden text-white/60 hover:text-white" onClick={onBack}>
               <ArrowLeft size={20} />
            </button>
            <div className={`w-8 h-8 rounded-full ${t.primaryBg}/20 flex items-center justify-center ${t.primaryText}`}>
              <User size={16} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm">{selected?.name || 'Select a chat'}</span>
              <span className="text-xs text-white/40">{msgLoading ? 'Loading...' : (selected?.isGroup ? 'Group' : 'Contact')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="xl:hidden p-2 bg-white/5 rounded-full" onClick={() => setIsAgentOpen(!isAgentOpen)}>
              <Bot size={18} className={t.primaryText} />
            </button>
          </div>
        </div>
        
        {/* Messages Container with Image Support */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-2 bg-[#0b141a] lg:bg-black/10">
          {msgs.map(m => {
             const isUser = m.fromMe;
             const isImage = m.hasMedia && m.type === 'image' && !!m.mediaUrl;
             const isAudio = m.hasMedia && m.type === 'audio' && !!m.mediaUrl;
             return (
            <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] md:max-w-[70%] rounded-2xl relative shadow-sm overflow-hidden ${
                  isUser
                    ? `${t.primaryBg} text-slate-900 ${isImage ? '' : 'rounded-tr-none'}`
                    : `bg-[#202c33] text-[#e9edef] ${isImage ? '' : 'rounded-tl-none'}`
                } ${isImage ? 'p-0' : 'p-2'}`}
              >
                {!isUser && selected?.isGroup && m.author && (
                  <div className={`${isImage ? 'px-2 pt-2' : 'mb-1'} text-xs font-bold text-[#53bdeb]`}>
                    {m.author}
                  </div>
                )}
                {isImage ? (
                  <div
                    className="relative w-full max-w-full cursor-pointer"
                    onClick={() => onViewImage(`http://localhost:4000${m.mediaUrl}`)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`http://localhost:4000${m.mediaUrl}`}
                      alt="Image"
                      className="w-full h-auto max-h-[500px] object-contain rounded-lg"
                      loading="lazy"
                    />
                  </div>
                ) : isAudio ? (
                  <div className="p-2">
                    <audio controls src={`http://localhost:4000${m.mediaUrl}`} className="w-full min-w-[200px]" />
                  </div>
                ) : null}

                {m.body && (
                  <div className={isImage ? 'p-2' : ''}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                )}

                <div className={`text-[10px] text-right ${isImage ? 'px-2 pb-2' : 'mt-1'} ${isUser ? 'text-black/60' : 'text-[#8696a0]'}`}>
                  {new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          )})}
          <div ref={endRef} />
        </div>

        <div className="p-4 bg-[#202c33] lg:bg-black/20 border-t border-white/5 shrink-0">
          {file && (
             <div className="mb-2 p-2 bg-white/5 rounded-lg flex items-center justify-between">
                <span className="text-xs text-white/60 truncate">{file.name}</span>
                <button onClick={() => setFile(null)}><X size={14} /></button>
             </div>
          )}
          <div className="flex gap-2">
            <button className="text-white/60 hover:text-white" onClick={() => document.getElementById('file-upload')?.click()}>
               <Paperclip size={20} />
            </button>
            <input type="file" id="file-upload" className="hidden" onChange={(e) => onSelectFile(e.target.files?.[0] || null)} />
            
            <input className="flex-1 bg-[#2a3942] lg:bg-black/20 border border-transparent lg:border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30" placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <Button onClick={send} icon={Send} themeName={theme}>{''}</Button>
          </div>
        </div>
      </div>
      
      {/* Right Sidebar - AI Context Agent */}
      <div className={`
        xl:col-span-3 glass-panel rounded-none xl:rounded-xl overflow-hidden flex flex-col h-full absolute inset-0 z-30 xl:static bg-black/95 xl:bg-transparent transition-transform duration-300
        ${isAgentOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none invisible xl:visible xl:translate-x-0 xl:pointer-events-auto'}
      `}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/5 xl:bg-transparent">
              <div className="flex items-center gap-2">
                 <Bot size={18} className={t.primaryText} />
                 <span className="font-bold text-sm text-white">Chat Agent</span>
              </div>
              <button className="xl:hidden p-2" onClick={() => setIsAgentOpen(false)}>
                 <X size={16} className="text-white/60" />
              </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/20">
             {reasoningLogs.length > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/5 text-xs font-mono space-y-2">
                   <div className="font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Cpu size={12} /> Thinking Process
                   </div>
                   {reasoningLogs.map((log, i) => (
                      <div key={i} className="flex gap-2 animate-fade-in">
                         <span className="text-white/30 shrink-0">{new Date(log.ts).toLocaleTimeString([], {minute:'2-digit', second: '2-digit'})}</span>
                         <span className={`${t.primaryText} shrink-0`}>[{log.step}]</span>
                         <span className="text-white/70 break-words">{log.message}</span>
                      </div>
                   ))}
                </div>
             )}

             {agentMsgs.length === 0 && reasoningLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-white/40 space-y-3">
                   <div className={`w-12 h-12 rounded-xl ${t.primaryBg}/10 flex items-center justify-center`}>
                      <Bot size={24} className={t.primaryText} />
                   </div>
                   <p className="text-xs max-w-[200px]">Ask questions about the current chat context. I can summarize, find dates, or extract info.</p>
                </div>
             )}
             {agentMsgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] rounded-xl p-3 text-xs ${
                        m.role === 'user' 
                        ? `${t.primaryBg} text-slate-900 font-medium rounded-tr-none` 
                        : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5'
                    }`}>
                        {m.loading ? (
                            <div className="flex gap-1 py-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" />
                                <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce delay-100" />
                                <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce delay-200" />
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                        )}
                    </div>
                </div>
             ))}
             <div ref={agentEndRef} />
          </div>

          <div className="p-3 border-t border-white/5 bg-black/20 shrink-0">
             <div className="flex gap-2 items-center">
                <input 
                   className="min-w-0 flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
                   placeholder={selected ? "Ask about this chat..." : "Select a chat first"}
                   value={agentInput}
                   onChange={(e) => setAgentInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleAgentSend()}
                   disabled={!selected}
                />
                <button 
                  onClick={handleAgentSend} 
                  disabled={!selected || !agentInput.trim()}
                  className={`shrink-0 p-2 rounded-lg ${t.primaryBg} text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity`}
                >
                   <Send size={16} />
                </button>
             </div>
          </div>
      </div>
    </div>
  );
};

interface SettingsPageProps extends GlobalStylesProps {
    config: DashboardConfig;
    setConfig: React.Dispatch<React.SetStateAction<DashboardConfig>>;
    setTheme: (theme: ThemeKey) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ config, setConfig, theme, setTheme }) => {
    const t = THEMES[theme];
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [embeddingSyncStarting, setEmbeddingSyncStarting] = useState<boolean>(false);
    const [embeddingSyncState, setEmbeddingSyncState] = useState<{ status: string; jobId?: string; stored?: number; scannedChats?: number; pages?: number; ms?: number; error?: string } | null>(null);
    const [embeddingSyncForce, setEmbeddingSyncForce] = useState<boolean>(false);

    type BackendSettings = { targetChatId: string; triggerPrefix: string; triggerWord: string; targetGroupId?: string };
    const [settings, setSettings] = useState<BackendSettings>({
      targetChatId: '',
      triggerPrefix: '',
      triggerWord: ''
    });
    type GroupItem = { id: string; name: string };
    const [groups, setGroups] = useState<GroupItem[]>([]);
    const [groupLoading, setGroupLoading] = useState<boolean>(false);
    type ContactItem = { id: string; name: string };
    const [contacts, setContacts] = useState<ContactItem[]>([]);
    const [contactLoading, setContactLoading] = useState<boolean>(false);
    type TargetType = 'group' | 'person';
    const [targetType, setTargetType] = useState<TargetType>('group');

    useEffect(() => {
      let stopped = false;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let ws: WebSocket | null = null;

      const connect = () => {
        if (stopped) return;
        try {
          ws = new WebSocket('ws://localhost:4000/ws');
          ws.onmessage = (ev) => {
            try {
              const j = JSON.parse(ev.data);
              if (j && j.type === 'embedding_sync') {
                setEmbeddingSyncState({
                  status: String(j.status || ''),
                  jobId: typeof j.jobId === 'string' ? j.jobId : undefined,
                  stored: typeof j.stored === 'number' ? j.stored : undefined,
                  scannedChats: typeof j.scannedChats === 'number' ? j.scannedChats : undefined,
                  pages: typeof j.pages === 'number' ? j.pages : undefined,
                  ms: typeof j.ms === 'number' ? j.ms : undefined,
                  error: typeof j.error === 'string' ? j.error : undefined
                });
              }
            } catch {}
          };
          ws.onclose = () => {
            if (stopped) return;
            retryTimer = setTimeout(connect, 1500);
          };
        } catch {
          retryTimer = setTimeout(connect, 1500);
        }
      };

      connect();
      return () => {
        stopped = true;
        if (retryTimer) clearTimeout(retryTimer);
        try { ws?.close(); } catch {}
        ws = null;
      };
    }, []);

    useEffect(() => {
      let mounted = true;
      const fetchSettings = async () => {
        try {
          const res = await fetch('http://localhost:4000/api/settings');
          const data = await res.json();
          if (mounted) setSettings({
            targetChatId: data.targetChatId || data.targetGroupId || '',
            triggerPrefix: data.triggerPrefix || '',
            triggerWord: data.triggerWord || '',
            targetGroupId: data.targetGroupId || ''
          });
          setError(null);
        } catch {
          setError('Failed to load settings');
        }
      };
      fetchSettings();
      return () => { mounted = false; };
    }, []);

    const fetchGroups = async () => {
      setGroupLoading(true);
      try {
        const res = await fetch('http://localhost:4000/api/groups');
        const data = await res.json();
        if (data.ok) setGroups(data.groups || []);
        else setError(data.error || 'Groups unavailable');
      } catch {
        setError('Failed to load groups');
      } finally {
        setGroupLoading(false);
      }
    };

    const fetchContacts = async () => {
      setContactLoading(true);
      try {
        const res = await fetch('http://localhost:4000/api/contacts');
        const data = await res.json();
        if (data.ok) setContacts(data.contacts || []);
        else setError(data.error || 'Contacts unavailable');
      } catch {
        setError('Failed to load contacts');
      } finally {
        setContactLoading(false);
      }
    };

    const saveSettings = async () => {
      setSaving(true);
      try {
        const res = await fetch('http://localhost:4000/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetChatId: settings.targetChatId,
            triggerPrefix: settings.triggerPrefix,
            triggerWord: settings.triggerWord
          })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed to save');
      } catch {
        setError('Failed to save settings');
      } finally {
        setSaving(false);
      }
    };
    
    const startEmbeddingSync = async () => {
      if (embeddingSyncStarting) return;
      setEmbeddingSyncStarting(true);
      try {
        const url = new URL('http://localhost:4000/api/embeddings/sync');
        if (embeddingSyncForce) url.searchParams.set('force', 'true');
        const res = await fetch(url.toString(), { method: 'POST' });
        const data: unknown = await res.json().catch(() => ({}));
        const obj: Record<string, unknown> = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {};
        if (!res.ok) {
          if (obj.busy === true) {
            setEmbeddingSyncState({ status: 'busy', error: 'Embedding sync already running' });
            return;
          }
          const msg = (typeof obj.error === 'string' && obj.error) ? obj.error : 'Failed to start embedding sync';
          setEmbeddingSyncState({ status: 'error', error: msg });
          return;
        }
        if (typeof obj.jobId === 'string') {
          setEmbeddingSyncState({ status: 'started', jobId: obj.jobId });
        } else {
          setEmbeddingSyncState({ status: 'started' });
        }
      } catch {
        setEmbeddingSyncState({ status: 'error', error: 'Failed to start embedding sync' });
      } finally {
        setEmbeddingSyncStarting(false);
      }
    };

    return (
        <div className="max-w-4xl pb-10 space-y-8 animate-fade-in">
            {/* WhatsApp Integration */}
            <div className="glass-panel rounded-xl p-8 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${t.primaryBg}`} />
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Smartphone size={20} className={`${t.primaryText}`} /> WhatsApp Integration
                </h3>
                {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField 
                        label="Trigger Prefix" 
                        value={settings.triggerPrefix} 
                        onChange={(e) => setSettings({ ...settings, triggerPrefix: e.target.value })} 
                        themeName={theme} 
                    />
                    <InputField 
                        label="Trigger Word" 
                        value={settings.triggerWord} 
                        onChange={(e) => setSettings({ ...settings, triggerWord: e.target.value })} 
                        themeName={theme} 
                    />
                    <div className="flex flex-col gap-1.5 mb-4 w-full">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Target</label>
                        <div className="flex gap-3 mb-2">
                          <button
                            className={`px-3 py-1 rounded-md text-xs font-bold border ${targetType === 'group' ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-white/50 border-white/10'}`}
                            onClick={() => setTargetType('group')}
                          >Group</button>
                          <button
                            className={`px-3 py-1 rounded-md text-xs font-bold border ${targetType === 'person' ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-white/50 border-white/10'}`}
                            onClick={() => setTargetType('person')}
                          >Person</button>
                        </div>
                        {targetType === 'group' ? (
                          <div className="flex gap-2">
                            <select 
                              value={settings.targetChatId}
                              onChange={(e) => setSettings({ ...settings, targetChatId: e.target.value })}
                              className={`flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none transition-colors
                                focus:${t.primaryBorder}
                              `}
                            >
                              <option value="">{groupLoading ? 'Loading…' : 'Select a group'}</option>
                              {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                            <Button icon={RefreshCw} themeName={theme} onClick={fetchGroups}>Refresh</Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <select 
                              value={settings.targetChatId}
                              onChange={(e) => setSettings({ ...settings, targetChatId: e.target.value })}
                              className={`flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none transition-colors
                                focus:${t.primaryBorder}
                              `}
                            >
                              <option value="">{contactLoading ? 'Loading…' : 'Select a person'}</option>
                              {contacts.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <Button icon={RefreshCw} themeName={theme} onClick={fetchContacts}>Refresh</Button>
                          </div>
                        )}
                        <p className="text-white/30 text-xs mt-1">If lists are empty, authenticate WhatsApp via Login.</p>
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <Button icon={Save} themeName={theme} onClick={saveSettings}>{saving ? 'Saving…' : 'Save WhatsApp Settings'}</Button>
                </div>
            </div>
            <div className="glass-panel rounded-xl p-8 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${t.primaryBg}`} />
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Database size={20} className={`${t.primaryText}`} /> Embeddings
                </h3>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-[220px]">
                          <div className="text-white/60 text-xs">Status</div>
                          <div className="text-white text-sm font-bold">
                            {embeddingSyncState?.status ? embeddingSyncState.status : 'idle'}
                          </div>
                          {embeddingSyncState?.jobId && (
                            <div className="text-white/30 text-xs truncate">Job: {embeddingSyncState.jobId}</div>
                          )}
                          {embeddingSyncState?.error && (
                            <div className="text-red-400 text-xs">{embeddingSyncState.error}</div>
                          )}
                          {typeof embeddingSyncState?.stored === 'number' && (
                            <div className="text-white/30 text-xs">
                              Stored: {embeddingSyncState.stored}
                              {typeof embeddingSyncState.scannedChats === 'number' ? ` • Chats: ${embeddingSyncState.scannedChats}` : ''}
                              {typeof embeddingSyncState.pages === 'number' ? ` • Pages: ${embeddingSyncState.pages}` : ''}
                            </div>
                          )}
                          <label className="mt-3 flex items-center gap-2 text-white/60 text-xs select-none">
                            <input
                              type="checkbox"
                              checked={embeddingSyncForce}
                              onChange={(e) => setEmbeddingSyncForce(e.target.checked)}
                              className="accent-white/80"
                            />
                            Force re-embed (overwrite existing)
                          </label>
                        </div>
                        <Button icon={RefreshCw} themeName={theme} onClick={startEmbeddingSync} disabled={embeddingSyncStarting}>
                          {embeddingSyncStarting ? 'Starting…' : 'Embed Entire WhatsApp History'}
                        </Button>
                    </div>
                    <div className="text-white/30 text-xs">
                      Runs a full embedding pass and writes to the vector database.
                    </div>
                </div>
            </div>
            {/* Appearance */}
             <div className="glass-panel rounded-xl p-8 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${t.primaryBg}`} />
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Layers size={20} className={`${t.primaryText}`} /> Appearance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.keys(THEMES).map(k => (
                    <button 
                      key={k}
                      onClick={() => setTheme(k as ThemeKey)}
                      className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${theme === k ? `${t.primaryBg}/20 ${t.primaryBorder}` : 'border-white/10 hover:bg-white/5'}`}
                    >
                      <div className={`w-8 h-8 rounded-full ${THEMES[k as ThemeKey].primaryBg}`} />
                      <div className="text-left">
                        <div className="font-bold text-white">{THEMES[k as ThemeKey].name}</div>
                        <div className="text-xs text-white/40">Theme</div>
                      </div>
                    </button>
                  ))}
                </div>
             </div>
        </div>
    );
};

// --- Main App Component ---

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, active, onClick, theme, collapsed }) => {
  const t = THEMES[theme];
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative
        ${active ? `${t.primaryBg} text-slate-900 shadow-lg font-bold` : 'text-white/60 hover:text-white hover:bg-white/5'}
      `}
      title={collapsed ? label : undefined}
    >
      <Icon size={20} className={active ? '' : 'group-hover:scale-110 transition-transform'} />
      {!collapsed && <span>{label}</span>}
      {collapsed && active && <div className={`absolute right-2 w-1.5 h-1.5 rounded-full bg-white`} />}
    </button>
  );
};

export default function RagBotApp() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemeKey>('cyber');
  const [currentTab, setCurrentTab] = useState<'overview' | 'chat' | 'whatsapp' | 'settings'>('overview');
  const [config, setConfig] = useState<DashboardConfig>({
    llmProvider: 'Ollama (Local)',
    localUrl: 'http://localhost:1234',
    embeddingDim: '768',
    triggerPrefix: '!',
    targetGroup: '',
    contextLimit: 2000
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  
  // Check auth status on mount
  useEffect(() => {
    fetch('http://localhost:4000/api/whatsapp/status')
      .then(r => r.json())
      .then(d => {
        if(d.status === 'ready' || d.status === 'authenticated') setIsLoggedIn(true);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:4000/api/whatsapp/logout', { method: 'POST' });
    } catch {}
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
      // Internal state for showing login page vs landing
      if (currentTab === 'whatsapp') return (
        <>
            <GlobalStyles theme={theme} />
            <LoginPage onComplete={() => setIsLoggedIn(true)} theme={theme} />
        </>
      );
      return (
        <>
            <GlobalStyles theme={theme} />
            <LandingPage onLogin={() => setCurrentTab('whatsapp')} theme={theme} setTheme={setTheme} />
        </>
      );
  }

  const t = THEMES[theme];

  return (
    <div className={`flex flex-col lg:flex-row h-full w-full overflow-hidden ${t.bgBase} text-white transition-colors duration-500 ${t.fontMain}`}>
      <GlobalStyles theme={theme} />
      
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className={`absolute top-[-20%] left-[-10%] w-[50%] h-[50%] ${t.primaryBg}/10 blur-[120px] rounded-full`} />
          <div className={`absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] ${t.accentBg}/5 blur-[120px] rounded-full`} />
          <div className="absolute inset-0 holo-grid opacity-10" />
      </div>

      {/* Mobile Sidebar Overlay Removed */}

      {/* Sidebar */}
      <aside className={`
        hidden lg:flex static inset-y-0 left-0 z-50 transition-all duration-300 flex-col border-r border-white/5 bg-black/20 backdrop-blur-xl
        ${sidebarCollapsed ? 'w-20' : 'w-64'}
      `}>
        <div className="p-6 flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.primaryBg} text-slate-900 font-bold shadow-lg shrink-0`}>
            <Terminal size={24} />
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="font-bold text-lg tracking-tight leading-none">RAG<span className={`${t.primaryText}`}>Bot</span></h1>
              <span className="text-xs text-white/40 font-mono">v2.0.0</span>
            </div>
          )}
          {/* Mobile Close Button */}
          <button className="lg:hidden ml-auto text-white/60" onClick={() => setMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <SidebarItem icon={Activity} label="Overview" active={currentTab === 'overview'} onClick={() => { setCurrentTab('overview'); setMobileMenuOpen(false); }} theme={theme} collapsed={sidebarCollapsed} />
          <SidebarItem icon={Smartphone} label="WhatsApp" active={currentTab === 'whatsapp'} onClick={() => { setCurrentTab('whatsapp'); setMobileMenuOpen(false); }} theme={theme} collapsed={sidebarCollapsed} />
          <SidebarItem icon={Bot} label="Playground" active={currentTab === 'chat'} onClick={() => { setCurrentTab('chat'); setMobileMenuOpen(false); }} theme={theme} collapsed={sidebarCollapsed} />
          <SidebarItem icon={Settings} label="Settings" active={currentTab === 'settings'} onClick={() => { setCurrentTab('settings'); setMobileMenuOpen(false); }} theme={theme} collapsed={sidebarCollapsed} />
        </nav>

        <div className="p-4 border-t border-white/5">
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hidden lg:flex w-full items-center justify-center p-2 text-white/40 hover:text-white mb-2">
                {sidebarCollapsed ? <Menu size={20} /> : <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold"><Menu size={16}/> Collapse</div>}
            </button>
            <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-red-400 hover:bg-red-500/10 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <LogOut size={20} />
                {!sidebarCollapsed && <span className="font-medium">Disconnect</span>}
            </button>
        </div>
      </aside>

      {/* Full Screen Image Modal */}
      {modalImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setModalImage(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white z-50">
            <X size={24} />
          </button>
          <div className="relative w-full h-full max-w-5xl max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img 
               src={modalImage} 
               alt="Full view" 
               className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
             />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 lg:h-20 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 bg-black/10 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile menu removed in favor of bottom nav */}
            <div>
              <h2 className="text-xl font-bold text-white capitalize">{currentTab}</h2>
              <p className="text-xs text-white/40 hidden md:block">Local Inference Engine Active</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono text-white/60">Qdrant Connected</span>
             </div>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-white to-slate-400" />
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-hidden p-0 relative"> 
             <div className="h-full w-full">
                {currentTab === 'overview' && (
                    <div className="h-full overflow-y-auto p-4 lg:p-8">
                         <OverviewTab theme={theme} />
                    </div>
                )}
                {currentTab === 'whatsapp' && (
                    <div className="h-full p-0 lg:p-6">
                        <WhatsAppPage theme={theme} onViewImage={setModalImage} />
                    </div>
                )}
                {currentTab === 'chat' && (
                    <div className="h-full p-4 lg:p-6">
                        <ChatPlayground theme={theme} />
                    </div>
                )}
                {currentTab === 'settings' && (
                    <div className="h-full overflow-y-auto p-4 lg:p-8">
                        <SettingsPage config={config} setConfig={setConfig} theme={theme} setTheme={setTheme} />
                    </div>
                )}
             </div>
        </div>
      </main>
      <BottomNav currentTab={currentTab} setTab={setCurrentTab} theme={theme} />
    </div>
  );
}
