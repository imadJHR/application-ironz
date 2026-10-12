import { redirect } from "next/navigation";
// La création manuelle d'articles est désactivée :
// le catalogue est importé depuis la base produits.
export default async function NewProduct() {
  redirect("/produits");
}
