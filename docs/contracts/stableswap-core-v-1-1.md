# Stableswap Core v1.1

This contract implements the core functionality for the Stableswap protocol, a decentralized exchange (DEX) designed for efficient stablecoin trading with low slippage. It manages pool creation, swaps, and liquidity operations.

## Constants

### Error Codes
- `ERR_NOT_AUTHORIZED (u1001)`: Operation not authorized
- `ERR_INVALID_AMOUNT (u1002)`: Invalid amount specified
- `ERR_INVALID_PRINCIPAL (u1003)`: Invalid principal provided
- `ERR_ALREADY_ADMIN (u2001)`: Principal is already an admin
- `ERR_ADMIN_LIMIT_REACHED (u2002)`: Admin list is at capacity
- `ERR_ADMIN_NOT_IN_LIST (u2003)`: Admin not found in list
- `ERR_CANNOT_REMOVE_CONTRACT_DEPLOYER (u2004)`: Cannot remove deployer
- `ERR_NO_POOL_DATA (u3001)`: Pool data not found
- `ERR_POOL_NOT_CREATED (u3002)`: Pool has not been created
- `ERR_POOL_DISABLED (u3003)`: Pool is currently disabled
- `ERR_POOL_ALREADY_CREATED (u3004)`: Pool already exists
- `ERR_INVALID_POOL (u3005)`: Invalid pool specified
- `ERR_INVALID_POOL_URI (u3006)`: Invalid pool URI
- `ERR_INVALID_POOL_SYMBOL (u3007)`: Invalid pool symbol
- `ERR_INVALID_TOKEN_SYMBOL (u3009)`: Invalid token symbol
- `ERR_MATCHING_TOKEN_CONTRACTS (u3010)`: Token contracts are the same
- `ERR_INVALID_X_TOKEN (u3011)`: Invalid X token contract
- `ERR_INVALID_Y_TOKEN (u3012)`: Invalid Y token contract
- `ERR_MINIMUM_X_AMOUNT (u3013)`: X amount below minimum
- `ERR_MINIMUM_Y_AMOUNT (u3014)`: Y amount below minimum
- `ERR_MINIMUM_LP_AMOUNT (u3015)`: LP amount below minimum
- `ERR_UNEQUAL_POOL_BALANCES (u3016)`: Pool balances not equal
- `ERR_MINIMUM_D_VALUE (u3017)`: D value below minimum

### Configuration Constants
- `BPS_1 (u10000)`: Base points denominator (100%)
- `BPS_2 (u10)`: Secondary scaling factor
- `BPS_3 (u2)`: Tertiary scaling factor
- `BPS_4 (u1)`: Quaternary scaling factor
- `MINIMUM_SHARES (u1000000)`: Minimum LP token amount

## Data Variables

- `admins`: List of admin principals (max 5)
- `admin-helper`: Helper admin principal
- `last-pool-id`: Counter for pool IDs
- `public-pool-creation`: Flag for public pool creation
- `pools`: Map of pool data indexed by ID

## Read-Only Functions

### Administrative
- `get-admins() → (response (list 5 principal) uint)`
  - Returns list of admin principals

- `get-admin-helper() → (response principal uint)`
  - Returns admin helper principal

- `get-last-pool-id() → (response uint uint)`
  - Returns latest pool ID

- `get-public-pool-creation() → (response bool uint)`
  - Returns public pool creation status

- `get-pool-by-id(id uint) → (response (optional {id: uint, name: (string-ascii 256), symbol: (string-ascii 256), pool-contract: principal}) uint)`
  - Returns pool data for given ID

### Price Calculation
- `get-dy(pool-trait <stableswap-pool-trait>, x-token-trait <sip-010-trait>, y-token-trait <sip-010-trait>, x-amount uint) → (response uint uint)`
  - Calculates output amount of token Y for input amount of token X
  - Returns expected Y token amount

- `get-dx(pool-trait <stableswap-pool-trait>, x-token-trait <sip-010-trait>, y-token-trait <sip-010-trait>, y-amount uint) → (response uint uint)`
  - Calculates input amount of token X needed for desired amount of token Y
  - Returns required X token amount

- `get-dlp(pool-trait <stableswap-pool-trait>, x-token-trait <sip-010-trait>, y-token-trait <sip-010-trait>, x-amount uint, y-amount uint) → (response uint uint)`
  - Calculates LP tokens to be minted for given token amounts
  - Returns expected LP token amount

## Public Functions

### Pool Management
- `create-pool(pool-trait <stableswap-pool-trait>, x-token-trait <sip-010-trait>, y-token-trait <sip-010-trait>, x-amount uint, y-amount uint, x-protocol-fee uint, x-provider-fee uint, y-protocol-fee uint, y-provider-fee uint, liquidity-fee uint, amplification-coefficient uint, fee-address principal, uri (string-utf8 256), status bool) → (response bool uint)`
  - Creates a new pool with specified parameters
  - Only callable by admins unless public creation is enabled

### Trading Operations
- `swap-x-for-y(pool-trait <stableswap-pool-trait>, x-token-trait <sip-010-trait>, y-token-trait <sip-010-trait>, x-amount uint, min-dy uint) → (response uint uint)`
  - Swaps token X for token Y
  - Returns actual Y token amount received

- `swap-y-for-x(pool-trait <stableswap-pool-trait>, x-token-trait <sip-010-trait>, y-token-trait <sip-010-trait>, y-amount uint, min-dx uint) → (response uint uint)`
  - Swaps token Y for token X
  - Returns actual X token amount received

### Liquidity Operations
- `add-liquidity(pool-trait <stableswap-pool-trait>, x-token-trait <sip-010-trait>, y-token-trait <sip-010-trait>, x-amount uint, y-amount uint, min-dlp uint) → (response uint uint)`
  - Adds liquidity to pool
  - Returns LP tokens minted

- `withdraw-liquidity(pool-trait <stableswap-pool-trait>, x-token-trait <sip-010-trait>, y-token-trait <sip-010-trait>, dlp-amount uint, min-x uint, min-y uint) → (response {dx: uint, dy: uint} uint)`
  - Removes liquidity from pool
  - Returns amounts of X and Y tokens received

### Fee Management
- `set-x-fees(pool-trait <stableswap-pool-trait>, protocol-fee uint, provider-fee uint) → (response bool uint)`
  - Sets fees for X token swaps
  - Only callable by admins

- `set-y-fees(pool-trait <stableswap-pool-trait>, protocol-fee uint, provider-fee uint) → (response bool uint)`
  - Sets fees for Y token swaps
  - Only callable by admins

- `set-liquidity-fee(pool-trait <stableswap-pool-trait>, fee uint) → (response bool uint)`
  - Sets fee for liquidity providers
  - Only callable by admins

### Pool Configuration
- `set-amplification-coefficient(pool-trait <stableswap-pool-trait>, coefficient uint) → (response bool uint)`
  - Sets pool's amplification coefficient
  - Only callable by admins

- `set-convergence-threshold(pool-trait <stableswap-pool-trait>, threshold uint) → (response bool uint)`
  - Sets pool's convergence threshold
  - Only callable by admins

## Usage Notes

1. Pool Creation:
   - Requires admin access unless public creation is enabled
   - Initial liquidity must be balanced
   - Fees must be specified in basis points (BPS)

2. Trading:
   - Slippage protection via minimum output amounts
   - Fees are split between protocol and liquidity providers
   - Maximum swap amount is 10% of pool balance

3. Liquidity:
   - Minimum LP token amount enforced
   - Balanced liquidity addition recommended
   - Withdrawals proportional to pool share

4. Security:
   - Admin functions protected
   - Pool operations can be paused
   - Slippage protection mandatory
