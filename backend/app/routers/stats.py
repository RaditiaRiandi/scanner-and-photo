import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date

from ..database import get_db
from ..models import HartaScan, AntamPhoto

router = APIRouter(prefix="/api/stats", tags=["Statistics & Counter"])

GRAMASI_LIST_HARTA  = [1, 5, 10, 20, 25, 50]
GRAMASI_LIST_ANTAM  = [1, 5, 20, 25, 50]

@router.get("/counter")
def get_live_counter(db: Session = Depends(get_db)):
    total_harta = db.query(HartaScan).count()
    total_antam = db.query(AntamPhoto).count()

    # Breakdown gramasi Antam
    antam_gramasi_raw = (
        db.query(AntamPhoto.gramasi, func.count(AntamPhoto.id))
        .group_by(AntamPhoto.gramasi)
        .all()
    )
    antam_gramasi_stats = {}
    total_gram_antam = 0
    for g, count in antam_gramasi_raw:
        key = g if g else "unknown"
        gram_val = int(g) if g and g.isdigit() else 0
        subtotal = gram_val * count
        antam_gramasi_stats[key] = {"count": count, "gram_per_pcs": gram_val, "total_gram": subtotal}
        total_gram_antam += subtotal
    for g in GRAMASI_LIST_ANTAM:
        k = str(g)
        if k not in antam_gramasi_stats:
            antam_gramasi_stats[k] = {"count": 0, "gram_per_pcs": g, "total_gram": 0}

    # Breakdown gramasi Harta
    harta_gramasi_raw = (
        db.query(HartaScan.gramasi, func.count(HartaScan.id))
        .group_by(HartaScan.gramasi)
        .all()
    )
    harta_gramasi_stats = {}
    total_gram_harta = 0
    for g, count in harta_gramasi_raw:
        key = g if g else "unknown"
        gram_val = int(g) if g and g.isdigit() else 0
        subtotal = gram_val * count
        harta_gramasi_stats[key] = {"count": count, "gram_per_pcs": gram_val, "total_gram": subtotal}
        total_gram_harta += subtotal
    for g in GRAMASI_LIST_HARTA:
        k = str(g)
        if k not in harta_gramasi_stats:
            harta_gramasi_stats[k] = {"count": 0, "gram_per_pcs": g, "total_gram": 0}

    # Breakdown per device
    harta_by_device = (
        db.query(HartaScan.device_id, func.count(HartaScan.id))
        .group_by(HartaScan.device_id).all()
    )
    antam_by_device = (
        db.query(AntamPhoto.device_id, func.count(AntamPhoto.id))
        .group_by(AntamPhoto.device_id).all()
    )
    devices_stats = {}
    for dev, count in harta_by_device:
        devices_stats.setdefault(dev, {"harta": 0, "antam": 0})
        devices_stats[dev]["harta"] = count
    for dev, count in antam_by_device:
        devices_stats.setdefault(dev, {"harta": 0, "antam": 0})
        devices_stats[dev]["antam"] = count

    return {
        "status": "online",
        "total_harta": total_harta,
        "total_antam": total_antam,
        "total_gram_antam": total_gram_antam,
        "total_gram_harta": total_gram_harta,
        "gramasi_breakdown": antam_gramasi_stats,
        "harta_gramasi_breakdown": harta_gramasi_stats,
        "devices": devices_stats
    }


@router.get("/daily")
def get_daily_stats(
    days: int = 14,
    db: Session = Depends(get_db)
):
    """Statistik harian: berapa scan Harta + foto Antam per hari (14 hari terakhir default)."""
    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)

    # Harta per hari (UTC date → WIB+7)
    harta_daily = (
        db.query(
            cast(HartaScan.scanned_at, Date).label("day"),
            func.count(HartaScan.id).label("count")
        )
        .filter(HartaScan.scanned_at >= since)
        .group_by(cast(HartaScan.scanned_at, Date))
        .all()
    )
    # Antam per hari
    antam_daily = (
        db.query(
            cast(AntamPhoto.uploaded_at, Date).label("day"),
            func.count(AntamPhoto.id).label("count")
        )
        .filter(AntamPhoto.uploaded_at >= since)
        .group_by(cast(AntamPhoto.uploaded_at, Date))
        .all()
    )

    # Kumpulkan semua tanggal (UTC date)
    all_dates = set()
    harta_map = {}
    antam_map = {}

    for row in harta_daily:
        day_str = str(row.day)
        harta_map[day_str] = row.count
        all_dates.add(day_str)
    for row in antam_daily:
        day_str = str(row.day)
        antam_map[day_str] = row.count
        all_dates.add(day_str)

    # Isi juga hari-hari yang missing
    today_utc = datetime.date.today()
    for i in range(days):
        d = today_utc - datetime.timedelta(days=i)
        all_dates.add(str(d))

    sorted_dates = sorted(all_dates)

    result = []
    for d in sorted_dates:
        result.append({
            "date": d,
            "harta": harta_map.get(d, 0),
            "antam": antam_map.get(d, 0),
            "total": harta_map.get(d, 0) + antam_map.get(d, 0)
        })

    return {"days": result}
