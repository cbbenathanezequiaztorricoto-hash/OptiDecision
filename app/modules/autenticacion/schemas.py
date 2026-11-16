# app/modules/autenticacion/schemas.py
# Esquemas Pydantic para Autenticación, Registro y JWT.

from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator


class UsuarioRegistroInput(BaseModel):
    email: EmailStr = Field(..., description="Correo electrónico del usuario")
    username: str = Field(..., min_length=3, max_length=50, description="Nombre de usuario único")
    password: str = Field(..., min_length=6, description="Contraseña de al menos 6 caracteres")

    @field_validator("username")
    @classmethod
    def validar_username_limpio(cls, v: str) -> str:
        username_limpio = v.strip()
        if " " in username_limpio:
            raise ValueError("El nombre de usuario no debe contener espacios en blanco.")
        return username_limpio


class UsuarioLoginInput(BaseModel):
    email: EmailStr = Field(..., description="Correo electrónico del usuario")
    password: str = Field(..., description="Contraseña del usuario")


class GoogleAuthInput(BaseModel):
    credential: Optional[str] = Field(default=None, description="ID Token enviado por Google Identity Services")
    id_token: Optional[str] = Field(default=None, description="Alias de compatibilidad para el token de Google")


class TokenOutput(BaseModel):
    access_token: str = Field(..., description="Token JWT para autenticar peticiones HTTP")
    token_type: str = Field(default="bearer", description="Tipo de token de autorización")
    username: str = Field(..., description="Nombre del usuario autenticado")
    email: str = Field(..., description="Correo del usuario autenticado")
    rol: str = Field(default="cliente", description="Rol del usuario: cliente, ferretero o admin")


class UsuarioPerfilOutput(BaseModel):
    id_usuario: int= Field(..., description="ID único del usuario en base de datos")
    email: str = Field(..., description="Correo del usuario")
    username: str = Field(..., description="Nombre de usuario")
    rol: str = Field(default="cliente", description="Rol del usuario")
    google_id: Optional[str] = Field(default=None, description="ID de Google del usuario")
    id_ferreteria: Optional[int] = Field(default=None, description="ID de la ferreteria asociada")
    nombre_ferreteria: Optional[str] = Field(default=None, description="Nombre de la ferreteria asociada")
    fecha_registro: datetime = Field(..., description="Fecha de registro del usuario")


class RegistroFerreteriaInput(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=150)
    direccion: str = Field(..., min_length=5)
    latitud: float = Field(..., ge=-90, le=90)
    longitud: float = Field(..., ge=-180, le=180)
    superficie_almacen_m2: float = Field(default=150.0, ge=0)
    capacidad_canales_atencion: int = Field(default=1, ge=1)


class CambioRolInput(BaseModel):
    rol: Literal["cliente", "ferretero", "admin"] = Field(..., description="Nuevo rol del usuario")
