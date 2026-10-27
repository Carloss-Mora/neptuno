import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  BellRing,
  CloudRain,
  Gauge,
  Layers,
  PiggyBank,
  Timer,
  WifiOff,
} from 'lucide-react';

const EMITTERS = [120, 260, 400];

// Corte del cultivo: la línea de goteo, las plantas y el bulbo húmedo que se forma bajo cada gotero.
// Es la única animación de la página: las gotas caen y la humedad del suelo late despacio.
const FieldScene = () => (
  <svg viewBox="0 0 520 400" role="img" aria-label="Línea de riego por goteo sobre plantas de fresa, con gotas que humedecen el suelo" className="h-auto w-full">
    <defs>
      <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ead8bf" />
        <stop offset="1" stopColor="#d9bf9b" />
      </linearGradient>
      <radialGradient id="wet" cx="0.5" cy="0.35" r="0.65">
        <stop offset="0" stopColor="#3fb7d4" stopOpacity="0.75" />
        <stop offset="1" stopColor="#7cd5e4" stopOpacity="0" />
      </radialGradient>
    </defs>

    <path d="M0 215 Q 130 195 260 205 T 520 200 V 400 H 0 Z" fill="url(#soil)" />
    <path d="M0 215 Q 130 195 260 205 T 520 200" fill="none" stroke="#c9ad86" strokeWidth="2" />

    {EMITTERS.map((x, i) => (
      <g key={x}>
        <ellipse className="wet-bulb" style={{ animationDelay: `${i * 0.9}s` }} cx={x} cy="262" rx="78" ry="58" fill="url(#wet)" />
        {/* planta de fresa */}
        <g transform={`translate(${x} 200)`}>
          <path d="M0 0 C -4 -26 -34 -40 -46 -22 C -34 -4 -14 -4 0 0Z" fill="#8fd3a8" />
          <path d="M0 0 C 4 -30 34 -46 48 -26 C 34 -6 14 -4 0 0Z" fill="#76c595" />
          <path d="M0 0 C -6 -40 6 -62 0 -66 C -16 -52 -14 -20 0 0Z" fill="#a4dfb9" />
          <circle cx="-22" cy="4" r="9" fill="#f58a9e" />
          <circle cx="20" cy="6" r="7" fill="#f9a3b3" />
          <circle cx="-24" cy="1" r="1.4" fill="#fff" opacity="0.8" />
          <circle cx="18" cy="3" r="1.2" fill="#fff" opacity="0.8" />
        </g>
        {/* gotero y gotas */}
        <rect x={x - 4} y="116" width="8" height="12" rx="3" fill="#1c5195" />
        {[0, 1, 2].map((d) => (
          <path
            key={d}
            className="drip"
            style={{ animationDelay: `${i * 0.55 + d * 0.62}s` }}
            d={`M${x} 130 q 5 8 0 14 q -5 -6 0 -14z`}
            fill="#3fb7d4"
          />
        ))}
      </g>
    ))}

    <rect x="10" y="108" width="500" height="10" rx="5" fill="#2468b6" />
    <rect x="10" y="110" width="500" height="3" rx="1.5" fill="#94c1ee" opacity="0.7" />
    <path d="M10 113 H -20" stroke="#2468b6" strokeWidth="10" strokeLinecap="round" />
  </svg>
);

// Foto del hero: public/hero-cultivo.jpg. Si no carga, se usa la escena dibujada.
const HeroPhoto = () => {
  const [failed, setFailed] = useState(false);
  if (failed) return <FieldScene />;
  return (
    <img
      src="/hero-cultivo.jpg"
      alt="Fresas maduras con gotas de agua sobre la planta"
      className="h-full w-full object-cover object-[60%_50%]"
      fetchPriority="high"
      onError={() => setFailed(true)}
    />
  );
};

const StatusChip = ({ className, label, value, tone }) => (
  <div className={`absolute rounded-2xl border border-white bg-white/95 px-4 py-3 shadow-lg shadow-sky-900/10 ${className}`}>
    <p className="text-xs font-semibold text-slate-500">{label}</p>
    <p className={`mt-0.5 text-lg font-extrabold ${tone}`}>{value}</p>
  </div>
);

const steps = [
  { title: 'Medición', text: 'Sensores de humedad del suelo, temperatura y nivel del tanque reportan de forma continua a la plataforma.' },
  { title: 'Decisión', text: 'Cada lectura se contrasta con el rango óptimo de la etapa del cultivo y con el pronóstico de lluvia.' },
  { title: 'Ejecución', text: 'La válvula se abre y se cierra de forma automática, y cada acción queda registrada con su motivo.' },
];

const capabilities = [
  { icon: Gauge, title: 'Riego por humedad', text: 'Umbrales por etapa fenológica, con valores de referencia para fresa y ajuste libre por cultivo.' },
  { icon: CloudRain, title: 'Integración meteorológica', text: 'Se suspende el inicio del riego ante lluvia pronosticada, salvo que el suelo esté en estado crítico.' },
  { icon: Layers, title: 'Gestión por zonas', text: 'Cada zona opera con su propia válvula y sensores, con control independiente.' },
  { icon: Timer, title: 'Riego por pulsos', text: 'Ciclos cortos con pausa de infiltración para evitar encharcamiento y pérdidas por escorrentía.' },
  { icon: PiggyBank, title: 'Eficiencia medible', text: 'Consumo estimado y ahorro frente al riego tradicional, exportables en PDF y Excel.' },
  { icon: BellRing, title: 'Alertas operativas', text: 'Avisos por correo y, opcionalmente, WhatsApp: nivel del tanque, temperatura, fugas y obstrucciones.' },
];

const stages = [
  { name: 'Vegetativo', range: '65 – 80 %', note: 'Establecimiento de raíces y follaje' },
  { name: 'Floración', range: '60 – 75 %', note: 'Control hídrico para proteger la flor' },
  { name: 'Fructificación', range: '70 – 85 %', note: 'Mayor demanda durante el llenado del fruto' },
];

const pillars = [
  ['24/7', 'Monitoreo continuo'],
  ['Automático', 'Decisión basada en datos'],
  ['Completa', 'Trazabilidad de cada riego'],
  ['PDF · Excel', 'Reportes exportables'],
];

const Brand = ({ className }) => (
  <Link to="/" className="flex items-center" aria-label="Neptuno, inicio">
    <img src="/neptuno-logo-cropped.png" alt="Neptuno" className={`w-auto object-contain mix-blend-multiply ${className}`} />
  </Link>
);

const HomePage = () => (
  <>
    <Helmet>
      <title>Neptuno - Riego de precisión para cultivos de fresa</title>
      <meta
        name="description"
        content="Neptuno automatiza el riego de fresa con sensores, pronóstico de lluvia y umbrales por etapa del cultivo, con trazabilidad completa de cada decisión."
      />
    </Helmet>

    <main className="font-landing min-h-screen overflow-x-clip bg-dew text-slate-900">
      <style>{`
        @keyframes drip-fall { 0% { transform: translateY(-4px); opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(78px); opacity: 0; } }
        @keyframes wet-breathe { 0%, 100% { transform: scale(0.88); opacity: 0.55; } 50% { transform: scale(1); opacity: 1; } }
        .drip { animation: drip-fall 1.9s ease-in infinite; opacity: 0; }
        .wet-bulb { transform-box: fill-box; transform-origin: center; animation: wet-breathe 3.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .drip { animation: none; opacity: 0.9; transform: translateY(24px); } .wet-bulb { animation: none; } }
      `}</style>

      <header>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Brand className="h-14 sm:h-16" />
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#plataforma" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white/70 md:block">Plataforma</a>
            <a href="#etapas" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white/70 md:block">Etapas</a>
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white/70 hover:text-slate-950 sm:px-4">
              Iniciar sesión
            </Link>
            <Link to="/signup">
              <Button className="rounded-xl bg-blue-800 px-5 font-semibold text-white shadow-md shadow-blue-900/20 hover:bg-blue-900">
                Crear cuenta
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="hero-photo-mask relative -mx-5 h-[300px] overflow-hidden sm:-mx-8 sm:h-[380px] lg:absolute lg:inset-y-0 lg:left-[40%] lg:right-0 lg:mx-0 lg:h-auto lg:rounded-l-[3rem]">
            <HeroPhoto />
          </div>
          <div className="relative grid items-center py-10 lg:min-h-[600px] lg:grid-cols-[0.95fr_1.05fr] lg:py-20">
            <div className="max-w-xl">
              <h1 className="text-[2.6rem] leading-[1.05] text-slate-950 sm:text-6xl lg:text-[4rem]">
                El agua justa, en el momento preciso.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
                Neptuno es la plataforma de riego de precisión para cultivos de fresa: mide, decide y ejecuta con datos del suelo, del clima y de cada etapa del cultivo.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup">
                  <Button size="lg" className="h-12 w-full rounded-xl bg-blue-800 px-7 font-semibold text-white shadow-lg shadow-blue-900/25 hover:bg-blue-900 sm:w-auto">
                    Crear cuenta <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#plataforma">
                  <Button size="lg" variant="outline" className="h-12 w-full rounded-xl border-slate-300 bg-white/80 px-7 font-semibold text-slate-800 hover:bg-white sm:w-auto">
                    Conocer la plataforma
                  </Button>
                </a>
              </div>
            </div>
            <div className="relative hidden h-full lg:block">
              <StatusChip className="bottom-24 left-6" label="Humedad del suelo" value="68 %  Rango óptimo" tone="text-emerald-700" />
              <StatusChip className="bottom-6 right-6" label="Riego automático" value="Activo, hace 4 min" tone="text-blue-800" />
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Indicadores de la plataforma" className="border-y border-sky-100 bg-white/70">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-8 sm:px-8 lg:grid-cols-4">
          {pillars.map(([figure, label]) => (
            <div key={label}>
              <dt className="text-sm font-semibold text-slate-500">{label}</dt>
              <dd className="mt-1 text-3xl font-extrabold tracking-tight text-blue-900">{figure}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="plataforma" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Un ciclo completo, sin intervención diaria</h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="relative">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-800 text-lg font-extrabold text-white">{index + 1}</span>
                {index < steps.length - 1 && <span aria-hidden="true" className="absolute left-14 right-0 top-5 hidden border-t-2 border-dashed border-sky-200 md:block" />}
                <h3 className="mt-5 text-xl font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Capacidades pensadas para el cultivo</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-3xl border border-white bg-white p-6 shadow-lg shadow-sky-900/5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-blue-800"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-4 rounded-3xl border border-sky-100 bg-white/70 p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-blue-800"><WifiOff className="h-6 w-6" aria-hidden="true" /></span>
            <p className="leading-7 text-slate-700"><span className="font-bold text-slate-900">Continuidad operativa.</span> Ante una pérdida de conexión, el controlador está diseñado para operar con la última configuración y cerrar la válvula si detecta una falla.</p>
          </div>
        </div>
      </section>

      <section id="etapas" className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Cada etapa del cultivo, su propia dosis de agua</h2>
            <p className="mt-4 max-w-md leading-7 text-slate-600">A partir de la fecha de siembra, la plataforma sugiere la etapa y la humedad objetivo. Todos los valores son ajustables por cultivo.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {stages.map((stage) => (
              <li key={stage.name} className="rounded-3xl border border-sky-100 bg-sky-50/60 p-5">
                <p className="font-bold text-slate-900">{stage.name}</p>
                <p className="mt-3 text-3xl font-extrabold tracking-tight text-blue-900">{stage.range}</p>
                <p className="mt-1 text-sm text-slate-500">humedad objetivo del suelo</p>
                <p className="mt-3 text-sm text-slate-600">{stage.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Decisiones de riego respaldadas por datos</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">Cree su cuenta, registre su cultivo y valide el funcionamiento en el entorno de simulación antes de conectar el equipo.</p>
          <Link to="/signup" className="mt-7 inline-block">
            <Button size="lg" className="h-12 rounded-xl bg-blue-800 px-8 font-semibold text-white shadow-lg shadow-blue-900/25 hover:bg-blue-900">
              Crear cuenta <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-sky-100 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 sm:flex-row sm:px-8">
          <Brand className="h-12" />
          <p className="text-center text-sm text-slate-500">Riego de precisión para una agricultura sostenible.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <Link to="/terminos" className="hover:text-slate-800 hover:underline">Términos y condiciones</Link>
            <Link to="/privacidad" className="hover:text-slate-800 hover:underline">Política de privacidad</Link>
            <span className="text-slate-400">© {new Date().getFullYear()} Neptuno</span>
          </div>
        </div>
      </footer>
    </main>
  </>
);

export default HomePage;
