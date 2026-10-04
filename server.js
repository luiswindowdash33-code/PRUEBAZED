// ==========================================================
// SOLIS ENTERPRISES - BACKEND ESCALABLE
// Node.js + Express + MongoDB Atlas
// ==========================================================

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname)));

// ==========================================================
// CONEXIÓN A MONGODB ATLAS
// ==========================================================
const MONGODB_URI = "mongodb+srv://luiswindowdash33_db_user:exito123@cluster0.nbky5us.mongodb.net/ventas_ipesa?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
})
  .then(() => {
      console.log("✅ ¡Conectado exitosamente a MongoDB Atlas (Base de datos: ventas_ipesa)!");
      crearIndices();
  })
  .catch(err => console.error("❌ Error de conexión a MongoDB:", err.message));

// ==========================================================
// MODELOS
// ==========================================================
const Cliente  = mongoose.model('cliente',  new mongoose.Schema({}, { strict: false }), 'cliente');
const Producto = mongoose.model('producto', new mongoose.Schema({}, { strict: false }), 'producto');
const Venta    = mongoose.model('Ventas',   new mongoose.Schema({}, { strict: false }), 'Ventas');

// ==========================================================
// CREAR ÍNDICES (para consultas rápidas con millones de filas)
// ==========================================================
async function crearIndices() {
    try {
        await Venta.collection.createIndex({ fecha: 1 });
        await Venta.collection.createIndex({ sucursal: 1 });
        await Venta.collection.createIndex({ categoria: 1 });
        await Venta.collection.createIndex({ id_cliente: 1 });
        await Cliente.collection.createIndex({ id_cliente: 1 });
        await Producto.collection.createIndex({ id_producto: 1 });
        console.log("📑 Índices creados/verificados correctamente.");
    } catch (err) {
        console.error("⚠️ Error creando índices:", err.message);
    }
}

// ==========================================================
// HELPER: Construir filtro de fecha
// ==========================================================
function filtroFecha(query) {
    const { desde, hasta } = query;
    if (!desde && !hasta) return {};

    const filtro = { fecha: {} };
    if (desde) filtro.fecha.$gte = desde;
    if (hasta) filtro.fecha.$lte = hasta;
    return filtro;
}

// ==========================================================
// POST: GUARDAR EXCEL EN MONGODB
// ==========================================================
app.post('/api/guardar-excel', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload || !payload.collections) {
            return res.status(400).json({ success: false, message: "No se recibieron datos válidos." });
        }

        const { cliente, producto, Ventas } = payload.collections;
        let clientesGuardados = 0, productosGuardados = 0, ventasGuardadas = 0;

        // ---------- CLIENTES ----------
        if (cliente && cliente.length > 0) {
            for (let cli of cliente) {
                let filtro = cli.id_cliente ? { id_cliente: cli.id_cliente } : cli;
                await Cliente.updateOne(filtro, { $set: cli }, { upsert: true });
                clientesGuardados++;
            }
        }

        // ---------- PRODUCTOS ----------
        if (producto && producto.length > 0) {
            for (let prod of producto) {
                let filtro = prod.id_producto ? { id_producto: prod.id_producto } : prod;
                await Producto.updateOne(filtro, { $set: prod }, { upsert: true });
                productosGuardados++;
            }
        }

        // ---------- VENTAS ----------
        if (Ventas && Ventas.length > 0) {
            await Venta.insertMany(Ventas);
            ventasGuardadas = Ventas.length;
        }

        console.log(`📥 Datos guardados: ${clientesGuardados} clientes, ${productosGuardados} productos, ${ventasGuardadas} ventas.`);

        res.status(200).json({
            success: true,
            message: `¡Guardado exitoso! Se procesaron ${clientesGuardados} clientes, ${productosGuardados} productos y ${ventasGuardadas} ventas.`
        });

    } catch (error) {
        console.error("Error al guardar en MongoDB:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================================
// GET: DATOS CRUDOS CON PAGINACIÓN
// ==========================================================

// ---------- VENTAS ----------
app.get('/api/ventas', async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(200, parseInt(req.query.limit) || 50);
        const skip  = (page - 1) * limit;

        const filtro = filtroFecha(req.query);

        const [total, data] = await Promise.all([
            Venta.countDocuments(filtro),
            Venta.find(filtro).sort({ fecha: -1 }).skip(skip).limit(limit).lean()
        ]);

        res.json({
            success: true,
            data,
            paginacion: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------- CLIENTES ----------
app.get('/api/clientes', async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(200, parseInt(req.query.limit) || 50);
        const skip  = (page - 1) * limit;

        const [total, data] = await Promise.all([
            Cliente.countDocuments({}),
            Cliente.find({}).skip(skip).limit(limit).lean()
        ]);

        res.json({
            success: true,
            data,
            paginacion: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------- PRODUCTOS ----------
app.get('/api/productos', async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(200, parseInt(req.query.limit) || 50);
        const skip  = (page - 1) * limit;

        const [total, data] = await Promise.all([
            Producto.countDocuments({}),
            Producto.find({}).skip(skip).limit(limit).lean()
        ]);

        res.json({
            success: true,
            data,
            paginacion: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================================
// GET: DASHBOARD (con agregaciones MongoDB - escalable)
// ==========================================================

// ---------- Rango de fechas reales (para filtro automático) ----------
app.get('/api/dashboard/rango-fechas', async (req, res) => {
    try {
        const r = await Venta.aggregate([
            {
                $group: {
                    _id: null,
                    fechaMin: { $min: "$fecha" },
                    fechaMax: { $max: "$fecha" }
                }
            }
        ]);
        res.json({ success: true, data: r[0] || { fechaMin: null, fechaMax: null } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------- KPIs ----------
app.get('/api/dashboard/kpis', async (req, res) => {
    try {
        const filtro = filtroFecha(req.query);

        const r = await Venta.aggregate([
            { $match: filtro },
            {
                $group: {
                    _id: null,
                    ventasTotales:  { $sum: "$total_cobrado" },
                    costoTotal:     { $sum: "$costo_total" },
                    cantidadVentas: { $sum: 1 },
                    clientesUnicos: { $addToSet: "$id_cliente" }
                }
            },
            {
                $project: {
                    _id: 0,
                    ventasTotales: 1,
                    costoTotal: 1,
                    utilidadBruta: { $subtract: ["$ventasTotales", "$costoTotal"] },
                    margenBruto: {
                        $cond: [
                            { $eq: ["$ventasTotales", 0] }, 0,
                            { $multiply: [
                                { $divide: [
                                    { $subtract: ["$ventasTotales", "$costoTotal"] },
                                    "$ventasTotales"
                                ]}, 100
                            ]}
                        ]
                    },
                    ticketPromedio: {
                        $cond: [
                            { $eq: ["$cantidadVentas", 0] }, 0,
                            { $divide: ["$ventasTotales", "$cantidadVentas"] }
                        ]
                    },
                    clientesUnicos: { $size: "$clientesUnicos" }
                }
            }
        ]);

        res.json({ success: true, data: r[0] || {} });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------- Ventas por sucursal (donut) ----------
app.get('/api/dashboard/ventas-por-sucursal', async (req, res) => {
    try {
        const filtro = filtroFecha(req.query);
        const data = await Venta.aggregate([
            { $match: filtro },
            { $group: { _id: "$sucursal", total: { $sum: "$total_cobrado" } } },
            { $sort: { total: -1 } }
        ]);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------- Ventas por categoría (barras) ----------
app.get('/api/dashboard/ventas-por-categoria', async (req, res) => {
    try {
        const filtro = filtroFecha(req.query);
        const data = await Venta.aggregate([
            { $match: filtro },
            { $group: { _id: "$categoria", total: { $sum: "$total_cobrado" } } },
            { $sort: { total: -1 } }
        ]);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------- Tendencia diaria (línea) ----------
app.get('/api/dashboard/tendencia-diaria', async (req, res) => {
    try {
        const filtro = filtroFecha(req.query);
        const data = await Venta.aggregate([
            { $match: filtro },
            { $group: { _id: "$fecha", total: { $sum: "$total_cobrado" } } },
            { $sort: { _id: 1 } }
        ]);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------- Top 5 clientes (BI Clientes) ----------
app.get('/api/dashboard/top-clientes', async (req, res) => {
    try {
        const filtro = filtroFecha(req.query);
        const limit = Math.min(20, parseInt(req.query.limit) || 5);

        const data = await Venta.aggregate([
            { $match: filtro },
            {
                $group: {
                    _id: "$id_cliente",
                    total: { $sum: "$total_cobrado" },
                    sucursales: { $addToSet: "$sucursal" },
                    cantidad: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } },
            { $limit: limit }
        ]);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------- Márgenes por sucursal (BI Sucursales) ----------
app.get('/api/dashboard/margenes-sucursal', async (req, res) => {
    try {
        const filtro = filtroFecha(req.query);
        const data = await Venta.aggregate([
            { $match: filtro },
            {
                $group: {
                    _id: "$sucursal",
                    ventas: { $sum: "$total_cobrado" },
                    costos: { $sum: "$costo_total" }
                }
            },
            {
                $project: {
                    _id: 1,
                    ventas: 1,
                    costos: 1,
                    margen: {
                        $cond: [
                            { $eq: ["$ventas", 0] }, 0,
                            { $multiply: [
                                { $divide: [
                                    { $subtract: ["$ventas", "$costos"] },
                                    "$ventas"
                                ]}, 100
                            ]}
                        ]
                    }
                }
            },
            { $sort: { ventas: -1 } }
        ]);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================================
// INICIO DEL SERVIDOR
// ==========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
    console.log(`🌐 Abre tu panel en: http://localhost:${PORT}/index.html`);
});
