import { en } from "./en";
import { ru, type Dictionary } from "./ru";
import type { Locale } from "@/types/product";

export const dictionaries: Record<Locale, Dictionary> = { ru, en };
