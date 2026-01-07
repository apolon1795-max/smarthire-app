import React, { useState, useEffect } from 'react';
import { generateCustomQuestions, generateCandidateProfile } from '../services/geminiService';
import { CustomTestConfig, JobListing, BenchmarkData } from '../types';
// Added RefreshCw to imports
import { Loader2, Save, Wand2, Copy, ArrowLeft, CheckCircle, List, Plus, BarChart, ChevronRight, LogOut, FileText, Eye, AlertCircle, TrendingUp, Settings, UserCheck, MessageSquare, Info, Target, Zap, RefreshCw } from 'lucide-react';

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

// Defined baseUrl for job links
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
    setIsLoadingJobs(true);
    try {
      const resp = await fetch(`${scriptUrl}?action=GET_CANDIDATES&jobId=${jobId}`);
      const data = await resp.json();
      // Находим текущую вакансию, чтобы взять её бенчмарк
      const currentJob = jobs.find(j => j.jobId === jobId);
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
      // Имитируем сбор результатов для генерации (в реальности нужно прокидывать все TestResult)
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

  const copyToClipboard = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setLastCopiedId(id);
    setTimeout(() => setLastCopiedId(null), 2000);
  };

  const calculateFit = (report: any) => {
    if (!report.jobBenchmark) return null;
    const b = report.jobBenchmark;
    const iqScore = 1 - Math.abs(report.iq - b.iq) / 12;
    const relScore = 1 - Math.abs(report.reliability - b.reliability) / 100;
    const sjtScore = 1 - Math.abs(report.sjtScore - b.sjt) / 8;
    return Math.round(((iqScore + relScore + sjtScore) / 3) * 100);
  };

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
                         <Target size={12}/> FIT: {calculateFit(activeReport)}%
                       </div>
                     )}
                   </div>
                   <p className="text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                     <TrendingUp size={14} className="text-blue-500"/> {activeReport.role}
                   </p>
                 </div>
                 <button onClick={() => { setActiveReport(null); setShowExtended(false); }} className="bg-slate-800 hover:bg-slate-700 px-8 py-3 rounded-2xl text-white font-black transition-all active:scale-95 shadow-xl">ЗАКРЫТЬ</button>
              </div>

              {/* БЛОК СРАВНЕНИЯ (GAP ANALYSIS) */}
              {activeReport.jobBenchmark && (
                <div className="mb-12 bg-blue-600/5 border border-blue-500/10 rounded-[2rem] p-8">
                   <h3 className="text-blue-400 font-black text-xs uppercase tracking-widest mb-8 flex items-center gap-2">
                     <Zap size={16}/> Анализ соответствия эталону (Gap Analysis)
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                      {[
                        { label: 'Интеллект', current: activeReport.iq, target: activeReport.jobBenchmark.iq, max: 12 },
                        { label: 'Надежность', current: activeReport.reliability, target: activeReport.jobBenchmark.reliability, max: 100 },
                        { label: 'Кейс-тест', current: activeReport.sjtScore, target: activeReport.jobBenchmark.sjt, max: 8 },
                      ].map(m => {
                        const diff = m.current - m.target;
                        return (
                          <div key={m.label}>
                             <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                                <span className="text-slate-500">{m.label}</span>
                                <span className={diff >= 0 ? 'text-green-400' : 'text-red-400'}>
                                  {diff > 0 ? '+' : ''}{diff} {diff === 0 ? 'Match' : ''}
                                </span>
                             </div>
                             <div className="h-4 bg-slate-950 rounded-full relative overflow-hidden border border-slate-800">
                                {/* Текущее значение кандидата */}
                                <div className={`h-full absolute left-0 transition-all duration-1000 ${m.current >= m.target ? 'bg-blue-500' : 'bg-red-500/50'}`} style={{ width: `${(m.current/m.max)*100}%` }} />
                                {/* Отметка эталона */}
                                <div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white] z-10" style={{ left: `${(m.target/m.max)*100}%` }} />
                             </div>
                             <div className="flex justify-between mt-2 text-[8px] font-bold uppercase text-slate-700">
                                <span>Текущий: {m.current}</span>
                                <span>Цель: {m.target}</span>
                             </div>
                          </div>
                        );
                      })}
                   </div>
                   {isReanalyzing ? (
                     <div className="mt-8 text-center text-xs text-blue-400 animate-pulse font-bold uppercase">Обновление анализа ИИ...</div>
                   ) : (
                     <button onClick={reanalyzeWithBenchmark} className="mt-8 text-[10px] font-black text-blue-500 uppercase hover:text-blue-400 flex items-center gap-2">
                       <RefreshCw size={12}/> Пересчитать ИИ-анализ с учетом эталона
                     </button>
                   )}
                </div>
              )}

              {/* МЕТРИКИ И АНАЛИЗ (КАК БЫЛО) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                 <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Интеллект</div>
                      <div className="text-3xl font-black text-white">{activeReport.iq} <span className="text-slate-700 text-lg">/ 12</span></div>
                    </div>
                 </div>
                 <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Надежность</div>
                      <div className="text-3xl font-black text-white">{activeReport.reliability}%</div>
                    </div>
                 </div>
                 <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Кейс-тест</div>
                      <div className="text-3xl font-black text-purple-400">{activeReport.sjtScore || 0}</div>
                    </div>
                 </div>
                 <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Топ Драйверы</div>
                      <div className="text-xs font-bold text-white line-clamp-2 leading-relaxed">{activeReport.drivers || "Не определено"}</div>
                    </div>
                 </div>
              </div>

              <div className="space-y-10">
                 <section>
                    <h3 className="text-white font-black mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.2em] border-l-4 border-indigo-500 pl-4">
                      Комплексный анализ системы
                    </h3>
                    <div className="bg-slate-950 p-10 rounded-[2rem] border border-slate-800 shadow-inner relative overflow-hidden">
                       <div className="prose prose-invert max-w-none prose-h3:text-blue-400 prose-h3:text-xl prose-h3:font-black prose-h3:mt-10 prose-h3:mb-4 prose-h3:uppercase prose-h3:tracking-widest prose-b:text-white prose-p:text-slate-400 prose-p:leading-relaxed prose-p:mb-8" 
                            style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.75' }} 
                            dangerouslySetInnerHTML={{ __html: activeReport.aiReport }} />
                    </div>
                 </section>
              </div>

              <div className="mt-12 pt-10 border-t border-slate-800 text-center">
                 <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-8 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-widest">Распечатать PDF</button>
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
        <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-sm font-bold"><LogOut size={18} className="rotate-180" /> ВЫЙТИ</button>
      </div>

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-end">
             <h2 className="text-xl font-bold flex items-center gap-2"><List size={20} className="text-blue-400"/> Ваши Вакансии</h2>
             <button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"><Plus size={20}/> Создать новую</button>
          </div>
          {isLoadingJobs ? <div className="text-center py-20 animate-pulse text-slate-500">Загрузка...</div> : jobs.length === 0 ? <div className="bg-slate-900 p-20 rounded-3xl text-center text-slate-500">Список пуст.</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map(job => (
                <div key={job.jobId} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 group">
                  <h3 className="text-lg font-bold text-white mb-2">{job.jobTitle}</h3>
                  <div className="text-slate-500 text-[10px] mb-6 uppercase tracking-widest">{new Date(job.dateCreated).toLocaleDateString()}</div>
                  <div className="space-y-3">
                    <button onClick={() => copyToClipboard(`${baseUrl}?jobId=${job.jobId}`, job.jobId)} className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${lastCopiedId === job.jobId ? 'bg-green-600/20 text-green-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{lastCopiedId === job.jobId ? 'ССЫЛКА СКОПИРОВАНА' : 'СКОПИРОВАТЬ ССЫЛКУ'}</button>
                    <button onClick={() => loadCandidates(job.jobId)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">Кандидаты <ChevronRight size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MANAGE (CANDIDATES LIST) */}
      {view === 'manage' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
           <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold uppercase"><ArrowLeft size={16}/> Назад к списку</button>
           <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-white mb-8 uppercase tracking-widest">Кандидаты</h2>
              {jobCandidates.length === 0 ? <div className="text-center py-20 text-slate-500">Пока никто не прошел тест.</div> : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                          <th className="pb-4 px-4">ФИО / Роль</th>
                          <th className="pb-4 px-4 text-center">IQ</th>
                          <th className="pb-4 px-4 text-center">Fit %</th>
                          <th className="pb-4 px-4 text-right">Детали</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobCandidates.map((c, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 px-4">
                               <div className="text-white font-bold">{c.name}</div>
                               <div className="text-slate-500 text-[10px]">{c.role}</div>
                            </td>
                            <td className="py-4 px-4 text-center">
                               <div className="font-black text-white">{c.iq}</div>
                            </td>
                            <td className="py-4 px-4 text-center">
                               <div className={`font-black ${calculateFit(c) && calculateFit(c)! >= 70 ? 'text-green-400' : 'text-blue-400'}`}>
                                 {calculateFit(c) ? `${calculateFit(c)}%` : '—'}
                               </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                               <button onClick={() => setActiveReport(c)} className="p-3 bg-slate-800 hover:bg-blue-600 text-white rounded-xl transition-all shadow-lg active:scale-90"><FileText size={20}/></button>
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

      {/* CREATE VIEW (С НАСТРОЙКОЙ ЭТАЛОНА) */}
      {view === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-left-4 duration-500">
           <div className="lg:col-span-4 space-y-6">
            <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold uppercase mb-2"><ArrowLeft size={16}/> Отмена</button>
            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-bold mb-6 text-white">Новая Вакансия</h2>
              <div className="space-y-6">
                <div><label className="text-xs font-black text-slate-500 uppercase block mb-2">Должность</label><input value={role} onChange={e => setRole(e.target.value)} placeholder="Напр: Официант" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 focus:border-blue-500 outline-none text-white transition-all" /></div>
                <div><label className="text-xs font-black text-slate-500 uppercase block mb-2">Проблемы в отделе / Задачи</label><textarea value={challenges} onChange={e => setChallenges(e.target.value)} placeholder="Опишите боли бизнеса..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 h-40 focus:border-blue-500 outline-none text-sm text-slate-300 resize-none transition-all" /></div>
                <button onClick={handleGenerate} disabled={isGenerating || !role} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 active:scale-95">{isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={24} />} СФОРМИРОВАТЬ ТЕСТ</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-8">
             <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 h-full shadow-2xl overflow-hidden relative">
              <h2 className="text-xl font-bold mb-8 text-white flex items-center gap-3"><Target size={20} className="text-blue-500"/> Настройка эталона (Target Profile)</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
                 <div className="space-y-6">
                    <div>
                      <label className="text-[10px] text-slate-500 font-black uppercase mb-2 block">Целевой IQ (1-12): {benchmark.iq}</label>
                      <input type="range" min="1" max="12" value={benchmark.iq} onChange={e => setBenchmark({...benchmark, iq: parseInt(e.target.value)})} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-black uppercase mb-2 block">Целевая Надежность (%): {benchmark.reliability}</label>
                      <input type="range" min="0" max="100" value={benchmark.reliability} onChange={e => setBenchmark({...benchmark, reliability: parseInt(e.target.value)})} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div>
                      <label className="text-[10px] text-slate-500 font-black uppercase mb-2 block">Целевой балл SJT (0-8): {benchmark.sjt}</label>
                      <input type="range" min="0" max="8" value={benchmark.sjt} onChange={e => setBenchmark({...benchmark, sjt: parseInt(e.target.value)})} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </div>
                 </div>
              </div>

              <div className="mt-12 pt-8 border-t border-slate-800">
                {!generatedConfig ? (
                  <div className="py-20 text-center text-slate-700 font-bold uppercase tracking-[0.2em] animate-pulse">Ожидание формирования теста...</div>
                ) : (
                  <div>
                    {!savedLink ? (
                      <button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-green-900/20 active:scale-95">{isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />} ОПУБЛИКОВАТЬ ВАКАНСИЮ</button>
                    ) : (
                      <div className="bg-blue-600/10 border border-blue-500/30 p-8 rounded-3xl text-center">
                        <h3 className="text-blue-400 font-bold mb-4 flex items-center justify-center gap-2"><CheckCircle size={20}/> ОПУБЛИКОВАНА С ЭТАЛОНОМ!</h3>
                        <div className="flex gap-3 mb-8"><input readOnly value={savedLink} className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-blue-300 outline-none" /><button onClick={() => copyToClipboard(savedLink, 'new')} className="bg-slate-800 p-3 rounded-xl hover:bg-slate-700 transition-colors"><Copy size={20}/></button></div>
                        <button onClick={() => setView('dashboard')} className="w-full bg-slate-800 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-700 transition-all">К СПИСКУ ВАКАНСИЙ</button>
                      </div>
                    )}
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
