"""Configurable ATS score weights. Values should sum to 100."""

WEIGHTS = {
    "required": 40,
    "preferred": 10,
    "experience_relevance": 20,
    "keyword_relevance": 15,
    "education": 5,
    "structure": 5,
    "extractability": 5,
}

LABELS = {
    "required": "Required Requirements",
    "preferred": "Preferred Requirements",
    "experience_relevance": "Experience Relevance",
    "keyword_relevance": "Keyword Relevance",
    "education": "Education",
    "structure": "Resume Structure",
    "extractability": "ATS Extractability",
}
