"""Runtime settings for PT Tracker analysis service."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    openai_model_ner: str = os.getenv("OPENAI_MODEL_NER", "gpt-4o-mini")
    openai_model_structure: str = os.getenv("OPENAI_MODEL_STRUCTURE", "gpt-4o-mini")
    openai_model_meta: str = os.getenv("OPENAI_MODEL_META", "gpt-4o-mini")
    whisper_model: str = os.getenv("WHISPER_MODEL", "whisper-1")


settings = Settings()
