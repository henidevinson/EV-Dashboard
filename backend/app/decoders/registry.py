from typing import Dict, Type
from app.decoders.base import BaseTelemetryDecoder
from app.decoders.standard_bms import StandardBmsDecoder
from app.decoders.custom_controller import CustomControllerDecoder
from app.decoders.gwort_ev import GwortEvDecoder

DECODER_REGISTRY: Dict[str, Type[BaseTelemetryDecoder]] = {
    "standard_bms": StandardBmsDecoder,
    "custom_controller": CustomControllerDecoder,
    "gwort_ev": GwortEvDecoder,
}


def get_decoder(protocol_name: str = "gwort_ev") -> BaseTelemetryDecoder:
    decoder_cls = DECODER_REGISTRY.get(protocol_name)
    if not decoder_cls:
        raise ValueError(
            f"Unknown protocol '{protocol_name}'. Available: {list(DECODER_REGISTRY.keys())}"
        )
    return decoder_cls()
