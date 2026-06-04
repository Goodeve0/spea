import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRESET_SCENARIOS, type Difficulty } from '@speak-coach/shared';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const DIFFICULTY_EMOJI: Record<Difficulty, string> = {
  beginner: '🌱',
  intermediate: '🌿',
  advanced: '🌳',
};

const SCENARIO_EMOJI: Record<string, string> = {
  interview: '💼',
  restaurant: '🍽️',
  meeting: '📋',
};

export default function ScenarioHub() {
  const navigate = useNavigate();
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('intermediate');

  const handleStart = (scenarioId: string) => {
    localStorage.setItem('scenarioId', scenarioId);
    localStorage.setItem('difficulty', selectedDifficulty);
    navigate('/conversation');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
            <span className="text-3xl">🗣️</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
            Speak Coach
          </h1>
          <p className="text-lg text-gray-500 max-w-md mx-auto">
            AI-powered English speaking practice. Pick a scenario and start talking!
          </p>
        </div>

        {/* Difficulty selector */}
        <div className="flex justify-center gap-3 mb-10">
          {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDifficulty(d)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                selectedDifficulty === d
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {DIFFICULTY_EMOJI[d]} {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>

        {/* Scenario cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRESET_SCENARIOS.map((scenario) => (
            <div
              key={scenario.id}
              className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-indigo-200 cursor-pointer"
              onClick={() => handleStart(scenario.id)}
            >
              {/* Card top accent */}
              <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
              
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{SCENARIO_EMOJI[scenario.id] ?? '🎯'}</span>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{scenario.title}</h2>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedDifficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                      selectedDifficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {DIFFICULTY_LABELS[selectedDifficulty]}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{scenario.description}</p>
                
                <div className="text-xs text-gray-400 mb-4 line-clamp-2">
                  <span className="font-medium text-gray-500">Goal:</span> {scenario.goal}
                </div>
                
                <button className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-all group-hover:shadow-md">
                  Start Practice →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full text-sm text-amber-700">
            <span>💡</span>
            <span>Tip: Use Chrome browser for the best speech recognition experience</span>
          </div>
        </div>
      </div>
    </div>
  );
}
