import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const TOKEN_KEY = 'my-package-dashboard-token';
const API_URL = import.meta.env.VITE_API_URL ?? '';
const ERROR_EVENT = 'app:error';

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
        user: <><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></>,
        search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
        bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
        chevron: <path d="m9 18 6-6-6-6" />,
        refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>,
        logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" /></>,
        arrow: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
    };

    return <svg {...shared}>{paths[name]}</svg>;
}

function reportError(setError, message) {
    setError(message);
    window.dispatchEvent(new CustomEvent(ERROR_EVENT, { detail: { message } }));
}

function getRequestErrorMessage(error, fallback) {
    if (error instanceof TypeError) {
        return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
    }

    if (error instanceof SyntaxError) {
        return 'O servidor retornou uma resposta inválida. Tente novamente.';
    }

    return error.message || fallback;
}

function ErrorPopup({ message, onClose }) {
    if (!message) return null;

    return (
        <div className="error-popup" role="alert" aria-live="assertive">
            <span className="error-popup-icon"><Icon name="close" size={16} /></span>
            <span className="error-popup-message">{message}</span>
            <button type="button" onClick={onClose} aria-label="Fechar mensagem de erro">
                <Icon name="close" size={16} />
            </button>
        </div>
    );
}

async function fetchCepData(url) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error('O serviço de consulta de CEP está indisponível.');
        }

        return await response.json();
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function getCepAddress(result, provider) {
    if (!result || result.erro) {
        return '';
    }

    const street = provider === 'viacep' ? result.logradouro : result.street;
    const neighborhood = provider === 'viacep' ? result.bairro : result.neighborhood;
    const city = provider === 'viacep' ? result.localidade : result.city;
    const state = provider === 'viacep' ? result.uf : result.state;

    return [
        street,
        neighborhood,
        [city, state].filter(Boolean).join(' - '),
    ].filter(Boolean).join(', ');
}

function useCepLookup(onAddressChange, onError) {
    const [cep, setCep] = useState('');
    const [cepError, setCepError] = useState('');
    const [lookingUpCep, setLookingUpCep] = useState(false);
    const validatedCep = useRef('');
    const validatedAddress = useRef('');
    const activeLookup = useRef(null);
    const requestId = useRef(0);

    const updateCep = useCallback((event) => {
        const nextCep = event.target.value.replace(/\D/g, '').slice(0, 8);
        requestId.current += 1;
        validatedCep.current = '';
        validatedAddress.current = '';
        activeLookup.current = null;
        setCep(nextCep);
        setCepError('');
        setLookingUpCep(false);
        onAddressChange('');
    }, [onAddressChange]);

    const lookupCep = useCallback(async () => {
        const digits = cep.replace(/\D/g, '');

        if (!/^\d{8}$/.test(digits)) {
            const message = 'Informe um CEP válido com 8 dígitos.';
            setCepError(message);
            onError(message);

            return false;
        }

        if (validatedCep.current === digits) {
            return validatedAddress.current;
        }

        if (activeLookup.current?.cep === digits) {
            return activeLookup.current.promise;
        }

        const currentRequestId = ++requestId.current;
        setLookingUpCep(true);
        setCepError('');

        const lookupPromise = (async () => {
            try {
                const results = await Promise.allSettled([
                    fetchCepData(`https://viacep.com.br/ws/${digits}/json/`)
                        .then((result) => getCepAddress(result, 'viacep')),
                    fetchCepData(`https://brasilapi.com.br/api/cep/v1/${digits}`)
                        .then((result) => getCepAddress(result, 'brasilapi')),
                ]);
                const address = results.find(
                    (result) => result.status === 'fulfilled' && result.value,
                )?.value ?? '';

                if (!address) {
                    const hasProviderResponse = results.some((result) => result.status === 'fulfilled');
                    throw new Error(hasProviderResponse
                        ? 'CEP não encontrado nas bases consultadas. Confira os números informados.'
                        : 'Os serviços de CEP estão indisponíveis. Tente novamente em instantes.');
                }

                if (requestId.current === currentRequestId) {
                    validatedCep.current = digits;
                    validatedAddress.current = address;
                    onAddressChange(address);
                }

                return requestId.current === currentRequestId ? address : false;
            } catch (requestError) {
                const message = requestError instanceof TypeError
                    ? 'Não foi possível conectar ao serviço de CEP. Verifique sua internet e tente novamente.'
                    : requestError.message || 'Não foi possível consultar o CEP. Tente novamente.';

                if (requestId.current === currentRequestId) {
                    setCepError(message);
                    onError(message);
                }

                return false;
            } finally {
                if (requestId.current === currentRequestId) {
                    setLookingUpCep(false);
                }

                if (activeLookup.current?.requestId === currentRequestId) {
                    activeLookup.current = null;
                }
            }
        })();

        activeLookup.current = { cep: digits, promise: lookupPromise, requestId: currentRequestId };

        return lookupPromise;
    }, [cep, onAddressChange, onError]);

    useEffect(() => {
        if (!/^\d{8}$/.test(cep.replace(/\D/g, '')) || validatedCep.current === cep) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            lookupCep();
        }, 350);

        return () => window.clearTimeout(timeoutId);
    }, [cep, lookupCep]);

    return { cep, cepError, lookingUpCep, lookupCep, updateCep };
}

function CepField({ id, label = 'CEP', cep, cepError, lookingUpCep, onCepChange, onLookup }) {
    const formattedCep = cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;

    return (
        <div className="cep-field form-span">
            <label htmlFor={id}>{label}</label>
            <div className="cep-input-row">
                <input
                    id={id}
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    pattern="[0-9]{5}-?[0-9]{3}"
                    maxLength={9}
                    value={formattedCep}
                    onChange={onCepChange}
                    onBlur={() => {
                        if (cep) onLookup();
                    }}
                    aria-invalid={Boolean(cepError)}
                    aria-describedby={cepError ? `${id}-error` : `${id}-hint`}
                    placeholder="00000-000"
                    required
                />
                <button className="secondary-button" type="button" onClick={onLookup} disabled={lookingUpCep}>
                    {lookingUpCep ? 'Consultando...' : 'Consultar CEP'}
                </button>
            </div>
            <span className="form-hint" id={`${id}-hint`}>
                {lookingUpCep
                    ? 'Consultando o CEP e preenchendo o endereço...'
                    : 'O endereço é preenchido automaticamente ao informar os 8 dígitos do CEP.'}
            </span>
            {cepError && <span className="cep-error" id={`${id}-error`}>{cepError}</span>}
        </div>
    );
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

const navigationMenus = {
    packages: {
        label: 'Pacotes',
        icon: 'package',
        actions: [
            { label: 'Listar pacotes', description: 'Consultar entregas cadastradas', icon: 'package', modal: 'package-list' },
            { label: 'Cadastrar pacote', description: 'Adicionar uma nova entrega', icon: 'clock', modal: 'package' },
        ],
    },
    centers: {
        label: 'Centros logísticos',
        icon: 'building',
        actions: [
            { label: 'Listar centros', description: 'Consultar centros cadastrados', icon: 'building', modal: 'center-list' },
            { label: 'Cadastrar centro', description: 'Adicionar um centro logístico', icon: 'plus', modal: 'center-create' },
        ],
    },
    admins: {
        label: 'Administradores',
        icon: 'user',
        actions: [
            { label: 'Listar administradores', description: 'Consultar administradores cadastrados', icon: 'users', modal: 'admin-list' },
            { label: 'Cadastrar administrador', description: 'Dar acesso ao sistema a outra pessoa', icon: 'plus', modal: 'admin-create' },
        ],
    },
    couriers: {
        label: 'Entregadores',
        icon: 'users',
        actions: [
            { label: 'Listar entregadores', description: 'Ver equipe e disponibilidade', icon: 'users', modal: 'courier-list' },
            { label: 'Cadastrar entregador', description: 'Adicionar alguém à equipe', icon: 'plus', modal: 'courier-create' },
        ],
    },
};

function ResourceNavMenu({ type, isOpen, onToggle, onSelect }) {
    const menu = navigationMenus[type];

    return (
        <div className="resource-nav-group">
            <button
                className={`nav-item ${isOpen ? 'menu-open' : ''}`}
                type="button"
                data-tooltip={menu.label}
                aria-label={menu.label}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={onToggle}
            >
                <Icon name={menu.icon} /><span className="nav-label">{menu.label}</span>
            </button>
            {isOpen && (
                <div className="courier-menu" role="menu" aria-label={`Ações: ${menu.label}`}>
                    <span className="courier-menu-heading">{menu.label.toUpperCase()}</span>
                    {menu.actions.map((action) => (
                        <button key={action.modal} role="menuitem" onClick={() => onSelect(action.modal)}>
                            <span className="courier-menu-icon"><Icon name={action.icon} size={16} /></span>
                            <span><strong>{action.label}</strong><small>{action.description}</small></span>
                        </button>
                    ))}
                </div>
            )}
        </div>
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
            reportError(setError, getRequestErrorMessage(routeError, 'Falha ao conectar com o serviço de mapas.'));
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
    const knownMessages = {
        'validation.required': 'Este campo é obrigatório.',
        'validation.exists': 'O registro informado não foi encontrado. Confira o centro ou entregador selecionado.',
        'validation.unique': 'Este valor já está cadastrado.',
        'validation.email': 'Informe um endereço de e-mail válido.',
        'validation.digits': 'Informe a quantidade de dígitos exigida.',
        'validation.min.string': 'O valor informado é menor que o mínimo permitido.',
        'validation.min.numeric': 'O valor informado está abaixo do mínimo permitido.',
        'validation.max.string': 'O valor informado excede o limite permitido.',
        'validation.integer': 'Informe um número inteiro válido.',
        'validation.date': 'Informe uma data válida.',
        'validation.date_format': 'Informe uma data válida no formato AAAA-MM-DD.',
        'validation.enum': 'O valor selecionado não é válido.',
    };
    const fieldLabels = {
        name: 'Nome',
        email: 'E-mail',
        password: 'Senha',
        cpf_destinatario: 'CPF do destinatário',
        telefone_destinatario: 'Telefone do destinatário',
        endereco_entrega: 'Endereço de entrega',
        endereco_centro: 'Endereço do centro',
        id_origem: 'Centro logístico',
        id_entregador_responsavel: 'Entregador',
        cod_rastreio: 'Código de rastreio',
        data_prevista: 'Data prevista',
        nome_destinatario: 'Nome do destinatário',
        nome_centro: 'Nome do centro',
        responsavel_centro: 'Responsável pelo centro',
        num_entregadores: 'Número de entregadores',
        nome_entregador: 'Nome do entregador',
        num_entregador: 'Número do entregador',
        situacao: 'Situação',
        status: 'Status',
    };
    const validationErrors = Object.entries(result.errors ?? {}).flatMap(([field, messages]) => (
        messages.map((message) => `${fieldLabels[field] ?? field}: ${knownMessages[message] ?? message}`)
    ));

    return validationErrors.length
        ? validationErrors.join(' ')
        : result.message ?? fallback;
}

const directoryDefinitions = {
    packages: {
        title: 'Pacotes',
        description: 'Consulte rastreamento, origem e situação das entregas.',
        endpoint: 'pacotes',
        emptyMessage: 'Cadastre um pacote para vê-lo nesta lista.',
        columns: [
            { label: 'Rastreamento', render: (item) => <span className="tracking-cell">{item.cod_rastreio}</span> },
            { label: 'Destinatário', render: (item) => item.nome_destinatario },
            { label: 'Origem', render: (item) => item.origem?.nome_centro ?? '—' },
            {
                label: 'Situação',
                render: (item) => (
                    <span className={`status-badge status-${item.situacao.replaceAll(' ', '-')}`}>
                        <span />{statusNames[item.situacao] ?? item.situacao}
                    </span>
                ),
            },
            {
                label: 'Previsão',
                render: (item) => new Date(`${item.data_prevista}T12:00:00`).toLocaleDateString('pt-BR'),
            },
        ],
    },
    centers: {
        title: 'Centros logísticos',
        description: 'Consulte os centros de origem cadastrados na operação.',
        endpoint: 'centros-logisticos',
        emptyMessage: 'Cadastre um centro logístico para vê-lo nesta lista.',
        columns: [
            { label: 'Centro', render: (item) => item.nome_centro },
            { label: 'Responsável', render: (item) => item.responsavel_centro },
            { label: 'Endereço', render: (item) => item.endereco_centro || '—' },
            { label: 'Entregadores informados', render: (item) => item.num_entregadores },
        ],
    },
    admins: {
        title: 'Administradores',
        description: 'Consulte as pessoas que têm acesso de administrador ao sistema.',
        endpoint: 'usuarios',
        emptyMessage: 'Cadastre um administrador para vê-lo nesta lista.',
        columns: [
            { label: 'Nome', render: (item) => item.name },
            { label: 'E-mail', render: (item) => item.email },
        ],
    },
};

function DirectoryList({ type, token, onClose, onUnauthorized }) {
    const definition = directoryDefinitions[type];
    const [page, setPage] = useState(1);
    const [items, setItems] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadItems = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/${definition.endpoint}?page=${page}`, {
                headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
            });
            const result = await response.json();

            if (response.status === 401) {
                onUnauthorized();
                return;
            }
            if (!response.ok) throw new Error(getApiError(result, `Não foi possível carregar ${definition.title.toLowerCase()}.`));

            setItems(result);
        } catch (requestError) {
            reportError(setError, getRequestErrorMessage(requestError, `Falha ao carregar ${definition.title.toLowerCase()}.`));
        } finally {
            setLoading(false);
        }
    }, [definition, page, token, onUnauthorized]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    return (
        <Modal title={definition.title} description={definition.description} onClose={onClose} size="directory">
            <div className="directory-list">
                {error && <p className="form-error" role="alert">{error}</p>}
                {loading ? (
                    <div className="list-loading">Carregando {definition.title.toLowerCase()}...</div>
                ) : items?.data?.length ? (
                    <>
                        <div className="directory-table-wrap">
                            <table>
                                <thead>
                                    <tr>{definition.columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {items.data.map((item) => (
                                        <tr key={item.id_pacote ?? item.id_centro_logistico ?? item.id}>
                                            {definition.columns.map((column) => (
                                                <td key={column.label}>{column.render(item)}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="pagination">
                            <span>{items.total} registros</span>
                            <div>
                                <button onClick={() => setPage((current) => current - 1)} disabled={!items.prev_page_url}>Anterior</button>
                                <span>Página {items.current_page} de {items.last_page}</span>
                                <button onClick={() => setPage((current) => current + 1)} disabled={!items.next_page_url}>Próxima</button>
                            </div>
                        </div>
                    </>
                ) : !error ? (
                    <div className="empty-state">
                        <span className="empty-icon"><Icon name={type === 'admins' ? 'user' : type === 'centers' ? 'building' : 'package'} size={22} /></span>
                        <strong>Nenhum registro cadastrado</strong>
                        <span>{definition.emptyMessage}</span>
                    </div>
                ) : null}
            </div>
        </Modal>
    );
}

function AdminForm({ token, onClose, onSaved, onUnauthorized }) {
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    function updateField(event) {
        setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    }

    async function createAdmin(event) {
        event.preventDefault();
        setSaving(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/api/usuarios`, {
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
            if (!response.ok) throw new Error(getApiError(result, 'Não foi possível cadastrar o administrador.'));

            onSaved('Administrador cadastrado com sucesso.');
            onClose();
        } catch (requestError) {
            reportError(setError, getRequestErrorMessage(requestError, 'Falha ao cadastrar o administrador.'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            title="Cadastrar administrador"
            description="A pessoa poderá entrar no sistema com o e-mail e a senha informados."
            onClose={onClose}
            size="wide"
        >
            <form className="action-form package-form" onSubmit={createAdmin}>
                <div className="form-grid">
                    <div>
                        <label htmlFor="admin-name">Nome completo</label>
                        <input id="admin-name" name="name" autoFocus value={form.name} onChange={updateField} maxLength={255} required placeholder="Nome do administrador" />
                    </div>
                    <div>
                        <label htmlFor="admin-email">E-mail</label>
                        <input id="admin-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} maxLength={255} required placeholder="admin@exemplo.com" />
                    </div>
                    <div className="form-span">
                        <label htmlFor="admin-password">Senha de acesso</label>
                        <input id="admin-password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={updateField} minLength={8} required placeholder="Mínimo de 8 caracteres" />
                    </div>
                </div>
                <p className="form-hint">O e-mail deve ser único. A senha será armazenada com hash.</p>
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="modal-actions">
                    <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
                    <button className="primary-button" type="submit" disabled={saving}>
                        {saving ? 'Salvando...' : 'Cadastrar administrador'}
                    </button>
                </div>
            </form>
        </Modal>
    );
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
            reportError(setError, getRequestErrorMessage(requestError, 'Falha ao carregar os entregadores.'));
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
            reportError(setError, getRequestErrorMessage(requestError, 'Falha ao cadastrar o entregador.'));
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
    const setCenterAddress = useCallback((endereco_centro) => {
        setForm((current) => ({ ...current, endereco_centro }));
    }, []);
    const notifyError = useCallback((message) => reportError(setError, message), []);
    const cepLookup = useCepLookup(setCenterAddress, notifyError);

    async function createCenter(event) {
        event.preventDefault();
        setSaving(true);
        setError('');

        try {
            const cepAddress = await cepLookup.lookupCep();
            if (!cepAddress) return;

            const response = await fetch(`${API_URL}/api/centros-logisticos`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({
                    ...form,
                    endereco_centro: form.endereco_centro || cepAddress,
                    num_entregadores: Number(form.num_entregadores),
                }),
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
            reportError(setError, getRequestErrorMessage(requestError, 'Falha ao cadastrar o centro logístico.'));
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
                    <CepField
                        id="center-cep"
                        cep={cepLookup.cep}
                        cepError={cepLookup.cepError}
                        lookingUpCep={cepLookup.lookingUpCep}
                        onCepChange={cepLookup.updateCep}
                        onLookup={cepLookup.lookupCep}
                    />
                </div>
                <div className="form-span">
                    <label htmlFor="center-address">Endereço do centro logístico</label>
                    <input id="center-address" name="endereco_centro" value={form.endereco_centro} onChange={updateField} maxLength={255} required placeholder="Confira o endereço e informe número/complemento" />
                    <p className="form-hint">Confira o endereço preenchido e complete com número e complemento, se houver.</p>
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
        cpf_destinatario: '',
        telefone_destinatario: '',
        data_prevista: defaultDate.toLocaleDateString('en-CA'),
    });
    const [centers, setCenters] = useState([]);
    const [couriers, setCouriers] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showCenterForm, setShowCenterForm] = useState(false);
    const setPackageAddress = useCallback((endereco_entrega) => {
        setForm((current) => ({ ...current, endereco_entrega }));
    }, []);
    const notifyError = useCallback((message) => reportError(setError, message), []);
    const cepLookup = useCepLookup(setPackageAddress, notifyError);

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
                if (!cancelled) {
                    reportError(setError, getRequestErrorMessage(requestError, 'Falha ao carregar os dados para o pacote.'));
                }
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

        try {
            const cepAddress = await cepLookup.lookupCep();
            if (!cepAddress) return;

            const payload = {
                ...form,
                endereco_entrega: form.endereco_entrega || cepAddress,
                id_origem: Number(form.id_origem),
                id_entregador_responsavel: form.id_entregador_responsavel
                    ? Number(form.id_entregador_responsavel)
                    : null,
            };

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
            reportError(setError, getRequestErrorMessage(requestError, 'Falha ao cadastrar o pacote.'));
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
                            <label htmlFor="package-cpf">CPF do destinatário</label>
                            <input id="package-cpf" name="cpf_destinatario" value={form.cpf_destinatario} onChange={updateField} inputMode="numeric" pattern="[0-9]{11}" maxLength={11} required placeholder="11 dígitos, sem pontuação" />
                        </div>
                        <div>
                            <label htmlFor="package-phone">Telefone do destinatário</label>
                            <input id="package-phone" name="telefone_destinatario" type="tel" value={form.telefone_destinatario} onChange={updateField} maxLength={30} required placeholder="Ex.: 11999999999" />
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
                            <CepField
                                id="package-cep"
                                cep={cepLookup.cep}
                                cepError={cepLookup.cepError}
                                lookingUpCep={cepLookup.lookingUpCep}
                                onCepChange={cepLookup.updateCep}
                                onLookup={cepLookup.lookupCep}
                            />
                        </div>
                        <div className="form-span">
                            <label htmlFor="package-address">Endereço de entrega</label>
                            <input id="package-address" name="endereco_entrega" value={form.endereco_entrega} onChange={updateField} maxLength={255} required placeholder="Confira o endereço e informe número/complemento" />
                            <p className="form-hint">Confira o endereço preenchido e complete com número e complemento para localizar a entrega.</p>
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
    const [openResourceMenu, setOpenResourceMenu] = useState(null);
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
            reportError(setError, getRequestErrorMessage(requestError, 'Falha ao conectar com a API.'));
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
                        onClick={() => setOpenResourceMenu(null)}
                    >
                        <Icon name="package" /><span className="nav-label">Visão geral</span>
                    </a>
                    {Object.keys(navigationMenus).map((type) => (
                        <ResourceNavMenu
                            key={type}
                            type={type}
                            isOpen={openResourceMenu === type}
                            onToggle={() => setOpenResourceMenu((current) => current === type ? null : type)}
                            onSelect={(modal) => {
                                setOpenResourceMenu(null);
                                setActiveModal(modal);
                            }}
                        />
                    ))}
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
                            <ErrorBoundary>
                                <RouteMap
                                    deliveries={data.entregas_recentes ?? []}
                                    packages={data.pacotes_mapa ?? []}
                                    totalMappedPackages={data.pacotes_no_mapa ?? 0}
                                    token={token}
                                />
                            </ErrorBoundary>
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
            {activeModal === 'admin-create' && (
                <AdminForm
                    token={token}
                    onClose={() => setActiveModal(null)}
                    onSaved={handleSaved}
                    onUnauthorized={handleUnauthorized}
                />
            )}
            {['package-list', 'center-list', 'admin-list'].includes(activeModal) && (
                <DirectoryList
                    type={activeModal === 'package-list' ? 'packages' : activeModal === 'center-list' ? 'centers' : 'admins'}
                    token={token}
                    onClose={() => setActiveModal(null)}
                    onUnauthorized={handleUnauthorized}
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

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Erro de renderização:', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="welcome-empty" role="alert">
                <strong>Algo deu errado ao exibir esta tela</strong>
                <span>{String(this.state.error?.message ?? this.state.error)}</span>
                <button className="primary-button" onClick={() => window.location.reload()}>Recarregar</button>
            </div>
        );
    }
}

function App() {
    const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState(() => {
        const storedUser = sessionStorage.getItem('my-package-dashboard-user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [popupError, setPopupError] = useState('');
    const popupTimer = useRef(null);

    useEffect(() => {
        function showError(event) {
            setPopupError(event.detail.message);
            window.clearTimeout(popupTimer.current);
            popupTimer.current = window.setTimeout(() => setPopupError(''), 7000);
        }

        window.addEventListener(ERROR_EVENT, showError);

        return () => {
            window.removeEventListener(ERROR_EVENT, showError);
            window.clearTimeout(popupTimer.current);
        };
    }, []);

    function closeErrorPopup() {
        window.clearTimeout(popupTimer.current);
        setPopupError('');
    }

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
                throw new Error(getApiError(result, 'E-mail ou senha inválidos.'));
            }

            sessionStorage.setItem(TOKEN_KEY, result.token);
            sessionStorage.setItem('my-package-dashboard-user', JSON.stringify(result.user));
            setToken(result.token);
            setUser(result.user);
        } catch (loginError) {
            reportError(setError, getRequestErrorMessage(loginError, 'Não foi possível acessar a API.'));
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
            } catch (logoutError) {
                reportError(setError, getRequestErrorMessage(logoutError, 'Não foi possível encerrar a sessão no servidor.'));
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

    return (
        <>
            <ErrorPopup message={popupError} onClose={closeErrorPopup} />
            {!token
                ? <Login onLogin={login} busy={busy} error={error} />
                : <Dashboard user={user} token={token} onLogout={logout} />}
        </>
    );
}

createRoot(document.getElementById('app')).render(<ErrorBoundary><App /></ErrorBoundary>);
