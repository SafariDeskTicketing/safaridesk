"""
Gemini Diagnostics Script

This standalone script exercises the Gemini client integration in ways that
match the codebase usage patterns, to help diagnose model availability (404),
streaming, and embeddings.

Usage examples:

  python scripts/gemini_diagnostics.py --prompt "Hello" --system "You are helpful."
  python scripts/gemini_diagnostics.py --prompt "Stream me" --stream
  python scripts/gemini_diagnostics.py --embed "Quick brown fox"
  python scripts/gemini_diagnostics.py --list-models

Environment variables respected:
  GEMINI_API_KEY         - API key (Developer API)
  GEMINI_MODEL           - default 'gemini-1.5-flash'
  GEMINI_MAX_RETRIES     - default 3
  GEMINI_RETRY_DELAY     - default 1.0
  GEMINI_TIMEOUT         - default 30
EMBEDDING_MODEL        - default 'gemini-embedding-001'
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Optional

try:
    # Local project import (no Django setup required)
    from tenant.services.ai.gemini_client import GeminiClient  # type: ignore
except Exception as e:  # pragma: no cover
    print(f"Failed to import GeminiClient: {e}")
    sys.exit(1)

try:
    from google import genai
    from google.genai import types
except Exception as e:  # pragma: no cover
    print(f"google-genai not installed or failed to import: {e}")
    sys.exit(1)


logger = logging.getLogger("gemini_diagnostics")


def configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def cmd_list_models() -> int:
    try:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY/GOOGLE_API_KEY not set; cannot list models")
            return 2
        client = genai.Client(api_key=api_key)
        print("Available models:")
        for m in client.models.list():
            name = getattr(m, "name", None)
            print(f"- {name}")
        return 0
    except Exception as e:
        logger.exception(f"Failed to list models: {e}")
        return 1


def cmd_generate(prompt: str, system: Optional[str], temperature: float, max_tokens: Optional[int], stream: bool) -> int:
    try:
        client = GeminiClient()
        if stream:
            print("--- Streaming response ---")
            chunks = client.generate_content_stream(prompt=prompt, system_instruction=system, temperature=temperature, max_tokens=max_tokens)
            for chunk in chunks:
                # Stream to stdout as it arrives
                sys.stdout.write(chunk)
                sys.stdout.flush()
            print("\n--- [end of stream] ---")
            return 0
        else:
            result = client.generate_content(prompt=prompt, system_instruction=system, temperature=temperature, max_tokens=max_tokens)
            print("--- Generation result ---")
            print(result.get("content", "<no content>"))
            usage = {
                "input_tokens": result.get("input_tokens"),
                "output_tokens": result.get("output_tokens"),
                "total_tokens": result.get("total_tokens"),
                "model": result.get("model"),
                "processing_time_ms": result.get("processing_time_ms"),
            }
            print("--- Usage ---")
            print(usage)
            return 0
    except Exception as e:
        logger.exception(f"Generation failed: {e}")
        return 1


def cmd_embed(text: str) -> int:
    try:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY/GOOGLE_API_KEY not set; cannot embed")
            return 2
        client = genai.Client(api_key=api_key)
        model = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
        result = client.models.embed_content(model=model, contents=text)

        # Extract vector from response
        vector = None
        embeddings = getattr(result, 'embeddings', None)
        if embeddings and len(embeddings) > 0:
            vector = getattr(embeddings[0], 'values', None)
        if not vector and isinstance(result, dict):
            vector = result.get("embedding", {}).get("values") or result.get("embedding")

        if not vector:
            logger.error("Embedding response did not include a vector")
            return 1

        dims = len(vector)
        preview = vector[:8]
        print(f"Embedding model: {model}")
        print(f"Vector dimensions: {dims}")
        print(f"Preview (first 8 values): {preview}")
        return 0
    except Exception as e:
        logger.exception(f"Embedding failed: {e}")
        return 1


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Gemini diagnostics matching project usage patterns")
    sub = p.add_subparsers(dest="cmd")

    # generate
    p_gen = sub.add_parser("generate", help="Run a non-streaming or streaming generation call")
    p_gen.add_argument("--prompt", required=True, help="User prompt text")
    p_gen.add_argument("--system", help="System instruction text")
    p_gen.add_argument("--temperature", type=float, default=0.7)
    p_gen.add_argument("--max-tokens", type=int)
    p_gen.add_argument("--stream", action="store_true", help="Use streaming mode")

    # embed
    p_emb = sub.add_parser("embed", help="Generate an embedding for a given text")
    p_emb.add_argument("--text", required=True, help="Text to embed")

    # list-models
    sub.add_parser("list-models", help="List available models and supported methods")

    # global
    p.add_argument("--verbose", action="store_true")

    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    configure_logging(args.verbose)

    if args.cmd == "list-models":
        return cmd_list_models()
    elif args.cmd == "embed":
        return cmd_embed(args.text)
    elif args.cmd == "generate":
        return cmd_generate(
            prompt=args.prompt,
            system=getattr(args, "system", None),
            temperature=float(getattr(args, "temperature", 0.7)),
            max_tokens=getattr(args, "max_tokens", None),
            stream=bool(getattr(args, "stream", False)),
        )
    else:
        # default: quick help and exit non-zero
        print("No command specified. Try one of: generate, embed, list-models")
        return 2


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main(sys.argv[1:]))
