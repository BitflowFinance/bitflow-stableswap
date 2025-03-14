## Stableswap Pool STX-stSTX v1.1

This contract implements a specific Stableswap pool for trading between STX (Stacks token) and stSTX (Stacked STX token). It implements the stableswap-pool-trait interface and provides the necessary functionality for a stable pair trading pool.

## Overview

The STX-stSTX pool is a specialized implementation of the Stableswap AMM designed for efficient trading between STX and stSTX tokens. It uses the constant sum invariant model with an amplification coefficient to maintain price stability while providing sufficient liquidity.

## Constants

- `ERR_NOT_AUTHORIZED (u1001)`: Operation not authorized
- `ERR_INVALID_AMOUNT (u1002)`: Invalid amount specified
- `ERR_INVALID_PRINCIPAL (u1003)`: Invalid principal provided
- `ERR_POOL_NOT_CREATED (u3002)`: Pool has not been created
- `ERR_POOL_DISABLED (u3003)`: Pool is currently disabled
- `BPS (u10000)`: Basis points constant for fee calculations

## Data Variables

### Pool Configuration
- `pool-id`: Unique identifier for the pool
- `pool-name`: Name of the pool
- `pool-symbol`: Symbol for the pool's LP token
- `pool-uri`: URI for pool metadata
- `pool-created`: Boolean indicating if pool is created
- `pool-status`: Boolean indicating if pool is active
- `creation-height`: Block height at pool creation

### Token Configuration
- `x-token`: Principal of the STX token contract
- `y-token`: Principal of the stSTX token contract
- `fee-address`: Principal receiving fee payments

### Pool State
- `x-balance`: Current balance of STX token
- `y-balance`: Current balance of stSTX token
- `d`: Current invariant value

### Fee Configuration
- `x-protocol-fee`: Protocol fee for STX trades
- `x-provider-fee`: Provider fee for STX trades
- `y-protocol-fee`: Protocol fee for stSTX trades
- `y-provider-fee`: Provider fee for stSTX trades
- `liquidity-fee`: Fee for liquidity providers

### AMM Parameters
- `amplification-coefficient`: A parameter that affects the pool's price curve
- `convergence-threshold`: Threshold for price calculations (default: 2)

## Read-Only Functions

### SIP-010 Interface
- `get-name() → (response (string-ascii 256) uint)`
  - Returns the pool's name
  
- `get-symbol() → (response (string-ascii 256) uint)`
  - Returns the pool's symbol
  
- `get-decimals() → (response uint uint)`
  - Returns the decimal places (6)
  
- `get-token-uri() → (response (optional (string-utf8 256)) uint)`
  - Returns the token URI if set

- `get-total-supply() → (response uint uint)`
  - Returns total supply of LP tokens

- `get-balance(address principal) → (response uint uint)`
  - Returns LP token balance for given address

### Pool Information
- `get-pool() → (response {...} uint)`
  - Returns comprehensive pool information including:
    - Pool configuration
    - Current balances
    - Fee settings
    - AMM parameters

## Public Functions

### Pool Configuration
- `set-pool-uri(uri (string-utf8 256)) → (response bool uint)`
  - Sets the pool's URI
  - Only callable by core contract

- `set-pool-status(status bool) → (response bool uint)`
  - Enables/disables the pool
  - Only callable by core contract

- `set-fee-address(address principal) → (response bool uint)`
  - Sets the fee recipient address
  - Only callable by core contract

### Fee Management
- `set-x-fees(protocol-fee uint, provider-fee uint) → (response bool uint)`
  - Sets STX token fees
  - Only callable by core contract

- `set-y-fees(protocol-fee uint, provider-fee uint) → (response bool uint)`
  - Sets stSTX token fees
  - Only callable by core contract

- `set-liquidity-fee(fee uint) → (response bool uint)`
  - Sets the liquidity provider fee
  - Only callable by core contract

### AMM Configuration
- `set-amplification-coefficient(coefficient uint) → (response bool uint)`
  - Sets the amplification coefficient
  - Only callable by core contract

- `set-convergence-threshold(threshold uint) → (response bool uint)`
  - Sets the convergence threshold
  - Only callable by core contract

### Pool Operations
- `update-pool-balances(x-bal uint, y-bal uint, d-val uint) → (response bool uint)`
  - Updates pool balances and invariant
  - Only callable by core contract

### Token Operations
- `transfer(amount uint, sender principal, recipient principal, memo (optional (buff 34))) → (response bool uint)`
  - Transfers LP tokens between addresses
  - Standard SIP-010 transfer function

- `pool-transfer(token-trait <sip-010-trait>, amount uint, recipient principal) → (response bool uint)`
  - Transfers tokens from the pool
  - Only callable by core contract

- `pool-mint(amount uint, address principal) → (response bool uint)`
  - Mints LP tokens
  - Only callable by core contract

- `pool-burn(amount uint, address principal) → (response bool uint)`
  - Burns LP tokens
  - Only callable by core contract

### Pool Initialization
- `create-pool(x-token-contract principal, y-token-contract principal, fee-addr principal, coefficient uint, id uint, name (string-ascii 256), symbol (string-ascii 256), uri (string-utf8 256), status bool) → (response bool uint)`
  - Initializes the pool with given parameters
  - Only callable by core contract

## Usage Notes

1. All pool operations (swaps, liquidity additions/removals) must be performed through the core contract.
2. The pool can be disabled by the core contract if needed.
3. Fee parameters can be adjusted by the core contract.
4. The amplification coefficient affects the price curve and should be set appropriately for the STX/stSTX pair.

## Security Considerations

1. Only the core contract can modify pool state
2. All token transfers require explicit approval
3. Pool can be paused via status flag
4. Fee parameters are bounded by BPS constant
5. Critical operations include reentrancy protection
