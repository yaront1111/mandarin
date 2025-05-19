# Default Subscription for New Users

## Overview
This feature automatically gives new users a subscription when they register. The subscription duration and enablement can be easily configured.

## Configuration

The feature is controlled by two environment variables:

1. `ENABLE_DEFAULT_SUBSCRIPTION` - Whether to automatically apply subscription to new users
   - Default: `true`
   - Set to `false` to disable automatic subscriptions

2. `DEFAULT_SUBSCRIPTION_DAYS` - How many days the subscription should last
   - Default: `365` (1 year)
   - Can be any positive integer

## Examples

### Give new users a 1-year subscription (default)
```bash
# No environment variables needed, uses defaults
npm start
```

### Give new users a 30-day trial
```bash
DEFAULT_SUBSCRIPTION_DAYS=30 npm start
```

### Disable automatic subscriptions
```bash
ENABLE_DEFAULT_SUBSCRIPTION=false npm start
```

### Production configuration
Add to your `.env` file:
```env
ENABLE_DEFAULT_SUBSCRIPTION=true
DEFAULT_SUBSCRIPTION_DAYS=365
```

## How it works

When a new user registers:
1. If `ENABLE_DEFAULT_SUBSCRIPTION` is true
2. The system sets:
   - `user.isPaid = true`
   - `user.subscriptionExpiry = current date + DEFAULT_SUBSCRIPTION_DAYS`
3. This activates premium features immediately upon registration

## Notes
- The subscription is applied automatically during registration
- No payment processing is involved - this is for free trials or promotions
- Users can still upgrade/extend their subscription through normal payment flows
- The feature logs when a subscription is applied for audit purposes