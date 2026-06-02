"""
Backward-compatible shim — callers that do `from backend.utils.llm import llm`
now get a lazy proxy that reads from request_config on every call.
"""
from backend.utils.request_config import get_llm as _get_llm


class _LLMProxy:
    """Delegates every attribute/call to the per-request LLM instance."""
    def __getattr__(self, name):
        return getattr(_get_llm(), name)

    def invoke(self, *a, **kw):
        return _get_llm().invoke(*a, **kw)


llm = _LLMProxy()

