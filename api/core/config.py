from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "production"
    app_debug: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # CORS
    allowed_origins: list[str] = [
        "https://pt-tracker-rho.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    # LLM Provider selection: "anthropic" | "openai" | "openrouter" | "nvidia_nim"
    llm_provider: str = "openrouter"  # Default to free provider

    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # OpenAI model routing per stage (used when llm_provider == "openai")
    openai_model_default: str = "gpt-4.1-mini"
    openai_model_ner: str = "gpt-4.1-mini"        # Stage 1: extract names
    openai_model_structure: str = "gpt-4.1-mini"  # Stage 2: structure + segment_index
    openai_model_meta: str = "gpt-4.1-nano"       # Stage 3: nutrition / metadata (light)
    openai_model_generate: str = "gpt-4.1-mini"   # Full recipe/workout AI generation

    # OpenRouter (free models available)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct:free"

    # NVIDIA NIM (free models available)
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model: str = "meta/llama-3.3-70b-instruct"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
