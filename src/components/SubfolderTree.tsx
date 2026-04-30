import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Folder, Pencil, Trash2, Plus } from "lucide-react";

interface Material {
  id: string;
  name: string;
  category: string;
  subfolder_id: string | null;
  is_limited?: boolean;
}

interface Subfolder {
  id: string;
  name: string;
  parent_category: string;
  parent_subfolder_id: string | null;
}

interface MaterialAvailability {
  available: boolean;
  siteName?: string;
  startTime?: string;
  endTime?: string;
}

interface SubfolderTreeProps {
  subfolders: Subfolder[];
  materials: Material[];
  assignedMaterials: { material_id: string }[];
  parentCategory: string;
  parentSubfolderId: string | null;
  currentDepth: number;
  maxDepth: number;
  getMaterialAvailability: (materialId: string, isLimited: boolean) => MaterialAvailability;
  onEditSubfolder: (subfolder: { id: string; name: string }) => void;
  onDeleteSubfolder: (subfolderId: string) => void;
  onCreateSubfolder: (name: string, category: string, parentSubfolderId: string | null) => void;
  onEditMaterial: (material: { id: string; name: string; category: string }) => void;
  onDeleteMaterial: (materialId: string) => void;
  onCreateMaterial: (name: string, category: string, subfolderId: string | null, isLimited: boolean) => void;
  onAddMaterialToAssignment: (materialId: string) => void;
  extractNumber: (name: string) => number;
  sortMaterials: (mats: Material[], category: string) => Material[];
}

const SubfolderTree: React.FC<SubfolderTreeProps> = ({
  subfolders,
  materials,
  assignedMaterials,
  parentCategory,
  parentSubfolderId,
  currentDepth,
  maxDepth,
  getMaterialAvailability,
  onEditSubfolder,
  onDeleteSubfolder,
  onCreateSubfolder,
  onEditMaterial,
  onDeleteMaterial,
  onCreateMaterial,
  onAddMaterialToAssignment,
  extractNumber,
  sortMaterials,
}) => {
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [newMaterialName, setNewMaterialName] = useState("");
  const [activeInputSubfolderId, setActiveInputSubfolderId] = useState<string | null>(null);

  // Filter subfolders at this level (parent_subfolder_id matches our parent)
  const currentSubfolders = subfolders.filter(
    sf => sf.parent_category === parentCategory && 
          (parentSubfolderId === null 
            ? sf.parent_subfolder_id === null 
            : sf.parent_subfolder_id === parentSubfolderId)
  );

  // Sort subfolders: numerically for schrauben, alphabetically for others
  const sortedSubfolders = parentCategory === "schrauben"
    ? [...currentSubfolders].sort((a, b) => extractNumber(a.name) - extractNumber(b.name))
    : [...currentSubfolders].sort((a, b) => a.name.localeCompare(b.name, 'de'));

  // Get materials at this level
  const materialsAtThisLevel = materials.filter(
    m => m.category === parentCategory && 
         (parentSubfolderId === null 
           ? m.subfolder_id === null 
           : m.subfolder_id === parentSubfolderId)
  );
  const sortedMaterials = sortMaterials(materialsAtThisLevel, parentCategory);

  // Determine if materials are limited based on category
  const isLimitedCategory = parentCategory === "fahrzeuge" || parentCategory === "werkzeuge";

  const handleCreateSubfolder = () => {
    if (newSubfolderName.trim()) {
      onCreateSubfolder(newSubfolderName, parentCategory, parentSubfolderId);
      setNewSubfolderName("");
    }
  };

  const handleCreateMaterial = (subfolderId: string | null) => {
    if (newMaterialName.trim()) {
      onCreateMaterial(newMaterialName, parentCategory, subfolderId, isLimitedCategory);
      setNewMaterialName("");
      setActiveInputSubfolderId(null);
    }
  };

  const canAddMoreSubfolders = currentDepth < maxDepth;

  return (
    <div className="space-y-2">
      {/* Subfolders */}
      {sortedSubfolders.length > 0 && (
        <Accordion type="multiple" className="w-full space-y-2">
          {sortedSubfolders.map(subfolder => {
            // Get materials in this subfolder
            const subfolderMaterials = materials.filter(
              m => m.category === parentCategory && m.subfolder_id === subfolder.id
            );
            const sortedSubfolderMaterials = sortMaterials(subfolderMaterials, parentCategory);

            return (
              <AccordionItem 
                key={subfolder.id} 
                value={subfolder.id}
                className="border rounded-lg px-3"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Folder className="w-4 h-4" />
                      {subfolder.name}
                      <span className="text-xs text-muted-foreground ml-1">
                        (Ebene {currentDepth + 1})
                      </span>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <span 
                        className="p-1 rounded hover:bg-accent cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSubfolder({ id: subfolder.id, name: subfolder.name });
                        }}
                      >
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </span>
                      <span 
                        className="p-1 rounded hover:bg-accent cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSubfolder(subfolder.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pb-2">
                    {/* Materials in this subfolder */}
                    {sortedSubfolderMaterials.map(m => {
                      const availability = getMaterialAvailability(m.id, m.is_limited || false);
                      const isAssigned = assignedMaterials?.some(am => am.material_id === m.id);
                      return (
                        <div 
                          key={m.id} 
                          className={`flex flex-col py-2 px-3 rounded ${!availability.available ? 'bg-muted/50 opacity-60' : 'hover:bg-accent/50'}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm ${!availability.available ? 'text-muted-foreground' : ''}`}>
                              {m.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => onEditMaterial({ id: m.id, name: m.name, category: m.category })}
                              >
                                <Pencil className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => onDeleteMaterial(m.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => onAddMaterialToAssignment(m.id)}
                                disabled={!availability.available || isAssigned}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {!availability.available && (
                            <span className="text-xs text-muted-foreground mt-1">
                              {availability.startTime?.slice(0,5)}-{availability.endTime?.slice(0,5)} Uhr auf Baustelle {availability.siteName}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Add new material input */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Input 
                        placeholder="Neues Material..." 
                        value={activeInputSubfolderId === subfolder.id ? newMaterialName : ""}
                        onChange={(e) => {
                          setNewMaterialName(e.target.value);
                          setActiveInputSubfolderId(subfolder.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newMaterialName.trim()) {
                            handleCreateMaterial(subfolder.id);
                          }
                        }}
                      />
                      <Button 
                        size="sm"
                        onClick={() => handleCreateMaterial(subfolder.id)}
                        disabled={!newMaterialName.trim() || activeInputSubfolderId !== subfolder.id}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Recursive: Child subfolders */}
                    <SubfolderTree
                      subfolders={subfolders}
                      materials={materials}
                      assignedMaterials={assignedMaterials}
                      parentCategory={parentCategory}
                      parentSubfolderId={subfolder.id}
                      currentDepth={currentDepth + 1}
                      maxDepth={maxDepth}
                      getMaterialAvailability={getMaterialAvailability}
                      onEditSubfolder={onEditSubfolder}
                      onDeleteSubfolder={onDeleteSubfolder}
                      onCreateSubfolder={onCreateSubfolder}
                      onEditMaterial={onEditMaterial}
                      onDeleteMaterial={onDeleteMaterial}
                      onCreateMaterial={onCreateMaterial}
                      onAddMaterialToAssignment={onAddMaterialToAssignment}
                      extractNumber={extractNumber}
                      sortMaterials={sortMaterials}
                    />

                    {/* Add new subfolder (only if depth allows) */}
                    {canAddMoreSubfolders && (
                      <div className="flex gap-2 pt-2 border-t mt-2">
                        <Input 
                          placeholder="Neuer Unterordner..." 
                          value={activeInputSubfolderId === `subfolder-${subfolder.id}` ? newSubfolderName : ""}
                          onChange={(e) => {
                            setNewSubfolderName(e.target.value);
                            setActiveInputSubfolderId(`subfolder-${subfolder.id}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newSubfolderName.trim()) {
                              onCreateSubfolder(newSubfolderName, parentCategory, subfolder.id);
                              setNewSubfolderName("");
                              setActiveInputSubfolderId(null);
                            }
                          }}
                        />
                        <Button 
                          size="sm"
                          onClick={() => {
                            if (newSubfolderName.trim()) {
                              onCreateSubfolder(newSubfolderName, parentCategory, subfolder.id);
                              setNewSubfolderName("");
                              setActiveInputSubfolderId(null);
                            }
                          }}
                          disabled={!newSubfolderName.trim() || activeInputSubfolderId !== `subfolder-${subfolder.id}`}
                        >
                          <Folder className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {/* Max depth warning */}
                    {!canAddMoreSubfolders && currentDepth >= maxDepth - 1 && (
                      <p className="text-xs text-muted-foreground pt-2 italic">
                        Maximale Verschachtelungstiefe erreicht
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Materials without subfolder (only show at root level) */}
      {parentSubfolderId === null && sortedMaterials.length > 0 && (
        <div className="space-y-2 border rounded-lg p-3">
          <div className="font-medium text-sm text-muted-foreground">Ohne Unterordner</div>
          {sortedMaterials.map(m => {
            const availability = getMaterialAvailability(m.id, m.is_limited || false);
            const isAssigned = assignedMaterials?.some(am => am.material_id === m.id);
            return (
              <div 
                key={m.id} 
                className={`flex flex-col py-2 px-3 rounded ${!availability.available ? 'bg-muted/50 opacity-60' : 'hover:bg-accent/50'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${!availability.available ? 'text-muted-foreground' : ''}`}>
                    {m.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => onEditMaterial({ id: m.id, name: m.name, category: m.category })}
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => onDeleteMaterial(m.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => onAddMaterialToAssignment(m.id)}
                      disabled={!availability.available || isAssigned}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {!availability.available && (
                  <span className="text-xs text-muted-foreground mt-1">
                    {availability.startTime?.slice(0,5)}-{availability.endTime?.slice(0,5)} Uhr auf Baustelle {availability.siteName}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add new subfolder at root level */}
      {parentSubfolderId === null && canAddMoreSubfolders && (
        <div className="flex gap-2 pt-3 border-t">
          <Input 
            placeholder="Neuer Unterordner..." 
            value={activeInputSubfolderId === `root-${parentCategory}` ? newSubfolderName : ""}
            onChange={(e) => {
              setNewSubfolderName(e.target.value);
              setActiveInputSubfolderId(`root-${parentCategory}`);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newSubfolderName.trim()) {
                handleCreateSubfolder();
                setActiveInputSubfolderId(null);
              }
            }}
          />
          <Button 
            size="sm"
            onClick={() => {
              handleCreateSubfolder();
              setActiveInputSubfolderId(null);
            }}
            disabled={!newSubfolderName.trim() || activeInputSubfolderId !== `root-${parentCategory}`}
          >
            <Folder className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default SubfolderTree;
