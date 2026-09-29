import { Package, Zap, Timer, Sofa, Truck } from "lucide-react";

export const SERVICE_ICONS = { standard: Package, express: Zap, "same-day": Timer, "fragile-bulky": Sofa };
export const serviceIcon = (slug) => SERVICE_ICONS[slug] || Truck;
