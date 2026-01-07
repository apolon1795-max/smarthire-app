
import React, { useState, useEffect } from 'react';
import { generateCustomQuestions, generateCandidateProfile } from '../services/geminiService';
import { CustomTestConfig, JobListing, BenchmarkData } from '../types';
import { Loader2, Save, Wand2, Copy, ArrowLeft, CheckCircle, List, Plus, BarChart, ChevronRight, LogOut, FileText, Target, Zap, RefreshCw, SlidersHorizontal, User, ShieldCheck, AlertTriangle, Activity } from 'lucide-react';

interface HrBuilderProps {
  scriptUrl: string;
  company: string;
  onExit: () => void;
  onTestPreview: (config: CustomTestConfig) => void;
}

const DEFAULT_BENCHMARK: BenchmarkData = {
  iq: 7, reliability: 50, sjt: 4,
  hexaco: { 'H': 60, 'E': 40, 'X': 60, 'A': 60, 'C': 70, 'O': 50 }
};

const HrBuilder: React.FC<HrBuilderProps> = ({ scriptUrl, company, onExit, onTestPreview }) => {
  const [view, setView] = useState<'dashboard' | 'create' | 'manage'>('dashboard');
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [jobCandidates, setJobCandidates] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isEditingBenchmark, setIsEditingBenchmark] = useState(false);
  const [benchmark, setBenchmark] = useState<BenchmarkData>(DEFAULT_BENCHMARK);

  const [role, setRole] = useState('');
  const [challenges, setChallenges] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<CustomTestConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLink, setSavedLink] = useState('');

  useEffect(() => { if (view === 'dashboard') loadJobs(); }, [view]);

  const loadJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const resp = await fetch(`${scriptUrl}?action=GET_JOBS&company=${encodeURIComponent(company)}`);
      const data = await resp.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) { setJobs([]); }
    finally { setIsLoadingJobs(false); }
  };

  const loadCandidates = async (jobId: string) => {
    setView('manage');
    setIsLoadingJobs(true);
    try {
      const configResp = await fetch(`${scriptUrl}?action=GET_JOB_CONFIG&jobId=${jobId}`);
      const configData = await configResp.json();
      const currentBenchmark = configData.benchmark || DEFAULT_BENCHMARK;
      setBenchmark(currentBenchmark);

      const resp = await fetch(`${scriptUrl}?action=GET_CANDIDATES&jobId=${jobId}`);
      const data = await resp.json();
      setJobCandidates(Array.isArray(data) ? data.map(c => ({ 
        ...c, 
        jobBenchmark: currentBenchmark,
        hexaco: typeof c.hexacoJson === 'string' ? JSON.parse(c.hexacoJson) : c.hexacoJson,
        motivation: typeof c.motivationJson === 'string' ? JSON.parse(c.motivationJson) : c.motivationJson
      })) : []);
    } catch (e) { setJobCandidates([]); }
    finally { setIsLoadingJobs(false); }
  };

  const calculateFit = (report: any) => {
    if (!report.jobBenchmark) return 0;
    const b = report.jobBenchmark;
    const iqScore = 1 - Math.abs(report.iq - b.iq) / 12;
    const relScore = 1 - Math.abs(report.reliability - b.reliability) / 100;
    const sjtScore = 1 - Math.abs((report.sjtScore || 0) - b.sjt) / 8;
    return Math.max(0, Math.min(100, Math.round(((iqScore + relScore + sjtScore) / 3) * 100)));
  };

  const reanalyzeWithBenchmark = async () => {
    if (!activeReport) return;
    setIsReanalyzing(true);
    try {
      const mockResults = [
        { sectionId: 'intelligence', title: 'IQ', percentage: (activeReport.iq/12)*100, rawScore: activeReport.iq },
        { sectionId: 'conscientiousness', title: 'Надежность', percentage: activeReport.reliability, rawScore: activeReport.reliability, hexacoProfile: activeReport.hexaco },
        { sectionId: 'sjt', title: 'Кейс-тест', percentage: (activeReport.sjtScore/8)*100, rawScore: activeReport.sjtScore },
        { sectionId: 'motivation', title: 'Драйверы', percentage: 100, motivationProfile: activeReport.motivation }
      ] as any;
      const newReport = await generateCandidateProfile(mockResults, { name: activeReport.name, role: activeReport.role } as any, activeReport.jobBenchmark);
      setActiveReport({ ...activeReport, aiReport: newReport });
    } catch (e) { alert("Ошибка анализа. Проверьте API_KEY."); }
    finally { setIsReanalyzing(false); }
  };

  const HEXACO_LABELS: Record<string, string> = {
    'H': 'Честность', 'E': 'Эмоциональность', 'X': 'Экстраверсия', 'A': 'Доброжелательность', 'C': 'Добросовестность', 'O': 'Открытость'
  };

  return (
    <div className="max-w-7xl mx-auto bg-slate-950 min-h-screen p-6 text-slate-100">
      {/* МОДАЛКА ОТЧЕТА */}
      {activeReport && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/98 backdrop-blur-2xl p-4 sm:p-10 lg:p-16 overflow-y-auto custom-scrollbar">
          <div className="max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-[3rem] p-8 lg:p-14 shadow-3xl animate-in zoom-in-95 duration-500 relative">
            <button onClick={() => setActiveReport(null)} className="absolute top-10 right-10 bg-slate-800 hover:bg-slate-700 p-4 rounded-full text-white transition-all"><ArrowLeft size={24}/></button>
            
            <div className="flex flex-col md:flex-row justify-between items-start mb-14 gap-8">
              <div>
                <h2 className="text-5xl font-black text-white tracking-tighter mb-2">{activeReport.name}</h2>
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 font-black uppercase text-xs tracking-widest">{activeReport.role}</span>
                  <div className="bg-blue-600/20 px-4 py-1 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/30">СООТВЕТСТВИЕ: {calculateFit(activeReport)}%</div>
                </div>
              </div>
              <button onClick={reanalyzeWithBenchmark} disabled={isReanalyzing} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-3">
                {isReanalyzing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>} ОБНОВИТЬ ИИ-ОТЧЕТ
              </button>
            </div>

            {/* ВЕРХНЯЯ ПАНЕЛЬ: IQ, ДОСТОВЕРНОСТЬ, SJT */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
               <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase mb-4 tracking-widest">Интеллект (IQ)</div>
                  <div className="text-4xl font-black text-white">{activeReport.iq} <span className="text-slate-700 text-lg">/ 12</span></div>
               </div>
               <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase mb-4 tracking-widest">Кейс-тест (SJT)</div>
                  <div className="text-4xl font-black text-purple-400">{activeReport.sjtScore || 0} <span className="text-slate-700 text-lg">/ 8</span></div>
               </div>
               <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase mb-4 tracking-widest">Достоверность</div>
                  <div className="flex items-center gap-2 mt-2">
                     <ShieldCheck size={24} className={activeReport.reliability > 30 ? "text-green-500" : "text-red-500"} />
                     <span className={`text-lg font-black ${activeReport.reliability > 30 ? "text-green-400" : "text-red-400"}`}>
                        {activeReport.reliability > 60 ? "ВЫСОКАЯ" : activeReport.reliability > 30 ? "СРЕДНЯЯ" : "НИЗКАЯ"}
                     </span>
                  </div>
               </div>
               <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase mb-4 tracking-widest">Драйверы</div>
                  <div className="text-xs font-black text-slate-300 leading-relaxed uppercase">{activeReport.drivers || "Не определено"}</div>
               </div>
            </div>

            {/* HEXACO 6 ФАКТОРОВ */}
            <div className="mb-14">
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-8 flex items-center gap-3">
                <Activity size={20} className="text-blue-500"/> 6 Граней личности (HEXACO)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {activeReport.hexaco ? activeReport.hexaco.map((h: any) => (
                  <div key={h.code} className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                    <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                      <span className="text-slate-400">{HEXACO_LABELS[h.code] || h.factor}</span>
                      <span className="text-blue-400">{Math.round(h.percentage)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${h.percentage}%` }} />
                    </div>
                  </div>
                )) : <div className="text-slate-600 italic">Данные HEXACO отсутствуют</div>}
              </div>
            </div>

            {/* ИИ ОТЧЕТ */}
            <div className="space-y-12">
               <section>
                  <h3 className="text-white font-black mb-8 flex items-center gap-3 text-sm uppercase tracking-[0.3em] border-l-4 border-blue-500 pl-6">Глубокая HR-аналитика</h3>
                  <div className="bg-slate-950 p-12 rounded-[3rem] border border-slate-800 shadow-2xl relative">
                     <div className="prose prose-invert max-w-none prose-h3:text-blue-400 prose-h3:text-2xl prose-h3:font-black prose-h3:mt-12 prose-h3:mb-6 prose-p:text-slate-400 prose-p:text-lg prose-p:leading-[1.8] prose-p:mb-8" 
                          dangerouslySetInnerHTML={{ __html: activeReport.aiReport }} />
                  </div>
               </section>
            </div>
          </div>
        </div>
      )}

      {/* ШАПКА КАБИНЕТА */}
      <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-2xl text-blue-400"><BarChart size={32} /></div>
          <div><h1 className="text-3xl font-black text-white">HR-КАБИНЕТ</h1><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{company}</p></div>
        </div>
        <button onClick={onExit} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold"><LogOut size={18} /> ВЫЙТИ</button>
      </div>

      {/* ДЭШБОРД */}
      {view === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-end">
             <h2 className="text-xl font-bold flex items-center gap-2"><List size={20} className="text-blue-400"/> Активные вакансии</h2>
             <button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-xl"><Plus size={20}/> СОЗДАТЬ</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {jobs.map(job => (
              <div key={job.jobId} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-blue-500/30 transition-all">
                <h3 className="text-xl font-black text-white mb-6">{job.jobTitle}</h3>
                <div className="space-y-3">
                  <button onClick={() => loadCandidates(job.jobId)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all">КАНДИДАТЫ <ChevronRight size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* СПИСОК КАНДИДАТОВ */}
      {view === 'manage' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <div className="flex justify-between items-center">
              <button onClick={() => setView('dashboard')} className="text-slate-500 hover:text-white flex items-center gap-2 text-xs font-black uppercase"><ArrowLeft size={16}/> НАЗАД</button>
              <button onClick={() => setIsEditingBenchmark(!isEditingBenchmark)} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase border ${isEditingBenchmark ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                <SlidersHorizontal size={14}/> {isEditingBenchmark ? 'ЗАКРЫТЬ ЭТАЛОН' : 'ИДЕАЛЬНЫЙ КАНДИДАТ'}
              </button>
           </div>

           {isEditingBenchmark && (
             <div className="bg-slate-900 border border-indigo-500/20 rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-white font-black text-sm uppercase tracking-widest mb-8 flex items-center gap-3"><Target size={20} className="text-indigo-500"/> Целевой профиль</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-4"><span>Целевой IQ</span> <span className="text-blue-400">{benchmark.iq}</span></div>
                    <input type="range" min="1" max="12" value={benchmark.iq} onChange={e => setBenchmark({...benchmark, iq: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 appearance-none accent-blue-500 cursor-pointer" />
                  </div>
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-4"><span>Надежность</span> <span className="text-blue-400">{benchmark.reliability}%</span></div>
                    <input type="range" min="0" max="100" value={benchmark.reliability} onChange={e => setBenchmark({...benchmark, reliability: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 appearance-none accent-blue-500 cursor-pointer" />
                  </div>
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-4"><span>Кейс-балл</span> <span className="text-blue-400">{benchmark.sjt}</span></div>
                    <input type="range" min="0" max="8" value={benchmark.sjt} onChange={e => setBenchmark({...benchmark, sjt: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 appearance-none accent-blue-500 cursor-pointer" />
                  </div>
                </div>
             </div>
           )}

           <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 lg:p-14 shadow-2xl">
              <h2 className="text-3xl font-black text-white mb-12">Список откликов <span className="text-blue-500 ml-2">{jobCandidates.length}</span></h2>
              {jobCandidates.length === 0 ? <div className="text-center py-20 text-slate-600 uppercase font-black tracking-widest">Кандидатов пока нет</div> : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-600 text-[11px] font-black uppercase tracking-[0.2em]">
                          <th className="pb-8 px-6">ФИО Кандидата</th>
                          <th className="pb-8 px-6 text-center">IQ</th>
                          <th className="pb-8 px-6 text-center">Надежность</th>
                          <th className="pb-8 px-6 text-center">Соответствие</th>
                          <th className="pb-8 px-6 text-right">Отчет</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobCandidates.map((c, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all cursor-pointer" onClick={() => setActiveReport(c)}>
                            <td className="py-8 px-6">
                               <div className="text-white font-black text-xl">{c.name}</div>
                               <div className="text-slate-600 text-[10px] font-bold uppercase mt-2 tracking-widest">{new Date(c.date).toLocaleDateString()}</div>
                            </td>
                            <td className="py-8 px-6 text-center"><div className="font-black text-white text-2xl">{c.iq}</div></td>
                            <td className="py-8 px-6 text-center"><div className={`font-black text-2xl ${c.reliability >= 75 ? 'text-green-400' : 'text-blue-400'}`}>{c.reliability}%</div></td>
                            <td className="py-8 px-6 text-center">
                               <div className="inline-block px-5 py-2 rounded-full font-black text-xs tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                 {calculateFit(c)}%
                               </div>
                            </td>
                            <td className="py-8 px-6 text-right">
                               <button onClick={(e) => { e.stopPropagation(); setActiveReport(c); }} className="p-4 bg-slate-950 hover:bg-blue-600 text-slate-500 hover:text-white rounded-2xl border border-slate-800 shadow-xl"><FileText size={24}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default HrBuilder;
