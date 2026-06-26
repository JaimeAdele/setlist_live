// Runs before every test file. Sets env vars that modules read at import time.
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/vibecheck_test';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
