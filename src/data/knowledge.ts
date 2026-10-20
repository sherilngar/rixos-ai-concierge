import { z } from 'zod';
import raw from './knowledge.json';

const sample = z.boolean().optional();

const MenuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAr: z.string(),
  tags: z.array(z.string()),
  contains: z.array(z.string()),
  modifiers: z.array(z.string()),
  kw: z.array(z.string()),
});

export const KnowledgeSchema = z.object({
  meta: z.object({
    hotel: z.string(),
    location: z.string(),
    /** Null until the hotel confirms its room count. */
    rooms: z.number().nullable(),
    confirmed: z.array(z.string()),
    /** Where the confirmed details come from. */
    source: z.string().optional(),
    note: z.string(),
  }),
  policies: z.object({
    sample,
    checkIn: z.string(),
    checkOut: z.string(),
    lateCheckOut: z.string(),
    pets: z.string(),
    smoking: z.string(),
    dressCode: z.string(),
  }),
  wifi: z.object({ sample, network: z.string(), access: z.string(), cost: z.string() }),
  outlets: z.array(
    z.object({
      id: z.string(),
      sample,
      name: z.string(),
      nameAr: z.string(),
      type: z.string(),
      meals: z.array(z.string()),
      hours: z.string(),
      dressCode: z.string(),
      reservations: z.boolean(),
      kw: z.array(z.string()),
    }),
  ),
  spa: z.object({
    sample,
    hours: z.string(),
    inRoomMassage: z.string(),
    treatments: z.array(z.object({ id: z.string(), name: z.string(), nameAr: z.string() })),
  }),
  gym: z.object({ sample, hours: z.string(), classes: z.string() }),
  sauna: z.object({ sample, hours: z.string() }),
  pool: z.object({ sample, hours: z.string(), towels: z.string(), cabanas: z.string() }),
  kidsClub: z.object({ sample, hours: z.string(), ages: z.string(), babysitting: z.string() }),
  activities: z.object({ sample, schedule: z.string() }),
  transport: z.object({ sample, options: z.string(), parking: z.string() }),
  ird: z.object({
    sample,
    hours: z.string(),
    note: z.string(),
    categories: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        nameAr: z.string(),
        items: z.array(MenuItemSchema),
      }),
    ),
  }),
  contacts: z.object({ sample, ambassador: z.string(), emergency: z.string(), doctor: z.string() }),
});

export type Knowledge = z.infer<typeof KnowledgeSchema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
export type Outlet = Knowledge['outlets'][number];

export const DEFAULT_KNOWLEDGE: Knowledge = KnowledgeSchema.parse(raw);

/** True while any section still carries placeholder content. */
export function hasSampleContent(k: Knowledge): boolean {
  const sections: Array<{ sample?: boolean }> = [
    k.policies,
    k.wifi,
    k.spa,
    k.gym,
    k.sauna,
    k.pool,
    k.kidsClub,
    k.activities,
    k.transport,
    k.ird,
    k.contacts,
    ...k.outlets,
  ];
  return sections.some((s) => s.sample);
}

export function menuItems(k: Knowledge): MenuItem[] {
  return k.ird.categories.flatMap((c) => c.items);
}

export const DIETARY_TAGS = [
  'vegetarian',
  'vegan',
  'gluten_free',
  'halal',
  'nut_free',
  'dairy_free',
] as const;
export type DietaryTag = (typeof DIETARY_TAGS)[number];
