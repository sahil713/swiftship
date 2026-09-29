class DeliveryArea < ApplicationRecord
  ZONES = %w[mainland remote northern_ireland excluded].freeze

  validates :name, presence: true
  validates :zone, inclusion: { in: ZONES }
  validates :surcharge_pence, :extra_transit_days, numericality: { greater_than_or_equal_to: 0 }

  before_validation { self.postcode_areas = Array(postcode_areas).map { _1.to_s.strip.upcase }.reject(&:blank?).uniq }

  def self.for_postcode_area(area)
    where("? = ANY (postcode_areas)", area).first
  end

  def as_json(*)
    slice(:id, :name, :zone, :postcode_areas, :surcharge_pence, :extra_transit_days, :serviced, :notes)
  end
end
