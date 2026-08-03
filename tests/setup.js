// Environment variables for all tests – set before any module is required.
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';
process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
