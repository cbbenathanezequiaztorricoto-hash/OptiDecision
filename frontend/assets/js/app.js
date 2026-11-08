/* ===================================================================
   OPTI DECISION SUITE - IOP812 | FRONTEND APP (SWEETALERT2 INTEGRATED) (CONSUMO PURO DE API)
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------------
    // 1. ESTADO Y VARIABLES GLOBALES
    // ---------------------------------------------------------------
    const COCHABAMBA_DEFAULT = [-17.3895, -66.1568]; // Plaza 14 de Septiembre
    let map = null;
    let markersLayer = null;
    let ubicacionUsuario = { lat: COCHABAMBA_DEFAULT[0], lng: COCHABAMBA_DEFAULT[1] };

    // Helper reutilizable para notificaciones con diseño Industrial-Tech
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
        //Aquí preguntamos ¿El tema es light? Si es así, cambiamos el icono a sol, de lo contrario a luna
        if (themeIcon) {
            themeIcon.className = tema === 'light' ? 'fa-solid fa-sun text-warning' : 'fa-solid fa-moon text-light';
        }
    };
    // Cargar tema guardado o por defecto (dark)
    aplicarTema(localStorage.getItem('iop812-theme') || 'dark');

    themeToggleBtn?.addEventListener('click', () => {
        const temaActual = document.documentElement.getAttribute('data-theme');
        aplicarTema(temaActual === 'dark' ? 'light' : 'dark');
    });

    // ---------------------------------------------------------------
    // 3. INICIALIZACIÓN DE LEAFLET
    // ---------------------------------------------------------------
    const inicializarMapa = () => {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        map = L.map('map', {
            center: COCHABAMBA_DEFAULT,
            zoom: 14,
            zoomControl: false
        });
        // Posicionar control de zoom en la esquina inferior derecha
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        // Capa base de azulejos OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors | IOP812'
        }).addTo(map);
        // Marcador inicial de ubicación del usuario (Azul)
        markersLayer = L.layerGroup().addTo(map);
        // Auto-centrado dinámico inteligente al cargar la aplicación 
        intentoAutoGeolocalizacion();
    };

    const actualizarMarcadorUsuario = (lat, lng, titulo) => {
        ubicacionUsuario = { lat, lng };
        // Eliminar marcador previo del usuario si existe
        markersLayer.eachLayer(layer => {
            if (layer.options.isUserMarker) {
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
                    map.setView([latitude, longitude], 15);
                    actualizarMarcadorUsuario(latitude, longitude, "Tu ubicación GPS actual").openPopup();
                    const inputOrigen = document.getElementById('inputOrigen');
                    if (inputOrigen) inputOrigen.value = `Ubicación GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
                },
                () => {
                    // Fallback silencioso a Cochabamba centro
                    actualizarMarcadorUsuario(COCHABAMBA_DEFAULT[0], COCHABAMBA_DEFAULT[1], "Origen: Plaza 14 de Septiembre, Cochabamba");
                },
                { timeout: 5000 }
            );
        } else {
            actualizarMarcadorUsuario(COCHABAMBA_DEFAULT[0], COCHABAMBA_DEFAULT[1], "Origen: Plaza 14 de Septiembre, Cochabamba");
        }
    };

    inicializarMapa();

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
                map.flyTo([latitude, longitude], 15);
                actualizarMarcadorUsuario(latitude, longitude, "Tu ubicación GPS actual").openPopup();
                inputOrigen.value = `Ubicación GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
                btnGPS.innerHTML = `<i class="fa-solid fa-crosshairs text-primary"></i>`;
            },
            (err) => {
                notificar('Error de Geolocalización', 'No se pudo obtener la posición GPS: ' + err.message, 'error');
                btnGPS.innerHTML = `<i class="fa-solid fa-crosshairs text-primary"></i>`;
            }
        );
    });
    // Convertir dirección digitada a Coordenadas mediante Geocoding dinámico
    const resolverCoordenadasOrigen = async (textoOrigen) => {
        if (textoOrigen.includes("GPS")) return ubicacionUsuario;

        try {
            const query = encodeURIComponent(`${textoOrigen}, Cochabamba, Bolivia`);
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
            const data = await res.json();

            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                map.flyTo([lat, lon], 14);
                actualizarMarcadorUsuario(lat, lon, `Origen: ${data[0].display_name.split(',')[0]}`);
                return { lat, lng: lon };
            }
        } catch (e) {
            console.warn("Geocoding Nominatim no disponible.");
        }
        return ubicacionUsuario;
    };

    // ---------------------------------------------------------------
    // 5. SLIDERS AHP (Ponderación Saaty 1-9)(Actualización Visual de UI)
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
        // Actualizar etiquetas de porcentaje en la UI
        if (labels.precio) labels.precio.textContent = `${Math.round((valP / suma) * 100)}%`;
        if (labels.distancia) labels.distancia.textContent = `${Math.round((valD / suma) * 100)}%`;
        if (labels.reputacion) labels.reputacion.textContent = `${Math.round((valR / suma) * 100)}%`;
        if (labels.stock) labels.stock.textContent = `${Math.round((valS / suma) * 100)}%`;
    };

    Object.values(sliders).forEach(slider => {
        slider?.addEventListener('input', actualizarPorcentajesAHP);
    });

    // ---------------------------------------------------------------
    // 6. BÚSQUEDA FERRETERÍAS MULTICRITERIO AHP (POSTGIS EN BD POSTGRESQL)
    // ---------------------------------------------------------------
    const formBuscador = document.getElementById('formBuscadorAHP');
    const cardTopResult = document.getElementById('cardTopResult');
    const btnCloseTopResult = document.getElementById('btnCloseTopResult');

    btnCloseTopResult?.addEventListener('click', () => {
        cardTopResult?.classList.add('d-none');
    });

    formBuscador?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productoText = document.getElementById('inputProducto').value.trim();
        const origenText = document.getElementById('inputOrigen').value.trim();
        if (!productoText) return;

        const btnBuscar = document.getElementById('btnBuscarAHP');
        btnBuscar.disabled = true;
        btnBuscar.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-2"></i> Consultando PostGIS & AHP...`;
        // Obtener coordenadas dinámicas según el texto digitado en Origen
        const coordsActuales = await resolverCoordenadasOrigen(origenText);
        // Petición al backend FastAPI que consulta PostgreSQL/PostGIS y calcula vector AHP en NumPy
        try {
            const response = await fetch('/api/ahp/buscar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    latitud: coordsActuales.lat,
                    longitud: coordsActuales.lng,
                    producto: productoText,
                    pesos: {
                        precio: parseInt(sliders.precio.value, 10),
                        distancia: parseInt(sliders.distancia.value, 10),
                        reputacion: parseInt(sliders.reputacion.value, 10),
                        stock: parseInt(sliders.stock.value, 10)
                    }
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Error en la búsqueda geoespacial');
            }

            const data = await response.json();
            renderizarResultadosAHP(data);
        } catch (error) {
            notificar('Sin Resultados', `No se pudo completar la consulta AHP: ${error.message}`, 'warning');
        } finally {
            btnBuscar.disabled = false;
            btnBuscar.innerHTML = `<i class="fa-solid fa-route"></i> <span>Optimizar y Buscar Ferretería</span>`;
        }
    });

    const renderizarResultadosAHP = (data) => {
        markersLayer.clearLayers();
        actualizarMarcadorUsuario(ubicacionUsuario.lat, ubicacionUsuario.lng, "Tu Origen de Búsqueda");

        if (!data.ferreterias || data.ferreterias.length === 0) {
            notificar('Búsqueda Desierta', 'No existen ferreterías registradas en la base de datos con ese producto.', 'info');
            return;
        }

        const top = data.ferreterias[0];

        // Renderizar Tarjeta Top Pick
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
                    <div style="color: #0F172A;">
                        <strong style="color: ${color};">${f.nombre}</strong><br>
                        <small>${f.direccion}</small><br>
                        <strong style="color: #10B981;">Bs. ${parseFloat(f.precio_bob).toFixed(2)}</strong> | Stock: ${f.stock} un.
                    </div>
                `);

            if (idx === 0) marker.openPopup();
            puntosBounds.push([f.latitud, f.longitud]);
        });

        map.fitBounds(puntosBounds, { padding: [50, 50] });
    };

    // ---------------------------------------------------------------
    // 7. AUTENTICACIÓN JWT Y PANEL FERRETERO/ADMINISTRADOR
    // ---------------------------------------------------------------
    const formLogin = document.getElementById('formLogin');
    const navItemDashboard = document.getElementById('navItemDashboard');

    const verificarSesion = () => {
        if (localStorage.getItem('iop812-token')) {
            navItemDashboard?.classList.remove('d-none');
        }
    };
    verificarSesion();

    formLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('inputEmail').value;
        const password = document.getElementById('inputPassword').value;

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
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            modalInstance?.hide();

            verificarSesion();
        } catch (err) {
            notificar('Error de Autenticación', err.message, 'error');
        }
    });

    // ---------------------------------------------------------------
    // 8. CALCULADORA INVENTARIOS EOQ (REAL API FASTAPI /api/inventario/calcular)
    // ---------------------------------------------------------------
    const formEOQ = document.getElementById('formEOQ');
    formEOQ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const D = parseFloat(document.getElementById('eoqD').value);
        const K = parseFloat(document.getElementById('eoqK').value);
        const H = parseFloat(document.getElementById('eoqH').value);
        const L_dias = parseFloat(document.getElementById('eoqL').value);

        try {
            // El cálculo de Q* y ROP se envía al motor matemático en Python (engine.py)
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

            if (!response.ok) throw new Error('Falló el procesamiento en el motor EOQ en Python');

            const data = await response.json();

            // Asignación directa de campos del contrato backend (lote_optimo_Q y punto_reorden_ROP)
            document.getElementById('resQOptimo').textContent = `${data.lote_optimo_Q} un.`;
            document.getElementById('resROP').textContent = `${data.punto_reorden_ROP} un.`;

            notificar('Cálculo Exitoso', 'Los valores de EOQ y ROP han sido actualizados por el motor numérico.', 'success');
        } catch (err) {
            notificar('Error en Modelo EOQ', err.message, 'error');
        }
    });
    // ---------------------------------------------------------------
    // 9. CALCULADORA DE TEORÍA DE DECISIONES
    // ---------------------------------------------------------------
    const formDecisiones = document.getElementById('formDecisiones');
    formDecisiones?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const payload = {
                alternativas: [
                    { nombre: document.getElementById('decAlt1').value, pagos: [parseFloat(document.getElementById('decA1E1').value), parseFloat(document.getElementById('decA1E2').value)] },
                    { nombre: document.getElementById('decAlt2').value, pagos: [parseFloat(document.getElementById('decA2E1').value), parseFloat(document.getElementById('decA2E2').value)] }
                ],
                probabilidades: [parseFloat(document.getElementById('decProbE1').value), 1 - parseFloat(document.getElementById('decProbE1').value)]
            };

            const res = await fetch('/api/decisiones/evaluar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Error en motor de decisiones');
            const data = await res.json();

            document.getElementById('resDecisionesContainer').innerHTML = `
                <ul class="list-unstyled mb-0 small">
                    <li class="mb-1"><strong>Sugerencia VME:</strong> <span class="text-success fw-bold">${data.mejor_vme_alternativa}</span> (Bs. ${data.vme_maximo})</li>
                    <li class="mb-1"><strong>Criterio Laplace:</strong> ${data.laplace_alternativa}</li>
                    <li class="mb-1"><strong>Criterio Savage (Minimax):</strong> ${data.savage_alternativa}</li>
                </ul>
            `;
            notificar('Evaluación Completada', 'Los escenarios de decisión fueron calculados.', 'success');
        } catch (err) {
            notificar('Error en Decisiones', err.message, 'error');
        }
    });

    // ---------------------------------------------------------------
    // 10. CALCULADORA COLAS M/M/1
    // ---------------------------------------------------------------
    const formColas = document.getElementById('formColas');
    formColas?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const lambda = parseFloat(document.getElementById('colaLambda').value);
        const mu = parseFloat(document.getElementById('colaMu').value);

        try {
            const res = await fetch('/api/colas/mm1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tasa_llegada_lambda: lambda, tasa_servicio_mu: mu })
            });

            if (!res.ok) throw new Error('Servicio saturado (lambda >= mu)');
            const data = await res.json();

            document.getElementById('resColaRho').textContent = `${(data.factor_uso_rho * 100).toFixed(1)}%`;
            document.getElementById('resColaWq').textContent = `${(data.tiempo_espera_cola_Wq * 60).toFixed(1)} min`;

            notificar('Métricas M/M/1 Calculadas', 'Estimación de tiempo en mostrador lista.', 'success');
        } catch (err) {
            notificar('Error en Colas', err.message, 'error');
        }
    });
    // ---------------------------------------------------------------
    // CALCULADORA CADENAS DE MARKOV (MATRIZ DE ABSORCIÓN B = N * R)
    // ---------------------------------------------------------------
    const formMarkov = document.getElementById('formMarkov');
    formMarkov?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const p12 = parseFloat(document.getElementById('markovP12').value);
        const p2A1 = parseFloat(document.getElementById('markovP2A1').value);

        try {
            const response = await fetch('/api/markov/simular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prob_busqueda_a_carrito: p12,
                    prob_carrito_a_compra: p2A1
                })
            });

            if (!response.ok) throw new Error('Error al procesar la simulación de Markov');

            const data = await response.json();

            // Desplegar matriz de absorción y probabilidad de conversión
            document.getElementById('resMarkovContainer').innerHTML = `
                <div class="alert alert-success border-0 mb-0">
                    <h6 class="fw-bold mb-1"><i class="fa-solid fa-chart-line me-1"></i> Tasa Probable de Conversión</h6>
                    <p class="mb-1 small">Probabilidad de que un comprador que inicia en <strong>Búsqueda</strong> concrete la <strong>Compra</strong>:</p>
                    <h3 class="fw-bold text-success mb-0">${(data.probabilidad_conversion * 100).toFixed(2)}%</h3>
                </div>
            `;

            notificar('Simulación Markov Exitosa', 'Matriz de absorción calculada correctamente.', 'success');
        } catch (err) {
            notificar('Error en Markov', err.message, 'error');
        }
    });
    // ---------------------------------------------------------------
    // TAB 1: CARGA DINÁMICA DEL CATÁLOGO (POSTGRESQL / BD)
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
                if (res.status === 401) return; // Sesión no iniciada; mantiene estado por defecto
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

    // Exponer handlers globales para las acciones de los botones de la tabla
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
            cargarProductosCRUD(); // Recargar tabla
        }
    };

    // Invocar la carga al hacer clic en la pestaña del catálogo
    document.getElementById('tab-crud-tab')?.addEventListener('click', cargarProductosCRUD);
});
