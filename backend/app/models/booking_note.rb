class BookingNote < ApplicationRecord
  KINDS = %w[internal collection_issue delivery_issue damage].freeze

  belongs_to :booking
  belongs_to :user, optional: true

  validates :body, presence: true
  validates :kind, inclusion: { in: KINDS }

  def as_json(*)
    slice(:id, :kind, :body, :created_at).merge(author: user&.name)
  end
end
