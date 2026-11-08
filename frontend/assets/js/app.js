/* ===================================================================
   OPTI DECISION SUITE - IOP812 | LÓGICA DE APLICACIÓN Y CONSUMO API
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------------
    // 1. ESTADO Y VARIABLES GLOBALES
    // ---------------------------------------------------------------
    const COCHABAMBA_CENTER = [-17.3895, -66.1568]; // Coordenadas Plaza 14 de Septiembre
    let map = null;
    let markersLayer = null;
    let ubicacionUsuario = { lat: -17.3895, lng: -66.1568 };

    // ---------------------------------------------------------------
    // 2. GESTIÓN DE TEMA OSCURO / CLARO
    // ---------------------------------------------------------------
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    const aplicarTema = (tema) => {
        document.documentElement.setAttribute('data-theme', tema);
        localStorage.setItem('iop812-theme', tema);
        if (tema === 'light') {
            themeIcon.className = 'fa-solid fa-sun text-warning';
        } else {
            themeIcon.className = 'fa-solid fa-moon text-light';
        }
    };

    // Cargar tema guardado o por defecto (dark)
    const temaGuardado = localStorage.getItem('iop812-theme') || 'dark';
    aplicarTema(temaGuardado);

    themeToggleBtn?.addEventListener('click', () => {
        const temaActual = document.documentElement.getAttribute('data-theme');
        aplicarTema(temaActual === 'dark' ? 'light' : 'dark');
    });

    // ---------------------------------------------------------------
    // 3. INICIALIZACIÓN DEL MAPA LEAFLET EN COCHABAMBA
    // ---------------------------------------------------------------
    const inicializarMapa = () => {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        map = L.map('map', {
            center: COCHABAMBA_CENTER,
            zoom: 13,
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
        actualizarMarcadorUsuario(COCHABAMBA_CENTER[0], COCHABAMBA_CENTER[1], "Origen: Plaza 14 de Septiembre");
    };

    const actualizarMarcadorUsuario = (lat, lng, titulo) => {
        ubicacionUsuario = { lat, lng };
        const userIcon = L.divIcon({
            className: 'user-marker-icon',
            html: `<div style="background-color: #0EA5E9; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(14,165,233,0.8);"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        L.marker([lat, lng], { icon: userIcon })
            .addTo(map)
            .bindPopup(`<strong>${titulo}</strong>`)
            .openPopup();
    };

    inicializarMapa();

    // ---------------------------------------------------------------
    // 4. GEOLOCALIZACIÓN GPS (UX ESTILO TRUFI COCHABAMBA)
    // ---------------------------------------------------------------
    const btnGPS = document.getElementById('btnGPS');
    const inputOrigen = document.getElementById('inputOrigen');

    btnGPS?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('La geolocalización no es compatible con este navegador.');
            return;
        }

        btnGPS.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-primary"></i>`;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                ubicacionUsuario = { lat: latitude, lng: longitude };
                inputOrigen.value = `Mi Ubicación GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
                map.flyTo([latitude, longitude], 15);
                actualizarMarcadorUsuario(latitude, longitude, "Tu ubicación actual GPS");
                btnGPS.innerHTML = `<i class="fa-solid fa-crosshairs text-primary"></i>`;
            },
            (err) => {
                alert('No se pudo obtener la ubicación GPS: ' + err.message);
                btnGPS.innerHTML = `<i class="fa-solid fa-crosshairs text-primary"></i>`;
            }
        );
    });

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
        const valP = parseInt(sliders.precio.value, 10);
        const valD = parseInt(sliders.distancia.value, 10);
        const valR = parseInt(sliders.reputacion.value, 10);
        const valS = parseInt(sliders.stock.value, 10);
        const suma = valP + valD + valR + valS;

        labels.precio.textContent = `${Math.round((valP / suma) * 100)}%`;
        labels.distancia.textContent = `${Math.round((valD / suma) * 100)}%`;
        labels.reputacion.textContent = `${Math.round((valR / suma) * 100)}%`;
        labels.stock.textContent = `${Math.round((valS / suma) * 100)}%`;
    };

    Object.values(sliders).forEach(slider => {
        slider?.addEventListener('input', actualizarPorcentajesAHP);
    });

    // ---------------------------------------------------------------
    // 6. BÚSQUEDA Y RENDIMIENTO AHP MULTICRITERIO
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
        if (!productoText) return;

        const btnBuscar = document.getElementById('btnBuscarAHP');
        btnBuscar.disabled = true;
        btnBuscar.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-2"></i> Procesando AHP & PostGIS...`;

        try {
            // Petición a endpoint del backend FastAPI
            const response = await fetch('/api/ahp/buscar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    latitud: ubicacionUsuario.lat,
                    longitud: ubicacionUsuario.lng,
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
                throw new Error('Error al conectar con la API AHP.');
            }

            const data = await response.json();
            renderizarResultadosAHP(data);
        } catch (error) {
            console.warn('Backend no disponible o usando modo simulación:', error.message);
            // Simulación visual local en caso de estar en desarrollo sin backend conectado
            simularBusquedaAHP(productoText);
        } finally {
            btnBuscar.disabled = false;
            btnBuscar.innerHTML = `<i class="fa-solid fa-route"></i> <span>Optimizar y Buscar Ferretería</span>`;
        }
    });

    const simularBusquedaAHP = (producto) => {
        const datosSimulados = [
            {
                nombre: "Ferretería El Castor (Top Pick)",
                direccion: "Av. Blanco Galindo Km 3",
                latitud: -17.3920,
                longitud: -66.1700,
                precio_bob: 45.00,
                distancia_km: 1.2,
                reputacion: 4.8,
                stock: 120,
                es_top: true
            },
            {
                nombre: "Ferretería Bolivia Pro",
                direccion: "Av. Heroínas #450",
                latitud: -17.3870,
                longitud: -66.1500,
                precio_bob: 48.50,
                distancia_km: 0.8,
                reputacion: 4.2,
                stock: 85,
                es_top: false
            }
        ];
        renderizarResultadosAHP({ ferreterias: datosSimulados, consistencia_cr: 0.04 });
    };

    const renderizarResultadosAHP = (data) => {
        markersLayer.clearLayers();

        // Volver a poner la ubicación del cliente
        actualizarMarcadorUsuario(ubicacionUsuario.lat, ubicacionUsuario.lng, "Tu ubicación de Origen");

        if (!data.ferreterias || data.ferreterias.length === 0) {
            alert('No se encontraron ferreterías con el producto especificado.');
            return;
        }

        const top = data.ferreterias[0];

        // Actualizar tarjeta flotante Top Pick
        document.getElementById('topFerreteriaNombre').textContent = top.nombre;
        document.getElementById('topFerreteriaDireccion').innerHTML = `<i class="fa-solid fa-location-pin me-1"></i> ${top.direccion}`;
        document.getElementById('topPrecioBOB').textContent = `Bs. ${top.precio_bob.toFixed(2)}`;
        document.getElementById('topDistanciaKM').textContent = `${top.distancia_km} km`;
        document.getElementById('topReputacion').textContent = top.reputacion;
        document.getElementById('topStock').textContent = `${top.stock} un.`;
        cardTopResult?.classList.remove('d-none');

        // Renderizar marcadores de ferreterías en el mapa
        data.ferreterias.forEach((f, idx) => {
            const color = idx === 0 ? '#F59E0B' : '#0EA5E9'; // Dorado para el #1 AHP, azul para secundarios
            const markerIcon = L.divIcon({
                className: 'ferreteria-marker',
                html: `<div style="background-color: ${color}; width: 26px; height: 26px; border-radius: 50%; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"><i class="fa-solid fa-store"></i></div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            });

            const marker = L.marker([f.latitud, f.longitud], { icon: markerIcon })
                .addTo(markersLayer)
                .bindPopup(`
                    <div style="color: #0F172A;">
                        <strong style="color: #0EA5E9;">${f.nombre}</strong><br>
                        <small>${f.direccion}</small><br>
                        <strong style="color: #10B981;">Bs. ${f.precio_bob.toFixed(2)}</strong> | Stock: ${f.stock} un.
                    </div>
                `);

            if (idx === 0) {
                marker.openPopup();
            }
        });

        // Ajustar zoom del mapa para abarcar todas las opciones
        const bounds = L.latLngBounds(data.ferreterias.map(f => [f.latitud, f.longitud]));
        bounds.extend([ubicacionUsuario.lat, ubicacionUsuario.lng]);
        map.fitBounds(bounds, { padding: [50, 50] });
    };

    // ---------------------------------------------------------------
    // 7. AUTENTICACIÓN JWT Y CONTROL DEL PANEL ADMINISTRADOR
    // ---------------------------------------------------------------
    const formLogin = document.getElementById('formLogin');
    const navItemDashboard = document.getElementById('navItemDashboard');

    const verificarSesion = () => {
        const token = localStorage.getItem('iop812-token');
        if (token) {
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
            
            // Cerrar modal de login y activar panel
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

        // Fórmula EOQ Básico: Q* = sqrt((2 * D * K) / H)
        const Q_optimo = Math.sqrt((2 * D * K) / H);
        
        // ROP = (Demanda Diaria * L) (asumiendo 365 días al año)
        const demanda_diaria = D / 365;
        const ROP = demanda_diaria * L_dias;

        document.getElementById('resQOptimo').textContent = `${Math.round(Q_optimo)} un.`;
        document.getElementById('resROP').textContent = `${Math.ceil(ROP)} un.`;
    });
});