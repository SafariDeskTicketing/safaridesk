import json
import logging
import re
from typing import Any

from tenant.services.ai.gemini_client import GeminiClient


logger = logging.getLogger(__name__)


class CopilotGatewayError(Exception):
    def __init__(self, error_type: str, message: str, *, user_message: str | None = None, raw_content: str = "") -> None:
        super().__init__(message)
        self.error_type = error_type
        self.user_message = user_message or "Copilot could not complete that request."
        self.raw_content = raw_content


class EmptyLLMResponseError(CopilotGatewayError):
    def __init__(self) -> None:
        super().__init__(
            "empty_response",
            "LLM returned an empty response",
            user_message="Copilot returned an empty response. Please try again.",
        )


class InvalidJSONResponseError(CopilotGatewayError):
    def __init__(self, message: str, *, raw_content: str = "") -> None:
        super().__init__(
            "invalid_json",
            message,
            user_message="Copilot returned an unreadable structured response. Please try again.",
            raw_content=raw_content,
        )


class BlockedLLMResponseError(CopilotGatewayError):
    def __init__(self, *, raw_content: str = "") -> None:
        super().__init__(
            "blocked_response",
            "LLM response was blocked or refused",
            user_message="Copilot could not complete that request because the provider blocked the response.",
            raw_content=raw_content,
        )


class ProviderLLMResponseError(CopilotGatewayError):
    def __init__(self, message: str) -> None:
        super().__init__(
            "provider_error",
            message,
            user_message="Copilot provider error. Please try again in a moment.",
        )


class TimeoutLLMResponseError(CopilotGatewayError):
    def __init__(self, message: str) -> None:
        super().__init__(
            "timeout",
            message,
            user_message="Copilot timed out while preparing a response. Please try again.",
        )


class LLMGateway:
    def __init__(self) -> None:
        self.client = GeminiClient()

    def generate_content(
        self,
        *,
        system_instruction: str,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 1000,
    ) -> dict[str, Any]:
        try:
            return self.client.generate_content(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except CopilotGatewayError:
            raise
        except Exception as exc:
            raise self._classify_provider_exception(exc) from exc

    @staticmethod
    def build_meta(result: dict[str, Any]) -> dict[str, Any]:
        return {
            "model": result.get("model"),
            "input_tokens": result.get("input_tokens"),
            "output_tokens": result.get("output_tokens"),
            "processing_time_ms": result.get("processing_time_ms"),
        }

    def generate_json(
        self,
        *,
        system_instruction: str,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 1000,
    ) -> dict[str, Any]:
        result = self.generate_content(
            system_instruction=system_instruction,
            prompt=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        content = (result.get("content") or "").strip()
        try:
            payload = self._extract_json(content)
        except InvalidJSONResponseError:
            payload = self._retry_json_reformat(
                content=content,
                max_tokens=max_tokens,
            )
        payload["_meta"] = self.build_meta(result)
        return payload

    def _extract_json(self, content: str) -> dict[str, Any]:
        if not content:
            raise EmptyLLMResponseError()

        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        if self._looks_blocked_response(cleaned):
            raise BlockedLLMResponseError(raw_content=cleaned[:1000])

        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            logger.warning("llm_gateway_invalid_json", extra={"preview": cleaned[:200]})
            raise InvalidJSONResponseError("No JSON object found in LLM response", raw_content=cleaned[:1000])

        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            logger.warning("llm_gateway_malformed_json", extra={"preview": cleaned[:200], "error": str(exc)})
            raise InvalidJSONResponseError("Malformed JSON object in LLM response", raw_content=cleaned[:1000]) from exc
        if not isinstance(parsed, dict):
            raise InvalidJSONResponseError("JSON response must be an object", raw_content=cleaned[:1000])
        return parsed

    def _retry_json_reformat(self, *, content: str, max_tokens: int) -> dict[str, Any]:
        retry_prompt = (
            "Rewrite the following model output into a single valid JSON object only. "
            "Do not add markdown fences, explanations, or extra keys. Use null for unknown values.\n\n"
            f"Model output:\n{content}"
        )
        retry_result = self.generate_content(
            system_instruction="You are a strict JSON formatter.",
            prompt=retry_prompt,
            temperature=0.0,
            max_tokens=max_tokens,
        )
        retry_content = (retry_result.get("content") or "").strip()
        payload = self._extract_json(retry_content)
        payload["_retry_meta"] = self.build_meta(retry_result)
        return payload

    def _classify_provider_exception(self, exc: Exception) -> CopilotGatewayError:
        message = str(exc).strip() or exc.__class__.__name__
        normalized = message.lower()
        if "timeout" in normalized or "timed out" in normalized:
            return TimeoutLLMResponseError(message)
        return ProviderLLMResponseError(message)

    @staticmethod
    def _looks_blocked_response(content: str) -> bool:
        lowered = content.lower()
        blocked_markers = (
            "i can't help with that",
            "i cannot help with that",
            "i'm sorry, but i can't",
            "i’m sorry, but i can’t",
            "unable to comply",
            "response was blocked",
            "blocked due to safety",
            "blocked by safety",
            "violates policy",
            "policy restrictions",
        )
        return any(marker in lowered for marker in blocked_markers)
