"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  UsersRound,
  Package,
  FileText,
  ClipboardList,
  Truck,
  ReceiptText,
  Wallet,
  Settings2,
  UserRoundCog,
  Search,
  Bell,
  ChevronDown,
  PanelLeftClose,
  Menu,
  ArrowUpRight,
  LogOut,
  X,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "./brand";
import { logout } from "@/server/actions";
const links = [
  { label: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: UsersRound },
  { label: "Produits & services", href: "/produits", icon: Package },
  { label: "Devis", href: "/devis", icon: FileText },
  { label: "Bons de commande", href: "/commandes", icon: ClipboardList },
  { label: "Bons de livraison", href: "/livraisons", icon: Truck },
  { label: "Factures", href: "/factures", icon: ReceiptText },
  { label: "Paiements", href: "/paiements", icon: Wallet },
];
const subscribeSidebar = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("ironz-sidebar-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("ironz-sidebar-change", callback);
  };
};
const getSidebarSnapshot = () =>
  localStorage.getItem("ironz-sidebar-collapsed") === "true";
const getSidebarServerSnapshot = () => false;
export function Shell({
  children,
  user,
  preview,
  logo,
}: {
  children: React.ReactNode;
  user: { name: string; role: string };
  preview: boolean;
  logo?: string;
}) {
  const pathname = usePathname(),
    router = useRouter(),
    searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(""),
    [suggest, setSuggest] = useState<{
      clients: { label: string; sub: string; href: string }[];
      documents: { label: string; sub: string; href: string }[];
      products: { label: string; sub: string; href: string }[];
    } | null>(null),
    [suggestOpen, setSuggestOpen] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggest(null);
      return;
    }
    const controller = new AbortController(),
      timer = setTimeout(async () => {
        try {
          const res = await fetch(
            "/api/recherche?q=" + encodeURIComponent(query.trim()),
            { signal: controller.signal },
          );
          if (res.ok) {
            setSuggest(await res.json());
            setSuggestOpen(true);
          }
        } catch {
          /* requête annulée */
        }
      }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  useEffect(() => {
    setSuggestOpen(false);
    setQuery("");
  }, [pathname]);
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const [mobile, setMobile] = useState(false),
    [account, setAccount] = useState(false),
    [notifications, setNotifications] = useState(false);
  const toggleSidebar = () => {
    localStorage.setItem("ironz-sidebar-collapsed", String(!collapsed));
    window.dispatchEvent(new Event("ironz-sidebar-change"));
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setAccount(false);
        setMobile(false);
        setNotifications(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const current =
    links.find((l) =>
      l.href === "/" ? pathname === "/" : pathname.startsWith(l.href),
    )?.label ||
    (pathname.startsWith("/parametres")
      ? "Paramètres"
      : pathname.startsWith("/utilisateurs")
        ? "Utilisateurs"
        : "Recherche");
  return (
    <div className={"app-shell " + (collapsed ? "sidebar-collapsed" : "")}>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "sidebar-open" : "")}>
        <div className="sidebar-brand">
          <Link
            href="/"
            className="sidebar-logo"
            aria-label="IRONZ accueil"
            onClick={() => setMobile(false)}
          >
            {collapsed ? (
              <Image
                width={46}
                height={46}
                src="/ironz-logo.png"
                alt="IRONZ"
                className="sidebar-mini-logo"
              />
            ) : logo ? (
              <Image
                unoptimized
                width={150}
                height={50}
                src={logo}
                alt="IRONZ"
                className="company-logo"
              />
            ) : (
              <Brand light />
            )}
          </Link>
          <button
            type="button"
            className="sidebar-collapse-button"
            aria-label={
              collapsed
                ? "Afficher la barre latérale"
                : "Réduire la barre latérale"
            }
            aria-pressed={collapsed}
            title={
              collapsed
                ? "Afficher la barre latérale"
                : "Réduire la barre latérale"
            }
            onClick={toggleSidebar}
          >
            <PanelLeftClose
              size={17}
              className={
                "sidebar-collapse " + (collapsed ? "sidebar-collapse-open" : "")
              }
            />
          </button>
        </div>
        <div className="workspace-mark">
          <span className="workspace-icon">I</span>
          <div>
            <strong>Espace IRONZ</strong>
            <span>Application interne</span>
          </div>
          <ShieldCheck size={15} />
        </div>
        <p className="nav-caption">VOTRE ACTIVITÉ</p>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              onClick={() => setMobile(false)}
              className={
                "nav-item " +
                ((href === "/" ? pathname === "/" : pathname.startsWith(href))
                  ? "active"
                  : "")
              }
            >
              <Icon size={19} strokeWidth={1.6} />
              <span>{label}</span>
              {href === "/" && <span className="nav-indicator" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p className="nav-caption">ADMINISTRATION</p>
          {user.role === "ADMIN" && (
            <>
              <Link
                href="/utilisateurs"
                title={collapsed ? "Utilisateurs" : undefined}
                onClick={() => setMobile(false)}
                className={
                  "nav-item " +
                  (pathname.startsWith("/utilisateurs") ? "active" : "")
                }
              >
                <UserRoundCog size={19} strokeWidth={1.6} />
                <span>Utilisateurs</span>
              </Link>
              <Link
                href="/parametres"
                title={collapsed ? "Paramètres" : undefined}
                onClick={() => setMobile(false)}
                className={
                  "nav-item " +
                  (pathname.startsWith("/parametres") ? "active" : "")
                }
              >
                <Settings2 size={19} strokeWidth={1.6} />
                <span>Paramètres</span>
              </Link>
            </>
          )}
          <div className="sidebar-note">
            <span className="mini-brand">Z</span>
            <div>
              <strong>Chaque étape, connectée.</strong>
              <p>Du premier devis au dernier paiement.</p>
            </div>
            <ArrowUpRight size={16} />
          </div>
          <div className="sidebar-user">
            <span className="avatar avatar-brand">
              <Image src="/ironz-logo.png" alt="IRONZ" width={22} height={22} />
            </span>
            <div>
              <strong>{user.name}</strong>
              <span>
                {user.role === "ADMIN"
                  ? "Administrateur"
                  : user.role === "COMMERCIAL"
                    ? "Commercial"
                    : "Comptabilité"}
              </span>
            </div>
            <button
              aria-label="Menu du compte"
              onClick={() => setAccount(!account)}
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              aria-label="Ouvrir la navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb-brand">IRONZ</span>
            <span className="breadcrumb-separator">/</span>
            <span>{current}</span>
          </div>
          <div className="topbar-right">
            <form
              action="/recherche"
              className="global-search"
              onSubmit={() => setSuggestOpen(false)}
            >
              <Search size={16} />
              <input
                ref={searchRef}
                name="q"
                aria-label="Recherche globale"
                placeholder="Rechercher dans IRONZ…"
                minLength={2}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => suggest && setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                onKeyDown={(e) => e.key === "Escape" && setSuggestOpen(false)}
                autoComplete="off"
              />
              <kbd>Ctrl K</kbd>
              {suggestOpen && suggest && (
                <div className="search-suggest" role="listbox">
                  {(
                    [
                      ["Clients", suggest.clients],
                      ["Documents", suggest.documents],
                      ["Catalogue", suggest.products],
                    ] as const
                  ).map(
                    ([title, items]) =>
                      items.length > 0 && (
                        <div key={title}>
                          <div className="search-suggest-group">{title}</div>
                          {items.map((item) => (
                            <button
                              key={item.href}
                              type="button"
                              className="search-suggest-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSuggestOpen(false);
                                setQuery("");
                                router.push(item.href);
                              }}
                            >
                              <strong>{item.label}</strong>
                              {item.sub && <small>{item.sub}</small>}
                            </button>
                          ))}
                        </div>
                      ),
                  )}
                  {suggest.clients.length +
                    suggest.documents.length +
                    suggest.products.length ===
                    0 && (
                    <div className="search-suggest-empty">
                      Aucun résultat — Entrée pour tout voir.
                    </div>
                  )}
                </div>
              )}
            </form>
            <Link
              className="mobile-global-search"
              href="/recherche"
              aria-label="Ouvrir la recherche"
            >
              <Search size={19} />
            </Link>
            <div className="topbar-divider" />
            <button
              className="notification-button"
              aria-label="Éléments à suivre"
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={19} />
            </button>
            <button
              className="topbar-avatar"
              aria-label="Menu du compte"
              onClick={() => setAccount(!account)}
            >
              <Image src="/ironz-logo.png" alt="IRONZ" width={21} height={21} />
            </button>
          </div>
        </header>
        {account && (
          <div className="account-menu">
            <div className="account-menu-profile">
              <Image src="/ironz-logo.png" alt="IRONZ" width={34} height={34} />
              <div>
                <strong>{user.name}</strong>
                <span>Compte interne IRONZ</span>
              </div>
            </div>
            {user.role === "ADMIN" && (
              <Link href="/parametres" onClick={() => setAccount(false)}>
                <Settings2 size={15} />
                Paramètres
              </Link>
            )}
            <form action={logout}>
              <button>
                <LogOut size={15} />
                Se déconnecter
              </button>
            </form>
          </div>
        )}
        {notifications && (
          <div className="notification-panel">
            <div>
              <strong>À suivre</strong>
              <button
                aria-label="Fermer"
                onClick={() => setNotifications(false)}
              >
                <X size={16} />
              </button>
            </div>
            <Link
              href="/factures?status=OVERDUE"
              onClick={() => setNotifications(false)}
            >
              <ReceiptText size={20} />
              <span>
                Factures en retard
                <small>Consultez les échéances à relancer.</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <Link
              href="/devis?status=SENT"
              onClick={() => setNotifications(false)}
            >
              <FileText size={20} />
              <span>
                Devis en attente
                <small>Retrouvez les propositions envoyées.</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
        {preview && (
          <div className="preview-banner">
            <span className="preview-dot" />
            Aperçu local · Connectez MongoDB Atlas et créez votre administrateur
            pour enregistrer vos données.
            <Link href="/parametres">
              Configuration <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
        <main className="main-content">{children}</main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} IRONZ · Gestion commerciale</span>
          <span>
            <ShieldCheck size={13} />
            Espace interne sécurisé
          </span>
        </footer>
      </div>
    </div>
  );
}
