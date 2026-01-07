
import React, { useState, useEffect } from 'react';
import { TEST_DATA, HEXACO_KEY, FACTOR_NAMES, MOTIVATION_MAPPING, MOTIVATION_NAMES, MOTIVATION_BLOCKS, MOTIVATION_DRIVERS_LOGIC } from './data/testData';
import TestRunner from './components/TestRunner';
import ResultsView from './components/ResultsView';
import HrBuilder from './components/HrBuilder';
import { UserAnswers, TestResult, HexacoScore, MotivationProfile, ValueScore, BlockScore, DriverScore, CandidateInfo, ValidityProfile, CustomTestConfig } from './types';
import { Brain, FileCheck, Target, Layers, CheckCircle2, Circle, UserPlus, Briefcase, Lock, Briefcase as CaseIcon, PenTool, Settings, LogIn, ShieldCheck, Wand2, LogOut, RefreshCcw, AlertTriangle } from 'lucide-react';
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
  const [initError, setInitError] = useState<string | null>(null);

  const resetApp = (fullReload = false) => {
    localStorage.clear();
    if (fullReload) {
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
      window.location.reload();
    }
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const jobId = params.get('jobId');

      if (jobId) {
        setCustomJobId(jobId);
        setIsAuthenticated(true); // Кандидат авторизован по ссылке
        setIsHrMode(false);
        fetchCustomConfig(jobId);
      } else {
        const savedAuth = localStorage.getItem('sh_auth');
        if (savedAuth === 'true') setIsAuthenticated(true);
      }

      const savedResults = localStorage.getItem('sh_results');
      const savedCompleted = localStorage.getItem('sh_completed');
      const savedCandidate = localStorage.getItem('sh_candidate');
      const savedCompany = localStorage.getItem('sh_company');
      const savedHrFlag = localStorage.getItem('sh_is_hr');

      if (savedResults) setResults(JSON.parse(savedResults));
      if (savedCompleted) setCompletedSections(JSON.parse(savedCompleted));
      if (savedCandidate) setCandidateInfo(JSON.parse(savedCandidate));
      if (savedCompany) setCurrentCompany(savedCompany);
      if (savedHrFlag === 'true') setIsHrMode(true);
    } catch (e) {
      setInitError("Ошибка загрузки данных.");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sh_results', JSON.stringify(results));
    localStorage.setItem('sh_completed', JSON.stringify(completedSections));
    if (candidateInfo) localStorage.setItem('sh_candidate', JSON.stringify(candidateInfo));
    localStorage.setItem('sh_auth', isAuthenticated.toString());
    localStorage.setItem('sh_company', currentCompany);
    localStorage.setItem('sh_is_hr', isHrMode.toString());
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

  const injectCustomSections = (data: CustomTestConfig, isPreview = false) => {
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
      if (isPreview) {
        setIsHrMode(true);
        setCandidateInfo({ name: 'HR Preview', age: '30', department: 'HR Dept', role: data.jobTitle });
        setIsAuthenticated(true);
      }
      if (data.company) setCurrentCompany(data.company);
  };

  const calculateHexacoScores = (answers: UserAnswers): HexacoScore[] => {
    const scores: Record<string, { sum: number; count: number }> = { 'H': { sum: 0, count: 0 }, 'E': { sum: 0, count: 0 }, 'X': { sum: 0, count: 0 }, 'A': { sum: 0, count: 0 }, 'C': { sum: 0, count: 0 }, 'O': { sum: 0, count: 0 } };
    Object.entries(answers).forEach(([qId, value]) => {
      const keyData = HEXACO_KEY[parseInt(qId)];
      if (keyData && typeof value === 'number') {
        const finalValue = keyData.reverse ? (6 - value) : value;
        scores[keyData.code].sum += finalValue; scores[keyData.code].count += 1;
      }
    });
    return Object.entries(scores).map(([code, data]) => ({ factor: FACTOR_NAMES[code], code: code, rawScore: data.sum, questionCount: data.count, average: parseFloat((data.count > 0 ? data.sum / data.count : 1).toFixed(2)), percentage: (((data.sum / data.count) - 1) / 4) * 100 }));
  };

  const calculateMotivationProfile = (answers: UserAnswers): MotivationProfile => {
    const valueTotals: Record<string, { sum: number; count: number }> = {};
    Object.entries(answers).forEach(([qId, score]) => {
      const valueCode = MOTIVATION_MAPPING[parseInt(qId)];
      if (valueCode && typeof score === 'number') {
        if (!valueTotals[valueCode]) valueTotals[valueCode] = { sum: 0, count: 0 };
        valueTotals[valueCode].sum += score; valueTotals[valueCode].count += 1;
      }
    });
    const values: ValueScore[] = Object.keys(MOTIVATION_NAMES).map(code => {
      const data = valueTotals[code] || { sum: 0, count: 1 };
      return { code, name: MOTIVATION_NAMES[code], score: parseFloat((data.sum / data.count).toFixed(1)) };
    });
    const blocks: BlockScore[] = Object.entries(MOTIVATION_BLOCKS).map(([bk, bd]) => {
      const relevant = values.filter(v => bd.values.includes(v.code));
      return { name: bd.name, score: parseFloat((relevant.reduce((a,v)=>a+v.score,0)/relevant.length).toFixed(2)) };
    });
    const drivers: DriverScore[] = Object.entries(MOTIVATION_DRIVERS_LOGIC).map(([k, l]) => {
      const relevant = values.filter(v => l.values.includes(v.code));
      return { name: l.name, score: parseFloat((relevant.reduce((a,v)=>a+v.score,0)/relevant.length).toFixed(1)), rank: 0, recommendation: l.hint };
    });
    drivers.sort((a,b)=>b.score-a.score).forEach((d,i)=>d.rank=i+1);
    return { values, blocks, drivers, topDrivers: drivers.slice(0, 3) };
  };

  const handleSectionComplete = (sectionId: string, answers: UserAnswers) => {
    const sectionData = testSections.find(t => t.id === sectionId);
    if (!sectionData) return;
    let rawScore = 0, maxPossibleScore = 0, hexacoProfile, motivationProfile, validityProfile, textAnswer;

    if (sectionId === 'conscientiousness') {
      hexacoProfile = calculateHexacoScores(answers);
      rawScore = hexacoProfile.find(f => f.code === 'C')?.average || 1; maxPossibleScore = 5;
      const att = answers['check_attention'] === 1;
      validityProfile = { attentionPassed: att, lieScore: (Number(answers['check_lie_1'] || 1) + Number(answers['check_lie_2'] || 1)) / 2, statusLabel: att ? 'Valid' : 'FAIL' };
    } else if (sectionId === 'motivation') {
       motivationProfile = calculateMotivationProfile(answers);
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
    localStorage.removeItem(`sh_answers_${sectionId}`);
    setActiveSectionId(null);
  };

  const handleAutofillAll = () => {
    testSections.forEach(s => {
      const ans: UserAnswers = {};
      s.questions.forEach(q => {
        if (q.type === 'likert') ans[q.id] = 4;
        else if (q.type === 'single-choice' || q.type === 'scenario') ans[q.id] = q.options![0].value;
        else ans[q.id] = "Тестовый ответ. Мы справимся с любой задачей.";
      });
      handleSectionComplete(s.id, ans);
    });
  };

  const handleLoginSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = (new FormData(e.currentTarget).get('code') as string || '').toUpperCase();
    if (COMPANY_CODES[code]) { setCurrentCompany(COMPANY_CODES[code]); setIsAuthenticated(true); setShowHrBuilder(true); setIsHrMode(true); } else { alert("Неверный код."); }
  };

  if (isLoadingConfig) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-bold animate-pulse text-center p-10"><div>Загрузка...</div></div>;

  const ControlBar = () => (
    <div className="fixed top-4 right-4 z-[9999] flex items-center gap-2">
      {isHrMode && <button onClick={handleAutofillAll} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"><Wand2 size={14}/> МАГИЯ</button>}
      <button onClick={() => resetApp(true)} className="bg-slate-900 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold"><LogOut size={14}/></button>
    </div>
  );

  if (showHrBuilder) return <HrBuilder scriptUrl={SCRIPT_URL} company={currentCompany} onExit={() => setShowHrBuilder(false)} onTestPreview={injectCustomSections} />;

  if (isAuthenticated && !candidateInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <ControlBar />
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-6">Анкета Кандидата</h1>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setCandidateInfo({ name: fd.get('name') as string, age: fd.get('age') as string, department: fd.get('department') as string, role: fd.get('role') as string }); }} className="space-y-4">
            <div><label className="text-slate-500 text-xs font-bold uppercase">ФИО</label><input name="name" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500" /></div>
            <div><label className="text-slate-500 text-xs font-bold uppercase">Возраст</label><input name="age" type="number" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-slate-500 text-xs font-bold uppercase">Отдел</label><input name="department" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500" /></div>
              <div><label className="text-slate-500 text-xs font-bold uppercase">Должность</label><input name="role" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500" /></div>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg mt-4 transition-all">НАЧАТЬ ТЕСТ</button>
          </form>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-black text-white mb-8">SmartHire Admin</h1>
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 max-w-sm w-full">
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <input name="code" type="password" required placeholder="КОД HR" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-white text-center tracking-widest outline-none focus:border-blue-500" />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all">ВОЙТИ</button>
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
        <ResultsView results={results} candidateInfo={candidateInfo} onReset={() => resetApp(true)} scriptUrl={SCRIPT_URL} isHrView={isHrMode} jobId={customJobId || ""} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      <ControlBar />
      <header className="max-w-7xl mx-auto py-12 px-6 text-center">
        <h1 className="text-4xl font-black text-white mb-2">Портал Тестирования</h1>
        <p className="text-slate-400">Добро пожаловать, {candidateInfo?.name}.</p>
      </header>
      <main className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {testSections.map(s => {
          const comp = completedSections.includes(s.id);
          return (
            <div key={s.id} onClick={() => !comp && setActiveSectionId(s.id)} className={`p-8 rounded-2xl border transition-all cursor-pointer ${comp ? 'bg-slate-900/50 border-green-500/20 opacity-60' : 'bg-slate-900 border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/50'}`}>
              <div className="mb-4 text-slate-400">{ICONS[s.id] || <Layers />}</div>
              <h3 className="text-xl font-bold mb-2">{s.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{s.description}</p>
              <div className="text-xs font-bold uppercase tracking-widest">{comp ? <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={14}/> Готово</span> : <span className="text-blue-500">Начать тест</span>}</div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
