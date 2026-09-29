class StatusEvent < ApplicationRecord
  belongs_to :booking
  belongs_to :user, optional: true

  validates :status, inclusion: { in: Booking::STATUSES }

  def as_json(*)
    slice(:id, :status, :location, :note, :customer_visible, :created_at)
      .merge(label: Booking.status_label(status), by: user&.name)
  end
end
