# Simulated card processor so the booking → payment flow works end to end in
# development. Replace with a Stripe PaymentIntent integration for production;
# card details must then never touch this server (use Stripe Elements).
class PaymentProcessor
  class Declined < StandardError; end

  TEST_DECLINE_CARD = "4000000000000002".freeze

  def self.charge!(booking:, amount_pence:, card_number:, expiry:, cvc:)
    number = card_number.to_s.gsub(/\D/, "")
    raise Declined, "Enter a valid card number." unless number.length.between?(13, 19) && luhn?(number)
    raise Declined, "Enter a valid expiry date." unless valid_expiry?(expiry)
    raise Declined, "Enter a valid security code." unless cvc.to_s.match?(/\A\d{3,4}\z/)
    raise Declined, "Your card was declined. Please try another card." if number == TEST_DECLINE_CARD

    booking.payments.create!(
      amount_pence:, status: "succeeded", provider: "simulated",
      provider_reference: "sim_#{SecureRandom.hex(10)}",
      card_last4: number[-4..], card_brand: brand(number)
    )
  end

  def self.refund!(payment:, amount_pence:)
    raise ArgumentError, "Refund exceeds amount paid" if amount_pence > payment.refundable_pence
    payment.refunded_pence += amount_pence
    payment.status = payment.refunded_pence >= payment.amount_pence ? "refunded" : "partially_refunded"
    payment.save!
    payment
  end

  def self.luhn?(number)
    sum = number.reverse.chars.each_with_index.sum do |ch, i|
      d = ch.to_i
      d *= 2 if i.odd?
      d > 9 ? d - 9 : d
    end
    (sum % 10).zero?
  end

  def self.valid_expiry?(expiry)
    m = expiry.to_s.match(%r{\A\s*(\d{1,2})\s*/\s*(\d{2}|\d{4})\s*\z})
    return false unless m
    month = m[1].to_i
    year = m[2].length == 2 ? 2000 + m[2].to_i : m[2].to_i
    return false unless (1..12).cover?(month)
    Date.new(year, month, -1) >= Date.current
  end

  def self.brand(number)
    case number
    when /\A4/ then "Visa"
    when /\A(5[1-5]|2[2-7])/ then "Mastercard"
    when /\A3[47]/ then "Amex"
    else "Card"
    end
  end
end
