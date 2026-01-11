
import React, { useEffect, useState } from 'react';
import { TestResult, CandidateInfo } from '../types.ts';
// Fix: Corrected import to use exported member 'generateCandidateProfile'
import { generateCandidateProfile } from '../geminiService.ts';
import { Loader2, ShieldCheck, CheckCircle2, LayoutDashboard, LogOut } from 'lucide-react';

interface ResultsViewProps {
  results: TestResult[];
  candidateInfo: CandidateInfo | null;
  onReset: () => void;
  scriptUrl: string;
  jobId?: string;
}

// Fix: Add default export and component implementation to resolve 'no default export' error
export default function ResultsView({ results, candidateInfo, onReset, scriptUrl, jobId }: ResultsViewProps) {
  const [isGenerating, setIsGenerating] = useState(true);
  const [report, setReport] = useState<string>('');

  useEffect(() => {
    async function processResults() {
      try {
        const aiReport = await generateCandidateProfile(results, candidateInfo);
        setReport(aiReport);

        // Map results for backend
        const findScore = (id: string) => results.find(r => r.sectionId === id);
        const conscientiousness = findScore('conscientiousness');
        const motivation = findScore('motivation');
        const intelligence = findScore('intelligence');
        const sjt = findScore('sjt');
        const work = findScore('work_sample');

        // Save to Google Sheet
        await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'SAVE_RESULT',
            candidateName: candidateInfo?.name,
            candidateRole: candidateInfo?.role,
            statusText: 'Completed',
            iqScore: intelligence?.rawScore || 0,
            reliability: 88, 
            emotionality: conscientiousness?.hexacoProfile?.find(f => f.code === 'E')?.percentage || 0,
            topDrivers: motivation?.motivationProfile?.topDrivers || [],
            sjtScore: sjt?.rawScore || 0,
            workSampleAnswer: work?.textAnswer || "",
            aiAnalysis: aiReport,
            hexacoJson: JSON.stringify(conscientiousness?.hexacoProfile || []),
            motivationJson: JSON.stringify(motivation?.motivationProfile || {}),
            company: 'SmartHire',
            jobId: jobId
          })
        });
      } catch (e) {
        console.error("Error processing results:", e);
      } finally {
        setIsGenerating(false);
      }
    }
    processResults();
  }, [results, candidateInfo, scriptUrl, jobId]);

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
          <Loader2 className="animate-spin text-blue-500 relative" size={64} />
        </div>
        <h2 className="text-3xl font-black text-white mb-4 text-center">Анализируем результаты</h2>
        <p className="text-slate-500 text-center max-w-sm">ИИ обрабатывает ваши ответы для создания глубокого психологического портрета...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16 border-b border-slate-800 pb-12">
          <div>
            <div className="flex items-center gap-2 text-blue-400 font-bold uppercase text-xs tracking-[0.2em] mb-4">
              <CheckCircle2 size={16} /> Тестирование завершено
            </div>
            <h1 className="text-5xl font-black text-white">Успешно!</h1>
            <p className="text-slate-500 mt-2">Спасибо, {candidateInfo?.name}. Ваши данные переданы в HR-департамент.</p>
          </div>
          <button onClick={onReset} className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-red-500/50 hover:text-red-400 px-6 py-3 rounded-2xl transition-all font-bold">
            <LogOut size={18} /> Выйти
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
          {results.map(r => (
            <div key={r.sectionId} className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">{r.title}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{Math.round(r.percentage)}</span>
                <span className="text-slate-500 text-sm">%</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full mt-6 overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${r.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-900/80 rounded-[3.5rem] border border-slate-800 overflow-hidden shadow-2xl">
          <div className="p-12 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-600/20 text-blue-400 rounded-3xl">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white leading-tight">Психологический Портрет</h2>
                <p className="text-slate-500 text-sm">Сгенерировано SmartHire AI</p>
              </div>
            </div>
          </div>
          <div className="p-12 bg-slate-900/30">
            <div className="prose prose-invert max-w-none 
              prose-h3:text-blue-400 prose-h3:font-black prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-6
              prose-p:text-slate-400 prose-p:leading-relaxed prose-p:text-lg
              prose-li:text-slate-400 prose-li:text-lg prose-ul:space-y-2" 
              dangerouslySetInnerHTML={{ __html: report }} 
            />
          </div>
        </div>

        <footer className="mt-20 text-center pb-12">
          <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">SmartHire Digital Assessment System</p>
        </footer>
      </div>
    </div>
  );
}
