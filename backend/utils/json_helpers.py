import re
import json


def extract_json(text: str) -> dict:
    """Robustly extract JSON from LLM response — handles markdown, extra text, etc."""
    try:
        return json.loads(text)
    except Exception:
        pass

    cleaned = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end+1])
        except Exception:
            pass

    print(f"\n⚠️  JSON parse failed. Raw LLM output was:\n{'-'*40}\n{text}\n{'-'*40}")
    return {}


def extract_price_value(price_str: str) -> float:
    """Extract numeric price from string like 'Rs. 45,000' or '$999'"""
    if not price_str:
        return 0.0
    cleaned = re.sub(r'[^\d.]', '', str(price_str))
    try:
        return float(cleaned) if cleaned else 0.0
    except Exception:
        return 0.0
