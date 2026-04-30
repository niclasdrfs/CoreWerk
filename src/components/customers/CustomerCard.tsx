import { useState } from "react";
import { Phone, Mail, MapPin, Building2, Pencil, Trash2, User, History } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerHistoryDialog } from "./CustomerHistoryDialog";

export interface Customer {
  id: string;
  name: string;
  company_name: string | null;
  address: string | null;
  address_line_2: string | null;
  phone: string | null;
  email: string | null;
  customer_type: "new" | "existing" | "premium";
  created_at: string;
  avatar_url?: string | null;
  customer_number?: string | null;
}

interface CustomerCardProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
}

const customerTypeBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  new: { label: "Neukunde", variant: "outline" },
  existing: { label: "Bestandskunde", variant: "secondary" },
  premium: { label: "Premium", variant: "default" },
};

export const CustomerCard = ({ customer, onEdit, onDelete }: CustomerCardProps) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const badgeConfig = customerTypeBadge[customer.customer_type] || customerTypeBadge.new;

  return (
    <>
      <Card className="group hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                {customer.avatar_url ? (
                  <img
                    src={customer.avatar_url}
                    alt={customer.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-accent" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{customer.name}</h3>
                {customer.company_name && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{customer.company_name}</span>
                  </div>
                )}
              </div>
            </div>
            <Badge variant={badgeConfig.variant} className="shrink-0">
              {badgeConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Contact Info */}
          <div className="space-y-1.5 text-sm">
            {(customer.address || customer.address_line_2) && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  {customer.address && <div>{customer.address}</div>}
                  {customer.address_line_2 && <div>{customer.address_line_2}</div>}
                </div>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4 shrink-0" />
                <a href={`tel:${customer.phone}`} className="hover:text-foreground transition-colors">
                  {customer.phone}
                </a>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4 shrink-0" />
                <a href={`mailto:${customer.email}`} className="hover:text-foreground transition-colors truncate">
                  {customer.email}
                </a>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="w-4 h-4" />
              Historie
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => onEdit(customer)}
            >
              <Pencil className="w-4 h-4" />
              Bearbeiten
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
              onClick={() => onDelete(customer.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <CustomerHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        customerId={customer.id}
        customerName={customer.company_name || customer.name}
      />
    </>
  );
};
