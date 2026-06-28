import json
import logging
from typing import Any, Dict, List, Optional

from django_redis import get_redis_connection

logger = logging.getLogger(__name__)


class ConversationStateManager:
    """
    Stores lightweight conversation state in Redis with TTL.
    Keys are namespaced by business and conversation_id.
    """

    def __init__(self, ttl_seconds: int = 3600):
        self.ttl = ttl_seconds
        self.redis = get_redis_connection("default")

    def _key(self, business_id: int | str, conversation_id: str) -> str:
        return f"chatbot:state:{business_id}:{conversation_id}"

    def set_state(self, business_id: int | str, conversation_id: str, data: Dict[str, Any]) -> None:
        key = self._key(business_id, conversation_id)
        self.redis.setex(key, self.ttl, json.dumps(data))

    def get_state(self, business_id: int | str, conversation_id: str) -> Dict[str, Any]:
        key = self._key(business_id, conversation_id)
        raw = self.redis.get(key)
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def append_message(self, business_id: int | str, conversation_id: str, role: str, content: str) -> None:
        state = self.get_state(business_id, conversation_id)
        history: List[Dict[str, str]] = state.get('history', [])
        history.append({'role': role, 'content': content})
        # Keep last 50
        state['history'] = history[-50:]
        self.set_state(business_id, conversation_id, state)

    def set_intent(self, business_id: int | str, conversation_id: str, intent: str, confidence: float) -> None:
        state = self.get_state(business_id, conversation_id)
        state['intent'] = intent
        state['confidence'] = confidence
        self.set_state(business_id, conversation_id, state)

    def set_extracted(self, business_id: int | str, conversation_id: str, data: Dict[str, Any]) -> None:
        state = self.get_state(business_id, conversation_id)
        state['extracted'] = data
        self.set_state(business_id, conversation_id, state)

    def set_contact_fields(self, business_id: int | str, conversation_id: str, contact: Dict[str, Any]) -> None:
        """
        Store contact fields (name/email/phone) gathered so far.
        """
        state = self.get_state(business_id, conversation_id)
        existing = state.get('contact', {})
        existing.update({k: v for k, v in contact.items() if v is not None})
        state['contact'] = existing
        self.set_state(business_id, conversation_id, state)

    def set_validation_status(
        self,
        business_id: int | str,
        conversation_id: str,
        missing: List[str],
        invalid: Dict[str, str],
        attempts: Optional[Dict[str, int]] = None,
    ) -> None:
        """
        Persist the latest validation outcome for contact fields.
        """
        state = self.get_state(business_id, conversation_id)
        state['validation'] = {
            'missing': missing,
            'invalid': invalid,
            'attempts': attempts or {},
        }
        self.set_state(business_id, conversation_id, state)

    def append_tool_call(self, business_id: int | str, conversation_id: str, tool_call: Dict[str, Any]) -> None:
        """
        Track recent tool calls/results (e.g., validation, ticket creation, kb search).
        """
        state = self.get_state(business_id, conversation_id)
        calls: List[Dict[str, Any]] = state.get('tool_calls', [])
        # Ensure JSON-serializable payload
        try:
            safe = json.loads(json.dumps(tool_call, default=str))
        except Exception:
            safe = {"tool": tool_call.get("tool"), "error": "non-serializable payload"}
        calls.append(safe)
        state['tool_calls'] = calls[-10:]  # keep last 10
        self.set_state(business_id, conversation_id, state)
        logger.info(f"[AI] Stored tool_call trace tool={safe.get('tool')} business={business_id} conversation={conversation_id}")

    def get_contact_fields(self, business_id: int | str, conversation_id: str) -> Dict[str, Any]:
        state = self.get_state(business_id, conversation_id)
        return state.get('contact', {})

    def set_contact_requested(self, business_id: int | str, conversation_id: str, requested: bool = True) -> None:
        state = self.get_state(business_id, conversation_id)
        state['contact_requested'] = requested
        self.set_state(business_id, conversation_id, state)

    def contact_requested(self, business_id: int | str, conversation_id: str) -> bool:
        state = self.get_state(business_id, conversation_id)
        return bool(state.get('contact_requested', False))

    def get_validation_status(self, business_id: int | str, conversation_id: str) -> Dict[str, Any]:
        state = self.get_state(business_id, conversation_id)
        return state.get('validation', {})

    def get_tool_calls(self, business_id: int | str, conversation_id: str) -> List[Dict[str, Any]]:
        state = self.get_state(business_id, conversation_id)
        return state.get('tool_calls', [])

    def clear(self, business_id: int | str, conversation_id: str) -> None:
        key = self._key(business_id, conversation_id)
        self.redis.delete(key)
