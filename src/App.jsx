import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Heart,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Maximize2,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trees,
  UserRound,
  Users,
  Waves,
  X,
} from "lucide-react";
import {
  demoRates,
  districts,
  getQuestions,
  profiles,
  project,
  properties,
  rateDate,
} from "./config.mjs";
import {
  buildFunnel,
  fixtureEvents,
  matchProperties,
  matchReasons,
  upsertDemoLead,
  validatePhone,
} from "./engine.mjs";
import {
  matchRentals,
  rentalQuote,
  rentals,
  scoreProperty,
  selectionSignature,
  tripLength,
} from "./rental.mjs";
import {
  getSession,
  readAttribution,
  readStore,
  safeSource,
  saveStore,
} from "./store.mjs";
import "./theme.css";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
let activeRates = demoRates;
let activeRateNote = "Google Finance · загрузка курса…";
let activeRateDate = rateDate;
let activeRatesAreLive = false;
const rateBasis = () =>
  `${activeRatesAreLive ? "Курс Google Finance" : "Демо-курс"} на ${activeRateDate} · исходная валюта USD · не банковский курс`;
const money = (n, currency = "USD") =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.ceil(n * activeRates[currency]));
const pct = (n) => (n === null ? "—" : `${Math.round(n * 1000) / 10}%`);
const formatLeadTime = (timestamp, timezone) => {
  if (!timestamp) return "Не указано";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(timestamp);
  } catch {
    return new Date(timestamp).toLocaleString("ru-RU");
  }
};
const beds = (n) => `${n} ${n === 1 ? "спальня" : "спальни"}`;
const defaultFilters = (a) => ({
  expanded: false,
  rooms: a.rooms || "any",
  district: a.district || "any",
  budget: a.budget || "any",
  type: a.type || "any",
  search: "",
  sort: "match",
});
const demoAnswers = (mode) =>
  mode === "sale"
    ? { rooms: "2", budget: "250000", goal: "living", viewing: "online" }
    : {
        arrival: "2026-11-05",
        departure: "2026-11-12",
        guests: 2,
        type: "any",
        rooms: "any",
        district: "any",
        budget: "2500",
        budgetBasis: "stay",
      };
function parseRoute() {
  const [mode, view, id] = location.hash.slice(1).split("/");
  return {
    mode: ["sale", "rental"].includes(mode) ? mode : "sale",
    view: [
      "start",
      "quiz",
      "gate",
      "results",
      "favorites",
      "property",
      "admin",
    ].includes(view)
      ? view
      : "start",
    id: id || "",
  };
}
function complete(mode, answers) {
  return getQuestions(mode, answers).every((q) =>
    q.kind === "dates"
      ? tripLength(answers.arrival, answers.departure) &&
        answers.arrival >= today() &&
        Number(answers.guests) >= 1 &&
        Number(answers.guests) <= 8
      : !!answers[q.id],
  );
}

function IconButton({ label, children, ...props }) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
function GoldButton({ children, ...props }) {
  return (
    <button className="gold-button" {...props}>
      <span>{children}</span>
      <span className="button-arrow">
        <ArrowRight size={23} />
      </span>
    </button>
  );
}
function Currency({ value, onChange }) {
  return (
    <div className="currency-control-shell">
      <div className="currency-control" role="group" aria-label="Валюта">
        {Object.keys(demoRates).map((c) => (
          <button key={c} aria-pressed={c === value} onClick={() => onChange(c)}>
            {c}
          </button>
        ))}
      </div>
      <small className="currency-rate-note">{activeRateNote}</small>
    </div>
  );
}

const contactChannels = [
  { name: "WhatsApp", icon: null },
  { name: "Telegram", icon: Send },
  { name: "Звонок", icon: Phone },
  { name: "MAX", icon: MessageCircle },
];
function ChannelSelector({ value, onChange }) {
  return (
    <div
      className="channel-selector"
      role="group"
      aria-label="Предпочтительный канал"
    >
      {contactChannels.map(({ name, icon: Icon }) => (
        <button
          type="button"
          key={name}
          aria-pressed={value === name}
          onClick={() => onChange(name)}
        >
          {Icon ? (
            <Icon size={16} aria-hidden="true" />
          ) : (
            <span className="whatsapp-icon" aria-hidden="true">
              <MessageCircle size={16} />
              <Phone size={9} />
            </span>
          )} {name}
        </button>
      ))}
    </div>
  );
}
function Photo({ name, alt, ...props }) {
  return <img src={`/images/${name}`} alt={alt} {...props} />;
}
function Empty({ onEdit }) {
  return (
    <div className="empty-state">
      <Search size={35} />
      <h2>Точных совпадений нет</h2>
      <p>
        С этими условиями в тестовой базе нет подходящего жилья. Можно изменить
        ответы.
      </p>
      <button className="outline-button" onClick={onEdit}>
        <SlidersHorizontal size={18} />
        Изменить условия
      </button>
    </div>
  );
}

export default function App() {
  const [store, setStore] = useState(readStore);
  const [route, setRoute] = useState(parseRoute);
  const [session] = useState(getSession);
  const [preview, setPreview] = useState(null);
  const [currency, setCurrency] = useState("USD");
  const [, refreshRates] = useState(0);
  const [request, setRequest] = useState(null);
  const [toast, setToast] = useState("");
  const [attribution] = useState(readAttribution);
  const mode = route.mode;
  const profile = preview || store.profiles[mode];
  const answers = profile.answers;
  const qs = getQuestions(mode, answers);
  const firstMissing = qs.findIndex((q) =>
    q.kind === "dates"
      ? !tripLength(answers.arrival, answers.departure)
      : !answers[q.id],
  );
  const step = Math.min(
    Math.max(0, Number(route.id) || 0),
    qs.length - 1,
    !preview && firstMissing >= 0 ? firstMissing : qs.length - 1,
  );
  const signature = selectionSignature(mode, answers);
  const unlocked = complete(mode, answers) && profile.unlocked === signature;
  const protectedView = ["results", "favorites", "property"].includes(
    route.view,
  );
  const view =
    route.view === "gate" && !complete(mode, answers)
      ? "start"
      : protectedView && !unlocked
        ? complete(mode, answers)
          ? "gate"
          : "start"
        : route.view;
  const inventory = mode === "sale" ? properties : rentals;
  const matched = useMemo(
    () =>
      mode === "sale"
        ? matchProperties(properties, answers)
        : matchRentals(rentals, answers),
    [mode, answers],
  );
  const dataset = useMemo(
    () => ({
      source: safeSource(),
      device: matchMedia("(max-width: 700px)").matches ? "mobile" : "desktop",
    }),
    [],
  );
  const favorites = new Set(profile.favorites);
  const scrollPositions = useRef({});

  useEffect(() => {
    saveStore(store);
  }, [store]);
  useEffect(() => {
    if (import.meta.env.MODE !== "public-demo") return;
    let active = true;
    fetch("/api/rates")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload) => {
        if (!active || !["USD", "THB", "RUB"].every((c) => Number.isFinite(payload.rates?.[c]) && payload.rates[c] > 0)) return;
        activeRates = payload.rates;
        activeRatesAreLive = true;
        activeRateDate = new Date(payload.updatedAt).toLocaleDateString("ru-RU");
        activeRateNote = `Google Finance · ${new Date(payload.updatedAt).toLocaleTimeString(
          "ru-RU",
          { hour: "2-digit", minute: "2-digit" },
        )}`;
        refreshRates((n) => n + 1);
      })
      .catch(() => {
        if (!active) return;
        activeRatesAreLive = false;
        activeRateDate = rateDate;
        activeRateNote = "Google Finance недоступен · демо-курс";
        refreshRates((n) => n + 1);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const listener = () => setRoute(parseRoute());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    window.scrollTo({
      top: ["results", "favorites"].includes(view)
        ? scrollPositions.current[`${mode}/${view}`] || 0
        : 0,
      behavior: "instant",
    });
  }, [route.mode, route.view, route.id]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function go(next, id = "", targetMode = mode) {
    scrollPositions.current[`${mode}/${view}`] = window.scrollY;
    const nextRoute = { mode: targetMode, view: next, id: String(id) };
    setRoute(nextRoute);
    location.hash = `${targetMode}/${next}${id !== "" ? `/${id}` : ""}`;
  }
  function updateProfile(updater) {
    if (preview) setPreview((p) => updater(p));
    else
      setStore((s) => ({
        ...s,
        profiles: { ...s.profiles, [mode]: updater(s.profiles[mode]) },
      }));
  }
  function record(name, extra = {}, once = true) {
    const isPreview = !!preview;
    setStore((s) => {
      if (
        once &&
        s.events.some(
          (e) =>
            e.session === session &&
            e.profile === mode &&
            e.name === name &&
            e.preview === isPreview,
        )
      )
        return s;
      return {
        ...s,
        events: [
          ...s.events,
          {
            id: crypto.randomUUID(),
            session,
            profile: mode,
            version: project.version,
            dataset: "local",
            name,
            at: Date.now(),
            preview: isPreview,
            ...dataset,
            ...extra,
          },
        ],
      };
    });
  }
  useEffect(() => {
    if (view !== "admin" && !preview) record("visit");
    if (view === "quiz") record(`question_${qs[step].id}`);
    if (view === "gate" && complete(mode, answers)) {
      record("preview");
      if (matched.length) record("contact");
    }
    if (view === "results") record("results");
  }, [view, step, mode, !!preview]);

  function choose(key, value) {
    updateProfile((p) => ({
      ...p,
      unlocked: null,
      answers: { ...p.answers, [key]: value },
    }));
    record("answer", { step: key, value }, false);
  }
  function start() {
    record("start");
    go("quiz", 0);
  }
  function next() {
    const q = qs[step];
    if (q.kind === "dates") {
      if (
        !tripLength(answers.arrival, answers.departure) ||
        answers.arrival < today()
      )
        return;
      record(
        "answer",
        {
          step: "dates",
          value: {
            arrival: answers.arrival,
            departure: answers.departure,
            guests: answers.guests,
          },
        },
        false,
      );
    } else if (!answers[q.id]) return;
    if (step === qs.length - 1) go("gate");
    else go("quiz", step + 1);
  }
  function favorite(id) {
    updateProfile((p) => ({
      ...p,
      favorites: p.favorites.includes(id)
        ? p.favorites.filter((v) => v !== id)
        : [...p.favorites, id],
    }));
    record("favorite", { property: id }, false);
  }
  function openProperty(id) {
    record("property", { property: id }, false);
    go("property", id);
  }
  function saveLead(
    channel,
    objectIds,
    requestedDate = "",
    time = "",
    contactChecks,
    visitor,
  ) {
    if (!preview)
      setStore((s) => ({
        ...s,
        leads: upsertDemoLead(s.leads, {
          id: crypto.randomUUID(),
          session,
          profile: mode,
          intent: signature,
          version: project.version,
          answers: { ...answers },
          objectIds,
          source: dataset.source,
          channel,
          ...(contactChecks ? { contactChecks } : {}),
          ...(visitor || {}),
          city: attribution.city || "",
          attribution,
          technical: {
            device: dataset.device,
            timezone: visitor?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            language: navigator.language || "",
            userAgent: navigator.userAgent || "",
            screen: `${window.screen.width}×${window.screen.height}`,
          },
          requestedDate,
          time,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          stage: requestedDate ? "viewing" : "new",
        }),
      }));
  }
  function unlock(channel, checks, contactType = "phone", visitor) {
    saveLead(
      channel,
      matched.slice(0, 3).map((p) => p.id),
      "",
      "",
      { ...checks, contactType },
      visitor,
    );
    updateProfile((p) => ({
      ...p,
      unlocked: signature,
      filters: defaultFilters(answers),
    }));
    record("lead");
    go("results");
  }
  function sendRequest({ channel, contactType, date, time }) {
    saveLead(channel, request, date, time, contactType ? { contactType } : undefined);
    record("request");
    setRequest(null);
    setToast("Тестовый запрос сохранён. Менеджеру ничего не отправлено.");
  }
  function enterPreview(target, index = 0) {
    const a = demoAnswers(mode);
    setPreview({
      answers: a,
      favorites: [],
      unlocked: selectionSignature(mode, a),
      filters: defaultFilters(a),
    });
    go(
      target,
      target === "quiz" ? index : target === "property" ? inventory[0].id : "",
    );
  }
  function leavePreview() {
    setPreview(null);
    go("admin");
  }
  const currentProperty = inventory.find((p) => p.id === route.id);

  return (
    <div className={`app view-${view} mode-${mode}`}>
      <div className="demo-strip">
        <span>
          <i />
          Тестовый каталог недвижимости
        </span>
        <span>Вымышленные объекты и цены · без заявок менеджеру</span>
      </div>
      <header className="topbar">
        <div className="topbar-inner">
          {view !== "start" ? (
            <IconButton
              label="Назад"
              onClick={() =>
                view === "quiz"
                  ? step
                    ? go("quiz", step - 1)
                    : go("start")
                  : view === "property" || view === "favorites"
                    ? go("results")
                    : go("start")
              }
            >
              <ArrowLeft />
            </IconButton>
          ) : (
            <Compass className="brand-symbol" size={28} />
          )}
          <button className="brand" onClick={() => go("start")}>
            terra<span>.</span>
            <small>
              {mode === "sale"
                ? "НЕДВИЖИМОСТЬ · ПХУКЕТ"
                : "НЕДВИЖИМОСТЬ · ПХУКЕТ"}
            </small>
          </button>
          <div className="header-actions">
            {unlocked && view !== "admin" && (
              <IconButton
                label={`Избранное ${favorites.size}`}
                onClick={() => go("favorites")}
              >
                <Heart fill={favorites.size ? "currentColor" : "none"} />
                {favorites.size > 0 && <sup>{favorites.size}</sup>}
              </IconButton>
            )}
            <IconButton label="Панель демо" onClick={() => go("admin")}>
              <LayoutDashboard size={19} />
            </IconButton>
          </div>
        </div>
      </header>
      {preview && (
        <div className="preview-banner">
          <span>Служебный просмотр · события исключены</span>
          <button onClick={leavePreview}>
            Завершить
            <X size={16} />
          </button>
        </div>
      )}

      {view === "start" && (
        <Welcome
          mode={mode}
          onMode={(m) => {
            setPreview(null);
            go("start", "", m);
          }}
          onStart={start}
          inventory={inventory}
          currency={currency}
        />
      )}
      {view === "quiz" && (
        <main className="quiz-screen screen-width">
          <div className="step-heading">
            <span>
              <LockKeyhole size={18} />
              Шаг {step + 1} из {qs.length}
            </span>
            <span>{Math.round(((step + 1) / qs.length) * 100)}%</span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${((step + 1) / qs.length) * 100}%` }} />
          </div>
          <div className="question-title">
            <h1>{qs[step].title}</h1>
            <p>{qs[step].hint}</p>
          </div>
          {mode === "rental" && qs[step].id === "budget" && (
            <div
              className="segmented budget-basis"
              role="group"
              aria-label="Единица бюджета"
            >
              {[
                ["stay", "За весь срок"],
                ["night", "В среднем за ночь"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={answers.budgetBasis === id}
                  onClick={() =>
                    updateProfile((p) => ({
                      ...p,
                      unlocked: null,
                      answers: { ...p.answers, budgetBasis: id, budget: null },
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {qs[step].kind === "dates" ? (
            <div className="trip-fields">
              <label>
                Заезд
                <input
                  type="date"
                  aria-label="Дата заезда"
                  value={answers.arrival || ""}
                  min={today()}
                  onChange={(e) => choose("arrival", e.target.value)}
                />
              </label>
              <label>
                Выезд
                <input
                  type="date"
                  aria-label="Дата выезда"
                  value={answers.departure || ""}
                  min={answers.arrival || today()}
                  onChange={(e) => choose("departure", e.target.value)}
                />
              </label>
              <label className="guests-field">
                <Users size={20} />
                Гостей
                <select
                  aria-label="Количество гостей"
                  value={answers.guests}
                  onChange={(e) => choose("guests", Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              {answers.arrival && answers.departure && (
                <p
                  className={
                    !tripLength(answers.arrival, answers.departure)
                      ? "error"
                      : "trip-total"
                  }
                >
                  {tripLength(answers.arrival, answers.departure)
                    ? `${tripLength(answers.arrival, answers.departure)} ночей · ${answers.guests} гостей`
                    : "Проверьте даты: от 1 до 180 ночей."}
                </p>
              )}
            </div>
          ) : (
            <div
              className="answer-options"
              role="radiogroup"
              aria-label={qs[step].title}
            >
              {qs[step].options.map((o) => (
                <label
                  key={o.value}
                  className={`answer-option ${answers[qs[step].id] === o.value ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={qs[step].id}
                    value={o.value}
                    checked={answers[qs[step].id] === o.value}
                    onChange={() => choose(qs[step].id, o.value)}
                  />
                  <span className="radio-mark" />
                  <span>
                    <strong>{o.title}</strong>
                    <small>{o.detail}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="bottom-action">
            <GoldButton
              disabled={
                qs[step].kind === "dates"
                  ? !tripLength(answers.arrival, answers.departure) ||
                    answers.arrival < today()
                  : !answers[qs[step].id]
              }
              onClick={next}
            >
              {step === qs.length - 1 ? "Собрать подборку" : "Далее"}
            </GoldButton>
          </div>
        </main>
      )}
      {view === "gate" && (
        <main className="gate-screen screen-width">
          {!matched.length ? (
            <Empty onEdit={() => go("quiz", 0)} />
          ) : (
            <>
              <h1>
                Ваша подборка
                <br />
                уже готова!
              </h1>
              <div className="unlock-badge">
                <LockKeyhole size={18} />
                ОТКРЫТИЕ СРАЗУ НА ЭКРАНЕ
              </div>
              <div className="locked-previews">
                {matched.slice(0, 3).map((p) => (
                  <div className="locked-preview" key={p.id}>
                    <div
                      className="locked-preview-art"
                      aria-hidden="true"
                      style={{
                        backgroundImage: `url("/images/teaser-blur/${p.image}")`,
                      }}
                    />
                    <LockKeyhole className="preview-lock" size={25} />
                    <div>
                      <strong>
                        {beds(p.bedrooms)} · {p.area} м²
                      </strong>
                      <span>
                        {money(
                          mode === "sale" ? p.price : p.quote.total,
                          currency,
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="selection-note">
                {matched.length}{" "}
                {mode === "sale"
                  ? "вариантов в подборке"
                  : "вариантов на выбранные даты"}{" "}
                ·{" "}
                {mode === "sale"
                  ? "Пхукет"
                  : `${tripLength(answers.arrival, answers.departure)} ночей`}
              </p>
              <p className="gate-intro">
                Откройте каталог с ценами и характеристиками. Подходящие
                варианты появятся <strong>сразу после формы.</strong>
              </p>
              <ContactForm
                kind="unlock"
                mode={mode}
                onSubmit={({ channel, checks, contactType, visitor }) => unlock(channel, checks, contactType, visitor)}
              />
            </>
          )}
        </main>
      )}
      {["results", "favorites"].includes(view) && (
        <Catalog
          mode={mode}
          view={view}
          answers={answers}
          profile={profile}
          matched={matched}
          favorites={favorites}
          currency={currency}
          onCurrency={setCurrency}
          onFavorite={favorite}
          onOpen={openProperty}
          onEdit={() => go("quiz", 0)}
          onRequest={(ids) => setRequest(ids)}
          onFilters={(filters) => updateProfile((p) => ({ ...p, filters }))}
          onResults={() => go("results")}
        />
      )}
      {view === "property" &&
        (currentProperty ? (
          <PropertyPage
            mode={mode}
            property={currentProperty}
            answers={answers}
            currency={currency}
            onCurrency={setCurrency}
            favorite={favorites.has(currentProperty.id)}
            onFavorite={() => favorite(currentProperty.id)}
            onRequest={() => setRequest([currentProperty.id])}
          />
        ) : (
          <main className="screen-width">
            <Empty onEdit={() => go("results")} />
          </main>
        ))}
      {view === "admin" && (
        <Admin
          mode={mode}
          store={store}
          setStore={setStore}
          onPreview={enterPreview}
          toast={setToast}
        />
      )}
      <footer className="footer">
        <span>
          terra. <small>Тестовый каталог недвижимости · 2026</small>
        </span>
        <span>Объекты и условия вымышлены. Фото — иллюстрации.</span>
      </footer>
      {request && (
        <RequestDialog
          initialChannel={
            store.leads.find(
              (l) => l.profile === mode && l.intent === signature,
            )?.channel || "WhatsApp"
          }
          mode={mode}
          ids={request}
          inventory={inventory}
          onClose={() => setRequest(null)}
          onSubmit={sendRequest}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={20} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Welcome({ mode, onMode, onStart, inventory, currency }) {
  const p = profiles[mode];
  return (
    <main className="welcome">
      <section className="welcome-hero">
        <Photo
          name={p.hero}
          alt={
            mode === "sale"
              ? "Вилла с бассейном, иллюстрация недвижимости"
              : "Бассейн у апартаментов, иллюстрация отдыха"
          }
          fetchPriority="high"
        />
        <div className="photo-tint" />
        <div className="hero-controls">
          <span className="closed-offer">
            <LockKeyhole size={16} />
            ДЕМО-КАТАЛОГ
          </span>
          <div
            className="segmented mode-selector"
            role="group"
            aria-label="Направление"
          >
            {Object.entries(profiles).map(([id, data]) => (
              <button
                key={id}
                aria-pressed={mode === id}
                onClick={() => onMode(id)}
              >
                {data.label}
              </button>
            ))}
          </div>
        </div>
        <div className="hero-content">
          <span className="location">
            <MapPin size={14} />
            ПХУКЕТ, ТАИЛАНД
          </span>
          <h1>
            {p.headline.split("\n").map((line, i) => (
              <React.Fragment key={line}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </h1>
          <p>{p.intro}</p>
        </div>
        <div className="hero-facts">
          <div>
            <strong>{inventory.length}</strong>
            <span>ОБЪЕКТОВ В ДЕМО</span>
          </div>
          <div>
            <strong>
              {mode === "sale"
                ? money(Math.min(...inventory.map((p) => p.price)), currency)
                : "По вашим датам"}
            </strong>
            <span>
              {mode === "sale" ? "УСЛОВНАЯ ЦЕНА ОТ" : "СТОИМОСТЬ ВСЕГО СРОКА"}
            </span>
          </div>
        </div>
      </section>
      <section className="welcome-intro">
        <span className="eyebrow">
          {mode === "sale"
            ? "ВАШЕ МЕСТО НА ОСТРОВЕ"
            : "ОТПУСК · ЗИМОВКА · ЖИЗНЬ"}
        </span>
        <h2>{p.headline}</h2>
        <p>
          Подборка с ценами — сразу после тестовой формы. Без ожидания звонка.
        </p>
        <div className="intro-features">
          <div>
            <Trees />
            <strong>
              {mode === "sale" ? "Под ваши планы" : "Поездка без спешки"}
            </strong>
            <span>
              {mode === "sale"
                ? "Для себя, аренды или вместе"
                : "Даты, гости и любимый район"}
            </span>
          </div>
          <div>
            <Sun />
            <strong>
              {mode === "sale" ? "Все детали рядом" : "Весь срок — в расчёте"}
            </strong>
            <span>
              {mode === "sale"
                ? "Цена, площадь и срок готовности"
                : "Проживание и обязательные сборы"}
            </span>
          </div>
        </div>
        <div className="bottom-action">
          <GoldButton onClick={onStart}>{p.action}</GoldButton>
        </div>
      </section>
      <section className="welcome-catalog wide">
        <div className="section-heading">
          <span className="eyebrow">
            {inventory.length} ОБЪЕКТОВ В ТЕСТОВОЙ БАЗЕ
          </span>
          <span className="subtle">
            <LockKeyhole size={13} />
            Каталог после подбора
          </span>
        </div>
        <div className="teaser-track">
          {inventory.slice(0, 5).map((p) => (
            <div className="teaser-item" key={p.id}>
              <div
                className="teaser-item-art"
                aria-hidden="true"
                style={{ backgroundImage: `url("/images/teaser-blur/${p.image}")` }}
              />
              <LockKeyhole size={22} />
              <div>
                <strong>{p.name}</strong>
                <span>
                  {mode === "sale"
                    ? money(p.price, currency)
                    : `${beds(p.bedrooms)} · ${p.capacity} гостей`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function ContactForm({ kind, mode, onSubmit }) {
  const publicDemo = import.meta.env.MODE === "public-demo";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState("WhatsApp");
  const [contactType, setContactType] = useState("phone");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [capabilities, setCapabilities] = useState(null);
  const [lookupConsent, setLookupConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const requestController = useRef(null);
  const lastLookup = useRef(null);
  useEffect(() => {
    if (publicDemo) {
      setCapabilities({ whatsappEnabled: false });
      return;
    }
    const controller = new AbortController();
    fetch("/api/contacts/capabilities", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCapabilities)
      .catch(() => {
        if (!controller.signal.aborted)
          setCapabilities({ whatsappEnabled: false });
      });
    return () => {
      controller.abort();
      requestController.current?.abort();
    };
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (!cleanName) return setError("Укажите имя.");
    if (!/^[\p{Script=Latin}\p{Script=Cyrillic}]+(?:[\s.'’\-][\p{Script=Latin}\p{Script=Cyrillic}]+)*$/u.test(cleanName))
      return setError("Имя должно содержать только русские или латинские буквы.");
    const phoneBased = contactType === "phone";
    const validation = phoneBased ? validatePhone(phone) : { valid: true, normalized: null };
    if (!validation.valid) return setError(validation.message);
    const destination = phone.trim();
    const visitor = {
      name: cleanName,
      contact: phoneBased ? validation.normalized : destination,
      contactType,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    };
    if (contactType === "telegram_username" && !/^@?[A-Za-z0-9_]{5,32}$/.test(destination))
      return setError("Укажите логин Telegram: от 5 символов, латиница, цифры или _.");
    if (contactType === "max_url") {
      try { const url = new URL(destination); if (url.protocol !== "https:" || url.hostname !== "max.ru" || url.pathname === "/") throw new Error(); }
      catch { return setError("Укажите ссылку на профиль MAX вида https://max.ru/…"); }
    }
    if (!consent) return setError("Подтвердите тестовый режим.");
    if (date && date < today()) return setError("Выберите будущую дату.");
    if (publicDemo) {
      onSubmit({
        channel,
        contactType,
        date,
        time,
        visitor,
        checks: {
          phoneStatus: phoneBased ? "valid" : "not_applicable",
          whatsappStatus: "unknown",
          whatsappReason: "public_demo_no_lookup",
          provider: null,
          checkedAt: null,
        },
      });
      setName("");
      setPhone("");
      return;
    }
    if (!phoneBased) {
      onSubmit({ channel, contactType, date, time, visitor, checks: { phoneStatus: "not_applicable", whatsappStatus: "not_applicable", provider: null, checkedAt: null } });
      setName(""); setPhone("");
      return;
    }
    if (
      channel === "WhatsApp" &&
      capabilities?.whatsappEnabled &&
      !lookupConsent
    )
      return setError(
        "Для проверки WhatsApp нужно отдельное разрешение. Или выберите другой канал.",
      );
    setBusy(true);
    setError("");
    setLookupMessage("");
    requestController.current = new AbortController();
    try {
      const response = await fetch("/api/contacts/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          lookupWhatsApp: channel === "WhatsApp" && phoneBased,
          lookupConsent,
        }),
        signal: AbortSignal.any([
          AbortSignal.timeout(7000),
          requestController.current.signal,
        ]),
      });
      const result = await response.json();
      if (response.status === 412) {
        setCapabilities({ whatsappEnabled: true });
        return setError("Подтвердите разрешение на проверку WhatsApp.");
      }
      if (!response.ok)
        return setError(
          result.phone?.message ||
            (response.status === 429
              ? "Слишком много попыток. Подождите минуту и повторите."
              : "Проверка временно недоступна. Повторите позже."),
        );
      if (
        channel === "WhatsApp" &&
        ["yes", "no", "error"].includes(result.whatsapp.status)
      )
        lastLookup.current = {
          phone: validation.normalized,
          result: result.whatsapp,
        };
      if (channel === "WhatsApp" && result.whatsapp.status === "no")
        return setLookupMessage(
          "На этом номере WhatsApp не найден. Исправьте номер или выберите Telegram / звонок.",
        );
      if (channel === "WhatsApp" && result.whatsapp.status === "error")
        return setLookupMessage(
          "Сервис не смог проверить WhatsApp. Это не означает, что его нет. Повторите или выберите другой канал.",
        );
      const lookup =
        channel !== "WhatsApp" &&
        lastLookup.current?.phone === validation.normalized
          ? lastLookup.current.result
          : result.whatsapp;
      const checks = {
        phoneStatus: phoneBased ? "valid" : "not_applicable",
        whatsappStatus: lookup.status,
        whatsappReason: lookup.reason || null,
        provider: lookup.provider || null,
        checkedAt: lookup.checkedAt || null,
      };
      onSubmit({ channel, contactType, date, time, visitor, checks });
      setName("");
      setPhone("");
    } catch {
      if (requestController.current?.signal.aborted) return;
      setError(
        "Не удалось связаться с проверкой. Данные не отправлены менеджеру; попробуйте ещё раз.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      <fieldset className="contact-fields" disabled={busy}>
        <div className="test-note">
          <ShieldCheck size={17} />
          <span>
            {capabilities?.whatsappEnabled
              ? "Демокаталог. Имя и контакт сохраняются только в браузере для теста и не отправляются менеджеру. Проверка WhatsApp передаёт номер в WAHA только с отдельного разрешения."
              : "Демо: имя и контакт сохраняются только в этом браузере для теста. Номер проверяется локально; менеджеру данные не отправляются."}
          </span>
        </div>
        <label className="input-label">
          ВАШЕ ИМЯ
          <div className="input-with-icon">
            <UserRound />
            <input
              aria-label="Тестовое имя"
              autoComplete="off"
              placeholder="Ваше имя"
              maxLength={60}
              value={name}
              onChange={(e) => {
                setName(
                  e.target.value
                    .normalize("NFKC")
                    .replace(/[^\p{Script=Latin}\p{Script=Cyrillic}\s.'’\-]/gu, "")
                    .replace(/\s{2,}/g, " "),
                );
                setError("");
              }}
            />
          </div>
        </label>
        <label className="input-label">
          {contactType === "phone" ? "НОМЕР С КОДОМ СТРАНЫ" : contactType === "telegram_username" ? "ЛОГИН TELEGRAM" : "ССЫЛКА НА ПРОФИЛЬ MAX"}
          <div className="input-with-icon">
            <MessageIcon />
            <input
              type={contactType === "phone" ? "tel" : contactType === "max_url" ? "url" : "text"}
              aria-label={contactType === "phone" ? "Номер телефона" : contactType === "telegram_username" ? "Логин Telegram" : "Ссылка на профиль MAX"}
              autoComplete="off"
              placeholder={contactType === "phone" ? "+1 202 555 0123" : contactType === "telegram_username" ? "@username" : "https://max.ru/…"}
              maxLength={30}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError("");
                setLookupMessage("");
                setLookupConsent(false);
                lastLookup.current = null;
              }}
            />
          </div>
        </label>
        <ChannelSelector value={channel} onChange={(c) => {
            setChannel(c); setContactType("phone"); setPhone("");
            setError(""); setLookupMessage(""); setLookupConsent(false); lastLookup.current = null;
          }} />
        {(channel === "Telegram" || channel === "MAX") && (
          <div className="contact-type-selector" role="group" aria-label="Тип контакта">
            {(channel === "Telegram" ? [["phone", "Телефон"], ["telegram_username", "Логин"]] : [["phone", "Телефон"], ["max_url", "Ссылка на профиль"]]).map(([value, label]) => (
              <button type="button" key={value} aria-pressed={contactType === value} onClick={() => { setContactType(value); setPhone(""); setError(""); setLookupConsent(false); lastLookup.current = null; }}>{label}</button>
            ))}
          </div>
        )}
        {channel === "WhatsApp" && contactType === "phone" && capabilities?.whatsappEnabled && (
          <label className="consent">
            <input type="checkbox" checked={lookupConsent} onChange={(e) => setLookupConsent(e.target.checked)} />
            <span>Разрешаю разовую проверку номера в WhatsApp через WAHA. Сообщение не отправляется.</span>
          </label>
        )}
        {kind === "request" && mode === "sale" && (
          <div className="request-schedule">
            <label>
              Желаемый день
              <input
                type="date"
                aria-label="Желаемый день"
                min={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Время
              <input
                type="time"
                aria-label="Желаемое время"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
        )}
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            Понимаю, что это демо: имя и контакт сохранятся в браузере для теста, но не будут отправлены менеджеру.
          </span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {lookupMessage && (
          <p className="error" role="alert">
            {lookupMessage}
          </p>
        )}
        <GoldButton type="submit" disabled={busy || !capabilities}>
          {busy
            ? "Проверяем номер…"
            : kind === "unlock"
              ? "Открыть мою подборку"
              : "Создать тестовый запрос"}
        </GoldButton>
        <p className="form-footnote">
          <ShieldCheck size={16} />
          {capabilities?.whatsappEnabled
            ? "Формат, защита от заглушек и проверка WhatsApp"
            : "Формат и защита от заглушек · WhatsApp ещё не подключён"}
        </p>
      </fieldset>
    </form>
  );
}
function MessageIcon() {
  return (
    <span className="message-symbol">
      <MessageCircle size={24} />
    </span>
  );
}

function Card({
  p,
  mode,
  answers,
  currency,
  favorite,
  onFavorite,
  onOpen,
  onRequest,
  first,
}) {
  const score = mode === "sale" ? scoreProperty(p, answers) : null;
  const quote = p.quote;
  return (
    <article className={`property-card ${first ? "first-card" : ""}`}>
      <div className="card-photo">
        <button
          className="photo-button"
          aria-label={`Открыть ${p.name}`}
          onClick={onOpen}
        >
          <Photo name={p.image} alt={`Иллюстрация ${p.name}`} loading="lazy" />
        </button>
        <span className="card-badge">
          {first && (mode === "rental" || score !== null)
            ? "ЛУЧШЕ ПО УСЛОВИЯМ"
            : p.type}
        </span>
        <IconButton
          label={`${favorite ? "Убрать из избранного" : "В избранное"}: ${p.name}`}
          aria-pressed={favorite}
          onClick={onFavorite}
        >
          <Heart fill={favorite ? "currentColor" : "none"} />
        </IconButton>
        <div className="photo-caption">
          <strong>
            {beds(p.bedrooms)} · {p.area} м²
          </strong>
          <span>{p.beach} м до моря</span>
        </div>
      </div>
      <div className="card-body">
        <div className="card-location">
          <MapPin size={12} />
          {districts[p.district]}
          <span>
            {mode === "rental"
              ? quote.status === "unknown"
                ? "Наличие уточняется"
                : "Тестовый календарь"
              : p.ready
                ? "Готов"
                : `${p.year} год`}
          </span>
        </div>
        <h3>
          <button onClick={onOpen}>
            {p.name}
            <ArrowUpRight size={18} />
          </button>
        </h3>
        {score !== null && score >= 70 ? (
          <div
            className="match-score"
            title="Демо-расчёт: спальни 50, бюджет 35, цель 15. Только активные критерии; не вероятность покупки."
          >
            <span>
              <i style={{ width: `${score}%` }} />
            </span>
            <strong>{score}% по критериям</strong>
          </div>
        ) : (
          <p className="card-reason">
            <Check size={14} />
            {mode === "sale"
              ? "По вашим условиям"
              : `${quote.nights} ночей · до ${p.capacity} гостей`}
          </p>
        )}
        <div className="card-specs">
          <span>
            <BedDouble size={16} />
            {beds(p.bedrooms)}
          </span>
          <span>
            <Maximize2 size={14} />
            {p.area} м²
          </span>
          <span>
            {mode === "sale"
              ? p.ready
                ? "Дом готов"
                : `Сдача ${p.year}`
              : `${p.capacity} гостей`}
          </span>
        </div>
        <div className="card-price">
          <div>
            <small>
              {mode === "sale"
                ? "Условная стоимость"
                : "За весь срок, со сборами"}
            </small>
            <strong>
              {money(mode === "sale" ? p.price : quote.total, currency)}
            </strong>
          </div>
        </div>
        <div className="card-buttons">
          <button className="outline-button" onClick={onOpen}>
            Подробнее
            <ArrowRight size={17} />
          </button>
          <button className="message-button" onClick={onRequest}>
            <MessageIcon />
            {mode === "sale" ? "Спросить" : "Уточнить"}
          </button>
        </div>
      </div>
    </article>
  );
}

function Catalog({
  mode,
  view,
  answers,
  profile,
  matched,
  favorites,
  currency,
  onCurrency,
  onFavorite,
  onOpen,
  onEdit,
  onRequest,
  onFilters,
  onResults,
}) {
  const f = { ...defaultFilters(answers), ...profile.filters };
  const expanded = f.expanded;
  const effective = {
    ...answers,
    rooms: f.rooms,
    district: f.district,
    budget: f.budget,
    type: f.type,
  };
  let list =
    mode === "sale"
      ? matchProperties(properties, effective)
      : matchRentals(rentals, effective);
  const saved = (
    mode === "sale"
      ? properties
      : rentals.map((p) => ({
          ...p,
          quote: rentalQuote(p, answers),
        }))
  ).filter((p) => favorites.has(p.id));
  const usableSaved = saved.filter(
    (p) => mode === "sale" || ["available", "unknown"].includes(p.quote.status),
  );
  if (view === "favorites") list = usableSaved;
  list = list.filter((p) =>
    p.name.toLowerCase().includes(f.search.toLowerCase()),
  );
  if (f.sort === "price" || f.sort === "price-desc")
    list.sort(
      (a, b) =>
        (mode === "sale" ? a.price - b.price : a.quote.total - b.quote.total) *
        (f.sort === "price-desc" ? -1 : 1),
    );
  const shown = expanded || view === "favorites" ? list : list.slice(0, 3);
  const change = (key, value) => {
    onFilters({ ...f, [key]: value, expanded: false });
  };
  const requestIds =
    view === "favorites"
      ? usableSaved.map((p) => p.id)
      : favorites.size
        ? usableSaved.map((p) => p.id)
        : list.slice(0, 3).map((p) => p.id);
  return (
    <main className="catalog-page wide">
      <div className="catalog-heading">
        <div>
          <span className="eyebrow">
            {view === "favorites"
              ? "СОХРАНЁННЫЕ ОБЪЕКТЫ"
              : "ПОДОБРАНО ПО ВАШИМ ОТВЕТАМ"}
          </span>
          <h1>{view === "favorites" ? "Ваш выбор" : profiles[mode].result}</h1>
          <p>
            {mode === "rental"
              ? `${answers.arrival} — ${answers.departure} · ${answers.guests} гостей`
              : `${list.length} вариантов · сначала наиболее подходящие`}
          </p>
        </div>
        <Currency value={currency} onChange={onCurrency} />
      </div>
      <div className="manager-panel">
        <div className="manager-avatar">
          <UserRound size={36} />
        </div>
        <div>
          <strong>
            Ваш консультант <span className="demo-label">ДЕМО</span>
          </strong>
          <p>
            {mode === "sale"
              ? "Обсудить квартиру онлайн или запланировать знакомство на Пхукете."
              : "Уточнить доступность жилья и детали вашей поездки."}
          </p>
        </div>
        <button
          className="outline-button"
          onClick={() => onRequest(requestIds)}
          disabled={!requestIds.length}
        >
          Связаться
          <ArrowUpRight size={17} />
        </button>
      </div>
      {view === "results" && (
        <div className="catalog-tools">
          <label>
            <span>Район</span>
            <select
              aria-label="Район"
              value={f.district}
              onChange={(e) => change("district", e.target.value)}
            >
              <option value="any">Все районы</option>
              {Object.entries(districts).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Спальни</span>
            <select
              aria-label="Спальни"
              value={f.rooms}
              onChange={(e) => change("rooms", e.target.value)}
            >
              <option value="any">Любое число</option>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Бюджет</span>
            <select
              aria-label="Бюджет"
              value={f.budget}
              onChange={(e) => change("budget", e.target.value)}
            >
              <option value="any">Без ограничений</option>
              {getQuestions(mode, answers)
                .find((q) => q.id === "budget")
                .options.filter((o) => o.value !== "any")
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.title}
                    {mode === "rental"
                      ? answers.budgetBasis === "night"
                        ? " / ночь"
                        : " / срок"
                      : ""}
                  </option>
                ))}
            </select>
          </label>
          <label className="catalog-search">
            <Search size={17} />
            <input
              aria-label="Поиск объекта"
              placeholder="Название"
              value={f.search}
              onChange={(e) => change("search", e.target.value)}
            />
          </label>
          <IconButton
            label="Сбросить фильтры"
            onClick={() => onFilters({ ...defaultFilters({}), budget: "any" })}
          >
            <RotateCcw size={17} />
          </IconButton>
        </div>
      )}
      <div className="listing-meta">
        <span>
          {view === "favorites"
            ? `${favorites.size} в избранном`
            : "Подборка под ваши условия"}
        </span>
        <select
          aria-label="Сортировка"
          value={f.sort}
          onChange={(e) => change("sort", e.target.value)}
        >
          <option value="match">По соответствию</option>
          <option value="price">Сначала дешевле</option>
          <option value="price-desc">Сначала дороже</option>
        </select>
        <button
          className="text-button"
          onClick={view === "favorites" ? onResults : onEdit}
        >
          {view === "favorites" ? "К подборке" : "Изменить ответы"}
        </button>
      </div>
      {view === "favorites" && usableSaved.length < saved.length && (
        <p className="test-note">
          Часть сохранённых объектов недоступна на выбранные даты или для этого
          числа гостей. Они остаются в избранном, но не включены в запрос.
        </p>
      )}
      {!list.length ? (
        <div className="empty-state">
          <Heart size={32} />
          <h2>
            {view === "favorites"
              ? "Ваш выбор пока пуст"
              : "Нет вариантов с этими фильтрами"}
          </h2>
          <button
            className="outline-button"
            onClick={
              view === "favorites"
                ? onResults
                : () => onFilters(defaultFilters({}))
            }
          >
            {view === "favorites" ? "К подборке" : "Сбросить фильтры"}
          </button>
        </div>
      ) : (
        <>
          <div className="property-grid">
            {shown.map((p, i) => (
              <Card
                onRequest={() => onRequest([p.id])}
                key={p.id}
                p={p}
                mode={mode}
                answers={effective}
                currency={currency}
                favorite={favorites.has(p.id)}
                onFavorite={() => onFavorite(p.id)}
                onOpen={() => onOpen(p.id)}
                first={view === "results" && i === 0 && f.sort === "match"}
              />
            ))}
          </div>
          {!expanded && list.length > 3 && view === "results" && (
            <button
              className="expand-catalog"
              onClick={() => onFilters({ ...f, expanded: true })}
            >
              Показать все варианты · {list.length}
              <ArrowRight size={18} />
            </button>
          )}
        </>
      )}
      <p className="rate-note">
        {currency !== "USD"
          ? rateBasis()
          : "Условные цены в USD"}
        {mode === "rental" && " · возвратный депозит отдельно"}
      </p>
      <div className="catalog-request">
        <div>
          <span className="eyebrow">
            {favorites.size ? `ВАШ ВЫБОР · ${favorites.size}` : "СЛЕДУЮЩИЙ ШАГ"}
          </span>
          <h2>
            {mode === "sale" ? "Посмотрим поближе?" : "Обсудим вашу поездку?"}
          </h2>
        </div>
        <GoldButton
          onClick={() => onRequest(requestIds)}
          disabled={!requestIds.length}
        >
          {profiles[mode].request}
          {favorites.size ? ` · ${requestIds.length}` : ""}
        </GoldButton>
      </div>
      <div className="mobile-contact bottom-action">
        <GoldButton
          onClick={() => onRequest(requestIds)}
          disabled={!requestIds.length}
        >
          {favorites.size
            ? `${profiles[mode].request} · ${requestIds.length}`
            : "Написать консультанту"}
        </GoldButton>
      </div>
    </main>
  );
}

function PropertyPage({
  mode,
  property: p,
  answers,
  currency,
  onCurrency,
  favorite,
  onFavorite,
  onRequest,
}) {
  const [photo, setPhoto] = useState(0);
  const quote = mode === "rental" ? rentalQuote(p, answers) : null;
  const eligible = !quote || ["available", "unknown"].includes(quote.status);
  return (
    <main className="property-page wide">
      <div className="property-layout">
        <div className="property-gallery">
          <div className="large-photo">
            <Photo
              name={p.gallery[photo]}
              alt={`Иллюстрация ${p.name}, фото ${photo + 1}`}
            />
            <IconButton
              label={favorite ? "Убрать из избранного" : "В избранное"}
              onClick={onFavorite}
            >
              <Heart fill={favorite ? "currentColor" : "none"} />
            </IconButton>
            <div className="gallery-navigation">
              <IconButton
                label="Предыдущее фото"
                onClick={() =>
                  setPhoto((photo + p.gallery.length - 1) % p.gallery.length)
                }
              >
                <ChevronLeft />
              </IconButton>
              <span>
                {photo + 1} / {p.gallery.length}
              </span>
              <IconButton
                label="Следующее фото"
                onClick={() => setPhoto((photo + 1) % p.gallery.length)}
              >
                <ChevronRight />
              </IconButton>
            </div>
          </div>
          <div className="thumbnails">
            {p.gallery.map((image, i) => (
              <button
                key={i}
                aria-label={`Фото ${i + 1}`}
                aria-pressed={photo === i}
                onClick={() => setPhoto(i)}
              >
                <Photo name={image} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="property-information">
          <span className="eyebrow">{districts[p.district]} · ПХУКЕТ</span>
          <h1>{p.name}</h1>
          <p className="property-subtitle">
            {beds(p.bedrooms)} · {p.area} м²
          </p>
          <div className="price-panel">
            <div>
              <small>
                {mode === "sale" ? "Условная цена" : "За весь выбранный срок"}
              </small>
              <strong>
                {eligible
                  ? money(mode === "sale" ? p.price : quote.total, currency)
                  : "Недоступно на эти даты"}
              </strong>
            </div>
            <Currency value={currency} onChange={onCurrency} />
            <p>
              {mode === "sale"
                ? "Демонстрационная стоимость. Не является предложением застройщика."
                : quote.status === "unknown"
                  ? "Наличие уточняется: календарь на эти даты не подтверждён."
                  : quote.status === "available"
                    ? "Даты свободны только в тестовом календаре. Реальной брони нет."
                    : quote.reason}
            </p>
          </div>
          <div className="property-facts">
            <div>
              <span>ПЛОЩАДЬ</span>
              <strong>{p.area} м²</strong>
            </div>
            <div>
              <span>СПАЛЬНИ</span>
              <strong>{p.bedrooms}</strong>
            </div>
            <div>
              <span>{mode === "sale" ? "ГОТОВНОСТЬ" : "ГОСТИ"}</span>
              <strong>
                {mode === "sale"
                  ? p.ready
                    ? "Готов"
                    : `${p.year} год`
                  : `до ${p.capacity}`}
              </strong>
            </div>
            <div>
              <span>ДО МОРЯ</span>
              <strong>{p.beach} м</strong>
            </div>
          </div>
          <button
            className="message-button desktop-property-cta"
            disabled={!eligible}
            onClick={onRequest}
          >
            <MessageIcon />
            {mode === "sale"
              ? "Спросить об этой квартире"
              : "Уточнить наличие и условия"}
            <ArrowUpRight size={18} />
          </button>
        </div>
      </div>
      <div className="property-extra">
        <section>
          <h2>Что есть в этом варианте</h2>
          {p.features.map((f) => (
            <p key={f}>
              <Check size={17} />
              {f}
            </p>
          ))}
          <p className="subtle">{p.description}</p>
        </section>
        <section>
          <h2>{mode === "sale" ? "Почему в подборке" : "Расчёт проживания"}</h2>
          {mode === "sale" ? (
            <>
              {matchReasons(p, answers, districts).map((r) => (
                <p key={r}>
                  <Check size={16} />
                  {r}
                </p>
              ))}
              <p className="subtle">
                Версия базы {project.dataVersion}. Все характеристики условные.
              </p>
            </>
          ) : eligible ? (
            <dl className="quote-lines">
              <div>
                <dt>Проживание · {quote.nights} ночей</dt>
                <dd>{money(quote.accommodation, currency)}</dd>
              </div>
              <div>
                <dt>Уборка</dt>
                <dd>{money(quote.cleaning, currency)}</dd>
              </div>
              <div>
                <dt>Сервисный сбор · {p.servicePercent}%</dt>
                <dd>{money(quote.service, currency)}</dd>
              </div>
              <div className="quote-total">
                <dt>Итого за срок</dt>
                <dd>{money(quote.total, currency)}</dd>
              </div>
              <div>
                <dt>Возвратный депозит отдельно</dt>
                <dd>{money(quote.deposit, currency)}</dd>
              </div>
              <p className="subtle">
                {answers.arrival} — {answers.departure} · минимум {p.minNights}{" "}
                ночей. Сезонные тарифы учтены; это тестовый расчёт.
              </p>
            </dl>
          ) : (
            <p>{quote.reason}</p>
          )}
        </section>
      </div>
      <p className="rate-note">
        {currency !== "USD"
          ? rateBasis()
          : "Цены демонстрационные, USD."}
      </p>
      <div className="mobile-contact bottom-action">
        <GoldButton disabled={!eligible} onClick={onRequest}>
          {mode === "sale" ? "Спросить об этой квартире" : "Уточнить наличие"}
        </GoldButton>
      </div>
    </main>
  );
}

function RequestDialog({
  mode,
  ids,
  inventory,
  onClose,
  onSubmit,
  initialChannel,
}) {
  const ref = useRef(null);
  const [channel, setChannel] = useState(initialChannel);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      previous?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="request-dialog"
      aria-label="Тестовый запрос по объектам"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <IconButton label="Закрыть" onClick={onClose}>
        <X />
      </IconButton>
      <span className="eyebrow">ВАШ ВЫБОР · {ids.length}</span>
      <h2>
        {mode === "sale" ? "Знакомство с объектами" : "Детали вашей поездки"}
      </h2>
      <div className="request-objects">
        {ids.map((id) => {
          const p = inventory.find((p) => p.id === id);
          return p ? (
            <span key={id}>
              <Check size={13} />
              {p.name}
            </span>
          ) : null;
        })}
      </div>
      <form
        className="contact-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (date && date < today()) return;
          onSubmit({ channel, date, time });
        }}
      >
        <p className="test-note">
          Повторно вводить контакты не нужно. Это тест: менеджеру ничего не
          отправится, просмотр и проживание не бронируются.
        </p>
        <ChannelSelector value={channel} onChange={setChannel} />

        {mode === "sale" && (
          <div className="request-schedule">
            <label>
              Желаемый день
              <input
                type="date"
                aria-label="Желаемый день"
                min={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Время
              <input
                type="time"
                aria-label="Желаемое время"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
        )}
        <GoldButton type="submit">Создать тестовый запрос</GoldButton>
      </form>
    </dialog>
  );
}

function Admin({ mode, store, setStore, onPreview, toast }) {
  const [tab, setTab] = useState("analytics");
  const [data, setData] = useState("local");
  const [source, setSource] = useState("");
  const [device, setDevice] = useState("");
  const [period, setPeriod] = useState("all");
  const since =
    period === "all"
      ? null
      : period === "today"
        ? new Date(`${today()}T00:00:00`).getTime()
        : Date.now() - 7 * 86400000;
  const rows = buildFunnel(store.events, {
    dataset: data,
    profile: mode,
    source,
    device,
    since,
  });
  const leads = store.leads.filter((l) => l.profile === mode);
  const events = store.events.filter(
    (e) =>
      e.profile === mode &&
      e.version === "2.0" &&
      !e.preview &&
      e.dataset === data &&
      (!source || e.source === source) &&
      (!device || e.device === device) &&
      (!since || e.at >= since),
  );
  function addSampleLeads() {
    const now = Date.now();
    const samples = [
      {
        source: "yandex",
        sourceLabel: "Яндекс Директ",
        name: "Тестовая заявка · Яндекс",
        city: "Москва",
        timezone: "Europe/Moscow",
        contact: "+12025550123",
        utm: {
          utm_source: "yandex",
          utm_medium: "cpc",
          utm_campaign: "demo_search_phuket",
          utm_term: "квартира на Пхукете",
          utm_content: "объявление_1",
          utm_id: "demo-yandex-campaign",
        },
        clickIds: { yclid: "DEMO-YCLID-123456789" },
        clientIds: { yandexMetrica: "DEMO-YM-CLIENT-987654321" },
        device: "mobile",
        screen: "390×844",
      },
      {
        source: "google",
        sourceLabel: "Google Ads",
        name: "Тестовая заявка · Google",
        city: "Бангкок",
        timezone: "Asia/Bangkok",
        contact: "+12025550124",
        utm: {
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign: "demo_search_phuket",
          utm_term: "phuket property",
          utm_content: "responsive_search_ad",
          utm_id: "demo-google-campaign",
        },
        clickIds: {
          gclid: "DEMO-GCLID-123456789",
          gbraid: "DEMO-GBRAID-987654321",
        },
        clientIds: { googleAnalytics: "DEMO-GA-CLIENT-1234.5678" },
        device: "desktop",
        screen: "1440×900",
      },
    ].map((sample) => ({
      id: crypto.randomUUID(),
      session: `sample-${crypto.randomUUID()}`,
      profile: mode,
      intent: "sample-lead",
      version: project.version,
      answers: {},
      objectIds: (mode === "sale" ? properties : rentals).slice(0, 2).map((p) => p.id),
      source: sample.source,
      channel: "WhatsApp",
      contactType: "phone",
      contact: sample.contact,
      name: sample.name,
      city: sample.city,
      attribution: {
        source: sample.source,
        sourceLabel: sample.sourceLabel,
        capturedAt: now,
        landingPage: "/#sale/results",
        referrer: `${sample.source}.example (учебные данные)`,
        utm: sample.utm,
        clickIds: sample.clickIds,
        clientIds: sample.clientIds,
      },
      technical: {
        device: sample.device,
        timezone: sample.timezone,
        language: "ru-RU",
        userAgent: "Учебные данные · Chrome",
        screen: sample.screen,
      },
      requestedDate: "2026-11-03",
      time: "11:30",
      createdAt: now,
      updatedAt: now,
      stage: "new",
      isSample: true,
    }));
    setStore((s) => ({ ...s, leads: [...samples, ...s.leads] }));
  }
  function sample() {
    setStore((s) => ({
      ...s,
      events: [
        ...s.events.filter(
          (e) => !(e.dataset === "sample" && e.profile === mode),
        ),
        ...fixtureEvents(mode),
      ],
    }));
    setData("sample");
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { demo: true, version: "2.0", profile: mode, events, leads },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `terra-v2-${mode}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function clear() {
    if (confirm("Очистить тестовую аналитику и заявки этого направления?"))
      setStore((s) => ({
        ...s,
        events: s.events.filter((e) => e.profile !== mode),
        leads: s.leads.filter((l) => l.profile !== mode),
      }));
  }
  return (
    <main className="admin-page wide">
      <div className="admin-heading">
        <div>
          <span className="eyebrow">
            ЛОКАЛЬНОЕ ДЕМО / {profiles[mode].label}
          </span>
          <h1>Контроль подбора</h1>
          <p>Версия 2 · контакты и аналитика хранятся только в этом браузере</p>
        </div>
        <div>
          <IconButton label="Выгрузить JSON" onClick={download}>
            <Download size={19} />
          </IconButton>
          <IconButton label="Очистить аналитику" onClick={clear}>
            <RotateCcw size={19} />
          </IconButton>
        </div>
      </div>
      <div className="admin-tabs" role="tablist">
        {[
          ["analytics", "Аналитика"],
          ["leads", `Заявки · ${leads.length}`],
          ["preview", "Просмотр экранов"],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "analytics" && (
        <>
          <div className="admin-filters">
            <select
              aria-label="Набор данных"
              value={data}
              onChange={(e) => setData(e.target.value)}
            >
              <option value="local">Мои прохождения</option>
              <option value="sample">Учебная выборка</option>
            </select>
            <select
              aria-label="Источник"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Все источники</option>
              <option value="direct">Прямой вход</option>
              <option value="google">Google</option>
              <option value="yandex">Яндекс</option>
              <option value="telegram">Telegram</option>
              <option value="other">Другой источник</option>
            </select>
            <select
              aria-label="Устройство"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
            >
              <option value="">Все устройства</option>
              <option value="mobile">Мобильные</option>
              <option value="desktop">Компьютеры</option>
            </select>
            <select
              aria-label="Период"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="all">Всё время</option>
              <option value="today">Сегодня</option>
              <option value="week">7 дней</option>
            </select>
            <button className="outline-button" onClick={sample}>
              Учебный пример
            </button>
          </div>
          {data === "sample" && (
            <p className="test-note">
              36 вымышленных сессий. Не результаты рекламы.
            </p>
          )}
          <div className="stat-grid">
            {[
              ["Входы", rows[0]],
              ["Начали", rows[1]],
              ["Открыли каталог", rows.find((r) => r.id === "results")],
              ["Запрос по объектам", rows.at(-1)],
            ].map(([label, row]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{row.count}</strong>
                <small>{pct(row.totalRate)} от входов</small>
              </div>
            ))}
          </div>
          <section className="funnel">
            <h2>Воронка прохождения</h2>
            <p className="subtle">
              Последовательная когорта · служебный просмотр исключён
            </p>
            {rows.map((row, i) => (
              <div className="funnel-row" key={row.id}>
                <div>
                  <span>{row.label}</span>
                  <div className="funnel-track">
                    <i style={{ width: `${(row.totalRate || 0) * 100}%` }} />
                  </div>
                </div>
                <strong>{row.count}</strong>
                <span>{pct(row.totalRate)}</span>
                <span>
                  {i && row.stepRate !== null
                    ? `−${pct(1 - row.stepRate)}`
                    : "—"}
                </span>
              </div>
            ))}
          </section>
          <section className="answer-statistics">
            <h2>Выбранные ответы</h2>
            <div className="answer-stat-grid">
              {getQuestions(mode)
                .filter((q) => q.options?.length)
                .map((q) => {
                  const latest = new Map();
                  for (const e of events)
                    if (e.name === "answer" && e.step === q.id)
                      latest.set(e.session, e.value);
                  return (
                    <div key={q.id}>
                      <h3>{q.short}</h3>
                      {(mode === "rental" && q.id === "budget"
                        ? [
                            ...q.options.map((o) => ({
                              ...o,
                              title:
                                o.value === "any"
                                  ? o.title
                                  : `${o.title} за срок`,
                            })),
                            ...getQuestions(mode, { budgetBasis: "night" })
                              .find((item) => item.id === "budget")
                              .options.filter((o) => o.value !== "any")
                              .map((o) => ({
                                ...o,
                                title: `${o.title} в среднем за ночь`,
                              })),
                          ]
                        : q.options
                      ).map((o) => (
                        <p key={o.value}>
                          <span>{o.title}</span>
                          <strong>
                            {
                              [...latest.values()].filter((v) => v === o.value)
                                .length
                            }
                          </strong>
                        </p>
                      ))}
                    </div>
                  );
                })}
            </div>
          </section>
        </>
      )}
      {tab === "leads" && (
        <div className="lead-list">
          <button className="outline-button" onClick={addSampleLeads}>
            Добавить учебные заявки Google и Яндекс
          </button>
          {!leads.length ? (
            <p>Тестовых заявок пока нет.</p>
          ) : (
            leads.map((l) => (
              <article className="lead-row" key={l.id}>
                <div>
                  <span className="eyebrow">
                    #{l.id.slice(0, 8)} · {l.isSample ? "УЧЕБНЫЙ ПРИМЕР" : "ТЕСТ"}
                  </span>
                  <h3>
                    {l.name || "Имя не указано"}
                  </h3>
                  <p>
                    {l.contactType === "telegram_username" ? "Telegram" : l.contactType === "max_url" ? "MAX" : "Телефон"}: {l.contact || "не указан"}
                  </p>
                  <p>
                    {l.objectIds
                      .map(
                        (id) =>
                          (mode === "sale" ? properties : rentals).find(
                            (p) => p.id === id,
                          )?.name,
                      )
                      .join(", ")}
                  </p>
                  <p>
                    {l.attribution?.sourceLabel || l.source} · {l.channel}
                    {l.requestedDate &&
                      ` · желаемый день ${l.requestedDate} ${l.time || ""}`}
                  </p>
                  <p>
                    Город: {l.city || "не указан"} · создана {formatLeadTime(l.createdAt, l.technical?.timezone)}
                    {l.technical?.timezone ? ` · ${l.technical.timezone}` : ""}
                  </p>
                  <details className="lead-attribution">
                    <summary>Источник и рекламные данные</summary>
                    <dl className="lead-detail-grid">
                      <dt>Страница входа</dt><dd>{l.attribution?.landingPage || "не зафиксирована"}</dd>
                      <dt>Реферер</dt><dd>{l.attribution?.referrer || "прямой вход / не передан"}</dd>
                      {Object.entries(l.attribution?.utm || {}).map(([key, value]) => (
                        <React.Fragment key={key}><dt>{key}</dt><dd>{value}</dd></React.Fragment>
                      ))}
                      {Object.entries(l.attribution?.clickIds || {}).map(([key, value]) => (
                        <React.Fragment key={key}><dt>{key}</dt><dd>{value}</dd></React.Fragment>
                      ))}
                      {Object.entries(l.attribution?.clientIds || {}).map(([key, value]) => (
                        <React.Fragment key={key}><dt>{key}</dt><dd>{value}</dd></React.Fragment>
                      ))}
                    </dl>
                    <small>Пустые метки и ID не добавляются. ID в учебных примерах синтетические.</small>
                  </details>
                  <details className="lead-attribution">
                    <summary>Техническая информация</summary>
                    <dl className="lead-detail-grid">
                      <dt>Устройство</dt><dd>{l.technical?.device || "неизвестно"}</dd>
                      <dt>Язык</dt><dd>{l.technical?.language || "неизвестен"}</dd>
                      <dt>Экран</dt><dd>{l.technical?.screen || "неизвестен"}</dd>
                      <dt>Браузер</dt><dd>{l.technical?.userAgent || "не передан"}</dd>
                    </dl>
                  </details>
                  <p>
                    Номер:{" "}
                    {l.contactChecks?.phoneStatus === "valid"
                      ? "проверен по правилам нумерации"
                      : "нет данных"}{" "}
                    · WhatsApp:{" "}
                    {{
                      yes: "найден",
                      no: "не найден",
                      unknown: "не проверен",
                      error: "ошибка проверки",
                    }[l.contactChecks?.whatsappStatus] || "нет данных"}
                  </p>
                </div>
                <select
                  aria-label={`Статус ${l.id.slice(0, 8)}`}
                  value={l.stage}
                  onChange={(e) =>
                    setStore((s) => ({
                      ...s,
                      leads: s.leads.map((item) =>
                        item.id === l.id
                          ? { ...item, stage: e.target.value }
                          : item,
                      ),
                    }))
                  }
                >
                  <option value="new">Новая</option>
                  <option value="qualified">Квалифицирована</option>
                  <option value="viewing">Запрос просмотра</option>
                  <option value="closed">Закрыта</option>
                </select>
              </article>
            ))
          )}
        </div>
      )}
      {tab === "preview" && (
        <div className="preview-grid">
          {getQuestions(mode).map((q, i) => (
            <button
              className="outline-button"
              key={q.id}
              onClick={() => onPreview("quiz", i)}
            >
              {i + 1}. {q.short}
              <ArrowUpRight size={16} />
            </button>
          ))}
          {[
            ["start", "Старт"],
            ["gate", "Превью и форма"],
            ["results", "Подборка"],
            ["property", "Карточка объекта"],
            ["favorites", "Избранное"],
          ].map(([id, label]) => (
            <button
              className="outline-button"
              key={id}
              onClick={() => onPreview(id)}
            >
              {label}
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
