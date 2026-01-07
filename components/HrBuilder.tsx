
import React, { useState, useEffect } from 'react';
import { generateCustomQuestions, generateCandidateProfile } from '../services/geminiService';
import { CustomTestConfig, JobListing, BenchmarkData } from '../types';
// Added AlertTriangle to imports
import { Loader2, Save, Wand2, Copy, ArrowLeft, CheckCircle, List, Plus, BarChart, ChevronRight, LogOut, FileText, Target, Zap, RefreshCw, SlidersHorizontal, User, ShieldCheck, Activity, Check, AlertTriangle } from 'lucide-react';

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

  const [role, setRole] = useState('');
  const [challenges, setChallenges] = useState('');

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
      const configResp = await fetch(`${scriptUrl}?action=GET_JOB_CONFIG&jobId=${jobId}`);
      const configData = await configResp.json();
      const currentBenchmark = configData.benchmark || DEFAULT_BENCHMARK;
      setBenchmark(currentBenchmark);

      const resp = await fetch(`${scriptUrl}?action=GET_CANDIDATES&jobId=${jobId}`);
      const data = await resp.json();
      
      const parsedCandidates = Array.isArray(data) ? data.map(c => {
        let hexaco = [];
        try {
          // Важно: проверяем не пустой ли JSON
          const hStr = (c.hexacoJson && c.hexacoJson !== '{}') ? c.hexacoJson : '[]';
          hexaco = typeof hStr === 'string' ? JSON.parse(hStr) : hStr;
          if (!Array.isArray(hexaco)) hexaco = [];
        } catch(e) { hexaco = []; }
        
        return { 
          ...c, 
          jobBenchmark: currentBenchmark,
          hexaco
        };
      }) : [];

      setJobCandidates(parsedCandidates);
    } catch (e) { setJobCandidates([]); }
    finally { setIsLoadingJobs(false); }
  };

  const saveBenchmarkToDb = async () => {
    setIsSavingBenchmark(true);
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'UPDATE_BENCHMARK', jobId: activeJobId, benchmark })
      });
      // Обновляем текущих кандидатов на лету
      setJobCandidates(prev => prev.map(c => ({ ...c, jobBenchmark: benchmark })));
      setIsEditingBenchmark(false);
    } catch (e) { alert("Не удалось сохранить эталон."); }
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
      const newReport = await generateCandidateProfile(mockResults, { name: activeReport.name, role: activeReport.role } as any, benchmark);
      setActiveReport({ ...activeReport, aiReport: newReport });
    } catch (e) { 
      console.error(e);
      alert("Ошибка ИИ. Проверьте соединение или API_KEY."); 
    }
    finally { setIsReanalyzing(false); }
  };

  const HEXACO_LABELS: Record<string, string> = {
    'H': 'Честность', 'E': 'Эмоциональность', 'X': 'Экстраверсия', 'A': 'Доброжелательность', 'C': 'Добросовестность', 'O': 'Открытость'
  };

  return (
    <div className="max-w-7xl mx-auto bg-slate-950 min-h-screen p-6 text-slate-100">
      {/* МОДАЛКА ОТЧЕТА */}
      {activeReport && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/98 backdrop-blur-2xl p-4 sm:p-10 overflow-y-auto custom-scrollbar">
          <div className="max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-[3rem] p-8 lg:p-14 shadow-3xl animate-in zoom-in-95 duration-500">
            
            {/* ИСПРАВЛЕННЫЙ ЗАГОЛОВОК МОДАЛКИ (Без перекрытий) */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-12 border-b border-slate-800 pb-10">
              <div className="flex items-center gap-6">
                <button onClick={() => setActiveReport(null)} className="bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl text-white transition-all flex items-center justify-center">
                  <ArrowLeft size={24}/>
                </button>
                <div>
                  <h2 className="text-4xl font-black text-white tracking-tighter mb-1">{activeReport.name}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-blue-400 font-black uppercase text-[10px] tracking-widest">{activeReport.role}</span>
                    <div className="bg-blue-600/20 px-3 py-1 rounded-full text-blue-400 text-[9px] font-black uppercase tracking-widest border border-blue-500/30">
                      СООТВЕТСТВИЕ: {calculateFit(activeReport)}%
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={reanalyzeWithBenchmark} disabled={isReanalyzing} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-3 shadow-xl">
                {isReanalyzing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>} ОБНОВИТЬ ИИ-ОТЧЕТ
              </button>
            </div>

            {/* МЕТРИКИ */}
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

            {/* HEXACO */}
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
                )) : (
                  <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-950/30">
                     <AlertTriangle className="mx-auto text-slate-700 mb-4" size={48} />
                     <p className="text-slate-600 font-black uppercase text-xs tracking-[0.2em]">Данные HEXACO отсутствуют или не загружены</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-12">
               <section>
                  <h3 className="text-white font-black mb-8 flex items-center gap-3 text-sm uppercase tracking-[0.3em] border-l-4 border-blue-500 pl-6">Глубокая HR-аналитика</h3>
                  <div className="bg-slate-950 p-12 rounded-[3rem] border border-slate-800 shadow-2xl">
                     {activeReport.aiReport ? (
                       <div className="prose prose-invert max-w-none prose-h3:text-blue-400 prose-h3:text-2xl prose-h3:font-black prose-h3:mt-12 prose-h3:mb-6 prose-p:text-slate-400 prose-p:text-lg prose-p:leading-[1.8] prose-p:mb-8" 
                            dangerouslySetInnerHTML={{ __html: activeReport.aiReport }} />
                     ) : (
                       <p className="text-slate-600 italic">Нажмите кнопку «Обновить ИИ-отчет» для генерации анализа.</p>
                     )}
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
          <div><h1 className="text-3xl font-black text-white">SmartHire</h1><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{company}</p></div>
        </div>
        <button onClick={onExit} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl"><LogOut size={18} /> ВЫЙТИ</button>
      </div>

      {/* КАНДИДАТЫ И ЭТАЛОН */}
      {view === 'manage' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <button onClick={() => setView('dashboard')} className="text-slate-500 hover:text-white flex items-center gap-2 text-xs font-black uppercase"><ArrowLeft size={16}/> НАЗАД</button>
              <button onClick={() => setIsEditingBenchmark(!isEditingBenchmark)} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase border transition-all ${isEditingBenchmark ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}>
                <SlidersHorizontal size={14}/> {isEditingBenchmark ? 'ЗАКРЫТЬ НАСТРОЙКИ' : 'ИДЕАЛЬНЫЙ КАНДИДАТ'}
              </button>
           </div>

           {isEditingBenchmark && (
             <div className="bg-slate-900 border border-indigo-500/20 rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-10">
                   <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-3"><Target size={20} className="text-indigo-500"/> Профиль вакансии</h3>
                   <button onClick={saveBenchmarkToDb} disabled={isSavingBenchmark} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2 transition-all">
                     {isSavingBenchmark ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} СОХРАНИТЬ ЭТАЛОН
                   </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-4"><span>Целевой IQ</span> <span className="text-blue-400 font-black">{benchmark.iq}</span></div>
                    <input type="range" min="1" max="12" value={benchmark.iq} onChange={e => setBenchmark({...benchmark, iq: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 appearance-none accent-blue-500 cursor-pointer" />
                  </div>
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-4"><span>Минимальная Надежность</span> <span className="text-blue-400 font-black">{benchmark.reliability}%</span></div>
                    <input type="range" min="0" max="100" value={benchmark.reliability} onChange={e => setBenchmark({...benchmark, reliability: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 appearance-none accent-blue-500 cursor-pointer" />
                  </div>
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase mb-4"><span>Целевой Кейс-балл</span> <span className="text-blue-400 font-black">{benchmark.sjt}</span></div>
                    <input type="range" min="0" max="8" value={benchmark.sjt} onChange={e => setBenchmark({...benchmark, sjt: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 appearance-none accent-blue-500 cursor-pointer" />
                  </div>
                </div>
                <p className="mt-8 text-[10px] text-slate-600 font-bold uppercase text-center italic">Данные будут сохранены в облаке и применятся при расчете процента соответствия.</p>
             </div>
           )}

           <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
              <h2 className="text-3xl font-black text-white mb-12">Список откликов <span className="text-blue-500 ml-2">{jobCandidates.length}</span></h2>
              {jobCandidates.length === 0 ? <div className="text-center py-20 text-slate-600 uppercase font-black">Кандидатов пока нет</div> : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-600 text-[11px] font-black uppercase tracking-[0.2em]">
                          <th className="pb-8 px-6">ФИО</th>
                          <th className="pb-8 px-6 text-center">IQ</th>
                          <th className="pb-8 px-6 text-center">Надежность</th>
                          <th className="pb-8 px-6 text-center">Fit Score</th>
                          <th className="pb-8 px-6 text-right">Отчет</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobCandidates.map((c, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all cursor-pointer" onClick={() => setActiveReport(c)}>
                            <td className="py-8 px-6 text-white font-black text-lg">{c.name}</td>
                            <td className="py-8 px-6 text-center font-black text-white text-xl">{c.iq || 0}</td>
                            <td className="py-8 px-6 text-center font-black text-blue-400 text-xl">{c.reliability || 0}%</td>
                            <td className="py-8 px-6 text-center">
                               <div className="inline-block px-4 py-1.5 rounded-full font-black text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                 {calculateFit(c)}%
                               </div>
                            </td>
                            <td className="py-8 px-6 text-right">
                               <button className="p-3 bg-slate-950 text-slate-500 hover:text-white rounded-xl border border-slate-800"><FileText size={20}/></button>
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

      {/* СПИСОК ВАКАНСИЙ (Главная) */}
      {view === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-end">
             <h2 className="text-xl font-bold flex items-center gap-2"><List size={20} className="text-blue-400"/> Вакансии</h2>
             <button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-xl"><Plus size={20}/> СОЗДАТЬ</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {jobs.map(job => (
              <div key={job.jobId} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-blue-500/30 transition-all">
                <h3 className="text-xl font-black text-white mb-6">{job.jobTitle}</h3>
                <button onClick={() => loadCandidates(job.jobId)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2">ОТКЛИКИ <ChevronRight size={14}/></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HrBuilder;
