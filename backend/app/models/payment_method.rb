# A bank account or other way for customers to pay, saved by an admin and reused when sending
# payment details to a customer.
class PaymentMethod < ApplicationRecord
  validates :name, presence: true
  validates :sort_code, format: { with: /\A\d{2}-?\d{2}-?\d{2}\z/, message: "must be 6 digits, e.g. 12-34-56" }, allow_blank: true
  validates :account_number, format: { with: /\A\d{6,10}\z/, message: "must be 6–10 digits" }, allow_blank: true
  validates :iban, format: { with: /\A[A-Z]{2}\d{2}[A-Z0-9 ]{10,32}\z/i, message: "doesn't look like an IBAN" }, allow_blank: true
  validates :swift_bic, format: { with: /\A[A-Z0-9]{8}([A-Z0-9]{3})?\z/i, message: "must be 8 or 11 characters" }, allow_blank: true
  validate :has_payment_details

  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:position, :id) }

  # Lines describing how to pay, in display order (used in emails and texts).
  def detail_lines(reference: nil)
    [
      ["Bank", bank_name], ["Account name", account_name], ["Sort code", sort_code],
      ["Account number", account_number], ["IBAN", iban], ["SWIFT/BIC", swift_bic],
      ["Payment reference", reference]
    ].select { |_, v| v.present? }
  end

  def as_json(*)
    slice(:id, :name, :bank_name, :account_name, :account_number, :sort_code, :iban, :swift_bic, :instructions, :active, :position)
  end

  private

  def has_payment_details
    return if [account_number, iban, instructions].any?(&:present?)
    errors.add(:base, "Add an account number, an IBAN or payment instructions")
  end
end
