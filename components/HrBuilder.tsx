
import React, { useState, useEffect } from 'react';
import { generateCustomQuestions, generateCandidateProfile } from '../services/geminiService';
import { CustomTestConfig, JobListing, BenchmarkData } from '../types';
import { Loader2, Save, Wand2, Copy, ArrowLeft, CheckCircle, List, Plus, BarChart, ChevronRight, LogOut, FileText, Target, Zap, RefreshCw, SlidersHorizontal, User, ShieldCheck, Activity, Check, AlertTriangle, Briefcase as CaseIcon } from 'lucide-react';

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
  const [activeJobId, setActiveJobId] = useState<string>('');
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [jobCandidates, setJobCandidates] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isEditingBenchmark, setIsEditingBenchmark] = useState(false);
  const [isSavingBenchmark, setIsSavingBenchmark] = useState(false);
  const [benchmark, setBenchmark] = useState<BenchmarkData>(DEFAULT_BENCHMARK);

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
    setActiveJobId(jobId);
    setView('manage');
    setIsLoadingJobs(true);
    try {
      // 1. Получаем конфиг вакансии для актуального эталона
      const configResp = await fetch(`${scriptUrl}?action=GET_JOB_CONFIG&jobId=${jobId}`);
      const configData = await configResp.json();
      const currentBenchmark = configData.benchmark || DEFAULT_BENCHMARK;
      setBenchmark(currentBenchmark);

      // 2. Получаем список кандидатов
      const resp = await fetch(`${scriptUrl}?action=GET_CANDIDATES&jobId=${jobId}`);
      const data = await resp.json();
      
      const parsedCandidates = Array.isArray(data) ? data.map(c => {
        let hexaco = [];
        let motivation = null;
        try {
          const hStr = (c.hexacoJson && c.hexacoJson !== '{}' && c.hexacoJson !== '[]') ? c.hexacoJson : '[]';
          hexaco = typeof hStr === 'string' ? JSON.parse(hStr) : hStr;
          if (!Array.isArray(hexaco)) hexaco = [];
        } catch(e) { hexaco = []; }

        try {
          const mStr = (c.motivationJson && c.motivationJson !== '{}') ? c.motivationJson : 'null';
          motivation = typeof mStr === 'string' ? JSON.parse(mStr) : mStr;
        } catch(e) { motivation = null; }
        
        return { 
          ...c, 
          jobBenchmark: currentBenchmark,
          hexaco,
          motivation
        };
      }) : [];

      setJobCandidates(parsedCandidates);
    } catch (e) { setJobCandidates([]); }
    finally { setIsLoadingJobs(false); }
  };

  const saveBenchmarkToDb = async () => {
    setIsSavingBenchmark(true);
    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'UPDATE_BENCHMARK', jobId: activeJobId, benchmark })
      });
      const result = await response.json();
      if (result.status === 'success') {
        // Обновляем локальных кандидатов новым эталоном для пересчета Fit Score
        setJobCandidates(prev => prev.map(c => ({ ...c, jobBenchmark: benchmark })));
        setIsEditingBenchmark(false);
        if (activeReport) {
            setActiveReport(prev => ({ ...prev, jobBenchmark: benchmark }));
        }
      } else {
        alert("Ошибка при сохранении: " + result.message);
      }
    } catch (e) { 
      console.error(e);
      alert("Не удалось сохранить эталон в базу данных."); 
    }
    finally { setIsSavingBenchmark(false); }
  };

  const calculateFit = (report: any) => {
    if (!report || !report.jobBenchmark) return 0;
    const b = report.jobBenchmark;
    const iqVal = report.iq || 0;
    const iqScore = 1 - Math.abs(iqVal - b.iq) / 12;
    const relVal = report.reliability || 0;
    const relScore = 1 - Math.abs(relVal - b.reliability) / 100;
    const sjtVal = report.sjtScore || 0;
    const sjtScore = 1 - Math.abs(sjtVal - b.sjt) / 8;
    
    const final = ((iqScore + relScore + sjtScore) / 3) * 100;
    return Math.max(0, Math.min(100, Math.round(final)));
  };

  const reanalyzeWithBenchmark = async () => {
    if (!activeReport) return;
    setIsReanalyzing(true);
    try {
      const mockResults = [
        { sectionId: 'intelligence', title: 'IQ', percentage: (activeReport.iq / 12) * 100, rawScore: activeReport.iq },
        { sectionId: 'conscientiousness', title: 'Надежность', percentage: activeReport.reliability, rawScore: activeReport.reliability, hexacoProfile: activeReport.hexaco },
        { sectionId: 'sjt', title: 'Кейс-тест', percentage: (activeReport.sjtScore / 8) * 100, rawScore: activeReport.sjtScore },
        { sectionId: 'motivation', title: 'Драйверы', percentage: 100, motivationProfile: activeReport.motivation },
        { sectionId: 'work_sample', title: 'Практическое Задание', percentage: 100, textAnswer: activeReport.workAnswer }
      ] as any;
      const newReport = await generateCandidateProfile(mockResults, { name: activeReport.name, role: activeReport.role } as any);
      setActiveReport({ ...activeReport, aiReport: newReport });
    } catch (e) { 
      console.error("AI Reanalysis Error:", e);
      alert("Ошибка при обновлении ИИ-отчета."); 
    }
    finally { setIsReanalyzing(false); }
  };

  const HEXACO_LABELS: Record<string, string> = {
    'H': 'Честность', 'E': 'Эмоциональность', 'X': 'Экстраверсия', 'A': 'Доброжелательность', 'C': 'Добросовестность', 'O': 'Открытость'
  };

  return (
    <div className="max-w-7xl mx-auto bg-slate-950 min-h-screen p-6 text-slate-100">
      {/* ОТЧЕТ КАНДИДАТА */}
      {activeReport && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/98 backdrop-blur-2xl p-4 sm:p-10 overflow-y-auto custom-scrollbar">
          <div className="max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-[3rem] p-8 lg:p-14 shadow-3xl animate-in zoom-in-95 duration-500">
            
            <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-12 border-b border-slate-800 pb-10">
              <div className="flex items-center gap-6">
                <button onClick={() => setActiveReport(null)} className="bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl text-white transition-all flex items-center justify-center shrink-0">
                  <ArrowLeft size={24}/>
                </button>
                <div className="min-w-0">
                  <h2 className="text-4xl font-black text-white tracking-tighter mb-2 truncate">{activeReport.name}</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-blue-400 font-black uppercase text-[10px] tracking-widest">{activeReport.role}</span>
                    <div className="bg-blue-600/20 px-3 py-1 rounded-full text-blue-400 text-[9px] font-black uppercase tracking-widest border border-blue-500/30">
                      СООТВЕТСТВИЕ: {calculateFit(activeReport)}%
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex w-full lg:w-auto gap-4">
                  <button onClick={reanalyzeWithBenchmark} disabled={isReanalyzing} className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 disabled:opacity-50">
                    {isReanalyzing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>} ОБНОВИТЬ ИИ-ОТЧЕТ
                  </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
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
                  <div className="text-[11px] font-black text-slate-300 leading-relaxed uppercase whitespace-normal">
                    {activeReport.drivers || "Не определено"}
                  </div>
               </div>
            </div>

            <div className="mb-14">
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-8 flex items-center gap-3">
                <Activity size={20} className="text-blue-500"/> 6 Граней личности (HEXACO)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {Array.isArray(activeReport.hexaco) && activeReport.hexaco.length > 0 ? activeReport.hexaco.map((h: any) => (
                  <div key={h.code} className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 hover:border-blue-500/30 transition-all group">
                    <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                      <span className="text-slate-400 group-hover:text-white transition-colors">{HEXACO_LABELS[h.code] || h.factor}</span>
                      <span className="text-blue-400">{Math.round(h.percentage || 0)}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000 ease-out" style={{ width: `${Math.max(3, h.percentage || 0)}%` }} />
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-950/30">
                     <AlertTriangle className="mx-auto text-slate-700 mb-4" size={48} />
                     <p className="text-slate-600 font-black uppercase text-xs tracking-[0.2em]">Данные HEXACO отсутствуют</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-12">
               <section>
                  <h3 className="text-white font-black mb-8 flex items-center gap-3 text-sm uppercase tracking-[0.3em] border-l-4 border-blue-500 pl-6">Глубокая HR-аналитика</h3>
                  <div className="bg-slate-950 p-10 sm:p-14 rounded-[3rem] border border-slate-800 shadow-inner">
                     {activeReport.aiReport ? (
                       <div className="prose prose-invert max-w-none 
                            prose-h3:text-blue-400 prose-h3:text-2xl prose-h3:font-black prose-h3:mt-12 prose-h3:mb-6 prose-h3:first:mt-0
                            prose-p:text-slate-400 prose-p:text-lg prose-p:leading-[1.8] prose-p:mb-8" 
                            dangerouslySetInnerHTML={{ __html: activeReport.aiReport }} />
                     ) : (
                       <div className="text-center py-20">
                          <p className="text-slate-600 italic mb-6">Анализ еще не сгенерирован.</p>
                       </div>
                     )}
                  </div>
               </section>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center mb-12 pb-8 border-b border-slate-800 gap-6">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-blue-600/20 rounded-2xl text-blue-400 shadow-lg shadow-blue-500/10"><BarChart size={32} /></div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">SmartHire</h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{company}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
            {view !== 'dashboard' && (
                <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-white flex items-center gap-2 text-xs font-black uppercase bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl transition-all">
                  <ArrowLeft size={16}/> ВАКАНСИИ
                </button>
            )}
            <button onClick={onExit} className="text-slate-400 hover:text-red-400 flex items-center gap-2 text-xs font-black uppercase bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl transition-all">
              <LogOut size={16} /> ВЫЙТИ
            </button>
        </div>
      </div>

      {view === 'manage' && (
        <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
           <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                     <CaseIcon size={24} className="text-blue-500"/> {jobs.find(j => j.jobId === activeJobId)?.jobTitle || "Управление вакансией"}
                  </h2>
              </div>
              <button onClick={() => setIsEditingBenchmark(!isEditingBenchmark)} className={`w-full lg:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-xs font-black uppercase border transition-all shadow-xl active:scale-95 ${isEditingBenchmark ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}>
                {isEditingBenchmark ? <ChevronRight className="rotate-90" size={16}/> : <SlidersHorizontal size={16}/>} 
                {isEditingBenchmark ? 'ЗАКРЫТЬ ЭТАЛОН' : 'НАСТРОИТЬ ЭТАЛОН'}
              </button>
           </div>

           {isEditingBenchmark && (
             <div className="bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-8 sm:p-12 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
                   <div>
                      <h3 className="text-white font-black text-lg uppercase tracking-wider flex items-center gap-3 mb-1"><Target size={24} className="text-indigo-400"/> Профиль идеального кандидата</h3>
                      <p className="text-slate-500 text-xs">Установите целевые показатели для расчета Fit Score всех кандидатов.</p>
                   </div>
                   <button onClick={saveBenchmarkToDb} disabled={isSavingBenchmark} className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-3 transition-all shadow-xl shadow-green-900/20 active:scale-95 disabled:opacity-50">
                     {isSavingBenchmark ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} СОХРАНИТЬ ЭТАЛОН В БД
                   </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800 hover:border-indigo-500/20 transition-all">
                    <div className="flex justify-between text-[11px] text-slate-500 font-black uppercase mb-6 tracking-widest">
                       <span>Целевой интеллект (IQ)</span> 
                       <span className="text-indigo-400 text-lg">{benchmark.iq}</span>
                    </div>
                    <input type="range" min="1" max="12" step="1" value={benchmark.iq} onChange={e => setBenchmark({...benchmark, iq: parseInt(e.target.value)})} className="w-full h-2 bg-slate-800 appearance-none accent-indigo-500 cursor-pointer rounded-full" />
                    <div className="flex justify-between mt-3 text-[9px] text-slate-700 font-bold uppercase"><span>Min</span><span>Max (12)</span></div>
                  </div>
                  <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800 hover:border-indigo-500/20 transition-all">
                    <div className="flex justify-between text-[11px] text-slate-500 font-black uppercase mb-6 tracking-widest">
                       <span>Надежность / Честность</span> 
                       <span className="text-indigo-400 text-lg">{benchmark.reliability}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={benchmark.reliability} onChange={e => setBenchmark({...benchmark, reliability: parseInt(e.target.value)})} className="w-full h-2 bg-slate-800 appearance-none accent-indigo-500 cursor-pointer rounded-full" />
                    <div className="flex justify-between mt-3 text-[9px] text-slate-700 font-bold uppercase"><span>0%</span><span>100%</span></div>
                  </div>
                  <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800 hover:border-indigo-500/20 transition-all">
                    <div className="flex justify-between text-[11px] text-slate-500 font-black uppercase mb-6 tracking-widest">
                       <span>Целевой балл кейс-теста</span> 
                       <span className="text-indigo-400 text-lg">{benchmark.sjt}</span>
                    </div>
                    <input type="range" min="0" max="8" step="1" value={benchmark.sjt} onChange={e => setBenchmark({...benchmark, sjt: parseInt(e.target.value)})} className="w-full h-2 bg-slate-800 appearance-none accent-indigo-500 cursor-pointer rounded-full" />
                    <div className="flex justify-between mt-3 text-[9px] text-slate-700 font-bold uppercase"><span>0</span><span>Max (8)</span></div>
                  </div>
                </div>
             </div>
           )}

           <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 sm:p-12 shadow-2xl">
              <div className="flex flex-col sm:flex-row justify-between items-end mb-12 gap-4">
                 <h2 className="text-3xl font-black text-white">Кандидаты <span className="text-blue-500 ml-2 bg-blue-500/10 px-4 py-1 rounded-2xl border border-blue-500/20 text-xl">{jobCandidates.length}</span></h2>
              </div>
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-600 text-[10px] font-black uppercase tracking-[0.25em]">
                      <th className="pb-8 px-6">ФИО Кандидата</th>
                      <th className="pb-8 px-6 text-center">IQ</th>
                      <th className="pb-8 px-6 text-center">Надежность</th>
                      <th className="pb-8 px-6 text-center">Fit Score</th>
                      <th className="pb-8 px-6 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobCandidates.sort((a,b) => calculateFit(b) - calculateFit(a)).map((c, idx) => (
                      <tr key={idx} className="group border-b border-slate-800/50 hover:bg-slate-800/30 transition-all cursor-pointer" onClick={() => setActiveReport(c)}>
                        <td className="py-8 px-6">
                           <div className="text-white font-black text-lg group-hover:text-blue-400 transition-colors">{c.name}</div>
                           <div className="text-slate-500 text-[10px] uppercase font-bold mt-1 tracking-widest">{new Date(c.date).toLocaleDateString()}</div>
                        </td>
                        <td className="py-8 px-6 text-center font-black text-white text-2xl">{c.iq || 0}</td>
                        <td className="py-8 px-6 text-center">
                           <div className={`font-black text-2xl ${c.reliability > 70 ? 'text-green-400' : c.reliability > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                             {c.reliability || 0}%
                           </div>
                        </td>
                        <td className="py-8 px-6 text-center">
                           <div className="inline-block px-5 py-2 rounded-2xl font-black text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                             {calculateFit(c)}%
                           </div>
                        </td>
                        <td className="py-8 px-6 text-right">
                           <button className="p-4 bg-slate-950 text-slate-500 hover:text-white rounded-2xl border border-slate-800 transition-all">
                              <FileText size={20}/>
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {view === 'dashboard' && (
        <div className="space-y-10 animate-in fade-in duration-500">
          <div className="flex justify-between items-end mb-6">
             <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3"><List size={28} className="text-blue-500"/> Доступные вакансии</h2>
             </div>
             <button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all"><Plus size={24}/> СОЗДАТЬ</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {jobs.map(job => (
              <div key={job.jobId} className="group bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 hover:border-blue-500/30 transition-all flex flex-col justify-between h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-all"><CaseIcon size={120} /></div>
                <div>
                  <div className="flex justify-between items-start mb-6">
                     <span className="bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase px-3 py-1 rounded-lg border border-blue-500/20">{job.jobId}</span>
                     {job.hasBenchmark && <CheckCircle className="text-green-500" size={18}/>}
                  </div>
                  <h3 className="text-2xl font-black text-white mb-8 group-hover:text-blue-400 transition-colors">{job.jobTitle}</h3>
                </div>
                <button onClick={() => loadCandidates(job.jobId)} className="w-full bg-slate-950 hover:bg-blue-600 text-slate-400 hover:text-white py-5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-3 transition-all border border-slate-800">
                  КАНДИДАТЫ <ChevronRight size={16}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HrBuilder;
