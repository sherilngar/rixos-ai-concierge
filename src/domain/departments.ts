import type { DepartmentId, Standards } from './types';

export interface DepartmentInfo {
  id: DepartmentId;
  en: string;
  ar: string;
  short: string;
  /** Demo staff member who signs replies and accepts tickets. Sample names. */
  staff: string;
  supervisor: string;
}

export const DEPARTMENTS: DepartmentInfo[] = [
  {
    id: 'frontoffice',
    en: 'Front Office / Ambassador',
    ar: 'المكتب الأمامي / السفير',
    short: 'Ambassador',
    staff: 'Nadia',
    supervisor: 'Front Office Manager',
  },
  {
    id: 'housekeeping',
    en: 'Housekeeping',
    ar: 'التدبير المنزلي',
    short: 'Housekeeping',
    staff: 'Maria',
    supervisor: 'Housekeeping Supervisor',
  },
  {
    id: 'laundry',
    en: 'Laundry',
    ar: 'المغسلة',
    short: 'Laundry',
    staff: 'Joseph',
    supervisor: 'Laundry Supervisor',
  },
  {
    id: 'engineering',
    en: 'Engineering',
    ar: 'الهندسة والصيانة',
    short: 'Engineering',
    staff: 'Rajesh',
    supervisor: 'Duty Engineer',
  },
  {
    id: 'ird',
    en: 'In-Room Dining',
    ar: 'خدمة الطعام في الغرفة',
    short: 'In-Room Dining',
    staff: 'Carlos',
    supervisor: 'IRD Supervisor',
  },
  {
    id: 'restaurants',
    en: 'Restaurants & Bars',
    ar: 'المطاعم والمقاهي',
    short: 'Restaurants',
    staff: 'Elena',
    supervisor: 'Restaurant Manager',
  },
  {
    id: 'spa',
    en: 'Spa & Wellness',
    ar: 'السبا والعافية',
    short: 'Spa',
    staff: 'Mai',
    supervisor: 'Spa Manager',
  },
  {
    id: 'recreation',
    en: 'Recreation & Beach',
    ar: 'الترفيه والشاطئ',
    short: 'Recreation',
    staff: 'Daniel',
    supervisor: 'Recreation Supervisor',
  },
  {
    id: 'concierge',
    en: 'Concierge & Transport',
    ar: 'الكونسيرج والمواصلات',
    short: 'Concierge',
    staff: 'Youssef',
    supervisor: 'Chief Concierge',
  },
  {
    id: 'security',
    en: 'Security',
    ar: 'الأمن',
    short: 'Security',
    staff: 'Khalid',
    supervisor: 'Security Manager',
  },
  {
    id: 'it',
    en: 'IT & AV',
    ar: 'تقنية المعلومات',
    short: 'IT & AV',
    staff: 'Arjun',
    supervisor: 'IT Manager',
  },
  {
    id: 'dutymanager',
    en: 'Rooms Controller',
    ar: 'مراقب الغرف',
    short: 'Rooms Controller',
    staff: 'Sherif',
    supervisor: 'Rooms Controller',
  },
];

export const DEPT_BY_ID = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d])) as Record<
  DepartmentId,
  DepartmentInfo
>;

/**
 * Response standards in minutes. The first eight come from the brief; laundry,
 * recreation, IT and Rooms Controller are placeholders until the hotel confirms them.
 */
export const DEFAULT_STANDARDS: Standards = {
  ird: { normal: 3 },
  housekeeping: { normal: 5 },
  engineering: { normal: 5, urgent: 2 },
  restaurants: { normal: 10 },
  spa: { normal: 10 },
  concierge: { normal: 5 },
  frontoffice: { normal: 3 },
  security: { normal: 1 },
  laundry: { normal: 10 },
  recreation: { normal: 5 },
  it: { normal: 5 },
  dutymanager: { normal: 3 },
};

export const PLACEHOLDER_STANDARDS: DepartmentId[] = ['laundry', 'recreation', 'it', 'dutymanager'];

export function deptName(id: DepartmentId, lang: 'en' | 'ar' = 'en'): string {
  return lang === 'ar' ? DEPT_BY_ID[id].ar : DEPT_BY_ID[id].en;
}
