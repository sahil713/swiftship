# Proofs a driver records on a task, kept against the job:
#   collection – Proof of Collection (POC): at least 1 photo; signature required unless switched off in Settings
#   depot      – items received at the depot: at least 1 photo, depot location and a signature
#   delivery   – Proof of Delivery (POD): at least 2 photos and the recipient's signature
# Changes to a saved proof go through #edit_by, which keeps the original values in the audit log.
class TaskProof < ApplicationRecord
  KINDS = %w[collection depot delivery].freeze
  MIN_PHOTOS = { "collection" => 1, "depot" => 1, "delivery" => 2 }.freeze
  MAX_PHOTOS = 8
  MAX_IMAGE_BYTES = 2.megabytes
  IMAGE_PREFIXES = ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"].freeze
  AUDITED_FIELDS = %w[person_name occurred_at notes location photos signature_data].freeze

  belongs_to :driver_task
  belongs_to :user, optional: true
  has_many :audit_logs, as: :auditable, dependent: :restrict_with_exception

  validates :kind, inclusion: { in: KINDS }, uniqueness: { scope: :driver_task_id }
  validates :person_name, :occurred_at, presence: true
  validates :location, presence: { message: "– enter the depot name or address" }, if: -> { kind == "depot" }
  validate :enough_photos
  validate :photos_are_images
  validate :signature_present_and_valid

  before_validation { self.photos = Array(photos).compact_blank }

  def self.collection_signature_required? = Setting.get(:require_collection_signature) != false

  def signature_required?
    kind == "collection" ? self.class.collection_signature_required? : true
  end

  # Applies a change and records what changed (old → new), who changed it and why.
  def edit_by(user, action:, reason: nil)
    before = attributes.slice(*AUDITED_FIELDS)
    yield
    changes = AUDITED_FIELDS.each_with_object({}) do |field, diff|
      old, new = before[field], public_send(field)
      next if old == new
      # Images are large: record that they changed and how many, not the image data itself.
      diff[field] = case field
                    when "photos" then ["#{Array(old).size} photo(s)", "#{Array(new).size} photo(s)"]
                    when "signature_data" then [old.present? ? "signature" : "none", new.present? ? "new signature" : "none"]
                    else [old, new]
                    end
    end
    AuditLog.record!(self, user:, action:, changes:, reason:)
  end

  def summary
    parts = ["#{photos.size} photo#{'s' unless photos.size == 1}"]
    parts << "signed by #{person_name}" if signature_data.present?
    parts << location if kind == "depot" && location.present?
    parts.join(" · ")
  end

  def as_json(*)
    slice(:id, :kind, :person_name, :occurred_at, :notes, :location, :signature_data, :photos, :created_at, :updated_at)
      .merge(recorded_by: user&.name, signature_required: signature_required?)
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
      errors.add(:signature_data, "– a signature is required") if signature_required?
    else
      validate_image(:signature_data, signature_data)
    end
  end

  def validate_image(attr, value)
    errors.add(attr, "must be a PNG, JPEG or WebP image") unless value.is_a?(String) && value.start_with?(*IMAGE_PREFIXES)
    errors.add(attr, "– each image must be under 2 MB") if value.to_s.bytesize > MAX_IMAGE_BYTES
  end
end
