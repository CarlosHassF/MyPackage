import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const TOKEN_KEY = 'my-package-dashboard-token';
const API_URL = import.meta.env.VITE_API_URL ?? '';

const statusNames = {
    'em separação': 'Em separação',
    enviado: 'Enviado',
    'em rota': 'Em rota',
    entregue: 'Entregue',
    devolvido: 'Devolvido',
};

const statusColors = {
    'em separação': '#9199aa',
    enviado: '#6f83e8',
    'em rota': '#f2ad50',
    entregue: '#22a879',
    devolvido: '#e27878',
};

function Icon({ name, size = 20 }) {
    const shared = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
    };

    const paths = {
        package: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v9" /><path d="m3 8v9l9 5 9-5V8" /></>,
        building: <><path d="M4 21V5l8-3 8 3v16" /><path d="M9 21v-4h6v4M8 9h.01M16 9h.01M8 13h.01M16 13h.01" /></>,
        plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
        close: <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>,
        clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
        check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
        users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
        search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
        bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
        chevron: <path d="m9 18 6-6-6-6" />,
        refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>,
        logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" /></>,
        arrow: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
    };

    return <svg {...shared}>{paths[name]}</svg>;
}

function Login({ onLogin, busy, error }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    function submit(event) {
        event.preventDefault();
        onLogin(email, password);
    }

    return (
        <main className="login-shell">
            <section className="login-card">
                <Brand />
                <div className="login-copy">
                    <p className="eyebrow">Acesso à operação</p>
                    <h1>Entre para acompanhar suas entregas.</h1>
                    <p>Use seu usuário administrativo para abrir o painel de logística.</p>
                </div>
                <form className="login-form" onSubmit={submit}>
                    <label htmlFor="email">E-mail</label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="username"
                        placeholder="voce@empresa.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                    />
                    <label htmlFor="password">Senha</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Sua senha"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />
                    {error && <p className="form-error" role="alert">{error}</p>}
                    <button className="primary-button login-button" type="submit" disabled={busy}>
                        {busy ? 'Entrando...' : 'Entrar no painel'}
                        {!busy && <Icon name="chevron" size={18} />}
                    </button>
                </form>
                <p className="login-footnote">Acesso protegido · Seus dados ficam seguros</p>
            </section>
            <aside className="login-aside">
                <div className="aside-glow" />
                <div className="aside-content">
                    <span className="aside-label">CENTRAL DE OPERAÇÕES</span>
                    <h2>Cada entrega,<br />no caminho certo.</h2>
                    <p>Visibilidade em tempo real para uma logística que não para.</p>
                    <div className="route-illustration" aria-hidden="true">
                        <div className="route-line" />
                        <span className="route-pin route-pin-start"><span /></span>
                        <span className="route-pin route-pin-end"><span /></span>
                        <span className="route-card"><Icon name="package" size={19} /> Entrega em andamento</span>
                    </div>
                </div>
                <span className="aside-footer">ENTREGAS COM MAIS INTELIGÊNCIA</span>
            </aside>
        </main>
    );
}

function Brand() {
    return (
        <a className="brand" href="/" aria-label="Rota, início">
            <span className="brand-mark"><Icon name="package" size={21} /></span>
            <span>rota<span className="brand-dot">.</span></span>
        </a>
    );
}

function MetricCard({ title, value, caption, icon, tone, trend }) {
    return (
        <article className="metric-card">
            <div className="metric-top">
                <span className={`metric-icon ${tone}`}><Icon name={icon} size={20} /></span>
                {trend && <span className="metric-trend"><Icon name="arrow" size={13} /> operação</span>}
            </div>
            <p className="metric-title">{title}</p>
            <div className="metric-value">{value.toLocaleString('pt-BR')}</div>
            <p className="metric-caption">{caption}</p>
        </article>
    );
}

function StatusChart({ statuses }) {
    const total = statuses.reduce((sum, item) => sum + item.quantidade, 0);

    return (
        <section className="panel status-panel">
            <div className="panel-heading">
                <div>
                    <h2>Visão das entregas</h2>
                    <p>Distribuição por situação atual</p>
                </div>
                <span className="period-pill">Todos os períodos</span>
            </div>
            <div className="status-chart" role="img" aria-label="Distribuição de entregas por situação">
                {statuses.map((item) => (
                    <span
                        key={item.situacao}
                        className="status-segment"
                        style={{
                            width: `${total ? (item.quantidade / total) * 100 : 0}%`,
                            backgroundColor: statusColors[item.situacao] ?? '#9199aa',
                        }}
                        title={`${statusNames[item.situacao] ?? item.situacao}: ${item.quantidade}`}
                    />
                ))}
                {!total && <span className="empty-chart">Sem entregas cadastradas</span>}
            </div>
            <div className="legend-grid">
                {statuses.map((item) => (
                    <div className="legend-item" key={item.situacao}>
                        <span className="legend-dot" style={{ backgroundColor: statusColors[item.situacao] ?? '#9199aa' }} />
                        <span>{statusNames[item.situacao] ?? item.situacao}</span>
                        <strong>{item.quantidade}</strong>
                    </div>
                ))}
            </div>
        </section>
    );
}

function RecentDeliveries({ deliveries }) {
    return (
        <section className="panel recent-panel">
            <div className="panel-heading">
                <div>
                    <h2>Entregas recentes</h2>
                    <p>Acompanhe as últimas movimentações</p>
                </div>
                <span className="recent-count">{deliveries.length} registros</span>
            </div>
            {deliveries.length ? (
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Rastreamento</th>
                                <th>Destinatário</th>
                                <th>Situação</th>
                                <th>Previsão</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deliveries.map((delivery) => (
                                <tr key={delivery.id_pacote}>
                                    <td className="tracking-cell">{delivery.cod_rastreio}</td>
                                    <td>{delivery.nome_destinatario}</td>
                                    <td>
                                        <span className={`status-badge status-${delivery.situacao.replaceAll(' ', '-')}`}>
                                            <span />
                                            {statusNames[delivery.situacao] ?? delivery.situacao}
                                        </span>
                                    </td>
                                    <td>{new Date(`${delivery.data_prevista}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state">
                    <span className="empty-icon"><Icon name="package" size={23} /></span>
                    <strong>Nenhuma entrega por aqui</strong>
                    <span>Quando novos pacotes forem cadastrados, eles aparecerão nesta lista.</span>
                </div>
            )}
        </section>
    );
}

function FitMap({ packages, routeCoordinates }) {
    const map = useMap();

    useEffect(() => {
        const bounds = routeCoordinates.length
            ? routeCoordinates
            : packages.map((delivery) => [delivery.latitude, delivery.longitude]);

        if (bounds.length === 1) {
            map.setView(bounds[0], 13);
        } else if (bounds.length > 1) {
            map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
        }
    }, [map, packages, routeCoordinates]);

    return null;
}

function RouteMap({ deliveries, packages, totalMappedPackages, token }) {
    const [selectedId, setSelectedId] = useState('');
    const [route, setRoute] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!deliveries.some((delivery) => String(delivery.id_pacote) === selectedId)) {
            setSelectedId(String(deliveries[0]?.id_pacote ?? ''));
            setRoute(null);
        }
    }, [deliveries, selectedId]);

    async function calculateRoute() {
        if (!selectedId) return;

        setLoading(true);
        setError('');
        setRoute(null);

        try {
            const response = await fetch(`${API_URL}/api/pacotes/${selectedId}/rota`, {
                headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
            });
            const result = await response.json();

            if (response.status === 401) {
                window.dispatchEvent(new CustomEvent('dashboard:unauthorized'));
                return;
            }

            if (!response.ok) throw new Error(result.message || 'Não foi possível calcular a rota.');

            setRoute(result);
        } catch (routeError) {
            setError(routeError.message || 'Falha ao conectar com o serviço de mapas.');
        } finally {
            setLoading(false);
        }
    }

    const coordinates = useMemo(
        () => route?.geometria?.coordinates?.map(([longitude, latitude]) => [latitude, longitude]) ?? [],
        [route],
    );
    const origin = route ? [route.origem.lat, route.origem.lon] : [-23.5505, -46.6333];
    const destination = route ? [route.destino.lat, route.destino.lon] : origin;
    const mappedDeliveries = packages.filter((delivery) => (
        Number.isFinite(delivery.latitude) && Number.isFinite(delivery.longitude)
    ));

    return (
        <section className="panel map-panel">
            <div className="panel-heading">
                <div>
                    <h2>Mapa de rotas</h2>
                    <p>{mappedDeliveries.length
                        ? `${mappedDeliveries.length} pacotes no mapa${totalMappedPackages > mappedDeliveries.length ? ` · exibindo os ${mappedDeliveries.length} mais recentes` : ''}`
                        : 'Os pacotes cadastrados aparecerão aqui automaticamente.'}</p>
                </div>
                {route && <span className="map-provider">OpenStreetMap</span>}
            </div>
            <div className="map-controls">
                <label className="sr-only" htmlFor="route-package">Entrega para calcular</label>
                <select
                    id="route-package"
                    value={selectedId}
                    onChange={(event) => {
                        setSelectedId(event.target.value);
                        setRoute(null);
                        setError('');
                    }}
                    disabled={!deliveries.length || loading}
                >
                    {deliveries.length
                        ? deliveries.map((delivery) => (
                            <option key={delivery.id_pacote} value={delivery.id_pacote}>
                                {delivery.cod_rastreio} · {delivery.nome_destinatario}
                            </option>
                        ))
                        : <option value="">Nenhuma entrega recente</option>}
                </select>
                <button className="route-button" onClick={calculateRoute} disabled={!selectedId || loading}>
                    {loading ? 'Calculando...' : 'Calcular rota'}
                </button>
            </div>
            <div className="map-frame">
                <MapContainer
                    center={mappedDeliveries.length
                        ? [mappedDeliveries[0].latitude, mappedDeliveries[0].longitude]
                        : origin}
                    zoom={route ? 12 : 5}
                    scrollWheelZoom={false}
                    className="leaflet-map"
                >
                    {(route || mappedDeliveries.length > 0) && (
                        <>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <FitMap packages={mappedDeliveries} routeCoordinates={coordinates} />
                            {route && (
                                <>
                                    <Polyline positions={coordinates} pathOptions={{ color: '#5969d9', weight: 5, opacity: 0.85 }} />
                                    <CircleMarker center={origin} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#5969d9', fillOpacity: 1 }} />
                                    <CircleMarker center={destination} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#21a879', fillOpacity: 1 }} />
                                </>
                            )}
                            {mappedDeliveries.map((delivery) => (
                                <CircleMarker
                                    key={delivery.id_pacote}
                                    center={[delivery.latitude, delivery.longitude]}
                                    radius={8}
                                    pathOptions={{
                                        color: '#fff',
                                        weight: 2,
                                        fillColor: statusColors[delivery.situacao] ?? '#5969d9',
                                        fillOpacity: 0.95,
                                    }}
                                >
                                    <Popup>
                                        <strong>{delivery.cod_rastreio}</strong>
                                        <br />
                                        {delivery.nome_destinatario}
                                        <br />
                                        <span>{statusNames[delivery.situacao] ?? delivery.situacao}</span>
                                    </Popup>
                                </CircleMarker>
                            ))}
                        </>
                    )}
                </MapContainer>
                {!route && !mappedDeliveries.length && !loading && (
                    <div className="map-placeholder">
                        <span className="map-placeholder-icon"><Icon name="package" size={20} /></span>
                        <strong>Nenhum pacote geolocalizado</strong>
                        <span>Cadastre um pacote para visualizar sua localização no mapa.</span>
                    </div>
                )}
                {loading && <div className="map-loading">Localizando endereços e calculando rota...</div>}
            </div>
            {error && <p className="map-error" role="alert">{error}</p>}
            {route && (
                <div className="route-summary">
                    <span><small>Distância estimada</small><strong>{route.distancia_km} km</strong></span>
                    <span><small>Tempo estimado</small><strong>{route.duracao_minutos} min</strong></span>
                    <span className="route-summary-provider">Rota calculada por {route.provedor}</span>
                </div>
            )}
            <p className="map-disclosure">
                Ao cadastrar um pacote ou calcular a rota, o endereço correspondente é consultado no OpenStreetMap/Nominatim.
            </p>
        </section>
    );
}

function Modal({ title, description, onClose, children, size = 'normal' }) {
    useEffect(() => {
        function closeOnEscape(event) {
            if (event.key === 'Escape') onClose();
        }

        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    return (
        <div className="modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <section
                className={`modal-card modal-${size}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <header className="modal-header">
                    <div>
                        <h2 id="modal-title">{title}</h2>
                        <p>{description}</p>
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Fechar">
                        <Icon name="close" size={18} />
                    </button>
                </header>
                {children}
            </section>
        </div>
    );
}

function getApiError(result, fallback) {
    return Object.values(result.errors ?? {})[0]?.[0] ?? result.message ?? fallback;
}

function CourierManager({ token, mode, onClose, onSaved, onUnauthorized }) {
    const [page, setPage] = useState(1);
    const [couriers, setCouriers] = useState(null);
    const [loadingList, setLoadingList] = useState(mode === 'list');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ nome_entregador: '', num_entregador: '' });
    const title = mode === 'create' ? 'Cadastrar entregador' : 'Entregadores';

    const loadCouriers = useCallback(async () => {
        setLoadingList(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/entregadores?page=${page}`, {
                headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
            });
            const result = await response.json();

            if (response.status === 401) {
                onUnauthorized();
                return;
            }
            if (!response.ok) throw new Error(getApiError(result, 'Não foi possível carregar os entregadores.'));

            setCouriers(result);
        } catch (requestError) {
            setError(requestError.message || 'Falha ao carregar os entregadores.');
        } finally {
            setLoadingList(false);
        }
    }, [page, token, onUnauthorized]);

    useEffect(() => {
        if (mode === 'list') loadCouriers();
    }, [mode, loadCouriers]);

    async function createCourier(event) {
        event.preventDefault();
        setSaving(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/entregadores`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify(form),
            });
            const result = await response.json();

            if (response.status === 401) {
                onUnauthorized();
                return;
            }
            if (!response.ok) throw new Error(getApiError(result, 'Não foi possível cadastrar o entregador.'));

            onSaved('Entregador cadastrado com sucesso.');
            onClose();
        } catch (requestError) {
            setError(requestError.message || 'Falha ao cadastrar o entregador.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            title={title}
            description={mode === 'create'
                ? 'Informe os dados para adicionar um entregador à equipe.'
                : 'Consulte a equipe e a disponibilidade dos entregadores.'}
            onClose={onClose}
            size={mode === 'list' ? 'wide' : 'normal'}
        >
            {mode === 'create' ? (
                <form className="action-form" onSubmit={createCourier}>
                    <label htmlFor="courier-name">Nome completo</label>
                    <input
                        id="courier-name"
                        autoFocus
                        required
                        maxLength={255}
                        value={form.nome_entregador}
                        onChange={(event) => setForm({ ...form, nome_entregador: event.target.value })}
                        placeholder="Ex.: Ana Silva"
                    />
                    <label htmlFor="courier-number">Número do entregador</label>
                    <input
                        id="courier-number"
                        required
                        maxLength={255}
                        value={form.num_entregador}
                        onChange={(event) => setForm({ ...form, num_entregador: event.target.value })}
                        placeholder="Ex.: ENT-001"
                    />
                    <p className="form-hint">O novo entregador será cadastrado como disponível.</p>
                    {error && <p className="form-error" role="alert">{error}</p>}
                    <div className="modal-actions">
                        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
                        <button className="primary-button" type="submit" disabled={saving}>
                            {saving ? 'Salvando...' : 'Cadastrar entregador'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="courier-list">
                    {error && <p className="form-error" role="alert">{error}</p>}
                    {loadingList ? (
                        <div className="list-loading">Carregando entregadores...</div>
                    ) : couriers?.data?.length ? (
                        <>
                            <div className="courier-table-wrap">
                                <table>
                                    <thead><tr><th>Entregador</th><th>Número</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {couriers.data.map((courier) => (
                                            <tr key={courier.id_entregador}>
                                                <td className="courier-name-cell">
                                                    <span className="courier-avatar">{courier.nome_entregador.charAt(0).toUpperCase()}</span>
                                                    {courier.nome_entregador}
                                                </td>
                                                <td>{courier.num_entregador}</td>
                                                <td>
                                                    <span className={`courier-status courier-${courier.status.replaceAll(' ', '-')}`}>
                                                        <span />{courier.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="pagination">
                                <span>{couriers.total} entregadores cadastrados</span>
                                <div>
                                    <button onClick={() => setPage((current) => current - 1)} disabled={!couriers.prev_page_url}>Anterior</button>
                                    <span>Página {couriers.current_page} de {couriers.last_page}</span>
                                    <button onClick={() => setPage((current) => current + 1)} disabled={!couriers.next_page_url}>Próxima</button>
                                </div>
                            </div>
                        </>
                    ) : !error ? (
                        <div className="empty-state">
                            <span className="empty-icon"><Icon name="users" size={22} /></span>
                            <strong>Nenhum entregador cadastrado</strong>
                            <span>Use o botão de cadastro no menu para adicionar alguém à equipe.</span>
                        </div>
                    ) : null}
                </div>
            )}
        </Modal>
    );
}

function CenterForm({ token, onClose, onCreated, onUnauthorized }) {
    const [form, setForm] = useState({
        nome_centro: '',
        responsavel_centro: '',
        endereco_centro: '',
        num_entregadores: '0',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function createCenter(event) {
        event.preventDefault();
        setSaving(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/centros-logisticos`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ ...form, num_entregadores: Number(form.num_entregadores) }),
            });
            const result = await response.json();

            if (response.status === 401) {
                onUnauthorized();
                return;
            }
            if (!response.ok) throw new Error(getApiError(result, 'Não foi possível cadastrar o centro logístico.'));

            onCreated(result);
            onClose();
        } catch (requestError) {
            setError(requestError.message || 'Falha ao cadastrar o centro logístico.');
        } finally {
            setSaving(false);
        }
    }

    function updateField(event) {
        setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    }

    return (
        <form className="action-form package-form" onSubmit={createCenter}>
            <div className="form-grid">
                <div>
                    <label htmlFor="center-name">Nome do centro</label>
                    <input id="center-name" autoFocus name="nome_centro" value={form.nome_centro} onChange={updateField} maxLength={255} required placeholder="Ex.: Centro de Distribuição Sul" />
                </div>
                <div>
                    <label htmlFor="center-manager">Responsável</label>
                    <input id="center-manager" name="responsavel_centro" value={form.responsavel_centro} onChange={updateField} maxLength={255} required placeholder="Nome do responsável" />
                </div>
                <div className="form-span">
                    <label htmlFor="center-address">Endereço do centro logístico</label>
                    <input id="center-address" name="endereco_centro" value={form.endereco_centro} onChange={updateField} maxLength={255} required placeholder="Rua, número, bairro, cidade e estado" />
                </div>
                <div>
                    <label htmlFor="center-couriers">Número de entregadores</label>
                    <input id="center-couriers" type="number" name="num_entregadores" value={form.num_entregadores} onChange={updateField} min="0" step="1" required />
                </div>
            </div>
            <p className="form-hint">O endereço será usado como origem ao calcular as rotas dos pacotes deste centro.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
                <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? 'Salvando...' : 'Cadastrar centro'}
                </button>
            </div>
        </form>
    );
}

function PackageForm({ token, onClose, onSaved, onUnauthorized, onCenterCreated }) {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    const [form, setForm] = useState({
        cod_rastreio: '',
        nome_destinatario: '',
        endereco_entrega: '',
        id_origem: '',
        id_entregador_responsavel: '',
        cpf_cliente: '',
        data_prevista: defaultDate.toLocaleDateString('en-CA'),
    });
    const [centers, setCenters] = useState([]);
    const [couriers, setCouriers] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showCenterForm, setShowCenterForm] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadOptions() {
            setLoadingOptions(true);
            setError('');

            try {
                const headers = { Accept: 'application/json', Authorization: 'Bearer ' + token };
                const [centerResponse, courierResponse] = await Promise.all([
                    fetch(`${API_URL}/api/centros-logisticos?per_page=100`, { headers }),
                    fetch(`${API_URL}/api/entregadores/disponiveis`, { headers }),
                ]);
                const [centerResult, courierResult] = await Promise.all([
                    centerResponse.json(),
                    courierResponse.json(),
                ]);

                if (centerResponse.status === 401 || courierResponse.status === 401) {
                    onUnauthorized();
                    return;
                }
                if (!centerResponse.ok) throw new Error(getApiError(centerResult, 'Não foi possível carregar os centros logísticos.'));
                if (!courierResponse.ok) throw new Error(getApiError(courierResult, 'Não foi possível carregar os entregadores disponíveis.'));

                if (!cancelled) {
                    setCenters(centerResult.data ?? []);
                    setCouriers(courierResult);
                }
            } catch (requestError) {
                if (!cancelled) setError(requestError.message || 'Falha ao carregar os dados para o pacote.');
            } finally {
                if (!cancelled) setLoadingOptions(false);
            }
        }

        loadOptions();
        return () => { cancelled = true; };
    }, [token, onUnauthorized]);

    async function createPackage(event) {
        event.preventDefault();
        setSaving(true);
        setError('');

        const payload = {
            ...form,
            id_origem: Number(form.id_origem),
            id_entregador_responsavel: form.id_entregador_responsavel
                ? Number(form.id_entregador_responsavel)
                : null,
        };

        try {
            const response = await fetch(`${API_URL}/api/pacotes`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify(payload),
            });
            const result = await response.json();

            if (response.status === 401) {
                onUnauthorized();
                return;
            }
            if (!response.ok) throw new Error(getApiError(result, 'Não foi possível cadastrar o pacote.'));

            onSaved('Pacote cadastrado com sucesso.');
            onClose();
        } catch (requestError) {
            setError(requestError.message || 'Falha ao cadastrar o pacote.');
        } finally {
            setSaving(false);
        }
    }

    function updateField(event) {
        setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    }

    return (
        <Modal
            title={showCenterForm ? 'Cadastrar centro logístico' : 'Cadastrar pacote'}
            description={showCenterForm
                ? 'Cadastre o centro de origem para continuar com o pacote.'
                : 'Preencha os dados da entrega para adicionar um novo pacote.'}
            onClose={onClose}
            size="wide"
        >
            {showCenterForm ? (
                <CenterForm
                    token={token}
                    onClose={() => setShowCenterForm(false)}
                    onUnauthorized={onUnauthorized}
                    onCreated={(center) => {
                        setCenters((current) => [...current, center]);
                        setForm((current) => ({ ...current, id_origem: String(center.id_centro_logistico) }));
                        setShowCenterForm(false);
                        onCenterCreated();
                    }}
                />
            ) : error && loadingOptions ? (
                <p className="form-error modal-error" role="alert">{error}</p>
            ) : loadingOptions ? (
                <div className="list-loading">Carregando centros e entregadores disponíveis...</div>
            ) : (
                <>
                <form className="action-form package-form" onSubmit={createPackage}>
                    <div className="form-grid">
                        <div>
                            <label htmlFor="package-tracking">Código de rastreio</label>
                            <input id="package-tracking" name="cod_rastreio" value={form.cod_rastreio} onChange={updateField} maxLength={255} required placeholder="Ex.: BR123456789" />
                        </div>
                        <div>
                            <label htmlFor="package-cpf">CPF do cliente</label>
                            <input id="package-cpf" name="cpf_cliente" value={form.cpf_cliente} onChange={updateField} inputMode="numeric" pattern="[0-9]{11}" maxLength={11} required placeholder="11 dígitos, sem pontuação" />
                        </div>
                        <div>
                            <label htmlFor="package-recipient">Nome do destinatário</label>
                            <input id="package-recipient" name="nome_destinatario" value={form.nome_destinatario} onChange={updateField} maxLength={255} required placeholder="Nome completo" />
                        </div>
                        <div>
                            <label htmlFor="package-date">Data prevista</label>
                            <input id="package-date" type="date" name="data_prevista" value={form.data_prevista} onChange={updateField} required />
                        </div>
                        <div className="form-span">
                            <label htmlFor="package-address">Endereço de entrega</label>
                            <input id="package-address" name="endereco_entrega" value={form.endereco_entrega} onChange={updateField} maxLength={255} required placeholder="Rua, número, bairro, cidade e estado" />
                        </div>
                        <div>
                            <div className="field-label-row">
                                <label htmlFor="package-center">Centro logístico de origem</label>
                                <button type="button" className="inline-action" onClick={() => setShowCenterForm(true)}>
                                    <Icon name="plus" size={13} /> Cadastrar centro
                                </button>
                            </div>
                            <select id="package-center" name="id_origem" value={form.id_origem} onChange={updateField} required>
                                <option value="">Selecione um centro</option>
                                {centers.map((center) => (
                                    <option key={center.id_centro_logistico} value={center.id_centro_logistico}>{center.nome_centro}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="package-courier">Entregador responsável</label>
                            <select id="package-courier" name="id_entregador_responsavel" value={form.id_entregador_responsavel} onChange={updateField}>
                                <option value="">Atribuir depois</option>
                                {couriers.map((courier) => (
                                    <option key={courier.id_entregador} value={courier.id_entregador}>
                                        {courier.nome_entregador} · {courier.num_entregador}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {!centers.length && <p className="form-hint form-warning">Cadastre um centro logístico antes de criar pacotes.</p>}
                    {couriers.length === 0 && <p className="form-hint">Não há entregadores disponíveis; o pacote poderá ser atribuído depois.</p>}
                    <div className="modal-actions">
                        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
                        <button className="primary-button" type="submit" disabled={saving || !centers.length}>
                            {saving ? 'Salvando...' : 'Cadastrar pacote'}
                        </button>
                    </div>
                </form>
                {error && <p className="form-error modal-error" role="alert">{error}</p>}
                </>
            )}
        </Modal>
    );
}

function Dashboard({ user, token, onLogout }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [courierMenuOpen, setCourierMenuOpen] = useState(false);
    const [activeModal, setActiveModal] = useState(null);
    const [notice, setNotice] = useState('');

    const refresh = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/dashboard`, {
                headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
            });

            if (response.status === 401) {
                onLogout();
                return;
            }

            if (!response.ok) throw new Error('Não foi possível carregar as estatísticas.');

            const result = await response.json();
            setData(result);
            setUpdatedAt(new Date(result.atualizado_em));
        } catch (requestError) {
            setError(requestError.message || 'Falha ao conectar com a API.');
        } finally {
            setLoading(false);
        }
    }, [token, onLogout]);

    useEffect(() => {
        refresh();
        const timer = window.setInterval(refresh, 60_000);
        return () => window.clearInterval(timer);
    }, [refresh]);

    useEffect(() => {
        const handleUnauthorized = () => onLogout();
        window.addEventListener('dashboard:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('dashboard:unauthorized', handleUnauthorized);
    }, [onLogout]);

    const statuses = useMemo(() => data?.por_situacao ?? [], [data]);
    const handleUnauthorized = useCallback(() => onLogout(), [onLogout]);
    const handleSaved = useCallback((message) => {
        setNotice(message);
        refresh();
        window.setTimeout(() => setNotice(''), 4000);
    }, [refresh]);
    const formattedTime = updatedAt
        ? updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '--:--';

    return (
        <div className="dashboard-shell">
            <aside className="sidebar">
                <Brand />
                <span className="nav-section">MENU PRINCIPAL</span>
                <nav aria-label="Menu principal">
                    <a
                        className="nav-item active"
                        href="#dashboard"
                        data-tooltip="Visão geral"
                        onClick={() => setCourierMenuOpen(false)}
                    >
                        <Icon name="package" /><span className="nav-label">Visão geral</span>
                    </a>
                    <button
                        className="nav-item"
                        type="button"
                        data-tooltip="Cadastrar pacote"
                        aria-label="Cadastrar pacote"
                        onClick={() => {
                            setCourierMenuOpen(false);
                            setActiveModal('package');
                        }}
                    >
                        <Icon name="clock" /><span className="nav-label">Cadastrar pacote</span>
                    </button>
                    <button
                        className="nav-item"
                        type="button"
                        data-tooltip="Cadastrar centro logístico"
                        aria-label="Cadastrar centro logístico"
                        onClick={() => {
                            setCourierMenuOpen(false);
                            setActiveModal('center-create');
                        }}
                    >
                        <Icon name="building" /><span className="nav-label">Cadastrar centro</span>
                    </button>
                    <div className="courier-nav-group">
                        <button
                            className={`nav-item ${courierMenuOpen ? 'menu-open' : ''}`}
                            type="button"
                            data-tooltip="Entregadores"
                            aria-label="Entregadores"
                            aria-expanded={courierMenuOpen}
                            aria-haspopup="menu"
                            onClick={() => setCourierMenuOpen((open) => !open)}
                        >
                            <Icon name="users" /><span className="nav-label">Entregadores</span>
                        </button>
                        {courierMenuOpen && (
                            <div className="courier-menu" role="menu" aria-label="Ações de entregadores">
                                <span className="courier-menu-heading">ENTREGADORES</span>
                                <button role="menuitem" onClick={() => {
                                    setCourierMenuOpen(false);
                                    setActiveModal('courier-create');
                                }}>
                                    <span className="courier-menu-icon"><Icon name="plus" size={16} /></span>
                                    <span><strong>Cadastrar entregador</strong><small>Adicionar alguém à equipe</small></span>
                                </button>
                                <button role="menuitem" onClick={() => {
                                    setCourierMenuOpen(false);
                                    setActiveModal('courier-list');
                                }}>
                                    <span className="courier-menu-icon"><Icon name="users" size={16} /></span>
                                    <span><strong>Listar entregadores</strong><small>Ver equipe e disponibilidade</small></span>
                                </button>
                            </div>
                        )}
                    </div>
                </nav>
                <div className="sidebar-bottom">
                    <div className="support-card">
                        <span className="support-icon"><Icon name="bell" size={17} /></span>
                        <strong>Precisa de ajuda?</strong>
                        <span>Acompanhe sua operação em um só lugar.</span>
                    </div>
                    <button className="profile-button" onClick={onLogout}>
                        <span className="avatar">{(user?.name ?? 'U').charAt(0).toUpperCase()}</span>
                        <span className="profile-copy"><strong>{user?.name ?? 'Usuário'}</strong><small>Administrador</small></span>
                        <Icon name="logout" size={17} />
                    </button>
                </div>
            </aside>

            <main className="dashboard-main" id="dashboard">
                <header className="topbar">
                    <div className="breadcrumb"><span>Início</span><Icon name="chevron" size={15} /><strong>Visão geral</strong></div>
                    <div className="topbar-actions">
                        <span className="live-status"><span /> Sistema operacional</span>
                        <span className="topbar-divider" />
                        <button className="icon-button" aria-label="Atualizar dados" onClick={refresh} disabled={loading}>
                            <Icon name="refresh" size={18} />
                        </button>
                        <span className="topbar-date">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                </header>

                <div className="content-wrap">
                    <section className="page-intro">
                        <div>
                            <p className="eyebrow">PAINEL DE CONTROLE</p>
                            <h1>Visão geral</h1>
                            <p className="intro-subtitle">Acompanhe o desempenho da sua operação de entregas.</p>
                        </div>
                        <div className="last-updated">
                            <span className="live-dot" />
                            Atualizado às {formattedTime}
                        </div>
                    </section>

                    {error && (
                        <div className="error-banner" role="alert">
                            <span>{error}</span>
                            <button onClick={refresh}>Tentar novamente</button>
                        </div>
                    )}

                    {loading && !data ? (
                        <div className="loading-grid" aria-label="Carregando estatísticas">
                            <span /><span /><span /><span />
                        </div>
                    ) : data ? (
                        <>
                            <section className="metrics-grid" aria-label="Estatísticas de entregas">
                                <MetricCard title="Total de entregas" value={data.total_entregas} caption="Pacotes cadastrados na operação" icon="package" tone="blue" trend />
                                <MetricCard title="Entregas atrasadas" value={data.entregas_atrasadas} caption="Fora do prazo e ainda em andamento" icon="clock" tone="orange" />
                                <MetricCard title="Entregas concluídas" value={data.entregas_concluidas} caption="Pacotes entregues com sucesso" icon="check" tone="green" />
                                <MetricCard title="Entregadores disponíveis" value={data.entregadores_disponiveis} caption="Prontos para novas entregas" icon="users" tone="purple" />
                            </section>
                            <section className="dashboard-grid">
                                <StatusChart statuses={statuses} />
                                <section className="panel operation-panel" id="entregadores">
                                    <div className="panel-heading">
                                        <div><h2>Operação hoje</h2><p>Resumo da equipe e dos prazos</p></div>
                                        <span className="operation-icon"><Icon name="arrow" size={17} /></span>
                                    </div>
                                    <div className="operation-stat">
                                        <span className="operation-stat-icon orange-soft"><Icon name="clock" size={18} /></span>
                                        <span><small>Precisam de atenção</small><strong>{data.entregas_atrasadas} entregas atrasadas</strong></span>
                                    </div>
                                    <div className="operation-stat">
                                        <span className="operation-stat-icon green-soft"><Icon name="users" size={18} /></span>
                                        <span><small>Equipe disponível</small><strong>{data.entregadores_disponiveis} entregadores livres</strong></span>
                                    </div>
                                    <div className="completion-callout">
                                        <span className="completion-check"><Icon name="check" size={17} /></span>
                                        <span><strong>Bom trabalho!</strong><small>{data.entregas_concluidas} entregas concluídas até agora.</small></span>
                                    </div>
                                </section>
                            </section>
                            <RouteMap
                                deliveries={data.entregas_recentes ?? []}
                                packages={data.pacotes_mapa ?? []}
                                totalMappedPackages={data.pacotes_no_mapa ?? 0}
                                token={token}
                            />
                            <div id="entregas"><RecentDeliveries deliveries={data.entregas_recentes ?? []} /></div>
                        </>
                    ) : (
                        <div className="welcome-empty">
                            <span className="empty-icon"><Icon name="search" size={23} /></span>
                            <strong>Não foi possível carregar os dados</strong>
                            <span>Confira sua conexão e tente atualizar o painel.</span>
                        </div>
                    )}
                    <footer className="dashboard-footer">
                        <span>© {new Date().getFullYear()} Rota Logística</span>
                        <span>Dados atualizados automaticamente a cada minuto</span>
                    </footer>
                </div>
            </main>
            {notice && <div className="success-toast" role="status">{notice}</div>}
            {activeModal === 'package' && (
                <PackageForm
                    token={token}
                    onClose={() => setActiveModal(null)}
                    onSaved={handleSaved}
                    onUnauthorized={handleUnauthorized}
                    onCenterCreated={() => handleSaved('Centro logístico cadastrado com sucesso.')}
                />
            )}
            {activeModal === 'center-create' && (
                <Modal
                    title="Cadastrar centro logístico"
                    description="Cadastre os dados e o endereço do centro de distribuição."
                    onClose={() => setActiveModal(null)}
                    size="wide"
                >
                    <CenterForm
                        token={token}
                        onClose={() => setActiveModal(null)}
                        onUnauthorized={handleUnauthorized}
                        onCreated={() => handleSaved('Centro logístico cadastrado com sucesso.')}
                    />
                </Modal>
            )}
            {(activeModal === 'courier-create' || activeModal === 'courier-list') && (
                <CourierManager
                    token={token}
                    mode={activeModal === 'courier-create' ? 'create' : 'list'}
                    onClose={() => setActiveModal(null)}
                    onSaved={handleSaved}
                    onUnauthorized={handleUnauthorized}
                />
            )}
        </div>
    );
}

function App() {
    const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState(() => {
        const storedUser = sessionStorage.getItem('my-package-dashboard-user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function login(email, password) {
        setBusy(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'E-mail ou senha inválidos.');
            }

            sessionStorage.setItem(TOKEN_KEY, result.token);
            sessionStorage.setItem('my-package-dashboard-user', JSON.stringify(result.user));
            setToken(result.token);
            setUser(result.user);
        } catch (loginError) {
            setError(loginError.message || 'Não foi possível acessar a API.');
        } finally {
            setBusy(false);
        }
    }

    const logout = useCallback(async () => {
        const currentToken = sessionStorage.getItem(TOKEN_KEY);

        if (currentToken) {
            try {
                await fetch(`${API_URL}/api/logout`, {
                    method: 'POST',
                    headers: { Accept: 'application/json', Authorization: `Bearer ${currentToken}` },
                });
            } finally {
                sessionStorage.removeItem(TOKEN_KEY);
                sessionStorage.removeItem('my-package-dashboard-user');
                setToken(null);
                setUser(null);
            }
        } else {
            setToken(null);
            setUser(null);
        }
    }, []);

    if (!token) return <Login onLogin={login} busy={busy} error={error} />;

    return <Dashboard user={user} token={token} onLogout={logout} />;
}

createRoot(document.getElementById('app')).render(<App />);
