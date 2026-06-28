import re
import logging

from util.email.mappings import PLACEHOLDER_MAPPINGS

logger = logging.getLogger(__name__)

class TemplateParser:
    def __init__(self, objects: dict = None, mappings: dict = None):
        """
        :param objects: dict of model instances, e.g. {"user": user_instance, "ticket": ticket_instance}
        :param mappings: dict of placeholder mappings (defaults to PLACEHOLDER_MAPPINGS)
        """
        self.objects = objects or {}
        self.mappings = mappings or PLACEHOLDER_MAPPINGS

        logger.info("TemplateParser initialized with objects=%s and mappings=%s",
                    list(self.objects.keys()), list(self.mappings.keys()))

    def extract_placeholders(self, text: str):
        """
        Finds placeholders inside {{ ... }} blocks.
        Example: "Hello {{ user_name }}" -> ["user_name"]
        """
        placeholders = re.findall(r"\{\{\s*(\w+)\s*\}\}", text or "")
        logger.debug("Extracted placeholders from text: %s -> %s", text, placeholders)
        return placeholders

    def build_context(self, template):
        """
        Build context automatically for a template.
        """
        logger.info("Building context for template '%s'", template.name)

        placeholders = set(
            self.extract_placeholders(template.subject)
            + self.extract_placeholders(template.body)
        )
        logger.info("Placeholders found in template: %s", placeholders)

        context = {}
        for entity, field_map in self.mappings.items():
            obj = self.objects.get(entity)
            if not obj:
                logger.debug("Skipping entity '%s' (not provided)", entity)
                continue

            logger.debug("Processing entity '%s'", entity)
            for placeholder, resolver in field_map.items():
                if placeholder in placeholders:
                    try:
                        value = resolver(obj) or ""
                        context[placeholder] = value
                        logger.debug("Resolved placeholder '%s' from entity '%s': %s",
                                     placeholder, entity, value)
                    except Exception as e:
                        context[placeholder] = ""
                        logger.error("Failed to resolve placeholder '%s' from entity '%s': %s",
                                     placeholder, entity, str(e))

        logger.info("Final context built: %s", context)
        return context
