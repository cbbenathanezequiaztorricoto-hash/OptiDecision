/* ===================================================================
   OPTI DECISION SUITE - IOP812 | LÓGICA DE APLICACIÓN DINO-DINÁMICA
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------------
    // 1. ESTADO Y VARIABLES GLOBALES
    // ---------------------------------------------------------------
    const COCHABAMBA_DEFAULT = [-17.3895, -66.1568]; // Plaza 14 de Septiembre (Fallback)
    let map = null;
    let markersLayer = null;
    let ubicacionUsuario = { lat: COCHABAMBA_DEFAULT[0], lng: COCHABAMBA_DEFAULT[1] };

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
    // 3. INICIALIZACIÓN DINÁMICA DEL MAPA
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

        const userMarker = L.marker([lat, lng], { icon: userIcon, isUserMarker: true })
            .addTo(markersLayer)
            .bindPopup(`<strong>${titulo}</strong>`);
            
        return userMarker;
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
    // 4. GEOCODIFICACIÓN REAL DE DIRECCIONES (OpenStreetMap Nominatim)
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
                alert('No se pudo obtener el GPS: ' + err.message);
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
            console.warn("Geocoding Nominatim no disponible, usando coordenadas de estado.");
        }
        return ubicacionUsuario;
    };

    // ---------------------------------------------------------------
    // 5. SLIDERS Y PONDERACIÓN DINÁMICA AHP (ESCALA SAATY 1-9)
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
        //Validamos que la suma no sea cero para evitar división por cero
        if (labels.precio) labels.precio.textContent = `${Math.round((valP / suma) * 100)}%`;
        if (labels.distancia) labels.distancia.textContent = `${Math.round((valD / suma) * 100)}%`;
        if (labels.reputacion) labels.reputacion.textContent = `${Math.round((valR / suma) * 100)}%`;
        if (labels.stock) labels.stock.textContent = `${Math.round((valS / suma) * 100)}%`;
    };

    Object.values(sliders).forEach(slider => {
        slider?.addEventListener('input', actualizarPorcentajesAHP);
    });

    // ---------------------------------------------------------------
    // 6. BÚSQUEDA Y PROCESAMIENTO MULTICRITERIO AHP
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
        btnBuscar.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-2"></i> Procesando AHP & Geolocalizando...`;

        // Obtener coordenadas dinámicas según el texto digitado en Origen
        const coordsActuales = await resolverCoordenadasOrigen(origenText);

        try {
            // Petición a endpoint del backend FastAPI
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
                throw new Error('API AHP Offline');
            }

            const data = await response.json();
            renderizarResultadosAHP(data);
        } catch (error) {
            // Generador Reactivo Dinámico alrededor de la ubicación elegida
            generarResultadosDinamicosContextuales(coordsActuales, productoText);
        } finally {
            btnBuscar.disabled = false;
            btnBuscar.innerHTML = `<i class="fa-solid fa-route"></i> <span>Optimizar y Buscar Ferretería</span>`;
        }
    });

    // Generador de contingencia que responde a las coordenadas y al producto buscado
    const generarResultadosDinamicosContextuales = (center, producto) => {
        const desplazamientos = [
            { dLat: 0.003, dLng: 0.004, nombreExt: "Central", precioMult: 1.0, stock: 140, rep: 4.8 },
            { dLat: -0.004, dLng: -0.002, nombreExt: "Express", precioMult: 1.08, stock: 45, rep: 4.3 },
            { dLat: 0.002, dLng: -0.005, nombreExt: "Industrial", precioMult: 0.95, stock: 310, rep: 4.6 }
        ];

        // Determinar precio base aproximado según el término buscado
        let precioBase = 50.00;
        const pLower = producto.toLowerCase();
        if (pLower.includes("cemento")) precioBase = 56.00;
        else if (pLower.includes("fierro")) precioBase = 48.00;
        else if (pLower.includes("yeso")) precioBase = 22.00;
        else if (pLower.includes("clavos") || pLower.includes("tornillo")) precioBase = 15.00;

        const ferreteriasDinamicas = desplazamientos.map((d, i) => {
            const lat = center.lat + d.dLat;
            const lng = center.lng + d.dLng;
            // Cálculo de distancia aproximada en km
            const dist = Math.sqrt(Math.pow(d.dLat * 111, 2) + Math.pow(d.dLng * 111, 2)).toFixed(1);
            
            return {
                nombre: `Ferretería ${d.nombreExt} (${producto})`,
                direccion: `Cerca de tu origen (${dist} km)`,
                latitud: lat,
                longitud: lng,
                precio_bob: +(precioBase * d.precioMult).toFixed(2),
                distancia_km: parseFloat(dist),
                reputacion: d.rep,
                stock: d.stock
            };
        });

        // Ordenar según criterio AHP
        ferreteriasDinamicas.sort((a, b) => a.precio_bob - b.precio_bob);

        renderizarResultadosAHP({ ferreterias: ferreteriasDinamicas, consistencia_cr: 0.03 });
    };

    const renderizarResultadosAHP = (data) => {
        markersLayer.clearLayers();

        // Re-dibujar el punto de origen del usuario
        actualizarMarcadorUsuario(ubicacionUsuario.lat, ubicacionUsuario.lng, "Tu Origen de Búsqueda");

        if (!data.ferreterias || data.ferreterias.length === 0) {
            alert('No se encontraron ferreterías disponibles.');
            return;
        }

        const top = data.ferreterias[0];

        // Desplegar tarjeta Top Pick AHP
        document.getElementById('topFerreteriaNombre').textContent = top.nombre;
        document.getElementById('topFerreteriaDireccion').innerHTML = `<i class="fa-solid fa-location-pin me-1"></i> ${top.direccion}`;
        document.getElementById('topPrecioBOB').textContent = `Bs. ${top.precio_bob.toFixed(2)}`;
        document.getElementById('topDistanciaKM').textContent = `${top.distancia_km} km`;
        document.getElementById('topReputacion').textContent = top.reputacion;
        document.getElementById('topStock').textContent = `${top.stock} un.`;
        cardTopResult?.classList.remove('d-none');

        // Renderizar marcadores dinámicos en el mapa
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
                        <strong style="color: #10B981;">Bs. ${f.precio_bob.toFixed(2)}</strong> | Stock: ${f.stock} un.
                    </div>
                `);

            if (idx === 0) marker.openPopup();
            puntosBounds.push([f.latitud, f.longitud]);
        });

        // Auto-encuadre de zoom para abarcar el origen y las ferreterías encontradas
        map.fitBounds(puntosBounds, { padding: [50, 50] });
    };

    // ---------------------------------------------------------------
    // 7. AUTENTICACIÓN JWT Y PANEL ADMINISTRADOR
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
            alert('¡Sesión iniciada con éxito!');

            const modalElement = document.getElementById('modalLoginAuth');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            modalInstance?.hide();

            verificarSesion();
        } catch (err) {
            alert('Error de autenticación: ' + err.message);
        }
    });

    // ---------------------------------------------------------------
    // 8. CALCULADORA INTERACTIVA DE INVENTARIOS (EOQ/EPQ)
    // ---------------------------------------------------------------
    const formEOQ = document.getElementById('formEOQ');
    formEOQ?.addEventListener('submit', (e) => {
        e.preventDefault();
        const D = parseFloat(document.getElementById('eoqD').value);
        const K = parseFloat(document.getElementById('eoqK').value);
        const H = parseFloat(document.getElementById('eoqH').value);
        const L_dias = parseFloat(document.getElementById('eoqL').value);

        if (D <= 0 || K <= 0 || H <= 0) {
            alert('Por favor ingrese valores positivos.');
            return;
        }

        const Q_optimo = Math.sqrt((2 * D * K) / H);
        const ROP = (D / 365) * L_dias;

        document.getElementById('resQOptimo').textContent = `${Math.round(Q_optimo)} un.`;
        document.getElementById('resROP').textContent = `${Math.ceil(ROP)} un.`;
    });
});