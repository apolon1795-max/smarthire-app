import React, { useEffect, useState } from 'react';
import { TestResult, CandidateInfo } from '../types';
import { generateCandidateProfile } from '../services/geminiService';
import { Loader2, Target, CheckCircle, FileCheck, Database, Check, Star, Zap, Shield, Heart, Lightbulb, Users, BarChart2, PieChart, Briefcase } from 'lucide-react';

interface ResultsViewProps {
  results: TestResult[];
  candidateInfo: CandidateInfo | null;
  onReset: () => void;
  scriptUrl: string;
}

// Positive feedback mapping for highest HEXACO score
const POSITIVE_FEEDBACK: Record<string, { title: string; desc: string; icon: React.ReactNode }> = {
  'H': { 
    title: 'Надежный Партнер', 
    desc: 'Вы цените честность и справедливость. Люди знают, что на ваше слово можно положиться.',
    icon: <Shield className="text-emerald-400" size={32} />
  },
  'E': { 
    title: 'Чуткий Наблюдатель', 
    desc: 'Вы обладаете развитым эмоциональным интеллектом и хорошо чувствуете настроение окружающих.',
    icon: <Heart className="text-rose-400" size={32} />
  },
  'X': { 
    title: 'Лидер и Коммуникатор', 
    desc: 'Вы заряжаете энергией команду и уверенно чувствуете себя в центре внимания.',
    icon: <Users className="text-blue-400" size={32} />
  },
  'A': { 
    title: 'Мастер Сотрудничества', 
    desc: 'Вы умеете сглаживать конфликты и создавать комфортную атмосферу в коллективе.',
    icon: <CheckCircle className="text-teal-400" size={32} />
  },
  'C': { 
    title: 'Человек Дела', 
    desc: 'Дисциплина и порядок — ваше второе имя. Вы доводите начатое до конца с высоким качеством.',
    icon: <Star className="text-amber-400" size={32} />
  },
  'O': { 
    title: 'Генератор Идей', 
    desc: 'Вы открыты новому, креативны и нестандартно подходите к решению задач.',
    icon: <Lightbulb className="text-purple-400" size={32} />
  }
};

const ResultsView: React.FC<ResultsViewProps> = ({ results, candidateInfo, onReset, scriptUrl }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  
  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // --- METRICS CALCULATION ---
  const iqResult = results.find(r => r.sectionId === 'intelligence');
  const iqScore = iqResult ? iqResult.rawScore : 0;
  
  const hexacoResult = results.find(r => r.sectionId === 'conscientiousness');
  const hexacoProfile = hexacoResult?.hexacoProfile || [];
  const getHexacoVal = (code: string) => hexacoProfile.find(h => h.code === code)?.average || 0;
  
  // Validity
  const validity = hexacoResult?.validityProfile;
  const antiFakeStatus = validity?.statusLabel || "Unknown";

  // Find Strongest Trait
  let maxScore = -1;
  let strongestTraitCode = 'C'; 
  const factors = ['H', 'E', 'X', 'A', 'C', 'O'];
  
  factors.forEach(code => {
    const val = getHexacoVal(code);
    if (val > maxScore) {
      maxScore = val;
      strongestTraitCode = code;
    }
  });

  const feedback = POSITIVE_FEEDBACK[strongestTraitCode] || POSITIVE_FEEDBACK['C'];

  const hexacoScoresArray = factors.map(code => getHexacoVal(code));
  const scoreC = getHexacoVal('C');
  const scoreH = getHexacoVal('H');
  const scoreE = getHexacoVal('E');

  const reliabilityScore = (scoreC + scoreH) / 2;
  
  let statusText = 'ТРЕБУЕТ ПРОВЕРКИ';
  let statusColor = '#facc15'; // Yellow
  
  if (validity && !validity.attentionPassed) {
    statusText = 'ТЕСТ НЕДОСТОВЕРЕН';
    statusColor = '#94a3b8'; // Grey/Slate
  } else {
    if (iqScore >= 6 && reliabilityScore >= 3.0) {
      statusText = 'РЕКОМЕНДОВАН К НАЙМУ';
      statusColor = '#4ade80'; // Green
    }
    if (iqScore < 4 || reliabilityScore < 2.5) {
      statusText = 'НЕ РЕКОМЕНДОВАН';
      statusColor = '#f87171'; // Red
    }
  }

  const motResult = results.find(r => r.sectionId === 'motivation');
  const motivationBlocks = motResult?.motivationProfile?.blocks || [];
  const topDrivers = motResult?.motivationProfile?.topDrivers || [];

  const sjtResult = results.find(r => r.sectionId === 'sjt');
  
  // --- EFFECT: GENERATE REPORT ---
  useEffect(() => {
    const processResults = async () => {
      setIsAnalyzing(true);
      const text = await generateCandidateProfile(results, candidateInfo || undefined);
      setAnalysis(text);
      setIsAnalyzing(false);
    };

    processResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- SERVER-SIDE DB SAVE HANDLER ---
  const handleSaveToDatabase = async () => {
    if (isUploading) return;
    setIsUploading(true);
    setUploadStatus('idle');

    const safeName = (candidateInfo?.name || "Candidate").replace(/["\\]/g, '');
    const safeRole = (candidateInfo?.role || "Applicant").replace(/["\\]/g, '');
    
    const payload = {
      candidateName: safeName,
      candidateRole: safeRole,
      fileName: `${safeName} - ${safeRole}.pdf`,
      
      // Metrics
      iqScore: iqScore,
      reliability: reliabilityScore.toFixed(1),
      emotionality: scoreE.toFixed(1),
      antiFakeStatus: antiFakeStatus, // New Field
      
      // Arrays for Charts
      hexacoScores: hexacoScoresArray,
      topDrivers: topDrivers.map(d => ({ name: d.name, score: d.score })),
      
      // Status
      statusText: statusText,
      statusColor: statusColor,
      
      // The Big Text (Analysis)
      aiAnalysis: analysis
    };

    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setUploadStatus('success');
    } catch (err) {
      console.error("Fetch error:", err);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };


  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
        <Loader2 className="animate-spin text-blue-500 mb-6" size={64} />
        <h2 className="text-2xl font-bold text-white mb-2">
          Анализируем результаты...
        </h2>
        <p className="text-slate-400">Составляем паспорт компетенций и прогноз эффективности.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-24 relative">
      
      {/* 1. CANDIDATE VIEW (Visible) */}
      <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-8 relative overflow-hidden z-10">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-blue-500"></div>
        
        <div className="text-center mb-10">
          <div className="mb-6 inline-flex p-4 rounded-full bg-green-500/10 ring-1 ring-green-500/30">
            <FileCheck className="text-green-400" size={48} />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-4">
            Тестирование завершено!
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Спасибо, {candidateInfo?.name.split(' ')[0]}. Мы подготовили для вас краткую сводку ваших сильных сторон.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Card 1: Superpower */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              {feedback.icon}
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-700">
                {feedback.icon}
              </div>
              <h3 className="text-white font-bold text-lg">Ваша сильная сторона</h3>
            </div>
            <h4 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 mb-2">
              {feedback.title}
            </h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              {feedback.desc}
            </p>
          </div>

          {/* Card 2: Motivators */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-700">
                <Target className="text-blue-400" size={24} />
              </div>
              <h3 className="text-white font-bold text-lg">Что вас драйвит</h3>
            </div>
            <div className="space-y-3">
              {topDrivers.map((driver, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-slate-950/50 border border-slate-800/50">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <span className="text-slate-200 font-medium block">{driver.name}</span>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>

        {/* VISUALIZATION: HEXACO PROFILE */}
        {hexacoProfile.length > 0 && (
          <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 mb-10">
            <div className="flex items-center gap-2 mb-6 text-slate-200 font-bold">
              <BarChart2 className="text-purple-400" size={20}/>
              <h3>Детальный Профиль Личности (HEXACO)</h3>
            </div>
            <div className="space-y-4">
              {hexacoProfile.map((factor) => (
                <div key={factor.code} className="group">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 font-medium">{factor.factor}</span>
                    <span className="text-slate-400 font-mono">{factor.average} / 5</span>
                  </div>
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out opacity-80 group-hover:opacity-100
                        ${factor.average > 3.5 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 
                          factor.average > 2.5 ? 'bg-gradient-to-r from-blue-500 to-blue-400' : 
                          'bg-gradient-to-r from-rose-500 to-rose-400'}`}
                      style={{ width: `${(factor.average / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISUALIZATION: MOTIVATION BLOCKS */}
        {motivationBlocks.length > 0 && (
          <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 mb-10">
            <div className="flex items-center gap-2 mb-6 text-slate-200 font-bold">
              <PieChart className="text-amber-400" size={20}/>
              <h3>Структура Мотивации</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {motivationBlocks.map((block) => (
                <div key={block.name} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 text-center">
                   <div className="text-2xl font-bold text-white mb-1">{block.score.toFixed(1)}</div>
                   <div className="text-xs text-slate-400 uppercase tracking-wide">{block.name}</div>
                   <div className="mt-2 h-1 w-full bg-slate-800 rounded-full">
                     <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(block.score / 6) * 100}%` }} />
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* SJT SCORE IF EXISTS */}
        {sjtResult && (
           <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 mb-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Briefcase size={24}/></div>
                 <div>
                    <div className="text-white font-bold">Ситуационные Кейсы</div>
                    <div className="text-slate-400 text-sm">Оценка управленческих решений</div>
                 </div>
              </div>
              <div className="text-2xl font-mono text-white font-bold">
                 {sjtResult.rawScore} <span className="text-sm text-slate-500">баллов</span>
              </div>
           </div>
        )}

        <div className="flex justify-center gap-4">
           <button onClick={onReset} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-all">
             В начало
           </button>
           
           <button 
             onClick={handleSaveToDatabase} 
             disabled={isUploading || uploadStatus === 'success'}
             className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg
               ${uploadStatus === 'success' 
                 ? 'bg-green-600 text-white cursor-default' 
                 : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'}`}
           >
             {isUploading ? (
               <><Loader2 className="animate-spin" size={20}/> Сохраняем...</>
             ) : uploadStatus === 'success' ? (
               <><Check size={20}/> Сохранено в Базу</>
             ) : (
               <><Database size={20}/> Сохранить в Базу</>
             )}
           </button>
        </div>
        
        {uploadStatus === 'success' && (
             <p className="text-green-400 text-sm mt-4 text-center animate-fade-in font-medium">
               Ваши результаты успешно сохранены в таблицу.
             </p>
        )}
      </div>

      {/* 2. DARK MODE PREVIEW */}
      <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-8 sm:p-12 relative overflow-hidden opacity-30 blur-sm pointer-events-none select-none">
         <h2 className="text-2xl font-bold text-white mb-6 text-center">SmartHire Analysis System</h2>
         <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="h-24 bg-slate-800 rounded-xl"></div>
            <div className="h-24 bg-slate-800 rounded-xl"></div>
            <div className="h-24 bg-slate-800 rounded-xl"></div>
         </div>
         <div className="h-40 bg-slate-800 rounded-xl"></div>
      </div>
    </div>
  );
};

export default ResultsView;