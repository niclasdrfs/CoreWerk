/**
 * useRealtimeSubscriptions – Globale Echtzeit-Datensynchronisation
 *
 * Funktionsweise:
 * - Ein einziger Supabase-Channel überwacht alle relevanten Tabellen.
 * - Änderungen werden per QueryClient.invalidateQueries weitergegeben.
 *
 * Performance (skaliert auf 1.000 gleichzeitige Nutzer):
 * - Debouncing: Schnelle aufeinanderfolgende Änderungen an derselben Tabelle
 *   werden zu einem einzigen Refetch zusammengefasst (16 ms Fenster).
 *   → Verhindert Query-Stürme bei Bulk-Updates in der DB.
 * - refetchType: "active" fetcht nur Queries, die gerade aktiv sind.
 *   → Keine unnötigen Netzwerkanfragen für nicht sichtbare Seiten.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// ── Query-Key-Mapping ─────────────────────────────────────────────────────────
// Welche Tabellen lösen welche Query-Invalidierungen aus?
const TABLE_QUERY_MAP: Record<string, string[]> = {
  // Zeit-Tracking
  time_entries: ["active-time-entries", "active-time-entry", "time-entries", "employee-hours"],

  // Baustellen
  construction_sites: ["construction-sites", "owner-sites", "site-details", "employee-sites", "chat-sites"],
  construction_site_categories: ["site-categories"],
  construction_site_timelines: ["site-timeline", "timeline"],
  construction_site_timeline_stages: ["site-timeline", "timeline-stages", "stage"],

  // Tagesplanung / Einsätze
  daily_assignments: ["daily-assignments", "assignments", "employee-assignment", "employee-day-assignments", "workday", "assignment-team"],
  employee_assignments: ["employee-assignments", "assignments", "employee-day-assignments", "workday", "assignment-team"],
  assignment_packing_list: ["packing-list", "assignment-packing", "employee-packing-list"],
  assignment_materials: ["assignment-materials"],

  // Mitarbeiter
  profiles: ["profiles", "profile", "employees", "owner-profile", "installation-manager", "assignment-team", "owner-employees"],
  employee_status: ["employee-status"],
  employee_custom_todos: ["employee-todos", "custom-todos", "employee-custom-todos"],
  employee_material_todos: ["material-todos", "employee-material-todos"],

  // Kunden
  customers: ["customers", "customer"],

  // Materialien
  materials: ["materials"],
  material_categories: ["material-categories"],
  material_subfolders: ["material-subfolders"],

  // Dokumentation
  stage_documentation: ["stage-documentation", "documentation"],
  stage_employee_assignments: ["stage-employees", "stage-assignments"],

  // Kalkulator
  calculator_categories: ["calculator-categories", "calculator-categories-with-count"],
  calculator_products: ["calculator-products"],
  calculator_product_items: ["calculator-products", "product-items"],
  saved_quotes: ["saved-quotes", "quotes", "site-quotes"],

  // Timeline Templates
  timeline_templates: ["timeline-templates", "templates"],
  timeline_template_stages: ["template-stages"],
  timeline_template_stage_todos: ["template-todos"],
  timeline_template_stage_packing_items: ["template-packing"],

  // Custom Pages
  owner_custom_pages: ["custom-pages", "owner-pages"],

  // Chat
  chat_messages: ["chat-messages", "chat-last-messages"],
};

const WATCHED_TABLES = Object.keys(TABLE_QUERY_MAP);
const DEBOUNCE_MS = 16; // Ein Frame – reicht aus, um Burst-Updates zu bündeln

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useRealtimeSubscriptions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Debounce-Timer pro Tabelle: { tableName → timeoutId }
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("db-changes");

    WATCHED_TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          // Laufenden Timer für diese Tabelle abbrechen und neu starten
          const existing = debounceTimers.current.get(table);
          if (existing) clearTimeout(existing);

          const timer = setTimeout(() => {
            const queryKeys = TABLE_QUERY_MAP[table] ?? [];
            queryKeys.forEach((key) => {
              queryClient.invalidateQueries({ queryKey: [key], refetchType: "active" });
            });
            debounceTimers.current.delete(table);
          }, DEBOUNCE_MS);

          debounceTimers.current.set(table, timer);
        }
      );
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.info("[Realtime] Verbunden – überwache", WATCHED_TABLES.length, "Tabellen");
      } else if (status === "CHANNEL_ERROR") {
        console.warn("[Realtime] Verbindungsfehler – Reconnect läuft...");
      }
    });

    return () => {
      // Alle offenen Debounce-Timer aufräumen
      debounceTimers.current.forEach(clearTimeout);
      debounceTimers.current.clear();
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
