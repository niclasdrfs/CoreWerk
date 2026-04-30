import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Folder, 
  Pencil, 
  Trash2, 
  Plus, 
  Minus,
  Home, 
  ChevronRight, 
  ArrowLeft,
  Truck,
  Wrench,
  Hammer,
  Cog,
  Package,
  Zap,
  Box,
  Layers,
  Settings,
  LucideIcon
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

interface NavigationStep {
  type: 'category' | 'subfolder';
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  is_limited: boolean;
  sort_numeric: boolean;
  requires_quantity: boolean;
  display_order: number;
}

interface MaterialFocusNavigationProps {
  categories: Category[];
  subfolders: Subfolder[];
  materials: Material[];
  assignedMaterials: { material_id: string }[];
  maxDepth: number;
  getMaterialAvailability: (materialId: string, isLimited: boolean) => MaterialAvailability;
  onEditSubfolder: (subfolder: { id: string; name: string }) => void;
  onDeleteSubfolder: (subfolderId: string) => void;
  onCreateSubfolder: (name: string, category: string, parentSubfolderId: string | null) => void;
  onEditMaterial: (material: { id: string; name: string; category: string }) => void;
  onDeleteMaterial: (materialId: string) => void;
  onCreateMaterial: (name: string, category: string, subfolderId: string | null, isLimited: boolean) => void;
  onAddMaterialToAssignment: (materialId: string, quantity: number) => void;
  onCreateCategory: (name: string, icon: string, isLimited: boolean, sortNumeric: boolean, requiresQuantity: boolean) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
  extractNumber: (name: string) => number;
  sortMaterials: (mats: Material[], category: string, sortNumeric: boolean) => Material[];
}

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'truck', icon: Truck },
  { name: 'wrench', icon: Wrench },
  { name: 'hammer', icon: Hammer },
  { name: 'cog', icon: Cog },
  { name: 'package', icon: Package },
  { name: 'zap', icon: Zap },
  { name: 'box', icon: Box },
  { name: 'layers', icon: Layers },
  { name: 'settings', icon: Settings },
];

const getIconComponent = (iconName: string): LucideIcon => {
  const found = ICON_OPTIONS.find(opt => opt.name === iconName);
  return found?.icon || Package;
};

const MaterialFocusNavigation: React.FC<MaterialFocusNavigationProps> = ({
  categories,
  subfolders,
  materials,
  assignedMaterials,
  maxDepth,
  getMaterialAvailability,
  onEditSubfolder,
  onDeleteSubfolder,
  onCreateSubfolder,
  onEditMaterial,
  onDeleteMaterial,
  onCreateMaterial,
  onAddMaterialToAssignment,
  onCreateCategory,
  onEditCategory,
  onDeleteCategory,
  extractNumber,
  sortMaterials,
}) => {
  const [navigationPath, setNavigationPath] = useState<NavigationStep[]>([]);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [newMaterialName, setNewMaterialName] = useState("");
  
  // New category dialog state
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("package");
  const [newCategoryIsLimited, setNewCategoryIsLimited] = useState(false);
  const [newCategorySortNumeric, setNewCategorySortNumeric] = useState(false);
  const [newCategoryRequiresQuantity, setNewCategoryRequiresQuantity] = useState(false);
  
  // Edit category dialog state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryIcon, setEditCategoryIcon] = useState("");
  const [editCategoryIsLimited, setEditCategoryIsLimited] = useState(false);
  const [editCategorySortNumeric, setEditCategorySortNumeric] = useState(false);
  const [editCategoryRequiresQuantity, setEditCategoryRequiresQuantity] = useState(false);
  
  // Quantity selection dialog state
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [selectedMaterialForQuantity, setSelectedMaterialForQuantity] = useState<{ id: string; name: string } | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Current navigation state
  const currentCategoryName = navigationPath.find(p => p.type === 'category')?.name || null;
  const currentSubfolderId = navigationPath.filter(p => p.type === 'subfolder').pop()?.id || null;
  const currentDepth = navigationPath.filter(p => p.type === 'subfolder').length;

  // Find current category object
  const currentCategory = categories.find(c => c.name.toLowerCase() === currentCategoryName?.toLowerCase());

  // Determine if materials are limited based on category
  const isLimitedCategory = currentCategory?.is_limited || false;
  const sortNumeric = currentCategory?.sort_numeric || false;

  // Get subfolders at current level
  const currentSubfolders = currentCategoryName
    ? subfolders.filter(
        sf => sf.parent_category.toLowerCase() === currentCategoryName.toLowerCase() && 
              (currentSubfolderId === null 
                ? sf.parent_subfolder_id === null 
                : sf.parent_subfolder_id === currentSubfolderId)
      )
    : [];

  // Sort subfolders
  const sortedSubfolders = sortNumeric
    ? [...currentSubfolders].sort((a, b) => extractNumber(a.name) - extractNumber(b.name))
    : [...currentSubfolders].sort((a, b) => a.name.localeCompare(b.name, 'de'));

  // Get materials at current level
  const currentMaterials = currentCategoryName
    ? materials.filter(
        m => m.category.toLowerCase() === currentCategoryName.toLowerCase() && 
             (currentSubfolderId === null 
               ? m.subfolder_id === null 
               : m.subfolder_id === currentSubfolderId)
      )
    : [];

  const sortedMaterials = sortMaterials(currentMaterials, currentCategoryName || "", sortNumeric);

  const canAddMoreSubfolders = currentDepth < maxDepth;

  const handleNavigateToCategory = (categoryName: string) => {
    setNavigationPath([{ type: 'category', id: categoryName.toLowerCase(), name: categoryName }]);
    setNewSubfolderName("");
    setNewMaterialName("");
  };

  const handleNavigateToSubfolder = (subfolderId: string, subfolderName: string) => {
    setNavigationPath([
      ...navigationPath,
      { type: 'subfolder', id: subfolderId, name: subfolderName }
    ]);
    setNewSubfolderName("");
    setNewMaterialName("");
  };

  const handleNavigateBack = () => {
    setNavigationPath(navigationPath.slice(0, -1));
    setNewSubfolderName("");
    setNewMaterialName("");
  };

  const handleNavigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setNavigationPath([]);
    } else {
      setNavigationPath(navigationPath.slice(0, index + 1));
    }
    setNewSubfolderName("");
    setNewMaterialName("");
  };

  const handleCreateSubfolder = () => {
    if (newSubfolderName.trim() && currentCategoryName) {
      onCreateSubfolder(newSubfolderName, currentCategoryName.toLowerCase(), currentSubfolderId);
      setNewSubfolderName("");
    }
  };

  const handleCreateMaterial = () => {
    if (newMaterialName.trim() && currentCategoryName) {
      onCreateMaterial(newMaterialName, currentCategoryName.toLowerCase(), currentSubfolderId, isLimitedCategory);
      setNewMaterialName("");
    }
  };

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      onCreateCategory(newCategoryName, newCategoryIcon, newCategoryIsLimited, newCategorySortNumeric, newCategoryRequiresQuantity);
      setShowNewCategoryDialog(false);
      setNewCategoryName("");
      setNewCategoryIcon("package");
      setNewCategoryIsLimited(false);
      setNewCategorySortNumeric(false);
      setNewCategoryRequiresQuantity(false);
    }
  };

  const handleOpenEditCategory = (category: Category) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditCategoryIcon(category.icon);
    setEditCategoryIsLimited(category.is_limited);
    setEditCategorySortNumeric(category.sort_numeric);
    setEditCategoryRequiresQuantity(category.requires_quantity);
  };

  const handleSaveEditCategory = () => {
    if (editingCategory && editCategoryName.trim()) {
      onEditCategory({
        ...editingCategory,
        name: editCategoryName,
        icon: editCategoryIcon,
        is_limited: editCategoryIsLimited,
        sort_numeric: editCategorySortNumeric,
        requires_quantity: editCategoryRequiresQuantity,
      });
      setEditingCategory(null);
    }
  };

  const handleAddMaterial = (material: { id: string; name: string }) => {
    const categoryRequiresQuantity = currentCategory?.requires_quantity || false;
    
    if (categoryRequiresQuantity) {
      setSelectedMaterialForQuantity(material);
      setQuantity(1);
      setShowQuantityDialog(true);
    } else {
      onAddMaterialToAssignment(material.id, 1);
    }
  };

  const handleConfirmQuantity = () => {
    if (selectedMaterialForQuantity) {
      onAddMaterialToAssignment(selectedMaterialForQuantity.id, quantity);
      setShowQuantityDialog(false);
      setSelectedMaterialForQuantity(null);
      setQuantity(1);
    }
  };

  // Sort categories by display_order
  const sortedCategories = [...categories].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      {navigationPath.length > 0 && (
        <div className="space-y-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink 
                  onClick={() => handleNavigateToBreadcrumb(-1)}
                  className="cursor-pointer flex items-center gap-1 hover:text-foreground"
                >
                  <Home className="w-4 h-4" />
                  Materialien
                </BreadcrumbLink>
              </BreadcrumbItem>
              {navigationPath.map((step, index) => (
                <React.Fragment key={step.id}>
                  <BreadcrumbSeparator>
                    <ChevronRight className="w-4 h-4" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    {index === navigationPath.length - 1 ? (
                      <BreadcrumbPage className="font-medium">
                        {step.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink 
                        onClick={() => handleNavigateToBreadcrumb(index)}
                        className="cursor-pointer hover:text-foreground"
                      >
                        {step.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNavigateBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>
        </div>
      )}

      {/* Category Selection (when no category selected) */}
      {!currentCategoryName && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {sortedCategories.map(cat => {
              const IconComponent = getIconComponent(cat.icon);
              return (
                <div key={cat.id} className="relative group">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground"
                    onClick={() => handleNavigateToCategory(cat.name)}
                  >
                    <IconComponent className="w-6 h-6" />
                    <span className="font-medium">{cat.name}</span>
                  </Button>
                  {/* Edit/Delete buttons on hover */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditCategory(cat);
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCategory(cat.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Add new category button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setShowNewCategoryDialog(true)}
          >
            <Plus className="w-4 h-4" />
            Neue Kategorie erstellen
          </Button>
        </div>
      )}

      {/* Current Level Content (when category is selected) */}
      {currentCategoryName && (
        <div className="space-y-3">
          {/* Subfolders */}
          {sortedSubfolders.map(subfolder => (
            <div
              key={subfolder.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div 
                className="flex items-center gap-2 flex-1 cursor-pointer"
                onClick={() => handleNavigateToSubfolder(subfolder.id, subfolder.name)}
              >
                <Folder className="w-5 h-5 text-primary" />
                <span className="font-medium">{subfolder.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditSubfolder({ id: subfolder.id, name: subfolder.name });
                  }}
                >
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSubfolder(subfolder.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
                <ChevronRight 
                  className="w-5 h-5 text-muted-foreground cursor-pointer" 
                  onClick={() => handleNavigateToSubfolder(subfolder.id, subfolder.name)}
                />
              </div>
            </div>
          ))}

          {/* Materials */}
          {sortedMaterials.map(material => {
            const availability = getMaterialAvailability(material.id, material.is_limited || false);
            const isAssigned = assignedMaterials?.some(am => am.material_id === material.id);
            
            return (
              <div
                key={material.id}
                className={`p-3 border rounded-lg ${!availability.available ? 'bg-muted/50 opacity-60' : ''}`}
              >
                {/* Material Name */}
                <div className={`font-medium mb-2 ${!availability.available ? 'text-muted-foreground' : ''}`}>
                  {material.name}
                </div>
                
                {/* Buttons Row - Centered Add Button */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEditMaterial({ id: material.id, name: material.name, category: material.category })}
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleAddMaterial({ id: material.id, name: material.name })}
                    disabled={!availability.available || isAssigned}
                    className="px-4"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Hinzufügen
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteMaterial(material.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                
                {!availability.available && (
                  <span className="text-xs text-muted-foreground mt-2 block">
                    {availability.startTime?.slice(0,5)}-{availability.endTime?.slice(0,5)} Uhr auf Baustelle {availability.siteName}
                  </span>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {sortedSubfolders.length === 0 && sortedMaterials.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Noch keine Einträge vorhanden</p>
            </div>
          )}

          {/* Divider */}
          <div className="border-t pt-4 mt-4 space-y-3">
            {/* Add new subfolder (if depth allows) */}
            {canAddMoreSubfolders && (
              <div className="flex gap-2">
                <Input
                  placeholder="Neuer Unterordner..."
                  value={newSubfolderName}
                  onChange={(e) => setNewSubfolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSubfolder();
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleCreateSubfolder}
                  disabled={!newSubfolderName.trim()}
                >
                  <Folder className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Max depth warning */}
            {!canAddMoreSubfolders && (
              <p className="text-xs text-muted-foreground italic">
                Maximale Verschachtelungstiefe erreicht
              </p>
            )}

            {/* Add new material */}
            <div className="flex gap-2">
              <Input
                placeholder="Neues Material..."
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateMaterial();
                }}
              />
              <Button
                size="sm"
                onClick={handleCreateMaterial}
                disabled={!newMaterialName.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Category Dialog */}
      <Dialog open={showNewCategoryDialog} onOpenChange={setShowNewCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Materialkategorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="z.B. Elektrik, Dichtungen..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Icon auswählen</label>
              <div className="grid grid-cols-5 gap-2">
                {ICON_OPTIONS.map(opt => {
                  const IconComp = opt.icon;
                  return (
                    <Button
                      key={opt.name}
                      type="button"
                      variant={newCategoryIcon === opt.name ? 'default' : 'outline'}
                      className="h-10 w-10 p-0"
                      onClick={() => setNewCategoryIcon(opt.name)}
                    >
                      <IconComp className="w-5 h-5" />
                    </Button>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox 
                  checked={newCategoryIsLimited} 
                  onCheckedChange={(checked) => setNewCategoryIsLimited(checked === true)} 
                />
                <div>
                  <span className="text-sm font-medium">Materialien sind limitiert</span>
                  <p className="text-xs text-muted-foreground">Kann nur einer Baustelle gleichzeitig zugewiesen werden (wie Fahrzeuge)</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox 
                  checked={newCategorySortNumeric} 
                  onCheckedChange={(checked) => setNewCategorySortNumeric(checked === true)} 
                />
                <div>
                  <span className="text-sm font-medium">Numerisch sortieren</span>
                  <p className="text-xs text-muted-foreground">Sortiert nach Zahlen im Namen (wie Schrauben: M6, M8, M10)</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox 
                  checked={newCategoryRequiresQuantity} 
                  onCheckedChange={(checked) => setNewCategoryRequiresQuantity(checked === true)} 
                />
                <div>
                  <span className="text-sm font-medium">Mengenangabe erforderlich</span>
                  <p className="text-xs text-muted-foreground">Beim Hinzufügen wird nach der gewünschten Menge gefragt (z.B. für Schrauben)</p>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategoryDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategorie bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Icon auswählen</label>
              <div className="grid grid-cols-5 gap-2">
                {ICON_OPTIONS.map(opt => {
                  const IconComp = opt.icon;
                  return (
                    <Button
                      key={opt.name}
                      type="button"
                      variant={editCategoryIcon === opt.name ? 'default' : 'outline'}
                      className="h-10 w-10 p-0"
                      onClick={() => setEditCategoryIcon(opt.name)}
                    >
                      <IconComp className="w-5 h-5" />
                    </Button>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox 
                  checked={editCategoryIsLimited} 
                  onCheckedChange={(checked) => setEditCategoryIsLimited(checked === true)} 
                />
                <div>
                  <span className="text-sm font-medium">Materialien sind limitiert</span>
                  <p className="text-xs text-muted-foreground">Kann nur einer Baustelle gleichzeitig zugewiesen werden</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox 
                  checked={editCategorySortNumeric} 
                  onCheckedChange={(checked) => setEditCategorySortNumeric(checked === true)} 
                />
                <div>
                  <span className="text-sm font-medium">Numerisch sortieren</span>
                  <p className="text-xs text-muted-foreground">Sortiert nach Zahlen im Namen</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox 
                  checked={editCategoryRequiresQuantity} 
                  onCheckedChange={(checked) => setEditCategoryRequiresQuantity(checked === true)} 
                />
                <div>
                  <span className="text-sm font-medium">Mengenangabe erforderlich</span>
                  <p className="text-xs text-muted-foreground">Beim Hinzufügen wird nach der gewünschten Menge gefragt</p>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveEditCategory} disabled={!editCategoryName.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quantity Selection Dialog */}
      <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Menge auswählen</DialogTitle>
            <p className="text-sm text-muted-foreground">{selectedMaterialForQuantity?.name}</p>
          </DialogHeader>
          
          <div className="flex items-center justify-center gap-4 py-6">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="w-6 h-6" />
            </Button>
            
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 text-center text-2xl font-bold h-14"
            />
            
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => setQuantity(quantity + 1)}
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuantityDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleConfirmQuantity}>
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaterialFocusNavigation;