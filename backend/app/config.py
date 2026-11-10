import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")

    DATABASE_URL = os.getenv("DATABASE_URL")

    # Adaptar la URL de Render al controlador psycopg 3.
    if DATABASE_URL:
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace(
                "postgres://",
                "postgresql+psycopg://",
                1
            )
        elif DATABASE_URL.startswith("postgresql://"):
            DATABASE_URL = DATABASE_URL.replace(
                "postgresql://",
                "postgresql+psycopg://",
                1
            )

    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    
    
    SQLALCHEMY_TRACK_MODIFICATIONS=False
    
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    JWT_TOKEN_LOCATION = ["headers"]

    # Orígenes del frontend permitidos por CORS, separados por coma.
    # Ej.: CORS_ORIGINS=http://localhost:3000,https://motoman.midominio.com
    CORS_ORIGINS = [
        origen.strip()
        for origen in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origen.strip()
    ]

    # Datos del emisor que se guardan en cada factura (si el cliente no envía los suyos).
    EMISOR_FACTURA = {
        "nombre": os.getenv("EMISOR_NOMBRE", "MotoMan"),
        "razon_social": os.getenv("EMISOR_RAZON_SOCIAL", "Moto Adictos de Nicaragua"),
        "ruc": os.getenv("EMISOR_RUC", ""),
        "direccion": os.getenv("EMISOR_DIRECCION", "Managua, Nicaragua"),
        "telefono": os.getenv("EMISOR_TELEFONO", ""),
    }

