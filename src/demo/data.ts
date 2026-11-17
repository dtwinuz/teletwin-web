// Demo-only fixtures: a fictional company ("Orzu Logistika"), its staff, corp chats and their history.
// Everything is invented and every timestamp is relative to `Date.now()`, so the demo never looks stale.
// Loaded only by the demo build (`npm run build:demo`), never by the production bundle.
import type {
  CorpApp, CorpEmployeeInfo, CorpEntity, CorpJiraIssue, CorpMedia, CorpUserGroup,
} from '../teletwin/api';

export const COMPANY = 'Orzu Logistika';
export const DEMO_CORP_SERVER = 'https://tele.orzu.example/';
export const JIRA_BASE_URL = 'https://jira.orzu.example/browse/';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function ago(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

export function ahead(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

export interface DemoEmployee extends CorpEmployeeInfo {
  isActive: boolean;
  isAdmin: boolean;
}

// [login, full name, title, department, admin, active]
const STAFF: [string, string, string, string, boolean, boolean][] = [
  ['d.rahimova', 'Rahimova Dilnoza', 'HR direktori', 'Kadrlar', true, true],
  ['j.toshmatov', 'Toshmatov Jasur', 'Savdo menejeri', 'Savdo', false, true],
  ['a.karimov', 'Karimov Akmal', 'Bosh direktor', 'Rahbariyat', true, true],
  ['n.yusupova', 'Yusupova Nilufar', 'Bosh buxgalter', 'Buxgalteriya', false, true],
  ['s.ergashev', 'Ergashev Sardor', 'IT bo\'lim boshlig\'i', 'IT', true, true],
  ['m.abdullayeva', 'Abdullayeva Madina', 'Marketing menejeri', 'Marketing', false, true],
  ['b.qodirov', 'Qodirov Bekzod', 'Ombor mudiri', 'Logistika', false, true],
  ['g.saidova', 'Saidova Gulnora', 'Buxgalter', 'Buxgalteriya', false, true],
  ['o.nazarov', 'Nazarov Otabek', 'Logist', 'Logistika', false, true],
  ['z.mirzayeva', 'Mirzayeva Zarina', 'Mijozlar bilan ishlash', 'Savdo', false, true],
  ['r.xolmatov', 'Xolmatov Rustam', 'Haydovchi-ekspeditor', 'Logistika', false, true],
  ['f.tursunova', 'Tursunova Feruza', 'Kadrlar inspektori', 'Kadrlar', false, true],
  ['u.alimov', 'Alimov Ulug\'bek', 'Tizim administratori', 'IT', false, true],
  ['sh.rasulova', 'Rasulova Shahnoza', 'Dizayner', 'Marketing', false, true],
  ['i.hamidov', 'Hamidov Islom', 'Savdo vakili', 'Savdo', false, true],
  ['k.usmonova', 'Usmonova Kamola', 'Iqtisodchi', 'Buxgalteriya', false, true],
  ['t.sobirov', 'Sobirov Temur', 'Dispetcher', 'Logistika', false, true],
  ['l.ahmedova', 'Ahmedova Laylo', 'Ofis menejeri', 'Rahbariyat', false, true],
  ['e.rahmonov', 'Rahmonov Elbek', 'Dasturchi', 'IT', false, true],
  ['m.jurayeva', 'Jo\'rayeva Malika', 'Savdo vakili', 'Savdo', false, true],
  ['a.boboyev', 'Boboyev Alisher', 'Xavfsizlik xizmati', 'Xavfsizlik', false, true],
  ['n.sultonov', 'Sultonov Nodir', 'Omborchi', 'Logistika', false, true],
  ['y.tojiyeva', 'Tojiyeva Yulduz', 'Yurist', 'Rahbariyat', false, true],
  ['h.qosimov', 'Qosimov Husan', 'Haydovchi-ekspeditor', 'Logistika', false, true],
  ['d.ismoilova', 'Ismoilova Diyora', 'SMM mutaxassisi', 'Marketing', false, true],
  ['b.normatov', 'Normatov Bobur', 'Savdo vakili', 'Savdo', false, true],
  ['s.valiyeva', 'Valiyeva Sevara', 'Kassir', 'Buxgalteriya', false, true],
  ['j.omonov', 'Omonov Javlon', 'Mexanik', 'Logistika', false, true],
  ['m.xudoyberdiyev', 'Xudoyberdiyev Mansur', 'Logistika direktori', 'Logistika', false, true],
  ['o.karimova', 'Karimova Oydin', 'Stajyor', 'Marketing', false, true],
  ['q.raximov', 'Raximov Qahramon', 'Savdo vakili', 'Savdo', false, false],
  ['v.yoqubova', 'Yoqubova Vazira', 'Buxgalter', 'Buxgalteriya', false, false],
  ['p.mamatov', 'Mamatov Po\'lat', 'Omborchi', 'Logistika', false, false],
  ['x.davronov', 'Davronov Xurshid', 'Dasturchi', 'IT', false, true],
  ['g.ortiqova', 'Ortiqova Gavhar', 'Mijozlar bilan ishlash', 'Savdo', false, true],
  ['a.sharipov', 'Sharipov Anvar', 'Haydovchi-ekspeditor', 'Logistika', false, true],
];

export const DEMO_EMPLOYEE_ID = 2;

// Online now, "last seen" a while ago, custom statuses and one "do not disturb"
const ONLINE_IDS = new Set([1, 3, 4, 5, 7, 9, 10, 13, 15, 17, 19, 20, 29]);
const STATUSES: Record<number, { emoji: string; text: string; untilMs?: number; dndMs?: number }> = {
  3: { emoji: '📅', text: 'Yig\'ilishdaman, 15:00 gacha', untilMs: 2 * HOUR },
  4: { emoji: '📊', text: 'Oy yopilishi — faqat shoshilinch', dndMs: 3 * HOUR },
  6: { emoji: '🏖', text: 'Ta\'tilda, 25-noyabrgacha', untilMs: 6 * DAY },
  11: { emoji: '🚚', text: 'Yo\'ldaman: Toshkent — Samarqand', untilMs: 5 * HOUR },
  13: { emoji: '🛠', text: 'Navbatchi administrator' },
  16: { emoji: '🤒', text: 'Kasal, uydan ishlayapman', untilMs: DAY },
  23: { emoji: '⚖️', text: 'Sudda, 14:00 dan keyin', untilMs: 3 * HOUR },
  29: { emoji: '🏗', text: 'Chirchiq omborida', untilMs: 4 * HOUR },
};

function buildPhone(index: number) {
  const block = String(100 + index * 23).slice(0, 3);
  const end = String(40 + index * 3).slice(-2);

  return `+998 9${index % 10} ${block}-${String(10 + index).slice(-2)}-${end}`;
}

function buildBirthday(index: number) {
  if (index === 6) return `1986-${new Date(Date.now() + 2 * DAY).toISOString().slice(5, 10)}`;
  const month = String(((index * 7) % 12) + 1).padStart(2, '0');
  const day = String(((index * 11) % 27) + 1).padStart(2, '0');

  return `${1978 + ((index * 3) % 24)}-${month}-${day}`;
}

export function makeEmployees(): DemoEmployee[] {
  return STAFF.map(([login, fullName, title, department, isAdmin, isActive], index) => {
    const id = index + 1;
    const status = STATUSES[id];

    return {
      id,
      login,
      fullName,
      isAdmin,
      isActive,
      title,
      department,
      phone: index % 5 === 3 ? undefined : buildPhone(index),
      birthday: index % 6 === 5 ? undefined : buildBirthday(index),
      workHours: { days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', tz: 'Asia/Tashkent' },
      isOnline: ONLINE_IDS.has(id),
      lastSeenAt: ONLINE_IDS.has(id) ? undefined : ago(((id * 37) % 300) * MINUTE + 4 * MINUTE),
      statusEmoji: status?.emoji,
      statusText: status?.text,
      statusUntil: status?.untilMs ? ahead(status.untilMs) : undefined,
      dndUntil: status?.dndMs ? ahead(status.dndMs) : undefined,
    };
  });
}

export const KIND_GROUP = 1;
export const KIND_CHANNEL = 2;
export const KIND_DIRECT = 3;

export interface DemoChat {
  id: number;
  title: string;
  kind: number;
  memberIds: number[];
  adminIds: number[];
  postIds?: number[];
  isPublic: boolean;
  description: string;
}

function selectDepartment(employees: DemoEmployee[], ...departments: string[]) {
  return employees.filter((e) => e.isActive && departments.includes(e.department!)).map((e) => e.id);
}

export function makeChats(employees: DemoEmployee[]): DemoChat[] {
  const all = employees.filter((e) => e.isActive).map((e) => e.id);
  const raw: Omit<DemoChat, 'id'>[] = [
    {
      title: 'Umumiy e\'lonlar',
      kind: KIND_CHANNEL,
      memberIds: all,
      adminIds: [1, 3, 18],
      isPublic: false,
      description: 'Rahbariyat va HR e\'lonlari. Faqat adminlar yozadi.',
    },
    {
      title: 'Savdo bo\'limi',
      kind: KIND_GROUP,
      memberIds: [...selectDepartment(employees, 'Savdo'), 3],
      adminIds: [2],
      isPublic: false,
      description: 'Buyurtmalar, mijozlar, kunlik reja',
    },
    {
      title: 'Buxgalteriya',
      kind: KIND_GROUP,
      memberIds: [...selectDepartment(employees, 'Buxgalteriya'), 3, 2],
      adminIds: [4],
      isPublic: false,
      description: 'Hisob-faktura, to\'lovlar, oylik hisobot',
    },
    {
      title: 'Toshkent ombori',
      kind: KIND_GROUP,
      memberIds: [...selectDepartment(employees, 'Logistika'), 2],
      adminIds: [7, 29],
      isPublic: false,
      description: 'Sergeli, 7-ombor: kirim-chiqim, qoldiq',
    },
    {
      title: 'IT yordam',
      kind: KIND_GROUP,
      memberIds: all,
      adminIds: [5, 13],
      isPublic: true,
      description: 'Kompyuter, printer, VPN, parol — shu yerga yozing',
    },
    {
      title: 'Loyiha: Chirchiq ombori',
      kind: KIND_GROUP,
      memberIds: [3, 5, 7, 29, 23, 4, 2, 9],
      adminIds: [29],
      isPublic: false,
      description: 'Yangi ombor qurilishi va jihozlash. Jira: CHIR',
    },
    {
      title: 'Marketing',
      kind: KIND_GROUP,
      memberIds: [...selectDepartment(employees, 'Marketing'), 2],
      adminIds: [6],
      isPublic: false,
      description: 'Kontent reja, reklama, ko\'rgazmalar',
    },
    {
      title: 'Bayramlar va tabriklar',
      kind: KIND_CHANNEL,
      memberIds: all,
      adminIds: [1, 12],
      isPublic: true,
      description: 'Tug\'ilgan kunlar, bayram tabriklari, korporativ tadbirlar',
    },
    {
      title: 'Reyslar: Toshkent — Samarqand',
      kind: KIND_GROUP,
      memberIds: [9, 11, 17, 24, 29, 36, 2],
      adminIds: [17],
      isPublic: false,
      description: 'Kunlik reyslar, yuk xatlari, yo\'l holati',
    },
    {
      title: 'Mijozlar xizmati',
      kind: KIND_GROUP,
      memberIds: [2, 10, 15, 20, 26, 35, 1],
      adminIds: [10],
      isPublic: false,
      description: 'Shikoyatlar, qaytarishlar, qo\'ng\'iroqlar',
    },
    {
      title: 'Tushlik',
      kind: KIND_GROUP,
      memberIds: all.filter((id) => id % 3 !== 0),
      adminIds: [18],
      isPublic: true,
      description: 'Bugun nima yeymiz? Buyurtma 11:30 gacha',
    },
    {
      title: 'Xavfsizlik',
      kind: KIND_CHANNEL,
      memberIds: all,
      adminIds: [21, 5],
      isPublic: false,
      description: 'Fishing ogohlantirishlari, ofisga kirish qoidalari',
    },
    {
      title: 'Sport klubi',
      kind: KIND_GROUP,
      memberIds: [2, 5, 9, 13, 15, 19, 21, 25, 30, 34, 36],
      adminIds: [15],
      isPublic: true,
      description: 'Shanba kuni futbol, 9:00',
    },
    // Public chats the demo employee has not joined yet: the "Kanallar katalogi" offers them
    {
      title: 'Kitobxonlar klubi',
      kind: KIND_GROUP,
      memberIds: [1, 6, 12, 14, 18, 23, 25, 30],
      adminIds: [12],
      isPublic: true,
      description: 'Oyiga bitta kitob, juma kuni muhokama',
    },
    {
      title: 'Ingliz tili kursi',
      kind: KIND_GROUP,
      memberIds: [5, 6, 10, 13, 19, 20, 24, 34, 35],
      adminIds: [6],
      isPublic: true,
      description: 'Seshanba va payshanba 18:30, 2-qavat',
    },
    {
      title: 'Texnika yangiliklari',
      kind: KIND_CHANNEL,
      memberIds: [5, 13, 19, 34],
      adminIds: [5],
      isPublic: true,
      description: 'IT bo\'limidan: yangi qurilmalar, xavfsizlik yangilanishlari',
    },
    // Company DMs of the demo employee
    {
      title: '', kind: KIND_DIRECT, memberIds: [2, 1], adminIds: [], isPublic: false, description: '',
    },
    {
      title: '', kind: KIND_DIRECT, memberIds: [2, 4], adminIds: [], isPublic: false, description: '',
    },
    {
      title: '', kind: KIND_DIRECT, memberIds: [2, 7], adminIds: [], isPublic: false, description: '',
    },
    {
      title: '', kind: KIND_DIRECT, memberIds: [2, 3], adminIds: [], isPublic: false, description: '',
    },
    {
      title: '', kind: KIND_DIRECT, memberIds: [2, 10], adminIds: [], isPublic: false, description: '',
    },
    {
      title: '', kind: KIND_DIRECT, memberIds: [2, 13], adminIds: [], isPublic: false, description: '',
    },
  ];

  return raw.map((chat, index) => ({ ...chat, id: index + 1, memberIds: [...new Set(chat.memberIds)] }));
}

// ---- conversation scripts ----

export interface DemoPollSeed {
  question: string;
  options: [string, number[]][];
  isAnonymous?: boolean;
  isMultiple?: boolean;
  closesInMs?: number;
  isClosed?: boolean;
}

export interface DemoLine {
  from: number;
  text: string;
  // Reply to the line this many steps back
  reply?: number;
  reactions?: Record<string, number[]>;
  media?: DemoMediaSeed;
  pin?: boolean;
  edited?: boolean;
  poll?: DemoPollSeed;
  thread?: [number, string][];
  forward?: { senderName: string; fromChatId?: number };
  entities?: CorpEntity[];
}

export type DemoMediaSeed = Omit<CorpMedia, 'fileId'> & { file: string; label?: string; colors?: [string, string] };

type ScriptLine = DemoLine | [number, string];

const ME = DEMO_EMPLOYEE_ID;

const SCRIPTS: Record<number, ScriptLine[]> = {
  1: [
    [3, 'Hurmatli hamkasblar! Dushanbadan boshlab ish vaqti 9:00 — 18:00. Tushlik 13:00 — 14:00.'],
    [1, 'Yillik tibbiy ko\'rik 25-noyabrgacha. Ro\'yxat HR bo\'limida, navbatni Tursunova Feruzaga yozdiring.'],
    {
      from: 3,
      text: '3-chorak natijalari: yuk aylanmasi +18%, kechikkan reyslar 4% dan 1,6% ga tushdi. Hammaga rahmat!',
      reactions: { '👍': [1, 2, 4, 5, 7, 9, 10, 13, 15, 17], '🔥': [6, 14, 19, 24, 25], '👏': [12, 18, 20, 29] },
      media: {
        file: 'q3-report', kind: 'photo', mime: 'image/jpeg', width: 1280, height: 720, label: '3-chorak: +18%',
        colors: ['#2a5bd7', '#5ec4ff'],
      },
    },
    [18, 'Ofisga yangi kofe mashinasi o\'rnatildi (3-qavat). Iltimos, kapsulalarni alohida qutiga tashlang.'],
    [1, 'Yangi xodimlarni kutib oling: Karimova Oydin (Marketing, stajyor) va Davronov Xurshid (IT, dasturchi).'],
    {
      from: 3,
      text: 'Ertaga soat 10:00 da umumiy yig\'ilish, katta zalda. Kun tartibi: yil yakuni, Chirchiq ombori, bonuslar.',
      pin: true,
      reactions: { '👍': [2, 4, 7, 9, 13, 15, 20] },
    },
    [1, 'Dekabr oyi oyligi 10-dekabrda, avans 25-noyabrda o\'tkaziladi.'],
    {
      from: 1,
      text: 'Yil yakuni korporativ tadbiri qayerda bo\'lsin?',
      poll: {
        question: 'Yil yakuni korporativ tadbiri qayerda bo\'lsin?',
        options: [
          ['Chorvoq, dam olish maskani', [2, 5, 7, 9, 13, 15, 19, 24, 29, 34]],
          ['Shahar ichida, restoran', [4, 8, 10, 12, 16, 18, 20, 27]],
          ['Ofisda, kechki bayram', [11, 14, 22]],
        ],
        isAnonymous: true,
        closesInMs: 3 * DAY,
      },
    },
    [18, 'Juma kuni ofis 17:00 da yopiladi: elektr tarmog\'ida profilaktika ishlari.'],
    {
      from: 1,
      text: 'Eslatma: ish yozishmalarini shaxsiy Telegram guruhlarida olib bormang. Korxona ma\'lumoti '
        + 'korxona serverida qoladi: xodim ketganda bir tugma bilan uziladi.',
      reactions: { '👍': [3, 5, 13, 21], '🙏': [2, 12] },
    },
  ],
  2: [
    [ME, 'Assalomu alaykum! Bugungi reja: 14 ta yetkazib berish, 3 ta yangi shartnoma.'],
    [15, '"Baraka Market" 120 quti buyurtma berdi, hisob-fakturani kim chiqaradi?'],
    { from: ME, text: 'Men chiqaraman, Faktura\'da 15 daqiqada tayyor bo\'ladi.', reply: 1 },
    {
      from: 20, text: 'Chilonzordagi mijoz to\'lovni ertaga o\'tkazishini aytdi, 48 500 000 so\'m.',
      reactions: { '👍': [ME, 3] },
    },
    [26, 'Yangi narx ro\'yxati qachon kuchga kiradi?'],
    {
      from: ME,
      text: '1-dekabrdan. PDF shu yerda.',
      reply: 1,
      pin: true,
      media: {
        file: 'prices', kind: 'document', mime: 'application/pdf', size: 248_312, fileName: 'Narxlar_dekabr_2026.pdf',
      },
    },
    {
      from: 3,
      text: 'Noyabr rejasi 82% bajarildi. Oxirgi haftada bosim beramiz, ishonaman sizlarga.',
      reactions: { '💪': [ME, 15, 20, 26, 35], '🔥': [10] },
      thread: [
        [15, 'Qolgan 18% uchun 3 ta yirik mijoz bor, ertaga uchrashaman.'],
        [ME, 'Men "Yashil Vodiy" bilan shartnomani tezlashtiraman.'],
        [20, 'Andijon yo\'nalishini men olaman.'],
        [3, 'Zo\'r. Juma kuni natijani ko\'ramiz.'],
      ],
    },
    [10, '"Orient Savdo" qaytarish so\'radi: 6 quti shikastlangan. Rasmlar mijozlar xizmati chatida.'],
    { from: 15, text: 'Samarqanddagi distribyutor bilan uchrashuv payshanba 11:00 ga ko\'chdi.', edited: true },
    { from: ME, text: '@savdo bugun 17:00 gacha CRM\'dagi kartochkalarni yangilab qo\'yinglar.' },
    { from: 20, text: 'Bajarildi ✅ 9 ta kartochka yangilandi.', reply: 1, reactions: { '👍': [ME] } },
    {
      from: 35,
      text: 'Navoiy yo\'nalishi bo\'yicha tijoriy taklif tayyor, ko\'rib chiqasizmi?',
      media: {
        file: 'offer',
        kind: 'document',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 64_820, fileName: 'Taklif_Navoiy_Orzu.docx',
      },
    },
    { from: ME, text: 'Ha, tushlikdan keyin qarayman.', reply: 1 },
    [15, 'Yangi mijoz: "Yashil Vodiy" MChJ, oyiga ~300 quti. Shartnoma loyihasi yuristda.'],
    {
      from: 26,
      text: '@j.toshmatov "Yashil Vodiy" uchun chegirma 5% bo\'ladimi yoki 7%? Mijoz bugun javob kutyapti.',
      entities: [{ type: 'mentionName', offset: 0, length: 12, employeeId: ME }],
    },
    {
      from: 15,
      text: 'Ovozli xabar: mijoz bilan gaplashuv natijasi',
      media: { file: 'voice-1', kind: 'voice', mime: 'audio/wav', duration: 9, size: 72_000 },
    },
  ],
  3: [
    [4, 'Hamkasblar, oy yopilishi 3-dekabr. Hamma avans hisobotlarini 1-dekabrgacha topshiring.'],
    [8, 'Noyabr uchun 37 ta hisob-faktura imzolandi, 2 tasi kontragent tomonidan rad etildi.'],
    { from: 4, text: 'Rad etilganlarning sababi nima?', reply: 1 },
    { from: 8, text: 'Bittasida STIR xato, ikkinchisida narx kelishilmagan. Bugun qayta yuboraman.', reply: 1 },
    {
      from: 16,
      text: 'Yoqilg\'i xarajati oktabrga nisbatan 6% kamaydi, hisobot ilovada.',
      media: {
        file: 'fuel', kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 41_204, fileName: 'Yoqilgi_noyabr.xlsx',
      },
      reactions: { '👍': [4, 3] },
    },
    [27, 'Kassa qoldig\'i: 12 340 000 so\'m, inkassatsiya soat 16:00 da.'],
    [4, 'QQS deklaratsiyasini 20-sanagacha topshirishimiz kerak, Kamola, sen tayyorlaysanmi?'],
    { from: 16, text: 'Ha, payshanbagacha qoralama tayyor bo\'ladi.', reply: 1 },
    [ME, 'Nilufar opa, "Baraka Market" hisob-fakturasini yubordim, ko\'rib qo\'ying.'],
    { from: 4, text: 'Ko\'rdim, hammasi to\'g\'ri 👍', reply: 1, reactions: { '🙏': [ME] } },
  ],
  4: [
    [7, 'Bugungi kirim: 3 ta fura, jami 46 palet. Rampa 2 va 3 band.'],
    {
      from: 22,
      text: '7-qatorda 4 palet shikastlangan qadoq bilan keldi, akt tuzdim.',
      media: {
        file: 'pallets', kind: 'photo', mime: 'image/jpeg', width: 1080, height: 1080, label: '7-qator, 4 palet',
        colors: ['#8a5a2b', '#e0b070'],
      },
    },
    [9, 'Soat 15:00 dagi Andijon reysiga 18 palet tayyorlab qo\'yinglar.'],
    { from: 7, text: 'Tayyor. Yuk xati raqami 2026/1187.', reply: 1 },
    [29, 'Qoldiq bo\'yicha haftalik hisobot juma kuni 12:00 gacha kerak.'],
    [22, 'Forklift №2 yana moy oqizyapti, Javlon ko\'rib bersin.'],
    { from: 28, text: 'Ertalab qarayman, bugun 3-forklift bilan ishlang.', reply: 1 },
    { from: 7, text: 'Inventarizatsiya 30-noyabr, shanba. Hamma ishda bo\'ladi.', pin: true },
    [9, 'Termiz yo\'nalishi uchun sovutgichli mashina kerak, kim biladi bo\'shi bormi?'],
    { from: 17, text: 'Ertaga 10:00 dan keyin 01 A 345 BC bo\'shaydi.', reply: 1 },
    [ME, 'Bekzod aka, "Yashil Vodiy" uchun 40 quti zaxirada qoldiring iltimos.'],
    { from: 7, text: 'Qoldirdim, 4-qator, B bo\'lim.', reply: 1, reactions: { '🙏': [ME] } },
  ],
  5: [
    [13, 'Printer 3-qavatda qayta ishga tushirildi, endi ishlayapti.'],
    [25, 'VPN ulanmayapti, "auth failed" chiqyapti.'],
    { from: 13, text: 'Parolingiz muddati tugagan, havola yubordim — yangilab qayta urinib ko\'ring.', reply: 1 },
    { from: 25, text: 'Ishladi, rahmat!', reply: 1, reactions: { '👍': [13] } },
    {
      from: 5,
      text: 'Shanba kuni 22:00 — 23:00 server texnik xizmat. Faktura va 1C bir soat ishlamaydi.',
      pin: true,
      reactions: { '👌': [2, 4, 7, 13] },
    },
    [30, 'Yangi noutbukka TeleTwin\'ni qanday o\'rnataman?'],
    {
      from: 19,
      text: 'Windows versiyasini IT\'dan oling, login va parolni HR beradi.',
      reply: 1,
      thread: [
        [30, 'Mac uchun ham bormi?'],
        [19, 'Ha, macOS (arm64 va x64) va Linux ham bor.'],
        [30, 'O\'rnatdim, ishladi 👍'],
      ],
    },
    [12, 'Kadrlar bo\'limidagi skaner hujjatni PDF qilmayapti.'],
    { from: 13, text: 'Drayverni yangiladim, endi ishlashi kerak.', reply: 1 },
    [5, 'Eslatma: IT hech qachon parolingizni so\'ramaydi. Shunday xabar kelsa — @xavfsizlik ga yozing.'],
    [34, 'GitLab\'dagi pipeline 2 marta yiqildi, runner diskida joy qolmagan ekan, tozaladim.'],
  ],
  6: [
    [29, 'Chirchiq ombori: poydevor 100%, karkas 70%. Batafsil CHIR-142 da.'],
    { from: 5, text: 'Server xonasi uchun konditsioner va UPS buyurtma qilindi (CHIR-151).' },
    {
      from: 7,
      text: 'Javonlar yetkazib beruvchisi bilan shartnoma imzolandi, 3 hafta ichida keladi.',
      media: {
        file: 'site', kind: 'photo', mime: 'image/jpeg', width: 1280, height: 853, label: 'Chirchiq: karkas 70%',
        colors: ['#3d6b4f', '#a7d7a0'],
      },
      reactions: { '🔥': [3, 29, ME] },
    },
    [4, '1-bosqich xarajati smetadan 3% kam chiqdi.'],
    [23, 'Yer uchastkasi hujjatlari kadastrda ro\'yxatdan o\'tdi (CHIR-137 yopildi).'],
    { from: 3, text: 'Ochilish sanasi — 15-yanvar. Kechiktirmaylik.', pin: true },
    [9, 'Kirish yo\'lini asfaltlash 2 kunga cho\'zildi, yomg\'ir sababli. CHIR-155 ochdim.'],
    {
      from: ME,
      text: 'Chirchiq omboridan viloyat mijozlariga yetkazish 40% tezlashadi, mijozlarga aytsam bo\'ladimi?',
      thread: [
        [3, 'Ochilgandan keyin e\'lon qilamiz.'],
        [29, 'Yanvar boshida aniq sanani beraman.'],
      ],
    },
    {
      from: 29,
      text: 'Ochilish marosimini qaysi kunga qo\'yamiz?',
      poll: {
        question: 'Ochilish marosimi qaysi kuni?',
        options: [['15-yanvar, payshanba', [3, 4, 29, 23]], ['17-yanvar, shanba', [5, 7, 9]]],
        isMultiple: false,
      },
    },
  ],
  7: [
    [6, 'Dekabr kontent rejasi tayyor: 12 post, 4 reels, 1 ta mijoz hikoyasi.'],
    {
      from: 14,
      text: 'Yangi bannerlar 2 xil variantda, qaysi biri ma\'qul?',
      media: {
        file: 'banner', kind: 'photo', mime: 'image/jpeg', width: 1200, height: 628, label: 'Orzu Logistika — banner A',
        colors: ['#ff7a45', '#ffd166'],
      },
    },
    {
      from: 24, text: 'Instagram\'da oxirgi post 18 ming ko\'rish, eng yaxshi natija 🔥',
      reactions: { '🔥': [6, 14, ME] },
    },
    [6, '"Logistika Expo" ko\'rgazmasiga stend 3x3 tasdiqlandi.'],
    [30, 'Stend uchun broshyura matnini yozib bo\'ldim, tekshirib bering.'],
    [ME, 'Savdo uchun 200 ta yangi vizitka kerak, buyurtma qilasizmi?'],
    { from: 6, text: 'Ha, payshanbaga tayyor bo\'ladi.', reply: 1 },
    [14, 'Logotipning yangi qora-oq varianti brendbukka qo\'shildi.'],
  ],
  8: [
    {
      from: 1,
      text: 'Ikki kundan keyin Qodirov Bekzod akaning tug\'ilgan kuni! 🎉 Sovg\'a uchun yig\'ilyapmiz.',
      reactions: { '🎉': [2, 3, 4, 9, 12, 17, 22, 29], '❤️': [8, 18] },
    },
    [12, 'Navro\'z tadbiri uchun ko\'ngillilar ro\'yxati ochildi.'],
    {
      from: 1,
      text: 'Futbol bo\'yicha korporativ turnirda jamoamiz 2-o\'rinni oldi 🏆',
      media: {
        file: 'football', kind: 'photo', mime: 'image/jpeg', width: 1280, height: 960, label: 'Turnir: 2-o\'rin 🏆',
        colors: ['#0f7b3f', '#76d68a'],
      },
      reactions: { '🏆': [2, 5, 9, 13, 15], '👏': [3, 4] },
    },
    [12, 'Yangi yil bayramiga bolalar uchun sovg\'alar ro\'yxatini 15-dekabrgacha yozib qoldiring.'],
  ],
  9: [
    [17, 'Bugun 4 ta reys: 06:00, 09:30, 13:00, 17:30.'],
    [11, '06:00 reysi yo\'lga chiqdi, 01 A 345 BC, 18 palet.'],
    [24, 'Jizzax postida tekshiruv, 20 daqiqa kechikaman.'],
    { from: 17, text: 'Qabul qildim, mijozga xabar berdim.', reply: 1 },
    {
      from: 36,
      text: 'Samarqandga yetib keldim, tushirish boshlandi.',
      media: {
        file: 'truck', kind: 'photo', mime: 'image/jpeg', width: 1080, height: 1350, label: 'Samarqand, tushirish',
        colors: ['#1d3557', '#a8dadc'],
      },
    },
    [9, 'Ertangi 09:30 reysi uchun yuk xati tayyor, raqami 2026/1192.'],
    [11, 'Yo\'lda tuman bor, tezlikni kamaytirdik. Hammasi joyida.'],
    [17, 'Yoqilg\'i kartalari yangilandi, eski kartalar 1-dekabrdan ishlamaydi.'],
    [ME, 'Samarqanddagi "Registon Savdo" ertalab 8:00 gacha yuk kutyapti, iloji bormi?'],
    { from: 17, text: '06:00 reysiga qo\'shamiz.', reply: 1, reactions: { '👍': [ME] } },
  ],
  10: [
    [10, 'Bugun 23 ta qo\'ng\'iroq, 2 ta shikoyat, ikkalasi hal qilindi.'],
    {
      from: 20,
      text: '"Orient Savdo" — 6 quti shikastlangan, rasmlar qo\'shildi. Qaytarishni rasmiylashtiramizmi?',
      media: {
        file: 'damaged', kind: 'photo', mime: 'image/jpeg', width: 1080, height: 810, label: 'Shikastlangan qadoq',
        colors: ['#6d597a', '#eaac8b'],
      },
    },
    { from: 1, text: 'Ha, aktni ombor bilan birga tuzing.', reply: 1 },
    [35, 'Mijoz yetkazib berish vaqtini SMS orqali bilishni so\'rayapti.'],
    { from: ME, text: 'Bu yaxshi g\'oya, IT bilan gaplashaman.', reply: 1 },
    [15, 'Yangi mijozlar uchun salomlashish skriptini yangiladim, sharhlaringizni kutaman.'],
    { from: 26, text: 'Qo\'ng\'iroq markazi shanba kuni ham 10:00 — 15:00 ishlaydi.', pin: true },
  ],
  11: [
    [18, 'Bugungi menyu: osh, mastava, salat. Buyurtma 11:30 gacha!'],
    {
      from: 18,
      text: 'Bugun nima olasiz?',
      poll: {
        question: 'Bugungi tushlik',
        options: [['Osh', [ME, 19, 34, 7, 9, 11, 13]], ['Mastava', [14, 22, 25]], ['Salat', [14, 25, 10, 20]]],
        isMultiple: true,
      },
    },
    [ME, 'Osh, bitta 🙋‍♂️'],
    [14, 'Mastava + salat'],
    [25, 'Bugun dietadaman, faqat salat 😅'],
    { from: 18, text: 'Jami: 14 osh, 6 mastava, 9 salat. Soat 13:00 da oshxonada.', reactions: { '😋': [ME, 9, 19] } },
    [9, 'Ertaga shashlik bo\'lsa yaxshi bo\'lardi 😄'],
  ],
  12: [
    {
      from: 21,
      text: 'Diqqat: "Soliq qo\'mitasi" nomidan soxta xatlar kelmoqda. Havolani ochmang, IT\'ga xabar bering.',
      pin: true,
      reactions: { '👍': [2, 5, 13] },
    },
    [5, '2 bosqichli autentifikatsiyani 1-dekabrgacha hamma yoqishi shart.'],
    [21, 'Ofisga kirish kartasini yo\'qotsangiz, darhol xavfsizlik xizmatiga xabar bering.'],
    [5, 'Eslatma: korxona chatlarini skrinshot qilib tashqi guruhlarga yubormang.'],
  ],
  13: [
    [15, 'Shanba 9:00, "Bunyodkor" mini-maydoni. Kim keladi?'],
    [ME, 'Men bor ⚽'],
    [9, 'Men ham'],
    [13, 'Bu safar darvozabon men 😄'],
    { from: 30, text: 'Oxirgi o\'yin hisobi 5:3, revansh kerak!', reactions: { '😂': [ME, 9, 13] } },
    [15, '10 kishi bo\'ldik, 2 jamoa tayyor.'],
  ],
  14: [
    [12, 'Noyabr kitobi: "O\'tkan kunlar". Juma 18:00 da muhokama.'],
    [6, 'Men 3-bobdaman, ulgurishga harakat qilaman 📚'],
  ],
  15: [
    [6, 'Bugungi mavzu: business e-mail. Uy vazifasi — mijozga xat.'],
    [20, 'Keyingi dars payshanbami?'],
  ],
  16: [
    [5, 'Windows yangilanishini shu hafta hamma kompyuterlarga o\'rnatamiz.'],
    [13, 'Yangi printerlar keldi: 2-qavat va 4-qavat.'],
  ],
  17: [
    [1, 'Jasur, assalomu alaykum. Mehnat ta\'tili arizangizni oldim.'],
    { from: ME, text: 'Vaalaykum assalom! Rahmat, 20-dekabrdan 10 kun.', reply: 1 },
    [1, 'Tasdiqlandi. Ketishdan oldin ishlarni Hamidov Islomga topshirasiz.'],
    { from: ME, text: 'Albatta, topshiriq ro\'yxatini tayyorlab qo\'yaman.', reactions: { '👍': [1] } },
    {
      from: 1,
      text: 'Ta\'til buyrug\'i shu yerda, imzolab qaytaring.',
      media: {
        file: 'leave-order', kind: 'document', mime: 'application/pdf', size: 118_400,
        fileName: 'Buyruq_tatil_Toshmatov.pdf',
      },
    },
  ],
  18: [
    [4, 'Jasur, "Baraka Market" to\'lovi tushdimi?'],
    { from: ME, text: 'Ha, bugun ertalab: 37 200 000 so\'m.', reply: 1 },
    [4, 'Zo\'r, rahmat. Akt sverkani juma kungacha yuboring.'],
    [ME, 'Yuboraman.'],
  ],
  19: [
    [ME, 'Bekzod aka, ertaga "Yashil Vodiy" uchun yuklash soat nechada?'],
    { from: 7, text: '8:30 da, 2-rampa.', reply: 1 },
    {
      from: 7,
      text: 'Ovozli xabar',
      media: { file: 'voice-2', kind: 'voice', mime: 'audio/wav', duration: 6, size: 48_000 },
    },
    [ME, 'Tushundim, haydovchiga aytaman.'],
  ],
  20: [
    [3, 'Jasur, dekabr rejasini juma kungi yig\'ilishga tayyorlang.'],
    { from: ME, text: 'Tayyorlayapman, payshanba kechgacha yuboraman.', reply: 1 },
    [3, 'Yangi mijozlar bo\'yicha alohida slayd qo\'shing.'],
  ],
  21: [
    [10, 'Jasur, "Orient Savdo" menejeri sizga qo\'ng\'iroq qilmoqchi.'],
    [ME, 'Raqamimni bering, 15:00 dan keyin bo\'shman.'],
    { from: 10, text: 'Berdim 👍', reply: 1 },
    [10, '"Orient Savdo" yana 50 quti so\'rayapti, narxni siz tasdiqlaysizmi?'],
  ],
  22: [
    [ME, 'Ulug\'bek, yangi noutbukda VPN sozlab berasizmi?'],
    { from: 13, text: 'Ha, 14:00 da kabinetingizga boraman.', reply: 1 },
    [13, 'Tayyor ✅ VPN va TeleTwin o\'rnatildi.'],
  ],
};

export function normalizeLine(line: ScriptLine): DemoLine {
  return Array.isArray(line) ? { from: line[0], text: line[1] } : line;
}

export function getScript(chatId: number) {
  return (SCRIPTS[chatId] || []).map(normalizeLine);
}

// Lines the simulated colleagues "type" while the demo is open (fake realtime hub): [chat id, sender id, text]
export const LIVE_LINES: [number, number, string][] = [
  [2, 15, 'Hozir "Baraka Market" bilan gaplashdim, 30 quti qo\'shimcha so\'rashdi.'],
  [21, 10, 'Jasur, mijoz narxni tasdiqlashingizni kutyapti 🙏'],
  [4, 7, 'Andijon reysi yuklandi, 18 palet ✅'],
  [9, 11, '13:00 reysi yo\'lda, Sirdaryo postidan o\'tdik.'],
  [11, 18, 'Eslatma: buyurtma 11:30 gacha! 🍲'],
  [2, 20, 'To\'lov tushdi ✅ 48 500 000 so\'m.'],
  [5, 13, 'Monitor kabelini 2-qavatdagi omborga qo\'yib ketdim, kerak bo\'lsa oling.'],
  [6, 29, 'Bugun karkas 75% ga yetdi 🏗'],
];

export function makeGroups(employees: DemoEmployee[]): CorpUserGroup[] {
  return [
    { id: 1, handle: 'savdo', name: 'Savdo bo\'limi', memberIds: selectDepartment(employees, 'Savdo') },
    { id: 2, handle: 'buxgalteriya', name: 'Buxgalteriya', memberIds: selectDepartment(employees, 'Buxgalteriya') },
    { id: 3, handle: 'ombor', name: 'Toshkent ombori', memberIds: [7, 22, 28, 9] },
    { id: 4, handle: 'haydovchilar', name: 'Haydovchi-ekspeditorlar', memberIds: [11, 24, 36] },
    { id: 5, handle: 'it', name: 'IT xizmati', memberIds: selectDepartment(employees, 'IT') },
    { id: 6, handle: 'rahbarlar', name: 'Bo\'lim rahbarlari', memberIds: [1, 3, 4, 5, 6, 7, 29] },
    { id: 7, handle: 'xavfsizlik', name: 'Xavfsizlik xizmati', memberIds: [21, 5] },
  ];
}

export function makeApps(): CorpApp[] {
  return [
    { id: 'lunch', icon: '🍲', title: 'Tushlik', url: 'lunch' },
    { id: 'leave', icon: '🌴', title: 'Ta\'til arizasi', url: 'leave' },
    { id: 'stock', icon: '📦', title: 'Ombor qoldig\'i', url: 'stock' },
    { id: 'invoices', icon: '🧾', title: 'Hisob-fakturalar', url: 'invoices' },
    { id: 'fleet', icon: '🚚', title: 'Avtopark (GPS)', url: 'fleet' },
    { id: 'kpi', icon: '📈', title: 'KPI panel', url: 'kpi' },
  ];
}

export const JIRA_ISSUES: Record<string, Omit<CorpJiraIssue, 'key' | 'url'>> = {
  'CHIR-137': {
    summary: 'Yer uchastkasi hujjatlarini kadastrda ro\'yxatdan o\'tkazish', status: 'Bajarildi',
    statusCategory: 'done', assignee: 'Tojiyeva Yulduz', priority: 'High', type: 'Task',
  },
  'CHIR-142': {
    summary: 'Ombor karkasini qurish (2-bosqich)', status: 'Jarayonda',
    statusCategory: 'indeterminate', assignee: 'Xudoyberdiyev Mansur', priority: 'Highest', type: 'Epic',
  },
  'CHIR-151': {
    summary: 'Server xonasi: konditsioner va UPS o\'rnatish', status: 'Kutilmoqda',
    statusCategory: 'new', assignee: 'Ergashev Sardor', priority: 'Medium', type: 'Task',
  },
  'CHIR-155': {
    summary: 'Kirish yo\'lini asfaltlash kechikmoqda', status: 'Jarayonda',
    statusCategory: 'indeterminate', assignee: 'Nazarov Otabek', priority: 'High', type: 'Bug',
  },
};
