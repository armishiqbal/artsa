"""ARTSA Attack Plugins — Modular attack implementations."""

from src.attacks.base_attack import BaseAttack
from src.attacks.prompt_injection import PromptInjectionAttack
from src.attacks.jailbreak import JailbreakAttack
from src.attacks.system_prompt_leak import SystemPromptLeakAttack
from src.attacks.data_extraction import DataExtractionAttack
from src.attacks.social_engineering import SocialEngineeringAttack
from src.attacks.payload_mutator import PayloadMutator
from src.models import AttackCategory

# Registry mapping categories to their attack plugin classes
ATTACK_REGISTRY: dict[AttackCategory, type[BaseAttack]] = {
    AttackCategory.PROMPT_INJECTION: PromptInjectionAttack,
    AttackCategory.JAILBREAK: JailbreakAttack,
    AttackCategory.SYSTEM_PROMPT_EXTRACTION: SystemPromptLeakAttack,
    AttackCategory.DATA_EXTRACTION: DataExtractionAttack,
    AttackCategory.SOCIAL_ENGINEERING: SocialEngineeringAttack,
}

__all__ = [
    "BaseAttack",
    "PromptInjectionAttack",
    "JailbreakAttack",
    "SystemPromptLeakAttack",
    "DataExtractionAttack",
    "SocialEngineeringAttack",
    "PayloadMutator",
    "ATTACK_REGISTRY",
]
