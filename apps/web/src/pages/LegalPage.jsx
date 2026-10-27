import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ArrowLeft } from 'lucide-react';

const VERSION = '27 de octubre de 2026';
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL || '';
const contactLine = CONTACT ? `escribiendo a ${CONTACT}` : 'escribiendo al correo de contacto del equipo de Neptuno';

const TERMS = {
  title: 'Términos y condiciones',
  intro: 'Estas reglas explican cómo puedes usar Neptuno. Al crear tu cuenta aceptas lo que sigue.',
  sections: [
    ['Qué es Neptuno', 'Neptuno es una plataforma para monitorear y controlar el riego por goteo de cultivos de fresa: muestra lecturas de sensores, permite programar y automatizar el riego y guarda el historial. Nació como proyecto de grado y se ofrece tal como está, sin costo.'],
    ['Tu cuenta', 'Debes dar un correo válido y verificarlo. Eres responsable de guardar tu contraseña y de lo que se haga con tu cuenta. Puedes descargar tus datos o eliminar tu cuenta cuando quieras desde Ajustes.'],
    ['El riego es tu responsabilidad', 'Neptuno es una ayuda para decidir y automatizar, no un sustituto de la supervisión del cultivo. Los sensores pueden fallar, descalibrarse o perder conexión, y una válvula o un tubo pueden averiarse. Revisa tu sistema con frecuencia. Neptuno no garantiza una cosecha, un ahorro de agua concreto ni que el riego ocurra sin fallas, y no responde por daños en cultivos, equipos o instalaciones derivados del uso del servicio.'],
    ['Modo manual y automático', 'Tú defines el modo de control, los rangos de humedad y los límites de riego. Neptuno incluye medidas de seguridad (tiempo máximo de riego, descanso entre riegos, parada si el dispositivo deja de reportar), pero no reemplazan tu criterio.'],
    ['Pronóstico de lluvia', 'La función de no regar si se espera lluvia usa un pronóstico de un servicio externo (Open-Meteo). Es una estimación y puede fallar; si el suelo está muy seco, Neptuno riega de todos modos.'],
    ['Datos de ejemplo y laboratorio', 'Los datos de demostración y el laboratorio de simulación son ficticios, están marcados como tal y no representan un cultivo real. No los uses para tomar decisiones de riego.'],
    ['Notificaciones', 'Puedes recibir alertas por correo y, si lo activas, por WhatsApp. Las alertas son un apoyo y pueden retrasarse o no llegar si falla el internet o el proveedor del mensaje. Puedes apagarlas cuando quieras.'],
    ['Uso adecuado', 'No uses Neptuno para actividades ilegales, para intentar entrar a cuentas ajenas ni para sobrecargar el servicio. Podemos suspender cuentas que lo hagan.'],
    ['Disponibilidad y cambios', 'Hacemos lo posible por mantener el servicio disponible, pero puede haber interrupciones o cambios. Podemos actualizar estos términos; la fecha de la versión vigente aparece al inicio de esta página.'],
    ['Ley aplicable', 'Estos términos se rigen por las leyes de Colombia.'],
  ],
};

const PRIVACY = {
  title: 'Política de privacidad',
  intro: 'Aquí te contamos qué datos guarda Neptuno, para qué los usa y qué puedes hacer con ellos, conforme a la Ley 1581 de 2012 de protección de datos personales de Colombia.',
  sections: [
    ['Quién es el responsable', `El responsable del tratamiento es el equipo del proyecto Neptuno. Puedes contactarnos ${contactLine}.`],
    ['Qué datos guardamos', 'Tu nombre y correo (y tu contraseña, guardada de forma cifrada); los datos de tus cultivos, zonas, sensores y dispositivos; las lecturas de humedad, temperatura y nivel de agua; el historial de riegos; tus preferencias; y, solo si lo activas, tu número de celular para WhatsApp y la ubicación aproximada del cultivo para consultar el pronóstico de lluvia.'],
    ['Para qué los usamos', 'Para mostrarte el estado de tu cultivo, controlar y registrar el riego, enviarte alertas y generar reportes. No vendemos tus datos ni los usamos para publicidad.'],
    ['Con quién se comparten', 'Solo con los servicios necesarios para funcionar: el proveedor de correo que envía tus códigos y alertas; Open-Meteo, que recibe las coordenadas del cultivo si activas «no regar con lluvia»; Google, si inicias sesión con tu cuenta de Google; y el proveedor de WhatsApp, que recibe tu número y el texto de la alerta si activas ese aviso.'],
    ['Cuánto tiempo los conservamos', 'Las lecturas detalladas se conservan el tiempo que elijas en Ajustes y luego se resumen por hora. El resto de tus datos se conserva mientras tengas tu cuenta.'],
    ['Tus derechos', 'Puedes conocer, actualizar y rectificar tus datos, pedir que se supriman, revocar tu autorización y reclamar ante la Superintendencia de Industria y Comercio. Desde Ajustes puedes descargar todos tus datos y eliminar tu cuenta, lo que borra tus cultivos, sensores, riegos y lecturas.'],
    ['Seguridad', 'Usamos conexiones cifradas y cada persona solo puede ver sus propios datos. Ningún sistema es infalible: usa una contraseña única y no la compartas.'],
    ['Menores de edad', 'Neptuno no está dirigido a menores de 18 años.'],
    ['Cambios', 'Si cambiamos esta política, actualizaremos la fecha de versión al inicio de la página.'],
  ],
};

const LegalPage = ({ kind }) => {
  const doc = kind === 'privacy' ? PRIVACY : TERMS;
  const other = kind === 'privacy' ? { to: '/terminos', label: 'Términos y condiciones' } : { to: '/privacidad', label: 'Política de privacidad' };
  return (
    <>
      <Helmet><title>{doc.title} - Neptuno</title></Helmet>
      <main className="min-h-screen bg-dew px-5 py-10 text-slate-800">
        <article className="mx-auto max-w-3xl rounded-3xl border border-white bg-white p-6 shadow-lg shadow-sky-900/5 sm:p-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a Neptuno
          </Link>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">{doc.title}</h1>
          <p className="mt-1 text-sm text-slate-500">Versión del {VERSION}</p>
          <p className="mt-5 leading-7 text-slate-700">{doc.intro}</p>
          <div className="mt-8 space-y-7">
            {doc.sections.map(([heading, text]) => (
              <section key={heading}>
                <h2 className="text-lg font-bold text-slate-900">{heading}</h2>
                <p className="mt-2 leading-7 text-slate-700">{text}</p>
              </section>
            ))}
          </div>
          <p className="mt-10 border-t border-slate-100 pt-5 text-sm text-slate-500">
            Consulta también: <Link to={other.to} className="font-semibold text-blue-700 hover:underline">{other.label}</Link>
          </p>
        </article>
      </main>
    </>
  );
};

export default LegalPage;
