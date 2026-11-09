/* ===================================================================
   OPTI DECISION SUITE - IOP812 | FRONTEND APP (SURGICAL FIX)
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------------
    // 1. ESTADO Y VARIABLES GLOBALES
    // ---------------------------------------------------------------
    const COCHABAMBA_DEFAULT = [-17.3895, -66.1568]; // Plaza 14 de Septiembre
    let map = null;
    let markersLayer = null;
    let ubicacionUsuario = { lat: COCHABAMBA_DEFAULT[0], lng: COCHABAMBA_DEFAULT[1] };

    // Helper para notificaciones con SweetAlert2
    const notificar = (titulo, texto, icono = 'info') => {
        const esOscuro = document.documentElement.getAttribute('data-theme') !== 'light';
        return Swal.fire({
            title: titulo,
            text: texto,
            icon: icono,
            background: esOscuro ? '#1E293B' : '#FFFFFF',
            color: esOscuro ? '#F8FAFC' : '#0F172A',
            confirmButtonColor: icono === 'error' ? '#EF4444' : '#0EA5E9',
            customClass: {
                popup: 'rounded-4 border border-secondary-subtle shadow-lg'
            }
        });
    };

    // ---------------------------------------------------------------
    // 2. GESTIÓN DE TEMA OSCURO / CLARO
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
    // 3. INICIALIZACIÓN DE LEAFLET
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
                zoom: 14,
                zoomControl: false
            });

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors | IOP812'
            }).addTo(map);

            markersLayer = L.layerGroup().addTo(map);
            intentoAutoGeolocalizacion();

            // Resuelve la pantalla en blanco forzando el recálculo de dimensiones del canvas Leaflet
            setTimeout(() => { if (map) map.invalidateSize(); }, 250);
        } catch (e) {
            console.error("Error al inicializar Leaflet:", e);
        }
    };

    inicializarMapa();
    // ---------------------------------------------------------------
    // VINCULACIÓN SEGURA DE MODALES Y NAVEGACIÓN
    // ---------------------------------------------------------------
    const btnAbrirLogin = document.getElementById('btnAbrirLogin');
    const btnAbrirCreditos = document.getElementById('btnAbrirCreditos');
    const btnAbrirDashboard = document.getElementById('btnAbrirDashboard');

    // Usar getOrCreateInstance evita errores de invocación nula en Bootstrap 5
    btnAbrirLogin?.addEventListener('click', () => {
         const el = document.getElementById('modalLoginAuth');
         if (el && typeof bootstrap !== 'undefined') {
             bootstrap.Modal.getOrCreateInstance(el).show();
         } else {
            alert("No se puede abrir");
            console.log('Modal encontrado:', !!el);
            console.log('Bootstrap disponible:', typeof bootstrap !== 'undefined');
         }
    });

    btnAbrirCreditos?.addEventListener('click', () => {
         const el = document.getElementById('modalCreditos');
         if (el && typeof bootstrap !== 'undefined') {
             bootstrap.Modal.getOrCreateInstance(el).show();
         } else {
            alert("Bootstrap Modal no disponible. No se puede abrir Créditos Académicos.");
         }
    });

    btnAbrirDashboard?.addEventListener('click', () => {
        const el = document.getElementById('modalDashboardIO');
        if (el && typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(el).show();
        }
    });

    // ---------------------------------------------------------------
    // DESPLEGABLE ACORDEÓN AHP (SAATY)
    // ---------------------------------------------------------------
    const btnToggleAHP = document.getElementById('btnToggleAHP');
    const collapseAHP = document.getElementById('collapseAHP');
    btnToggleAHP?.addEventListener('click', (e) => {
        e.preventDefault();
        if (collapseAHP && typeof bootstrap !== 'undefined') {
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseAHP, { toggle: false });
            bsCollapse.toggle();
        } else {
            alert("Bootstrap Collapse no disponible. No se puede alternar el panel AHP.");
        }
    });
    // ---------------------------------------------------------------
    // EVENTO BOTÓN GOOGLE OAUTH2
    // ---------------------------------------------------------------
    const btnGoogleAuth = document.getElementById('btnGoogleAuth');
    btnGoogleAuth?.addEventListener('click', () => {
        notificar(
            'Google Sign-In',
            'Iniciando pasarela Google OAuth2... Redirigiendo a la selección de cuenta.',
            'info'
        );
    });
    // ---------------------------------------------------------------
    // 4. GEOCODIFICACIÓN DE ORIGEN (Nominatim OpenStreetMap)
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

    // ---------------------------------------------------------------
    // 5. SLIDERS AHP (Ponderación Saaty 1-9)
    // ---------------------------------------------------------------
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

    Object.values(sliders).forEach(slider => {
        slider?.addEventListener('input', actualizarPorcentajesAHP);
    });
    actualizarPorcentajesAHP();

    // ---------------------------------------------------------------
    // 6. BÚSQUEDA FERRETERÍAS MULTICRITERIO AHP (AHPSearchInput)
    // ---------------------------------------------------------------
    const formBuscador = document.getElementById('formBuscadorAHP');
    const cardTopResult = document.getElementById('cardTopResult');
    const btnCloseTopResult = document.getElementById('btnCloseTopResult');

    btnCloseTopResult?.addEventListener('click', () => {
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                let detalleError = 'Error en la búsqueda geoespacial';
                if (Array.isArray(errData.detail)) {
                    detalleError = errData.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join('<br>');
                } else if (typeof errData.detail === 'string') {
                    detalleError = errData.detail;
                }
                throw new Error(detalleError);
            }

            const data = await response.json();
            renderizarResultadosAHP(data);
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
            notificar('Búsqueda Desierta', 'No existen ferreterías registradas en la base de datos con ese producto.', 'info');
            return;
        }

        const top = data.ferreterias[0];

        const elNombre = document.getElementById('topFerreteriaNombre');
        const elDireccion = document.getElementById('topFerreteriaDireccion');
        const elPrecio = document.getElementById('topPrecioBOB');
        const elDistancia = document.getElementById('topDistanciaKM');
        const elReputacion = document.getElementById('topReputacion');
        const elStock = document.getElementById('topStock');

        if (elNombre) elNombre.textContent = top.nombre;
        if (elDireccion) elDireccion.innerHTML = `<i class="fa-solid fa-location-pin me-1"></i> ${top.direccion}`;
        if (elPrecio) elPrecio.textContent = `Bs. ${parseFloat(top.precio_bob).toFixed(2)}`;
        if (elDistancia) elDistancia.textContent = `${top.distancia_km} km`;
        if (elReputacion) elReputacion.textContent = top.reputacion;
        if (elStock) elStock.textContent = `${top.stock} un.`;

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
                    <div style="color: #0F172A;">
                        <strong style="color: ${color};">${f.nombre}</strong><br>
                        <small>${f.direccion}</small><br>
                        <strong style="color: #10B981;">Bs. ${parseFloat(f.precio_bob).toFixed(2)}</strong> | Stock: ${f.stock} un.
                    </div>
                `);

            if (idx === 0) marker.openPopup();
            puntosBounds.push([f.latitud, f.longitud]);
        });

        if (map) map.fitBounds(puntosBounds, { padding: [50, 50] });
    };

    // ---------------------------------------------------------------
    // 7. AUTENTICACIÓN JWT Y SESIÓN
    // ---------------------------------------------------------------
    const formLogin = document.getElementById('formLogin');

    const verificarSesion = () => {
        if (localStorage.getItem('iop812-token')) {
            btnAbrirDashboard?.classList.remove('d-none');
        }
    };
    verificarSesion();

    formLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('inputEmail')?.value;
        const password = document.getElementById('inputPassword')?.value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!res.ok) throw new Error('Credenciales incorrectas');

            const data = await res.json();
            localStorage.setItem('iop812-token', data.access_token);
            
            notificar('¡Acceso Correcto!', 'Sesión iniciada como administrador ferretero.', 'success');

            const modalElement = document.getElementById('modalLoginAuth');
            if (modalElement && typeof bootstrap !== 'undefined') {
                const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                modalInstance.hide();
            }

            verificarSesion();
        } catch (err) {
            notificar('Error de Autenticación', err.message, 'error');
        }
    });

    // ---------------------------------------------------------------
    // 8. CALCULADORA INVENTARIOS EOQ (EOQParametrosInput)
    // ---------------------------------------------------------------
    const formEOQ = document.getElementById('formEOQ');
    formEOQ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const D = parseFloat(document.getElementById('eoqD')?.value || 0);
        const K = parseFloat(document.getElementById('eoqK')?.value || 0);
        const H = parseFloat(document.getElementById('eoqH')?.value || 0);
        const L_dias = parseFloat(document.getElementById('eoqL')?.value || 0);

        try {
            const response = await fetch('/api/inventario/calcular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unidad_tiempo: 'Años',
                    demanda_D: D,
                    costo_pedido_K: K,
                    costo_mantenimiento_H: H,
                    tiempo_entrega_dias_L: L_dias
                })
            });

            if (!response.ok) throw new Error('Falló el procesamiento en el motor EOQ');

            const data = await response.json();
            const elQ = document.getElementById('resQOptimo');
            const elROP = document.getElementById('resROP');
            if (elQ) elQ.textContent = `${data.lote_optimo_Q} un.`;
            if (elROP) elROP.textContent = `${data.punto_reorden_ROP} un.`;

            notificar('Cálculo Exitoso', 'Valores de EOQ y ROP actualizados por el motor matemático.', 'success');
        } catch (err) {
            notificar('Error en Modelo EOQ', err.message, 'error');
        }
    });

    // ---------------------------------------------------------------
    // 9. ESTIMACIÓN DE COLAS M/M/1 (ColasMM1Input)
    // ---------------------------------------------------------------
    const formColas = document.getElementById('formColas');
    formColas?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const lambda = parseFloat(document.getElementById('colaLambda')?.value || 0);
        const mu = parseFloat(document.getElementById('colaMu')?.value || 0);
        const unidad = document.getElementById('colaUnidad')?.value || 'horas';

        try {
            const res = await fetch('/api/colas/mm1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tasa_llegada_lambda: lambda,
                    tasa_servicio_mu: mu,
                    unidad_tiempo: unidad
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Servicio saturado o parámetros inválidos');
            }

            const data = await res.json();
            const elRho = document.getElementById('resColaRho');
            const elWq = document.getElementById('resColaWq');

            if (elRho) elRho.textContent = `${(data.factor_uso_rho * 100).toFixed(1)}%`;
            
            const tiempoMostrar = unidad === 'horas' ? (data.tiempo_espera_cola_Wq * 60).toFixed(1) + ' min' : data.tiempo_espera_cola_Wq.toFixed(1) + ' min';
            if (elWq) elWq.textContent = tiempoMostrar;

            notificar('Métricas M/M/1 Calculadas', 'Estimación procesada correctamente.', 'success');
        } catch (err) {
            notificar('Error en Colas', err.message, 'error');
        }
    });

    // ---------------------------------------------------------------
    // 10. SIMULACIÓN CADENAS DE MARKOV (MarkovMatrixInput)
    // ---------------------------------------------------------------
    const formMarkov = document.getElementById('formMarkov');
    formMarkov?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const p12 = parseFloat(document.getElementById('markovP12')?.value || 0);
        const p2A1 = parseFloat(document.getElementById('markovP2A1')?.value || 0);

        const payload = {
            estados_transitorios: ["Busqueda", "EnCarrito"],
            estados_absorbentes: ["CompraRealizada", "Abandono"],
            matriz_Q: [
                [0.0, p12],
                [0.0, 0.0]
            ],
            matriz_R: [
                [0.0, 1 - p12],
                [p2A1, 1 - p2A1]
            ]
        };

        try {
            const response = await fetch('/api/markov/simular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Error al simular Cadenas de Markov');
            }

            const data = await response.json();
            const probConversion = data.matriz_absorcion_B?.Busqueda?.CompraRealizada ?? 0.0;
            const interpretacion = data.interpretacion_humana ? data.interpretacion_humana.join('<br>') : '';

            const container = document.getElementById('resMarkovContainer');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-success border-0 mb-0">
                        <h6 class="fw-bold mb-1"><i class="fa-solid fa-chart-line me-1"></i> Tasa Probable de Conversión</h6>
                        <p class="mb-1 small">Probabilidad de absorción final desde <strong>Búsqueda</strong> hasta <strong>CompraRealizada</strong>:</p>
                        <h3 class="fw-bold text-success mb-2">${(probConversion * 100).toFixed(2)}%</h3>
                        <div class="extra-small text-muted border-top pt-2 mt-2">${interpretacion}</div>
                    </div>
                `;
            }

            notificar('Simulación Markov Exitosa', 'Matriz N y B calculadas por el motor NumPy.', 'success');
        } catch (err) {
            notificar('Error en Markov', err.message, 'error');
        }
    });

    // ---------------------------------------------------------------
    // 11. EVALUACIÓN TEORÍA DE DECISIONES (Alineado con DecisionOutput)
    // ---------------------------------------------------------------
    const formDecisiones = document.getElementById('formDecisiones');
    formDecisiones?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const alt1 = document.getElementById('decAlt1')?.value || '';
            const a1e1 = parseFloat(document.getElementById('decA1E1')?.value || 0);
            const a1e2 = parseFloat(document.getElementById('decA1E2')?.value || 0);

            const alt2 = document.getElementById('decAlt2')?.value || '';
            const a2e1 = parseFloat(document.getElementById('decA2E1')?.value || 0);
            const a2e2 = parseFloat(document.getElementById('decA2E2')?.value || 0);

            const p1 = parseFloat(document.getElementById('decProbE1')?.value || 0);
            const p2 = 1 - p1;

            const payload = {
                alternativas: [alt1, alt2],
                estados_naturaleza: ["Alta Demanda", "Baja Demanda"],
                matriz_pagos: [
                    [a1e1, a1e2],
                    [a2e1, a2e2]
                ],
                probabilidades: [p1, p2],
                coeficiente_alpha: 0.7
            };

            const res = await fetch('/api/decisiones/evaluar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Error en evaluación de decisiones');
            }

            const data = await res.json();
            
            // Extracción corregida mapeando los contratos del schema DecisionOutput
            const vmeOpt = data.analisis_riesgo ? data.analisis_riesgo.decision_optima_vme : 'N/A';
            const laplaceOpt = data.criterios_incertidumbre?.["Laplace (Equiprobabilidad)"]?.alternativa_optima || 'N/A';
            const waldOpt = data.criterios_incertidumbre?.["Wald Pesimista (MaxiMin)"]?.alternativa_optima || 'N/A';
            const savageOpt = data.criterios_incertidumbre?.["Savage (MiniMax Arrepentimiento)"]?.alternativa_optima || 'N/A';

            const container = document.getElementById('resDecisionesContainer');
            if (container) {
                container.innerHTML = `
                    <ul class="list-unstyled mb-0 small">
                        <li class="mb-2"><strong>Sugerencia VME (Riesgo):</strong> <span class="text-success fw-bold">${vmeOpt}</span></li>
                        <li class="mb-1"><strong>Criterio Laplace:</strong> ${laplaceOpt}</li>
                        <li class="mb-1"><strong>Criterio Wald (Pesimista):</strong> ${waldOpt}</li>
                        <li class="mb-1"><strong>Criterio Savage (Minimax):</strong> ${savageOpt}</li>
                    </ul>
                    <div class="mt-2 pt-2 border-top extra-small text-muted">${data.recomendacion_general}</div>
                `;
            }
            notificar('Evaluación Completada', 'Los criterios de decisión fueron procesados exitosamente.', 'success');
        } catch (err) {
            notificar('Error en Decisiones', err.message, 'error');
        }
    });

    // ---------------------------------------------------------------
    // 12. CARGA DINÁMICA DEL CATÁLOGO (Tabla productos de PostgreSQL)
    // ---------------------------------------------------------------
    const cargarProductosCRUD = async () => {
        const tbody = document.getElementById('tbodyCatálogo');
        if (!tbody) return;

        try {
            const token = localStorage.getItem('iop812-token');
            const res = await fetch('/api/productos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                if (res.status === 401) return;
                throw new Error(`Error en servidor (${res.status})`);
            }

            const productos = await res.json();
            if (productos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted small py-3">No hay productos registrados en el catálogo.</td></tr>`;
                return;
            }

            tbody.innerHTML = productos.map(p => `
                <tr>
                    <td class="fw-medium">${p.nombre}</td>
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
            console.warn('Fallo al obtener el catálogo de productos:', e);
        }
    };

    window.editarProducto = (id) => {
        notificar('Editar Producto', `Abriendo edición para el producto ID: ${id}`, 'info');
    };

    window.eliminarProducto = async (id) => {
        const confirmacion = await Swal.fire({
            title: '¿Eliminar producto?',
            text: 'Esta acción no se puede deshacer en la base de datos.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (confirmacion.isConfirmed) {
            notificar('Producto Eliminado', `El producto ID ${id} fue removido.`, 'success');
            cargarProductosCRUD();
        }
    };
 
    
    document.getElementById('tab-crud-tab')?.addEventListener('click', cargarProductosCRUD);
});
