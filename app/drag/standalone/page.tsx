import { redirect } from "next/navigation";
import { DRAG_WEB_URL } from "../../../lib/drag";

export const dynamic = "force-static";

export default function DragStandalonePage() {
  redirect(DRAG_WEB_URL);
}
