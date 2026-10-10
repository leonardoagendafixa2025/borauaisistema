import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import { useRestaurant } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { useScale } from '@/hooks/useScale';
import { Scale, Plug, PlugZap, Loader2, AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ScalePage() {
  const { data: restaurant } = useRestaurant();
  const qc = useQueryClient();
  const { isSupported, connected, weight, error, connect, disconnect } = useScale();
  const [baud, setBaud] = useState(9600);

  const { data: products = [] } = useQuery({
    queryKey: ['products-by-weight', restaurant?.id],
    queryFn: async () => {
      if (!restaurant?.id) return [];
      const { data, error } = await supabase
        .from('products').select('id,name,price,sold_by_weight,unit_label,price_per_kg')
        .eq('restaurant_id', restaurant.id).eq('active', true).order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!restaurant?.id,
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; sold_by_weight: boolean; unit_label: string; price_per_kg: number | null }) => {
      const { error } = await (supabase.from('products') as any)
        .update({ sold_by_weight: p.sold_by_weight, unit_label: p.unit_label, price_per_kg: p.price_per_kg })
        .eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Produto atualizado');
      qc.invalidateQueries({ queryKey: ['products-by-weight'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <RestaurantLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" /> Balança eletrônica
          </h1>
          <p className="text-sm text-muted-foreground">
            Conecte uma balança via USB e cadastre produtos vendidos por peso (R$/kg)
          </p>
        </div>

        {/* Conexão */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-3">Conexão</h2>
          {!isSupported && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 text-warning p-3 text-sm mb-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Seu navegador não suporta a Web Serial API. Use Chrome, Edge ou Opera em conexão segura (HTTPS).</span>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Baud rate</label>
              <select
                value={baud} onChange={(e) => setBaud(Number(e.target.value))}
                disabled={connected}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {[1200, 2400, 4800, 9600, 19200, 38400].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            {!connected ? (
              <button
                onClick={() => connect(baud)}
                disabled={!isSupported}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plug className="h-4 w-4" /> Conectar balança
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 text-destructive px-4 py-2 text-sm font-semibold hover:bg-destructive/10"
              >
                <PlugZap className="h-4 w-4" /> Desconectar
              </button>
            )}
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Leitura atual</p>
              <p className="text-3xl font-bold tabular-nums">
                {weight !== null ? `${weight.toFixed(3)} kg` : '— kg'}
              </p>
            </div>
          </div>
          {error && <p className="text-xs text-destructive mt-3">{error}</p>}
          <p className="text-xs text-muted-foreground mt-4">
            Compatível com Toledo, Filizola, Urano e similares (protocolo ASCII com terminador CR/LF).
            A balança aparecerá no diálogo de seleção de porta serial do navegador.
          </p>
        </div>

        {/* Produtos */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold">Produtos vendidos por peso</h2>
            <p className="text-xs text-muted-foreground">
              Marque os produtos vendidos a peso e defina o preço por quilo
            </p>
          </div>
          <div className="divide-y divide-border">
            {products.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground text-center">
                Nenhum produto cadastrado. Adicione produtos no Cardápio primeiro.
              </p>
            )}
            {products.map((p: any) => (
              <ProductRow key={p.id} product={p} onSave={(v) => update.mutate({ id: p.id, ...v })} saving={update.isPending} />
            ))}
          </div>
        </div>
      </div>
    </RestaurantLayout>
  );
}

function ProductRow({ product, onSave, saving }: any) {
  const [byWeight, setByWeight] = useState<boolean>(!!product.sold_by_weight);
  const [unit, setUnit] = useState<string>(product.unit_label || 'un');
  const [pricePerKg, setPricePerKg] = useState<string>(product.price_per_kg?.toString() ?? '');

  const dirty =
    byWeight !== !!product.sold_by_weight ||
    unit !== (product.unit_label || 'un') ||
    pricePerKg !== (product.price_per_kg?.toString() ?? '');

  return (
    <div className="px-6 py-4 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[180px]">
        <p className="font-medium text-sm">{product.name}</p>
        <p className="text-xs text-muted-foreground">Preço: R$ {Number(product.price).toFixed(2)}</p>
      </div>
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox" checked={byWeight}
          onChange={(e) => { setByWeight(e.target.checked); if (e.target.checked) setUnit('kg'); }}
          className="h-4 w-4"
        />
        Por peso
      </label>
      <input
        type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
        placeholder="un / kg / g"
        className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
      />
      <input
        type="number" step="0.01" value={pricePerKg}
        onChange={(e) => setPricePerKg(e.target.value)}
        placeholder="R$/kg" disabled={!byWeight}
        className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
      />
      <button
        onClick={() => onSave({
          sold_by_weight: byWeight, unit_label: unit,
          price_per_kg: byWeight && pricePerKg ? Number(pricePerKg) : null,
        })}
        disabled={!dirty || saving}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Salvar
      </button>
    </div>
  );
}
