import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY=os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL")
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

