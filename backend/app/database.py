import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DB_USER = os.getenv("DB_USER", "planc_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "planc_secret")
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "planc_db")

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Fallback ke sqlite jika dijalankan testing lokal tanpa container docker database
if os.getenv("USE_SQLITE", "false").lower() == "true":
    DATABASE_URL = "sqlite:///./local_planc.db"

engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
