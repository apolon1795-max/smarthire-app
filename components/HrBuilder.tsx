
import React, { useState, useEffect } from 'react';
import { generateCustomQuestions, generateCandidateProfile } from '../services/geminiService';
import { CustomTestConfig, JobListing, BenchmarkData } from '../types';
import { Loader2, Save, Wand2, Copy, ArrowLeft, CheckCircle, List, Plus, BarChart, ChevronRight, LogOut, FileText, Target, Zap, RefreshCw, SlidersHorizontal, User, ShieldCheck, Activity } from 'lucide-react';

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
      
      const parsedCandidates = Array.isArray(data) ? data.map(c => {
        let hexaco = [];
        let motivation = null;
        try {
          hexaco = typeof c.hexacoJson === 'string' ? JSON.parse(c.hexacoJson) : c.hexacoJson;
          if (!Array.isArray(hexaco)) hexaco = [];
        } catch(e) { hexaco = []; }
        
        try {
          motivation = typeof c.motivationJson === 'string' ? JSON.parse(c.motivationJson) : c.motivationJson;
        } catch(e) { motivation = null; }

        return { 
          ...c, 
          jobBenchmark: currentBenchmark,
          hexaco,
          motivation
        };
      }) : [];

      setJobCandidates(parsedCandidates);
    } catch (e) { 
      console.error("Error loading candidates:", e);
      setJobCandidates([]); 
    }
    finally { setIsLoadingJobs(false); }
  };

  const calculateFit = (report: any) => {
    if (!report || !report.jobBenchmark) return 0;
    const b = report.jobBenchmark;
    // IQ (0-12)
    const iqVal = report.iq || 0;
    const iqScore = 1 - Math.abs(iqVal - b.iq) / 12;
    // Reliability (0-100)
    const relVal = report.reliability || 0;
    const relScore = 1 - Math.abs(relVal - b.reliability) / 100;
    // SJT (0-8)
    const sjtVal = report.sjtScore || 0;
    const sjtScore = 1 - Math.abs(sjtVal - b.sjt) / 8;
    
    const total = Math.round(((iqScore + relScore + sjtScore) / 3) * 100);
    return Math.max(0, Math.min(100, total));
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
    } catch (e) { alert("Ошибка анализа. Попробуйте еще раз."); }
    finally { setIsReanalyzing(false); }
  };

  const HEXACO_LABELS: Record<string, string> = {
    'H': 'Честность', 'E': 'Эмоциональность', 'X': 'Экстраверсия', 'A': 'Доброжелательность', 'C': 'Добросовестность', 'O': 'Открытость'
  };

  return (
    <div className="max-w-7xl mx-auto bg-slate-950 min-h-screen p-6 text-slate-100">
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
              <button onClick={reanalyzeWithBenchmark} disabled={isReanalyzing} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-3 shadow-xl shadow-blue-900/20">
                {isReanalyzing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>} ОБНОВИТЬ ИИ-ОТЧЕТ
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
               <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase mb-4 tracking-widest">Интеллект (IQ)</div>
                  <div className="text-4xl font-black text-white">{activeReport.iq || 0} <span className="text-slate-700 text-lg">/ 12</span></div>
               </div>
               <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase mb-4 tracking-widest">Кейс-тест (SJT)</div>
                  <div className="text-4xl font-black text-purple-400">{activeReport.sjtScore || 0} <span className="text-slate-700 text-lg">/ 8</span></div>
               </div>
               <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase mb-4 tracking-widest">Достоверность</div>
                  <div className="flex items-center gap-2 mt-2">
                     <ShieldCheck size={24} className={(activeReport.reliability || 0) > 30 ? "text-green-500" : "text-red-500"} />
                     <span className={`text-lg font-black ${(activeReport.reliability || 0) > 30 ? "text-green-400" : "text-red-400"}`}>
                        {(activeReport.reliability || 0) > 60 ? "ВЫСОКАЯ" : (activeReport.reliability || 0) > 30 ? "СРЕДНЯЯ" : "НИЗКАЯ"}
                     </span>
                  </div>
               </div>
               <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase mb-4 tracking-widest">Драйверы</div>
                  <div className="text-xs font-black text-slate-300 leading-relaxed uppercase truncate">{activeReport.drivers || "Не определено"}</div>
               </div>
            </div>

            <div className="mb-14">
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-8 flex items-center gap-3">
                <Activity size={20} className="text-blue-500"/> 6 Граней личности (HEXACO)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {Array.isArray(activeReport.hexaco) && activeReport.hexaco.length > 0 ? activeReport.hexaco.map((h: any) => (
                  <div key={h.code} className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                    <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                      <span className="text-slate-400">{HEXACO_LABELS[h.code] || h.factor}</span>
                      <span className="text-blue-400">{Math.round(h.percentage || 0)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${h.percentage || 0}%` }} />
                    </div>
                  </div>
                )) : <div className="col-span-full p-10 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 font-black uppercase tracking-widest">Данные HEXACO отсутствуют</div>}
              </div>
            </div>

            <div className="space-y-12">
               <section>
                  <h3 className="text-white font-black mb-8 flex items-center gap-3 text-sm uppercase tracking-[0.3em] border-l-4 border-blue-500 pl-6">Глубокая HR-аналитика</h3>
                  <div className="bg-slate-950 p-12 rounded-[3rem] border border-slate-800 shadow-2xl relative">
                     {activeReport.aiReport ? (
                       <div className="prose prose-invert max-w-none prose-h3:text-blue-400 prose-h3:text-2xl prose-h3:font-black prose-h3:mt-12 prose-h3:mb-6 prose-p:text-slate-400 prose-p:text-lg prose-p:leading-[1.8] prose-p:mb-8" 
                            dangerouslySetInnerHTML={{ __html: activeReport.aiReport }} />
                     ) : (
                       <div className="text-center py-20">
                          <p className="text-slate-500 font-bold mb-6">Отчет еще не сформирован ИИ</p>
                          <button onClick={reanalyzeWithBenchmark} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold uppercase text-xs">Сформировать сейчас</button>
                       </div>
                     )}
                  </div>
               </section>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-2xl text-blue-400"><BarChart size={32} /></div>
          <div><h1 className="text-3xl font-black text-white uppercase tracking-tighter">SmartHire</h1><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Кабинет: {company}</p></div>
        </div>
        <button onClick={onExit} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 transition-all"><LogOut size={18} /> ВЫЙТИ</button>
      </div>

      {view === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-end">
             <h2 className="text-xl font-bold flex items-center gap-2 text-white"><List size={20} className="text-blue-400"/> Активные вакансии</h2>
             <button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-xl transition-all active:scale-95"><Plus size={20}/> СОЗДАТЬ</button>
          </div>
          {isLoadingJobs ? <div className="text-center py-20 text-slate-500 font-black animate-pulse">ЗАГРУЗКА...</div> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {jobs.map(job => (
                <div key={job.jobId} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-blue-500/30 transition-all shadow-xl group">
                  <h3 className="text-xl font-black text-white mb-6 group-hover:text-blue-400 transition-colors">{job.jobTitle}</h3>
                  <div className="space-y-3">
                    <button onClick={() => loadCandidates(job.jobId)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all">КАНДИДАТЫ <ChevronRight size={14}/></button>
                  </div>
                </div>
              ))}
              {jobs.length === 0 && <div className="col-span-full py-20 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800 text-slate-600 font-black uppercase">Нет активных вакансий</div>}
            </div>
          )}
        </div>
      )}

      {view === 'manage' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <div className="flex justify-between items-center">
              <button onClick={() => setView('dashboard')} className="text-slate-500 hover:text-white flex items-center gap-2 text-xs font-black uppercase transition-all"><ArrowLeft size={16}/> НАЗАД</button>
              <button onClick={() => setIsEditingBenchmark(!isEditingBenchmark)} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase border transition-all ${isEditingBenchmark ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}>
                <SlidersHorizontal size={14}/> {isEditingBenchmark ? 'ЗАКРЫТЬ ЭТАЛОН' : 'ИДЕАЛЬНЫЙ КАНДИДАТ'}
              </button>
           </div>

           {isEditingBenchmark && (
             <div className="bg-slate-900 border border-indigo-500/20 rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-white font-black text-sm uppercase tracking-widest mb-8 flex items-center gap-3"><Target size={20} className="text-indigo-500"/> Настройка профиля</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-4"><span>Целевой IQ</span> <span className="text-blue-400 font-black">{benchmark.iq}</span></div>
                    <input type="range" min="1" max="12" value={benchmark.iq} onChange={e => setBenchmark({...benchmark, iq: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 appearance-none accent-blue-500 cursor-pointer" />
                  </div>
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-4"><span>Надежность</span> <span className="text-blue-400 font-black">{benchmark.reliability}%</span></div>
                    <input type="range" min="0" max="100" value={benchmark.reliability} onChange={e => setBenchmark({...benchmark, reliability: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 appearance-none accent-blue-500 cursor-pointer" />
                  </div>
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-4"><span>SJT балл</span> <span className="text-blue-400 font-black">{benchmark.sjt}</span></div>
                    <input type="range" min="0" max="8" value={benchmark.sjt} onChange={e => setBenchmark({...benchmark, sjt: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 appearance-none accent-blue-500 cursor-pointer" />
                  </div>
                </div>
             </div>
           )}

           <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 lg:p-14 shadow-2xl">
              <h2 className="text-3xl font-black text-white mb-12">Список откликов <span className="text-blue-500 ml-2">{jobCandidates.length}</span></h2>
              {isLoadingJobs ? <div className="text-center py-20 text-slate-500 font-black animate-pulse">ЗАГРУЗКА ДАННЫХ...</div> : jobCandidates.length === 0 ? <div className="text-center py-20 text-slate-600 uppercase font-black tracking-widest border-2 border-dashed border-slate-800 rounded-3xl">Кандидатов пока нет</div> : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-600 text-[11px] font-black uppercase tracking-[0.2em]">
                          <th className="pb-8 px-6">Кандидат</th>
                          <th className="pb-8 px-6 text-center">IQ</th>
                          <th className="pb-8 px-6 text-center">Надежность</th>
                          <th className="pb-8 px-6 text-center">Соответствие</th>
                          <th className="pb-8 px-6 text-right">Действие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobCandidates.map((c, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all cursor-pointer group" onClick={() => setActiveReport(c)}>
                            <td className="py-8 px-6">
                               <div className="text-white font-black text-xl group-hover:text-blue-400 transition-colors">{c.name}</div>
                               <div className="text-slate-600 text-[10px] font-bold uppercase mt-2 tracking-widest">{new Date(c.date).toLocaleDateString()}</div>
                            </td>
                            <td className="py-8 px-6 text-center"><div className="font-black text-white text-2xl">{c.iq || 0}</div></td>
                            <td className="py-8 px-6 text-center"><div className={`font-black text-2xl ${(c.reliability || 0) >= 75 ? 'text-green-400' : 'text-blue-400'}`}>{c.reliability || 0}%</div></td>
                            <td className="py-8 px-6 text-center">
                               <div className={`inline-block px-5 py-2 rounded-full font-black text-xs tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20`}>
                                 {calculateFit(c)}%
                               </div>
                            </td>
                            <td className="py-8 px-6 text-right">
                               <button onClick={(e) => { e.stopPropagation(); setActiveReport(c); }} className="p-4 bg-slate-950 hover:bg-blue-600 text-slate-500 hover:text-white rounded-2xl border border-slate-800 shadow-xl transition-all"><FileText size={24}/></button>
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
