class ChangeRequest < ApplicationRecord
  KINDS = %w[cancellation change].freeze
  STATUSES = %w[pending approved rejected].freeze

  belongs_to :booking
  belongs_to :user, optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }
  validates :details, presence: true, if: -> { kind == "change" }

  scope :pending, -> { where(status: "pending") }

  def as_json(*)
    slice(:id, :kind, :details, :status, :admin_response, :created_at, :updated_at)
  end
end
