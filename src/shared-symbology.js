const ICON_ROOT = "https://raw.githubusercontent.com/jonpedder/asset-management/main/assets/resource-icons";
const iconUrl = (name) => `${ICON_ROOT}/${name}.svg`;

export const SHARED_RESOURCE_SYMBOLS = [
  { value: "communications", label: "Communications", icon: "tower-broadcast", keywords: ["communication", "radio", "telecom", "antenna"] },
  { value: "public-works", label: "Public Works", icon: "helmet-safety", keywords: ["public works", "engineering", "infrastructure", "construction", "debris"] },
  { value: "medical", label: "Health and Medical", icon: "kit-medical", keywords: ["medical", "health", "ems", "ambulance", "hospital"] },
  { value: "hazmat", label: "Hazardous Materials", icon: "biohazard", keywords: ["hazardous", "hazmat", "chemical", "radiological", "biological"] },
  { value: "law-enforcement", label: "Law Enforcement and Security", icon: "shield-halved", keywords: ["law enforcement", "security", "police", "sheriff"] },
  { value: "search-rescue", label: "Search and Rescue", icon: "magnifying-glass-location", keywords: ["search and rescue", "usar", "rescue"] },
  { value: "fire", label: "Firefighting", icon: "fire-extinguisher", keywords: ["fire", "suppression", "wildland"] },
  { value: "mass-care", label: "Mass Care and Shelter", icon: "people-roof", keywords: ["mass care", "shelter", "housing", "human services"] },
  { value: "transportation", label: "Transportation", icon: "truck-fast", keywords: ["transportation", "ground support", "fleet", "vehicle"] },
  { value: "animals-agriculture", label: "Animals and Agriculture", icon: "paw", keywords: ["animal", "agriculture", "veterinary"] },
  { value: "energy", label: "Energy and Utilities", icon: "bolt", keywords: ["energy", "electric", "power", "utility"] },
  { value: "water", label: "Water and Supply", icon: "droplet", keywords: ["water", "potable", "wastewater"] },
  { value: "facilities", label: "Facilities and Command", icon: "building-shield", keywords: ["command", "facility", "eoc", "management"] },
  { value: "other", label: "Other Resources", icon: "boxes-stacked", keywords: [] }
].map((definition) => ({ ...definition, url: iconUrl(definition.icon) }));

export const SHARED_FACILITY_SYMBOL_URL = iconUrl("facility-management");

export function sharedResourceSymbol(record = {}) {
  const value = `${record.NIMS_Category || record.category || ""} ${record.ResourceName || record.assetType || ""}`.toLowerCase();
  return SHARED_RESOURCE_SYMBOLS.find((definition) => definition.keywords.some((keyword) => value.includes(keyword))) || SHARED_RESOURCE_SYMBOLS.at(-1);
}
