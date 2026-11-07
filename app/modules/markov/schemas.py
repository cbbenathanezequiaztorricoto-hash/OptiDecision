# app/modules/markov/schemas.py
# Este archivo define los contratos de entrada (JSON) y salida de la API para Markov.
 
from typing import List, Dict
from pydantic import BaseModel, Field, field_validator, model_validator

# -------------------------------------------------------------------------
# 1. FUNCIÓN AUXILIAR DE VALIDACIÓN MATEMÁTICA
# -------------------------------------------------------------------------
def validar_rango_probabilidades(matriz: List[List[float]], nombre_matriz: str) -> None:
    """Revisa que todos los números dentro de la matriz 
       estén entre 0.0 y 1.0."""
    if not matriz:
        raise ValueError(f"La {nombre_matriz} no puede estar vacía.")

    for num_fila, fila in enumerate(matriz):
        for valor in fila:
            if valor < 0.0 or valor > 1.0:
                raise ValueError(
                    f"En {nombre_matriz} (fila {num_fila}), el valor {valor} no es una probabilidad válida (debe estar entre 0.0 y 1.0)."
                )

# -------------------------------------------------------------------------
# 2. MODELO DE ENTRADA (LO QUE EL CLIENTE O EL FRONTEND ENVÍA)
# -------------------------------------------------------------------------
class MarkovMatrixInput(BaseModel):
    #El molde recibe los datos de entrada cuando el cliente 
    # hace un POST a la ruta /api/markov/simular, y valida que cumplan 
    # con las condiciones de la clase MarkovMatrixInput
    estados_transitorios: List[str] = Field(
        default=["Busqueda", "VistaProducto", "EnCarrito"],
        description="Nombres de los estados no finales de la aplicación"
    )
    estados_absorbentes: List[str] = Field(
        default=["CompraRealizada", "Abandono"],
        description="Nombres de los estados finales (absorbentes)"
    )
    matriz_Q: List[List[float]] = Field(
        ...,
        description="Matriz Q (k x k): probabilidades entre estados transitorios"
    )
    matriz_R: List[List[float]] = Field(
        ...,
        description="Matriz R (k x r): probabilidades hacia estados absorbentes"
    )
    # VALIDADOR 1: Matriz Q debe ser cuadrada y sus números entre 0 y 1
    @field_validator("matriz_Q") #Nada más reciba el atributo de matriz_Q anteriormente declarado, se ejecuta esta función para validar su contenido

    # Eso hace field_validator, que es un decorador de Pydantic 
    # que permite definir validaciones personalizadas para los campos 
    # de un modelo. En este caso, se está aplicando a la propiedad matriz_Q 
    # del modelo MarkovMatrixInput.

    @classmethod
    def validar_matriz_Q(cls, v: List[List[float]]) -> List[List[float]]:
        validar_rango_probabilidades(v, "matriz_Q")
        k = len(v)
        for num_fila, fila in enumerate(v):
            if len(fila) != k:
                raise ValueError(f"La matriz Q debe ser cuadrada ({k}x{k}). La fila {num_fila} tiene {len(fila)} elementos.")
        return v
    # VALIDADOR 2: Matriz R debe tener tantas filas como Q y números entre 0 y 1
    @field_validator("matriz_R")
    @classmethod
    def validar_matriz_R(cls, v: List[List[float]], info) -> List[List[float]]:
        validar_rango_probabilidades(v, "matriz_R")
        matriz_Q = info.data.get("matriz_Q")
        if matriz_Q and len(v) != len(matriz_Q):
            raise ValueError(f"La matriz R debe tener {len(matriz_Q)} filas (igual que Q), pero tiene {len(v)}.")
        return v
    # VALIDADOR 3: Comprobación global (Suma de cada fila Q + R debe ser 1.0)
    @model_validator(mode="after")
    def validar_consistencia_global(self) -> "MarkovMatrixInput":
        # 1. Validar que no existan nombres duplicados
        if len(set(self.estados_transitorios)) != len(self.estados_transitorios):
            raise ValueError("Los nombres de los estados transitorios no pueden estar duplicados.")
        if len(set(self.estados_absorbentes)) != len(self.estados_absorbentes):
            raise ValueError("Los nombres de los estados absorbentes no pueden estar duplicados.")

        # 2. Validar coincidencia exacta de nombres vs dimensiones (evita IndexError)
        if len(self.estados_transitorios) != len(self.matriz_Q):
            raise ValueError(
                f"La cantidad de estados transitorios ({len(self.estados_transitorios)}) "
                f"no coincide con las filas de Q ({len(self.matriz_Q)})."
            )
        if len(self.matriz_R) > 0 and len(self.estados_absorbentes) != len(self.matriz_R[0]):
            raise ValueError(
                f"La cantidad de estados absorbentes ({len(self.estados_absorbentes)}) "
                f"no coincide con las columnas de R ({len(self.matriz_R[0])})."
            )

        # 3. Validar suma estocástica por fila (Q + R = 1.0)
        for i in range(len(self.matriz_Q)):
            suma_q = sum(self.matriz_Q[i])
            suma_r = sum(self.matriz_R[i])
            suma_total = suma_q + suma_r
            if abs(suma_total - 1.0) > 1e-5:
                raise ValueError(
                    f"Error en fila {i} ({self.estados_transitorios[i]}): "
                    f"La suma Q + R es {suma_total:.4f}, pero DEBE ser 1.0."
                )
        return self


# -------------------------------------------------------------------------
# 3. MODELO DE SALIDA (LO QUE RESPONDE NUESTRA API)
# -------------------------------------------------------------------------
class MarkovResultadoOutput(BaseModel):
    matriz_fundamental_N: List[List[float]] = Field(..., description="Matriz N = (I - Q)^-1")
    matriz_absorcion_B: Dict[str, Dict[str, float]] = Field(..., description="Probabilidad de absorción final")
    pasos_esperados_t: Dict[str, float] = Field(..., description="Pasos promedio antes de la absorción")
    interpretacion_humana: List[str] = Field(..., description="Explicación en lenguaje natural")
