'use client';

import { useState, useMemo } from 'react';
import { QuizCategory, QUIZ_CATEGORIES, CATEGORY_GROUPS, CATEGORY_GROUP_LABELS, getCategoryInfo } from '../lib/quizCategories';

interface CategorySelectorProps {
  onStart: (selectedCategories: QuizCategory[]) => void;
  onCancel: () => void;
  availableCategories?: QuizCategory[];
  defaultSelected?: QuizCategory[];
  categoryCounts?: Record<string, number>; // Total questions per category
}

/**
 * Composant de sélection de catégories avant de démarrer un quiz
 * Permet au joueur de choisir les thèmes de questions qui l'intéressent
 */
export default function CategorySelector({
  onStart,
  onCancel,
  availableCategories,
  defaultSelected = [],
  categoryCounts = {},
}: CategorySelectorProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<QuizCategory>>(
    new Set(defaultSelected)
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['finance']));

  // Filtrer les catégories disponibles
  const filteredCategories = useMemo(() => {
    if (!availableCategories) return QUIZ_CATEGORIES;
    return QUIZ_CATEGORIES.filter(cat => availableCategories.includes(cat.id));
  }, [availableCategories]);

  // Organiser par groupes
  const categoriesByGroup = useMemo(() => {
    const groups: Record<string, typeof filteredCategories> = {};
    Object.entries(CATEGORY_GROUPS).forEach(([groupKey, categoryIds]) => {
      groups[groupKey] = filteredCategories.filter(cat => 
        (categoryIds as readonly string[]).includes(cat.id)
      );
    });
    return groups;
  }, [filteredCategories]);

  const toggleCategory = (categoryId: QuizCategory) => {
    const count = categoryCounts[categoryId] || 0;
    if (count < 20) return; // Prevent selection if not enough questions

    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
    } else {
      newSelected.add(categoryId);
    }
    setSelectedCategories(newSelected);
  };

  const selectAll = () => {
    // Only select categories with enough questions
    const validCategories = filteredCategories
      .filter(cat => (categoryCounts[cat.id] || 0) >= 20)
      .map(cat => cat.id);
    setSelectedCategories(new Set(validCategories));
  };

  const clearAll = () => {
    setSelectedCategories(new Set());
  };

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const selectGroupCategories = (groupKey: string) => {
    const groupCategories = categoriesByGroup[groupKey] || [];
    const newSelected = new Set(selectedCategories);
    groupCategories.forEach(cat => {
      if ((categoryCounts[cat.id] || 0) >= 20) {
        newSelected.add(cat.id);
      }
    });
    setSelectedCategories(newSelected);
  };

  const handleStart = () => {
    if (selectedCategories.size > 0) {
      onStart(Array.from(selectedCategories));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-gradient-to-b from-neutral-900 to-neutral-950 rounded-xl border-2 border-purple-500/30 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-900/90 to-pink-900/90 backdrop-blur-sm p-6 border-b border-purple-500/30">
          <h2 className="text-2xl font-bold text-white mb-2">
            🎯 Choisis tes catégories
          </h2>
          <p className="text-purple-200 text-sm">
            Sélectionne au moins une catégorie pour personnaliser ton quiz
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-white font-semibold">
              {selectedCategories.size} catégorie{selectedCategories.size > 1 ? 's' : ''} sélectionnée{selectedCategories.size > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="p-4 bg-neutral-900/50 border-b border-neutral-800 flex gap-3">
          <button
            onClick={selectAll}
            className="flex-1 px-4 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-all"
          >
            ✅ Tout sélectionner
          </button>
          <button
            onClick={clearAll}
            className="flex-1 px-4 py-2 rounded-lg bg-neutral-700/20 hover:bg-neutral-700/30 border border-neutral-600/30 text-neutral-300 text-sm font-medium transition-all"
          >
            ❌ Tout effacer
          </button>
        </div>

        {/* Catégories par groupes */}
        <div className="p-4 space-y-4">
          {Object.entries(categoriesByGroup).map(([groupKey, categories]) => {
            if (categories.length === 0) return null;
            const groupInfo = CATEGORY_GROUP_LABELS[groupKey as keyof typeof CATEGORY_GROUP_LABELS];
            const isExpanded = expandedGroups.has(groupKey);
            const groupSelectedCount = categories.filter(cat => selectedCategories.has(cat.id)).length;

            return (
              <div key={groupKey} className="border border-neutral-800 rounded-lg overflow-hidden">
                {/* Group header */}
                <div
                  className="flex items-center justify-between p-4 bg-neutral-900/50 cursor-pointer hover:bg-neutral-800/50 transition-all"
                  onClick={() => toggleGroup(groupKey)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{groupInfo.icon}</span>
                    <div>
                      <h3 className="font-bold text-white">{groupInfo.label}</h3>
                      <p className="text-xs text-neutral-400">
                        {groupSelectedCount}/{categories.length} sélectionnée{groupSelectedCount > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectGroupCategories(groupKey);
                      }}
                      className="px-3 py-1 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-xs font-medium transition-all"
                    >
                      Tout
                    </button>
                    <span className="text-neutral-500 text-xl">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {/* Group categories */}
                {isExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-neutral-950/30">
                    {categories.map((category) => {
                      const isSelected = selectedCategories.has(category.id);
                      const count = categoryCounts[category.id] || 0;
                      const isDisabled = count < 20;
                      
                      return (
                        <button
                          key={category.id}
                          onClick={() => toggleCategory(category.id)}
                          disabled={isDisabled}
                          className={`
                            relative p-4 rounded-lg border-2 transition-all text-left
                            ${isDisabled 
                              ? 'bg-neutral-900/30 border-neutral-800 opacity-60 cursor-not-allowed grayscale' 
                              : isSelected
                                ? `bg-gradient-to-br ${category.color} border-white/50 shadow-lg scale-105`
                                : 'bg-neutral-900/50 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800/50'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-3xl">{category.icon}</span>
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-bold text-sm mb-1 ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                                {category.label}
                              </h4>
                              <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-neutral-400'}`}>
                                {category.description}
                              </p>
                              <div className={`mt-2 text-[10px] font-mono ${isDisabled ? 'text-red-400' : 'text-neutral-500'}`}>
                                {isDisabled ? 'Bientôt disponible' : `${count} questions`}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                              <span className="text-green-600 text-sm">✓</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer avec boutons d'action */}
        <div className="sticky bottom-0 bg-gradient-to-t from-neutral-900 to-neutral-900/95 backdrop-blur-sm p-6 border-t border-neutral-800 flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white font-semibold transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleStart}
            disabled={selectedCategories.size === 0}
            className={`
              flex-1 px-6 py-3 rounded-lg font-bold text-white transition-all
              ${selectedCategories.size > 0
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/30'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }
            `}
          >
            {selectedCategories.size > 0
              ? `🚀 Commencer le quiz (${selectedCategories.size} catégorie${selectedCategories.size > 1 ? 's' : ''})`
              : '⚠️ Sélectionne au moins 1 catégorie'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
