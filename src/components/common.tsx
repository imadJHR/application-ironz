import Link from "next/link";
import {
  ArrowRight,
  Plus,
  Search,
  Inbox,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";
import type { Filters } from "@/server/queries";
export function PageHeader({
  eyebrow = "GESTION COMMERCIALE",
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {title}
          <span className="heading-period">.</span>
        </h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">
        {children}
        {action && (
          <Button asChild>
            <Link href={action.href}>
              <Plus size={16} />
              {action.label}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
export function EmptyState({
  title,
  text,
  href,
  action,
  compact = false,
}: {
  title: string;
  text: string;
  href?: string;
  action?: string;
  compact?: boolean;
}) {
  return (
    <div className={"empty-state " + (compact ? "empty-compact" : "")}>
      <div className="empty-icon">
        <Inbox size={25} strokeWidth={1.4} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {href && (
        <Link href={href} className="text-link">
          {action || "Commencer"}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
export function Pagination({
  total,
  page,
  filters,
}: {
  total: number;
  page: number;
  filters: Filters;
}) {
  const pages = Math.max(1, Math.ceil(total / 12));
  const href = (p: number) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [
        string,
        string,
      ][],
    );
    params.set("page", String(p));
    return "?" + params;
  };
  return (
    <div className="pagination">
      <span>
        {total ? (page - 1) * 12 + 1 : 0}–{Math.min(page * 12, total)} sur{" "}
        {total} résultat{total > 1 ? "s" : ""}
      </span>
      <div>
        <Link
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : 0}
          href={href(Math.max(1, page - 1))}
          aria-label="Page précédente"
        >
          <ChevronLeft size={16} />
        </Link>
        <span>
          Page {page} sur {pages}
        </span>
        <Link
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : 0}
          href={href(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
export function FilterBar({
  filters,
  statuses,
  dateFilters,
  archive,
  clients,
}: {
  filters: Filters;
  statuses?: Record<string, string>;
  dateFilters?: boolean;
  archive?: boolean;
  clients?: { id: string; name: string }[];
}) {
  return (
    <form className="filterbar">
      <div className="module-search">
        <Search size={17} />
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Rechercher un nom, une référence…"
          aria-label="Rechercher dans ce module"
        />
      </div>
      {statuses && (
        <select
          name="status"
          defaultValue={filters.status || ""}
          aria-label="Statut"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(statuses).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      )}
      {clients && (
        <select
          name="client"
          defaultValue={filters.client || ""}
          aria-label="Client"
        >
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {dateFilters && (
        <>
          <input
            name="from"
            type="date"
            defaultValue={filters.from}
            aria-label="Date de début"
          />
          <input
            name="to"
            type="date"
            defaultValue={filters.to}
            aria-label="Date de fin"
          />
        </>
      )}
      {archive && (
        <select
          name="archived"
          defaultValue={filters.archived || "false"}
          aria-label="Activité"
        >
          <option value="false">Actifs</option>
          <option value="true">Archivés / inactifs</option>
        </select>
      )}
      <Button variant="outline" size="sm">
        Filtrer
      </Button>
      {Object.values(filters).some(Boolean) && (
        <Link href="?" className="reset-filter">
          Réinitialiser
        </Link>
      )}
    </form>
  );
}
