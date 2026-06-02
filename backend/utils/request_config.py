"""
Thread-local request config — stores per-request API keys so agents
can read them without passing config through every function signature.
Falls back to environment variables if user hasn't provided a key.
"""

import os
import threading
from dotenv import load_dotenv

load_dotenv()

_local = threading.local()


def set_config(config: dict):
    _local.config = config or {}


def clear_config():
    _local.config = {}


def get(key: str) -> str:
    cfg = getattr(_local, 'config', {})
    return cfg.get(key) or os.getenv(key, '')


def get_llm():
    """Instantiate the correct LLM based on user config, falling back to env."""
    from langchain_openai import ChatOpenAI

    cfg = getattr(_local, 'config', {})
    provider = cfg.get('LLM_PROVIDER') or os.getenv('LLM_PROVIDER', 'openrouter')
    api_key  = cfg.get('LLM_API_KEY')  or os.getenv('OPENROUTER_API_KEY', '')
    model    = cfg.get('LLM_MODEL', '').strip()

    PROVIDERS = {
        'openrouter': {
            'base_url': 'https://openrouter.ai/api/v1',
            'default_model': 'deepseek/deepseek-v4-flash',
        },
        'openai': {
            'base_url': 'https://api.openai.com/v1',
            'default_model': 'gpt-4o-mini',
        },
        'anthropic': {
            'base_url': 'https://api.anthropic.com/v1',
            'default_model': 'claude-haiku-4-5-20251001',
        },
        'groq': {
            'base_url': 'https://api.groq.com/openai/v1',
            'default_model': 'llama-3.3-70b-versatile',
        },
        'together': {
            'base_url': 'https://api.together.xyz/v1',
            'default_model': 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        },
        'mistral': {
            'base_url': 'https://api.mistral.ai/v1',
            'default_model': 'mistral-small-latest',
        },
        'ollama': {
            'base_url': 'http://localhost:11434/v1',
            'default_model': 'llama3.2',
        },
    }

    p = PROVIDERS.get(provider, PROVIDERS['openrouter'])
    resolved_model = model or p['default_model']

    # Anthropic via LangChain needs the anthropic SDK but ChatOpenAI
    # works with Anthropic's OpenAI-compatible endpoint too
    return ChatOpenAI(
        model=resolved_model,
        openai_api_base=p['base_url'],
        openai_api_key=api_key or 'sk-placeholder',
        temperature=0,
    )
