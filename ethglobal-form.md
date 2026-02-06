Short description *
A max 100-character or less description of your project (it should fit in a tweet!)

Description *
Go in as much detail as you can about what this project is. Please be as clear as possible! (min 280 characters)

AbiPago solves a real world crypto payments problem: merchants and users rarely share the same chain or token, and “how to get paid” is often centralized or manual. AbiPago turns a simple NFC/QR invoice into an intent like payment flow backed by portable onchain configuration.
A merchant uses an ENS name (e.g., cafeteria.eth) and stores a payment profile in ENS text records: desired token, settlement chain, receiver address, and optional settings (expiry, slippage). A payer scans a QR or taps an NFC tag, AbiPago resolves ENS and automatically builds the best route from the payer’s current assets to the merchant’s requested settlement.
AbiPago executes cross-chain routing using LI.FI Composer (swap, bridge, and optionally contract call). On the destination chain, a PayRouter receives funds, optionally performs a final Uniswap v4 swap (Universal Router) if needed, and pays the merchant, emitting an onchain receipt event

How it's made *
Tell us about how you built this project; the nitty-gritty details. What technologies did you use? How are they pieced together? If you used any partner technologies, how did it benefit your project? Did you do anything particuarly hacky that's notable and worth mentioning? (min 280 characters)

AbiPago is a React Native mobile payments app that turns a simple NFC tap or QR scan into an end-to-end onchain payment. Merchants publish a “payment profile” on ENS using text records (pay.chainId, pay.token, pay.receiver, etc.), so the app can resolve human readable names (no 0x) and auto configure settlement without any centralized settings. When a user pays, AbiPago connects via WalletConnect and uses LI.FI Composer routes to swap/bridge from the user’s current chain/token into the merchant’s desired chain/token. On the destination chain we call our Solidity PayRouter contract to finalize settlement; if the incoming asset doesn’t match the merchant’s requested token, PayRouter performs a final swap using Uniswap v4 (via Universal Router) before transferring funds and emitting an onchain receipt event. The “hacky” bit: ENS acts as a portable payments configuration layer, and LI.FI + Uniswap v4 make the entire cross-chain swap-> pay flow feel like a single tap.