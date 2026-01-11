
import React, { useState, useEffect } from 'react';
import { TEST_DATA, HEXACO_KEY, FACTOR_NAMES, MOTIVATION_MAPPING, MOTIVATION_NAMES, MOTIVATION_DRIVERS_LOGIC } from './data/testData.ts';
import TestRunner from './components/TestRunner.tsx';
import ResultsView from './components/ResultsView.tsx';
import HrBuilder from './components/HrBuilder.tsx';
import { UserAnswers, TestResult, DriverScore, CandidateInfo, CustomTestConfig } from './types.ts';
import { Brain, FileCheck, Target, Layers, Lock, Briefcase, PenTool, LogOut, ChevronRight, Shield, ArrowLeft } from 'lucide-react';
import { SCRIPT_URL } from './geminiService.ts';

const ICONS: Record<string, React.ReactNode> = {
  intelligence: <Brain size={28} />,
  conscientiousness: <FileCheck size={28} />,
  motivation: <Target size={28} />,
  sjt: <Briefcase size={28} />,
  work_sample: <PenTool size={28} />
};

const COMPANY_CODES: Record<string, string> = {
  'YANDEX_HR': 'Yandex',
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
  const [showHrBuilder, setShowHrBuilder] = useState(false);
  const [showHrLogin, setShowHrLogin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId');
    const hrAuth = localStorage.getItem('sh_hr_authenticated');
    
    if (hrAuth === 'true' && !jobId) {
      setIsAuthenticated(true);
      setIsHrMode(true);
      setShowHrBuilder(true);
      const savedCompany = localStorage.getItem('sh_company');
      if (savedCompany) setCurrentCompany(savedCompany);
    } else if (jobId) {
      setCustomJobId(jobId);
      setIsAuthenticated(true);
      fetchCustomConfig(jobId);
    }
  }, []);

  const fetchCustomConfig = async (jobId: string) => {
    try {
      const response = await fetch(`${SCRIPT_URL}?action=GET_JOB_CONFIG&jobId=${jobId}`);
      const data = await response.json();
      if (data && data.sjtQuestions) injectCustomSections(data);
    } catch (e) { console.error(e); }
  };

  const injectCustomSections = (data: CustomTestConfig) => {
      const customSections = [...TEST_DATA];
      if (!customSections.find(s => s.id === 'sjt')) {
        customSections.push({
          id: 'sjt', title: 'Ситуационные Кейсы', description: `Тест для роли ${data.jobTitle}.`,
          displayMode: 'step', questions: data.sjtQuestions
        });
      }
      if (data.workSampleQuestion && !customSections.find(s => s.id === 'work_sample')) {
        customSections.push({
          id: 'work_sample', title: 'Практическое Задание', description: 'Кейс в формате In-Basket.',
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
      localStorage.setItem('sh_company', COMPANY_CODES[code]);
    } else { alert("Ошибка доступа"); }
  };

  const resetApp = (fullReload = false) => {
    localStorage.clear();
    if (fullReload) window.location.href = window.location.origin + window.location.pathname;
    else setIsAuthenticated(false);
  };

  const handleSectionComplete = (sectionId: string, answers: UserAnswers) => {
    const sectionData = testSections.find(t => t.id === sectionId);
    if (!sectionData) return;
    
    let rawScore = 0, maxPossibleScore = 0, hexacoProfile, motivationProfile, textAnswer;
    
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
         Object.entries(ans).forEach(([qId, score]) => { 
           const vc = MOTIVATION_MAPPING[parseInt(qId)]; 
           if (vc && typeof score === 'number') { 
             if (!vt[vc]) vt[vc] = { sum: 0, count: 0 }; 
             vt[vc].sum += score; vt[vc].count += 1; 
           } 
         });
         const vs = Object.keys(MOTIVATION_NAMES).map(c => ({ code: c, name: MOTIVATION_NAMES[c], score: parseFloat(((vt[c]?.sum || 0) / (vt[c]?.count || 1)).toFixed(1)) }));
         const ds: DriverScore[] = Object.entries(MOTIVATION_DRIVERS_LOGIC).map(([k, l]) => {
           const relevantValues = vs.filter(v => l.values.includes(v.code));
           const score = relevantValues.length > 0 ? (relevantValues.reduce((a,v)=>a+v.score,0) / relevantValues.length) : 0;
           return { name: l.name, score: parseFloat(score.toFixed(1)), rank: 0, recommendation: l.hint };
         });
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
      sectionId: sectionId as any, title: sectionData.title, rawScore, maxScore: maxPossibleScore, percentage: maxPossibleScore > 0 ? (rawScore / maxPossibleScore) * 100 : 0, answers, hexacoProfile, motivationProfile, textAnswer 
    }]);
    setCompletedSections(prev => [...prev, sectionId]);
    setActiveSectionId(null);
  };

  if (!isAuthenticated && !showHrLogin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-full text-blue-400 text-xs font-bold uppercase mb-8"><Shield size={14} /> SmartHire Assessment</div>
          <h1 className="text-6xl font-black text-white mb-6">Smart<span className="text-blue-500">Hire</span></h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
            <button onClick={() => setShowHrLogin(true)} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-left hover:border-blue-500 transition-all">
              <Lock size={24} className="text-blue-400 mb-4"/>
              <h3 className="text-white font-bold mb-2">HR-Панель</h3>
              <p className="text-slate-500 text-sm">Управление и аналитика.</p>
            </button>
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl text-left opacity-50">
              <h3 className="text-white font-bold mb-2">Кандидатам</h3>
              <p className="text-slate-500 text-sm">Используйте вашу ссылку.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showHrLogin && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <button onClick={() => setShowHrLogin(false)} className="text-slate-500 hover:text-white mb-8 flex items-center gap-2 text-sm font-bold uppercase"><ArrowLeft size={16}/> Назад</button>
        <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800">
          <h2 className="text-2xl font-black text-white mb-8">Вход HR</h2>
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <input name="code" type="password" required autoFocus placeholder="КОД" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-5 text-white text-center outline-none focus:border-blue-500" />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all">ВОЙТИ</button>
          </form>
        </div>
      </div>
    );
  }

  if (showHrBuilder) return <HrBuilder scriptUrl={SCRIPT_URL} company={currentCompany} onExit={() => resetApp(true)} onTestPreview={injectCustomSections} />;

  if (isAuthenticated && !candidateInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] border border-slate-800 p-10">
          <h1 className="text-3xl font-black text-white mb-8">Анкета</h1>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setCandidateInfo({ name: fd.get('name') as string, age: fd.get('age') as string, department: fd.get('department') as string, role: fd.get('role') as string }); }} className="space-y-5">
            <input name="name" required placeholder="ФИО" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white outline-none focus:border-blue-500" />
            <input name="role" required placeholder="Должность" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white" />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl">НАЧАТЬ</button>
          </form>
        </div>
      </div>
    );
  }

  if (activeSectionId) {
    const s = testSections.find(t => t.id === activeSectionId);
    return <TestRunner section={s!} onComplete={handleSectionComplete} onExit={() => setActiveSectionId(null)} />;
  }

  if (completedSections.length === testSections.length) {
    return <ResultsView results={results} candidateInfo={candidateInfo} onReset={() => resetApp(true)} scriptUrl={SCRIPT_URL} jobId={customJobId || ""} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <header className="max-w-7xl mx-auto pt-12 pb-12 text-center">
        <h1 className="text-4xl font-black mb-2">Центр Оценки</h1>
        <p className="text-slate-500">{candidateInfo?.name}</p>
      </header>
      <main className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {testSections.map(s => {
          const comp = completedSections.includes(s.id);
          return (
            <div key={s.id} onClick={() => !comp && setActiveSectionId(s.id)} className={`p-10 rounded-[2.5rem] border transition-all cursor-pointer ${comp ? 'bg-slate-900/40 border-green-500/10 opacity-50' : 'bg-slate-900 border-slate-800 hover:border-blue-500'}`}>
              <div className="mb-6 p-4 rounded-2xl bg-blue-500/10 text-blue-400 w-fit">{ICONS[s.id] || <Layers />}</div>
              <h3 className="text-2xl font-black mb-3">{s.title}</h3>
              <p className="text-slate-500 text-sm mb-8">{s.description}</p>
              <div className="text-xs font-black uppercase tracking-widest text-blue-500">{comp ? 'ПРОЙДЕНО ✓' : 'НАЧАТЬ →'}</div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
