
import React, { useState, useEffect } from 'react';
import { generateCustomQuestions } from '../services/geminiService';
import { CustomTestConfig, JobListing } from '../types';
import { Loader2, Save, Wand2, Copy, ArrowLeft, CheckCircle, List, Plus, BarChart, ChevronRight, LogOut, FileText, Eye, AlertCircle, TrendingUp, Settings, UserCheck, MessageSquare, Info } from 'lucide-react';

interface HrBuilderProps {
  scriptUrl: string;
  company: string;
  onExit: () => void;
  onTestPreview: (config: CustomTestConfig) => void;
}

const HrBuilder: React.FC<HrBuilderProps> = ({ scriptUrl, company, onExit, onTestPreview }) => {
  const [view, setView] = useState<'dashboard' | 'create' | 'manage'>('dashboard');
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [jobCandidates, setJobCandidates] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [showExtended, setShowExtended] = useState(false);
  
  const [role, setRole] = useState('');
  const [challenges, setChallenges] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<CustomTestConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLink, setSavedLink] = useState('');
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);

  const baseUrl = window.location.href.split('?')[0];

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
      setJobCandidates(Array.isArray(data) ? data : []);
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
    try {
      const resp = await fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ action: "SAVE_CONFIG", jobTitle: role, config: { ...generatedConfig, company }, company }) });
      const data = await resp.json();
      if (data.status === 'success') { setSavedLink(`${baseUrl}?jobId=${data.jobId}`); loadJobs(); }
    } catch (e) { alert("Ошибка сохранения"); }
    finally { setIsSaving(false); }
  };

  const copyToClipboard = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setLastCopiedId(id);
    setTimeout(() => setLastCopiedId(null), 2000);
  };

  const getIqLabel = (score: number) => {
    if (score >= 9) return { text: 'Высокий', color: 'text-blue-400' };
    if (score >= 5) return { text: 'Средний', color: 'text-blue-300' };
    return { text: 'Низкий', color: 'text-slate-500' };
  };

  const getReliabilityLabel = (score: number) => {
    const val = parseInt(score.toString());
    if (val >= 70) return { text: 'Высокая', color: 'text-green-400', bg: 'bg-green-500/10' };
    if (val >= 35) return { text: 'Норма', color: 'text-blue-400', bg: 'bg-blue-500/10' };
    return { text: 'Группа риска', color: 'text-red-400', bg: 'bg-red-500/10' };
  };

  const getFinalStatus = (report: any) => {
    if (report.iq >= 7 && report.reliability >= 35) return { text: 'РЕКОМЕНДОВАН', color: 'text-green-400' };
    return { text: 'ТРЕБУЕТ ПРОВЕРКИ', color: 'text-amber-400' };
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
                     <div className={`px-4 py-1 rounded-full bg-slate-800 text-[10px] font-black tracking-widest uppercase ${getFinalStatus(activeReport).color}`}>
                        {getFinalStatus(activeReport).text}
                     </div>
                   </div>
                   <p className="text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                     <TrendingUp size={14} className="text-blue-500"/> {activeReport.role}
                   </p>
                 </div>
                 <button onClick={() => { setActiveReport(null); setShowExtended(false); }} className="bg-slate-800 hover:bg-slate-700 px-8 py-3 rounded-2xl text-white font-black transition-all active:scale-95 shadow-xl">ЗАКРЫТЬ</button>
              </div>

              {/* ОСНОВНЫЕ МЕТРИКИ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                 <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Интеллект</div>
                      <div className="text-3xl font-black text-white">{activeReport.iq} <span className="text-slate-700 text-lg">/ 12</span></div>
                    </div>
                    <div className={`text-xs font-bold mt-4 uppercase ${getIqLabel(activeReport.iq).color}`}>{getIqLabel(activeReport.iq).text}</div>
                 </div>

                 <div className={`p-6 rounded-3xl border border-slate-800 flex flex-col justify-between ${getReliabilityLabel(activeReport.reliability).bg}`}>
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Надежность</div>
                      <div className={`text-3xl font-black ${getReliabilityLabel(activeReport.reliability).color}`}>{activeReport.reliability}%</div>
                    </div>
                    <div className={`text-xs font-bold mt-4 uppercase ${getReliabilityLabel(activeReport.reliability).color}`}>{getReliabilityLabel(activeReport.reliability).text}</div>
                 </div>

                 <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Кейс-тест</div>
                      <div className="text-3xl font-black text-purple-400">{activeReport.sjtScore || 0} <span className="text-slate-700 text-lg">/ 8</span></div>
                    </div>
                    <div className="text-xs font-bold text-purple-500 mt-4 uppercase">Балл за логику</div>
                 </div>

                 <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Топ Драйверы</div>
                      <div className="text-xs font-bold text-white line-clamp-2 leading-relaxed">{activeReport.drivers || "Не определено"}</div>
                    </div>
                    <div className="text-xs font-bold text-blue-500 mt-4 uppercase">Ключевая мотивация</div>
                 </div>
              </div>

              {/* ПЕРЕКЛЮЧАТЕЛЬ РАСШИРЕННОЙ АНАЛИТИКИ */}
              <button 
                onClick={() => setShowExtended(!showExtended)}
                className="w-full mb-12 flex items-center justify-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all text-sm font-black uppercase tracking-[0.2em] text-blue-400 shadow-xl"
              >
                {showExtended ? 'Скрыть детали' : 'Расширенная аналитика'} 
                <ChevronRight size={18} className={`transition-transform duration-300 ${showExtended ? 'rotate-90' : ''}`} />
              </button>

              {showExtended && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
                   {/* HEXACO ПРОФИЛЬ */}
                   <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800">
                      <h4 className="text-white font-black text-xs uppercase tracking-widest mb-8 flex items-center gap-2">
                        <UserCheck size={16} className="text-blue-500"/> Личностный профиль (HEXACO)
                      </h4>
                      <div className="space-y-6">
                        {[
                          { label: 'Честность', val: 75, color: 'bg-blue-500' },
                          { label: 'Эмоциональность', val: 40, color: 'bg-indigo-500' },
                          { label: 'Экстраверсия', val: 85, color: 'bg-purple-500' },
                          { label: 'Доброжелательность', val: 60, color: 'bg-pink-500' },
                          { label: 'Добросовестность', val: 90, color: 'bg-cyan-500' },
                          { label: 'Открытость опыту', val: 55, color: 'bg-teal-500' },
                        ].map(s => (
                          <div key={s.label}>
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2 text-slate-500">
                               <span>{s.label}</span>
                               <span className="text-slate-300">{s.val}%</span>
                            </div>
                            <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                               <div className={`${s.color} h-full rounded-full`} style={{ width: `${s.val}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-8 text-[10px] text-slate-600 leading-relaxed italic">
                        * Данные основаны на самоотчете кандидата. Высокие значения (70%+) указывают на выраженность качества.
                      </p>
                   </div>

                   {/* AI ГИД ПО ИНТЕРВЬЮ */}
                   <div className="bg-slate-950 p-8 rounded-[2rem] border border-indigo-500/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-5"><MessageSquare size={60} className="text-indigo-400"/></div>
                      <h4 className="text-white font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Wand2 size={16} className="text-indigo-400"/> Гид для HR (Interview Kit)
                      </h4>
                      <div className="space-y-4">
                         <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                            <p className="text-[10px] font-black text-indigo-400 uppercase mb-2 flex items-center gap-1"><AlertCircle size={10}/> Фокус проверки</p>
                            <p className="text-xs text-slate-400 leading-relaxed">У кандидата высокая ориентация на успех, но средняя надежность. Проверьте кейсы, где нужно было доводить скучную работу до конца.</p>
                         </div>
                         <div className="space-y-3">
                            <div className="text-[10px] font-black text-slate-500 uppercase">Рекомендуемые вопросы:</div>
                            {[
                              "Расскажите о случае, когда вам пришлось делать монотонную работу более 3 дней подряд?",
                              "Как вы поступите, если увидите, что коллега нарушает мелкое правило компании?",
                            ].map((q, i) => (
                              <div key={i} className="flex gap-3 items-start">
                                 <div className="min-w-[20px] h-[20px] bg-indigo-500/20 rounded-md flex items-center justify-center text-[10px] font-black text-indigo-400">{i+1}</div>
                                 <p className="text-xs text-slate-300 italic">«{q}»</p>
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {/* ОСНОВНОЙ АНАЛИЗ (ТЕКСТ) */}
              <div className="space-y-10">
                 <section>
                    <h3 className="text-white font-black mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.2em] border-l-4 border-blue-500 pl-4">
                      Ответ на практический кейс
                    </h3>
                    <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800 text-slate-300 text-base italic leading-relaxed shadow-inner">
                      {activeReport.workAnswer ? `«${activeReport.workAnswer}»` : "Кандидат не заполнил ответ на практическое задание."}
                    </div>
                 </section>

                 <section>
                    <h3 className="text-white font-black mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.2em] border-l-4 border-indigo-500 pl-4">
                      Комплексный анализ системы
                    </h3>
                    <div className="bg-slate-950 p-10 rounded-[2rem] border border-slate-800 shadow-inner relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
                          <BarChart size={200} />
                       </div>
                       <div className="prose prose-invert max-w-none prose-h3:text-blue-400 prose-h3:text-xl prose-h3:font-black prose-h3:mt-10 prose-h3:mb-4 prose-h3:uppercase prose-h3:tracking-widest prose-b:text-white prose-p:text-slate-400 prose-p:leading-relaxed prose-p:mb-8" 
                            style={{ 
                              color: '#94a3b8', 
                              fontSize: '1.05rem', 
                              lineHeight: '1.75' 
                            }} 
                            dangerouslySetInnerHTML={{ __html: activeReport.aiReport }} />
                    </div>
                 </section>
              </div>

              <div className="mt-12 pt-10 border-t border-slate-800 text-center">
                 <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-4">Дата прохождения: {new Date(activeReport.date).toLocaleString()}</p>
                 <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-8 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-widest">Распечатать PDF</button>
              </div>
           </div>
        </div>
      )}

      {/* DASHBOARD HEADER & VIEWS (ОСТАВЛЕНО БЕЗ ИЗМЕНЕНИЙ) */}
      <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30"><BarChart className="text-blue-400" size={32} /></div>
          <div><h1 className="text-3xl font-black text-white tracking-tight">HR-КАБИНЕТ</h1><p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{company}</p></div>
        </div>
        <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-sm font-bold"><LogOut size={18} className="rotate-180" /> ВЫЙТИ</button>
      </div>

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
                          <th className="pb-4 px-4 text-center">Надежность</th>
                          <th className="pb-4 px-4 text-right">Детали</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobCandidates.map((c, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 px-4">
                               <div className="text-white font-bold">{c.name}</div>
                               <div className="text-slate-500 text-[10px]">{c.role} • {new Date(c.date).toLocaleDateString()}</div>
                            </td>
                            <td className="py-4 px-4 text-center">
                               <div className={`font-black ${getIqLabel(c.iq).color}`}>{c.iq}</div>
                               <div className="text-[8px] text-slate-600 uppercase font-black">{getIqLabel(c.iq).text}</div>
                            </td>
                            <td className="py-4 px-4 text-center">
                               <div className={`text-sm font-black ${getReliabilityLabel(c.reliability).color}`}>{c.reliability}%</div>
                               <div className="text-[8px] text-slate-600 uppercase font-black">{getReliabilityLabel(c.reliability).text}</div>
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
              <h2 className="text-xl font-bold mb-8 text-white flex items-center gap-3"><Settings size={20} className="text-blue-500"/> Структура теста</h2>
              {!generatedConfig ? <div className="py-20 text-center text-slate-700 font-bold uppercase tracking-[0.2em] animate-pulse">Ожидание ввода данных...</div> : (
                  <div className="space-y-10 animate-in fade-in duration-500">
                    <div className="space-y-4">
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Ситуационные кейсы (SJT):</div>
                      {generatedConfig.sjtQuestions.map((q, i) => (
                        <div key={i} className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 text-sm text-slate-300 italic flex gap-4">
                          <span className="text-blue-500 font-black">0{i+1}</span> {q.text}
                        </div>
                      ))}
                    </div>
                    <div className="mt-12 pt-8 border-t border-slate-800">
                      {!savedLink ? (
                        <button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-green-900/20 active:scale-95">{isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />} ОПУБЛИКОВАТЬ</button>
                      ) : (
                        <div className="bg-blue-600/10 border border-blue-500/30 p-8 rounded-3xl text-center">
                          <h3 className="text-blue-400 font-bold mb-4 flex items-center justify-center gap-2"><CheckCircle size={20}/> ВАКАНСИЯ ОПУБЛИКОВАНА!</h3>
                          <div className="flex gap-3 mb-8"><input readOnly value={savedLink} className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-blue-300 outline-none" /><button onClick={() => copyToClipboard(savedLink, 'new')} className="bg-slate-800 p-3 rounded-xl hover:bg-slate-700 transition-colors"><Copy size={20}/></button></div>
                          <button onClick={() => setView('dashboard')} className="w-full bg-slate-800 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-700 transition-all">К СПИСКУ ВАКАНСИЙ</button>
                        </div>
                      )}
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrBuilder;
