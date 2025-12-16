import React, { useState, useEffect } from 'react';
import { TEST_DATA, HEXACO_KEY, FACTOR_NAMES, MOTIVATION_MAPPING, MOTIVATION_NAMES, MOTIVATION_BLOCKS, MOTIVATION_DRIVERS_LOGIC } from './data/testData';
import TestRunner from './components/TestRunner';
import ResultsView from './components/ResultsView';
import HrBuilder from './components/HrBuilder';
import { UserAnswers, TestResult, HexacoScore, MotivationProfile, ValueScore, BlockScore, DriverScore, CandidateInfo, ValidityProfile, CustomTestConfig } from './types';
import { Brain, FileCheck, Target, Layers, CheckCircle2, Circle, UserPlus, Briefcase, Lock, Briefcase as CaseIcon, PenTool, Settings, LogIn, ShieldCheck } from 'lucide-react';
import { SCRIPT_URL } from './services/geminiService';

const ICONS: Record<string, React.ReactNode> = {
  intelligence: <Brain size={28} />,
  conscientiousness: <FileCheck size={28} />,
  motivation: <Target size={28} />,
  sjt: <CaseIcon size={28} />,
  work_sample: <PenTool size={28} />
};

const ACCESS_CODE = 'SMART2025';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  
  // Custom Config State
  const [customJobId, setCustomJobId] = useState<string | null>(null);
  const [testSections, setTestSections] = useState(TEST_DATA);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  
  // View Modes
  const [showHrBuilder, setShowHrBuilder] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<CustomTestConfig | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId');
    if (jobId) {
      setCustomJobId(jobId);
      fetchCustomConfig(jobId);
    }
  }, []);

  const injectCustomSections = (data: CustomTestConfig, isPreview = false) => {
      const customSections = [...TEST_DATA];
      
      customSections.push({
        id: 'sjt',
        title: 'Ситуационные Кейсы (SJT)',
        description: `Решение профессиональных дилемм для роли ${data.jobTitle}.`,
        displayMode: 'step',
        questions: data.sjtQuestions
      });

      if (data.workSampleQuestion) {
        customSections.push({
          id: 'work_sample',
          title: 'Практическое Задание',
          description: 'Комплексный бизнес-кейс в формате "In-Basket". Проверка hard skills.',
          displayMode: 'step',
          questions: [data.workSampleQuestion]
        });
      }

      setTestSections(customSections);
      
      if (isPreview) {
        setCandidateInfo({ name: 'HR Preview', age: 'N/A', department: 'HR', role: data.jobTitle });
        setIsAuthenticated(true);
        setShowHrBuilder(false);
      }
  };

  const fetchCustomConfig = async (jobId: string) => {
    setIsLoadingConfig(true);
    try {
      const response = await fetch(`${SCRIPT_URL}?jobId=${jobId}`);
      const data = await response.json();
      if (data && data.sjtQuestions) injectCustomSections(data);
    } catch (e) {
      console.error("Failed to load custom config", e);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleTestPreview = (config: CustomTestConfig) => {
    setPreviewConfig(config);
    injectCustomSections(config, true);
  };

  // --- SCORING (same) ---
  const calculateHexacoScores = (answers: UserAnswers): HexacoScore[] => {
    const scores: Record<string, { sum: number; count: number }> = {
      'H': { sum: 0, count: 0 }, 'E': { sum: 0, count: 0 }, 'X': { sum: 0, count: 0 },
      'A': { sum: 0, count: 0 }, 'C': { sum: 0, count: 0 }, 'O': { sum: 0, count: 0 },
    };
    Object.entries(answers).forEach(([qId, value]) => {
      const idNum = parseInt(qId);
      const keyData = HEXACO_KEY[idNum];
      if (keyData && typeof value === 'number') {
        const finalValue = keyData.reverse ? (6 - value) : value;
        if (scores[keyData.code]) { scores[keyData.code].sum += finalValue; scores[keyData.code].count += 1; }
      }
    });
    return Object.entries(scores).map(([code, data]) => ({
      factor: FACTOR_NAMES[code], code: code, rawScore: data.sum, questionCount: data.count,
      average: parseFloat((data.count > 0 ? data.sum / data.count : 0).toFixed(2)),
      percentage: (data.sum / (data.count * 5)) * 100
    }));
  };

  const calculateMotivationProfile = (answers: UserAnswers): MotivationProfile => {
    const valueTotals: Record<string, { sum: number; count: number }> = {};
    Object.entries(answers).forEach(([qId, score]) => {
      const idNum = parseInt(qId);
      const valueCode = MOTIVATION_MAPPING[idNum];
      if (valueCode && typeof score === 'number') {
        if (!valueTotals[valueCode]) valueTotals[valueCode] = { sum: 0, count: 0 };
        valueTotals[valueCode].sum += score;
        valueTotals[valueCode].count += 1;
      }
    });
    const values: ValueScore[] = Object.keys(MOTIVATION_NAMES).map(code => {
      const data = valueTotals[code] || { sum: 0, count: 1 };
      return { code, name: MOTIVATION_NAMES[code], score: parseFloat((data.sum / data.count).toFixed(1)) };
    });
    const blocks: BlockScore[] = Object.entries(MOTIVATION_BLOCKS).map(([blockKey, blockData]) => {
      const relevantValues = values.filter(v => blockData.values.includes(v.code));
      const sum = relevantValues.reduce((acc, v) => acc + v.score, 0);
      const avg = relevantValues.length > 0 ? sum / relevantValues.length : 0;
      return { name: blockData.name, score: parseFloat(avg.toFixed(2)) };
    });
    const drivers: DriverScore[] = Object.entries(MOTIVATION_DRIVERS_LOGIC).map(([key, logic]) => {
      const relevantValues = values.filter(v => logic.values.includes(v.code));
      const sum = relevantValues.reduce((acc, v) => acc + v.score, 0);
      const avg = relevantValues.length > 0 ? sum / relevantValues.length : 0;
      return { name: logic.name, score: parseFloat(avg.toFixed(1)), rank: 0, recommendation: logic.hint };
    });
    drivers.sort((a, b) => b.score - a.score);
    drivers.forEach((d, idx) => d.rank = idx + 1);
    return { values, blocks, drivers, topDrivers: drivers.slice(0, 3) };
  };

  const handleSectionComplete = (sectionId: string, answers: UserAnswers) => {
    const sectionData = testSections.find(t => t.id === sectionId);
    if (!sectionData) return;
    let rawScore = 0;
    let maxPossibleScore = 0;
    let hexacoProfile: HexacoScore[] | undefined;
    let motivationProfile: MotivationProfile | undefined;
    let validityProfile: ValidityProfile | undefined;
    let textAnswer: string | undefined;

    if (sectionId === 'conscientiousness') {
      hexacoProfile = calculateHexacoScores(answers);
      rawScore = hexacoProfile.find(f => f.code === 'C')?.average || 0;
      maxPossibleScore = 5;
      const attentionVal = answers['check_attention'] === 1;
      const lie1 = typeof answers['check_lie_1'] === 'number' ? answers['check_lie_1'] : 0;
      const lie2 = typeof answers['check_lie_2'] === 'number' ? answers['check_lie_2'] : 0;
      validityProfile = { attentionPassed: attentionVal, lieScore: (lie1 + lie2) / 2, statusLabel: attentionVal ? 'Valid' : 'FAIL' };
    } else if (sectionId === 'motivation') {
       motivationProfile = calculateMotivationProfile(answers);
       const totalSum = Object.values(answers).reduce((a, b) => (typeof a === 'number' ? a : 0) + (typeof b === 'number' ? b : 0), 0);
       rawScore = Object.keys(answers).length > 0 ? (totalSum as number / Object.keys(answers).length) : 0;
       maxPossibleScore = 6;
    } else if (sectionId === 'sjt') {
       Object.values(answers).forEach(val => { if (typeof val === 'number') rawScore += val; maxPossibleScore += 2; });
    } else if (sectionId === 'work_sample') {
       textAnswer = answers[sectionData.questions[0].id] as string;
    } else {
      sectionData.questions.forEach(q => { if (typeof answers[q.id] === 'number') rawScore += answers[q.id] as number; maxPossibleScore += 1; });
    }
    const percentage = maxPossibleScore > 0 ? (rawScore / maxPossibleScore) * 100 : 0;
    setResults(prev => [...prev.filter(r => r.sectionId !== sectionId), { sectionId: sectionId as any, title: sectionData.title, rawScore, maxScore: maxPossibleScore, percentage, answers, hexacoProfile, motivationProfile, validityProfile, textAnswer }]);
    setCompletedSections(prev => [...prev, sectionId]);
    setActiveSectionId(null);
  };

  const startTest = (id: string) => setActiveSectionId(id);
  const resetApp = () => { setActiveSectionId(null); setCompletedSections([]); setResults([]); setCandidateInfo(null); setIsAuthenticated(false); setPreviewConfig(null); setTestSections(TEST_DATA); };

  const handleRegistrationSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setCandidateInfo({
      name: formData.get('name') as string,
      age: formData.get('age') as string,
      department: formData.get('department') as string,
      role: formData.get('role') as string,
    });
  };

  const handleLoginSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (formData.get('code') === ACCESS_CODE) setIsAuthenticated(true);
    else alert("Неверный код доступа");
  };

  if (isLoadingConfig) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-bold animate-pulse">Загрузка портала...</div>;
  if (showHrBuilder) return <HrBuilder scriptUrl={SCRIPT_URL} onExit={() => setShowHrBuilder(false)} onTestPreview={handleTestPreview} />;

  // --- LOGIC: FIRST SCREEN ---
  // If NO JobID -> Show Landing with HR Button only
  if (!customJobId && !isAuthenticated && !candidateInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-xl w-full">
           <div className="mb-12 space-y-4">
              <div className="inline-flex p-4 rounded-3xl bg-blue-600/10 border border-blue-500/20 mb-4">
                <ShieldCheck className="text-blue-500" size={64} />
              </div>
              <h1 className="text-5xl font-extrabold text-white tracking-tight">SmartHire Assessment</h1>
              <p className="text-slate-400 text-lg">Платформа для профессиональной оценки персонала и генерации индивидуальных тестов с помощью AI.</p>
           </div>
           
           <div className="bg-slate-900/50 p-1 rounded-2xl border border-slate-800">
             <button 
               onClick={() => setShowHrBuilder(true)} 
               className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-bold py-5 rounded-xl shadow-2xl shadow-blue-900/40 transition-all group"
             >
               <Settings size={24} className="group-hover:rotate-45 transition-transform" />
               ВХОД ДЛЯ HR-СПЕЦИАЛИСТА
             </button>
           </div>
           
           <p className="mt-8 text-slate-600 text-sm">© 2025 SmartHire Solutions. Все права защищены.</p>
        </div>
      </div>
    );
  }

  // --- LOGIC: CANDIDATE VIEW (JobId present) ---
  if (customJobId && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-8 text-center">
          <div className="inline-block p-3 rounded-full bg-blue-500/10 mb-4 ring-1 ring-blue-500/30">
            <LogIn className="text-blue-400" size={32} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Доступ к тестированию</h1>
          <p className="text-slate-400 text-sm mb-6">Введите код доступа, предоставленный вашим HR-менеджером.</p>
          <form onSubmit={handleLoginSubmit}>
            <input name="code" type="password" required placeholder="КОД ДОСТУПА" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white mb-4 focus:border-blue-500 outline-none text-center tracking-widest font-bold" />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all">Подтвердить</button>
          </form>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !candidateInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
          <div className="text-center mb-8">
            <div className="inline-block p-3 rounded-full bg-blue-500/10 mb-4 ring-1 ring-blue-500/30"><UserPlus className="text-blue-400" size={32} /></div>
            <h1 className="text-2xl font-bold text-white mb-2">Анкета Кандидата</h1>
            <p className="text-slate-400 text-sm">Пожалуйста, заполните данные для формирования отчета.</p>
          </div>
          <form onSubmit={handleRegistrationSubmit} className="space-y-4">
            <div><label className="block text-slate-400 text-xs font-bold mb-1 ml-1 uppercase">ФИО</label><input name="name" required className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" /></div>
            <div><label className="block text-slate-400 text-xs font-bold mb-1 ml-1 uppercase">Возраст</label><input name="age" type="number" required className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-slate-400 text-xs font-bold mb-1 ml-1 uppercase">Отдел</label><input name="department" required className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" /></div>
              <div><label className="block text-slate-400 text-xs font-bold mb-1 ml-1 uppercase">Должность</label><input name="role" required className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" /></div>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg mt-4 transition-all">НАЧАТЬ ТЕСТ</button>
          </form>
        </div>
      </div>
    );
  }

  if (activeSectionId) {
    const section = testSections.find(t => t.id === activeSectionId);
    if (!section) return null;
    return <div className="min-h-screen bg-slate-950 py-6 px-4 sm:px-6"><TestRunner section={section} onComplete={handleSectionComplete} onExit={() => setActiveSectionId(null)} /></div>;
  }

  if (completedSections.length === testSections.length) {
    return <div className="min-h-screen bg-slate-950 py-8 px-4 sm:px-6"><ResultsView results={results} candidateInfo={candidateInfo} onReset={resetApp} scriptUrl={SCRIPT_URL} /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      <header className="max-w-7xl mx-auto py-12 px-4 sm:px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-4 tracking-tight">Портал Оценки Кандидатов</h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">Добро пожаловать, <span className="text-white font-bold">{candidateInfo?.name}</span>. Завершите все этапы тестирования.</p>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testSections.map((section) => {
            const isCompleted = completedSections.includes(section.id);
            return (
              <div key={section.id} onClick={() => !isCompleted && startTest(section.id)} className={`relative group rounded-2xl p-8 border backdrop-blur-sm transition-all duration-300 flex flex-col h-full ${isCompleted ? 'bg-slate-900/40 border-green-500/30 cursor-default' : 'bg-slate-900/60 border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/80 cursor-pointer hover:-translate-y-1'}`}>
                <div className="absolute top-6 right-6">{isCompleted ? <CheckCircle2 className="text-green-400" size={20} /> : <Circle className="text-slate-600" size={20} />}</div>
                <div className="mb-6 p-4 rounded-xl inline-block w-fit bg-slate-800 text-slate-300 transition-colors group-hover:bg-slate-700">{ICONS[section.id] || <Layers size={28}/>}</div>
                <h3 className="text-xl font-bold mb-3 text-slate-100">{section.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-grow">{section.description}</p>
                <div className="mt-auto pt-6 border-t border-slate-800 flex items-center justify-between">
                  {!isCompleted && <span className="text-blue-500 font-bold text-sm uppercase tracking-wider">Начать тест</span>}
                  {isCompleted && <span className="text-green-500 text-sm font-bold flex items-center gap-2"><CheckCircle2 size={16}/> ЗАВЕРШЕНО</span>}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
