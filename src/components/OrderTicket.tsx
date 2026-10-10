import { useRef } from 'react';
import { Printer } from 'lucide-react';

interface OrderItem {
  name: string;
  qty: number;
  notes?: string | null;
  options?: any;
}

interface TicketProps {
  order: {
    number: number;
    type: string;
    customer_name: string;
    customer_phone?: string | null;
    address?: string | null;
    notes?: string | null;
    table_id?: string | null;
    created_at: string;
    order_items?: OrderItem[];
  };
  restaurantName?: string;
  tableLabel?: string;
  onClose?: () => void;
}

const typeLabels: Record<string, string> = { delivery: 'ENTREGA', pickup: 'RETIRADA', dine_in: 'MESA' };

export default function OrderTicket({ order, restaurantName, tableLabel, onClose }: TicketProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!ref.current) return;
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Comanda #${order.number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-bottom: 1px dashed #000; margin: 4px 0; }
        .item { display: flex; justify-content: space-between; margin: 2px 0; }
        .notes { font-size: 10px; color: #555; margin-left: 12px; }
        .option { font-size: 10px; color: #333; margin-left: 12px; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin-bottom: 2px; }
      </style></head><body>
      ${ref.current.innerHTML}
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const time = new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const date = new Date(order.created_at).toLocaleDateString('pt-BR');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white text-black rounded-lg shadow-2xl max-w-sm w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        {/* Preview */}
        <div ref={ref} className="p-6 font-mono text-xs leading-relaxed">
          <div className="center">
            <h1 className="bold">{restaurantName || 'RESTAURANTE'}</h1>
            <p>COMANDA DE PEDIDO</p>
            <div className="line" />
          </div>

          <div className="item"><span>Pedido:</span><span className="bold">#{order.number}</span></div>
          <div className="item"><span>Tipo:</span><span className="bold">{typeLabels[order.type] || order.type}</span></div>
          {tableLabel && <div className="item"><span>Mesa:</span><span className="bold">{tableLabel}</span></div>}
          <div className="item"><span>Data:</span><span>{date} {time}</span></div>
          <div className="item"><span>Cliente:</span><span>{order.customer_name}</span></div>
          {order.customer_phone && <div className="item"><span>Fone:</span><span>{order.customer_phone}</span></div>}

          <div className="line" style={{ borderWidth: 2 }} />
          <div className="center bold" style={{ margin: '4px 0' }}>ITENS</div>
          <div className="line" />

          {(order.order_items || []).map((item, i) => (
            <div key={i}>
              <div className="item">
                <span>{item.qty}x {item.name}</span>
              </div>
              {item.options && Array.isArray(item.options) && item.options.length > 0 && (
                item.options.map((opt: any, oi: number) => (
                  <div key={oi} className="option">+ {opt.name}</div>
                ))
              )}
              {item.notes && <div className="notes">→ {item.notes}</div>}
            </div>
          ))}

          <div className="line" />
          {order.notes && (
            <>
              <div className="bold">OBS:</div>
              <div>{order.notes}</div>
              <div className="line" />
            </>
          )}
          {order.address && (
            <>
              <div className="bold">ENDEREÇO:</div>
              <div>{order.address}</div>
              <div className="line" />
            </>
          )}
          <div className="center" style={{ marginTop: 8, fontSize: 10 }}>
            Impresso em {new Date().toLocaleString('pt-BR')}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t">
          <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-all">
            <Printer className="h-4 w-4" /> Imprimir Comanda
          </button>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
