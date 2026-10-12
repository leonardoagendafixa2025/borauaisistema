import React from 'react';
import { Loader2 } from 'lucide-react';
import logoImg from '@/assets/logo.png';

export const PageLoader: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <img src={logoImg} alt="Bora Uai" className="h-12 w-auto animate-pulse select-none" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Carregando...</span>
        </div>
      </div>
    </div>
  );
};

export default PageLoader;
