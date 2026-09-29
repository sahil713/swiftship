class Surcharge < ApplicationRecord
  # Codes the price calculator knows how to apply.
  CODES = %w[inter_region fragile bulky weekend_collection].freeze
  KINDS = %w[fixed percent].freeze

  validates :name, presence: true
  validates :code, inclusion: { in: CODES }, uniqueness: true
  validates :kind, inclusion: { in: KINDS }
  validates :amount, numericality: { greater_than_or_equal_to: 0 }

  scope :active, -> { where(active: true) }

  def as_json(*)
    slice(:id, :name, :code, :kind, :amount, :description, :active)
  end
end
