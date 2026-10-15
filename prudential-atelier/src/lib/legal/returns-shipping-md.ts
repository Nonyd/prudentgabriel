/** Returns & Refunds and Shipping policies. Revision "nd-1", 15 October 2026. */

export const RETURNS_MD = `## How returns work

Every Prudent Gabriel piece is cut after you order it. What you can return depends on whether it was cut to a size on our chart or to your own measurements, and on whether we met our agreement with you. This policy is part of our [Terms & Conditions](/terms-and-conditions) and does not affect your statutory rights under the Federal Competition and Consumer Protection Act 2018 or the consumer law of your country.

## Standard-size pieces: change of mind

You may return a standard-size ready-to-wear piece within **{{return_window_days}} days** of delivery (or of collection from the atelier) if you change your mind, for an exchange or a credit to your account.

1. Write to [{{contact_email}}](mailto:{{contact_email}}) within those {{return_window_days}} days with your order number and the piece you wish to return.
2. We reply with the return address and instructions. Please do not send a piece without writing to us first.
3. Send it back within seven days of our reply, unworn, unwashed, unaltered, with its tags and packaging, using a tracked service. The cost of returning it is yours, and it is your responsibility until it reaches us.
4. When we have received and checked it, we arrange your exchange, or credit your account with the price you paid for the piece (delivery charges are not credited).

A change-of-mind return is exchanged or credited, not refunded as cash. Pieces paid for with Prudent Points are credited back to your points balance.

## Made-to-measure pieces, commissions and bridal

A piece made to your measurements, an atelier commission or a bridal piece is cut for your body alone and cannot be worn by anyone else, so it **cannot be returned for a change of mind**, including a change in your size after you gave us your measurements. This does not affect your rights if the piece is faulty or not made as agreed (below).

Atelier commissions come with a free alteration window after you confirm receipt (below).

## Faulty, damaged or not as agreed

If your piece arrives damaged, has a fault in its making, or is not what you ordered (for example the wrong size, colour or design, or not cut to the measurements you gave us), we will put it right.

- {{#post_delivery_fault_hours}}Please tell us within {{post_delivery_fault_hours}} hours of delivery, with photographs of the piece and the packaging, at [{{contact_email}}](mailto:{{contact_email}}). Telling us quickly helps us claim from the carrier and act fast; it does not remove your statutory rights for a fault you could not reasonably have noticed on delivery.{{/post_delivery_fault_hours}}
- We may ask you to send the piece back so our workroom can inspect it. We pay for that return.
- We will repair or remake the piece. If we cannot offer a reasonable solution within a reasonable time, we refund what you paid for it, including the original delivery charge.

Small variations in colour, fabric, beading and finish from the photographs are part of handmade work and are not a fault.

## Fabric unavailable

{{#fabric_promise_hours}}If the fabric for your piece becomes unavailable after you order, we tell you and offer an alternative or a full refund within {{fabric_promise_hours}} hours.{{/fabric_promise_hours}}

## When we fail

{{#house_term_refunds}}{{house_term_refunds}}{{/house_term_refunds}}

That is the refunds term printed on every quotation and invoice. It covers a piece we do not make, do not deliver in good and usable condition, or do not deliver by the agreed date, where we cannot put it right. In those cases you are entitled to a refund of what you paid for it.

## How refunds are paid

When a refund is due, we pay it to the payment method you used (a card refund goes back through the same payment provider) or, for a bank transfer, to an account in your name, within **fourteen business days** of agreeing the refund. Card refunds can take a further few days to appear, depending on your bank. Amounts are refunded in the currency and naira value of the original order; we are not responsible for exchange-rate differences or charges your bank makes. Prudent Points used on the order are returned to your points balance.

## Atelier alterations after delivery

{{#alteration_warranty_days}}After you confirm you have received your commission, you have {{alteration_warranty_days}} days to ask for alterations to its fit or workmanship, free of charge. A change of design you request, damage after delivery, or a request after that window is a new, charged instruction.{{/alteration_warranty_days}}

## Consultations

The consultation fee is not refundable, as you agree when you book, unless we cancel your consultation and cannot offer another date, in which case we refund it in full.

## Contact

{{#contact_email}}[{{contact_email}}](mailto:{{contact_email}}){{/contact_email}}
`;

export const SHIPPING_MD = `## Made, then shipped

Nothing is held in stock. {{#production_time}}A ready-to-wear piece is made in {{production_time}}, then shipped.{{/production_time}} Delivery time is in addition to the making time. Where a product shows its own making time, that time applies to that piece. Commission delivery dates are those agreed on your quotation, and you can follow every stage on your tracking page.

## Delivery options

{{#shipping_methods}}We currently offer: {{shipping_methods}}.{{/shipping_methods}}

{{#shipping_lagos}}Lagos delivery: {{shipping_lagos}}.{{/shipping_lagos}}

**Elsewhere in Nigeria** we send with GIG Logistics, and **internationally** with DHL. Where a rate can be calculated at checkout, you pay it with your order. Otherwise you agree at checkout that we will confirm the courier and the cost once your piece is packed; we tell you the cost before dispatch, and send your piece once it is paid.

{{#house_term_shipping}}{{house_term_shipping}}{{/house_term_shipping}}

Delivery times given by us or the carrier are estimates, counted in business days from dispatch.

## International orders, duties and taxes

{{#shipping_ddu}}{{shipping_ddu}}{{/shipping_ddu}}

International orders are sent **delivered duty unpaid (DDU)**. We do not collect import duties, taxes or customs charges at checkout, and the recipient pays them on arrival. If they are refused and the parcel is returned to us, the cost of the return and of any re-delivery is yours, and we refund the price of the piece less those costs only where you are entitled to return it. Please check your country's rules before ordering.

## Your address and delivery

Please check your delivery details carefully: we and the carrier deliver to the address you give us. If a delivery fails because the address is wrong or no one is available, the carrier's own redelivery rules and charges apply, and re-sending the piece is at your cost.

Please check your parcel when it arrives. Risk in your piece passes to you on delivery to your address or on collection. {{#post_delivery_fault_hours}}If it arrives damaged, tell us within {{post_delivery_fault_hours}} hours with photographs, as our [Returns & Refunds Policy](/returns-policy) explains.{{/post_delivery_fault_hours}}

## Collecting from the atelier

If you choose collection, we email you a collection code when your piece is ready. Please bring the code and identification matching the name on the order to our atelier in Ajah, Lagos, during opening hours. Someone else may collect for you with the code and your written authority.

We hold your piece for fourteen days after telling you it is ready{{#shipping_uncollected_days}}, and send a reminder after {{shipping_uncollected_days}} days{{/shipping_uncollected_days}}. After that we contact you to arrange collection or delivery at your cost. Our [Terms & Conditions](/terms-and-conditions) explain what happens to a piece that stays uncollected for a long time.

## Tracking

Shop orders show their status in your account, and we email a carrier tracking number when there is one. Commissions are followed stage by stage on your tracking page, using your order reference and the email on the order.

## Contact

{{#contact_email}}For delivery questions: [{{contact_email}}](mailto:{{contact_email}}){{/contact_email}}
`;
