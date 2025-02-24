# Stableswap Testing Cheat Sheet

This document provides guidelines for safe value ranges when testing the Stableswap contract. Following these ranges helps avoid arithmetic underflows/overflows and ensures realistic test scenarios.

## 1. Pool Creation Parameters

### Initial Liquidity
- **x_amount, y_amount**: 
  - Minimum: >= 100,000 units each
  - Recommended: 1,000,000 - 10,000,000 units
  - Must be equal after scaling
  - Total (x_amount + y_amount) must be >= minimum-total-shares (10,000)

### Burn Amount
- **burn_amount**:
  - Minimum: >= 1,000 (minimum-burnt-shares)
  - Maximum: < total initial liquidity
  - Recommended: 1,000 to 10% of initial liquidity
  - Must result in (total_shares - burn_amount) >= 0

### Price Parameters
- **midpoint**:
  - Minimum: > 0
  - Recommended: 1,000,000
  - Used for price adjustments

- **midpoint_factor**:
  - Minimum: > 0
  - Recommended: 1,000,000
  - Ratio with midpoint determines price impact

### Fee Parameters
- **protocol_fee, provider_fee**:
  - Range: 1-100 each (0.01% - 1%)
  - Combined (protocol + provider) must be < 10,000
  - Recommended test values:
    - Low fees: 10 (0.1%)
    - Medium fees: 30 (0.3%)
    - High fees: 100 (1%)

- **liquidity_fee**:
  - Range: 1-100 (0.01% - 1%)
  - Must be < 10,000
  - Recommended test value: 40 (0.4%)

### Technical Parameters
- **amplification_coefficient**:
  - Range: 100-1000
  - Higher = more stable prices
  - Recommended test values:
    - Low stability: 100
    - Medium stability: 300
    - High stability: 500-1000

- **convergence_threshold**:
  - Range: 1-10
  - Lower = more precise but more computation
  - Recommended test value: 2

## 2. Swap Operations

### Swap Amounts
- **x_amount, y_amount**:
  - Minimum: >= 100 units
  - Maximum: < pool_balance * 10
  - Recommended test ranges:
    - Small swap: 0.1% of pool balance
    - Medium swap: 1% of pool balance
    - Large swap: 5% of pool balance

### Minimum Outputs
- **min_dx, min_dy**:
  - Minimum: >= 1 unit
  - Maximum: <= expected output amount
  - Recommended: 98% of expected output (2% slippage)

## 3. Liquidity Operations

### Adding Liquidity
- **Minimum add**:
  - Amount >= 1,000 units
  - Should be proportional to pool size
  - Recommended: >= 0.1% of pool balance

### Maximum Add
- < pool_balance * 10
- Should maintain reasonable proportions

### LP Tokens
- **min_dlp**:
  - Minimum: >= 1
  - Recommended: Expected LP tokens * 0.98 (2% slippage)

### Withdrawing Liquidity
- **amount**: 1 to user's LP token balance
- **min_x_amount, min_y_amount**: >= 1 unit each

## 4. Scaling Considerations

### Token Decimal Scaling
Different token decimals require amount scaling:
- 6 decimals (e.g., USDC): 0 to 10^12 safe range
- 8 decimals (e.g., BTC): 0 to 10^10 safe range
- 18 decimals (e.g., ETH): 0 to 1 safe range

### Safety Guidelines
- Keep amounts above 100 * token_decimals
- Keep amounts below balance * 10
- Maintain reasonable proportions to pool size (0.1% - 10%)
- Consider decimal scaling in all calculations

## 5. Test Scenario Recommendations

### Initial Pool Setup
```typescript
const INITIAL_POOL_BALANCE = 10_000_000; // 10M tokens
const BURN_AMOUNT = 1_000;
const MIDPOINT = 1_000_000;
const MIDPOINT_FACTOR = 1_000_000;
const PROTOCOL_FEE = 30;  // 0.3%
const PROVIDER_FEE = 30;  // 0.3%
const LIQUIDITY_FEE = 40; // 0.4%
const AMP_COEFF = 100;
const CONVERGENCE_THRESHOLD = 2;
```

### Swap Testing
```typescript
const SMALL_SWAP = INITIAL_POOL_BALANCE / 1000;    // 0.1%
const MEDIUM_SWAP = INITIAL_POOL_BALANCE / 100;     // 1%
const LARGE_SWAP = INITIAL_POOL_BALANCE / 20;       // 5%
```

### Liquidity Testing
```typescript
const MIN_LIQUIDITY_ADD = 100_000;
const STANDARD_LIQUIDITY_ADD = 1_000_000;
const LARGE_LIQUIDITY_ADD = 5_000_000;
```

## 6. Common Testing Pitfalls

1. **Underflow Errors**
   - Using amounts too small relative to pool size
   - Not accounting for fee scaling
   - Insufficient minimum output amounts

2. **Overflow Errors**
   - Amounts too large for uint limits
   - Not considering token decimal scaling
   - Excessive liquidity additions

3. **Invalid Operations**
   - Unequal initial liquidity
   - Fees exceeding BPS limits
   - Burn amounts too high or low

## 7. Best Practices

1. Always start with recommended values
2. Test edge cases within safe ranges
3. Consider token decimal differences
4. Maintain realistic proportions
5. Use appropriate scaling factors
6. Test with various fee configurations
7. Verify all calculations maintain precision

## 8. Deep Dive: Technical Parameters

### Midpoint & Midpoint Factor Mechanics

The midpoint and midpoint factor are crucial parameters that control the price curve and trading behavior of the pool. They work together to create price adjustments and discounts.

#### Midpoint
- **Purpose**: Controls the target price ratio between tokens
- **Range**: > 0, typically 1,000,000
- **Effect on Pool**:
  ```
  Higher midpoint = Higher price target for token X relative to Y
  Lower midpoint = Lower price target for token X relative to Y
  ```

#### Midpoint Factor
- **Purpose**: Controls the strength of price adjustments
- **Range**: > 0, typically 1,000,000
- **Effect on Pool**:
  ```
  Higher factor = More aggressive price adjustments
  Lower factor = More gradual price adjustments
  ```

#### Examples of Midpoint/Factor Combinations

1. **1:1 Peg (Stablecoin Pair)**
```typescript
const MIDPOINT = 1_000_000;
const MIDPOINT_FACTOR = 1_000_000;
// Results in equal value for both tokens
// Example: USDC/USDT pair
```

2. **2:1 Price Ratio**
```typescript
const MIDPOINT = 2_000_000;
const MIDPOINT_FACTOR = 1_000_000;
// Token X is valued at 2x Token Y
// Example: WBTC/ETH pair where BTC is ~2x ETH
```

3. **Aggressive Price Defense**
```typescript
const MIDPOINT = 1_000_000;
const MIDPOINT_FACTOR = 10_000_000;
// Strong resistance to price movement
// Useful for tokens that should maintain strict ratios
```

4. **Flexible Price Movement**
```typescript
const MIDPOINT = 1_000_000;
const MIDPOINT_FACTOR = 100_000;
// More flexible price movement
// Suitable for tokens with natural price variation
```

### Technical Controls Deep Dive

#### 1. Amplification Coefficient (A)

The amplification coefficient controls how tightly the pool maintains its target ratio.

```typescript
// Low Amplification (More volatile)
const AMP_COEFF = 100;
/* Effects:
- Larger price slippage
- Higher trading volume possible
- More profitable for arbitrage
- Suitable for volatile pairs
*/

// Medium Amplification (Balanced)
const AMP_COEFF = 300;
/* Effects:
- Moderate price slippage
- Balanced trading volume
- Normal arbitrage opportunities
- Suitable for most pairs
*/

// High Amplification (More stable)
const AMP_COEFF = 1000;
/* Effects:
- Minimal price slippage
- Lower trading volume needed
- Limited arbitrage opportunities
- Ideal for stablecoin pairs
*/
```

#### 2. Convergence Threshold

Controls the precision of price calculations using Newton's method.

```typescript
// High Precision (More computation)
const CONVERGENCE_THRESHOLD = 1;
/* Effects:
- More accurate prices
- Higher gas costs
- Better for high-value trades
- Recommended for production
*/

// Medium Precision (Balanced)
const CONVERGENCE_THRESHOLD = 2;
/* Effects:
- Good price accuracy
- Moderate gas costs
- Suitable for most use cases
*/

// Low Precision (Less computation)
const CONVERGENCE_THRESHOLD = 5;
/* Effects:
- Less accurate prices
- Lower gas costs
- Suitable for testing
- Not recommended for production
*/
```

#### 3. Fee Structure Impact

The combination of fees affects pool behavior and profitability.

```typescript
// Low Fee Environment
const PROTOCOL_FEE = 10;    // 0.1%
const PROVIDER_FEE = 10;    // 0.1%
const LIQUIDITY_FEE = 20;   // 0.2%
/* Effects:
- Higher trading volume
- More arbitrage opportunities
- Lower revenue per trade
- Better for high-frequency trading
*/

// Balanced Fee Structure
const PROTOCOL_FEE = 30;    // 0.3%
const PROVIDER_FEE = 30;    // 0.3%
const LIQUIDITY_FEE = 40;   // 0.4%
/* Effects:
- Moderate trading volume
- Standard arbitrage opportunities
- Balanced revenue generation
- Suitable for most pairs
*/

// High Fee Environment
const PROTOCOL_FEE = 100;   // 1%
const PROVIDER_FEE = 100;   // 1%
const LIQUIDITY_FEE = 100;  // 1%
/* Effects:
- Lower trading volume
- Limited arbitrage opportunities
- Higher revenue per trade
- Better for exotic pairs
*/
```

### Example Configurations for Different Use Cases

#### 1. Stablecoin Pool (USDC/USDT)
```typescript
const config = {
    MIDPOINT: 1_000_000,
    MIDPOINT_FACTOR: 1_000_000,
    AMP_COEFF: 1000,              // High stability
    CONVERGENCE_THRESHOLD: 1,      // High precision
    PROTOCOL_FEE: 10,             // Low fees
    PROVIDER_FEE: 10,
    LIQUIDITY_FEE: 20,
    INITIAL_POOL_BALANCE: 10_000_000
};
```

#### 2. Volatile Pair Pool (ETH/BTC)
```typescript
const config = {
    MIDPOINT: 1_000_000,
    MIDPOINT_FACTOR: 500_000,     // More flexible
    AMP_COEFF: 100,               // Lower stability
    CONVERGENCE_THRESHOLD: 2,      // Standard precision
    PROTOCOL_FEE: 30,             // Standard fees
    PROVIDER_FEE: 30,
    LIQUIDITY_FEE: 40,
    INITIAL_POOL_BALANCE: 1_000_000
};
```

#### 3. Exotic Pair Pool (Synthetic/Token)
```typescript
const config = {
    MIDPOINT: 2_000_000,          // 2:1 ratio
    MIDPOINT_FACTOR: 5_000_000,   // Strong defense
    AMP_COEFF: 500,               // Higher stability
    CONVERGENCE_THRESHOLD: 1,      // High precision
    PROTOCOL_FEE: 100,            // High fees
    PROVIDER_FEE: 100,
    LIQUIDITY_FEE: 100,
    INITIAL_POOL_BALANCE: 500_000
};
```

### Testing Different Scenarios

When testing pools, it's important to verify behavior under different conditions:

1. **Price Impact Tests**
```typescript
// Test small price impact
const smallSwap = INITIAL_POOL_BALANCE / 1000;
// Test medium price impact
const mediumSwap = INITIAL_POOL_BALANCE / 100;
// Test large price impact
const largeSwap = INITIAL_POOL_BALANCE / 10;
```

2. **Imbalance Tests**
```typescript
// Test balanced add
await addLiquidity(amount, amount);
// Test imbalanced add
await addLiquidity(amount * 2, amount);
// Test single-sided add
await addLiquidity(amount, 0);
```

3. **Fee Accumulation Tests**
```typescript
// Multiple small trades
for (let i = 0; i < 10; i++) {
    await swap(smallAmount);
}
// Single large trade
await swap(largeAmount);
// Compare fee generation
```

### Common Technical Issues and Solutions

1. **Price Drift**
   - Symptom: Pool price gradually deviates from target
   - Solution: Increase amplification coefficient or midpoint factor

2. **Excessive Slippage**
   - Symptom: Large trades have too much price impact
   - Solution: Increase pool liquidity or amplification coefficient

3. **Insufficient Fee Generation**
   - Symptom: Pool not generating enough fees
   - Solution: Adjust fee structure or increase trading volume

4. **Calculation Precision Issues**
   - Symptom: Swaps or liquidity operations failing
   - Solution: Lower convergence threshold or increase minimum operation sizes 