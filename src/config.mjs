export const project = {
  id: "terra-phuket-demo",
  version: "2.0",
  name: "terra",
  location: "Пхукет, Таиланд",
  currency: "USD",
  dataVersion: "demo-2026-10-20",
  demo: true,
};

export const districts = {
  bangtao: "Банг Тао",
  rawai: "Раваи",
  kamala: "Камала",
};
export const emptyAnswers = {
  budget: null,
  rooms: null,
  district: null,
  goal: null,
  handover: null,
};
const baseQuestions = [
  {
    id: "budget",
    short: "Бюджет",
    title: "Какой бюджет рассматриваете?",
    hint: "Стоимость объекта в долларах США",
    options: [
      {
        value: "150000",
        title: "До $150 000",
        detail: "Компактная квартира у моря",
      },
      {
        value: "250000",
        title: "До $250 000",
        detail: "Больше пространства для жизни",
      },
      {
        value: "400000",
        title: "До $400 000",
        detail: "Просторные апартаменты и виллы",
      },
      {
        value: "any",
        title: "Пока не определился",
        detail: "Посмотрю разные варианты",
      },
    ],
  },
  {
    id: "rooms",
    short: "Спальни",
    title: "Сколько спален вам нужно?",
    hint: "Отдельные спальни, не общее число комнат",
    options: [
      { value: "1", title: "Одна спальня", detail: "Для себя или пары" },
      { value: "2", title: "Две спальни", detail: "Для семьи и гостей" },
      {
        value: "3",
        title: "Три спальни",
        detail: "Больше личного пространства",
      },
      {
        value: "any",
        title: "Не принципиально",
        detail: "Главное, чтобы понравилось",
      },
    ],
  },
  {
    id: "district",
    short: "Район",
    title: "Какая часть острова вам ближе?",
    hint: "У каждого района свой ритм",
    options: [
      {
        value: "bangtao",
        title: "Банг Тао",
        detail: "Длинный пляж и городская инфраструктура",
      },
      { value: "rawai", title: "Раваи", detail: "Спокойный юг и жизнь у воды" },
      {
        value: "kamala",
        title: "Камала",
        detail: "Зелёные холмы и небольшая бухта",
      },
      {
        value: "any",
        title: "Открыт к вариантам",
        detail: "Выберу по самой квартире",
      },
    ],
  },
  {
    id: "goal",
    short: "Цель покупки",
    title: "Для чего выбираете недвижимость?",
    hint: "Это поможет расставить приоритеты в подборке",
    options: [
      { value: "living", title: "Жить самому", detail: "Комфорт каждый день" },
      {
        value: "rental",
        title: "Сдавать в аренду",
        detail: "Подбор без обещаний доходности",
      },
      {
        value: "both",
        title: "Совмещать",
        detail: "Приезжать самому и сдавать",
      },
      {
        value: "any",
        title: "Пока изучаю рынок",
        detail: "Хочу понять, что есть",
      },
    ],
  },
  {
    id: "handover",
    short: "Срок",
    title: "Когда хотите получить ключи?",
    hint: "В подборке будут только варианты с подходящим сроком",
    options: [
      {
        value: "ready",
        title: "Можно заселяться",
        detail: "Только готовые объекты",
      },
      {
        value: "2027",
        title: "До конца 2027 года",
        detail: "Готовые и строящиеся объекты",
      },
      { value: "any", title: "Готов подождать", detail: "Посмотрю все сроки" },
    ],
  },
];

export const questions = [
  baseQuestions.find((q) => q.id === "rooms"),
  baseQuestions.find((q) => q.id === "budget"),
  baseQuestions.find((q) => q.id === "goal"),
  {
    id: "viewing",
    short: "Знакомство с объектом",
    title: "Когда удобно посмотреть?",
    hint: "Лично на острове или онлайн",
    options: [
      {
        value: "now",
        title: "Я уже на Пхукете",
        detail: "Хочу посмотреть в ближайшие дни",
      },
      { value: "soon", title: "Скоро прилетаю", detail: "В ближайшие месяцы" },
      {
        value: "online",
        title: "Сначала онлайн",
        detail: "Познакомлюсь с объектами удалённо",
      },
      {
        value: "any",
        title: "Пока присматриваюсь",
        detail: "Хочу увидеть варианты",
      },
    ],
  },
];
export const rentalQuestions = [
  {
    id: "dates",
    short: "Даты и гости",
    title: "Когда вы на Пхукет?",
    hint: "По датам проверим тестовый календарь и стоимость всего проживания",
    kind: "dates",
  },
  {
    id: "type",
    short: "Тип жилья",
    title: "Где хотите остановиться?",
    hint: "У каждого путешествия свой формат",
    options: [
      {
        value: "apartment",
        title: "Квартира",
        detail: "Апартаменты в комплексе",
      },
      {
        value: "villa",
        title: "Вилла",
        detail: "Больше пространства и свой бассейн",
      },
      {
        value: "any",
        title: "Рассмотрю оба варианта",
        detail: "Главное — чтобы подошло",
      },
    ],
  },
  baseQuestions.find((q) => q.id === "rooms"),
  baseQuestions.find((q) => q.id === "district"),
  {
    id: "budget",
    short: "Бюджет",
    title: "Какой бюджет на проживание?",
    hint: "Обязательные сборы включены, возвратный депозит указан отдельно",
    options: [],
  },
];
export function getQuestions(mode, answers = {}) {
  if (mode !== "rental") return questions;
  const values =
    answers.budgetBasis === "night" ? [100, 200, 400] : [1000, 2500, 5000];
  return rentalQuestions.map((q) =>
    q.id !== "budget"
      ? q
      : {
          ...q,
          options: [
            ...values.map((n) => ({
              value: String(n),
              title: `До $${n.toLocaleString("en-US")}`,
              detail:
                answers.budgetBasis === "night"
                  ? "В среднем за ночь, включая сборы"
                  : "За весь выбранный срок",
            })),
            {
              value: "any",
              title: "Хочу понять цены",
              detail: "Покажите все подходящие варианты",
            },
          ],
        },
  );
}
export const profiles = {
  sale: {
    label: "Покупка",
    headline: "Апартаменты\nна Пхукете",
    intro: "Ответьте на 4 вопроса — соберём варианты под ваш бюджет и планы.",
    action: "Подобрать квартиру",
    result: "Квартиры для вас",
    request: "Запросить просмотр",
    hero: "villa.jpg",
  },
  rental: {
    label: "Аренда",
    headline: "Квартиры и виллы\nна Пхукете",
    intro:
      "Выберите даты и расскажите о поездке — подберём жильё и рассчитаем весь срок.",
    action: "Подобрать жильё",
    result: "Ваше место на Пхукете",
    request: "Уточнить наличие",
    hero: "pool.jpg",
  },
};
// Demo fallbacks used only when Google Finance is unavailable.
export const demoRates = { USD: 1, THB: 33.53, RUB: 82.85 };
export const rateDate = "2026-10-20";

// All names, prices, specifications and inventory below are fictional demo fixtures.
export const properties = [
  {
    id: "p01",
    name: "Palm Residence",
    district: "bangtao",
    bedrooms: 1,
    area: 48,
    price: 138000,
    year: 2026,
    ready: true,
    available: true,
    beach: 650,
    image: "interior-1.jpg",
    gallery: ["interior-1.jpg", "pool.jpg"],
    goals: ["living", "rental", "both"],
    type: "Апартаменты",
    features: ["Балкон с видом на сад", "Общий бассейн", "Кухня и гостиная"],
    description:
      "Светлая квартира с отдельной спальней и просторной лоджией. В демонстрационной карточке показаны планировка, характеристики и путь до запроса просмотра.",
  },
  {
    id: "p02",
    name: "Lagoon Park",
    district: "bangtao",
    bedrooms: 2,
    area: 79,
    price: 224000,
    year: 2027,
    ready: false,
    available: true,
    beach: 900,
    image: "interior-2.jpg",
    gallery: ["interior-2.jpg", "pool.jpg"],
    goals: ["living", "both"],
    type: "Апартаменты",
    features: ["Две отдельные спальни", "Терраса", "Бассейн во дворе"],
    description:
      "Пространство для семьи с двумя спальнями и общей гостиной. Условный объект с демонстрационными характеристиками, не предложение застройщика.",
  },
  {
    id: "p03",
    name: "Coast Garden",
    district: "rawai",
    bedrooms: 1,
    area: 54,
    price: 149000,
    year: 2026,
    ready: true,
    available: true,
    beach: 1100,
    image: "interior-3.jpg",
    gallery: ["interior-3.jpg", "villa.jpg"],
    goals: ["rental", "both"],
    type: "Апартаменты",
    features: ["Отдельная кухня", "Вид на зелень", "Рабочая зона"],
    description:
      "Компактные апартаменты с отдельной рабочей зоной и видом в зелёный двор. Все условия здесь заданы для тестирования подбора.",
  },
  {
    id: "p04",
    name: "The Grove",
    district: "kamala",
    bedrooms: 2,
    area: 86,
    price: 238000,
    year: 2026,
    ready: true,
    available: true,
    beach: 800,
    image: "interior-4.jpg",
    gallery: ["interior-4.jpg", "pool.jpg"],
    goals: ["living", "both"],
    type: "Апартаменты",
    features: ["Две ванные комнаты", "Большая гостиная", "Крытая терраса"],
    description:
      "Семейная квартира с большой общей зоной и крытой террасой. Сроки, стоимость и доступность условные, только для демонстрации.",
  },
  {
    id: "p05",
    name: "Mango Courtyard",
    district: "rawai",
    bedrooms: 2,
    area: 94,
    price: 209000,
    year: 2027,
    ready: false,
    available: true,
    beach: 1400,
    image: "interior-1.jpg",
    gallery: ["interior-1.jpg", "interior-3.jpg"],
    goals: ["rental", "both"],
    type: "Апартаменты",
    features: ["Угловая планировка", "Общий сад", "Парковка"],
    description:
      "Угловые апартаменты с двумя спальнями и окнами на сад. Карточка показывает, как будет выглядеть объект из клиентской базы.",
  },
  {
    id: "p06",
    name: "Canopy Villas",
    district: "bangtao",
    bedrooms: 3,
    area: 180,
    price: 389000,
    year: 2027,
    ready: false,
    available: true,
    beach: 1800,
    image: "villa.jpg",
    gallery: ["villa.jpg", "interior-2.jpg"],
    goals: ["living", "both"],
    type: "Вилла",
    features: ["Частный бассейн", "Три спальни", "Собственный сад"],
    description:
      "Вилла с частным бассейном и садом. Условный пример крупного объекта для проверки фильтров бюджета и количества спален.",
  },
  {
    id: "p07",
    name: "Bay Studio",
    district: "kamala",
    bedrooms: 1,
    area: 42,
    price: 129000,
    year: 2028,
    ready: false,
    available: true,
    beach: 700,
    image: "interior-3.jpg",
    gallery: ["interior-3.jpg", "pool.jpg"],
    goals: ["rental"],
    type: "Апартаменты",
    features: ["Отдельная спальня", "Балкон", "Общий бассейн"],
    description:
      "Небольшие апартаменты с более поздним сроком готовности. Нужны в демо, чтобы проверить отсечение по сроку.",
  },
  {
    id: "p08",
    name: "Ocean Terrace",
    district: "kamala",
    bedrooms: 3,
    area: 156,
    price: 365000,
    year: 2026,
    ready: true,
    available: true,
    beach: 450,
    image: "interior-2.jpg",
    gallery: ["interior-2.jpg", "villa.jpg"],
    goals: ["living", "rental", "both"],
    type: "Пентхаус",
    features: ["Открытая терраса", "Три спальни", "Две ванные"],
    description:
      "Пентхаус с террасой и тремя отдельными спальнями. Цена и характеристики придуманы для локального прототипа.",
  },
  {
    id: "p09",
    name: "Palm Residence II",
    district: "bangtao",
    bedrooms: 2,
    area: 72,
    price: 198000,
    year: 2026,
    ready: true,
    available: true,
    beach: 750,
    image: "interior-4.jpg",
    gallery: ["interior-4.jpg", "interior-1.jpg"],
    goals: ["rental", "both"],
    type: "Апартаменты",
    features: ["Готовая отделка", "Две спальни", "Внутренний двор"],
    description:
      "Готовые двухспальные апартаменты для проверки наиболее востребованного сценария подбора. Не являются реальным объявлением.",
  },
  {
    id: "p10",
    name: "Private Garden",
    district: "rawai",
    bedrooms: 3,
    area: 210,
    price: 540000,
    year: 2026,
    ready: true,
    available: true,
    beach: 2000,
    image: "villa.jpg",
    gallery: ["villa.jpg", "pool.jpg"],
    goals: ["living"],
    type: "Вилла",
    features: ["Частный сад", "Бассейн", "Кабинет"],
    description:
      "Просторная вилла с отдельным кабинетом. Цена выше основного диапазона помогает проверить вариант без ограничения бюджета.",
  },
];
