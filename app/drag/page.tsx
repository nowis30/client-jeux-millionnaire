import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DRAG_WEB_URL } from "../../lib/drag";

export const metadata: Metadata = {
  title: "Drag Shift Duel | Héritier Millionnaire",
  description: "Affrontez l'IA en ligne droite, synchronisez vos shifts et cumulez des gains partagés avec le jeu principal.",
};

export default function DragPage() {
  redirect(DRAG_WEB_URL);
}
