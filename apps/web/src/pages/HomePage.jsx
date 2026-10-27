import React, { useEffect, useState } from 'react';
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
  Radio,
  Sprout,
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

// Si existe public/hero-cultivo.mp4 (un video real de tu cultivo, sin sonido) se muestra en bucle;
// si no, se usa la escena dibujada. Con «reducir movimiento» activado solo se ve la imagen fija (hero-cultivo.jpg).
const HeroMedia = () => {
  const [hasVideo, setHasVideo] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduceMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/hero-cultivo.mp4', { method: 'HEAD' });
        if (active && response.ok && /video/.test(response.headers.get('content-type') || '')) setHasVideo(true);
      } catch {
        // sin video: se queda la escena dibujada
      }
    })();
    return () => { active = false; };
  }, []);
  if (!hasVideo || failed) return <FieldScene />;
  return (
    <video
      className="aspect-[4/3] h-auto w-full object-cover"
      src="/hero-cultivo.mp4"
      poster="/hero-cultivo.jpg"
      autoPlay={!reduceMotion}
      muted
      loop
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      aria-label="Cultivo de fresa con riego por goteo"
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
  { title: 'Los sensores miden', text: 'La humedad del suelo, la temperatura y el nivel del tanque se leen a cada rato y llegan a tu panel.' },
  { title: 'Neptuno decide', text: 'Compara la humedad con el rango ideal de tu fresa en su etapa actual y revisa si va a llover.' },
  { title: 'La válvula riega', text: 'Abre el agua cuando el suelo está seco, la cierra al llegar al punto justo y te cuenta por qué.' },
];

const features = [
  { icon: Gauge, title: 'Riego según la humedad', text: 'Define el rango ideal, o usa los valores sugeridos para vegetativo, floración y fructificación.' },
  { icon: CloudRain, title: 'No riega si va a llover', text: 'Al aire libre mira el pronóstico de las próximas 6 horas. Si el suelo está muy seco, riega igual.' },
  { icon: Layers, title: 'Zonas y válvulas', text: 'Divide el lote en zonas con su propia válvula y sensores, y riega cada una cuando lo necesita.' },
  { icon: Timer, title: 'Riego por pulsos', text: 'Pulsos cortos con pausas para que el agua se infiltre sin encharcar el suelo.' },
  { icon: PiggyBank, title: 'Cuánta agua ahorras', text: 'Compara tu consumo con el riego que harías sin Neptuno, en litros y en reportes PDF o Excel.' },
  { icon: BellRing, title: 'Alertas a tiempo', text: 'Tanque bajo, temperatura alta, y posibles fugas u obstrucciones en la línea.' },
];

const stages = [
  { name: 'Vegetativo', range: '65–80 %', note: 'Raíces y hojas' },
  { name: 'Floración', range: '60–75 %', note: 'Menos agua para no perder flor' },
  { name: 'Fructificación', range: '70–85 %', note: 'La fruta pide más agua' },
];

const HomePage = () => (
  <>
    <Helmet>
      <title>Neptuno - Riego inteligente para fresa</title>
      <meta
        name="description"
        content="Neptuno riega tu cultivo de fresa según la humedad del suelo, el pronóstico de lluvia y la etapa del cultivo, y te cuenta por qué."
      />
    </Helmet>

    <main className="min-h-screen overflow-x-clip bg-dew text-slate-900">
      <style>{`
        @keyframes drip-fall { 0% { transform: translateY(-4px); opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(78px); opacity: 0; } }
        @keyframes wet-breathe { 0%, 100% { transform: scale(0.88); opacity: 0.55; } 50% { transform: scale(1); opacity: 1; } }
        .drip { animation: drip-fall 1.9s ease-in infinite; opacity: 0; }
        .wet-bulb { transform-box: fill-box; transform-origin: center; animation: wet-breathe 3.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .drip { animation: none; opacity: 0.9; transform: translateY(24px); } .wet-bulb { animation: none; } }
      `}</style>

      <header>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Link to="/" className="flex items-center" aria-label="Neptuno, inicio">
            <img src="/neptuno-logo-cropped.png" alt="Neptuno" className="h-14 w-auto object-contain mix-blend-multiply sm:h-16" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white/70 hover:text-slate-950 sm:px-4">
              Iniciar sesión
            </Link>
            <Link to="/signup">
              <Button className="rounded-xl bg-blue-700 px-5 font-semibold text-white shadow-md shadow-blue-700/20 hover:bg-blue-800">
                Crear cuenta
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section>
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-6 lg:pb-24 lg:pt-12">
          <div className="max-w-xl">
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.6rem]">
              Cada fresa recibe el agua justa, cuando la pide.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
              Neptuno mide la humedad del suelo, mira si va a llover y abre la válvula solo cuando hace falta. Y siempre te dice por qué regó.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup">
                <Button size="lg" className="h-12 w-full rounded-xl bg-blue-700 px-7 font-semibold text-white shadow-lg shadow-blue-700/25 hover:bg-blue-800 sm:w-auto">
                  Crear mi cuenta <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#como-funciona">
                <Button size="lg" variant="outline" className="h-12 w-full rounded-xl border-sky-200 bg-white/70 px-7 font-semibold text-slate-700 hover:bg-white sm:w-auto">
                  Ver cómo funciona
                </Button>
              </a>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <Sprout className="h-4 w-4 text-sky-600" aria-hidden="true" /> Hecho para cultivos de fresa en clima frío de altura.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] pt-8 lg:pt-0">
            <div className="rounded-[2rem] border border-white bg-white/60 p-3 shadow-xl shadow-sky-900/10 backdrop-blur">
              <div className="overflow-hidden rounded-[1.5rem] bg-gradient-to-b from-sky-100 via-sky-50 to-white">
                <HeroMedia />
              </div>
            </div>
            <StatusChip className="-left-1 top-2 sm:-left-5" label="Humedad del suelo" value="68 %  Húmedo y estable" tone="text-emerald-700" />
            <StatusChip className="-right-1 bottom-10 sm:-right-5" label="Riego" value="Activo, hace 4 min" tone="text-blue-700" />
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Tres pasos, sin que tengas que estar pendiente</h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="relative">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-700 text-lg font-extrabold text-white">{index + 1}</span>
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
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Lo que Neptuno hace por tu cultivo</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-3xl border border-white bg-white p-6 shadow-lg shadow-sky-900/5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-4 rounded-3xl border border-sky-100 bg-white/70 p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-blue-700"><WifiOff className="h-6 w-6" aria-hidden="true" /></span>
            <p className="leading-7 text-slate-700"><span className="font-bold text-slate-900">Si se cae el internet,</span> el controlador está pensado para seguir con tu última configuración y cerrar la válvula si algo falla, en vez de dejarla abierta.</p>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">La fresa no bebe igual toda su vida</h2>
            <p className="mt-4 max-w-md leading-7 text-slate-600">Dile a Neptuno la fecha de siembra y te sugiere la etapa y la humedad ideal. Tú puedes ajustar cualquier valor.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {stages.map((stage) => (
              <li key={stage.name} className="rounded-3xl border border-sky-100 bg-sky-50/60 p-5">
                <p className="font-bold text-slate-900">{stage.name}</p>
                <p className="mt-3 text-3xl font-extrabold text-blue-700">{stage.range}</p>
                <p className="mt-1 text-sm text-slate-500">de humedad en el suelo</p>
                <p className="mt-3 text-sm text-slate-600">{stage.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <Radio className="mx-auto h-8 w-8 text-sky-600" aria-hidden="true" />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Empieza con un cultivo y míralo regarse</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">Crea tu cuenta, registra tu cultivo y prueba todo en el laboratorio de simulación, sin conectar nada todavía.</p>
          <Link to="/signup" className="mt-7 inline-block">
            <Button size="lg" className="h-12 rounded-xl bg-blue-700 px-8 font-semibold text-white shadow-lg shadow-blue-700/25 hover:bg-blue-800">
              Crear mi cuenta <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-sky-100 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 sm:flex-row sm:px-8">
          <Link to="/" className="flex items-center" aria-label="Neptuno, inicio">
            <img src="/neptuno-logo-cropped.png" alt="Neptuno" className="h-12 w-auto object-contain mix-blend-multiply" />
          </Link>
          <p className="text-center text-sm text-slate-500">Riego inteligente para una agricultura sostenible.</p>
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
