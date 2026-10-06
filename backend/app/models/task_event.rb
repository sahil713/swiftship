# One recorded action on a driver task (assigned, started, arrived, proof submitted, closed…).
class TaskEvent < ApplicationRecord
  LABELS = {
    "assigned" => "Assigned to driver", "reassigned" => "Reassigned", "unassigned" => "Removed from driver",
    "started" => "Set off", "arrived" => "Arrived at location", "collected" => "Proof of collection submitted",
    "arrived_delivery" => "Arrived at delivery address", "depot" => "Items checked in at depot – task closed",
    "pod_recorded" => "Proof of delivery submitted", "completed" => "Task closed – delivery completed",
    "cancelled" => "Task cancelled"
  }.freeze

  belongs_to :driver_task
  belongs_to :user, optional: true

  validates :action, inclusion: { in: LABELS.keys }

  def as_json(*)
    { id:, action:, label: LABELS[action], note:, occurred_at:, by: user&.name }
  end
end
