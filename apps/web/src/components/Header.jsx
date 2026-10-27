
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, LayoutDashboard, Sliders, BarChart3, LogOut, History, Sprout, Settings, Activity, FlaskConical, ChevronDown, Radio, FileText } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import pb from '@/lib/pocketbaseClient';
import { useCrop } from '@/contexts/CropContext';

const Header = () => {
  const { currentUser, logout } = useAuth();
  const { crops, selectedCropId, selectCrop, loading: cropsLoading, error: cropsError } = useCrop();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
    navigate('/');
  };

  const navLinks = [
    { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
    { to: '/control', label: 'Panel de Control', short: 'Panel', icon: Sliders },
    { to: '/statistics', label: 'Estadísticas', icon: BarChart3 },
    { to: '/historial', label: 'Historial de Riego', short: 'Historial', icon: History },
    { to: '/sensors', label: 'Sensores', icon: Radio },
    { to: '/reports', label: 'Reportes', icon: FileText },
    { to: '/crops', label: 'Cultivos', icon: Sprout },
    { to: '/simulator', label: 'Laboratorio', icon: FlaskConical },
    { to: '/settings', label: 'Ajustes', icon: Settings },
    { to: '/summary', label: 'Resumen', icon: Activity },
  ];

  const isActive = (path) => location.pathname === path;

  // Indicador verde que se desliza bajo la pestaña activa (único movimiento del encabezado).
  const tabsRef = useRef(null);
  const tabRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });

  const measureIndicator = () => {
    const activeLink = navLinks.find((link) => isActive(link.to));
    const el = activeLink && tabRefs.current[activeLink.to];
    if (!el) {
      setIndicator((prev) => ({ ...prev, visible: false }));
      return;
    }
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth, visible: true });
  };

  useLayoutEffect(measureIndicator, [location.pathname]);
  useEffect(() => {
    window.addEventListener('resize', measureIndicator);
    return () => window.removeEventListener('resize', measureIndicator);
  }, [location.pathname]);

  const getUserInitials = () => {
    if (currentUser?.name) {
      return currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return currentUser?.email?.[0]?.toUpperCase() || 'U';
  };

  const cropSelect = (
    <label className="relative hidden md:block">
      <span className="sr-only">Cultivo seleccionado</span>
      <Sprout aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-700" />
      <select
        aria-label="Cultivo seleccionado"
        value={selectedCropId}
        onChange={(event) => selectCrop(event.target.value)}
        disabled={cropsLoading || crops.length === 0}
        title={cropsError || undefined}
        className="h-10 max-w-[12rem] appearance-none rounded-full border border-teal-100 bg-teal-50/70 pl-9 pr-9 text-sm font-medium text-slate-700 transition-colors hover:border-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:text-slate-400"
      >
        {crops.length === 0
          ? <option value="">{cropsLoading ? 'Cargando cultivos…' : cropsError ? 'Error al cargar cultivos' : 'Sin cultivos'}</option>
          : crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </label>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-teal-100 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Barra superior: marca, cultivo activo, alertas y cuenta */}
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="group flex shrink-0 items-center" aria-label="Neptuno, inicio">
            <img
              src="/neptuno-logo-cropped.png"
              alt="Neptuno"
              className="h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.03]"
            />
          </Link>

          <div className="flex items-center gap-3">
            {cropSelect}
            {currentUser && <NotificationBell />}

            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" aria-label="Menú de la cuenta" className="relative h-10 w-10 rounded-full p-0 hover:bg-teal-50">
                    <Avatar className="h-10 w-10 border-2 border-teal-100">
                      {currentUser?.avatar && (
                        <AvatarImage src={pb.files.getUrl(currentUser, currentUser.avatar)} alt={currentUser.name || 'Usuario'} />
                      )}
                      <AvatarFallback className="bg-teal-700 font-semibold text-white">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <div className="border-b border-gray-100 px-2 py-2">
                    <p className="text-sm font-medium text-gray-900">{currentUser?.name || 'Usuario'}</p>
                    <p className="truncate text-xs text-gray-500">{currentUser?.email}</p>
                  </div>
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-rose-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              variant="ghost"
              size="icon"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
              className="md:hidden"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Barra de pestañas (escritorio y tablet) */}
        <nav aria-label="Navegación principal" className="-mx-1 hidden md:block">
          <div ref={tabsRef} className="relative flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  ref={(node) => { tabRefs.current[link.to] = node; }}
                  aria-label={link.label}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-3.5 py-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 ${
                    active ? 'text-teal-800' : 'text-slate-500 hover:bg-teal-50/70 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-teal-700' : ''}`} aria-hidden="true" />
                  <span>{link.short || link.label}</span>
                </Link>
              );
            })}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-teal-700 transition-[transform,width,opacity] duration-300 ease-out motion-reduce:transition-none"
              style={{
                width: indicator.width,
                transform: `translateX(${indicator.left}px)`,
                opacity: indicator.visible ? 1 : 0,
              }}
            />
          </div>
        </nav>
      </div>
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="absolute right-2 top-full z-50 w-[min(20rem,calc(100vw-1rem))] rounded-b-2xl border border-teal-100 bg-white p-4 shadow-xl md:hidden"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <Avatar className="h-11 w-11 border-2 border-teal-200">
              {currentUser?.avatar && (
                <AvatarImage src={pb.files.getUrl(currentUser, currentUser.avatar)} alt={currentUser.name || 'Usuario'} />
              )}
              <AvatarFallback className="font-semibold text-white bg-teal-700">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{currentUser?.name || 'Usuario'}</p>
              <p className="truncate text-xs text-slate-500">{currentUser?.email}</p>
            </div>
          </div>
          <nav aria-label="Menú móvil" className="space-y-1 py-4">
            <label className="mb-3 block space-y-1 px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cultivo activo</span>
              <select
                aria-label="Cultivo seleccionado"
                value={selectedCropId}
                onChange={(event) => selectCrop(event.target.value)}
                disabled={cropsLoading || crops.length === 0}
                title={cropsError || undefined}
                className="h-10 w-full rounded-lg border border-teal-200 bg-white px-3 text-sm text-slate-700 disabled:text-slate-400"
              >
                {crops.length === 0
                  ? <option value="">{cropsLoading ? 'Cargando cultivos…' : cropsError ? 'Error al cargar cultivos' : 'Sin cultivos'}</option>
                  : crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
              </select>
            </label>
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${
                    isActive(link.to)
                      ? 'bg-teal-50 font-medium text-teal-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      )}
    </header>
  );
};

export default Header;
