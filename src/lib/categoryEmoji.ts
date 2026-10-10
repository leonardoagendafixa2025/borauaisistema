/**
 * Maps a category name to an appropriate emoji based on keywords.
 * Falls back to a generic plate emoji if no keyword matches.
 */
const RULES: Array<[RegExp, string]> = [
  // Bebidas
  [/refrigerante|refri|coca|guaran|soda|\bsuco\b|sucos/i, '🥤'],
  [/\bagua\b|água|mineral/i, '💧'],
  [/cerveja|chopp|chope|brahma|skol|heineken|long\s*neck/i, '🍺'],
  [/vinho|tinto|branco|espumante|champ/i, '🍷'],
  [/drink|coquetel|caipi|gin|vodka|whisky|whiskey|destilado|dose/i, '🍸'],
  [/cafe|café|expresso|capuccino|cappuccino/i, '☕'],
  [/cha\b|chá|matte/i, '🍵'],
  [/energetic|energ[ée]tico|red bull|monster/i, '⚡'],
  [/bebida/i, '🥤'],

  // Comida principal
  [/hamb[uú]rg|burger|lanche|x-|sandu/i, '🍔'],
  [/pizza|calzone/i, '🍕'],
  [/massa|macarr[aã]o|espaguete|lasanha|nhoque|talharim|ravioli/i, '🍝'],
  [/sushi|temaki|sashimi|japon|oriental/i, '🍣'],
  [/taco|burrito|nachos|mexican/i, '🌮'],
  [/churras|carne|bovina|costela|picanha|grelhad/i, '🥩'],
  [/frango|galinha|chicken|aves/i, '🍗'],
  [/peixe|salmao|salmão|tilapia|fil[ée]\s*de\s*peixe|fritura|peixaria/i, '🐟'],
  [/camar[aã]o|frutos do mar|moqueca|maris/i, '🦐'],
  [/salada|verdura|vegetar|vegan/i, '🥗'],
  [/sopa|caldo|cremes/i, '🍲'],
  [/porc[aã]o|petisco|tira-?gosto|aperitivo|entrada/i, '🍟'],
  [/batata|fritas/i, '🍟'],
  [/pastel|past[ée]is/i, '🥟'],
  [/cuscuz|tapioca|nordest/i, '🌽'],
  [/feij[aã]o|feijoada/i, '🍛'],
  [/arroz|risoto/i, '🍚'],
  [/prato\s*feito|pf|executivo|almoc|almoço|refei[cç][aã]o/i, '🍽️'],
  [/marmita|quentinha/i, '🍱'],

  // Sobremesas / doces
  [/sobremesa|doce|pudim|mousse|brigadeiro|brownie/i, '🍮'],
  [/sorvete|a[cç][ai]a[ií]|gelad/i, '🍦'],
  [/bolo|torta/i, '🍰'],
  [/chocolate/i, '🍫'],

  // Padaria
  [/p[aã]o|padaria|sandu[ií]che/i, '🥖'],
  [/queijo/i, '🧀'],

  // Café da manhã
  [/caf[ée]\s*da\s*manh|breakfast|matinal/i, '🥐'],
  [/ovo|omelete/i, '🥚'],

  // Promoções / combos
  [/promo|oferta|desconto/i, '🏷️'],
  [/combo|kit/i, '🎁'],
  [/destaque|favorito|popular|mais vendid/i, '⭐'],
  [/novo|novidade|lan[cç]amento/i, '🆕'],
  [/kids|infantil|crian[cç]a/i, '🧒'],

  // Fallbacks
  [/comida|prato|menu|geral/i, '🍽️'],
];

export function getCategoryEmoji(name: string | null | undefined): string {
  if (!name) return '🍽️';
  for (const [regex, emoji] of RULES) {
    if (regex.test(name)) return emoji;
  }
  return '🍽️';
}
