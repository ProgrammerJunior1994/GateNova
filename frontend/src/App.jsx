import React from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, ArrowLeftRight, Users, CarFront, CreditCard,
  MapPin, Clock3, CheckCircle2, XCircle, Menu, Plus, Trash2,
  RefreshCw, Search, AlertCircle, X, Pencil, LogOut, Eye, EyeOff, ShieldCheck, Download
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const modules = [
  { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
  { id: 'logs', label: 'Registro de accesos', icon: ArrowLeftRight },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'vehicles', label: 'Vehículos', icon: CarFront },
  { id: 'cards', label: 'Tarjetas RFID', icon: CreditCard },
  { id: 'points', label: 'Puntos de acceso', icon: MapPin },
];

const titles = {
  dashboard: 'Resumen de accesos', logs: 'Registro de accesos', users: 'Usuarios',
  vehicles: 'Vehículos', cards: 'Tarjetas RFID', points: 'Puntos de acceso'
};

const LanguageContext = createContext('es');
const translations = {
  es: {
    administration: 'Administración', dashboard: 'Resumen', logs: 'Registro de accesos',
    users: 'Usuarios', vehicles: 'Vehículos', cards: 'Tarjetas RFID', points: 'Puntos de acceso',
    refresh: 'Actualizar', newRecord: 'Nuevo registro', search: 'Buscar en este módulo...',
    previous: 'Anterior', next: 'Siguiente', page: 'Página', records: 'registro(s)',
    loading: 'Cargando información...', empty: 'No hay registros para mostrar.',
    language: 'Idioma', english: 'Inglés', spanish: 'Español',
    administrator: 'Administrador', controlPanel: 'Panel de control', system: 'SISTEMA DE CONTROL VEHICULAR',
  },
  en: {
    administration: 'Administration', dashboard: 'Dashboard', logs: 'Access log',
    users: 'Users', vehicles: 'Vehicles', cards: 'RFID cards', points: 'Access points',
    refresh: 'Refresh', newRecord: 'New record', search: 'Search this module...',
    previous: 'Previous', next: 'Next', page: 'Page', records: 'record(s)',
    loading: 'Loading information...', empty: 'No records to display.',
    language: 'Language', english: 'English', spanish: 'Spanish',
    administrator: 'Administrator', controlPanel: 'Control panel', system: 'VEHICLE ACCESS CONTROL SYSTEM',
  }
};
function useTranslation() {
  const language = useContext(LanguageContext);
  return translations[language];
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const data = await response.json();
      message = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
    } catch { }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'es-MX', { dateStyle: 'short', timeStyle: 'short' });
}
function roleLabel(value) {
  const english = document.documentElement.lang === 'en';
  return (english
    ? { student: 'Student', teacher: 'Teacher', admin: 'Administrator', alumno: 'Student', docente: 'Teacher', administrativo: 'Administrative' }
    : { student: 'Estudiante', teacher: 'Docente', admin: 'Administrador', alumno: 'Estudiante', docente: 'Docente', administrativo: 'Administrativo' })[value] || value;
}
function resultLabel(value) {
  return value === 'authorized' ? 'Autorizado' : 'Rechazado';
}
function directionLabel(value) {
  const english = document.documentElement.lang === 'en';
  return value === 'entry' ? (english ? 'Entry' : 'Entrada') : (english ? 'Exit' : 'Salida');
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('gatenova-authenticated') === 'true');
  const [active, setActive] = useState(() => {
    const savedModule = localStorage.getItem('gatenova-active-module');
    return modules.some(({ id }) => id === savedModule) ? savedModule : 'dashboard';
  });
  const [mobileNav, setMobileNav] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [cards, setCards] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem('gatenova-language') || 'es');
  const [adminName] = useState(() => {
    const savedName = localStorage.getItem('gatenova-admin-name');
    return savedName && savedName.trim() ? savedName.trim() : 'Administrador';
  });
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1, total: 0 });
  const logTotalRef = useRef(null);
  const t = translations[language];

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (active === 'dashboard') {
        const [summary, logs, pts, cs, vs] = await Promise.all([
          request('/api/dashboard'), request('/api/access-logs?page_size=6'), request('/api/access-points?page_size=500'),
          request('/api/cards?page_size=500'), request('/api/vehicles?page_size=500')
        ]);
        setDashboard(summary); setData(logs.items); setPoints(pts.items); setCards(cs.items); setVehicles(vs.items);
      } else if (active === 'logs') {
        const [logs, us, cs, vs, pts] = await Promise.all([
          request(`/api/access-logs?page=${page}&page_size=10`), request('/api/users?page_size=500'), request('/api/cards?page_size=500'),
          request('/api/vehicles?page_size=500'), request('/api/access-points?page_size=500')
        ]);
        logTotalRef.current = logs.total;
        setData(logs.items); setPageInfo(logs); setUsers(us.items); setCards(cs.items); setVehicles(vs.items); setPoints(pts.items);
      } else if (active === 'users') {
        const [items, roles] = await Promise.all([request(`/api/users?page=${page}&page_size=10`), request('/api/user-roles')]);
        setData(items.items); setPageInfo(items); setRoleOptions(roles);
      } else if (active === 'vehicles') {
        const [items, us] = await Promise.all([request(`/api/vehicles?page=${page}&page_size=10`), request('/api/users?page_size=500')]);
        setData(items.items); setPageInfo(items); setUsers(us.items);
      } else if (active === 'cards') {
        const [items, us] = await Promise.all([request(`/api/cards?page=${page}&page_size=10`), request('/api/users?page_size=500')]);
        setData(items.items); setPageInfo(items); setUsers(us.items);
      } else if (active === 'points') {
        const items = await request(`/api/access-points?page=${page}&page_size=10`);
        setData(items.items); setPageInfo(items);
      }
    } catch (e) {
      setError(`${e.message}. Comprueba que FastAPI esté ejecutándose y que PostgreSQL esté configurado.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) load();
  }, [authenticated, active, refreshKey, page]);

  useEffect(() => {
    if (!authenticated || active !== 'logs' || loading) return;

    let cancelled = false;
    let polling = false;
    const refreshLogs = async () => {
      if (polling) return;
      polling = true;
      try {
        const logs = await request(`/api/access-logs?page=${page}&page_size=10`);
        if (cancelled) return;
        const hasNewLogs = logTotalRef.current !== null && logs.total > logTotalRef.current;
        logTotalRef.current = logs.total;
        if (hasNewLogs && page > 1) {
          setPage(1);
          return;
        }
        setData(logs.items);
        setPageInfo(logs);
      } catch (e) {
        if (!cancelled) setError(`${e.message}. Comprueba que FastAPI esté ejecutándose y que PostgreSQL esté configurado.`);
      } finally {
        polling = false;
      }
    };

    const timer = setInterval(refreshLogs, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authenticated, active, loading, page]);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem('gatenova-language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('gatenova-active-module', active);
  }, [active]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(item => JSON.stringify(item).toLowerCase().includes(q));
  }, [data, search]);

  async function createRecord(payload) {
    setSaving(true);
    try {
      const endpoints = { users: '/api/users', vehicles: '/api/vehicles', cards: '/api/cards', points: '/api/access-points', logs: '/api/access-logs' };
      await request(endpoints[active], { method: 'POST', body: JSON.stringify(payload) });
      setModal(false); setToast('Registro guardado correctamente.'); setRefreshKey(v => v + 1);
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function exportReport(startDate, endDate) {
    setExportingReport(true);
    setError('');
    try {
      const params = new URLSearchParams({ start_date: startDate });
      if (endDate) params.set('end_date', endDate);
      const response = await fetch(`${API}/api/access-logs/report?${params}`);
      if (!response.ok) {
        let message = `Error ${response.status}`;
        try {
          const result = await response.json();
          message = typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail || result);
        } catch { }
        throw new Error(message);
      }

      const report = await response.blob();
      const url = URL.createObjectURL(report);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-registros-${startDate}-${endDate || startDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setReportModal(false);
      setToast(language === 'en' ? 'Report downloaded.' : 'Reporte descargado correctamente.');
    } catch (e) {
      setError(e.message);
    } finally {
      setExportingReport(false);
    }
  }

  async function updateUser(id, payload) {
    setSaving(true);
    try {
      await request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      setEditingUser(null);
      setToast('Usuario actualizado correctamente.');
      setRefreshKey(v => v + 1);
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function deleteRecord(id) {
    if (!window.confirm('¿Seguro que deseas eliminar este registro?')) return;
    const endpoints = {
      users: `/api/users/${id}`, vehicles: `/api/vehicles/${id}`, cards: `/api/cards/${id}`,
      points: `/api/access-points/${id}`
    };
    try {
      await request(endpoints[active], { method: 'DELETE' });
      setToast('Registro eliminado.'); setRefreshKey(v => v + 1);
    } catch (e) { setError(e.message); }
  }

  const canCreate = ['users', 'vehicles', 'cards', 'points'].includes(active);
  const updateSearch = value => { setSearch(value); setPage(1); };
  const pageTitle = language === 'en'
    ? { dashboard: 'Access dashboard', logs: 'Access log', users: 'Users', vehicles: 'Vehicles', cards: 'RFID cards', points: 'Access points' }[active]
    : titles[active];

  if (!authenticated) {
    return <LanguageContext.Provider value={language}>
      <LoginScreen
        language={language}
        onLanguageChange={setLanguage}
        onLogin={username => {
          sessionStorage.setItem('gatenova-authenticated', 'true');
          sessionStorage.setItem('gatenova-login-user', username);
          setAuthenticated(true);
        }}
      />
    </LanguageContext.Provider>;
  }

  return (
    <LanguageContext.Provider value={language}><div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-name">Gate<span>Nova</span></div>
          <p>Control de acceso vehicular</p>
        </div>
        <div className="nav-label">{t.administration}</div>
        <nav>
          {modules.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${active === id ? 'selected' : ''}`}
              onClick={() => { setActive(id); setPage(1); setSearch(''); setMobileNav(false); setError(''); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{t[id]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-light" /> API de GateNova
          <small>Panel administrativo</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Abrir menú"><Menu size={20} /></button>
          <div className="breadcrumb">GateNova <span>/</span> <strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <select className="language-select" value={language} onChange={e => setLanguage(e.target.value)} aria-label={t.language}>
              <option value="es">ES</option><option value="en">EN</option>
            </select>
            <div className="admin-chip" aria-label="Usuario administrador">
              <div className="admin-avatar">{adminName.trim().split(/\s+/).length > 1 ? adminName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() : adminName.trim().slice(0, 2).toUpperCase()}</div>
              <div><b>{adminName}</b><small>{t.controlPanel}</small></div>
            </div>
            <button type="button" className="icon-button logout-button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => { sessionStorage.removeItem('gatenova-authenticated'); sessionStorage.removeItem('gatenova-login-user'); setAuthenticated(false); }}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div><p className="eyebrow">{t.system}</p><h1>{pageTitle}</h1><p className="page-description">{language === 'en' ? descriptionsEn[active] : descriptions[active]}</p></div>
            <div className="heading-actions">
              <button className="secondary-button" onClick={() => setRefreshKey(v => v + 1)}><RefreshCw size={15} /> {t.refresh}</button>
              {active === 'logs'
                ? <button className="primary-button" onClick={() => { setError(''); setReportModal(true); }}><Download size={16} /> {language === 'en' ? 'Import report' : 'Importar registro'}</button>
                : canCreate && <button className="primary-button" onClick={() => { setError(''); setModal(true); }}><Plus size={16} /> {t.newRecord}</button>}
            </div>
          </div>

          {error && <div className="alert error-alert"><AlertCircle size={18} /><span>{error}</span><button onClick={() => setError('')} aria-label="Cerrar"><X size={16} /></button></div>}

          {active === 'dashboard' && <Dashboard summary={dashboard} logs={data} points={points} cards={cards} vehicles={vehicles} loading={loading} onOpenLogs={() => setActive('logs')} />}
          {active === 'logs' && <Logs data={filtered} users={users} cards={cards} vehicles={vehicles} points={points} loading={loading} search={search} setSearch={updateSearch} pagination={pageInfo} onPageChange={setPage} />}
          {active === 'users' && <UsersPage data={filtered} loading={loading} search={search} setSearch={updateSearch} onDelete={deleteRecord} onEdit={setEditingUser} pagination={pageInfo} onPageChange={setPage} />}
          {active === 'vehicles' && <VehiclesPage data={filtered} users={users} loading={loading} search={search} setSearch={updateSearch} onDelete={deleteRecord} pagination={pageInfo} onPageChange={setPage} />}
          {active === 'cards' && <CardsPage data={filtered} users={users} loading={loading} search={search} setSearch={updateSearch} onDelete={deleteRecord} pagination={pageInfo} onPageChange={setPage} />}
          {active === 'points' && <PointsPage data={filtered} loading={loading} search={search} setSearch={updateSearch} onDelete={deleteRecord} pagination={pageInfo} onPageChange={setPage} />}

          <footer className="page-footer">GateNova <span>·</span> Sistema de control de acceso vehicular</footer>
        </div>
      </main>

      {modal && <RecordModal type={active} users={users} cards={cards} vehicles={vehicles} points={points} roleOptions={roleOptions}
        saving={saving} onClose={() => setModal(false)} onSubmit={createRecord} />}
      {reportModal && <AccessLogReportModal language={language} exporting={exportingReport}
        onClose={() => setReportModal(false)} onSubmit={exportReport} />}
      {editingUser && <UserEditModal user={editingUser} roleOptions={roleOptions} saving={saving}
        onClose={() => setEditingUser(null)} onSubmit={payload => updateUser(editingUser.user_id, payload)} />}
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
    </div></LanguageContext.Provider>
  );
}

const descriptions = {
  dashboard: 'Indicadores generales y últimos movimientos registrados.',
  logs: 'Consulta de entradas, salidas y accesos rechazados.',
  users: 'Personas autorizadas para utilizar el acceso vehicular.',
  vehicles: 'Vehículos registrados y asociados a un responsable.',
  cards: 'Tarjetas RFID vinculadas a los usuarios del instituto.',
  points: 'Entradas y salidas físicas configuradas en el sistema.',
};
const descriptionsEn = {
  dashboard: 'General indicators and latest recorded movements.',
  logs: 'Review entries, exits, and denied access attempts.',
  users: 'People authorized to use vehicle access.',
  vehicles: 'Registered vehicles and their associated owner.',
  cards: 'RFID cards linked to institute users.',
  points: 'Physical entrances and exits configured in the system.',
};

function LoginScreen({ language, onLanguageChange, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEnglish = language === 'en';

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password })
      });
      onLogin(result.username);
    } catch (e) {
      setError(isEnglish ? 'Incorrect username or password.' : e.message);
    } finally {
      setLoading(false);
    }
  }

  return <main className="login-page">
    <div className="login-language">
      <select className="language-select" value={language} onChange={e => onLanguageChange(e.target.value)} aria-label="Language">
        <option value="es">ES</option>
        <option value="en">EN</option>
      </select>
    </div>
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-brand"><div className="login-shield"><ShieldCheck size={28} /></div><div className="brand-name">Gate<span>Nova</span></div></div>
      <p className="login-subtitle">{isEnglish ? 'Vehicle access control system' : 'Sistema de control de acceso vehicular'}</p>
      <form onSubmit={submit}>
        <h1 id="login-title">{isEnglish ? 'Administrator sign in' : 'Inicio de sesión'}</h1>
        {error && <div className="alert error-alert login-error"><AlertCircle size={17} /><span>{error}</span></div>}
        <label className="form-field login-field">
          <span>{isEnglish ? 'Username' : 'Nombre de usuario'}</span>
          <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required autoFocus placeholder={isEnglish ? 'Enter username' : 'Ingresa tu usuario'} />
        </label>
        <label className="form-field login-field">
          <span>{isEnglish ? 'Password' : 'Contraseña'}</span>
          <div className="password-input">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required placeholder={isEnglish ? 'Enter password' : 'Ingresa tu contraseña'} />
            <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>
        <button className="primary-button login-button" type="submit" disabled={loading}>{loading ? (isEnglish ? 'Signing in...' : 'Ingresando...') : (isEnglish ? 'Sign in' : 'Iniciar sesión')}</button>
      </form>
    </section>
  </main>;
}

function SearchBar({ value, onChange }) {
  const t = useTranslation();
  return <label className="search-box"><Search size={16} /><input value={value} onChange={e => onChange(e.target.value)} placeholder={t.search} /></label>;
}
function LoadingOrEmpty({ loading, empty, children }) {
  const t = useTranslation();
  if (loading) return <div className="empty-state">{t.loading}</div>;
  if (empty) return <div className="empty-state">{t.empty}</div>;
  return children;
}
function Panel({ title, subtitle, children, action }) {
  return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}
function StatCard({ label, value, detail, icon: Icon }) {
  return <div className="stat-card"><div className="stat-label">{label}<span><Icon size={18} /></span></div><div className="stat-value">{value ?? '—'}</div><div className="stat-detail">{detail}</div></div>;
}

function Dashboard({ summary, logs, points, cards, vehicles, loading, onOpenLogs }) {
  const cardLabel = id => cards.find(card => card.card_id === id)?.card_code || 'Tarjeta registrada';
  const vehicleLabel = id => vehicles.find(vehicle => vehicle.vehicle_id === id)?.plate || 'Vehículo registrado';
  return <>
    <div className="stats-grid">
      <StatCard label="Accesos de hoy" value={summary?.access_today} detail="Entradas y salidas registradas" icon={ArrowLeftRight} />
      <StatCard label="Vehículos dentro" value={summary?.vehicles_inside_estimate} detail="Estimación por eventos autorizados" icon={CarFront} />
      <StatCard label="Accesos rechazados" value={summary?.denied_today} detail="Intentos no autorizados de hoy" icon={XCircle} />
      <StatCard label="Puntos activos" value={summary ? `${summary.active_points} / ${summary.total_points}` : '—'} detail="Puntos configurados" icon={MapPin} />
    </div>
    <div className="dashboard-grid">
      <Panel title="Actividad reciente" subtitle="Últimos eventos guardados en PostgreSQL" action={<button className="text-button" onClick={onOpenLogs}>Ver historial</button>}>
        <LoadingOrEmpty loading={loading} empty={!logs.length}>
          <div className="table-scroll"><table><thead><tr><th>FECHA Y HORA</th><th>MOVIMIENTO</th><th>TARJETA</th><th>VEHÍCULO</th><th>RESULTADO</th></tr></thead>
            <tbody>{logs.map(log => <tr key={log.access_log_id}><td>{formatDate(log.access_datetime)}</td><td>{directionLabel(log.access_type)}</td><td>{log.card_code_read || (log.card_id ? cardLabel(log.card_id) : 'Sin identificar')}</td><td>{log.vehicle_id ? vehicleLabel(log.vehicle_id) : 'Sin identificar'}</td><td><Status value={log.access_result} /></td></tr>)}</tbody>
          </table></div>
        </LoadingOrEmpty>
      </Panel>
      <Panel title="Puntos de acceso" subtitle="Estado de cada punto">
        <LoadingOrEmpty loading={loading} empty={!points.length}>
          <div className="point-list">{points.map(point => <div className="point-row" key={point.access_point_id}><div className="point-icon"><MapPin size={18} /></div><div className="point-main"><b>{point.name}</b><small>{point.location} · {directionLabel(point.direction)}</small></div><Status value={point.status} /></div>)}</div>
        </LoadingOrEmpty>
      </Panel>
    </div>
    <div className="info-note"><AlertCircle size={17} /><div><b>Estado del proyecto</b><p>El panel consulta datos reales de la API. La conexión con lectores RFID y el control físico de las plumas se deben integrar por separado.</p></div></div>
  </>;
}

function Status({ value }) {
  const classes = {
    authorized: 'green', active: 'green', denied: 'red', disabled: 'gray', lost: 'red',
    inactive: 'gray', entry: 'blue', exit: 'purple'
  };
  const labels = document.documentElement.lang === 'en'
    ? { authorized: 'Authorized', denied: 'Denied', active: 'Active', disabled: 'Disabled', lost: 'Reported lost', inactive: 'Inactive', entry: 'Entry', exit: 'Exit' }
    : { authorized: 'Autorizado', denied: 'Rechazado', active: 'Activo', disabled: 'Desactivada', lost: 'Reportada perdida', inactive: 'Inactivo', entry: 'Entrada', exit: 'Salida' };
  return <span className={`status-pill ${classes[value] || 'gray'}`}>{labels[value] || value || '—'}</span>;
}

function TableToolbar({ search, setSearch, count }) {
  const t = useTranslation();
  return <div className="table-toolbar"><SearchBar value={search} onChange={setSearch} /><span>{count} {t.records}</span></div>;
}
function Pagination({ page, totalPages, onPageChange }) {
  const t = useTranslation();
  if (totalPages <= 1) return null;
  return <div className="pagination">
    <button className="pagination-button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>{t.previous}</button>
    <span>{t.page} {page} / {totalPages}</span>
    <button className="pagination-button" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>{t.next}</button>
  </div>;
}
function PaginatedTable({ data, pagination, onPageChange, children }) {
  return <>{children(data)}<Pagination page={pagination.page} totalPages={pagination.pages} onPageChange={onPageChange} /></>;
}
function UsersPage({ data, loading, search, setSearch, onDelete, onEdit, pagination, onPageChange }) {
  return <Panel title="Directorio de usuarios" subtitle="Estudiantes, docentes y personal administrativo">
    <TableToolbar search={search} setSearch={setSearch} count={data.length} />
    <LoadingOrEmpty loading={loading} empty={!data.length}><PaginatedTable data={data} pagination={pagination} onPageChange={onPageChange}>{pageData => <div className="table-scroll"><table><thead><tr><th>CÓDIGO INSTITUCIONAL</th><th>NOMBRE</th><th>ROL</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>
      {pageData.map(u => <tr key={u.user_id}><td>{u.institutional_code}</td><td><b>{u.name} {u.last_name}</b></td><td>{roleLabel(u.role)}</td><td><span className="status-pill green">Registrado</span></td><td><div className="row-actions"><button className="edit-button" onClick={() => onEdit(u)} title="Editar usuario" aria-label="Editar usuario"><Pencil size={15} /></button><DeleteButton onClick={() => onDelete(u.user_id)} /></div></td></tr>)}
    </tbody></table></div>}</PaginatedTable></LoadingOrEmpty>
  </Panel>;
}
function VehiclesPage({ data, users, loading, search, setSearch, onDelete, pagination, onPageChange }) {
  const owner = id => { const u = users.find(x => x.user_id === id); return u ? `${u.name} ${u.last_name}` : 'Usuario no encontrado'; };
  return <Panel title="Vehículos registrados" subtitle="Placas y responsable asociado">
    <TableToolbar search={search} setSearch={setSearch} count={data.length} />
    <LoadingOrEmpty loading={loading} empty={!data.length}><PaginatedTable data={data} pagination={pagination} onPageChange={onPageChange}>{pageData => <div className="table-scroll"><table><thead><tr><th>PLACA</th><th>MARCA</th><th>MODELO</th><th>RESPONSABLE</th><th>ESTADO</th><th></th></tr></thead><tbody>
      {pageData.map(v => <tr key={v.vehicle_id}><td><span className="plate">{v.plate}</span></td><td>{v.trademark}</td><td>{v.model}</td><td>{owner(v.user_id)}</td><td><Status value={v.status} /></td><td><DeleteButton onClick={() => onDelete(v.vehicle_id)} /></td></tr>)}
    </tbody></table></div>}</PaginatedTable></LoadingOrEmpty>
  </Panel>;
}
function CardsPage({ data, users, loading, search, setSearch, onDelete, pagination, onPageChange }) {
  const owner = id => { const u = users.find(x => x.user_id === id); return u ? `${u.name} ${u.last_name}` : 'Usuario no encontrado'; };
  return <Panel title="Tarjetas RFID" subtitle="Tarjetas registradas y asignadas a usuarios">
    <TableToolbar search={search} setSearch={setSearch} count={data.length} />
    <LoadingOrEmpty loading={loading} empty={!data.length}><PaginatedTable data={data} pagination={pagination} onPageChange={onPageChange}>{pageData => <div className="table-scroll"><table><thead><tr><th>CÓDIGO RFID</th><th>USUARIO ASIGNADO</th><th>FECHA DE ASIGNACIÓN</th><th>ESTADO</th><th></th></tr></thead><tbody>
      {pageData.map(c => <tr key={c.card_id}><td><span className="code-tag">{c.card_code}</span></td><td>{owner(c.user_id)}</td><td>{formatDate(c.assigned_at)}</td><td><Status value={c.status} /></td><td><DeleteButton onClick={() => onDelete(c.card_id)} /></td></tr>)}
    </tbody></table></div>}</PaginatedTable></LoadingOrEmpty>
  </Panel>;
}
function PointsPage({ data, loading, search, setSearch, onDelete, pagination, onPageChange }) {
  return <Panel title="Configuración de puntos" subtitle="Ubicaciones y dirección de movimiento">
    <TableToolbar search={search} setSearch={setSearch} count={data.length} />
    <LoadingOrEmpty loading={loading} empty={!data.length}><PaginatedTable data={data} pagination={pagination} onPageChange={onPageChange}>{pageData => <div className="table-scroll"><table><thead><tr><th>NOMBRE</th><th>UBICACIÓN</th><th>DIRECCIÓN</th><th>ESTADO</th><th></th></tr></thead><tbody>
      {pageData.map(p => <tr key={p.access_point_id}><td><b>{p.name}</b></td><td>{p.location}</td><td>{directionLabel(p.direction)}</td><td><Status value={p.status} /></td><td><DeleteButton onClick={() => onDelete(p.access_point_id)} /></td></tr>)}
    </tbody></table></div>}</PaginatedTable></LoadingOrEmpty>
  </Panel>;
}
function Logs({ data, users, cards, vehicles, points, loading, search, setSearch, pagination, onPageChange }) {
  const cardLabel = id => { const c = cards.find(x => x.card_id === id); return c ? c.card_code : 'Tarjeta no encontrada'; };
  const vehicleLabel = id => { const v = vehicles.find(x => x.vehicle_id === id); return v ? v.plate : 'Vehículo no encontrado'; };
  const pointLabel = id => { const p = points.find(x => x.access_point_id === id); return p ? p.name : 'Punto no encontrado'; };
  return <Panel title="Historial de movimientos" subtitle="Eventos de acceso registrados por la API · Actualización automática cada 5 segundos">
    <TableToolbar search={search} setSearch={setSearch} count={data.length} />
    <LoadingOrEmpty loading={loading} empty={!data.length}><PaginatedTable data={data} pagination={pagination} onPageChange={onPageChange}>{pageData => <div className="table-scroll"><table><thead><tr><th>FECHA Y HORA</th><th>MOVIMIENTO</th><th>TARJETA</th><th>VEHÍCULO</th><th>PUNTO</th><th>RESULTADO</th><th>MOTIVO</th></tr></thead><tbody>
      {pageData.map(log => <tr key={log.access_log_id}><td>{formatDate(log.access_datetime)}</td><td>{directionLabel(log.access_type)}</td><td>{log.card_id ? cardLabel(log.card_id) : log.card_code_read || 'Sin identificar'}</td><td>{log.vehicle_id ? vehicleLabel(log.vehicle_id) : 'Sin identificar'}</td><td>{pointLabel(log.access_point_id)}</td><td><Status value={log.access_result} /></td><td>{log.reason || '—'}</td></tr>)}
    </tbody></table></div>}</PaginatedTable></LoadingOrEmpty>
  </Panel>;
}

function AccessLogReportModal({ language, exporting, onClose, onSubmit }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const isEnglish = language === 'en';

  function submit(e) {
    e.preventDefault();
    onSubmit(startDate, endDate);
  }

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !exporting) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div className="modal-heading">
        <div>
          <h2 id="report-modal-title">{isEnglish ? 'Import access report' : 'Importar registro'}</h2>
          <p>{isEnglish ? 'Select the date range for the report.' : 'Selecciona el intervalo de fechas del reporte.'}</p>
        </div>
        <button className="icon-button" onClick={onClose} disabled={exporting} aria-label={isEnglish ? 'Close' : 'Cerrar'}><X size={19} /></button>
      </div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="form-field">
            <span>{isEnglish ? 'Start date' : 'Fecha inicial'}</span>
            <input type="date" value={startDate} required onChange={e => setStartDate(e.target.value)} />
          </label>
          <label className="form-field">
            <span>{isEnglish ? 'End date (optional)' : 'Fecha final (opcional)'}</span>
            <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} />
          </label>
        </div>
        <p className="report-hint">{isEnglish
          ? 'If only one date is selected, the report will include that entire day.'
          : 'Si seleccionas una sola fecha, el reporte incluirá todos los registros de ese día.'}</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={exporting}>{isEnglish ? 'Cancel' : 'Cancelar'}</button>
          <button type="submit" className="primary-button" disabled={exporting}>
            <Download size={15} /> {exporting ? (isEnglish ? 'Preparing...' : 'Preparando...') : (isEnglish ? 'Download report' : 'Descargar reporte')}
          </button>
        </div>
      </form>
    </section>
  </div>;
}

function DeleteButton({ onClick }) {
  return <button className="delete-button" onClick={onClick} title="Eliminar registro" aria-label="Eliminar registro"><Trash2 size={15} /></button>;
}

function UserEditModal({ user, roleOptions, saving, onClose, onSubmit }) {
  const [form, setForm] = useState({
    institutional_code: user.institutional_code,
    name: user.name,
    last_name: user.last_name,
    role: user.role,
    username: user.username || '',
    password: ''
  });

  function submit(e) {
    e.preventDefault();
    onSubmit({
      institutional_code: Number(form.institutional_code),
      name: form.name.trim(),
      last_name: form.last_name.trim(),
      role: form.role,
      username: form.role === 'admin' ? form.username.trim() || null : null,
      password: form.role === 'admin' ? form.password || null : null
    });
  }

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
      <div className="modal-heading"><div><h2 id="edit-user-title">Actualizar usuario</h2><p>Modifica la información del usuario seleccionado.</p></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="form-field"><span>Código institucional</span><input type="number" min="1" required value={form.institutional_code} onChange={e => setForm({ ...form, institutional_code: e.target.value })} /></label>
          <label className="form-field"><span>Nombre</span><input required maxLength="60" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label className="form-field"><span>Apellidos</span><input required maxLength="80" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label>
          <label className="form-field"><span>Rol</span><select required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roleOptions.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          {form.role === 'admin' && <>
            <label className="form-field"><span>Usuario de acceso</span><input maxLength="60" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Déjalo vacío para quitar el acceso" /></label>
            <label className="form-field"><span>Nueva contraseña</span><input type="password" maxLength="72" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Déjala vacía para conservarla" /></label>
          </>}
        </div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Actualizando...' : 'Actualizar usuario'}</button></div>
      </form>
    </section>
  </div>;
}

function RecordModal({ type, users, cards, vehicles, points, roleOptions, saving, onClose, onSubmit }) {
  const [form, setForm] = useState({});
  const [localError, setLocalError] = useState('');
  const update = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const field = (key, label, placeholder = '', required = true, type = 'text') => (
    <label className="form-field" key={key}><span>{label}</span><input type={type} value={form[key] ?? ''} placeholder={placeholder} required={required} onChange={e => update(key, e.target.value)} /></label>
  );
  const select = (key, label, options, placeholder = 'Selecciona una opción') => (
    <label className="form-field" key={key}><span>{label}</span><select value={form[key] ?? ''} required onChange={e => update(key, e.target.value)}><option value="">{placeholder}</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
  );
  const userLabel = id => { const user = users.find(item => item.user_id === id); return user ? `${user.name} ${user.last_name}` : 'Usuario no encontrado'; };
  const userOptions = users.map(u => ({ value: u.user_id, label: `${u.name} ${u.last_name} (${u.institutional_code})` }));
  const pointOptions = points.map(p => ({ value: p.access_point_id, label: `${p.name} — ${directionLabel(p.direction)}` }));
  const configs = {
    users: {
      title: 'Registrar usuario', fields: [
        field('institutional_code', 'Código institucional', 'Ej. 2026001', true, 'number'),
        field('name', 'Nombre', 'Nombre(s)'),
        field('last_name', 'Apellidos', 'Apellidos'),
        select('role', 'Rol', roleOptions.map(value => ({ value, label: roleLabel(value) })))
      ].concat(form.role === 'admin' ? [
        field('username', 'Usuario de acceso', 'Ej. Admin', false),
        field('password', 'Contraseña', 'Contraseña temporal', false, 'password')
      ] : []),
      payload: () => ({
        institutional_code: Number(form.institutional_code),
        name: form.name?.trim(),
        last_name: form.last_name?.trim(),
        role: form.role,
        username: form.role === 'admin' ? form.username?.trim() || null : null,
        password: form.role === 'admin' ? form.password || null : null
      })
    },
    vehicles: {
      title: 'Registrar vehículo', fields: [
        field('plate', 'Placa', 'ABC-123-A'),
        field('trademark', 'Marca', 'Ej. Nissan'),
        field('model', 'Modelo', 'Ej. Versa'),
        select('user_id', 'Responsable', userOptions, users.length ? 'Selecciona al responsable' : 'Primero registra un usuario')
      ], payload: () => ({ plate: form.plate?.trim().toUpperCase(), trademark: form.trademark?.trim(), model: form.model?.trim(), user_id: Number(form.user_id), status: 'active' })
    },
    cards: {
      title: 'Registrar tarjeta RFID', fields: [
        field('card_code', 'Código RFID', 'Código leído por el lector'),
        select('user_id', 'Usuario asignado', userOptions, users.length ? 'Selecciona un usuario' : 'Primero registra un usuario'),
        select('status', 'Estado', [{ value: 'active', label: 'Activa' }, { value: 'disabled', label: 'Desactivada' }, { value: 'lost', label: 'Reportada perdida' }])
      ], payload: () => ({ card_code: form.card_code?.trim(), user_id: Number(form.user_id), status: form.status || 'active' })
    },
    points: {
      title: 'Registrar punto de acceso', fields: [
        field('name', 'Nombre del punto', 'Ej. Entrada principal'),
        field('location', 'Ubicación', 'Ej. Portón norte'),
        select('direction', 'Dirección', [{ value: 'entry', label: 'Entrada' }, { value: 'exit', label: 'Salida' }]),
        select('status', 'Estado', [{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }])
      ], payload: () => ({ name: form.name?.trim(), location: form.location?.trim(), direction: form.direction, status: form.status || 'active' })
    },
    logs: {
      title: 'Registrar evento de acceso', fields: [
        select('access_type', 'Movimiento', [{ value: 'entry', label: 'Entrada' }, { value: 'exit', label: 'Salida' }]),
        select('access_result', 'Resultado', [{ value: 'authorized', label: 'Autorizado' }, { value: 'denied', label: 'Rechazado' }]),
        select('access_point_id', 'Punto de acceso', pointOptions, points.length ? 'Selecciona un punto' : 'Primero registra un punto'),
        select('card_id', 'Tarjeta (opcional)', cards.map(c => ({ value: c.card_id, label: `${c.card_code} — ${userLabel(c.user_id)}` })), 'Sin tarjeta identificada'),
        select('vehicle_id', 'Vehículo (opcional)', vehicles.map(v => ({ value: v.vehicle_id, label: `${v.plate} — ${v.trademark} ${v.model}` })), 'Sin vehículo identificado'),
        field('card_code_read', 'Código leído (opcional)', 'Código RFID desconocido', false),
        field('reason', 'Motivo o detalle (opcional)', 'Ej. Tarjeta desactivada', false)
      ], payload: () => ({ access_type: form.access_type, access_result: form.access_result, access_point_id: Number(form.access_point_id), card_id: form.card_id ? Number(form.card_id) : null, vehicle_id: form.vehicle_id ? Number(form.vehicle_id) : null, card_code_read: form.card_code_read?.trim() || null, reason: form.reason?.trim() || null })
    },
  };
  const config = configs[type];

  function submit(e) {
    e.preventDefault();
    setLocalError('');
    if (['vehicles', 'cards'].includes(type) && !users.length) return setLocalError('Registra primero un usuario para poder asignar el registro.');
    if (type === 'logs' && !points.length) return setLocalError('Registra primero un punto de acceso.');
    onSubmit(config.payload());
  }

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><div><h2 id="modal-title">{config.title}</h2><p>Completa los datos solicitados.</p></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
      <form onSubmit={submit}>
        <div className="form-grid">{config.fields}</div>
        {localError && <div className="form-error">{localError}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Guardando...' : 'Guardar registro'}</button></div>
      </form>
    </section>
  </div>;
}
