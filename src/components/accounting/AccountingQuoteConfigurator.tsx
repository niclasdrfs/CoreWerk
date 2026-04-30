import { SidebarProvider } from "@/components/ui/sidebar";
import OwnerQuoteConfigurator from "@/pages/OwnerQuoteConfigurator";

interface AccountingQuoteConfiguratorProps {
  onBack: () => void;
}

const AccountingQuoteConfigurator = ({ onBack }: AccountingQuoteConfiguratorProps) => {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="accounting-quote-configurator w-full">
        <style>{`
          .accounting-quote-configurator [data-sidebar="trigger"] {
            display: none !important;
          }
          .accounting-quote-configurator > div > header {
            display: none !important;
          }
        `}</style>
        <OwnerQuoteConfigurator />
      </div>
    </SidebarProvider>
  );
};

export default AccountingQuoteConfigurator;
