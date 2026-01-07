
import React, { useEffect, useState, useRef } from 'react';
import { TestResult, CandidateInfo } from '../types';
import { generateCandidateProfile } from '../services/geminiService';
import { Loader2, CheckCircle, ShieldCheck, Download } from 'lucide-react';

interface ResultsViewProps {
  results: TestResult[];
  candidateInfo: CandidateInfo | null;
  onReset: () => void;
  scriptUrl: string;
  isHrView?: boolean;
  jobId?: string;
}

const ResultsView: React.FC<ResultsViewProps> = ({ results, candidateInfo, onReset, scriptUrl, isHrView, jobId }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const hasSaved = useRef(false);

  // Глубокая очистка от markdown
  const cleanReportHtml = (text: string) => {
    return text
      .replace(/```html/g, '')
      .replace(/```/g, '')
      .replace(/yandexgpt/g, '')
      .replace(/&lt;h3&gt;/g, '<h3>')
      .replace(/&lt;\/h3&gt;/g, '</h3>')
      .replace(/&lt;b&gt;/g, '<b>')
      .replace(/&lt;\/b&gt;/g, '</b>')
      .trim();
  };

  useEffect(() => {
    const process = async () => {
      setIsAnalyzing(true);
      try {
        const text = await generateCandidateProfile(results, candidateInfo || undefined);
        setAnalysis(cleanReportHtml(text));
      } catch (e) { console.error(e); }
      finally { setIsAnalyzing(false); }
    };
    process();
  }, [results, candidateInfo]);

  useEffect(() => {
    if (!isAnalyzing && analysis && !hasSaved.current) {
      handleAutoSave();
      hasSaved.current = true;
    }
  }, [isAnalyzing, analysis]);

  const handleAutoSave = async () => {
    setSaveStatus('saving');
    const workRes = results.find(r => r.sectionId === 'work_sample');
    const payload = {
      action: "SAVE_RESULT",
      jobId: jobId || "",
      candidateName: candidateInfo?.name || "Кандидат",
      candidateRole: candidateInfo?.role || "Соискатель",
      iqScore: results.find(r => r.sectionId === 'intelligence')?.rawScore || 0,
      reliability: results.find(r => r.sectionId === 'conscientiousness')?.percentage.toFixed(0) || 0,
      emotionality: 3,
      topDrivers: results.find(r => r.sectionId === 'motivation')?.motivationProfile?.topDrivers || [],
      statusText: "Завершено",
      aiAnalysis: analysis,
      sjtScore: results.find(r => r.sectionId === 'sjt')?.rawScore || 0,
      workSampleAnswer: workRes?.textAnswer || "Нет ответа",
      company: localStorage.getItem('sh_company') || ""
    };

    try {
      await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
      setSaveStatus('done');
    } catch (e) { console.error(e); }
  };

  if (isAnalyzing) return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Loader2 className="animate-spin text-blue-500" size={64} />
      <h2 className="text-xl font-bold text-white">Анализируем ваши ответы...</h2>
    </div>
  );

  // КАНДИДАТ ВИДИТ ТОЛЬКО ЭТО
  if (!isHrView) {
    return (
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-10 rounded-[2rem] text-center shadow-2xl">
        <div className="inline-flex p-5 rounded-3xl bg-green-500/10 border border-green-500/20 mb-8">
           <ShieldCheck className="text-green-500" size={64} />
        </div>
        <h1 className="text-3xl font-black text-white mb-4">ТЕСТ ПРОЙДЕН!</h1>
        <p className="text-slate-400 leading-relaxed mb-10">Спасибо за уделенное время. Ваши результаты переданы в HR-отдел компании. Мы свяжемся с вами после проверки.</p>
        <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700 mb-8 flex items-center justify-between">
           <span className="text-xs font-bold text-slate-500 uppercase">Синхронизация:</span>
           {saveStatus === 'done' ? <span className="text-xs font-bold text-green-400 flex items-center gap-1 uppercase"><CheckCircle size={14}/> Ок</span> : <span className="text-xs font-bold text-blue-400 animate-pulse uppercase">Загрузка...</span>}
        </div>
        <button onClick={onReset} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl">НА ГЛАВНУЮ</button>
      </div>
    );
  }

  // HR ВИДИТ ОТЧЕТ
  return (
    <div className="max-w-4xl w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl">
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
        <div>
           <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Отчёт: {candidateInfo?.name}</h1>
           <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{candidateInfo?.role}</p>
        </div>
        <button onClick={() => window.print()} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-500 transition-all shadow-lg"><Download size={20}/></button>
      </div>
      
      <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-slate-200 text-sm leading-relaxed overflow-hidden">
        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: analysis }} />
      </div>

      <div className="mt-10 flex justify-center">
         <button onClick={onReset} className="bg-slate-800 text-slate-400 font-bold px-8 py-3 rounded-xl hover:text-white transition-colors">ВЕРНУТЬСЯ К СПИСКУ</button>
      </div>
    </div>
  );
};

export default ResultsView;
