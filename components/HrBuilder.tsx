
import React, { useState, useEffect } from 'react';
import { generateCustomQuestions } from '../geminiService.ts';
import { CustomTestConfig, JobListing, BenchmarkData } from '../types.ts';
import { 
  Loader2, Save, ArrowLeft, Plus, BarChart, LogOut, 
  FileText, SlidersHorizontal, Briefcase, Send, Target, Copy, ExternalLink 
} from 'lucide-react';

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
  const [activeJobId, setActiveJobId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkData>(DEFAULT_BENCHMARK);
  const [isEditingBenchmark, setIsEditingBenchmark] = useState(false);

  useEffect(() => {
    if (view === 'dashboard') loadJobs();
  }, [view]);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(`${scriptUrl}?action=GET_JOBS&company=${encodeURIComponent(company)}`);
      const data = await resp.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Jobs loading error:", e);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle.trim()) return;

    setIsCreating(true);
    try {
      // Генерируем вопросы через Gemini (фронтенд-сервис)
      const config = await generateCustomQuestions(newJobTitle, company);
      
      const resp = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'SAVE_CONFIG',
          jobTitle: newJobTitle,
          company: company,
          config: config
        })
      });

      const result = await resp.json();
      if (result.status === 'success') {
        setNewJobTitle('');
        setView('dashboard');
        loadJobs();
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка при создании вакансии. Проверьте соединение.");
    } finally {
      setIsCreating(false);
    }
  };

  const loadCandidates = async (jobId: string) => {
    setActiveJobId(jobId);
    setView('manage');
    setIsLoading(true);
    try {
      const resp = await fetch(`${scriptUrl}?action=GET_CANDIDATES&jobId=${jobId}`);
      const data = await resp.json();
      setJobCandidates(Array.isArray(data) ? data : []);
      
      const configResp = await fetch(`${scriptUrl}?action=GET_JOB_CONFIG&jobId=${jobId}`);
      const configData = await configResp.json();
      setBenchmark(configData.benchmark || DEFAULT_BENCHMARK);
    } catch (e) {
      setJobCandidates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}?jobId=${id}`;
    navigator.clipboard.writeText(url);
    alert("Ссылка для кандидата скопирована!");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Шапка */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2 rounded-lg">
              <BarChart size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg leading-none">SmartHire Dashboard</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{company}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {view === 'dashboard' && (
              <button 
                onClick={() => setView('create')}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
              >
                <Plus size={16} /> Создать вакансию
              </button>
            )}
            <button onClick={onExit} className="p-2 text-slate-500 hover:text-white transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
            <p className="text-slate-500 font-medium">Синхронизация с базой данных...</p>
          </div>
        ) : view === 'dashboard' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {jobs.length === 0 ? (
              <div className="mt-12 bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-[3rem] p-20 text-center">
                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Briefcase size={32} className="text-slate-600" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Список вакансий пуст</h3>
                <p className="text-slate-500 mb-10 max-w-sm mx-auto">Создайте первую позицию, чтобы ИИ подготовил индивидуальные тесты для ваших кандидатов.</p>
                <button 
                  onClick={() => setView('create')}
                  className="bg-white text-slate-950 px-10 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl"
                >
                  СОЗДАТЬ ВАКАНСИЮ
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {jobs.map(job => (
                  <div key={job.jobId} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-blue-500/50 transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-4 bg-slate-950 rounded-2xl text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                        <Briefcase size={24} />
                      </div>
                      <span className="text-[10px] font-black text-slate-600 bg-slate-950 px-3 py-1 rounded-full uppercase">
                        ID: {job.jobId}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{job.jobTitle}</h3>
                    <p className="text-slate-500 text-sm mb-8">Опубликовано: {new Date(job.dateCreated).toLocaleDateString()}</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => loadCandidates(job.jobId)}
                        className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2"
                      >
                        <FileText size={14} /> КАНДИДАТЫ
                      </button>
                      <button 
                        onClick={() => copyLink(job.jobId)}
                        className="bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2"
                      >
                        <Copy size={14} /> ССЫЛКА
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : view === 'create' ? (
          <div className="max-w-2xl mx-auto py-12 animate-in fade-in zoom-in-95 duration-300">
            <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-white mb-8 font-bold transition-colors">
              <ArrowLeft size={18} /> К списку вакансий
            </button>
            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 shadow-2xl">
              <h2 className="text-3xl font-black mb-2 text-white">Новая позиция</h2>
              <p className="text-slate-500 mb-10">Введите название роли, и наш ИИ сгенерирует профильные вопросы.</p>
              
              <form onSubmit={handleCreateJob} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Название должности</label>
                  <input 
                    value={newJobTitle}
                    onChange={e => setNewJobTitle(e.target.value)}
                    placeholder="Например: Senior Frontend Developer"
                    required
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-5 text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                  />
                </div>
                
                <div className="p-6 bg-blue-600/5 rounded-2xl border border-blue-500/10">
                  <p className="text-xs text-blue-400 leading-relaxed font-bold">
                    🚀 После нажатия кнопки ИИ создаст 3 ситуационных кейса и 1 практическое задание специально для этой роли.
                  </p>
                </div>

                <button 
                  type="submit" 
                  disabled={isCreating}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      ГЕНЕРАЦИЯ ТЕСТОВ...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      ОПУБЛИКОВАТЬ ВАКАНСИЮ
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors">
                <ArrowLeft size={18} /> Назад
              </button>
              <h2 className="text-2xl font-black">Управление кандидатами</h2>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden">
              <div className="p-8 border-b border-slate-800 bg-slate-900/50">
                <h3 className="font-bold flex items-center gap-2 text-slate-400 uppercase text-xs tracking-widest">
                  <FileText size={16} className="text-blue-500" /> 
                  Отклики ({jobCandidates.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                    <tr>
                      <th className="p-6">ФИО</th>
                      <th className="p-6">Статус</th>
                      <th className="p-6 text-center">IQ</th>
                      <th className="p-6 text-center">Надежность</th>
                      <th className="p-6 text-right">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {jobCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-20 text-center text-slate-600 italic font-medium">Кандидатов пока нет. Поделитесь ссылкой!</td>
                      </tr>
                    ) : (
                      jobCandidates.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-6 font-bold text-white">{c.name}</td>
                          <td className="p-6 text-xs text-green-500 font-black uppercase tracking-tighter">{c.status}</td>
                          <td className="p-6 text-center text-blue-400 font-bold">{c.iq}</td>
                          <td className="p-6 text-center text-slate-300">{c.reliability}%</td>
                          <td className="p-6 text-right">
                            <button 
                              onClick={() => setActiveReport(c)}
                              className="p-3 bg-slate-950 border border-slate-800 rounded-xl hover:text-blue-400 hover:border-blue-500 transition-all"
                            >
                              <ExternalLink size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Модалка отчета */}
      {activeReport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[90vh] rounded-[3rem] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div>
                <h2 className="text-2xl font-black text-white">{activeReport.name}</h2>
                <p className="text-slate-500 text-sm">{activeReport.role}</p>
              </div>
              <button onClick={() => setActiveReport(null)} className="p-2 text-slate-500 hover:text-white transition-colors">
                ✕
              </button>
            </div>
            <div className="p-10 overflow-y-auto custom-scrollbar">
              <div className="prose prose-invert max-w-none 
                prose-h3:text-blue-400 prose-h3:font-black prose-h3:mt-8
                prose-p:text-slate-400 prose-p:leading-relaxed" 
                dangerouslySetInnerHTML={{ __html: activeReport.aiReport }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrBuilder;
