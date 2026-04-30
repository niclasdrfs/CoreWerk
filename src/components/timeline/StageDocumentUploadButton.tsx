import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Camera, FileText, StickyNote, ChevronDown, FolderOpen } from "lucide-react";

interface StageDocumentUploadButtonProps {
  stageId: string;
  siteId: string;
  stageName: string;
  basePath?: string;
}

export const StageDocumentUploadButton = ({ 
  stageId, 
  siteId, 
  stageName,
  basePath = "/owner",
}: StageDocumentUploadButtonProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNavigateToDocumentation = (type?: string) => {
    const baseUrl = `${basePath}/site/${siteId}/stage/${stageId}/documentation`;
    const url = type ? `${baseUrl}?upload=${type}` : baseUrl;
    navigate(url);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FolderOpen className="w-4 h-4" />
          Dokumentation
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-popover z-50">
        <DropdownMenuItem 
          onClick={() => handleNavigateToDocumentation("photo")}
          className="gap-2 cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          Foto hochladen
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleNavigateToDocumentation("note")}
          className="gap-2 cursor-pointer"
        >
          <StickyNote className="w-4 h-4" />
          Notiz hinzufügen
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleNavigateToDocumentation("document")}
          className="gap-2 cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          Dokument hochladen
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleNavigateToDocumentation()}
          className="gap-2 cursor-pointer border-t mt-1 pt-2"
        >
          <FolderOpen className="w-4 h-4" />
          Alle Dokumente anzeigen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
