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

/* демо-сообщество: без настоящего backend других реальных пользователей нет,
   эти профили нужны, чтобы рейтинги и публичные профили было с чем показывать */
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
function eventIcon(type) {
  if (type === "internship") return Briefcase;
  if (type === "forum") return Calendar;
  return GraduationCap;
}

const AUTO_REPLIES = [
  "Привет! Спасибо, что написал(а) 🙂",
  "О, интересно! Как готовишься к следующей олимпиаде?",
  "Круто, давай как-нибудь сравним результаты!",
  "Спасибо! Заходи на мой профиль, там есть свежие достижения.",
  "Согласен(на), звучит интересно — расскажи подробнее?",
];

/* ---------------- AI diploma verification ---------------- */
async function verifyDiploma(photoDataUrl, hintText) {
  const base64 = photoDataUrl.split(",")[1];
  const system = `Ты — ассистент, который проверяет дипломы школьных олимпиад для профиля ученика.
По фото диплома определи: название олимпиады, предмет, результат (победитель/призёр/участник), год, ФИО получателя диплома (как оно написано на дипломе) и к какому уровню олимпиада относится.
Уровни для классификации (используй ключ level_key ровно из списка):
- "intl" — международная олимпиада (IMO, IPhO, IChO и т.п.)
- "vos_final" — Всероссийская олимпиада школьников (ВОШ), заключительный этап
- "lvl1" — олимпиада I уровня по перечню Минобрнауки/РСОШ
- "lvl2" — олимпиада II уровня по перечню
- "lvl3" — олимпиада III уровня по перечню (обычно менее известные предметные олимпиады)
- "regional" — региональный, муниципальный или школьный этап, либо олимпиада не из перечня
- "unknown" — не удалось определить уровень
Если название олимпиады тебе не знакомо, воспользуйся веб-поиском, чтобы проверить, в каком перечне и уровне она числится, международная она или нет.
Поле subject укажи одним словом из: Математика, Физика, Информатика, Химия, Биология, Экономика, Другое.
Поле recipient_name — ФИО получателя диплома точно как написано на дипломе, или пустая строка, если не удалось прочитать.
Ответь СТРОГО в виде JSON без markdown и пояснений вокруг, в таком формате:
{"olympiad_name":"...","subject":"...","result":"...","year":"...","recipient_name":"...","level_key":"...","confidence":"high|medium|low","authenticity_flag":"looks_valid|uncertain|unclear_image","reasoning":"1-2 предложения на русском"}`;

  const userText = hintText
    ? `Дополнительная информация от пользователя (может быть неточной): ${hintText}`
    : "Определи данные с этого диплома.";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: userText },
          ],
        },
      ],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  const data = await response.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : clean);
}

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

/* ---------------- Onboarding (email -> code -> profile -> survey) ---------------- */
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
              Демо-режим: письмо реально не отправляется. В настоящем приложении здесь будет код на почту и проверка через сервер.
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
              Указывай так же, как в дипломах — при добавлении олимпиады мы будем сверять эти данные, чтобы никто не мог присвоить чужие достижения.
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

/* ---------------- Feed ---------------- */
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

/* ---------------- Rating ---------------- */
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
    return Object.values(rows).sort((a, b) => b.score - a.score);
  }, [subject, achievements, me]);

  const businessRows = useMemo(() => {
    const rows = {};
    Object.entries(SEED_ACHIEVEMENTS).forEach(([id, achs]) => {
      const list = achs.filter((a) => a.type === "business");
      if (list.length) rows[id] = { id, score: list.reduce((s, a) => s + a.weight, 0), count: list.length, ...SEED_META[id] };
    });
    const myList = achievements.filter((a) => a.type === "business");
    if (myList.length) rows[me.userId] = { id: me.userId, score: myList.reduce((s, a) => s + a.weight, 0), count: myList.length, name: me.name, avatar: me.avatar, university: me.university };
    return Object.values(rows).sort((a, b) => b.score - a.score);
  }, [achievements, me]);

  const universityRows = useMemo(() => {
    const counts = {};
    Object.values(SEED_META).forEach((m) => { counts[m.university] = (counts[m.university] || 0) + 1; });
    counts[me.university] = (counts[me.university] || 0) + 1;
    const arr = Object.entries(counts).map(([university, count]) => ({ university, count }));
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }, [me]);
  const maxUniCount = Math.max(1, ...universityRows.map((r) => r.count));

  return (
    <div>
      <ScreenHeader title="Рейтинг" subtitle="Общий счёт, разбивка по предметам, бизнесам и вузам мечты" />
      <div style={{ padding: "0 14px 12px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["overall", "Общий"], ["subject", "Предметы"], ["business", "Бизнесы"], ["university", "Вузы"]].map(([k, label]) => (
            <button key={k} type="button" className="k-chip" data-active={subTab === k} onClick={() => setSubTab(k)}>{label}</button>
          ))}
        </div>
        {subTab === "subject" && (
          <div style={{ marginTop: 8 }}><ChipRow options={OLYMPIAD_SUBJECTS} value={subject} onChange={setSubject} /></div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 14px 90px" }}>
        {subTab === "overall" && overallRows.map((r, i) => (
          <RankRow key={r.id} rank={i + 1} avatar={r.avatar} name={r.name} university={`О:${r.olympiads || 0} П:${r.projects || 0} Б:${r.businesses || 0}`} isMe={r.id === me.userId}
            onClick={() => onOpenProfile(r.id)} right={<div className="k-mono-score">{r.score || 0}</div>} />
        ))}

        {subTab === "subject" && (
          subjectRows.length === 0
            ? <Empty text={`Пока никто не отметил достижения по предмету «${subject}».`} />
            : subjectRows.map((r, i) => (
              <RankRow key={r.id} rank={i + 1} avatar={r.avatar} name={r.name} university={r.university} isMe={r.id === me.userId}
                onClick={() => onOpenProfile(r.id)} right={<div className="k-mono-score">{r.score}</div>} />
            ))
        )}

        {subTab === "business" && (
          businessRows.length === 0
            ? <Empty text="Пока никто не отметил бизнес-достижения." />
            : businessRows.map((r, i) => (
              <RankRow key={r.id} rank={i + 1} avatar={r.avatar} name={r.name} university={`${r.count} бизнес${r.count === 1 ? "" : "а"}`} isMe={r.id === me.userId}
                onClick={() => onOpenProfile(r.id)} right={<div className="k-mono-score">{r.score}</div>} />
            ))
        )}

        {subTab === "university" && universityRows.map((r) => (
          <div key={r.university} className="k-card" style={{ padding: "13px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{r.university}</span>
              <span className="k-mono-score">{r.count}</span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: "var(--line)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(r.count / maxUniCount) * 100}%`, background: "linear-gradient(90deg, var(--bronze), var(--gold))", borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Journal ---------------- */
function JournalEditor({ onClose, onSubmit, initial }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [tag, setTag] = useState(initial?.tag || TAGS_JOURNAL[0]);
  const [text, setText] = useState(initial?.text || "");
  return (
    <Sheet title={initial ? "Изменить запись" : "Новая запись"} onClose={onClose}>
      <input className="k-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" maxLength={60} />
      <div style={{ display: "flex", gap: 6, margin: "10px 0", flexWrap: "wrap" }}>
        {TAGS_JOURNAL.map((t) => (
          <button key={t} type="button" className="k-chip" data-active={tag === t} onClick={() => setTag(t)}>{t}</button>
        ))}
      </div>
      <textarea className="k-input" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="О чём думаешь перед олимпиадой, что получилось на подготовке, что запомнить на будущее…" style={{ resize: "none" }} />
      <button className="k-btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={!title.trim() || !text.trim()} onClick={() => onSubmit({ title: title.trim(), tag, text: text.trim() })}>Сохранить</button>
    </Sheet>
  );
}

function JournalScreen({ entries, onAdd, onEdit, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  return (
    <div>
      <ScreenHeader title="Дневник" subtitle="Только ты видишь эти записи" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 14px 90px" }}>
        {entries.length === 0 && <Empty text="Записей пока нет. Начни с мысли о следующей олимпиаде." />}
        {entries.map((e) => (
          <div key={e.id} className="k-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setOpen(open === e.id ? null : e.id)}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{e.title}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{e.tag} · {timeAgo(e.createdAt)}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <IconBtn title="Изменить" onClick={() => setEditing(e)}><Pencil size={15} /></IconBtn>
                <IconBtn title="Удалить" onClick={() => onDelete(e.id)}><Trash2 size={15} /></IconBtn>
              </div>
            </div>
            {open === e.id && <div style={{ fontSize: 13.5, color: "var(--text)", marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.text}</div>}
          </div>
        ))}
      </div>
      <button className="k-fab" onClick={() => setEditing({})} type="button"><Plus size={22} /></button>
      {editing && (
        <JournalEditor
          initial={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSubmit={(data) => { editing.id ? onEdit(editing.id, data) : onAdd(data); setEditing(null); }}
        />
      )}
    </div>
  );
}

/* ---------------- Events ---------------- */
function EventsScreen({ profile }) {
  const [audience, setAudience] = useState(profile.grade === "Студент" ? "student" : "school");
  const rows = EVENTS.filter((e) => e.audience === audience);
  return (
    <div>
      <ScreenHeader title="События" subtitle="Регистрации на олимпиады, форумы и стажировки" />
      <div style={{ padding: "0 14px 12px" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="k-chip" data-active={audience === "school"} onClick={() => setAudience("school")}>Школьникам</button>
          <button type="button" className="k-chip" data-active={audience === "student"} onClick={() => setAudience("student")}>Студентам</button>
        </div>
      </div>
      <div style={{ padding: "0 14px 8px" }}>
        <div className="k-card" style={{ padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(201,154,61,0.06)", borderColor: "rgba(201,154,61,0.3)" }}>
          <Info size={14} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
            Даты и условия каждый год немного смещаются — это ориентир по открытым источникам. Перед подачей проверяй официальный сайт организатора.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 14px 90px" }}>
        {rows.map((e) => {
          const Icon = eventIcon(e.type);
          return (
            <div key={e.id} className="k-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(201,154,61,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} style={{ color: "var(--gold)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{e.org}</div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text)", marginTop: 10, lineHeight: 1.5 }}>{e.window}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <Tag>{e.field}</Tag>
                {e.link ? (
                  <a href={e.link} target="_blank" rel="noopener noreferrer" className="k-chip" style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
                    Перейти <ExternalLink size={12} />
                  </a>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>ищи на сайте организации</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Achievement add (mandatory AI + identity + duplicate check) ---------------- */
function AchievementAdd({ onClose, onSubmit, profileName, existingAchievements }) {
  const [type, setType] = useState("olympiad");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [subject, setSubject] = useState(OLYMPIAD_SUBJECTS[0]);
  const [photo, setPhoto] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [levelKey, setLevelKey] = useState("unknown");
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAiResult(null);
    setAiError(null);
    setConfirmMismatch(false);
    try { setPhoto(await resizeImage(f, 900, 0.8)); } catch (e) {}
  }

  async function runAiCheck() {
    setAiLoading(true);
    setAiError(null);
    try {
      const hint = [title && `название/предмет: ${title}`, link && `ссылка: ${link}`].filter(Boolean).join("; ");
      const result = await verifyDiploma(photo, hint);
      setAiResult(result);
      if (result.olympiad_name) setTitle(result.olympiad_name);
      const found = OLYMPIAD_LEVELS.find((l) => l.key === result.level_key);
      setLevelKey(found ? found.key : "unknown");
      setSubject(matchSubject(result.subject));
    } catch (e) {
      setAiError("Не удалось выполнить проверку. Проверь соединение и попробуй ещё раз — без проверки олимпиаду добавить нельзя.");
    }
    setAiLoading(false);
  }

  const weight = type === "olympiad" ? levelInfo(levelKey).weight : type === "project" ? PROJECT_WEIGHT : BUSINESS_WEIGHT;
  const nameMatch = aiResult ? nameMatches(aiResult.recipient_name, profileName) : null;
  const duplicate = type === "olympiad" && title.trim() && isDuplicateOlympiad(title, existingAchievements);
  const identityOk = nameMatch === true || confirmMismatch;
  const canSubmitOlympiad = !!aiResult && identityOk && !duplicate;
  const canSubmit = type === "olympiad" ? canSubmitOlympiad && title.trim() : !!title.trim();

  return (
    <Sheet title="Новое достижение" onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["olympiad", "Олимпиада"], ["project", "Проект"], ["business", "Бизнес"]].map(([k, label]) => (
          <button key={k} type="button" className="k-chip" data-active={type === k} onClick={() => setType(k)}>{label}</button>
        ))}
      </div>

      <input className="k-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "olympiad" ? "Название олимпиады (заполнится после AI-проверки)" : type === "project" ? "Название проекта" : "Название бизнеса"} />

      {type === "olympiad" && (
        <>
          <div className="k-notice">
            <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Для олимпиады обязательна проверка диплома через AI — без неё добавить достижение нельзя.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
            <LinkIcon size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
            <input className="k-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Ссылка на результаты (необязательно)" />
          </div>

          {photo ? (
            <div style={{ position: "relative", marginTop: 10 }}>
              <img src={photo} alt="" style={{ width: "100%", borderRadius: 14, display: "block" }} />
              <button className="k-iconbtn" onClick={() => { setPhoto(null); setAiResult(null); setConfirmMismatch(false); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(21,23,28,0.7)", color: "#fff", borderColor: "transparent" }} type="button"><X size={16} /></button>
            </div>
          ) : (
            <button type="button" className="k-dashed" onClick={() => fileRef.current?.click()}>
              <Camera size={16} /> Загрузить фото диплома
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

          {photo && !aiResult && (
            <button type="button" className="k-btn-ai" onClick={runAiCheck} disabled={aiLoading}>
              {aiLoading ? <><Loader2 size={14} className="k-spin" style={{ marginRight: 6, verticalAlign: -2 }} />Проверяю…</> : <><Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Проверить с AI (обязательно)</>}
            </button>
          )}
          {aiError && <div style={{ fontSize: 12, color: "var(--signal)", marginTop: 8 }}>{aiError}</div>}

          {aiResult && (
            <>
              <div className="k-card" style={{ padding: 12, marginTop: 10, background: "rgba(201,154,61,0.06)", borderColor: "rgba(201,154,61,0.35)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <ShieldCheck size={15} style={{ color: "var(--gold)" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Оценка AI</span>
                  <span style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: "auto" }}>уверенность: {aiResult.confidence || "—"}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5 }}>
                  {aiResult.subject && <>Предмет: {aiResult.subject}. </>}
                  {aiResult.result && <>Результат: {aiResult.result}. </>}
                  {aiResult.year && <>Год: {aiResult.year}. </>}
                  {aiResult.recipient_name && <>ФИО на дипломе: {aiResult.recipient_name}. </>}
                </div>
                {aiResult.reasoning && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{aiResult.reasoning}</div>}
                {aiResult.authenticity_flag === "uncertain" && <div style={{ fontSize: 11.5, color: "var(--signal)", marginTop: 4 }}>AI не уверен в подлинности — проверь вручную.</div>}
              </div>

              {nameMatch === true && (
                <div className="k-notice k-notice-ok"><BadgeCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} /> Имя на дипломе совпадает с профилем — это твой диплом.</div>
              )}
              {nameMatch !== true && (
                <div className="k-notice k-notice-warn">
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    {nameMatch === false
                      ? <>Имя на дипломе («{aiResult.recipient_name}») не совпадает с профилем («{profileName}»).</>
                      : <>Не удалось прочитать ФИО на дипломе.</>}
                    <label style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 6, fontSize: 12, cursor: "pointer" }}>
                      <input type="checkbox" checked={confirmMismatch} onChange={(e) => setConfirmMismatch(e.target.checked)} style={{ marginTop: 2 }} />
                      Подтверждаю, что это мой диплом (например, ФИО написано иначе)
                    </label>
                  </div>
                </div>
              )}

              {duplicate && (
                <div className="k-notice k-notice-warn">
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  Такая олимпиада уже есть в твоём профиле — повторно добавить её нельзя. Если это ошибка, отредактируй существующую запись.
                </div>
              )}

              <div style={{ fontSize: 12, color: "var(--muted)", margin: "16px 0 8px", fontWeight: 600 }}>Предмет</div>
              <ChipRow options={OLYMPIAD_SUBJECTS} value={subject} onChange={setSubject} />

              <div style={{ fontSize: 12, color: "var(--muted)", margin: "16px 0 8px", fontWeight: 600 }}>Уровень олимпиады (можно поправить)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {OLYMPIAD_LEVELS.map((l) => (
                  <button key={l.key} type="button" className="k-levelrow" data-active={levelKey === l.key} onClick={() => setLevelKey(l.key)}>
                    <span>{l.label}</span>
                    <span className="k-mono-score" style={{ fontSize: 13 }}>{l.weight}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Очков за достижение</span>
        <span className="k-mono-score" style={{ fontSize: 19 }}>{weight}</span>
      </div>
      <button
        className="k-btn-primary" style={{ width: "100%", marginTop: 10 }}
        disabled={!canSubmit}
        onClick={() => onSubmit({
          type, title: title.trim(), link: link.trim(),
          subject: type === "olympiad" ? subject : null,
          levelKey: type === "olympiad" ? levelKey : null,
          weight, aiChecked: type === "olympiad" ? true : false, aiNote: aiResult?.reasoning || "",
        })}
      >
        Добавить
      </button>
    </Sheet>
  );
}

/* ---------------- Profile editing ---------------- */
function ProfileEditor({ profile, onClose, onSubmit }) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [avatar, setAvatar] = useState(profile.avatar);
  return (
    <Sheet title="Редактировать профиль" onClose={onClose}>
      <AvatarPicker avatar={avatar} onChange={setAvatar} />
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "16px 0 8px", fontWeight: 600 }}>Фамилия Имя Отчество</div>
      <input className="k-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>Это имя сверяется с дипломами при добавлении олимпиад.</div>
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "16px 0 8px", fontWeight: 600 }}>Почта</div>
      <input className="k-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
      <button className="k-btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={!name.trim()} onClick={() => onSubmit({ name: name.trim(), email: email.trim(), avatar })}>Сохранить</button>
    </Sheet>
  );
}
function SurveyEditor({ profile, onClose, onSubmit }) {
  const [university, setUniversity] = useState(UNIVERSITIES.includes(profile.university) ? profile.university : "Другой");
  const [universityOther, setUniversityOther] = useState(UNIVERSITIES.includes(profile.university) ? "" : profile.university || "");
  const [grade, setGrade] = useState(profile.grade || GRADES[2]);
  const [interest, setInterest] = useState(profile.interest || INTERESTS[0]);
  return (
    <Sheet title="Анкета" onClose={onClose}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>Желаемый вуз</div>
      <ChipRow options={UNIVERSITIES} value={university} onChange={setUniversity} />
      {university === "Другой" && <input className="k-input" style={{ marginTop: 8 }} value={universityOther} onChange={(e) => setUniversityOther(e.target.value)} placeholder="Название вуза" />}
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "16px 0 8px", fontWeight: 600 }}>Класс / статус</div>
      <ChipRow options={GRADES} value={grade} onChange={setGrade} />
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "16px 0 8px", fontWeight: 600 }}>Профиль интересов</div>
      <ChipRow options={INTERESTS} value={interest} onChange={setInterest} />
      <button className="k-btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => onSubmit({ university: university === "Другой" ? (universityOther.trim() || "Другой") : university, grade, interest })}>Сохранить</button>
    </Sheet>
  );
}

/* ---------------- Search ---------------- */
function SearchScreen({ query, setQuery, profiles, posts, onOpenProfile, onLike, onComment, viewerId, onBack }) {
  const q = query.trim().toLowerCase();
  const profileMatches = q ? profiles.filter((p) => p.name.toLowerCase().includes(q) || (p.university || "").toLowerCase().includes(q) || (p.interest || "").toLowerCase().includes(q)) : [];
  const postMatches = q ? posts.filter((p) => p.text.toLowerCase().includes(q)) : [];
  return (
    <div>
      <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <IconBtn onClick={onBack}><ChevronLeft size={18} /></IconBtn>
        <input className="k-input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Искать людей и посты…" />
      </div>
      <div style={{ padding: "16px 14px 90px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!q && <Empty text="Начни вводить имя, вуз, интерес или текст поста." />}
        {q && (
          <>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 8, letterSpacing: 0.4 }}>ПРОФИЛИ</div>
              {profileMatches.length === 0 ? <Empty text="Профили не найдены." /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {profileMatches.map((p) => (
                    <button key={p.id} type="button" className="k-card" style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer" }} onClick={() => onOpenProfile(p.id)}>
                      <Ava value={p.avatar} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.university}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 8, letterSpacing: 0.4 }}>ПОСТЫ</div>
              {postMatches.length === 0 ? <Empty text="Посты не найдены." /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {postMatches.map((p) => <PostCard key={p.id} post={p} me={{ userId: viewerId }} onLike={onLike} onComment={onComment} onOpenProfile={onOpenProfile} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Messages ---------------- */
function ChatsScreen({ messages, resolveIdentity, onOpenChat, onBack }) {
  const rows = Object.entries(messages)
    .map(([id, thread]) => ({ id, identity: resolveIdentity(id), last: thread[thread.length - 1] }))
    .filter((r) => r.identity && r.last)
    .sort((a, b) => b.last.createdAt - a.last.createdAt);
  return (
    <div>
      <div style={{ padding: "14px 16px 0" }}><IconBtn onClick={onBack}><ChevronLeft size={18} /></IconBtn></div>
      <ScreenHeader title="Сообщения" subtitle="Личные переписки" />
      <div style={{ padding: "0 14px 90px", display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.length === 0 && <Empty text="Пока нет переписок. Напиши кому-нибудь со страницы профиля." />}
        {rows.map((r) => (
          <button key={r.id} type="button" className="k-card" style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer" }} onClick={() => onOpenChat(r.id)}>
            <Ava value={r.identity.avatar} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>{r.identity.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.last.from === "me" ? "Вы: " : ""}{r.last.text}</div>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", flexShrink: 0 }}>{timeAgo(r.last.createdAt)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
function ChatView({ identity, thread, onBack, onSend }) {
  const [text, setText] = useState("");
  function submit() {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <IconBtn onClick={onBack}><ChevronLeft size={18} /></IconBtn>
        <Ava value={identity.avatar} />
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{identity.name}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
        {thread.length === 0 && <Empty text="Напиши первое сообщение." />}
        {thread.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
            <div className={m.from === "me" ? "k-bubble-me" : "k-bubble-them"}>{m.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, padding: "10px 14px 16px", borderTop: "1px solid var(--line)", flexShrink: 0 }}>
        <input className="k-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Написать сообщение…" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        <IconBtn onClick={submit} disabled={!text.trim()}><Send size={14} /></IconBtn>
      </div>
    </div>
  );
}

/* ---------------- Profile view (own tab AND public profiles) ---------------- */
function ProfileView({ data, rankInfo, posts, isMe, viewerId, targetUserId, onBack, onUpdate, onAddAchievement, onDeleteAchievement, onLogout, onLike, onComment, onOpenProfile, onMessage }) {
  const [innerTab, setInnerTab] = useState("posts");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openAch, setOpenAch] = useState(null);
  const [bio, setBio] = useState(data.bio || "");

  if (!data) return <Empty text="Профиль не найден." />;

  async function share() {
    const link = `kleo.app/u/${(data.name || "user").toLowerCase().replace(/\s+/g, "-")}`;
    try { await navigator.clipboard.writeText(link); } catch (e) {}
  }

  return (
    <div>
      <div style={{ padding: "14px 16px 0", minHeight: 30 }}>
        {onBack && <IconBtn onClick={onBack}><ChevronLeft size={18} /></IconBtn>}
      </div>
      <div style={{ padding: "8px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span className="k-name">{data.name}</span>
            {data.score >= 50 && <BadgeCheck size={17} style={{ color: "var(--gold)" }} />}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>🎓 {data.university || "Вуз не указан"}{data.grade ? ` · ${data.grade}` : ""}</div>
          {isMe ? (
            <textarea
              className="k-input" rows={2} value={bio} placeholder="Пара слов о себе и целях"
              onChange={(e) => setBio(e.target.value)}
              onBlur={() => onUpdate({ bio })}
              style={{ resize: "none", marginTop: 10, fontSize: 12.5 }}
            />
          ) : (
            data.bio && <div style={{ fontSize: 13, color: "var(--text)", marginTop: 8, lineHeight: 1.45 }}>{data.bio}</div>
          )}
        </div>
        <Ava value={data.avatar} big />
      </div>

      <div style={{ display: "flex", padding: "18px 16px 4px" }}>
        {[["Очки", data.score], ["Место", `#${rankInfo.rank}`], ["Записи", data.achievements.length]].map(([label, val]) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <div className="k-mono-score" style={{ fontSize: 17 }}>{val}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {isMe && (
        <div style={{ display: "flex", gap: 8, padding: "14px 16px 4px" }}>
          <button type="button" className="k-btn-outline" style={{ flex: 1 }} onClick={() => setEditingProfile(true)}>Редактировать профиль</button>
          <button type="button" className="k-btn-outline" style={{ flex: 1 }} onClick={share}>Поделиться</button>
        </div>
      )}
      {!isMe && (
        <div style={{ display: "flex", gap: 8, padding: "14px 16px 4px" }}>
          <button type="button" className="k-btn-outline" style={{ flex: 1 }} onClick={() => onMessage(targetUserId)}><MessageSquare size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Написать</button>
        </div>
      )}

      <div className="k-tabs">
        {[["posts", "Публикации"], ["achievements", "Достижения"], ["about", "О себе"]].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setInnerTab(k)} className="k-tabbtn" data-active={innerTab === k}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "14px 14px 90px", display: "flex", flexDirection: "column", gap: 10 }}>
        {innerTab === "posts" && (
          posts.length === 0 ? <Empty text="Пока нет публикаций." /> :
            posts.map((p) => <PostCard key={p.id} post={p} me={{ userId: viewerId }} onLike={onLike} onComment={onComment} onOpenProfile={onOpenProfile} />)
        )}

        {innerTab === "achievements" && (
          <>
            {data.achievements.length === 0 && <Empty text="Пока нет достижений." />}
            {data.achievements.map((a) => (
              <div key={a.id} className="k-card" style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setOpenAch(openAch === a.id ? null : a.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>{a.title}</span>
                      {a.aiChecked && <span className="k-badge-ai"><Sparkles size={10} /> AI</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {a.type === "olympiad" ? `${a.subject} · ${levelInfo(a.levelKey).label}` : a.type === "project" ? "Проект" : "Бизнес"}{a.createdAt ? ` · ${timeAgo(a.createdAt)}` : ""}
                    </div>
                  </div>
                  <span className="k-mono-score" style={{ fontSize: 15 }}>{a.weight}</span>
                  {isMe && <IconBtn title="Удалить" onClick={() => onDeleteAchievement(a.id)}><Trash2 size={14} /></IconBtn>}
                </div>
                {openAch === a.id && a.aiNote && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>{a.aiNote}</div>}
              </div>
            ))}
            {isMe && <button type="button" className="k-dashed" style={{ marginTop: 4 }} onClick={() => setAdding(true)}><Plus size={16} /> Добавить достижение</button>}
          </>
        )}

        {innerTab === "about" && (
          <>
            <div className="k-card" style={{ padding: 14 }}>
              {isMe && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{data.email}</div>}
              <div style={{ fontSize: 13, color: "var(--text)" }}>🎓 {data.university || "—"}</div>
              {data.grade && <div style={{ fontSize: 13, color: "var(--text)", marginTop: 4 }}>{data.grade}</div>}
              {data.interest && <div style={{ fontSize: 13, color: "var(--text)", marginTop: 4 }}>Интересы: {data.interest}</div>}
              {!isMe && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Демо-профиль — используется для примера рейтингов и ленты.</div>}
            </div>
            {isMe && (
              <>
                <button type="button" className="k-card" style={{ width: "100%", textAlign: "left", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setEditingSurvey(true)}>
                  <span style={{ fontSize: 13, color: "var(--text)" }}>Изменить анкету</span>
                  <Pencil size={14} style={{ color: "var(--muted)" }} />
                </button>
                <button type="button" onClick={onLogout} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
                  <LogOut size={13} /> Выйти и посмотреть экран входа
                </button>
              </>
            )}
          </>
        )}
      </div>

      {isMe && adding && (
        <AchievementAdd
          profileName={data.name} existingAchievements={data.achievements}
          onClose={() => setAdding(false)}
          onSubmit={(d) => { onAddAchievement(d); setAdding(false); }}
        />
      )}
      {isMe && editingProfile && <ProfileEditor profile={data} onClose={() => setEditingProfile(false)} onSubmit={(d) => { onUpdate(d); setEditingProfile(false); }} />}
      {isMe && editingSurvey && <SurveyEditor profile={data} onClose={() => setEditingSurvey(false)} onSubmit={(d) => { onUpdate(d); setEditingSurvey(false); }} />}
    </div>
  );
}

/* ---------------- App ---------------- */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [board, setBoard] = useState({});
  const [posts, setPosts] = useState([]);
  const [journal, setJournal] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [tab, setTab] = useState("feed");
  const [compose, setCompose] = useState(false);
  const [viewProfileId, setViewProfileId] = useState(null);
  const [messages, setMessages] = useState({});
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [chatUserId, setChatUserId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      const prof = parseOr(await safeGet("kleo_profile", false), null);

      let boardObj = parseOr(await safeGet("kleo_leaderboard", true), null);
      if (!boardObj) { boardObj = { ...SEED_LEADERBOARD }; await safeSet("kleo_leaderboard", boardObj, true); }

      let postsArr = parseOr(await safeGet("kleo_posts", true), null);
      if (!postsArr) { postsArr = SEED_POSTS; await safeSet("kleo_posts", postsArr, true); }

      const journalArr = parseOr(await safeGet("kleo_journal", false), []);
      const achievementsArr = parseOr(await safeGet("kleo_achievements", false), []);
      const messagesObj = parseOr(await safeGet("kleo_messages", false), {});

      setBoard(boardObj);
      setPosts(postsArr);
      setJournal(journalArr);
      setAchievements(achievementsArr);
      setMessages(messagesObj);
      setProfile(prof);
      setLoading(false);
    })();
  }, []);

  async function syncBoard(nextAchievements, nextProfile) {
    const p = nextProfile || profile;
    const counts = { olympiads: 0, projects: 0, businesses: 0 };
    let score = 0;
    nextAchievements.forEach((a) => {
      score += a.weight;
      if (a.type === "olympiad") counts.olympiads++;
      if (a.type === "project") counts.projects++;
      if (a.type === "business") counts.businesses++;
    });
    const nextBoard = { ...board, [p.userId]: { name: p.name, avatar: p.avatar, university: p.university, score, ...counts } };
    setBoard(nextBoard);
    await safeSet("kleo_leaderboard", nextBoard, true);
  }

  async function finishOnboarding({ email, name, avatar, university, grade, interest }) {
    const userId = uid();
    const prof = { userId, email, name, avatar, university, grade, interest, bio: "", createdAt: Date.now() };
    setProfile(prof);
    await safeSet("kleo_profile", prof, false);
    await syncBoard([], prof);
  }

  async function updateProfile(patch) {
    const next = { ...profile, ...patch };
    setProfile(next);
    await safeSet("kleo_profile", next, false);
    await syncBoard(achievements, next);
  }

  async function addAchievement(data) {
    const entry = { id: uid(), createdAt: Date.now(), ...data };
    const next = [entry, ...achievements];
    setAchievements(next);
    await safeSet("kleo_achievements", next, false);
    await syncBoard(next, profile);
  }
  async function deleteAchievement(id) {
    const next = achievements.filter((a) => a.id !== id);
    setAchievements(next);
    await safeSet("kleo_achievements", next, false);
    await syncBoard(next, profile);
  }

  async function addPost({ text, tag, photo }) {
    const post = { id: uid(), authorId: profile.userId, authorName: profile.name, authorAvatar: profile.avatar, tag, photo, text, likes: [], comments: [], createdAt: Date.now() };
    const next = [post, ...posts].slice(0, 60);
    setPosts(next);
    setCompose(false);
    await safeSet("kleo_posts", next, true);
  }
  async function likePost(id) {
    const next = posts.map((p) => {
      if (p.id !== id) return p;
      const has = p.likes.includes(profile.userId);
      return { ...p, likes: has ? p.likes.filter((x) => x !== profile.userId) : [...p.likes, profile.userId] };
    });
    setPosts(next);
    await safeSet("kleo_posts", next, true);
  }
  async function addComment(postId, text) {
    const next = posts.map((p) => p.id === postId
      ? { ...p, comments: [...(p.comments || []), { id: uid(), authorId: profile.userId, authorName: profile.name, authorAvatar: profile.avatar, text, createdAt: Date.now() }] }
      : p);
    setPosts(next);
    await safeSet("kleo_posts", next, true);
  }

  async function addJournal(data) {
    const next = [{ id: uid(), ...data, createdAt: Date.now() }, ...journal];
    setJournal(next);
    await safeSet("kleo_journal", next, false);
  }
  async function editJournal(id, data) {
    const next = journal.map((e) => (e.id === id ? { ...e, ...data } : e));
    setJournal(next);
    await safeSet("kleo_journal", next, false);
  }
  async function deleteJournal(id) {
    const next = journal.filter((e) => e.id !== id);
    setJournal(next);
    await safeSet("kleo_journal", next, false);
  }

  async function logout() {
    await safeDelete("kleo_profile", false);
    setProfile(null);
    setTab("feed");
  }

  function openProfile(userId) {
    if (!profile) return;
    if (userId === profile.userId) { setTab("profile"); return; }
    setViewProfileId(userId);
  }

  function resolveIdentity(userId) {
    if (!profile) return null;
    if (userId === profile.userId) return { name: profile.name, avatar: profile.avatar };
    const meta = SEED_META[userId];
    return meta ? { name: meta.name, avatar: meta.avatar } : null;
  }

  async function sendMessage(otherId, text) {
    const mine = { id: uid(), from: "me", text, createdAt: Date.now() };
    const withMine = { ...messages, [otherId]: [...(messages[otherId] || []), mine] };
    setMessages(withMine);
    await safeSet("kleo_messages", withMine, false);
    if (SEED_META[otherId]) {
      setTimeout(() => {
        setMessages((prev) => {
          const reply = { id: uid(), from: "them", text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)], createdAt: Date.now() };
          const updated = { ...prev, [otherId]: [...(prev[otherId] || []), reply] };
          safeSet("kleo_messages", updated, false);
          return updated;
        });
      }, 1000 + Math.random() * 1200);
    }
  }

  const searchableProfiles = useMemo(() => {
    if (!profile) return [];
    const list = [{ id: profile.userId, name: profile.name, avatar: profile.avatar, university: profile.university, interest: profile.interest }];
    Object.entries(SEED_META).forEach(([id, m]) => list.push({ id, name: m.name, avatar: m.avatar, university: m.university, interest: null }));
    return list;
  }, [profile]);

  function rankFor(userId) {
    const list = Object.entries(board).map(([id, s]) => ({ id, score: s.score || 0 }));
    list.sort((a, b) => b.score - a.score);
    const idx = list.findIndex((r) => r.id === userId);
    return { rank: idx >= 0 ? idx + 1 : list.length + 1, total: list.length };
  }

  function resolveProfileData(userId) {
    if (userId === profile.userId) {
      return { name: profile.name, avatar: profile.avatar, email: profile.email, university: profile.university, grade: profile.grade, interest: profile.interest, bio: profile.bio, achievements, score: achievements.reduce((s, a) => s + a.weight, 0) };
    }
    const meta = SEED_META[userId];
    if (!meta) return null;
    const achs = (SEED_ACHIEVEMENTS[userId] || []).map((a, i) => ({ ...a, id: `${userId}_${i}` }));
    return { name: meta.name, avatar: meta.avatar, university: meta.university, grade: null, interest: null, bio: meta.bio, achievements: achs, score: achs.reduce((s, a) => s + a.weight, 0) };
  }

  const rankInfo = useMemo(() => (profile ? rankFor(profile.userId) : { rank: 0, total: 0 }), [board, profile]);

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
    .k-root { --bg:#FFFFFF; --surface:#FFFFFF; --line:#EAEAEE; --text:#15171C; --muted:#6B7280;
      --gold:#C99A3D; --silver:#9CA3B8; --bronze:#B97D49; --signal:#EF4444;
      font-family:'Inter',sans-serif; background-color:var(--bg); color:var(--text);
      min-height:600px; max-width:420px; margin:0 auto; position:relative;
      border-radius:26px; overflow:hidden; box-shadow:0 0 0 1px var(--line); }
    .k-display { font-weight:800; letter-spacing:-0.01em; }
    .k-wordmark { font-weight:800; font-size:32px; letter-spacing:0.01em; color:var(--text); }
    .k-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 6px 10px 14px; font-weight:800; font-size:16px; letter-spacing:0.02em; border-bottom:1px solid var(--line); background:rgba(255,255,255,0.9); backdrop-filter:blur(6px); position:sticky; top:0; z-index:5; color:var(--text); }
    .k-topicon { border:none; background:none; color:var(--text); width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; }
    .k-topicon:hover { background:#F3F4F6; }
    .k-card { background:var(--surface); border:1px solid var(--line); border-radius:16px; box-shadow:0 1px 3px rgba(16,23,42,0.04); }
    .k-card[data-me="true"] { border-color: var(--gold); box-shadow:0 0 0 1px var(--gold); }
    .k-rankrow:hover { border-color:#D8D8DE; }
    .k-tag { font-size:10.5px; font-weight:600; padding:3px 9px; border-radius:20px; background:#F3F4F6; border:1px solid var(--line); color:var(--muted); white-space:nowrap; }
    .k-badge-ai { display:inline-flex; align-items:center; gap:3px; font-size:9.5px; font-weight:700; padding:2px 7px; border-radius:20px; background:rgba(201,154,61,0.12); color:var(--gold); border:1px solid rgba(201,154,61,0.4); }
    .k-input { width:100%; border:1px solid var(--line); border-radius:12px; padding:11px 13px; font-size:13.5px; font-family:'Inter',sans-serif; background:#FAFAFB; color:var(--text); box-sizing:border-box; outline:none; }
    .k-input::placeholder { color:var(--muted); }
    .k-input:focus { border-color:var(--gold); background:#fff; }
    .k-btn-primary { background:var(--text); color:#fff; border:none; border-radius:12px; padding:12px 16px; font-weight:700; font-size:13.5px; cursor:pointer; }
    .k-btn-primary:disabled { opacity:0.35; cursor:not-allowed; }
    .k-btn-outline { background:#fff; color:var(--text); border:1px solid var(--line); border-radius:12px; padding:10px 14px; font-weight:600; font-size:13px; cursor:pointer; }
    .k-btn-ai { width:100%; margin-top:10px; background:rgba(201,154,61,0.1); color:#8A6621; border:1px solid rgba(201,154,61,0.45); border-radius:12px; padding:11px 16px; font-weight:700; font-size:13px; cursor:pointer; }
    .k-btn-ai:disabled { opacity:0.5; cursor:not-allowed; }
    .k-notice { display:flex; gap:8px; align-items:flex-start; font-size:11.5px; color:var(--muted); background:#F6F7F9; border:1px solid var(--line); border-radius:12px; padding:10px 12px; margin-top:10px; line-height:1.5; }
    .k-notice-ok { color:#166534; background:rgba(34,197,94,0.08); border-color:rgba(34,197,94,0.3); }
    .k-notice-warn { color:#92400E; background:rgba(245,158,11,0.1); border-color:rgba(245,158,11,0.35); }
    .k-iconbtn { border:1px solid var(--line); background:#fff; border-radius:9px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); flex-shrink:0; }
    .k-iconbtn:disabled { opacity:0.35; cursor:not-allowed; }
    .k-chip { border:1px solid var(--line); background:#F6F7F9; border-radius:20px; padding:6px 13px; font-size:12px; font-weight:600; color:var(--muted); cursor:pointer; }
    .k-chip[data-active="true"] { background:var(--text); color:#fff; border-color:var(--text); }
    .k-levelrow { display:flex; justify-content:space-between; align-items:center; border:1px solid var(--line); background:#fff; border-radius:12px; padding:10px 13px; font-size:12.5px; color:var(--text); cursor:pointer; text-align:left; }
    .k-levelrow[data-active="true"] { border-color:var(--gold); background:rgba(201,154,61,0.08); }
    .k-avatarpick { border:2px solid var(--line); background:#fff; border-radius:12px; font-size:20px; padding:9px 0; cursor:pointer; }
    .k-avatarpick[data-active="true"] { border-color:var(--gold); background:rgba(201,154,61,0.1); }
    .k-dashed { width:100%; border:1.5px dashed var(--line); border-radius:12px; background:transparent; color:var(--muted); font-size:13px; padding:13px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; margin-top:10px; }
    .k-fab { position:absolute; right:16px; bottom:78px; width:54px; height:54px; border-radius:50%; background:var(--text); color:#fff; border:none; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 16px rgba(21,23,28,0.25); cursor:pointer; z-index:4; }
    .k-avatar-sm { width:34px; height:34px; border-radius:50%; background:#F0F1F3; border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0; }
    .k-avatar-lg { width:72px; height:72px; border-radius:50%; background:#F0F1F3; border:2px solid var(--gold); display:flex; align-items:center; justify-content:center; font-size:36px; flex-shrink:0; }
    .k-like { display:flex; align-items:center; gap:5px; border:none; background:none; color:var(--muted); font-size:12.5px; font-weight:600; cursor:pointer; padding:0; }
    .k-like[data-active="true"] { color:var(--signal); }
    .k-mono-score { font-family:'JetBrains Mono',monospace; font-weight:700; color:var(--text); }
    .k-name { font-weight:800; font-size:19px; color:var(--text); }
    .k-nav { position:absolute; left:0; right:0; bottom:0; display:flex; background:rgba(255,255,255,0.94); backdrop-filter:blur(6px); border-top:1px solid var(--line); padding:9px 6px 13px; z-index:5; }
    .k-navbtn { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; border:none; background:none; color:var(--muted); font-size:9.5px; font-weight:600; cursor:pointer; padding:4px 0; }
    .k-navbtn svg { width:17px; height:17px; }
    .k-navbtn[data-active="true"] { color:var(--gold); }
    .k-tabs { display:flex; border-bottom:1px solid var(--line); margin-top:16px; }
    .k-tabbtn { flex:1; text-align:center; padding:12px 0; font-size:12.5px; font-weight:600; color:var(--muted); background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; }
    .k-tabbtn[data-active="true"] { color:var(--text); border-bottom-color:var(--text); }
    .k-overlay { position:absolute; inset:0; background:rgba(15,17,23,0.45); display:flex; align-items:flex-end; z-index:10; }
    .k-sheet { width:100%; background:var(--bg); border-radius:20px 20px 0 0; max-height:82%; display:flex; flex-direction:column; border-top:1px solid var(--line); }
    .k-sheet-head { display:flex; align-items:center; justify-content:space-between; padding:15px 16px; font-weight:700; border-bottom:1px solid var(--line); color:var(--text); }
    .k-sheet-body { padding:16px; overflow-y:auto; }
    .k-fullsheet { position:absolute; inset:0; background:var(--bg); z-index:8; overflow-y:auto; }
    .k-bubble-me { background:var(--text); color:#fff; padding:9px 13px; border-radius:16px; font-size:13px; max-width:75%; line-height:1.4; }
    .k-bubble-them { background:#F1F1F4; color:var(--text); padding:9px 13px; border-radius:16px; font-size:13px; max-width:75%; line-height:1.4; }
    .k-spin { animation: k-rotate 1s linear infinite; display:inline-block; }
    @keyframes k-rotate { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  `;

  if (loading) {
    return (
      <div className="k-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 560 }}>
        <style>{styles}</style>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>Загрузка…</div>
      </div>
    );
  }
  if (!profile) {
    return (<><style>{styles}</style><OnboardingWizard onDone={finishOnboarding} /></>);
  }

  return (
    <div className="k-root">
      <style>{styles}</style>
      <div className="k-topbar">
        <div style={{ width: 68 }} />
        <div style={{ flex: 1, textAlign: "center" }}>KLEO</div>
        <div style={{ display: "flex", gap: 2, paddingRight: 6 }}>
          <button className="k-topicon" type="button" onClick={() => setSearchOpen(true)}><Search size={18} /></button>
          <button className="k-topicon" type="button" onClick={() => setMessagesOpen(true)}><MessageSquare size={18} /></button>
        </div>
      </div>
      <div style={{ paddingBottom: 8 }}>
        {tab === "feed" && <FeedScreen me={profile} posts={posts} onLike={likePost} onComment={addComment} onCompose={() => setCompose(true)} onOpenProfile={openProfile} />}
        {tab === "rating" && <RatingScreen me={profile} board={board} achievements={achievements} onOpenProfile={openProfile} />}
        {tab === "journal" && <JournalScreen entries={journal} onAdd={addJournal} onEdit={editJournal} onDelete={deleteJournal} />}
        {tab === "events" && <EventsScreen profile={profile} />}
        {tab === "profile" && (
          <ProfileView
            data={resolveProfileData(profile.userId)} rankInfo={rankInfo} posts={posts.filter((p) => p.authorId === profile.userId)}
            isMe viewerId={profile.userId} targetUserId={profile.userId} onBack={null}
            onUpdate={updateProfile} onAddAchievement={addAchievement} onDeleteAchievement={deleteAchievement} onLogout={logout}
            onLike={likePost} onComment={addComment} onOpenProfile={openProfile} onMessage={() => {}}
          />
        )}
      </div>
      <div className="k-nav">
        <button className="k-navbtn" data-active={tab === "feed"} onClick={() => setTab("feed")} type="button"><BookOpen size={18} /> Лента</button>
        <button className="k-navbtn" data-active={tab === "rating"} onClick={() => setTab("rating")} type="button"><Trophy size={18} /> Рейтинг</button>
        <button className="k-navbtn" data-active={tab === "journal"} onClick={() => setTab("journal")} type="button"><Pencil size={18} /> Дневник</button>
        <button className="k-navbtn" data-active={tab === "events"} onClick={() => setTab("events")} type="button"><Calendar size={18} /> События</button>
        <button className="k-navbtn" data-active={tab === "profile"} onClick={() => setTab("profile")} type="button"><User size={18} /> Профиль</button>
      </div>
      {compose && <Compose onClose={() => setCompose(false)} onSubmit={addPost} />}

      {viewProfileId && (
        <div className="k-fullsheet">
          <ProfileView
            data={resolveProfileData(viewProfileId)} rankInfo={rankFor(viewProfileId)} posts={posts.filter((p) => p.authorId === viewProfileId)}
            isMe={false} viewerId={profile.userId} targetUserId={viewProfileId} onBack={() => setViewProfileId(null)}
            onUpdate={() => {}} onAddAchievement={() => {}} onDeleteAchievement={() => {}} onLogout={() => {}}
            onLike={likePost} onComment={addComment} onOpenProfile={openProfile}
            onMessage={(id) => { setViewProfileId(null); setMessagesOpen(true); setChatUserId(id); }}
          />
        </div>
      )}

      {searchOpen && (
        <div className="k-fullsheet">
          <SearchScreen
            query={searchQuery} setQuery={setSearchQuery} profiles={searchableProfiles} posts={posts}
            onOpenProfile={(id) => { setSearchOpen(false); openProfile(id); }}
            onLike={likePost} onComment={addComment} viewerId={profile.userId}
            onBack={() => setSearchOpen(false)}
          />
        </div>
      )}

      {messagesOpen && !chatUserId && (
        <div className="k-fullsheet">
          <ChatsScreen messages={messages} resolveIdentity={resolveIdentity} onOpenChat={setChatUserId} onBack={() => setMessagesOpen(false)} />
        </div>
      )}
      {messagesOpen && chatUserId && (
        <div className="k-fullsheet" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <ChatView
            identity={resolveIdentity(chatUserId) || { name: "Пользователь", avatar: "👤" }}
            thread={messages[chatUserId] || []}
            onBack={() => setChatUserId(null)}
            onSend={(text) => sendMessage(chatUserId, text)}
          />
        </div>
      )}
    </div>
  );
}