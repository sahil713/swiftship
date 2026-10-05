# An exception to the normal UK service area for one postcode area (e.g. "TQ").
# Requests touching these areas are still accepted but flagged for admin review.
# Ireland is never configured here – it is always blocked in ServiceArea.
class PostcodeRule < ApplicationRecord
  LEVELS = %w[outside restricted].freeze
  LEVEL_LABELS = {
    "outside" => "Outside our normal service area",
    "restricted" => "Limited service area – served only occasionally"
  }.freeze

  normalizes :postcode_area, with: ->(v) { v.to_s.strip.upcase }

  validates :postcode_area, presence: true, uniqueness: true, format: { with: /\A[A-Z]{1,2}\z/, message: "must be 1–2 letters, e.g. TQ" }
  validates :level, inclusion: { in: LEVELS }
  validate :not_ireland

  scope :active, -> { where(active: true) }

  def self.for_area(area) = active.find_by(postcode_area: area)

  def as_json(*)
    slice(:id, :postcode_area, :level, :note, :active).merge(level_label: LEVEL_LABELS[level])
  end

  private

  def not_ireland
    errors.add(:postcode_area, "BT (Northern Ireland) is always excluded and can't be changed here") if postcode_area == "BT"
  end
end
