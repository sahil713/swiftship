# Immutable record of a change to data that was already recorded: original and new values,
# who changed it, when, and (for corrections) why.
class AuditLog < ApplicationRecord
  belongs_to :auditable, polymorphic: true
  belongs_to :user, optional: true

  validates :action, presence: true

  scope :newest_first, -> { order(created_at: :desc, id: :desc) }

  def readonly? = persisted?

  # changes: { "field" => [old, new] }
  def self.record!(auditable, user:, action:, changes:, reason: nil)
    return if changes.blank?
    create!(auditable:, user:, action:, changes_made: changes, reason: reason.presence, created_at: Time.current)
  end

  def as_json(*)
    { id:, action:, changes: changes_made, reason:, by: user&.name, at: created_at }
  end
end
