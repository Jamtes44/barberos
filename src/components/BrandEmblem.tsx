import React from 'react';

interface BrandEmblemProps {
  size?: 'sm' | 'md';
  className?: string;
}

/** Emblema/monograma de la marca, idéntico al que se muestra en el login. */
export const BrandEmblem: React.FC<BrandEmblemProps> = ({ size = 'md', className = '' }) => {
  const box = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 'text-lg' : 'text-xl';
  return (
    <div
      className={`relative flex items-center justify-center ${box} rounded-xl bg-white border border-slate-200 shadow-sm shrink-0 ${className}`}
      aria-hidden="true"
    >
      <span
        className={`material-symbols-outlined text-amber-600 ${iconSize}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        content_cut
      </span>
      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold shadow-xs">
        OS
      </span>
    </div>
  );
};