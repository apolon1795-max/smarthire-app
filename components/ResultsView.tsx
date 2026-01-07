
import React, { useEffect, useState, useRef } from 'react';
import { TestResult, CandidateInfo, BenchmarkData } from '../types';
import { generateCandidateProfile, SCRIPT_URL } from '../services/geminiService';
import { Loader2, Target, CheckCircle, FileCheck, Database, Check, Star, Zap, Shield, Heart, Lightbulb, Users, BarChart2, PieChart, Briefcase, Award } from 'lucide-react';

interface ResultsViewProps {
  results: TestResult[];
  candidateInfo: CandidateInfo | null;
  onReset: () => void;
  scriptUrl: string;
}

const POSITIVE_FEEDBACK: Record<string, { title: string; desc: string; icon: React.ReactNode }> = {
  'H': { title: 'Надежный Партнер', desc: 'Вы цените честность и справедливость. Люди знают, что на ваше слово можно положиться.', icon: <Shield className="text-emerald-400" size={32} /> },
  'E': { title: 'Чуткий Наблюдатель', desc: 'Вы обладаете развитым эмоциональным интеллектом и хорошо чувствуете настроение окружающих.', icon: <Heart className="text-rose-400" size={32} /> },
  'X': { title: 'Лидер и Коммуникатор', desc: 'Вы заряжаете энергией команду и уверенно чувствуете себя в центре внимания.', icon: <Users className="text-blue-400" size={32} /> },
  'A': { title: 'Мастер Сотрудничества', desc: 'Вы умеете сглаживать конфликты и создавать комфортную атмосферу в коллективе.', icon: <CheckCircle className="text-teal-400" size={32} /> },
  'C': { title: 'Человек Дела', desc: 'Дисциплина и порядок — ваше второе имя. Вы доводите начатое до конца с высоким качеством.', icon: <Star className="text-amber-400" size={32} /> },
  'O': { title: 'Генератор Идей', desc: 'Вы открыты новому, креативны и нестандартно подходите к решению задач.', icon: <Lightbulb className="text-purple-400" size={32} /> }
};

const ResultsView: React.FC<ResultsViewProps> = ({ results, candidateInfo, onReset, scriptUrl }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const hasAutoSaved = useRef(false);

  useEffect(() => {
    const fetchBenchmark = async () => {
      const params = new URLSearchParams(window.location.search);
      const jobId = params.get('jobId');
      if (jobId) {
        try {
          const resp = await fetch(`${SCRIPT_URL}?jobId=${jobId}`);
          const config = await resp.json();
          if (config.benchmark) setBenchmark(config.benchmark);
          if (config.company) setCompanyName(config.company);
        } catch(e) {}
      } else {
        // Fallback for HR preview mode
        const savedCompany = localStorage.getItem('sh_company');
        if (savedCompany) setCompanyName(savedCompany);
      }
    };
    fetchBenchmark();
  }, []);

  const iqResult = results.find(r => r.sectionId === 'intelligence');
  const iqScore = iqResult ? iqResult.rawScore : 0;
  const hexacoResult = results.find(r => r.sectionId === 'conscientiousness');
  const hexacoProfile = hexacoResult?.hexacoProfile || [];
  const getHexacoVal = (code: string) => hexacoProfile.find(h => h.code === code)?.average || 0;
  
  // MATCH SCORE CALCULATION
  let matchScore = 0;
  if (benchmark) {
    let diffSum = 0;
    const factors = ['H', 'E', 'X', 'A', 'C', 'O'];
    factors.forEach(f => {
      diffSum += Math.abs(getHexacoVal(f) - (benchmark.hexaco[f] || 3));
    });
    const hexacoMatch = (1 - (diffSum / 18)) * 100;
    const iqMatch = (1 - (Math.abs(iqScore - benchmark.iq) / 12)) * 100;
    matchScore = Math.round((hexacoMatch * 0.7) + (iqMatch * 0.3));
    if (matchScore > 100) matchScore = 100;
    if (matchScore < 0) matchScore = 0;
  }

  const strongestTraitCode = hexacoProfile.sort((a,b) => b.average - a.average)[0]?.code || 'C';
  const feedback = POSITIVE_FEEDBACK[strongestTraitCode] || POSITIVE_FEEDBACK['C'];
  const reliabilityScore = (getHexacoVal('C') + getHexacoVal('H')) / 2;
  
  const motResult = results.find(r => r.sectionId === 'motivation');
  const topDrivers = motResult?.motivationProfile?.topDrivers || [];

  useEffect(() => {
    const processResults = async () => {
      setIsAnalyzing(true);
      const text = await generateCandidateProfile(results, candidateInfo || undefined);
      setAnalysis(text);
      setIsAnalyzing(false);
    };
    processResults();
  }, [results, candidateInfo]);

  useEffect(() => {
    if (!isAnalyzing && analysis && !hasAutoSaved.current) {
      handleSaveToDatabase();
      hasAutoSaved.current = true;
    }
  }, [isAnalyzing, analysis]);

  const handleSaveToDatabase = async () => {
    setIsUploading(true);
    const hexacoMap: Record<string, number> = {};
    hexacoProfile.forEach(h => hexacoMap[h.code] = h.average);

    const payload = {
      action: "SAVE_RESULT",
      company: companyName, // Added company isolation
      candidateName: candidateInfo?.name || "Candidate",
      candidateRole: candidateInfo?.role || "Applicant",
      iqScore,
      reliability: reliabilityScore.toFixed(1),
      emotionality: getHexacoVal('E').toFixed(1),
      hexacoScoresMap: hexacoMap,
      topDrivers: topDrivers.map(d => ({ name: d.name, score: d.score })),
      statusText: matchScore > 0 ? `Match: ${matchScore}%` : "Завершено",
      aiAnalysis: analysis,
      sjtScore: results.find(r => r.sectionId === 'sjt')?.rawScore || 0,
      workSampleAnswer: results.find(r => r.sectionId === 'work_sample')?.textAnswer || ""
    };

    try {
      await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
      setUploadStatus('success');
    } catch (err) { setUploadStatus('error'); }
    finally { setIsUploading(false); }
  };

  if (isAnalyzing) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-blue-500 mb-6" size={64} /><h2 className="text-2xl font-bold text-white">Генерируем паспорт компетенций...</h2></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-24 px-4">
      <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black text-white mb-2">РЕЗУЛЬТАТЫ ОЦЕНКИ</h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">{candidateInfo?.name} • {candidateInfo?.role}</p>
            {companyName && <div className="mt-2 inline-block px-3 py-1 bg-blue-500/10 rounded-lg text-[10px] font-black text-blue-400 border border-blue-500/20 uppercase tracking-widest">{companyName}</div>}
          </div>
          
          {benchmark && (
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative bg-slate-950 border-2 border-blue-500/50 rounded-3xl p-6 text-center min-w-[180px]">
                <div className="text-xs font-black text-blue-400 uppercase tracking-tighter mb-1">Match Score</div>
                <div className="text-5xl font-black text-white">{matchScore}%</div>
                <div className="text-[10px] text-slate-500 mt-2 font-bold uppercase">Схожесть с эталоном</div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">{feedback.icon}</div>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-400 border border-blue-500/20">{feedback.icon}</div>
              <h3 className="text-white font-bold">Главный талант</h3>
            </div>
            <h4 className="text-2xl font-black text-white mb-3">{feedback.title}</h4>
            <p className="text-slate-400 text-sm leading-relaxed">{feedback.desc}</p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-purple-600/10 rounded-2xl text-purple-400 border border-purple-500/20"><Zap size={28}/></div>
              <h3 className="text-white font-bold">Ключевые драйверы</h3>
            </div>
            <div className="space-y-3">
              {topDrivers.map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-[10px] font-black flex items-center justify-center">{i+1}</div>
                  <span className="text-slate-200 text-sm font-bold">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {hexacoProfile.length > 0 && (
          <div className="bg-slate-950 rounded-3xl p-8 border border-slate-800 mb-12">
            <div className="flex items-center gap-3 mb-8">
              <BarChart2 className="text-blue-500" size={24}/>
              <h3 className="text-white font-bold text-lg">Личностный профиль (HEXACO)</h3>
            </div>
            <div className="space-y-6">
              {hexacoProfile.map((f) => {
                const benchVal = benchmark?.hexaco[f.code] || 0;
                return (
                  <div key={f.code} className="relative">
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
                      <span className="text-slate-400">{f.factor}</span>
                      <span className="text-white">{f.average.toFixed(1)} / 5</span>
                    </div>
                    <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden relative border border-slate-800">
                      {/* Линия эталона */}
                      {benchVal > 0 && (
                        <div 
                          className="absolute h-full w-1 bg-amber-400 z-10 shadow-[0_0_10px_rgba(251,191,36,0.8)]" 
                          style={{ left: `${(benchVal / 5) * 100}%` }}
                          title="Линия эталона"
                        ></div>
                      )}
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${(f.average / 5) * 100}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {benchmark && (
                <div className="flex items-center gap-2 mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                   <div className="w-3 h-1 bg-amber-400"></div> Эталон вакансии
                </div>
              )}
            </div>
          </div>
        )}

        <div className="prose prose-invert max-w-none bg-slate-950 p-8 rounded-3xl border border-slate-800 mb-12 shadow-inner">
           <div className="flex items-center gap-3 mb-6">
              <Award className="text-blue-500" size={24}/>
              <h3 className="text-white font-bold text-lg m-0">AI-Интерпретация</h3>
           </div>
           <div className="text-slate-300 leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: analysis }} />
        </div>

        <div className="flex justify-center gap-4 pt-6 border-t border-slate-800">
           <button onClick={onReset} className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all">В НАЧАЛО</button>
           <button onClick={() => window.print()} className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-900/40 transition-all flex items-center gap-2">
             ПЕЧАТЬ ОТЧЕТА
           </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
