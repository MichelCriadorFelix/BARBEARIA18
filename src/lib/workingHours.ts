import { supabase } from "./supabase";

export interface Break {
  id: string;
  start: string;
  end: string;
}

export interface BusinessDay {
  isOpen: boolean;
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
  breaks: Break[];
}

export type BusinessHours = Record<number, BusinessDay>;

export const defaultBusinessHours: BusinessHours = {
  0: { isOpen: false, openTime: "08:00", closeTime: "20:00", breaks: [] },
  1: { isOpen: true, openTime: "08:00", closeTime: "20:00", breaks: [] },
  2: { isOpen: true, openTime: "08:00", closeTime: "20:00", breaks: [] },
  3: { isOpen: true, openTime: "08:00", closeTime: "20:00", breaks: [] },
  4: { isOpen: true, openTime: "08:00", closeTime: "20:00", breaks: [] },
  5: { isOpen: true, openTime: "08:00", closeTime: "20:00", breaks: [] },
  6: { isOpen: true, openTime: "08:00", closeTime: "20:00", breaks: [] },
};

export async function fetchBusinessHours(shopId: string): Promise<BusinessHours> {
  try {
    const fileName = `working_hours_${shopId}.json`;
    const { data } = supabase.storage
      .from("documentsbarbearia")
      .getPublicUrl(fileName);
    if (!data?.publicUrl) return defaultBusinessHours;

    // Buscamos sem cache para garantir que sempre refletirá as mudanças
    const res = await fetch(data.publicUrl + "?t=" + new Date().getTime());
    if (!res.ok) {
      return defaultBusinessHours;
    }
    const json = await res.json();
    return json as BusinessHours;
  } catch (error) {
    console.error("Failed to fetch business hours", error);
    return defaultBusinessHours;
  }
}

export async function saveBusinessHours(
  shopId: string,
  hours: BusinessHours,
): Promise<boolean> {
  try {
    const fileName = `working_hours_${shopId}.json`;
    const file = new Blob([JSON.stringify(hours)], {
      type: "application/json",
    });

    // Remove old first to ensure update (Supabase sometimes caches upserts otherwise)
    await supabase.storage
      .from("documentsbarbearia")
      .remove([fileName]);

    const { error } = await supabase.storage
      .from("documentsbarbearia")
      .upload(fileName, file, {
        cacheControl: "0",
        upsert: true,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Failed to save business hours", error);
    return false;
  }
}
