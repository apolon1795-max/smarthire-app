
import React, { useState, useEffect } from 'react';
import { TEST_DATA, HEXACO_KEY, FACTOR_NAMES, MOTIVATION_MAPPING, MOTIVATION_NAMES, MOTIVATION_BLOCKS, MOTIVATION_DRIVERS_LOGIC } from './data/testData';
import TestRunner from './components/TestRunner';
import ResultsView from './components/ResultsView';
import HrBuilder from './components/HrBuilder';
import { UserAnswers, TestResult, HexacoScore, MotivationProfile, ValueScore, BlockScore, DriverScore, CandidateInfo, ValidityProfile, CustomTestConfig } from './types';
import { Brain, FileCheck, Target, Layers, CheckCircle2, Circle, UserPlus, Briefcase, Lock, Briefcase as CaseIcon, PenTool, Settings, LogIn, ShieldCheck, Wand2, LogOut, RefreshCcw, AlertTriangle, RotateCcw, ChevronRight, BarChart3, Shield, ArrowLeft } from 'lucide-react';
import { SCRIPT_URL } from './services/geminiService';

const ICONS: Record<string, React.ReactNode> = {
  intelligence: <Brain size={28} />,
  conscientiousness: <FileCheck size={28} />,
  motivation: <Target size={28} />,
  sjt: <CaseIcon size={28} />,
  work_sample: <PenTool size={28} />
};

const COMPANY_CODES: Record<string, string> = {
  'YANDEX_HR': 'Yandex',
  'SB_TECH': 'SberDevices',
  'STARTUP_XYZ': 'FutureCorp',
  'ADMIN': 'SmartHire'
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<string>('');
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isHrMode, setIsHrMode] = useState(false);
  const [customJobId, setCustomJobId] = useState<string | null>(null);
  const [testSections, setTestSections] = useState(TEST_DATA);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [showHrBuilder, setShowHrBuilder] = useState(false);
  const [showHrLogin, setShowHrLogin] = useState(false);

  const resetApp = (fullReload = false) => {
    localStorage.clear();
    if (fullReload) {
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
      window.location.reload();
    } else {
      setResults([]);
      setCompletedSections([]);
      setCandidateInfo(null);
      setActiveSectionId(null);
      setIsHrMode(false);
      setIsAuthenticated(false);
      setShowHrLogin(false);
    }
  };

  const handleRetake = () => {
    if (confirm("Вы уверены, что хотите сбросить текущие результаты и пройти тесты заново?")) {
      setResults([]);
      setCompletedSections([]);
      localStorage.removeItem('sh_results');
      localStorage.removeItem('sh_completed');
      setActiveSectionId(null);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId');

    // 1. Проверка HR-сессии (самый высокий приоритет)
    const hrAuth = localStorage.getItem('sh_hr_authenticated');
    const savedCompany = localStorage.getItem('sh_company');
    
    if (hrAuth === 'true' && !jobId) {
      setIsAuthenticated(true);
      setIsHrMode(true);
      setShowHrBuilder(true);
      if (savedCompany) setCurrentCompany(savedCompany);
      return;
    }

    // 2. Проверка Кандидат-сессии
    if (jobId) {
      setCustomJobId(jobId);
      setIsAuthenticated(true);
      setIsHrMode(false);
      fetchCustomConfig(jobId);
      
      const savedCandidate = localStorage.getItem('sh_candidate');
      if (savedCandidate) setCandidateInfo(JSON.parse(savedCandidate));
    }

    const savedResults = localStorage.getItem('sh_results');
    const savedCompleted = localStorage.getItem('sh_completed');
    if (savedResults) setResults(JSON.parse(savedResults));
    if (savedCompleted) setCompletedSections(JSON.parse(savedCompleted));
  }, []);

  useEffect(() => {
    localStorage.setItem('sh_results', JSON.stringify(results));
    localStorage.setItem('sh_completed', JSON.stringify(completedSections));
    if (candidateInfo) localStorage.setItem('sh_candidate', JSON.stringify(candidateInfo));
    localStorage.setItem('sh_auth', isAuthenticated.toString());
    localStorage.setItem('sh_company', currentCompany);
    localStorage.setItem('sh_is_hr', isHrMode.toString());
    if (isHrMode) localStorage.setItem('sh_hr_authenticated', 'true');
  }, [results, completedSections, candidateInfo, isAuthenticated, isHrMode, currentCompany]);

  const fetchCustomConfig = async (jobId: string) => {
    if (SCRIPT_URL.includes('ВАШ_УНИКАЛЬНЫЙ_ID')) return;
    setIsLoadingConfig(true);
    try {
      const response = await fetch(`${SCRIPT_URL}?action=GET_JOB_CONFIG&jobId=${jobId}`);
      const data = await response.json();
      if (data && data.sjtQuestions) injectCustomSections(data);
    } catch (e) { console.error(e); } finally { setIsLoadingConfig(false); }
  };

  const injectCustomSections = (data: CustomTestConfig) => {
      const customSections = [...TEST_DATA];
      if (!customSections.find(s => s.id === 'sjt')) {
        customSections.push({
          id: 'sjt', title: 'Ситуационные Кейсы (SJT)', description: `Решение дилемм для роли ${data.jobTitle}.`,
          displayMode: 'step', questions: data.sjtQuestions
        });
      }
      if (data.workSampleQuestion && !customSections.find(s => s.id === 'work_sample')) {
        customSections.push({
          id: 'work_sample', title: 'Практическое Задание', description: 'Кейс в формате "In-Basket".',
          displayMode: 'step', questions: [data.workSampleQuestion]
        });
      }
      setTestSections(customSections);
      if (data.company) setCurrentCompany(data.company);
  };

  const handleLoginSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = (new FormData(e.currentTarget).get('code') as string || '').toUpperCase();
    if (COMPANY_CODES[code]) { 
      setCurrentCompany(COMPANY_CODES[code]); 
      setIsAuthenticated(true); 
      setShowHrBuilder(true); 
      setIsHrMode(true); 
      localStorage.setItem('sh_hr_authenticated', 'true');
    } else { 
      alert("Неверный код доступа."); 
    }
  };

  const ControlBar = () => (
    <div className="fixed top-6 right-6 z-[9999] flex items-center gap-3">
      {isHrMode && (
        <button onClick={() => {
          testSections.forEach(s => {
            const ans: UserAnswers = {};
            s.questions.forEach(q => {
              if (q.type === 'likert') ans[q.id] = 4;
              else if (q.type === 'single-choice' || q.type === 'scenario') ans[q.id] = q.options![0].value;
              else ans[q.id] = "Тестовый ответ системы.";
            });
            handleSectionComplete(s.id, ans);
          });
        }} title="Магия (Demo)" className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2">
          <Wand2 size={14}/> МАГИЯ
        </button>
      )}
      <button onClick={() => resetApp(true)} title="Выйти" className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-white px-3 py-3 rounded-xl transition-all shadow-xl">
        <LogOut size={18}/>
      </button>
    </div>
  );

  const handleSectionComplete = (sectionId: string, answers: UserAnswers) => {
    const sectionData = testSections.find(t => t.id === sectionId);
    if (!sectionData) return;
    
    let rawScore = 0, maxPossibleScore = 0, hexacoProfile, motivationProfile, validityProfile, textAnswer;
    if (sectionId === 'conscientiousness') {
      const scores: Record<string, { sum: number; count: number }> = { 'H': { sum: 0, count: 0 }, 'E': { sum: 0, count: 0 }, 'X': { sum: 0, count: 0 }, 'A': { sum: 0, count: 0 }, 'C': { sum: 0, count: 0 }, 'O': { sum: 0, count: 0 } };
      Object.entries(answers).forEach(([qId, value]) => {
        const keyData = HEXACO_KEY[parseInt(qId)];
        if (keyData && typeof value === 'number') {
          const finalValue = keyData.reverse ? (6 - value) : value;
          scores[keyData.code].sum += finalValue; scores[keyData.code].count += 1;
        }
      });
      hexacoProfile = Object.entries(scores).map(([code, data]) => ({ factor: FACTOR_NAMES[code], code, rawScore: data.sum, questionCount: data.count, average: parseFloat((data.count > 0 ? data.sum / data.count : 1).toFixed(2)), percentage: (((data.sum / data.count) - 1) / 4) * 100 }));
      rawScore = hexacoProfile.find(f => f.code === 'C')?.average || 1; maxPossibleScore = 5;
    } else if (sectionId === 'motivation') {
       motivationProfile = (function(ans){
         const vt: any = {};
         Object.entries(ans).forEach(([qId, score]) => { const vc = MOTIVATION_MAPPING[parseInt(qId)]; if (vc && typeof score === 'number') { if (!vt[vc]) vt[vc] = { sum: 0, count: 0 }; vt[vc].sum += score; vt[vc].count += 1; } });
         const vs: any[] = Object.keys(MOTIVATION_NAMES).map(c => ({ code: c, name: MOTIVATION_NAMES[c], score: parseFloat(((vt[c]?.sum || 0) / (vt[c]?.count || 1)).toFixed(1)) }));
         const ds: DriverScore[] = Object.entries(MOTIVATION_DRIVERS_LOGIC).map(([k, l]) => ({ name: l.name, score: parseFloat((vs.filter(v => l.values.includes(v.code)).reduce((a,v)=>a+v.score,0)/2).toFixed(1)), rank: 0, recommendation: l.hint }));
         ds.sort((a,b)=>b.score-a.score).forEach((d,i)=>d.rank=i+1);
         return { values: vs, blocks: [], drivers: ds, topDrivers: ds.slice(0, 3) };
       })(answers);
       rawScore = 3.5; maxPossibleScore = 6;
    } else if (sectionId === 'sjt') {
       Object.values(answers).forEach(v => { if (typeof v === 'number') rawScore += v; maxPossibleScore += 2; });
    } else if (sectionId === 'work_sample') {
       textAnswer = answers[sectionData.questions[0].id] as string;
       rawScore = textAnswer ? 1 : 0; maxPossibleScore = 1;
    } else {
      sectionData.questions.forEach(q => { if (typeof answers[q.id] === 'number') rawScore += answers[q.id] as number; maxPossibleScore += 1; });
    }

    setResults(prev => [...prev.filter(r => r.sectionId !== sectionId), { 
      sectionId: sectionId as any, title: sectionData.title, rawScore, maxScore: maxPossibleScore, percentage: maxPossibleScore > 0 ? (rawScore / maxPossibleScore) * 100 : 0, answers, hexacoProfile, motivationProfile, validityProfile, textAnswer 
    }]);
    setCompletedSections(prev => [...prev, sectionId]);
    setActiveSectionId(null);
  };

  if (isLoadingConfig) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-bold animate-pulse">Загрузка SmartHire...</div>;

  // ГЛАВНЫЙ ЭКРАН (LANDING)
  if (!isAuthenticated && !showHrLogin) {
    return (
      <div className="min-h-screen bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center px-6">
        {/* Background blobs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
        
        <div className="relative z-10 max-w-4xl w-full text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-full text-blue-400 text-xs font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <Shield size={14} /> AI-Powered Candidate Assessment
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tighter">
            Smart<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-400">Hire</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Профессиональная экосистема для глубокой оценки потенциала кандидатов. Интеллект, психотип и драйверы в одном отчете.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
            {/* HR-Панель - теперь первая */}
            <button 
              onClick={() => setShowHrLogin(true)}
              className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-left group hover:border-indigo-500/50 transition-all shadow-xl"
            >
              <div className="p-3 bg-indigo-500/10 rounded-2xl w-fit mb-4 group-hover:bg-indigo-500/20 transition-all text-indigo-400"><Lock size={24}/></div>
              <h3 className="text-white font-bold mb-2 flex items-center justify-between">HR-Панель <ChevronRight size={18}/></h3>
              <p className="text-slate-500 text-sm">Управление вакансиями и просмотр детальной аналитики по кандидатам.</p>
            </button>

            {/* Блок для кандидатов - теперь второй */}
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl text-left group hover:border-blue-500/30 transition-all cursor-default">
              <div className="p-3 bg-blue-500/10 rounded-2xl w-fit mb-4 group-hover:bg-blue-500/20 transition-all text-blue-400"><UserPlus size={24}/></div>
              <h3 className="text-white font-bold mb-2">Кандидатам</h3>
              <p className="text-slate-500 text-sm">Перейдите по индивидуальной ссылке от рекрутера для начала теста.</p>
            </div>
          </div>
        </div>

        <div className="mt-20 flex gap-12 text-slate-600 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
           <div className="flex items-center gap-2 font-black tracking-tighter text-xl"><BarChart3 size={24}/> DATA DRIVEN</div>
           <div className="flex items-center gap-2 font-black tracking-tighter text-xl"><Brain size={24}/> NEURAL AI</div>
           <div className="flex items-center gap-2 font-black tracking-tighter text-xl"><ShieldCheck size={24}/> TRUSTED</div>
        </div>
      </div>
    );
  }

  // ЭКРАН ВХОДА HR
  if (showHrLogin && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full">
           <button onClick={() => setShowHrLogin(false)} className="text-slate-500 hover:text-white mb-8 flex items-center gap-2 text-sm font-bold uppercase transition-colors">
             <ArrowLeft size={16}/> Назад
           </button>
           <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-2xl font-black text-white mb-2">Админ-панель</h2>
              <p className="text-slate-500 text-sm mb-8">Введите персональный код доступа для входа в кабинет управления.</p>
              <form onSubmit={handleLoginSubmit} className="space-y-6">
                <input name="code" type="password" required autoFocus placeholder="КОД HR" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-5 text-white text-center tracking-[0.3em] outline-none focus:border-indigo-500 transition-all" />
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-900/20 transition-all active:scale-95">ВОЙТИ В СИСТЕМУ</button>
              </form>
           </div>
        </div>
      </div>
    );
  }

  if (showHrBuilder) return <HrBuilder scriptUrl={SCRIPT_URL} company={currentCompany} onExit={() => resetApp(true)} onTestPreview={injectCustomSections} />;

  // АНКЕТА КАНДИДАТА
  if (isAuthenticated && !candidateInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <ControlBar />
        <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] border border-slate-800 p-10 shadow-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-white mb-2">Добро пожаловать</h1>
            <p className="text-slate-500">Пожалуйста, заполните анкету для начала оценки.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setCandidateInfo({ name: fd.get('name') as string, age: fd.get('age') as string, department: fd.get('department') as string, role: fd.get('role') as string }); }} className="space-y-5">
            <div><label className="text-slate-500 text-[10px] font-black uppercase mb-2 block">Ваше ФИО</label><input name="name" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white outline-none focus:border-blue-500 transition-all" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1"><label className="text-slate-500 text-[10px] font-black uppercase mb-2 block">Возраст</label><input name="age" type="number" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white outline-none focus:border-blue-500 transition-all" /></div>
              <div className="col-span-2"><label className="text-slate-500 text-[10px] font-black uppercase mb-2 block">Отдел</label><input name="department" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white outline-none focus:border-blue-500 transition-all" /></div>
            </div>
            <div><label className="text-slate-500 text-[10px] font-black uppercase mb-2 block">Желаемая роль</label><input name="role" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white outline-none focus:border-blue-500 transition-all" /></div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-900/30 mt-4 transition-all active:scale-95 flex items-center justify-center gap-2">НАЧАТЬ ТЕСТИРОВАНИЕ <ChevronRight size={20}/></button>
          </form>
        </div>
      </div>
    );
  }

  if (activeSectionId) {
    const s = testSections.find(t => t.id === activeSectionId);
    return <div className="min-h-screen bg-slate-950 py-6 px-4"><TestRunner section={s!} onComplete={handleSectionComplete} onExit={() => setActiveSectionId(null)} /></div>;
  }

  if (completedSections.length === testSections.length) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <ResultsView results={results} candidateInfo={candidateInfo} onReset={() => resetApp(true)} scriptUrl={SCRIPT_URL} isHrView={isHrMode} jobId={customJobId || ""} onRetake={handleRetake} />
      </div>
    );
  }

  // МЕНЮ ТЕСТОВ
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      <ControlBar />
      <header className="max-w-7xl mx-auto pt-24 pb-12 px-6 text-center">
        <h1 className="text-5xl font-black text-white mb-3 tracking-tight">Центр Оценки</h1>
        <p className="text-slate-500 font-medium">Кандидат: <span className="text-blue-400">{candidateInfo?.name}</span>. Завершите все доступные блоки тестов.</p>
        {completedSections.length > 0 && (
          <button onClick={handleRetake} className="mt-6 flex items-center gap-2 mx-auto text-slate-600 hover:text-red-400 transition-colors text-xs font-black uppercase tracking-[0.2em]">
            <RotateCcw size={14}/> СБРОСИТЬ И ПЕРЕПРОЙТИ
          </button>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6 pb-20">
        {testSections.map(s => {
          const comp = completedSections.includes(s.id);
          return (
            <div key={s.id} onClick={() => !comp && setActiveSectionId(s.id)} className={`p-10 rounded-[2.5rem] border transition-all cursor-pointer ${comp ? 'bg-slate-900/40 border-green-500/10 opacity-50 grayscale' : 'bg-slate-900 border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/40 shadow-2xl hover:shadow-blue-900/10'}`}>
              <div className={`mb-6 p-4 rounded-2xl w-fit ${comp ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-400'}`}>{ICONS[s.id] || <Layers />}</div>
              <h3 className="text-2xl font-black mb-3">{s.title}</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">{s.description}</p>
              <div className="text-xs font-black uppercase tracking-widest">{comp ? <span className="text-green-500 flex items-center gap-2">✓ ПРОЙДЕНО</span> : <span className="text-blue-500 flex items-center gap-2">НАЧАТЬ ТЕСТ <ChevronRight size={14}/></span>}</div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
