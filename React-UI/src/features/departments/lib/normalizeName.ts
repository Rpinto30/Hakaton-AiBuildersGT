const ALIASES: Record<string, string> = {
  'el quiche': 'quiché',
  quilche: 'quiché',
  quiche: 'quiché',
  quezaltenango: 'quetzaltenango',
  'el peten': 'petén',
  peten: 'petén',
  'el progreso': 'el progreso',
  sanmarcos: 'san marcos',
  santarosa: 'santa rosa',
}

function normalizeBase(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function normalizeName(input: string): string {
  const base = normalizeBase(input)
  return ALIASES[base] ?? base
}
