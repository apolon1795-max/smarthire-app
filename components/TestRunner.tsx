
import React, { useState } from 'react';
import { Question, TestSection, UserAnswers } from '../types.ts';
import { ArrowRight, CheckCircle, Circle, ArrowLeft, AlignLeft, Briefcase } from 'lucide-react';

interface TestRunnerProps {
  section: TestSection;
  onComplete: (sectionId: string, answers: UserAnswers) => void;
  onExit: () => void;
}

// Fix: Add default export and full component implementation to resolve 'no default export' error
export default function TestRunner({ section, onComplete, onExit }: TestRunnerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<UserAnswers>({});

  const handleAnswer = (qId: string, value: number | string) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleNext = () => {
    if (section.displayMode === 'step') {
      if (currentStep < section.questions.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        onComplete(section.id, answers);
      }
    } else {
      onComplete(section.id, answers);
    }
  };

  const currentQuestion = section.questions[currentStep];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors uppercase text-xs font-bold tracking-widest">
            <ArrowLeft size={16} /> Назад
          </button>
          <div className="text-blue-500 font-black text-sm uppercase tracking-widest">
            {section.title} {section.displayMode === 'step' && `• ${currentStep + 1} / ${section.questions.length}`}
          </div>
        </header>

        <div className="space-y-12">
          {section.displayMode === 'step' ? (
            <div className="bg-slate-900/50 p-10 rounded-[2.5rem] border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {currentQuestion.imageUrl && (
                <div className="mb-8 rounded-2xl overflow-hidden border border-slate-800 bg-white p-2">
                  <img src={currentQuestion.imageUrl} alt="Question" className="w-full h-auto max-h-[400px] object-contain" />
                </div>
              )}
              
              <p className="text-2xl font-bold mb-10 leading-relaxed text-white whitespace-pre-wrap">{currentQuestion.text}</p>
              
              <div className="space-y-4">
                {currentQuestion.type === 'single-choice' && currentQuestion.options?.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleAnswer(currentQuestion.id, opt.value)}
                    className={`w-full text-left p-6 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                      answers[currentQuestion.id] === opt.value 
                        ? 'bg-blue-600/10 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${answers[currentQuestion.id] === opt.value ? 'border-blue-500 bg-blue-500' : 'border-slate-700'}`}>
                      {answers[currentQuestion.id] === opt.value && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="font-bold">{opt.text}</span>
                  </button>
                ))}

                {currentQuestion.type === 'likert' && (
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6 py-8">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Не согласен</span>
                    <div className="flex gap-2 md:gap-4">
                      {[1, 2, 3, 4, 5, 6].slice(0, section.scaleMax || 5).map(v => (
                        <button
                          key={v}
                          onClick={() => handleAnswer(currentQuestion.id, v)}
                          className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-2 flex items-center justify-center text-lg font-black transition-all ${
                            answers[currentQuestion.id] === v
                              ? 'bg-blue-600 border-blue-500 text-white scale-110 shadow-lg shadow-blue-500/20'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Согласен</span>
                  </div>
                )}

                {currentQuestion.type === 'text' && (
                  <textarea
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-white outline-none focus:border-blue-500 min-h-[300px] text-lg leading-relaxed resize-none"
                    placeholder="Введите ваш ответ здесь..."
                    onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                    value={answers[currentQuestion.id] as string || ''}
                  />
                )}
              </div>

              <div className="mt-12 flex justify-end">
                <button
                  onClick={handleNext}
                  disabled={answers[currentQuestion.id] === undefined && currentQuestion.type !== 'text'}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black px-10 py-5 rounded-2xl transition-all flex items-center gap-3"
                >
                  {currentStep === section.questions.length - 1 ? 'ЗАВЕРШИТЬ' : 'СЛЕДУЮЩИЙ'}
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {section.questions.map((q, idx) => (
                <div key={q.id} className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800">
                  <p className="text-lg font-bold mb-6 text-white">{idx + 1}. {q.text}</p>
                  <div className="flex justify-between items-center gap-2 md:gap-4 overflow-x-auto pb-2">
                    {[1, 2, 3, 4, 5, 6].slice(0, section.scaleMax || 5).map(v => (
                      <button
                        key={v}
                        onClick={() => handleAnswer(q.id, v)}
                        className={`w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all ${
                          answers[q.id] === v
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-8">
                <button
                  onClick={handleNext}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-[2rem] transition-all shadow-xl shadow-blue-500/10"
                >
                  ОТПРАВИТЬ ВСЕ ОТВЕТЫ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
