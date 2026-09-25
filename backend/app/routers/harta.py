import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from ..models import HartaScan

router = APIRouter(prefix="/api/harta", tags=["Harta Scans"])

VALID_GRAMASI = {"1", "5", "10", "20", "25", "50"}

class ScanRequest(BaseModel):
    device_id: str
    url_harta: str
    id_mandiri: str
    gramasi: Optional[str] = None

class ScanResponse(BaseModel):
    success: bool
    message: str
    id: int
    device_id: str
    waktu_scan: str
    url_harta: str
    id_mandiri: str
    gramasi: Optional[str]
    total_records: int

@router.post("/scan", response_model=ScanResponse)
def create_harta_scan(payload: ScanRequest, db: Session = Depends(get_db)):
    if not payload.url_harta or not payload.url_harta.strip():
        raise HTTPException(status_code=400, detail="Data QR Harta tidak boleh kosong.")
    if not payload.id_mandiri or not payload.id_mandiri.strip():
        raise HTTPException(status_code=400, detail="Data ID Mandiri tidak boleh kosong.")
    if payload.gramasi and payload.gramasi not in VALID_GRAMASI:
        raise HTTPException(status_code=400, detail=f"Gramasi tidak valid. Pilihan: {', '.join(sorted(VALID_GRAMASI, key=int))} gram.")

    device_name = payload.device_id.strip() if payload.device_id else "Default Device"

    new_scan = HartaScan(
        device_id=device_name,
        url_harta=payload.url_harta.strip(),
        id_mandiri=payload.id_mandiri.strip(),
        gramasi=payload.gramasi,
        scanned_at=datetime.datetime.utcnow()
    )
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)

    total_count = db.query(HartaScan).count()

    local_time = new_scan.scanned_at + datetime.timedelta(hours=7)
    waktu_str = local_time.strftime("%Y-%m-%d %H:%M:%S")

    return ScanResponse(
        success=True,
        message="Data scan Harta berhasil disimpan ke database.",
        id=new_scan.id,
        device_id=new_scan.device_id,
        waktu_scan=waktu_str,
        url_harta=new_scan.url_harta,
        id_mandiri=new_scan.id_mandiri,
        gramasi=new_scan.gramasi,
        total_records=total_count
    )

@router.get("/history")
def get_harta_history(
    limit: int = Query(50, ge=1, le=500),
    device_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(HartaScan)
    if device_id and device_id.strip():
        query = query.filter(HartaScan.device_id == device_id.strip())

    total_records = query.count()
    items = query.order_by(desc(HartaScan.id)).limit(limit).all()

    result_items = []
    for item in items:
        loc_time = item.scanned_at + datetime.timedelta(hours=7)
        result_items.append({
            "id": item.id,
            "device_id": item.device_id,
            "waktu": loc_time.strftime("%Y-%m-%d %H:%M:%S"),
            "url_harta": item.url_harta,
            "id_mandiri": item.id_mandiri,
            "gramasi": item.gramasi
        })

    return {
        "total_records": total_records,
        "items": result_items
    }
