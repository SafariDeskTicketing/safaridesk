from __future__ import annotations

from typing import List, Dict, Any, Optional

from tenant.models.ChatbotModel import ChatbotConfig


class ContextBuilder:
    """
    Builds prompts/context for AI responses based on business config, KB snippets, and history.
    """

    def build_system_prompt(self, config: Optional[ChatbotConfig] = None, business_name: str = "your organization") -> str:
        parts: List[str] = [
            f"You are a helpful human-like support agent for {business_name}.",
            "Behave conversationally and naturally. Do NOT mention tools, functions, or searches.",
            "Use the knowledge base to ground answers when helpful, but keep it invisible to the user.",
            "Stay focused on SafariDesk support. If the user asks clearly unrelated general knowledge, trivia, homework, creative writing, astronomy, or physics questions, briefly redirect them back to their support issue.",
            "When an issue requires follow-up, offer to create a ticket.",
            "Before creating a ticket, you MUST have: name, valid email, and phone.",
            "When starting ticket creation, use the UI form for contact fields (name, email, phone) if available. Do not ask piecemeal in chat. Always validate the form fields.",
            "If a field looks invalid, ask gently for correction (e.g., 'That email doesn't look right—could you double-check?').",
            "Infer ticket title/description/routing from the conversation; do not ask the user to fill a form.",
            "Before creating a ticket, call ticket_options and only use existing department, category, label, and assignee IDs from that tool. If labels or assignee are uncertain, omit them.",
            "Never invent or create departments, categories, labels, users, or assignees from text.",
            "Always check the knowledge base first when relevant; cite snippets in your answer.",
            "After sharing KB steps, ask if the issue is resolved. If fixed, call resolution_status with resolved=true. If not fixed, call resolution_status with resolved=false and a short reason, then proceed to collect contact info to create a ticket.",
        ]
        
        # Add response length constraint
        if config and hasattr(config, 'max_response_chars') and config.max_response_chars:
            parts.append(f"CRITICAL: Keep responses under {config.max_response_chars} characters. Be concise and direct - customers won't read long paragraphs.")
        else:
            parts.append("Keep responses very concise and clear - under 300 characters when possible. Avoid long multi-paragraph replies.")
        
        if config:
            if config.instructions:
                parts.append(f"Business instructions: {config.instructions}")
            parts.append(f"Tone: {config.tone}")
            if config.kb_search_enabled:
                parts.append("Prefer knowledge base answers if relevant.")
        return "\n".join(parts)

    def build_user_prompt(
        self,
        message: str,
        kb_results: Optional[List[Dict[str, Any]]] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        lines: List[str] = []
        if history:
            lines.append("Conversation history:")
            for m in history[-10:]:
                lines.append(f"- {m.get('role','user')}: {m.get('content','')}")
            lines.append("")

        if kb_results:
            lines.append("Relevant knowledge base articles:")
            for r in kb_results[:5]:
                title = r.get('title')
                content = (r.get('content') or '')[:200]
                lines.append(f"- {title}: {content}")
            lines.append("")

        lines.append("User message:")
        lines.append(message)
        return "\n".join(lines)

    def build_messages(
        self,
        history: Optional[List[Dict[str, str]]] = None,
        user_message: Optional[str] = None,
        kb_results: Optional[List[Dict[str, Any]]] = None,
        include_few_shots: bool = True,
    ) -> List[Dict[str, str]]:
        """
        Build structured messages for Gemini (history + optional KB context + user).
        System prompt should be passed separately as system_instruction.
        """
        messages: List[Dict[str, str]] = []

        if history:
            for m in history[-10:]:
                messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})

        if kb_results:
            kb_lines: List[str] = ["Relevant knowledge base snippets:"]
            for r in kb_results[:5]:
                title = r.get("title")
                content = (r.get("content") or "")[:200]
                kb_lines.append(f"- {title}: {content}")
            messages.append({"role": "assistant", "content": "\n".join(kb_lines)})

        if user_message is not None:
            messages.append({"role": "user", "content": user_message})

        if include_few_shots:
            messages.extend(self._few_shot_examples())

        return messages

    def _few_shot_examples(self) -> List[Dict[str, str]]:
        """Examples to guide conversational contact collection and validation."""
        return [
            {
                "role": "user",
                "content": "I need help upgrading my package.",
            },
            {
                "role": "assistant",
                "content": "I can help with that! To get a ticket started, could you share your email address?",
            },
            {
                "role": "user",
                "content": "It's john@exmple.com",
            },
            {
                "role": "assistant",
                "content": "Thanks! That email doesn't look quite right—could you double-check the spelling?",
            },
            {
                "role": "user",
                "content": "Sorry, it's john@example.com",
            },
            {
                "role": "assistant",
                "content": "Got it, thanks. What's your full name and the best phone number to reach you?",
            },
            {
                "role": "user",
                "content": "Jane Doe, +1 555 123 4567",
            },
            {
                "role": "assistant",
                "content": "Perfect. I've created a ticket to upgrade your package. We'll reach out soon.",
            },
            # Example where contact already provided
            {
                "role": "user",
                "content": "I'm Sarah, sarah@example.com, need help with login, phone +254712345678",
            },
            {
                "role": "assistant",
                "content": "Thanks Sarah. I'll create a ticket for your login issue and let you know once it's set.",
            },
        ]
