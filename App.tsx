import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Trophy, Plus, Heart, X, User, BookOpen, Camera,
  Pencil, Trash2, Sparkles, Link as LinkIcon, ShieldCheck, Loader2, Mail,
  MessageCircle, Send, LogOut, Calendar, GraduationCap, Briefcase, ExternalLink,
  Info, ChevronLeft, BadgeCheck, AlertTriangle, Search, MessageSquare
} from "lucide-react";

/* ---------------- storage helpers ---------------- */
async function safeGet(key, shared) {
  try {
    const res = await window.storage.get(key, shared);
    return res ? res.value : null;
  } catch (e) {
    return null;
  }
}
async function safeSet(key, value, shared) {
  try {
    await window.storage.set(key, JSON.stringify(value), shared);
    return true;
  } catch (e) {
    console.error("storage set failed", e);
    return false;
  }
}
async function safeDelete(key, shared) {
  try { await window.storage.delete(key, shared); } catch (e) {}
}
function parseOr(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch (e) {
    return fallback;
  }
}

/* ---------------- small utils ---------------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "сейчас";
  if (min < 60) return `${min} мин`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} дн`;
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
function resizeImage(file, maxWidth = 700, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function normalizeName(s) {
  return (s || "").toLowerCase().replace(/[^a-zа-яё\s]/gi, "").split(/\s+/).filter(Boolean);
}
function nameMatches(diplomaName, profileName) {
  const a = normalizeName(diplomaName);
  const b = normalizeName(profileName);
  if (!a.length || !b.length) return null;
  const overlap = a.filter((t) => b.includes(t)).length;
  return overlap >= Math.min(2, b.length);
}
function normTitle(s) {
  return (s || "").toLowerCase().replace(/[^a-zа-яё0-9]+/gi, " ").trim();
}
function isDuplicateOlympiad(title, existing) {
  const nt = normTitle(title);
  if (!nt) return false;
  return existing.some((a) => a.type === "olympiad" && normTitle(a.title) === nt);
}

const AVATARS = ["🦉", "🦊", "🐺", "🐢", "🐉", "🦁", "🐝", "🦅", "🐬", "🦄"];
const TAGS_POST = ["Достижение", "Мысль", "Вопрос"];
const TAGS_JOURNAL = ["Математика", "Физика", "Информатика", "Химия", "Биология", "Другое"];
const UNIVERSITIES = ["МГУ", "СПбГУ", "ВШЭ", "МФТИ", "ИТМО", "Другой"];
const GRADES = ["8 класс", "9 класс", "10 класс", "11 класс", "Студент"];
const INTERESTS = ["Математика", "Физика", "Информатика", "Химия", "Биология", "Экономика", "Гуманитарные", "Другое"];
const OLYMPIAD_SUBJECTS = ["Математика", "Физика", "Информатика", "Химия", "Биология", "Экономика", "Другое"];

function matchSubject(text) {
  if (!text) return "Другое";
  const t = text.toLowerCase();
  const found = OLYMPIAD_SUBJECTS.find((s) => t.includes(s.toLowerCase().slice(0, 4)));
  return found || "Другое";
}

const OLYMPIAD_LEVELS = [
  { key: "intl", label: "Международная (IMO, IPhO и т.п.)", weight: 100 },
  { key: "vos_final", label: "ВОШ — заключительный этап", weight: 90 },
  { key: "lvl1", label: "Перечень — I уровень", weight: 70 },
  { key: "lvl2", label: "Перечень — II уровень", weight: 45 },
  { key: "lvl3", label: "Перечень — III уровень", weight: 25 },
  { key: "regional", label: "Региональная / школьная", weight: 10 },
  { key: "unknown", label: "Не определён", weight: 5 },
];
function levelInfo(key) {
  return OLYMPIAD_LEVELS.find((l) => l.key === key) || OLYMPIAD_LEVELS[OLYMPIAD_LEVELS.length - 1];
}
const PROJECT_WEIGHT = 6;
const BUSINESS_WEIGHT = 8;

const SEED_META = {
  seed_sonya: { name: "Соня Кравцова", avatar: "🦉", university: "МГУ", bio: "Химия и немного научной фотографии." },
  seed_timur: { name: "Тимур Ахметов", avatar: "🐺", university: "МФТИ", bio: "Алгоритмы, C++ и стажировки в IT." },
  seed_mila: { name: "Мила Воронцова", avatar: "🦊", university: "МГУ", bio: "Математика — это красиво." },
  seed_dana: { name: "Дана Ким", avatar: "🐢", university: "ВШЭ", bio: "Биология и школьный стартап про экологию." },
  seed_artem: { name: "Артём Лебедев", avatar: "🐉", university: "МФТИ", bio: "Физика, математика, немного шахмат." },
};
const SEED_ACHIEVEMENTS = {
  seed_sonya: [
    { type: "olympiad", subject: "Химия", levelKey: "lvl1", weight: 70, title: "Олимпиада по химии, I уровень" },
    { type: "olympiad", subject: "Химия", levelKey: "regional", weight: 10, title: "Региональная олимпиада по химии" },
    { type: "project", weight: 6, title: "Научный проект по электрохимии" },
  ],
  seed_timur: [
    { type: "olympiad", subject: "Информатика", levelKey: "vos_final", weight: 90, title: "ВсОШ по информатике, заключительный этап" },
    { type: "project", weight: 6, title: "Телеграм-бот для расписания школы" },
    { type: "project", weight: 6, title: "Пет-проект: трекер задач" },
    { type: "business", weight: 8, title: "Небольшая IT-подработка для местного бизнеса" },
  ],
  seed_mila: [
    { type: "olympiad", subject: "Математика", levelKey: "intl", weight: 100, title: "Международная математическая олимпиада" },
    { type: "olympiad", subject: "Математика", levelKey: "lvl2", weight: 45, title: "Олимпиада по математике, II уровень" },
  ],
  seed_dana: [
    { type: "olympiad", subject: "Биология", levelKey: "lvl3", weight: 25, title: "Олимпиада по биологии, III уровень" },
    { type: "project", weight: 6, title: "Экопроект по переработке пластика" },
    { type: "project", weight: 6, title: "Исследование локальной флоры" },
    { type: "project", weight: 6, title: "Школьная теплица" },
    { type: "business", weight: 8, title: "Стартап по переработке пластика" },
    { type: "business", weight: 8, title: "Продажа эко-сувениров" },
  ],
  seed_artem: [
    { type: "olympiad", subject: "Физика", levelKey: "intl", weight: 100, title: "Международная физическая олимпиада" },
    { type: "olympiad", subject: "Физика", levelKey: "vos_final", weight: 90, title: "ВсОШ по физике, заключительный этап" },
    { type: "olympiad", subject: "Математика", levelKey: "lvl1", weight: 70, title: "Олимпиада по математике, I уровень" },
  ],
};
function buildSeedBoard() {
  const board = {};
  Object.entries(SEED_META).forEach(([id, meta]) => {
    const achs = SEED_ACHIEVEMENTS[id] || [];
    const counts = { olympiads: 0, projects: 0, businesses: 0 };
    let score = 0;
    achs.forEach((a) => {
      score += a.weight;
      if (a.type === "olympiad") counts.olympiads++;
      if (a.type === "project") counts.projects++;
      if (a.type === "business") counts.businesses++;
    });
    board[id] = { name: meta.name, avatar: meta.avatar, university: meta.university, score, ...counts };
  });
  return board;
}
const SEED_LEADERBOARD = buildSeedBoard();
const SEED_POSTS = [
  {
    id: "seed_p1", authorId: "seed_sonya", authorName: "Соня Кравцова", authorAvatar: "🦉", tag: "Достижение", photo: null,
    text: "Прошла на всеросс по химии! Два месяца решала задачи каждый вечер — оказывается, это работает 🙂",
    likes: ["seed_timur", "seed_dana"],
    comments: [{ id: "c1", authorId: "seed_mila", authorName: "Мила Воронцова", authorAvatar: "🦊", text: "Красота! Поделишься подборкой задач?", createdAt: Date.now() - 1000 * 60 * 60 * 4 }],
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: "seed_p2", authorId: "seed_timur", authorName: "Тимур Ахметов", authorAvatar: "🐺", tag: "Вопрос", photo: null,
    text: "Кто-то писал ВОШ по информатике на C++? Поделитесь, как готовились к олимпиадным алгоритмам.",
    likes: [], comments: [], createdAt: Date.now() - 1000 * 60 * 60 * 26,
  },
  {
    id: "seed_p3", authorId: "seed_dana", authorName: "Дана Ким", authorAvatar: "🐢", tag: "Мысль", photo: null,
    text: "Запустили школьный стартап по переработке пластика с командой — это тоже своего рода олимпиада, только без жюри.",
    likes: ["seed_mila"], comments: [], createdAt: Date.now() - 1000 * 60 * 60 * 50,
  },
];
const EVENTS = [
  { id: "ev1", audience: "school", type: "olympiad", title: "Пригласительный этап ВсОШ", org: "Образовательный центр «Сириус»", window: "Идёт в течение учебного года — доступен школьникам 3–10 классов", field: "Разные предметы", link: "https://siriusolymp.ru/" },
  { id: "ev2", audience: "school", type: "olympiad", title: "Олимпиада «Физтех» (перечень, I уровень)", org: "МФТИ", window: "Отборочный этап обычно проходит осенью–зимой, точные даты — на сайте олимпиады", field: "Математика, физика, информатика", link: "https://olymp.mipt.ru/" },
  { id: "ev3", audience: "school", type: "olympiad", title: "Школьный этап ВсОШ 2026/27", org: "Минпросвещения РФ", window: "Обычно сентябрь–октябрь, точные сроки устанавливает регион — уточняй в своей школе", field: "Все предметы перечня", link: "https://www.ucheba.ru/for-abiturients/olympiads" },
  { id: "ev4", audience: "school", type: "forum", title: "Сводный перечень олимпиад 2026/27", org: "Учёба.ру", window: "Полный список регистраций по всем предметам и льготам вузов", field: "Справочник", link: "https://www.ucheba.ru/for-abiturients/olympiads" },
  { id: "ev5", audience: "student", type: "internship", title: "SberStudent / SberSeasons", org: "Сбер", window: "Несколько волн набора в год, весенняя обычно в мае–июне", field: "IT, аналитика, финансы, продукт", link: "https://sberstudent.ru/internship" },
  { id: "ev6", audience: "student", type: "internship", title: "Т1 Дебют", org: "Т1 (экосистема Т-Банка)", window: "Есть сезонные волны набора в течение года", field: "Backend, frontend, data, QA", link: "https://career.t1.ru/debut/internship" },
  { id: "ev7", audience: "student", type: "internship", title: "Яндекс Тренировки и стажировки", org: "Яндекс", window: "Тренировки по алгоритмам идут круглый год бесплатно, стажировки — по волнам набора", field: "Backend, frontend, ML, аналитика", link: "" },
  { id: "ev8", audience: "student", type: "internship", title: "Весенняя стажировка Банка России", org: "Банк России", window: "Обычно открывается в феврале–марте", field: "Финансы, экономика, IT, регуляторика", link: "" },
];

/* ---------------- Laurel (signature rank badge) ---------------- */
function Laurel({ rank, size = 40 }) {
  const tier = rank === 1 ? "var(--gold)" : rank === 2 ? "var(--silver)" : rank === 3 ? "var(--bronze)" : null;
  if (!tier) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", border: "2px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--muted)", fontSize: size * 0.36, flexShrink: 0 }}>
        {rank}
      </div>
    );
  }
  const leafPath = "M0,0 C-5,-7 -5,-16 0,-22 C5,-16 5,-7 0,0 Z";
  const angles = [-6, -28, -50, -72, -95];
  const pivot = { x: 15, y: 41 };
  const leaves = angles.map((a, i) => (
    <g key={i} transform={`translate(${pivot.x} ${pivot.y}) rotate(${a})`}>
      <path d={leafPath} fill={tier} opacity={0.5 + i * 0.1} />
    </g>
  ));
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{ flexShrink: 0 }}>
      <g>{leaves}</g>
      <g transform="translate(60,0) scale(-1,1)">{leaves}</g>
      <circle cx="30" cy="26" r="14" fill={tier} stroke="var(--text)" strokeWidth="1.2" />
      <text x="30" y="31" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="700" fontSize="14" fill="var(--bg)">{rank}</text>
    </svg>
  );
}

/* ---------------- shared UI bits ---------------- */
function Ava({ value, big, size }) {
  const cls = big ? "k-avatar-lg" : "k-avatar-sm";
  const style = size ? { width: size, height: size, fontSize: size * 0.5 } : undefined;
  if (typeof value === "string" && value.startsWith("data:")) {
    return <img src={value} alt="" className={cls} style={{ ...style, objectFit: "cover" }} />;
  }
  return <div className={cls} style={style}>{value}</div>;
}
function AvatarPicker({ avatar, onChange }) {
  const fileRef = useRef(null);
  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { onChange(await resizeImage(f, 320, 0.85)); } catch (e) {}
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Ava value={avatar} big /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {AVATARS.map((a) => (
          <button key={a} type="button" onClick={() => onChange(a)} className="k-avatarpick" data-active={avatar === a}>{a}</button>
        ))}
      </div>
      <button type="button" className="k-dashed" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>
        <Camera size={16} /> Загрузить свою фотографию
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </div>
  );
}
function Tag({ children }) { return <span className="k-tag">{children}</span>; }
function IconBtn({ children, onClick, disabled, title }) {
  return <button className="k-iconbtn" onClick={onClick} disabled={disabled} title={title} type="button">{children}</button>;
}
function Sheet({ title, onClose, children }) {
  return (
    <div className="k-overlay" onClick={onClose}>
      <div className="k-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="k-sheet-head">
          <span>{title}</span>
          <button onClick={onClose} className="k-iconbtn" type="button"><X size={18} /></button>
        </div>
        <div className="k-sheet-body">{children}</div>
      </div>
    </div>
  );
}
function ScreenHeader({ title, subtitle }) {
  return (
    <div style={{ padding: "20px 16px 12px" }}>
      <div className="k-display" style={{ fontSize: 21, color: "var(--text)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{subtitle}</div>
    </div>
  );
}
function Empty({ text }) {
  return <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: "40px 20px" }}>{text}</div>;
}
function ChipRow({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={o} type="button" className="k-chip" data-active={value === o} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

/* ---------------- Onboarding ---------------- */
function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [university, setUniversity] = useState(UNIVERSITIES[0]);
  const [universityOther, setUniversityOther] = useState("");
  const [grade, setGrade] = useState(GRADES[2]);
  const [interest, setInterest] = useState(INTERESTS[0]);

  const steps = ["email", "code", "name", "survey"];
  const stepIdx = steps.indexOf(step);
  const nameOk = name.trim().split(/\s+/).filter(Boolean).length >= 2;

  return (
    <div className="k-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 640 }}>
      <div style={{ width: "100%", maxWidth: 340, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div className="k-wordmark">KLEO</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Твои олимпиады, проекты и бизнес — в одном рейтинге</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 14 }}>
            {steps.map((s, i) => (
              <div key={s} style={{ width: 20, height: 4, borderRadius: 3, background: i <= stepIdx ? "var(--gold)" : "var(--line)" }} />
            ))}
          </div>
        </div>

        {step === "email" && (
          <div className="k-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Вход по почте</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Демо-режим: письмо реально не отправляется. Подойдёт любой код из 4+ цифр.
            </div>
            <input className="k-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
            <button className="k-btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={!email.includes("@")} onClick={() => setStep("code")}>
              <Mail size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Отправить код
            </button>
          </div>
        )}

        {step === "code" && (
          <div className="k-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Введите код</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>Демо: подойдёт любой код из 4+ цифр — отправлен на {email}</div>
            <input className="k-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="0000" maxLength={6} style={{ textAlign: "center", letterSpacing: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 19 }} />
            <button className="k-btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={code.length < 4} onClick={() => setStep("name")}>Подтвердить</button>
          </div>
        )}

        {step === "name" && (
          <div className="k-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>Фамилия Имя Отчество</div>
            <input className="k-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Кравцова Софья Игоревна" maxLength={60} />
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
              Указывай так же, как в дипломах — при добавлении олимпиады мы будем сверять эти данные.
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", margin: "18px 0 8px", fontWeight: 600 }}>Аватар</div>
            <AvatarPicker avatar={avatar} onChange={setAvatar} />
            <button className="k-btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={!nameOk} onClick={() => setStep("survey")}>Далее</button>
            {!nameOk && name.trim() && <div style={{ fontSize: 11, color: "var(--signal)", marginTop: 6 }}>Укажи хотя бы имя и фамилию.</div>}
          </div>
        )}

        {step === "survey" && (
          <div className="k-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>В какой вуз хочешь поступить?</div>
            <ChipRow options={UNIVERSITIES} value={university} onChange={setUniversity} />
            {university === "Другой" && (
              <input className="k-input" style={{ marginTop: 8 }} value={universityOther} onChange={(e) => setUniversityOther(e.target.value)} placeholder="Название вуза" />
            )}
            <div style={{ fontSize: 12, color: "var(--muted)", margin: "18px 0 8px", fontWeight: 600 }}>Класс / статус</div>
            <ChipRow options={GRADES} value={grade} onChange={setGrade} />
            <div style={{ fontSize: 12, color: "var(--muted)", margin: "18px 0 8px", fontWeight: 600 }}>Профиль интересов</div>
            <ChipRow options={INTERESTS} value={interest} onChange={setInterest} />
            <button
              className="k-btn-primary" style={{ width: "100%", marginTop: 20 }}
              onClick={() => onDone({
                email, name: name.trim(), avatar,
                university: university === "Другой" ? (universityOther.trim() || "Другой") : university,
                grade, interest,
              })}
            >
              Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Feed Components ---------------- */
function Compose({ onClose, onSubmit }) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState(TAGS_POST[0]);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try { setPhoto(await resizeImage(f)); } catch (e) {}
    setBusy(false);
  }

  return (
    <Sheet title="Новый пост" onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {TAGS_POST.map((t) => (
          <button key={t} type="button" className="k-chip" data-active={tag === t} onClick={() => setTag(t)}>{t}</button>
        ))}
      </div>
      <textarea className="k-input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Что произошло, о чём думаешь, что хочешь спросить?" style={{ resize: "none" }} />
      {photo ? (
        <div style={{ position: "relative", marginTop: 10 }}>
          <img src={photo} alt="" style={{ width: "100%", borderRadius: 14, display: "block" }} />
          <button className="k-iconbtn" onClick={() => setPhoto(null)} style={{ position: "absolute", top: 6, right: 6, background: "rgba(21,23,28,0.7)", color: "#fff", borderColor: "transparent" }} type="button"><X size={16} /></button>
        </div>
      ) : (
        <button type="button" className="k-dashed" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Camera size={16} /> {busy ? "Загружаю фото…" : "Добавить фото"}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <button className="k-btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={!text.trim()} onClick={() => onSubmit({ text: text.trim(), tag, photo })}>Опубликовать</button>
    </Sheet>
  );
}

function PostCard({ post, me, onLike, onComment, onOpenProfile }) {
  const liked = post.likes.includes(me.userId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const comments = post.comments || [];

  function submit() {
    if (!draft.trim()) return;
    onComment(post.id, draft.trim());
    setDraft("");
  }

  return (
    <div className="k-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button type="button" onClick={() => onOpenProfile && onOpenProfile(post.authorId)} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
          <Ava value={post.authorAvatar} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{post.authorName}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{timeAgo(post.createdAt)}</div>
          </div>
        </button>
        <Tag>{post.tag}</Tag>
      </div>
      <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{post.text}</div>
      {post.photo && <img src={post.photo} alt="" style={{ width: "100%", borderRadius: 14, marginTop: 10, display: "block" }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 12 }}>
        <button type="button" onClick={() => onLike(post.id)} className="k-like" data-active={liked}>
          <Heart size={15} fill={liked ? "var(--signal)" : "none"} /> {post.likes.length}
        </button>
        <button type="button" onClick={() => setOpen(!open)} className="k-like">
          <MessageCircle size={15} /> {comments.length}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          {comments.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Комментариев пока нет.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 10 }}>
            {comments.map((c) => (
              <button key={c.id} type="button" onClick={() => onOpenProfile && onOpenProfile(c.authorId)} style={{ display: "flex", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}>
                <Ava value={c.authorAvatar} size={26} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{c.authorName} <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 10.5 }}>· {timeAgo(c.createdAt)}</span></div>
                  <div style={{ fontSize: 12.5, color: "var(--text)" }}>{c.text}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input className="k-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Написать комментарий…" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
            <IconBtn onClick={submit} disabled={!draft.trim()}><Send size={14} /></IconBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedScreen({ me, posts, onLike, onComment, onCompose, onOpenProfile }) {
  return (
    <div>
      <ScreenHeader title="Лента" subtitle="Успехи, мысли и вопросы участников" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 14px 90px" }}>
        {posts.length === 0 && <Empty text="Пока пусто. Стань первым, кто поделится чем-то." />}
        {posts.map((p) => <PostCard key={p.id} post={p} me={me} onLike={onLike} onComment={onComment} onOpenProfile={onOpenProfile} />)}
      </div>
      <button className="k-fab" onClick={onCompose} type="button"><Plus size={22} /></button>
    </div>
  );
}

/* ---------------- Rating Components ---------------- */
function RankRow({ rank, avatar, name, university, right, isMe, onClick }) {
  return (
    <div className="k-card k-rankrow" data-me={isMe} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: onClick ? "pointer" : "default" }}>
      <Laurel rank={rank} size={38} />
      <Ava value={avatar} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}{isMe ? " (ты)" : ""}</div>
        {university && <div style={{ fontSize: 11, color: "var(--muted)" }}>{university}</div>}
      </div>
      {right}
    </div>
  );
}

function RatingScreen({ me, board, achievements, onOpenProfile }) {
  const [subTab, setSubTab] = useState("overall");
  const [subject, setSubject] = useState(OLYMPIAD_SUBJECTS[0]);

  const overallRows = useMemo(() => {
    const list = Object.entries(board).map(([id, s]) => ({ id, ...s }));
    list.sort((a, b) => (b.score || 0) - (a.score || 0));
    return list;
  }, [board]);

  const subjectRows = useMemo(() => {
    const rows = {};
    Object.entries(SEED_ACHIEVEMENTS).forEach(([id, achs]) => {
      const sum = achs.filter((a) => a.type === "olympiad" && a.subject === subject).reduce((s, a) => s + a.weight, 0);
      if (sum > 0) rows[id] = { id, score: sum, ...SEED_META[id] };
    });
    const mySum = achievements.filter((a) => a.type === "olympiad" && a.subject === subject).reduce((s, a) => s + a.weight, 0);
    if (mySum > 0) rows[me.userId] = { id: me.userId, score: mySum, name: me.name, avatar: me.avatar, university: me.university };
    
    const list = Object.values(rows);
    list.sort((a, b) => b.score - a.score);
    return list;
  }, [subject, achievements, me]);

  return (
    <div>
      <ScreenHeader title="Рейтинг" subtitle="Сводный рейтинг участников по олимпиадам и проектам" />
      <div style={{ padding: "0 14px 90px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button className="k-chip" data-active={subTab === "overall"} onClick={() => setSubTab("overall")}>Общий</button>
          <button className="k-chip" data-active={subTab === "subject"} onClick={() => setSubTab("subject")}>По предметам</button>
        </div>

        {subTab === "subject" && (
          <div style={{ marginBottom: 14 }}>
            <ChipRow options={OLYMPIAD_SUBJECTS} value={subject} onChange={setSubject} />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(subTab === "overall" ? overallRows : subjectRows).map((row, i) => (
            <RankRow
              key={row.id}
              rank={i + 1}
              avatar={row.avatar}
              name={row.name}
              university={row.university}
              isMe={row.id === me.userId}
              onClick={() => onOpenProfile && onOpenProfile(row.id)}
              right={<div style={{ fontWeight: 700, fontSize: 15, color: "var(--gold)" }}>{row.score}</div>}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main Application Shell ---------------- */
export default function App() {
  // 1. Инициализация состояний с автоматической загрузкой из localStorage
  const [me, setMe] = useState(() => {
    const saved = localStorage.getItem("kleo_me");
    return saved ? JSON.parse(saved) : null;
  });

  const [posts, setPosts] = useState(() => {
    const saved = localStorage.getItem("kleo_posts");
    return saved ? JSON.parse(saved) : SEED_POSTS;
  });

  const [achievements, setAchievements] = useState(() => {
    const saved = localStorage.getItem("kleo_achievements");
    return saved ? JSON.parse(saved) : [];
  });

  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem("kleo_chats");
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState("feed");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  // 2. Эффекты сохранности данных через localStorage
  useEffect(() => {
    if (me) localStorage.setItem("kleo_me", JSON.stringify(me));
    else localStorage.removeItem("kleo_me");
  }, [me]);

  useEffect(() => {
    localStorage.setItem("kleo_posts", JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem("kleo_achievements", JSON.stringify(achievements));
  }, [achievements]);

  useEffect(() => {
    localStorage.setItem("kleo_chats", JSON.stringify(chats));
  }, [chats]);

  // Расчет суммарного рейтинга
  const leaderboard = useMemo(() => {
    const board = { ...SEED_LEADERBOARD };
    if (me) {
      let myScore = 0;
      let olympiads = 0, projects = 0, businesses = 0;
      achievements.forEach((a) => {
        myScore += a.weight || 0;
        if (a.type === "olympiad") olympiads++;
        if (a.type === "project") projects++;
        if (a.type === "business") businesses++;
      });
      board[me.userId] = {
        name: me.name,
        avatar: me.avatar,
        university: me.university,
        score: myScore,
        olympiads,
        projects,
        businesses
      };
    }
    return board;
  }, [me, achievements]);

  // Хэндлеры пользовательских действий
  function handleOnboardingDone(profileData) {
    const newMe = { userId: uid(), ...profileData, bio: "" };
    setMe(newMe);
  }

  function handleCreatePost({ text, tag, photo }) {
    if (!me) return;
    const newPost = {
      id: uid(),
      authorId: me.userId,
      authorName: me.name,
      authorAvatar: me.avatar,
      tag,
      text,
      photo,
      likes: [],
      comments: [],
      createdAt: Date.now()
    };
    setPosts([newPost, ...posts]);
    setComposeOpen(false);
  }

  function handleToggleLike(postId) {
    if (!me) return;
    setPosts(posts.map((p) => {
      if (p.id !== postId) return p;
      const has = p.likes.includes(me.userId);
      return {
        ...p,
        likes: has ? p.likes.filter((id) => id !== me.userId) : [...p.likes, me.userId]
      };
    }));
  }

  function handleAddComment(postId, text) {
    if (!me) return;
    const comment = {
      id: uid(),
      authorId: me.userId,
      authorName: me.name,
      authorAvatar: me.avatar,
      text,
      createdAt: Date.now()
    };
    setPosts(posts.map((p) => {
      if (p.id !== postId) return p;
      return { ...p, comments: [...(p.comments || []), comment] };
    }));
  }

  function handleLogout() {
    localStorage.clear();
    setMe(null);
    setAchievements([]);
  }

  if (!me) {
    return <OnboardingWizard onDone={handleOnboardingDone} />;
  }

  return (
    <div className="k-root">
      <div className="k-container">
        {activeTab === "feed" && (
          <FeedScreen
            me={me}
            posts={posts}
            onLike={handleToggleLike}
            onComment={handleAddComment}
            onCompose={() => setComposeOpen(true)}
            onOpenProfile={(id) => setSelectedProfileId(id)}
          />
        )}

        {activeTab === "rating" && (
          <RatingScreen
            me={me}
            board={leaderboard}
            achievements={achievements}
            onOpenProfile={(id) => setSelectedProfileId(id)}
          />
        )}

        {activeTab === "profile" && (
          <div style={{ padding: 16 }}>
            <ScreenHeader title="Профиль" subtitle="Твои персональные настройки и достижения" />
            <div className="k-card" style={{ padding: 20, textAlign: "center", marginBottom: 16 }}>
              <Ava value={me.avatar} big />
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 10 }}>{me.name}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{me.university} · {me.grade}</div>
              <button
                className="k-btn-primary"
                style={{ marginTop: 16, background: "var(--signal)", width: "100%" }}
                onClick={handleLogout}
              >
                <LogOut size={16} style={{ marginRight: 6, verticalAlign: -2 }} /> Выйти из аккаунта
              </button>
            </div>
          </div>
        )}

        {/* Попап создания поста */}
        {composeOpen && (
          <Compose onClose={() => setComposeOpen(false)} onSubmit={handleCreatePost} />
        )}

        {/* Нижнее навигационное меню */}
        <div className="k-bottom-nav">
          <button className="k-nav-item" data-active={activeTab === "feed"} onClick={() => setActiveTab("feed")}>
            <BookOpen size={20} />
            <span>Лента</span>
          </button>
          <button className="k-nav-item" data-active={activeTab === "rating"} onClick={() => setActiveTab("rating")}>
            <Trophy size={20} />
            <span>Рейтинг</span>
          </button>
          <button className="k-nav-item" data-active={activeTab === "profile"} onClick={() => setActiveTab("profile")}>
            <User size={20} />
            <span>Профиль</span>
          </button>
        </div>
      </div>
    </div>
  );
}