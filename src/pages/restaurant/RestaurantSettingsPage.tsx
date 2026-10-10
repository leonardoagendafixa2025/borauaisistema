import { Store, Truck, Clock, CreditCard, Palette, Lock, Send, Copy, Check, Zap, MapPin, Bell } from 'lucide-react';
import NotificationPrefsToggle from '@/components/NotificationPrefsToggle';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import DeliveryZonesManager from '@/components/DeliveryZonesManager';
import { Link } from 'react-router-dom';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import TelegramStaffManager from '@/components/TelegramStaffManager';
import { useState } from 'react';
import { useRestaurant, useRestaurantSettings } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

const tabs = [
  { id: 'store', label: 'Loja', icon: Store },
  { id: 'delivery', label: 'Entrega', icon: Truck },
  { id: 'zones', label: 'Bairros', icon: MapPin },
  { id: 'hours', label: 'Horários', icon: Clock },
  { id: 'payments', label: 'Pagamentos', icon: CreditCard },
  { id: 'dinein', label: 'Mesa & Bar', icon: Clock },
  { id: 'appearance', label: 'Aparência', icon: Palette },
  { id: 'balada', label: 'Modo Balada', icon: Zap },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'telegram', label: 'Telegram', icon: Send },
];

const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export default function RestaurantSettings() {
  const [active, setActive] = useState('store');
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const { data: restaurant } = useRestaurant();
  const { data: settings, isLoading } = useRestaurantSettings();
  const plan = usePlanFeatures();

  const [saving, setSaving] = useState(false);

  const handleSaveStore = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    await supabase.from('restaurants').update({
      name: form.get('name') as string,
      cnpj: form.get('cnpj') as string,
      phone: form.get('phone') as string,
      whatsapp: form.get('whatsapp') as string,
      address: form.get('address') as string,
    }).eq('id', restaurantId!);
    queryClient.invalidateQueries({ queryKey: ['restaurant'] });
    toast.success('Dados salvos com sucesso!');
    setSaving(false);
  };

  const handleSaveSettings = async (updates: Record<string, any>) => {
    setSaving(true);
    await supabase.from('restaurant_settings').update(updates as any).eq('restaurant_id', restaurantId!);
    queryClient.invalidateQueries({ queryKey: ['restaurant_settings'] });
    toast.success('Configurações salvas!');
    setSaving(false);
  };

  if (isLoading) {
    return <RestaurantLayout><div className="p-12 text-center text-muted-foreground">Carregando...</div></RestaurantLayout>;
  }

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div>
            <h1 className="font-heading text-2xl font-bold">Configurações</h1>
            <p className="text-sm text-muted-foreground">Gerencie as configurações do seu restaurante</p>
          </div>
        </ScrollReveal>

        <div className="flex flex-col lg:flex-row gap-6">
          <ScrollReveal>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:w-48 shrink-0">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActive(t.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    active === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}>
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </nav>
          </ScrollReveal>

          <ScrollReveal className="flex-1">
            <div className="card-elevated p-6 space-y-6">
              {active === 'store' && (
                <form onSubmit={handleSaveStore}>
                  <h3 className="font-heading font-semibold text-lg mb-4">Dados da Loja</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Nome</label>
                      <input name="name" type="text" defaultValue={restaurant?.name || ''} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Slug (URL)</label>
                      <input name="slug" type="text" defaultValue={restaurant?.slug || ''} disabled className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed" />
                      <p className="text-xs text-muted-foreground mt-1">Gerenciado pelo administrador</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">CNPJ</label>
                      <input name="cnpj" type="text" defaultValue={restaurant?.cnpj || ''} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">E-mail</label>
                      <input name="email" type="email" defaultValue={restaurant?.email || ''} disabled className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed" />
                      <p className="text-xs text-muted-foreground mt-1">Gerenciado pelo administrador</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Telefone</label>
                      <input name="phone" type="tel" defaultValue={restaurant?.phone || ''} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">WhatsApp</label>
                      <input name="whatsapp" type="tel" defaultValue={restaurant?.whatsapp || ''} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-sm font-medium">Endereço</label>
                    <input name="address" type="text" defaultValue={restaurant?.address || ''} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                  <div className="pt-4 border-t border-border mt-6">
                    <button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                      {saving ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                  </div>
                </form>
              )}

              {active === 'dinein' && (
                <>
                  <h3 className="font-heading font-semibold text-lg">Mesa & Bar</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Couvert artístico', desc: 'Cobrar couvert dos clientes', key: 'couvert_enabled', checked: settings?.couvert_enabled },
                      { label: 'Taxa de serviço (10%)', desc: 'Cobrar taxa do garçom', key: 'service_fee_enabled', checked: settings?.service_fee_enabled },
                    ].map(o => (
                      <div key={o.key} className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                        <div>
                          <p className="text-sm font-medium">{o.label}</p>
                          <p className="text-xs text-muted-foreground">{o.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked={o.checked} onChange={e => handleSaveSettings({ [o.key]: e.target.checked })} className="sr-only peer" />
                          <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                        </label>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Valor do couvert (R$)</label>
                        <input type="number" defaultValue={settings?.couvert_value || 0}
                          onBlur={e => handleSaveSettings({ couvert_value: parseFloat(e.target.value) })}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">% Taxa de serviço</label>
                        <input type="number" defaultValue={settings?.service_fee_percent || 10}
                          onBlur={e => handleSaveSettings({ service_fee_percent: parseFloat(e.target.value) })}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-sm font-medium">Pagamento nas mesas</p>
                      <p className="text-xs text-muted-foreground mt-1">O pagamento é 100% realizado pelo garçom.</p>
                    </div>
                  </div>
                </>
              )}

              {active === 'delivery' && (
                <>
                  <h3 className="font-heading font-semibold text-lg">Entrega & Retirada</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Delivery', key: 'delivery_enabled', checked: settings?.delivery_enabled },
                      { label: 'Retirada', key: 'pickup_enabled', checked: settings?.pickup_enabled },
                      { label: 'Consumo no local', key: 'dine_in_enabled', checked: settings?.dine_in_enabled },
                    ].map(o => (
                      <div key={o.key} className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                        <p className="text-sm font-medium">{o.label}</p>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked={o.checked} onChange={e => handleSaveSettings({ [o.key]: e.target.checked })} className="sr-only peer" />
                          <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                        </label>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium">Taxa de entrega (R$)</label>
                        <input type="number" defaultValue={settings?.delivery_fee || 0}
                          onBlur={e => handleSaveSettings({ delivery_fee: parseFloat(e.target.value) })}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Pedido mínimo (R$)</label>
                        <input type="number" defaultValue={settings?.min_order_value || 0}
                          onBlur={e => handleSaveSettings({ min_order_value: parseFloat(e.target.value) })}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Tempo estimado (min)</label>
                        <input type="number" defaultValue={settings?.estimated_prep_time || 30}
                          onBlur={e => handleSaveSettings({ estimated_prep_time: parseInt(e.target.value) })}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {active === 'zones' && <DeliveryZonesManager />}

              {active === 'hours' && (() => {
                const hours = (settings?.opening_hours || {}) as Record<string, any>;
                const getDay = (d: string) => hours[d] || { enabled: true, open: '11:00', close: '23:00' };
                const saveHours = (dayKey: string, updates: any) => {
                  const current = { ...hours };
                  current[dayKey] = { ...getDay(dayKey), ...updates };
                  handleSaveSettings({ opening_hours: current });
                };
                const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                return (
                  <>
                    <h3 className="font-heading font-semibold text-lg">Horários de Funcionamento</h3>
                    <div className="space-y-3">
                      {days.map((d, i) => {
                        const dk = dayKeys[i];
                        const val = getDay(dk);
                        return (
                          <div key={d} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={val.enabled !== false} onChange={e => saveHours(dk, { enabled: e.target.checked })} className="sr-only peer" />
                              <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                            </label>
                            <span className="text-sm font-medium w-20">{d}</span>
                            <input type="time" defaultValue={val.open || '11:00'} onBlur={e => saveHours(dk, { open: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                            <span className="text-xs text-muted-foreground">até</span>
                            <input type="time" defaultValue={val.close || '23:00'} onBlur={e => saveHours(dk, { close: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {active === 'payments' && (() => {
                const methods = (settings?.payment_methods || ['pix', 'cash', 'credit_card', 'debit_card']) as string[];
                const allMethods = [
                  { key: 'pix', label: 'PIX' },
                  { key: 'cash', label: 'Dinheiro' },
                  { key: 'credit_card', label: 'Cartão de crédito' },
                  { key: 'debit_card', label: 'Cartão de débito' },
                  { key: 'meal_voucher', label: 'Vale refeição' },
                ];
                const toggleMethod = (key: string) => {
                  const updated = methods.includes(key)
                    ? methods.filter(m => m !== key)
                    : [...methods, key];
                  handleSaveSettings({ payment_methods: updated });
                };
                return (
                  <>
                    <h3 className="font-heading font-semibold text-lg">Métodos de Pagamento</h3>
                    <div className="space-y-3">
                      {allMethods.map(m => (
                        <div key={m.key} className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                          <span className="text-sm font-medium">{m.label}</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={methods.includes(m.key)} onChange={() => toggleMethod(m.key)} className="sr-only peer" />
                            <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                          </label>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {active === 'appearance' && (
                plan.hasVisualCustomization ? (
                <>
                  <h3 className="font-heading font-semibold text-lg">Aparência do Cardápio</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Cor primária</label>
                      <div className="flex items-center gap-3 mt-1">
                        <input type="color" defaultValue={settings?.primary_color || '#F97316'}
                          onBlur={e => handleSaveSettings({ primary_color: e.target.value })}
                          className="h-10 w-10 rounded cursor-pointer" />
                        <input type="text" defaultValue={settings?.primary_color || '#F97316'}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-32" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Logo</label>
                      <p className="text-xs text-muted-foreground mb-1">Recomendado: 512×512px (quadrado, PNG ou JPG)</p>
                      {restaurant?.logo_url && (
                        <img src={restaurant.logo_url} alt="Logo" className="h-16 w-16 rounded-xl object-cover mb-2" />
                      )}
                      <label className="mt-1 flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary/50 transition-colors cursor-pointer">
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
                          if (!validTypes.includes(file.type)) { toast.error('Formato inválido. Use PNG, JPG ou WebP.'); return; }
                          if (file.size > 2 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 2MB.'); return; }
                          setSaving(true);
                          const ext = file.name.split('.').pop();
                          const path = `${restaurantId}/logo.${ext}`;
                          const { error: uploadErr } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: true });
                          if (uploadErr) { toast.error('Erro no upload'); setSaving(false); return; }
                          const { data: { publicUrl } } = supabase.storage.from('restaurant-assets').getPublicUrl(path);
                          await supabase.from('restaurants').update({ logo_url: publicUrl }).eq('id', restaurantId);
                          queryClient.invalidateQueries({ queryKey: ['restaurant'] });
                          toast.success('Logo atualizada!');
                          setSaving(false);
                        }} />
                        {saving ? 'Enviando...' : 'Clique para enviar logo (PNG, JPG, WebP — máx. 2MB)'}
                      </label>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Banner</label>
                      <p className="text-xs text-muted-foreground mb-1">Recomendado: 1200×400px (proporção 3:1, PNG ou JPG)</p>
                      {restaurant?.banner_url && (
                        <img src={restaurant.banner_url} alt="Banner" className="w-full h-24 rounded-xl object-cover mb-2" />
                      )}
                      <label className="mt-1 flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary/50 transition-colors cursor-pointer">
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !restaurantId) return;
                          const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
                          if (!validTypes.includes(file.type)) { toast.error('Formato inválido. Use PNG, JPG ou WebP.'); return; }
                          if (file.size > 5 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 5MB.'); return; }
                          setSaving(true);
                          const ext = file.name.split('.').pop();
                          const path = `${restaurantId}/banner.${ext}`;
                          const { error: uploadErr } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: true });
                          if (uploadErr) { toast.error('Erro no upload'); setSaving(false); return; }
                          const { data: { publicUrl } } = supabase.storage.from('restaurant-assets').getPublicUrl(path);
                          await supabase.from('restaurants').update({ banner_url: publicUrl }).eq('id', restaurantId);
                          queryClient.invalidateQueries({ queryKey: ['restaurant'] });
                          toast.success('Banner atualizado!');
                          setSaving(false);
                        }} />
                        {saving ? 'Enviando...' : 'Clique para enviar banner (PNG, JPG, WebP — máx. 5MB)'}
                      </label>
                    </div>
                  </div>
                </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border-2 border-dashed border-border bg-muted/30">
                    <Lock className="h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="font-heading font-bold text-lg">Recurso não disponível</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Personalização visual não está incluída no plano {plan.planName}. Faça upgrade para desbloquear.
                    </p>
                    <Link to="/restaurant/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                      Fazer upgrade
                    </Link>
                  </div>
                )
              )}

              {active === 'balada' && (
                plan.hasQuickSale ? (
                <>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <h3 className="font-heading font-semibold text-lg">Modo Balada (venda em pé)</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ative para liberar o app de venda avulsa móvel para o garçom — ideal para baladas, casas noturnas e eventos com galera em pé.
                  </p>
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                      <div>
                        <p className="text-sm font-medium">Ativar Modo Balada</p>
                        <p className="text-xs text-muted-foreground">Libera a aba <strong>/garcom/balada</strong> no app</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked={(settings as any)?.quick_sale_enabled} onChange={e => handleSaveSettings({ quick_sale_enabled: e.target.checked })} className="sr-only peer" />
                        <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                    </div>
                    <div>
                      <label className="text-sm font-medium">% Comissão padrão por garçom</label>
                      <p className="text-xs text-muted-foreground mb-1">Aplicada sobre o total vendido. Ex: 5 = 5%.</p>
                      <input type="number" min="0" max="100" step="0.5"
                        defaultValue={(settings as any)?.quick_sale_commission_percent || 0}
                        onBlur={e => handleSaveSettings({ quick_sale_commission_percent: parseFloat(e.target.value) || 0 })}
                        className="mt-1 w-full sm:w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </div>

                    {/* Agendamento automático */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">⏰ Ativação automática por horário</p>
                          <p className="text-xs text-muted-foreground">Liga e desliga o Modo Balada sozinho na janela definida</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked={(settings as any)?.quick_sale_auto_schedule} onChange={e => handleSaveSettings({ quick_sale_auto_schedule: e.target.checked })} className="sr-only peer" />
                          <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Início</label>
                          <input type="time"
                            defaultValue={(settings as any)?.quick_sale_start_time?.slice(0,5) || '22:00'}
                            onBlur={e => handleSaveSettings({ quick_sale_start_time: e.target.value })}
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Fim</label>
                          <input type="time"
                            defaultValue={(settings as any)?.quick_sale_end_time?.slice(0,5) || '04:00'}
                            onBlur={e => handleSaveSettings({ quick_sale_end_time: e.target.value })}
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Dias ativos</label>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {['D','S','T','Q','Q','S','S'].map((d, idx) => {
                            const days: number[] = (settings as any)?.quick_sale_active_days || [5,6];
                            const active = days.includes(idx);
                            return (
                              <button key={idx} type="button"
                                onClick={() => {
                                  const next = active ? days.filter(x => x !== idx) : [...days, idx].sort();
                                  handleSaveSettings({ quick_sale_active_days: next });
                                }}
                                className={`h-9 w-9 rounded-lg text-xs font-bold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                                {d}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">Domingo a Sábado · padrão: Sex e Sáb</p>
                      </div>
                    </div>

                    {/* Mensagens personalizadas */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <p className="text-sm font-medium">💬 Mensagens para o cliente</p>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Mensagem de boas-vindas</label>
                        <p className="text-[11px] text-muted-foreground mb-1">Exibida no topo do app de venda do garçom</p>
                        <textarea rows={2} maxLength={140}
                          placeholder="Ex: 🎉 Bem-vindo à balada! Bebida gelada na hora."
                          defaultValue={(settings as any)?.quick_sale_welcome_message || ''}
                          onBlur={e => handleSaveSettings({ quick_sale_welcome_message: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Mensagem de agradecimento</label>
                        <p className="text-[11px] text-muted-foreground mb-1">Mostrada após o pagamento ser confirmado</p>
                        <textarea rows={2} maxLength={140}
                          placeholder="Ex: Valeu! Aproveite a noite 🍻"
                          defaultValue={(settings as any)?.quick_sale_thankyou_message || ''}
                          onBlur={e => handleSaveSettings({ quick_sale_thankyou_message: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" />
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
                      <p className="font-semibold text-foreground">Como funciona:</p>
                      <p>1. Marque os produtos favoritos no <strong>Cardápio</strong> (botão ⚡ no produto).</p>
                      <p>2. O garçom abre o app em <strong>/garcom/balada</strong>, toca nos produtos e cobra na hora.</p>
                      <p>3. Veja vendas em tempo real no painel <strong>Modo Balada</strong> (sidebar).</p>
                    </div>
                  </div>
                </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border-2 border-dashed border-border bg-muted/30">
                    <Lock className="h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="font-heading font-bold text-lg">Modo Balada</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Disponível nos planos Pro e Premium. Faça upgrade para liberar a venda avulsa móvel.
                    </p>
                    <Link to="/restaurant/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                      Fazer upgrade
                    </Link>
                  </div>
                )
              )}

              {active === 'notifications' && (
                <>
                  <h3 className="font-heading font-semibold text-lg">Som, vibração & push</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Controle como este aparelho avisa quando chega pedido novo ou chamada de mesa. Preferências salvas por dispositivo.
                  </p>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          📲 Push Notifications nativas
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Recebe alertas mesmo com o app fechado ou tela apagada. No iPhone, instale o app antes (Compartilhar → Adicionar à Tela de Início).
                        </p>
                      </div>
                      <PushNotificationToggle />
                    </div>

                    <NotificationPrefsToggle variant="full" />
                  </div>

                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    💡 Dica: o garçom também ativa direto no app <code className="text-primary">/garcom</code> no topo da tela de mesas.
                  </div>
                </>
              )}

              {active === 'telegram' && (() => {
                const slug = restaurant?.slug || 'seu-slug';
                const command = `/start ${slug}`;
                const isLinked = !!(settings as any)?.telegram_chat_id;
                return (
                <>
                  <h3 className="font-heading font-semibold text-lg">Central de Notificações Telegram</h3>
                  <p className="text-sm text-muted-foreground">Alertas em tempo real e comandos interativos direto no seu Telegram.</p>

                  {/* Recursos disponíveis */}
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {[
                      { icon: '🆕', title: 'Novo pedido', desc: 'Alerta a cada pedido novo' },
                      { icon: '🔔', title: 'Chamada de mesa', desc: 'Garçom e pedido de conta' },
                      { icon: '📉', title: 'Avaliação ruim', desc: 'NPS ≤ 6 com comentário' },
                      { icon: '⚠️', title: 'Estoque baixo', desc: 'Itens abaixo do mínimo' },
                      { icon: '💸', title: 'Despesa vencendo', desc: '1 dia antes do vencimento' },
                      { icon: '📊', title: 'Resumo diário', desc: 'KPIs todo dia às 22h' },
                    ].map(f => (
                      <div key={f.title} className="rounded-lg border border-border bg-muted/30 p-3 flex gap-2">
                        <span className="text-lg">{f.icon}</span>
                        <div>
                          <p className="text-sm font-medium">{f.title}</p>
                          <p className="text-xs text-muted-foreground">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Comandos disponíveis */}
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm font-semibold mb-2">📋 Comandos do bot</p>
                    <div className="grid gap-1.5 sm:grid-cols-2 text-xs">
                      <div><code className="text-primary">/relatorio_hoje</code> — KPIs do dia</div>
                      <div><code className="text-primary">/relatorio_semana</code> — últimos 7 dias</div>
                      <div><code className="text-primary">/relatorio_mes</code> — últimos 30 dias</div>
                      <div><code className="text-primary">/comandas</code> — mesas abertas</div>
                      <div><code className="text-primary">/estoque</code> — itens em falta</div>
                      <div><code className="text-primary">/abrir</code> — abrir restaurante</div>
                      <div><code className="text-primary">/fechar</code> — fechar restaurante</div>
                      <div><code className="text-primary">/ajuda</code> — lista completa</div>
                    </div>
                  </div>

                  {/* Tutorial passo a passo */}
                  <div className="mt-4 rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">🎓</span>
                      <h4 className="font-heading font-semibold text-base">Tutorial: Configurar Telegram em 4 passos</h4>
                    </div>
                    <ol className="space-y-4">
                      <li className="flex gap-3">
                        <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">Instale o Telegram</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Baixe o app no <a href="https://telegram.org/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">site oficial</a> (celular ou desktop) e crie uma conta com seu número.
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">Encontre nosso bot oficial</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Na busca do Telegram, digite <code className="rounded bg-muted px-1.5 py-0.5 text-primary">@SeuBotAlertas</code> e abra a conversa. Toque em <strong>"Iniciar"</strong> (ou "Start").
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">Vincule sua conta com seu restaurante</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Copie o comando abaixo (botão 📋) e cole na conversa com o bot. Ele detecta automaticamente seu Chat ID e vincula ao seu painel — não precisa digitar nada manualmente.
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">4</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">Teste os alertas</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Quando o status abaixo mostrar <span className="text-success font-medium">"✅ Telegram vinculado"</span>, clique em <strong>"Enviar teste"</strong> no fim da página. Você deve receber a mensagem em segundos no Telegram.
                          </p>
                        </div>
                      </li>
                    </ol>
                    <div className="mt-4 rounded-lg bg-muted/50 border border-border p-3">
                      <p className="text-xs text-muted-foreground">
                        💡 <strong>Dica:</strong> Para receber alertas em grupo (ex: equipe da cozinha), crie um grupo no Telegram, adicione o <code className="text-primary">@SeuBotAlertas</code> como administrador e envie o comando do passo 3 dentro do grupo.
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className={`mt-4 flex items-center gap-3 rounded-lg p-4 ${isLinked ? 'bg-success/10 border border-success/20' : 'bg-warning/10 border border-warning/20'}`}>
                    <span className="text-lg">{isLinked ? '✅' : '⏳'}</span>
                    <div>
                      <p className="text-sm font-medium">{isLinked ? 'Telegram vinculado!' : 'Telegram não vinculado'}</p>
                      <p className="text-xs text-muted-foreground">{isLinked ? `Chat ID: ${(settings as any).telegram_chat_id}` : 'Siga as instruções abaixo para vincular.'}</p>
                    </div>
                  </div>

                  <div className="space-y-4 mt-4">
                    {/* Easy link instructions */}
                    <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📱</span>
                        <p className="text-sm font-semibold">Vincular automaticamente (recomendado)</p>
                      </div>
                      <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
                        <li>Abra o Telegram e procure o bot <strong>@SeuBotAlertas</strong></li>
                        <li>Envie exatamente o comando abaixo:</li>
                      </ol>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded-lg bg-background border border-border px-4 py-3 text-sm font-mono select-all">
                          {command}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(command);
                            toast.success('Comando copiado!');
                          }}
                          className="shrink-0 rounded-lg border border-border p-3 hover:bg-muted transition-colors"
                          title="Copiar comando"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">O bot confirmará a vinculação automaticamente em até 1 minuto.</p>
                    </div>

                    {/* Manual option */}
                    <details className="rounded-lg border border-border">
                      <summary className="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-muted/50 transition-colors">
                        Configuração manual (avançado)
                      </summary>
                      <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border">
                        <div>
                          <label className="text-sm font-medium">Chat ID do Telegram</label>
                          <input
                            type="text"
                            defaultValue={(settings as any)?.telegram_chat_id || ''}
                            placeholder="Ex: 8434843310"
                            onBlur={e => {
                              const val = e.target.value.trim();
                              handleSaveSettings({ telegram_chat_id: val || null } as any);
                            }}
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </details>

                    {/* Test button */}
                    <button
                      onClick={async () => {
                        if (!isLinked) {
                          toast.error('Vincule o Telegram primeiro');
                          return;
                        }
                        setSaving(true);
                        try {
                          const res = await supabase.functions.invoke('telegram-stock-alert', {
                            body: { restaurant_id: restaurantId },
                          });
                          if (res.error) throw res.error;
                          const data = res.data;
                          if (data?.sent) {
                            toast.success(`Teste enviado! ${data.sent} item(ns) com estoque baixo.`);
                          } else if (data?.message) {
                            toast.info('Nenhum item com estoque baixo no momento.');
                          } else if (data?.error) {
                            toast.error(data.error);
                          }
                        } catch (err: any) {
                          toast.error('Erro ao enviar teste: ' + (err.message || 'erro desconhecido'));
                        }
                        setSaving(false);
                      }}
                      disabled={saving || !isLinked}
                      className="flex items-center gap-2 rounded-lg bg-[#0088cc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0088cc]/90 transition-all disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {saving ? 'Enviando...' : 'Enviar teste'}
                    </button>

                    {/* Garçons vinculados (Fase C) */}
                    <TelegramStaffManager slug={(restaurant as any)?.slug} />
                  </div>
                </>
                );
              })()}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </RestaurantLayout>
  );
}
