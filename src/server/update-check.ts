"use server";
import { requireUser } from "./auth";
import { checkForUpdates, type UpdateInfo } from "./updates";

// Vérification déclenchée par l'utilisateur (bouton de la section
// Mises à jour de Paramètres). Lecture seule, sans effet sur la base :
// aucune donnée locale ne quitte le poste.
export async function checkUpdates(): Promise<UpdateInfo> {
  try {
    const user = await requireUser("admin");
    if (!user) {
      return {
        status: "error",
        currentVersion: "",
        message: "Session administrateur requise.",
      };
    }
    return await checkForUpdates();
  } catch {
    return {
      status: "error",
      currentVersion: "",
      message: "Session administrateur requise.",
    };
  }
}
