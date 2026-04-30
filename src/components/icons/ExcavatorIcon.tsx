import React from "react";

interface ExcavatorIconProps {
  className?: string;
  size?: number;
}

export const ExcavatorIcon: React.FC<ExcavatorIconProps> = ({ 
  className = "", 
  size = 24 
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Ketten/Fahrwerk */}
      <path d="M1 20 L1 18 Q1 17 2 17 L11 17 Q12 17 12 18 L12 20 Q12 21 11 21 L2 21 Q1 21 1 20 Z" />
      <line x1="3" y1="19" x2="10" y2="19" />
      
      {/* Kabine */}
      <path d="M3 17 L3 13 Q3 12 4 12 L9 12 Q10 12 10 13 L10 17" />
      <line x1="5" y1="14" x2="8" y2="14" />
      
      {/* Ausleger (Hauptarm) */}
      <path d="M10 13 L15 7" strokeWidth="2.5" />
      
      {/* Stiel (zweiter Arm) */}
      <path d="M15 7 L20 10" strokeWidth="2.5" />
      
      {/* Schaufel/Löffel - Halbmond-Form */}
      <path d="M19 9 Q23 9 23 13 Q23 15 20 15 L18 12" strokeWidth="2.5" fill="none" />
      
      {/* Gelenke */}
      <circle cx="15" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="13" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
};

export default ExcavatorIcon;
