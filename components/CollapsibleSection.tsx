'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  maxHeight?: string;
  itemCount?: number;
}

/**
 * Section rétractable optimisée mobile.
 * Sur téléphone, elle démarre fermée même si la version bureau souhaite
 * l'ouvrir par défaut; cela évite plusieurs écrans de défilement dès l'accueil.
 */
export default function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  maxHeight = '500px',
  itemCount
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 640px)').matches;
    setIsOpen(desktop ? defaultOpen : false);
  }, [defaultOpen]);

  return (
    <div className="mb-3 w-full sm:mb-6">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-purple-950/65 to-slate-900/70 px-3 py-2.5 text-left shadow-lg transition active:scale-[0.995] sm:min-h-14 sm:rounded-t-lg sm:rounded-b-none sm:p-4"
        aria-expanded={isOpen}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <h2 className="truncate text-sm font-black text-white sm:text-xl">{title}</h2>
          {itemCount !== undefined && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/80 sm:px-3 sm:py-1 sm:text-sm">
              {itemCount}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-slate-400">
          <span className="hidden text-xs sm:inline">{isOpen ? 'Masquer' : 'Afficher'}</span>
          {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div
          className="overflow-y-auto rounded-b-2xl border border-t-0 border-white/8 bg-gray-950/55 backdrop-blur-sm custom-scrollbar sm:rounded-b-lg"
          style={{ maxHeight: isOpen ? maxHeight : '0' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
