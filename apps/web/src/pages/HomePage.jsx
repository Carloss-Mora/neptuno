import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Droplets, Leaf, TrendingUp, Shield, Zap, Clock } from 'lucide-react';
const HomePage = () => {
  const features = [{
    icon: Droplets,
    title: 'Riego Inteligente',
    description: 'Riego automatizado basado en la humedad del suelo en tiempo real y datos meteorológicos.'
  }, {
    icon: Leaf,
    title: 'Optimización de Cultivos',
    description: 'Maximiza el rendimiento de tus fresas con una gestión precisa del agua.'
  }, {
    icon: TrendingUp,
    title: 'Análisis de Agua',
    description: 'Rastrea patrones de consumo y optimiza el uso de recursos.'
  }, {
    icon: Shield,
    title: 'Monitoreo Confiable',
    description: 'Monitoreo de sensores 24/7 con alertas y notificaciones instantáneas.'
  }, {
    icon: Zap,
    title: 'Eficiencia Energética',
    description: 'Reduce el desperdicio de agua y disminuye los costos operativos.'
  }, {
    icon: Clock,
    title: 'Control Programado',
    description: 'Establece horarios de riego personalizados adaptados a tus cultivos.'
  }];
  return <>
      <Helmet>
        <title>Neptuno - Sistema de Riego Automático</title>
        <meta name="description" content="Automatiza el riego de tus cultivos de fresas con el sistema de monitoreo inteligente de Neptuno. Sensores en tiempo real, controles inteligentes y análisis de agua." />
      </Helmet>

      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative h-screen flex items-center justify-center overflow-hidden">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img src="https://images.unsplash.com/photo-1697165927010-a966c1456ea7" alt="Cultivo de fresas con sistema de riego" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-800/60 to-slate-900/90"></div>
          </div>

          {/* Hero Content */}
          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
            {/* Logo Image */}
            <div className="mb-8 transform hover:scale-105 transition-transform duration-500">
              <img src="https://horizons-cdn.hostinger.com/2f825762-810b-4e8e-874a-392eb2481818/dee86fa59fe69c97121ae2a3444ed036.jpg" alt="Neptuno Logo" className="h-24 md:h-32 w-auto rounded-2xl shadow-2xl border-2 border-white/10" />
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-tight tracking-tight drop-shadow-lg">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-300">Neptuno</span> <br className="hidden sm:block" />
              <span className="text-3xl sm:text-5xl lg:text-6xl font-bold mt-2 block text-gray-100">Riego Inteligente para Cultivos de Fresa</span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-gray-200 mb-10 max-w-3xl mx-auto leading-relaxed drop-shadow-md font-medium">
              Automatiza tu riego con monitoreo en tiempo real, controles inteligentes e información basada en datos. Maximiza el rendimiento mientras conservas agua.
            </p>
            
            <Link to="/login">
              <Button size="lg" className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white text-lg px-10 py-7 rounded-xl shadow-[0_0_40px_rgba(20,184,166,0.4)] hover:shadow-[0_0_60px_rgba(20,184,166,0.6)] transition-all duration-300 hover:-translate-y-1 font-bold border border-teal-400/30">
                Comenzar Ahora
                <Droplets className="ml-3 w-6 h-6" />
              </Button>
            </Link>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
            <div className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center p-2">
              <div className="w-1 h-3 bg-white/70 rounded-full animate-bounce"></div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
                ¿Por qué elegir Neptuno?
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                La tecnología avanzada se encuentra con la experiencia agrícola para una gestión óptima de los cultivos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => {
              const Icon = feature.icon;
              return <div key={index} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-slate-100">
                    <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center mb-6 shadow-md">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                  </div>;
            })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-gradient-to-br from-slate-900 via-teal-900 to-cyan-900 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1542355838-1a6fcf5a9fd1')] bg-cover bg-center mix-blend-overlay"></div>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              ¿Listo para transformar tu riego?
            </h2>
            <p className="text-xl text-teal-100 mb-10 max-w-2xl mx-auto">
              Únete a los agricultores que ya están ahorrando agua y aumentando sus rendimientos con Neptuno.
            </p>
            <Link to="/login">
              <Button size="lg" className="bg-white text-teal-800 hover:bg-gray-50 text-lg px-10 py-6 rounded-xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 font-bold">
                Iniciar Monitoreo
                <Droplets className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-3 mb-4 md:mb-0">
                <img src="https://horizons-cdn.hostinger.com/2f825762-810b-4e8e-874a-392eb2481818/dee86fa59fe69c97121ae2a3444ed036.jpg" alt="Neptuno Logo" className="h-8 w-auto rounded opacity-80 grayscale hover:grayscale-0 transition-all" />
                <span className="text-xl font-bold text-slate-200">Neptuno</span>
              </div>
              <p className="text-sm">
                © 2026 Neptuno. Riego inteligente para una agricultura sostenible.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>;
};
export default HomePage;