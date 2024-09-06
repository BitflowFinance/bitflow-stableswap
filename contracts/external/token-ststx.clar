;; token-ststx

(impl-trait .sip-010-trait-ft-standard-v-1-1.sip-010-trait)

(define-fungible-token stSTX)

(define-data-var token-uri (string-utf8 256) u"")

(define-read-only (get-total-supply)
  (ok (ft-get-supply stSTX))
)

(define-read-only (get-name)
  (ok "stSTX Token")
)

(define-read-only (get-symbol)
  (ok "stSTX")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance stSTX account))
)

(define-read-only (get-balance-simple (account principal))
  (ft-get-balance stSTX account)
)


(define-read-only (get-token-uri)
  (ok (some (var-get token-uri)))
)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) (err u1001))

    (match (ft-transfer? stSTX amount sender recipient)
      response (begin
        (print memo)
        (ok response)
      )
      error (err error)
    )
  )
)

(define-public (mint (amount uint) (recipient principal))
  (begin
    (ft-mint? stSTX amount recipient)
  )
)

(define-public (burn (amount uint))
  (begin
    (ft-burn? stSTX amount tx-sender)
  )
)