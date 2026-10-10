import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { findNavByPath } from './adminNav';

export default function AdminBreadcrumbs() {
  const { pathname } = useLocation();
  const match = findNavByPath(pathname);

  // No crumb on the home itself
  if (!match || match.path === '/restaurant') return null;

  return (
    <nav className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground" aria-label="Breadcrumb">
      <Link to="/restaurant" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="h-3 w-3" />
        Início
      </Link>
      <ChevronRight className="h-3 w-3 opacity-50" />
      <span className="text-muted-foreground/80">{(match as any).groupLabel}</span>
      <ChevronRight className="h-3 w-3 opacity-50" />
      <span className="font-semibold text-foreground">{match.label}</span>
    </nav>
  );
}
