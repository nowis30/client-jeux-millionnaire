'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  maxHeight?: string;
  itemCount?: number;
}

/**
 * Composant de section rétractable avec compteur d'éléments
 * Permet d'afficher/masquer du contenu avec une animation fluide
 * 
 * @param title - Titre de la section
 * @param children - Contenu à afficher/masquer
 * @param defaultOpen - État initial (ouvert par défaut)
 * @param maxHeight - Hauteur maximale du conteneur (ex: "500px")
 * @param itemCount - Nombre d'éléments dans la section (affiché dans le titre)
 */
export default function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  maxHeight = '500px',
  itemCount
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="w-full mb-6">
      {/* En-tête cliquable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-t-lg hover:from-purple-800/60 hover:to-blue-800/60 transition-all duration-200"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {itemCount !== undefined && (
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm text-white/90 font-semibold">
              {itemCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/70">
            {isOpen ? 'Masquer' : 'Afficher'}
          </span>
          {isOpen ? (
            <ChevronUp className="w-6 h-6 text-white" />
          ) : (
            <ChevronDown className="w-6 h-6 text-white" />
          )}
        </div>
      </button>

      {/* Conteneur rétractable avec animation */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div
          className="bg-gray-900/50 backdrop-blur-sm rounded-b-lg border-t-0 overflow-y-auto custom-scrollbar"
          style={{ maxHeight: isOpen ? maxHeight : '0' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
