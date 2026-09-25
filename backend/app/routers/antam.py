import os
import re
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from ..models import AntamPhoto

router = APIRouter(prefix="/api/antam", tags=["Antam Photos"])

PHOTOS_BASE_DIR = os.getenv("PHOTOS_DIR", "/app/photos")

VALID_GRAMASI = {"1", "5", "20", "25", "50"}

def sanitize_folder_name(name: str) -> str:
    """Bersihkan nama device untuk digunakan sebagai nama folder (aman untuk filesystem)."""
    clean = re.sub(r'[\\/:*?"<>|]', '', name).strip()
    clean = re.sub(r'\s+', '_', clean)
    return clean if clean else "default_device"

@router.post("/upload")
async def upload_antam_photo(
    device_id: str = Form(...),
    gramasi: str = Form(...),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not device_id or not device_id.strip():
        raise HTTPException(status_code=400, detail="Nama pengguna (device) wajib diisi.")
    if gramasi not in VALID_GRAMASI:
        raise HTTPException(status_code=400, detail=f"Gramasi tidak valid. Pilihan: {', '.join(sorted(VALID_GRAMASI, key=int))} gram.")

    device_name = device_id.strip()
    clean_device_folder = sanitize_folder_name(device_name)

    # Sub-folder per device
    target_folder = os.path.join(PHOTOS_BASE_DIR, clean_device_folder)
    os.makedirs(target_folder, exist_ok=True)

    # Generate nama file unik: ANTAM_{nama}_{gramasi}g_{timestamp}.ext
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    original_ext = os.path.splitext(photo.filename)[1] if photo.filename else ""
    if not original_ext:
        original_ext = ".jpg"

    save_filename = f"ANTAM_{clean_device_folder}_{gramasi}g_{timestamp_str}{original_ext}"
    full_save_path = os.path.join(target_folder, save_filename)

    # Simpan file ke storage
    try:
        content = await photo.read()
        with open(full_save_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan file foto: {str(e)}")

    # Simpan metadata ke database
    relative_path = f"{clean_device_folder}/{save_filename}"
    new_photo = AntamPhoto(
        device_id=device_name,
        filename=save_filename,
        filepath=relative_path,
        gramasi=gramasi,
        uploaded_at=datetime.datetime.utcnow()
    )
    db.add(new_photo)
    db.commit()
    db.refresh(new_photo)

    total_count = db.query(AntamPhoto).count()
    loc_time = new_photo.uploaded_at + datetime.timedelta(hours=7)

    return {
        "success": True,
        "message": f"Foto {gramasi}g berhasil disimpan ke folder '{clean_device_folder}'.",
        "id": new_photo.id,
        "device_id": new_photo.device_id,
        "gramasi": gramasi,
        "filename": new_photo.filename,
        "filepath": new_photo.filepath,
        "waktu_upload": loc_time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_records": total_count
    }

@router.get("/history")
def get_antam_history(
    limit: int = Query(50, ge=1, le=500),
    device_id: Optional[str] = None,
    gramasi: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AntamPhoto)
    if device_id and device_id.strip():
        query = query.filter(AntamPhoto.device_id == device_id.strip())
    if gramasi and gramasi.strip():
        query = query.filter(AntamPhoto.gramasi == gramasi.strip())

    total_records = query.count()
    items = query.order_by(desc(AntamPhoto.id)).limit(limit).all()

    result_items = []
    for item in items:
        loc_time = item.uploaded_at + datetime.timedelta(hours=7)
        result_items.append({
            "id": item.id,
            "device_id": item.device_id,
            "gramasi": item.gramasi or "-",
            "filename": item.filename,
            "filepath": item.filepath,
            "waktu": loc_time.strftime("%Y-%m-%d %H:%M:%S"),
            "url_view": f"/api/antam/photo/{item.filepath}"
        })

    return {
        "total_records": total_records,
        "items": result_items
    }

@router.get("/photo/{device_folder}/{filename}")
def view_photo_file(device_folder: str, filename: str):
    clean_folder = sanitize_folder_name(device_folder)
    safe_filename = os.path.basename(filename)
    full_path = os.path.join(PHOTOS_BASE_DIR, clean_folder, safe_filename)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File foto tidak ditemukan.")

    return FileResponse(full_path)
