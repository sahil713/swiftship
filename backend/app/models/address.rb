class Address < ApplicationRecord
  belongs_to :user

  normalizes :postcode, with: ->(pc) { UkPostcode.format(pc) || pc.to_s.upcase.strip }

  validates :line1, :city, :postcode, presence: true
  validate :postcode_format

  def as_json(*)
    slice(:id, :label, :contact_name, :phone, :line1, :line2, :city, :postcode)
  end

  private

  def postcode_format
    errors.add(:postcode, "is not a valid UK postcode") unless UkPostcode.valid?(postcode)
  end
end
