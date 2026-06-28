import os
from decouple import config


def main():
    model = config("EMBEDDING_MODEL", default="gemini-embedding-001")
    dim_raw = os.getenv("EMBEDDING_OUTPUT_DIM")
    dim = int(dim_raw) if dim_raw else None
    api = os.getenv("GEMINI_API_KEY")
    print(f"EMBEDDING_MODEL={model}")
    print(f"EMBEDDING_OUTPUT_DIM={dim}")
    print(f"GEMINI_API_KEY set={bool(api)}")


if __name__ == "__main__":
    main()
