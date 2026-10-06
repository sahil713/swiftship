# A private document on a driver's profile (licence, passport, visa…). Stored in the database and
# only served to admins through an authenticated endpoint. Uploading a new document of the same
# type keeps the old one as history (replaced_at) rather than deleting it.
class DriverDocument < ApplicationRecord
  TYPES = { "licence" => "Driving licence", "passport" => "Passport", "visa" => "Visa / right to work", "other" => "Other document" }.freeze
  MAX_BYTES = 4.megabytes # also keeps uploads within the hosting proxy's request limit
  # Signatures of the file types we accept – the browser-supplied content type isn't trusted.
  MAGIC = {
    "application/pdf" => ->(b) { b.start_with?("%PDF") },
    "image/jpeg" => ->(b) { b.start_with?("\xFF\xD8\xFF".b) },
    "image/png" => ->(b) { b.start_with?("\x89PNG\r\n\x1A\n".b) },
    "image/webp" => ->(b) { b[0, 4] == "RIFF" && b[8, 4] == "WEBP" },
    "image/heic" => ->(b) { b[4, 4] == "ftyp" && %w[heic heix mif1 msf1 heis hevc].include?(b[8, 4]) }
  }.freeze

  belongs_to :user
  belongs_to :uploaded_by, class_name: "User", optional: true
  belongs_to :replaced_by, class_name: "User", optional: true

  validates :doc_type, inclusion: { in: TYPES.keys }
  validates :filename, :content_type, :data, presence: true
  validates :byte_size, numericality: { greater_than: 0, less_than_or_equal_to: MAX_BYTES, message: "must be 4 MB or smaller" }
  validate :content_matches_type

  scope :current, -> { where(replaced_at: nil) }
  scope :without_data, -> { select(column_names - ["data"]) }

  # Builds a document from an uploaded file, detecting its real type from the content.
  def self.from_upload(file, **attrs)
    bytes = file.read
    detected = MAGIC.find { |_, check| check.call(bytes[0, 16].to_s.b) }&.first
    new(attrs.merge(filename: File.basename(file.original_filename.to_s)[0, 200], content_type: detected || file.content_type.to_s,
                    byte_size: bytes.bytesize, data: bytes))
  end

  def as_json(*)
    { id:, doc_type:, type_label: TYPES[doc_type], filename:, content_type:, byte_size:, expires_on:, notes:,
      uploaded_at: created_at, uploaded_by: uploaded_by&.name, replaced_at:, replaced_by: replaced_by&.name }
  end

  private

  def content_matches_type
    return if data.blank?
    check = MAGIC[content_type]
    errors.add(:base, "Only PDF, JPEG, PNG, WebP or HEIC files can be uploaded") unless check&.call(data.to_s[0, 16].b)
  end
end
