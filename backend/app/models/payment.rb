class Payment < ApplicationRecord
  STATUSES = %w[pending succeeded failed refunded partially_refunded].freeze

  belongs_to :booking

  validates :amount_pence, numericality: { greater_than: 0 }
  validates :status, inclusion: { in: STATUSES }

  scope :succeeded, -> { where(status: %w[succeeded partially_refunded refunded]) }

  def refundable_pence = amount_pence - refunded_pence

  def as_json(*)
    slice(:id, :amount_pence, :refunded_pence, :status, :provider, :provider_reference,
          :card_brand, :card_last4, :created_at)
  end
end
