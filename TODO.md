# TODO

## Security
- [ ] Rotate exposed credentials (if any API keys/secrets were committed to git history)
  - Firebase Console: Rotate API keys
  - Supabase Dashboard: Rotate API keys and database credentials
  - Any other third-party services

## Data Protection (Future)
- [ ] Strip email from login response - only return necessary user fields
- [ ] Add pagination to IOU/feed endpoints - limit to 50 records per request
- [ ] Consider CAPTCHA on public invite decline endpoint
