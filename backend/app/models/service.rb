class Service < ApplicationRecord
  has_many :bookings, dependent: :restrict_with_error

  validates :name, :slug, presence: true
  validates :slug, uniqueness: true, format: { with: /\A[a-z0-9-]+\z/ }
  validates :base_price_pence, :price_per_kg_pence, :included_kg, numericality: { greater_than_or_equal_to: 0 }

  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:position, :id) }

  # Working days from collection to delivery (0 = same day).
  def transit_days
    case slug
    when "same-day" then 0
    when "express" then 1
    when "fragile-bulky" then 3
    else 2
    end
  end

  def same_day? = slug == "same-day"

  def as_json(*)
    slice(:id, :name, :slug, :tagline, :description, :transit_time, :base_price_pence,
          :price_per_kg_pence, :included_kg, :max_weight_kg, :cutoff_hour, :restrictions,
          :position, :active)
  end
end
