
import React, { useState, useEffect } from 'react';
import { generateCustomQuestions } from '../services/geminiService';
import { CustomTestConfig, JobListing } from '../types';
import { Loader2, Save, Wand2, Copy, ArrowLeft, CheckCircle, List, Plus, BarChart, ChevronRight, LogOut, FileText, Eye } from 'lucide-react';

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

  return (
    <div className="max-w-7xl mx-auto bg-slate-950 min-h-screen p-6 text-slate-100">
      {/* ОТЧЕТ (МОДАЛКА) */}
      {activeReport && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-xl p-4 sm:p-20 overflow-y-auto">
           <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-3xl">
              <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
                 <div>
                   <h2 className="text-3xl font-black text-white">{activeReport.name}</h2>
                   <p className="text-slate-500 font-bold uppercase">{activeReport.role}</p>
                 </div>
                 <button onClick={() => setActiveReport(null)} className="bg-slate-800 px-6 py-2 rounded-xl text-white font-bold">ЗАКРЫТЬ</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                 <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><div className="text-[10px] text-slate-500 font-bold uppercase mb-1">IQ</div><div className="text-2xl font-black text-blue-400">{activeReport.iq}</div></div>
                 <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Надежность</div><div className="text-2xl font-black text-green-400">{activeReport.reliability}%</div></div>
                 <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><div className="text-[10px] text-slate-500 font-bold uppercase mb-1">SJT</div><div className="text-2xl font-black text-purple-400">{activeReport.sjtScore}</div></div>
                 <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Результат</div><div className="text-2xl font-black text-amber-400">PASSED</div></div>
              </div>
              <div className="mb-8">
                 <h3 className="text-white font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-widest"><Eye size={16} className="text-blue-400"/> Ответ на кейс:</h3>
                 <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{activeReport.workAnswer || "Кандидат не заполнил ответ"}</div>
              </div>
              <div>
                 <h3 className="text-white font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-widest"><FileText size={16} className="text-blue-400"/> Анализ ИИ:</h3>
                 <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 prose prose-invert max-w-none text-slate-200" dangerouslySetInnerHTML={{ __html: activeReport.aiReport }} />
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

      {/* MANAGE */}
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
                          <th className="pb-4 px-4">ФИО</th>
                          <th className="pb-4 px-4 text-center">IQ</th>
                          <th className="pb-4 px-4 text-center">Надежность</th>
                          <th className="pb-4 px-4 text-right">Детали</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobCandidates.map((c, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 px-4"><div className="text-white font-bold">{c.name}</div><div className="text-slate-500 text-[10px]">{new Date(c.date).toLocaleDateString()}</div></td>
                            <td className="py-4 px-4 text-center font-bold text-blue-400">{c.iq}</td>
                            <td className="py-4 px-4 text-center text-sm">{c.reliability}%</td>
                            <td className="py-4 px-4 text-right">
                               <button onClick={() => setActiveReport(c)} className="p-3 bg-slate-800 hover:bg-blue-600 text-white rounded-xl transition-all"><FileText size={20}/></button>
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

      {/* CREATE VIEW (без изменений в логике, только дизайн) */}
      {view === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-left-4 duration-500">
           {/* Форма создания... */}
           <div className="lg:col-span-4 space-y-6">
            <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold uppercase mb-2"><ArrowLeft size={16}/> Отмена</button>
            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-bold mb-6 text-white">Новая Вакансия</h2>
              <div className="space-y-6">
                <div><label className="text-xs font-black text-slate-500 uppercase block mb-2">Должность</label><input value={role} onChange={e => setRole(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 focus:border-blue-500 outline-none text-white" /></div>
                <div><label className="text-xs font-black text-slate-500 uppercase block mb-2">Проблемы в отделе / Задачи</label><textarea value={challenges} onChange={e => setChallenges(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 h-40 focus:border-blue-500 outline-none text-sm text-slate-300" /></div>
                <button onClick={handleGenerate} disabled={isGenerating || !role} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50">{isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={24} />} СФОРМИРОВАТЬ ТЕСТ</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-8">
             <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 h-full">
              <h2 className="text-xl font-bold mb-8 text-white">Структура теста</h2>
              {!generatedConfig ? <div className="py-20 text-center text-slate-700 font-bold uppercase tracking-[0.2em]">Ожидание ввода данных...</div> : (
                  <div className="space-y-10">
                    <div className="space-y-4">
                      {generatedConfig.sjtQuestions.map((q, i) => (
                        <div key={i} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-sm text-slate-300 italic">{q.text}</div>
                      ))}
                    </div>
                    <div className="mt-12 pt-8 border-t border-slate-800">
                      {!savedLink ? (
                        <button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all">{isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />} ОПУБЛИКОВАТЬ</button>
                      ) : (
                        <div className="bg-blue-600/10 border border-blue-500/30 p-8 rounded-3xl text-center">
                          <h3 className="text-blue-400 font-bold mb-4 flex items-center justify-center gap-2"><CheckCircle size={20}/> ВАКАНСИЯ ОПУБЛИКОВАНА!</h3>
                          <div className="flex gap-3 mb-8"><input readOnly value={savedLink} className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-blue-300" /><button onClick={() => copyToClipboard(savedLink, 'new')} className="bg-slate-800 p-3 rounded-xl"><Copy size={20}/></button></div>
                          <button onClick={() => setView('dashboard')} className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold">К СПИСКУ ВАКАНСИЙ</button>
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
