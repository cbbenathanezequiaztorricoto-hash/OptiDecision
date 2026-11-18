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
    let rutasLayer = null;
    let ubicacionUsuario = { lat: COCHABAMBA_DEFAULT[0], lng: COCHABAMBA_DEFAULT[1] };
    let rutaActivaConfig = null;
    let rutasDisponiblesCache = [];
    let perfilUsuarioActual = null;
    let topFerreteriaActual = null;
    let ferreteriaModalActual = null;
    let catalogoModalCache = [];
    let favoritosIds = new Set();
    let productosCache = [];
    let modoSeleccionMapa = false;

    const escapeHtml = (texto) => {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const obtenerIconoCategoria = (categoria, nombreProducto = '') => {
        const ref = `${categoria || ''} ${nombreProducto || ''}`.toLowerCase();
        if (ref.includes('herramienta') || ref.includes('martillo') || ref.includes('llave') || ref.includes('taladro')) {
            return 'fa-screwdriver-wrench';
        }
        if (ref.includes('pintura') || ref.includes('brocha') || ref.includes('rodillo') || ref.includes('esmalte')) {
            return 'fa-paint-roller';
        }
        if (ref.includes('construc') || ref.includes('cemento') || ref.includes('ladrillo') || ref.includes('yeso') || ref.includes('arena')) {
            return 'fa-trowel-bricks';
        }
        if (ref.includes('electr') || ref.includes('cable') || ref.includes('foco') || ref.includes('breaker')) {
            return 'fa-bolt';
        }
        return 'fa-box-open';
    };

    const renderizarMiniaturaProducto = (fotoUrl, categoria, nombreProducto = '') => {
        if (fotoUrl && String(fotoUrl).trim() !== '') {
            return `
                <div class="product-thumb-box">
                    <img src="${escapeHtml(fotoUrl)}" alt="${escapeHtml(nombreProducto)}" class="product-thumb-img" loading="lazy">
                </div>
            `;
        }
        const icono = obtenerIconoCategoria(categoria, nombreProducto);
        return `
            <div class="product-thumb-box" title="Sin fotografía">
                <i class="fa-solid ${icono}"></i>
            </div>
        `;
    };

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
            .bindPopup(`<strong>${escapeHtml(titulo)}</strong>`);
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

            rutasLayer = L.layerGroup().addTo(map);
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
    // 4. MODALES, OMNIBOX Y POPOVER DE CUENTA
    // ---------------------------------------------------------------
    const popoverPerfil = document.getElementById('popoverPerfilCuenta');
    const btnEsfericoCuenta = document.getElementById('btnEsfericoCuenta');

    btnEsfericoCuenta?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!perfilUsuarioActual) {
            const el = document.getElementById('modalLoginAuth');
            if (el && typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(el).show();
            return;
        }
        popoverPerfil?.classList.toggle('d-none');
    });

    document.addEventListener('click', (e) => {
        if (popoverPerfil && !popoverPerfil.classList.contains('d-none')) {
            if (!popoverPerfil.contains(e.target) && !btnEsfericoCuenta?.contains(e.target)) {
                popoverPerfil.classList.add('d-none');
            }
        }
    });

    document.getElementById('btnAbrirCreditos')?.addEventListener('click', () => {
        const el = document.getElementById('modalCreditos');
        if (el && typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(el).show();
    });

    const abrirDashboardIO = () => {
        popoverPerfil?.classList.add('d-none');
        const el = document.getElementById('modalDashboardIO');
        if (el && typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(el).show();
            cargarProductosCRUD();
            if (perfilUsuarioActual?.rol === 'admin') cargarUsuariosAdmin();
        }
    };

    document.getElementById('btnAbrirDashboard')?.addEventListener('click', abrirDashboardIO);
    document.getElementById('btnPopoverDashboard')?.addEventListener('click', abrirDashboardIO);

    const abrirModalRegistroFerreteria = () => {
        popoverPerfil?.classList.add('d-none');
        const el = document.getElementById('modalRegistrarFerreteria');
        if (el && typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(el).show();
    };

    document.getElementById('btnAbrirRegistroFerreteria')?.addEventListener('click', abrirModalRegistroFerreteria);
    document.getElementById('btnPopoverRegFerreteria')?.addEventListener('click', abrirModalRegistroFerreteria);
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

    // Subpaneles colapsables del Omnibox (Origen y Pesos AHP)
    const panelOrigenOmnibox = document.getElementById('panelOrigenOmnibox');
    const btnToggleOrigen = document.getElementById('btnToggleOrigen');
    const btnToggleAHP = document.getElementById('btnToggleAHP');

    btnToggleOrigen?.addEventListener('click', () => {
        const oculto = panelOrigenOmnibox?.classList.contains('d-none');
        panelOrigenOmnibox?.classList.toggle('d-none', !oculto);
        btnToggleOrigen.classList.toggle('active', oculto);
    });

    document.getElementById('btnCerrarOrigenPanel')?.addEventListener('click', () => {
        panelOrigenOmnibox?.classList.add('d-none');
        btnToggleOrigen?.classList.remove('active');
    });

    document.getElementById('inputProducto')?.addEventListener('focus', () => {
        panelOrigenOmnibox?.classList.remove('d-none');
        btnToggleOrigen?.classList.add('active');
    });

    btnToggleAHP?.addEventListener('click', (e) => {
        e.preventDefault();
        const collapseAHP = document.getElementById('collapseAHP');
        if (collapseAHP && typeof bootstrap !== 'undefined') {
            const abierto = collapseAHP.classList.contains('show');
            bootstrap.Collapse.getOrCreateInstance(collapseAHP, { toggle: false }).toggle();
            btnToggleAHP.classList.toggle('active', !abierto);
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
        if (textoOrigen.includes("GPS") || textoOrigen.includes("Historial")) return ubicacionUsuario;
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
    // SINCRONIZACIÓN DE FAVORITOS (RN-08) Y FICHA DE FERRETERÍA 17/11/2026 16:24 pm
    // ---------------------------------------------------------------
    const actualizarBotonesFavoritoUI = () => {
        // 1. Botón de favorito en tarjeta flotante Top Pick AHP
        const btnTop = document.getElementById('btnFavoritoTop');
        if (btnTop && topFerreteriaActual) {
            const esFavTop = favoritosIds.has(Number(topFerreteriaActual.id_ferreteria));
            btnTop.classList.toggle('btn-favorito-activo', esFavTop);
            btnTop.classList.toggle('btn-outline-warning', !esFavTop);
            btnTop.title = esFavTop ? 'Quitar de favoritos' : 'Guardar ferretería en favoritos';
            btnTop.innerHTML = esFavTop
                ? `<i class="fa-solid fa-star"></i>`
                : `<i class="fa-regular fa-star"></i>`;
        }

        // 2. Botón de favorito dentro del Modal de Ficha de Ferretería
        const btnModal = document.getElementById('btnFavoritoModalFerr');
        if (btnModal && ferreteriaModalActual) {
            const esFavModal = favoritosIds.has(Number(ferreteriaModalActual.id_ferreteria));
            btnModal.classList.toggle('btn-favorito-activo', esFavModal);
            btnModal.classList.toggle('btn-outline-warning', !esFavModal);
            btnModal.innerHTML = esFavModal
                ? `<i class="fa-solid fa-star me-1"></i><span>Quitar de Favoritos</span>`
                : `<i class="fa-regular fa-star me-1"></i><span>Guardar</span>`;
        }

        // 3. Botones dentro de popups activos de Leaflet
        document.querySelectorAll('[data-popup-fav-id]').forEach(btn => {
            const id = Number(btn.getAttribute('data-popup-fav-id'));
            const esFav = favoritosIds.has(id);
            btn.className = esFav
                ? 'btn btn-sm btn-favorito-activo mt-2 w-100 py-1'
                : 'btn btn-sm btn-warning mt-2 w-100 py-1';
            btn.innerHTML = esFav
                ? `<i class="fa-solid fa-star me-1"></i>Quitar de Favoritos`
                : `<i class="fa-regular fa-star me-1"></i>Guardar Favorito`;
        });
    };

    window.toggleFavorito = async (idFerreteria) => {
        const idNum = Number(idFerreteria);
        if (!perfilUsuarioActual) {
            notificar('Inicia Sesión', 'Debes iniciar sesión para administrar tus ferreterías favoritas.', 'info');
            return;
        }

        const yaEsFavorito = favoritosIds.has(idNum);
        const method = yaEsFavorito ? 'DELETE' : 'POST';

        try {
            const res = await fetch(`/api/ahp/favoritos/${idNum}`, {
                method,
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'No se pudo actualizar favoritos');

            if (yaEsFavorito) {
                favoritosIds.delete(idNum);
            } else {
                favoritosIds.add(idNum);
            }

            actualizarBotonesFavoritoUI();
            notificar(
                yaEsFavorito ? 'Eliminado de Favoritos' : 'Guardado en Favoritos',
                data.mensaje || (yaEsFavorito ? 'Ferretería quitada de tu lista.' : 'Ferretería añadida a tu lista.'),
                'success'
            );
            cargarHistorialYFavoritos();
        } catch (err) {
            notificar('Favoritos', err.message, 'warning');
        }
    };

    // Mantener alias por compatibilidad
    window.agregarFavorito = window.toggleFavorito;

    document.getElementById('btnFavoritoTop')?.addEventListener('click', () => {
        if (topFerreteriaActual) window.toggleFavorito(topFerreteriaActual.id_ferreteria);
    });

    document.getElementById('btnFavoritoModalFerr')?.addEventListener('click', () => {
        if (ferreteriaModalActual) window.toggleFavorito(ferreteriaModalActual.id_ferreteria);
    });

    const renderizarListaCatalogoModal = (productos) => {
        const contenedor = document.getElementById('contenedorProductosFerreteria');
        if (!contenedor) return;

        if (!productos || productos.length === 0) {
            contenedor.innerHTML = `
                <div class="list-group-item bg-transparent text-muted small py-3 text-center">
                    Esta ferretería aún no tiene productos registrados en su catálogo.
                </div>`;
            return;
        }

        contenedor.innerHTML = productos.map(p => {
            const disponible = Number(p.stock_actual) > 0;
            const badgeStock = disponible
                ? `<span class="badge bg-success-subtle text-success border border-success-subtle">${p.stock_actual} un.</span>`
                : `<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Agotado</span>`;
            const subInfo = [p.categoria, p.marca].filter(Boolean).join(' • ');

            const payloadProd = encodeURIComponent(JSON.stringify(p));
            return `
                <div role="button" tabindex="0"
                    data-producto="${payloadProd}"
                    onclick="window.abrirDetalleProductoDesdeCatalogo(this)"
                    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.abrirDetalleProductoDesdeCatalogo(this);}"
                    title="Ver ficha técnica del producto"
                    class="list-group-item bg-transparent text-main py-2 px-3 catalogo-item-row d-flex justify-content-between align-items-center gap-2">
                    <div class="d-flex align-items-center gap-2 overflow-hidden">
                        ${renderizarMiniaturaProducto(p.foto_url, p.categoria, p.nombre)}
                        <div class="overflow-hidden">
                            <div class="fw-semibold small text-truncate">${escapeHtml(p.nombre)}</div>
                            ${subInfo ? `<div class="extra-small text-muted text-truncate">${escapeHtml(subInfo)}</div>` : ''}
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-shrink-0">
                        <span class="fw-bold text-success small">Bs. ${parseFloat(p.precio_bob).toFixed(2)}</span>
                        ${badgeStock}
                        <i class="fa-solid fa-chevron-right extra-small text-muted ms-1"></i>
                    </div>
                </div>
            `;
        }).join('');
    };

    document.getElementById('filtroCatalogoFerreteria')?.addEventListener('input', (e) => {
        const termino = e.target.value.trim().toLowerCase();
        const filtrados = !termino
            ? catalogoModalCache
            : catalogoModalCache.filter(p =>
                p.nombre.toLowerCase().includes(termino) ||
                (p.categoria && p.categoria.toLowerCase().includes(termino)) ||
                (p.marca && p.marca.toLowerCase().includes(termino))
            );
        renderizarListaCatalogoModal(filtrados);
    });

    const cargarCatalogoFerreteriaModal = async (idFerreteria) => {
        const seccion = document.getElementById('seccionCatalogoFerreteria');
        const contenedor = document.getElementById('contenedorProductosFerreteria');
        const btnCatalogo = document.getElementById('btnVerCatalogoCompleto');
        if (!seccion || !contenedor) return;

        seccion.classList.remove('d-none');
        if (btnCatalogo) {
            btnCatalogo.disabled = true;
            btnCatalogo.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-2"></i>Cargando Catálogo...`;
        }
        contenedor.innerHTML = `<div class="list-group-item bg-transparent text-muted small py-3 text-center"><i class="fa-solid fa-spinner fa-spin me-1"></i> Consultando inventario...</div>`;

        try {
            const res = await fetch(`/api/ahp/ferreterias/${idFerreteria}/catalogo`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'No se pudo cargar el catálogo de la ferretería');

            ferreteriaModalActual = data;
            catalogoModalCache = data.productos || [];

            document.getElementById('modalDetalleFerreteriaLabel').textContent = data.nombre;
            document.getElementById('detFerrDireccion').textContent = data.direccion;
            document.getElementById('detFerrReputacion').textContent = Number(data.reputacion).toFixed(2);
            document.getElementById('detFerrCanales').textContent = data.capacidad_canales_atencion ?? 1;
            document.getElementById('detFerrTotalProductos').textContent = data.total_productos ?? catalogoModalCache.length;

            const wqEl = document.getElementById('detFerrWq');
            if (wqEl) {
                wqEl.textContent = data.tiempo_espera_wq_min !== null && data.tiempo_espera_wq_min !== undefined
                    ? `${data.tiempo_espera_wq_min} min`
                    : 'Sin datos';
            }

            const filtroInput = document.getElementById('filtroCatalogoFerreteria');
            if (filtroInput) filtroInput.value = '';
            renderizarListaCatalogoModal(catalogoModalCache);
            actualizarBotonesFavoritoUI();
        } catch (err) {
            contenedor.innerHTML = `<div class="list-group-item bg-transparent text-danger small py-3 text-center">${escapeHtml(err.message)}</div>`;
        } finally {
            if (btnCatalogo) {
                btnCatalogo.disabled = false;
                btnCatalogo.innerHTML = `<i class="fa-solid fa-boxes-stacked me-2"></i>Actualizar Catálogo`;
            }
        }
    };

    document.getElementById('btnVerCatalogoCompleto')?.addEventListener('click', () => {
        if (ferreteriaModalActual?.id_ferreteria) {
            cargarCatalogoFerreteriaModal(ferreteriaModalActual.id_ferreteria);
        }
    });

    document.getElementById('btnTrazarRutaModalFerr')?.addEventListener('click', () => {
        if (!ferreteriaModalActual) return;
        const { latitud, longitud, nombre, tiempo_espera_wq_min } = ferreteriaModalActual;
        const modalEl = document.getElementById('modalDetalleFerreteria');
        if (modalEl && typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        }
        window.trazarRutaFerreteria(latitud, longitud, nombre, tiempo_espera_wq_min ?? null, 'driving-car');
    });

    window.abrirFichaFerreteria = async (idFerreteria, datosIniciales = null) => {
        const idNum = Number(idFerreteria);
        ferreteriaModalActual = datosIniciales ? { ...datosIniciales, id_ferreteria: idNum } : { id_ferreteria: idNum };
        catalogoModalCache = [];

        document.getElementById('modalDetalleFerreteriaLabel').textContent = datosIniciales?.nombre || 'Ficha de Ferretería';
        document.getElementById('detFerrDireccion').textContent = datosIniciales?.direccion || 'Cargando dirección...';
        document.getElementById('detFerrReputacion').textContent = datosIniciales?.reputacion ? Number(datosIniciales.reputacion).toFixed(2) : '5.00';
        document.getElementById('detFerrWq').textContent = 'Consultando...';
        document.getElementById('detFerrCanales').textContent = datosIniciales?.capacidad_canales_atencion || '1';
        document.getElementById('detFerrTotalProductos').textContent = '0';

        const seccionCat = document.getElementById('seccionCatalogoFerreteria');
        if (seccionCat) seccionCat.classList.add('d-none');

        const btnCat = document.getElementById('btnVerCatalogoCompleto');
        if (btnCat) {
            btnCat.disabled = false;
            btnCat.innerHTML = `<i class="fa-solid fa-boxes-stacked me-2"></i>Ver Catálogo Completo`;
        }

        actualizarBotonesFavoritoUI();

        const modalEl = document.getElementById('modalDetalleFerreteria');
        if (modalEl && typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }

        // Precargar metadatos reales de la ferretería (incluyendo Wq si existe)
        try {
            const res = await fetch(`/api/ahp/ferreterias/${idNum}/catalogo`);
            if (res.ok) {
                const data = await res.json();
                ferreteriaModalActual = data;
                catalogoModalCache = data.productos || [];
                document.getElementById('modalDetalleFerreteriaLabel').textContent = data.nombre;
                document.getElementById('detFerrDireccion').textContent = data.direccion;
                document.getElementById('detFerrReputacion').textContent = Number(data.reputacion).toFixed(2);
                document.getElementById('detFerrCanales').textContent = data.capacidad_canales_atencion ?? 1;
                document.getElementById('detFerrTotalProductos').textContent = data.total_productos ?? catalogoModalCache.length;
                document.getElementById('detFerrWq').textContent =
                    data.tiempo_espera_wq_min !== null && data.tiempo_espera_wq_min !== undefined
                        ? `${data.tiempo_espera_wq_min} min`
                        : 'Sin datos';
                actualizarBotonesFavoritoUI();
            }
        } catch (e) {
            console.warn('No se pudo precargar ficha de ferretería:', e);
        }
    };

    window.seleccionarFavoritoDrawer = (idFerreteria, lat, lng, nombre, direccion, reputacion) => {
        const drawerEl = document.getElementById('drawerGoogleMaps');
        if (drawerEl && typeof bootstrap !== 'undefined') {
            bootstrap.Offcanvas.getOrCreateInstance(drawerEl).hide();
        }

        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);

        if (map && !Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
            map.flyTo([latNum, lngNum], 16);
            L.popup()
                .setLatLng([latNum, lngNum])
                .setContent(`<strong>${escapeHtml(nombre)}</strong><br><small>${escapeHtml(direccion)}</small>`)
                .openOn(map);
        }

        window.abrirFichaFerreteria(idFerreteria, {
            id_ferreteria: idFerreteria,
            nombre,
            direccion,
            latitud: latNum,
            longitud: lngNum,
            reputacion: parseFloat(reputacion) || 5.0
        });
    };

    window.restaurarBusquedaHistorial = (textoBuscado, latUsuario, lngUsuario) => {
        const drawerEl = document.getElementById('drawerGoogleMaps');
        if (drawerEl && typeof bootstrap !== 'undefined') {
            bootstrap.Offcanvas.getOrCreateInstance(drawerEl).hide();
        }

        const latNum = parseFloat(latUsuario);
        const lngNum = parseFloat(lngUsuario);
        if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
            ubicacionUsuario = { lat: latNum, lng: lngNum };
            const inputOrig = document.getElementById('inputOrigen');
            if (inputOrig) {
                inputOrig.value = `Historial (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`;
            }
            actualizarMarcadorUsuario(latNum, lngNum, 'Origen restaurado del historial');
            if (map) map.flyTo([latNum, lngNum], 14);
        }

        const inputProd = document.getElementById('inputProducto');
        if (inputProd) inputProd.value = textoBuscado;
        document.getElementById('formBuscadorAHP')?.dispatchEvent(new Event('submit'));
    };

    window.eliminarHistorialItem = async (idBusqueda, event) => {
        if (event) event.stopPropagation();
        if (!perfilUsuarioActual) return;

        try {
            const res = await fetch(`/api/ahp/historial/${idBusqueda}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'No se pudo eliminar el registro');
            cargarHistorialYFavoritos();
        } catch (err) {
            notificar('Historial', err.message, 'warning');
        }
    };

    document.getElementById('btnVerCatalogoTop')?.addEventListener('click', () => {
        if (topFerreteriaActual) {
            window.abrirFichaFerreteria(topFerreteriaActual.id_ferreteria, topFerreteriaActual);
        }
    });

    // ---------------------------------------------------------------
    // 7. BÚSQUEDA MULTICRITERIO AHP + HISTORIAL Y FAVORITOS EN DRAWER
    // ---------------------------------------------------------------
    const formBuscador = document.getElementById('formBuscadorAHP');
    const cardTopResult = document.getElementById('cardTopResult');

    const colapsarSubpanelesOmnibox = () => {
        document.getElementById('panelOrigenOmnibox')?.classList.add('d-none');
        document.getElementById('btnToggleOrigen')?.classList.remove('active');
        const collapseAHP = document.getElementById('collapseAHP');
        if (collapseAHP?.classList.contains('show') && typeof bootstrap !== 'undefined') {
            bootstrap.Collapse.getOrCreateInstance(collapseAHP, { toggle: false }).hide();
            document.getElementById('btnToggleAHP')?.classList.remove('active');
        }
    };

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
            btnBuscar.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
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
            console.error('[OptiDecision] Error en búsqueda AHP:', error);
            notificar('Error en búsqueda AHP', error.message, 'warning');
        } finally {
            if (btnBuscar) {
                btnBuscar.disabled = false;
                btnBuscar.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i>`;
            } else {
                console.warn('[OptiDecision] No se encontró #btnBuscarAHP en el DOM al restaurarestado.');
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
        document.getElementById('topFerreteriaDireccion').innerHTML = `<i class="fa-solid fa-location-pin me-1"></i> ${escapeHtml(top.direccion)}`;
        document.getElementById('topProductoNombre').textContent = top.producto_nombre || 'Producto seleccionado';
        const topThumbEl = document.getElementById('topProductoThumb');
        if (topThumbEl) {
            topThumbEl.innerHTML = top.producto_foto_url
                ? `<img src="${escapeHtml(top.producto_foto_url)}" alt="${escapeHtml(top.producto_nombre || '')}" class="product-thumb-img">`
                : `<i class="fa-solid ${obtenerIconoCategoria(top.producto_categoria, top.producto_nombre)}"></i>`;
        }
        document.getElementById('topPrecioBOB').textContent = `Bs. ${parseFloat(top.precio_bob).toFixed(2)}`;
        document.getElementById('topDistanciaKM').textContent = `${top.distancia_km} km`;
        document.getElementById('topReputacion').textContent = top.reputacion;
        document.getElementById('topStock').textContent = `${top.stock} un.`;

        const wqTopTexto = top.tiempo_espera_wq_min !== null && top.tiempo_espera_wq_min !== undefined
            ? `${top.tiempo_espera_wq_min} min`
            : 'Sin datos';
        const topColaWqEl = document.getElementById('topColaWq');
        const topEstadoColaEl = document.getElementById('topEstadoCola');
        if (topColaWqEl) topColaWqEl.textContent = wqTopTexto;
        if (topEstadoColaEl) topEstadoColaEl.textContent = top.estado_congestion || 'Sin datos de cola';

        actualizarBotonesFavoritoUI();
        cardTopResult?.classList.remove('d-none');
        if (window.innerWidth < 768) colapsarSubpanelesOmnibox();
        const puntosBounds = [[ubicacionUsuario.lat, ubicacionUsuario.lng]];

        data.ferreterias.forEach((f, idx) => {
            const color = idx === 0 ? '#F59E0B' : '#0EA5E9';
            const esFav = favoritosIds.has(Number(f.id_ferreteria));
            const wqPopup = f.tiempo_espera_wq_min !== null && f.tiempo_espera_wq_min !== undefined
                ? `${f.tiempo_espera_wq_min} min (${escapeHtml(f.estado_congestion || '')})`
                : 'Sin datos de cola';
            const wqParam = f.tiempo_espera_wq_min !== null && f.tiempo_espera_wq_min !== undefined
                ? Number(f.tiempo_espera_wq_min)
                : 'null';

            const markerIcon = L.divIcon({
                className: 'ferreteria-marker',
                html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);"><i class="fa-solid fa-store"></i></div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const marker = L.marker([f.latitud, f.longitud], { icon: markerIcon })
                .addTo(markersLayer)
                .bindPopup(`
                    <div style="color: #0F172A; min-width: 205px;">
                        <strong style="color: ${color};">${escapeHtml(f.nombre)}</strong><br>
                        <small>${escapeHtml(f.direccion)}</small><br>
                        <strong style="color: #10B981;">Bs. ${parseFloat(f.precio_bob).toFixed(2)}</strong> | Stock: ${f.stock} un.<br>
                        <small style="color: #0284C7;"><i class="fa-solid fa-users-line"></i> Espera Wq: ${wqPopup}</small><br>
                        <button class="btn btn-sm btn-primary mt-2 w-100 py-1"
                            onclick="window.trazarRutaFerreteria(${Number(f.latitud)}, ${Number(f.longitud)}, ${escapeHtml(JSON.stringify(f.nombre))}, ${wqParam}, 'driving-car')">
                            <i class="fa-solid fa-route me-1"></i>Trazar Ruta
                        </button>
                        <button class="btn btn-sm ${esFav ? 'btn-favorito-activo' : 'btn-warning'} mt-1 w-100 py-1"
                            data-popup-fav-id="${f.id_ferreteria}"
                            onclick="window.toggleFavorito(${f.id_ferreteria})">
                            <i class="${esFav ? 'fa-solid' : 'fa-regular'} fa-star me-1"></i>${esFav ? 'Quitar de Favoritos' : 'Guardar Favorito'}
                        </button>
                        <button class="btn btn-sm btn-outline-secondary mt-1 w-100 py-1"
                            data-producto="${encodeURIComponent(JSON.stringify(f))}"
                            onclick="window.abrirDetalleProductoDesdeAHP(this)">
                            <i class="fa-solid fa-circle-info me-1"></i>Ver Producto
                        </button>
                        <button class="btn btn-sm btn-outline-primary mt-1 w-100 py-1"
                            onclick="window.abrirFichaFerreteria(${f.id_ferreteria})">
                            <i class="fa-solid fa-boxes-stacked me-1"></i>Ver Catálogo
                        </button>
                    </div>
                `);

            marker.on('popupopen', actualizarBotonesFavoritoUI);

            if (idx === 0) marker.openPopup();
            puntosBounds.push([f.latitud, f.longitud]);
        });

        if (map) map.fitBounds(puntosBounds, { padding: [50, 50] });
    };

    const seleccionarRutaAlternativa = (indiceSeleccionado) => {
        if (!rutasLayer || !rutasDisponiblesCache.length || !rutaActivaConfig) return;
        rutasLayer.clearLayers();

        // Dibujar primero las rutas no seleccionadas en gris punteado (#94A3B8)
        rutasDisponiblesCache.forEach((r) => {
            if (r.indice === indiceSeleccionado || !r.geometry) return;
            const capaAlt = L.geoJSON(r.geometry, {
                style: {
                    color: '#94A3B8',
                    weight: 5,
                    opacity: 0.75,
                    dashArray: '8, 8'
                }
            }).addTo(rutasLayer);
            capaAlt.on('click', () => seleccionarRutaAlternativa(r.indice));
        });

        // Dibujar la ruta seleccionada encima en azul sólido (#0EA5E9)
        const rutaElegida = rutasDisponiblesCache.find(r => r.indice === indiceSeleccionado) || rutasDisponiblesCache[0];
        if (rutaElegida?.geometry) {
            const capaPrincipal = L.geoJSON(rutaElegida.geometry, {
                style: {
                    color: '#0EA5E9',
                    weight: 6,
                    opacity: 0.95
                }
            }).addTo(rutasLayer);
            if (map) map.fitBounds(capaPrincipal.getBounds(), { padding: [55, 55] });
        }

        // Actualizar botones de alternativas y cálculo logístico total: Viaje + Wq = Total
        const contAlt = document.getElementById('contenedorAlternativasRuta');
        if (contAlt) {
            contAlt.innerHTML = rutasDisponiblesCache.map(r => `
                <button type="button"
                    class="btn btn-sm ${r.indice === rutaElegida.indice ? 'btn-primary' : 'btn-outline-secondary'} extra-small py-0 px-2"
                    onclick="window.seleccionarRutaIndex(${r.indice})">
                    ${escapeHtml(r.etiqueta)} (${r.duracion_min} min)
                </button>
            `).join('');
        }

        const wqMin = rutaActivaConfig.wqMin !== null && rutaActivaConfig.wqMin !== undefined
            ? Number(rutaActivaConfig.wqMin)
            : 0.0;
        const totalMin = (Number(rutaElegida.duracion_min) + wqMin).toFixed(1);

        document.getElementById('rutaViajeResumen').textContent = `${rutaElegida.distancia_km} km (${rutaElegida.duracion_min} min)`;
        document.getElementById('rutaEsperaWq').textContent = rutaActivaConfig.wqMin !== null && rutaActivaConfig.wqMin !== undefined
            ? `${wqMin.toFixed(1)} min`
            : 'Sin datos (0 min)';
        document.getElementById('rutaTiempoTotal').textContent = `${totalMin} min`;
    };

    window.seleccionarRutaIndex = seleccionarRutaAlternativa;

    window.trazarRutaFerreteria = async (destinoLat, destinoLng, nombreFerreteria, wqMin = null, modo = 'driving-car') => {
        rutaActivaConfig = {
            destinoLat: Number(destinoLat),
            destinoLng: Number(destinoLng),
            nombreFerreteria,
            wqMin,
            modo
        };

        document.querySelectorAll('.route-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-modo') === modo);
        });

        const panel = document.getElementById('panelNavegacionRuta');
        document.getElementById('rutaDestinoNombre').textContent = nombreFerreteria;
        document.getElementById('rutaViajeResumen').textContent = 'Calculando ruta...';
        panel?.classList.remove('d-none');

        try {
            const params = new URLSearchParams({
                origen_lat: String(ubicacionUsuario.lat),
                origen_lng: String(ubicacionUsuario.lng),
                destino_lat: String(destinoLat),
                destino_lng: String(destinoLng),
                modo
            });
            const res = await fetch(`/api/ahp/ruta?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'No se pudo trazar la ruta.');

            rutasDisponiblesCache = data.rutas || [];
            seleccionarRutaAlternativa(0);
        } catch (err) {
            notificar('Enrutamiento Vial', err.message, 'warning');
        }
    };

    document.getElementById('btnTrazarRutaTop')?.addEventListener('click', () => {
        if (!topFerreteriaActual) return;
        window.trazarRutaFerreteria(
            topFerreteriaActual.latitud,
            topFerreteriaActual.longitud,
            topFerreteriaActual.nombre,
            topFerreteriaActual.tiempo_espera_wq_min ?? null,
            'driving-car'
        );
    });

    document.querySelectorAll('.route-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!rutaActivaConfig) return;
            const nuevoModo = btn.getAttribute('data-modo') || 'driving-car';
            window.trazarRutaFerreteria(
                rutaActivaConfig.destinoLat,
                rutaActivaConfig.destinoLng,
                rutaActivaConfig.nombreFerreteria,
                rutaActivaConfig.wqMin,
                nuevoModo
            );
        });
    });

    document.getElementById('btnCerrarPanelRuta')?.addEventListener('click', () => {
        document.getElementById('panelNavegacionRuta')?.classList.add('d-none');
        if (rutasLayer) rutasLayer.clearLayers();
    });

    const cargarHistorialYFavoritos = async () => {
        if (!perfilUsuarioActual) {
            favoritosIds = new Set();
            actualizarBotonesFavoritoUI();
            return;
        }
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
                        <div class="list-group-item bg-transparent text-main small py-2 px-3 drawer-item-row d-flex justify-content-between align-items-center gap-2"
                            role="button"
                            onclick="window.restaurarBusquedaHistorial(${escapeHtml(JSON.stringify(h.texto_buscado))}, ${Number(h.latitud_usuario)}, ${Number(h.longitud_usuario)})">
                            <div class="overflow-hidden">
                                <div class="fw-semibold text-truncate"><i class="fa-solid fa-magnifying-glass text-primary me-2"></i>${escapeHtml(h.texto_buscado)}</div>
                                <span class="extra-small text-muted d-block">${new Date(h.fecha_busqueda).toLocaleString()}</span>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-danger border-0 flex-shrink-0"
                                title="Eliminar búsqueda del historial"
                                onclick="window.eliminarHistorialItem(${h.id_busqueda}, event)">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    `).join('');
            }

            if (resFav.ok) {
                const favoritos = await resFav.json();
                favoritosIds = new Set(favoritos.map(f => Number(f.id_ferreteria)));
                actualizarBotonesFavoritoUI();

                if (listaFav) {
                    listaFav.innerHTML = favoritos.length === 0
                        ? `<div class="list-group-item bg-transparent text-muted small py-3 text-center">No tienes ferreterías favoritas guardadas.</div>`
                        : favoritos.map(f => `
                            <div class="list-group-item bg-transparent text-main small py-2 px-3 drawer-item-row d-flex justify-content-between align-items-center gap-2"
                                role="button"
                                onclick="window.seleccionarFavoritoDrawer(${f.id_ferreteria}, ${Number(f.latitud)}, ${Number(f.longitud)}, ${escapeHtml(JSON.stringify(f.nombre))}, ${escapeHtml(JSON.stringify(f.direccion))}, ${Number(f.reputacion || 5)})">
                                <div class="overflow-hidden">
                                    <div class="fw-semibold text-truncate"><i class="fa-solid fa-star text-warning me-1"></i> ${escapeHtml(f.nombre)}</div>
                                    <span class="extra-small text-muted d-block text-truncate">${escapeHtml(f.direccion)}</span>
                                </div>
                                <button type="button" class="btn btn-sm btn-outline-warning border-0 flex-shrink-0"
                                    title="Quitar de favoritos"
                                    onclick="event.stopPropagation(); window.toggleFavorito(${f.id_ferreteria});">
                                    <i class="fa-solid fa-trash-can text-danger"></i>
                                </button>
                            </div>
                        `).join('');
                }
            }
        } catch (e) {
            console.warn('Historial/Favoritos pendientes de consulta:', e);
        }
    };

    document.getElementById('drawerGoogleMaps')?.addEventListener('show.bs.offcanvas', cargarHistorialYFavoritos);

    // ---------------------------------------------------------------
    // 8. GOOGLE OAUTH2 (AUTHORIZATION CODE FLOW) + JWT + ROLES
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
                notificar('Acceso Correcto', `Bienvenido ${perfil.username} (${perfil.rol.toUpperCase()}).`, 'success');
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

        const btnCuenta = document.getElementById('btnEsfericoCuenta');
        const popover = document.getElementById('popoverPerfilCuenta');

        if (btnCuenta) {
            btnCuenta.classList.toggle('authenticated', autenticado);
            if (autenticado) {
                const inicial = (perfil.username || perfil.email || 'U').charAt(0).toUpperCase();
                btnCuenta.innerHTML = `<span>${inicial}</span>`;
                btnCuenta.title = `${perfil.username} (${rol})`;
            } else {
                btnCuenta.innerHTML = `<i class="fa-solid fa-user"></i>`;
                btnCuenta.title = 'Iniciar Sesión / Crear Cuenta';
                popover?.classList.add('d-none');
            }
        }

        if (autenticado) {
            const inicial = (perfil.username || perfil.email || 'U').charAt(0).toUpperCase();
            document.getElementById('popoverUserInitial').textContent = inicial;
            document.getElementById('popoverUserName').textContent = perfil.username || 'Usuario';
            document.getElementById('popoverUserEmail').textContent = perfil.email || '';
            document.getElementById('popoverUserRole').textContent = rol;

            const ferrInfo = document.getElementById('popoverUserFerreteria');
            if (ferrInfo) {
                if (perfil.nombre_ferreteria) {
                    ferrInfo.classList.remove('d-none');
                    ferrInfo.querySelector('span').textContent = perfil.nombre_ferreteria;
                } else {
                    ferrInfo.classList.add('d-none');
                }
            }
            cargarHistorialYFavoritos();
        } else {
            favoritosIds = new Set();
            actualizarBotonesFavoritoUI();
        }

        const esGestor = autenticado && (rol === 'ferretero' || rol === 'admin');
        const puedeRegistrarFerreteria = autenticado && (rol === 'admin' || !perfil.id_ferreteria);

        document.getElementById('btnAbrirDashboard')?.classList.toggle('d-none', !esGestor);
        document.getElementById('btnPopoverDashboard')?.classList.toggle('d-none', !esGestor);
        document.getElementById('btnAbrirRegistroFerreteria')?.classList.toggle('d-none', !puedeRegistrarFerreteria);
        document.getElementById('btnPopoverRegFerreteria')?.classList.toggle('d-none', !puedeRegistrarFerreteria);
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
        document.getElementById('modalLoginAuthLabel').textContent = isRegisterMode ? 'Crear cuenta ferretera' : 'Iniciar sesión en Opti';
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
            notificar('Acceso correcto', `Bienvenido ${perfil.username}.`, 'success');
        } catch (err) {
            notificar('Error de Autenticación', err.message, 'error');
        }
    });

    // ---------------------------------------------------------------
    // 9. REGISTRO DE FERRETERÍA Y GESTIÓN ADMIN DE ROLES
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

    document.getElementById('btnPlantillaCatalogoAdmin')?.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/auth/ferreterias/plantilla-catalogo', {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('No se pudo generar la plantilla desde la base de datos');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plantilla_ferreterias_cbba.csv';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            notificar('Error en Plantilla', err.message, 'error');
        }
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
                    <td class="fw-medium">${escapeHtml(u.username)}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td>${u.nombre_ferreteria ? escapeHtml(u.nombre_ferreteria) : '<span class="text-muted">Sin ferretería</span>'}</td>
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
    // 9.1 FICHA DETALLE DE PRODUCTO + FALLBACK VECTORIAL + ZOOM 2X
    // ---------------------------------------------------------------
    let productoModalDestinoActual = null;

    const generarFallbackVectorialCategoria = (categoria = '', nombre = '') => {
        const texto = `${categoria} ${nombre}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        let etiqueta = categoria || 'Ferretería General';
        let svgIcon = `
            <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="46" stroke="#0EA5E9" stroke-width="2" stroke-dasharray="6 4" opacity="0.45"/>
                <polygon points="60,24 91,42 91,78 60,96 29,78 29,42" fill="#1E293B" stroke="#0EA5E9" stroke-width="3.5"/>
                <circle cx="60" cy="60" r="14" fill="#0F172A" stroke="#38BDF8" stroke-width="3.5"/>
            </svg>`;

        if (/herramienta|martillo|llave|alicate|taladro|destornillador|sierra/.test(texto)) {
            etiqueta = categoria || 'Herramientas';
            svgIcon = `
                <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="46" stroke="#0EA5E9" stroke-width="2" stroke-dasharray="6 4" opacity="0.45"/>
                    <path d="M77 27a16 16 0 0 0-20 20L31 73a6 6 0 0 0 8 8l26-26a16 16 0 0 0 20-20l-9 9-7-2-2-7 10-8Z" fill="#1E293B" stroke="#F59E0B" stroke-width="3.5" stroke-linejoin="round"/>
                    <path d="M35 34l14 14m23 23l15 15" stroke="#38BDF8" stroke-width="4" stroke-linecap="round"/>
                </svg>`;
        } else if (/electr|cable|foco|led|interruptor|enchufe|breaker|luz/.test(texto)) {
            etiqueta = categoria || 'Material Eléctrico';
            svgIcon = `
                <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="46" stroke="#38BDF8" stroke-width="2" stroke-dasharray="6 4" opacity="0.45"/>
                    <polygon points="66,22 36,64 58,64 52,98 84,54 62,54" fill="#1E293B" stroke="#FACC15" stroke-width="3.5" stroke-linejoin="round"/>
                </svg>`;
        } else if (/plomeria|tubo|pvc|grifo|llave de paso|valvula|agua|sanitar/.test(texto)) {
            etiqueta = categoria || 'Plomería y Gasfitería';
            svgIcon = `
                <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="46" stroke="#38BDF8" stroke-width="2" stroke-dasharray="6 4" opacity="0.45"/>
                    <path d="M26 52h26v-12h16v12h26v16H68v16H52V68H26V52Z" fill="#1E293B" stroke="#38BDF8" stroke-width="3.5" stroke-linejoin="round"/>
                    <line x1="44" y1="30" x2="76" y2="30" stroke="#F59E0B" stroke-width="4" stroke-linecap="round"/>
                    <line x1="60" y1="30" x2="60" y2="40" stroke="#F59E0B" stroke-width="4"/>
                </svg>`;
        } else if (/pintura|brocha|rodillo|esmalte|barniz|lija|sellador/.test(texto)) {
            etiqueta = categoria || 'Pinturas y Acabados';
            svgIcon = `
                <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="46" stroke="#A78BFA" stroke-width="2" stroke-dasharray="6 4" opacity="0.45"/>
                    <rect x="30" y="28" width="52" height="22" rx="5" fill="#1E293B" stroke="#0EA5E9" stroke-width="3.5"/>
                    <path d="M82 39h10v16L58 63v12" stroke="#94A3B8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <rect x="52" y="75" width="12" height="22" rx="3" fill="#F59E0B"/>
                </svg>`;
        } else if (/construc|cemento|fierro|clavo|tornillo|perno|yeso|arena/.test(texto)) {
            etiqueta = categoria || 'Construcción y Fijaciones';
            svgIcon = `
                <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="46" stroke="#0EA5E9" stroke-width="2" stroke-dasharray="6 4" opacity="0.45"/>
                    <rect x="26" y="64" width="32" height="18" rx="2" fill="#1E293B" stroke="#0EA5E9" stroke-width="3"/>
                    <rect x="62" y="64" width="32" height="18" rx="2" fill="#1E293B" stroke="#0EA5E9" stroke-width="3"/>
                    <rect x="44" y="42" width="32" height="18" rx="2" fill="#1E293B" stroke="#F59E0B" stroke-width="3"/>
                </svg>`;
        }

        return `
            <div class="detalle-fallback-svg-wrap text-center">
                ${svgIcon}
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle mt-2">${escapeHtml(etiqueta)}</span>
                <span class="extra-small text-muted mt-1">Sin fotografía registrada</span>
            </div>
        `;
    };

    const abrirDetalleProducto = (item, ferreteriaContexto = null) => {
        const modalEl = document.getElementById('modalDetalleProducto');
        if (!modalEl || !item) return;

        // Normaliza tanto objetos de búsqueda AHP (producto_*) como ítems de catálogo por tienda
        const nombreProd = item.producto_nombre || item.nombre || 'Producto';
        const descProd = (item.producto_descripcion ?? item.descripcion ?? '').trim();
        const fotoProd = (item.producto_foto_url ?? item.foto_url ?? '').trim();
        const catProd = item.producto_categoria || item.categoria || 'General';
        const marcaProd = item.producto_marca || item.marca || 'Marca estándar';
        const precioProd = parseFloat(item.precio_bob ?? 0);
        const stockProd = parseInt(item.stock_actual ?? item.stock ?? 0, 10);

        const ferrDestino = ferreteriaContexto || (item.latitud !== undefined ? {
            id_ferreteria: item.id_ferreteria,
            nombre: item.nombre,
            latitud: item.latitud,
            longitud: item.longitud,
            tiempo_espera_wq_min: item.tiempo_espera_wq_min ?? null
        } : null);
        productoModalDestinoActual = ferrDestino;

        document.getElementById('detalleProdCategoriaBadge').textContent = catProd;
        const ferrSpan = document.querySelector('#detalleProdFerreteriaBadge span');
        if (ferrSpan) ferrSpan.textContent = ferrDestino?.nombre || 'Sucursal';

        document.getElementById('detalleProdMarca').textContent = marcaProd;
        document.getElementById('detalleProdNombre').textContent = nombreProd;
        document.getElementById('detalleProdPrecio').textContent = `Bs. ${precioProd.toFixed(2)}`;

        const stockBadgeEl = document.getElementById('detalleProdStockBadge');
        if (stockProd > 5) {
            stockBadgeEl.innerHTML = `<span class="badge bg-success-subtle text-success border border-success-subtle">Disponible (${stockProd} un.)</span>`;
        } else if (stockProd > 0) {
            stockBadgeEl.innerHTML = `<span class="badge bg-warning-subtle text-warning border border-warning-subtle">Últimas unidades (${stockProd} un.)</span>`;
        } else {
            stockBadgeEl.innerHTML = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Agotado</span>`;
        }

        document.getElementById('detalleProdDescripcion').textContent =
            descProd || 'Sin especificaciones técnicas adicionales registradas para este artículo.';

        const btnRuta = document.getElementById('btnComoLlegarProducto');
        if (btnRuta) {
            btnRuta.disabled = !ferrDestino || ferrDestino.latitud === undefined;
        }

        const visualBox = document.getElementById('detalleProdVisualBox');
        const zoomHint = document.getElementById('detalleProdZoomHint');
        const btnZoom = document.getElementById('btnAbrirZoomDetalle');

        if (fotoProd) {
            visualBox.classList.add('has-photo');
            visualBox.innerHTML = `<img src="${escapeHtml(fotoProd)}" alt="${escapeHtml(nombreProd)}" class="detalle-prod-img">`;
            zoomHint?.classList.remove('d-none');
            btnZoom?.classList.remove('d-none');

            const dispararZoom = () => abrirZoomImagen(fotoProd, nombreProd);
            visualBox.onclick = dispararZoom;
            if (btnZoom) btnZoom.onclick = dispararZoom;
        } else {
            visualBox.classList.remove('has-photo');
            visualBox.innerHTML = generarFallbackVectorialCategoria(catProd, nombreProd);
            visualBox.onclick = null;
            zoomHint?.classList.add('d-none');
            btnZoom?.classList.add('d-none');
        }

        if (typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    };

    window.abrirDetalleProductoDesdeCatalogo = (el) => {
        const raw = el?.getAttribute('data-producto');
        if (!raw) return;
        const prod = JSON.parse(decodeURIComponent(raw));
        abrirDetalleProducto(prod, ferreteriaModalActual);
    };

    window.abrirDetalleProductoDesdeAHP = (el) => {
        const raw = el?.getAttribute('data-producto');
        if (!raw) return;
        const item = JSON.parse(decodeURIComponent(raw));
        abrirDetalleProducto(item, null);
    };

    document.getElementById('btnVerProductoTop')?.addEventListener('click', () => {
        if (topFerreteriaActual) abrirDetalleProducto(topFerreteriaActual, null);
    });

    document.getElementById('btnComoLlegarProducto')?.addEventListener('click', () => {
        if (!productoModalDestinoActual) return;
        const { latitud, longitud, nombre, tiempo_espera_wq_min } = productoModalDestinoActual;

        ['modalDetalleProducto', 'modalDetalleFerreteria'].forEach(id => {
            const mEl = document.getElementById(id);
            if (mEl && typeof bootstrap !== 'undefined') {
                bootstrap.Modal.getInstance(mEl)?.hide();
            }
        });

        window.trazarRutaFerreteria(latitud, longitud, nombre, tiempo_espera_wq_min ?? null, 'driving-car');
    });

    const abrirZoomImagen = (url, titulo = 'Vista ampliada') => {
        const modalZoomEl = document.getElementById('modalZoomImagen');
        const viewport = document.getElementById('zoomViewport');
        const imgTarget = document.getElementById('zoomImgTarget');
        const badgeNivel = document.getElementById('zoomNivelBadge');
        if (!modalZoomEl || !viewport || !imgTarget) return;

        document.getElementById('zoomImagenTitulo').textContent = titulo;
        imgTarget.src = url;
        imgTarget.style.transformOrigin = '50% 50%';
        viewport.classList.add('is-zoomed');
        if (badgeNivel) badgeNivel.textContent = '2.0x';

        if (typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(modalZoomEl).show();
            setTimeout(() => {
                const backdrops = document.querySelectorAll('.modal-backdrop');
                if (backdrops.length > 1) {
                    backdrops[backdrops.length - 1].style.zIndex = '1060';
                }
            }, 50);
        }
    };

    (() => {
        const viewport = document.getElementById('zoomViewport');
        const imgTarget = document.getElementById('zoomImgTarget');
        const btnToggle = document.getElementById('btnToggleZoomNivel');
        const badgeNivel = document.getElementById('zoomNivelBadge');
        if (!viewport || !imgTarget) return;

        const actualizarOrigen = (clientX, clientY) => {
            if (!viewport.classList.contains('is-zoomed')) return;
            const rect = viewport.getBoundingClientRect();
            const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
            const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
            imgTarget.style.transformOrigin = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
        };

        const alternarZoom = () => {
            const activo = viewport.classList.toggle('is-zoomed');
            if (!activo) imgTarget.style.transformOrigin = '50% 50%';
            if (badgeNivel) badgeNivel.textContent = activo ? '2.0x' : '1.0x';
        };

        viewport.addEventListener('mousemove', (e) => actualizarOrigen(e.clientX, e.clientY));
        viewport.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                actualizarOrigen(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
        viewport.addEventListener('click', alternarZoom);
        btnToggle?.addEventListener('click', alternarZoom);
    })();

    // ---------------------------------------------------------------
    // 10. CRUD CATÁLOGO FERRETERO + IMPORTADOR CSV + MULTIMEDIA CLOUDINARY
    // ---------------------------------------------------------------
    const cardFormProducto = document.getElementById('cardFormProducto');
    const formProductoCRUD = document.getElementById('formProductoCRUD');

    const actualizarPreviewFotoCRUD = (fotoUrl, nombre = '') => {
        const preview = document.getElementById('previewProdFoto');
        if (!preview) return;
        if (fotoUrl && fotoUrl.trim() !== '') {
            preview.innerHTML = `<img src="${escapeHtml(fotoUrl)}" alt="${escapeHtml(nombre)}" class="product-thumb-img">`;
        } else {
            preview.innerHTML = `<i class="fa-solid ${obtenerIconoCategoria('', nombre)}"></i>`;
        }
    };

    document.getElementById('btnToggleFormProducto')?.addEventListener('click', () => {
        formProductoCRUD?.reset();
        document.getElementById('prodEditId').value = '';
        document.getElementById('prodFotoUrl').value = '';
        actualizarPreviewFotoCRUD('');
        cardFormProducto?.classList.toggle('d-none');
    });

    document.getElementById('btnCancelarProducto')?.addEventListener('click', () => {
        cardFormProducto?.classList.add('d-none');
    });

    document.getElementById('btnLimpiarProdFoto')?.addEventListener('click', () => {
        document.getElementById('prodFotoUrl').value = '';
        const inputFoto = document.getElementById('inputProdFoto');
        if (inputFoto) inputFoto.value = '';
        actualizarPreviewFotoCRUD('', document.getElementById('prodNombre')?.value || '');
    });

    document.getElementById('inputProdFoto')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const btnGuardar = document.getElementById('btnGuardarProducto');
        const preview = document.getElementById('previewProdFoto');
        if (btnGuardar) btnGuardar.disabled = true;
        if (preview) preview.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

        const formData = new FormData();
        formData.append('archivo', file);

        try {
            const res = await fetch('/api/productos/subir-imagen', {
                method: 'POST',
                headers: getAuthHeaders(false),
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'No se pudo subir la imagen');

            document.getElementById('prodFotoUrl').value = data.foto_url;
            actualizarPreviewFotoCRUD(data.foto_url, document.getElementById('prodNombre')?.value || '');
            notificar('Imagen Cargada', 'Fotografía subida correctamente a Cloudinary.', 'success');
        } catch (err) {
            actualizarPreviewFotoCRUD(document.getElementById('prodFotoUrl')?.value || '');
            notificar('Error al Subir Imagen', err.message, 'error');
        } finally {
            if (btnGuardar) btnGuardar.disabled = false;
        }
    });

    document.getElementById('inputFotosLote')?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const formData = new FormData();
        files.forEach(file => formData.append('archivos', file));

        try {
            const res = await fetch('/api/productos/subir-imagenes-lote', {
                method: 'POST',
                headers: getAuthHeaders(false),
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al procesar el lote de fotografías');

            let detalle = `${data.total_vinculadas} fotografía(s) vinculadas automáticamente.`;
            if (data.total_no_emparejadas > 0) {
                detalle += ` Sin coincidencia (${data.total_no_emparejadas}): ${data.no_emparejadas.join(', ')}.`;
            }

            notificar(
                'Carga Multimedia por Lote',
                detalle,
                data.total_vinculadas > 0 ? 'success' : 'warning'
            );
            cargarProductosCRUD();
        } catch (err) {
            notificar('Error en Lote de Fotos', err.message, 'error');
        } finally {
            e.target.value = '';
        }
    });

    document.getElementById('btnDescargarPlantillaCSV')?.addEventListener('click', () => {
        const encabezado = "nombre,precio_bob,stock_actual,demanda_anual_D,costo_pedido_K,costo_mantenimiento_H,tiempo_entrega_dias_L,stock_seguridad_SS,descripcion,foto_url\n";
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
            stock_seguridad_SS: parseInt(document.getElementById('prodSS').value || 10, 10),
            descripcion: document.getElementById('prodDescripcion')?.value.trim() || null,
            foto_url: document.getElementById('prodFotoUrl')?.value.trim() || null
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
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            ${renderizarMiniaturaProducto(p.foto_url, p.categoria, p.nombre)}
                            <div class="overflow-hidden">
                                <div class="fw-medium text-truncate" style="max-width: 220px;">${escapeHtml(p.nombre)}</div>
                                ${p.descripcion ? `<div class="extra-small text-muted text-truncate" style="max-width: 220px;">${escapeHtml(p.descripcion)}</div>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="small text-muted">${escapeHtml(p.ferreteria_nombre || '-')}</td>
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
        document.getElementById('prodDescripcion').value = prod.descripcion || '';
        document.getElementById('prodFotoUrl').value = prod.foto_url || '';
        const inputFoto = document.getElementById('inputProdFoto');
        if (inputFoto) inputFoto.value = '';
        actualizarPreviewFotoCRUD(prod.foto_url || '', prod.nombre);
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
    // 11. CALCULADORAS IO2 (EOQ, COLAS M/M/1, MARKOV, DECISIONES)
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
                headers: getAuthHeaders(true),
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
                    <li class="mb-2"><strong>Sugerencia VME (Riesgo):</strong> <span class="text-success fw-bold">${escapeHtml(vmeOpt)}</span></li>
                    <li class="mb-1"><strong>Criterio Laplace:</strong> ${escapeHtml(laplaceOpt)}</li>
                    <li class="mb-1"><strong>Criterio Wald (Pesimista):</strong> ${escapeHtml(waldOpt)}</li>
                    <li class="mb-1"><strong>Criterio Savage (Minimax):</strong> ${escapeHtml(savageOpt)}</li>
                </ul>
                <div class="mt-2 pt-2 border-top extra-small text-muted">${escapeHtml(data.recomendacion_general)}</div>
            `;
            notificar('Evaluación Completada', 'Criterios procesados exitosamente.', 'success');
        } catch (err) {
            notificar('Error en Decisiones', err.message, 'error');
        }
    });
});
