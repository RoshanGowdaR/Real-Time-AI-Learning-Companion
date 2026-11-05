"""Version Space Algorithm for Adaptive Tutor Personalization.

Uses concept learning / version space hypothesis updates based on student feedback
to continuously evolve the AI tutor's explanation approach.
"""
import json
from datetime import datetime
from typing import Dict, List, Optional
from services.local_db import get_connection, _lock

# Attributes in our tutoring concept space
ATTRIBUTES = {
    "examples": ["none", "moderate", "high_analogy_driven"],
    "explanation_style": ["concise_bullets", "step_by_step", "deep_conceptual"],
    "tone": ["warm_encouraging", "academic_rigorous", "casual_friendly"],
    "pacing": ["bite_sized", "comprehensive"],
    "interactive_checks": ["ask_check_question", "direct_answer_only"],
}

DEFAULT_HYPOTHESIS = {
    "examples": "high_analogy_driven",
    "explanation_style": "step_by_step",
    "tone": "warm_encouraging",
    "pacing": "bite_sized",
    "interactive_checks": "ask_check_question",
    
}


def _extract_feedback_constraints(feedback_text: str) -> Dict[str, str]:
    """Parse text feedback for target attribute preferences."""
    text = feedback_text.lower()
    constraints = {}

    # Examples preference
    if "more example" in text or "real-world" in text or "practical" in text or "analogy" in text or "analogies" in text or "sample" in text:
        constraints["examples"] = "high_analogy_driven"
    elif "less example" in text or "fewer example" in text or "no example" in text:
        constraints["examples"] = "none"

    # Explanation style
    if "concise" in text or "short" in text or "bullet" in text or "brief" in text or "to the point" in text or "summar" in text:
        constraints["explanation_style"] = "concise_bullets"
    elif "step by step" in text or "simple" in text or "simpler" in text or "break it down" in text or "detailed steps" in text:
        constraints["explanation_style"] = "step_by_step"
    elif "deep" in text or "theory" in text or "technical" in text or "in-depth" in text:
        constraints["explanation_style"] = "deep_conceptual"

    # Tone
    if "gentle" in text or "encouraging" in text or "friendly" in text or "warm" in text or "motivat" in text:
        constraints["tone"] = "warm_encouraging"
    elif "academic" in text or "formal" in text or "professional" in text:
        constraints["tone"] = "academic_rigorous"
    elif "casual" in text or "chill" in text or "fun" in text:
        constraints["tone"] = "casual_friendly"

    # Pacing
    if "slow" in text or "bite" in text or "one by one" in text or "fast" in text or "slow down" in text:
        constraints["pacing"] = "bite_sized"
    elif "comprehensive" in text or "all at once" in text or "complete" in text:
        constraints["pacing"] = "comprehensive"

    # Interactive checks
    if "ask me" in text or "quiz" in text or "test me" in text or "question" in text or "check" in text:
        constraints["interactive_checks"] = "ask_check_question"
    elif "don't ask" in text or "just answer" in text or "direct" in text:
        constraints["interactive_checks"] = "direct_answer_only"

    # Fallback if no specific trigger matched
    if not constraints:
        if "good" in text or "great" in text or "awesome" in text:
            constraints["tone"] = "warm_encouraging"
        else:
            constraints["examples"] = "high_analogy_driven"

    return constraints


def _build_hypothesis_prompt(hypothesis: Dict[str, str]) -> str:
    """Generate human-readable instructions from the Version Space hypothesis."""
    rules = []

    ex = hypothesis.get("examples", "moderate")
    if ex == "high_analogy_driven":
        rules.append("• Illustrate every key concept with real-world analogies and concrete examples.")
    elif ex == "none":
        rules.append("• Keep explanations conceptual and direct without extraneous examples.")
    else:
        rules.append("• Provide balanced, relevant examples when clarifying complex ideas.")

    exp = hypothesis.get("explanation_style", "step_by_step")
    if exp == "concise_bullets":
        rules.append("• Format explanations using clear, concise bullet points with bold key terms.")
    elif exp == "step_by_step":
        rules.append("• Break down explanations into numbered step-by-step stages.")
    elif exp == "deep_conceptual":
        rules.append("• Provide comprehensive conceptual analysis covering foundational principles.")

    tn = hypothesis.get("tone", "warm_encouraging")
    if tn == "warm_encouraging":
        rules.append("• Maintain an empathetic, warmly motivating, and patient tone.")
    elif tn == "academic_rigorous":
        rules.append("• Maintain an academically precise and scholarly tone.")
    elif tn == "casual_friendly":
        rules.append("• Maintain a relaxed, approachable, conversational tone.")

    pace = hypothesis.get("pacing", "bite_sized")
    if pace == "bite_sized":
        rules.append("• Deliver insights in digestible, bite-sized portions so the student is never overwhelmed.")
    else:
        rules.append("• Deliver complete, thorough overviews in a single coherent flow.")

    chk = hypothesis.get("interactive_checks", "ask_check_question")
    if chk == "ask_check_question":
        rules.append("• Conclude with a quick, engaging comprehension check question to reinforce learning.")
    else:
        rules.append("• Focus solely on answering the inquiry directly without follow-up quiz questions.")

    return "\n".join(rules)


def get_student_hypothesis(student_id: str) -> Dict[str, str]:
    """Retrieve the current active Version Space hypothesis for a student."""
    with _lock:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT active_hypothesis, version_space FROM hypothesis_profiles WHERE student_id = ?", (student_id,))
        row = cursor.fetchone()
        conn.close()

    if row and row["version_space"]:
        try:
            vs = json.loads(row["version_space"])
            if isinstance(vs, dict) and "active" in vs:
                return vs["active"]
        except Exception:
            pass

    return dict(DEFAULT_HYPOTHESIS)


def get_hypothesis_prompt_instruction(student_id: str) -> str:
    """Get the active instruction block to inject into the LLM system prompt."""
    h = get_student_hypothesis(student_id)
    return _build_hypothesis_prompt(h)


def update_hypothesis_from_feedback(student_id: str, rating: int, feedback_text: str) -> Dict:
    """Run Version Space candidate elimination / hypothesis update using student feedback."""
    current_h = get_student_hypothesis(student_id)
    constraints = _extract_feedback_constraints(feedback_text)

    # Version Space update step: Specialize/generalize the hypothesis towards positive constraints
    updated_h = dict(current_h)
    for attr, val in constraints.items():
        if attr in ATTRIBUTES and val in ATTRIBUTES[attr]:
            updated_h[attr] = val

    prompt_summary = _build_hypothesis_prompt(updated_h)

    vs_payload = {
        "G": [{"examples": "?", "explanation_style": "?", "tone": "?", "pacing": "?", "interactive_checks": "?"}],
        "S": [dict(updated_h)],
        "active": updated_h,
        "history_count": 1,
    }

    now_str = datetime.utcnow().isoformat() + "Z"

    with _lock:
        conn = get_connection()
        cursor = conn.cursor()

        # Update or insert hypothesis profile
        cursor.execute("SELECT id, version_space FROM hypothesis_profiles WHERE student_id = ?", (student_id,))
        existing = cursor.fetchone()
        if existing:
            try:
                old_vs = json.loads(existing["version_space"])
                vs_payload["history_count"] = old_vs.get("history_count", 1) + 1
            except Exception:
                pass
            cursor.execute(
                "UPDATE hypothesis_profiles SET version_space = ?, active_hypothesis = ?, updated_at = ? WHERE student_id = ?",
                (json.dumps(vs_payload), prompt_summary, now_str, student_id),
            )
        else:
            profile_id = f"hp_{student_id[:8]}"
            cursor.execute(
                "INSERT INTO hypothesis_profiles (id, student_id, version_space, active_hypothesis, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (profile_id, student_id, json.dumps(vs_payload), prompt_summary, now_str, now_str),
            )

        # Log session feedback
        fb_id = f"fb_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')[:18]}"
        cursor.execute(
            "INSERT INTO session_feedback (id, student_id, rating, feedback_text, extracted_constraints, previous_hypothesis, updated_hypothesis, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (fb_id, student_id, rating, feedback_text, json.dumps(constraints), json.dumps(current_h), prompt_summary, now_str),
        )

        conn.commit()
        conn.close()

    return {
        "status": "success",
        "previous_hypothesis": current_h,
        "updated_hypothesis": updated_h,
        "constraints_extracted": constraints,
        "active_instruction": prompt_summary,
    }
