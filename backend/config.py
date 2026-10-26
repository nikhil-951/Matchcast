"""
MatchCast AI Backend Configuration
Loads environment variables and initializes the Azure OpenAI client.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Optional

# Ensure package imports resolve
_config_dir = Path(__file__).resolve().parent
_root_dir = _config_dir.parent
for _p in [str(_root_dir), str(_config_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from dotenv import load_dotenv
from openai import AsyncAzureOpenAI
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Search for .env in current directory or parent directories
env_paths = [
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
]
for p in env_paths:
    if p.exists():
        load_dotenv(dotenv_path=p, override=False)
        break
else:
    load_dotenv()


class AppSettings(BaseModel):
    """Application settings and environment configuration."""

    azure_openai_endpoint: str = Field(
        default_factory=lambda: os.getenv("AZURE_OPENAI_ENDPOINT", "")
    )
    azure_openai_api_key: str = Field(
        default_factory=lambda: os.getenv("AZURE_OPENAI_API_KEY", "")
    )
    azure_openai_deployment: str = Field(
        default_factory=lambda: os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    )
    azure_openai_api_version: str = Field(
        default_factory=lambda: os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01")
    )
    data_dir: Path = Field(
        default_factory=lambda: Path(
            os.getenv("DATA_DIR", str(Path(__file__).resolve().parent.parent / "data" / "matches"))
        )
    )
    host: str = Field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = Field(default_factory=lambda: int(os.getenv("PORT", "8000")))

    @property
    def is_azure_configured(self) -> bool:
        """Check if real Azure OpenAI credentials are configured."""
        endpoint = self.azure_openai_endpoint.strip()
        api_key = self.azure_openai_api_key.strip()
        is_dummy_endpoint = "your-resource" in endpoint or not endpoint.startswith("http")
        is_dummy_key = "your-api-key" in api_key or len(api_key) < 10
        return bool(endpoint and api_key and not is_dummy_endpoint and not is_dummy_key)


settings = AppSettings()

# Ensure DATA_DIR directory exists
settings.data_dir.mkdir(parents=True, exist_ok=True)

_async_client: Optional[AsyncAzureOpenAI] = None


def get_openai_client() -> Optional[AsyncAzureOpenAI]:
    """
    Get or initialize the AsyncAzureOpenAI client.
    Returns None if credentials are missing or invalid, activating fallback mode.
    """
    global _async_client
    if not settings.is_azure_configured:
        return None

    if _async_client is None:
        try:
            _async_client = AsyncAzureOpenAI(
                azure_endpoint=settings.azure_openai_endpoint,
                api_key=settings.azure_openai_api_key,
                api_version=settings.azure_openai_api_version,
                timeout=8.0,
            )
            logger.info("Initialized AsyncAzureOpenAI client with endpoint: %s", settings.azure_openai_endpoint)
        except Exception as exc:
            logger.warning("Failed to initialize AsyncAzureOpenAI client (%s). Fallback mode active.", exc)
            _async_client = None

    return _async_client
