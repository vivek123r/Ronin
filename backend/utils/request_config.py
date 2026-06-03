"""
Thread-local request config — stores per-request API keys so agents
can read them without passing config through every function signature.
Falls back to environment variables if user hasn't provided a key.

Sub-threads spawned by ThreadPoolExecutor inherit config from the
registered pipeline thread (keyed by the thread that called set_config).
"""

import os
import threading
from dotenv import load_dotenv

load_dotenv()

_configs: dict = {}   # tid -> config dict
_lock = threading.Lock()
_main_tid: str = ""   # the pipeline thread that called set_config


def set_config(config: dict):
    global _main_tid
    tid = str(threading.get_ident())
    with _lock:
        _configs[tid] = config or {}
        _main_tid = tid


def clear_config():
    global _main_tid
    tid = str(threading.get_ident())
    with _lock:
        _configs.pop(tid, None)
        if _main_tid == tid:
            _main_tid = ""


def get(key: str) -> str:
    tid = str(threading.get_ident())
    with _lock:
        # Try own thread first, then the registered pipeline thread
        cfg = _configs.get(tid) or _configs.get(_main_tid) or {}
    return cfg.get(key) or os.getenv(key, '')


def get_llm():
    """Instantiate the correct LLM based on user config, falling back to env."""
    from langchain_openai import ChatOpenAI

    tid = str(threading.get_ident())
    with _lock:
        cfg = _configs.get(tid) or _configs.get(_main_tid) or {}

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

    return ChatOpenAI(
        model=resolved_model,
        openai_api_base=p['base_url'],
        openai_api_key=api_key or 'sk-placeholder',
        temperature=0,
    )
