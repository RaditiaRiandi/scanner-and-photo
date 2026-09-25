import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from .database import Base

class HartaScan(Base):
    __tablename__ = "harta_scans"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), index=True, nullable=False)
    url_harta = Column(Text, nullable=False)
    id_mandiri = Column(String(100), nullable=False)
    gramasi = Column(String(10), nullable=True, index=True)   # e.g. "1", "5", "10", "20", "25", "50"
    scanned_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

class AntamPhoto(Base):
    __tablename__ = "antam_photos"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    filepath = Column(Text, nullable=False)
    gramasi = Column(String(10), nullable=True, index=True)   # e.g. "1", "5", "20", "25", "50"
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
