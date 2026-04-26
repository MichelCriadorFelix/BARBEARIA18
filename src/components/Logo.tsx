import React from "react";

interface LogoProps {
  className?: string;
  iconClassName?: string;
}

export function Logo({ className = "w-10 h-10", iconClassName = "w-6 h-6" }: LogoProps) {
  return (
    <div className={`${className} rounded-lg overflow-hidden flex items-center justify-center bg-black/20 border border-white/10`}>
      <img
        src="/icon.svg"
        alt="Barbearia 18 Logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
