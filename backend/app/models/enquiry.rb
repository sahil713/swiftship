class Enquiry < ApplicationRecord
  STATUSES = %w[open in_progress closed].freeze

  belongs_to :booking, optional: true

  validates :name, :subject, :message, presence: true
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :status, inclusion: { in: STATUSES }

  def as_json(*)
    slice(:id, :name, :email, :phone, :subject, :message, :status, :response, :created_at)
      .merge(booking_reference: booking&.reference)
  end
end
