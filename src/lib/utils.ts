import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const money = (value: number | string, currency = "MAD") =>
  new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value));
export const shortDate = (value: string | Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
