import ollama


def ask_llm(system_prompt: str, user_message: str, model: str = "phi3") -> str:
    """
    Single reusable function to call Ollama.
    All agents use this instead of calling ollama.chat() directly.
    """
    try:
        response = ollama.chat(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
        )
        return response["message"]["content"]
    except Exception as e:
        return f"❌ LLM error: {str(e)}"