import csv
import random

# Materiales referenciales del mercado ferretero en Cochabamba (precios en BOB)
MATERIALES_CBBA = [
    ("Cemento COBOCE IP-30 50kg", 48.50, 3600, 85.0, 6.5, 2, 40),
    ("Fierro Corrugado 1/2 pulg 12m", 72.00, 2400, 120.0, 9.0, 3, 30),
    ("Fierro Corrugado 3/8 pulg 12m", 42.50, 3000, 100.0, 5.5, 3, 35),
    ("Yeso Cochabamba Bolsa 35kg", 21.00, 4200, 60.0, 3.2, 2, 50),
    ("Alambre de Amarre Nro 16 (kg)", 14.50, 1800, 45.0, 2.1, 2, 25),
    ("Clavos Calamina 2.5 pulg (kg)", 16.00, 1400, 40.0, 2.4, 2, 20),
    ("Tuberia PVC Tigre Desague 2 pulg 6m", 34.00, 960, 70.0, 4.8, 4, 15),
    ("Pintura Latex Monopol 18L Blanco", 310.00, 360, 90.0, 28.0, 4, 8),
]

random.seed(42)
ferreterias = []

with open("ferreterias_cbba.csv", "r", encoding="utf-8-sig") as f:
    for fila in csv.DictReader(f):
        nombre = (fila.get("name") or fila.get("nombre") or "").strip()
        if nombre and nombre.lower() != "null":
            ferreterias.append(nombre)

with open("catalogo_cbba_listo.csv", "w", newline="", encoding="utf-8-sig") as out:
    writer = csv.writer(out)
    writer.writerow([
        "ferreteria", "nombre", "precio_bob", "stock_actual",
        "demanda_anual_D", "costo_pedido_K", "costo_mantenimiento_H",
        "tiempo_entrega_dias_L", "stock_seguridad_SS"
    ])
    for ferr in dict.fromkeys(ferreterias):
        # Cada sucursal ofrece entre 5 y 8 productos con precios y stocks propios del mercado
        surtido = random.sample(MATERIALES_CBBA, k=random.randint(5, len(MATERIALES_CBBA)))
        for prod, precio_base, dem, k, h, l, ss in surtido:
            precio_real = round(precio_base * random.uniform(0.95, 1.07), 2)
            stock_real = random.randint(15, 320)
            writer.writerow([ferr, prod, precio_real, stock_real, dem, k, h, l, ss])

print("Listo: catalogo_cbba_listo.csv generado.")