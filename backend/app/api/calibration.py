from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from app.core.config import settings
from app.telemetry.state import TelemetryStateManager

router = APIRouter()


def get_telemetry_state(request: Request) -> TelemetryStateManager:
    return request.app.state.telemetry_state


class CalibrationResponse(BaseModel):
    voltage_offset: float
    raw_pack_voltage: Optional[float] = None
    calibrated_pack_voltage: Optional[float] = None
    calibration_formula: str = "V_calibrated = V_raw + voltage_offset"


class CalibrationUpdateRequest(BaseModel):
    voltage_offset: Optional[float] = Field(None, description="Direct offset in Volts to apply")
    multimeter_measured_voltage: Optional[float] = Field(
        None,
        description="Physical voltage measured at pack terminals with a calibrated multimeter",
    )


@router.get("/voltage", response_model=CalibrationResponse)
async def get_voltage_calibration(state: TelemetryStateManager = Depends(get_telemetry_state)):
    """Returns current active voltage offset and live pack voltages."""
    snapshot = state.get_snapshot()
    raw_v = snapshot.telemetry.raw_pack_voltage if snapshot.telemetry else None
    cal_v = snapshot.telemetry.calibrated_pack_voltage if snapshot.telemetry else None

    return CalibrationResponse(
        voltage_offset=settings.VOLTAGE_OFFSET,
        raw_pack_voltage=raw_v,
        calibrated_pack_voltage=cal_v,
    )


@router.post("/voltage", response_model=CalibrationResponse)
async def update_voltage_calibration(
    payload: CalibrationUpdateRequest,
    state: TelemetryStateManager = Depends(get_telemetry_state),
):
    """
    Updates runtime calibration offset.
    If multimeter_measured_voltage is provided:
        offset = multimeter_measured_voltage - raw_pack_voltage
    """
    snapshot = state.get_snapshot()

    if payload.multimeter_measured_voltage is not None:
        if not snapshot.telemetry:
            raise HTTPException(
                status_code=400,
                detail="Cannot calculate offset from multimeter reading: no live raw telemetry received yet.",
            )
        raw_v = snapshot.telemetry.raw_pack_voltage
        calculated_offset = round(payload.multimeter_measured_voltage - raw_v, 2)
        settings.VOLTAGE_OFFSET = calculated_offset
    elif payload.voltage_offset is not None:
        settings.VOLTAGE_OFFSET = round(payload.voltage_offset, 2)
    else:
        raise HTTPException(
            status_code=422,
            detail="Must specify either 'voltage_offset' or 'multimeter_measured_voltage'.",
        )

    # Re-evaluate live calibrated value if telemetry is active
    raw_v = snapshot.telemetry.raw_pack_voltage if snapshot.telemetry else None
    cal_v = round(raw_v + settings.VOLTAGE_OFFSET, 2) if raw_v is not None else None

    return CalibrationResponse(
        voltage_offset=settings.VOLTAGE_OFFSET,
        raw_pack_voltage=raw_v,
        calibrated_pack_voltage=cal_v,
    )