import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className merge, used by every UI component. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
