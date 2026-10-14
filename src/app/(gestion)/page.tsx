import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  CalendarDays,
  ChevronDown,
  TrendingUp,
  ReceiptText,
  Wallet,
  Clock3,
  FileText,
  ClipboardCheck,
  Truck,
  CircleCheck,
  MoreHorizontal,
  CircleHelp,
} from "lucide-react";
import { dashboard, settings } from "@/server/queries";
import { money, shortDate } from "@/lib/utils";
import { Status } from "@/components/status";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { currentUser, allowed } from "@/server/auth";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; period?: string }>;
}) {
  const filters = await searchParams,
    now = new Date();
  const periodStart =
    filters.period === "month"
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : filters.period === "quarter"
        ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        : undefined;
  const [data, company, user] = await Promise.all([
    dashboard(
      filters.from || periodStart?.toISOString().slice(0, 10),
      filters.to,
    ),
    settings(),
    currentUser(),
  ]);
  const issued = data.invoices.filter(
      (i) => !["DRAFT", "CANCELLED"].includes(i.status),
    ),
    invoiced = issued.reduce((s, i) => s + Number(i.totalTTC), 0),
    revenue = issued.reduce((s, i) => s + Number(i.totalHT), 0),
    collected = data.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = (i: (typeof issued)[number]) =>
    Math.max(
      0,
      Number(i.totalTTC) - i.payments.reduce((s, p) => s + Number(p.amount), 0),
    );
  const remaining = issued.reduce((s, i) => s + balance(i), 0),
    draftInvoices = data.invoices.filter((i) => i.status === "DRAFT"),
    unpaid = issued.filter((i) => i.status !== "PAID"),
    overdue = unpaid.filter((i) => i.status === "OVERDUE"),
    pending = data.quotes.filter((q) => q.status === "SENT"),
    accepted = data.quotes.filter((q) =>
      ["ACCEPTED", "CONVERTED"].includes(q.status),
    ),
    converted = data.quotes.filter((q) =>
      q.children.some((c) => c.kind === "ORDER" && c.status !== "CANCELLED"),
    );
  const drafts = [
    ...data.quotes.map((doc) => ({
      ...doc,
      label: "Devis",
      href: "/devis/" + doc.id,
    })),
    ...data.orders.map((doc) => ({
      ...doc,
      label: "Commande",
      href: "/commandes/" + doc.id,
    })),
    ...data.invoices.map((doc) => ({
      ...doc,
      label: "Facture",
      href: "/factures/" + doc.id,
    })),
  ]
    .filter((doc) => doc.status === "DRAFT")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
  const months = Array.from(
    { length: 6 },
    (_, n) => new Date(now.getFullYear(), now.getMonth() - 5 + n, 1),
  );
  const monthly = months.map((d) =>
      issued
        .filter(
          (i) =>
            new Date(i.date).getMonth() === d.getMonth() &&
            new Date(i.date).getFullYear() === d.getFullYear(),
        )
        .reduce((s, i) => s + Number(i.totalHT), 0),
    ),
    max = Math.max(...monthly, 1000),
    points = monthly
      .map((v, n) => `${56 + n * 116},${178 - (v / max) * 138}`)
      .join(" ");
  const paidCount = issued.filter((i) => i.status === "PAID").length,
    paidRatio = issued.length ? (paidCount / issued.length) * 100 : 0;
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <div className="eyebrow">
            <span />
            VUE D’ENSEMBLE
          </div>
          <h1>
            Tableau de bord<span className="heading-period">.</span>
          </h1>
          <p>Une vision claire de votre activité. Chaque jour.</p>
        </div>
        <div className="page-actions">
          <form className="period-select">
            <CalendarDays size={16} />
            <select
              name="period"
              defaultValue={filters.period || "year"}
              aria-label="Période du tableau de bord"
            >
              <option value="year">Cette année · {now.getFullYear()}</option>
              <option value="quarter">Ce trimestre</option>
              <option value="month">Ce mois-ci</option>
            </select>
            <button aria-label="Appliquer la période">
              <ChevronDown size={14} />
            </button>
          </form>
          {user && allowed(user.role, "sales") && (
            <Button asChild>
              <Link href="/devis/nouveau">
                <Plus size={17} />
                Nouveau devis
              </Link>
            </Button>
          )}
        </div>
      </div>
      <div className="kpi-grid">
        {[
          {
            label: "Chiffre d’affaires",
            value: revenue,
            icon: TrendingUp,
            note: "Ventes facturées hors taxes",
            href: "/factures",
            primary: true,
          },
          {
            label: "Montant facturé",
            value: invoiced,
            icon: ReceiptText,
            note:
              issued.length +
              " facture(s) émise(s) · " +
              draftInvoices.length +
              " en brouillon",
            href: "/factures",
          },
          {
            label: "Montant encaissé",
            value: collected,
            icon: Wallet,
            note: data.payments.length + " paiement(s) enregistré(s)",
            href: "/paiements",
          },
          {
            label: "Reste à encaisser",
            value: remaining,
            icon: Clock3,
            note: unpaid.length + " facture(s) à suivre",
            href: "/factures",
          },
        ].map(({ label, value, icon: Icon, note, href, primary }) => (
          <Link
            key={label}
            href={href}
            className={"kpi-card " + (primary ? "kpi-primary" : "")}
          >
            <div className="kpi-top">
              <span>{label}</span>
              <Icon size={18} strokeWidth={1.6} />
            </div>
            <div className="kpi-value">
              {new Intl.NumberFormat("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(value)}
              <small>{company.currency}</small>
            </div>
            <div className="kpi-bottom">
              <span>
                {primary && <span className="kpi-tag">HT</span>}
                {note}
              </span>
              <ArrowUpRight size={15} />
            </div>
          </Link>
        ))}
      </div>
      <section className="panel drafts-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Brouillons à finaliser{" "}
              <span className="count-tag">{drafts.length}</span>
            </h2>
            <p>Documents sauvegardés mais pas encore émis ou confirmés.</p>
          </div>
          <FileText size={18} className="muted" />
        </div>
        {drafts.length ? (
          <div className="draft-list">
            {drafts.map((doc) => (
              <Link href={doc.href} key={doc.id} className="draft-item">
                <span className="draft-type">{doc.label}</span>
                <span className="draft-details">
                  <strong>{doc.number}</strong>
                  <small>
                    {doc.client.name} · {shortDate(doc.date)}
                  </small>
                </span>
                <span className="draft-total">
                  {money(Number(doc.totalTTC), company.currency)}
                </span>
                <ArrowUpRight size={15} className="muted" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            title="Aucun brouillon sur cette période"
            text="Les documents enregistrés en brouillon apparaîtront ici."
          />
        )}
      </section>
      <div className="dashboard-main-grid">
        <section className="panel revenue-panel">
          <div className="panel-heading">
            <div>
              <h2>Évolution du chiffre d’affaires</h2>
              <p>Vos ventes mois après mois, en {company.currency} HT</p>
            </div>
            <span className="chart-legend">
              <i />
              Chiffre d’affaires
            </span>
          </div>
          <div className="chart-summary">
            {money(revenue, company.currency)}
            <span>sur la période sélectionnée</span>
          </div>
          <div className="revenue-chart">
            <svg
              viewBox="0 0 680 225"
              role="img"
              aria-label="Chiffre d’affaires des six derniers mois"
            >
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ee713d" stopOpacity=".16" />
                  <stop offset="100%" stopColor="#ee713d" stopOpacity=".01" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((n) => (
                <g key={n}>
                  <line
                    x1="56"
                    x2="636"
                    y1={40 + n * 46}
                    y2={40 + n * 46}
                    stroke="#e9e9e6"
                    strokeDasharray="3 5"
                  />
                  <text
                    x="40"
                    y={44 + n * 46}
                    textAnchor="end"
                    fill="#969690"
                    fontSize="10"
                  >
                    {new Intl.NumberFormat("fr", {
                      notation: "compact",
                    }).format(max * (1 - n / 3))}
                  </text>
                </g>
              ))}
              <polygon
                points={`56,178 ${points} 636,178`}
                fill="url(#chart-fill)"
              />
              <polyline
                points={points}
                fill="none"
                stroke="#e4774b"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {months.map((d, n) => (
                <g key={n}>
                  <circle
                    cx={56 + n * 116}
                    cy={178 - (monthly[n] / max) * 138}
                    r={monthly[n] ? 4 : 2.5}
                    fill="#e4774b"
                  >
                    <title>{money(monthly[n], company.currency)}</title>
                  </circle>
                  <text
                    x={56 + n * 116}
                    y="210"
                    textAnchor="middle"
                    fill="#8c8c86"
                    fontSize="11"
                  >
                    {new Intl.DateTimeFormat("fr", { month: "short" }).format(
                      d,
                    )}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="chart-footnote">
            <CircleHelp size={13} />
            {issued.length
              ? "Factures émises, hors brouillons et annulations."
              : "Votre courbe se dessinera dès votre première facture."}
            <Link href="/factures">
              Voir les factures <ArrowRight size={13} />
            </Link>
          </div>
        </section>
        <section className="panel payment-overview">
          <div className="panel-heading">
            <div>
              <h2>État des factures</h2>
              <p>Gardez le cap sur vos encaissements</p>
            </div>
            <ReceiptText size={18} className="muted" />
          </div>
          <div className="donut-wrap">
            <div
              className="donut"
              style={{
                background: `conic-gradient(#292d2a 0% ${paidRatio}%, #ed7850 ${paidRatio}% ${issued.length ? 100 : 0}%, #eeefeb ${issued.length ? 100 : 0}% 100%)`,
              }}
            >
              <div>
                <strong>{issued.length}</strong>
                <span>factures émises</span>
              </div>
            </div>
          </div>
          <div className="donut-legend">
            <div>
              <span>
                <i className="legend-paid" />
                Payées
              </span>
              <strong>
                {paidCount}
                <small>{Math.round(paidRatio)} %</small>
              </strong>
            </div>
            <div>
              <span>
                <i className="legend-unpaid" />À encaisser
              </span>
              <strong>
                {unpaid.length}
                <small>
                  {issued.length ? Math.round(100 - paidRatio) : 0} %
                </small>
              </strong>
            </div>
          </div>
          <Link
            href="/factures?status=OVERDUE"
            className={"overdue-note " + (overdue.length ? "has-overdue" : "")}
          >
            <Clock3 size={16} />
            <span>
              {overdue.length
                ? overdue.length + " facture(s) en retard"
                : "Aucune facture en retard"}
            </span>
            <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
      <section className="pipeline-strip">
        <div className="pipeline-title">
          <span className="eyebrow">VOTRE CYCLE COMMERCIAL</span>
          <h2>De la proposition au paiement.</h2>
        </div>
        <div className="pipeline-stages">
          {[
            {
              icon: FileText,
              title: "Devis en attente",
              value: pending.length,
              href: "/devis?status=SENT",
            },
            {
              icon: ClipboardCheck,
              title: "Devis acceptés",
              value: accepted.length,
              href: "/devis?status=ACCEPTED",
            },
            {
              icon: ClipboardCheck,
              title: "Commandes en cours",
              value: data.orders.filter((o) =>
                ["CONFIRMED", "PREPARING"].includes(o.status),
              ).length,
              href: "/commandes",
            },
            {
              icon: Truck,
              title: "Livraisons récentes",
              value: data.deliveries.filter((d) =>
                ["DELIVERED", "RECEIVED"].includes(d.status),
              ).length,
              href: "/livraisons",
            },
          ].map(({ icon: Icon, title, value, href }, n) => (
            <Link href={href} key={title} className="pipeline-stage">
              <div>
                <Icon size={18} />
                <strong>{value}</strong>
              </div>
              <span>{title}</span>
              {n < 3 && (
                <span className="pipeline-arrow">
                  <ArrowRight size={13} />
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>
      <div className="dashboard-bottom-grid">
        <section className="panel invoices-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Factures à suivre{" "}
                <span className="count-tag">{unpaid.length}</span>
              </h2>
              <p>Les prochaines échéances de votre activité</p>
            </div>
            <Link href="/factures" className="text-link">
              Tout voir <ArrowUpRight size={14} />
            </Link>
          </div>
          {unpaid.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>FACTURE / CLIENT</th>
                    <th>ÉCHÉANCE</th>
                    <th>STATUT</th>
                    <th className="align-right">RESTE À PAYER</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaid
                    .sort(
                      (a, b) =>
                        new Date(a.dueDate || a.date).getTime() -
                        new Date(b.dueDate || b.date).getTime(),
                    )
                    .slice(0, 5)
                    .map((i) => (
                      <tr key={i.id}>
                        <td>
                          <Link
                            href={"/factures/" + i.id}
                            className="table-primary"
                          >
                            {i.number}
                          </Link>
                          <span className="table-secondary">
                            {i.client.name}
                          </span>
                        </td>
                        <td>{i.dueDate ? shortDate(i.dueDate) : "—"}</td>
                        <td>
                          <Status status={i.status} />
                        </td>
                        <td className="align-right table-amount">
                          {money(balance(i), company.currency)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              compact
              title="Tout est à jour"
              text="Vos factures à encaisser apparaîtront ici."
              href="/factures/nouveau"
              action="Créer une facture"
            />
          )}
          <div className="panel-bottom">
            <CircleCheck size={14} />
            <span>Une visibilité complète sur chaque échéance.</span>
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Activité récente</h2>
              <p>Ce qui se passe chez IRONZ</p>
            </div>
            <MoreHorizontal size={20} className="muted" />
          </div>
          {data.activity.length ? (
            <div className="activity-list">
              {data.activity.map((a) => (
                <Link
                  href={
                    [
                      "devis",
                      "commandes",
                      "livraisons",
                      "factures",
                      "client",
                    ].includes(a.entityType)
                      ? "/" +
                        (a.entityType === "client" ? "clients" : a.entityType) +
                        "/" +
                        a.entityId
                      : "/"
                  }
                  className="activity-item"
                  key={a.id}
                >
                  <span className="activity-icon">
                    <FileText size={15} />
                  </span>
                  <div>
                    <strong>{a.action}</strong>
                    <p>{a.detail}</p>
                    <small>
                      {a.user.name} · {shortDate(a.createdAt)}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              title="Le début d’une nouvelle organisation"
              text="Les créations, conversions et paiements de votre équipe apparaîtront ici."
            />
          )}
          <div className="conversion-mini">
            <div>
              <span>Conversion devis → commande</span>
              <strong>
                {data.quotes.length
                  ? Math.round((converted.length / data.quotes.length) * 100)
                  : 0}
                <small> %</small>
              </strong>
            </div>
            <div className="conversion-track">
              <i
                style={{
                  width:
                    (data.quotes.length
                      ? (converted.length / data.quotes.length) * 100
                      : 0) + "%",
                }}
              />
            </div>
            <small>
              {converted.length} commande(s) issue(s) de {data.quotes.length}{" "}
              devis
            </small>
          </div>
        </section>
      </div>
      <div className="dashboard-closing">
        <span className="closing-mark">Z</span>
        <p>
          Moins de fichiers. Plus de clarté.
          <span>Tout votre cycle commercial, dans un seul espace.</span>
        </p>
        <Link href="/clients">
          Gérer mes clients <ArrowRight size={14} />
        </Link>
      </div>
    </>
  );
}
