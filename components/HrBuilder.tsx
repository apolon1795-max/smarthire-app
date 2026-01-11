
import React, { useState, useEffect } from 'react';
import { generateCustomQuestions } from '../services/geminiService';
import { CustomTestConfig, JobListing, CandidateInfo } from '../types';
import { Loader2, Save, Wand2, Copy, Check, ExternalLink, ArrowLeft, CheckCircle, Edit3, Play, AlertTriangle, List, Plus, Star, User, Calendar, BarChart, ChevronRight, Link as LinkIcon, LogOut, RefreshCcw } from 'lucide-react';

interface HrBuilderProps {
  scriptUrl: string;
  company: string;
  onExit: () => void;
  onTestPreview: (config: CustomTestConfig) => void;
}

const HrBuilder: React.FC<HrBuilderProps> = ({ scriptUrl, company, onExit, onTestPreview }) => {
  const [view, setView] = useState<'dashboard' | 'create' | 'manage'>('dashboard');
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobCandidates, setJobCandidates] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  
  const [role, setRole] = useState('');
  const [challenges, setChallenges] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<CustomTestConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLink, setSavedLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const baseUrl = window.location.href.split('?')[0];

  useEffect(() => {
    if (view === 'dashboard') loadJobs();
  }, [view]);

  const loadJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const response = await fetch(`${scriptUrl}?action=GET_JOBS&company=${encodeURIComponent(company)}`);
      const data = await response.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setIsLoadingJobs(false); }
  };

  const loadCandidates = async (jobId: string) => {
    setSelectedJobId(jobId);
    setView('manage');
    setIsLoadingJobs(true);
    try {
      const response = await fetch(`${scriptUrl}?action=GET_CANDIDATES&jobId=${jobId}&company=${encodeURIComponent(company)}`);
      const data = await response.json();
      setJobCandidates(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setIsLoadingJobs(false); }
  };

  const handleSetBenchmark = async (candidate: any) => {
    if (!selectedJobId) return;
    if (!confirm(`Сделать результаты кандидата ${candidate.name} эталоном для этой вакансии? Все новые кандидаты будут сравниваться с ним.`)) return;

    let benchmark;
    try {
       benchmark = {
         iq: candidate.iq || 5,
         hexaco: { 'H': candidate.reliability, 'C': candidate.reliability, 'E': candidate.emotionality, 'X': 3, 'A': 3, 'O': 3 },
         drivers: candidate.drivers ? candidate.drivers.split(', ') : []
       };
    } catch(e) { alert("Ошибка парсинга данных кандидата"); return; }

    try {
      const resp = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'SET_BENCHMARK', jobId: selectedJobId, benchmark, company })
      });
      const res = await resp.json();
      if (res.status === 'success') {
        alert("Эталон успешно установлен!");
        loadJobs();
      }
    } catch(e) { alert("Ошибка связи"); }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedConfig(null);
    setSavedLink('');
    try {
      const config = await generateCustomQuestions(role, challenges);
      if (config) { 
        setGeneratedConfig({ ...config, jobTitle: role, jobId: '', company: company }); 
      }
    } catch (e: any) { setErrorMsg(e.message || "Ошибка генерации"); }
    finally { setIsGenerating(false); }
  };

  const handleSave = async () => {
    if (!generatedConfig) return;
    setIsSaving(true);
    const payload = { action: "SAVE_CONFIG", jobTitle: role, config: { ...generatedConfig, company }, company };
    try {
      const response = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (data.status === 'success') {
        setSavedLink(`${baseUrl}?jobId=${data.jobId}`);
        // Сразу подгружаем обновленный список, чтобы вакансия не "пропадала"
        await loadJobs();
      }
    } catch (e) { alert("Ошибка сохранения"); }
    finally { setIsSaving(false); }
  };

  const copyToClipboard = (link: string, id: string | null = null) => {
    navigator.clipboard.writeText(link);
    if (id) {
      setLastCopiedId(id);
      setTimeout(() => setLastCopiedId(null), 2000);
    } else {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const resetFormAndGoBack = () => {
    setRole('');
    setChallenges('');
    setGeneratedConfig(null);
    setSavedLink('');
    setView('dashboard');
    loadJobs(); // Принудительно обновляем список при возврате
  };

  return (
    <div className="max-w-7xl mx-auto bg-slate-950 min-h-screen p-6 sm:p-10 text-slate-100">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30">
            <BarChart className="text-blue-400" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">{company} PORTAL</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Кабинет HR-специалиста</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={loadJobs} className="p-2 text-slate-400 hover:text-blue-400 transition-colors" title="Обновить список">
            <RefreshCcw size={20} className={isLoadingJobs ? 'animate-spin' : ''} />
          </button>
          <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-sm font-bold">
            <LogOut size={18} className="rotate-180" /> ВЫХОД В ПОРТАЛ
          </button>
        </div>
      </div>

      {/* DASHBOARD VIEW */}
      {view === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-end">
             <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><List size={20} className="text-blue-400"/> Активные Вакансии</h2>
                <button onClick={loadJobs} className="text-slate-500 hover:text-white transition-colors"><RefreshCcw size={16} className={isLoadingJobs ? 'animate-spin' : ''} /></button>
             </div>
             <button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20">
               <Plus size={20}/> Создать новую
             </button>
          </div>

          {isLoadingJobs ? (
            <div className="flex justify-center py-20 flex-col items-center gap-4 text-slate-500">
               <Loader2 className="animate-spin text-blue-500" size={48} />
               <p className="text-sm font-medium">Синхронизация с базой данных...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-20 text-center">
               <p className="text-slate-500 font-medium">Для компании {company} пока нет созданных вакансий.</p>
               <button onClick={loadJobs} className="mt-4 text-blue-400 font-bold flex items-center gap-2 mx-auto hover:text-blue-300 transition-colors">
                 <RefreshCcw size={16}/> Проверить еще раз
               </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map(job => {
                const jLink = `${baseUrl}?jobId=${job.jobId}`;
                return (
                  <div key={job.jobId} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-blue-500/30 transition-all group flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">{job.jobTitle}</h3>
                      {job.hasBenchmark && <span title="Есть эталон"><Star size={18} className="text-amber-400 fill-amber-400" /></span>}
                    </div>
                    <div className="text-slate-500 text-[10px] font-mono mb-4 flex items-center gap-2 uppercase tracking-wider">
                      <Calendar size={10}/> {new Date(job.dateCreated).toLocaleDateString()}
                    </div>
                    
                    <div className="mt-auto space-y-3 pt-4 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="flex-grow bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                          {jLink}
                        </div>
                        <button 
                          onClick={() => copyToClipboard(jLink, job.jobId)}
                          className={`p-2 rounded-lg transition-all ${lastCopiedId === job.jobId ? 'bg-green-600/20 text-green-400' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                        >
                          {lastCopiedId === job.jobId ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <button onClick={() => loadCandidates(job.jobId)} className="w-full bg-slate-800 hover:bg-blue-600/10 hover:text-blue-400 border border-transparent hover:border-blue-500/30 text-slate-200 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all">
                        Кандидаты и Аналитика <ChevronRight size={14}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MANAGE VACANCY VIEW */}
      {view === 'manage' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
           <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
             <ArrowLeft size={16}/> Назад к списку
           </button>
           
           <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-bold text-white">Кандидаты: {jobs.find(j => j.jobId === selectedJobId)?.jobTitle}</h2>
                 <div className="text-xs bg-slate-800 text-slate-400 px-4 py-2 rounded-full font-mono uppercase tracking-widest">Job ID: {selectedJobId}</div>
              </div>

              {jobCandidates.length === 0 ? (
                 <div className="text-center py-20 text-slate-500">Пока никто не прошел тест по этой вакансии.</div>
              ) : (
                 <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                          <th className="pb-4 px-4">Имя</th>
                          <th className="pb-4 px-4 text-center">IQ</th>
                          <th className="pb-4 px-4 text-center">Надежность</th>
                          <th className="pb-4 px-4">Мотиваторы</th>
                          <th className="pb-4 px-4 text-right">Действие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobCandidates.map((c, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-400 border border-blue-500/10 group-hover:bg-blue-500/20"><User size={20}/></div>
                                <div>
                                  <div className="text-white font-bold">{c.name}</div>
                                  <div className="text-slate-500 text-[10px] uppercase font-bold tracking-tighter">{new Date(c.date).toLocaleDateString()}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-bold text-blue-400">{c.iq}</td>
                            <td className="py-4 px-4 text-center">
                               <div className="flex justify-center items-center gap-2">
                                 <span className="font-mono text-sm">{c.reliability}</span>
                                 <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                   <div className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" style={{width: `${(c.reliability/5)*100}%`}}></div>
                                 </div>
                               </div>
                            </td>
                            <td className="py-4 px-4 text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{c.drivers}</td>
                            <td className="py-4 px-4 text-right">
                               <button 
                                 onClick={() => handleSetBenchmark(c)}
                                 className="p-2 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-400 transition-all border border-transparent hover:border-amber-500/30 group/btn"
                                 title="Сделать эталоном"
                               >
                                 <Star size={20} className="group-hover/btn:fill-amber-400/50" />
                               </button>
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

      {/* CREATE VACANCY VIEW */}
      {view === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="lg:col-span-4 space-y-6">
            <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-2">
              <ArrowLeft size={16}/> Отмена
            </button>
            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 sticky top-6 shadow-2xl">
              <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2"><Plus className="text-blue-400" size={20}/> Создание Вакансии</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black mb-2 text-slate-500 uppercase tracking-widest">Должность</label>
                  <input 
                    value={role} onChange={e => setRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 focus:border-blue-500 outline-none transition-all text-white"
                    placeholder="Напр. Senior Python Dev"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-2 text-slate-500 uppercase tracking-widest">Контекст и Вызовы</label>
                  <textarea 
                    value={challenges} onChange={e => setChallenges(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 h-40 focus:border-blue-500 outline-none transition-all text-sm text-slate-300"
                    placeholder="Какие задачи будет решать? Какие сложности в команде? AI создаст вопросы на основе этих данных."
                  />
                </div>
                {errorMsg && <div className="text-red-400 text-xs flex items-start gap-2 bg-red-500/10 p-4 rounded-xl border border-red-500/20"><AlertTriangle size={16} /> {errorMsg}</div>}
                
                <button 
                  onClick={handleGenerate} disabled={isGenerating || !role}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-900/30 disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={24} />}
                  {generatedConfig ? 'ПЕРЕГЕНЕРИРОВАТЬ' : 'СФОРМИРОВАТЬ ТЕСТ'}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col h-full">
             <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 flex-grow shadow-2xl relative overflow-hidden">
              <h2 className="text-xl font-bold mb-8 text-white flex justify-between items-center">
                <span>Просмотр структуры теста</span>
                {generatedConfig && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 font-black uppercase tracking-widest">AI Methodologist</span>}
              </h2>
              
              {!generatedConfig ? (
                  <div className="flex flex-col items-center justify-center py-32 text-slate-700">
                    <Wand2 size={64} className="mb-6 opacity-20" />
                    <p className="font-bold text-center max-w-xs">Заполните данные слева, чтобы AI сформировал профильные вопросы</p>
                  </div>
              ) : (
                  <div className="space-y-10">
                    <div className="space-y-6">
                      {generatedConfig.sjtQuestions.map((q, i) => (
                        <div key={i} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 relative group hover:border-slate-700 transition-colors">
                          <div className="absolute -left-3 top-6 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-slate-950 shadow-lg shadow-blue-900/30">{i+1}</div>
                          <textarea 
                            value={q.text}
                            onChange={(e) => {
                              const newQ = [...generatedConfig.sjtQuestions];
                              newQ[i].text = e.target.value;
                              setGeneratedConfig({...generatedConfig, sjtQuestions: newQ});
                            }}
                            className="w-full bg-transparent border-none text-slate-100 text-sm focus:ring-0 outline-none resize-none mb-4 font-medium"
                          />
                          <div className="space-y-2 pl-4 border-l-2 border-slate-800">
                            {q.options?.map((o, optIndex) => (
                              <div key={optIndex} className="flex gap-4 items-center">
                                 <span className="text-[10px] font-bold text-slate-600 w-4">+{o.value}</span>
                                 <input 
                                   value={o.text}
                                   onChange={(e) => {
                                      const newQ = [...generatedConfig.sjtQuestions];
                                      newQ[i].options![optIndex].text = e.target.value;
                                      setGeneratedConfig({...generatedConfig, sjtQuestions: newQ});
                                   }}
                                   className="flex-grow bg-transparent border-none text-slate-400 text-xs focus:text-white transition-colors outline-none"
                                 />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-12 pt-8 border-t border-slate-800">
                      {!savedLink ? (
                        <button 
                          onClick={handleSave} disabled={isSaving}
                          className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-green-900/30"
                        >
                          {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                          ОПУБЛИКОВАТЬ ВАКАНСИЮ
                        </button>
                      ) : (
                        <div className="bg-blue-600/10 border border-blue-500/30 p-8 rounded-3xl animate-in zoom-in-95 duration-300">
                          <h3 className="text-blue-400 font-bold mb-4 flex items-center gap-2"><CheckCircle size={20}/> Вакансия успешно опубликована!</h3>
                          <p className="text-slate-400 text-sm mb-6">Ссылка для кандидатов вашей компании:</p>
                          <div className="flex gap-3 mb-8">
                            <input readOnly value={savedLink} className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-blue-300 outline-none" />
                            <button onClick={() => copyToClipboard(savedLink)} className={`p-3 rounded-xl transition-all ${copySuccess ? 'bg-green-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                              {copySuccess ? <Check size={20}/> : <Copy size={20}/>}
                            </button>
                            <a href={savedLink} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl flex items-center transition-colors">
                              <ExternalLink size={20}/>
                            </a>
                          </div>
                          
                          <button 
                            onClick={resetFormAndGoBack}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                          >
                            <List size={18} /> К СПИСКУ ВАКАНСИЙ
                          </button>
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
