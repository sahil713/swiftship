# Proof of Collection (POC) or Proof of Delivery (POD), kept against the job for reference.
class TaskProof < ApplicationRecord
  MAX_PHOTOS = 8
  MAX_IMAGE_BYTES = 2.megabytes
  IMAGE_PREFIXES = ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"].freeze

  belongs_to :driver_task
  belongs_to :user, optional: true

  validates :kind, inclusion: { in: DriverTask::KINDS }
  validates :person_name, :occurred_at, presence: true
  validate :photos_are_images
  validate :signature_is_image
  validate :collection_has_photo, if: -> { kind == "collection" }

  before_validation { self.photos = Array(photos).compact_blank }

  # A delivery can only be completed with the full POD: name, date/time, signature and a photo.
  def complete_for_delivery? = person_name.present? && occurred_at.present? && signature_data.present? && photos.any?

  def as_json(*)
    slice(:id, :kind, :person_name, :occurred_at, :notes, :signature_data, :photos, :created_at)
      .merge(recorded_by: user&.name)
  end

  private

  def collection_has_photo
    errors.add(:photos, "– add at least one photo of the collected items") if photos.empty?
  end

  def photos_are_images
    errors.add(:photos, "– up to #{MAX_PHOTOS} photos") if photos.size > MAX_PHOTOS
    photos.each { |photo| validate_image(:photos, photo) }
  end

  def signature_is_image
    validate_image(:signature_data, signature_data) if signature_data.present?
  end

  def validate_image(attr, value)
    errors.add(attr, "must be a PNG, JPEG or WebP image") unless value.is_a?(String) && value.start_with?(*IMAGE_PREFIXES)
    errors.add(attr, "– each image must be under 2 MB") if value.to_s.bytesize > MAX_IMAGE_BYTES
  end
end
