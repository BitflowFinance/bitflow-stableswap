## Stableswap Staking STX-stSTX v1.1

This contract implements the staking mechanism for the STX-stSTX Stableswap pool. It allows liquidity providers to stake their LP tokens and earn rewards.

### Key Features

#### Staking Mechanism

- Cycle-based staking system
- Early unstaking functionality
- Rewards distribution per cycle
- Multiple cycles management

### Core Functions

#### Staking Operations

- `stake`
  - Stakes LP tokens for a specified number of cycles
  - Parameters:
    - `amount`: Amount of LP tokens to stake
    - `lock-cycles`: Number of cycles to lock tokens
  - Returns: Response indicating success/failure

- `unstake`
  - Unstakes LP tokens after lock period
  - Parameters:
    - `cycle`: The cycle to unstake from
  - Returns: Response with unstaked amount

- `early-unstake`
  - Allows early unstaking with penalty
  - Parameters:
    - `cycles`: List of cycles to unstake from
  - Returns: Response with unstaked amount and penalty

#### Reward Management

- `get-rewards`
  - Returns available rewards for a user
  - Parameters:
    - `cycle`: The cycle to check rewards for
  - Returns: Response with reward amount

- `claim-rewards`
  - Claims available rewards for a specific cycle
  - Parameters:
    - `cycle`: The cycle to claim rewards from
  - Returns: Response with claimed amount

#### View Functions

- `get-user-staking-data`
  - Returns user's staking data for a cycle
  - Parameters:
    - `user`: User principal
    - `cycle`: Cycle number
  - Returns: Response with staking data

- `get-cycle-data`
  - Returns total staked amount for a cycle
  - Parameters:
    - `cycle`: Cycle number
  - Returns: Response with cycle data

### Error Codes

- `ERR_UNAUTHORIZED`: Unauthorized operation
- `ERR_INVALID_CYCLE`: Invalid cycle number
- `ERR_NO_STAKE`: No stake found
- `ERR_LOCKED`: Tokens still locked
- `ERR_TRANSFER_FAILED`: Token transfer failed
- `ERR_ALREADY_CLAIMED`: Rewards already claimed

### State Management

- Uses maps to track:
  - User staking positions
  - Cycle total stakes
  - Claimed rewards
  - Lock periods

### Usage

This contract is used in conjunction with the STX-stSTX pool to provide additional yield opportunities for liquidity providers through staking rewards. Users can lock their LP tokens for various periods to earn rewards, with longer lock periods potentially earning higher rewards.
