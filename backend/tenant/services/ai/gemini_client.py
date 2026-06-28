"""
Gemini API Client with retry logic, rate limiting, and cost tracking
Migrated to google-genai SDK (from deprecated google-generativeai)
"""

import logging
import time
from typing import Optional, Dict, Any, List, Callable, Type, TypeVar
from decouple import config
from google import genai
from google.genai import types
from pydantic import BaseModel

logger = logging.getLogger(__name__)

StructuredModel = TypeVar("StructuredModel", bound=BaseModel)


class GeminiClient:
    """
    Client for interacting with Google Gemini API
    Includes retry logic, rate limiting, and cost tracking
    """
    
    def __init__(self):
        self.api_key = config('GEMINI_API_KEY', default=None)
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        self.client = genai.Client(api_key=self.api_key)
        
        # Model configuration
        self.model_name = config('GEMINI_MODEL', default='gemini-2.0-flash')
        self.max_retries = int(config('GEMINI_MAX_RETRIES', default=3))
        self.retry_delay = float(config('GEMINI_RETRY_DELAY', default=1.0))
        self.timeout = int(config('GEMINI_TIMEOUT', default=30))
        
        # Safety settings
        self.safety_settings = [
            types.SafetySetting(
                category='HARM_CATEGORY_HARASSMENT',
                threshold='BLOCK_MEDIUM_AND_ABOVE'
            ),
            types.SafetySetting(
                category='HARM_CATEGORY_HATE_SPEECH',
                threshold='BLOCK_MEDIUM_AND_ABOVE'
            ),
            types.SafetySetting(
                category='HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold='BLOCK_MEDIUM_AND_ABOVE'
            ),
            types.SafetySetting(
                category='HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold='BLOCK_MEDIUM_AND_ABOVE'
            ),
        ]
        
        logger.info(f"Gemini client initialized with model '{self.model_name}'")
        
        # Cost tracking (tokens)
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_requests = 0
    
    def _calculate_backoff(self, attempt: int) -> float:
        """Calculate exponential backoff delay"""
        return self.retry_delay * (2 ** attempt)
    
    def _log_api_call(self, prompt: str, response: str, input_tokens: int, output_tokens: int):
        """Log API call for debugging and cost tracking"""
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.total_requests += 1
        
        logger.info(
            f"Gemini API call - Input tokens: {input_tokens}, Output tokens: {output_tokens}, "
            f"Total requests: {self.total_requests}"
        )

    def generate_content(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        retry_on_error: bool = True
    ) -> Dict[str, Any]:
        """
        Generate content using Gemini API with retry logic
        
        Args:
            prompt: User prompt
            system_instruction: System instruction/prompt
            temperature: Temperature for generation (0.0-2.0)
            max_tokens: Maximum tokens to generate
            retry_on_error: Whether to retry on errors
            
        Returns:
            Dict with 'content', 'input_tokens', 'output_tokens', 'model'
        """
        
        gen_config = types.GenerateContentConfig(
            temperature=temperature,
            safety_settings=self.safety_settings,
            system_instruction=system_instruction,
            max_output_tokens=max_tokens,
        )
        
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                start_time = time.time()
                
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=gen_config,
                )
                
                processing_time = int((time.time() - start_time) * 1000)
                
                # Extract tokens
                input_tokens, output_tokens = self._extract_usage_tokens(response)
                
                # Get response text
                content = response.text if response.text else str(response)
                
                # Log API call
                self._log_api_call(prompt, content, input_tokens, output_tokens)
                
                return {
                    'content': content,
                    'input_tokens': input_tokens,
                    'output_tokens': output_tokens,
                    'total_tokens': input_tokens + output_tokens,
                    'processing_time_ms': processing_time,
                    'model': self.model_name,
                    'raw_response': response
                }
                
            except Exception as e:
                last_exception = e
                logger.warning(
                    f"Gemini API call failed (attempt {attempt + 1}/{self.max_retries}): {str(e)}"
                )

                if not retry_on_error or attempt == self.max_retries - 1:
                    raise
                
                # Exponential backoff
                backoff_delay = self._calculate_backoff(attempt)
                time.sleep(backoff_delay)
        
        raise Exception(f"Gemini API call failed after {self.max_retries} attempts: {str(last_exception)}")

    def generate_structured_content(
        self,
        prompt: str,
        response_schema: Type[StructuredModel],
        system_instruction: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = None,
        retry_on_error: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate JSON constrained by a provider response schema, then validate with Pydantic.

        Returns:
            Dict with 'parsed' containing a validated Pydantic model instance.
        """
        gen_config = types.GenerateContentConfig(
            temperature=temperature,
            safety_settings=self.safety_settings,
            system_instruction=system_instruction,
            max_output_tokens=max_tokens,
            response_mime_type="application/json",
            response_schema=response_schema,
        )

        last_exception = None

        for attempt in range(self.max_retries):
            try:
                start_time = time.time()

                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=gen_config,
                )

                processing_time = int((time.time() - start_time) * 1000)
                input_tokens, output_tokens = self._extract_usage_tokens(response)

                parsed = self._validate_structured_response(response, response_schema)
                content = getattr(response, "text", None) or parsed.model_dump_json()

                self._log_api_call(prompt, content, input_tokens, output_tokens)

                return {
                    "content": content,
                    "parsed": parsed,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": input_tokens + output_tokens,
                    "processing_time_ms": processing_time,
                    "model": self.model_name,
                    "raw_response": response,
                }

            except Exception as e:
                last_exception = e
                logger.warning(
                    f"Gemini structured API call failed (attempt {attempt + 1}/{self.max_retries}): {str(e)}"
                )

                if not retry_on_error or attempt == self.max_retries - 1:
                    raise

                backoff_delay = self._calculate_backoff(attempt)
                time.sleep(backoff_delay)

        raise Exception(f"Gemini structured API call failed after {self.max_retries} attempts: {str(last_exception)}")

    def generate_agentic_response(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Any]] = None,
        tool_dispatcher: Optional[Dict[str, Callable[..., Any]]] = None,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        max_iterations: int = 4,
    ) -> Dict[str, Any]:
        """
        Agentic generation with Gemini function calling.

        Args:
            messages: list of {'role': 'user'|'assistant'|'system'|'tool', 'content': str}
            tools: list of tool schemas or callables
            tool_dispatcher: mapping tool name -> callable(**kwargs)
            system_instruction: optional system prompt
            temperature: sampling temperature
            max_tokens: optional max output tokens
            max_iterations: max tool-call loops per turn

        Returns:
            Dict with final content, tool_call trace, and raw responses.
        """
        conversation = self._to_genai_contents(messages)
        traces: List[Dict[str, Any]] = []
        total_input_tokens = 0
        total_output_tokens = 0

        sdk_tools = self._build_sdk_tools(tools) if tools else None
        gen_config = types.GenerateContentConfig(
            temperature=temperature,
            safety_settings=self.safety_settings,
            system_instruction=system_instruction,
            max_output_tokens=max_tokens,
            tools=sdk_tools,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        if logger.isEnabledFor(logging.DEBUG):
            logger.debug(
                "Agentic start model=%s messages=%s tools=%s",
                self.model_name,
                len(messages),
                len(tools or []),
            )

        last_response = None
        for _ in range(max_iterations):
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=conversation,
                config=gen_config,
            )
            last_response = response
            in_tok, out_tok = self._extract_usage_tokens(response)
            total_input_tokens += in_tok
            total_output_tokens += out_tok

            calls = self._extract_function_calls(response)
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(
                    "Agentic turn model=%s calls=%s input_tokens=%s output_tokens=%s",
                    self.model_name,
                    [c.get("name") for c in calls],
                    in_tok,
                    out_tok,
                )
            if not calls:
                try:
                    final_text = response.text if getattr(response, "text", None) else str(response)
                except Exception:
                    final_text = str(response)
                if logger.isEnabledFor(logging.DEBUG):
                    logger.debug("Agentic final text (truncated): %s", (final_text or "")[:400])
                self._log_api_call("agentic_turn", final_text, in_tok, out_tok)
                return {
                    "content": final_text,
                    "tool_calls": traces,
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                    "model": self.model_name,
                    "raw_response": response,
                }

            # Preserve the original model content (includes thought_signature parts for thinking models).
            # Reconstructing a new Content object drops the thought signatures, causing a 400 error
            # on the next turn. Use the raw candidate content directly.
            if response.candidates:
                conversation.append(response.candidates[0].content)

            function_responses = []
            for call in calls:
                tool_name = call.get("name")
                arguments = call.get("arguments") or {}
                result_payload: Dict[str, Any]
                error: Optional[str] = None

                func = (tool_dispatcher or {}).get(tool_name)
                if not func:
                    error = f"Unknown tool '{tool_name}'"
                    logger.warning(f"Agentic tool call failed: {error} args={arguments}")
                    result_payload = {"error": error}
                else:
                    try:
                        result_payload = func(**arguments)
                    except Exception as exc:
                        error = str(exc)
                        logger.warning(f"Agentic tool '{tool_name}' raised: {exc}", exc_info=True)
                        result_payload = {"error": error}

                if logger.isEnabledFor(logging.DEBUG):
                    logger.debug(
                        "Agentic tool result tool=%s error=%s keys=%s",
                        tool_name,
                        error,
                        list(result_payload.keys()),
                    )
                traces.append({
                    "tool": tool_name,
                    "args": arguments,
                    "result": result_payload,
                    "error": error,
                })

                function_responses.append(
                    types.Part(function_response=types.FunctionResponse(
                        name=tool_name,
                        response=result_payload,
                    ))
                )

            # Append all function responses in a single user turn
            conversation.append(
                types.Content(role="user", parts=function_responses)
            )

        # max_iterations exhausted with pending tool results in conversation.
        # Make one final call (no tools) so the model can produce a closing reply.
        final_text = ""
        try:
            closing_config = types.GenerateContentConfig(
                temperature=temperature,
                safety_settings=self.safety_settings,
                system_instruction=system_instruction,
                max_output_tokens=max_tokens,
            )
            closing_response = self.client.models.generate_content(
                model=self.model_name,
                contents=conversation,
                config=closing_config,
            )
            in_tok, out_tok = self._extract_usage_tokens(closing_response)
            total_input_tokens += in_tok
            total_output_tokens += out_tok
            final_text = closing_response.text if getattr(closing_response, "text", None) else ""
            last_response = closing_response
        except Exception as exc:
            logger.warning("Agentic closing call failed: %s", exc)

        return {
            "content": final_text or "I ran into an issue completing that request.",
            "tool_calls": traces,
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "model": self.model_name,
            "raw_response": last_response,
        }
    
    def generate_content_stream(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ):
        """
        Generate content with streaming response
        
        Yields:
            Chunks of generated text
        """
        gen_config = types.GenerateContentConfig(
            temperature=temperature,
            safety_settings=self.safety_settings,
            system_instruction=system_instruction,
            max_output_tokens=max_tokens,
        )
        
        try:
            for chunk in self.client.models.generate_content_stream(
                model=self.model_name,
                contents=prompt,
                config=gen_config,
            ):
                if chunk.text:
                    yield chunk.text
                    
        except Exception as e:
            logger.error(f"Gemini streaming error: {str(e)}")
            raise

    def _build_sdk_tools(self, tools: List[Any]) -> List[types.Tool]:
        """Convert plain tool-schema dicts to types.Tool objects required by the google-genai SDK."""
        declarations = []
        for tool in tools:
            if isinstance(tool, dict):
                declarations.append(
                    types.FunctionDeclaration(
                        name=tool["name"],
                        description=tool.get("description", ""),
                        parameters=tool.get("parameters"),
                    )
                )
            else:
                # Already a proper SDK type — pass through as-is
                return tools
        return [types.Tool(function_declarations=declarations)]

    def _extract_usage_tokens(self, response: Any) -> tuple[int, int]:
        """Normalize usage_metadata access across SDK object shapes."""
        usage = getattr(response, 'usage_metadata', None)
        prompt_tokens = 0
        output_tokens = 0
        if usage:
            prompt_tokens = getattr(usage, 'prompt_token_count', 0) or 0
            output_tokens = getattr(usage, 'candidates_token_count', 0) or 0
        return int(prompt_tokens), int(output_tokens)

    def _extract_function_calls(self, response: Any) -> List[Dict[str, Any]]:
        """
        Extract function calls from a response.
        """
        calls: List[Dict[str, Any]] = []
        candidates = getattr(response, "candidates", None) or []
        for cand in candidates:
            content = getattr(cand, "content", None)
            parts = getattr(content, "parts", None) or []
            for part in parts:
                fc = getattr(part, "function_call", None)
                if fc:
                    name = getattr(fc, "name", None)
                    args = getattr(fc, "args", None) or {}
                    if isinstance(args, dict):
                        calls.append({"name": name, "arguments": args})
                    else:
                        calls.append({"name": name, "arguments": dict(args) if args else {}})
        return [c for c in calls if c.get("name")]

    def _validate_structured_response(
        self,
        response: Any,
        response_schema: Type[StructuredModel],
    ) -> StructuredModel:
        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, response_schema):
            return parsed
        if parsed is not None:
            return response_schema.model_validate(parsed)

        content = getattr(response, "text", None)
        if not content:
            raise ValueError("Structured Gemini response did not include parsed data or text.")
        return response_schema.model_validate_json(content)

    def _to_genai_contents(self, messages: List[Dict[str, str]]) -> List[types.Content]:
        """
        Convert simplified message dicts to Gemini Content format.
        Expected input: {'role': 'user'|'assistant'|'tool'|'function', 'content': str}
        """
        converted: List[types.Content] = []
        role_map = {
            "assistant": "model",
            "tool": "user",
            "function": "user",
        }
        for msg in messages:
            role = msg.get("role", "user")
            if role == "system":
                # system_instruction should be used via config instead
                continue
            content = msg.get("content", "")
            mapped_role = role_map.get(role, role)
            converted.append(
                types.Content(
                    role=mapped_role,
                    parts=[types.Part(text=content)],
                )
            )
        return converted
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics"""
        return {
            'total_requests': self.total_requests,
            'total_input_tokens': self.total_input_tokens,
            'total_output_tokens': self.total_output_tokens,
            'total_tokens': self.total_input_tokens + self.total_output_tokens,
        }
    
    def reset_usage_stats(self):
        """Reset usage statistics"""
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_requests = 0
