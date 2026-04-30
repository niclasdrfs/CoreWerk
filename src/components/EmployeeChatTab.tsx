import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Send, ImagePlus, Building2, ChevronDown, ImageIcon, User, MessageSquare, Plus, Users, Search, X } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { SiteMenuSubView } from "./SiteMenuSubView";
import { CreateGroupDialog } from "./chat/CreateGroupDialog";

interface ChatGroup {
  id: string;
  customer_last_name: string;
  address: string | null;
  color: string | null;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

interface CustomGroup {
  id: string;
  name: string;
  company_id: string;
  created_by: string;
}

interface ChatMessage {
  id: string;
  content: string | null;
  image_path: string | null;
  created_at: string;
  sender_id: string;
  profiles: { full_name: string | null } | null;
}

export function EmployeeChatTab() {
  const { user, hasRole } = useAuth();
  const isAccounting = hasRole("accounting");
  const queryClient = useQueryClient();
  const [selectedSite, setSelectedSite] = useState<ChatGroup | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<CustomGroup | null>(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showSiteMenu, setShowSiteMenu] = useState(false);
  const [siteMenuView, setSiteMenuView] = useState<"plans" | "customer" | "correspondence" | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingDM, setIsCreatingDM] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get user profile for company_id and full_name
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_id, full_name")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Fetch all company profiles for search
  const { data: companyProfiles = [] } = useQuery({
    queryKey: ["company-profiles-search", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles_limited" as any)
        .select("id, full_name, email")
        .eq("company_id", profile!.company_id!)
        .neq("id", user!.id);
      return (data || []) as unknown as { id: string; full_name: string | null; email: string }[];
    },
    enabled: !!profile?.company_id && !!user,
  });

  const searchLower = searchQuery.trim().toLowerCase();

  const filteredProfiles = searchLower
    ? companyProfiles.filter(p =>
        (p.full_name || "").toLowerCase().includes(searchLower) ||
        p.email.toLowerCase().includes(searchLower)
      )
    : [];


  // Open or create a DM conversation with a person
  const openDirectMessage = async (targetUserId: string) => {
    if (!user || !profile?.company_id) return;
    setIsCreatingDM(true);
    try {
      const sortedIds = [user.id, targetUserId].sort();
      const dmName = `DM:${sortedIds[0]}:${sortedIds[1]}`;

      let { data: existingGroup } = await supabase
        .from("chat_groups")
        .select("id, name, company_id, created_by")
        .eq("company_id", profile.company_id)
        .eq("name", dmName)
        .maybeSingle();

      if (!existingGroup) {
        const { data: newGroup, error: createErr } = await supabase
          .from("chat_groups")
          .insert({ name: dmName, company_id: profile.company_id, created_by: user.id })
          .select("id, name, company_id, created_by")
          .single();
        if (createErr) throw createErr;
        existingGroup = newGroup;
        await supabase.from("chat_group_members").insert([
          { group_id: newGroup.id, user_id: user.id },
          { group_id: newGroup.id, user_id: targetUserId },
        ]);
      }

      queryClient.invalidateQueries({ queryKey: ["chat-groups"] });
      setSelectedGroup(existingGroup as CustomGroup);
      setSearchQuery("");
      setIsSearching(false);
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Öffnen der Direktnachricht");
    } finally {
      setIsCreatingDM(false);
    }
  };

  // Helper to get DM partner name
  const getDMPartnerName = (dmGroupName: string) => {
    if (!dmGroupName.startsWith("DM:") || !user) return dmGroupName;
    const parts = dmGroupName.split(":");
    const partnerId = parts[1] === user.id ? parts[2] : parts[1];
    const partner = companyProfiles.find(p => p.id === partnerId);
    return partner?.full_name || partner?.email || "Direktnachricht";
  };

  // Get construction sites (skip for accounting - they only see assigned groups)
  const { data: sites } = useQuery({
    queryKey: ["chat-sites", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("construction_sites")
        .select("id, customer_last_name, address, color")
        .eq("company_id", profile!.company_id!)
        .eq("status", "active")
        .order("customer_last_name");
      return (data || []) as ChatGroup[];
    },
    enabled: !!profile?.company_id && !isAccounting,
  });

  // Get last messages for each site
  const { data: lastMessages } = useQuery({
    queryKey: ["chat-last-messages", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("construction_site_id, content, created_at")
        .eq("company_id", profile!.company_id!)
        .order("created_at", { ascending: false });
      
      // Group by site, take first (latest) per site
      const map: Record<string, { content: string | null; created_at: string }> = {};
      for (const msg of data || []) {
        if (!map[msg.construction_site_id]) {
          map[msg.construction_site_id] = msg;
        }
      }
      return map;
    },
    enabled: !!profile?.company_id,
  });

  // Fetch custom chat groups (accounting only sees groups they're a member of)
  const { data: customGroups = [] } = useQuery({
    queryKey: ["chat-groups", profile?.company_id, isAccounting, user?.id],
    queryFn: async () => {
      if (isAccounting) {
        // Only get groups where user is a member
        const { data: memberships } = await supabase
          .from("chat_group_members")
          .select("group_id")
          .eq("user_id", user!.id);
        const groupIds = (memberships || []).map(m => m.group_id);
        if (groupIds.length === 0) return [];
        const { data, error } = await supabase
          .from("chat_groups")
          .select("id, name, company_id, created_by")
          .in("id", groupIds)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as CustomGroup[];
      }
      const { data, error } = await supabase
        .from("chat_groups")
        .select("id, name, company_id, created_by")
        .eq("company_id", profile!.company_id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CustomGroup[];
    },
    enabled: !!profile?.company_id,
  });

  const filteredGroups = searchLower
    ? customGroups.filter(g => {
        const isDM = g.name.startsWith("DM:");
        const displayName = isDM ? getDMPartnerName(g.name) : g.name;
        return displayName.toLowerCase().includes(searchLower);
      })
    : [];

  const filteredSites = searchLower && !isAccounting
    ? (sites || []).filter(s =>
        s.customer_last_name.toLowerCase().includes(searchLower) ||
        (s.address || "").toLowerCase().includes(searchLower)
      )
    : [];

  const { data: groupLastMessages } = useQuery({
    queryKey: ["chat-group-last-messages", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("chat_group_id, content, created_at")
        .not("chat_group_id", "is", null)
        .order("created_at", { ascending: false });
      const map: Record<string, { content: string | null; created_at: string }> = {};
      for (const msg of data || []) {
        if (msg.chat_group_id && !map[msg.chat_group_id]) {
          map[msg.chat_group_id] = msg;
        }
      }
      return map;
    },
    enabled: !!profile?.company_id,
  });

  // Fetch group members for selected group
  const { data: groupMembers } = useQuery({
    queryKey: ["chat-group-members", selectedGroup?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_group_members")
        .select("user_id")
        .eq("group_id", selectedGroup!.id);
      if (error) throw error;
      const userIds = (data || []).map(m => m.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      return profiles || [];
    },
    enabled: !!selectedGroup,
  });

  // Determine active chat context
  const activeChatId = selectedSite?.id || selectedGroup?.id;
  const isGroupChat = !!selectedGroup;

  // Get messages for selected site OR group
  const { data: messages } = useQuery({
    queryKey: ["chat-messages", activeChatId, isGroupChat],
    queryFn: async () => {
      let query = supabase
        .from("chat_messages")
        .select("id, content, image_path, created_at, sender_id, profiles:sender_id(full_name)");
      
      if (isGroupChat) {
        query = query.eq("chat_group_id", selectedGroup!.id);
      } else {
        query = query.eq("construction_site_id", selectedSite!.id);
      }
      
      const { data } = await query.order("created_at", { ascending: true });
      return (data || []) as unknown as ChatMessage[];
    },
    enabled: !!activeChatId,
  });

  // Get members assigned to this construction site
  const { data: siteMembers } = useQuery({
    queryKey: ["chat-site-members", selectedSite?.id],
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("daily_assignments")
        .select("installation_manager_id, employee_assignments(employee_id)")
        .eq("construction_site_id", selectedSite!.id);

      const memberIds = new Set<string>();
      for (const a of assignments || []) {
        memberIds.add(a.installation_manager_id);
        for (const ea of (a.employee_assignments as any[] || [])) {
          memberIds.add(ea.employee_id);
        }
      }

      if (memberIds.size === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(memberIds));

      return profiles || [];
    },
    enabled: !!selectedSite,
  });

  // Realtime for site or group chat
  useEffect(() => {
    if (!activeChatId) return;
    const filterCol = isGroupChat ? "chat_group_id" : "construction_site_id";
    const channel = supabase
      .channel(`chat-${activeChatId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `${filterCol}=eq.${activeChatId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", activeChatId] });
        queryClient.invalidateQueries({ queryKey: ["chat-last-messages"] });
        queryClient.invalidateQueries({ queryKey: ["chat-group-last-messages"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChatId, isGroupChat, queryClient]);

  // Scroll to bottom on new messages and initial load
  useEffect(() => {
    if (scrollRef.current) {
      // Use setTimeout to ensure DOM has rendered
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [messages, selectedSite, selectedGroup]);

  const sendMutation = useMutation({
    mutationFn: async ({ content, imagePath }: { content?: string; imagePath?: string }) => {
      const insertData: any = {
        sender_id: user!.id,
        company_id: profile!.company_id!,
        content: content || null,
        image_path: imagePath || null,
      };
      if (isGroupChat) {
        insertData.chat_group_id = selectedGroup!.id;
        insertData.construction_site_id = null;
      } else {
        insertData.construction_site_id = selectedSite!.id;
      }
      const { error } = await supabase.from("chat_messages").insert(insertData);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["chat-messages", activeChatId] });
      queryClient.invalidateQueries({ queryKey: ["chat-last-messages"] });
      queryClient.invalidateQueries({ queryKey: ["chat-group-last-messages"] });

      // Fire push notification to other participants (fire-and-forget)
      const preview = variables.content?.slice(0, 100) || "📷 Bild";
      supabase.functions.invoke("notify-chat-message", {
        body: {
          sender_id: user!.id,
          sender_name: profile?.full_name || "Unbekannt",
          chat_group_id: isGroupChat ? selectedGroup?.id : undefined,
          construction_site_id: !isGroupChat ? selectedSite?.id : undefined,
          message_preview: preview,
        },
      }).catch(() => {}); // silent fail
    },
    onError: () => toast.error("Nachricht konnte nicht gesendet werden"),
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate({ content: message.trim() });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedSite) return;

    setIsUploading(true);
    try {
      const filePath = `${user.id}/${selectedSite.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("chat-images")
        .getPublicUrl(filePath);

      sendMutation.mutate({ imagePath: urlData.publicUrl });
    } catch {
      toast.error("Bild konnte nicht hochgeladen werden");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getSiteColor = (color: string | null) => {
    return color || "hsl(var(--primary))";
  };

  // Site menu sub-view (Plans, Customer Info, Correspondence)
  if (selectedSite && siteMenuView) {
    return (
      <SiteMenuSubView
        siteId={selectedSite.id}
        siteName={selectedSite.customer_last_name}
        view={siteMenuView}
        onBack={() => setSiteMenuView(null)}
        userId={user?.id}
      />
    );
  }

  // Chat detail view (site or group)
  if (selectedSite || selectedGroup) {
    const isDMChat = selectedGroup?.name.startsWith("DM:");
    const chatTitle = selectedSite ? selectedSite.customer_last_name : (isDMChat ? getDMPartnerName(selectedGroup!.name) : selectedGroup!.name);
    const chatColor = selectedSite ? getSiteColor(selectedSite.color) : isDMChat ? "hsl(var(--primary))" : "hsl(142,70%,35%)";
    const chatIcon = selectedSite ? <Building2 className="w-4 h-4" /> : isDMChat ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />;
    const membersList = selectedSite ? siteMembers : groupMembers;
    const handleBack = () => { setSelectedSite(null); setSelectedGroup(null); setShowSiteMenu(false); setSiteMenuView(null); };
    return (
      <>
        {/* Chat Header - fixed at top */}
        <div className="fixed top-14 left-0 right-0 z-30 bg-background border-b border-border px-4 py-3 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: chatColor }}
            >
              {chatIcon}
            </div>
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => selectedSite && setShowSiteMenu(!showSiteMenu)}
            >
              <div className="flex items-center gap-1">
                <h2 className="font-semibold text-sm truncate">{chatTitle}</h2>
                {selectedSite && <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${showSiteMenu ? "rotate-180" : ""}`} />}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {membersList && membersList.length > 0
                  ? membersList.map(m => {
                    const parts = (m.full_name || "?").split(" ");
                    const first = parts[0];
                    const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : "";
                    return `${first}${lastInitial}`;
                  }).join(", ")
                  : selectedSite?.address || "Keine Mitglieder"}
              </p>
            </button>
          </div>
        </div>

        {/* Site menu dropdown - only for site chats */}
        {showSiteMenu && selectedSite && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowSiteMenu(false)} />
            <div className="fixed top-[7.5rem] left-4 right-4 z-40 bg-card border border-border rounded-xl shadow-lg p-2 max-w-3xl mx-auto">
              <button
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors text-left"
                onClick={() => { setShowSiteMenu(false); setSiteMenuView("plans"); }}
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Pläne & Bilder</p>
                  <p className="text-xs text-muted-foreground">Fotos und Dokumente</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors text-left"
                onClick={() => { setShowSiteMenu(false); setSiteMenuView("customer"); }}
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Kundeninfos</p>
                  <p className="text-xs text-muted-foreground">Kontakt und Notizen</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors text-left"
                onClick={() => { setShowSiteMenu(false); setSiteMenuView("correspondence"); }}
              >
                <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Schriftverkehr</p>
                  <p className="text-xs text-muted-foreground">Einträge und Dateien</p>
                </div>
              </button>
            </div>
          </>
        )}

        <div className="flex flex-col pb-16 pt-16">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 py-2">
            {(!messages || messages.length === 0) && (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                Noch keine Nachrichten. Starte die Unterhaltung!
              </div>
            )}
            {messages?.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-2 max-w-[80%] ${isMe ? "flex-row-reverse" : ""}`}>
                    {!isMe && (
                      <Avatar className="w-7 h-7 shrink-0 mt-1">
                        <AvatarFallback className="text-[10px] bg-secondary">
                          {getInitials(msg.profiles?.full_name ?? null)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      {!isMe && (
                        <p className="text-[10px] text-muted-foreground mb-0.5 px-1">
                          {msg.profiles?.full_name || "Unbekannt"}
                        </p>
                      )}
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        {msg.image_path && (
                          <img
                            src={msg.image_path}
                            alt="Bild"
                            className="rounded-lg max-w-full max-h-48 mb-1 cursor-pointer"
                            onClick={() => window.open(msg.image_path!, "_blank")}
                          />
                        )}
                        {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                      </div>
                      <p className={`text-[10px] text-muted-foreground mt-0.5 ${isMe ? "text-right" : ""} px-1`}>
                        {format(new Date(msg.created_at), "HH:mm", { locale: de })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input - fixed above bottom nav */}
        <div className="fixed bottom-20 md:bottom-16 left-0 right-0 z-30 bg-background border-t border-border px-4 py-2">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="shrink-0"
            >
              <ImagePlus className="w-5 h-5" />
            </Button>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nachricht schreiben..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!message.trim() || sendMutation.isPending}
              className="shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Chat list view
  return (
    <div className="divide-y divide-border relative">
      <div className="px-3 py-3 space-y-3">
        <h2 className="text-lg font-semibold">Chats</h2>
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Chats & Kontakte suchen..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setIsSearching(!!e.target.value.trim()); }}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setIsSearching(false); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {isSearching && (
        <div className="bg-card">
          {filteredGroups.length === 0 && filteredSites.length === 0 && filteredProfiles.length === 0 && (
            <div className="text-center text-muted-foreground py-6 text-sm">Keine Ergebnisse gefunden</div>
          )}

          {/* Matching groups & DMs */}
          {filteredGroups.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">Chats</div>
              {filteredGroups.map((group) => {
                const isDM = group.name.startsWith("DM:");
                const displayName = isDM ? getDMPartnerName(group.name) : group.name;
                const last = groupLastMessages?.[group.id];
                return (
                  <button
                    key={`search-group-${group.id}`}
                    onClick={() => { setSelectedGroup(group); setSearchQuery(""); setIsSearching(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/60 transition-colors text-left"
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 ${isDM ? "bg-primary" : "bg-[hsl(142,70%,35%)]"}`}>
                      {isDM ? <User className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{displayName}</h3>
                      <p className="text-xs text-muted-foreground truncate">{last?.content || "Noch keine Nachrichten"}</p>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Matching site chats */}
          {filteredSites.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">Baustellen</div>
              {filteredSites.map((site) => {
                const last = lastMessages?.[site.id];
                return (
                  <button
                    key={`search-site-${site.id}`}
                    onClick={() => { setSelectedSite(site); setSearchQuery(""); setIsSearching(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/60 transition-colors text-left"
                  >
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: getSiteColor(site.color) }}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{site.customer_last_name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{last?.content || site.address || "Noch keine Nachrichten"}</p>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Matching contacts */}
          {filteredProfiles.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">Kontakte</div>
              {filteredProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openDirectMessage(p.id)}
                  disabled={isCreatingDM}
                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/60 transition-colors text-left"
                >
                  <div className="w-11 h-11 rounded-full flex items-center justify-center bg-primary/10 text-primary shrink-0 text-xs font-bold">
                    {getInitials(p.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{p.full_name || p.email}</h3>
                    {p.full_name && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                  </div>
                  <Send className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Custom Groups & DMs */}
      {!isSearching && customGroups.map((group) => {
        const last = groupLastMessages?.[group.id];
        const isDM = group.name.startsWith("DM:");
        const displayName = isDM ? getDMPartnerName(group.name) : group.name;
        return (
          <button
            key={`group-${group.id}`}
            onClick={() => setSelectedGroup(group)}
            className="w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/60 transition-colors text-left"
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 ${isDM ? "bg-primary" : "bg-[hsl(142,70%,35%)]"}`}>
              {isDM ? <User className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm truncate">{displayName}</h3>
                {last && (
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {format(new Date(last.created_at), "dd.MM. HH:mm", { locale: de })}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {last?.content || "Noch keine Nachrichten"}
              </p>
            </div>
          </button>
        );
      })}

      {/* Site Chats - hidden for accounting and during search */}
      {!isSearching && !isAccounting && (!sites || sites.length === 0) && customGroups.length === 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">
          Keine Chats vorhanden.
        </div>
      )}
      {!isSearching && isAccounting && customGroups.length === 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">
          Keine Chats vorhanden. Sie sehen nur Gruppen, denen Sie zugewiesen wurden.
        </div>
      )}
      {!isSearching && !isAccounting && sites?.map((site) => {
        const last = lastMessages?.[site.id];
        return (
          <button
            key={site.id}
            onClick={() => setSelectedSite(site)}
            className="w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/60 transition-colors text-left"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: getSiteColor(site.color) }}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm truncate">{site.customer_last_name}</h3>
                {last && (
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {format(new Date(last.created_at), "dd.MM. HH:mm", { locale: de })}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {last?.content || site.address || "Noch keine Nachrichten"}
              </p>
            </div>
          </button>
        );
      })}

      {/* FAB: Create new group */}
      <button
        onClick={() => setShowCreateGroup(true)}
        className="fixed bottom-24 md:bottom-20 right-4 z-20 w-14 h-14 rounded-full bg-[hsl(142,70%,35%)] text-white shadow-lg flex items-center justify-center hover:bg-[hsl(142,70%,30%)] transition-colors"
      >
        <Plus className="w-6 h-6" />
      </button>

      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        companyId={profile?.company_id || ""}
      />
    </div>
  );
}
