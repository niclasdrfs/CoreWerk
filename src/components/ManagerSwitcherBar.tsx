import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Users, HardHat, User } from "lucide-react";

// Distinct colors for each manager
export const MANAGER_COLORS = [
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

export type PersonType = "ober_montageleiter" | "installation_manager" | "employee";

export interface ManagerEntry {
  id: string;
  name: string;
  isOber: boolean;
  personType: PersonType;
  color: string;
}

function getContrastTextColor(hex: string | undefined | null): string {
  if (!hex || typeof hex !== 'string' || hex.length < 7) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#000000" : "#ffffff";
}

interface ManagerSwitcherBarProps {
  selectedManagerId: string | null;
  onSelectManager: (managerId: string) => void;
  companyId: string;
  managers: ManagerEntry[];
}

export const useManagerList = (companyId: string | undefined | null, includeEmployees = false) => {
  const { user } = useAuth();

  return useQuery<ManagerEntry[]>({
    queryKey: ["switcher-managers", companyId, user?.id, includeEmployees],
    queryFn: async () => {
      const rolesToFetch: ("installation_manager" | "ober_montageleiter" | "employee")[] = includeEmployees
        ? ["installation_manager", "ober_montageleiter", "employee"]
        : ["installation_manager", "ober_montageleiter"];

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("company_id", companyId!)
        .in("role", rolesToFetch);

      if (roleError) throw roleError;
      if (!roleData || roleData.length === 0) return [];

      const userIds = [...new Set(roleData.map((r) => r.user_id))];

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profileError) throw profileError;

      const oberIds = new Set(
        roleData.filter((r) => r.role === "ober_montageleiter").map((r) => r.user_id)
      );
      const managerIds = new Set(
        roleData.filter((r) => r.role === "installation_manager").map((r) => r.user_id)
      );

      const getPersonType = (id: string): PersonType => {
        if (oberIds.has(id)) return "ober_montageleiter";
        if (managerIds.has(id)) return "installation_manager";
        return "employee";
      };

      const sorted = (profiles || [])
        .map((p) => ({
          id: p.id,
          name: p.full_name || p.email || "Unbekannt",
          isOber: oberIds.has(p.id),
          personType: getPersonType(p.id),
        }))
        .sort((a, b) => {
          if (a.id === user?.id) return -1;
          if (b.id === user?.id) return 1;
          // Ober-ML first, then managers, then employees
          const typeOrder: Record<PersonType, number> = { ober_montageleiter: 0, installation_manager: 1, employee: 2 };
          if (typeOrder[a.personType] !== typeOrder[b.personType]) return typeOrder[a.personType] - typeOrder[b.personType];
          return a.name.localeCompare(b.name);
        });

      // Assign stable colors by sorted index
      return sorted.map((m, i) => ({
        ...m,
        color: MANAGER_COLORS[i % MANAGER_COLORS.length],
      }));
    },
    enabled: !!companyId,
  });
};

export const ManagerSwitcherBar = ({
  selectedManagerId,
  onSelectManager,
  managers,
}: ManagerSwitcherBarProps) => {
  if (managers.length === 0) return null;

  const managerGroup = managers.filter(m => m.personType !== "employee");
  const employeeGroup = managers.filter(m => m.personType === "employee");

  return (
    <div className="px-2 md:px-3 pt-1 pb-0">
      <div className="flex items-end gap-1 overflow-x-auto scrollbar-hide">
        {managerGroup.length > 0 && (
          <>
            <HardHat className="h-3 w-3 text-muted-foreground flex-shrink-0 mb-1.5" />
            <div className="flex gap-0.5">
              {managerGroup.map((manager) => {
                const isSelected = selectedManagerId === manager.id;
                return (
                  <button
                    key={manager.id}
                    onClick={() => onSelectManager(manager.id)}
                    className="px-2 py-0.5 text-xs whitespace-nowrap transition-all"
                    style={{
                      borderColor: manager.color,
                      borderWidth: "2px",
                      borderStyle: "solid",
                      borderBottomWidth: isSelected ? "0" : "2px",
                      borderRadius: isSelected ? "6px 6px 0 0" : "6px",
                      backgroundColor: isSelected ? manager.color : `${manager.color}15`,
                      color: isSelected ? getContrastTextColor(manager.color) : manager.color,
                      fontWeight: isSelected ? 700 : 600,
                      marginBottom: isSelected ? "-3px" : "0",
                      position: "relative",
                      zIndex: isSelected ? 10 : 1,
                      paddingBottom: isSelected ? "calc(0.25rem + 3px)" : undefined,
                    }}
                  >
                    {manager.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {employeeGroup.length > 0 && managerGroup.length > 0 && (
          <div className="w-px h-4 bg-border flex-shrink-0 mx-1 mb-0.5" />
        )}
        {employeeGroup.length > 0 && (
          <>
            <User className="h-3 w-3 text-muted-foreground flex-shrink-0 mb-1.5" />
            <div className="flex gap-0.5">
              {employeeGroup.map((employee) => {
                const isSelected = selectedManagerId === employee.id;
                return (
                  <button
                    key={employee.id}
                    onClick={() => onSelectManager(employee.id)}
                    className="px-2 py-0.5 text-xs whitespace-nowrap transition-all"
                    style={{
                      borderColor: employee.color,
                      borderWidth: "2px",
                      borderStyle: "solid",
                      borderBottomWidth: isSelected ? "0" : "2px",
                      borderRadius: isSelected ? "6px 6px 0 0" : "6px",
                      backgroundColor: isSelected ? employee.color : `${employee.color}15`,
                      color: isSelected ? getContrastTextColor(employee.color) : employee.color,
                      fontWeight: isSelected ? 700 : 600,
                      marginBottom: isSelected ? "-3px" : "0",
                      position: "relative",
                      zIndex: isSelected ? 10 : 1,
                      paddingBottom: isSelected ? "calc(0.25rem + 3px)" : undefined,
                    }}
                  >
                    {employee.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
