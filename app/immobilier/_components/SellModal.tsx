"use client";
import { useState } from "react";
import { formatMoney } from "../../../lib/format";

type Property = {
  id: string;
  name: string;
  city: string;
  currentValue: number;
  purchasePrice: number;
  remainingBalance: number;
  quantity: number;
  imageUrl?: string;
};

interface SellModalProps {
  property: Property;
  onClose: () => void;
  onConfirm: (propertyId: string, quantityToSell: number) => Promise<void>;
}

export default function SellModal({ property, onClose, onConfirm }: SellModalProps) {
  const [quantityToSell, setQuantityToSell] = useState(1);
  const [processing, setProcessing] = useState(false);

  const salePrice = property.currentValue * quantityToSell;
  const remainingDebt = property.remainingBalance * quantityToSell;
  const netProceeds = salePrice - remainingDebt;
  const originalCost = property.purchasePrice * quantityToSell;
  const totalGain = salePrice - originalCost;
  const gainPercent = originalCost > 0 ? (totalGain / originalCost) * 100 : 0;

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await onConfirm(property.id, quantityToSell);
      onClose();
    } catch (error) {
      console.error("Erreur lors de la vente:", error);
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl p-8 max-w-2xl w-full shadow-2xl border-2 border-amber-500/30">
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-3xl font-bold mb-2 text-neutral-100">🏠 Vendre la propriété</h3>
            <p className="text-neutral-400">{property.name}, {property.city}</p>
          </div>

          {property.imageUrl && (
            <div className="aspect-video w-full bg-neutral-800 rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={property.imageUrl} alt={property.name} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Quantité à vendre */}
          {property.quantity > 1 && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Quantité à vendre: {quantityToSell} sur {property.quantity}
              </label>
              <input
                type="range"
                min="1"
                max={property.quantity}
                value={quantityToSell}
                onChange={(e) => setQuantityToSell(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-400 mt-1">
                <span>1</span>
                <span>{property.quantity}</span>
              </div>
            </div>
          )}

          {/* Détails de la transaction */}
          <div className="bg-neutral-800/50 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-neutral-200 mb-3">📊 Détails de la vente</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-400">Prix d'achat original</span>
                <span className="text-neutral-200">{formatMoney(originalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Valeur actuelle</span>
                <span className="text-white font-semibold">{formatMoney(salePrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Hypothèque à rembourser</span>
                <span className="text-red-400">-{formatMoney(remainingDebt)}</span>
              </div>
              <div className="pt-2 border-t border-neutral-700">
                <div className="flex justify-between font-bold">
                  <span className="text-neutral-200">Montant net reçu</span>
                  <span className={netProceeds >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {formatMoney(netProceeds)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Résultat de l'investissement */}
          <div className={`rounded-lg p-4 border ${totalGain >= 0 ? "bg-emerald-900/20 border-emerald-700/30" : "bg-red-900/20 border-red-700/30"}`}>
            <h4 className={`font-semibold mb-3 ${totalGain >= 0 ? "text-emerald-200" : "text-red-200"}`}>
              💰 Résultat de l'investissement
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-300">{totalGain >= 0 ? "Plus-value totale" : "Perte totale"}</span>
                <span className={`font-bold text-lg ${totalGain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalGain >= 0 ? "+" : ""}{formatMoney(totalGain)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Rendement</span>
                <span className={`font-semibold ${gainPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {gainPercent >= 0 ? "+" : ""}{gainPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Avertissement */}
          {netProceeds < 0 && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-300 text-sm">
              ⚠️ <strong>Attention :</strong> Le prix de vente ne couvre pas l'hypothèque restante. 
              Vous devrez payer {formatMoney(Math.abs(netProceeds))} de votre poche pour compléter la transaction.
            </div>
          )}

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
              disabled={processing}
              className="flex-1 px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-bold transition-colors"
            >
              {processing ? "Traitement..." : `Vendre (${formatMoney(salePrice)})`}
            </button>
          </div>

          <p className="text-xs text-neutral-400 text-center">
            Cette action est irréversible. Les fonds seront crédités à votre compte immédiatement.
          </p>
        </div>
      </div>
    </div>
  );
}
