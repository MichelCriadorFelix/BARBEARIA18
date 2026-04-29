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
    const { data, error } = await supabase
      .from("barbershops")
      .select("working_hours")
      .eq("id", shopId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching business hours from DB:", error);
      return defaultBusinessHours;
    }

    if (data?.working_hours) {
      return data.working_hours as BusinessHours;
    }
    
    return defaultBusinessHours;
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
    const { error } = await supabase
      .from("barbershops")
      .update({ working_hours: hours })
      .eq("id", shopId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Failed to save business hours", error);
    return false;
  }
}
