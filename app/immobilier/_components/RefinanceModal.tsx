"use client";
import { useState } from "react";
import { formatMoney } from "../../../lib/format";

type Property = {
  id: string;
  name: string;
  currentValue: number;
  remainingBalance: number;
  monthlyPayment: number;
  interestRate: number;
  quantity: number;
};

interface RefinanceModalProps {
  property: Property;
  onClose: () => void;
  onConfirm: (propertyId: string, newRate: number, newYears: number) => Promise<void>;
}

export default function RefinanceModal({ property, onClose, onConfirm }: RefinanceModalProps) {
  const [newRate, setNewRate] = useState(4.5);
  const [newYears, setNewYears] = useState(25);
  const [processing, setProcessing] = useState(false);

  const calculateNewPayment = () => {
    const monthlyRate = newRate / 100 / 12;
    const numberOfPayments = newYears * 12;
    const loanAmount = property.remainingBalance * property.quantity;
    
    if (monthlyRate === 0) return loanAmount / numberOfPayments;
    
    return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
           (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  };

  const newMonthlyPayment = calculateNewPayment();
  const monthlySavings = (property.monthlyPayment * property.quantity) - newMonthlyPayment;
  const refinanceCost = property.currentValue * property.quantity * 0.02; // 2% du prix comme frais

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await onConfirm(property.id, newRate, newYears);
      onClose();
    } catch (error) {
      console.error("Erreur lors du refinancement:", error);
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl p-8 max-w-2xl w-full shadow-2xl border-2 border-indigo-500/30">
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-3xl font-bold mb-2 text-neutral-100">🏦 Refinancement</h3>
            <p className="text-neutral-400">{property.name} (×{property.quantity})</p>
          </div>

          {/* Infos actuelles */}
          <div className="bg-neutral-800/50 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-neutral-200 mb-3">📊 Hypothèque actuelle</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-neutral-400">Solde restant</p>
                <p className="font-semibold text-white">{formatMoney(property.remainingBalance * property.quantity)}</p>
              </div>
              <div>
                <p className="text-neutral-400">Taux actuel</p>
                <p className="font-semibold text-white">{property.interestRate.toFixed(2)}%</p>
              </div>
              <div className="col-span-2">
                <p className="text-neutral-400">Paiement mensuel actuel</p>
                <p className="font-semibold text-red-400">{formatMoney(property.monthlyPayment * property.quantity)}</p>
              </div>
            </div>
          </div>

          {/* Nouveaux paramètres */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Nouveau taux d'intérêt: {newRate.toFixed(2)}%
              </label>
              <input
                type="range"
                min="2"
                max="8"
                step="0.25"
                value={newRate}
                onChange={(e) => setNewRate(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-400 mt-1">
                <span>2%</span>
                <span>8%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Nouvelle période: {newYears} ans
              </label>
              <input
                type="range"
                min="15"
                max="30"
                step="5"
                value={newYears}
                onChange={(e) => setNewYears(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-400 mt-1">
                <span>15 ans</span>
                <span>30 ans</span>
              </div>
            </div>
          </div>

          {/* Résumé du refinancement */}
          <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-emerald-200">💰 Aperçu du nouveau prêt</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-300">Nouveau paiement mensuel</span>
                <span className="font-semibold text-white">{formatMoney(newMonthlyPayment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-300">Économie mensuelle</span>
                <span className={`font-semibold ${monthlySavings > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {monthlySavings > 0 ? "+" : ""}{formatMoney(monthlySavings)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-300">Frais de refinancement (2%)</span>
                <span className="font-semibold text-amber-400">{formatMoney(refinanceCost)}</span>
              </div>
              {monthlySavings > 0 && (
                <div className="pt-2 border-t border-emerald-700/30">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Rentabilisé en</span>
                    <span className="text-neutral-300">
                      {Math.ceil(refinanceCost / monthlySavings)} mois
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Boutons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={processing}
              className="flex-1 px-6 py-3 rounded-lg bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white font-bold transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing || monthlySavings <= 0}
              className="flex-1 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-bold transition-colors"
            >
              {processing ? "Traitement..." : `Refinancer (${formatMoney(refinanceCost)})`}
            </button>
          </div>

          {monthlySavings <= 0 && (
            <p className="text-xs text-amber-400 text-center">
              ⚠️ Le nouveau taux ne vous fait pas économiser d'argent. Essayez un taux plus bas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
