-- Read-only regression checks; run in an authenticated database session.
-- Does not create, change, or delete any financial records.
SELECT public.budget_payment_net(100, 'card') = 95 AS card_commission_5_percent;
SELECT public.budget_payment_net(100, 'transfer') = 100 AS transfer_no_commission;
SELECT round(public.budget_payment_net(1640, 'delivery', 25, 16), 2) = 1060.34 AS delivery_net;
SELECT sum(public.budget_payment_net(1, 'transfer')) = 1060 AS beyond_1000_rows FROM generate_series(1,1060);
SELECT public.till_tx_signed('adjustment_out',1230) = -1230 AS cash_to_card;
SELECT public.till_tx_signed('adjustment_in',1230) = 1230 AS card_to_cash;