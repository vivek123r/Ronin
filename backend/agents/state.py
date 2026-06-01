import operator
from typing import TypedDict, Annotated, List, Dict, Any


class Blackboard(TypedDict):
    query:                str
    search_keyword:       str
    mode:                 str          # "discovery" | "comparison"
    comparison_products:  List[str]
    budget_type:          str          # "under" | "around" | "range" | "none"
    budget_min:           int
    budget_max:           int
    raw_findings:         Annotated[List[dict], operator.add]
    agent_opinions:       Dict[str, Any]
    confidence:           Dict[str, float]
    notes:                Annotated[List[str], operator.add]
    final_recommendation: Dict[str, Any]
