
import React, { useState, useEffect } from 'react';
import { generateCustomQuestions, generateCandidateProfile } from '../services/geminiService';
import { CustomTestConfig, JobListing, BenchmarkData } from '../types';
import { Loader2, Save, Wand2, Copy, ArrowLeft, CheckCircle, List, Plus, BarChart, ChevronRight, LogOut, FileText, Eye, AlertCircle, TrendingUp, Settings, UserCheck, MessageSquare, Info, Target, Zap, RefreshCw, SlidersHorizontal } from 'lucide-react';

interface HrBuilderProps {
  scriptUrl: string;
  company: string;
  onExit: () => void;
  onTestPreview: (config: CustomTestConfig) => void;
}

const DEFAULT_BENCHMARK: BenchmarkData = {
  iq: 7,
  reliability: 50,
  sjt: 4,
  hexaco: { 'H': 60, 'E': 40, 'X': 60, 'A': 60, 'C': 70, 'O': 50 }
};

const baseUrl = window.location.origin + window.location.pathname;

const HrBuilder: React.FC<HrBuilderProps> = ({ scriptUrl, company, onExit, onTestPreview }) => {
  const [view, setView] = useState<'dashboard' | 'create' | 'manage'>('dashboard');
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [jobCandidates, setJobCandidates] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [showExtended, setShowExtended] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  
  const [role, setRole] = useState('');
  const [challenges, setChallenges] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<CustomTestConfig | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkData>(DEFAULT_BENCHMARK);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLink, setSavedLink] = useState('');
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);

  // Для редактирования эталона в существующей вакансии
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isEditingBenchmark, setIsEditingBenchmark] = useState(false);

  useEffect(() => {
    if (view === 'dashboard') loadJobs();
  }, [view]);

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
    setCurrentJobId(jobId);
    setIsLoadingJobs(true);
    try {
      const resp = await fetch(`${scriptUrl}?action=GET_CANDIDATES&jobId=${jobId}`);
      const data = await resp.json();
      const currentJob = jobs.find(j => j.jobId === jobId);
      if (currentJob?.benchmark) setBenchmark(currentJob.benchmark);
      setJobCandidates(Array.isArray(data) ? data.map(c => ({ ...c, jobBenchmark: currentJob?.benchmark })) : []);
    } catch (e) { console.error(e); }
    finally { setIsLoadingJobs(false); }
  };

  const handleGenerate = async () => {
    setIsGenerating(true); setGeneratedConfig(null);
    try {
      const config = await generateCustomQuestions(role, challenges);
      if (config) setGeneratedConfig({ ...config, jobTitle: role, jobId: '', company: company }); 
    } catch (e) { alert("Ошибка генерации"); }
    finally { setIsGenerating(false); }
  };

  const handleSave = async () => {
    if (!generatedConfig) return;
    setIsSaving(true);
    const finalConfig = { ...generatedConfig, benchmark, company };
    try {
      const resp = await fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ action: "SAVE_CONFIG", jobTitle: role, config: finalConfig, company }) });
      const data = await resp.json();
      if (data.status === 'success') { setSavedLink(`${baseUrl}?jobId=${data.jobId}`); loadJobs(); }
    } catch (e) { alert("Ошибка сохранения"); }
    finally { setIsSaving(false); }
  };

  const reanalyzeWithBenchmark = async () => {
    if (!activeReport) return;
    setIsReanalyzing(true);
    try {
      const mockResults = [
        { sectionId: 'intelligence', title: 'IQ', percentage: (activeReport.iq/12)*100, rawScore: activeReport.iq },
        { sectionId: 'conscientiousness', title: 'Надежность', percentage: activeReport.reliability, rawScore: activeReport.reliability },
        { sectionId: 'sjt', title: 'Кейс-тест', percentage: (activeReport.sjtScore/8)*100, rawScore: activeReport.sjtScore },
        { sectionId: 'work_sample', title: 'Практика', percentage: 100, textAnswer: activeReport.workAnswer }
      ] as any;
      
      const newReport = await generateCandidateProfile(mockResults, { name: activeReport.name, role: activeReport.role } as any, activeReport.jobBenchmark);
      setActiveReport({ ...activeReport, aiReport: newReport });
    } catch (e) { alert("Ошибка анализа"); }
    finally { setIsReanalyzing(false); }
  };

  const calculateFit = (report: any) => {
    if (!report.jobBenchmark) return null;
    const b = report.jobBenchmark;
    const iqScore = 1 - Math.abs(report.iq - b.iq) / 12;
    const relScore = 1 - Math.abs(report.reliability - b.reliability) / 100;
    const sjtScore = 1 - Math.abs((report.sjtScore || 0) - b.sjt) / 8;
    return Math.round(((iqScore + relScore + sjtScore) / 3) * 100);
  };

  const copyToClipboard = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setLastCopiedId(id);
    setTimeout(() => setLastCopiedId(null), 2000);
  };

  // Компонент слайдеров для эталона
  const BenchmarkEditor = ({ data, onChange }: { data: BenchmarkData, onChange: (d: BenchmarkData) => void }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <label className="text-[10px] text-slate-500 font-black uppercase mb-4 block flex justify-between">
          <span>Целевой IQ</span>
          <span className="text-blue-400">{data.iq} / 12</span>
        </label>
        <input type="range" min="1" max="12" value={data.iq} onChange={e => onChange({...data, iq: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
      </div>
      <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <label className="text-[10px] text-slate-500 font-black uppercase mb-4 block flex justify-between">
          <span>Целевая Надежность</span>
          <span className="text-blue-400">{data.reliability}%</span>
        </label>
        <input type="range" min="0" max="100" value={data.reliability} onChange={e => onChange({...data, reliability: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
      </div>
      <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <label className="text-[10px] text-slate-500 font-black uppercase mb-4 block flex justify-between">
          <span>Целевой SJT</span>
          <span className="text-blue-400">{data.sjt} / 8</span>
        </label>
        <input type="range" min="0" max="8" value={data.sjt} onChange={e => onChange({...data, sjt: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto bg-slate-950 min-h-screen p-6 text-slate-100">
      {/* ОТЧЕТ (МОДАЛКА) */}
      {activeReport && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/95 backdrop-blur-xl p-4 sm:p-10 lg:p-20 overflow-y-auto custom-scrollbar">
           <div className="max-w-5xl mx-auto bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 lg:p-12 shadow-3xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-start mb-12 border-b border-slate-800 pb-10">
                 <div>
                   <div className="flex items-center gap-3 mb-2">
                     <h2 className="text-4xl font-black text-white">{activeReport.name}</h2>
                     {activeReport.jobBenchmark && (
                       <div className="bg-blue-600/20 border border-blue-500/30 px-4 py-1 rounded-full text-blue-400 text-[10px] font-black tracking-widest uppercase flex items-center gap-2">
                         <Target size={12}/> FIT MATCH: {calculateFit(activeReport)}%
                       </div>
                     )}
                   </div>
                   <p className="text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                     <TrendingUp size={14} className="text-blue-500"/> {activeReport.role}
                   </p>
                 </div>
                 <button onClick={() => { setActiveReport(null); setShowExtended(false); }} className="bg-slate-800 hover:bg-slate-700 px-8 py-3 rounded-2xl text-white font-black transition-all active:scale-95 shadow-xl">ЗАКРЫТЬ</button>
              </div>

              {/* GAP ANALYSIS */}
              {activeReport.jobBenchmark && (
                <div className="mb-12 bg-blue-600/5 border border-blue-500/10 rounded-[2rem] p-8">
                   <h3 className="text-blue-400 font-black text-xs uppercase tracking-widest mb-8 flex items-center gap-2">
                     <Zap size={16}/> Анализ разрывов (Gap Analysis)
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                      {[
                        { label: 'Интеллект', current: activeReport.iq, target: activeReport.jobBenchmark.iq, max: 12 },
                        { label: 'Надежность', current: activeReport.reliability, target: activeReport.jobBenchmark.reliability, max: 100 },
                        { label: 'Кейс-тест', current: activeReport.sjtScore || 0, target: activeReport.jobBenchmark.sjt, max: 8 },
                      ].map(m => {
                        const diff = m.current - m.target;
                        return (
                          <div key={m.label}>
                             <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                                <span className="text-slate-500">{m.label}</span>
                                <span className={diff >= 0 ? 'text-green-400' : 'text-red-400'}>
                                  {diff > 0 ? `+${diff}` : diff} {diff === 0 ? 'Match' : ''}
                                </span>
                             </div>
                             <div className="h-3 bg-slate-950 rounded-full relative overflow-hidden border border-slate-800">
                                <div className={`h-full absolute left-0 transition-all duration-1000 ${m.current >= m.target ? 'bg-blue-500' : 'bg-red-500/50'}`} style={{ width: `${(m.current/m.max)*100}%` }} />
                                <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_white] z-10" style={{ left: `${(m.target/m.max)*100}%` }} />
                             </div>
                          </div>
                        );
                      })}
                   </div>
                </div>
              )}

              {/* AI REPORT */}
              <div className="space-y-10">
                 <section>
                    <h3 className="text-white font-black mb-6 flex items-center gap-3 text-sm uppercase tracking-[0.2em] border-l-4 border-indigo-500 pl-4">
                      Комплексный анализ системы
                    </h3>
                    <div className="bg-slate-950 p-10 rounded-[2.5rem] border border-slate-800 shadow-inner relative overflow-hidden">
                       <div className="prose prose-invert max-w-none 
                            prose-h3:text-blue-400 prose-h3:text-2xl prose-h3:font-black prose-h3:mt-12 prose-h3:mb-6 prose-h3:uppercase prose-h3:tracking-widest first:prose-h3:mt-0
                            prose-b:text-white prose-b:font-bold
                            prose-p:text-slate-400 prose-p:text-lg prose-p:leading-[1.8] prose-p:mb-10" 
                            style={{ color: '#94a3b8' }} 
                            dangerouslySetInnerHTML={{ __html: activeReport.aiReport }} />
                       
                       {activeReport.jobBenchmark && (
                         <div className="mt-12 pt-8 border-t border-slate-800 flex justify-center">
                            <button onClick={reanalyzeWithBenchmark} disabled={isReanalyzing} className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
                              {isReanalyzing ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>} 
                              Пересчитать отчет по эталону
                            </button>
                         </div>
                       )}
                    </div>
                 </section>
              </div>

              <div className="mt-12 pt-10 border-t border-slate-800 text-center">
                 <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-8 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-widest">Печать отчета</button>
              </div>
           </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30"><BarChart className="text-blue-400" size={32} /></div>
          <div><h1 className="text-3xl font-black text-white tracking-tight">HR-КАБИНЕТ</h1><p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{company}</p></div>
        </div>
        <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-sm font-bold"><LogOut size={18} /> ВЫЙТИ</button>
      </div>

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-end">
             <h2 className="text-xl font-bold flex items-center gap-2"><List size={20} className="text-blue-400"/> Активные вакансии</h2>
             <button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl shadow-blue-900/20 transition-all active:scale-95"><Plus size={20}/> Создать вакансию</button>
          </div>
          {isLoadingJobs ? <div className="text-center py-20 animate-pulse text-slate-500 uppercase font-black tracking-widest">Загрузка данных...</div> : jobs.length === 0 ? <div className="bg-slate-900 p-20 rounded-3xl text-center text-slate-500 border border-slate-800">Список вакансий пуст.</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map(job => (
                <div key={job.jobId} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 group hover:border-blue-500/30 transition-all shadow-xl">
                  <h3 className="text-xl font-black text-white mb-4">{job.jobTitle}</h3>
                  <div className="flex gap-2 mb-8">
                     <span className="bg-slate-800 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-500 uppercase">{new Date(job.dateCreated).toLocaleDateString()}</span>
                     {job.hasBenchmark && <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">Эталон задан</span>}
                  </div>
                  <div className="space-y-3">
                    <button onClick={() => loadCandidates(job.jobId)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all">ПЕРЕЙТИ К КАНДИДАТАМ <ChevronRight size={14}/></button>
                    <button onClick={() => copyToClipboard(`${baseUrl}?jobId=${job.jobId}`, job.jobId)} className={`w-full py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${lastCopiedId === job.jobId ? 'bg-green-600/10 text-green-400 border border-green-500/20' : 'bg-slate-950 text-slate-500 hover:text-white border border-slate-800'}`}>{lastCopiedId === job.jobId ? 'ССЫЛКА СКОПИРОВАНА' : 'СКОПИРОВАТЬ ССЫЛКУ'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MANAGE (CANDIDATES & BENCHMARK) */}
      {view === 'manage' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <div className="flex justify-between items-center">
              <button onClick={() => setView('dashboard')} className="text-slate-500 hover:text-white flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all"><ArrowLeft size={16}/> Назад к списку</button>
              <button 
                onClick={() => setIsEditingBenchmark(!isEditingBenchmark)}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${isEditingBenchmark ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
              >
                <SlidersHorizontal size={14}/> {isEditingBenchmark ? 'Закрыть настройку' : 'Настроить эталон'}
              </button>
           </div>

           {isEditingBenchmark && (
             <div className="bg-slate-900 border border-blue-500/20 rounded-[2rem] p-8 animate-in zoom-in-95 duration-300">
                <h3 className="text-white font-black text-sm uppercase tracking-widest mb-8 flex items-center gap-2">
                  <Target size={18} className="text-blue-500"/> Идеальный профиль для этой вакансии
                </h3>
                <BenchmarkEditor data={benchmark} onChange={setBenchmark} />
                <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
                   <p className="text-[10px] text-slate-500 font-bold uppercase italic mr-auto mt-2">* Изменения влияют на расчет Fit Match и AI-отчеты всех кандидатов этой вакансии.</p>
                   <button onClick={() => setIsEditingBenchmark(false)} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all">СОХРАНИТЬ ЭТАЛОН</button>
                </div>
             </div>
           )}

           <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl">
              <h2 className="text-2xl font-black text-white mb-10 flex items-center gap-4">
                Кандидаты <span className="text-slate-700">/</span> <span className="text-blue-500">{jobCandidates.length}</span>
              </h2>
              {jobCandidates.length === 0 ? <div className="text-center py-20 text-slate-600 font-bold uppercase tracking-widest border-2 border-dashed border-slate-800 rounded-3xl">Ожидаем первых откликов...</div> : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                          <th className="pb-6 px-4">Кандидат</th>
                          <th className="pb-6 px-4 text-center">IQ</th>
                          <th className="pb-6 px-4 text-center">Надежность</th>
                          <th className="pb-6 px-4 text-center">Fit Match</th>
                          <th className="pb-6 px-4 text-right">Отчет</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobCandidates.map((c, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-all group">
                            <td className="py-6 px-4">
                               <div className="text-white font-black text-lg group-hover:text-blue-400 transition-colors">{c.name}</div>
                               <div className="text-slate-600 text-[10px] font-bold uppercase mt-1 tracking-widest">{new Date(c.date).toLocaleDateString()}</div>
                            </td>
                            <td className="py-6 px-4 text-center">
                               <div className="font-black text-white text-xl">{c.iq}</div>
                               <div className="text-[8px] text-slate-700 uppercase font-black">из 12</div>
                            </td>
                            <td className="py-6 px-4 text-center">
                               <div className={`font-black text-xl ${c.reliability >= 70 ? 'text-green-400' : 'text-blue-400'}`}>{c.reliability}%</div>
                            </td>
                            <td className="py-6 px-4 text-center">
                               <div className={`inline-block px-4 py-1.5 rounded-full font-black text-sm tracking-tighter ${calculateFit(c) && calculateFit(c)! >= 75 ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                 {calculateFit(c) ? `${calculateFit(c)}%` : '—'}
                               </div>
                            </td>
                            <td className="py-6 px-4 text-right">
                               <button onClick={() => setActiveReport(c)} className="p-4 bg-slate-950 hover:bg-blue-600 text-slate-400 hover:text-white rounded-2xl transition-all shadow-xl border border-slate-800"><FileText size={24}/></button>
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

      {/* CREATE VIEW */}
      {view === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
           <div className="lg:col-span-4 space-y-6">
            <button onClick={() => setView('dashboard')} className="text-slate-500 hover:text-white flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-4 transition-all"><ArrowLeft size={16}/> Отмена</button>
            <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-2xl">
              <h2 className="text-2xl font-black mb-8 text-white">Новая вакансия</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-3 tracking-widest">Должность</label>
                  <input value={role} onChange={e => setRole(e.target.value)} placeholder="Напр: Тимлид отдела продаж" className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 focus:border-blue-500 outline-none text-white font-bold transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-3 tracking-widest">Задачи и боли бизнеса</label>
                  <textarea value={challenges} onChange={e => setChallenges(e.target.value)} placeholder="Опишите, какие проблемы должен решить кандидат..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 h-48 focus:border-blue-500 outline-none text-sm text-slate-400 resize-none transition-all leading-relaxed" />
                </div>
                <button onClick={handleGenerate} disabled={isGenerating || !role} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-900/20 active:scale-95 disabled:opacity-50">
                  {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={24} />} 
                  СФОРМИРОВАТЬ ТЕСТ
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
             {/* НАСТРОЙКА ЭТАЛОНА ПРИ СОЗДАНИИ */}
             <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-slate-800 shadow-2xl">
                <div className="flex items-center gap-3 mb-10">
                   <div className="p-3 bg-blue-600/20 rounded-2xl text-blue-400"><Target size={28}/></div>
                   <div>
                      <h2 className="text-2xl font-black text-white">Целевой профиль</h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Определите параметры идеального кандидата</p>
                   </div>
                </div>
                <BenchmarkEditor data={benchmark} onChange={setBenchmark} />
                
                <div className="mt-12 pt-10 border-t border-slate-800">
                  <h3 className="text-xl font-black mb-6 text-white flex items-center gap-3"><Settings size={20} className="text-blue-500"/> Структура теста</h3>
                  {!generatedConfig ? (
                    <div className="py-20 text-center text-slate-700 font-black uppercase tracking-[0.3em] animate-pulse border-2 border-dashed border-slate-800 rounded-[2rem]">Ожидание ввода данных...</div>
                  ) : (
                    <div className="space-y-10 animate-in fade-in duration-500">
                      <div className="space-y-4">
                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Ситуационные кейсы (SJT):</div>
                        {generatedConfig.sjtQuestions.map((q, i) => (
                          <div key={i} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-sm text-slate-400 italic flex gap-4">
                            <span className="text-blue-500 font-black">0{i+1}</span> {q.text}
                          </div>
                        ))}
                      </div>
                      <div className="mt-12 pt-8">
                        {!savedLink ? (
                          <button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-6 rounded-[2rem] flex items-center justify-center gap-3 transition-all shadow-2xl shadow-green-900/20 active:scale-95">
                            {isSaving ? <Loader2 className="animate-spin" /> : <Save size={28} />} 
                            ОПУБЛИКОВАТЬ ВАКАНСИЮ И ЭТАЛОН
                          </button>
                        ) : (
                          <div className="bg-blue-600/10 border border-blue-500/30 p-10 rounded-[2.5rem] text-center animate-in zoom-in-95 duration-500">
                            <div className="inline-flex p-4 bg-green-500/20 rounded-full text-green-400 mb-6"><CheckCircle size={32}/></div>
                            <h3 className="text-2xl font-black text-white mb-2">ВАКАНСИЯ ОПУБЛИКОВАНА!</h3>
                            <p className="text-slate-500 mb-8 font-bold">Отправьте эту ссылку кандидатам для прохождения теста.</p>
                            <div className="flex gap-3 mb-8">
                               <input readOnly value={savedLink} className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-xs font-mono text-blue-400 outline-none" />
                               <button onClick={() => copyToClipboard(savedLink, 'new')} className="bg-slate-800 p-4 rounded-xl hover:bg-slate-700 transition-all text-white"><Copy size={24}/></button>
                            </div>
                            <button onClick={() => setView('dashboard')} className="w-full bg-slate-800 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-700 transition-all">ВЕРНУТЬСЯ В КАБИНЕТ</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrBuilder;
