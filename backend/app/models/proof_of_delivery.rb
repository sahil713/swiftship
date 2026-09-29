class ProofOfDelivery < ApplicationRecord
  MAX_DATA_URL_BYTES = 3.megabytes

  belongs_to :booking
  belongs_to :user, optional: true

  validates :recipient_name, presence: true
  validate :has_signature_or_photo
  validate :data_urls_are_images

  def as_json(*)
    slice(:id, :recipient_name, :signature_data, :photo_data, :notes, :created_at).merge(driver: user&.name)
  end

  private

  def has_signature_or_photo
    errors.add(:base, "A signature or photo is required") if signature_data.blank? && photo_data.blank?
  end

  def data_urls_are_images
    { signature_data:, photo_data: }.each do |attr, value|
      next if value.blank?
      unless value.start_with?("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,")
        errors.add(attr, "must be a PNG, JPEG or WebP image")
      end
      errors.add(attr, "is too large") if value.bytesize > MAX_DATA_URL_BYTES
    end
  end
end
