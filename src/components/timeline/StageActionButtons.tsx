import { Button } from "@/components/ui/button";
import { Users, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StageActionButtonsProps {
  stageId: string;
  siteId: string;
  stageName: string;
  basePath?: string;
}

export const StageActionButtons = ({ stageId, siteId, stageName, basePath = "/owner" }: StageActionButtonsProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => navigate(`${basePath}/site/${siteId}/stage/${stageId}/employees`)}
      >
        <Users className="w-4 h-4" />
        Mitarbeiter
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => navigate(`${basePath}/site/${siteId}/stage/${stageId}/documentation`)}
      >
        <FolderOpen className="w-4 h-4" />
        Fotos/Notizen/Dokumente
      </Button>
    </div>
  );
};
