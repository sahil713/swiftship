# Proofs a driver records on a task, kept against the job:
#   collection – Proof of Collection (POC): at least 1 photo, signature optional
#   depot      – items checked in at the depot: at least 1 photo and a signature
#   delivery   – Proof of Delivery (POD): at least 2 photos and the recipient's signature
class TaskProof < ApplicationRecord
  KINDS = %w[collection depot delivery].freeze
  MIN_PHOTOS = { "collection" => 1, "depot" => 1, "delivery" => 2 }.freeze
  SIGNATURE_REQUIRED = %w[depot delivery].freeze
  MAX_PHOTOS = 8
  MAX_IMAGE_BYTES = 2.megabytes
  IMAGE_PREFIXES = ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"].freeze

  belongs_to :driver_task
  belongs_to :user, optional: true

  validates :kind, inclusion: { in: KINDS }, uniqueness: { scope: :driver_task_id }
  validates :person_name, :occurred_at, presence: true
  validate :enough_photos
  validate :photos_are_images
  validate :signature_present_and_valid

  before_validation { self.photos = Array(photos).compact_blank }

  def as_json(*)
    slice(:id, :kind, :person_name, :occurred_at, :notes, :signature_data, :photos, :created_at)
      .merge(recorded_by: user&.name)
  end

  private

  def enough_photos
    min = MIN_PHOTOS.fetch(kind, 1)
    errors.add(:photos, "– add at least #{min} photo#{'s' if min > 1}") if photos.size < min
  end

  def photos_are_images
    errors.add(:photos, "– up to #{MAX_PHOTOS} photos") if photos.size > MAX_PHOTOS
    photos.each { |photo| validate_image(:photos, photo) }
  end

  def signature_present_and_valid
    if signature_data.blank?
      errors.add(:signature_data, "– a signature is required") if SIGNATURE_REQUIRED.include?(kind)
    else
      validate_image(:signature_data, signature_data)
    end
  end

  def validate_image(attr, value)
    errors.add(attr, "must be a PNG, JPEG or WebP image") unless value.is_a?(String) && value.start_with?(*IMAGE_PREFIXES)
    errors.add(attr, "– each image must be under 2 MB") if value.to_s.bytesize > MAX_IMAGE_BYTES
  end
end
