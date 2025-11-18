"use client";
import { useState } from "react";
import { formatMoney } from "../../../lib/format";

type PropertyType = "DUPLEX" | "TRIPLEX" | "SIXPLEX" | "TOUR_50" | "TOUR_100" | "GRATTE_CIEL" | "VILLAGE_FUTURISTE";

interface PropertyMenuProps {
  templates: Array<{
    id: string;
    name: string;
    city: string;
    price: number;
    baseRent: number;
    units?: number;
  }>;
  onSelectProperty: (templateId: string, quantity: number) => void;
}

const PROPERTY_TYPES: Array<{ value: PropertyType; label: string; units: number | "range" }> = [
  { value: "DUPLEX", label: "Duplex", units: 2 },
  { value: "TRIPLEX", label: "Triplex", units: 3 },
  { value: "SIXPLEX", label: "6-plex", units: 6 },
  { value: "TOUR_50", label: "Tour 50 logements", units: 50 },
  { value: "TOUR_100", label: "Tour 100 logements", units: 100 },
  { value: "GRATTE_CIEL", label: "Gratte-ciel (400+ log.)", units: 400 },
  { value: "VILLAGE_FUTURISTE", label: "Village futuriste (800+ log.)", units: 800 },
];

export default function PropertyMenu({ templates, onSelectProperty }: PropertyMenuProps) {
  const [selectedType, setSelectedType] = useState<PropertyType>("SIXPLEX");
  const [quantity, setQuantity] = useState<number>(1);
  const [showPurchaseDetails, setShowPurchaseDetails] = useState(false);

  // Filtrer les templates selon le type sélectionné
  const getTemplatesByType = (type: PropertyType) => {
    const typeConfig = PROPERTY_TYPES.find(t => t.value === type);
    if (!typeConfig) return [];
    
    if (type === "GRATTE_CIEL") {
      return templates.filter(t => (t.units || 0) >= 400 && (t.units || 0) < 800);
    } else if (type === "VILLAGE_FUTURISTE") {
      return templates.filter(t => (t.units || 0) >= 800);
    } else if (type === "TOUR_50") {
      return templates.filter(t => (t.units || 0) === 50);
    } else if (type === "TOUR_100") {
      return templates.filter(t => (t.units || 0) === 100);
    } else {
      return templates.filter(t => (t.units || 0) === typeConfig.units);
    }
  };

  const availableTemplates = getTemplatesByType(selectedType);
  const selectedTemplate = availableTemplates[0]; // Prend le premier disponible

  const handleConfirmPurchase = () => {
    if (selectedTemplate) {
      setShowPurchaseDetails(true);
    }
  };

  const handleFinalPurchase = () => {
    if (selectedTemplate) {
      onSelectProperty(selectedTemplate.id, quantity);
      setShowPurchaseDetails(false);
      setQuantity(1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-600/60 bg-sky-900/20 p-4 space-y-4">
        <h3 className="text-lg font-semibold text-sky-200">Menu d'achat immobilier</h3>
        
        {/* Sélection du type d'immeuble */}
        <div className="space-y-2">
          <label className="text-sm text-neutral-300 font-medium">Type d'immeuble</label>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value as PropertyType);
              setShowPurchaseDetails(false);
            }}
            className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-white"
          >
            {PROPERTY_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Nombre d'immeubles */}
        <div className="space-y-2">
          <label className="text-sm text-neutral-300 font-medium">
            Nombre d'immeubles (disponibles: {availableTemplates.length})
          </label>
          <input
            type="number"
            min="1"
            max={Math.min(10, availableTemplates.length)}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
            className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-white"
          />
        </div>

        {/* Aperçu du bien sélectionné */}
        {selectedTemplate && (
          <div className="rounded bg-neutral-900/50 border border-neutral-700 p-3 space-y-1">
            <p className="text-sm font-semibold text-neutral-200">{selectedTemplate.name}</p>
            <p className="text-xs text-neutral-400">{selectedTemplate.city}</p>
            <p className="text-sm text-neutral-300">Prix: {formatMoney(selectedTemplate.price)}</p>
            <p className="text-sm text-neutral-300">
              Loyer: {formatMoney(selectedTemplate.baseRent)}
              {selectedTemplate.units && selectedTemplate.units > 1 ? 
                ` × ${selectedTemplate.units} logements = ${formatMoney(selectedTemplate.baseRent * selectedTemplate.units)}` 
                : ""}
            </p>
          </div>
        )}

        {!availableTemplates.length && (
          <p className="text-sm text-amber-400">
            Aucun immeuble de ce type disponible. Utilisez les boutons de refill pour ajouter du stock.
          </p>
        )}

        {/* Bouton pour afficher les détails */}
        <button
          onClick={handleConfirmPurchase}
          disabled={!availableTemplates.length}
          className="w-full px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-700 disabled:cursor-not-allowed font-semibold"
        >
          {showPurchaseDetails ? "Détails affichés" : "Voir les détails d'achat"}
        </button>
      </div>

      {/* Bloc de détails d'achat (affiché conditionnellement) */}
      {showPurchaseDetails && selectedTemplate && (
        <div className="rounded-xl border border-emerald-600/60 bg-emerald-900/20 p-4 space-y-3 animate-fade-in">
          <h4 className="text-lg font-semibold text-emerald-200">Détails de l'achat</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-300">Prix de l'immeuble:</span>
              <span className="font-semibold text-white">{formatMoney(selectedTemplate.price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-300">Mise de fonds (20%):</span>
              <span className="font-semibold text-white">{formatMoney(selectedTemplate.price * 0.2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-300">Hypothèque (80%):</span>
              <span className="font-semibold text-amber-300">{formatMoney(selectedTemplate.price * 0.8)}</span>
            </div>
            
            {quantity > 1 && (
              <>
                <hr className="border-neutral-700 my-2" />
                <div className="flex justify-between">
                  <span className="text-neutral-300">Total pour {quantity} immeubles:</span>
                  <span className="font-bold text-white">{formatMoney(selectedTemplate.price * quantity)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-300">Mise de fonds totale:</span>
                  <span className="font-bold text-white">{formatMoney(selectedTemplate.price * 0.2 * quantity)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-300">Hypothèque totale:</span>
                  <span className="font-bold text-amber-300">{formatMoney(selectedTemplate.price * 0.8 * quantity)}</span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleFinalPurchase}
            className="w-full px-4 py-3 rounded bg-emerald-600 hover:bg-emerald-500 font-bold text-lg"
          >
            Confirmer l'achat
          </button>
        </div>
      )}
    </div>
  );
}
