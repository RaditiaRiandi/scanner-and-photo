import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .database import engine, Base
from .routers import harta, antam, stats, export

# Buat tabel otomatis jika belum ada di database
Base.metadata.create_all(bind=engine)

# Migrasi kolom baru (aman dijalankan berulang kali — IF NOT EXISTS)
def run_migrations():
    with engine.connect() as conn:
        # Antam: gramasi + device_id size
        conn.execute(text(
            "ALTER TABLE antam_photos ADD COLUMN IF NOT EXISTS gramasi VARCHAR(10)"
        ))
        conn.execute(text(
            "ALTER TABLE antam_photos ALTER COLUMN device_id TYPE VARCHAR(100)"
        ))
        # Harta: gramasi + device_id size
        conn.execute(text(
            "ALTER TABLE harta_scans ADD COLUMN IF NOT EXISTS gramasi VARCHAR(10)"
        ))
        conn.execute(text(
            "ALTER TABLE harta_scans ALTER COLUMN device_id TYPE VARCHAR(100)"
        ))
        conn.commit()

try:
    run_migrations()
except Exception as e:
    print(f"[Migration] Info: {e}")

app = FastAPI(
    title="Plan C — Sistem Terpadu Harta & Antam",
    description="Sistem client-server terpadu untuk pendataan Harta (Scan QR) dan Antam (Foto) berbasis Docker & PostgreSQL.",
    version="2.0.0"
)

# CORS middleware agar device lain di jaringan LAN leluasa akses API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Daftarkan Router API
app.include_router(harta.router)
app.include_router(antam.router)
app.include_router(stats.router)
app.include_router(export.router)

# Mount folder static untuk Frontend UI
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", "8089"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
