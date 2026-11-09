# app/modules/autenticacion/schemas.py
# Esquemas Pydantic para Autenticación, Registro y JWT.

from typing import Optional
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
    credential: str  # ID Token de Google enviado por el SDK
    id_token: str = Field(..., description="Token de identidad provisto por Google Sign-In SDK")


class TokenOutput(BaseModel):
    access_token: str = Field(..., description="Token JWT para autenticar peticiones HTTP")
    token_type: str = Field(default="bearer", description="Tipo de token de autorización")
    username: str = Field(..., description="Nombre del usuario autenticado")
    email: str = Field(..., description="Correo del usuario autenticado")


class UsuarioPerfilOutput(BaseModel):
    id_usuario: int = Field(..., description="ID único del usuario en base de datos")
    email: str = Field(..., description="Correo electrónico registrado")
    username: str = Field(..., description="Nombre de usuario")
    google_id: Optional[str] = Field(default=None, description="ID único de Google (si aplica)")
    fecha_registro: datetime = Field(..., description="Fecha de creación de la cuenta")