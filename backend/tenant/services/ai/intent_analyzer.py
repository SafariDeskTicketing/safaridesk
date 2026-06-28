from __future__ import annotations

from typing import Dict, Any


class IntentAnalyzer:
    """
    Lightweight intent classifier. Rule-based for now, can be upgraded to LLM.
    Returns intent in: create_ticket | search_kb | general_question | greeting
    """

    def analyze(self, text: str) -> Dict[str, Any]:
        t = (text or '').strip().lower()
        intent = 'general_question'
        confidence = 0.5
        entities: Dict[str, Any] = {}

        if not t:
            return {'intent': intent, 'confidence': 0.0, 'entities': entities}

        # Greeting
        if any(w in t for w in ['hello', 'hi ', 'hi,', 'hey', 'good morning', 'good afternoon']):
            return {'intent': 'greeting', 'confidence': 0.85, 'entities': entities}

        # Create ticket cues
        if any(w in t for w in ['create ticket', 'open ticket', 'raise ticket', 'report issue', 'file a bug', 'support request']):
            return {'intent': 'create_ticket', 'confidence': 0.8, 'entities': entities}
        if any(w in t for w in ['broken', 'not working', 'cannot', "can't", 'error', 'issue', 'fail']):
            intent = 'create_ticket'; confidence = 0.65

        # KB search cues
        if any(w in t for w in ['how to', 'documentation', 'docs', 'guide', 'help article', 'kb']):
            if confidence < 0.75:
                intent = 'search_kb'; confidence = max(confidence, 0.7)

        return {'intent': intent, 'confidence': confidence, 'entities': entities}

