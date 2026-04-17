from authentik.core.models import Token, User, TokenIntents
user = User.objects.get(username="akadmin")
token, _ = Token.objects.get_or_create(identifier="fastapi-svc", defaults={"user": user, "intent": TokenIntents.INTENT_API, "description": "FastAPI service", "expiring": False})
print(token.key)
