# One recorded action on a driver task. Events are append-only: once saved they can't be
# changed or deleted, so the task history is a reliable audit trail.
class TaskEvent < ApplicationRecord
  LABELS = {
    "assigned" => "Task assigned", "reassigned" => "Task reassigned", "unassigned" => "Removed from driver",
    "started" => "Task started", "arrived_collection" => "Arrived at collection location",
    "collection_proof" => "Collection proof uploaded", "collection_signature" => "Collection signature received",
    "collection_proof_updated" => "Collection proof updated", "collection_completed" => "Collection completed",
    "depot" => "Items received and stored at depot", "depot_updated" => "Depot record updated",
    "arrived_delivery" => "Arrived at delivery location", "delivery_proof" => "Delivery photos uploaded",
    "delivery_signature" => "Customer signature received", "delivery_proof_updated" => "Delivery proof updated",
    "delivery_completed" => "Delivery completed", "closed" => "Task closed", "issue_reported" => "Problem reported",
    "proof_corrected" => "Record corrected by office", "cancelled" => "Task cancelled",
    # Labels for events recorded before the step-by-step workflow.
    "arrived" => "Arrived at location", "collected" => "Proof of collection submitted",
    "pod_recorded" => "Proof of delivery submitted", "completed" => "Task closed – delivery completed"
  }.freeze

  belongs_to :driver_task
  belongs_to :user, optional: true

  validates :action, inclusion: { in: LABELS.keys }

  def readonly? = persisted?

  def as_json(*)
    {
      id:, action:, label: LABELS[action], note:, occurred_at:, by: user&.name,
      location: (latitude && { latitude: latitude.to_f, longitude: longitude.to_f, accuracy_m: }),
    }
  end
end
