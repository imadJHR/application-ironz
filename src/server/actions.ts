"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma";
import Decimal from "decimal.js";
import { z } from "zod";
import {
  db,
  atomic,
  nextNumber,
  jsonSnapshot,
  isDesktopDb,
  isPreview,
} from "./db";
import { requireUser, requireDocumentWrite, sessionHash, appOrigins } from "./auth";
import { verifyPassword, hashPassword, dummyHash } from "./password";
import {
  ensureRecoverySchema,
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  recoveryHashMatches,
  verifyRecoveryCodeInput,
  RECOVERY_MAX_FAILED_ATTEMPTS,
  RECOVERY_WINDOW_MS,
  RECOVERY_WINDOW_ATTEMPTS,
} from "./recovery";
import {
  calculate,
  documentSchema,
  transitions,
  statusLabels,
  moduleFor,
  invoiceStatus,
  type Kind,
} from "@/lib/business";
import {
  clientSchema,
  productSchema,
  paymentSchema,
  settingsSchema,
  firstRunSchema,
  recoverySchema,
  regenerateSchema,
} from "./validation";
// recoveryCode : le code de récupération en clair, renvoyé UNE SEULE FOIS
// (affichage unique côté client) ; il n'est jamais stocké ni journalisé.
export type Result = {
  ok: boolean;
  message: string;
  id?: string;
  recoveryCode?: string;
};
function failure(error: unknown): Result {
  if (error instanceof z.ZodError)
    return {
      ok: false,
      message: error.issues[0]?.message || "Vérifiez les champs.",
    };
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return { ok: false, message: "Cette référence existe déjà." };
  if (error instanceof Error && error.name === "BusinessError")
    return { ok: false, message: error.message };
  console.error(
    "[IRONZ operation]",
    error instanceof Error ? error.message : "Unknown",
  );
  return {
    ok: false,
    message: "Impossible d’enregistrer. Vérifiez vos droits et réessayez.",
  };
}
function business(message: string): never {
  const error = new Error(message);
  error.name = "BusinessError";
  throw error;
}
function refreshed() {
  revalidatePath("/", "layout");
}
export async function login(
  _previous: Result,
  form: FormData,
): Promise<Result> {
  const data = z
    .object({
      email: z.email().transform((v) => v.toLowerCase()),
      password: z.string().min(1).max(128),
    })
    .safeParse(Object.fromEntries(form));
  if (!data.success)
    return {
      ok: false,
      message: "Renseignez votre email et votre mot de passe.",
    };
  try {
    const h = await headers();
    const origin = h.get("origin");
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = "";
      }
      if (!appOrigins().has(originHost))
        return { ok: false, message: "Origine de connexion invalide." };
    }
    const key = sessionHash(data.data.email);
    const accepted = await atomic(async (tx) => {
      const now = new Date(),
        windowMs = 15 * 60 * 1000;
      const attempt = await tx.loginAttempt.upsert({
        where: { key },
        create: { key, attempts: 1 },
        update: { attempts: { increment: 1 } },
      });
      if (now.getTime() - attempt.windowStart.getTime() > windowMs) {
        await tx.loginAttempt.update({
          where: { key },
          data: { attempts: 1, windowStart: now },
        });
        return true;
      }
      return attempt.attempts <= 10;
    });
    if (!accepted)
      return {
        ok: false,
        message: "Trop de tentatives. Réessayez dans 15 minutes.",
      };
    const user = await db.user.findUnique({
      where: { email: data.data.email },
    });
    // Derive a key even for unknown emails to reduce timing leakage.
    const dummy = "01234567890123456789012345678901:" + "0".repeat(128);
    const valid = await verifyPassword(
      data.data.password,
      user?.passwordHash || dummy,
    );
    if (!user?.active || !valid || user.role !== "ADMIN")
      return { ok: false, message: "Email ou mot de passe incorrect." };
    const token = randomBytes(32).toString("hex"),
      expiresAt = new Date(Date.now() + 8 * 3600 * 1000);
    await db.session.create({
      data: { tokenHash: sessionHash(token), userId: user.id, expiresAt },
    });
    await db.loginAttempt.deleteMany({ where: { key } });
    (await cookies()).set("ironz_session", token, {
      httpOnly: true,
      // Sur desktop (.exe, http://127.0.0.1 en local), un cookie Secure serait
      // rejeté : on le réserve au web HTTPS.
      secure:
        process.env.NODE_ENV === "production" &&
        process.env.IRONZ_SQLITE !== "1",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });
  } catch {
    return {
      ok: false,
      message: "Connexion indisponible. Contactez votre administrateur.",
    };
  }
  redirect("/");
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get("ironz_session")?.value;
  if (token)
    await db.session.deleteMany({ where: { tokenHash: sessionHash(token) } });
  jar.delete("ironz_session");
  redirect("/connexion");
}
// Configuration initiale (premier démarrage) : accessible uniquement quand
// aucun administrateur n'existe. La vérification et la création ont lieu
// dans une vraie transaction SQLite pour être atomiques et protégées
// contre les accès concurrents (deux soumissions simultanées).
export async function configureFirstAdmin(
  _previous: Result,
  form: FormData,
): Promise<Result> {
  try {
    // Réservé à l'application locale (desktop) et à l'aperçu :
    // la version web (Atlas) ne propose jamais de configuration initiale.
    if (!isDesktopDb() && !isPreview())
      business("Opération disponible uniquement dans l’application locale.");
    const data = firstRunSchema.parse(Object.fromEntries(form));
    const passwordHash = await hashPassword(data.password);
    // Migration de schéma AVANT la transaction (le DDL opéré hors
    // transaction évite tout verrou SQLite concurrent).
    await ensureRecoverySchema();
    // Code de récupération du premier administrateur : généré dans la
    // transaction, renvoyé en clair une seule fois au client, stocké
    // uniquement sous forme de hash, jamais écrit dans le journal.
    const recovery = generateRecoveryCode();
    await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const admins = await tx.user.count({ where: { role: "ADMIN" } });
        if (admins > 0)
          business(
            "La configuration initiale est déjà terminée. Connectez-vous.",
          );
        await tx.companySettings.upsert({
          where: { id: "ironz" },
          create: { id: "ironz", name: data.company },
          update: { name: data.company },
        });
        const admin = await tx.user.create({
          data: {
            email: data.email,
            name: data.adminName,
            role: "ADMIN",
            passwordHash,
          },
        });
        await tx.recoveryCode.create({
          data: { userId: admin.id, codeHash: recovery.hash },
        });
        await tx.activityLog.create({
          data: {
            userId: admin.id,
            action: "Configuration initiale (premier administrateur)",
            entityType: "user",
            entityId: admin.id,
            detail: data.company,
          },
        });
      },
      { timeout: 15000 },
    );
    // PAS de revalidatePath ici : la page /premiere-installation redirigerait
    // immédiatement (admin créé) et masquerait l'affichage unique du code.
    // La page de connexion est rendue dynamiquement : elle détectera l'admin.
    return {
      ok: true,
      message: "Administrateur créé. Vous pouvez vous connecter.",
      recoveryCode: recovery.plain,
    };
  } catch (e) {
    return failure(e);
  }
}
export async function saveClient(input: unknown, id?: string): Promise<Result> {
  try {
    const user = await requireUser("sales", true);
    const data = clientSchema.parse(input);
    const client = await atomic(async (tx) => {
      const c = id
        ? await tx.client.update({ where: { id }, data })
        : await tx.client.create({ data });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: id ? "Client modifié" : "Client ajouté",
          entityType: "client",
          entityId: c.id,
          detail: c.name,
        },
      });
      return c;
    });
    refreshed();
    return { ok: true, message: "Client enregistré.", id: client.id };
  } catch (e) {
    return failure(e);
  }
}
export async function setClientArchived(
  id: string,
  archived: boolean,
): Promise<Result> {
  try {
    const user = await requireUser("sales", true);
    await atomic(async (tx) => {
      const client = await tx.client.update({
        where: { id },
        data: { archived },
      });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: archived ? "Client archivé" : "Client restauré",
          entityType: "client",
          entityId: id,
          detail: client.name,
        },
      });
    });
    refreshed();
    return {
      ok: true,
      message: archived
        ? "Client archivé. Son historique est conservé."
        : "Client restauré.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function saveProduct(
  input: unknown,
  id?: string,
): Promise<Result> {
  try {
    const user = await requireUser("sales", true);
    if (!id)
      business("La création manuelle d'articles est désactivée.");
    const parsed = productSchema.parse(input),
      data = {
        ...parsed,
        reference: parsed.reference || null,
        referenceKey: parsed.reference
          ? "ref:" + parsed.reference.toLocaleLowerCase("fr")
          : "auto:" + (id || randomUUID()),
        price: new Decimal(parsed.price).toFixed(2),
        tax: new Decimal(parsed.tax).toFixed(2),
      };
    const product = await atomic(async (tx) => {
      const p = id
        ? await tx.product.update({ where: { id }, data })
        : await tx.product.create({ data });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: id ? "Article modifié" : "Article ajouté",
          entityType: "product",
          entityId: p.id,
          detail: p.reference || "",
        },
      });
      return p;
    });
    refreshed();
    return { ok: true, message: "Article enregistré.", id: product.id };
  } catch (e) {
    return failure(e);
  }
}
export async function toggleProduct(id: string): Promise<Result> {
  try {
    const user = await requireUser("sales", true);
    await atomic(async (tx) => {
      const p = await tx.product.findUniqueOrThrow({ where: { id } });
      await tx.product.update({ where: { id }, data: { active: !p.active } });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: p.active ? "Article désactivé" : "Article activé",
          entityType: "product",
          entityId: id,
          detail: p.reference || "",
        },
      });
    });
    refreshed();
    return { ok: true, message: "Statut mis à jour." };
  } catch (e) {
    return failure(e);
  }
}
export async function saveSettings(input: unknown): Promise<Result> {
  try {
    const user = await requireUser("admin", true);
    const parsed = settingsSchema.parse(input),
      data = {
        ...parsed,
        defaultTax: new Decimal(parsed.defaultTax).toFixed(2),
      };
    await atomic(async (tx) => {
      const previous = await tx.companySettings.findUnique({
        where: { id: "ironz" },
      });
      if (
        previous &&
        previous.currency !== data.currency &&
        (await tx.document.count()) > 0
      )
        business(
          "La devise ne peut pas changer après la création de documents commerciaux.",
        );
      await tx.companySettings.upsert({
        where: { id: "ironz" },
        create: { ...data, id: "ironz" },
        update: data,
      });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "Profil IRONZ mis à jour",
          entityType: "settings",
          entityId: "ironz",
        },
      });
    });
    refreshed();
    return {
      ok: true,
      message:
        "Paramètres enregistrés. Les documents existants restent inchangés.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function resolveAccountConflict(
  extraId: string,
  password: string,
): Promise<Result> {
  try {
    const actor = await requireUser("admin", true);
    regenerateSchema.parse({ password });
    // Le mot de passe actuel confirme la décision (comparaison timing-safe
    // sur le hash réel ; même protocole que la régénération du code).
    const full = await db.user.findUnique({ where: { id: actor.id } });
    if (!full || !(await verifyPassword(password, full.passwordHash)))
      business("Mot de passe actuel incorrect.");
    if (extraId === actor.id)
      business("Impossible de fusionner votre propre compte.");
    await atomic(async (tx) => {
      const extra = await tx.user.findUnique({ where: { id: extraId } });
      if (!extra) business("Ce compte n'existe plus ou a déjà été fusionné.");
      // L'historique commercial reste complet : toutes les références
      // (documents, paiements, journal) sont réaffectées au compte
      // administrateur conservé. Sessions, code de récupération et
      // données personnelles du compte fusionné sont retirés.
      const links = {
        document: await tx.document.updateMany({
          where: { createdById: extraId },
          data: { createdById: actor.id },
        }),
        payment: await tx.payment.updateMany({
          where: { createdById: extraId },
          data: { createdById: actor.id },
        }),
        activity: await tx.activityLog.updateMany({
          where: { userId: extraId },
          data: { userId: actor.id },
        }),
      };
      await tx.session.deleteMany({ where: { userId: extraId } });
      await tx.recoveryCode.deleteMany({ where: { userId: extraId } });
      await tx.user.delete({ where: { id: extraId } });
      await tx.activityLog.create({
        data: {
          userId: actor.id,
          action: "Compte fusionné dans le compte administrateur",
          entityType: "user",
          entityId: extra.id,
          detail: `${extra.name} — ${extra.email} (${links.document.count} documents, ${links.payment.count} paiements réaffectés)`,
        },
      });
    });
    refreshed();
    return {
      ok: true,
      message: "Compte fusionné. L'historique est rattaché à votre compte.",
    };
  } catch (e) {
    return failure(e);
  }
}
// Comptes hérités (fusion/panneau de conflit) : prévu dans ./accounts.ts.
// Message unique pour tous les échecs de récupération : aucune réponse
// ne révèle si un email ou un code existe (anti-énumération de comptes).
const RECOVERY_GENERIC = "Email, code ou informations invalides.";
function recoveryFailure(): Result {
  return { ok: false, message: RECOVERY_GENERIC };
}
// Récupération de compte administrateur (mot de passe oublié) : réservée
// à l'application locale (desktop), elle exige le code de récupération
// à usage unique. Un accès physique à la base SQLite ne prouve rien :
// sans code valide, aucune réinitialisation n'est possible.
export async function recoverAccount(
  _previous: Result,
  form: FormData,
): Promise<Result> {
  let data: z.infer<typeof recoverySchema> | null = null;
  try {
    if (!isDesktopDb()) return recoveryFailure();
    const parsed = recoverySchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return recoveryFailure();
    data = parsed.data;
    // Migration de schéma pour les bases héritées / restaurations anciennes.
    await ensureRecoverySchema();
    const h = await headers();
    const origin = h.get("origin");
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = "";
      }
      if (!appOrigins().has(originHost)) return recoveryFailure();
    }
    // Limite de tentatives par email (même fenêtre glissante que le login).
    const key = "recovery:" + sessionHash(data.email);
    const accepted = await atomic(async (tx) => {
      const now = new Date();
      const attempt = await tx.loginAttempt.upsert({
        where: { key },
        create: { key, attempts: 1 },
        update: { attempts: { increment: 1 } },
      });
      if (now.getTime() - attempt.windowStart.getTime() > RECOVERY_WINDOW_MS) {
        await tx.loginAttempt.update({
          where: { key },
          data: { attempts: 1, windowStart: now },
        });
        return true;
      }
      return attempt.attempts <= RECOVERY_WINDOW_ATTEMPTS;
    });
    // Coût scrypt à temps quasi constant même sur les échecs précoces.
    const burn = verifyPassword(data.password, dummyHash());
    if (!accepted) {
      await burn;
      return { ok: false, message: "Trop de tentatives. Réessayez dans 15 minutes." };
    }
    const user = await db.user.findUnique({
      where: { email: data.email },
    });
    const adminOk = user?.active && user.role === "ADMIN";
    const verdict = adminOk
      ? await verifyRecoveryCodeInput(user.id, data.code)
      : { ok: false, blocked: false, codeId: undefined as string | undefined };
    if (verdict.codeId) {
      // Code erroné mais existant : compter l'essai (blocage après 5).
      await db.recoveryCode.update({
        where: { id: verdict.codeId },
        data: { failedAttempts: { increment: 1 } },
      });
    }
    if (!verdict.ok) {
      await burn;
      return recoveryFailure();
    }
    // Égalisation du coût (scrypt réel) avant l'écriture de la transaction.
    const passwordHash = await hashPassword(data.password);
    const userId = user!.id;
    const nextCode = generateRecoveryCode();
    const updated = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Relecture dans la transaction : usage unique garanti contre
        // deux soumissions simultanées du même code.
        const live = await tx.recoveryCode.findUnique({
          where: { userId },
        });
        const stillValid =
          live &&
          !live.consumedAt &&
          live.failedAttempts < RECOVERY_MAX_FAILED_ATTEMPTS &&
          recoveryHashMatches(
            hashRecoveryCode(normalizeRecoveryCode(data!.code)),
            live.codeHash,
          );
        if (!stillValid) return null;
        await tx.user.update({
          where: { id: userId },
          data: { passwordHash },
        });
        // Le mot de passe change : toutes les sessions existantes sont closes.
        await tx.session.deleteMany({ where: { userId } });
        const next = await tx.recoveryCode.update({
          where: { id: live.id },
          data: {
            codeHash: nextCode.hash,
            consumedAt: null,
            failedAttempts: 0,
            windowStart: new Date(),
          },
        });
        await tx.activityLog.create({
          data: {
            userId,
            action: "Récupération de compte via code de récupération",
            entityType: "user",
            entityId: userId,
          },
        });
        return next;
      },
      { timeout: 15000 },
    );
    if (!updated) {
      // Code consommé entre-temps (course) : message générique.
      await db.loginAttempt.deleteMany({ where: { key } });
      return recoveryFailure();
    }
    await db.loginAttempt.deleteMany({ where: { key } });
    return {
      ok: true,
      message:
        "Mot de passe mis à jour. Sessions fermées. Notez votre nouveau code : il s’affiche une seule fois.",
      recoveryCode: nextCode.plain,
    };
  } catch (e) {
    // Aucun secret ni code n'est journalisé.
    console.error(
      "[IRONZ recovery] échec générique",
      e instanceof Error ? e.name : "Unknown",
    );
    return recoveryFailure();
  }
}
// Régénération du code par l'administrateur connecté (Paramètres).
// Le mot de passe courant est exigé : une session volée ne peut pas
// s'emparer d'un nouveau code sans connaître le mot de passe.
export async function regenerateRecoveryCode(
  _previous: Result,
  form: FormData,
): Promise<Result> {
  try {
    const actor = await requireUser("admin", true);
    if (!isDesktopDb() && !isPreview())
      business("Opération disponible uniquement dans l’application locale.");
    const data = regenerateSchema.parse(Object.fromEntries(form));
    const full = await db.user.findUnique({ where: { id: actor.id } });
    const passwordOk = await verifyPassword(data.password, full?.passwordHash || dummyHash());
    if (!full || !passwordOk)
      return { ok: false, message: "Mot de passe actuel incorrect." };
    await ensureRecoverySchema();
    const recovery = generateRecoveryCode();
    await atomic(async (tx) => {
      await tx.recoveryCode.upsert({
        where: { userId: actor.id },
        create: { userId: actor.id, codeHash: recovery.hash },
        update: {
          codeHash: recovery.hash,
          consumedAt: null,
          failedAttempts: 0,
          windowStart: new Date(),
        },
      });
      await tx.activityLog.create({
        data: {
          userId: actor.id,
          action: "Code de récupération régénéré",
          entityType: "user",
          entityId: actor.id,
        },
      });
    });
    return {
      ok: true,
      message:
        "Nouveau code généré. Notez-le : il s’affiche une seule fois et remplace l’ancien code.",
      recoveryCode: recovery.plain,
    };
  } catch (e) {
    return failure(e);
  }
}
function itemData(items: z.infer<typeof documentSchema>["items"]) {
  const totals = calculate(items);
  const { lines, ...financials } = totals;
  return {
    financials,
    items: items.map((item, position) => ({
      ...item,
      position,
      quantity: new Decimal(item.quantity).toFixed(3),
      unitPrice: new Decimal(item.unitPrice).toFixed(2),
      discountRate: new Decimal(item.discountRate).toFixed(2),
      taxRate: new Decimal(item.taxRate).toFixed(2),
      ...lines[position],
    })),
  };
}
export async function saveDocument(
  input: unknown,
  id?: string,
  version?: number,
): Promise<Result> {
  try {
    const data = documentSchema.parse(input),
      user = await requireDocumentWrite(data.kind);
    const doc = await atomic(async (tx) => {
      const existing = id
        ? await tx.document.findUniqueOrThrow({
            where: { id },
            include: { children: true },
          })
        : null;
      if (
        existing &&
        (existing.kind !== data.kind ||
          existing.status !== "DRAFT" ||
          existing.version !== version ||
          existing.children.length)
      )
        business(
          "Ce document ne peut plus être modifié, ou a été modifié par un collègue.",
        );
      if (
        existing &&
        new Date(data.date).getUTCFullYear() !== existing.date.getUTCFullYear()
      )
        business(
          "La date doit rester dans l’année de numérotation du document.",
        );
      if (existing?.sourceId && existing.clientId !== data.clientId)
        business("Le client d’un document lié doit rester identique.");
      const client = await tx.client.findUniqueOrThrow({
        where: { id: data.clientId },
      });
      if (client.archived && !existing) business("Ce client est archivé.");
      const company = await tx.companySettings.findUniqueOrThrow({
        where: { id: "ironz" },
      });
      let validatedItems = data.items.map((line) => ({
        ...line,
        sourceItemId: undefined as string | undefined,
      }));
      if (existing?.kind === "DELIVERY" && existing.sourceId) {
        const source = await tx.document.findUniqueOrThrow({
          where: { id: existing.sourceId },
          include: {
            items: true,
            children: {
              where: { kind: "DELIVERY", id: { not: id } },
              include: { items: true },
            },
          },
        });
        if (
          new Set(data.items.map((i) => i.sourceItemId)).size !==
          data.items.length
        )
          business("Chaque article commandé doit apparaître une seule fois.");
        validatedItems = data.items.map((line) => {
          const original = source.items.find((i) => i.id === line.sourceItemId);
          if (!original)
            business("La ligne ne correspond pas à la commande d’origine.");
          const reserved = source.children
            .flatMap((d) => d.items)
            .filter((i) => i.sourceItemId === original.id)
            .reduce((s, i) => s.plus(i.quantity.toString()), new Decimal(0));
          if (
            new Decimal(line.quantity).gt(
              new Decimal(original.quantity.toString()).minus(reserved),
            )
          )
            business("La quantité dépasse le reste à livrer.");
          return {
            ...line,
            sourceItemId: original.id,
            reference: original.reference,
            name: original.name,
            description: original.description,
            unit: original.unit,
            unitPrice: Number(original.unitPrice),
            discountRate: Number(original.discountRate),
            taxRate: Number(original.taxRate),
            productId: original.productId || undefined,
          };
        });
      }
      const { financials, items } = itemData(validatedItems);
      if (new Decimal(financials.totalTTC).gt("99999999999999.99"))
        business("Le total dépasse la limite autorisée.");
      const {
        kind,
        clientId,
        date,
        dueDate,
        notes,
        terms,
        leadTime,
        deliveryAddress,
      } = data;
      const documentData = {
        kind,
        clientId,
        date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
        terms,
        leadTime,
        deliveryAddress,
        ...financials,
      };
      let saved;
      if (id && existing) {
        await tx.documentItem.deleteMany({ where: { documentId: id } });
        saved = await tx.document.update({
          where: { id },
          data: {
            ...documentData,
            clientSnapshot: jsonSnapshot(
              existing.sourceId ? existing.clientSnapshot : client,
            ),
            companySnapshot: jsonSnapshot(
              existing.sourceId ? existing.companySnapshot : company,
            ),
            version: { increment: 1 },
            items: { create: items },
          },
        });
      } else {
        const prefix = {
          QUOTE: "DEV",
          ORDER: "BC",
          DELIVERY: "BL",
          INVOICE: "FAC",
        }[kind];
        saved = await tx.document.create({
          data: {
            ...documentData,
            number: await nextNumber(tx, prefix, new Date(date)),
            clientSnapshot: jsonSnapshot(client),
            companySnapshot: jsonSnapshot(company),
            createdById: user.id,
            items: { create: items },
          },
        });
      }
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: id ? "Document modifié" : "Document créé",
          entityType: moduleFor(kind),
          entityId: saved.id,
          detail: saved.number,
        },
      });
      return saved;
    });
    refreshed();
    return { ok: true, message: "Brouillon enregistré.", id: doc.id };
  } catch (e) {
    return failure(e);
  }
}
export async function setDocumentStatus(
  id: string,
  status: string,
): Promise<Result> {
  try {
    await requireUser();
    const current = await db.document.findUniqueOrThrow({ where: { id } });
    const user = await requireDocumentWrite(current.kind);
    await atomic(async (tx) => {
      const doc = await tx.document.findUniqueOrThrow({
        where: { id },
        include: { payments: true, children: true },
      });
      if (!transitions[doc.kind][doc.status]?.includes(status))
        business("Cette transition de statut n’est pas autorisée.");
      if (
        status === "CANCELLED" &&
        (doc.payments.length ||
          doc.children.some((c) => c.status !== "CANCELLED"))
      )
        business("Ce document a déjà des paiements ou des documents liés.");
      if (doc.kind === "DELIVERY" && status === "DELIVERED" && doc.sourceId) {
        const order = await tx.document.findUniqueOrThrow({
          where: { id: doc.sourceId },
          include: {
            items: true,
            children: { where: { kind: "DELIVERY" }, include: { items: true } },
          },
        });
        const complete = order.items.every((item) =>
          order.children
            .filter(
              (d) =>
                d.id === id || ["DELIVERED", "RECEIVED"].includes(d.status),
            )
            .flatMap((d) => d.items)
            .filter((i) => i.sourceItemId === item.id)
            .reduce((sum, i) => sum.plus(i.quantity.toString()), new Decimal(0))
            .gte(item.quantity.toString()),
        );
        if (complete)
          await tx.document.update({
            where: { id: order.id },
            data: { status: "DELIVERED", version: { increment: 1 } },
          });
      }
      await tx.document.update({
        where: { id },
        data: {
          status:
            doc.kind === "INVOICE" && status === "SENT"
              ? invoiceStatus(doc.totalTTC.toString(), "0", doc.dueDate, "SENT")
              : status,
          version: { increment: 1 },
        },
      });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "Statut mis à jour",
          entityType: moduleFor(doc.kind),
          entityId: id,
          detail: doc.number + " · " + statusLabels[status],
        },
      });
    });
    refreshed();
    return { ok: true, message: "Statut mis à jour." };
  } catch (e) {
    return failure(e);
  }
}
export async function convertDocument(
  id: string,
  target: Kind,
  quantities?: Record<string, number>,
): Promise<Result> {
  try {
    z.enum(["ORDER", "DELIVERY", "INVOICE"]).parse(target);
    const user = await requireDocumentWrite(target);
    const created = await atomic(async (tx) => {
      const source = await tx.document.findUniqueOrThrow({
        where: { id },
        include: {
          items: { orderBy: { position: "asc" } },
          children: { include: { items: true } },
        },
      });
      const valid =
        (source.kind === "QUOTE" &&
          source.status === "ACCEPTED" &&
          ["ORDER", "INVOICE"].includes(target)) ||
        (source.kind === "ORDER" &&
          ["CONFIRMED", "PREPARING", "DELIVERED"].includes(source.status) &&
          ["DELIVERY", "INVOICE"].includes(target)) ||
        (source.kind === "DELIVERY" &&
          ["DELIVERED", "RECEIVED"].includes(source.status) &&
          target === "INVOICE");
      if (!valid)
        business("Le statut de ce document ne permet pas cette conversion.");
      if (
        target === "ORDER" &&
        source.children.some(
          (d) => d.kind === "ORDER" && d.status !== "CANCELLED",
        )
      )
        business("Un bon de commande existe déjà.");
      if (target === "INVOICE") {
        // Prevent billing the same source through two routes (quote/order/delivery).
        const ancestorIds: string[] = [id];
        let parentId = source.sourceId;
        while (parentId) {
          ancestorIds.push(parentId);
          const parent = await tx.document.findUniqueOrThrow({
            where: { id: parentId },
          });
          parentId = parent.sourceId;
        }
        const branchIds: string[] = [id];
        let frontier = [id];
        while (frontier.length) {
          const children = await tx.document.findMany({
            where: { sourceId: { in: frontier }, kind: { not: "INVOICE" } },
            select: { id: true },
          });
          frontier = children.map((c) => c.id);
          branchIds.push(...frontier);
        }
        if (
          await tx.document.count({
            where: {
              kind: "INVOICE",
              status: { not: "CANCELLED" },
              sourceId: { in: [...new Set([...ancestorIds, ...branchIds])] },
            },
          })
        )
          business("Ce périmètre est déjà facturé.");
      }
      const rawItems = source.items
        .map((item) => {
          let quantity = Number(item.quantity);
          if (target === "DELIVERY") {
            const reserved = source.children
              .filter((d) => d.kind === "DELIVERY")
              .flatMap((d) => d.items)
              .filter((i) => i.sourceItemId === item.id)
              .reduce(
                (sum, i) => sum.plus(i.quantity.toString()),
                new Decimal(0),
              );
            const remaining = new Decimal(item.quantity.toString()).minus(
              reserved,
            );
            quantity = quantities
              ? (quantities[item.id] ?? 0)
              : Math.max(0, remaining.toNumber());
            if (
              !Number.isFinite(quantity) ||
              quantity < 0 ||
              new Decimal(quantity).gt(remaining)
            )
              business("La quantité livrée dépasse le reste à livrer.");
          }
          return {
            productId: item.productId || undefined,
            sourceItemId: target === "DELIVERY" ? item.id : undefined,
            reference: item.reference,
            name: item.name,
            description: item.description,
            unit: item.unit,
            quantity,
            unitPrice: Number(item.unitPrice),
            discountRate: Number(item.discountRate),
            taxRate: Number(item.taxRate),
          };
        })
        .filter((i) => i.quantity > 0);
      if (!rawItems.length) business("Aucune quantité restante à livrer.");
      const validated = z
        .array(documentSchema.shape.items.element)
        .parse(rawItems);
      const { financials, items } = itemData(validated);
      const now = new Date(),
        company = source.companySnapshot as Record<string, Prisma.JsonValue>;
      const dueDate =
        target === "INVOICE" ? new Date(now.getTime() + 30 * 86400000) : null;
      const prefix = {
        ORDER: "BC",
        DELIVERY: "BL",
        INVOICE: "FAC",
        QUOTE: "DEV",
      }[target];
      const doc = await tx.document.create({
        data: {
          kind: target,
          number: await nextNumber(tx, prefix, now),
          date: now,
          dueDate,
          clientId: source.clientId,
          clientSnapshot: jsonSnapshot(source.clientSnapshot),
          companySnapshot: jsonSnapshot(company),
          sourceId: id,
          createdById: user.id,
          notes: source.notes,
          terms: source.terms,
          leadTime: source.leadTime,
          deliveryAddress: source.deliveryAddress,
          ...financials,
          items: { create: items },
        },
      });
      if (source.kind === "QUOTE")
        await tx.document.update({
          where: { id },
          data: { status: "CONVERTED", version: { increment: 1 } },
        });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "Document converti",
          entityType: moduleFor(target),
          entityId: doc.id,
          detail: source.number + " → " + doc.number,
        },
      });
      return doc;
    });
    refreshed();
    return {
      ok: true,
      message: "Document créé. Les informations ont été conservées.",
      id: created.id,
    };
  } catch (e) {
    return failure(e);
  }
}
export async function duplicateDocument(id: string): Promise<Result> {
  try {
    const doc = await db.document.findUniqueOrThrow({
      where: { id },
      include: { items: { orderBy: { position: "asc" } } },
    });
    return saveDocument({
      kind: doc.kind,
      clientId: doc.clientId,
      date: new Date().toISOString().slice(0, 10),
      dueDate: "",
      notes: doc.notes,
      terms: doc.terms,
      leadTime: doc.leadTime,
      deliveryAddress: doc.deliveryAddress,
      items: doc.items.map((i) => ({
        ...i,
        productId: i.productId || undefined,
        sourceItemId: undefined,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        discountRate: Number(i.discountRate),
        taxRate: Number(i.taxRate),
      })),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function deleteChain(id: string): Promise<Result> {
  try {
    await requireUser("admin", true);
    const start = await db.document.findUnique({
      where: { id },
      select: { id: true, sourceId: true },
    });
    if (!start) business("Document introuvable.");
    // Remonte jusqu'à la racine de la chaîne.
    let root = start.id,
      parentId = start.sourceId;
    while (parentId) {
      const parent = await db.document.findUnique({
        where: { id: parentId },
        select: { id: true, sourceId: true },
      });
      if (!parent) break;
      root = parent.id;
      parentId = parent.sourceId;
    }
    // Redescend vers tous les documents liés.
    const ids = new Set([root]),
      queue = [root];
    while (queue.length) {
      const children = await db.document.findMany({
        where: { sourceId: queue.pop() },
        select: { id: true },
      });
      for (const child of children)
        if (!ids.has(child.id)) {
          ids.add(child.id);
          queue.push(child.id);
        }
    }
    const all = [...ids];
    // Conformité fiscale (art. 145 CGI, numérotation sans trou) : seuls les
    // brouillons sans paiement peuvent être effacés. Les documents émis
    // s'annulent, ils ne se suppriment pas.
    const chain = await db.document.findMany({
      where: { id: { in: all } },
      select: { status: true, payments: { select: { id: true } } },
    });
    if (
      chain.some((d) => d.status !== "DRAFT" || d.payments.length > 0)
    )
      business(
        "Suppression réservée aux chaînes en brouillon sans paiement. Annulez les documents émis.",
      );
    await atomic(async (tx) => {
      await tx.payment.deleteMany({ where: { invoiceId: { in: all } } });
      await tx.documentItem.updateMany({
        where: { documentId: { in: all } },
        data: { sourceItemId: null },
      });
      await tx.documentItem.deleteMany({
        where: { documentId: { in: all } },
      });
      await tx.document.updateMany({
        where: { id: { in: all } },
        data: { sourceId: null },
      });
      await tx.document.deleteMany({ where: { id: { in: all } } });
      await tx.activityLog.deleteMany({
        where: { entityId: { in: all } },
      });
    });
    refreshed();
    return {
      ok: true,
      message:
        "Chaîne supprimée définitivement (" + all.length + " document(s)).",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function registerPayment(input: unknown): Promise<Result> {
  try {
    const user = await requireUser("finance", true);
    const data = paymentSchema.parse(input);
    const payment = await atomic(async (tx) => {
      const replay = await tx.payment.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (replay) {
        if (
          replay.createdById !== user.id ||
          replay.invoiceId !== data.invoiceId ||
          Number(replay.amount) !== data.amount ||
          replay.method !== data.method ||
          replay.date.toISOString().slice(0, 10) !== data.date ||
          replay.reference !== data.reference ||
          replay.notes !== data.notes
        )
          business(
            "Ce formulaire de paiement a déjà été enregistré. Ouvrez un nouveau formulaire.",
          );
        return replay;
      }
      const invoice = await tx.document.findUniqueOrThrow({
        where: { id: data.invoiceId },
        include: { payments: true },
      });
      if (
        invoice.kind !== "INVOICE" ||
        ["DRAFT", "CANCELLED"].includes(invoice.status)
      )
        business("Les paiements sont réservés aux factures émises.");
      const paid = invoice.payments.reduce(
        (sum, p) => sum.plus(p.amount.toString()),
        new Decimal(0),
      );
      if (
        new Decimal(data.amount).gt(
          new Decimal(invoice.totalTTC.toString()).minus(paid),
        )
      )
        business("Le montant dépasse le solde de la facture.");
      if (
        data.date < invoice.date.toISOString().slice(0, 10) ||
        data.date > new Date().toISOString().slice(0, 10)
      )
        business(
          "La date du paiement doit être comprise entre la facture et aujourd’hui.",
        );
      const payment = await tx.payment.create({
        data: {
          ...data,
          amount: new Decimal(data.amount).toFixed(2),
          date: new Date(data.date),
          clientId: invoice.clientId,
          createdById: user.id,
          number: await nextNumber(tx, "PAY", new Date(data.date)),
        },
      });
      await tx.document.update({
        where: { id: invoice.id },
        data: {
          status: invoiceStatus(
            invoice.totalTTC.toString(),
            paid.plus(data.amount).toString(),
            invoice.dueDate,
            invoice.status,
          ),
          version: { increment: 1 },
        },
      });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "Paiement enregistré",
          entityType: "factures",
          entityId: invoice.id,
          detail:
            payment.number +
            " · " +
            data.amount +
            " " +
            String(
              (invoice.companySnapshot as Record<string, unknown>).currency ||
                "MAD",
            ),
        },
      });
      return payment;
    });
    refreshed();
    return {
      ok: true,
      message: "Paiement enregistré. Le solde a été actualisé.",
      id: payment.id,
    };
  } catch (e) {
    return failure(e);
  }
}
