
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, LayoutDashboard, Sliders, BarChart3, LogOut, History, Sprout, Settings, Activity } from 'lucide-react';
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
    { to: '/control', label: 'Panel de Control', icon: Sliders },
    { to: '/statistics', label: 'Estadísticas', icon: BarChart3 },
    { to: '/historial', label: 'Historial de Riego', icon: History },
    { to: '/crops', label: 'Cultivos', icon: Sprout },
    { to: '/settings', label: 'Ajustes', icon: Settings },
    { to: '/summary', label: 'Resumen', icon: Activity },
  ];

  const isActive = (path) => location.pathname === path;

  const getUserInitials = () => {
    if (currentUser?.name) {
      return currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return currentUser?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-teal-100 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-2.5" aria-label="Neptuno, inicio">
            <img
              src="/neptuno-logo-cropped.png"
              alt="Neptuno"
              className="h-12 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
                    isActive(link.to)
                      ? 'bg-teal-50 text-teal-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <label className="hidden xl:flex xl:items-center xl:gap-2">
            <span className="sr-only">Cultivo seleccionado</span>
            <select
              aria-label="Cultivo seleccionado"
              value={selectedCropId}
              onChange={(event) => selectCrop(event.target.value)}
              disabled={cropsLoading || crops.length === 0}
              title={cropsError || undefined}
              className="max-w-44 rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:text-slate-400"
            >
              {crops.length === 0
                ? <option value="">{cropsLoading ? 'Cargando cultivos…' : cropsError ? 'Error al cargar cultivos' : 'Sin cultivos'}</option>
                : crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
            </select>
          </label>

          {/* User Menu & Alerts */}
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            {currentUser && <NotificationBell />}

            {/* Desktop User Dropdown */}
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 border-2 border-teal-200">
                      {currentUser?.avatar && (
                        <AvatarImage src={pb.files.getUrl(currentUser, currentUser.avatar)} alt={currentUser.name || 'Usuario'} />
                      )}
                      <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white font-semibold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{currentUser?.name || 'Usuario'}</p>
                    <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                  </div>
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Menu */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
              className="md:hidden"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </div>
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
              <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-600 font-semibold text-white">
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
