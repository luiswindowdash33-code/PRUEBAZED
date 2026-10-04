/* ==========================================================
   SOLIS ENTERPRISES - DASHBOARD COMPLETO
   Excel + Limpieza + MongoDB + Lectura + Gráficos + BI
   Rango automático: última semana con ventas
   ========================================================== */

// ========== ESTADO GLOBAL ==========
let ventasData = [];
let lineChartInstance = null;
let donutChartInstance = null;
let barChartInstance = null;
let ultimoPayloadMongoDB = null;
let filtros = { desde: null, hasta: null };

// ==========================================================
// NAVEGACIÓN Y UI
// ==========================================================
function switchView(viewId, btn) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    document.getElementById('pageTitle').innerText = btn.querySelector('span').innerText;

    document.querySelectorAll('aside nav button').forEach(b => {
        b.className = "w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white transition text-left text-slate-300";
        const icon = b.querySelector('i');
        if (icon) icon.className = icon.className.replace(/text-white/, 'text-slate-400');
    });
    btn.className = "w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg bg-blue-600 text-white font-medium shadow-md shadow-blue-600/20 text-left";
    const activeIcon = btn.querySelector('i');
    if (activeIcon) activeIcon.className = activeIcon.className.replace(/text-slate-400/, 'text-white');
}

function setSidebarColor(colorHex, el) {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('ring-4', 'ring-offset-2', 'ring-blue-400'));
    el.classList.add('ring-4', 'ring-offset-2', 'ring-blue-400');
    document.querySelector('aside').style.backgroundColor = colorHex;
}
function setSidenavType(type) {
    const sidebar = document.querySelector('aside');
    if (type === 'dark') sidebar.style.backgroundColor = '#0f172a';
    else if (type === 'white') sidebar.style.backgroundColor = '#ffffff';
    else if (type === 'transparent') sidebar.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
}
function toggleNavbarFixed(checkbox) {
    const header = document.querySelector('header');
    if (checkbox.checked) header.classList.add('sticky', 'top-0', 'z-50', 'shadow-sm');
    else header.classList.remove('sticky', 'top-0', 'z-50', 'shadow-sm');
}
function toggleDarkMode(checkbox) {
    if (checkbox.checked) document.body.className = "bg-slate-900 text-slate-100 font-sans antialiased flex h-screen overflow-hidden";
    else document.body.className = "bg-slate-100 text-slate-800 font-sans antialiased flex h-screen overflow-hidden";
}

// ==========================================================
// HELPERS
// ==========================================================
function fmtMoneda(n) {
    return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNumero(n) {
    return (Number(n) || 0).toLocaleString('en-US');
}
function setTexto(id, valor) {
    const el = document.getElementById(id);
    if (el) el.innerText = valor;
}
function queryFiltros() {
    let q = [];
    if (filtros.desde) q.push(`desde=${filtros.desde}`);
    if (filtros.hasta) q.push(`hasta=${filtros.hasta}`);
    return q.length ? '?' + q.join('&') : '';
}
function normalizar(str) {
    return String(str || '').toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
}
function buscarColumna(headers, ...coincidencias) {
    const normalizadas = headers.map(h => normalizar(h));
    for (const c of coincidencias) {
        const idx = normalizadas.indexOf(normalizar(c));
        if (idx !== -1) return idx;
    }
    return headers.findIndex(h => {
        const n = normalizar(h);
        return coincidencias.some(c => n.includes(normalizar(c)));
    });
}
function valorFila(row, idx) {
    if (idx < 0 || idx === undefined) return '';
    const v = row[idx];
    return v !== undefined && v !== null ? v : '';
}

// ==========================================================
// RANGO DE FECHAS: última semana con ventas
// ==========================================================
async function cargarRangoFechas() {
    try {
        const r = await fetch('http://localhost:3000/api/dashboard/rango-fechas');
        const data = (await r.json()).data || {};

        const inputInicio = document.getElementById('fechaInicio');
        const inputFin    = document.getElementById('fechaFin');

        if (data.fechaMax) {
            // Fecha fin = última venta registrada
            const fechaFin = data.fechaMax;

            // Fecha inicio = 7 días antes (incluyendo el día final → 7 días exactos)
            const fechaFinDate = new Date(fechaFin + 'T00:00:00');
            const fechaInicioDate = new Date(fechaFinDate);
            fechaInicioDate.setDate(fechaInicioDate.getDate() - 6);

            const fechaInicio = fechaInicioDate.toISOString().split('T')[0];

            inputInicio.value = fechaInicio;
            inputFin.value    = fechaFin;

            filtros = { desde: fechaInicio, hasta: fechaFin };

            console.log(`📅 Rango aplicado: ${fechaInicio} → ${fechaFin} (última semana con ventas)`);
        } else {
            inputInicio.value = '';
            inputFin.value    = '';
            filtros = { desde: null, hasta: null };
            console.log("📅 No hay ventas registradas aún");
        }
    } catch (err) {
        console.error("❌ Error cargando rango de fechas:", err);
    }
}

// ==========================================================
// 1) DASHBOARD GLOBAL
// ==========================================================
async function cargarDashboard() {
    try {
        const q = queryFiltros();

        // --- KPIs ---
        const rKpis = await fetch('http://localhost:3000/api/dashboard/kpis' + q);
        const kpis = (await rKpis.json()).data || {};

        setTexto('kpiVentas',   fmtMoneda(kpis.ventasTotales));
        setTexto('kpiUtilidad', fmtMoneda(kpis.utilidadBruta));
        setTexto('kpiMargen',   (kpis.margenBruto || 0).toFixed(1) + '%');
        setTexto('kpiTicket',   fmtMoneda(kpis.ticketPromedio));
        setTexto('kpiClientes', fmtNumero(kpis.clientesUnicos));

        // Proyección estimada
        const proy = (kpis.margenBruto || 0) * 0.25;
        setTexto('kpiProyeccion', '+' + proy.toFixed(1) + '%');

        // --- Tabla de transacciones ---
        const rVentas = await fetch('http://localhost:3000/api/ventas?page=1&limit=50' + (q ? '&' + q.substring(1) : ''));
        const respVentas = await rVentas.json();
        const ventas = respVentas.data || [];

        ventasData = ventas.map(v => ({
            cliente: v.id_cliente,
            fecha: v.fecha,
            sucursal: v.sucursal,
            vendedor: v.vendedor,
            categoria: v.categoria,
            producto: v.producto,
            precio: v.precio_total,
            costo: v.costo_total,
            cantidad: v.cantidad,
            total: v.total_cobrado
        }));
        poblarTablaVentas(ventasData);

        // --- Gráficos ---
        const rSuc = await fetch('http://localhost:3000/api/dashboard/ventas-por-sucursal' + q);
        const dataSuc = (await rSuc.json()).data || [];

        const rCat = await fetch('http://localhost:3000/api/dashboard/ventas-por-categoria' + q);
        const dataCat = (await rCat.json()).data || [];

        const rTen = await fetch('http://localhost:3000/api/dashboard/tendencia-diaria' + q);
        const dataTen = (await rTen.json()).data || [];

        renderGraficos(dataTen, dataSuc, dataCat);

        console.log("✅ Dashboard cargado con filtros:", filtros);
    } catch (err) {
        console.error("❌ Error cargando dashboard:", err);
    }
}

function poblarTablaVentas(datos) {
    const tbody = document.getElementById('tablaVentasBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (datos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-3 text-center text-slate-400">Sin datos en el rango seleccionado</td></tr>`;
        return;
    }
    datos.forEach(row => {
        tbody.innerHTML += `
            <tr>
                <td class="p-3 font-semibold text-slate-700">${row.cliente || ''}</td>
                <td class="p-3">${row.fecha || ''}</td>
                <td class="p-3">${row.sucursal || ''}</td>
                <td class="p-3">${row.vendedor || ''}</td>
                <td class="p-3">${row.categoria || ''}</td>
                <td class="p-3">${row.producto || ''}</td>
                <td class="p-3">${fmtMoneda(row.precio)}</td>
                <td class="p-3">${fmtMoneda(row.costo)}</td>
                <td class="p-3">${row.cantidad || 0}</td>
                <td class="p-3 font-bold text-blue-600">${fmtMoneda(row.total)}</td>
            </tr>
        `;
    });
}

function renderGraficos(tendencia, sucursal, categoria) {
    // Línea
    if (lineChartInstance) lineChartInstance.destroy();
    lineChartInstance = new Chart(document.getElementById('lineChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: tendencia.map(d => d._id),
            datasets: [{
                label: 'Ventas Diarias',
                data: tendencia.map(d => d.total),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
        }
    });

    // Donut
    const colores = ['#2563eb', '#22c55e', '#eab308', '#a855f7', '#ef4444', '#06b6d4'];
    if (donutChartInstance) donutChartInstance.destroy();
    donutChartInstance = new Chart(document.getElementById('donutChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: sucursal.map(d => d._id),
            datasets: [{
                data: sucursal.map(d => d.total),
                backgroundColor: colores.slice(0, sucursal.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
            cutout: '70%'
        }
    });

    // Barras
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(document.getElementById('barChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: categoria.map(d => d._id),
            datasets: [{
                data: categoria.map(d => d.total),
                backgroundColor: '#eab308',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, grid: { display: false } }, y: { grid: { display: false } } }
        }
    });
}

// ==========================================================
// 2) BI CLIENTES
// ==========================================================
async function cargarBIClientes() {
    try {
        const q = queryFiltros();
        const r = await fetch('http://localhost:3000/api/dashboard/top-clientes' + q);
        const data = (await r.json()).data || [];

        const ul = document.getElementById('biTopClientes');
        if (!ul) return;

        ul.innerHTML = '';
        if (data.length === 0) {
            ul.innerHTML = `<li class="text-slate-400">Sin datos en el rango</li>`;
            return;
        }

        data.forEach(c => {
            const sucursales = (c.sucursales || []).join(', ');
            ul.innerHTML += `
                <li class="flex justify-between py-1 border-b border-slate-200">
                    <span>${c._id} (${sucursales})</span>
                    <strong class="text-slate-800">${fmtMoneda(c.total)}</strong>
                </li>
            `;
        });

        // Métricas
        const rKpis = await fetch('http://localhost:3000/api/dashboard/kpis' + q);
        const kpis = (await rKpis.json()).data || {};

        setTexto('biRecompra', ((kpis.clientesUnicos || 0) * 0.74 / 10).toFixed(1) + '%');
        setTexto('biLTV', fmtMoneda((kpis.ventasTotales || 0) / (kpis.clientesUnicos || 1)));

    } catch (err) {
        console.error("❌ Error BI Clientes:", err);
    }
}

// ==========================================================
// 3) BI SUCURSALES
// ==========================================================
async function cargarBISucursales() {
    try {
        const q = queryFiltros();
        const r = await fetch('http://localhost:3000/api/dashboard/margenes-sucursal' + q);
        const data = (await r.json()).data || [];

        const grid = document.getElementById('biSucursalesGrid');
        if (!grid) return;

        if (data.length === 0) {
            grid.innerHTML = `<p class="text-slate-400">Sin datos en el rango</p>`;
            return;
        }

        const colores = ['text-blue-600', 'text-emerald-600', 'text-amber-600', 'text-purple-600'];
        grid.innerHTML = '';
        data.forEach((s, i) => {
            grid.innerHTML += `
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                    <span class="text-xs font-bold text-slate-400 uppercase">${s._id}</span>
                    <div class="text-xl font-extrabold ${colores[i % colores.length]} mt-1">${fmtMoneda(s.ventas)}</div>
                    <span class="text-xs text-slate-500">Margen: ${(s.margen || 0).toFixed(1)}%</span>
                </div>
            `;
        });
    } catch (err) {
        console.error("❌ Error BI Sucursales:", err);
    }
}

// ==========================================================
// 4) BI PROYECCIONES
// ==========================================================
async function cargarBIProyecciones() {
    try {
        const q = queryFiltros();
        const r = await fetch('http://localhost:3000/api/dashboard/kpis' + q);
        const kpis = (await r.json()).data || {};

        const proyeccion = (kpis.ventasTotales || 0) * 0.225;
        setTexto('biProyeccionQ2', '+' + fmtMoneda(proyeccion));
        setTexto('biMargenNeto', (kpis.margenBruto || 0).toFixed(2) + '%');
    } catch (err) {
        console.error("❌ Error BI Proyecciones:", err);
    }
}

// ==========================================================
// 5) TABLA CLIENTES
// ==========================================================
async function cargarClientes() {
    try {
        const r = await fetch('http://localhost:3000/api/clientes?page=1&limit=100');
        const resp = await r.json();
        const data = resp.data || [];

        const tbody = document.getElementById('tablaClientesBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400">Sin clientes</td></tr>`;
            return;
        }
        data.forEach(c => {
            tbody.innerHTML += `
                <tr>
                    <td class="p-3 font-semibold">${c.id_cliente || ''}</td>
                    <td class="p-3">${c.dni || ''}</td>
                    <td class="p-3">${c.nombre_cliente || ''}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("❌ Error Clientes:", err);
    }
}

// ==========================================================
// 6) TABLA PRODUCTOS
// ==========================================================
async function cargarProductos() {
    try {
        const r = await fetch('http://localhost:3000/api/productos?page=1&limit=100');
        const resp = await r.json();
        const data = resp.data || [];

        const tbody = document.getElementById('tablaProductosBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400">Sin productos</td></tr>`;
            return;
        }
        data.forEach(p => {
            tbody.innerHTML += `
                <tr>
                    <td class="p-3 font-semibold">${p.id_producto || ''}</td>
                    <td class="p-3">${p.categoria || ''}</td>
                    <td class="p-3">${p.nombre_producto || ''}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("❌ Error Productos:", err);
    }
}

// ==========================================================
// 7) FILTRO POR FECHAS (manual)
// ==========================================================
async function analizarDatosConFiltros() {
    const desde = document.getElementById('fechaInicio').value;
    const hasta = document.getElementById('fechaFin').value;

    filtros = { desde, hasta };

    await Promise.all([
        cargarDashboard(),
        cargarBIClientes(),
        cargarBISucursales(),
        cargarBIProyecciones()
    ]);

    console.log("📊 Datos recargados con filtros:", filtros);
}

// ==========================================================
// 8) EXCEL: CARGAR Y VALIDAR (con limpieza matemática)
// ==========================================================
function validarYPrevisualizarExcel() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];

    if (!file) {
        alert("⚠️ Por favor, selecciona primero un archivo Excel (.xlsx, .xls o .csv).");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            let datosVentas = [];
            let datosClientes = [];
            let datosProductos = [];

            let auditoriaCorrecciones = [];
            let filasVentasTotal = 0;
            let filasClientesTotal = 0;
            let filasProductosTotal = 0;

            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                if (jsonData.length < 2) return;

                const headers = jsonData[0].map(h => String(h || '').trim());
                const lowerSheet = sheetName.toLowerCase();
                const headersNorm = headers.map(h => normalizar(h));

                let tipoTabla = "";
                if (lowerSheet.includes("venta") ||
                    headersNorm.some(h => h.includes("totalcobrado") || h.includes("precio") || h.includes("vendedor"))) {
                    tipoTabla = "ventas";
                } else if (lowerSheet.includes("cliente") ||
                    headersNorm.some(h => h.includes("dni") || h.includes("nombrecliente"))) {
                    tipoTabla = "clientes";
                } else if (lowerSheet.includes("producto") ||
                    headersNorm.some(h => h.includes("nombreproducto") || h.includes("categoria"))) {
                    tipoTabla = "productos";
                }

                // VENTAS
                if (tipoTabla === "ventas") {
                    const idx = {
                        id_cliente:    buscarColumna(headers, "id_cliente", "idcliente", "cliente", "codigo_cliente"),
                        fecha:         buscarColumna(headers, "fecha", "fecha_venta"),
                        sucursal:      buscarColumna(headers, "sucursal"),
                        vendedor:      buscarColumna(headers, "vendedor"),
                        categoria:     buscarColumna(headers, "categoria", "categoría"),
                        producto:      buscarColumna(headers, "producto"),
                        precio_total:  buscarColumna(headers, "precio_total", "preciototal", "precio"),
                        costo_total:   buscarColumna(headers, "costo_total", "costototal", "costo"),
                        cantidad:      buscarColumna(headers, "cantidad"),
                        total_cobrado: buscarColumna(headers, "total_cobrado", "totalcobrado")
                    };

                    for (let i = 1; i < jsonData.length; i++) {
                        let row = jsonData[i];
                        if (!row || row.length === 0) continue;
                        filasVentasTotal++;

                        let cliente   = String(valorFila(row, idx.id_cliente) || '').trim();
                        let fechaRaw  = valorFila(row, idx.fecha);
                        let sucursal  = String(valorFila(row, idx.sucursal) || '').trim();
                        let vendedor  = String(valorFila(row, idx.vendedor) || '').trim();
                        let categoria = String(valorFila(row, idx.categoria) || '').trim();
                        let producto  = String(valorFila(row, idx.producto) || '').trim();

                        let precioTotal = parseFloat(valorFila(row, idx.precio_total)) || 0;
                        let costoTotal  = parseFloat(valorFila(row, idx.costo_total)) || 0;

                        let rawCantidad     = valorFila(row, idx.cantidad);
                        let rawTotalCobrado = valorFila(row, idx.total_cobrado);

                        let fecha = "";
                        if (typeof fechaRaw === 'number') {
                            let excelDate = new Date((fechaRaw - (25567 + 2)) * 86400 * 1000);
                            fecha = excelDate.toISOString().split('T')[0];
                        } else {
                            fecha = String(fechaRaw || '').trim();
                        }

                        let cantidad     = (rawCantidad !== "" && !isNaN(rawCantidad)) ? parseInt(rawCantidad) : NaN;
                        let totalCobrado = (rawTotalCobrado !== "" && !isNaN(rawTotalCobrado)) ? parseFloat(rawTotalCobrado) : NaN;

                        let estadoFila = "Correcto";
                        let motivoCorreccion = [];

                        if (isNaN(cantidad) || cantidad <= 0) {
                            if (!isNaN(totalCobrado) && totalCobrado > 0 && precioTotal > 0) {
                                cantidad = Math.round(totalCobrado / precioTotal);
                                motivoCorreccion.push(`Cantidad vacía. Calculada (${totalCobrado} / ${precioTotal} = ${cantidad})`);
                            } else {
                                cantidad = 1;
                                motivoCorreccion.push(`Cantidad vacía. Asignado 1`);
                            }
                            estadoFila = "Corregido";
                        }

                        let totalEsperado = Number((precioTotal * cantidad).toFixed(2));

                        if (isNaN(totalCobrado) || totalCobrado <= 0) {
                            totalCobrado = totalEsperado;
                            motivoCorreccion.push(`TotalCobrado vacío. Calculado (${precioTotal} * ${cantidad} = ${totalCobrado})`);
                            estadoFila = "Corregido";
                        } else {
                            let diferencia = Math.abs(totalCobrado - totalEsperado);
                            if (diferencia > 0.05) {
                                motivoCorreccion.push(`TotalCobrado inconsistente (${totalCobrado} vs ${totalEsperado}). Corregido`);
                                totalCobrado = totalEsperado;
                                estadoFila = "Corregido";
                            }
                        }

                        if (estadoFila === "Corregido") {
                            auditoriaCorrecciones.push({
                                fila: i + 1,
                                cliente: cliente,
                                producto: producto,
                                acciones: motivoCorreccion.join(" | ")
                            });
                        }

                        datosVentas.push({
                            id_cliente: cliente,
                            fecha: fecha,
                            sucursal: sucursal,
                            vendedor: vendedor,
                            categoria: categoria,
                            producto: producto,
                            precio_total: precioTotal,
                            costo_total: costoTotal,
                            cantidad: cantidad,
                            total_cobrado: totalCobrado
                        });
                    }
                }
                // CLIENTES
                else if (tipoTabla === "clientes") {
                    const idx = {
                        id_cliente:     buscarColumna(headers, "id_cliente", "idcliente", "codigo", "codigo_cliente"),
                        dni:            buscarColumna(headers, "dni"),
                        nombre_cliente: buscarColumna(headers, "nombre_cliente", "nombrecliente", "nombre")
                    };

                    for (let i = 1; i < jsonData.length; i++) {
                        let row = jsonData[i];
                        if (!row || row.length === 0) continue;
                        filasClientesTotal++;

                        let idCliente     = String(valorFila(row, idx.id_cliente) || '').trim();
                        let dni           = String(valorFila(row, idx.dni) || '').trim();
                        let nombreCliente = String(valorFila(row, idx.nombre_cliente) || '').trim();

                        if (idCliente) {
                            datosClientes.push({ id_cliente: idCliente, dni: dni, nombre_cliente: nombreCliente });
                        }
                    }
                }
                // PRODUCTOS
                else if (tipoTabla === "productos") {
                    const idx = {
                        id_producto:     buscarColumna(headers, "producto", "id_producto", "idproducto", "codigo"),
                        categoria:       buscarColumna(headers, "categoria", "categoría"),
                        nombre_producto: buscarColumna(headers, "nombre_producto", "nombreproducto", "nombre")
                    };

                    for (let i = 1; i < jsonData.length; i++) {
                        let row = jsonData[i];
                        if (!row || row.length === 0) continue;
                        filasProductosTotal++;

                        let idProducto     = String(valorFila(row, idx.id_producto) || '').trim();
                        let categoria      = String(valorFila(row, idx.categoria) || '').trim();
                        let nombreProducto = String(valorFila(row, idx.nombre_producto) || '').trim();

                        if (idProducto) {
                            datosProductos.push({
                                id_producto: idProducto,
                                categoria: categoria,
                                nombre_producto: nombreProducto
                            });
                        }
                    }
                }
            });

            let clientesMap = new Map();
            let productosMap = new Map();

            datosClientes.forEach(c => { if (c.id_cliente) clientesMap.set(c.id_cliente, c); });
            datosProductos.forEach(p => { if (p.id_producto) productosMap.set(p.id_producto, p); });

            datosVentas.forEach(v => {
                if (v.id_cliente && !clientesMap.has(v.id_cliente)) {
                    clientesMap.set(v.id_cliente, { id_cliente: v.id_cliente, dni: "", nombre_cliente: "" });
                }
                if (v.producto && !productosMap.has(v.producto)) {
                    productosMap.set(v.producto, {
                        id_producto: v.producto,
                        categoria: v.categoria,
                        nombre_producto: ""
                    });
                }
            });

            ultimoPayloadMongoDB = {
                database: "ventas_ipesa",
                collections: {
                    cliente: Array.from(clientesMap.values()),
                    producto: Array.from(productosMap.values()),
                    Ventas: datosVentas
                }
            };

            document.getElementById('jsonOutput').value = JSON.stringify(ultimoPayloadMongoDB, null, 2);

            const panel = document.getElementById('panelAuditoria');
            panel.classList.remove('hidden');

            document.getElementById('resumenTablas').innerHTML = `
                <li>📁 <strong>Ventas:</strong> ${filasVentasTotal} filas cargadas</li>
                <li>📁 <strong>Clientes:</strong> ${clientesMap.size} registros únicos</li>
                <li>📁 <strong>Productos:</strong> ${productosMap.size} registros únicos</li>
            `;

            document.getElementById('totalErroresCorregidos').innerText = auditoriaCorrecciones.length;

            const lista = document.getElementById('detalleCorrecciones');
            lista.innerHTML = '';
            if (auditoriaCorrecciones.length === 0) {
                lista.innerHTML = `<li class="text-emerald-600 font-semibold">¡Ninguna celda requirió corrección!</li>`;
            } else {
                auditoriaCorrecciones.forEach(err => {
                    lista.innerHTML += `
                        <li class="bg-amber-50 border border-amber-200 p-2 rounded text-xs text-amber-800">
                            <strong>Fila ${err.fila}</strong> (Cliente: ${err.cliente}):<br>
                            ⚠️ <em>${err.acciones}</em>
                        </li>
                    `;
                });
            }

            ventasData = datosVentas.map(v => ({
                cliente: v.id_cliente,
                fecha: v.fecha,
                sucursal: v.sucursal,
                vendedor: v.vendedor,
                categoria: v.categoria,
                producto: v.producto,
                precio: v.precio_total,
                costo: v.costo_total,
                cantidad: v.cantidad,
                total: v.total_cobrado
            }));
            poblarTablaVentas(ventasData);

            document.getElementById('mensajeExitoCarga').classList.remove('hidden');
            document.getElementById('seccionGuardarMongo').classList.remove('hidden');

            setTimeout(() => document.getElementById('mensajeExitoCarga').classList.add('hidden'), 5000);

        } catch (err) {
            console.error("Error al procesar Excel:", err);
            alert("❌ Ocurrió un error al leer el archivo Excel.");
        }
    };
    reader.readAsArrayBuffer(file);
}

// ==========================================================
// 9) EXCEL: GUARDAR EN MONGODB
// ==========================================================
async function guardarEnMongoDB() {
    if (!ultimoPayloadMongoDB) {
        alert("⚠️ Primero debes cargar y validar un Excel.");
        return;
    }
    const btn = document.getElementById('btnGuardarMongo');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;

    try {
        const resp = await fetch('http://localhost:3000/api/guardar-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ultimoPayloadMongoDB)
        });
        const result = await resp.json();
        if (!result.success) throw new Error(result.message);

        const msg = document.getElementById('mensajeExitoMongo');
        msg.classList.remove('hidden');
        msg.innerText = `✅ ${result.message}`;
        setTimeout(() => msg.classList.add('hidden'), 6000);

        // Recalcular rango de fechas con los datos nuevos
        await cargarRangoFechas();

        // Recargar todo
        await Promise.all([
            cargarDashboard(),
            cargarBIClientes(),
            cargarBISucursales(),
            cargarBIProyecciones(),
            cargarClientes(),
            cargarProductos()
        ]);

    } catch (err) {
        alert("❌ " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-database"></i> Guardar en MongoDB (ventas_ipesa)`;
    }
}

// ==========================================================
// 10) INICIALIZACIÓN
// ==========================================================
window.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Inicializando panel...");

    // 1. Cargar rango de fechas (última semana con ventas)
    await cargarRangoFechas();

    // 2. Inicializar Flatpickr con los valores ya puestos
    if (typeof flatpickr !== 'undefined') {
        flatpickr("#fechaInicio", { dateFormat: "Y-m-d", locale: "es" });
        flatpickr("#fechaFin",    { dateFormat: "Y-m-d", locale: "es" });
    }

    // 3. Cargar todo el dashboard
    await Promise.all([
        cargarDashboard(),
        cargarBIClientes(),
        cargarBISucursales(),
        cargarBIProyecciones(),
        cargarClientes(),
        cargarProductos()
    ]);

    console.log("✅ Panel listo. Rango:", filtros);
});
