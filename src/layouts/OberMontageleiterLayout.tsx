import { Outlet } from "react-router-dom";
import { BrowserTabsProvider } from "@/contexts/BrowserTabsContext";
import { BrowserTabBar } from "@/components/BrowserTabBar";
import { TabRenderer } from "@/components/TabRenderer";
import { useIsMobile } from "@/hooks/use-mobile";
import { oberMLRoutes } from "@/config/oberMLRoutes";

export default function OberMontageleiterLayout() {
  const isMobile = useIsMobile();

  return (
    <BrowserTabsProvider basePath="/ober-montageleiter">
      <div className="min-h-screen flex flex-col w-full overflow-x-hidden relative">
        <BrowserTabBar basePath="/ober-montageleiter" />

        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {isMobile ? <Outlet /> : <TabRenderer routes={oberMLRoutes} basePath="/ober-montageleiter" />}
        </div>
      </div>
    </BrowserTabsProvider>
  );
}
