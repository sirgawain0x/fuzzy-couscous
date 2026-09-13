# Production Readiness Checklist

## ✅ Completed

### Tableland Integration

- ✅ Table created: `transactions_8453_26`
- ✅ Table visible in Studio
- ✅ Schema matches requirements
- ✅ Error handling with API fallback
- ✅ Background sync implemented
- ✅ Batch operations for performance
- ✅ Table name properly quoted in SQL queries

### Code Quality

- ✅ Graceful error handling
- ✅ Fallback to Coinbase API if Tableland fails
- ✅ Non-blocking background sync
- ✅ Input validation
- ✅ Proper logging

## ⚠️ Production Checklist

### 1. Environment Variables (CRITICAL)

Ensure these are set in your production environment:

```bash
# Required for Tableland
TABLELAND_PRIVATE_KEY=0x...  # Wallet with ETH on Base for gas
TABLELAND_TABLE_NAME=transactions_8453_26

# Required for Coinbase API
COINBASE_API_KEY_ID=...
COINBASE_API_KEY_SECRET=...

# Required for Crossmint Auth (server) + webhooks (production)
CROSSMINT_SERVER_API_KEY=...
CROSSMINT_WEBHOOK_SECRET=whsec_...
COCKROACHDB_URL=...
```

**Action Items:**

- [ ] Configure Crossmint Console webhook → `https://<domain>/api/webhooks/crossmint` ([guide](./docs/CROSSMINT_WEBHOOKS.md))
- [ ] Add `CROSSMINT_WEBHOOK_SECRET` to production (and preview if needed)
- [ ] Subscribe to `wallets.transfer.in`, `wallets.transfer.out`, `wallets.transfer.transaction.update`, and `wallets.experimental.transfer.updated`
- [ ] Add `TABLELAND_PRIVATE_KEY` to production environment
- [ ] Verify wallet has sufficient ETH on Base for gas fees
- [ ] Confirm `TABLELAND_TABLE_NAME` is set correctly
- [ ] Test that environment variables load correctly in production

### 2. Gas Costs & Wallet Funding

**Current Setup:**

- Using Base mainnet (low gas costs)
- Each write operation costs minimal gas (~$0.001-0.01 per transaction)

**Action Items:**

- [ ] Fund the `TABLELAND_PRIVATE_KEY` wallet with ETH on Base
- [ ] Monitor gas costs (consider setting up alerts)
- [ ] Estimate monthly costs based on transaction volume
- [ ] Consider implementing rate limiting for writes

### 3. Error Monitoring

**Current Implementation:**

- Errors are logged to console
- Graceful fallback to Coinbase API
- Background sync errors don't block user requests

**Action Items:**

- [ ] Set up error monitoring (e.g., Sentry, LogRocket)
- [ ] Add alerts for Tableland failures
- [ ] Monitor API fallback frequency
- [ ] Track Tableland write success rate

### 4. Performance & Scaling

**Current Implementation:**

- Batch operations for multiple transactions
- Cached reads from Tableland
- Background sync doesn't block requests

**Action Items:**

- [ ] Monitor query performance
- [ ] Test with high transaction volumes
- [ ] Consider adding indexes if needed (Tableland supports indexes)
- [ ] Monitor Tableland query limits

### 5. Data Validation

**Current Implementation:**

- Basic input validation (userId required)
- JSON parsing with error handling
- Transaction ID uniqueness enforced

**Action Items:**

- [ ] Add validation for transaction data structure
- [ ] Validate user_id format
- [ ] Add data sanitization if needed
- [ ] Consider adding constraints in schema

### 6. Security

**Current Implementation:**

- Private key stored in environment variables
- Server-side only operations
- No client-side exposure

**Action Items:**

- [ ] Verify private key is never logged
- [ ] Use secure secret management (e.g., AWS Secrets Manager, Vercel Env)
- [ ] Rotate private key periodically
- [ ] Review access controls on Tableland table
- [ ] Consider implementing table access control if needed

### 7. Testing

**Action Items:**

- [ ] Test transaction fetching in staging
- [ ] Test Tableland write operations
- [ ] Test API fallback when Tableland is unavailable
- [ ] Test background sync behavior
- [ ] Load test with multiple concurrent requests

### 8. Monitoring & Observability

**Action Items:**

- [ ] Add metrics for:
  - Tableland query success rate
  - API fallback frequency
  - Average query latency
  - Transaction storage success rate
- [ ] Set up dashboards
- [ ] Configure alerts for critical failures

### 9. Documentation

**Action Items:**

- [ ] Document production deployment steps
- [ ] Create runbook for common issues
- [ ] Document rollback procedures
- [ ] Update team on Tableland integration

### 10. Backup & Recovery

**Current Implementation:**

- Data stored on-chain (immutable)
- Coinbase API as source of truth
- Background sync keeps data fresh

**Action Items:**

- [ ] Document recovery procedures
- [ ] Test data recovery from Coinbase API
- [ ] Consider periodic data validation

## 🚀 Deployment Steps

1. **Pre-Deployment:**

   ```bash
   # Verify environment variables
   echo $TABLELAND_PRIVATE_KEY
   echo $TABLELAND_TABLE_NAME
   echo $COINBASE_API_KEY_ID
   ```

2. **Deploy:**
   - Deploy code to production
   - Verify environment variables are set
   - Monitor initial requests

3. **Post-Deployment:**
   - Check logs for Tableland operations
   - Verify transactions are being stored
   - Monitor error rates
   - Check gas costs

## 📊 Success Metrics

Track these metrics post-deployment:

- Tableland query success rate (target: >99%)
- Average query latency (target: <500ms)
- API fallback frequency (target: <1%)
- Transaction storage success rate (target: >99%)
- Gas costs per transaction

## 🔧 Rollback Plan

If issues occur:

1. Tableland failures automatically fallback to Coinbase API
2. No user-facing impact (graceful degradation)
3. Can disable Tableland by removing `TABLELAND_TABLE_NAME`
4. All data remains accessible via Coinbase API

## ⚡ Quick Wins

Before going to production, consider:

1. Add retry logic for Tableland writes
2. Add request timeout handling
3. Implement rate limiting for writes
4. Add health check endpoint
5. Set up basic monitoring/alerts
