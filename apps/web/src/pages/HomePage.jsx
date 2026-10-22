import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  Droplets,
  Leaf,
  ShieldCheck,
  Sprout,
  Waves,
} from 'lucide-react';

const features = [
  {
    icon: Droplets,
    title: 'Riego inteligente',
    description: 'Consulta tus lecturas y organiza el riego de acuerdo con las condiciones de tu cultivo.',
  },
  {
    icon: CalendarClock,
    title: 'Horarios a tu medida',
    description: 'Programa cuándo empieza y termina cada riego, y revisa tus horarios desde el panel.',
  },
  {
    icon: BarChart3,
    title: 'Actividad en contexto',
    description: 'Conoce las sesiones de riego y el tiempo de funcionamiento que queda registrado.',
  },
];

const HomePage = () => (
  <>
    <Helmet>
      <title>Neptuno - Sistema de Riego Inteligente</title>
      <meta
        name="description"
        content="Monitorea y programa el riego de tus cultivos con Neptuno: sensores, horarios y actividad en un solo lugar."
      />
    </Helmet>

    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Link to="/" className="flex items-center" aria-label="Neptuno, inicio">
            <img
              src="/neptuno-logo-cropped.png"
              alt="Neptuno"
              className="h-14 w-auto object-contain sm:h-16"
            />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 sm:px-4">
              Iniciar sesión
            </Link>
            <Link to="/signup">
              <Button className="rounded-lg bg-teal-700 px-4 font-semibold text-white shadow-sm hover:bg-teal-800">
                Crear cuenta
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="overflow-hidden bg-[#f5f8f6]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 lg:py-20">
          <div className="max-w-xl">
            <p className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.1em] text-teal-800">
              <Sprout className="h-4 w-4" /> Tecnología para el campo
            </p>
            <h1 className="text-4xl font-bold leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.5rem]">
              Neptuno
            </h1>
            <p className="mt-3 text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">
              Riego inteligente para cultivos de fresa
            </p>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Supervisa tus sensores, programa horarios y conoce la actividad del sistema de riego desde un solo lugar.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup">
                <Button size="lg" className="h-12 w-full rounded-lg bg-teal-700 px-6 font-semibold text-white shadow-sm hover:bg-teal-800 sm:w-auto">
                  Comenzar ahora <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#beneficios">
                <Button size="lg" variant="outline" className="h-12 w-full rounded-lg border-slate-300 bg-white px-6 font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 sm:w-auto">
                  Conocer la plataforma
                </Button>
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-teal-700" /> Lecturas de sensores</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-teal-700" /> Horarios flexibles</span>
            </div>
          </div>

          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1697165927010-a966c1456ea7"
              alt="Sistema de riego instalado en un cultivo"
              className="h-[300px] w-full rounded-2xl object-cover shadow-lg sm:h-[400px] lg:h-[460px]"
            />
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-xl border border-white/70 bg-white/95 p-3 shadow-md sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-xs sm:p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Droplets className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Tu cultivo, mejor conectado</p>
                <p className="mt-0.5 text-xs text-slate-600">Sensores y control en un mismo panel</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-100 bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:grid-cols-3 sm:px-8">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-teal-50 p-2.5 text-teal-700"><Waves className="h-5 w-5" /></span>
            <div><h2 className="font-semibold text-slate-900">Información clara</h2><p className="mt-1 text-sm leading-6 text-slate-600">Revisa las variables principales de tu cultivo de un vistazo.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-emerald-50 p-2.5 text-emerald-700"><Leaf className="h-5 w-5" /></span>
            <div><h2 className="font-semibold text-slate-900">Control flexible</h2><p className="mt-1 text-sm leading-6 text-slate-600">Activa el sistema manualmente o deja tus horarios preparados.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-sky-50 p-2.5 text-sky-700"><ShieldCheck className="h-5 w-5" /></span>
            <div><h2 className="font-semibold text-slate-900">Actividad visible</h2><p className="mt-1 text-sm leading-6 text-slate-600">Consulta cuándo se activó el riego y cuánto tiempo estuvo funcionando.</p></div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="bg-[#f7faf9] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">Una forma más ordenada de regar</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Las herramientas que necesitas, sin complicaciones</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">Neptuno te ayuda a entender el estado del sistema y mantener tus tareas de riego organizadas.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-2xl border border-teal-100 bg-[#f5f8f6] px-6 py-8 sm:flex-row sm:items-center sm:px-10 sm:py-10">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Empieza a organizar tu riego</h2>
            <p className="mt-2 text-slate-600">Crea tu cuenta para acceder a las lecturas, controles y horarios de tu sistema.</p>
          </div>
          <Link to="/signup" className="shrink-0">
            <Button size="lg" className="rounded-lg bg-teal-700 px-6 font-semibold text-white hover:bg-teal-800">
              Crear cuenta <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 sm:flex-row sm:px-8">
          <Link to="/" className="flex items-center" aria-label="Neptuno, inicio">
            <img src="/neptuno-logo-cropped.png" alt="Neptuno" className="h-12 w-auto object-contain" />
          </Link>
          <p className="text-center text-sm text-slate-500">Riego inteligente para una agricultura sostenible.</p>
          <span className="text-xs text-slate-400">© {new Date().getFullYear()} Neptuno</span>
        </div>
      </footer>
    </main>
  </>
);

export default HomePage;
