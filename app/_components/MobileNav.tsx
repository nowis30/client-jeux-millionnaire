"use client";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Accueil" },
  { href: "/immobilier", label: "Immo" },
  { href: "/bourse", label: "Bourse" },
  { href: "/listings", label: "Annonces" },
  { href: "/summary", label: "Résumé" },
  { href: "/quiz", label: "Quiz" },
];

export default function MobileNav() {
  const pathname = usePathname();
  // Masquer sur desktop
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 safe-bottom bg-neutral-900/95 backdrop-blur border-t border-neutral-800">
      <ul className="grid grid-cols-5 gap-1 px-2 py-2 text-[13px]">
        {items.slice(0,5).map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="text-center">
              <a
                href={item.href}
                className={[
                  "block rounded-md px-2 py-2",
                  active ? "bg-neutral-800 text-white" : "text-neutral-300 hover:bg-neutral-800/60",
                ].join(" ")}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
      <div className="px-2 pb-2">
        <a
          href="/quiz"
          className={[
            "block w-full text-center rounded-md px-3 py-2",
            pathname?.startsWith("/quiz") ? "bg-sky-600 text-white" : "bg-sky-700 text-white hover:bg-sky-600",
          ].join(" ")}
        >
          Quiz
        </a>
      </div>
    </nav>
  );
}
