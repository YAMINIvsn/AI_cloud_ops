import os
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

# ── Azure OpenAI client ───────────────────────────────────────────
client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_KEY"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
)

DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")


def ask_llm(system_prompt: str, user_message: str, model: str = None) -> str:
    """
    Single reusable function to call Azure OpenAI.
    """
    try:
        response = client.chat.completions.create(
            model=model or DEPLOYMENT,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            max_tokens=500,
            temperature=0.3,   # low temp = factual, consistent answers
        )
        return response.choices[0].message.content

    except Exception as e:
        return f"❌ Azure OpenAI error: {str(e)}"
