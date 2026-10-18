// src/lib/model.js
// Life dimensions, default rhythms, and the migration from v1 saved lists.

export const DIMENSIONS = [
  { id: 'health',   name: 'Health',              color: '#C0563F' },
  { id: 'family',   name: 'Family',              color: '#2B5F7D' },
  { id: 'faith',    name: 'Faith',               color: '#6A5C8E' },
  { id: 'work',     name: 'Work',                color: '#4A5862' },
  { id: 'creative', name: 'Creative / Music',    color: '#B07A2A' },
  { id: 'home',     name: 'Home / Finances',     color: '#3E7352' },
  { id: 'friends',  name: 'Friends / Community', color: '#A2577A' },
]
export const DIM_IDS = DIMENSIONS.map((d) => d.id)

// v1 checklist categories map onto the new dimensions.
const CAT_TO_DIM = { spirit: 'faith', health: 'health', home: 'family', work: 'work', music: 'creative' }

export const LIST_KEYS = ['weekday', 'saturday', 'sunday', 'travel']
export const LIST_LABELS = { weekday: 'Weekday rhythm', saturday: 'Saturday rhythm', sunday: 'Sabbath rhythm', travel: 'Travel day' }

// No em or en dashes anywhere in UI copy. Saved v1 text is cleaned on display.
export function clean(text, sep = ': ') {
  if (typeof text !== 'string') return ''
  return text.replace(/\s*[—–]\s*/g, sep).replace(/One Five One|\b151\b/g, 'the platform')
}

export const DEFAULT_LISTS = {
  weekday: [
    { id: 'wd0', text: '30 min stillness', sub: 'Prayer before the day opens.', icon: '🕊️', w: 'core', dim: 'faith' },
    { id: 'wd1', text: 'Morning anchor', sub: 'Identity before activity.', icon: '☀️', w: 'bonus', dim: 'faith' },
    { id: 'wd2', text: 'No caffeine after 12pm', sub: 'Protect sleep.', icon: '☕', w: 'bonus', dim: 'health' },
    { id: 'wd3', text: 'Present with family', sub: 'Eye contact. No phone at dinner.', icon: '🏠', w: 'core', dim: 'family' },
    { id: 'wd4', text: 'Workout done', sub: 'Strength, sprint, or movement.', icon: '💪', w: 'core', dim: 'health' },
    { id: 'wd5', text: 'No decisions after 9pm', sub: 'Hard problems get morning slots.', icon: '🌙', w: 'bonus', dim: 'work' },
    { id: 'wd6', text: 'Hydration', sub: 'Water before coffee. All day.', icon: '💧', w: 'bonus', dim: 'health' },
  ],
  saturday: [
    { id: 'sa0', text: 'Family breakfast', sub: 'Together. No phones.', icon: '🍳', w: 'core', dim: 'family' },
    { id: 'sa1', text: 'River: connection time', sub: 'Intentional. His world, his pace.', icon: '⚽', w: 'core', dim: 'family' },
    { id: 'sa2', text: 'Annie: connection time', sub: 'Her space, her interests.', icon: '🎭', w: 'core', dim: 'family' },
    { id: 'sa3', text: 'Music practice', sub: 'Bass, guitar, or piano. 30 min+.', icon: '🎸', w: 'bonus', dim: 'creative' },
    { id: 'sa4', text: 'Movement / outdoors', sub: 'Walk, hike, or workout.', icon: '🌄', w: 'core', dim: 'health' },
    { id: 'sa6', text: 'Jules: date or moment', sub: 'Even 30 minutes. Just the two of you.', icon: '💍', w: 'core', dim: 'family' },
  ],
  sunday: [
    { id: 'su0', text: 'Church', sub: 'Show up. Be present.', icon: '⛪', w: 'core', dim: 'faith' },
    { id: 'su1', text: '30 min stillness', sub: 'Sabbath starts in the quiet.', icon: '🕊️', w: 'bonus', dim: 'faith' },
    { id: 'su2', text: 'Sabbath honored', sub: "Rest in God's sovereignty.", icon: '🌿', w: 'core', dim: 'faith' },
    { id: 'su3', text: 'Family time', sub: 'No agenda. Just present.', icon: '🏠', w: 'core', dim: 'family' },
  ],
  travel: [
    { id: 'tr1', text: '30 min stillness', sub: 'Especially on the road.', icon: '☀️', w: 'core', dim: 'faith' },
    { id: 'tr4', text: 'Called Jules and kids', sub: "Connection doesn't stop at the gate.", icon: '📱', w: 'core', dim: 'family' },
    { id: 'tr5', text: '20 min movement', sub: 'Hotel gym or bodyweight.', icon: '🏃', w: 'core', dim: 'health' },
    { id: 'tr0', text: 'Morning anchor', sub: "The compass doesn't change with timezone.", icon: '🕊️', w: 'bonus', dim: 'faith' },
    { id: 'tr3', text: 'Sleep kit deployed', sub: 'Eye mask, earplugs, room dark.', icon: '😴', w: 'bonus', dim: 'health' },
    { id: 'tr6', text: 'Hydration: water first', sub: 'Not just airport coffee.', icon: '💧', w: 'bonus', dim: 'health' },
  ],
}
export const DEFAULT_TRAVEL_MIN = ['tr1', 'tr4', 'tr5']

const RETIRED_ITEM_IDS = ['p2']

function normItem(it) {
  return {
    id: String(it.id),
    text: clean(it.text),
    sub: clean(it.sub || '', ', '),
    icon: it.icon || '•',
    w: it.w === 'bonus' ? 'bonus' : 'core',
    dim: DIM_IDS.includes(it.dim) ? it.dim : (CAT_TO_DIM[it.cat] || 'work'),
    ...(it.addedAt ? { addedAt: it.addedAt } : {}),
  }
}

// Builds v2 lists from the v2 key if present, otherwise from the v1 saved
// lists, otherwise from defaults. Only the four daily lists survive; the
// weekly/monthly/annual/platform lists are retired in v2.
export function normalizeLists(v2Lists, v1Saved) {
  const src = v2Lists || v1Saved || DEFAULT_LISTS
  const out = {}
  LIST_KEYS.forEach((k) => {
    const arr = Array.isArray(src[k]) ? src[k] : DEFAULT_LISTS[k]
    out[k] = arr.filter((it) => it && it.id && !RETIRED_ITEM_IDS.includes(it.id)).map(normItem)
  })
  return out
}

export function allItems(lists) {
  const seen = new Map()
  LIST_KEYS.forEach((k) => (lists[k] || []).forEach((it) => { if (!seen.has(it.id)) seen.set(it.id, { ...it, list: k }) }))
  return [...seen.values()]
}

export function dimOf(id) { return DIMENSIONS.find((d) => d.id === id) || DIMENSIONS[3] }
export function dimName(id, names) { return (names && names[id]) || dimOf(id).name }
