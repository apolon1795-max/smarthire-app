
import React, { useState, useEffect } from 'react';
// Fix: Import newly created functions from geminiService
import { generateCustomQuestions, generateCandidateProfile } from '../geminiService.ts';
import { CustomTestConfig, JobListing, BenchmarkData } from '../types.ts';
import { Loader2, Save, ArrowLeft, CheckCircle, List, Plus, BarChart, ChevronRight, LogOut, FileText, Target, SlidersHorizontal, ShieldCheck, Activity, AlertTriangle, Briefcase } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkData>(DEFAULT_BENCHMARK);
  const [isEditingBenchmark, setIsEditingBenchmark] = useState(false);

  useEffect(() => { if (view === 'dashboard') loadJobs(); }, [view]);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(`${scriptUrl}?action=GET_JOBS&company=${encodeURIComponent(company)}`);
      const data = await resp.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) { setJobs([]); }
    finally { setIsLoading(false); }
  };

  const loadCandidates = async (jobId: string) => {
    setActiveJobId(jobId);
    setView('manage');
    setIsLoading(true);
    try {
      const configResp = await fetch(`${scriptUrl}?action=GET_JOB_CONFIG&jobId=${jobId}`);
      const configData = await configResp.json();
      const currentBenchmark = configData.benchmark || DEFAULT_BENCHMARK;
      setBenchmark(currentBenchmark);

      const resp = await fetch(`${scriptUrl}?action=GET_CANDIDATES&jobId=${jobId}`);
      const data = await resp.json();
      setJobCandidates(Array.isArray(data) ? data.map(c => ({ ...c, jobBenchmark: currentBenchmark })) : []);
    } catch (e) { setJobCandidates([]); }
    finally { setIsLoading(false); }
  };

  const saveBenchmark = async () => {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'UPDATE_BENCHMARK', jobId: activeJobId, benchmark })
      });
      setIsEditingBenchmark(false);
      loadCandidates(activeJobId);
    } catch (e) { alert("Ошибка сохранения"); }
  };

  const calculateFit = (report: any) => {
    if (!report || !report.jobBenchmark) return 0;
    const b = report.jobBenchmark;
    const iqScore = 1 - Math.abs((report.iq || 0) - b.iq) / 12;
    const relScore = 1 - Math.abs((report.reliability || 0) - b.reliability) / 100;
    const sjtScore = 1 - Math.abs((report.sjtScore || 0) - b.sjt) / 8;
    return Math.max(0, Math.min(100, Math.round(((iqScore + relScore + sjtScore) / 3) * 100)));
  };

  return (
    <div className="max-w-7xl mx-auto bg-slate-950 min-h-screen p-6 text-slate-100">
      {activeReport && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/98 backdrop-blur-2xl p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-[2rem] p-10">
            <button onClick={() => setActiveReport(null)} className="mb-8 flex items-center gap-2 text-slate-400 hover:text-white"><ArrowLeft/> Назад</button>
            <h2 className="text-3xl font-black mb-2">{activeReport.name}</h2>
            {/* Fix: replaced 'report' with 'activeReport' on line 86 to fix reference error */}
            <div className="bg-blue-600/20 px-4 py-2 rounded-xl text-blue-400 w-fit mb-8">Fit Score: {calculateFit(activeReport)}%</div>
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: activeReport.aiReport }} />
          </div>
        </div>
      )}

      <header className="flex justify-between items-center mb-12 border-b border-slate-800 pb-8">
        <h1 className="text-2xl font-black flex items-center gap-3"><BarChart className="text-blue-500"/> SmartHire HR</h1>
        <button onClick={onExit} className="text-slate-500 hover:text-red-400 flex items-center gap-2"><LogOut size={18}/> Выйти</button>
      </header>

      {view === 'dashboard' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {jobs.map(job => (
            <div key={job.jobId} className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] hover:border-blue-500 transition-all cursor-pointer" onClick={() => loadCandidates(job.jobId)}>
              <h3 className="text-xl font-bold mb-4">{job.jobTitle}</h3>
              <div className="text-blue-500 font-bold text-xs uppercase tracking-widest">Открыть кандидатов →</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
             <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-slate-400"><ArrowLeft/> К вакансиям</button>
             <button onClick={() => setIsEditingBenchmark(!isEditingBenchmark)} className="bg-slate-800 px-6 py-3 rounded-xl flex items-center gap-2"><SlidersHorizontal size={18}/> {isEditingBenchmark ? 'Закрыть эталон' : 'Настроить эталон'}</button>
          </div>

          {isEditingBenchmark && (
            <div className="bg-slate-900 p-8 rounded-[2rem] border border-blue-500/30">
              <h3 className="text-lg font-bold mb-6">Эталон для {activeJobId}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                 <div>
                    <label className="block text-xs text-slate-500 mb-2 uppercase font-bold">Целевой IQ: {benchmark.iq}</label>
                    <input type="range" min="1" max="12" value={benchmark.iq} onChange={e => setBenchmark({...benchmark, iq: parseInt(e.target.value)})} className="w-full accent-blue-500"/>
                 </div>
                 <div>
                    <label className="block text-xs text-slate-500 mb-2 uppercase font-bold">Надежность %: {benchmark.reliability}</label>
                    <input type="range" min="0" max="100" value={benchmark.reliability} onChange={e => setBenchmark({...benchmark, reliability: parseInt(e.target.value)})} className="w-full accent-blue-500"/>
                 </div>
                 <button onClick={saveBenchmark} className="bg-blue-600 h-fit self-end py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Save size={18}/> Сохранить</button>
              </div>
            </div>
          )}

          <div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase">
                <tr>
                  <th className="p-6">Кандидат</th>
                  <th className="p-6 text-center">Fit Score</th>
                  <th className="p-6 text-right">Отчет</th>
                </tr>
              </thead>
              <tbody>
                {jobCandidates.map((c, i) => (
                  <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="p-6 font-bold">{c.name}</td>
                    <td className="p-6 text-center"><span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/20">{calculateFit(c)}%</span></td>
                    <td className="p-6 text-right"><button onClick={() => setActiveReport(c)} className="p-3 bg-slate-950 rounded-xl hover:text-blue-400"><FileText size={18}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrBuilder;
