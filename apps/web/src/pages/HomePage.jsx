import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';

// Página principal. Paleta propia: hoja (verde profundo), fresa (acento único) y niebla (fondo claro).
// Tipografía: Bricolage Grotesque para titulares y Public Sans para el texto.
const styles = `
  .np { --leaf: #143427; --leaf-2: #1f4a37; --berry: #c8283f; --berry-dark: #a81f33; --mist: #f1f5ef; --wash: #e0eadd; --ink: #16231c; --muted: #4f5f55;
    background: var(--mist); color: var(--ink); }
  .np h1, .np h2, .np h3, .np .np-display { font-family: "Bricolage Grotesque", "Public Sans", sans-serif; letter-spacing: -0.025em; }
  .np a:focus-visible, .np button:focus-visible { outline: 3px solid var(--berry); outline-offset: 3px; }
  .np-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 3rem; padding: 0 1.6rem; border-radius: 0.5rem; font-weight: 600; transition: background-color .2s, color .2s, border-color .2s; }
  .np-btn-berry { background: var(--berry); color: #fff; }
  .np-btn-berry:hover { background: var(--berry-dark); }
  .np-btn-ghost { border: 1.5px solid rgba(255,255,255,.55); color: #fff; }
  .np-btn-ghost:hover { background: rgba(255,255,255,.12); border-color: #fff; }
  .np-hero-photo { position: relative; aspect-ratio: 16 / 10; background: var(--leaf-2); }
  .np-hero-photo img { width: 100%; height: 100%; object-fit: cover; object-position: 60% 50%; }
  .np-hero-photo::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(20,52,39,0) 55%, var(--leaf) 100%); }
  @media (min-width: 1024px) {
    .np-hero-photo { position: absolute; inset: 0 0 0 38%; aspect-ratio: auto; }
    .np-hero-photo::after { background: linear-gradient(to right, var(--leaf) 0%, rgba(20,52,39,.55) 28%, rgba(20,52,39,0) 60%); }
  }
  .np-range { position: relative; height: 0.75rem; border-radius: 999px; background: var(--wash); }
  .np-range > span { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: var(--leaf-2); }
  .np-flow { position: relative; }
  .np-flow::before { content: ""; position: absolute; left: 0.45rem; top: 0.5rem; bottom: 0.5rem; width: 2px; background: var(--wash); }
  @media (min-width: 768px) { .np-flow::before { left: 0; right: 0; top: 0.45rem; bottom: auto; width: auto; height: 2px; } }
  @keyframes np-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .np-intro > * { animation: np-rise .7s cubic-bezier(.2,.7,.2,1) both; }
  .np-intro > *:nth-child(2) { animation-delay: .12s; } .np-intro > *:nth-child(3) { animation-delay: .24s; } .np-intro > *:nth-child(4) { animation-delay: .36s; }
  @media (prefers-reduced-motion: reduce) { .np-intro > * { animation: none; } }
`;

const readout = [
  ['Humedad del suelo', '68 %', 'dentro del rango'],
  ['Válvula', 'Cerrada', 'último riego hace 42 min'],
  ['Tanque', '74 %', 'nivel suficiente'],
];

const flow = [
  { title: 'Mide', text: 'Sensores de humedad del suelo, temperatura y nivel del tanque envían sus lecturas de forma continua.' },
  { title: 'Decide', text: 'Cada lectura se compara con el rango de la etapa del cultivo y con el pronóstico de lluvia.' },
  { title: 'Riega', text: 'La válvula abre y cierra sola. Cada riego queda registrado con la razón que lo originó.' },
];

const capabilities = [
  ['Riego según la humedad', 'Umbrales por etapa, con valores de referencia para fresa que usted puede ajustar en cada cultivo.'],
  ['Pronóstico de lluvia', 'No inicia un riego si va a llover, salvo que el suelo ya esté en estado crítico.'],
  ['Zonas independientes', 'Cada lote tiene su válvula y sus sensores, y se controla por separado.'],
  ['Riego por pulsos', 'Ciclos cortos con pausa para que el agua se infiltre, sin encharcar ni perderse por escorrentía.'],
  ['Consumo y ahorro', 'Litros estimados por riego y ahorro frente al riego tradicional, en PDF y Excel.'],
  ['Alertas', 'Aviso por correo, y por WhatsApp si lo activa: tanque bajo, temperatura, fugas y obstrucciones.'],
];

const stages = [
  { name: 'Vegetativo', min: 65, max: 80, note: 'Establecimiento de raíces y follaje.' },
  { name: 'Floración', min: 60, max: 75, note: 'Riego medido para proteger la flor.' },
  { name: 'Fructificación', min: 70, max: 85, note: 'Mayor demanda mientras el fruto se llena.' },
];

const Brand = ({ className }) => (
  <Link to="/" className="flex items-center" aria-label="Neptuno, inicio">
    <img src="/neptuno-logo-cropped.png" alt="Neptuno" className={`w-auto object-contain ${className}`} />
  </Link>
);

const HeroPhoto = () => {
  const [failed, setFailed] = useState(false);
  return (
    <div className="np-hero-photo" aria-hidden={failed ? 'true' : undefined}>
      {!failed && (
        <img
          src="/hero-cultivo.jpg"
          alt="Fresas maduras con gotas de agua sobre la planta"
          fetchPriority="high"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

const HomePage = () => (
  <>
    <Helmet>
      <title>Neptuno - Riego de precisión para cultivos de fresa</title>
      <meta
        name="description"
        content="Neptuno automatiza el riego de fresa con sensores, pronóstico de lluvia y umbrales por etapa del cultivo, con registro de cada decisión."
      />
    </Helmet>

    <main className="np font-landing min-h-screen overflow-x-clip">
      <style>{styles}</style>

      <header style={{ background: 'var(--mist)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Brand className="h-12 mix-blend-multiply sm:h-14" />
          <nav className="flex items-center gap-1 sm:gap-3">
            <a href="#plataforma" className="hidden rounded-md px-3 py-2 text-sm font-semibold md:block" style={{ color: 'var(--muted)' }}>Plataforma</a>
            <a href="#etapas" className="hidden rounded-md px-3 py-2 text-sm font-semibold md:block" style={{ color: 'var(--muted)' }}>Etapas</a>
            <Link to="/login" className="rounded-md px-3 py-2 text-sm font-semibold" style={{ color: 'var(--leaf)' }}>Iniciar sesión</Link>
            <Link to="/signup" className="np-btn np-btn-berry !min-h-10 !px-4 text-sm sm:!px-5">Crear cuenta</Link>
          </nav>
        </div>
      </header>

      <section className="relative" style={{ background: 'var(--leaf)' }}>
        <HeroPhoto />
        <div className="relative mx-auto max-w-7xl px-5 pb-12 pt-2 sm:px-8 md:pb-16 lg:flex lg:min-h-[620px] lg:items-center lg:py-20">
          <div className="np-intro max-w-xl text-white md:max-w-2xl lg:max-w-[34rem]">
            <h1 className="text-[2.35rem] font-extrabold leading-[1.04] sm:text-5xl lg:text-[3.6rem]">
              Cada gota, donde la fresa la necesita.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
              Neptuno mide el suelo, consulta el clima y abre la válvula solo cuando el cultivo lo pide.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup" className="np-btn np-btn-berry">Crear cuenta</Link>
              <a href="#plataforma" className="np-btn np-btn-ghost">Cómo funciona</a>
            </div>
            <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-white/20 pt-6 sm:grid-cols-3">
              {readout.map(([label, value, note]) => (
                <div key={label}>
                  <dt className="text-sm text-white/65">{label}</dt>
                  <dd className="np-display mt-1 text-2xl font-bold">{value}</dd>
                  <dd className="text-sm text-white/60">{note}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section id="plataforma" className="px-5 py-16 sm:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl" style={{ color: 'var(--leaf)' }}>Un ciclo completo, sin visitas diarias al campo</h2>
          <ol className="np-flow mt-12 grid gap-10 pl-9 md:grid-cols-3 md:gap-8 md:pl-0 md:pt-9">
            {flow.map((step) => (
              <li key={step.title} className="relative">
                <span aria-hidden="true" className="absolute -left-9 top-1 h-3.5 w-3.5 rounded-full md:-top-9 md:left-0" style={{ background: 'var(--berry)' }} />
                <h3 className="text-xl font-bold" style={{ color: 'var(--leaf)' }}>{step.title}</h3>
                <p className="mt-2 max-w-sm leading-7" style={{ color: 'var(--muted)' }}>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 md:py-24" style={{ background: 'var(--wash)' }}>
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.4fr]">
          <h2 className="max-w-sm text-3xl font-bold leading-tight sm:text-4xl" style={{ color: 'var(--leaf)' }}>Lo que hace por su cultivo</h2>
          <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {capabilities.map(([term, text]) => (
              <div key={term}>
                <dt className="np-display text-lg font-bold" style={{ color: 'var(--leaf)' }}>{term}</dt>
                <dd className="mt-1.5 leading-7" style={{ color: 'var(--muted)' }}>{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="etapas" className="px-5 py-16 sm:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl" style={{ color: 'var(--leaf)' }}>Una dosis de agua distinta en cada etapa</h2>
          <p className="mt-4 max-w-lg leading-7" style={{ color: 'var(--muted)' }}>
            Según la fecha de siembra, la plataforma propone la etapa y su humedad objetivo del suelo. Todos los valores se ajustan por cultivo.
          </p>
          <ul className="mt-10 grid gap-8 md:max-w-3xl">
            {stages.map((stage) => (
              <li key={stage.name} className="grid items-center gap-x-6 gap-y-2 sm:grid-cols-[11rem_1fr]">
                <div>
                  <p className="np-display text-lg font-bold" style={{ color: 'var(--leaf)' }}>{stage.name}</p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>{stage.note}</p>
                </div>
                <div>
                  <div className="np-range" role="img" aria-label={`Humedad objetivo de ${stage.min} a ${stage.max} por ciento`}>
                    <span style={{ left: `${stage.min}%`, width: `${stage.max - stage.min}%` }} />
                  </div>
                  <p className="mt-1.5 text-sm font-semibold" style={{ color: 'var(--leaf-2)' }}>{stage.min} – {stage.max} % de humedad</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-12 max-w-2xl border-l-4 pl-5 text-lg leading-8" style={{ borderColor: 'var(--berry)', color: 'var(--ink)' }}>
            Si se pierde la conexión, el controlador sigue con la última configuración recibida y cierra la válvula si detecta una falla.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 md:py-20" style={{ background: 'var(--leaf)' }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl text-white">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">Pruébelo antes de conectar el equipo</h2>
            <p className="mt-3 leading-7 text-white/75">Cree su cuenta, registre su cultivo y compruebe el riego en el simulador.</p>
          </div>
          <Link to="/signup" className="np-btn np-btn-berry self-start md:self-auto">Crear cuenta</Link>
        </div>
      </section>

      <footer style={{ background: 'var(--mist)' }}>
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 sm:px-8 md:flex-row">
          <Brand className="h-11 mix-blend-multiply" />
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--muted)' }}>
            <Link to="/terminos" className="hover:underline">Términos y condiciones</Link>
            <Link to="/privacidad" className="hover:underline">Política de privacidad</Link>
            <span>© {new Date().getFullYear()} Neptuno</span>
          </div>
        </div>
      </footer>
    </main>
  </>
);

export default HomePage;
