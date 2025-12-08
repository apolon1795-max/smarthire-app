
import React, { useState } from 'react';
import { generateCustomQuestions } from '../services/geminiService';
import { CustomTestConfig } from '../types';
import { Loader2, Save, Wand2, Copy, Check, ExternalLink, ArrowLeft, CheckCircle, Edit3, Play } from 'lucide-react';

interface HrBuilderProps {
  scriptUrl: string;
  onExit: () => void;
  onTestPreview: (config: CustomTestConfig) => void;
}

const HrBuilder: React.FC<HrBuilderProps> = ({ scriptUrl, onExit, onTestPreview }) => {
  const [role, setRole] = useState('');
  const [challenges, setChallenges] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<CustomTestConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLink, setSavedLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    const config = await generateCustomQuestions(role, challenges);
    if (config) {
      setGeneratedConfig({ ...config, jobTitle: role, jobId: '' });
    }
    setIsGenerating(false);
  };

  // --- EDITING HANDLERS ---
  const handleUpdateQuestion = (index: number, newText: string) => {
    if (!generatedConfig) return;
    const newQuestions = [...generatedConfig.sjtQuestions];
    newQuestions[index].text = newText;
    setGeneratedConfig({ ...generatedConfig, sjtQuestions: newQuestions });
  };

  const handleUpdateOption = (qIndex: number, oIndex: number, field: 'text' | 'value', value: string | number) => {
    if (!generatedConfig) return;
    const newQuestions = [...generatedConfig.sjtQuestions];
    const option = newQuestions[qIndex].options![oIndex];
    
    if (field === 'text') option.text = value as string;
    if (field === 'value') option.value = parseInt(value as string) || 0;
    
    setGeneratedConfig({ ...generatedConfig, sjtQuestions: newQuestions });
  };

  const handleUpdateWorkSample = (newText: string) => {
    if (!generatedConfig) return;
    setGeneratedConfig({ 
      ...generatedConfig, 
      workSampleQuestion: { ...generatedConfig.workSampleQuestion, text: newText } 
    });
  };

  // --- SAVE & PREVIEW ---
  const handleSave = async () => {
    if (!generatedConfig) return;
    setIsSaving(true);
    
    const payload = {
      action: "SAVE_CONFIG",
      jobTitle: role,
      config: generatedConfig
    };

    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        const baseUrl = window.location.href.split('?')[0];
        const link = `${baseUrl}?jobId=${data.jobId}`;
        setSavedLink(link);
      }
    } catch (e) {
      console.error("Save error", e);
      alert("Ошибка сохранения. Убедитесь, что скрипт обновлен.");
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(savedLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto bg-slate-900 min-h-screen p-6 sm:p-10 text-slate-100">
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            Конструктор Вакансий
          </h1>
          <p className="text-slate-400 text-sm mt-1">Создайте, отредактируйте и опубликуйте тест</p>
        </div>
        <div className="flex gap-3">
           {generatedConfig && (
             <button 
                onClick={() => onTestPreview(generatedConfig)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-bold transition-all shadow-lg shadow-blue-900/20"
             >
               <Play size={18} fill="currentColor" /> Проверить тест прямо сейчас
             </button>
           )}
           <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-800 px-4 py-2 rounded-lg">
             <ArrowLeft size={18} /> Выход
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: INPUT */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 sticky top-6">
            <h2 className="text-xl font-bold mb-4 text-white">1. Параметры</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2 text-blue-300">Название Вакансии</label>
                <input 
                  value={role} onChange={e => setRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 focus:border-blue-500 outline-none transition-colors"
                  placeholder="Напр. Директор по маркетингу"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-blue-300">Ключевые вызовы</label>
                <textarea 
                  value={challenges} onChange={e => setChallenges(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 h-32 focus:border-blue-500 outline-none transition-colors text-sm"
                  placeholder="Опишите проблемы..."
                />
              </div>
              <button 
                onClick={handleGenerate} disabled={isGenerating || !role}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={20} />}
                Сгенерировать (AI)
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: EDITOR */}
        <div className="lg:col-span-8 flex flex-col h-full">
           <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 flex-grow">
            <h2 className="text-xl font-bold mb-6 text-white flex justify-between items-center">
              2. Редактор Теста
              {generatedConfig && <span className="text-xs bg-slate-700 text-slate-300 px-3 py-1 rounded-full flex items-center gap-1"><Edit3 size={12}/> Режим редактирования</span>}
            </h2>
            
            {!generatedConfig ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 opacity-50 border-2 border-dashed border-slate-700 rounded-xl">
                  <Wand2 size={48} className="mb-4" />
                  <p>Заполните форму слева для генерации вопросов</p>
                </div>
            ) : (
                <div className="space-y-8">
                  {/* SJT QUESTIONS */}
                  <div className="space-y-6">
                    <h3 className="font-bold text-blue-400 uppercase text-sm tracking-wider border-b border-slate-700 pb-2">SJT: Ситуационные Кейсы</h3>
                    {generatedConfig.sjtQuestions.map((q, i) => (
                      <div key={i} className="bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-sm">
                        <div className="flex gap-3 mb-4">
                          <span className="bg-slate-800 text-slate-400 w-6 h-6 flex items-center justify-center rounded-full text-xs shrink-0 font-mono">{i+1}</span>
                          <textarea 
                            value={q.text}
                            onChange={(e) => handleUpdateQuestion(i, e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 text-sm focus:border-blue-500 outline-none resize-y min-h-[80px]"
                          />
                        </div>
                        <div className="space-y-3 pl-9">
                          {q.options?.map((o, optIndex) => (
                            <div key={o.id} className="flex gap-2 items-start">
                               <input 
                                 type="number" min="0" max="2"
                                 value={o.value}
                                 onChange={(e) => handleUpdateOption(i, optIndex, 'value', e.target.value)}
                                 className={`w-12 bg-slate-950 border rounded-lg p-2 text-center text-xs font-bold focus:border-blue-500 outline-none
                                   ${o.value === 2 ? 'border-green-500/50 text-green-400' : 'border-slate-800 text-slate-500'}`}
                                 title="Баллы (0-2)"
                               />
                               <input 
                                 value={o.text}
                                 onChange={(e) => handleUpdateOption(i, optIndex, 'text', e.target.value)}
                                 className="flex-grow bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-400 text-sm focus:border-blue-500 outline-none focus:text-slate-200 transition-colors"
                               />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* WORK SAMPLE */}
                  <div className="space-y-4 pt-4 border-t border-slate-700">
                    <h3 className="font-bold text-purple-400 uppercase text-sm tracking-wider">Work Sample: Практика</h3>
                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
                      <label className="block text-xs text-slate-500 mb-2">Инструкция для кандидата:</label>
                      <textarea 
                        value={generatedConfig.workSampleQuestion.text}
                        onChange={(e) => handleUpdateWorkSample(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 text-sm focus:border-purple-500 outline-none resize-y min-h-[100px]"
                      />
                    </div>
                  </div>

                  {/* SAVE BUTTON AREA */}
                  <div className="mt-8 pt-6 border-t border-slate-800">
                    {!savedLink ? (
                      <button 
                        onClick={handleSave} disabled={isSaving}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20"
                      >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                        Сохранить Вакансию в Облако
                      </button>
                    ) : (
                      <div className="bg-slate-950 border border-green-500/30 p-6 rounded-2xl animate-fade-in relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                        <h3 className="text-green-400 font-bold mb-1 flex items-center gap-2"><CheckCircle size={18}/> Вакансия опубликована!</h3>
                        <p className="text-slate-400 text-sm mb-4">Ссылка для кандидатов:</p>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-grow bg-slate-900 border border-slate-700 rounded-lg flex items-center px-3 py-2 overflow-hidden">
                            <code className="text-blue-300 font-mono text-sm whitespace-nowrap overflow-x-auto custom-scrollbar">
                              {savedLink}
                            </code>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={copyToClipboard} className="bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg transition-colors" title="Копировать">
                              {copySuccess ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
                            </button>
                            <a 
                              href={savedLink} 
                              target="_blank" 
                              rel="noreferrer"
                              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm transition-colors"
                            >
                              <ExternalLink size={18} /> Проверить
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HrBuilder;
