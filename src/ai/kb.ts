import type { Knowledge } from '../data/knowledge';

type L = 'en' | 'ar';

export interface KbTopic {
  id: string;
  kw: string[];
  answer: (k: Knowledge, lang: L) => { text: string; sample: boolean };
}

const both = (en: string, ar: string, lang: L) => (lang === 'ar' ? ar : en);

export const KB_TOPICS: KbTopic[] = [
  {
    id: 'checkin',
    kw: [
      'check-in time',
      'check in time',
      'checkin time',
      'check-out time',
      'check out time',
      'checkout time',
      'check-in',
      'check-out',
      'check in',
      'check out',
      'checkout',
      'وقت الدخول',
      'وقت المغادره',
      'تسجيل الدخول',
      'تسجيل الخروج',
      'المغادره',
    ],
    answer: (k, lang) => ({
      sample: !!k.policies.sample,
      text: both(
        `Check-in is from ${k.policies.checkIn} and check-out is at ${k.policies.checkOut}. Late check-out: ${k.policies.lateCheckOut}`,
        `تسجيل الدخول من الساعة ${k.policies.checkIn} والمغادرة الساعة ${k.policies.checkOut}. يمكن طلب تأخير المغادرة حسب التوفر، ويؤكده لك السفير.`,
        lang,
      ),
    }),
  },
  {
    id: 'pets',
    kw: ['pets', 'pet', 'dog', 'cat', 'حيوانات اليفه', 'حيوان اليف', 'كلب', 'قطه'],
    answer: (k, lang) => ({
      sample: !!k.policies.sample,
      text: both(k.policies.pets, 'يسعد السفير بإفادتك بسياسة الحيوانات الأليفة لدينا.', lang),
    }),
  },
  {
    id: 'smoking',
    kw: ['smoking', 'smoke', 'cigarette', 'vape', 'shisha', 'التدخين', 'ادخن', 'سجائر', 'شيشه'],
    answer: (k, lang) => ({
      sample: !!k.policies.sample,
      text: both(k.policies.smoking, 'يُسمح بالتدخين فقط في المناطق الخارجية المخصصة لذلك.', lang),
    }),
  },
  {
    id: 'dress_code',
    kw: ['dress code', 'what to wear', 'dress', 'قواعد اللباس', 'اللبس', 'الملابس المناسبه'],
    answer: (k, lang) => ({
      sample: !!k.policies.sample,
      text: both(
        k.policies.dressCode,
        'اللباس الأنيق غير الرسمي في المطاعم مساءً، وملابس السباحة عند المسبح والشاطئ فقط.',
        lang,
      ),
    }),
  },
  {
    id: 'wifi',
    kw: [
      'wifi password',
      'wi-fi password',
      'wifi',
      'wi-fi',
      'internet',
      'network',
      'الواي فاي',
      'واي فاي',
      'الانترنت',
      'كلمه السر',
    ],
    answer: (k, lang) => ({
      sample: !!k.wifi.sample,
      text: both(
        `Our Wi-Fi network is “${k.wifi.network}”. ${k.wifi.access} ${k.wifi.cost}`,
        `شبكة الواي فاي لدينا هي «${k.wifi.network}». اتصل بالشبكة وسجّل الدخول برقم غرفتك واسم العائلة. الخدمة مجانية للنزلاء.`,
        lang,
      ),
    }),
  },
  {
    id: 'outlets',
    kw: [
      'restaurants',
      'restaurant',
      'opening hours',
      'where can i eat',
      'places to eat',
      'dinner',
      'lunch',
      'المطاعم',
      'مطعم',
      'ساعات العمل',
      'وين اكل',
    ],
    answer: (k, lang) => ({
      sample: k.outlets.some((o) => o.sample),
      text:
        both('Here are our restaurants and bars:\n', 'هذه مطاعمنا ومقاهينا:\n', lang) +
        k.outlets
          .map((o) =>
            lang === 'ar' ? `• ${o.nameAr}: ${o.hours}` : `• ${o.name} (${o.type}): ${o.hours}`,
          )
          .join('\n'),
    }),
  },
  {
    id: 'breakfast',
    kw: ['breakfast', 'الفطور', 'فطور', 'الافطار'],
    answer: (k, lang) => {
      const o = k.outlets.find((x) => x.meals.includes('breakfast'));
      return {
        sample: !!o?.sample,
        text: o
          ? both(
              `Breakfast is served at ${o.name}. ${o.hours.split('·')[0]?.trim()}. You can also order breakfast to your room at any time.`,
              `يُقدَّم الفطور في ${o.nameAr}، ${o.hours.split('·')[0]?.trim()}. ويمكنك أيضاً طلب الفطور إلى غرفتك في أي وقت.`,
              lang,
            )
          : both(
              'Let me check breakfast times with your ambassador.',
              'سأتحقق من مواعيد الفطور مع السفير.',
              lang,
            ),
      };
    },
  },
  {
    id: 'spa',
    kw: ['spa hours', 'spa open', 'spa', 'treatments', 'massage menu', 'السبا', 'سبا'],
    answer: (k, lang) => ({
      sample: !!k.spa.sample,
      text: both(
        `The spa is open ${k.spa.hours}. Treatments include: ${k.spa.treatments.map((t) => t.name).join('; ')}.`,
        `السبا مفتوح ${k.spa.hours}. تشمل العلاجات: ${k.spa.treatments.map((t) => t.nameAr).join('، ')}.`,
        lang,
      ),
    }),
  },
  {
    id: 'gym',
    kw: ['gym', 'fitness', 'classes', 'yoga', 'الجيم', 'النادي الرياضي', 'يوغا'],
    answer: (k, lang) => ({
      sample: !!k.gym.sample,
      text: both(
        `The gym: ${k.gym.hours}. Classes: ${k.gym.classes}.`,
        `النادي الرياضي: مفتوح على مدار الساعة باستخدام بطاقة غرفتك. الحصص: ${k.gym.classes}.`,
        lang,
      ),
    }),
  },
  {
    id: 'sauna',
    kw: ['sauna', 'steam', 'الساونا', 'ساونا', 'البخار'],
    answer: (k, lang) => ({
      sample: !!k.sauna.sample,
      text: both(
        `Sauna and steam room: ${k.sauna.hours}.`,
        `الساونا وغرفة البخار: ${k.sauna.hours}.`,
        lang,
      ),
    }),
  },
  {
    id: 'pool',
    kw: [
      'pool hours',
      'beach hours',
      'pool',
      'beach',
      'swim',
      'المسبح',
      'الشاطئ',
      'البحر',
      'سباحه',
    ],
    answer: (k, lang) => ({
      sample: !!k.pool.sample,
      text: both(
        `${k.pool.hours}. ${k.pool.towels} ${k.pool.cabanas}`,
        `${k.pool.hours}. تتوفر مناشف المسبح والشاطئ عند مكتب المناشف، ويمكن حجز الكابانا عبر الكونسيرج.`,
        lang,
      ),
    }),
  },
  {
    id: 'kids',
    kw: [
      "kids' club",
      'kids club',
      'children',
      'kids',
      'babysitting',
      'نادي الاطفال',
      'الاطفال',
      'اطفال',
    ],
    answer: (k, lang) => ({
      sample: !!k.kidsClub.sample,
      text: both(
        `Our kids' club is open ${k.kidsClub.hours}, for ages ${k.kidsClub.ages} Babysitting: ${k.kidsClub.babysitting}`,
        `نادي الأطفال مفتوح ${k.kidsClub.hours} للأعمار من ٤ إلى ١٢ سنة. تتوفر جليسة أطفال عند الطلب المسبق.`,
        lang,
      ),
    }),
  },
  {
    id: 'activities',
    kw: ['activities', 'activity', "what's on", 'things to do', 'الانشطه', 'نشاطات'],
    answer: (k, lang) => ({
      sample: !!k.activities.sample,
      text: both(
        k.activities.schedule,
        'نضع برنامج الأنشطة اليومي في غرفتك كل مساء: كرة الطائرة الشاطئية، أنشطة الأطفال، ويوغا الغروب.',
        lang,
      ),
    }),
  },
  {
    id: 'transport',
    kw: ['transport', 'getting around', 'parking', 'valet', 'المواصلات', 'مواقف', 'باركينج'],
    answer: (k, lang) => ({
      sample: !!k.transport.sample,
      text: both(
        `${k.transport.options} ${k.transport.parking}`,
        'يرتب الكونسيرج التوصيل من وإلى المطار وسيارات الأجرة والليموزين والسائق الخاص. وتتوفر خدمة صف السيارات عند المدخل الرئيسي.',
        lang,
      ),
    }),
  },
  {
    id: 'ird',
    kw: [
      'room service hours',
      'in-room dining hours',
      'room service',
      'in-room dining',
      'خدمه الغرف',
    ],
    answer: (k, lang) => ({
      sample: !!k.ird.sample,
      text: both(
        `In-room dining is available ${k.ird.hours}. ${k.ird.note}`,
        `خدمة الطعام في الغرفة متاحة ${k.ird.hours === '24 hours' ? 'على مدار الساعة' : k.ird.hours}. يرجى إعلامنا بأي حساسية غذائية.`,
        lang,
      ),
    }),
  },
  {
    id: 'location',
    kw: [
      'where is the hotel',
      'address',
      'location',
      'how many rooms',
      'العنوان',
      'موقع الفندق',
      'كم غرفه',
    ],
    answer: (k, lang) => ({
      sample: false,
      text: both(
        k.meta.rooms
          ? `We are on ${k.meta.location}, with ${k.meta.rooms} rooms and suites.`
          : `We are on ${k.meta.location}.`,
        k.meta.rooms
          ? `يقع الفندق في جزيرة المرجان، رأس الخيمة، الإمارات العربية المتحدة، ويضم ${k.meta.rooms} غرفة وجناحاً.`
          : 'يقع الفندق في جزيرة المرجان، رأس الخيمة، الإمارات العربية المتحدة.',
        lang,
      ),
    }),
  },
  {
    id: 'contact',
    kw: [
      'phone number',
      'contact',
      'call the front desk',
      'reception number',
      'رقم الاستقبال',
      'اتصل',
    ],
    answer: (k, lang) => ({
      sample: !!k.contacts.sample,
      text: both(
        k.contacts.ambassador,
        'اطلب الرقم 0 من هاتف غرفتك، أو استخدم هذه المحادثة.',
        lang,
      ),
    }),
  },
];

/** Topics for each outlet, so "when does the Beach Grill open" is answered precisely. */
export function outletTopics(k: Knowledge): KbTopic[] {
  return k.outlets.map((o) => ({
    id: `outlet:${o.id}`,
    kw: o.kw,
    answer: (_k, lang) => ({
      sample: !!o.sample,
      text: both(
        `${o.name}, ${o.type}. Hours: ${o.hours}. Dress code: ${o.dressCode}.${o.reservations ? ' Reservations are recommended; I can request one for you.' : ''}`,
        `${o.nameAr}. ساعات العمل: ${o.hours}.${o.reservations ? ' ننصح بالحجز المسبق، ويمكنني طلب حجز لك.' : ''}`,
        lang,
      ),
    }),
  }));
}
