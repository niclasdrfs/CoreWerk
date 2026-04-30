import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerAvatarUploadProps {
  customerId?: string;
  currentAvatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const sizeClasses = {
  sm: "w-10 h-10",
  md: "w-16 h-16",
  lg: "w-24 h-24",
};

const iconSizes = {
  sm: "w-5 h-5",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

export const CustomerAvatarUpload = ({
  customerId,
  currentAvatarUrl,
  onAvatarChange,
  size = "md",
  disabled = false,
}: CustomerAvatarUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte wählen Sie eine Bilddatei aus");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Das Bild darf maximal 5MB groß sein");
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${customerId || "temp"}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("customer-avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("customer-avatars")
        .getPublicUrl(filePath);

      onAvatarChange(urlData.publicUrl);
      toast.success("Profilbild hochgeladen");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Fehler beim Hochladen des Profilbildes");
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isUploading}
        className={cn(
          "relative rounded-full overflow-hidden border-2 border-dashed border-border hover:border-primary/50 transition-colors group",
          sizeClasses[size],
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer"
        )}
      >
        {currentAvatarUrl ? (
          <img
            src={currentAvatarUrl}
            alt="Kundenbild"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-accent/10 flex items-center justify-center">
            <User className={cn("text-accent/50", iconSizes[size])} />
          </div>
        )}

        {/* Overlay */}
        {!disabled && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {isUploading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </div>
        )}
      </button>
    </div>
  );
};
