
import React, { useEffect, useState, useRef } from 'react';
import { TestResult, CandidateInfo } from '../types';
import { generateCandidateProfile, SCRIPT_URL } from '../geminiService';
import { Loader2, ShieldCheck } from 'lucide-react';

interface ResultsViewProps {
  results: TestResult[];
  candidateInfo: CandidateInfo | null;
  onReset: () => void;
  scriptUrl: string;
  jobId?: string;
}

const ResultsView: React.FC<ResultsViewProps> = ({ results, candidateInfo, onReset, scriptUrl, jobId }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const hasSaved = useRef(false);

  useEffect(() => {
    const process = async () => {
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
    const payloads = {
      action: "SAVE_RESULT",
      jobId: jobId || "",
      candidateName: candidateInfo?.name || "Кандидат",
      candidateRole: candidateInfo?.role || "Соискатель",
      iqScore: results.find(r => r.sectionId === 'intelligence')?.rawScore || 0,
      reliability: results.find(r => r.sectionId === 'conscientiousness')?.percentage.toFixed(0) || 0,
      aiAnalysis: analysis,
      sjtScore: results.find(r => r.sectionId === 'sjt')?.rawScore || 0,
      workSampleAnswer: results.find(r => r.sectionId === 'work_sample')?.textAnswer || "Нет ответа",
      hexacoJson: JSON.stringify(results.find(r => r.sectionId === 'conscientiousness')?.hexacoProfile || {}),
      motivationJson: JSON.stringify(results.find(r => r.sectionId === 'motivation')?.motivationProfile || {})
    };

    try {
      await fetch(scriptUrl, { method: 'POST', body: JSON.stringify(payloads) });
      setSaveStatus('done');
    } catch (e) { console.error(e); }
  };

  if (isAnalyzing) return (
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={64} />
      <h2 className="text-white font-bold animate-pulse">Анализируем результаты...</h2>
    </div>
  );

  return (
    <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-10 rounded-[2rem] text-center">
      <ShieldCheck className="text-green-500 mx-auto mb-6" size={64} />
      <h1 className="text-2xl font-black mb-4">ТЕСТ ЗАВЕРШЕН</h1>
      <p className="text-slate-400 mb-8">Ваши данные переданы в HR-отдел.</p>
      <button onClick={onReset} className="w-full bg-blue-600 py-4 rounded-xl font-bold">ОК</button>
    </div>
  );
};

export default ResultsView;
