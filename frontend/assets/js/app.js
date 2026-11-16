/* ===================================================================
   OPTI DECISION SUITE - IOP812 | FRONTEND APP (BLOQUE 2 COMPLETO)
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------------
    // 1. ESTADO GLOBAL
    // ---------------------------------------------------------------
    const COCHABAMBA_DEFAULT = [-17.3895, -66.1568]; // Plaza 14 de Septiembre
    let map = null;
    let markersLayer = null;
    let ubicacionUsuario = { lat: COCHABAMBA_DEFAULT[0], lng: COCHABAMBA_DEFAULT[1] };
    let perfilUsuarioActual = null;
    let topFerreteriaActual = null;
    let productosCache = [];
    let modoSeleccionMapa = false;

    const getAuthHeaders = (conJson = false) => {
        const headers = {};
        if (conJson) headers['Content-Type'] = 'application/json';
        const token = localStorage.getItem('iop812-token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    };
    // Helper para notificaciones con SweetAlert2
    const notificar = (titulo, texto, icono = 'info') => {
        // Quitar el foco de cualquier elemento activo para evitar advertencias aria-hidden
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        const esOscuro = document.documentElement.getAttribute('data-theme') !== 'light';
        return Swal.fire({
            title: titulo,
            text: texto,
            icon: icono,
            background: esOscuro ? '#1E293B' : '#FFFFFF',
            color: esOscuro ? '#F8FAFC' : '#0F172A',
            confirmButtonColor: icono === 'error' ? '#EF4444' : '#0EA5E9',
            customClass: { popup: 'rounded-4 border border-secondary-subtle shadow-lg' }
        });
    };

    // ---------------------------------------------------------------
    // 2. TEMA OSCURO / CLARO
    // ---------------------------------------------------------------
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    const aplicarTema = (tema) => {
        document.documentElement.setAttribute('data-theme', tema);
        localStorage.setItem('iop812-theme', tema);
        if (themeIcon) {
            themeIcon.className = tema === 'light' ? 'fa-solid fa-sun text-warning' : 'fa-solid fa-moon text-light';
        }
    };
    aplicarTema(localStorage.getItem('iop812-theme') || 'dark');

    themeToggleBtn?.addEventListener('click', () => {
        const temaActual = document.documentElement.getAttribute('data-theme');
        aplicarTema(temaActual === 'dark' ? 'light' : 'dark');
    });

    // ---------------------------------------------------------------
    // 3. MAPA LEAFLET Y GEOLOCALIZACIÓN
    // ---------------------------------------------------------------
    const actualizarMarcadorUsuario = (lat, lng, titulo) => {
        ubicacionUsuario = { lat, lng };
        if (!markersLayer) return null;

        markersLayer.eachLayer(layer => {
            if (layer.options && layer.options.isUserMarker) {
                markersLayer.removeLayer(layer);
            }
        });

        const userIcon = L.divIcon({
            className: 'user-marker-icon',
            html: `<div style="background-color: #0EA5E9; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 12px rgba(14,165,233,0.9);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        return L.marker([lat, lng], { icon: userIcon, isUserMarker: true })
            .addTo(markersLayer)
            .bindPopup(`<strong>${titulo}</strong>`);
    };

    const intentoAutoGeolocalizacion = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    if (map) map.setView([latitude, longitude], 15);
                    const marker = actualizarMarcadorUsuario(latitude, longitude, "Tu ubicación GPS actual");
                    if (marker) marker.openPopup();
                    const inputOrigen = document.getElementById('inputOrigen');
                    if (inputOrigen) inputOrigen.value = `Ubicación GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
                },
                () => {
                    actualizarMarcadorUsuario(COCHABAMBA_DEFAULT[0], COCHABAMBA_DEFAULT[1], "Origen: Plaza 14 de Septiembre, Cochabamba");
                },
                { timeout: 5000 }
            );
        } else {
            actualizarMarcadorUsuario(COCHABAMBA_DEFAULT[0], COCHABAMBA_DEFAULT[1], "Origen: Plaza 14 de Septiembre, Cochabamba");
        }
    };

    const inicializarMapa = () => {
        const mapContainer = document.getElementById('map');
        if (!mapContainer || map !== null) return;

        try {
            map = L.map('map', {
                center: COCHABAMBA_DEFAULT,
                zoom: 13,
                zoomControl: false
            });

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors | IOP812'
            }).addTo(map);

            markersLayer = L.layerGroup().addTo(map);
            intentoAutoGeolocalizacion();

            // Captura de coordenadas al registrar ferretería en el mapa
            map.on('click', (e) => {
                if (!modoSeleccionMapa) return;
                modoSeleccionMapa = false;
                document.getElementById('map')?.classList.remove('cursor-crosshair');
                document.getElementById('mapPickerBanner')?.classList.add('d-none');

                const latInput = document.getElementById('regFerrLat');
                const lngInput = document.getElementById('regFerrLng');
                if (latInput) latInput.value = e.latlng.lat.toFixed(6);
                if (lngInput) lngInput.value = e.latlng.lng.toFixed(6);

                const modalReg = document.getElementById('modalRegistrarFerreteria');
                if (modalReg && typeof bootstrap !== 'undefined') {
                    bootstrap.Modal.getOrCreateInstance(modalReg).show();
                }
            });

            setTimeout(() => { if (map) map.invalidateSize(); }, 250);
        } catch (e) {
            console.error("Error al inicializar Leaflet:", e);
        }
    };

    inicializarMapa();

    // ---------------------------------------------------------------
    // 4. MODALES Y NAVEGACIÓN
    // ---------------------------------------------------------------
    document.getElementById('btnAbrirLogin')?.addEventListener('click', () => {
        const el = document.getElementById('modalLoginAuth');
        if (el && typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(el).show();
    });

    document.getElementById('btnAbrirCreditos')?.addEventListener('click', () => {
        const el = document.getElementById('modalCreditos');
        if (el && typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(el).show();
    });

    document.getElementById('btnAbrirDashboard')?.addEventListener('click', () => {
        const el = document.getElementById('modalDashboardIO');
        if (el && typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(el).show();
            cargarProductosCRUD();
            if (perfilUsuarioActual?.rol === 'admin') cargarUsuariosAdmin();
        }
    });

    const abrirModalRegistroFerreteria = () => {
        const el = document.getElementById('modalRegistrarFerreteria');
        if (el && typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(el).show();
    };

    document.getElementById('btnAbrirRegistroFerreteria')?.addEventListener('click', abrirModalRegistroFerreteria);
    document.getElementById('btnAdminNuevaFerreteria')?.addEventListener('click', abrirModalRegistroFerreteria);

    document.getElementById('btnPickMapLocation')?.addEventListener('click', () => {
        const modalReg = document.getElementById('modalRegistrarFerreteria');
        if (modalReg && typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(modalReg).hide();
        }
        modoSeleccionMapa = true;
        document.getElementById('mapPickerBanner')?.classList.remove('d-none');
    });

    document.getElementById('btnCancelarMapPicker')?.addEventListener('click', () => {
        modoSeleccionMapa = false;
        document.getElementById('mapPickerBanner')?.classList.add('d-none');
        abrirModalRegistroFerreteria();
    });

    document.getElementById('btnToggleAHP')?.addEventListener('click', (e) => {
        e.preventDefault();
        const collapseAHP = document.getElementById('collapseAHP');
        if (collapseAHP && typeof bootstrap !== 'undefined') {
            bootstrap.Collapse.getOrCreateInstance(collapseAHP, { toggle: false }).toggle();
        }
    });

    // ---------------------------------------------------------------
    // 5. GEOCODIFICACIÓN Y SLIDERS AHP
    // ---------------------------------------------------------------
    const btnGPS = document.getElementById('btnGPS');
    const inputOrigen = document.getElementById('inputOrigen');

    btnGPS?.addEventListener('click', () => {
        btnGPS.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-primary"></i>`;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                if (map) map.flyTo([latitude, longitude], 15);
                const marker = actualizarMarcadorUsuario(latitude, longitude, "Tu ubicación GPS actual");
                if (marker) marker.openPopup();
                if (inputOrigen) inputOrigen.value = `Ubicación GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
                btnGPS.innerHTML = `<i class="fa-solid fa-crosshairs text-primary"></i>`;
            },
            (err) => {
                notificar('Error de Geolocalización', 'No se pudo obtener la posición GPS: ' + err.message, 'error');
                btnGPS.innerHTML = `<i class="fa-solid fa-crosshairs text-primary"></i>`;
            }
        );
    });

    const resolverCoordenadasOrigen = async (textoOrigen) => {
        if (textoOrigen.includes("GPS")) return ubicacionUsuario;
        try {
            const query = encodeURIComponent(`${textoOrigen}, Cochabamba, Bolivia`);
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                if (map) map.flyTo([lat, lon], 14);
                actualizarMarcadorUsuario(lat, lon, `Origen: ${data[0].display_name.split(',')[0]}`);
                return { lat, lng: lon };
            }
        } catch (e) {
            console.warn("Geocoding Nominatim no disponible.");
        }
        return ubicacionUsuario;
    };
    //(Ponderación Saaty 1-9)
    const sliders = {
        precio: document.getElementById('sliderPrecio'),
        distancia: document.getElementById('sliderDistancia'),
        reputacion: document.getElementById('sliderReputacion'),
        stock: document.getElementById('sliderStock')
    };
    const labels = {
        precio: document.getElementById('valPrecio'),
        distancia: document.getElementById('valDistancia'),
        reputacion: document.getElementById('valReputacion'),
        stock: document.getElementById('valStock')
    };

    const actualizarPorcentajesAHP = () => {
        const valP = parseInt(sliders.precio?.value || 4, 10);
        const valD = parseInt(sliders.distancia?.value || 3, 10);
        const valR = parseInt(sliders.reputacion?.value || 2, 10);
        const valS = parseInt(sliders.stock?.value || 1, 10);
        const suma = valP + valD + valR + valS;

        if (labels.precio) labels.precio.textContent = `${Math.round((valP / suma) * 100)}%`;
        if (labels.distancia) labels.distancia.textContent = `${Math.round((valD / suma) * 100)}%`;
        if (labels.reputacion) labels.reputacion.textContent = `${Math.round((valR / suma) * 100)}%`;
        if (labels.stock) labels.stock.textContent = `${Math.round((valS / suma) * 100)}%`;
    };

    Object.values(sliders).forEach(s => s?.addEventListener('input', actualizarPorcentajesAHP));
    actualizarPorcentajesAHP();

    // ---------------------------------------------------------------
    // 6. BÚSQUEDA MULTICRITERIO AHP + FAVORITOS E HISTORIAL
    // ---------------------------------------------------------------
    const formBuscador = document.getElementById('formBuscadorAHP');
    const cardTopResult = document.getElementById('cardTopResult');

    document.getElementById('btnCloseTopResult')?.addEventListener('click', () => {
        cardTopResult?.classList.add('d-none');
    });

    formBuscador?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productoText = document.getElementById('inputProducto')?.value.trim();
        const origenText = document.getElementById('inputOrigen')?.value.trim();
        if (!productoText) return;

        const btnBuscar = document.getElementById('btnBuscarAHP');
        if (btnBuscar) {
            btnBuscar.disabled = true;
            btnBuscar.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-2"></i> Consultando PostGIS & AHP...`;
        }

        const coordsActuales = await resolverCoordenadasOrigen(origenText || '');
        // Estructura exacta requerida por AHPSearchInput en app/modules/buscador_ahp/schemas.py
        const payload = {
            latitud: coordsActuales.lat,
            longitud: coordsActuales.lng,
            producto: productoText,
            pesos: {
                precio: parseInt(sliders.precio?.value || 4, 10),
                distancia: parseInt(sliders.distancia?.value || 3, 10),
                reputacion: parseInt(sliders.reputacion?.value || 2, 10),
                stock: parseInt(sliders.stock?.value || 1, 10)
            }
        };

        try {
            const response = await fetch('/api/ahp/buscar', {
                method: 'POST',
                headers: getAuthHeaders(true),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(typeof errData.detail === 'string' ? errData.detail : 'Error en la búsqueda geoespacial');
            }

            const data = await response.json();
            renderizarResultadosAHP(data);
            if (perfilUsuarioActual) cargarHistorialYFavoritos();
        } catch (error) {
            notificar('Error en Búsqueda AHP', error.message, 'warning');
        } finally {
            if (btnBuscar) {
                btnBuscar.disabled = false;
                btnBuscar.innerHTML = `<i class="fa-solid fa-route"></i> <span>Optimizar y Buscar Ferretería</span>`;
            }
        }
    });

    const renderizarResultadosAHP = (data) => {
        if (!markersLayer) return;
        markersLayer.clearLayers();
        actualizarMarcadorUsuario(ubicacionUsuario.lat, ubicacionUsuario.lng, "Tu Origen de Búsqueda");

        if (!data.ferreterias || data.ferreterias.length === 0) {
            notificar('Búsqueda sin resultados', 'No hay ferreterías con stock disponible para ese producto.', 'info');
            return;
        }

        const top = data.ferreterias[0];
        topFerreteriaActual = top;

        document.getElementById('topFerreteriaNombre').textContent = top.nombre;
        document.getElementById('topFerreteriaDireccion').innerHTML = `<i class="fa-solid fa-location-pin me-1"></i> ${top.direccion}`;
        document.getElementById('topPrecioBOB').textContent = `Bs. ${parseFloat(top.precio_bob).toFixed(2)}`;
        document.getElementById('topDistanciaKM').textContent = `${top.distancia_km} km`;
        document.getElementById('topReputacion').textContent = top.reputacion;
        document.getElementById('topStock').textContent = `${top.stock} un.`;
        cardTopResult?.classList.remove('d-none');

        const puntosBounds = [[ubicacionUsuario.lat, ubicacionUsuario.lng]];

        data.ferreterias.forEach((f, idx) => {
            const color = idx === 0 ? '#F59E0B' : '#0EA5E9';
            const markerIcon = L.divIcon({
                className: 'ferreteria-marker',
                html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);"><i class="fa-solid fa-store"></i></div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const marker = L.marker([f.latitud, f.longitud], { icon: markerIcon })
                .addTo(markersLayer)
                .bindPopup(`
                    <div style="color: #0F172A; min-width: 180px;">
                        <strong style="color: ${color};">${f.nombre}</strong><br>
                        <small>${f.direccion}</small><br>
                        <strong style="color: #10B981;">Bs. ${parseFloat(f.precio_bob).toFixed(2)}</strong> | Stock: ${f.stock} un.<br>
                        <button class="btn btn-sm btn-warning mt-2 w-100 py-0" onclick="window.agregarFavorito(${f.id_ferreteria})">
                            <i class="fa-solid fa-star"></i> Guardar Favorito
                        </button>
                    </div>
                `);

            if (idx === 0) marker.openPopup();
            puntosBounds.push([f.latitud, f.longitud]);
        });

        if (map) map.fitBounds(puntosBounds, { padding: [50, 50] });
    };

    window.agregarFavorito = async (idFerreteria) => {
        if (!perfilUsuarioActual) {
            notificar('Inicia Sesión', 'Debes iniciar sesión para guardar ferreterías favoritas.', 'info');
            return;
        }
        try {
            const res = await fetch(`/api/ahp/favoritos/${idFerreteria}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'No se pudo guardar en favoritos');
            notificar('Guardado en Favoritos', data.mensaje || 'Ferretería añadida a tu lista.', 'success');
            cargarHistorialYFavoritos();
        } catch (err) {
            notificar('Favoritos', err.message, 'warning');
        }
    };

    document.getElementById('btnFavoritoTop')?.addEventListener('click', () => {
        if (topFerreteriaActual) window.agregarFavorito(topFerreteriaActual.id_ferreteria);
    });

    const cargarHistorialYFavoritos = async () => {
        if (!perfilUsuarioActual) return;
        const listaHist = document.getElementById('listaHistorial');
        const listaFav = document.getElementById('listaFavoritos');

        try {
            const [resHist, resFav] = await Promise.all([
                fetch('/api/ahp/historial', { headers: getAuthHeaders() }),
                fetch('/api/ahp/favoritos', { headers: getAuthHeaders() })
            ]);

            if (resHist.ok && listaHist) {
                const historial = await resHist.json();
                listaHist.innerHTML = historial.length === 0
                    ? `<div class="list-group-item bg-transparent text-muted small py-3 text-center">Aún no tienes búsquedas registradas.</div>`
                    : historial.map(h => `
                        <button type="button" class="list-group-item list-group-item-action bg-transparent text-main small py-2"
                            onclick="document.getElementById('inputProducto').value='${h.texto_buscado.replace(/'/g, "\\'")}'; document.getElementById('formBuscadorAHP').dispatchEvent(new Event('submit'));">
                            <div class="fw-semibold"><i class="fa-solid fa-magnifying-glass text-primary me-2"></i>${h.texto_buscado}</div>
                            <span class="extra-small text-muted">${new Date(h.fecha_busqueda).toLocaleString()}</span>
                        </button>
                    `).join('');
            }

            if (resFav.ok && listaFav) {
                const favoritos = await resFav.json();
                listaFav.innerHTML = favoritos.length === 0
                    ? `<div class="list-group-item bg-transparent text-muted small py-3 text-center">No tienes ferreterías favoritas guardadas.</div>`
                    : favoritos.map(f => `
                        <div class="list-group-item bg-transparent text-main small py-2 d-flex justify-content-between align-items-center">
                            <div role="button" onclick="if(window._flyToStore) window._flyToStore(${f.latitud}, ${f.longitud}, '${f.nombre.replace(/'/g, "\\'")}')">
                                <div class="fw-semibold"><i class="fa-solid fa-star text-warning me-1"></i> ${f.nombre}</div>
                                <span class="extra-small text-muted">${f.direccion}</span>
                            </div>
                        </div>
                    `).join('');
            }
        } catch (e) {
            console.warn('Historial/Favoritos pendientes de consulta:', e);
        }
    };

    window._flyToStore = (lat, lng, nombre) => {
        if (map) {
            map.flyTo([lat, lng], 16);
            L.popup().setLatLng([lat, lng]).setContent(`<strong>${nombre}</strong>`).openOn(map);
        }
    };

    document.getElementById('drawerGoogleMaps')?.addEventListener('show.bs.offcanvas', cargarHistorialYFavoritos);

    // ---------------------------------------------------------------
    // 7. GOOGLE OAUTH2 (AUTHORIZATION CODE FLOW) + JWT + ROLES
    // ---------------------------------------------------------------
    const procesarRetornoOAuth = async () => {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const queryParams = new URLSearchParams(window.location.search);
        const oauthToken = hashParams.get('access_token');
        const oauthError = queryParams.get('auth_error');

        if (oauthToken) {
            localStorage.setItem('iop812-token', oauthToken);
            window.history.replaceState({}, document.title, window.location.pathname);
            try {
                const perfil = await obtenerPerfil(oauthToken);
                actualizarInterfazSesion(perfil);
                notificar('¡Acceso Correcto!', `Bienvenido ${perfil.username} (${perfil.rol.toUpperCase()}).`, 'success');
                return true;
            } catch (err) {
                localStorage.removeItem('iop812-token');
            }
        } else if (oauthError) {
            window.history.replaceState({}, document.title, window.location.pathname);
            const mensajesError = {
                google_not_configured: 'Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en el archivo .env del servidor.',
                invalid_state: 'La sesión de seguridad OAuth expiró. Intenta iniciar sesión nuevamente.',
                access_denied: 'Cancelaste el inicio de sesión con Google.',
                google_token_exchange_failed: 'No se pudo validar el código con Google. Verifica el Redirect URI en Google Cloud Console.'
            };
            notificar('Inicio con Google', mensajesError[oauthError] || `Error OAuth2: ${oauthError}`, 'warning');
        }
        return false;
    };

    const inicializarGoogleSignIn = async () => {
        const btnGoogle = document.getElementById('btnGoogleOAuth');
        if (!btnGoogle) return;

        try {
            const res = await fetch('/api/auth/config');
            if (!res.ok) return;
            const cfg = await res.json();
            if (!cfg.google_oauth_enabled) {
                btnGoogle.addEventListener('click', (e) => {
                    e.preventDefault();
                    notificar(
                        'Configuración Pendiente',
                        'Agrega GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en tu archivo .env y reinicia el servidor.',
                        'info'
                    );
                });
            }
        } catch (e) {
            console.warn('No se pudo verificar /api/auth/config:', e);
        }
    };
    inicializarGoogleSignIn();

    const actualizarInterfazSesion = (perfil) => {
        perfilUsuarioActual = perfil;
        const autenticado = Boolean(perfil);
        const rol = perfil?.rol || 'cliente';

        document.getElementById('btnAbrirLogin')?.classList.toggle('d-none', autenticado);
        document.getElementById('btnCerrarSesion')?.classList.toggle('d-none', !autenticado);

        const navBadge = document.getElementById('navUserBadge');
        if (navBadge) {
            navBadge.classList.toggle('d-none', !autenticado);
            navBadge.classList.toggle('d-md-inline-flex', autenticado);
            document.getElementById('navUserName').textContent = autenticado ? perfil.username : '';
            document.getElementById('navUserRole').textContent = autenticado ? rol : '';
        }

        const esGestor = autenticado && (rol === 'ferretero' || rol === 'admin');
        const puedeRegistrarFerreteria = autenticado && (rol === 'admin' || !perfil.id_ferreteria);

        document.getElementById('btnAbrirDashboard')?.classList.toggle('d-none', !esGestor);
        document.getElementById('btnAbrirRegistroFerreteria')?.classList.toggle('d-none', !puedeRegistrarFerreteria);
        document.getElementById('navItemAdmin')?.classList.toggle('d-none', rol !== 'admin');
    };

    const obtenerPerfil = async (token) => {
        const res = await fetch('/api/auth/perfil', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
            const error = new Error(data.detail || `Sesión inválida (${res.status})`);
            error.status = res.status;
            throw error;
        }
        return data;
    };

    const restaurarSesion = async () => {
        const token = localStorage.getItem('iop812-token');
        if (!token) {
            actualizarInterfazSesion(null);
            return;
        }
        try {
            const perfil = await obtenerPerfil(token);
            actualizarInterfazSesion(perfil);
        } catch (err) {
            localStorage.removeItem('iop812-token');
            actualizarInterfazSesion(null);
        }
    };
    procesarRetornoOAuth().then((autenticadoPorOAuth) => {
        if (!autenticadoPorOAuth) restaurarSesion();
    });

    // Login / Registro clásico
    let isRegisterMode = false;
    const btnToggleAuthMode = document.getElementById('btnToggleAuthMode');
    const usernameGroup = document.getElementById('usernameGroup');
    const inputUsername = document.getElementById('inputUsername');

    btnToggleAuthMode?.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        usernameGroup?.classList.toggle('d-none', !isRegisterMode);
        if (inputUsername) inputUsername.required = isRegisterMode;
        document.getElementById('btnSubmitAuth').textContent = isRegisterMode ? 'Crear cuenta' : 'Iniciar Sesión';
        document.getElementById('authModePrompt').textContent = isRegisterMode ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
        btnToggleAuthMode.textContent = isRegisterMode ? 'Iniciar sesión' : 'Crear cuenta';
        document.getElementById('modalLoginAuthLabel').textContent = isRegisterMode ? 'Crear cuenta ferretera' : '¡Bienvenido a la familia Opti!';
    });

    document.getElementById('btnCerrarSesion')?.addEventListener('click', () => {
        localStorage.removeItem('iop812-token');
        actualizarInterfazSesion(null);
        notificar('Sesión cerrada', 'Has cerrado tu sesión correctamente.', 'success');
    });

    document.getElementById('formLogin')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('inputEmail')?.value;
        const password = document.getElementById('inputPassword')?.value;
        const username = inputUsername?.value;
        const endpoint = isRegisterMode ? '/api/auth/registro' : '/api/auth/login';
        const payload = isRegisterMode ? { email, username, password } : { email, password };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                const detail = Array.isArray(data.detail) ? data.detail.map(i => i.msg).join(', ') : data.detail;
                throw new Error(detail || 'Error de autenticación');
            }

            localStorage.setItem('iop812-token', data.access_token);
            const perfil = await obtenerPerfil(data.access_token);
            actualizarInterfazSesion(perfil);

            const modalEl = document.getElementById('modalLoginAuth');
            if (modalEl && typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(modalEl).hide();
            e.target.reset();
            notificar('¡Acceso correcto!', `Bienvenido ${perfil.username}.`, 'success');
        } catch (err) {
            notificar('Error de Autenticación', err.message, 'error');
        }
    });

    // ---------------------------------------------------------------
    // 8. REGISTRO DE FERRETERÍA Y GESTIÓN ADMIN DE ROLES
    // ---------------------------------------------------------------
    document.getElementById('formRegistrarFerreteria')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            nombre: document.getElementById('regFerrNombre').value.trim(),
            direccion: document.getElementById('regFerrDireccion').value.trim(),
            latitud: parseFloat(document.getElementById('regFerrLat').value),
            longitud: parseFloat(document.getElementById('regFerrLng').value),
            superficie_almacen_m2: parseFloat(document.getElementById('regFerrSuperficie').value || 0),
            capacidad_canales_atencion: parseInt(document.getElementById('regFerrCanales').value || 1, 10)
        };

        try {
            const res = await fetch('/api/auth/registrar-ferreteria', {
                method: 'POST',
                headers: getAuthHeaders(true),
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al registrar ferretería');

            if (data.access_token) {
                localStorage.setItem('iop812-token', data.access_token);
            }

            const modalEl = document.getElementById('modalRegistrarFerreteria');
            if (modalEl && typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(modalEl).hide();

            const token = localStorage.getItem('iop812-token');
            if (token) actualizarInterfazSesion(await obtenerPerfil(token));

            notificar('Ferretería Registrada', 'Tu ferretería ya está activa en el mapa y tu panel fue habilitado.', 'success');
        } catch (err) {
            notificar('Error al Registrar', err.message, 'error');
        }
    });
const cargarResumenAdmin = async () => {
        const badge = document.getElementById('badgeResumenAdmin');
        if (!badge) return;
        try {
            const res = await fetch('/api/auth/ferreterias/resumen', { headers: getAuthHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            badge.textContent = `${data.total_ferreterias} ferreterías | ${data.total_productos} productos`;
        } catch (e) {
            console.warn('No se pudo cargar resumen admin:', e);
        }
    };

    document.getElementById('btnPlantillaCatalogoAdmin')?.addEventListener('click', () => {
        const encabezado = "ferreteria,nombre,precio_bob,stock_actual,demanda_anual_D,costo_pedido_K,costo_mantenimiento_H,tiempo_entrega_dias_L,stock_seguridad_SS\n";
        const blob = new Blob([encabezado], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_catalogo_multisucursal.csv';
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('inputCsvFerreterias')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('archivo', file);

        try {
            const res = await fetch('/api/auth/ferreterias/carga-masiva', {
                method: 'POST',
                headers: getAuthHeaders(false),
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al importar ferreterías CSV');

            notificar('Ferreterías Importadas', data.mensaje, 'success');
            cargarResumenAdmin();
        } catch (err) {
            notificar('Error en Carga de Ferreterías', err.message, 'error');
        } finally {
            e.target.value = '';
        }
    });

    document.getElementById('inputCsvCatalogoAdmin')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('archivo', file);

        try {
            const res = await fetch('/api/productos/carga-masiva', {
                method: 'POST',
                headers: getAuthHeaders(false),
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al importar catálogo multi-sucursal');

            notificar('Catálogo Multi-Sucursal Cargado', data.mensaje, 'success');
            cargarResumenAdmin();
            cargarProductosCRUD();
        } catch (err) {
            notificar('Error en Carga de Catálogo', err.message, 'error');
        } finally {
            e.target.value = '';
        }
    });
    const cargarUsuariosAdmin = async () => {
        cargarResumenAdmin();
        const tbody = document.getElementById('tbodyUsuariosAdmin');
        if (!tbody) return;
        try {
            const res = await fetch('/api/auth/usuarios', { headers: getAuthHeaders() });
            if (!res.ok) return;
            const usuarios = await res.json();
            tbody.innerHTML = usuarios.map(u => `
                <tr>
                    <td class="fw-medium">${u.username}</td>
                    <td>${u.email}</td>
                    <td>${u.nombre_ferreteria || '<span class="text-muted">Sin ferretería</span>'}</td>
                    <td>
                        <select class="form-select form-select-sm w-auto" onchange="window.cambiarRolUsuario(${u.id_usuario}, this.value)">
                            <option value="cliente" ${u.rol === 'cliente' ? 'selected' : ''}>cliente</option>
                            <option value="ferretero" ${u.rol === 'ferretero' ? 'selected' : ''}>ferretero</option>
                            <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>admin</option>
                        </select>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            console.warn('Error cargando usuarios admin:', e);
        }
    };

    window.cambiarRolUsuario = async (idUsuario, nuevoRol) => {
        try {
            const res = await fetch(`/api/auth/usuarios/${idUsuario}/rol`, {
                method: 'PATCH',
                headers: getAuthHeaders(true),
                body: JSON.stringify({ rol: nuevoRol })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al actualizar rol');
            notificar('Rol Actualizado', data.mensaje || `Rol cambiado a ${nuevoRol}.`, 'success');
        } catch (err) {
            notificar('Error de Permisos', err.message, 'error');
        }
    };

    // ---------------------------------------------------------------
    // 9. CRUD CATÁLOGO FERRETERO + IMPORTADOR CSV
    // ---------------------------------------------------------------
    const cardFormProducto = document.getElementById('cardFormProducto');
    const formProductoCRUD = document.getElementById('formProductoCRUD');

    document.getElementById('btnToggleFormProducto')?.addEventListener('click', () => {
        formProductoCRUD?.reset();
        document.getElementById('prodEditId').value = '';
        cardFormProducto?.classList.toggle('d-none');
    });

    document.getElementById('btnCancelarProducto')?.addEventListener('click', () => {
        cardFormProducto?.classList.add('d-none');
    });

    document.getElementById('btnDescargarPlantillaCSV')?.addEventListener('click', () => {
        const encabezado = "nombre,precio_bob,stock_actual,demanda_anual_D,costo_pedido_K,costo_mantenimiento_H,tiempo_entrega_dias_L,stock_seguridad_SS\n";
        const blob = new Blob([encabezado], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_catalogo_iop812.csv';
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('inputCsvProductos')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('archivo', file);

        try {
            const res = await fetch('/api/productos/carga-masiva', {
                method: 'POST',
                headers: getAuthHeaders(false),
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al procesar el archivo CSV');

            notificar('Carga Masiva Exitosa', data.mensaje, 'success');
            cargarProductosCRUD();
        } catch (err) {
            notificar('Error en Carga CSV', err.message, 'error');
        } finally {
            e.target.value = '';
        }
    });

    formProductoCRUD?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('prodEditId').value;
        const payload = {
            nombre: document.getElementById('prodNombre').value.trim(),
            precio_bob: parseFloat(document.getElementById('prodPrecio').value),
            stock_actual: parseInt(document.getElementById('prodStock').value, 10),
            demanda_anual_D: parseInt(document.getElementById('prodDemanda').value, 10),
            costo_pedido_K: parseFloat(document.getElementById('prodK').value || 50),
            costo_mantenimiento_H: parseFloat(document.getElementById('prodH').value || 5),
            tiempo_entrega_dias_L: parseInt(document.getElementById('prodL').value || 3, 10),
            stock_seguridad_SS: parseInt(document.getElementById('prodSS').value || 10, 10)
        };

        const url = editId ? `/api/productos/${editId}` : '/api/productos';
        const method = editId ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: getAuthHeaders(true),
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'No se pudo guardar el producto');

            cardFormProducto?.classList.add('d-none');
            notificar('Catálogo Actualizado', data.mensaje, 'success');
            cargarProductosCRUD();
        } catch (err) {
            notificar('Error al Guardar', err.message, 'error');
        }
    });

    const cargarProductosCRUD = async () => {
        const tbody = document.getElementById('tbodyCatálogo');
        if (!tbody) return;

        try {
            const res = await fetch('/api/productos', { headers: getAuthHeaders() });
            if (!res.ok) return;
            productosCache = await res.json();

            if (productosCache.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted small py-3">No hay productos registrados en el catálogo.</td></tr>`;
                return;
            }

            tbody.innerHTML = productosCache.map(p => `
                <tr>
                    <td class="fw-medium">${p.nombre}</td>
                    <td class="small text-muted">${p.ferreteria_nombre || '-'}</td>
                    <td class="text-success fw-bold">Bs. ${parseFloat(p.precio_bob).toFixed(2)}</td>
                    <td><span class="badge ${p.stock_actual > 20 ? 'bg-success' : 'bg-danger'}">${p.stock_actual} un.</span></td>
                    <td>${p.demanda_anual_D} un.</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="window.editarProducto(${p.id_producto})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="window.eliminarProducto(${p.id_producto})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            console.warn('Error cargando catálogo:', e);
        }
    };

    window.editarProducto = (id) => {
        const prod = productosCache.find(p => p.id_producto === id);
        if (!prod) return;
        document.getElementById('prodEditId').value = prod.id_producto;
        document.getElementById('prodNombre').value = prod.nombre;
        document.getElementById('prodPrecio').value = prod.precio_bob;
        document.getElementById('prodStock').value = prod.stock_actual;
        document.getElementById('prodDemanda').value = prod.demanda_anual_D;
        document.getElementById('prodK').value = prod.costo_pedido_K ?? 50;
        document.getElementById('prodH').value = prod.costo_mantenimiento_H ?? 5;
        document.getElementById('prodL').value = prod.tiempo_entrega_dias_L ?? 3;
        document.getElementById('prodSS').value = prod.stock_seguridad_SS ?? 10;
        cardFormProducto?.classList.remove('d-none');
    };

    window.eliminarProducto = async (id) => {
        const confirmacion = await Swal.fire({
            title: '¿Eliminar producto?',
            text: 'Esta acción eliminará el ítem del catálogo.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirmacion.isConfirmed) return;

        try {
            const res = await fetch(`/api/productos/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'No se pudo eliminar');
            notificar('Eliminado', data.mensaje, 'success');
            cargarProductosCRUD();
        } catch (err) {
            notificar('Error al Eliminar', err.message, 'error');
        }
    };

    document.getElementById('tab-crud-tab')?.addEventListener('click', cargarProductosCRUD);

    // ---------------------------------------------------------------
    // 10. CALCULADORAS IO2 (EOQ, COLAS M/M/1, MARKOV, DECISIONES)
    // ---------------------------------------------------------------
    document.getElementById('formEOQ')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/inventario/calcular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unidad_tiempo: 'Años',
                    demanda_D: parseFloat(document.getElementById('eoqD')?.value || 0),
                    costo_pedido_K: parseFloat(document.getElementById('eoqK')?.value || 0),
                    costo_mantenimiento_H: parseFloat(document.getElementById('eoqH')?.value || 0),
                    tiempo_entrega_dias_L: parseFloat(document.getElementById('eoqL')?.value || 0)
                })
            });
            if (!response.ok) throw new Error('Falló el procesamiento en el motor EOQ');
            const data = await response.json();
            document.getElementById('resQOptimo').textContent = `${data.lote_optimo_Q} un.`;
            document.getElementById('resROP').textContent = `${data.punto_reorden_ROP} un.`;
            notificar('Cálculo Exitoso', 'Valores de EOQ y ROP actualizados.', 'success');
        } catch (err) {
            notificar('Error en Modelo EOQ', err.message, 'error');
        }
    });

    document.getElementById('formColas')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const unidad = document.getElementById('colaUnidad')?.value || 'horas';
        try {
            const res = await fetch('/api/colas/mm1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tasa_llegada_lambda: parseFloat(document.getElementById('colaLambda')?.value || 0),
                    tasa_servicio_mu: parseFloat(document.getElementById('colaMu')?.value || 0),
                    unidad_tiempo: unidad
                })
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Servicio saturado o parámetros inválidos');
            }
            const data = await res.json();
            document.getElementById('resColaRho').textContent = `${(data.factor_uso_rho * 100).toFixed(1)}%`;
            const tiempoMostrar = unidad === 'horas' ? (data.tiempo_espera_cola_Wq * 60).toFixed(1) + ' min' : data.tiempo_espera_cola_Wq.toFixed(1) + ' min';
            document.getElementById('resColaWq').textContent = tiempoMostrar;
            notificar('Métricas M/M/1 Calculadas', 'Estimación procesada correctamente.', 'success');
        } catch (err) {
            notificar('Error en Colas', err.message, 'error');
        }
    });

    document.getElementById('formMarkov')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const p12 = parseFloat(document.getElementById('markovP12')?.value || 0);
        const p2A1 = parseFloat(document.getElementById('markovP2A1')?.value || 0);
        try {
            const response = await fetch('/api/markov/simular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estados_transitorios: ["Busqueda", "EnCarrito"],
                    estados_absorbentes: ["CompraRealizada", "Abandono"],
                    matriz_Q: [[0.0, p12], [0.0, 0.0]],
                    matriz_R: [[0.0, 1 - p12], [p2A1, 1 - p2A1]]
                })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Error al simular Cadenas de Markov');
            }
            const data = await response.json();
            const probConversion = data.matriz_absorcion_B?.Busqueda?.CompraRealizada ?? 0.0;
            const interpretacion = data.interpretacion_humana ? data.interpretacion_humana.join('<br>') : '';
            document.getElementById('resMarkovContainer').innerHTML = `
                <div class="alert alert-success border-0 mb-0">
                    <h6 class="fw-bold mb-1"><i class="fa-solid fa-chart-line me-1"></i> Tasa Probable de Conversión</h6>
                    <p class="mb-1 small">Probabilidad de absorción final desde <strong>Búsqueda</strong> hasta <strong>CompraRealizada</strong>:</p>
                    <h3 class="fw-bold text-success mb-2">${(probConversion * 100).toFixed(2)}%</h3>
                    <div class="extra-small text-muted border-top pt-2 mt-2">${interpretacion}</div>
                </div>
            `;
            notificar('Simulación Markov Exitosa', 'Matriz N y B calculadas.', 'success');
        } catch (err) {
            notificar('Error en Markov', err.message, 'error');
        }
    });

    document.getElementById('formDecisiones')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const p1 = parseFloat(document.getElementById('decProbE1')?.value || 0);
            const res = await fetch('/api/decisiones/evaluar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alternativas: [
                        document.getElementById('decAlt1')?.value || '',
                        document.getElementById('decAlt2')?.value || ''
                    ],
                    estados_naturaleza: ["Alta Demanda", "Baja Demanda"],
                    matriz_pagos: [
                        [parseFloat(document.getElementById('decA1E1')?.value || 0), parseFloat(document.getElementById('decA1E2')?.value || 0)],
                        [parseFloat(document.getElementById('decA2E1')?.value || 0), parseFloat(document.getElementById('decA2E2')?.value || 0)]
                    ],
                    probabilidades: [p1, 1 - p1],
                    coeficiente_alpha: 0.7
                })
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Error en evaluación de decisiones');
            }
            const data = await res.json();
            const vmeOpt = data.analisis_riesgo ? data.analisis_riesgo.decision_optima_vme : 'N/A';
            const laplaceOpt = data.criterios_incertidumbre?.["Laplace (Equiprobabilidad)"]?.alternativa_optima || 'N/A';
            const waldOpt = data.criterios_incertidumbre?.["Wald Pesimista (MaxiMin)"]?.alternativa_optima || 'N/A';
            const savageOpt = data.criterios_incertidumbre?.["Savage (MiniMax Arrepentimiento)"]?.alternativa_optima || 'N/A';

            document.getElementById('resDecisionesContainer').innerHTML = `
                <ul class="list-unstyled mb-0 small">
                    <li class="mb-2"><strong>Sugerencia VME (Riesgo):</strong> <span class="text-success fw-bold">${vmeOpt}</span></li>
                    <li class="mb-1"><strong>Criterio Laplace:</strong> ${laplaceOpt}</li>
                    <li class="mb-1"><strong>Criterio Wald (Pesimista):</strong> ${waldOpt}</li>
                    <li class="mb-1"><strong>Criterio Savage (Minimax):</strong> ${savageOpt}</li>
                </ul>
                <div class="mt-2 pt-2 border-top extra-small text-muted">${data.recomendacion_general}</div>
            `;
            notificar('Evaluación Completada', 'Criterios procesados exitosamente.', 'success');
        } catch (err) {
            notificar('Error en Decisiones', err.message, 'error');
        }
    });
});
