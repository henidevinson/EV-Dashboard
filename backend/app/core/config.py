from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "EV Smart Telemetry Engine"
    API_V1_STR: str = "/api"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # Default to serial mode for instant hardware connection
    TELEMETRY_MODE: str = "serial"
    TELEMETRY_FRESHNESS_TIMEOUT: float = 5.0
    CONTROLLER_PROTOCOL: str = "gwort_ev"

    # Serial Configuration (Matched to Physical Battery: 9600 8-N-1)
    SERIAL_PORT: str = "/dev/ttyUSB0"
    SERIAL_BAUDRATE: int = 9600
    SERIAL_TIMEOUT_SECONDS: float = 0.5

    # CAN Configuration (Staged)
    CAN_INTERFACE: str = "socketcan"
    CAN_CHANNEL: str = "can0"
    CAN_BITRATE: Optional[int] = None

    # Safety Guard
    READ_ONLY_MODE: bool = True
    VOLTAGE_OFFSET: float = 0.0

    # Electrical & Thermal Trip Limits for 72V/84V Pack (20S/21S Li-ion)
    FAULT_MAX_VOLTAGE: float = 88.2          # 4.2V/cell on 21S (Safe peak)
    FAULT_MIN_VOLTAGE: float = 60.0          # 3.0V/cell low cutoff
    FAULT_MAX_DISCHARGE_AMPS: float = 65.0   # Max continuous draw
    FAULT_MAX_CHARGE_AMPS: float = 30.0      # Max regen charge
    FAULT_MAX_MOTOR_TEMP: float = 85.0
    FAULT_MAX_CONTROLLER_TEMP: float = 75.0

    DATABASE_URL: str = "sqlite:///./ev_telemetry.db"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
