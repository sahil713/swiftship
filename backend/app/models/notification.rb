class Notification < ApplicationRecord
  belongs_to :booking, optional: true

  validates :channel, inclusion: { in: %w[email sms] }
  validates :recipient, :body, presence: true

  def as_json(*)
    slice(:id, :channel, :recipient, :subject, :body, :status, :created_at)
  end
end
