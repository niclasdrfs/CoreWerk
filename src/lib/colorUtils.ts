// Predefined contrasting colors for construction sites
export const SITE_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#6366F1", // Indigo
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#A855F7", // Violet
];

// Simple hash function for consistent color assignment
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Get a color for a site, avoiding recently used colors
export const getSiteColor = (siteId: string, existingColors: string[]): string => {
  const availableColors = SITE_COLORS.filter(c => !existingColors.includes(c));
  
  if (availableColors.length > 0) {
    // Use hash to get consistent color for same site
    return availableColors[hashCode(siteId) % availableColors.length];
  }
  
  // Fallback: hash-based selection from all colors
  return SITE_COLORS[hashCode(siteId) % SITE_COLORS.length];
};

// Assign colors to sites that don't have one
export const assignColorToSite = async (
  siteId: string, 
  existingSiteColors: string[],
  supabase: any
): Promise<string> => {
  const color = getSiteColor(siteId, existingSiteColors);
  
  await supabase
    .from("construction_sites")
    .update({ color })
    .eq("id", siteId);
  
  return color;
};

// Get readable text color based on background
export const getTextColor = (backgroundColor: string): string => {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, dark for light backgrounds
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
};