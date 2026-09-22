from datetime import datetime, timezone
from typing import Any, Dict, Literal
from pydantic import BaseModel, Field

EventType = Literal["telemetry", "status", "fault", "heartbeat"]


class WebSocketEnvelope(BaseModel):
    type: EventType
    timestamp_utc: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    data: Dict[str, Any]

    def to_json(self) -> str:
        return self.model_dump_json()