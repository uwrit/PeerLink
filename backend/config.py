import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    database_url: str = os.environ.get(
        "DATABASE_URL",
        "mysql+pymysql://peerlink:peerlink@db:3306/peerlink",
    )
    gf_consumer_key: str = os.environ.get("GRAVITY_FORMS_API_CONSUMER_KEY", "")
    gf_consumer_secret: str = os.environ.get("GRAVITY_FORMS_API_CONSUMER_SECRET", "")
    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    openalex_api_key: str = os.environ.get("OPENALEX_API_KEY", "")


settings = Settings()
