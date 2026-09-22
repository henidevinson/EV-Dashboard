from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.database.models import FaultRecord, RawFrameAudit, TelemetryRecord, Trip
from app.database.session import get_db
from app.services.trip_service import trip_manager

router = APIRouter()


@router.get("/telemetry")
async def get_historical_telemetry(
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    records = db.query(TelemetryRecord).order_by(TelemetryRecord.timestamp_utc.desc()).limit(limit).all()
    return records


@router.get("/trips")
async def get_trips(
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    trips = db.query(Trip).order_by(Trip.start_time_utc.desc()).limit(limit).all()
    return trips


@router.get("/trips/{trip_id}")
async def get_trip_details(
    trip_id: int,
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.get("/trips/{trip_id}/telemetry")
async def get_trip_telemetry_series(
    trip_id: int,
    limit: int = Query(200, ge=10, le=1000),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    query = db.query(TelemetryRecord).filter(TelemetryRecord.timestamp_utc >= trip.start_time_utc)
    if trip.end_time_utc:
        query = query.filter(TelemetryRecord.timestamp_utc <= trip.end_time_utc)

    records = query.order_by(TelemetryRecord.timestamp_utc.asc()).limit(limit).all()
    return records


@router.post("/trips/start")
async def start_new_trip(db: Session = Depends(get_db)):
    trip = trip_manager.start_trip(db)
    return {"message": "Trip started", "trip_id": trip.id}


@router.post("/trips/stop")
async def stop_current_trip(db: Session = Depends(get_db)):
    trip = trip_manager.end_trip(db)
    if not trip:
        return {"message": "No active trip to stop"}
    return {"message": "Trip stopped", "trip_id": trip.id, "distance_km": trip.distance_km}


@router.get("/diagnostics/faults")
async def get_fault_history(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    faults = db.query(FaultRecord).order_by(FaultRecord.timestamp_utc.desc()).limit(limit).all()
    return faults


@router.get("/diagnostics/raw-frames")
async def get_raw_frame_audit(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    frames = db.query(RawFrameAudit).order_by(RawFrameAudit.timestamp_utc.desc()).limit(limit).all()
    return frames
