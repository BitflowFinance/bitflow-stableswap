# Stableswap Pool Contract Audit Report

## Executive Summary

This audit report analyzes the Stableswap Pool smart contract implementation, focusing on potential security issues, mathematical correctness, and economic implications. The primary concern identified is a critical inconsistency in how token values are calculated between swap operations and liquidity operations.

### Key Findings

| Severity | Issue | Status |
|----------|--------|---------|
| 🔴 Critical | Midpoint Value Inconsistency | Unresolved |
| 🟡 Medium | Potential Precision Loss in Calculations | Needs Review |
| 🟢 Low | Documentation Gaps | Needs Improvement |

## Detailed Analysis

### 1. Critical: Midpoint Value Inconsistency

#### Description
A critical inconsistency exists between how token values are calculated during swap operations versus liquidity operations. This creates potential arbitrage opportunities and incorrect LP token valuations.

#### Technical Details

##### Swap Operations
In swap operations, the contract correctly adjusts balances using the midpoint before calculating swap amounts:

```clarity
;; From swap-x-for-y function
(x-balance-midpoint-scaled (/ (* x-balance-scaled midpoint-factor) midpoint))
(updated-y-balance-scaled (get-y dx-scaled x-balance-midpoint-scaled y-balance-scaled amplification-coefficient convergence-threshold))
```

```clarity
;; From swap-y-for-x function
(y-balance-midpoint-scaled (/ (* y-balance-scaled midpoint) midpoint-factor))
(updated-x-balance-scaled (get-x dy-scaled y-balance-midpoint-scaled x-balance-scaled amplification-coefficient convergence-threshold))
```

##### Liquidity Operations
However, in liquidity operations, the contract uses raw balances without midpoint adjustment:

```clarity
;; From add-liquidity function
(d-a (get-d x-balance-scaled y-balance-scaled amplification-coefficient convergence-threshold))
(d-b (get-d updated-x-balance-scaled updated-y-balance-scaled amplification-coefficient convergence-threshold))
```

```clarity
;; From withdraw-liquidity function
(x-amount (/ (* amount x-balance) total-shares))
(y-amount (/ (* amount y-balance) total-shares))
```

#### Impact
This inconsistency leads to:
1. Arbitrage opportunities when STX ≠ stSTX
2. Incorrect LP token valuations
3. Potential loss of funds for liquidity providers

#### Exploitation Scenario
1. When STX > stSTX (midpoint_factor > midpoint):
   - Traders can exploit the difference between trading price and LP token price
   - LP tokens are minted/burned as if STX was worth less than its actual trading value
   - Arbitrageurs can profit by:
     a. Adding liquidity at undervalued rates
     b. Trading at market rates
     c. Removing liquidity at undervalued rates

2. When STX < stSTX (midpoint_factor < midpoint):
   - The opposite scenario occurs
   - LP tokens are minted/burned as if STX was worth more than its actual trading value

### 2. Medium: Potential Precision Loss

#### Description
The contract uses multiple scaling operations for decimal handling, which could lead to precision loss in certain scenarios.

#### Technical Details
```clarity
;; Scale up operations
(define-private (scale-up-amounts (x-amount uint) (y-amount uint) (x-token-trait <sip-010-trait>) (y-token-trait <sip-010-trait>))
  (let (
    (x-decimals (unwrap-panic (contract-call? x-token-trait get-decimals)))
    (y-decimals (unwrap-panic (contract-call? y-token-trait get-decimals)))
    (x-amount-scaled
      (if (is-eq x-decimals y-decimals)
        x-amount
        (if (> x-decimals y-decimals)
          x-amount
          (* x-amount (pow u10 (- y-decimals x-decimals)))
        )
      )
    )
    ;; ... rest of the function
  ))
```

#### Impact
- Potential rounding errors in calculations
- Possible loss of precision in large numbers
- May affect users with small token amounts

### 3. Low: Documentation Gaps

#### Description
The contract lacks comprehensive documentation for certain critical parameters and mathematical models.

#### Examples
1. Amplification Coefficient:
```clarity
;; Set amplification coefficient for a pool
(define-public (set-amplification-coefficient (pool-trait <stableswap-pool-trait>) (coefficient uint))
```
- No documentation on safe ranges for coefficient
- Missing explanation of impact on pool behavior

2. Convergence Threshold:
```clarity
;; Set convergence threshold for a pool
(define-public (set-convergence-threshold (pool-trait <stableswap-pool-trait>) (threshold uint))
```
- No guidance on optimal threshold values
- Missing explanation of trade-offs

## Recommendations

### 1. Fix Midpoint Value Inconsistency

#### Proposed Changes
1. Add helper function for consistent balance adjustment:
```clarity
(define-private (get-adjusted-balances 
    (x-balance uint) 
    (y-balance uint) 
    (midpoint uint) 
    (midpoint-factor uint)
  )
  {
    x-adjusted: (/ (* x-balance midpoint-factor) midpoint),
    y-adjusted: (/ (* y-balance midpoint) midpoint-factor)
  }
)
```

2. Modify add-liquidity function to use adjusted balances:
```clarity
(let (
    (adjusted-balances (get-adjusted-balances x-balance y-balance midpoint midpoint-factor))
    (x-balance-adjusted (get x-adjusted adjusted-balances))
    (y-balance-adjusted (get y-adjusted adjusted-balances))
    ;; Use adjusted balances in d-value calculations
    (d-a (get-d x-balance-adjusted y-balance-adjusted amplification-coefficient convergence-threshold))
    ;; ... rest of the function
  ))
```

3. Update withdraw-liquidity to use adjusted balances:
```clarity
(let (
    (adjusted-balances (get-adjusted-balances x-balance y-balance midpoint midpoint-factor))
    (x-amount (/ (* amount (get x-adjusted adjusted-balances)) total-shares))
    (y-amount (/ (* amount (get y-adjusted adjusted-balances)) total-shares))
    ;; ... rest of the function
  ))
```

### 2. Improve Precision Handling

1. Add minimum value checks:
```clarity
(asserts! (> x-amount-scaled u1000) ERR_AMOUNT_TOO_SMALL) ;; Prevent dust amounts
```

2. Document precision loss scenarios in comments

### 3. Enhance Documentation

1. Add detailed parameter documentation:
```clarity
;; @notice Sets the amplification coefficient for the pool
;; @dev The amplification coefficient affects the pool's price curve
;; @param coefficient Must be > 0, recommended range: 1-5000
;; @param Higher values = more stable prices near 1:1
;; @param Lower values = more like a constant product AMM
```

2. Create comprehensive technical documentation

## Security Considerations

### Access Control
The contract implements proper access control through admin functions:
```clarity
(define-public (add-admin (admin principal))
  (let (
    (admins-list (var-get admins))
    (caller tx-sender)
  )
    (asserts! (is-some (index-of admins-list caller)) ERR_NOT_AUTHORIZED)
    ;; ... rest of the function
  ))
```

### Fee Handling
Fees are properly calculated and distributed:
```clarity
(x-amount-fees-protocol-scaled (/ (* x-amount-scaled protocol-fee) BPS))
(x-amount-fees-provider-scaled (/ (* x-amount-scaled provider-fee) BPS))
```

### Error Handling
Comprehensive error constants and checks:
```clarity
(define-constant ERR_NOT_AUTHORIZED (err u1001))
(define-constant ERR_INVALID_AMOUNT (err u1002))
;; ... more error constants
```

## Testing Recommendations

1. Add specific test cases for midpoint scenarios:
   - Test LP token minting/burning at different midpoint values
   - Verify no arbitrage opportunities exist
   - Test extreme price scenarios

2. Add property-based tests for:
   - Invariant maintenance
   - Rounding behavior
   - Fee calculations

3. Add integration tests for:
   - Multi-step trading scenarios
   - Complex liquidity provision/removal cases

## Conclusion

The stableswap pool contract requires immediate attention to address the midpoint value inconsistency issue. While the overall architecture is sound, this critical issue could lead to significant economic implications if left unresolved. The recommended changes should be implemented and thoroughly tested before deployment.

### Risk Assessment Matrix

| Component | Risk Level | Impact | Likelihood |
|-----------|------------|---------|------------|
| Midpoint Handling | High | High | High |
| Precision Loss | Medium | Medium | Low |
| Documentation | Low | Low | N/A |

### Next Steps

1. Implement proposed fixes for midpoint handling
2. Add comprehensive test suite
3. Conduct follow-up audit after changes
4. Update documentation
5. Deploy with monitoring for unusual activity

---

*This audit was conducted on February 17, 2024. The findings are based on the contract code as of this date.* 