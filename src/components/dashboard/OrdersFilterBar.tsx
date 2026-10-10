import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type OrderTypeFilter = 'all' | 'delivery' | 'pickup' | 'dine_in' | 'quick_sale';
export type WaitFilter = 'all' | 'lt5' | '5to15' | 'gt15';

export interface OrdersFilterValue {
  search: string;
  type: OrderTypeFilter;
  tableId: string | 'all';
  wait: WaitFilter;
}

interface Props {
  value: OrdersFilterValue;
  onChange: (next: OrdersFilterValue) => void;
  tables: { id: string; number: number; label: string | null }[];
  resultCount: number;
  totalCount: number;
}

const typeOptions: { value: OrderTypeFilter; label: string }[] = [
  { value: 'all', label: 'Todas modalidades' },
  { value: 'delivery', label: '🛵 Entrega' },
  { value: 'pickup', label: '🏪 Retirada' },
  { value: 'dine_in', label: '🍽️ Mesa' },
  { value: 'quick_sale', label: '⚡ Balada' },
];

const waitOptions: { value: WaitFilter; label: string }[] = [
  { value: 'all', label: 'Qualquer tempo' },
  { value: 'lt5', label: '< 5 min' },
  { value: '5to15', label: '5–15 min' },
  { value: 'gt15', label: '> 15 min (atrasado)' },
];

export default function OrdersFilterBar({ value, onChange, tables, resultCount, totalCount }: Props) {
  const activeFilterCount =
    (value.type !== 'all' ? 1 : 0) +
    (value.tableId !== 'all' ? 1 : 0) +
    (value.wait !== 'all' ? 1 : 0);

  const clearAll = () =>
    onChange({ search: '', type: 'all', tableId: 'all', wait: 'all' });

  return (
    <div className="card-elevated p-3 space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Buscar por #nº, cliente ou telefone..."
            className="pl-9 pr-9"
          />
          {value.search && (
            <button
              type="button"
              onClick={() => onChange({ ...value, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filters popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 shrink-0">
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-bold tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-3" align="end">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Modalidade
              </label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={value.type}
                onChange={(e) => onChange({ ...value, type: e.target.value as OrderTypeFilter })}
              >
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Mesa
              </label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={value.tableId}
                onChange={(e) => onChange({ ...value, tableId: e.target.value })}
                disabled={tables.length === 0}
              >
                <option value="all">Todas as mesas</option>
                {tables
                  .slice()
                  .sort((a, b) => a.number - b.number)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label || `Mesa ${t.number}`}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Tempo de espera
              </label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={value.wait}
                onChange={(e) => onChange({ ...value, wait: e.target.value as WaitFilter })}
              >
                {waitOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <Button variant="ghost" size="sm" className="w-full" onClick={clearAll} disabled={activeFilterCount === 0 && !value.search}>
              Limpar tudo
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active chips + result count */}
      {(activeFilterCount > 0 || value.search) && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-muted-foreground font-medium">
            {resultCount} de {totalCount} pedido{totalCount === 1 ? '' : 's'}
          </span>
          {value.search && (
            <Chip onClear={() => onChange({ ...value, search: '' })}>
              Busca: <strong>"{value.search}"</strong>
            </Chip>
          )}
          {value.type !== 'all' && (
            <Chip onClear={() => onChange({ ...value, type: 'all' })}>
              {typeOptions.find((o) => o.value === value.type)?.label}
            </Chip>
          )}
          {value.tableId !== 'all' && (
            <Chip onClear={() => onChange({ ...value, tableId: 'all' })}>
              {(() => {
                const t = tables.find((x) => x.id === value.tableId);
                return t ? t.label || `Mesa ${t.number}` : 'Mesa';
              })()}
            </Chip>
          )}
          {value.wait !== 'all' && (
            <Chip onClear={() => onChange({ ...value, wait: 'all' })}>
              {waitOptions.find((o) => o.value === value.wait)?.label}
            </Chip>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
      {children}
      <button type="button" onClick={onClear} className="hover:bg-primary/20 rounded-full p-0.5" aria-label="Remover filtro">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
