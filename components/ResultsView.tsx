
import React, { useEffect, useState, useRef } from 'react';
import { TestResult, CandidateInfo } from '../types';
import { generateCandidateProfile } from '../services/geminiService';
import { Loader2, CheckCircle, ShieldCheck, Download, RotateCcw } from 'lucide-react';

interface ResultsViewProps {
  results: TestResult[];
  candidateInfo: CandidateInfo | null;
  onReset: () => void;
  scriptUrl: string;
  isHrView?: boolean;
  jobId?: string;
  onRetake?: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ results, candidateInfo, onReset, scriptUrl, isHrView, jobId, onRetake }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const hasSaved = useRef(false);

  useEffect(() => {
    const process = async () => {
      setIsAnalyzing(true);
      try {
        const text = await generateCandidateProfile(results, candidateInfo || undefined);
        setAnalysis(text);
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
    const conscientiousnessSection = results.find(r => r.sectionId === 'conscientiousness');
    const motivationSection = results.find(r => r.sectionId === 'motivation');
    const workRes = results.find(r => r.sectionId === 'work_sample');
    
    const payload = {
      action: "SAVE_RESULT",
      jobId: jobId || "",
      candidateName: candidateInfo?.name || "Кандидат",
      candidateRole: candidateInfo?.role || "Соискатель",
      iqScore: results.find(r => r.sectionId === 'intelligence')?.rawScore || 0,
      reliability: conscientiousnessSection?.percentage.toFixed(0) || 0,
      topDrivers: motivationSection?.motivationProfile?.topDrivers || [],
      statusText: "Завершено",
      aiAnalysis: analysis,
      sjtScore: results.find(r => r.sectionId === 'sjt')?.rawScore || 0,
      workSampleAnswer: workRes?.textAnswer || "Нет ответа",
      company: localStorage.getItem('sh_company') || "",
      hexacoJson: JSON.stringify(conscientiousnessSection?.hexacoProfile || {}),
      motivationJson: JSON.stringify(motivationSection?.motivationProfile || {})
    };

    try {
      const response = await fetch(scriptUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain' }, 
        body: JSON.stringify(payload) 
      });
      const data = await response.json();
      if (data.status === 'success') setSaveStatus('done');
      else setSaveStatus('error');
    } catch (e) { setSaveStatus('error'); }
  };

  if (isAnalyzing) return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Loader2 className="animate-spin text-blue-500" size={64} />
      <h2 className="text-xl font-bold text-white uppercase tracking-widest animate-pulse">Составляем профиль кандидата...</h2>
    </div>
  );

  return (
    <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-10 rounded-[2rem] text-center shadow-2xl">
      <div className="inline-flex p-5 rounded-3xl bg-green-500/10 border border-green-500/20 mb-8"><ShieldCheck className="text-green-500" size={64} /></div>
      <h1 className="text-3xl font-black text-white mb-4">ТЕСТ ПРОЙДЕН!</h1>
      <p className="text-slate-400 leading-relaxed mb-10">Спасибо за уделенное время. Ваши результаты переданы в HR-отдел компании. Мы свяжемся с вами после проверки.</p>
      <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700 mb-8 flex items-center justify-between">
         <span className="text-xs font-bold text-slate-500 uppercase">Синхронизация данных:</span>
         <span className={`text-xs font-black uppercase ${saveStatus === 'done' ? 'text-green-400' : 'text-blue-400'}`}>{saveStatus === 'done' ? 'УСПЕШНО' : 'ЗАГРУЗКА...'}</span>
      </div>
      <button onClick={onReset} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 uppercase tracking-widest text-sm">НА ГЛАВНУЮ</button>
    </div>
  );
};

export default ResultsView;
