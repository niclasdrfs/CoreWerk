import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanySettingsDialog } from "@/components/calculator/CompanySettingsDialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FileDown,
  Plus,
  Trash2,
  Settings,
  FileText,
  User,
  LayoutGrid,
  ChevronDown,
  PackagePlus,
} from "lucide-react";

interface LineItem {
  id: string;
  position: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

type Customer = {
  id: string;
  name: string;
  company_name: string | null;
  address: string | null;
  address_line_2: string | null;
  phone: string | null;
  email: string | null;
  customer_number: string | null;
};

const AutoResizeTextarea = ({
  className,
  value,
  onChange,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);
  useEffect(() => { resize(); }, [value, resize]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => { onChange?.(e); resize(); }}
      className={cn(
        "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden",
        className
      )}
      rows={1}
      {...props}
    />
  );
};

const OwnerQuoteConfigurator = () => {
  const { user } = useAuth();
  const [showCompanySettings, setShowCompanySettings] = useState(false);

  // Quote state
  const [quoteTitle, setQuoteTitle] = useState("Angebot");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [greeting, setGreeting] = useState("Sehr geehrte Damen und Herren,");
  const [introText, setIntroText] = useState(
    "wir freuen uns über Ihr Interesse an unserem Service/unseren Produkten.\n\nHier unser Angebot für Sie:"
  );
  const [closingText, setClosingText] = useState(
    "Ist unser Angebot für Sie interessant? Dann freuen wir uns über Ihren Auftrag!\nZögern Sie bitte nicht, uns bei Fragen zu kontaktieren."
  );
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), position: "1", description: "", quantity: 1, unit: "Stk", unitPrice: 0 },
  ]);

  const [importFromQuote, setImportFromQuote] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["owner-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: company } = useQuery({
    queryKey: ["company-details", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.company_id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!profile?.company_id,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from("customers")
        .select("id, name, company_name, address, address_line_2, phone, email, customer_number")
        .eq("company_id", profile.company_id)
        .order("name");
      return (data || []) as Customer[];
    },
    enabled: !!profile?.company_id,
  });

  const { data: savedQuotes = [] } = useQuery({
    queryKey: ["saved-quotes", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from("saved_quotes")
        .select("id, title, total_price, products")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Calculator categories for template selection
  const { data: calcCategories = [] } = useQuery({
    queryKey: ["calc-categories-quote", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from("calculator_categories")
        .select("id, name, slug")
        .eq("company_id", profile.company_id)
        .order("name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const [selectedCalcCategory, setSelectedCalcCategory] = useState("");

  // Products for selected category
  const { data: calcProducts = [] } = useQuery({
    queryKey: ["calc-products-quote", selectedCalcCategory],
    queryFn: async () => {
      if (!selectedCalcCategory) return [];
      const { data } = await supabase
        .from("calculator_products")
        .select("id, name, article_number, unit_type, base_quantity, margin_multiplier, calculator_product_items(price)")
        .eq("category_id", selectedCalcCategory)
        .order("name");
      return data || [];
    },
    enabled: !!selectedCalcCategory,
  });

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Auto-populate customer number when customer is selected
  useEffect(() => {
    if (selectedCustomer?.customer_number) {
      setCustomerNumber(selectedCustomer.customer_number);
    }
  }, [selectedCustomer]);

  const totalNet = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [lineItems]
  );
  const totalTax = totalNet * 0.19;
  const totalGross = totalNet + totalTax;

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        position: String(prev.length + 1),
        description: "",
        quantity: 1,
        unit: "Stk",
        unitPrice: 0,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      return updated.map((item, i) => ({ ...item, position: String(i + 1) }));
    });
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleImportQuote = (quoteId: string) => {
    setImportFromQuote(quoteId);
    const quote = savedQuotes.find((q) => q.id === quoteId);
    if (quote && Array.isArray(quote.products)) {
      const products = quote.products as any[];
      const imported: LineItem[] = products.map((p, i) => ({
        id: crypto.randomUUID(),
        position: String(i + 1),
        description: p.name || "",
        quantity: p.quantity || 1,
        unit: p.unitType === "meter" ? "m" : p.unitType === "square_meter" ? "m²" : "Stk",
        unitPrice: p.sellingPricePerUnit || p.pricePerUnit || 0,
      }));
      setLineItems(imported);
      if (quote.title) setQuoteTitle(quote.title);
      toast.success("Positionen aus Kalkulation importiert", { duration: 2000 });
    }
  };

  const handleImportFromCategory = (productId: string) => {
    const product = calcProducts.find((p) => p.id === productId);
    if (!product) return;
    const totalItemPrice = (product.calculator_product_items || []).reduce(
      (sum: number, item: any) => sum + (item.price || 0),
      0
    );
    const margin = product.margin_multiplier || 1;
    const unitMap: Record<string, string> = { meter: "m", square_meter: "m²", piece: "Stk" };
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      position: String(lineItems.length + 1),
      description: product.name + (product.article_number ? ` (${product.article_number})` : ""),
      quantity: product.base_quantity || 1,
      unit: unitMap[product.unit_type] || "Stk",
      unitPrice: Math.round(totalItemPrice * margin * 100) / 100,
    };
    setLineItems((prev) => [...prev, newItem]);
    toast.success(`"${product.name}" hinzugefügt`);
  };


  const fmt = (n: number) =>
    n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const generatePDF = async () => {
    if (lineItems.every((item) => !item.description.trim())) {
      toast.error("Bitte mindestens eine Position eintragen");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginL = 25;
    const marginR = 20;
    const contentWidth = pageWidth - marginL - marginR;
    let y = 20;

    // ─── Logo / Company Name (top center) ───
    if (company?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = company.logo_url;
        });
        const ratio = img.width / img.height;
        const logoH = 20;
        const logoW = logoH * ratio;
        const logoX = (pageWidth - logoW) / 2;
        doc.addImage(img, "PNG", logoX, y, logoW, logoH);
        y += logoH + 6;
      } catch {
        // fallback to company name
        if (company?.name) {
          doc.setFontSize(24);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text(company.name, pageWidth / 2, y + 8, { align: "center" });
          y += 16;
          // underline
          doc.setDrawColor(0);
          doc.setLineWidth(0.8);
          doc.line(marginL + 20, y, pageWidth - marginR - 20, y);
          y += 8;
        }
      }
    } else if (company?.name) {
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(company.name, pageWidth / 2, y + 8, { align: "center" });
      y += 16;
      doc.setDrawColor(0);
      doc.setLineWidth(0.8);
      doc.line(marginL + 20, y, pageWidth - marginR - 20, y);
      y += 8;
    }

    // ─── Sender line (small, above customer address) ───
    const senderLine = [company?.name, company?.address].filter(Boolean).join(" – ");
    if (senderLine) {
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(senderLine, marginL, y);
      y += 2;
      doc.setDrawColor(160, 160, 160);
      doc.setLineWidth(0.3);
      doc.line(marginL, y, marginL + 85, y);
      y += 5;
    }

    const addressBlockY = y;

    // ─── Company details block (right side) ───
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    const rightX = pageWidth - marginR;
    let ry = addressBlockY;
    if (company?.name) { doc.text(company.name, rightX, ry, { align: "right" }); ry += 4.5; }
    if (company?.address) {
      const addrParts = company.address.split(",").map((s: string) => s.trim());
      addrParts.forEach((part: string) => { doc.text(part, rightX, ry, { align: "right" }); ry += 4.5; });
    }
    ry += 2;
    if (company?.phone) { doc.text(`Tel.: ${company.phone}`, rightX, ry, { align: "right" }); ry += 4.5; }
    if (company?.email) { doc.text(`E-Mail: ${company.email}`, rightX, ry, { align: "right" }); ry += 4.5; }

    // ─── Customer address (left side) ───
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    if (selectedCustomer) {
      if (selectedCustomer.company_name) { doc.text(selectedCustomer.company_name, marginL, y); y += 5; }
      doc.text(selectedCustomer.name, marginL, y); y += 5;
      if (selectedCustomer.address) { doc.text(selectedCustomer.address, marginL, y); y += 5; }
      if (selectedCustomer.address_line_2) { doc.text(selectedCustomer.address_line_2, marginL, y); y += 5; }
    }

    y = Math.max(y, ry) + 10;

    // ─── Title ───
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(quoteTitle, marginL, y);
    y += 10;
    doc.setFont("helvetica", "normal");

    // ─── Angebots-Nr., Kunden-Nr., Datum on one line ───
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const metaParts: string[] = [];
    if (quoteNumber) metaParts.push(`Angebots-Nr.: ${quoteNumber}`);
    if (customerNumber) metaParts.push(`Kunden-Nr.: ${customerNumber}`);
    metaParts.push(`Datum: ${new Date(quoteDate).toLocaleDateString("de-DE")}`);

    // Distribute across the line
    if (metaParts.length === 3) {
      doc.text(metaParts[0], marginL, y);
      doc.text(metaParts[1], pageWidth / 2, y, { align: "center" });
      doc.text(metaParts[2], rightX, y, { align: "right" });
    } else if (metaParts.length === 2) {
      doc.text(metaParts[0], marginL, y);
      doc.text(metaParts[1], rightX, y, { align: "right" });
    } else {
      doc.text(metaParts[0], rightX, y, { align: "right" });
    }
    y += 4;

    // Horizontal line
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, pageWidth - marginR, y);
    y += 8;

    // ─── Greeting & Intro ───
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    if (greeting.trim()) {
      doc.text(greeting, marginL, y);
      y += 7;
    }
    if (introText.trim()) {
      const introLines = doc.splitTextToSize(introText, contentWidth);
      doc.text(introLines, marginL, y);
      y += introLines.length * 5 + 5;
    }

    // ─── Table (with integrated totals) ───
    const tableData = lineItems
      .filter((item) => item.description.trim())
      .map((item) => [
        item.position,
        item.description,
        `${fmt(item.quantity)} ${item.unit}`,
        `${fmt(item.unitPrice)} EUR`,
        `${fmt(item.quantity * item.unitPrice)} EUR`,
      ]);

    autoTable(doc, {
      startY: y,
      head: [["Pos", "Bezeichnung", "Umfang", "Einzelpreis", "Gesamtpreis"]],
      body: [
        ...tableData,
        // Empty spacer rows to give the table some height like the reference
        ...(tableData.length < 5 ? Array(5 - tableData.length).fill(["", "", "", "", ""]) : []),
        // Summary rows
        ["", "Zwischensumme", "", "", `${fmt(totalNet)} EUR`],
        ["", "19% MwSt.", "", "", `${fmt(totalTax)} EUR`],
        ["", { content: "Gesamtbetrag", styles: { fontStyle: "bold" } }, "", "", { content: `${fmt(totalGross)} EUR`, styles: { fontStyle: "bold" } }],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 9,
        fontStyle: "bold",
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [0, 0, 0],
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 14, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 28, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 32, halign: "right" },
      },
      margin: { left: marginL, right: marginR },
      didParseCell: (data) => {
        const totalRows = data.table.body.length;
        const summaryStart = totalRows - 3;
        if (data.section === "body" && data.row.index >= summaryStart) {
          // Remove left borders for summary rows except last column
          data.cell.styles.lineWidth = 0.3;
          data.cell.styles.lineColor = [0, 0, 0];
          if (data.column.index < 1) {
            data.cell.styles.lineWidth = 0.3;
          }
        }
      },
    });

    // @ts-ignore
    y = doc.lastAutoTable.finalY + 12;

    // ─── Closing text ───
    if (closingText.trim()) {
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const closingLines = doc.splitTextToSize(closingText, contentWidth);
      doc.text(closingLines, marginL, y);
      y += closingLines.length * 5 + 5;
    }

    // Validity
    if (validUntil) {
      doc.setFontSize(10);
      doc.text(
        `Dieses Angebot ist gültig bis zum ${new Date(validUntil).toLocaleDateString("de-DE")}.`,
        marginL,
        y
      );
      y += 8;
    }

    // ─── Notes ───
    if (notes.trim()) {
      y += 3;
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const splitNotes = doc.splitTextToSize(notes, contentWidth);
      doc.text(splitNotes, marginL, y);
    }

    // ─── Footer ───
    const footerY = pageHeight - 18;
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(marginL, footerY - 4, pageWidth - marginR, footerY - 4);

    const footerParts: string[] = [];
    if (company?.name) footerParts.push(company.name);
    if (company?.address) footerParts.push(company.address);
    if (company?.phone) footerParts.push(`Tel.: ${company.phone}`);
    if (company?.email) footerParts.push(company.email);
    if (company?.tax_id) footerParts.push(`Steuer-Nr.: ${company.tax_id}`);

    if (footerParts.length) {
      doc.text(footerParts.join("  |  "), pageWidth / 2, footerY, { align: "center" });
    }

    // Download
    const fileName = `${quoteTitle.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}_${quoteDate}.pdf`;
    doc.save(fileName);
    toast.success("PDF heruntergeladen", { duration: 2000 });
  };

  const needsCompanySetup = !company?.name || !(company as any)?.address;

  return (
    <div className="flex-1 min-h-screen bg-muted/30">
      <header className="border-b border-violet-500/20 bg-gradient-to-r from-violet-500/15 via-violet-500/5 to-card safe-top">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold flex-1">Angebotskonfigurator</h1>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowCompanySettings(true)}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Firmendaten</span>
            </Button>
            <Button
              className="gap-2"
              size="sm"
              onClick={generatePDF}
              disabled={lineItems.every((i) => !i.description.trim())}
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Setup Hint */}
      {needsCompanySetup && (
        <div className="container mx-auto px-4 pt-4">
          <div className="max-w-[210mm] mx-auto bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
            <Settings className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Firmendaten einrichten</p>
              <p className="text-xs text-muted-foreground">
                Bitte hinterlegen Sie Ihre Firmenanschrift für den Briefkopf.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowCompanySettings(true)}>
              Einrichten
            </Button>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-6">
        {/* A4 Document */}
        <div
          className="mx-auto bg-card shadow-xl border border-border/50 rounded-sm"
          style={{
            maxWidth: "210mm",
            minHeight: "297mm",
            padding: "20mm 25mm 20mm 25mm",
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          }}
        >
          {/* ─── Company Header (centered) ─── */}
          <div className="text-center mb-2">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt="Logo"
                className="h-14 object-contain mx-auto mb-2"
                crossOrigin="anonymous"
              />
            ) : company?.name ? (
              <h2 className="text-2xl font-bold tracking-tight">{company.name}</h2>
            ) : (
              <h2 className="text-2xl font-bold tracking-tight text-muted-foreground/40">Firmenname</h2>
            )}
            <div className="border-b-2 border-foreground/80 mx-auto mt-2" style={{ maxWidth: "60%" }} />
          </div>

          {/* ─── Sender Line ─── */}
          {(company?.name || company?.address) && (
            <div className="mt-4 mb-0.5">
              <p className="text-[10px] text-muted-foreground">
                {[company?.name, company?.address].filter(Boolean).join(" – ")}
              </p>
              <div className="border-b border-muted-foreground/30 w-52 mt-0.5" />
            </div>
          )}

          {/* ─── Address & Company Details Row ─── */}
          <div className="flex justify-between mt-3 mb-6 gap-8">
            {/* Customer Address (left) - with dropdown */}
            <div className="flex-1 max-w-[55%]">
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 rounded h-auto py-1.5 px-2 text-sm font-medium text-left w-full mb-1.5 transition-colors">
                  <div className="flex items-center gap-1.5 w-full min-w-0">
                    <User className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      {selectedCustomer
                        ? (selectedCustomer.company_name
                            ? `${selectedCustomer.company_name} – ${selectedCustomer.name}`
                            : selectedCustomer.name)
                        : "Kunde auswählen..."}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name ? `${c.company_name} – ${c.name}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomer ? (
                <div className="text-sm space-y-0.5 pl-0.5">
                  {selectedCustomer.company_name && (
                    <p className="font-semibold">{selectedCustomer.company_name}</p>
                  )}
                  <p>{selectedCustomer.name}</p>
                  {selectedCustomer.address && <p className="text-muted-foreground">{selectedCustomer.address}</p>}
                  {selectedCustomer.address_line_2 && (
                    <p className="text-muted-foreground">{selectedCustomer.address_line_2}</p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground/40 italic pl-0.5">
                  <p>Firmenname</p>
                  <p>Vorname Nachname</p>
                  <p>Straße Nr.</p>
                  <p>PLZ Ort</p>
                </div>
              )}
            </div>

            {/* Company Details (right) */}
            <div className="text-right text-xs space-y-0.5 text-muted-foreground shrink-0">
              {company?.name && <p className="font-medium text-foreground">{company.name}</p>}
              {company?.address && company.address.split(",").map((part: string, i: number) => (
                <p key={i}>{part.trim()}</p>
              ))}
              {company?.phone && <p className="mt-1">Tel.: {company.phone}</p>}
              {company?.email && <p>{company.email}</p>}
            </div>
          </div>

          {/* ─── Title ─── */}
          <div className="mb-1">
            <input
              value={quoteTitle}
              onChange={(e) => setQuoteTitle(e.target.value)}
              className="text-xl font-bold bg-transparent border-none outline-none w-full p-0 placeholder:text-muted-foreground/40 focus:ring-0"
              placeholder="Angebot"
            />
          </div>

          {/* ─── Meta Line (Angebots-Nr., Kunden-Nr., Datum) ─── */}
          <div className="flex items-center gap-4 text-sm mb-1 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">Angebots-Nr.:</span>
              <input
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                className="bg-transparent border-none outline-none w-20 p-0 text-sm placeholder:text-muted-foreground/40 focus:ring-0"
                placeholder="2024-001"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">Kunden-Nr.:</span>
              <input
                value={customerNumber}
                onChange={(e) => setCustomerNumber(e.target.value)}
                className="bg-transparent border-none outline-none w-16 p-0 text-sm placeholder:text-muted-foreground/40 focus:ring-0"
                placeholder="1003"
              />
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-muted-foreground text-xs">Datum:</span>
              <input
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
                className="bg-transparent border-none outline-none p-0 text-sm focus:ring-0"
              />
            </div>
          </div>
          <div className="border-b border-foreground/60 mb-6" />

          {/* ─── Greeting & Intro ─── */}
          <div className="mb-4">
            <input
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className="bg-transparent border-none outline-none w-full p-0 text-sm placeholder:text-muted-foreground/40 focus:ring-0 mb-2"
              placeholder="Sehr geehrte Damen und Herren,"
            />
            <AutoResizeTextarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              className="border-none shadow-none bg-transparent p-0 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
              placeholder="wir freuen uns über Ihr Interesse..."
            />
          </div>

          {/* ─── Category Template Import (inline dropdown) ─── */}
          {calcCategories.length > 0 && (
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <Select value={selectedCalcCategory} onValueChange={setSelectedCalcCategory}>
                <SelectTrigger className="border-dashed border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10 rounded h-auto py-1.5 px-2 text-xs font-medium w-auto min-w-[180px] transition-colors">
                  <div className="flex items-center gap-1.5">
                    <LayoutGrid className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    <span>{calcCategories.find(c => c.id === selectedCalcCategory)?.name || "Vorlage wählen..."}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {calcCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCalcCategory && calcProducts.length > 0 && (
                <Select onValueChange={handleImportFromCategory}>
                  <SelectTrigger className="border-dashed border-green-500/40 bg-green-500/5 hover:bg-green-500/10 rounded h-auto py-1.5 px-2 text-xs font-medium w-auto min-w-[200px] transition-colors">
                    <div className="flex items-center gap-1.5">
                      <PackagePlus className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <span>Produkt hinzufügen...</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {calcProducts.map((product) => {
                      const totalItemPrice = (product.calculator_product_items || []).reduce(
                        (sum: number, item: any) => sum + (item.price || 0),
                        0
                      );
                      const margin = product.margin_multiplier || 1;
                      const price = Math.round(totalItemPrice * margin * 100) / 100;
                      return (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} – {fmt(price)} €
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}

              {/* Import from saved quotes */}
              {savedQuotes.length > 0 && (
                <Select value={importFromQuote} onValueChange={handleImportQuote}>
                  <SelectTrigger className="border-dashed border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 rounded h-auto py-1.5 px-2 text-xs font-medium w-auto min-w-[180px] transition-colors">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span>Aus Kalkulation...</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {savedQuotes.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.title || "Ohne Titel"} – {fmt(q.total_price)} €
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* ─── Positions Table ─── */}
          <div className="mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-y border-foreground/80">
                  <th className="py-1.5 px-1 text-left font-semibold w-10">Pos</th>
                  <th className="py-1.5 px-1 text-left font-semibold">Bezeichnung</th>
                  <th className="py-1.5 px-1 text-right font-semibold w-20">Menge</th>
                  <th className="py-1.5 px-1 text-center font-semibold w-14">Einh.</th>
                  <th className="py-1.5 px-1 text-right font-semibold w-24">Einzelpr.</th>
                  <th className="py-1.5 px-1 text-right font-semibold w-24">Gesamt</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-border/40 group">
                    <td className="py-1 px-1 text-center text-muted-foreground text-xs">{item.position}</td>
                    <td className="py-1 px-1">
                      <input
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                        className="bg-transparent border-none outline-none w-full p-0 text-sm placeholder:text-muted-foreground/40 focus:ring-0"
                        placeholder="Beschreibung..."
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        className="bg-transparent border-none outline-none w-full p-0 text-sm text-right placeholder:text-muted-foreground/40 focus:ring-0"
                      />
                    </td>
                    <td className="py-1 px-0">
                      <select
                        value={item.unit}
                        onChange={(e) => updateLineItem(item.id, "unit", e.target.value)}
                        className="bg-transparent border-none outline-none text-xs text-center w-full p-0 focus:ring-0 cursor-pointer"
                      >
                        <option value="Stk">Stk</option>
                        <option value="Stunde">Std</option>
                        <option value="m">m</option>
                        <option value="m²">m²</option>
                        <option value="m³">m³</option>
                        <option value="kg">kg</option>
                        <option value="pauschal">psch</option>
                      </select>
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="bg-transparent border-none outline-none w-full p-0 text-sm text-right placeholder:text-muted-foreground/40 focus:ring-0"
                      />
                    </td>
                    <td className="py-1 px-1 text-right text-sm">
                      {fmt(item.quantity * item.unitPrice)} €
                    </td>
                    <td className="py-1 px-0">
                      <button
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length <= 1}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive disabled:hidden p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add Position Button (inline) */}
            <button
              onClick={addLineItem}
              className="mt-1 flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors py-1"
            >
              <Plus className="h-3 w-3" />
              Position hinzufügen
            </button>

            {/* Totals (right-aligned, inside the document) */}
            <div className="mt-4 flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zwischensumme</span>
                  <span>{fmt(totalNet)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">19% MwSt.</span>
                  <span>{fmt(totalTax)} €</span>
                </div>
                <div className="flex justify-between font-bold border-t border-foreground/60 pt-1 mt-1">
                  <span>Gesamtbetrag</span>
                  <span>{fmt(totalGross)} €</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Closing Text ─── */}
          <div className="mb-4">
            <AutoResizeTextarea
              value={closingText}
              onChange={(e) => setClosingText(e.target.value)}
              className="border-none shadow-none bg-transparent p-0 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
              placeholder="Ist unser Angebot für Sie interessant?..."
            />
          </div>

          {/* ─── Validity ─── */}
          <div className="mb-4 flex items-center gap-1 text-sm">
            <span className="text-muted-foreground text-xs">Gültig bis:</span>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="bg-transparent border-none outline-none p-0 text-sm focus:ring-0"
            />
          </div>

          {/* ─── Notes ─── */}
          <div className="mb-6">
            <AutoResizeTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border-none shadow-none bg-transparent p-0 text-xs text-muted-foreground placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
              placeholder="Bemerkungen / Konditionen..."
            />
          </div>

          {/* ─── Footer ─── */}
          <div className="mt-auto pt-8">
            <div className="border-t border-muted-foreground/30 pt-2">
              <p className="text-[9px] text-muted-foreground text-center">
                {[
                  company?.name,
                  company?.address,
                  company?.phone ? `Tel.: ${company.phone}` : null,
                  company?.email,
                  (company as any)?.tax_id ? `Steuer-Nr.: ${(company as any).tax_id}` : null,
                ].filter(Boolean).join("  |  ")}
              </p>
            </div>
          </div>
        </div>
      </main>

      <CompanySettingsDialog open={showCompanySettings} onOpenChange={setShowCompanySettings} />
    </div>
  );
};

export default OwnerQuoteConfigurator;
