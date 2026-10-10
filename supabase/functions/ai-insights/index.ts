import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  restaurant_id: string;
  question?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { restaurant_id, question, history = [] }: Payload = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: "restaurant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate access
    const { data: roleCheck } = await admin
      .from("user_roles").select("id")
      .or(`user_id.eq.${userData.user.id},restaurant_id.eq.${restaurant_id}`)
      .eq("user_id", userData.user.id).limit(1);
    if (!roleCheck || roleCheck.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate business data (last 30d)
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [ordersRes, expensesRes, surveysRes, productsRes, inventoryRes] = await Promise.all([
      admin.from("orders").select("id,total,status,type,created_at,payment_method")
        .eq("restaurant_id", restaurant_id).gte("created_at", since).neq("status", "cancelled"),
      admin.from("expenses").select("amount,status,due_date,description")
        .eq("restaurant_id", restaurant_id).gte("due_date", since.slice(0, 10)),
      admin.from("satisfaction_surveys").select("score,category,comment")
        .eq("restaurant_id", restaurant_id).gte("created_at", since),
      admin.from("products").select("id,name,price,sold_out")
        .eq("restaurant_id", restaurant_id).eq("active", true),
      admin.from("inventory_items").select("name,current_stock,min_stock,unit")
        .eq("restaurant_id", restaurant_id).eq("active", true),
    ]);

    const orders = ordersRes.data ?? [];
    const expenses = expensesRes.data ?? [];
    const surveys = surveysRes.data ?? [];
    const products = productsRes.data ?? [];
    const inventory = inventoryRes.data ?? [];

    // Top items (last 30d)
    const { data: topItems } = await admin
      .from("order_items")
      .select("name,qty,total_price,order_id,orders!inner(restaurant_id,created_at,status)")
      .eq("orders.restaurant_id", restaurant_id)
      .gte("orders.created_at", since)
      .neq("orders.status", "cancelled")
      .limit(500);

    const itemMap = new Map<string, { qty: number; revenue: number }>();
    (topItems ?? []).forEach((it: any) => {
      const cur = itemMap.get(it.name) ?? { qty: 0, revenue: 0 };
      cur.qty += Number(it.qty);
      cur.revenue += Number(it.total_price);
      itemMap.set(it.name, cur);
    });
    const topProducts = [...itemMap.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
      .sort((a, b) => b.qty - a.qty).slice(0, 10);

    const revenue = orders.reduce((s, o: any) => s + Number(o.total), 0);
    const totalExpenses = expenses.filter((e: any) => e.status === "paid")
      .reduce((s, e: any) => s + Number(e.amount), 0);
    const overdue = expenses.filter((e: any) => e.status === "overdue").length;
    const lowStock = inventory.filter((i: any) => Number(i.current_stock) <= Number(i.min_stock));
    const avgTicket = orders.length ? revenue / orders.length : 0;
    const npsPromoters = surveys.filter((s: any) => s.score >= 9).length;
    const npsDetractors = surveys.filter((s: any) => s.score <= 6).length;
    const nps = surveys.length
      ? Math.round(((npsPromoters - npsDetractors) / surveys.length) * 100)
      : null;

    // Hour distribution
    const byHour = new Array(24).fill(0);
    orders.forEach((o: any) => { byHour[new Date(o.created_at).getHours()]++; });
    const peakHour = byHour.indexOf(Math.max(...byHour));

    const context = {
      period: "últimos 30 dias",
      orders_count: orders.length,
      revenue: Number(revenue.toFixed(2)),
      avg_ticket: Number(avgTicket.toFixed(2)),
      total_paid_expenses: Number(totalExpenses.toFixed(2)),
      net_profit: Number((revenue - totalExpenses).toFixed(2)),
      overdue_expenses: overdue,
      low_stock_items: lowStock.map((i: any) => `${i.name} (${i.current_stock} ${i.unit})`),
      sold_out_products: products.filter((p: any) => p.sold_out).map((p: any) => p.name),
      top_products: topProducts,
      peak_hour: `${peakHour}h`,
      nps,
      promoters: npsPromoters,
      detractors: npsDetractors,
      surveys_count: surveys.length,
      orders_by_type: {
        delivery: orders.filter((o: any) => o.type === "delivery").length,
        pickup: orders.filter((o: any) => o.type === "pickup").length,
        dine_in: orders.filter((o: any) => o.type === "dine_in").length,
      },
      recent_negative_comments: surveys
        .filter((s: any) => s.score <= 6 && s.comment)
        .slice(0, 5).map((s: any) => s.comment),
    };

    const systemPrompt = `Você é um consultor de negócios sênior especializado em food service no Brasil.
Analise os dados do restaurante e dê insights ACIONÁVEIS, específicos e baseados nos números fornecidos.
Seja direto, use bullets, sugira ações concretas. Use R$ e formato brasileiro.
NUNCA invente números — use apenas os dados do contexto.
Se o usuário fizer uma pergunta, responda objetivamente com base nos dados.`;

    const userMsg = question
      ? `Dados do restaurante (JSON):\n${JSON.stringify(context, null, 2)}\n\nPergunta: ${question}`
      : `Dados do restaurante (JSON):\n${JSON.stringify(context, null, 2)}\n\nGere um resumo executivo com:\n1. Diagnóstico geral (1 parágrafo)\n2. 3-5 pontos fortes\n3. 3-5 alertas/problemas\n4. 3-5 ações recomendadas priorizadas`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMsg },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações > Workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar análise" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const answer = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ answer, context }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
