import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Users, Divide, ListChecks, Copy } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

interface OrderItem {
  id: string;
  name: string;
  qty: number;
  total_price: number;
}

interface SplitBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    number: number;
    total: number;
    order_items: OrderItem[];
  } | null;
}

export default function SplitBillDialog({ open, onOpenChange, order }: SplitBillDialogProps) {
  const [mode, setMode] = useState<'equal' | 'items'>('equal');
  const [numPeople, setNumPeople] = useState(2);
  const [numGroups, setNumGroups] = useState(2);
  const [assignments, setAssignments] = useState<Record<number, Set<string>>>({});

  const total = order ? Number(order.total) : 0;
  const items = order?.order_items || [];
  const perPerson = total / Math.max(numPeople, 1);

  // Items split helpers
  const toggleItem = (groupIdx: number, itemId: string) => {
    setAssignments(prev => {
      const next = { ...prev };
      const set = new Set(next[groupIdx] || []);
      if (set.has(itemId)) set.delete(itemId); else set.add(itemId);
      next[groupIdx] = set;
      return next;
    });
  };

  const groupTotals = useMemo(() => {
    const totals: number[] = [];
    for (let i = 0; i < numGroups; i++) {
      const ids = assignments[i] || new Set();
      const sum = items.filter(it => ids.has(it.id)).reduce((s, it) => s + Number(it.total_price), 0);
      totals.push(sum);
    }
    return totals;
  }, [assignments, numGroups, items]);

  const assignedTotal = groupTotals.reduce((a, b) => a + b, 0);
  const remainder = total - assignedTotal;

  if (!order) return null;

  const copySummary = () => {
    let text = `📋 Conta #${order.number}\n`;
    if (mode === 'equal') {
      text += `Dividida igualmente por ${numPeople} pessoas\n`;
      text += `Total: ${fmt(total)}\n`;
      text += `Cada um paga: ${fmt(perPerson)}\n`;
    } else {
      for (let i = 0; i < numGroups; i++) {
        const ids = assignments[i] || new Set();
        const groupItems = items.filter(it => ids.has(it.id));
        text += `\nPessoa ${i + 1} — ${fmt(groupTotals[i])}:\n`;
        groupItems.forEach(it => { text += `  ${it.qty}x ${it.name} ${fmt(Number(it.total_price))}\n`; });
      }
      if (remainder > 0.01) text += `\n⚠️ Restante não atribuído: ${fmt(remainder)}\n`;
    }
    navigator.clipboard.writeText(text);
    toast.success('Resumo copiado!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Divide className="h-5 w-5" /> Dividir Conta #{order.number}
          </DialogTitle>
        </DialogHeader>

        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">Total da conta</p>
          <p className="text-2xl font-bold">{fmt(total)}</p>
        </div>

        <Tabs value={mode} onValueChange={v => setMode(v as 'equal' | 'items')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="equal" className="flex items-center gap-1"><Users className="h-4 w-4" /> Igual</TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-1"><ListChecks className="h-4 w-4" /> Por itens</TabsTrigger>
          </TabsList>

          {/* Equal split */}
          <TabsContent value="equal" className="space-y-4 mt-4">
            <div>
              <Label>Número de pessoas</Label>
              <div className="flex items-center gap-3 mt-1">
                <Button size="sm" variant="outline" onClick={() => setNumPeople(p => Math.max(2, p - 1))} disabled={numPeople <= 2}>−</Button>
                <Input
                  type="number"
                  min={2}
                  max={20}
                  value={numPeople}
                  onChange={e => setNumPeople(Math.max(2, Math.min(20, Number(e.target.value))))}
                  className="w-20 text-center"
                />
                <Button size="sm" variant="outline" onClick={() => setNumPeople(p => Math.min(20, p + 1))} disabled={numPeople >= 20}>+</Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground">Cada pessoa paga</p>
              <p className="text-3xl font-bold text-primary">{fmt(perPerson)}</p>
            </div>

            {/* Quick visual */}
            <div className="flex flex-wrap gap-2 justify-center">
              {Array.from({ length: numPeople }).map((_, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  Pessoa {i + 1}: {fmt(perPerson)}
                </Badge>
              ))}
            </div>
          </TabsContent>

          {/* Items split */}
          <TabsContent value="items" className="space-y-4 mt-4">
            <div>
              <Label>Número de pessoas</Label>
              <div className="flex items-center gap-3 mt-1">
                <Button size="sm" variant="outline" onClick={() => { setNumGroups(g => Math.max(2, g - 1)); }} disabled={numGroups <= 2}>−</Button>
                <Input
                  type="number"
                  min={2}
                  max={10}
                  value={numGroups}
                  onChange={e => setNumGroups(Math.max(2, Math.min(10, Number(e.target.value))))}
                  className="w-20 text-center"
                />
                <Button size="sm" variant="outline" onClick={() => setNumGroups(g => Math.min(10, g + 1))} disabled={numGroups >= 10}>+</Button>
              </div>
            </div>

            {Array.from({ length: numGroups }).map((_, gi) => (
              <div key={gi} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">Pessoa {gi + 1}</span>
                  <Badge variant="outline">{fmt(groupTotals[gi])}</Badge>
                </div>
                <div className="space-y-1">
                  {items.map(item => {
                    const checked = (assignments[gi] || new Set()).has(item.id);
                    // Check if another group has this item
                    const takenBy = Object.entries(assignments).find(([k, s]) => Number(k) !== gi && s.has(item.id));
                    return (
                      <label key={item.id} className={`flex items-center gap-2 text-sm py-1 px-1 rounded cursor-pointer hover:bg-muted/50 ${takenBy ? 'opacity-40' : ''}`}>
                        <Checkbox
                          checked={checked}
                          disabled={!!takenBy && !checked}
                          onCheckedChange={() => toggleItem(gi, item.id)}
                        />
                        <span className="flex-1">{item.qty}x {item.name}</span>
                        <span className="text-muted-foreground tabular-nums">{fmt(Number(item.total_price))}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {remainder > 0.01 && (
              <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 text-center">
                ⚠️ Falta atribuir: {fmt(remainder)}
              </div>
            )}
            {remainder <= 0.01 && assignedTotal > 0 && (
              <div className="bg-primary/10 text-primary text-sm rounded-lg p-3 text-center">
                ✅ Todos os itens atribuídos!
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex items-center gap-1" onClick={copySummary}>
            <Copy className="h-4 w-4" /> Copiar resumo
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
