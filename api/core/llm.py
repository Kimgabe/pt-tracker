"""Unified LLM client factory with optional fallback routing.

For paid providers (OpenAI / Anthropic) we trust the primary model and skip
the free-model fallback chain — those models exist to rescue OpenRouter free
tier when it returns 429/empty.
"""
import logging
from openai import OpenAI
from core.config import settings

logger = logging.getLogger(__name__)

# Free OpenRouter models — only used when primary provider IS openrouter
FREE_MODELS = [
    "arcee-ai/trinity-large-preview:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-27b-it:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "google/gemma-3-12b-it:free",
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
]


def _resolve_provider() -> str:
    """Resolve effective provider, considering auto-detect order."""
    p = settings.llm_provider
    if p in ("anthropic", "openai", "openrouter", "nvidia_nim"):
        # Honor explicit choice if its key is set
        key_map = {
            "anthropic": settings.anthropic_api_key,
            "openai": settings.openai_api_key,
            "openrouter": settings.openrouter_api_key,
            "nvidia_nim": settings.nvidia_api_key,
        }
        if key_map.get(p):
            return p
    # Auto-detect priority: openai > anthropic > openrouter > nvidia
    if settings.openai_api_key:
        return "openai"
    if settings.anthropic_api_key:
        return "anthropic"
    if settings.openrouter_api_key:
        return "openrouter"
    if settings.nvidia_api_key:
        return "nvidia_nim"
    raise RuntimeError(
        "No LLM API key configured. Set one of: "
        "ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or NVIDIA_API_KEY"
    )


def get_llm_client() -> tuple[OpenAI | None, str]:
    """Get configured LLM client and model name.

    Returns:
        Tuple of (OpenAI-compatible client, model_name)
        When model_name == "anthropic", client is None (use Anthropic SDK directly).
    """
    provider = _resolve_provider()

    if provider == "anthropic":
        return None, "anthropic"

    if provider == "openai":
        return OpenAI(api_key=settings.openai_api_key), settings.openai_model_default

    if provider == "openrouter":
        return OpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
        ), settings.openrouter_model

    if provider == "nvidia_nim":
        return OpenAI(
            api_key=settings.nvidia_api_key,
            base_url=settings.nvidia_base_url,
        ), settings.nvidia_model

    raise RuntimeError(f"Unsupported provider: {provider}")


def call_llm_with_fallback(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 2000,
    model_override: str | None = None,
    use_json_mode: bool = False,
) -> str:
    """Call LLM, optionally with stage-specific model + JSON mode.

    Behavior by provider:
    - openai: uses model_override (or default), JSON mode enabled if requested,
      no free-model fallback. One transient retry on rate limit.
    - anthropic: uses claude-sonnet-4 (model_override ignored).
    - openrouter / nvidia_nim: tries primary then walks FREE_MODELS chain.

    Returns the LLM response text.
    """
    provider = _resolve_provider()

    # === Anthropic path ===
    if provider == "anthropic":
        from anthropic import Anthropic
        anthropic_client = Anthropic(api_key=settings.anthropic_api_key)
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return response.content[0].text

    # === OpenAI path (paid, trusted) ===
    if provider == "openai":
        client = OpenAI(api_key=settings.openai_api_key)
        model = model_override or settings.openai_model_default
        kwargs: dict = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
        }
        if use_json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            response = client.chat.completions.create(**kwargs)
            result = response.choices[0].message.content or ""
            if result.strip():
                return result
            logger.warning(f"LLM empty response from {model}")
        except Exception as e:
            logger.warning(f"LLM error from {model}: {str(e)[:120]}")
            raise
        return ""

    # === OpenRouter / NVIDIA path (free, walk fallback chain) ===
    client, primary_model = get_llm_client()
    models_to_try = [primary_model] + [m for m in FREE_MODELS if m != primary_model]

    if settings.openrouter_api_key:
        fallback_client = OpenAI(
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
        )
    else:
        fallback_client = client

    last_error = None
    for model in models_to_try:
        try:
            use_client = client if model == primary_model else fallback_client
            assert use_client is not None
            response = use_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=max_tokens,
            )
            result = response.choices[0].message.content
            if result and result.strip():
                if model != primary_model:
                    logger.info(f"LLM fallback: {primary_model} → {model}")
                return result
            logger.warning(f"LLM empty response from {model}, trying next...")
        except Exception as e:
            error_str = str(e)
            last_error = e
            if "429" in error_str or "rate" in error_str.lower():
                logger.warning(f"LLM rate limited: {model}, trying next...")
            elif "404" in error_str:
                logger.warning(f"LLM model not found: {model}, trying next...")
            else:
                logger.warning(f"LLM error from {model}: {error_str[:80]}, trying next...")

    raise RuntimeError(
        f"All {len(models_to_try)} LLM models failed. Last error: {last_error}"
    )
