
import React, { useState, useRef } from 'react';
import { Question, TestSection, UserAnswers } from '../types';
import { ArrowRight, CheckCircle, Circle, ArrowLeft, AlignLeft, Briefcase } from 'lucide-react';

interface TestRunnerProps {
  section: TestSection;
  onComplete: (sectionId: string, answers: UserAnswers) => void;
  onExit: () => void;
}

const TestRunner: React.FC<TestRunnerProps> = ({ section, onComplete, onExit }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<UserAnswers>({});
  const [selectedOptionIds, setSelectedOptionIds] = useState<{[key: string]: string}>({});
  
  // For scrolling functionality
  const questionRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const maxScale = section.scaleMax || 5;

  const handleAnswer = (questionId: string, value: number | string, optionId?: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (optionId) {
      setSelectedOptionIds(prev => ({ ...prev, [questionId]: optionId }));
    }
  };

  const handleNextStep = () => {
    if (currentQuestionIndex < section.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      onComplete(section.id, answers);
    }
  };

  const handlePrevStep = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleCompleteScroll = () => {
    // Basic validation
    const unanswered = section.questions.filter(q => answers[q.id] === undefined || answers[q.id] === '');
    if (unanswered.length > 0) {
      alert(`Пожалуйста, ответьте на все вопросы. Осталось: ${unanswered.length}`);
      const firstId = unanswered[0].id;
      questionRefs.current[firstId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onComplete(section.id, answers);
  };

  // Helper to format text
  const formatQuestionText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const isHeader = line.startsWith('Вопрос:') || line.startsWith('Правило:') || line.startsWith('Текст:') || line.startsWith('Известно:');
      const className = isHeader 
        ? "text-blue-400 font-bold mb-1 mt-3 first:mt-0" 
        : "text-slate-100 mb-2 leading-relaxed";
      return <p key={i} className={className}>{line}</p>;
    });
  };

  const renderHeader = (title: string, showProgress = false, progressStr = "") => (
    <div className="flex justify-between items-center mb-6">
       <button onClick={onExit} className="flex items-center text-slate-400 hover:text-white transition-colors text-sm font-medium">
        <ArrowLeft size={18} className="mr-1" /> В меню
      </button>
      {showProgress ? (
         <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-800 px-3 py-1 rounded-full">
            {progressStr}
         </span>
      ) : (
         <h2 className="text-lg font-bold text-slate-100 text-right">{title}</h2>
      )}
    </div>
  );

  // --- RENDER SINGLE QUESTION (IQ or SJT Step-by-Step) ---
  if (section.displayMode === 'step') {
    const currentQuestion = section.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex) / section.questions.length) * 100;
    const isCurrentAnswered = answers[currentQuestion.id] !== undefined && answers[currentQuestion.id] !== '';

    return (
      <div className="max-w-4xl mx-auto bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden min-h-[600px] flex flex-col">
        <div className="bg-slate-900 p-6 border-b border-slate-800">
          {renderHeader(section.title, true, `Вопрос ${currentQuestionIndex + 1} / ${section.questions.length}`)}
          <div className="w-full bg-slate-800 rounded-full h-1 mt-4">
            <div className="bg-blue-500 h-1 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          
          {/* QUESTION TEXT / SCENARIO */}
          {currentQuestion.type === 'scenario' ? (
            <div className="mb-8 bg-slate-950 p-6 rounded-xl border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Briefcase size={80} className="text-blue-400"/>
              </div>
              <h3 className="text-blue-400 font-bold uppercase tracking-wider text-xs mb-4 flex items-center gap-2">
                <div className="p-1 bg-blue-900/30 rounded"><Briefcase size={14}/></div> Ситуация
              </h3>
              <div className="text-lg text-slate-200 leading-relaxed font-serif tracking-wide">
                {formatQuestionText(currentQuestion.text)}
              </div>
            </div>
          ) : (
            <div className="text-xl font-medium text-slate-50 mb-8">
              {formatQuestionText(currentQuestion.text)}
            </div>
          )}

          {currentQuestion.imageUrl && (
            <div className="mb-8 p-2 bg-slate-800/50 border border-slate-700 rounded-xl flex justify-center">
               <img src={currentQuestion.imageUrl} alt="Задание" className="max-h-[300px] object-contain rounded-lg"/>
            </div>
          )}

          {/* SINGLE CHOICE / SCENARIO OPTIONS */}
          {(currentQuestion.type === 'single-choice' || currentQuestion.type === 'scenario') && (
            <div className="space-y-3 grid grid-cols-1">
              {currentQuestion.options?.map((option) => {
                const isSelected = selectedOptionIds[currentQuestion.id] === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleAnswer(currentQuestion.id, option.value, option.id)}
                    className={`w-full text-left p-5 rounded-xl border transition-all duration-200 flex items-center group relative overflow-hidden
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-600/10 text-white shadow-lg shadow-blue-900/20' 
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600 text-slate-300'}`}
                  >
                    {isSelected && <div className="absolute left-0 top-0 w-1 h-full bg-blue-500"></div>}
                    <div className={`mr-5 ${isSelected ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'} transition-colors`}>
                      {isSelected ? <CheckCircle size={24} className="fill-blue-500/20" /> : <Circle size={24} />}
                    </div>
                    <span className="text-base sm:text-lg font-medium">{option.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* TEXT INPUT (WORK SAMPLE) */}
          {currentQuestion.type === 'text' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm">
                <AlignLeft size={16}/> Развернутый ответ
              </div>
              <textarea
                value={answers[currentQuestion.id] as string || ''}
                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                placeholder="Напишите ваш ответ здесь..."
                className="w-full h-64 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:border-blue-500 outline-none resize-none text-lg leading-relaxed"
              />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <button
            onClick={handlePrevStep}
            disabled={currentQuestionIndex === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all
              ${currentQuestionIndex === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-white'}`}
          >
            <ArrowLeft size={20} /> Назад
          </button>

          <button
            onClick={handleNextStep}
            disabled={!isCurrentAnswered}
            className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white transition-all shadow-lg
              ${isCurrentAnswered ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
          >
            {currentQuestionIndex === section.questions.length - 1 ? 'Завершить раздел' : 'Следующий вопрос'}
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  // --- SCROLL MODE (Personality/Likert) ---
  // (Existing scroll logic remains mostly the same, handling likert)
  const answeredCount = Object.keys(answers).length;
  const totalCount = section.questions.length;
  const progressPercent = (answeredCount / totalCount) * 100;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-800 p-6 mb-8 sticky top-6 z-20">
        {renderHeader(section.title)}
        <div className="w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-400 h-2 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="space-y-6 pb-24">
        {section.questions.map((q, idx) => (
          <div 
            key={q.id} 
            ref={(el) => { questionRefs.current[q.id] = el; }}
            className={`rounded-2xl p-6 transition-all duration-300 border ${answers[q.id] !== undefined ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900 border-slate-700'}`}
          >
            <div className="flex gap-5">
              <span className="text-slate-500 font-mono text-sm pt-1">{idx+1}</span>
              <div className="w-full">
                <p className="text-lg text-slate-200 font-medium mb-8 leading-snug">{q.text}</p>
                {q.type === 'likert' && (
                  <div className="py-2">
                    <input 
                      type="range" min="1" max={maxScale} step="1"
                      value={(answers[q.id] as number) || Math.ceil(maxScale/2)}
                      onChange={(e) => handleAnswer(q.id, parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between mt-4 text-xs font-bold text-slate-500 uppercase">
                      <span className="text-red-400">Не согласен</span>
                      <span className="text-green-400">Согласен</span>
                    </div>
                    {answers[q.id] && (
                       <div className="mt-4 text-center">
                         <span className="inline-block px-3 py-1 bg-slate-800 text-blue-400 text-sm font-bold rounded-lg border border-slate-700">
                           {answers[q.id]} / {maxScale}
                         </span>
                       </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-950/80 backdrop-blur-lg border-t border-slate-800 flex justify-center z-30">
        <button onClick={handleCompleteScroll} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-10 rounded-full shadow-lg">
          Завершить тестирование
        </button>
      </div>
    </div>
  );
};

export default TestRunner;
